// Shared helpers used by every chapter.
const SIM = {
  $(id) { return document.getElementById(id); },
  // Read a CSS colour variable so canvases follow light/dark mode.
  color(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); },
  // Wrap an angle to (-pi, pi].
  wrap(a) { return Math.atan2(Math.sin(a), Math.cos(a)); },
  deg(a) { return Math.round(Math.abs(SIM.wrap(a)) * 180 / Math.PI); },
  // Probability that a check reports "flipped" after a tilt theta.
  pFlip(theta) { return Math.sin(theta / 2) ** 2; },
  // SVG text helper.
  t(x, y, str, o = {}) {
    return `<text x="${x}" y="${y}" font-size="${o.s || 13}" text-anchor="${o.a || 'middle'}" fill="${o.c || 'var(--text)'}" font-weight="${o.w || 400}" pointer-events="none">${str}</text>`;
  },
  // Size a canvas to its CSS width at device resolution; returns the scale factor.
  fit(canvas, aspect = 1) {
    const r = canvas.getBoundingClientRect(), d = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, r.width * d);
    canvas.height = Math.max(1, r.width * aspect * d);
    return d;
  },
  // Read a whole number typed by the user. Shows an inline error and returns null if it is not valid.
  readCount(inputId, errId, min, max) {
    const el = SIM.$(inputId), err = SIM.$(errId), v = Number(el.value);
    const ok = el.value.trim() !== '' && Number.isInteger(v) && v >= min && v <= max;
    err.textContent = ok ? '' : `Enter a whole number between ${min.toLocaleString()} and ${max.toLocaleString()}.`;
    if (!el.dataset.wired) { el.dataset.wired = '1'; el.addEventListener('input', () => err.textContent = ''); }
    return ok ? v : null;
  },
  // ---------- 3-D Bloch sphere ----------
  // The qubit state is a point on a sphere: |0⟩ at the north pole, |1⟩ at the south pole,
  // |+⟩ and |−⟩ on the equator. Phase errors (Z rotations) swing the arrow around the equator,
  // so a state with phase φ sits at (cos φ, sin φ, 0).
  view: { az: -0.45, el: 0.32 },           // camera angles in radians (drag a canvas sphere to change az)
  project(cx, cy, R, X, Y, Z) {
    const { az, el } = SIM.view;
    const x1 = X * Math.cos(az) - Y * Math.sin(az);
    const depth = X * Math.sin(az) + Y * Math.cos(az); // > 0 means behind the sphere's centre
    return [cx + R * x1, cy - R * (Z * Math.cos(el) + depth * Math.sin(el)), depth];
  },
  // SVG version: returns markup. ref = phase of the dashed "correct" arrow, real = phase of the real arrow.
  blochSVG(cx, cy, R, ref, real, o = {}) {
    const P = (X, Y, Z) => SIM.project(cx, cy, R, X, Y, Z);
    let h = `<circle cx="${cx}" cy="${cy}" r="${R}" fill="var(--surface)" stroke="${o.ring || 'var(--border-strong)'}" stroke-width="${o.ringW || 1}"/>`;
    const back = [], front = [];
    for (let i = 0; i <= 72; i++) { const f = i / 72 * 2 * Math.PI, [x, y, dp] = P(Math.cos(f), Math.sin(f), 0); (dp > 0 ? back : front).push(`${x.toFixed(1)},${y.toFixed(1)}`); }
    h += `<polyline points="${back.join(' ')}" fill="none" stroke="var(--border-strong)" stroke-width="0.8" stroke-dasharray="3 3"/>`;
    h += `<polyline points="${front.join(' ')}" fill="none" stroke="var(--border-strong)" stroke-width="1"/>`;
    const [nx, ny] = P(0, 0, 1), [sx, sy] = P(0, 0, -1);
    h += `<line x1="${nx}" y1="${ny}" x2="${sx}" y2="${sy}" stroke="var(--border-strong)" stroke-width="0.8" stroke-dasharray="2 3"/>`;
    if (!o.small) {
      const [px, py] = P(1.22, 0, 0), [mx, my] = P(-1.22, 0, 0);
      h += SIM.t(nx, ny - 6, '|0⟩', { s: 11, c: 'var(--text2)' }) + SIM.t(sx, sy + 14, '|1⟩', { s: 11, c: 'var(--text2)' });
      h += SIM.t(px + 4, py + 4, '|+⟩', { s: 11, c: 'var(--text2)', a: 'start' }) + SIM.t(mx - 4, my + 4, '|−⟩', { s: 11, c: 'var(--text2)', a: 'end' });
    }
    const arrow = (phi, col, w, dash) => {
      const [x, y] = P(Math.cos(phi), Math.sin(phi), 0);
      return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="${col}" stroke-width="${w}" ${dash ? 'stroke-dasharray="5 4"' : ''}/><circle cx="${x}" cy="${y}" r="${dash ? 2.5 : 4.5}" fill="${col}"/>`;
    };
    h += arrow(ref, 'var(--gray)', 1.5, true) + arrow(real, 'var(--coral)', 3, false);
    h += `<circle cx="${cx}" cy="${cy}" r="2" fill="var(--text2)"/>`;
    return h;
  },
  // Canvas version (used where the sphere is animated every frame).
  globe(ctx, cx, cy, R, d, ref, real) {
    const P = (X, Y, Z) => SIM.project(cx, cy, R, X, Y, Z);
    ctx.fillStyle = SIM.color('--surface'); ctx.strokeStyle = SIM.color('--border-strong'); ctx.lineWidth = 1 * d;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
    // Equator: dashed behind, solid in front.
    for (const behind of [true, false]) {
      ctx.setLineDash(behind ? [3 * d, 3 * d] : []); ctx.lineWidth = (behind ? 0.8 : 1.2) * d; ctx.beginPath();
      let pen = false;
      for (let i = 0; i <= 120; i++) {
        const f = i / 120 * 2 * Math.PI, [x, y, dp] = P(Math.cos(f), Math.sin(f), 0);
        if ((dp > 0) === behind) { pen ? ctx.lineTo(x, y) : ctx.moveTo(x, y); pen = true; } else pen = false;
      }
      ctx.stroke();
    }
    const [nx, ny] = P(0, 0, 1), [sx, sy] = P(0, 0, -1);
    ctx.setLineDash([2 * d, 3 * d]); ctx.beginPath(); ctx.moveTo(nx, ny); ctx.lineTo(sx, sy); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = SIM.color('--text2'); ctx.font = `${13 * d}px sans-serif`; ctx.textBaseline = 'middle';
    const [px, py] = P(1, 0, 0), [mx, my] = P(-1, 0, 0);
    ctx.textAlign = 'center'; ctx.fillText('|0⟩', nx, ny - 12 * d); ctx.fillText('|1⟩', sx, sy + 12 * d);
    // Equator labels sit just above and below their points so they never fall off the canvas.
    ctx.fillText('|+⟩', px, py - 16 * d); ctx.fillText('fine', px, py + 18 * d);
    ctx.fillText('|−⟩', mx, my - 16 * d); ctx.fillText('flipped', mx, my + 18 * d);
    const arrow = (phi, col, w, dash) => {
      const [x, y] = P(Math.cos(phi), Math.sin(phi), 0);
      ctx.setLineDash(dash ? [6 * d, 5 * d] : []); ctx.strokeStyle = col; ctx.lineWidth = w * d;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x, y); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, (dash ? 3 : 6) * d, 0, 2 * Math.PI); ctx.fill();
      return [x, y];
    };
    arrow(ref, SIM.color('--gray'), 2, true);
    arrow(real, SIM.color('--coral'), 3.5, false);
    // Shade the angle θ between the correct and the real arrow along the equator.
    const diff = SIM.wrap(real - ref);
    if (Math.abs(diff) > 0.03) {
      ctx.strokeStyle = SIM.color('--coral'); ctx.lineWidth = 1.5 * d; ctx.beginPath();
      for (let i = 0; i <= 30; i++) { const [x, y] = P(0.38 * Math.cos(ref + diff * i / 30), 0.38 * Math.sin(ref + diff * i / 30), 0); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.stroke();
      const [tx, ty] = P(0.55 * Math.cos(ref + diff / 2), 0.55 * Math.sin(ref + diff / 2), 0);
      ctx.fillStyle = SIM.color('--coral-dark'); ctx.textAlign = 'center'; ctx.fillText('θ', tx, ty);
    }
    ctx.fillStyle = SIM.color('--text2'); ctx.beginPath(); ctx.arc(cx, cy, 2.5 * d, 0, 2 * Math.PI); ctx.fill();
  },
  // Let the user drag any canvas sphere sideways to turn the 3-D view.
  draggable(canvas, redraw) {
    let x0 = null;
    canvas.style.cursor = 'grab'; canvas.style.touchAction = 'none';
    canvas.addEventListener('pointerdown', e => { x0 = e.clientX; canvas.setPointerCapture(e.pointerId); canvas.style.cursor = 'grabbing'; });
    canvas.addEventListener('pointermove', e => { if (x0 === null) return; SIM.view.az += (e.clientX - x0) * 0.01; x0 = e.clientX; redraw && redraw(); });
    const up = () => { x0 = null; canvas.style.cursor = 'grab'; };
    canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  }
};

// Highlight the chapter currently on screen in the sticky navigation.
document.addEventListener('DOMContentLoaded', () => {
  const links = [...document.querySelectorAll('nav.toc a')];
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) links.forEach(l => l.classList.toggle('active', l.getAttribute('href') === '#' + e.target.id));
    });
  }, { rootMargin: '-40% 0px -55% 0px' });
  document.querySelectorAll('section.chapter').forEach(s => obs.observe(s));
});
