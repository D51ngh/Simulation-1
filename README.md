# Simulation 1 · From phase noise to error correction

An interactive, beginner-friendly walkthrough of the MSQT research project: how phase noise on a transmon qubit becomes stabilizer detection events, how long it takes a stabilizer to notice the noise, and how a minimum-weight perfect matching (MWPM) decoder turns detection events into a correction.

**Open it:** download the repo and open `index.html` in any browser, or enable GitHub Pages (Settings → Pages → Deploy from branch → `main` / root) to get a shareable link.

No install, no build step, no internet needed: plain HTML, CSS and JavaScript.

## Simulation Lab (`lab.html`)

A separate page where you control every parameter yourself and see when a weight-4 stabilizer first detects the noise:

- **Noise:** which qubit it starts on, start time, duration, decay time, peak strength (kHz), steady or OU-fluctuating (with memory τc)
- **Propagation:** spread to neighbouring qubits, delay per hop, strength kept per hop
- **Circuit timing:** ancilla reset, Hadamard, CNOT, readout, electronics delay, cycle time
- **Outputs:** an animated shot, a timeline of the noise on each qubit with the CNOT sample times and detections, and 2,000-shot statistics (detection probability, mean/median latency, detection rate per round)

Presets: typical transmon drift (15 kHz, OU), strong TLS burst (140 kHz), burst spreading across qubits, fast circuit (300 ns cycle).

## Chapters

| # | Chapter | What you can do |
|---|---------|-----------------|
| 1 | A qubit, its phase, and the wrong rotation | Compare the correct spin with the noisy spin in the lab view and the rotating frame; add OU-style wandering noise; run a check |
| 2 | A tilt is a mix of "fine" and "flipped" | Set a tilt θ and see cos²(θ/2) vs sin²(θ/2); check 1,000 identical qubits |
| 3 | The stabilizer check, step by step | Step through reset → CNOT → measure → tilt erased → syndrome → detection event; run 2,000 shots and recover the hidden phase per round |
| 4 | Measuring often | Quantum Zeno effect; mean detection latency vs cycle time T for OU noise with adjustable τc and strength |
| 5 | Four data qubits and the gate schedule | Weight-4 stabilizer with a 1,000 ns schedule; hit any qubit at any time (clean flip or gradual noise) and see which round the stabilizer fires in |
| 6 | The decoder: MWPM | Distance-3 surface code: explore pairings, play "you be the decoder", and run 20,000 random shots to compare logical vs physical error rates |
| 7 | The thesis | The full chain OU noise → Hamiltonian → tilt → circuit faults → syndromes → decoder, the three memory times, and the experiment plan P0–P5 |

## Model notes

- Noise is a frequency shift δω(t) on each data qubit, giving a Z rotation θ = ∫δω dt. OU noise uses dξ = −(ξ/τc)dt + σdW with stationary variance V = σ²τc/2.
- A stabilizer check projects a tilt θ into "no error" (probability cos²(θ/2)) or a full Z flip (probability sin²(θ/2)).
- Detection event d_r = s_r ⊕ s_(r−1).
- Gate and readout timings (reset 100 ns, H 20 ns, CNOT 60 ns, readout 300 ns, electronics delay 100 ns, 1,000 ns cycle) are illustrative dummy values, not device data.
- Chapter 5 treats the four data qubits independently, which gives the correct timing of when the stabilizer fires; a real surface code keeps them in a shared entangled state.
- Chapter 6 uses one perfect round of X checks (code-capacity Z noise). Real decoders match in space and time across many noisy rounds.

## Files

```
index.html          all chapters and explanations
css/style.css       styles (light and dark mode)
js/common.js        shared helpers (globe drawing, flip probability)
js/ch1-phase.js     Chapter 1
js/ch2-tilt.js      Chapter 2
js/ch3-check.js     Chapter 3
js/ch4-zeno.js      Chapter 4
js/ch5-schedule.js  Chapter 5
js/ch6-mwpm.js      Chapter 6
lab.html            Simulation Lab page
js/ch8-lab.js       Simulation Lab model and drawing
```
