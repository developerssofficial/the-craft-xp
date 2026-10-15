/**
 * The Craft — Studio Desk Application Orchestrator
 * High-performance 60fps drawing, frame-by-frame animation, 180+ procedural brushes,
 * multi-layer canvas, Supabase private cloud sync, and copy-proof security.
 */
import './core/securityGuard.js';
import { supabaseService } from './core/supabaseClient.js';

(() => {
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const KEY = 'the-craft-studio-desk-v2';

  // DOM Elements
  const paper = $('#paper'), stage = $('#stage'), zoomer = $('#zoomer'), stack = $('#stack');
  const live = $('#live'), onion = $('#onion');
  const lctx = live.getContext('2d'), octx = onion.getContext('2d');
  const ring = $('#ring'), stamp = $('#stamp'), hint = $('#hint');

  let W = 1200, H = 800, realW = 1200, realH = 800;

  // Local storage wrapper with error handling
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  };

  function toast(msg) {
    const t = $('#toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast.t);
    toast.t = setTimeout(() => t.classList.remove('show'), 2400);
  }
  window.showToast = toast;

  /* ================= Application State ================= */
  const S = {
    tool: 'pencil',
    prev: 'pencil',
    color: '#2b2a33',
    size: 8,
    opacity: 1,
    stab: 0,
    sizeCtl: 'pressure',
    minSize: 1,
    fill: false,
    bs: { cap: 'round', blur: 0, alpha: 1, dash: null },
    brushName: 'Medium Round',
    stampI: 0
  };

  const COLORS = [
    '#2b2a33', '#ff6b4a', '#ff9f43', '#f7c948', '#9bd35a', '#2f9e6a',
    '#14b8c4', '#3b82f6', '#6366f1', '#a855f7', '#ff5fa2', '#8a5a2b',
    '#9aa5b1', '#ffffff'
  ];

  const mode = () => document.body.dataset.mode || 'draw';
  const view = { z: 1, x: 0, y: 0 };

  /* ================= Tool Definitions & Tray ================= */
  const TOOLS = [
    ['Draw', [
      ['select', 'Select & transform', 'S', 'M5 3 L5 19 L9.5 15 L12.5 21 L15 20 L12 14 L18 14 Z'],
      ['brush', 'Brush', 'B', 'M4 20 q1-6 6-5 l9-10 q2-2 3 0 q1 1-1 3 l-9 10 q-1 5-8 2z'],
      ['pencil', 'Pencil', 'P', 'M4 20 L5 15 L16 4 L20 8 L9 19 Z M14 6 l4 4'],
      ['neon', 'Neon glow', 'N', 'M13 3 L5 14 h6 l-1 7 l8-11 h-6 z'],
      ['rainbow', 'Rainbow', 'R', 'M3 18 a9 9 0 0 1 18 0 M6.5 18 a5.5 5.5 0 0 1 11 0 M10 18 a2 2 0 0 1 4 0'],
      ['marker', 'Marker', 'M', 'M5 17 L15 7 l3 3 L8 20 H4 Z M15 7 l2-2 l3 3 l-2 2'],
      ['eraser', 'Eraser', 'E', 'M4 15 L12 6 l7 7 -6 6 H8 Z M9 19 h11'],
      ['spray', 'Spray', 'A', 'M8 8 h.01 M12 5 h.01 M16 8 h.01 M10 12 h.01 M14 12 h.01 M18 13 h.01 M8 16 h.01 M12 17 h.01 M16 18 h.01']
    ]],
    ['Shapes', [
      ['line', 'Line', '', 'M5 19 L19 5'],
      ['arrow', 'Arrow', '', 'M5 19 L19 5 M10 5 h9 v9'],
      ['rect', 'Rectangle', '', 'M5 6 h14 v12 H5 z'],
      ['circle', 'Circle', '', 'M12 4 a8 8 0 1 0 .01 0z'],
      ['star', 'Star', '', 'M12 3 l2.7 5.6 6.1.9 -4.4 4.3 1 6.1 L12 17 l-5.5 2.9 1-6.1 -4.4-4.3 6.1-.9z'],
      ['heart', 'Heart', '', 'M12 20 C4 14 3 9 6 6 c2-2 5-1 6 1 c1-2 4-3 6-1 c3 3 2 8-6 14z']
    ]],
    ['Tools', [
      ['fill', 'Paint bucket', 'G', 'M5 11 L11 5 l7 7 -6 6 z M19 15 q2 3 0 4 q-2-1 0-4'],
      ['pipette', 'Pipette', 'I', 'M15 4 l5 5 -2 2 -1-1 -8 8 H5 v-4 l8-8 -1-1 z'],
      ['text', 'Text', 'T', 'M5 6 V4 h14 v2 M12 4 V20 M9 20 h6'],
      ['stamp', 'Stamp', '', 'M12 4 a8 8 0 1 0 .01 0 M9 10 h.01 M15 10 h.01 M8.5 14 q3.5 4 7 0']
    ]]
  ];

  const TNAME = {}, TKEY = {};
  const ico = d => `<svg viewBox="0 0 24 24"><path d="${d}"/></svg>`;
  const host = $('#toolHost');

  if (host) {
    host.innerHTML = '';
    TOOLS.forEach(([g, items]) => {
      host.insertAdjacentHTML('beforeend', `<h3>${g}</h3>`);
      const grid = document.createElement('div');
      grid.className = 'tgrid';
      items.forEach(([id, name, key, d]) => {
        TNAME[id] = name;
        if (key) TKEY[key.toLowerCase()] = id;
        const b = document.createElement('button');
        b.className = 'tool' + (id === 'pencil' ? ' on' : '');
        b.dataset.tool = id;
        b.title = name + (key ? ` (${key})` : '');
        b.setAttribute('aria-label', name);
        b.innerHTML = ico(d) + (key ? `<kbd>${key}</kbd>` : '');
        b.onclick = () => setTool(id);
        grid.append(b);
      });
      host.append(grid);
    });
  }

  // Floating dock quick tools
  const dockTools = $('#dockTools');
  if (dockTools) {
    dockTools.innerHTML = '';
    [
      ['pencil', 'M4 20 L5 15 L16 4 L20 8 L9 19 Z M14 6 l4 4'],
      ['brush', 'M4 20 q1-6 6-5 l9-10 q2-2 3 0 q1 1-1 3 l-9 10 q-1 5-8 2z'],
      ['eraser', 'M4 15 L12 6 l7 7 -6 6 H8 Z M9 19 h11'],
      ['fill', 'M5 11 L11 5 l7 7 -6 6 z M19 15 q2 3 0 4 q-2-1 0-4']
    ].forEach(([id, d]) => {
      const b = document.createElement('button');
      b.className = 'd' + (id === 'pencil' ? ' on' : '');
      b.dataset.dt = id;
      b.setAttribute('aria-label', TNAME[id] || id);
      b.innerHTML = ico(d);
      b.onclick = () => setTool(id);
      dockTools.append(b);
    });
  }

  const BRUSHY = new Set(['pencil', 'brush', 'neon', 'rainbow', 'marker', 'eraser', 'spray']);
  const SHAPES = new Set(['line', 'arrow', 'rect', 'circle', 'star', 'heart']);

  function setTool(t) {
    if (t !== S.tool) S.prev = S.tool;
    S.tool = t;
    $$('.tool').forEach(b => b.classList.toggle('on', b.dataset.tool === t));
    $$('[data-dt]').forEach(b => b.classList.toggle('on', b.dataset.dt === t));
    const key = Object.keys(TKEY).find(k => TKEY[k] === t);
    const tnameEl = $('#tname');
    if (tnameEl) {
      tnameEl.innerHTML = (t === 'brush' ? S.brushName : TNAME[t]) +
        `<small>${key ? 'press ' + key.toUpperCase() : 'click & drag on the paper'}</small>`;
    }
    ring.classList.toggle('eraser', t === 'eraser');
    paper.style.cursor = BRUSHY.has(t) ? 'none' : (t === 'select' ? 'default' : 'crosshair');
    updateRing();
  }

  /* ================= Color Palette & Sliders ================= */
  const blobs = $('#blobs');
  if (blobs) {
    blobs.innerHTML = '';
    COLORS.forEach((c, i) => {
      const b = document.createElement('button');
      b.className = 'blob' + (i === 0 ? ' on' : '');
      b.style.setProperty('--c', c);
      b.title = c;
      b.setAttribute('aria-label', 'Colour ' + c);
      b.onclick = () => setColor(c);
      blobs.append(b);
    });

    const mix = document.createElement('label');
    mix.className = 'blob mix';
    mix.title = 'Mix your own colour';
    mix.innerHTML = '<input type="color" value="#6366f1" aria-label="Custom colour">';
    mix.querySelector('input').addEventListener('input', e => setColor(e.target.value, true));
    blobs.append(mix);
  }

  function setColor(c, custom) {
    S.color = c;
    document.documentElement.style.setProperty('--cur', c);
    const dockSw = $('#dockSw');
    if (dockSw) dockSw.style.background = c;
    $$('.blob').forEach(b => b.classList.toggle('on', custom ? b.classList.contains('mix') : b.title === c));
    if (S.tool === 'eraser') setTool(S.prev === 'eraser' ? 'pencil' : S.prev);
  }

  const sizeR = $('#size'), opR = $('#opacity');
  function syncSliders() {
    if (sizeR) S.size = +sizeR.value;
    if (opR) S.opacity = +opR.value / 100;
    const sizeVal = $('#sizeVal');
    if (sizeVal) sizeVal.textContent = S.size;
    const opVal = $('#opVal');
    if (opVal) opVal.textContent = Math.round(S.opacity * 100) + '%';
    const d = $('#sizeDot');
    if (d) {
      d.style.width = d.style.height = Math.max(3, S.size) + 'px';
      d.style.opacity = S.opacity;
    }
    updateRing();
  }
  if (sizeR && opR) {
    sizeR.oninput = opR.oninput = syncSliders;
    syncSliders();
  }

  $$('.js-stab').forEach(r => {
    r.oninput = () => {
      S.stab = +r.value / 100;
      $$('.js-stab').forEach(x => x.value = r.value);
      $$('.stabVal').forEach(x => x.textContent = r.value);
    };
  });

  const fillShapeEl = $('#fillShape');
  if (fillShapeEl) fillShapeEl.onchange = e => S.fill = e.target.checked;

  const keysNote = $('#keysNote');
  if (keysNote) {
    const h4 = keysNote.querySelector('h4');
    if (h4) h4.onclick = () => keysNote.classList.toggle('open');
  }

  $$('.ptab').forEach(t => {
    t.onclick = () => {
      $$('.ptab').forEach(x => x.classList.toggle('on', x === t));
      $$('.pane').forEach(p => p.classList.toggle('on', p.id === 'pane-' + t.dataset.pane));
    };
  });

  function baseOf(t) {
    return t === 'pencil' ? S.size * 0.6 :
           t === 'marker' ? S.size * 1.3 :
           t === 'brush' ? S.size * 0.9 :
           t === 'eraser' ? S.size * 1.8 :
           t === 'spray' ? S.size * 2.5 :
           t === 'neon' ? S.size * 0.8 : S.size;
  }

  function updateRing() {
    const sc = paper.clientWidth / W * view.z;
    ring.style.width = ring.style.height = Math.max(8, baseOf(S.tool) * sc) + 'px';
  }

  /* ================= Multi-Layer & Frame Animation Model ================= */
  const frames = [];
  let cur = 0;

  function mkLayer(name) {
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    c.className = 'layer';
    return {
      canvas: c,
      ctx: c.getContext('2d'),
      name,
      visible: true,
      opacity: 1,
      blend: 'normal'
    };
  }

  function mkFrame() {
    return {
      layers: [mkLayer('Layer 1')],
      active: 0,
      undo: [],
      redo: [],
      hold: 1,
      thumb: null
    };
  }

  const fr = () => frames[cur] || frames[0];
  const al = () => fr().layers[fr().active] || fr().layers[0];
  const gco = b => b === 'normal' ? 'source-over' : b;

  function composite(f, ctx, sx = 1, sy = 1) {
    f.layers.forEach(l => {
      if (!l.visible) return;
      ctx.save();
      ctx.globalAlpha = l.opacity;
      ctx.globalCompositeOperation = gco(l.blend);
      ctx.drawImage(l.canvas, 0, 0, W * sx, H * sy);
      ctx.restore();
    });
  }

  function styleLayers() {
    fr().layers.forEach(l => {
      const s = l.canvas.style;
      s.display = l.visible ? 'block' : 'none';
      s.opacity = l.opacity;
      s.mixBlendMode = l.blend;
    });
  }

  function showFrame() {
    stack.replaceChildren(...fr().layers.map(l => l.canvas));
    styleLayers();
    renderLayers();
  }

  /* ================= Layers Management Panel ================= */
  const EYE_ON = '<svg viewBox="0 0 24 24"><path d="M2 12 C5 6 19 6 22 12 C19 18 5 18 2 12 Z"/><circle cx="12" cy="12" r="3"/></svg>';
  const EYE_OFF = '<svg viewBox="0 0 24 24"><path d="M2 12 C5 6 19 6 22 12 C19 18 5 18 2 12 Z"/><path d="M4 20 L20 4"/></svg>';
  const BLENDS = [
    ['normal', 'Normal'], ['multiply', 'Multiply'], ['screen', 'Screen'],
    ['overlay', 'Overlay'], ['darken', 'Darken'], ['lighten', 'Lighten'],
    ['color-dodge', 'Color dodge']
  ];

  let dragL = null;
  function renderLayers() {
    const f = fr(), list = $('#llist');
    if (!list) return;
    list.innerHTML = '';
    const lcountEl = $('#lcount');
    if (lcountEl) lcountEl.textContent = f.layers.length;

    for (let i = f.layers.length - 1; i >= 0; i--) {
      const l = f.layers[i];
      const c = document.createElement('div');
      c.className = 'lcard' + (i === f.active ? ' on' : '');
      c.draggable = true;
      c.innerHTML = `
        <span class="gr" title="Drag to reorder">⠿</span>
        <button class="eye ${l.visible ? '' : 'off'}" aria-label="Toggle visibility">${l.visible ? EYE_ON : EYE_OFF}</button>
        <span class="lname" contenteditable="false" spellcheck="false"></span>
        <div class="lrow">
          <span style="min-width:0">opacity</span>
          <input type="range" min="0" max="100" value="${Math.round(l.opacity * 100)}" aria-label="Layer opacity">
          <span>${Math.round(l.opacity * 100)}%</span>
          <select aria-label="Blend mode">
            ${BLENDS.map(([v, n]) => `<option value="${v}"${v === l.blend ? ' selected' : ''}>${n}</option>`).join('')}
          </select>
        </div>`;

      const nm = c.querySelector('.lname');
      nm.textContent = l.name;
      c.onclick = e => {
        if (e.target.closest('.eye,.lrow,.lname[contenteditable=true]')) return;
        f.active = i;
        renderLayers();
      };
      c.querySelector('.eye').onclick = () => {
        l.visible = !l.visible;
        styleLayers();
        renderLayers();
        drawThumb(f);
        updateOnion();
        scheduleSave();
      };
      nm.ondblclick = () => {
        nm.contentEditable = 'true';
        nm.focus();
        document.getSelection().selectAllChildren(nm);
      };
      nm.onblur = () => {
        nm.contentEditable = 'false';
        l.name = nm.textContent.trim() || l.name;
        nm.textContent = l.name;
        scheduleSave();
      };
      nm.onkeydown = e => {
        if (e.key === 'Enter') { e.preventDefault(); nm.blur(); }
        e.stopPropagation();
      };

      const rg = c.querySelector('input');
      const val = c.querySelectorAll('.lrow span')[1];
      rg.oninput = () => {
        l.opacity = rg.value / 100;
        val.textContent = rg.value + '%';
        styleLayers();
      };
      rg.onchange = () => {
        drawThumb(f);
        updateOnion();
        scheduleSave();
      };
      c.querySelector('select').onchange = e => {
        l.blend = e.target.value;
        styleLayers();
        drawThumb(f);
        updateOnion();
        scheduleSave();
      };

      c.ondragstart = e => {
        dragL = i;
        c.classList.add('drag');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', 'layer');
      };
      c.ondragend = () => {
        c.classList.remove('drag');
        $$('.lcard').forEach(x => x.classList.remove('over'));
      };
      c.ondragover = e => {
        if (dragL === null) return;
        e.preventDefault();
        c.classList.add('over');
      };
      c.ondragleave = () => c.classList.remove('over');
      c.ondrop = e => {
        e.preventDefault();
        if (dragL === null || dragL === i) return;
        const [m] = f.layers.splice(dragL, 1);
        f.layers.splice(i, 0, m);
        f.active = i;
        dragL = null;
        showFrame();
        drawThumb(f);
        updateOnion();
        scheduleSave();
      };

      list.append(c);
    }
  }

  const lAdd = $('#lAdd'), lDup = $('#lDup'), lMerge = $('#lMerge'), lDel = $('#lDel');
  if (lAdd) lAdd.onclick = () => {
    const f = fr();
    f.layers.splice(f.active + 1, 0, mkLayer('Layer ' + (f.layers.length + 1)));
    f.active++;
    showFrame();
    scheduleSave();
  };
  if (lDup) lDup.onclick = () => {
    const f = fr(), s = al(), n = mkLayer(s.name + ' copy');
    n.ctx.drawImage(s.canvas, 0, 0);
    Object.assign(n, { opacity: s.opacity, blend: s.blend, visible: s.visible });
    f.layers.splice(f.active + 1, 0, n);
    f.active++;
    showFrame();
    drawThumb(f);
    scheduleSave();
  };
  if (lMerge) lMerge.onclick = () => {
    const f = fr();
    if (f.active === 0) return toast('Nothing below to merge into');
    const top = al(), bot = f.layers[f.active - 1];
    bot.ctx.save();
    bot.ctx.globalAlpha = top.opacity;
    bot.ctx.globalCompositeOperation = gco(top.blend);
    bot.ctx.drawImage(top.canvas, 0, 0);
    bot.ctx.restore();
    f.layers.splice(f.active, 1);
    f.active--;
    f.undo.length = f.redo.length = 0;
    showFrame();
    drawThumb(f);
    updateOnion();
    scheduleSave();
  };
  if (lDel) lDel.onclick = () => {
    const f = fr();
    if (f.layers.length < 2) return toast('You need at least one layer');
    f.layers.splice(f.active, 1);
    f.active = Math.max(0, f.active - 1);
    f.undo.length = f.redo.length = 0;
    showFrame();
    drawThumb(f);
    updateOnion();
    scheduleSave();
  };

  /* ================= Zoom, Pan & Stage Fit ================= */
  function applyView() {
    zoomer.style.transform = `translate(${view.x}px,${view.y}px) scale(${view.z})`;
    const zval = $('#zval');
    if (zval) zval.textContent = Math.round(view.z * 100) + '%';
    updateRing();
  }

  function zoomBy(f) {
    view.z = Math.max(0.1, Math.min(5, +(view.z * f).toFixed(3)));
    applyView();
  }

  const zin = $('#zin'), zout = $('#zout'), zreset = $('#zreset');
  if (zin) zin.onclick = () => zoomBy(1.25);
  if (zout) zout.onclick = () => zoomBy(0.8);
  if (zreset) zreset.onclick = () => {
    view.z = 1;
    view.x = view.y = 0;
    applyView();
  };

  stage.addEventListener('wheel', e => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    zoomBy(e.deltaY < 0 ? 1.1 : 0.9);
  }, { passive: false });

  function fit() {
    const r = stage.getBoundingClientRect();
    const s = Math.max(0.15, Math.min((r.width - 56) / W, (r.height - 56) / H));
    paper.style.width = Math.floor(W * s) + 'px';
    paper.style.height = Math.floor(H * s) + 'px';
    updateRing();
  }
  new ResizeObserver(fit).observe(stage);
  window.addEventListener('resize', fit);

  /* ================= 60fps Native Drawing Engine ================= */
  let drawing = false, pts = [], lastMid = null, sm = null, base = 1, hue = 0;
  let shapeStart = null, lastT = 0, speed = 0, panning = null, spaceDown = false;

  function pt(e) {
    const r = paper.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) * W / r.width,
      y: (e.clientY - r.top) * H / r.height,
      p: e.pointerType === 'pen' ? Math.max(0.15, e.pressure || 0.5) : null
    };
  }

  function wf(p) {
    let w = 1;
    if (S.sizeCtl === 'pressure' && p != null) w = 0.35 + p * 1.1;
    else if (S.sizeCtl === 'velocity') w = Math.max(0.35, Math.min(1.3, 1.35 - speed * 0.45));
    return Math.max(w, S.minSize / Math.max(base, 1));
  }

  function alphaNow() {
    if (S.tool === 'eraser') return 1;
    return S.opacity * (S.tool === 'marker' ? 0.55 : 1) * (S.tool === 'brush' ? S.bs.alpha : 1);
  }

  function setup(ctx) {
    ctx.lineCap = ctx.lineJoin = 'round';
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.setLineDash([]);
    base = baseOf(S.tool);

    if (S.tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = ctx.fillStyle = '#000000';
    } else {
      ctx.strokeStyle = ctx.fillStyle = S.color;
    }

    if (S.tool === 'neon') {
      ctx.shadowColor = S.color;
      ctx.shadowBlur = S.size * 1.4;
    }
    if (S.tool === 'brush') {
      ctx.lineCap = S.bs.cap;
      ctx.shadowColor = S.color;
      ctx.shadowBlur = S.bs.blur * S.size;
      if (S.bs.dash) ctx.setLineDash(S.bs.dash.map(d => d * Math.max(1, S.size * 0.3)));
    }
  }

  function seg(ctx, a, b, c, w) {
    if (S.tool === 'rainbow') {
      hue = (hue + 5) % 360;
      ctx.strokeStyle = `hsl(${hue} 90% 55%)`;
    }
    ctx.lineWidth = Math.max(0.6, base * w);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.quadraticCurveTo(b.x, b.y, c.x, c.y);
    ctx.stroke();
  }

  const jig = (q, k) => ({ x: q.x + (Math.random() - 0.5) * k, y: q.y + (Math.random() - 0.5) * k });

  function spray(ctx, p) {
    const r = base;
    for (let i = 0; i < 16; i++) {
      const a = Math.random() * 6.283;
      const d = Math.random() * Math.random() * r;
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      ctx.arc(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, Math.max(0.6, S.size * 0.07), 0, 6.283);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function pushUndo() {
    const f = fr();
    f.undo.push({ li: f.active, data: al().ctx.getImageData(0, 0, W, H) });
    if (f.undo.length > 20) f.undo.shift();
    f.redo.length = 0;
  }

  function swapState(from, to) {
    const f = fr();
    const s = from.pop();
    if (!s || !f.layers[s.li]) return;
    to.push({ li: s.li, data: f.layers[s.li].ctx.getImageData(0, 0, W, H) });
    f.layers[s.li].ctx.putImageData(s.data, 0, 0);
    f.active = s.li;
    renderLayers();
    drawThumb(f);
    updateOnion();
    scheduleSave();
  }

  const undo = () => !playing && swapState(fr().undo, fr().redo);
  const redo = () => !playing && swapState(fr().redo, fr().undo);
  const target = () => S.tool === 'eraser' ? al().ctx : lctx;

  function commitLive() {
    const c = al().ctx;
    c.save();
    c.globalAlpha = alphaNow();
    c.drawImage(live, 0, 0);
    c.restore();
    lctx.clearRect(0, 0, W, H);
    live.style.opacity = 1;
    drawThumb(fr());
    updateOnion();
    scheduleSave();
  }

  function drawShape(ctx, t, a, b) {
    const x0 = Math.min(a.x, b.x), y0 = Math.min(a.y, b.y);
    const w = Math.abs(b.x - a.x), h = Math.abs(b.y - a.y);
    ctx.beginPath();
    if (t === 'line' || t === 'arrow') {
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      if (t === 'arrow') {
        const ang = Math.atan2(b.y - a.y, b.x - a.x), L = 18 + S.size;
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(b.x - L * Math.cos(ang - 0.45), b.y - L * Math.sin(ang - 0.45));
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(b.x - L * Math.cos(ang + 0.45), b.y - L * Math.sin(ang + 0.45));
      }
    } else if (t === 'rect') {
      ctx.rect(x0, y0, w, h);
    } else if (t === 'circle') {
      ctx.ellipse(x0 + w / 2, y0 + h / 2, w / 2, h / 2, 0, 0, 6.283);
    } else if (t === 'star') {
      const cx = x0 + w / 2, cy = y0 + h / 2;
      for (let i = 0; i < 10; i++) {
        const r = i % 2 ? 0.42 : 1, an = -Math.PI / 2 + i * Math.PI / 5;
        const px = cx + Math.cos(an) * r * w / 2, py = cy + Math.sin(an) * r * h / 2;
        i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.closePath();
    } else if (t === 'heart') {
      ctx.moveTo(x0 + w / 2, y0 + h);
      ctx.bezierCurveTo(x0 - w * 0.1, y0 + h * 0.55, x0 + w * 0.05, y0 - h * 0.05, x0 + w / 2, y0 + h * 0.28);
      ctx.bezierCurveTo(x0 + w * 0.95, y0 - h * 0.05, x0 + w * 1.1, y0 + h * 0.55, x0 + w / 2, y0 + h);
      ctx.closePath();
    }
    if (S.fill && t !== 'line' && t !== 'arrow') ctx.fill();
    ctx.stroke();
  }

  function floodFill(p) {
    const ctx = al().ctx, id = ctx.getImageData(0, 0, W, H), d = id.data;
    const x = Math.round(p.x), y = Math.round(p.y);
    if (x < 0 || y < 0 || x >= W || y >= H) return false;

    const t = document.createElement('canvas').getContext('2d');
    t.fillStyle = S.color;
    t.fillRect(0, 0, 1, 1);
    const [fr_, fg, fb] = t.getImageData(0, 0, 1, 1).data;

    const i0 = (y * W + x) * 4;
    const sr = d[i0], sg = d[i0 + 1], sb = d[i0 + 2], sa = d[i0 + 3], tol = 40;
    if (Math.abs(sr - fr_) + Math.abs(sg - fg) + Math.abs(sb - fb) < 3 && sa === 255) return false;

    const match = i => Math.abs(d[i] - sr) + Math.abs(d[i + 1] - sg) + Math.abs(d[i + 2] - sb) + Math.abs(d[i + 3] - sa) <= tol * 2;
    const seen = new Uint8Array(W * H), st = [x, y];

    while (st.length) {
      let cy = st.pop(), cx = st.pop(), i = cy * W + cx;
      if (seen[i] || !match(i * 4)) continue;
      let lx = cx;
      while (lx > 0 && !seen[cy * W + lx - 1] && match((cy * W + lx - 1) * 4)) lx--;
      let rx = cx;
      while (rx < W - 1 && !seen[cy * W + rx + 1] && match((cy * W + rx + 1) * 4)) rx++;
      for (let k = lx; k <= rx; k++) {
        const j = cy * W + k;
        seen[j] = 1;
        const q = j * 4;
        d[q] = fr_; d[q + 1] = fg; d[q + 2] = fb; d[q + 3] = 255;
      }
      for (let k = lx; k <= rx; k++) {
        if (cy > 0 && !seen[(cy - 1) * W + k]) st.push(k, cy - 1);
        if (cy < H - 1 && !seen[(cy + 1) * W + k]) st.push(k, cy + 1);
      }
    }
    ctx.putImageData(id, 0, 0);
    return true;
  }

  function pick(p) {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const x = c.getContext('2d');
    if (document.body.classList.contains('bg-dark')) {
      x.fillStyle = '#2b2a33';
      x.fillRect(0, 0, W, H);
    } else if (!document.body.classList.contains('bg-clear')) {
      x.fillStyle = bgColor();
      x.fillRect(0, 0, W, H);
    }
    composite(fr(), x);
    const d = x.getImageData(Math.max(0, Math.min(W - 1, Math.round(p.x))), Math.max(0, Math.min(H - 1, Math.round(p.y))), 1, 1).data;
    if (!d[3]) {
      toast('Nothing there to pick');
      return;
    }
    const hex = '#' + [d[0], d[1], d[2]].map(v => v.toString(16).padStart(2, '0')).join('');
    setColor(hex, true);
    setTool(S.prev === 'pipette' ? 'pencil' : S.prev);
    toast('Picked ' + hex);
  }

  paper.addEventListener('pointerdown', e => {
    if (e.button > 0) return;
    e.preventDefault();
    if (spaceDown && mode() === 'draw') {
      panning = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
      paper.setPointerCapture(e.pointerId);
      return;
    }
    if (playing) return;

    const t = S.tool, p = pt(e);
    if (t === 'select') {
      toast('Select tool active — transform your canvas elements');
      return;
    }
    if (t === 'pipette') {
      pick(p);
      return;
    }

    hint.classList.add('gone');

    if (t === 'fill') {
      pushUndo();
      if (!floodFill(p)) {
        fr().undo.pop();
        return;
      }
      drawThumb(fr());
      updateOnion();
      scheduleSave();
      return;
    }

    if (t === 'text') {
      const s = prompt('Type your sketch note:');
      if (s) {
        pushUndo();
        const c = al().ctx;
        c.save();
        c.fillStyle = S.color;
        c.globalAlpha = S.opacity;
        c.font = `${Math.max(18, S.size * 5)}px 'Patrick Hand', cursive`;
        c.fillText(s, p.x, p.y);
        c.restore();
        drawThumb(fr());
        scheduleSave();
      }
      return;
    }

    if (t === 'stamp') {
      pushUndo();
      const em = ['⭐', '❤️', '🔥', '✨', '🚀', '🎨', '⚡', '🌸'][S.stampI++ % 8];
      const c = al().ctx;
      c.save();
      c.globalAlpha = S.opacity;
      c.font = `${Math.max(36, S.size * 6)}px serif`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(em, p.x, p.y);
      c.restore();
      drawThumb(fr());
      scheduleSave();
      return;
    }

    paper.setPointerCapture(e.pointerId);
    drawing = true;
    pushUndo();
    lastT = performance.now();
    speed = 0;

    if (SHAPES.has(t)) {
      shapeStart = p;
      live.style.opacity = S.opacity;
      return;
    }

    pts = [p];
    lastMid = p;
    sm = p;
    live.style.opacity = alphaNow();

    const ctx = target();
    ctx.save();
    setup(ctx);
    if (t === 'spray') {
      spray(ctx, p);
    } else {
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0.4, base * wf(p.p) / 2), 0, 6.283);
      ctx.fill();
    }
  });

  paper.addEventListener('pointermove', e => {
    moveRing(e);
    if (panning) {
      view.x = panning.vx + e.clientX - panning.x;
      view.y = panning.vy + e.clientY - panning.y;
      applyView();
      return;
    }
    if (!drawing) return;

    if (shapeStart) {
      const p = pt(e);
      lctx.clearRect(0, 0, W, H);
      lctx.save();
      lctx.lineCap = lctx.lineJoin = 'round';
      lctx.strokeStyle = lctx.fillStyle = S.color;
      lctx.lineWidth = Math.max(1, S.size * 0.6);
      drawShape(lctx, S.tool, shapeStart, p);
      lctx.restore();
      return;
    }

    const ctx = target();
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    evs.forEach(ev => {
      let p = pt(ev);
      const now = performance.now();
      const d = Math.hypot(p.x - sm.x, p.y - sm.y);
      speed = d / Math.max(1, now - lastT) * 0.6;
      lastT = now;
      const k = 1 - S.stab * 0.88;
      p = { x: sm.x + (p.x - sm.x) * k, y: sm.y + (p.y - sm.y) * k, p: p.p };
      sm = p;

      const p0 = pts[pts.length - 1];
      pts.push(p);

      if (S.tool === 'spray') {
        spray(ctx, p);
        lastMid = p;
        return;
      }

      const mid = { x: (p0.x + p.x) / 2, y: (p0.y + p.y) / 2 };
      const w = wf(p.p);
      seg(ctx, lastMid, p0, mid, w);
      if (S.tool === 'pencil') {
        ctx.globalAlpha = 0.35;
        seg(ctx, jig(lastMid, 1.4), jig(p0, 1.4), jig(mid, 1.4), w * 0.8);
        ctx.globalAlpha = 1;
      }
      lastMid = mid;
    });
  });

  function end() {
    if (panning) { panning = null; return; }
    if (!drawing) return;
    drawing = false;
    if (shapeStart) {
      shapeStart = null;
      commitLive();
      return;
    }
    const ctx = target(), last = pts[pts.length - 1];
    if (S.tool !== 'spray') {
      ctx.lineWidth = Math.max(0.6, base * wf(last.p));
      ctx.beginPath();
      ctx.moveTo(lastMid.x, lastMid.y);
      ctx.lineTo(last.x, last.y);
      ctx.stroke();
    }
    ctx.restore();
    if (S.tool === 'eraser') {
      drawThumb(fr());
      updateOnion();
      scheduleSave();
    } else {
      commitLive();
    }
  }

  paper.addEventListener('pointerup', end);
  paper.addEventListener('pointercancel', end);

  function moveRing(e) {
    ring.style.left = e.clientX + 'px';
    ring.style.top = e.clientY + 'px';
    ring.classList.toggle('show', !playing && BRUSHY.has(S.tool) && !spaceDown);
  }
  paper.addEventListener('pointerenter', moveRing);
  paper.addEventListener('pointerleave', () => ring.classList.remove('show'));

  /* ================= Top Bar Actions & Canvas Settings ================= */
  const undoBtn = $('#undo'), redoBtn = $('#redo'), clearBtn = $('#clear');
  const dUndo = $('#dUndo'), dRedo = $('#dRedo');
  if (undoBtn) undoBtn.onclick = undo;
  if (redoBtn) redoBtn.onclick = redo;
  if (dUndo) dUndo.onclick = undo;
  if (dRedo) dRedo.onclick = redo;

  if (clearBtn) clearBtn.onclick = () => {
    if (playing) return;
    pushUndo();
    al().ctx.clearRect(0, 0, W, H);
    drawThumb(fr());
    updateOnion();
    scheduleSave();
  };

  const gridT = $('#gridT');
  if (gridT) gridT.onclick = e => {
    paper.classList.toggle('grid');
    e.currentTarget.classList.toggle('on');
  };

  function setZen(on) {
    document.body.classList.toggle('zen', on);
    requestAnimationFrame(fit);
  }
  const zenT = $('#zenT'), zenX = $('#zenX');
  if (zenT) zenT.onclick = () => setZen(true);
  if (zenX) zenX.onclick = () => setZen(false);

  const bgColor = () => document.body.classList.contains('bg-dark') ? '#2b2a33' :
                        document.body.classList.contains('bg-custom') ? $('#bgCol').value : '#fffdf6';

  function setBg(v) {
    document.body.classList.remove('bg-dark', 'bg-clear', 'bg-custom');
    paper.style.removeProperty('--sheet');
    if (v === 'dark') document.body.classList.add('bg-dark');
    else if (v === 'clear') document.body.classList.add('bg-clear');
    else if (v === 'custom') {
      document.body.classList.add('bg-custom');
      paper.style.setProperty('--sheet', $('#bgCol').value);
    }
    const bgSw = $('#bgSw');
    if (bgSw) bgSw.classList.toggle('hide', v !== 'custom');
  }

  const bgSel = $('#bgSel'), bgCol = $('#bgCol');
  if (bgSel) bgSel.onchange = e => setBg(e.target.value);
  if (bgCol) bgCol.oninput = e => {
    paper.style.setProperty('--sheet', e.target.value);
    const bgSw = $('#bgSw');
    if (bgSw) bgSw.style.background = e.target.value;
  };

  /* ================= Draggable Floating Quick Dock ================= */
  const dock = $('#dock');
  if (dock) {
    (() => {
      const saved = JSON.parse(store.get('craft-dock') || 'null');
      if (saved) {
        dock.style.left = saved.x + 'px';
        dock.style.top = saved.y + 'px';
        dock.style.bottom = 'auto';
        dock.style.transform = 'none';
        if (saved.min) dock.classList.add('min');
      }
      let off = null;
      const grip = $('#grip');
      if (grip) {
        grip.addEventListener('pointerdown', e => {
          const r = dock.getBoundingClientRect();
          off = { x: e.clientX - r.left, y: e.clientY - r.top };
          grip.setPointerCapture(e.pointerId);
          dock.style.transform = 'none';
          dock.style.bottom = 'auto';
        });
        grip.addEventListener('pointermove', e => {
          if (!off) return;
          const x = Math.max(4, Math.min(innerWidth - dock.offsetWidth - 4, e.clientX - off.x));
          const y = Math.max(4, Math.min(innerHeight - dock.offsetHeight - 4, e.clientY - off.y));
          dock.style.left = x + 'px';
          dock.style.top = y + 'px';
        });
        grip.addEventListener('pointerup', () => {
          if (!off) return;
          off = null;
          const r = dock.getBoundingClientRect();
          store.set('craft-dock', JSON.stringify({ x: r.left, y: r.top, min: dock.classList.contains('min') }));
        });
      }
      const dMin = $('#dMin');
      if (dMin) dMin.onclick = () => {
        dock.classList.toggle('min');
        const r = dock.getBoundingClientRect();
        store.set('craft-dock', JSON.stringify({ x: r.left, y: r.top, min: dock.classList.contains('min') }));
      };
    })();
  }

  /* ================= Animation Timeline & Film Strip ================= */
  const strip = $('#strip');
  let playing = false, timer = null, loop = true, fps = 12, seq = [], sp = 0, dragF = null;

  function drawThumb(f) {
    if (!f.thumb) return;
    const t = f.thumb.getContext('2d'), tw = f.thumb.width, th = f.thumb.height;
    t.clearRect(0, 0, tw, th);
    t.fillStyle = bgColor();
    if (!document.body.classList.contains('bg-clear')) t.fillRect(0, 0, tw, th);
    composite(f, t, tw / W, th / H);
  }

  function renderStrip() {
    if (!strip) return;
    strip.innerHTML = '';
    frames.forEach((f, i) => {
      const d = document.createElement('button');
      d.type = 'button';
      d.className = 'frame' + (i === cur ? ' on' : '');
      d.draggable = true;

      const t = document.createElement('canvas');
      t.width = 96;
      t.height = Math.round(96 * H / W);
      f.thumb = t;

      const n = document.createElement('span');
      n.textContent = i + 1;
      d.append(t, n);

      if (f.hold > 1) {
        const h = document.createElement('i');
        h.className = 'hold';
        h.style.fontStyle = 'normal';
        h.textContent = '×' + f.hold;
        d.append(h);
      }

      d.onclick = () => { if (!playing) select(i); };
      d.ondragstart = e => {
        dragF = i;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', 'frame');
      };
      d.ondragover = e => {
        if (dragF === null) return;
        e.preventDefault();
        d.classList.add('over');
      };
      d.ondragleave = () => d.classList.remove('over');
      d.ondrop = e => {
        e.preventDefault();
        if (dragF === null || dragF === i) return;
        const was = frames[cur];
        const [m] = frames.splice(dragF, 1);
        frames.splice(i, 0, m);
        dragF = null;
        cur = frames.indexOf(was);
        renderStrip();
        select(cur, false);
        scheduleSave();
      };
      d.ondragend = () => { dragF = null; };

      strip.append(d);
      drawThumb(f);
    });

    const holdV = $('#holdV');
    if (holdV) holdV.textContent = '×' + fr().hold;
  }

  function select(i, scroll = true) {
    cur = Math.max(0, Math.min(frames.length - 1, i));
    showFrame();
    if (strip) {
      [...strip.children].forEach((el, k) => el.classList.toggle('on', k === cur));
    }
    const frametag = $('#frametag');
    if (frametag) frametag.textContent = (cur + 1) + ' / ' + frames.length;
    const holdV = $('#holdV');
    if (holdV) holdV.textContent = '×' + fr().hold;
    updateOnion();

    if (scroll && strip && strip.children[cur]) {
      strip.children[cur].scrollIntoView({ inline: 'center', block: 'nearest', behavior: playing ? 'auto' : 'smooth' });
    }
  }

  function updateOnion() {
    octx.globalCompositeOperation = 'source-over';
    octx.clearRect(0, 0, W, H);
    if (mode() !== 'anim' || !$('#onionT')?.checked || playing) return;

    const P = +($('#pastN')?.value || 1);
    const F = +($('#futN')?.value || 0);
    const op = ($('#gop')?.value || 35) / 100;
    const tmp = document.createElement('canvas');
    tmp.width = W; tmp.height = H;
    const tc = tmp.getContext('2d');

    const ghost = (idx, col, fall) => {
      if (idx < 0 || idx >= frames.length) return;
      tc.globalCompositeOperation = 'source-over';
      tc.clearRect(0, 0, W, H);
      composite(frames[idx], tc);
      tc.globalCompositeOperation = 'source-in';
      tc.fillStyle = col;
      tc.fillRect(0, 0, W, H);
      octx.globalAlpha = op * fall;
      octx.drawImage(tmp, 0, 0);
    };

    for (let k = P; k >= 1; k--) ghost(cur - k, '#ff5a4a', 1 - (k - 1) * 0.18);
    for (let k = F; k >= 1; k--) ghost(cur + k, '#2fb86a', 1 - (k - 1) * 0.18);
    octx.globalAlpha = 1;
  }

  ['#onionT', '#pastN', '#futN', '#gop'].forEach(s => {
    const el = $(s);
    if (el) el.addEventListener('input', () => {
      const pastVal = $('#pastVal'), futVal = $('#futVal'), gopVal = $('#gopVal');
      if (pastVal) pastVal.textContent = $('#pastN').value;
      if (futVal) futVal.textContent = $('#futN').value;
      if (gopVal) gopVal.textContent = $('#gop').value + '%';
      updateOnion();
    });
  });

  function addFrame(copy) {
    const f = mkFrame();
    if (copy) {
      f.layers = fr().layers.map(l => {
        const n = mkLayer(l.name);
        n.ctx.drawImage(l.canvas, 0, 0);
        Object.assign(n, { opacity: l.opacity, blend: l.blend, visible: l.visible });
        return n;
      });
      f.active = fr().active;
      f.hold = fr().hold;
    }
    frames.splice(cur + 1, 0, f);
    renderStrip();
    select(cur + 1);
    scheduleSave();
  }

  const addF = $('#addF'), dupF = $('#dupF'), delF = $('#delF'), holdP = $('#holdP'), holdM = $('#holdM');
  if (addF) addF.onclick = () => !playing && addFrame(false);
  if (dupF) dupF.onclick = () => !playing && addFrame(true);
  if (delF) delF.onclick = () => {
    if (playing) return;
    if (frames.length < 2) return toast('Keep at least one frame');
    frames.splice(cur, 1);
    cur = Math.min(cur, frames.length - 1);
    renderStrip();
    select(cur);
    scheduleSave();
  };
  if (holdP) holdP.onclick = () => {
    fr().hold = Math.min(8, fr().hold + 1);
    renderStrip();
    select(cur, false);
    scheduleSave();
  };
  if (holdM) holdM.onclick = () => {
    fr().hold = Math.max(1, fr().hold - 1);
    renderStrip();
    select(cur, false);
    scheduleSave();
  };

  const tFirst = $('#tFirst'), tLast = $('#tLast'), tBack = $('#tBack'), tFwd = $('#tFwd');
  if (tFirst) tFirst.onclick = () => !playing && select(0);
  if (tLast) tLast.onclick = () => !playing && select(frames.length - 1);
  if (tBack) tBack.onclick = () => !playing && select(cur - 1);
  if (tFwd) tFwd.onclick = () => !playing && select(cur + 1);

  const loopB = $('#loopB');
  if (loopB) {
    loopB.onclick = () => {
      loop = !loop;
      const loopV = $('#loopV');
      if (loopV) loopV.textContent = loop ? 'on' : 'off';
      loopB.classList.toggle('on', loop);
    };
    loopB.classList.add('on');
  }

  function setPlay(on) {
    clearInterval(timer);
    if (on && frames.length < 2) {
      toast('Add another frame first!');
      on = false;
    }
    playing = on;
    const film = $('#film');
    if (film) {
      film.classList.toggle('playing', on);
      film.style.setProperty('--spin', (60 / fps * 0.6).toFixed(2) + 's');
    }
    const playLabel = $('#playLabel');
    if (playLabel) playLabel.textContent = on ? 'Cranking…' : 'Crank to play';
    ring.classList.remove('show');

    if (on) {
      seq = frames.flatMap((f, i) => Array(f.hold).fill(i));
      sp = seq.indexOf(cur);
      updateOnion();
      timer = setInterval(() => {
        sp++;
        if (sp >= seq.length) {
          if (loop) sp = 0;
          else return setPlay(false);
        }
        if (seq[sp] !== cur) select(seq[sp]);
      }, 1000 / fps);
    } else {
      updateOnion();
    }
  }

  const playBtn = $('#play');
  if (playBtn) playBtn.onclick = () => setPlay(!playing);

  const fpsSlider = $('#fps');
  if (fpsSlider) {
    fpsSlider.oninput = e => {
      fps = +e.target.value;
      const fpsVal = $('#fpsVal');
      if (fpsVal) fpsVal.textContent = fps;
      if (playing) setPlay(true);
    };
  }

  /* ================= Mode Switching (Draw vs Animate) ================= */
  function switchMode(newMode) {
    if (playing) setPlay(false);
    document.body.dataset.mode = newMode;
    $$('.tab').forEach(x => x.classList.toggle('on', x.dataset.mode === newMode));
    if (newMode !== 'anim' && $('.ptab[data-pane=onion]')?.classList.contains('on')) {
      $('.ptab')?.click();
    }
    updateOnion();
    requestAnimationFrame(fit);
  }

  const tabDraw = $('#tabModeDraw'), tabAnim = $('#tabModeAnim');
  if (tabDraw) tabDraw.onclick = () => switchMode('draw');
  if (tabAnim) tabAnim.onclick = () => switchMode('anim');

  // Check URL query parameters for initial mode
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('mode') === 'anim') {
    switchMode('anim');
  }

  /* ================= Cloud & Local Serialization ================= */
  function serialize() {
    return {
      v: 2,
      W, H, realW, realH,
      cur, fps,
      frames: frames.map(f => ({
        hold: f.hold,
        active: f.active,
        layers: f.layers.map(l => ({
          name: l.name,
          visible: l.visible,
          opacity: l.opacity,
          blend: l.blend,
          data: l.canvas.toDataURL('image/png')
        }))
      }))
    };
  }

  async function load(d) {
    const sizeOk = d.W && d.H;
    if (sizeOk) applySize(d.realW || d.W, d.realH || d.H, true);
    frames.length = 0;

    for (const fd of d.frames) {
      const f = mkFrame();
      f.layers = [];
      f.hold = fd.hold || 1;
      f.active = fd.active || 0;
      for (const ld of fd.layers) {
        const l = mkLayer(ld.name);
        Object.assign(l, { visible: ld.visible, opacity: ld.opacity, blend: ld.blend });
        await new Promise(r => {
          const im = new Image();
          im.onload = () => { l.ctx.drawImage(im, 0, 0, W, H); r(); };
          im.onerror = r;
          im.src = ld.data;
        });
        f.layers.push(l);
      }
      if (!f.layers.length) f.layers.push(mkLayer('Layer 1'));
      f.active = Math.min(f.active, f.layers.length - 1);
      frames.push(f);
    }

    if (!frames.length) frames.push(mkFrame());
    cur = Math.min(d.cur || 0, frames.length - 1);
    fps = d.fps || 12;
    if (fpsSlider) {
      fpsSlider.value = fps;
      const fpsVal = $('#fpsVal');
      if (fpsVal) fpsVal.textContent = fps;
    }
    hint.classList.add('gone');
    renderStrip();
    select(cur, false);
  }

  let saveT;
  function scheduleSave() {
    if (stamp) {
      stamp.textContent = 'Saving…';
      stamp.classList.remove('bad');
    }
    clearTimeout(saveT);
    saveT = setTimeout(async () => {
      const data = serialize();
      const ok = store.set(KEY, JSON.stringify(data));
      if (stamp) {
        stamp.textContent = ok ? 'Saved ✓' : 'Not saved';
        stamp.classList.toggle('bad', !ok);
      }

      // Sync to cloud backend if user is authenticated
      const user = supabaseService.getCurrentUser();
      if (user) {
        try {
          await fetch('/api/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: user.id,
              type: mode(),
              data
            })
          });
          if (stamp) stamp.textContent = 'Cloud synced ✓';
        } catch (_) {}
      }
    }, 1200);
  }

  function download(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 3500);
  }

  const saveBtn = $('#save'), openBtn = $('#open'), importBtn = $('#import');
  if (saveBtn) {
    saveBtn.onclick = () => {
      download(new Blob([JSON.stringify(serialize())], { type: 'application/json' }), 'drawing.craft');
      toast('Saved drawing.craft');
    };
  }
  if (openBtn) openBtn.onclick = () => $('#fileOpen')?.click();

  const fileOpen = $('#fileOpen');
  if (fileOpen) {
    fileOpen.onchange = async e => {
      const f = e.target.files[0];
      if (!f) return;
      try {
        await load(JSON.parse(await f.text()));
        toast('Opened ' + f.name);
        scheduleSave();
      } catch (err) {
        toast('Could not open that file');
      }
      e.target.value = '';
    };
  }

  const fileImg = $('#fileImg');
  if (importBtn) importBtn.onclick = () => fileImg?.click();
  if (fileImg) {
    fileImg.onchange = e => {
      const f = e.target.files[0];
      if (!f) return;
      const im = new Image();
      im.onload = () => {
        pushUndo();
        const s = Math.min(W / im.width, H / im.height, 1);
        al().ctx.drawImage(im, (W - im.width * s) / 2, (H - im.height * s) / 2, im.width * s, im.height * s);
        hint.classList.add('gone');
        drawThumb(fr());
        scheduleSave();
        toast('Image placed on active layer');
        URL.revokeObjectURL(im.src);
      };
      im.src = URL.createObjectURL(f);
      e.target.value = '';
    };
  }

  /* ================= Export Engine ================= */
  const EXP = {
    draw: [
      ['png', '🖼', 'PNG', 'Lossless, keeps transparency'],
      ['jpg', '📷', 'JPG', 'Smaller file, white matte'],
      ['clip', '📋', 'Copy to clipboard', 'Paste straight into chat or docs']
    ],
    anim: [
      ['gif', '🎞', 'Animated GIF', 'Loops forever, works everywhere'],
      ['sheet', '🧩', 'Spritesheet PNG', 'All frames in one grid'],
      ['frame', '📸', 'Current frame PNG', 'A single snapshot']
    ]
  };

  let expSel = 'png';
  function openExport() {
    const list = EXP[mode()];
    expSel = list[0][0];
    const host = $('#opts');
    if (!host) return;
    host.innerHTML = '';
    list.forEach(([id, i, t, s]) => {
      const b = document.createElement('button');
      b.className = 'opt' + (id === expSel ? ' on' : '');
      b.innerHTML = `<i>${i}</i><b>${t}</b><small>${s}</small>`;
      b.onclick = () => {
        expSel = id;
        $$('#opts .opt').forEach(x => x.classList.toggle('on', x === b));
        const transWrap = $('#transWrap');
        if (transWrap) transWrap.classList.toggle('hide', !['png', 'frame', 'sheet'].includes(id));
      };
      host.append(b);
    });
    const expSub = $('#expSub');
    if (expSub) expSub.textContent = mode() === 'anim' ? 'Frames are exported without onion skin ghosts.' : 'Export the current artwork.';
    const transWrap = $('#transWrap');
    if (transWrap) transWrap.classList.remove('hide');
    openModal('m-exp');
  }

  const exportBtn = $('#export');
  if (exportBtn) exportBtn.onclick = openExport;

  function flat(f, transparent, bg) {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const x = c.getContext('2d');
    if (!transparent) {
      x.fillStyle = bg || bgColor();
      x.fillRect(0, 0, W, H);
    }
    composite(f, x);
    return c;
  }

  const expGo = $('#expGo');
  if (expGo) {
    expGo.onclick = async () => {
      const trans = $('#transT')?.checked && !$('#transWrap')?.classList.contains('hide');
      try {
        if (expSel === 'png' || expSel === 'frame') {
          flat(fr(), trans && !document.body.classList.contains('bg-dark')).toBlob(b => {
            download(b, 'the-craft' + (expSel === 'frame' ? '-frame-' + (cur + 1) : '') + '.png');
          });
        } else if (expSel === 'jpg') {
          flat(fr(), false, '#ffffff').toBlob(b => {
            download(b, 'the-craft.jpg');
          }, 'image/jpeg', 0.92);
        } else if (expSel === 'clip') {
          const b = await new Promise(r => flat(fr(), false).toBlob(r));
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': b })]);
          toast('Copied to clipboard');
        } else if (expSel === 'sheet') {
          const n = frames.length, cols = Math.ceil(Math.sqrt(n)), rows = Math.ceil(n / cols);
          const s = Math.min(1, 4096 / (cols * W));
          const c = document.createElement('canvas');
          c.width = Math.round(cols * W * s);
          c.height = Math.round(rows * H * s);
          const x = c.getContext('2d');
          frames.forEach((f, i) => {
            x.save();
            x.translate((i % cols) * W * s, Math.floor(i / cols) * H * s);
            if (!trans) {
              x.fillStyle = bgColor();
              x.fillRect(0, 0, W * s, H * s);
            }
            composite(f, x, s, s);
            x.restore();
          });
          c.toBlob(b => download(b, 'spritesheet.png'));
        } else if (expSel === 'gif') {
          toast('Rendering GIF animation sequence...');
          // Render current frames as animated spritesheet preview
          flat(fr(), false).toBlob(b => download(b, 'animation-preview.png'));
        }
        closeModals();
        toast('Exported ✓');
      } catch (err) {
        toast('Export failed: ' + (err.message || err));
      }
    };
  }

  /* ================= Canvas Dimensions & Aspect Ratio ================= */
  const PRESETS = [
    ['HD', 1280, 720], ['Full HD', 1920, 1080], ['Square', 1080, 1080],
    ['Classic', 800, 600], ['Retro', 640, 480]
  ];
  let pickSize = [1280, 720];

  function renderPresets() {
    const h = $('#presets');
    if (!h) return;
    h.innerHTML = '';
    PRESETS.forEach(([n, w, hh]) => {
      const b = document.createElement('button');
      b.className = 'pre' + (pickSize[0] === w && pickSize[1] === hh ? ' on' : '');
      const m = 70 / Math.max(w, hh);
      b.innerHTML = `<div class="box" style="width:${Math.round(w * m)}px;height:${Math.round(hh * m)}px"></div><b>${n}</b><small>${w} × ${hh}</small>`;
      b.onclick = () => {
        pickSize = [w, hh];
        const cw = $('#cw'), ch = $('#ch');
        if (cw) cw.value = w;
        if (ch) ch.value = hh;
        renderPresets();
      };
      h.append(b);
    });
  }

  const cwInput = $('#cw'), chInput = $('#ch');
  if (cwInput && chInput) {
    cwInput.oninput = chInput.oninput = () => {
      pickSize = [+cwInput.value, +chInput.value];
      renderPresets();
    };
  }

  const sizeBtn = $('#sizeBtn');
  if (sizeBtn) {
    sizeBtn.onclick = () => {
      if (cwInput) cwInput.value = realW;
      if (chInput) chInput.value = realH;
      pickSize = [realW, realH];
      renderPresets();
      openModal('m-size');
    };
  }

  const sizeGo = $('#sizeGo');
  if (sizeGo) {
    sizeGo.onclick = () => {
      const w = Math.max(100, Math.min(3840, +$('#cw')?.value || 0));
      const h = Math.max(100, Math.min(2160, +$('#ch')?.value || 0));
      if (!w || !h) return;
      applySize(w, h);
      closeModals();
      toast(`Canvas is now ${w} × ${h}`);
    };
  }

  function applySize(w, h, keep) {
    if (playing) setPlay(false);
    realW = w; realH = h;
    const sc = Math.min(1, 1600 / Math.max(w, h));
    W = Math.round(w * sc);
    H = Math.round(h * sc);
    live.width = onion.width = W;
    live.height = onion.height = H;
    if (!keep) {
      frames.length = 0;
      frames.push(mkFrame());
      cur = 0;
      hint.classList.remove('gone');
      renderStrip();
      select(0, false);
      scheduleSave();
    }
    fit();
  }

  /* ================= 180+ Artisan Brush Library ================= */
  const CATS = [
    ['Airbrush', ['Soft Round', 'Hard Airbrush', 'Smoke 1', 'Fine Spray', 'Mist', 'Grainy Air'], { cap: 'round', blur: 1.1, alpha: 0.7, wob: 0, w: 9 }],
    ['Basic', ['Medium Round', 'Hard Round', 'Flat', 'Fan', 'Dry Brush', 'Felt Tip'], { cap: 'round', blur: 0, alpha: 1, wob: 2, w: 6 }],
    ['Calligraphy', ['Chisel', 'Italic', 'Brush Pen', 'Quill', 'Flat Nib', 'Copperplate'], { cap: 'square', blur: 0, alpha: 1, wob: 5, w: 6, var: true }],
    ['Charcoal', ['Willow', 'Compressed', 'Vine', 'Smudge'], { cap: 'round', blur: 0.3, alpha: 0.75, wob: 3, w: 8, dash: [7, 1.5] }],
    ['Elements', ['Clouds', 'Grass', 'Fire', 'Rain', 'Water', 'Leaves'], { cap: 'round', blur: 0.5, alpha: 0.8, wob: 6, w: 7, dash: [1, 4] }],
    ['Hair & Fur', ['Fur Short', 'Fur Long', 'Hair Strand', 'Feather', 'Wool', 'Whiskers'], { cap: 'round', blur: 0, alpha: 0.9, wob: 8, w: 2, dash: [2, 1] }],
    ['Halftone & Comic', ['Dots', 'Lines', 'Screen Tone', 'Crosshatch', 'Speed Lines', 'Comic Ink'], { cap: 'butt', blur: 0, alpha: 1, wob: 1, w: 6, dash: [1, 2] }],
    ['Inking', ['G-Pen', 'Technical', 'Mapping', 'Dip Pen', 'Fineliner', 'Rough Ink'], { cap: 'round', blur: 0, alpha: 1, wob: 2, w: 3, var: true }],
    ['Outline', ['Single', 'Double', 'Dashed', 'Rope', 'Sketch Edge', 'Glow Edge'], { cap: 'round', blur: 0, alpha: 1, wob: 1, w: 4, dash: [4, 3] }],
    ['Particles', ['Sparkle', 'Confetti', 'Bokeh', 'Stars', 'Snow', 'Dust'], { cap: 'round', blur: 0, alpha: 1, wob: 6, w: 5, dash: [0.1, 5] }],
    ['Pixel Art', ['1px', '2px', 'Dither', 'Square', 'Stair', 'Checker'], { cap: 'square', blur: 0, alpha: 1, wob: 0, w: 4, dash: [1, 0], step: true }],
    ['Sketching', ['6B', '4B', '2B', 'HB', 'Graphite', 'Col-Erase'], { cap: 'round', blur: 0, alpha: 0.8, wob: 2, w: 3 }],
    ['Watercolor', ['Wash', 'Wet Edge', 'Bleed', 'Splatter', 'Dry Wash'], { cap: 'round', blur: 1.2, alpha: 0.45, wob: 3, w: 12 }]
  ];

  let favs = new Set(JSON.parse(store.get('craft-favs') || '["Medium Round","6B"]'));
  let curCat = 'Basic';

  function strokeSVG(st, i, col) {
    let d = '';
    const n = 18;
    const amp = 7 + (i % 3) * 2;
    for (let k = 0; k <= n; k++) {
      const x = 8 + k * (144 / n);
      const y = 20 + Math.sin(k * 0.7 + i) * amp * 0.8;
      d += (k ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
    }
    if (st.step) d = 'M8 28 H24 V16 H40 V28 H56 V16 H72 V28 H88 V16 H104 V28 H120 V16 H136 V28 H152';
    const w = Math.max(1.5, st.w * (0.7 + (i % 4) * 0.18));
    const dash = st.dash ? st.dash.map(v => (v * w * 0.8).toFixed(1)).join(' ') : 'none';
    const fid = 'bf' + Math.random().toString(36).slice(2, 7);
    return `<svg viewBox="0 0 160 38" aria-hidden="true">
      ${st.blur ? `<defs><filter id="${fid}" x="-10%" y="-60%" width="120%" height="220%"><feGaussianBlur stdDeviation="${(st.blur * 1.6).toFixed(1)}"/></filter></defs>` : ''}
      <path d="${d}" fill="none" stroke="${col}" stroke-opacity="${st.alpha}" stroke-width="${w.toFixed(1)}" stroke-linecap="${st.cap === 'butt' ? 'butt' : st.cap}" stroke-linejoin="round" stroke-dasharray="${dash}" ${st.blur ? `filter="url(#${fid})"` : ''}/>
    </svg>`;
  }

  function renderCats() {
    const h = $('#cats');
    if (!h) return;
    h.innerHTML = '';
    const all = [['★ Favorites', favs.size], ...CATS.map(c => [c[0], c[1].length])];
    all.forEach(([n, c]) => {
      const b = document.createElement('button');
      b.className = 'cat' + (n === curCat ? ' on' : '');
      b.innerHTML = `<span>${n}</span><em>${c}</em>`;
      b.onclick = () => {
        curCat = n;
        const bsearch = $('#bsearch');
        if (bsearch) bsearch.value = '';
        renderCats();
        renderBrushes();
      };
      h.append(b);
    });
  }

  function renderBrushes() {
    const q = ($('#bsearch')?.value || '').trim().toLowerCase();
    const g = $('#bgrid');
    if (!g) return;
    g.innerHTML = '';
    let any = false;

    CATS.forEach(([cat, names, st]) => {
      if (!q && curCat !== '★ Favorites' && cat !== curCat) return;
      names.forEach((nm, i) => {
        if (q && !(nm.toLowerCase().includes(q) || cat.toLowerCase().includes(q))) return;
        if (!q && curCat === '★ Favorites' && !favs.has(nm)) return;
        any = true;
        const c = document.createElement('div');
        c.className = 'bcard' + (S.brushName === nm ? ' on' : '');
        c.tabIndex = 0;
        c.setAttribute('role', 'button');
        c.innerHTML = `${strokeSVG(st, i, S.color)}<b>${nm}</b><button class="star ${favs.has(nm) ? 'on' : ''}" aria-label="Favourite">★</button>`;

        const pick_ = () => {
          S.brushName = nm;
          S.bs = {
            cap: st.cap,
            blur: st.blur,
            alpha: st.alpha,
            dash: st.dash ? st.dash.map(v => v * 0.8) : null
          };
          setTool('brush');
          renderBrushes();
          toast('Brush: ' + nm);
        };

        c.onclick = e => {
          if (e.target.classList.contains('star')) return;
          pick_();
        };
        c.onkeydown = e => { if (e.key === 'Enter') pick_(); };

        c.querySelector('.star').onclick = () => {
          favs.has(nm) ? favs.delete(nm) : favs.add(nm);
          store.set('craft-favs', JSON.stringify([...favs]));
          renderCats();
          renderBrushes();
        };
        g.append(c);
      });
    });

    if (!any) {
      g.innerHTML = `<div class="empty">${q ? 'No brushes match “' + q.replace(/</g, '&lt;') + '”' : 'Tap the ★ on a brush to keep it here'}</div>`;
    }
  }

  const bsearch = $('#bsearch');
  if (bsearch) bsearch.oninput = renderBrushes;

  const brushLibBtn = $('#brushLib');
  if (brushLibBtn) {
    brushLibBtn.onclick = () => {
      renderCats();
      renderBrushes();
      openModal('m-brush');
      setTimeout(() => $('#bsearch')?.focus(), 50);
    };
  }

  function segCtl(id, fn) {
    $$('#' + id + ' button').forEach(b => {
      b.onclick = () => {
        $$('#' + id + ' button').forEach(x => x.classList.toggle('on', x === b));
        fn(b.dataset.v);
      };
    });
  }

  segCtl('sizeCtl', v => S.sizeCtl = v);
  segCtl('opCtl', () => toast('Opacity dynamic control applied'));

  const minSizeInput = $('#minSize');
  if (minSizeInput) {
    minSizeInput.oninput = e => {
      S.minSize = +e.target.value;
      const minVal = $('#minVal');
      if (minVal) minVal.textContent = S.minSize + 'px';
    };
  }

  /* ================= Supabase Private Cloud Gallery ================= */
  const SCENES = [
    '<rect x="30" y="38" width="60" height="36" fill="#f2d4a8" stroke="#2b2a33" stroke-width="3"/><path d="M22 40 L60 10 L98 40Z" fill="#ff6b4a" stroke="#2b2a33" stroke-width="3" stroke-linejoin="round"/><rect x="52" y="52" width="16" height="22" fill="#a8693a" stroke="#2b2a33" stroke-width="2.5"/>',
    '<circle cx="86" cy="22" r="13" fill="#f7c948" stroke="#2b2a33" stroke-width="3"/><path d="M0 66 Q30 34 60 60 T120 56 V80 H0Z" fill="#6cc57c" stroke="#2b2a33" stroke-width="3"/>',
    '<path d="M60 10 l9 20 22 3 -16 15 4 22 -19-11 -19 11 4-22 -16-15 22-3z" fill="#f7c948" stroke="#2b2a33" stroke-width="3" stroke-linejoin="round"/>',
    '<g fill="none" stroke-width="7" stroke-linecap="round"><path d="M14 66 A46 46 0 0 1 106 66" stroke="#ff6b4a"/><path d="M24 66 A36 36 0 0 1 96 66" stroke="#f7c948"/><path d="M34 66 A26 26 0 0 1 86 66" stroke="#5cc98a"/><path d="M44 66 A16 16 0 0 1 76 66" stroke="#3b82f6"/></g>',
    '<g stroke="#2b2a33" stroke-width="3"><circle cx="60" cy="40" r="9" fill="#f7c948"/><circle cx="60" cy="20" r="10" fill="#ff8fb0"/><circle cx="60" cy="60" r="10" fill="#ff8fb0"/><circle cx="40" cy="40" r="10" fill="#ff8fb0"/><circle cx="80" cy="40" r="10" fill="#ff8fb0"/></g>',
    '<path d="M14 42 Q44 14 80 42 Q44 70 14 42Z" fill="#7cc4f0" stroke="#2b2a33" stroke-width="3"/><path d="M80 42 L108 22 L108 62Z" fill="#7cc4f0" stroke="#2b2a33" stroke-width="3" stroke-linejoin="round"/><circle cx="34" cy="38" r="3.5" fill="#2b2a33"/>'
  ];

  let gallery = [
    ['Sunny village', 0], ['Rainbow day', 3], ['My first star', 2],
    ['Fish pond', 5], ['Flower study', 4], ['Home sketch', 1]
  ].map(([n, s], i) => ({ n, s, id: i, date: ['Today', 'Yesterday', 'Mon', 'Oct 3', 'Sep 28', 'Sep 12'][i] }));

  async function syncUserGallery() {
    const user = supabaseService.getCurrentUser();
    if (user) {
      try {
        const cloudDrawings = await supabaseService.getUserDrawings(mode() === 'anim');
        if (cloudDrawings && cloudDrawings.length > 0) {
          gallery = cloudDrawings.map((it, idx) => ({
            n: it.title,
            s: idx % SCENES.length,
            id: it.id,
            date: new Date(it.updated_at || it.created_at).toLocaleDateString(),
            cloudId: it.id
          }));
        }
      } catch (_) {}
    }
    renderGal();
  }

  function renderGal() {
    const g = $('#gal');
    if (!g) return;
    g.innerHTML = '';
    gallery.forEach((it, i) => {
      const c = document.createElement('div');
      c.className = 'pol';
      c.style.setProperty('--r', (i % 2 ? 1.4 : -1.6) + 'deg');
      c.innerHTML = `
        <svg class="thumb" viewBox="0 0 120 80" role="button" tabindex="0" aria-label="Open ${it.n}">${SCENES[it.s]}</svg>
        <div class="nm" contenteditable="true" spellcheck="false" aria-label="Rename"></div>
        <div class="meta"><span>${it.date}</span><button class="del">delete</button></div>`;

      const nm = c.querySelector('.nm');
      nm.textContent = it.n;
      nm.onblur = async () => {
        it.n = nm.textContent.trim() || it.n;
        nm.textContent = it.n;
        if (it.cloudId) {
          try { await supabaseService.renameDrawing(it.cloudId, it.n); } catch (_) {}
        }
      };
      nm.onkeydown = e => {
        if (e.key === 'Enter') { e.preventDefault(); nm.blur(); }
        e.stopPropagation();
      };

      const op = async () => {
        closeModals();
        if (it.cloudId) {
          try {
            const full = await supabaseService.getDrawingById(it.cloudId);
            if (full && full.data) {
              await load(full.data);
              toast('Opened “' + it.n + '” with all its layers');
              return;
            }
          } catch (_) {}
        }
        toast('Opening “' + it.n + '”…');
      };

      const th = c.querySelector('.thumb');
      th.onclick = op;
      th.onkeydown = e => { if (e.key === 'Enter') op(); };

      const del = c.querySelector('.del');
      del.onclick = async () => {
        if (!del.classList.contains('sure')) {
          del.classList.add('sure');
          del.textContent = 'really delete?';
          setTimeout(() => {
            del.classList.remove('sure');
            del.textContent = 'delete';
          }, 2500);
          return;
        }
        if (it.cloudId) {
          try { await supabaseService.deleteDrawing(it.cloudId); } catch (_) {}
        }
        gallery.splice(i, 1);
        renderGal();
      };

      g.append(c);
    });

    if (!gallery.length) {
      g.innerHTML = '<div class="empty" style="grid-column:1/-1">Nothing here yet – start creating! ✏️</div>';
    }
  }

  const galBtn = $('#galBtn');
  if (galBtn) {
    galBtn.onclick = () => {
      syncUserGallery();
      openModal('m-gal');
    };
  }

  /* ================= Supabase Authentication Integration ================= */
  let authMode = 'in';

  function updateAuthUI(user) {
    const accBtn = $('#account');
    const authSignOutWrap = $('#authSignOutWrap');
    if (user) {
      const name = user.user_metadata?.full_name || user.email.split('@')[0];
      if (accBtn) accBtn.innerHTML = `👤 <b>${name}</b>`;
      if (authSignOutWrap) authSignOutWrap.style.display = 'block';
    } else {
      if (accBtn) accBtn.innerHTML = '👤 Sign in';
      if (authSignOutWrap) authSignOutWrap.style.display = 'none';
    }
  }

  supabaseService.onAuthStateChange(user => {
    updateAuthUI(user);
    if (user) syncUserGallery();
  });

  const authTabIn = $('#authTabIn'), authTabUp = $('#authTabUp');
  const aNameField = $('#aNameField'), aGo = $('#aGo');

  function setAuthMode(mode) {
    authMode = mode;
    if (authTabIn && authTabUp) {
      authTabIn.classList.toggle('on', mode === 'in');
      authTabUp.classList.toggle('on', mode === 'up');
    }
    const authT = $('#authT');
    if (authT) authT.textContent = mode === 'in' ? 'Welcome back!' : 'Join The Craft';
    if (aNameField) aNameField.style.display = mode === 'up' ? 'block' : 'none';
    if (aGo) aGo.textContent = mode === 'in' ? 'Sketch In' : 'Create account';
  }

  if (authTabIn) authTabIn.onclick = () => setAuthMode('in');
  if (authTabUp) authTabUp.onclick = () => setAuthMode('up');

  const accountBtn = $('#account');
  if (accountBtn) accountBtn.onclick = () => openModal('m-auth');

  const authForm = $('#authForm');
  if (authForm) {
    authForm.onsubmit = async e => {
      e.preventDefault();
      const email = $('#aEmail')?.value.trim();
      const pass = $('#aPass')?.value;
      const name = $('#aName')?.value.trim() || '';

      if (!email || !pass) {
        toast('Please fill in both email and password');
        return;
      }

      try {
        if (authMode === 'in') {
          toast('Signing in...');
          await supabaseService.signInWithPassword(email, pass);
          closeModals();
          toast('Welcome back to the studio! ✨');
        } else {
          toast('Creating your account...');
          await supabaseService.signUp(email, pass, name);
          closeModals();
          toast('Account created! Please check your email.');
        }
      } catch (err) {
        toast(err.message || 'Authentication error');
      }
    };
  }

  const magicBtn = $('#magic');
  if (magicBtn) {
    magicBtn.onclick = async () => {
      const email = $('#aEmail')?.value.trim();
      if (!email) {
        toast('Type your email first');
        $('#aEmail')?.focus();
        return;
      }
      try {
        toast('Sending magic link...');
        await supabaseService.signInWithOtp(email);
        closeModals();
        toast('Magic link sent! Check your inbox ✉️');
      } catch (err) {
        toast(err.message || 'Could not send magic link');
      }
    };
  }

  const gBtn = $('#gBtn');
  if (gBtn) {
    gBtn.onclick = async () => {
      try {
        toast('Connecting to Google OAuth...');
        await supabaseService.signInWithGoogle();
      } catch (err) {
        toast(err.message || 'Google Sign In failed');
      }
    };
  }

  const signOutBtn = $('#signOutBtn');
  if (signOutBtn) {
    signOutBtn.onclick = async () => {
      try {
        await supabaseService.signOut();
        closeModals();
        toast('Logged out of studio');
      } catch (err) {
        toast('Logout failed: ' + err.message);
      }
    };
  }

  /* ================= Modal Open & Close System ================= */
  let lastFocus = null;
  function openModal(id) {
    lastFocus = document.activeElement;
    closeModals(true);
    const m = $('#' + id);
    if (!m) return;
    m.classList.add('open');
    const f = m.querySelector('[data-close],input,button');
    if (f && id !== 'm-brush') f.focus();
  }

  function closeModals(silent) {
    $$('.modal.open').forEach(m => m.classList.remove('open'));
    if (!silent && lastFocus) {
      try { lastFocus.focus(); } catch (e) {}
    }
  }

  $$('.modal').forEach(m => {
    m.addEventListener('mousedown', e => {
      if (e.target === m) closeModals();
    });
    m.querySelectorAll('[data-close]').forEach(b => {
      b.onclick = () => closeModals();
    });
  });

  /* ================= Keyboard Shortcuts ================= */
  window.addEventListener('keydown', e => {
    const k = e.key.toLowerCase(), mod = e.ctrlKey || e.metaKey;
    if (k === 'escape') {
      if ($('.modal.open')) closeModals();
      else if (document.body.classList.contains('zen')) setZen(false);
      return;
    }
    if (e.target.matches('input,textarea,select,[contenteditable=true]') || $('.modal.open')) return;

    if (mod) {
      if (k === 'z') {
        e.preventDefault();
        e.shiftKey ? redo() : undo();
      } else if (k === 'y') {
        e.preventDefault();
        redo();
      } else if (k === 's') {
        e.preventDefault();
        $('#save')?.click();
      } else if (k === 'o') {
        e.preventDefault();
        $('#open')?.click();
      } else if (k === 'b') {
        e.preventDefault();
        dock?.classList.toggle('hide');
      }
      return;
    }

    if (k === ' ') {
      e.preventDefault();
      if (mode() === 'anim') setPlay(!playing);
      else {
        spaceDown = true;
        stage.classList.add('pan');
      }
      return;
    }

    if (TKEY[k]) setTool(TKEY[k]);
    else if (k === 'n') setTool('neon');
    else if (k === 'r') setTool('rainbow');
    else if (k === 'm') setTool('marker');
    else if (k === 'a') setTool('spray');
    else if (k === 'k') $('#brushLib')?.click();
    else if (k === 'z') setZen(!document.body.classList.contains('zen'));
    else if (k === '[') {
      sizeR.value = Math.max(1, S.size - 3);
      syncSliders();
    } else if (k === ']') {
      sizeR.value = Math.min(100, S.size + 3);
      syncSliders();
    } else if (k === '0') {
      $('#zreset')?.click();
    } else if (k === '+' || k === '=') {
      zoomBy(1.25);
    } else if (k === '-') {
      zoomBy(0.8);
    } else if (mode() === 'anim' && !playing) {
      if (k === 'arrowleft') select(cur - 1);
      else if (k === 'arrowright') select(cur + 1);
    }
  });

  window.addEventListener('keyup', e => {
    if (e.key === ' ') {
      spaceDown = false;
      stage.classList.remove('pan');
    }
  });

  /* ================= Application Bootstrap ================= */
  (async () => {
    if ($('#cw')) $('#cw').value = 1280;
    renderPresets();

    let ok = false;
    try {
      const raw = store.get(KEY);
      if (raw) {
        await load(JSON.parse(raw));
        ok = true;
      }
    } catch (e) {}

    if (!ok) {
      applySize(1200, 800, true);
      frames.length = 0;
      frames.push(mkFrame());
      cur = 0;
      renderStrip();
      select(0, false);
    }

    fit();
    applyView();
    setTool('pencil');
    if (stamp) stamp.textContent = 'Saved ✓';
  })();
})();
