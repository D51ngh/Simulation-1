// Chapter 3: one stabilizer check, step by step, then many shots.
(() => {
  const $ = SIM.$, T = SIM.t;
  const base = [0.2, 0.5, 1.2, 0.9, 0.3, 0.1, 0.6, 0.25]; // hidden tilt per round (radians), before scaling
  const NR = 8, SHOTS = 2000;
  let S, auto = null;

  const prof = () => base.map(v => v * +$('ch3-scale').value);
  function reset() { S = { r: 0, st: 0, th: 0, fl: false, anc: '|0⟩', out: null, p: 0, s: [], d: [], shots: null, anim: false }; }

  function draw() {
    const cx = 105, cy = 120, R = 68, a = (S.fl ? Math.PI : 0) + S.th;
    const ex = cx + R * Math.cos(a), ey = cy - R * Math.sin(a);
    let h = T(105, 22, 'Data qubit (rotating frame)', { c: 'var(--text2)' });
    h += `<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="var(--border-strong)"/>`;
    h += T(cx + R + 6, cy - 10, '+', { a: 'start', w: 600 }) + T(cx - R - 6, cy - 10, '−', { a: 'end', w: 600 });
    h += `<line x1="${cx}" y1="${cy}" x2="${cx + R}" y2="${cy}" stroke="var(--gray)" stroke-width="2" stroke-dasharray="6 5"/>`;
    h += `<line x1="${cx}" y1="${cy}" x2="${ex}" y2="${ey}" stroke="var(--coral)" stroke-width="3"/><circle cx="${ex}" cy="${ey}" r="5" fill="var(--coral)"/>`;
    h += T(cx, cy + R + 22, 'tilt θ = ' + SIM.deg(S.th) + '°', { c: 'var(--coral-dark)' });
    const on = S.st >= 2 && S.st <= 5;
    h += `<rect x="228" y="52" width="170" height="130" rx="8" fill="none" stroke="${on ? 'var(--accent)' : 'var(--border)'}" stroke-width="${on ? 2 : 1}"/>`;
    h += T(313, 74, 'Ancilla', { c: 'var(--text2)' }) + T(313, 124, S.anc, { s: S.anc.length > 6 ? 16 : 24, w: 600 });
    if (S.st === 3 || S.st === 4) h += T(313, 160, 'linked to data by CNOT', { s: 12, c: 'var(--text2)' });
    if (S.st >= 5 && S.out !== null) h += T(313, 160, 'measured: ' + S.out, { s: 12, c: 'var(--text2)' });
    const c = Math.cos(S.th / 2) ** 2, s = 1 - c, bx = 430, bw = 220;
    h += T(540, 22, 'What the tilt is made of', { c: 'var(--text2)' });
    h += `<rect x="${bx}" y="62" width="${Math.max(2, bw * c)}" height="26" rx="4" fill="var(--teal-bg)" stroke="var(--teal)"/>` + T(bx, 56, 'fine |+⟩ ' + (100 * c).toFixed(1) + '%', { a: 'start', s: 12 });
    h += `<rect x="${bx}" y="122" width="${Math.max(2, bw * s)}" height="26" rx="4" fill="var(--coral-bg)" stroke="var(--coral)"/>` + T(bx, 116, 'flipped |−⟩ ' + (100 * s).toFixed(1) + '%', { a: 'start', s: 12 });
    if (S.st === 3 || S.st === 4) h += T(bx + bw + 6, 80, 'tag 0', { a: 'end', s: 12, c: 'var(--teal)' }) + T(bx + bw + 6, 140, 'tag 1', { a: 'end', s: 12, c: 'var(--coral-dark)' });
    const x0 = 180, dx = 60;
    h += `<line x1="20" y1="222" x2="660" y2="222" stroke="var(--border)"/>`;
    [['true tilt (hidden), rad', 256], ['syndrome s', 282], ['detection d', 308]].forEach(([n, y]) => h += T(20, y, n, { a: 'start', s: 12, c: 'var(--text2)' }));
    if (S.shots) [['detections / ' + SHOTS.toLocaleString(), 344], ['recovered tilt, rad', 372]].forEach(([n, y]) => h += T(20, y, n, { a: 'start', s: 12, c: 'var(--text2)' }));
    for (let r = 0; r < NR; r++) {
      const x = x0 + dx * r;
      h += T(x, 236, 'R' + (r + 1), { s: 11, c: r === S.r && S.st < 7 ? 'var(--accent)' : 'var(--muted)', w: r === S.r ? 600 : 400 });
      if (r < S.s.length) {
        h += T(x, 256, prof()[r].toFixed(2), { s: 12, c: 'var(--muted)' }) + T(x, 282, S.s[r]);
        h += T(x, 308, S.d[r], { w: S.d[r] ? 700 : 400, c: S.d[r] ? 'var(--coral)' : 'var(--text)' });
      }
      if (S.shots) {
        const k = S.shots.k[r], f = k / SHOTS;
        h += T(x, 344, k, { s: 12 }) + T(x, 372, (2 * Math.asin(Math.sqrt(f))).toFixed(2), { s: 12, c: 'var(--accent)', w: 600 });
      }
    }
    if (S.shots) h += T(20, 400, `Mean first detection: round ${S.shots.first.toFixed(1)} · recovered tilt = 2·arcsin√(detections / shots)`, { a: 'start', s: 12, c: 'var(--text2)' });
    $('ch3-sv').innerHTML = h;
  }

  const msg = [
    () => '<b>Start.</b> The data qubit points at |+⟩. Its information is stored in this direction. The ancilla waits in |0⟩.',
    () => `<b>Round ${S.r + 1} · noise.</b> The qubit spins slightly too fast, so it tilts by θ away from the dashed “correct” arrow.`,
    () => '<b>Prepare the check.</b> The ancilla is reset to |0⟩, then a Hadamard gate turns it into |+⟩.',
    () => '<b>CNOT.</b> The fine part of the data tags the ancilla with 0, the flipped part tags it with 1 (phase kickback). The ancilla now carries both tags.',
    () => `<b>Read the tag.</b> A Hadamard and a measurement force one answer. Chance of “1” was ${(100 * S.p).toFixed(1)}%. Result: <b>${S.out}</b>.`,
    () => `<b>Tilt erased.</b> The data qubit snaps fully to ${S.fl ? '|−⟩ (flipped)' : '|+⟩ (fine)'}. The tilt is gone; it only set the odds.`,
    () => `<b>Record.</b> Syndrome s = ${S.s[S.r]}, detection d = ${S.d[S.r]} ${S.d[S.r] ? '(the answer changed!)' : '(no change)'}. The next round starts from zero tilt.`,
    () => '<b>One shot done.</b> A decoder only ever sees the detection row. Run many shots to recover the hidden tilt of each round from how often it fired.'
  ];
  function show() { $('ch3-cap').innerHTML = msg[S.st](); draw(); }

  function animate(from, to, ms, done) {
    const t0 = performance.now(); S.anim = true;
    (function f(t) {
      const u = Math.min(1, (t - t0) / ms);
      S.th = from + (to - from) * (1 - (1 - u) ** 2); draw();
      if (u < 1) requestAnimationFrame(f); else { S.anim = false; done && done(); }
    })(t0);
  }

  function next() {
    if (S.anim || S.st === 7) return;
    if (S.st === 0 || S.st === 6) {
      if (S.st === 6) { if (S.r === NR - 1) { S.st = 7; return show(); } S.r++; }
      S.st = 1; S.anc = '|0⟩'; S.out = null; show(); animate(0, prof()[S.r], 1100); return;
    }
    if (S.st === 1) { S.st = 2; S.anc = '|+⟩'; return show(); }
    if (S.st === 2) { S.st = 3; S.anc = '0 & 1'; return show(); }
    if (S.st === 3) { S.p = SIM.pFlip(S.th); S.out = Math.random() < S.p ? 1 : 0; S.anc = '|' + S.out + '⟩'; S.st = 4; return show(); }
    if (S.st === 4) {
      const flip = S.out === 1; S.st = 5; show();
      animate(S.th, flip ? (S.th >= 0 ? Math.PI : -Math.PI) : 0, 700, () => { if (flip) S.fl = !S.fl; S.th = 0; draw(); });
      return;
    }
    if (S.st === 5) {
      const s = S.fl ? 1 : 0, prev = S.r ? S.s[S.r - 1] : 0;
      S.s.push(s); S.d.push(s ^ prev); S.st = 6; return show();
    }
  }

  function stopAuto() { clearInterval(auto); auto = null; $('ch3-auto').textContent = 'Auto-play'; }
  $('ch3-next').onclick = next;
  $('ch3-auto').onclick = () => {
    if (auto) return stopAuto();
    auto = setInterval(() => { if (S.st === 7) return stopAuto(); next(); }, 1500);
    $('ch3-auto').textContent = 'Pause';
  };
  $('ch3-shots').onclick = () => {
    // Each round fires in a shot exactly when the qubit flips in that round (d_r = flip_r).
    const p = prof().map(SIM.pFlip), k = Array(NR).fill(0);
    let sum = 0, n = 0;
    for (let i = 0; i < SHOTS; i++) {
      let first = 0;
      for (let r = 0; r < NR; r++) if (Math.random() < p[r]) { k[r]++; if (!first) first = r + 1; }
      if (first) { sum += first; n++; }
    }
    S.shots = { k, first: n ? sum / n : 0 };
    $('ch3-cap').innerHTML = `<b>${SHOTS.toLocaleString()} shots.</b> Each round fired in a fraction f of shots. Turning f back into an angle, 2·arcsin√f, recovers the hidden tilt (blue row). Compare it with the grey hidden row.`;
    draw();
  };
  $('ch3-reset').onclick = () => { stopAuto(); reset(); show(); };
  $('ch3-scale').oninput = e => { $('ch3-scalev').textContent = (+e.target.value).toFixed(1) + '×'; S.shots = null; draw(); };
  reset(); show();
})();
