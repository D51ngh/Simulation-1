// Step 2: a tilt is a mix of "fine" and "flipped".
(() => {
  const $ = SIM.$;
  const cv = $('ch2-globe');
  let counts = { fine: 0, flip: 0 };

  function render() {
    const deg = +$('ch2-theta').value, th = deg * Math.PI / 180;
    $('ch2-thetav').textContent = deg + '°';
    const d = SIM.fit(cv), ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, cv.width, cv.height);
    SIM.globe(ctx, cv.width / 2, cv.height / 2, cv.width * 0.3, d, 0, th);
    const c = Math.cos(th / 2), s = Math.sin(th / 2);
    $('ch2-bar-fine').style.width = (100 * c * c) + '%';
    $('ch2-bar-flip').style.width = (100 * s * s) + '%';
    $('ch2-fine').textContent = (100 * c * c).toFixed(2) + '%';
    $('ch2-flip').textContent = (100 * s * s).toFixed(2) + '%';
    $('ch2-eq').innerHTML = `tilted qubit = <b>${c.toFixed(3)}</b> |+⟩ − i <b>${s.toFixed(3)}</b> |−⟩`;
    $('ch2-counts').textContent = counts.fine + counts.flip
      ? `${counts.fine + counts.flip} measurements: ${counts.fine} fine, ${counts.flip} flipped (${(100 * counts.flip / (counts.fine + counts.flip)).toFixed(1)}%).`
      : 'Each measurement returns fine or flipped with the probabilities above.';
  }
  $('ch2-theta').oninput = () => { counts = { fine: 0, flip: 0 }; render(); };
  $('ch2-run').onclick = () => {
    const p = SIM.pFlip(+$('ch2-theta').value * Math.PI / 180);
    for (let i = 0; i < 1000; i++) Math.random() < p ? counts.flip++ : counts.fine++;
    render();
  };
  SIM.draggable(cv, render);
  window.addEventListener('resize', render);
  render();
})();
