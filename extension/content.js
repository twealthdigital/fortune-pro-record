(() => {
  if (window.top !== window) return;

  const DEFAULTS = { on: false, circle: true, mirror: true, size: 200, x: null, y: null };
  let state = { ...DEFAULTS };
  let host = null;
  let shadow = null;

  const CSS = `
    .box{position:fixed;cursor:grab;user-select:none;touch-action:none;}
    .box.dragging{cursor:grabbing;}
    .clip{position:absolute;inset:0;overflow:hidden;box-sizing:border-box;border:3px solid #ff6b00;background:#000;
      box-shadow:0 0 0 4px rgba(255,107,0,.25),0 10px 30px rgba(0,0,0,.6),0 0 26px rgba(255,107,0,.5);transition:border-radius .25s ease;}
    .box.circle .clip{border-radius:50%;}
    .box.square .clip{border-radius:18px;}
    iframe{position:absolute;inset:0;width:100%;height:100%;border:0;background:#000;pointer-events:none;}
    .box.mirror iframe{transform:scaleX(-1);}
    .bar{position:absolute;left:50%;bottom:12%;transform:translateX(-50%);display:flex;gap:6px;padding:4px 6px;border-radius:999px;
      background:rgba(10,10,10,.85);border:1px solid rgba(255,107,0,.6);opacity:0;transition:opacity .2s;}
    .box:hover .bar{opacity:1;}
    .bar button{all:unset;cursor:pointer;width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;
      color:#f5f2ee;font:700 12px system-ui,sans-serif;}
    .bar button:hover{background:#ff6b00;color:#000;}
    .grip{position:absolute;right:-6px;bottom:-6px;width:18px;height:18px;border-radius:50%;background:#ff6b00;border:2px solid #000;
      cursor:nwse-resize;opacity:0;transition:opacity .2s;}
    .box:hover .grip{opacity:1;}
  `;

  function dims() {
    const w = state.size;
    const h = state.circle ? state.size : Math.round(state.size * 0.75);
    return { w, h };
  }

  function clampPos() {
    const { w, h } = dims();
    if (state.x === null || state.y === null) {
      state.x = window.innerWidth - w - 24;
      state.y = window.innerHeight - h - 24;
    }
    state.x = Math.max(0, Math.min(state.x, window.innerWidth - w));
    state.y = Math.max(0, Math.min(state.y, window.innerHeight - h));
  }

  function save(keys) {
    const out = {};
    keys.forEach((k) => { out[k] = state[k]; });
    try { chrome.storage.local.set(out); } catch (e) {}
  }

  function build() {
    host = document.createElement('div');
    host.id = '__fortune_cam_bubble__';
    host.style.cssText = 'all:initial;position:fixed;top:0;left:0;width:0;height:0;z-index:2147483647;';
    shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
      <style>${CSS}</style>
      <div class="box">
        <div class="clip">
          <iframe allow="camera"></iframe>
          <div class="bar">
            <button data-act="shape" title="Circle or square">&#9679;</button>
            <button data-act="mirror" title="Mirror">&#8644;</button>
            <button data-act="close" title="Turn off">&#10005;</button>
          </div>
        </div>
        <div class="grip"></div>
      </div>`;
    shadow.querySelector('iframe').src = chrome.runtime.getURL('bubble.html');
    document.documentElement.appendChild(host);

    const box = shadow.querySelector('.box');
    const grip = shadow.querySelector('.grip');

    shadow.querySelector('.bar').addEventListener('pointerdown', (e) => e.stopPropagation());
    shadow.querySelector('.bar').addEventListener('click', (e) => {
      const act = e.target.closest('button') && e.target.closest('button').dataset.act;
      if (act === 'shape') { state.circle = !state.circle; clampPos(); apply(); save(['circle', 'x', 'y']); }
      if (act === 'mirror') { state.mirror = !state.mirror; apply(); save(['mirror']); }
      if (act === 'close') { state.on = false; save(['on']); render(); }
    });

    let dragging = false, ox = 0, oy = 0;
    box.addEventListener('pointerdown', (e) => {
      if (e.target === grip) return;
      dragging = true;
      box.classList.add('dragging');
      box.setPointerCapture(e.pointerId);
      ox = e.clientX - state.x;
      oy = e.clientY - state.y;
      e.preventDefault();
    });
    box.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      state.x = e.clientX - ox;
      state.y = e.clientY - oy;
      clampPos();
      apply();
    });
    const endDrag = () => {
      if (!dragging) return;
      dragging = false;
      box.classList.remove('dragging');
      save(['x', 'y']);
    };
    box.addEventListener('pointerup', endDrag);
    box.addEventListener('pointercancel', endDrag);

    let resizing = false, sx = 0, startSize = 0;
    grip.addEventListener('pointerdown', (e) => {
      resizing = true;
      grip.setPointerCapture(e.pointerId);
      sx = e.clientX;
      startSize = state.size;
      e.preventDefault();
      e.stopPropagation();
    });
    grip.addEventListener('pointermove', (e) => {
      if (!resizing) return;
      state.size = Math.max(110, Math.min(520, startSize + (e.clientX - sx)));
      clampPos();
      apply();
    });
    const endResize = () => {
      if (!resizing) return;
      resizing = false;
      save(['size', 'x', 'y']);
    };
    grip.addEventListener('pointerup', endResize);
    grip.addEventListener('pointercancel', endResize);
  }

  function apply() {
    if (!shadow) return;
    const box = shadow.querySelector('.box');
    const { w, h } = dims();
    box.style.left = state.x + 'px';
    box.style.top = state.y + 'px';
    box.style.width = w + 'px';
    box.style.height = h + 'px';
    box.classList.toggle('circle', state.circle);
    box.classList.toggle('square', !state.circle);
    box.classList.toggle('mirror', state.mirror);
  }

  function render() {
    if (!state.on) {
      if (host) { host.remove(); host = null; shadow = null; }
      return;
    }
    if (!host) build();
    clampPos();
    apply();
  }

  try {
    chrome.storage.local.get(null, (v) => {
      state = { ...DEFAULTS, ...v };
      render();
    });
    chrome.storage.onChanged.addListener((changes) => {
      Object.keys(changes).forEach((k) => { state[k] = changes[k].newValue; });
      render();
    });
  } catch (e) {}

  window.addEventListener('resize', () => { if (state.on) { clampPos(); apply(); } });
})();
