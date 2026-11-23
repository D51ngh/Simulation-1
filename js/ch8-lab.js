// Simulation Lab.
// One X stabilizer with four data qubits (Q1 top, Q2 right, Q3 bottom, Q4 left).
// The user controls the noise (start time, duration, decay, strength, memory, propagation)
// and the circuit timing (reset, Hadamard, CNOT, readout, electronics delay, cycle time).
// Time step: 1 ns. Noise acts as a frequency shift δω_q(t) on each data qubit (Z rotation).
(() => {
  const $ = SIM.$, T_ = SIM.t;
  const NR = 8;
  const POS = [[150, 62], [250, 150], [150, 238], [50, 150]];

  // ---------------- parameters ----------------
  const ids = {
    nq: 'lab-nq', tn: 'lab-tn', dur: 'lab-dur', td: 'lab-td', f: 'lab-f', type: 'lab-type', tc: 'lab-tc',
    prop: 'lab-prop', hop: 'lab-hop', keep: 'lab-keep',
    reset: 'lab-reset', h: 'lab-h', cnot: 'lab-cnot', ro: 'lab-ro', delay: 'lab-delay', T: 'lab-T', speed: 'lab-speed'
  };
  const units = { tn: ' ns', dur: ' ns', tc: ' ns', hop: ' ns', reset: ' ns', h: ' ns', cnot: ' ns', ro: ' ns', delay: ' ns', T: ' ns', speed: ' ns/s' };
  function P() {
    const v = k => $(ids[k]).type === 'checkbox' ? $(ids[k]).checked : $(ids[k]).value;
    const p = {
      nq: +v('nq'), tn: +v('tn'), dur: +v('dur'), td: +v('td'), fMHz: +v('f'), type: v('type'), tc: +v('tc'),
      prop: v('prop'), hop: +v('hop'), keep: +v('keep'),
      reset: +v('reset'), h: +v('h'), cnot: +v('cnot'), ro: +v('ro'), delay: +v('delay'), Tset: +v('T')
    };
    p.A = 2 * Math.PI * p.fMHz * 1e-3; // peak frequency shift in rad/ns
    p.noDecay = p.td >= 20000;
    // Schedule inside one cycle.
    let t = 0; const s = {};
    s.reset = [t, t += p.reset]; s.h1 = [t, t += p.h];
    s.cnot = [0, 1, 2, 3].map(() => [t, t += p.cnot]);
    s.h2 = [t, t += p.h]; s.ro = [t, t += p.ro];
    s.meas = t; s.res = t + p.delay; s.min = t;
    p.T = Math.max(p.Tset, s.min);
    p.s = s;
    // Simulate a little past the last round so its answer can still arrive.
    p.N = NR * p.T + Math.max(0, s.res - p.T) + 1;
    return p;
  }
  // Number of propagation hops from the starting qubit to qubit q (clockwise Q1→Q2→Q3→Q4).
  const hopsTo = (p, q) => (q - p.nq + 4) % 4;
  // Noise envelope on qubit q at time t (ns): 0 outside its window, decays inside it.
  function env(p, q, t) {
    const h = hopsTo(p, q);
    if (h > 0 && !p.prop) return 0;
    const t0 = p.tn + h * p.hop;
    if (t < t0 || t >= t0 + p.dur) return 0;
    return Math.pow(p.keep, h) * (p.noDecay ? 1 : Math.exp(-(t - t0) / p.td));
  }
  function randn() { let u = 0; while (!u) u = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * Math.random()); }

  // ---------------- one shot ----------------
  // record = true keeps per-ns angles and δω for the animation and timeline.
  function shot(p, record) {
    const N = p.N, shift = 3 * p.hop + 1;
    const xi = new Float32Array(N + shift + 1);
    if (p.type === 'ou') {
      const a = Math.exp(-1 / p.tc), b = Math.sqrt(1 - a * a);
      xi[0] = randn();
      for (let i = 1; i < xi.length; i++) xi[i] = a * xi[i - 1] + b * randn();
    } else xi.fill(1);
    const base = [0, 0, 0, 0], tilt = [0, 0, 0, 0], samp = [0, 0, 0, 0], pend = [0, 0, 0, 0];
    const pendS = [], s = [], d = [], flips = [];
    const ang = record ? new Float32Array(4 * N) : null, dw = record ? new Float32Array(4 * N) : null;
    let first = null;
    const S = p.s;
    for (let t = 0; t < N; t++) {
      for (let q = 0; q < 4; q++) {
        const e = env(p, q, t);
        const w = e ? p.A * e * xi[t + shift - hopsTo(p, q) * p.hop] : 0;
        tilt[q] += w;
        if (record) { ang[q * N + t] = base[q] * Math.PI + tilt[q]; dw[q * N + t] = w; }
      }
      const te = t + 1, r = Math.floor(te / p.T), tc = te - r * p.T;
      for (let q = 0; q < 4; q++) if (tc === S.cnot[q][1]) { samp[q] = base[q]; pend[q] = tilt[q]; } // the check looks at qubit q
      if (tc === S.meas) {                                                                          // the tag is read
        let par = 0; const f = [0, 0, 0, 0];
        for (let q = 0; q < 4; q++) {
          f[q] = Math.random() < SIM.pFlip(pend[q]) ? 1 : 0;
          par ^= samp[q] ^ f[q]; base[q] ^= f[q]; tilt[q] -= pend[q]; pend[q] = 0;
        }
        pendS[r] = par; flips[r] = f;
      }
      const k = te - S.res;                                                                          // the answer arrives
      if (k >= 0 && k % p.T === 0) {
        const rr = k / p.T;
        if (rr < NR && pendS[rr] !== undefined && s.length === rr) {
          const prev = rr ? s[rr - 1] : 0, dd = pendS[rr] ^ prev;
          s.push(pendS[rr]); d.push(dd);
          if (dd && !first) first = { r: rr + 1, t: te };
        }
      }
    }
    return { s, d, flips, first, ang, dw };
  }

  // ---------------- state & drawing ----------------
  let p = P(), cur = shot(p, true), t = 0, playing = false, last = 0;

  function phaseText(tc) {
    const S = p.s;
    if (tc < S.reset[1]) return 'Reset to |0⟩';
    if (tc < S.h1[1]) return 'H: now |+⟩';
    for (let q = 0; q < 4; q++) if (tc < S.cnot[q][1]) return 'CNOT Q' + (q + 1);
    if (tc < S.h2[1]) return 'H';
    if (tc < S.ro[1]) return 'Reading…';
    return 'Idle';
  }
  function drawLive() {
    const ti = Math.min(Math.floor(t), p.N - 1), r = Math.floor(ti / p.T), tc = ti - r * p.T;
    const S = p.s, act = S.cnot.findIndex(([a, b]) => tc >= a && tc < b);
    const resT = r * p.T + S.res, fired = cur.d.length > r && cur.d[r] === 1 && ti >= resT && ti < resT + 0.35 * p.T;
    let h = '';
    POS.forEach(([x, y], q) => h += `<line x1="150" y1="150" x2="${x}" y2="${y}" stroke="${act === q ? 'var(--accent)' : 'var(--border-strong)'}" stroke-width="${act === q ? 4 : 1.5}"/>`);
    h += `<circle cx="150" cy="150" r="40" fill="${fired ? 'var(--coral-bg)' : 'var(--surface)'}" stroke="${fired ? 'var(--coral)' : act >= 0 ? 'var(--accent)' : 'var(--border-strong)'}" stroke-width="${fired || act >= 0 ? 2.5 : 1}"/>`;
    h += T_(150, 144, 'Ancilla', { s: 11, c: 'var(--text2)' }) + T_(150, 162, fired ? 'FIRED' : phaseText(tc), { s: 11, w: 600, c: fired ? 'var(--coral-dark)' : 'var(--text)' });
    POS.forEach(([x, y], q) => {
      const R = 30, a = cur.ang[q * p.N + ti], noisy = Math.abs(cur.dw[q * p.N + ti]) > 0;
      h += SIM.blochSVG(x, y, R, 0, a, { small: true, ring: noisy ? 'var(--coral)' : null, ringW: noisy ? 2.5 : 1 });
      const lx = q === 3 ? x : x, ly = q === 0 ? y - R - 8 : y + R + 14;
      h += T_(lx, ly, `Q${q + 1} · ${SIM.deg(a)}°`, { s: 11, w: 600, c: noisy ? 'var(--coral-dark)' : 'var(--text)' });
    });
    h += T_(150, 296, `round ${Math.min(r + 1, NR)} of ${NR} · t = ${ti} ns`, { s: 12, c: 'var(--text2)' });
    $('lab-live').innerHTML = h;

    // Schedule bar for one cycle.
    const W = 360, X = v => 10 + v / p.T * (W - 20);
    const segs = [[S.reset, 'Reset', 'none'], [S.h1, 'H', 'none'], ...S.cnot.map((c, q) => [c, 'Q' + (q + 1), 'var(--accent-bg)']), [S.h2, 'H', 'none'], [S.ro, 'Readout', 'var(--neutral)'], [[S.ro[1], p.T], 'Idle', 'none']];
    let g = T_(10, 16, `One round: T = ${p.T} ns${p.T > p.Tset ? ' (extended to fit operations)' : ''}`, { a: 'start', s: 12, c: 'var(--text2)' });
    segs.forEach(([[a, b], l, fill]) => {
      if (b <= a) return;
      g += `<rect x="${X(a)}" y="26" width="${X(b) - X(a)}" height="26" fill="${fill}" stroke="var(--border-strong)" stroke-width="0.75"/>`;
      if (X(b) - X(a) > 7 * l.length) g += T_((X(a) + X(b)) / 2, 43, l, { s: 10.5, c: fill === 'var(--accent-bg)' ? 'var(--accent)' : 'var(--text2)' });
    });
    if (S.res <= p.T) g += `<line x1="${X(S.res)}" y1="22" x2="${X(S.res)}" y2="56" stroke="var(--teal)" stroke-width="2"/>` + T_(X(S.res), 68, 'answer', { s: 10.5, c: 'var(--teal)' });
    else g += T_(W - 10, 68, `answer ${S.res - p.T} ns into next cycle`, { a: 'end', s: 10.5, c: 'var(--teal)' });
    g += `<line x1="${X(tc)}" y1="22" x2="${X(tc)}" y2="56" stroke="var(--text)" stroke-width="2"/>`;
    $('lab-sched').innerHTML = g;
  }

  // Timeline of the whole shot: noise on each qubit, CNOT sample times, detections.
  function drawTimeline() {
    const W = 680, L = 60, Rr = 648, X = v => L + v / p.N * (Rr - L), lane = q => 52 + q * 42;
    let max = 0; for (let i = 0; i < cur.dw.length; i += 3) max = Math.max(max, Math.abs(cur.dw[i]));
    max = max || 1;
    let h = T_(L, 14, 'Frequency error δω per qubit (orange), CNOT sample times (blue), detections (top)', { a: 'start', s: 11.5, c: 'var(--text2)' });
    for (let r = 0; r <= NR; r++) h += `<line x1="${X(r * p.T)}" y1="24" x2="${X(r * p.T)}" y2="222" stroke="var(--border)"/>`;
    for (let r = 0; r < NR; r++) {
      h += T_(X(r * p.T + p.T / 2), 36, 'R' + (r + 1), { s: 11, c: 'var(--muted)' });
      if (cur.d[r] === 1) { const x = X(Math.min(p.N - 1, r * p.T + p.s.res)); h += `<circle cx="${x}" cy="31" r="5" fill="var(--coral)"/>`; }
    }
    for (let q = 0; q < 4; q++) {
      const y = lane(q);
      h += T_(10, y + 4, 'Q' + (q + 1), { a: 'start', s: 12, w: 600 });
      h += `<line x1="${L}" y1="${y}" x2="${Rr}" y2="${y}" stroke="var(--border)" />`;
      let pts = [];
      const step = Math.max(1, Math.floor(p.N / 600));
      for (let i = 0; i < p.N; i += step) pts.push(`${X(i).toFixed(1)},${(y - 15 * cur.dw[q * p.N + i] / max).toFixed(1)}`);
      h += `<polyline points="${pts.join(' ')}" fill="none" stroke="var(--coral)" stroke-width="1.5"/>`;
      for (let r = 0; r < NR; r++) { const x = X(r * p.T + p.s.cnot[q][1]); h += `<line x1="${x}" y1="${y - 6}" x2="${x}" y2="${y + 6}" stroke="var(--accent)" stroke-width="2"/>`; }
      cur.flips.forEach((f, r) => { if (f && f[q]) h += T_(X(r * p.T + p.s.meas), y + 18, 'flip', { s: 10, c: 'var(--coral-dark)', w: 600 }); });
    }
    h += `<line x1="${X(p.tn)}" y1="24" x2="${X(p.tn)}" y2="222" stroke="var(--coral)" stroke-dasharray="4 4"/>` + T_(X(p.tn), 236, 'noise starts', { s: 11, c: 'var(--coral-dark)' });
    h += `<line x1="${X(t)}" y1="24" x2="${X(t)}" y2="222" stroke="var(--text)" stroke-width="1.5"/>`;
    [0, 0.25, 0.5, 0.75, 1].forEach(f => h += T_(X(f * p.N), 252, Math.round(f * p.N / 1000 * 10) / 10 + ' µs', { s: 10.5, c: 'var(--muted)' }));
    $('lab-time').innerHTML = h;
  }

  function summary() {
    const el = $('lab-ans');
    const peakKHz = Math.round(p.fMHz * 1000);
    const parts = [`<b>Noise:</b> ${peakKHz} kHz on Q${p.nq + 1}, ${p.tn}–${p.tn + p.dur} ns${p.noDecay ? ', no decay' : `, t<sub>d</sub> = ${p.td} ns`}${p.type === 'ou' ? `, OU (τc = ${p.tc} ns)` : ', steady'}${p.prop ? `; propagates clockwise, ${p.hop} ns and ${Math.round(p.keep * 100)}% per hop` : ''}.`];
    if (t >= p.N - 1 || !playing) {
      if (cur.first && cur.first.t <= t + 1) parts.push(`<b>This shot:</b> first detection in round ${cur.first.r}, result at ${cur.first.t} ns. <b>Latency: ${cur.first.t - p.tn} ns.</b>`);
      else if (t >= p.N - 1) parts.push('<b>This shot:</b> no detection in 8 rounds.');
    } else if (cur.first && cur.first.t <= t) parts.push(`<b>Detected in round ${cur.first.r}.</b> Latency ${cur.first.t - p.tn} ns.`);
    el.innerHTML = parts.join('<br>');
  }

  function render() { drawLive(); drawTimeline(); summary(); }

  // ---------------- many shots + syndrome history ----------------
  let hist = null, sel = 0;
  function runStats(SHOTS) {
    const lat = [], byRound = Array(NR).fill(0), recs = [];
    let det = 0;
    for (let i = 0; i < SHOTS; i++) {
      const o = shot(p, false);
      o.d.forEach((v, r) => byRound[r] += v);
      if (o.first) { det++; lat.push(o.first.t - p.tn); }
      recs.push({ s: o.s, d: o.d, flips: o.flips, first: o.first });
    }
    lat.sort((a, b) => a - b);
    const mean = lat.length ? lat.reduce((a, b) => a + b, 0) / lat.length : 0, med = lat.length ? lat[Math.floor(lat.length / 2)] : 0;
    $('lab-stats').innerHTML = `<div class="stats">
      <div class="stat"><span>Shots with a detection</span><b>${(100 * det / SHOTS).toFixed(1)}%</b></div>
      <div class="stat"><span>Mean latency</span><b>${det ? Math.round(mean) + ' ns' : '—'}</b></div>
      <div class="stat"><span>Median latency</span><b>${det ? Math.round(med) + ' ns' : '—'}</b></div></div>
      <table class="simple"><tr><th>Round</th>${byRound.map((_, r) => `<th>R${r + 1}</th>`).join('')}</tr>
      <tr><td>Detection rate</td>${byRound.map(k => `<td>${(100 * k / SHOTS).toFixed(1)}%</td>`).join('')}</tr></table>
      <p class="note">${SHOTS.toLocaleString()} shots × ${NR} rounds = ${(SHOTS * NR).toLocaleString()} syndrome measurements. Latency: noise onset to arrival of the first detection result. Statistical uncertainty ≈ ±${(100 / Math.sqrt(SHOTS)).toFixed(1)}%.</p>`;
    hist = { n: SHOTS, T: p.T, res: p.s.res, tn: p.tn, recs };
    sel = Math.max(0, recs.findIndex(r => r.first));
    $('lab-hist').style.display = '';
    $('lab-shot').max = SHOTS; $('lab-shoterr').textContent = '';
    renderHistory();
  }

  const resTime = r => r * hist.T + hist.res;                 // arrival time of round r's result (0-based r)
  const sign = b => b ? '−1' : '+1';                         // syndrome bit → stabilizer eigenvalue
  const qList = f => f ? f.map((v, q) => v ? 'Q' + (q + 1) : null).filter(Boolean).join(', ') : '';

  function renderShot() {
    const rec = hist.recs[sel];
    $('lab-shot').value = sel + 1;
    const cells = (fn) => rec.s.map((_, r) => `<td>${fn(r)}</td>`).join('');
    $('lab-shotview').innerHTML = `<table class="simple" style="text-align:center">
      <tr><th style="text-align:left">Shot ${sel + 1}</th>${rec.s.map((_, r) => `<th>R${r + 1}</th>`).join('')}</tr>
      <tr><td style="text-align:left">Result time (ns)</td>${cells(r => resTime(r))}</tr>
      <tr><td style="text-align:left">Syndrome</td>${cells(r => `<b style="color:${rec.s[r] ? 'var(--coral-dark)' : 'var(--text)'}">${sign(rec.s[r])}</b>`)}</tr>
      <tr><td style="text-align:left">Detection</td>${cells(r => rec.d[r] ? '<span class="tag bad">yes</span>' : '—')}</tr>
      <tr><td style="text-align:left">Z errors (hidden)</td>${cells(r => qList(rec.flips[r]) || '—')}</tr></table>
      <p class="note">${rec.first ? `First detection: round ${rec.first.r}, ${rec.first.t} ns, ${rec.first.t - hist.tn} ns after onset.` : 'No detection in this shot.'} Syndrome +1 = even parity, −1 = odd parity.</p>`;
  }

  function renderHistory() {
    const H = hist, N = H.n, R = NR;
    renderShot();
    // Detections per round, with the shots involved.
    const perRound = Array.from({ length: R }, () => []);
    H.recs.forEach((rec, i) => rec.d.forEach((v, r) => { if (v) perRound[r].push(i); }));
    $('lab-round').innerHTML = `<table class="simple"><tr><th>Round</th><th>Result at</th><th>Time after onset</th><th>Shots</th><th>Shot numbers (click to open)</th></tr>${perRound.map((list, r) =>
      `<tr><td>R${r + 1}</td><td>${resTime(r)} ns</td><td>${resTime(r) - H.tn} ns</td><td>${list.length}</td><td>${list.slice(0, 12).map(i => `<a href="#" data-shot="${i}" style="color:var(--accent)">${i + 1}</a>`).join(', ')}${list.length > 12 ? ` … +${list.length - 12}` : ''}</td></tr>`).join('')}</table>`;
    // Detections per shot and spacing between consecutive detections in the same shot.
    const count = [0, 0, 0, 0], gaps = Array(R).fill(0); let pairs = 0;
    H.recs.forEach(rec => {
      const rs = rec.d.map((v, r) => v ? r : -1).filter(r => r >= 0);
      count[Math.min(3, rs.length)]++;
      for (let k = 1; k < rs.length; k++) { gaps[rs[k] - rs[k - 1]]++; pairs++; }
    });
    $('lab-spacing').innerHTML = `<div class="two"><table class="simple"><tr><th>Detections per shot</th><th>Shots</th><th>%</th></tr>${count.map((c, k) => `<tr><td>${k === 3 ? '3 or more' : k}</td><td>${c}</td><td>${(100 * c / N).toFixed(1)}%</td></tr>`).join('')}</table>
      <table class="simple"><tr><th>Spacing</th><th>Time apart</th><th>Pairs</th><th>%</th></tr>${gaps.map((c, g) => g ? `<tr><td>${g} round${g > 1 ? 's' : ''}</td><td>${g * H.T} ns</td><td>${c}</td><td>${pairs ? (100 * c / pairs).toFixed(1) : '0.0'}%</td></tr>` : '').join('')}</table></div>
      <p class="note">Spacing: time between consecutive detection events within the same shot (${pairs} pairs). Short spacings indicate correlated or persistent noise.</p>`;
    // Memory check: does a detection in round r make one in round r+1 more likely?
    let rows = '';
    for (let r = 0; r < R - 1; r++) {
      let a = 0, ab = 0, b = 0;
      H.recs.forEach(rec => { if (rec.d[r]) { a++; if (rec.d[r + 1]) ab++; } if (rec.d[r + 1]) b++; });
      const cond = a ? ab / a : null, base = b / N;
      rows += `<tr><td>R${r + 1} → R${r + 2}</td><td>${(100 * base).toFixed(1)}%</td><td>${cond === null ? '—' : (100 * cond).toFixed(1) + '%'}</td><td>${a}</td><td>${cond !== null && base > 0 ? (cond / base).toFixed(2) : '—'}</td></tr>`;
    }
    $('lab-memory').innerHTML = `<table class="simple"><tr><th>Rounds</th><th>P(detection in next round)</th><th>P(next | detection now)</th><th>Shots with detection now</th><th>Ratio</th></tr>${rows}</table>
      <p class="note">Ratio ≈ 1: consecutive detections are independent. Ratio &gt; 1: detections cluster in time. Ratios based on few shots are unreliable.</p>`;
    document.querySelectorAll('#lab-round a[data-shot]').forEach(a => a.onclick = e => { e.preventDefault(); sel = +a.dataset.shot; renderShot(); $('lab-shotview').scrollIntoView({ block: 'nearest' }); });
  }

  function csv() {
    const H = hist, lines = ['shot,round,result_time_ns,syndrome,detection,z_errors_hidden'];
    H.recs.forEach((rec, i) => rec.s.forEach((b, r) => lines.push(`${i + 1},${r + 1},${resTime(r)},${sign(b)},${rec.d[r]},"${qList(rec.flips[r])}"`)));
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }));
    a.download = 'syndrome_history.csv'; a.click(); URL.revokeObjectURL(a.href);
  }
  function go(i) { if (!hist) return; $('lab-shoterr').textContent = ''; sel = Math.min(hist.n - 1, Math.max(0, i)); renderShot(); }
  $('lab-prev').onclick = () => go(sel - 1);
  $('lab-next').onclick = () => go(sel + 1);
  $('lab-nextdet').onclick = () => { if (!hist) return; for (let k = 1; k <= hist.n; k++) { const i = (sel + k) % hist.n; if (hist.recs[i].first) return go(i); } };
  $('lab-shot').oninput = () => { const v = Number($('lab-shot').value); if (hist && Number.isInteger(v) && v >= 1 && v <= hist.n) { $('lab-shoterr').textContent = ''; go(v - 1); } else if (hist) $('lab-shoterr').textContent = `Enter a shot number from 1 to ${hist.n}.`; };
  $('lab-csv').onclick = () => hist && csv();

  function newShot() { p = P(); cur = shot(p, true); t = 0; hist = null; $('lab-hist').style.display = 'none'; $('lab-stats').innerHTML = '<p class="note">Set the number of shots and press Run.</p>'; render(); }
  function loop(ts) {
    const dt = (ts - last) / 1000; last = ts;
    if (playing) { t = Math.min(p.N - 1, t + Math.min(dt, 0.1) * +$(ids.speed).value); if (t >= p.N - 1) { playing = false; $('lab-play').textContent = 'Play'; } render(); }
    requestAnimationFrame(loop);
  }

  // ---------------- controls ----------------
  function label(k) {
    const el = $(ids[k]), out = $(ids[k] + 'v'); if (!out) return;
    let v = el.value;
    if (k === 'f') { v = Math.round(+v * 1000) + ' kHz'; const hi = +el.value > 0.14; $('lab-fhint').textContent = hi ? 'Above the typical 5–140 kHz range: exaggerated for illustration.' : 'Typical transmon range: 5–140 kHz.'; $('lab-fhint').style.color = hi ? 'var(--coral-dark)' : ''; }
    else if (k === 'keep') v = Math.round(+v * 100) + '%';
    else if (k === 'td') v = +v >= 20000 ? 'none' : v + ' ns';
    else v = v + (units[k] || '');
    out.textContent = v;
  }
  Object.keys(ids).forEach(k => {
    const el = $(ids[k]); label(k);
    el.addEventListener(el.tagName === 'SELECT' || el.type === 'checkbox' ? 'change' : 'input', () => {
      label(k); if (k === 'speed') return;
      playing = false; $('lab-play').textContent = 'Play'; newShot();
    });
  });
  const presets = {
    typical: { f: 0.015, dur: 6000, td: 20000, type: 'ou', tc: 2000, prop: false, tn: 300 },
    burst: { f: 0.14, dur: 1500, td: 800, type: 'steady', prop: false, tn: 300 },
    spread: { f: 0.25, dur: 2000, td: 1500, type: 'steady', prop: true, hop: 400, keep: 0.8, tn: 300 },
    fast: { reset: 40, h: 10, cnot: 30, ro: 100, delay: 50, T: 300 }
  };
  document.querySelectorAll('[data-preset]').forEach(b => b.onclick = () => {
    const pr = presets[b.dataset.preset];
    Object.entries(pr).forEach(([k, v]) => { const el = $(ids[k]); if (el.type === 'checkbox') el.checked = v; else el.value = v; label(k); });
    playing = false; $('lab-play').textContent = 'Play'; newShot();
  });
  $('lab-play').onclick = () => { if (t >= p.N - 1) t = 0; playing = !playing; $('lab-play').textContent = playing ? 'Pause' : 'Play'; };
  $('lab-new').onclick = () => { playing = false; $('lab-play').textContent = 'Play'; newShot(); };
  $('lab-end').onclick = () => { playing = false; $('lab-play').textContent = 'Play'; t = p.N - 1; render(); };
  $('lab-run').onclick = () => {
    const n = SIM.readCount('lab-n', 'lab-err', 10, 20000);
    if (n === null) return;
    $('lab-stats').innerHTML = `<p class="note">Running ${n.toLocaleString()} shots…</p>`;
    setTimeout(() => runStats(n), 20);
  };
  newShot();
  requestAnimationFrame(ts => { last = ts; loop(ts); });

  // Exposed for automated tests.
  window.LAB = { P, shot, env };
})();
