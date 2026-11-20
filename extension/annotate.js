(() => {
  if (window.top !== window) return;
  if (window.__fortuneAnnotateLoaded) return;
  window.__fortuneAnnotateLoaded = true;

  const COLORS = ['#ff3b30', '#ff9500', '#ffd60a', '#34c759', '#0a84ff', '#ffffff', '#000000'];
  const WIDTHS = [3, 6, 10];
  const FADE_HOLD = 2500;
  const FADE_DUR = 800;

  let st = { annOn: false, annColor: '#ff3b30', annWidth: 1, annFade: false, annBarX: null, annBarY: null };
  let tool = 'pointer';
  let shapes = [];
  let current = null;
  let raf = 0;
  let noteCount = 0;
  let host = null, shadow = null, canvas = null, ctx = null, bar = null, notesLayer = null;

  const I = {
    pointer: '<path d="M5 3l14 8-6 2-3 6z"/>',
    pen: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/>',
    arrow: '<path d="M5 19L19 5"/><path d="M9 5h10v10"/>',
    circle: '<ellipse cx="12" cy="12" rx="9" ry="7"/>',
    rect: '<rect x="3.5" y="5.5" width="17" height="13" rx="1.5"/>',
    note: '<path d="M4 4h16v12l-5 5H4z"/><path d="M15 21v-5h5"/>',
    undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 010 12h-3"/>',
    trash: '<path d="M4 7h16"/><path d="M10 11v6M14 11v6"/><path d="M6 7l1 13h10l1-13"/><path d="M9 7V4h6v3"/>',
    fade: '<circle cx="12" cy="12" r="8" stroke-dasharray="3 3"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>'
  };
  const icon = (n) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${I[n]}</svg>`;

  const CSS = `
    *{box-sizing:border-box}
    canvas{position:fixed;left:0;top:0;pointer-events:none;}
    canvas.draw{pointer-events:auto;cursor:crosshair;}
    .bar{position:fixed;display:flex;align-items:center;flex-wrap:wrap;gap:4px;padding:6px 8px;border-radius:14px;
      background:rgba(18,18,20,.95);border:1px solid rgba(255,107,0,.6);box-shadow:0 10px 30px rgba(0,0,0,.55);
      pointer-events:auto;font:12px system-ui,sans-serif;color:#f5f2ee;user-select:none;max-width:calc(100vw - 16px);z-index:5;}
    .grip{width:16px;height:30px;cursor:grab;display:flex;align-items:center;justify-content:center;color:#8a8a8a;font-size:14px;letter-spacing:-2px}
    .grip:active{cursor:grabbing}
    .bar button{all:unset;cursor:pointer;width:30px;height:30px;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#f5f2ee;}
    .bar button svg{width:18px;height:18px}
    .bar button:hover{background:rgba(255,255,255,.14)}
    .bar button.on{background:#ff6b00;color:#000}
    .sep{width:1px;height:22px;background:rgba(255,255,255,.2);margin:0 3px}
    .bar button.sw{width:20px;height:20px;border-radius:50%;border:2px solid rgba(255,255,255,.35);margin:0 1px}
    .bar button.sw.on{border-color:#fff;box-shadow:0 0 0 2px #ff6b00}
    .bar input[type=color]{width:22px;height:22px;padding:0;border:0;background:none;cursor:pointer;border-radius:50%}
    .bar input[type=color]::-webkit-color-swatch-wrapper{padding:0}
    .bar input[type=color]::-webkit-color-swatch{border:2px solid rgba(255,255,255,.35);border-radius:50%}
    .wdot{border-radius:50%;background:#f5f2ee;display:block}
    .bar button.on .wdot{background:#000}
    .notes{position:fixed;left:0;top:0;width:0;height:0;z-index:4}
    .note{position:fixed;display:flex;flex-direction:column;width:320px;height:190px;min-width:200px;min-height:110px;resize:both;overflow:hidden;
      border-radius:12px;box-shadow:0 12px 34px rgba(0,0,0,.5);pointer-events:auto;font-family:system-ui,sans-serif;}
    .note.light{background:#fff;color:#111;border:1px solid #d8d8d8}
    .note.dark{background:#000;color:#fff;border:1px solid #444}
    .nh{display:flex;align-items:center;gap:2px;padding:4px 6px;cursor:grab;user-select:none;flex:0 0 auto}
    .note.light .nh{background:#f0f0f0}
    .note.dark .nh{background:#1c1c1c}
    .ng{flex:1;opacity:.5;font-size:12px}
    .nh button{all:unset;cursor:pointer;min-width:26px;height:24px;padding:0 4px;border-radius:6px;display:flex;align-items:center;justify-content:center;font:700 12px system-ui,sans-serif;}
    .note.light .nh button:hover{background:rgba(0,0,0,.12)}
    .note.dark .nh button:hover{background:rgba(255,255,255,.2)}
    .nb{flex:1;padding:10px 12px;overflow:auto;outline:none;font-size:var(--fs,20px);line-height:1.35;white-space:pre-wrap;word-break:break-word;cursor:text;}
    .nb:empty:before{content:attr(data-ph);opacity:.4}
  `;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const save = (o) => { try { chrome.storage.local.set(o); } catch (e) {} };

  // ---------- drawing ----------
  function resizeCanvas() {
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(window.innerWidth * dpr);
    canvas.height = Math.round(window.innerHeight * dpr);
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    redraw();
  }

  function drawShape(s, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = s.color;
    ctx.fillStyle = s.color;
    ctx.lineWidth = s.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = 'rgba(0,0,0,.35)';
    ctx.shadowBlur = 3;
    if (s.type === 'pen') {
      const p = s.points;
      if (p.length === 1) {
        ctx.beginPath(); ctx.arc(p[0][0], p[0][1], s.width / 2, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(p[0][0], p[0][1]);
        for (let i = 1; i < p.length - 1; i++) {
          const mx = (p[i][0] + p[i + 1][0]) / 2, my = (p[i][1] + p[i + 1][1]) / 2;
          ctx.quadraticCurveTo(p[i][0], p[i][1], mx, my);
        }
        const last = p[p.length - 1];
        ctx.lineTo(last[0], last[1]);
        ctx.stroke();
      }
    } else if (s.type === 'arrow') {
      const dx = s.x2 - s.x1, dy = s.y2 - s.y1;
      const len = Math.hypot(dx, dy);
      if (len > 3) {
        const head = Math.min(len * 0.6, Math.max(16, s.width * 4.5));
        const a = Math.atan2(dy, dx);
        const bx = s.x2 - Math.cos(a) * head * 0.8, by = s.y2 - Math.sin(a) * head * 0.8;
        ctx.beginPath(); ctx.moveTo(s.x1, s.y1); ctx.lineTo(bx, by); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(s.x2, s.y2);
        ctx.lineTo(s.x2 - Math.cos(a - 0.45) * head, s.y2 - Math.sin(a - 0.45) * head);
        ctx.lineTo(s.x2 - Math.cos(a + 0.45) * head, s.y2 - Math.sin(a + 0.45) * head);
        ctx.closePath(); ctx.fill();
      }
    } else if (s.type === 'circle') {
      const rx = Math.abs(s.x2 - s.x1) / 2, ry = Math.abs(s.y2 - s.y1) / 2;
      if (rx > 1 && ry > 1) {
        ctx.beginPath();
        ctx.ellipse((s.x1 + s.x2) / 2, (s.y1 + s.y2) / 2, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (s.type === 'rect') {
      ctx.strokeRect(Math.min(s.x1, s.x2), Math.min(s.y1, s.y2), Math.abs(s.x2 - s.x1), Math.abs(s.y2 - s.y1));
    }
    ctx.restore();
  }

  function redraw(now) {
    if (!ctx) return;
    now = now || performance.now();
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    shapes.forEach((s) => {
      let alpha = 1;
      if (s.born) alpha = clamp(1 - (now - s.born - FADE_HOLD) / FADE_DUR, 0, 1);
      if (alpha > 0) drawShape(s, alpha);
    });
    if (current) drawShape(current, 1);
  }

  function tick() {
    raf = 0;
    const now = performance.now();
    shapes = shapes.filter((s) => !(s.born && now - s.born > FADE_HOLD + FADE_DUR));
    redraw(now);
    if (shapes.some((s) => s.born)) raf = requestAnimationFrame(tick);
  }
  function startTick() { if (!raf && shapes.some((s) => s.born)) raf = requestAnimationFrame(tick); }

  function onDown(e) {
    if (tool === 'pointer' || e.button !== 0) return;
    canvas.setPointerCapture(e.pointerId);
    current = { type: tool, color: st.annColor, width: WIDTHS[st.annWidth] || 6, points: [[e.clientX, e.clientY]], x1: e.clientX, y1: e.clientY, x2: e.clientX, y2: e.clientY };
    e.preventDefault();
    redraw();
  }
  function onMove(e) {
    if (!current) return;
    if (current.type === 'pen') current.points.push([e.clientX, e.clientY]);
    current.x2 = e.clientX; current.y2 = e.clientY;
    redraw();
  }
  function onUp() {
    if (!current) return;
    if (st.annFade) current.born = performance.now();
    shapes.push(current);
    current = null;
    redraw();
    startTick();
  }

  // ---------- notes ----------
  function addNote() {
    const n = document.createElement('div');
    n.className = 'note light';
    n.innerHTML = `
      <div class="nh"><span class="ng">&#8942;&#8942; note</span>
        <button data-a="theme" title="Switch white / black"><svg viewBox="0 0 24 24" width="14" height="14"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 3a9 9 0 010 18z" fill="currentColor"/></svg></button>
        <button data-a="smaller" title="Smaller text">A&minus;</button>
        <button data-a="bigger" title="Bigger text">A+</button>
        <button data-a="close" title="Close note">&#10005;</button></div>
      <div class="nb" contenteditable="true" spellcheck="false" data-ph="Type your note here..."></div>`;
    const off = (noteCount++ % 6) * 28;
    n.style.left = clamp(window.innerWidth / 2 - 160 + off, 8, Math.max(8, window.innerWidth - 330)) + 'px';
    n.style.top = clamp(110 + off, 8, Math.max(8, window.innerHeight - 200)) + 'px';
    notesLayer.appendChild(n);

    const head = n.querySelector('.nh');
    const body = n.querySelector('.nb');
    let fs = 20;

    ['keydown', 'keyup', 'keypress'].forEach((t) => body.addEventListener(t, (e) => {
      e.stopPropagation();
      if (t === 'keydown' && e.key === 'Escape') body.blur();
    }));
    body.addEventListener('paste', (e) => {
      e.preventDefault();
      const t = (e.clipboardData || window.clipboardData).getData('text/plain');
      document.execCommand('insertText', false, t);
    });

    head.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      const a = b.dataset.a;
      if (a === 'close') n.remove();
      if (a === 'theme') { const d = n.classList.contains('light'); n.classList.toggle('light', !d); n.classList.toggle('dark', d); }
      if (a === 'bigger') { fs = Math.min(72, fs + 4); n.style.setProperty('--fs', fs + 'px'); }
      if (a === 'smaller') { fs = Math.max(10, fs - 4); n.style.setProperty('--fs', fs + 'px'); }
    });

    let drag = false, ox = 0, oy = 0;
    head.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button')) return;
      drag = true; head.setPointerCapture(e.pointerId);
      ox = e.clientX - n.offsetLeft; oy = e.clientY - n.offsetTop;
      e.preventDefault();
    });
    head.addEventListener('pointermove', (e) => {
      if (!drag) return;
      n.style.left = clamp(e.clientX - ox, 0, window.innerWidth - 60) + 'px';
      n.style.top = clamp(e.clientY - oy, 0, window.innerHeight - 40) + 'px';
    });
    const end = () => { drag = false; };
    head.addEventListener('pointerup', end);
    head.addEventListener('pointercancel', end);

    setTimeout(() => body.focus(), 0);
  }

  // ---------- toolbar ----------
  function setTool(t) {
    tool = t;
    if (!shadow) return;
    canvas.classList.toggle('draw', t !== 'pointer');
    shadow.querySelectorAll('[data-tool]').forEach((b) => b.classList.toggle('on', b.dataset.tool === t));
  }

  function syncUI() {
    if (!shadow) return;
    shadow.querySelectorAll('.sw').forEach((b) => b.classList.toggle('on', b.dataset.color.toLowerCase() === (st.annColor || '').toLowerCase()));
    const picker = shadow.querySelector('input[type=color]');
    if (picker && /^#[0-9a-f]{6}$/i.test(st.annColor)) picker.value = st.annColor;
    const dot = shadow.querySelector('.wdot');
    const w = WIDTHS[st.annWidth] || 6;
    dot.style.width = dot.style.height = (w + 4) + 'px';
    shadow.querySelector('[data-act=fade]').classList.toggle('on', !!st.annFade);
  }

  function placeBar() {
    if (!bar) return;
    if (st.annBarX == null || st.annBarY == null) {
      st.annBarX = Math.max(8, (window.innerWidth - bar.offsetWidth) / 2);
      st.annBarY = 16;
    }
    st.annBarX = clamp(st.annBarX, 0, Math.max(0, window.innerWidth - bar.offsetWidth));
    st.annBarY = clamp(st.annBarY, 0, Math.max(0, window.innerHeight - bar.offsetHeight));
    bar.style.left = st.annBarX + 'px';
    bar.style.top = st.annBarY + 'px';
  }

  function build() {
    host = document.createElement('div');
    host.id = '__fortune_annotate__';
    host.style.cssText = 'all:initial;position:fixed;top:0;left:0;width:0;height:0;z-index:2147483646;';
    shadow = host.attachShadow({ mode: 'open' });
    const tools = [['pointer', 'Pointer (use the page normally)'], ['pen', 'Pen'], ['arrow', 'Arrow'], ['circle', 'Circle'], ['rect', 'Box']];
    shadow.innerHTML = `
      <style>${CSS}</style>
      <canvas></canvas>
      <div class="notes"></div>
      <div class="bar">
        <div class="grip" title="Drag toolbar">&#8942;&#8942;</div>
        ${tools.map(([t, title]) => `<button data-tool="${t}" title="${title}">${icon(t)}</button>`).join('')}
        <button data-act="note" title="Add note">${icon('note')}</button>
        <div class="sep"></div>
        ${COLORS.map((c) => `<button class="sw" data-color="${c}" title="${c}" style="background:${c}"></button>`).join('')}
        <input type="color" title="Custom color" value="#ff3b30">
        <button data-act="width" title="Line thickness"><span class="wdot"></span></button>
        <div class="sep"></div>
        <button data-act="fade" title="Auto-fade drawings after 3 seconds">${icon('fade')}</button>
        <button data-act="undo" title="Undo (Ctrl+Z)">${icon('undo')}</button>
        <button data-act="clear" title="Clear drawings">${icon('trash')}</button>
        <button data-act="close" title="Hide tools">${icon('close')}</button>
      </div>`;
    document.documentElement.appendChild(host);

    canvas = shadow.querySelector('canvas');
    ctx = canvas.getContext('2d');
    notesLayer = shadow.querySelector('.notes');
    bar = shadow.querySelector('.bar');

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);

    bar.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.tool) return setTool(b.dataset.tool);
      if (b.classList.contains('sw')) { st.annColor = b.dataset.color; syncUI(); save({ annColor: st.annColor }); if (tool === 'pointer') setTool('pen'); return; }
      const a = b.dataset.act;
      if (a === 'note') addNote();
      if (a === 'undo') { shapes.pop(); redraw(); }
      if (a === 'clear') { shapes = []; redraw(); }
      if (a === 'width') { st.annWidth = (st.annWidth + 1) % WIDTHS.length; syncUI(); save({ annWidth: st.annWidth }); }
      if (a === 'fade') { st.annFade = !st.annFade; syncUI(); save({ annFade: st.annFade }); }
      if (a === 'close') { save({ annOn: false }); st.annOn = false; render(); }
    });
    bar.querySelector('input[type=color]').addEventListener('input', (e) => {
      st.annColor = e.target.value; syncUI(); save({ annColor: st.annColor });
      if (tool === 'pointer') setTool('pen');
    });

    const grip = bar.querySelector('.grip');
    let drag = false, ox = 0, oy = 0;
    grip.addEventListener('pointerdown', (e) => {
      drag = true; grip.setPointerCapture(e.pointerId);
      ox = e.clientX - st.annBarX; oy = e.clientY - st.annBarY;
      e.preventDefault();
    });
    grip.addEventListener('pointermove', (e) => {
      if (!drag) return;
      st.annBarX = e.clientX - ox; st.annBarY = e.clientY - oy;
      placeBar();
    });
    const endDrag = () => { if (!drag) return; drag = false; save({ annBarX: st.annBarX, annBarY: st.annBarY }); };
    grip.addEventListener('pointerup', endDrag);
    grip.addEventListener('pointercancel', endDrag);

    resizeCanvas();
    setTool('pointer');
    syncUI();
  }

  function render() {
    if (!st.annOn) {
      if (host) { host.style.display = 'none'; setTool('pointer'); }
      return;
    }
    if (!host) build();
    host.style.display = '';
    placeBar();
    syncUI();
  }

  // ---------- keyboard ----------
  window.addEventListener('keydown', (e) => {
    if (!st.annOn || tool === 'pointer') return;
    const t = e.composedPath && e.composedPath()[0];
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA)$/.test(t.tagName))) return;
    if (e.key === 'Escape') { setTool('pointer'); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { shapes.pop(); redraw(); e.preventDefault(); }
  }, true);

  // ---------- state ----------
  try {
    chrome.storage.local.get(null, (v) => {
      Object.keys(st).forEach((k) => { if (v[k] !== undefined) st[k] = v[k]; });
      render();
    });
    chrome.storage.onChanged.addListener((changes) => {
      let changed = false;
      Object.keys(changes).forEach((k) => { if (k in st) { st[k] = changes[k].newValue; changed = true; } });
      if (changed) render();
    });
  } catch (e) {}

  window.addEventListener('resize', () => { if (host) { resizeCanvas(); placeBar(); } });
})();
