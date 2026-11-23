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
  // Draw the "top-down globe" used throughout: equator circle, + and − points,
  // a dashed reference arrow and the real (orange) arrow.
  globe(ctx, cx, cy, R, d, refAngle, realAngle, opts = {}) {
    ctx.lineWidth = 1 * d;
    ctx.strokeStyle = SIM.color('--border-strong');
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, 2 * Math.PI); ctx.stroke();
    ctx.fillStyle = SIM.color('--text2');
    ctx.font = `${13 * d}px sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (!opts.noLabels) {
      ctx.fillText('|+⟩ fine', cx + R * 0.72, cy - R - 12 * d);
      ctx.fillText('|−⟩ flipped', cx - R * 0.72, cy - R - 12 * d);
    }
    ctx.beginPath(); ctx.arc(cx + R, cy, 3 * d, 0, 2 * Math.PI); ctx.arc(cx - R, cy, 3 * d, 0, 2 * Math.PI); ctx.fill();
    const arrow = (a, color, dash, w) => {
      const ex = cx + R * Math.cos(a), ey = cy - R * Math.sin(a);
      ctx.setLineDash(dash.map(v => v * d)); ctx.strokeStyle = color; ctx.lineWidth = w * d;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(ex, ey); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(ex, ey, 5 * d, 0, 2 * Math.PI); ctx.fill();
    };
    arrow(refAngle, SIM.color('--gray'), [6, 5], 2);
    arrow(realAngle, SIM.color('--coral'), [], 3);
    const diff = SIM.wrap(realAngle - refAngle);
    if (Math.abs(diff) > 0.03) {
      ctx.strokeStyle = SIM.color('--coral'); ctx.lineWidth = 1.5 * d;
      ctx.beginPath(); ctx.arc(cx, cy, R * 0.35, -refAngle, -(refAngle + diff), diff > 0); ctx.stroke();
      const m = refAngle + diff / 2;
      ctx.fillStyle = SIM.color('--coral-dark');
      ctx.fillText('θ', cx + R * 0.52 * Math.cos(m), cy - R * 0.52 * Math.sin(m));
    }
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
