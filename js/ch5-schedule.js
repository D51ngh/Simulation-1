// Step 5: one X stabilizer with four data qubits, its gate schedule, and when it fires.
(() => {
  const $ = SIM.$, T_ = SIM.t;
  const T = 1000, CE = [180, 240, 300, 360], MEAS = 680, RES = 780, NR = 6; // ns
  const pos = [[340, 58], [500, 170], [340, 282], [180, 170]];
  let S, playing = false, last = 0;

  const cfg = () => ({ q: +$('ch5-q').value, t0: +$('ch5-t').value, md: $('ch5-mode').value, rate: +$('ch5-rate').value * Math.PI / 180 / 1000 });
  function reset() {
    S = { t: 0, base: [0, 0, 0, 0], tilt: [0, 0, 0, 0], samp: [0, 0, 0, 0], pend: [0, 0, 0, 0], pendS: 0, s: [], d: [], hit: false, first: null };
    preds(); answer(); draw();
  }
  function events(a, b) {
    const out = [];
    for (let r = Math.floor(a / T); r <= Math.floor(b / T); r++) {
      CE.forEach((o, q) => out.push([r * T + o, 'cnot', q]));
      out.push([r * T + MEAS, 'meas']); out.push([r * T + RES, 'result', r]);
    }
    return out.filter(e => e[0] > a && e[0] <= b).sort((x, y) => x[0] - y[0]);
  }
  // Advance the simulation from time a to b (ns).
  function stepTo(a, b) {
    const c = cfg();
    if (c.md === 'grad' && b > c.t0) S.tilt[c.q] += c.rate * (b - Math.max(a, c.t0));
    for (const e of events(a, b)) {
      if (e[1] === 'cnot') { S.samp[e[2]] = S.base[e[2]]; S.pend[e[2]] = S.tilt[e[2]]; }       // the check "looks" at this qubit now
      else if (e[1] === 'meas') {                                                                // the tag is read: each tilt becomes flip / no flip
        let s = 0;
        for (let q = 0; q < 4; q++) {
          const f = Math.random() < SIM.pFlip(S.pend[q]) ? 1 : 0;
          s ^= S.samp[q] ^ f; S.base[q] ^= f; S.tilt[q] -= S.pend[q]; S.pend[q] = 0;
        }
        S.pendS = s;
      } else if (e[1] === 'result' && S.s.length === e[2]) {                                    // answer reaches the electronics
        const prev = e[2] ? S.s[e[2] - 1] : 0, d = S.pendS ^ prev;
        S.s.push(S.pendS); S.d.push(d);
        if (d && !S.first) S.first = { r: e[2] + 1, t: e[0] };
      }
    }
    if (!S.hit && c.t0 > a && c.t0 <= b) { S.hit = true; if (c.md === 'clean') S.base[c.q] ^= 1; }
  }
  function advance(dt) {
    if (S.t >= NR * T) { playing = false; $('ch5-play').textContent = 'Play'; return; }
    const tgt = Math.min(NR * T, S.t + dt);
    while (S.t < tgt) { const b = Math.min(tgt, S.t + 5); stepTo(S.t, b); S.t = b; }
  }
  function phase(tc) {
    if (tc < 100) return ['Reset to |0⟩', -1];
    if (tc < 120) return ['H: now |+⟩', -1];
    for (let q = 0; q < 4; q++) if (tc < CE[q]) return ['CNOT Q' + (q + 1), q];
    if (tc < 380) return ['H', -1];
    if (tc < MEAS) return ['Reading…', -1];
    if (tc < RES) return ['Delay', -1];
    return ['Answer known', -1];
  }
  function draw() {
    const c = cfg(), r = Math.floor(Math.min(S.t, NR * T - 1) / T), tc = S.t - r * T, [ph, act] = phase(tc);
    const fired = S.d.length > r && tc >= RES && S.d[r] === 1;
    let h = '';
    pos.forEach(([x, y], q) => { const on = act === q; h += `<line x1="340" y1="170" x2="${x}" y2="${y}" stroke="${on ? 'var(--accent)' : 'var(--border-strong)'}" stroke-width="${on ? 4 : 1.5}"/>`; });
    h += `<circle cx="340" cy="170" r="46" fill="${fired ? 'var(--coral-bg)' : 'var(--surface)'}" stroke="${fired ? 'var(--coral)' : act >= 0 ? 'var(--accent)' : 'var(--border-strong)'}" stroke-width="${fired || act >= 0 ? 2.5 : 1}"/>`;
    h += T_(340, 162, 'Ancilla', { s: 12, c: 'var(--text2)' }) + T_(340, 182, fired ? 'FIRED' : ph, { s: 12, w: 600, c: fired ? 'var(--coral-dark)' : 'var(--text)' });
    pos.forEach(([x, y], q) => {
      const R = 34, a = S.base[q] * Math.PI + S.tilt[q], hitq = c.q === q && S.hit;
      h += SIM.blochSVG(x, y, R, 0, a, { small: true, ring: hitq ? 'var(--coral)' : null, ringW: hitq ? 2 : 1 });
      const lx = q === 3 ? x - R - 8 : x + R + 8, an = q === 3 ? 'end' : 'start', deg = SIM.deg(a);
      h += T_(lx, y - 6, 'Q' + (q + 1), { a: an, w: 600 }) + T_(lx, y + 10, 'tilt ' + deg + '°', { a: an, s: 12, c: deg ? 'var(--coral-dark)' : 'var(--text2)' });
      if (tc >= CE[q] && tc < MEAS) h += T_(lx, y + 25, 'checked', { a: an, s: 11, c: 'var(--accent)' });
    });
    const X = v => 40 + v * 0.6;
    const segs = [[0, 100, 'Reset'], [100, 120, ''], [120, 180, 'Q1'], [180, 240, 'Q2'], [240, 300, 'Q3'], [300, 360, 'Q4'], [360, 380, ''], [380, 680, 'Readout'], [680, 780, 'Delay'], [780, 1000, 'Idle']];
    h += T_(40, 338, `Gate schedule · round ${r + 1} of ${NR} · t = ${Math.round(S.t)} ns`, { a: 'start', c: 'var(--text2)' });
    segs.forEach(([a, b, l]) => {
      const cn = l && l[0] === 'Q';
      h += `<rect x="${X(a)}" y="362" width="${X(b) - X(a)}" height="28" fill="${cn ? 'var(--accent-bg)' : l === 'Readout' ? 'var(--neutral)' : 'none'}" stroke="var(--border-strong)" stroke-width="0.75"/>`;
      if (l) h += T_((X(a) + X(b)) / 2, 380, l, { s: 11, c: cn ? 'var(--accent)' : 'var(--text2)' });
    });
    h += T_(X(110), 356, 'H', { s: 11, c: 'var(--text2)' }) + T_(X(370), 356, 'H', { s: 11, c: 'var(--text2)' });
    [0, 200, 400, 600, 800, 1000].forEach(v => h += T_(X(v), 406, v + ' ns', { s: 11, c: 'var(--muted)' }));
    if (Math.floor(c.t0 / T) === r && c.t0 < NR * T) { const hx = X(c.t0 - r * T); h += `<line x1="${hx}" y1="358" x2="${hx}" y2="394" stroke="var(--coral)" stroke-width="2"/>` + T_(hx, 422, 'hit Q' + (c.q + 1), { s: 11, c: 'var(--coral-dark)', w: 600 }); }
    h += `<line x1="${X(tc)}" y1="356" x2="${X(tc)}" y2="396" stroke="var(--text)" stroke-width="2"/>`;
    const x0 = 200, dx = 78;
    [['round', 448], ['syndrome s', 472], ['detection d', 496], ['noise hit (hidden)', 520]].forEach(([n, y]) => h += T_(40, y, n, { a: 'start', s: 12, c: 'var(--text2)' }));
    for (let k = 0; k < NR; k++) {
      const x = x0 + dx * k;
      h += T_(x, 448, 'R' + (k + 1), { s: 12, c: k === r ? 'var(--accent)' : 'var(--muted)', w: k === r ? 600 : 400 });
      if (k < S.s.length) h += T_(x, 472, S.s[k]) + T_(x, 496, S.d[k], { w: S.d[k] ? 700 : 400, c: S.d[k] ? 'var(--coral)' : 'var(--text)' });
      if (Math.floor(c.t0 / T) === k && S.hit) h += T_(x, 520, (c.md === 'clean' ? 'flip' : 'starts') + ' @' + (c.t0 - k * T), { s: 11, c: 'var(--coral-dark)' });
    }
    $('ch5-sv').innerHTML = h;
  }
  // Round in which a clean flip at t0 on qubit q is first seen.
  const rStar = (q, t0) => t0 < CE[q] ? 1 : Math.floor((t0 - CE[q]) / T) + 2;
  function preds() {
    const c = cfg();
    $('ch5-pred').innerHTML = [0, 1, 2, 3].map(q => {
      const r = rStar(q, c.t0), known = (r - 1) * T + RES;
      return `<div class="card${q === c.q ? ' on' : ''}">Q${q + 1}<b>Round ${r}</b>known at ${known} ns<br>wait ${known - c.t0} ns</div>`;
    }).join('');
  }
  function answer() {
    const c = cfg(), el = $('ch5-ans');
    if (S.first) el.innerHTML = `Error on <b>Q${c.q + 1}</b> at ${c.t0} ns. First detection in <b>round ${S.first.r}</b>, result at ${S.first.t} ns. <b>Latency: ${S.first.t - c.t0} ns.</b>`;
    else if (S.t >= NR * T) el.innerHTML = c.md === 'grad' ? 'No detection in 6 rounds. With gradual noise, detection is probabilistic.' : 'No detection in 6 rounds: the error occurred after the last check.';
    else el.innerHTML = S.hit ? `Error on Q${c.q + 1}. Waiting for detection.` : `Error scheduled on Q${c.q + 1} at ${c.t0} ns. Press Play.`;
  }
  function loop(ts) { const dt = (ts - last) / 1000; last = ts; if (playing) { advance(Math.min(dt, 0.1) * +$('ch5-speed').value); answer(); } draw(); requestAnimationFrame(loop); }
  $('ch5-play').onclick = () => { if (S.t >= NR * T) reset(); playing = !playing; $('ch5-play').textContent = playing ? 'Pause' : 'Play'; };
  $('ch5-reset').onclick = () => { playing = false; $('ch5-play').textContent = 'Play'; reset(); };
  $('ch5-speed').oninput = e => $('ch5-speedv').textContent = e.target.value + ' ns/s';
  ['ch5-q', 'ch5-mode'].forEach(id => $(id).onchange = () => { playing = false; $('ch5-play').textContent = 'Play'; reset(); });
  $('ch5-t').oninput = e => { $('ch5-tv').textContent = e.target.value + ' ns'; playing = false; $('ch5-play').textContent = 'Play'; reset(); };
  $('ch5-rate').oninput = e => $('ch5-ratev').textContent = e.target.value + '°/µs';
  reset();
  requestAnimationFrame(t => { last = t; loop(t); });
})();
