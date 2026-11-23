# Simulation 1 · From phase noise to error correction

An interactive walkthrough of the MSQT research project: how phase noise on a transmon qubit becomes stabilizer detection events, how long it takes a stabilizer to notice the noise, and how a minimum-weight perfect matching (MWPM) decoder turns detection events into a correction.

**Open it:** download the repo and open `index.html` in any browser, or enable GitHub Pages (Settings → Pages → Deploy from branch → `main` / root) to get a shareable link.

No install, no build step, no internet needed: plain HTML, CSS and JavaScript.

## Simulation Lab (`lab.html`)

Separate page for setting all noise and timing parameters of a weight-4 stabilizer:

- **Noise:** which qubit it starts on, start time, duration, decay time, peak strength (kHz), steady or OU-fluctuating (with memory τc)
- **Propagation:** spread to neighbouring qubits, delay per hop, strength kept per hop
- **Circuit timing:** ancilla reset, Hadamard, CNOT, readout, electronics delay, cycle time
- **Outputs:** an animated shot, a timeline of the noise on each qubit with the CNOT sample times and detections, and statistics over as many shots as you choose (detection probability, mean/median latency, detection rate per round)

- **Syndrome history:** after a run, open any shot to see its rounds as +1/−1 with result times and the hidden Z errors; detections by round (with clickable shot numbers); detections per shot; spacing between detections in the same shot (rounds and ns); a temporal-correlation check P(next | detection now) vs P(next); CSV export of the full history

Presets: typical transmon drift (15 kHz, OU), strong TLS burst (140 kHz), burst spreading across qubits, fast circuit (300 ns cycle).

## Walkthrough (`index.html`)

| Step | Topic | What you can do |
|---|---------|-----------------|
| 1 | A qubit, its phase, and the wrong rotation | Compare the correct spin with the noisy spin in the lab view and the rotating frame; add OU-style wandering noise; run a check |
| 2 | A tilt is a mix of "fine" and "flipped" | Set a tilt θ and see cos²(θ/2) vs sin²(θ/2); check 1,000 identical qubits |
| 3 | The stabilizer check, step by step | Step through reset → CNOT → measure → tilt erased → syndrome → detection event; run your own number of shots and recover the hidden phase per round |
| 4 | Measuring often | Quantum Zeno effect; mean detection latency vs cycle time T for OU noise with adjustable τc and strength |
| 5 | Four data qubits and the gate schedule | Weight-4 stabilizer with a 1,000 ns schedule; hit any qubit at any time (clean flip or gradual noise) and see which round the stabilizer fires in |
| 6 | The decoder: MWPM | Distance-3 surface code: explore pairings, play "you be the decoder", and run any number of random trials to compare logical vs physical error rates |
| 7 | The thesis | The full chain OU noise → Hamiltonian → tilt → circuit faults → syndromes → decoder, the three memory times, and the experiment plan P0–P5 |

## QuTiP simulation (`qutip.html`, `qutip_sim/`)

`qutip_sim/bloch_stabilizer.py` evolves a data qubit under H(t) = ½δω(t)σz with QuTiP (`mesolve`, optional T₁/Tφ), applies a projective X-stabilizer check each round, and labels every check with the accumulated phase Δθ (from the known noise and from the QuTiP state; they agree to 0.01°). Outputs a Bloch-sphere MP4, an angle-change plot, `rounds.csv` and `summary.json`.

```
pip install -r qutip_sim/requirements.txt
python qutip_sim/bloch_stabilizer.py --f-khz 140 --noise ou --tau-c-us 2 --rounds 8 --seed 3
```

The Lab's syndrome history also shows the per-qubit Δθ for every round and includes it in the CSV.

## Model scope

Implemented: frequency-noise fluctuation δω(t) (steady or variance-normalized OU) → two-level Hamiltonian H = ħδωZ/2 → exact phase evolution → Z error with P = sin²(θ/2) → weight-4 syndrome over repeated rounds → detection events and timing. Step 6 MWPM is a single-round teaching example.

Not yet implemented: multilevel transmon Hamiltonian and gate pulses, T₁/T₂ and leakage, correlated multi-qubit (entangled) dynamics, gate and measurement errors, full distance-3 circuit, space-time MWPM with correlation-aware weights. These are planned for a Python research version.

## Model notes

- Every qubit is drawn as a 3-D Bloch sphere (|0⟩ and |1⟩ at the poles, |+⟩ and |−⟩ on the equator). In Steps 1 and 2 you can drag a sphere to turn it.

- Noise is a frequency shift δω(t) on each data qubit, giving a Z rotation θ = ∫δω dt. OU noise uses dξ = −(ξ/τc)dt + σdW with stationary variance V = σ²τc/2.
- A stabilizer check projects a tilt θ into "no error" (probability cos²(θ/2)) or a full Z flip (probability sin²(θ/2)).
- Detection event d_r = s_r ⊕ s_(r−1).
- Gate and readout timings (reset 100 ns, H 20 ns, CNOT 60 ns, readout 300 ns, electronics delay 100 ns, 1,000 ns cycle) are illustrative dummy values, not device data.
- Step 5 and the Lab treat the four data qubits independently, which gives the correct timing of when the stabilizer fires; a real surface code keeps them in a shared entangled state.
- Step 6 uses one perfect round of X checks (code-capacity Z noise). Real decoders match in space and time across many noisy rounds.

## Files

```
index.html          walkthrough (Steps 1–7)
css/style.css       styles (light and dark mode)
js/common.js        shared helpers (globe drawing, flip probability)
js/ch{i}-phase.js     Step 1
js/ch{i}-tilt.js      Step 2
js/ch{i}-check.js     Step 3
js/ch{i}-zeno.js      Step 4
js/ch{i}-schedule.js  Step 5
js/ch{i}-mwpm.js      Step 6
lab.html            Simulation Lab page
qutip.html          QuTiP results page
qutip_sim/          QuTiP script, requirements and outputs
js/ch8-lab.js       Simulation Lab model and drawing
```
