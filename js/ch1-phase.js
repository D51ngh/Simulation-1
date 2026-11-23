// Chapter 1: correct rotation vs wrong rotation (lab view and rotating frame).
(() => {
  const $ = SIM.$;
  const c1 = $('ch1-lab'), c2 = $('ch1-rot');
  const NATURAL = 60 * Math.PI / 180; // visual "normal spin", rad per second (slowed down)
  let spin = 0, theta = 0, flipped = false, wobble = 0, playing = true, last = performance.now();

  function draw(canvas, ref, real) {
    const d = SIM.fit(canvas), ctx = canvas.getContext('2d'), w = canvas.width;
    ctx.clearRect(0, 0, w, canvas.height);
    SIM.globe(ctx, w / 2, canvas.height / 2 + 6 * d, w * 0.34, d, ref, real);
  }

  function tick(now) {
    const dt = Math.min((now - last) / 1000, 0.05); last = now;
    if (playing) {
      const err = +$('ch1-err').value * Math.PI / 180;
      if ($('ch1-wob').checked) {
        // Ornstein–Uhlenbeck-style wandering: decays back toward 0 and gets random kicks.
        wobble += -wobble * dt / 1.5 + Math.sqrt(dt) * 1.6 * (Math.random() * 2 - 1);
      } else wobble *= 0.9;
      spin += NATURAL * dt;
      theta += (err + wobble) * dt;
    }
    const tilt = SIM.wrap(theta + (flipped ? Math.PI : 0));
    draw(c1, spin, spin + tilt);
    draw(c2, 0, tilt);
    $('ch1-theta').textContent = SIM.deg(theta) + '°';
    $('ch1-p').textContent = (100 * SIM.pFlip(SIM.wrap(theta))).toFixed(1) + '%';
    requestAnimationFrame(tick);
  }

  $('ch1-err').oninput = e => $('ch1-errv').textContent = e.target.value + '°/s';
  $('ch1-play').onclick = e => { playing = !playing; e.currentTarget.textContent = playing ? 'Pause' : 'Play'; };
  $('ch1-check').onclick = () => {
    if (Math.random() < SIM.pFlip(SIM.wrap(theta))) flipped = !flipped;
    theta = 0;
    $('ch1-res').textContent = flipped ? 'flipped' : 'fine';
  };
  $('ch1-reset').onclick = () => { theta = 0; flipped = false; wobble = 0; $('ch1-res').textContent = '—'; };
  requestAnimationFrame(tick);
})();
