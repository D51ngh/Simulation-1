// Chapter 4: measuring often (Zeno effect) and detection latency vs cycle time.
(() => {
  const $ = SIM.$;

  // ---------- Part A: same total phase, split into N checks ----------
  const cA = $('ch4-zeno');
  function endsFlipped(total, n) { const p = SIM.pFlip(total / n); return (1 - (1 - 2 * p) ** n) / 2; }
  function drawZeno() {
    const total = +$('ch4-total').value, n = +$('ch4-n').value;
    $('ch4-totalv').textContent = total.toFixed(1) + ' rad';
    $('ch4-nv').textContent = n;
    const pOne = SIM.pFlip(total / n);
    $('ch4-per').textContent = (total / n).toFixed(3) + ' rad';
    $('ch4-pper').textContent = (100 * pOne).toFixed(2) + '%';
    $('ch4-end').textContent = (100 * endsFlipped(total, n)).toFixed(1) + '%';
    const d = SIM.fit(cA, 0.45), ctx = cA.getContext('2d'), W = cA.width, H = cA.height;
    ctx.clearRect(0, 0, W, H);
    const L = 48 * d, Rm = 16 * d, Tp = 14 * d, B = 34 * d, maxN = 20;
    const X = k => L + (k - 1) / (maxN - 1) * (W - L - Rm), Y = v => Tp + (1 - v / 0.5) * (H - Tp - B);
    ctx.strokeStyle = SIM.color('--border'); ctx.lineWidth = 1 * d; ctx.fillStyle = SIM.color('--text2');
    ctx.font = `${12 * d}px sans-serif`; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    [0, 0.1, 0.2, 0.3, 0.4, 0.5].forEach(v => { ctx.beginPath(); ctx.moveTo(L, Y(v)); ctx.lineTo(W - Rm, Y(v)); ctx.stroke(); ctx.fillText(Math.round(v * 100) + '%', L - 6 * d, Y(v)); });
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    [1, 5, 10, 15, 20].forEach(k => ctx.fillText(k, X(k), H - B + 6 * d));
    ctx.fillText('number of checks the phase is split into', (L + W - Rm) / 2, H - B + 20 * d);
    ctx.strokeStyle = SIM.color('--coral'); ctx.lineWidth = 2.5 * d; ctx.beginPath();
    for (let k = 1; k <= maxN; k++) { const y = Y(endsFlipped(total, k)); k === 1 ? ctx.moveTo(X(k), y) : ctx.lineTo(X(k), y); }
    ctx.stroke();
    ctx.fillStyle = SIM.color('--accent'); ctx.beginPath(); ctx.arc(X(n), Y(endsFlipped(total, n)), 6 * d, 0, 2 * Math.PI); ctx.fill();
  }
  ['ch4-total', 'ch4-n'].forEach(id => $(id).oninput = drawZeno);

  // ---------- Part B: mean detection latency vs cycle time ----------
  const cB = $('ch4-lat'), t0 = 0.3; // noise switches on at 0.3 µs
  // Mean latency from the first-detection formula: P(first in k) = p_k * prod_{j<k}(1 - p_j).
  function meanLatency(pWindow, T) {
    let surv = 1, mean = 0, k = 1;
    while (surv > 1e-7 && k < 200000) {
      const a = (k - 1) * T, b = k * T;
      if (b > t0) { const p = pWindow(Math.max(a, t0), b); mean += surv * p * (b - t0); surv *= 1 - p; }
      k++;
    }
    return mean + surv * (k * T - t0);
  }
  // OU window phase variance, V = stationary variance of the frequency noise (rad²/µs²).
  const ouVar = (len, V, tc) => { const x = len / tc; return 2 * V * tc * tc * (x - 1 + Math.exp(-x)); };
  function drawLat() {
    const tc = +$('ch4-tc').value, V = (+$('ch4-sig').value) ** 2;
    $('ch4-tcv').textContent = tc.toFixed(2) + ' µs';
    $('ch4-sigv').textContent = (+$('ch4-sig').value).toFixed(1) + ' rad/µs';
    const Ts = []; for (let T = 0.1; T <= 2.0001; T += 0.05) Ts.push(+T.toFixed(2));
    const ou = Ts.map(T => meanLatency((a, b) => 0.5 * (1 - Math.exp(-ouVar(b - a, V, tc) / 2)), T));
    const clean = Ts.map(T => T / 2);
    const d = SIM.fit(cB, 0.5), ctx = cB.getContext('2d'), W = cB.width, H = cB.height;
    ctx.clearRect(0, 0, W, H);
    const L = 52 * d, Rm = 34 * d, Tp = 14 * d, B = 36 * d;
    const ymax = Math.max(4, Math.ceil(Math.min(60, Math.max(...ou)) / 4) * 4);
    const X = T => L + (T - 0.1) / 1.9 * (W - L - Rm), Y = v => Tp + (1 - Math.min(v, ymax) / ymax) * (H - Tp - B);
    ctx.font = `${12 * d}px sans-serif`; ctx.fillStyle = SIM.color('--text2'); ctx.strokeStyle = SIM.color('--border'); ctx.lineWidth = 1 * d;
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (let i = 0; i <= 4; i++) { const v = ymax * i / 4; ctx.beginPath(); ctx.moveTo(L, Y(v)); ctx.lineTo(W - Rm, Y(v)); ctx.stroke(); ctx.fillText((v % 1 ? v.toFixed(1) : v) + ' µs', L - 6 * d, Y(v)); }
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    [0.1, 0.5, 1.0, 1.5, 2.0].forEach(T => ctx.fillText(T * 1000 + ' ns', X(T), H - B + 6 * d));
    ctx.fillText('cycle time T (how often the stabilizer checks)', (L + W - Rm) / 2, H - B + 20 * d);
    const line = (vals, col, dash) => { ctx.setLineDash(dash.map(v => v * d)); ctx.strokeStyle = col; ctx.lineWidth = 2.5 * d; ctx.beginPath(); vals.forEach((v, i) => i ? ctx.lineTo(X(Ts[i]), Y(v)) : ctx.moveTo(X(Ts[i]), Y(v))); ctx.stroke(); ctx.setLineDash([]); };
    line(clean, SIM.color('--gray'), [6, 5]);
    line(ou, SIM.color('--coral'), []);
    const best = Ts[ou.indexOf(Math.min(...ou))];
    $('ch4-best').textContent = best * 1000 + ' ns';
    $('ch4-regime').textContent = tc > 1 ? 'slow noise (long memory): checking more often delays detection (Zeno)' : tc < 0.2 ? 'fast noise (short memory): latency barely depends on T' : 'in between: watch the curve bend near T ≈ τc';
  }
  ['ch4-tc', 'ch4-sig'].forEach(id => $(id).oninput = drawLat);
  window.addEventListener('resize', () => { drawZeno(); drawLat(); });
  drawZeno(); drawLat();
})();
