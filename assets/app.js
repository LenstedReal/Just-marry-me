(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var DPR = Math.min(window.devicePixelRatio || 1, 2);
  var W = window.innerWidth, H = window.innerHeight;

  // ---------- personalisation (?isim=...) ----------
  (function () {
    var name = "tugce'm";
    try {
      var q = new URLSearchParams(location.search).get('isim');
      if (q) { q = q.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 24); if (q) name = q; }
    } catch (e) {}
    $('letterName').textContent = name; // textContent => no HTML injection
  })();

  // ---------- audio ----------
  var audioCtx = null, muted = false;
  try { muted = localStorage.getItem('jm-muted') === '1'; } catch (e) {}
  var muteBtn = $('muteBtn');
  function syncMute() { muteBtn.setAttribute('aria-pressed', String(muted)); muteBtn.setAttribute('aria-label', muted ? 'Sesi aç' : 'Sesi kapat'); }
  syncMute();
  muteBtn.addEventListener('click', function (e) {
    e.stopPropagation(); muted = !muted; syncMute();
    try { localStorage.setItem('jm-muted', muted ? '1' : '0'); } catch (err) {}
  });
  function initAudio() {
    try {
      if (!audioCtx) { var AC = window.AudioContext || window.webkitAudioContext; if (AC) audioCtx = new AC(); }
      if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    } catch (e) { audioCtx = null; }
  }
  function tone(freq, start, dur, type, vol, toFreq) {
    if (muted || !audioCtx) return;
    var t = audioCtx.currentTime + start, o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t);
    if (toFreq) o.frequency.exponentialRampToValueAtTime(toFreq, t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol || .15, t + .02); g.gain.exponentialRampToValueAtTime(.001, t + dur);
    o.connect(g); g.connect(audioCtx.destination); o.start(t); o.stop(t + dur + .02);
  }
  function playEnvelopeSound() { tone(180, 0, .35, 'triangle', .12, 380); tone(900, .05, .25, 'sine', .05, 1400); }
  function playClickSound() { tone(750, 0, .08, 'square', .06); }
  function playAcceptanceSound() {
    [[523.25, 0], [587.33, .12], [659.25, .24], [783.99, .36], [1046.5, .52]].forEach(function (n) { tone(n[0], n[1], .4, 'sine', .18); });
    [1318.5, 1568, 2093].forEach(function (f, i) { tone(f, .8 + i * .09, .6, 'triangle', .05); });
  }
  document.addEventListener('pointerdown', initAudio, { once: true });
  document.addEventListener('touchstart', initAudio, { once: true, passive: true });

  // ---------- canvases ----------
  var bg = $('bgCanvas'), bctx = bg.getContext('2d');
  var fx = $('fxCanvas'), fctx = fx.getContext('2d');
  function resize() {
    W = window.innerWidth; H = window.innerHeight;
    [bg, fx].forEach(function (c) { c.width = Math.round(W * DPR); c.height = Math.round(H * DPR); });
    bctx.setTransform(DPR, 0, 0, DPR, 0, 0); fctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  resize();
  window.addEventListener('resize', resize);

  // bokeh background with parallax
  var bokeh = [], nB = reduced ? 18 : Math.round(Math.min(70, 30 + W / 30));
  for (var i = 0; i < nB; i++) {
    var depth = Math.random();
    bokeh.push({ x: Math.random(), y: Math.random(), r: 2 + depth * depth * 26, d: depth, a: .05 + Math.random() * .22,
      vy: -(0.004 + depth * .012) / 60, hue: 330 + Math.random() * 30, ph: Math.random() * 6.28 });
  }
  var ptr = { x: 0, y: 0, tx: 0, ty: 0 };
  window.addEventListener('pointermove', function (e) { ptr.tx = e.clientX / W - .5; ptr.ty = e.clientY / H - .5; }, { passive: true });
  window.addEventListener('deviceorientation', function (e) {
    if (e.gamma == null) return; ptr.tx = Math.max(-.5, Math.min(.5, e.gamma / 60)); ptr.ty = Math.max(-.5, Math.min(.5, (e.beta - 40) / 60));
  }, { passive: true });
  var scene = $('envScene'), envelope = $('envelope');
  function drawBg(t) {
    ptr.x += (ptr.tx - ptr.x) * .05; ptr.y += (ptr.ty - ptr.y) * .05;
    bctx.clearRect(0, 0, W, H);
    for (var i = 0; i < bokeh.length; i++) {
      var b = bokeh[i];
      if (!reduced) { b.y += b.vy; if (b.y < -.1) { b.y = 1.1; b.x = Math.random(); } }
      var x = b.x * W - ptr.x * b.d * 60, y = b.y * H - ptr.y * b.d * 40;
      var tw = .6 + .4 * Math.sin(t / 1400 + b.ph);
      var g = bctx.createRadialGradient(x, y, 0, x, y, b.r);
      g.addColorStop(0, 'hsla(' + b.hue + ',100%,75%,' + (b.a * tw) + ')');
      g.addColorStop(1, 'hsla(' + b.hue + ',100%,60%,0)');
      bctx.fillStyle = g; bctx.beginPath(); bctx.arc(x, y, b.r, 0, 6.2832); bctx.fill();
    }
    if (!reduced && !scene.classList.contains('away')) {
      envelope.style.setProperty('--ry', (ptr.x * 14).toFixed(2) + 'deg');
      envelope.style.setProperty('--rx', (8 - ptr.y * 10).toFixed(2) + 'deg');
    }
  }

  // ---------- fx particles ----------
  var parts = [];
  function heartXY(t) {
    return { x: 16 * Math.pow(Math.sin(t), 3), y: -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) };
  }
  function burst(x, y, n, speed, colors) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * 6.2832, s = speed * (.4 + Math.random() * .8);
      parts.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: .08, life: 1, decay: .012 + Math.random() * .02,
        r: 1.5 + Math.random() * 2.5, c: colors[i % colors.length], kind: 'dot' });
    }
  }
  function heartBloom(cx, cy, scale, n) {
    for (var i = 0; i < n; i++) {
      var p = heartXY((i / n) * 6.2832), tx = cx + p.x * scale, ty = cy + p.y * scale;
      parts.push({ x: cx, y: cy, sx: cx, sy: cy, tx: tx, ty: ty, t: 0, dl: Math.random() * .15, vx: 0, vy: 0, g: .05, life: 1, decay: .008,
        r: 2 + Math.random() * 1.6, c: ['#ff4d8d', '#ff9cc2', '#ffd1e1', '#ff2f6d'][i % 4], kind: 'bloom' });
    }
  }
  function confetti(n) {
    for (var i = 0; i < n; i++) {
      parts.push({ x: Math.random() * W, y: -20 - Math.random() * H * .6, vx: (Math.random() - .5) * 1.2, vy: 1 + Math.random() * 2, g: .015,
        life: 1, decay: .0025 + Math.random() * .002, r: 7 + Math.random() * 9, rot: Math.random() * 6, vr: (Math.random() - .5) * .1,
        sw: Math.random() * 6, c: ['#ff4d8d', '#ff8fbd', '#ffffff', '#ff2f6d', '#ffc2d8'][i % 5], kind: 'heart' });
    }
  }
  function drawHeartShape(c, x, y, s, rot) {
    c.save(); c.translate(x, y); c.rotate(rot); c.scale(s / 32, s / 32);
    c.beginPath(); c.moveTo(0, 10); c.bezierCurveTo(-18, -2, -10, -16, 0, -7); c.bezierCurveTo(10, -16, 18, -2, 0, 10); c.fill(); c.restore();
  }
  function drawFx() {
    fctx.clearRect(0, 0, W, H);
    if (!parts.length) return;
    fctx.globalCompositeOperation = 'lighter';
    for (var i = parts.length - 1; i >= 0; i--) {
      var p = parts[i];
      if (p.kind === 'bloom') {
        if (p.t < 1) { p.t = Math.min(1, p.t + .018); var k = Math.max(0, (p.t - p.dl) / (1 - p.dl)), e = 1 - Math.pow(1 - k, 3);
          p.x = p.sx + (p.tx - p.sx) * e; p.y = p.sy + (p.ty - p.sy) * e; }
        else { p.vy += p.g * .3; p.y += p.vy; p.x += (Math.random() - .5) * .4; p.life -= p.decay; }
      } else {
        p.vy += p.g; p.x += p.vx; p.y += p.vy; p.life -= p.decay;
        if (p.kind === 'dot') { p.vx *= .97; p.vy *= .97; }
      }
      if (p.life <= 0 || p.y > H + 40) { parts.splice(i, 1); continue; }
      fctx.globalAlpha = Math.max(0, Math.min(1, p.life));
      fctx.fillStyle = p.c;
      if (p.kind === 'heart') {
        fctx.globalCompositeOperation = 'source-over';
        p.rot += p.vr; p.sw += .05;
        drawHeartShape(fctx, p.x + Math.sin(p.sw) * 12, p.y, p.r * 2, p.rot);
        fctx.globalCompositeOperation = 'lighter';
      } else {
        fctx.beginPath(); fctx.arc(p.x, p.y, p.r, 0, 6.2832); fctx.fill();
        fctx.globalAlpha *= .25; fctx.beginPath(); fctx.arc(p.x, p.y, p.r * 3, 0, 6.2832); fctx.fill();
      }
    }
    fctx.globalAlpha = 1; fctx.globalCompositeOperation = 'source-over';
  }

  // ---------- incremental heart outline ----------
  var heart = null;
  function startHeart() {
    var c = $('heartCanvas'), ctx = c.getContext('2d');
    var size = Math.round(Math.min(W * .7, H * .36, 380));
    c.width = size * DPR; c.height = size * DPR; c.style.width = size + 'px'; c.style.height = size + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.clearRect(0, 0, size, size);
    ctx.lineWidth = Math.max(3, size / 110); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = '#ff4d8d'; ctx.shadowColor = '#ff4d8d'; ctx.shadowBlur = 12;
    var sc = size / 36, cx = size / 2, cy = size / 2 + size * .02;
    var p0 = heartXY(0);
    heart = { ctx: ctx, t: 0, sc: sc, cx: cx, cy: cy, last: { x: p0.x * sc + cx, y: p0.y * sc + cy }, total: reduced ? 1 : 2200, start: performance.now() };
  }
  function drawHeart(now) {
    if (!heart || heart.t >= 6.2832) return;
    var target = Math.min(6.2832, ((now - heart.start) / heart.total) * 6.2832), ctx = heart.ctx;
    ctx.beginPath(); ctx.moveTo(heart.last.x, heart.last.y);
    while (heart.t < target) { // only the new segment is stroked each frame
      heart.t = Math.min(target, heart.t + .02);
      var p = heartXY(heart.t), x = p.x * heart.sc + heart.cx, y = p.y * heart.sc + heart.cy;
      ctx.lineTo(x, y); heart.last = { x: x, y: y };
    }
    ctx.stroke();
  }

  // ---------- main loop ----------
  function loop(t) { drawBg(t); drawFx(); drawHeart(t); requestAnimationFrame(loop); }
  requestAnimationFrame(loop);

  // ---------- envelope sequence ----------
  var opened = false, letter = $('letter'), seal = $('seal');
  var later = function (fn, ms) { return setTimeout(fn, reduced ? Math.min(ms, 120) : ms); };
  function openEnvelope() {
    if (opened) return; opened = true; initAudio(); playEnvelopeSound();
    var r = seal.getBoundingClientRect();
    if (!reduced) burst(r.left + r.width / 2, r.top + r.height / 2, 60, 6, ['#ff4f73', '#ff9cc2', '#ffd6e0', '#b3002d']);
    seal.classList.add('broken');
    $('headerTxt').classList.add('fade-out');
    later(function () { scene.classList.add('open'); }, 250);
    later(function () {
      scene.classList.add('away');
      letter.classList.add('show'); letter.setAttribute('aria-hidden', 'false');
      var lines = letter.querySelectorAll('.line');
      Array.prototype.forEach.call(lines, function (el, i) { later(function () { el.classList.add('in'); }, 500 + i * 420); });
      later(function () { $('yesBtn').focus({ preventScroll: true }); }, 500 + lines.length * 420);
    }, 1300);
  }
  seal.addEventListener('click', openEnvelope);

  // ---------- HAYIR dodge ----------
  var evasionCount = 0, lastDodge = 0, runBtn = $('runBtn'), yesBtn = $('yesBtn'), inner = $('letterInner');
  function dodge(e) {
    if (e) e.preventDefault();
    var now = Date.now(); if (now - lastDodge < 300 || runBtn.classList.contains('gone')) return; lastDodge = now;
    evasionCount++; playClickSound();
    yesBtn.classList.add('big'); yesBtn.style.setProperty('--yes-scale', String(1 + evasionCount * .12));
    if (evasionCount >= 3) {
      runBtn.classList.add('gone'); runBtn.setAttribute('aria-hidden', 'true'); runBtn.tabIndex = -1;
      yesBtn.style.setProperty('--yes-scale', '1.35'); yesBtn.focus({ preventScroll: true });
      setTimeout(function () { runBtn.style.display = 'none'; }, 450);
      return;
    }
    // move within the visible part of the letter, never outside it, avoiding EVET
    var ir = inner.getBoundingClientRect(), br = runBtn.getBoundingClientRect(), yr = yesBtn.getBoundingClientRect();
    var s = 1 - evasionCount * .18, bw = br.width / (runBtn._s || 1) * s, bh = br.height / (runBtn._s || 1) * s, pad = 10;
    var x, y, tries = 0;
    do {
      x = ir.left + pad + Math.random() * Math.max(0, ir.width - bw - pad * 2);
      y = ir.top + pad + Math.random() * Math.max(0, ir.height - bh - pad * 2);
      tries++;
    } while (tries < 30 && x < yr.right + 8 && x + bw > yr.left - 8 && y < yr.bottom + 8 && y + bh > yr.top - 8);
    if (getComputedStyle(runBtn).position !== 'absolute') {
      runBtn.style.position = 'absolute';
      runBtn.style.left = (br.left - ir.left + inner.scrollLeft) + 'px'; runBtn.style.top = (br.top - ir.top + inner.scrollTop) + 'px';
      runBtn.offsetWidth; // commit start position so the move animates
    }
    runBtn._s = s; runBtn.style.transformOrigin = '0 0'; runBtn.style.transform = 'scale(' + s + ') rotate(' + ((Math.random() - .5) * 16).toFixed(1) + 'deg)';
    runBtn.style.left = (x - ir.left + inner.scrollLeft) + 'px'; runBtn.style.top = (y - ir.top + inner.scrollTop) + 'px';
  }
  inner.style.position = 'relative';
  if (window.matchMedia('(hover: hover)').matches) runBtn.addEventListener('pointerenter', dodge);
  runBtn.addEventListener('pointerdown', dodge);
  runBtn.addEventListener('click', dodge);
  runBtn.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') dodge(e); });

  // ---------- EVET ----------
  var LANGS = [
    ['Seni seviyorum', 'Türkçe', 'tr'], ['I love you', 'English', 'en'], ['Je t’aime', 'Français', 'fr'], ['Te quiero', 'Español', 'es'],
    ['Ich liebe dich', 'Deutsch', 'de'], ['Ti amo', 'Italiano', 'it'], ['Eu te amo', 'Português', 'pt'], ['Ik hou van jou', 'Nederlands', 'nl'],
    ['Я тебя люблю', 'Русский', 'ru'], ['Я тебе кохаю', 'Українська', 'uk'], ['Kocham cię', 'Polski', 'pl'], ['Jag älskar dig', 'Svenska', 'sv'],
    ['Jeg elsker deg', 'Norsk', 'nb'], ['Jeg elsker dig', 'Dansk', 'da'], ['Minä rakastan sinua', 'Suomi', 'fi'], ['Szeretlek', 'Magyar', 'hu'],
    ['Miluji tě', 'Čeština', 'cs'], ['Te iubesc', 'Română', 'ro'], ['Σ’ αγαπώ', 'Ελληνικά', 'el'], ['Səni sevirəm', 'Azərbaycanca', 'az'],
    ['Volim te', 'Bosanski', 'bs'], ['Të dua', 'Shqip', 'sq'], ['Aku cinta kamu', 'Bahasa Indonesia', 'id'], ['أحبك', 'العربية', 'ar'],
    ['دوستت دارم', 'فارسی', 'fa'], ['אני אוהב אותך', 'עברית', 'he'], ['मैं तुमसे प्यार करता हूँ', 'हिन्दी', 'hi'],
    ['愛してる', '日本語', 'ja'], ['사랑해', '한국어', 'ko'], ['我爱你', '中文', 'zh'], ['Mahal kita', 'Filipino', 'fil'], ['Nakupenda', 'Kiswahili', 'sw']
  ];
  var RTL = { ar: 1, fa: 1, he: 1 }, langTimer = null;
  function cycleLangs() {
    var i = 0, box = $('langs'), txt = $('langText'), nm = $('langName');
    function set() { var l = LANGS[i]; txt.textContent = l[0]; nm.textContent = l[1]; txt.lang = l[2]; txt.dir = RTL[l[2]] ? 'rtl' : 'ltr'; }
    set();
    langTimer = setInterval(function () {
      box.classList.add('swap');
      setTimeout(function () { i = (i + 1) % LANGS.length; set(); box.classList.remove('swap'); }, 600);
    }, 2400);
  }
  var accepted = false;
  function accept(e) {
    // A tap on HAYIR moves it away; the browser then fires that same tap's click on whatever is now under the finger,
    // which can be the growing EVET. Ignore any EVET click that comes right after a dodge, and synthetic clicks.
    if (e && (e.isTrusted === false || Date.now() - lastDodge < 800)) return;
    if (accepted) return; accepted = true; initAudio(); playAcceptanceSound();
    var ov = $('final-overlay'); ov.classList.add('show'); ov.setAttribute('aria-hidden', 'false');
    letter.setAttribute('aria-hidden', 'true');
    setTimeout(function () { letter.style.opacity = '0'; letter.style.visibility = 'hidden'; }, 400);
    if (!reduced) {
      var fi = $('finalInner'); fi.classList.add('shake-soft'); setTimeout(function () { fi.classList.remove('shake-soft'); }, 700);
      heartBloom(W / 2, H / 2, Math.min(W, H) / 38, 220);
      setTimeout(function () { burst(W * .25, H * .3, 70, 7, ['#ff4d8d', '#ffd1e1', '#fff']); }, 500);
      setTimeout(function () { burst(W * .75, H * .35, 70, 7, ['#ff2f6d', '#ff9cc2', '#fff']); }, 800);
      setTimeout(function () { confetti(Math.round(Math.min(110, W / 6))); }, 300);
      setTimeout(function () { confetti(Math.round(Math.min(60, W / 10))); }, 3500);
    }
    setTimeout(startHeart, reduced ? 0 : 700);
    setTimeout(cycleLangs, reduced ? 0 : 2600);
    setTimeout(function () { $('replayBtn').focus({ preventScroll: true }); }, 3200);
  }
  yesBtn.addEventListener('click', accept);
  $('replayBtn').addEventListener('click', function () { location.reload(); });
})();
