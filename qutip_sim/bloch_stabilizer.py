"""
QuTiP simulation: phase noise on a data qubit, repeated stabilizer checks, Bloch-sphere animation.

Chain simulated here
    physical fluctuation δω(t)  →  H(t) = ½ δω(t) σz  (rotating frame, ħ = 1)
    →  qubit evolution solved numerically with QuTiP (sesolve, or mesolve with T1/T2)
    →  projective X-stabilizer measurement at each CNOT sample time
    →  syndrome s_r (+1 / −1)  →  detection event d_r = s_r ⊕ s_{r−1}

Because the noise is known, every round records the true phase accumulated in that
round (Δθ from ∫δω dt) and the phase measured from the QuTiP state just before the
projection. Detection events are labelled with that angle change.

Units: time in µs, angular frequency in rad/µs.

Example
    python bloch_stabilizer.py --f-khz 140 --tau-c-us 2 --noise ou --rounds 8 --seed 3
"""
import argparse, csv, json, os
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib import animation
import qutip as qt


# ----------------------------------------------------------------------------- parameters
def get_args():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--f-khz", type=float, default=140.0, help="frequency-shift scale in kHz (steady: the shift; OU: its RMS value)")
    p.add_argument("--noise", choices=["ou", "steady"], default="ou", help="noise type")
    p.add_argument("--tau-c-us", type=float, default=2.0, help="OU correlation time (µs)")
    p.add_argument("--onset-us", type=float, default=0.3, help="noise onset time (µs)")
    p.add_argument("--duration-us", type=float, default=7.0, help="noise duration (µs)")
    p.add_argument("--decay-us", type=float, default=0.0, help="amplitude decay time (µs); 0 = no decay")
    p.add_argument("--cycle-us", type=float, default=1.0, help="stabilizer cycle time T (µs)")
    p.add_argument("--sample-us", type=float, default=0.18, help="CNOT end (sample time) within the cycle (µs)")
    p.add_argument("--result-us", type=float, default=0.78, help="result available within the cycle (µs)")
    p.add_argument("--rounds", type=int, default=8)
    p.add_argument("--t1-us", type=float, default=0.0, help="T1 (µs); 0 = off")
    p.add_argument("--tphi-us", type=float, default=0.0, help="extra pure dephasing time Tφ (µs); 0 = off")
    p.add_argument("--dt-ns", type=float, default=1.0, help="noise grid step (ns)")
    p.add_argument("--frames-per-round", type=int, default=28)
    p.add_argument("--fps", type=int, default=14)
    p.add_argument("--seed", type=int, default=3)
    p.add_argument("--out", default=os.path.join(os.path.dirname(__file__), "output"))
    p.add_argument("--no-video", action="store_true", help="skip the animation (faster)")
    return p.parse_args()


# ----------------------------------------------------------------------------- noise
def make_noise(a, tgrid, rng):
    """δω(t) on the grid. OU noise has unit stationary variance (variance-normalized),
    so its strength does not change with τc; it is scaled by the peak shift A."""
    A = 2 * np.pi * a.f_khz * 1e-3               # kHz → rad/µs
    dt = tgrid[1] - tgrid[0]
    if a.noise == "ou":
        r = np.exp(-dt / a.tau_c_us)
        xi = np.empty_like(tgrid)
        xi[0] = rng.standard_normal()
        kicks = rng.standard_normal(len(tgrid)) * np.sqrt(1 - r * r)
        for i in range(1, len(tgrid)):
            xi[i] = r * xi[i - 1] + kicks[i]
    else:
        xi = np.ones_like(tgrid)
    on = (tgrid >= a.onset_us) & (tgrid < a.onset_us + a.duration_us)
    env = np.where(on, 1.0, 0.0)
    if a.decay_us > 0:
        env *= np.exp(-np.clip(tgrid - a.onset_us, 0, None) / a.decay_us)
    return A * env * xi


# ----------------------------------------------------------------------------- simulation
def bloch_xyz(rho):
    return np.array([qt.expect(qt.sigmax(), rho), qt.expect(qt.sigmay(), rho), qt.expect(qt.sigmaz(), rho)])


def simulate(a):
    rng = np.random.default_rng(a.seed)
    dt = a.dt_ns * 1e-3
    t_end = a.rounds * a.cycle_us
    tgrid = np.arange(0.0, t_end + dt, dt)
    dw = make_noise(a, tgrid, rng)

    # H(t) = ½ δω(t) σz with a piecewise-constant (order 0) coefficient on the noise grid.
    coeff = qt.coefficient(dw, tlist=tgrid, order=0)
    H = qt.QobjEvo([[0.5 * qt.sigmaz(), coeff]])
    c_ops = []
    if a.t1_us > 0:
        c_ops.append(np.sqrt(1 / a.t1_us) * qt.destroy(2))       # energy decay toward |0⟩
    if a.tphi_us > 0:
        c_ops.append(np.sqrt(1 / (2 * a.tphi_us)) * qt.sigmaz())  # extra pure dephasing
    opts = {"store_states": True, "atol": 1e-10, "rtol": 1e-8, "max_step": dt}

    plus = (qt.basis(2, 0) + qt.basis(2, 1)).unit()
    minus = (qt.basis(2, 0) - qt.basis(2, 1)).unit()
    rho = qt.ket2dm(plus)
    s_prev = 0
    frames, rounds = [], []
    t0 = 0.0
    for r in range(a.rounds):
        t_s = r * a.cycle_us + a.sample_us                         # CNOT sample time of round r
        tl = np.linspace(t0, t_s, a.frames_per_round + 1)
        res = qt.mesolve(H, rho, tl, c_ops=c_ops, options=opts)
        ref = +1 if s_prev == 0 else -1                            # current stabilizer eigenstate (+X or −X)
        for t, st in zip(tl, res.states):
            v = bloch_xyz(st)
            # Phase since the last check, measured from the QuTiP state relative to the current eigenstate.
            phi = np.degrees(np.arctan2(v[1] * ref, v[0] * ref))
            frames.append(dict(t=t, v=v, round=r + 1, phase_deg=phi, event=None))
        rho_pre = res.states[-1]
        v_pre = bloch_xyz(rho_pre)
        # True accumulated phase in this window from the known noise: Δθ = ∫ δω dt.
        i0, i1 = int(round(t0 / dt)), int(round(t_s / dt))
        dtheta_true = float(np.sum(dw[i0:i1]) * dt)
        dtheta_qutip = float(np.arctan2(v_pre[1] * ref, v_pre[0] * ref))
        # Projective measurement of the X stabilizer.
        p_minus = float(qt.expect(qt.ket2dm(minus), rho_pre).real)
        p_flip = p_minus if s_prev == 0 else 1 - p_minus
        s = int(rng.random() < p_minus)                            # 1 → |−⟩ (syndrome −1)
        rho = qt.ket2dm(minus if s else plus)
        d = s ^ s_prev
        rec = dict(round=r + 1, t_sample_us=round(t_s, 4), t_result_us=round(r * a.cycle_us + a.result_us, 4),
                   dtheta_true_deg=round(np.degrees(dtheta_true), 3), dtheta_qutip_deg=round(np.degrees(dtheta_qutip), 3),
                   bloch_length=round(float(np.linalg.norm(v_pre)), 4), p_flip=round(p_flip, 4),
                   syndrome="+1" if s == 0 else "-1", detection=d,
                   change=("+ → −" if s else "− → +") if d else "none")
        rounds.append(rec)
        # Hold frames showing the projection.
        v_post = bloch_xyz(rho)
        for k in range(6):
            frames.append(dict(t=t_s, v=v_post if k >= 2 else v_pre, round=r + 1,
                               phase_deg=0.0 if k >= 2 else np.degrees(dtheta_qutip), event=rec))
        s_prev, t0 = s, t_s
    return dict(tgrid=tgrid, dw=dw, frames=frames, rounds=rounds)


# ----------------------------------------------------------------------------- outputs
def save_tables(a, sim):
    os.makedirs(a.out, exist_ok=True)
    with open(os.path.join(a.out, "rounds.csv"), "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(sim["rounds"][0].keys()))
        w.writeheader(); w.writerows(sim["rounds"])
    with open(os.path.join(a.out, "summary.json"), "w") as f:
        json.dump(dict(parameters=vars(a), rounds=sim["rounds"]), f, indent=2)


def angle_figure(a, sim, path):
    """Phase since the last check vs time, with the angle change written at every check."""
    fr = sim["frames"]
    t = [x["t"] for x in fr]; ph = [x["phase_deg"] for x in fr]
    fig, (ax0, ax1) = plt.subplots(2, 1, figsize=(10, 6), sharex=True, gridspec_kw={"height_ratios": [1, 2]})
    ax0.plot(sim["tgrid"], sim["dw"] / (2 * np.pi) * 1e3, color="#D85A30", lw=1)
    ax0.set_ylabel("δω / 2π (kHz)"); ax0.set_title("Noise and accumulated phase (QuTiP)", loc="left", fontsize=12)
    ax1.plot(t, ph, color="#D85A30", lw=1.6, label="phase since last check (QuTiP state)")
    for rec in sim["rounds"]:
        ts = rec["t_sample_us"]
        ax1.axvline(ts, color="#378ADD", lw=0.8, alpha=0.6)
        col = "#993C1D" if rec["detection"] else "#5F5E5A"
        txt = f"R{rec['round']}\nΔθ={rec['dtheta_true_deg']:.1f}°" + (f"\nDETECTION\n{rec['change']}" if rec["detection"] else "")
        ax1.annotate(txt, (ts, rec["dtheta_qutip_deg"]), textcoords="offset points", xytext=(4, 8),
                     fontsize=8, color=col, fontweight="bold" if rec["detection"] else "normal")
        if rec["detection"]:
            ax1.plot(ts, rec["dtheta_qutip_deg"], "o", color="#D85A30", ms=8)
    ax1.axhline(0, color="#888780", lw=0.6)
    ax1.set_xlabel("time (µs)"); ax1.set_ylabel("phase since last check (deg)")
    ax1.legend(loc="lower left", fontsize=8, frameon=False)
    fig.tight_layout(); fig.savefig(path, dpi=130); plt.close(fig)


def animate(a, sim, base):
    fr = sim["frames"]
    fig = plt.figure(figsize=(9.6, 4.8))
    ax_b = fig.add_axes([0.0, 0.02, 0.5, 0.92], projection="3d")
    ax_t = fig.add_axes([0.54, 0.05, 0.44, 0.88]); ax_t.axis("off")
    b = qt.Bloch(fig=fig, axes=ax_b)
    trail = []

    def draw(i):
        f = fr[i]
        b.clear()
        b.vector_color = ["#D85A30"]; b.point_color = ["#F0997B"]; b.point_marker = ["o"]; b.point_size = [6]
        b.xlabel = ["|+⟩", "|−⟩"]; b.ylabel = ["", ""]; b.zlabel = ["|0⟩", "|1⟩"]
        if f["event"] is None:
            trail.append(f["v"])
        else:
            trail.clear()
        if len(trail) > 1:
            pts = np.array(trail[-40:]).T
            b.add_points(pts)
        b.add_vectors(f["v"])
        b.render()
        ax_b.set_title(f"t = {f['t']:.2f} µs   round {f['round']}", fontsize=11)
        ax_t.clear(); ax_t.axis("off")
        lines = [f"Phase since last check: {f['phase_deg']:+.1f}°", ""]
        done = [r for r in sim["rounds"] if r["t_sample_us"] <= f["t"] + 1e-9 and (f["event"] is not None or r["t_sample_us"] < f["t"])]
        lines.append("Round  Δθ (true)  P(flip)  syndrome  event")
        for r in done[-8:]:
            ev = f"DETECTION {r['change']}" if r["detection"] else "—"
            lines.append(f"R{r['round']:<5} {r['dtheta_true_deg']:+7.1f}°  {100 * r['p_flip']:5.1f}%     {r['syndrome']:>3}    {ev}")
        if f["event"] is not None:
            e = f["event"]
            lines += ["", f"Check R{e['round']}: Δθ = {e['dtheta_true_deg']:+.1f}° → P(flip) = {100 * e['p_flip']:.1f}%",
                      f"Outcome {e['syndrome']} : " + (f"detection, {e['change']}" if e["detection"] else "no change")]
        ax_t.text(0, 1, "\n".join(lines), va="top", ha="left", family="monospace", fontsize=8.4)
        return []

    anim = animation.FuncAnimation(fig, draw, frames=len(fr), interval=1000 / a.fps, blit=False)
    anim.save(base + ".mp4", writer=animation.FFMpegWriter(fps=a.fps, bitrate=1800))
    anim.save(base + ".gif", writer=animation.PillowWriter(fps=a.fps))
    plt.close(fig)


def main():
    a = get_args()
    sim = simulate(a)
    save_tables(a, sim)
    angle_figure(a, sim, os.path.join(a.out, "angle_changes.png"))
    if not a.no_video:
        animate(a, sim, os.path.join(a.out, "bloch_animation"))
    print(f"{'round':>5} {'Δθ true':>9} {'Δθ QuTiP':>9} {'P(flip)':>8} {'syn':>4} {'event':>10}")
    for r in sim["rounds"]:
        print(f"{r['round']:>5} {r['dtheta_true_deg']:>8.2f}° {r['dtheta_qutip_deg']:>8.2f}° {100 * r['p_flip']:>7.2f}% {r['syndrome']:>4} {r['change'] if r['detection'] else '—':>10}")
    print("outputs in", a.out)


if __name__ == "__main__":
    main()
