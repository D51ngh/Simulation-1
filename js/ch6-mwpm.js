// Step 6: the MWPM decoder on a distance-3 rotated surface code (Z errors, X checks, one perfect round).
(() => {
  const $ = SIM.$, T_ = SIM.t;
  // Data qubits Q1..Q9 on a 3×3 grid.
  const Q = []; for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) Q.push({ r, c, x: 90 + c * 110, y: 90 + r * 110 });
  // X-type checks: two square plaquettes (A, B) and two half-moon boundary checks (top, bottom).
  const CH = ['T', 'A', 'B', 'D'];
  const NP = { T: [255, 52], A: [145, 145], B: [255, 255], D: [145, 348] };
  const NAME = { T: 'top check', A: 'check A', B: 'check B', D: 'bottom check', L: 'left edge', R: 'right edge' };
  // Each data qubit is an edge of the matching graph: [qubit, end1, end2]. L / R = boundaries of the code.
  const E = [[0, 'A', 'L'], [1, 'A', 'T'], [2, 'T', 'R'], [3, 'A', 'L'], [4, 'A', 'B'], [5, 'B', 'R'], [6, 'D', 'L'], [7, 'B', 'D'], [8, 'B', 'R']];
  const touches = q => [E[q][1], E[q][2]];

  const syndrome = v => CH.filter(ch => E.filter(e => e[1] === ch || e[2] === ch).reduce((s, e) => s ^ v[e[0]], 0));
  const xor = (a, b) => a.map((v, i) => v ^ b[i]);
  // Logical Z error = residual with an odd number of Z's on the left column (Q1, Q4, Q7).
  const isLogical = res => (res[0] ^ res[3] ^ res[6]) === 1;

  const bfsCache = {};
  function bfs(src) {
    if (bfsCache[src]) return bfsCache[src];
    const dist = { [src]: 0 }, par = {}, qu = [src];
    while (qu.length) {
      const u = qu.shift();
      if ((u === 'L' || u === 'R') && u !== src) continue;
      for (const [q, a, b] of E) {
        const v = a === u ? b : b === u ? a : null;
        if (v && dist[v] === undefined) { dist[v] = dist[u] + 1; par[v] = [u, q]; qu.push(v); }
      }
    }
    return (bfsCache[src] = { dist, par });
  }
  function path(a, b) { const { par } = bfs(a), out = []; let v = b; while (v !== a) { out.push(par[v][1]); v = par[v][0]; } return out; }
  // Enumerate every way to pair up the detection events (with each other or with an edge of the code).
  function pairings(ev) {
    if (!ev.length) return [[[], 0]];
    const [e, ...rest] = ev, out = [], de = bfs(e).dist;
    for (const bn of ['L', 'R']) for (const [m, c] of pairings(rest)) out.push([[[e, bn]].concat(m), c + de[bn]]);
    rest.forEach((f, i) => {
      const d = bfs(e).dist[f], r2 = rest.filter((_, j) => j !== i);
      for (const [m, c] of pairings(r2)) out.push([[[e, f]].concat(m), c + d]);
    });
    return out;
  }
  function options(err, onlyBest = false) {
    let list = pairings(syndrome(err)).sort((a, b) => a[1] - b[1]);
    if (onlyBest) list = list.slice(0, 1);
    return list.map(([pairs, w]) => {
      const corr = Array(9).fill(0), paths = pairs.map(([a, b]) => { const p = path(a, b); p.forEach(q => corr[q] ^= 1); return [a, b, p]; });
      return { pairs, w, corr, paths, logical: isLogical(xor(err, corr)) };
    });
  }

  // ---------------- state ----------------
  let mode = 'explore', err = Array(9).fill(0), sel = 0, hover = null;
  let game = { err: Array(9).fill(0), uc: Array(9).fill(0), revealed: false, showDec: false, win: 0, n: 0, msg: '' };
  err[4] = 1;

  function pts(a, b, p) {
    const out = []; let cur = a;
    p.forEach(q => {
      const e = E[q], qq = Q[q], nx = e[1] === cur ? e[2] : e[1];
      const at = n => NP[n] || [n === 'L' ? 30 : 370, qq.y];
      out.push(at(cur), [qq.x, qq.y], at(nx)); cur = nx;
    });
    return out.map(p => p.join(',')).join(' ');
  }

  function lattice({ fired, quiet = [], errs, showErr, corr, paths, dashed, res }) {
    let h = '';
    h += `<rect x="200" y="90" width="110" height="110" fill="var(--neutral)" stroke="var(--border)"/><rect x="90" y="200" width="110" height="110" fill="var(--neutral)" stroke="var(--border)"/>`;
    h += T_(255, 150, 'Z check', { s: 11, c: 'var(--muted)' }) + T_(145, 260, 'Z check', { s: 11, c: 'var(--muted)' });
    const shapes = { A: '<rect x="90" y="90" width="110" height="110"', B: '<rect x="200" y="200" width="110" height="110"', T: '<path d="M200,90 A55,55 0 0 1 310,90 Z"', D: '<path d="M90,310 A55,55 0 0 0 200,310 Z"' };
    CH.forEach(k => { const on = fired.includes(k), ok = quiet.includes(k); h += `${shapes[k]} fill="${on ? 'var(--coral-bg)' : ok ? 'var(--teal-bg)' : 'var(--purple-bg)'}" stroke="${on ? 'var(--coral)' : ok ? 'var(--teal)' : 'var(--purple)'}" stroke-width="${on || ok ? 2 : 1}"/>`; });
    h += `<line x1="30" y1="70" x2="30" y2="330" stroke="var(--border-strong)" stroke-dasharray="5 5"/><line x1="370" y1="70" x2="370" y2="330" stroke="var(--border-strong)" stroke-dasharray="5 5"/>`;
    h += T_(30, 352, 'left edge', { s: 11, c: 'var(--text2)' }) + T_(370, 352, 'right edge', { s: 11, c: 'var(--text2)' });
    (paths || []).forEach(([a, b, p]) => h += `<polyline points="${pts(a, b, p)}" fill="none" stroke="var(--accent)" stroke-width="4" stroke-linejoin="round" stroke-opacity="0.75" ${dashed ? 'stroke-dasharray="8 6"' : ''}/>`);
    if (hover !== null) touches(hover).forEach(n => { const [x, y] = NP[n] || [n === 'L' ? 30 : 370, Q[hover].y]; h += `<line x1="${Q[hover].x}" y1="${Q[hover].y}" x2="${x}" y2="${y}" stroke="var(--text2)" stroke-width="1.5" stroke-dasharray="3 4"/>`; });
    CH.forEach(k => { const [x, y] = NP[k], on = fired.includes(k); h += `<circle cx="${x}" cy="${y}" r="${on ? 9 : 6}" fill="${on ? 'var(--coral)' : 'var(--purple)'}"/>`; if (on) h += T_(x + (k === 'T' ? 0 : 0), y - 14, 'fired', { s: 11, c: 'var(--coral-dark)', w: 600 }); });
    Q.forEach((q, i) => {
      const e = showErr && errs[i], c = corr && corr[i], r = res && res[i];
      const fill = res ? (r ? 'var(--coral-bg)' : 'var(--surface)') : e ? 'var(--coral)' : 'var(--surface)';
      h += `<g data-q="${i}" style="cursor:pointer"><circle cx="${q.x}" cy="${q.y}" r="18" fill="${fill}" stroke="${c ? 'var(--accent)' : e ? 'var(--coral)' : 'var(--border-strong)'}" stroke-width="${c ? 4 : 1.5}"/>`;
      h += T_(q.x, q.y + 5, res ? (r ? 'Z' : '') : e ? 'Z' : '', { w: 700, c: res ? 'var(--coral-dark)' : '#fff' });
      h += T_(q.x + 24, q.y + 26, 'Q' + (i + 1), { s: 10, c: 'var(--muted)', a: 'start' }) + '</g>';
    });
    return h;
  }

  function hoverText() {
    if (hover === null) return '';
    const [a, b] = touches(hover).map(n => NAME[n]);
    return `<br><span class="note">Q${hover + 1}: ${a}, ${b}.</span>`;
  }

  // ---------------- explore ----------------
  function renderExplore() {
    const ops = options(err), o = ops[Math.min(sel, ops.length - 1)], fired = syndrome(err);
    $('ch6-sv').innerHTML = lattice({ fired, errs: err, showErr: true, corr: fired.length ? o.corr : null, paths: o.paths });
    const nErr = err.reduce((a, b) => a + b, 0);
    $('ch6-cap').innerHTML = (fired.length
      ? `<b>${fired.length} stabilizer${fired.length > 1 ? 's' : ''} fired:</b> ${fired.map(f => NAME[f]).join(', ')}. Possible matchings are listed on the right; the selected one is shown in blue.`
      : nErr ? '<b>No stabilizer fired.</b> The errors cancel in every stabilizer: either a stabilizer (harmless) or a logical error.' : 'Click data qubits to place Z errors.') + hoverText();
    $('ch6-pan').innerHTML = '<h3 style="margin-top:0">Matchings</h3>' + (fired.length ? ops.slice(0, 6).map((x, i) => `<div class="opt${i === sel ? ' sel' : ''}" data-i="${i}">${x.pairs.map(([a, b]) => NAME[a] + ' ↔ ' + NAME[b]).join('<br>')}<br><span class="note">weight ${x.w}</span>${i === 0 ? '<span class="tag best">MWPM</span>' : ''}<span class="tag ${x.logical ? 'bad' : 'good'}">${x.logical ? 'logical error' : 'success'}</span></div>`).join('') + (ops.length > 6 ? `<p class="note">+ ${ops.length - 6} more</p>` : '') + '<p class="note">MWPM selects the lowest total weight.</p>' : '<p class="note">No detection events.</p>');
    document.querySelectorAll('#ch6-pan .opt').forEach(d => d.onclick = () => { sel = +d.dataset.i; renderExplore(); });
  }

  // ---------------- game ----------------
  function newPuzzle() {
    do {
      game.err = Array(9).fill(0);
      const k = Math.random() < 0.7 ? 1 : 2;
      while (game.err.reduce((a, b) => a + b, 0) < k) game.err[Math.floor(Math.random() * 9)] = 1;
    } while (!syndrome(game.err).length);
    game.uc = Array(9).fill(0); game.revealed = false; game.showDec = false; game.msg = '';
  }
  function renderGame() {
    const orig = syndrome(game.err), now = syndrome(xor(game.err, game.uc)), quiet = orig.filter(c => !now.includes(c));
    const dec = options(game.err)[0];
    if (!game.revealed) {
      $('ch6-sv').innerHTML = lattice({ fired: now, quiet, errs: game.err, showErr: false, corr: game.uc });
      $('ch6-cap').innerHTML = `<b>Manual decoding.</b> Errors are hidden. Select qubits to correct (blue) until no stabilizer fires.${game.msg ? '<br><span style="color:var(--coral-dark)">' + game.msg + '</span>' : ''}` + hoverText();
    } else {
      const res = xor(game.err, game.uc), lg = isLogical(res);
      $('ch6-sv').innerHTML = lattice({ fired: [], errs: game.err, showErr: true, corr: game.uc, res, paths: game.showDec ? dec.paths : null, dashed: true });
      $('ch6-cap').innerHTML = `<b>${lg ? 'Logical error.' : 'Correct.'}</b> Errors: ${game.err.map((v, i) => v ? 'Q' + (i + 1) : null).filter(Boolean).join(', ')}. Correction: ${game.uc.map((v, i) => v ? 'Q' + (i + 1) : null).filter(Boolean).join(', ')}.${lg ? ' The residual is a logical Z operator.' : ''}`;
    }
    $('ch6-pan').innerHTML = `<h3 style="margin-top:0">Score: ${game.win} / ${game.n}</h3>
      <p class="note">Orange: still firing. Green: resolved.</p>
      ${game.revealed ? `<p><b>MWPM:</b> flip ${dec.corr.map((v, i) => v ? 'Q' + (i + 1) : null).filter(Boolean).join(', ')} (weight ${dec.w}) → <span class="tag ${dec.logical ? 'bad' : 'good'}">${dec.logical ? 'logical error' : 'success'}</span></p><p class="note">${dec.logical ? 'MWPM also fails: the two errors are equivalent to a lower-weight error elsewhere.' : ''}</p>` : '<p class="note">Hover a qubit to see its stabilizers.</p>'}`;
  }

  // ---------------- many trials ----------------
  function runTrials() {
    const N = SIM.readCount('ch6-n', 'ch6-err', 100, 200000); if (N === null) return;
    const p = +$('ch6-p').value, byK = {};
    let fail = 0;
    for (let i = 0; i < N; i++) {
      const e = Array.from({ length: 9 }, () => Math.random() < p ? 1 : 0), k = Math.min(3, e.reduce((a, b) => a + b, 0));
      const lg = options(e, true)[0].logical;
      byK[k] = byK[k] || [0, 0]; byK[k][0]++; if (lg) { byK[k][1]++; fail++; }
    }
    const pl = fail / N;
    $('ch6-stat').innerHTML = `<div class="stats"><div class="stat"><span>Physical error rate</span><b>${(100 * p).toFixed(1)}%</b></div><div class="stat"><span>Logical error rate (MWPM)</span><b>${(100 * pl).toFixed(2)}%</b></div><div class="stat"><span>Improvement</span><b>${pl < p ? (p / Math.max(pl, 1e-9)).toFixed(1) + '×' : 'none'}</b></div></div>
      <table class="simple"><tr><th>Errors per trial</th><th>Trials</th><th>Logical error</th></tr>${[0, 1, 2, 3].filter(k => byK[k]).map(k => `<tr><td>${k === 3 ? '3 or more' : k}</td><td>${byK[k][0].toLocaleString()}</td><td>${(100 * byK[k][1] / byK[k][0]).toFixed(1)}%</td></tr>`).join('')}</table>
      <p class="note">${N.toLocaleString()} trials, independent Z errors with probability ${(100 * p).toFixed(0)}% per qubit, one perfect round. Single errors are always corrected.</p>`;
  }

  // ---------------- wiring ----------------
  function render() {
    ['explore', 'game', 'stats'].forEach(m => { $('ch6-m-' + m).classList.toggle('on', mode === m); $('ch6-c-' + m).style.display = mode === m ? 'flex' : 'none'; });
    $('ch6-board').style.display = mode === 'stats' ? 'none' : '';
    $('ch6-stat').style.display = mode === 'stats' ? '' : 'none';
    if (mode === 'explore') renderExplore(); else if (mode === 'game') renderGame();
  }
  ['explore', 'game', 'stats'].forEach(m => $('ch6-m-' + m).onclick = () => { mode = m; if (m === 'game' && !syndrome(game.err).length) newPuzzle(); render(); });
  $('ch6-sv').addEventListener('click', e => {
    const g = e.target.closest('g[data-q]'); if (!g) return; const q = +g.dataset.q;
    if (mode === 'explore') { err[q] ^= 1; sel = 0; }
    else if (mode === 'game' && !game.revealed) { game.uc[q] ^= 1; game.msg = ''; }
    render();
  });
  $('ch6-sv').addEventListener('mouseover', e => { const g = e.target.closest('g[data-q]'); const q = g ? +g.dataset.q : null; if (q !== hover) { hover = q; render(); } });
  $('ch6-sv').addEventListener('mouseleave', () => { hover = null; render(); });
  $('ch6-ex1').onclick = () => { err = Array(9).fill(0); err[4] = 1; sel = 0; render(); };
  $('ch6-ex2').onclick = () => { err = Array(9).fill(0); err[3] = 1; err[4] = 1; sel = 0; render(); };
  $('ch6-rand').onclick = () => { err = err.map(() => Math.random() < 0.15 ? 1 : 0); sel = 0; render(); };
  $('ch6-clear').onclick = () => { err = Array(9).fill(0); sel = 0; render(); };
  $('ch6-new').onclick = () => { newPuzzle(); render(); };
  $('ch6-submit').onclick = () => {
    if (game.revealed) return;
    if (syndrome(xor(game.err, game.uc)).length) { game.msg = 'Some stabilizers are still firing.'; return render(); }
    game.revealed = true; game.n++; if (!isLogical(xor(game.err, game.uc))) game.win++; render();
  };
  $('ch6-showdec').onclick = () => { if (game.revealed) { game.showDec = !game.showDec; render(); } };
  $('ch6-p').oninput = e => $('ch6-pv').textContent = Math.round(e.target.value * 100) + '%';
  $('ch6-run').onclick = runTrials;
  render();
})();
