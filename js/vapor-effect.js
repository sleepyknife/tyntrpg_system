(function () {
  // 水氣效果僅限有滑鼠的裝置
  if (typeof window.matchMedia === 'function' && !window.matchMedia('(pointer: fine)').matches) return;

  window.vaporEnabled = true;

  const canvas = document.createElement('canvas');
  canvas.id = 'vapor-canvas';
  canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:99998;';
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  let W = window.innerWidth, H = window.innerHeight;
  canvas.width = W; canvas.height = H;
  window.addEventListener('resize', function () {
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = W; canvas.height = H;
  });

  const particles = [];
  let mx = -9999, my = -9999;
  let lastMx = -9999, lastMy = -9999;
  let spawnAccum = 0;

  document.addEventListener('mousemove', function (e) {
    mx = e.clientX; my = e.clientY;
  });

  function spawnParticle(x, y) {
    const size = 8 + Math.random() * 18;
    particles.push({
      x: x + (Math.random() - 0.5) * 16,
      y: y + (Math.random() - 0.5) * 8,
      vx: (Math.random() - 0.5) * 0.5,
      vy: -(0.3 + Math.random() * 0.7),
      size: size,
      maxSize: size + 20 + Math.random() * 30,
      alpha: 0.28 + Math.random() * 0.18,
      life: 0,
      maxLife: 80 + Math.random() * 60,
    });
  }

  let lastTime = null;
  function loop(ts) {
    requestAnimationFrame(loop);
    if (!window.vaporEnabled) {
      ctx.clearRect(0, 0, W, H);
      return;
    }

    const dt = lastTime ? Math.min(ts - lastTime, 50) : 16;
    lastTime = ts;

    // 根據滑鼠移動速度決定生成數量
    const dx = mx - lastMx, dy = my - lastMy;
    const speed = Math.sqrt(dx * dx + dy * dy);
    lastMx = mx; lastMy = my;

    if (speed > 1.5) {
      spawnAccum += speed * 0.12;
      while (spawnAccum >= 1) {
        spawnParticle(mx, my);
        spawnAccum -= 1;
      }
    }

    ctx.clearRect(0, 0, W, H);

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life += dt / 16;
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.98;
      p.vy *= 0.99;

      const progress = p.life / p.maxLife; // 0 → 1
      // 尺寸：線性增大
      const curSize = p.size + (p.maxSize - p.size) * progress;
      // alpha：前20%淡入，後淡出
      const fade = progress < 0.2 ? progress / 0.2 : 1 - (progress - 0.2) / 0.8;
      const curAlpha = p.alpha * fade;

      if (p.life >= p.maxLife) { particles.splice(i, 1); continue; }

      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, curSize);
      grad.addColorStop(0,   `rgba(255,255,255,${curAlpha})`);
      grad.addColorStop(0.5, `rgba(220,235,245,${curAlpha * 0.5})`);
      grad.addColorStop(1,   `rgba(200,220,240,0)`);

      ctx.beginPath();
      ctx.arc(p.x, p.y, curSize, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
    }
  }

  requestAnimationFrame(loop);
})();
