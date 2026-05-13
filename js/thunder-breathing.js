(function () {
  // ── Canvas setup ──
  const canvas = document.createElement('canvas');
  canvas.id = 'thunder-breathing-canvas';
  canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:99999;';
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  // ── Config ──
  const TRIGGER_SPEED = 2;        // px/ms
  const MIN_STRIKE_DISTANCE = 50; // px
  const COLOR_PALETTE_LIST = [
    { color: '#4dc9f6', coreColor: '#e8fbff' },
    { color: '#4cf5f5', coreColor: '#e6f1f7' },
  ];

  // ── Performance config ──
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
    || ('ontouchstart' in window && navigator.maxTouchPoints > 0);

  const MAIN_GLOW_LAYERS = isMobile
    ? [[8, 0.1], [3, 0.3], [1.5, 0.7], [0.8, 1]]
    : [[12, 0.06], [8, 0.12], [5, 0.2], [3, 0.4], [1.8, 0.7], [0.8, 1]];

  const BRANCH_GLOW_LAYERS = isMobile
    ? [[3, 0.15], [1, 0.6]]
    : [[6, 0.08], [3, 0.2], [1.5, 0.45], [0.6, 0.8]];

  const MIN_SEG = isMobile ? 5 : 3;
  const BRANCH_MIN_SEG = isMobile ? 8 : 4;
  const MAX_BRANCH = isMobile ? 20 : Infinity;
  const MAX_BOLT = isMobile ? 10 : Infinity;
  const MAX_PIXEL_RATIO = isMobile ? 2 : Infinity;
  const MAIN_BASE_WIDTH = 3;
  const BRANCH_BASE_WIDTH = 1;

  // ── Canvas sizing ──
  const pixelRatio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);

  function syncSize() {
    canvas.width = window.innerWidth * pixelRatio;
    canvas.height = window.innerHeight * pixelRatio;
  }
  syncSize();
  window.addEventListener('resize', syncSize);

  // ── State ──
  const boltList = [];
  let screenFlashAlpha = 0;

  // ── Mouse velocity tracking ──
  let mouseX = 0, mouseY = 0;
  let lastMouseX = 0, lastMouseY = 0;
  let lastMouseTime = performance.now();
  let speed = 0;
  let lastStrikePos = null;
  const mountTime = performance.now();
  const MOUNT_DELAY_MS = 100;

  document.addEventListener('mousemove', function (e) {
    const now = performance.now();
    const dt = now - lastMouseTime;
    mouseX = e.clientX;
    mouseY = e.clientY;

    if (dt > 0) {
      const vx = (mouseX - lastMouseX) / dt;
      const vy = (mouseY - lastMouseY) / dt;
      speed = Math.sqrt(vx * vx + vy * vy);

      if (now - mountTime >= MOUNT_DELAY_MS && window.thunderEnabled !== false) {
        handleVelocity();
      }
    }

    lastMouseX = mouseX;
    lastMouseY = mouseY;
    lastMouseTime = now;
  });

  function handleVelocity() {
    if (speed < TRIGGER_SPEED * 0.3) {
      lastStrikePos = null;
      return;
    }
    if (speed < TRIGGER_SPEED) return;

    const currentPos = { x: mouseX, y: mouseY };

    if (lastStrikePos) {
      const dx = currentPos.x - lastStrikePos.x;
      const dy = currentPos.y - lastStrikePos.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance >= MIN_STRIKE_DISTANCE) {
        const palette = COLOR_PALETTE_LIST[Math.floor(Math.random() * COLOR_PALETTE_LIST.length)];
        strike(lastStrikePos, currentPos, palette);
        lastStrikePos = currentPos;
      }
    } else {
      lastStrikePos = { x: currentPos.x, y: currentPos.y };
    }
  }

  // ── Lightning path generation (midpoint displacement) ──
  function generateBoltPath(start, end, displacement, minSeg) {
    var xList = [start.x, end.x];
    var yList = [start.y, end.y];
    var curDisp = displacement;

    while (curDisp > minSeg) {
      var newX = [xList[0]];
      var newY = [yList[0]];

      for (var i = 0; i < xList.length - 1; i++) {
        var sx = xList[i], sy = yList[i];
        var ex = xList[i + 1], ey = yList[i + 1];
        var midX = (sx + ex) * 0.5;
        var midY = (sy + ey) * 0.5;
        var dx = ex - sx, dy = ey - sy;
        var len = Math.sqrt(dx * dx + dy * dy);
        if (len === 0) { newX.push(ex); newY.push(ey); continue; }
        var nx = -dy / len, ny = dx / len;
        var offset = (Math.random() - 0.5) * curDisp;
        newX.push(midX + nx * offset, ex);
        newY.push(midY + ny * offset, ey);
      }

      xList = newX;
      yList = newY;
      curDisp *= 0.5;
    }

    var count = xList.length;
    var data = new Float64Array(count * 2);
    for (var j = 0; j < count; j++) {
      data[j * 2] = xList[j];
      data[j * 2 + 1] = yList[j];
    }
    return { pointData: data, pointCount: count };
  }

  function generateBranches(mainPath, branchCount, displacement) {
    var branches = [];
    var pd = mainPath.pointData, pc = mainPath.pointCount;

    for (var i = 0; i < branchCount; i++) {
      var bi = Math.floor(Math.random() * (pc - 2)) + 1;
      var bx = pd[bi * 2], by = pd[bi * 2 + 1];
      var px = pd[(bi - 1) * 2], py = pd[(bi - 1) * 2 + 1];
      var angle = Math.atan2(by - py, bx - px) + (Math.random() - 0.5) * Math.PI * 0.9;
      var branchLen = displacement * (0.3 + Math.random() * 0.7);
      branches.push(generateBoltPath(
        { x: bx, y: by },
        { x: bx + Math.cos(angle) * branchLen, y: by + Math.sin(angle) * branchLen },
        displacement * 0.4,
        BRANCH_MIN_SEG,
      ));
    }
    return branches;
  }

  // ── Drawing ──
  function drawPath(path, color, alpha, lineWidth) {
    if (path.pointCount < 2 || alpha <= 0.01) return;
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.moveTo(path.pointData[0], path.pointData[1]);
    for (var i = 1; i < path.pointCount; i++) {
      ctx.lineTo(path.pointData[i * 2], path.pointData[i * 2 + 1]);
    }
    ctx.stroke();
  }

  function drawBolt(bolt) {
    var lifeRatio = bolt.remainingLife / bolt.totalLife;
    var alpha = lifeRatio * lifeRatio; // easeOut: stays bright, fades quickly at end
    if (alpha <= 0) return;

    for (var k = 0; k < MAIN_GLOW_LAYERS.length; k++) {
      var wm = MAIN_GLOW_LAYERS[k][0], am = MAIN_GLOW_LAYERS[k][1];
      drawPath(bolt.mainPath, wm < 1 ? bolt.coreColor : bolt.color, alpha * am, MAIN_BASE_WIDTH * wm);
    }
    for (var b = 0; b < bolt.branchPaths.length; b++) {
      for (var m = 0; m < BRANCH_GLOW_LAYERS.length; m++) {
        var bwm = BRANCH_GLOW_LAYERS[m][0], bam = BRANCH_GLOW_LAYERS[m][1];
        drawPath(bolt.branchPaths[b], bwm < 1 ? bolt.coreColor : bolt.color, alpha * bam * 0.7, BRANCH_BASE_WIDTH * bwm);
      }
    }
  }

  function jitterPath(path, amount) {
    for (var i = 1; i < path.pointCount - 1; i++) {
      path.pointData[i * 2] += (Math.random() - 0.5) * amount;
      path.pointData[i * 2 + 1] += (Math.random() - 0.5) * amount;
    }
  }

  // ── Strike ──
  function strike(start, end, palette) {
    var dx = end.x - start.x, dy = end.y - start.y;
    var distance = Math.sqrt(dx * dx + dy * dy);
    var displacement = distance * 0.55;

    while (boltList.length >= MAX_BOLT) boltList.shift();

    var mainPath = generateBoltPath(start, end, displacement, MIN_SEG);
    var branchCount = Math.min(Math.floor(distance / 30) + 3, MAX_BRANCH);
    var branchPaths = generateBranches(mainPath, branchCount, distance);
    var life = 300 + Math.random() * 200;

    boltList.push({ mainPath: mainPath, branchPaths: branchPaths, remainingLife: life, totalLife: life, color: palette.color, coreColor: palette.coreColor });

    screenFlashAlpha = Math.min(screenFlashAlpha + 0.08, 0.2);

    // Secondary bolt (70% chance)
    if (boltList.length < MAX_BOLT && Math.random() > 0.3) {
      var sp = generateBoltPath(start, end, displacement * 0.7, MIN_SEG + 1);
      var sc = Math.min(Math.floor(branchCount * 0.5), MAX_BRANCH);
      var sl = generateBranches(sp, sc, distance * 0.6);
      var sLife = 200 + Math.random() * 150;
      boltList.push({ mainPath: sp, branchPaths: sl, remainingLife: sLife, totalLife: sLife, color: palette.color, coreColor: palette.coreColor });
    }

    // Tertiary thin bolt (40% chance)
    if (boltList.length < MAX_BOLT && Math.random() > 0.6) {
      var tp = generateBoltPath(start, end, displacement * 0.9, MIN_SEG + 2);
      var tLife = 150 + Math.random() * 100;
      boltList.push({ mainPath: tp, branchPaths: [], remainingLife: tLife, totalLife: tLife, color: palette.color, coreColor: palette.coreColor });
    }
  }

  // ── Animation loop ──
  var lastTime = performance.now();

  function loop(now) {
    var delta = now - lastTime;
    lastTime = now;

    ctx.resetTransform();
    ctx.scale(pixelRatio, pixelRatio);
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    if (window.thunderEnabled === false) {
      boltList.length = 0;
      screenFlashAlpha = 0;
      lastStrikePos = null;
      requestAnimationFrame(loop);
      return;
    }

    if (screenFlashAlpha > 0.01) {
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = screenFlashAlpha;
      ctx.fillStyle = '#e0e8ff';
      ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
      screenFlashAlpha *= 0.85;
    }

    if (boltList.length > 0) {
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalCompositeOperation = 'lighter';

      for (var i = boltList.length - 1; i >= 0; i--) {
        var bolt = boltList[i];
        bolt.remainingLife -= delta;
        if (bolt.remainingLife <= 0) { boltList.splice(i, 1); continue; }
        if (bolt.remainingLife > bolt.totalLife * 0.3) {
          jitterPath(bolt.mainPath, 2.5);
          for (var b = 0; b < bolt.branchPaths.length; b++) jitterPath(bolt.branchPaths[b], 1.5);
        }
        drawBolt(bolt);
      }

      ctx.globalCompositeOperation = 'source-over';
    }

    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
})();
