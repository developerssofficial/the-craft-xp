/**
 * The Craft XP — Pro Digital Drawing & Design Studio
 * Interactive Object & Freehand Canvas Engine with Select & Move Tool
 */

document.addEventListener('DOMContentLoaded', () => {
  // ==========================================
  // 1. DOM Elements & References
  // ==========================================
  const viewport = document.getElementById('canvasStage');
  const canvasBoard = document.getElementById('canvasBoard');
  const gridCanvas = document.getElementById('gridCanvas');
  const paintCanvas = document.getElementById('paintCanvas');
  const previewCanvas = document.getElementById('previewCanvas');
  const cursorCanvas = document.getElementById('cursorCanvas');
  const inlineTextInput = document.getElementById('inlineCanvasTextInput');

  const gridCtx = gridCanvas.getContext('2d');
  const paintCtx = paintCanvas.getContext('2d', { willReadFrequently: true });
  const previewCtx = previewCanvas.getContext('2d');
  const cursorCtx = cursorCanvas.getContext('2d');

  // Sidebar Elements
  const toolDock = document.getElementById('toolDock');
  const propertiesPanel = document.getElementById('propertiesPanel');
  const toggleLeftDockBtn = document.getElementById('toggleLeftDockBtn');
  const toggleRightPanelBtn = document.getElementById('toggleRightPanelBtn');
  const collapseDockBtn = document.getElementById('collapseDockBtn');
  const collapsePanelBtn = document.getElementById('collapsePanelBtn');
  const leftEdgeTrigger = document.getElementById('leftEdgeTrigger');
  const rightEdgeTrigger = document.getElementById('rightEdgeTrigger');
  const zenModeBtn = document.getElementById('zenModeBtn');

  // Tools & Control Buttons
  const toolButtons = document.querySelectorAll('.tool-item');
  const brushSizeSlider = document.getElementById('brushSize');
  const brushOpacitySlider = document.getElementById('brushOpacity');
  const sizeBadge = document.getElementById('sizeBadge');
  const opacityBadge = document.getElementById('opacityBadge');
  const pillButtons = document.querySelectorAll('.pill-btn');
  const swatchButtons = document.querySelectorAll('.swatch-btn');
  const nativeColorPicker = document.getElementById('nativeColorPicker');
  const bottomColorPicker = document.getElementById('bottomColorPicker');
  const activeColorSwatch = document.getElementById('activeColorSwatch');
  const hexCodeBadge = document.getElementById('hexCodeBadge');
  const brushDotPreview = document.getElementById('brushDotPreview');
  const shapeFillCheck = document.getElementById('shapeFillCheck');
  const shapeConfig = document.getElementById('shapeConfig');
  const stampConfig = document.getElementById('stampConfig');
  const stampChoices = document.querySelectorAll('.stamp-choice');

  // Top Nav Controls
  const undoBtn = document.getElementById('undoBtn');
  const redoBtn = document.getElementById('redoBtn');
  const clearBtn = document.getElementById('clearBtn');
  const bgPreset = document.getElementById('bgPreset');
  const gridToggleBtn = document.getElementById('gridToggleBtn');
  const symmetryToggleBtn = document.getElementById('symmetryToggleBtn');
  const symmetryGuide = document.getElementById('symmetryGuide');
  const imageUploadInput = document.getElementById('imageUploadInput');
  const exportDropdownBtn = document.getElementById('exportDropdownBtn');
  const exportDropdownWrap = document.getElementById('exportDropdownWrap');
  const savePngBtn = document.getElementById('savePngBtn');
  const saveJpgBtn = document.getElementById('saveJpgBtn');
  const copyClipboardBtn = document.getElementById('copyClipboardBtn');
  const zoomInBtn = document.getElementById('zoomInBtn');
  const zoomOutBtn = document.getElementById('zoomOutBtn');
  const zoomResetBtn = document.getElementById('zoomResetBtn');
  const zoomLevelDisplay = document.getElementById('zoomLevel');

  // Floating Quick Bar
  const quickBtns = document.querySelectorAll('.quick-btn');
  const quickDots = document.querySelectorAll('.quick-dot');
  const toast = document.getElementById('toast');

  // ==========================================
  // 2. Application State & Elements Store
  // ==========================================
  const state = {
    tool: 'select', // select, brush, pencil, neon, rainbow, spray, highlighter, eraser, line, arrow, rectangle, circle, star, heart, fill, pipette, text, stamp
    color: '#6366f1',
    size: 8,
    opacity: 1.0,
    fillShape: false,
    selectedStamp: '⭐',
    isDrawing: false,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    points: [],
    rainbowHue: 0,
    showGrid: false,
    symmetryMode: false,
    zoom: 1.0,
    canvasBg: '#0f1117',
    canvasWidth: 0,
    canvasHeight: 0,
    leftDockCollapsed: false,
    rightPanelCollapsed: false,

    // Selection & Transform State
    selectedElement: null,
    isDraggingElement: false,
    isResizingElement: false,
    resizeHandle: null, // 'nw', 'ne', 'se', 'sw'
    dragOffset: { x: 0, y: 0 },

    // Elements & History
    elements: [],
    history: [],
    historyIndex: -1,
    maxHistory: 35,
  };

  let activeTextPos = null;

  // ==========================================
  // 3. Dynamic Fullscreen Canvas Resize
  // ==========================================
  function resizeCanvases() {
    const width = viewport.clientWidth || window.innerWidth;
    const height = viewport.clientHeight || (window.innerHeight - 56);

    if (state.canvasWidth === width && state.canvasHeight === height) return;

    state.canvasWidth = width;
    state.canvasHeight = height;

    [gridCanvas, paintCanvas, previewCanvas, cursorCanvas].forEach(canvas => {
      canvas.width = width;
      canvas.height = height;
    });

    drawGrid();
    renderAll();
  }

  // ==========================================
  // 4. Grid Rendering
  // ==========================================
  function drawGrid() {
    gridCtx.clearRect(0, 0, state.canvasWidth, state.canvasHeight);
    if (!state.showGrid) return;

    gridCtx.save();
    gridCtx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    gridCtx.lineWidth = 1;

    const step = 32;
    for (let x = 0; x <= state.canvasWidth; x += step) {
      gridCtx.beginPath();
      gridCtx.moveTo(x, 0);
      gridCtx.lineTo(x, state.canvasHeight);
      gridCtx.stroke();
    }

    for (let y = 0; y <= state.canvasHeight; y += step) {
      gridCtx.beginPath();
      gridCtx.moveTo(0, y);
      gridCtx.lineTo(state.canvasWidth, y);
      gridCtx.stroke();
    }
    gridCtx.restore();
  }

  // ==========================================
  // 5. History (Undo / Redo) Management
  // ==========================================
  function saveState() {
    if (state.historyIndex < state.history.length - 1) {
      state.history = state.history.slice(0, state.historyIndex + 1);
    }

    // Deep clone elements array
    const snapshot = JSON.stringify(state.elements);
    state.history.push(snapshot);

    if (state.history.length > state.maxHistory) {
      state.history.shift();
    } else {
      state.historyIndex++;
    }

    updateHistoryButtons();
  }

  function undo() {
    if (state.historyIndex > 0) {
      state.historyIndex--;
      const snapshot = state.history[state.historyIndex];
      state.elements = JSON.parse(snapshot);
      state.selectedElement = null;
      renderAll();
      updateHistoryButtons();
      showToast('Undo');
    }
  }

  function redo() {
    if (state.historyIndex < state.history.length - 1) {
      state.historyIndex++;
      const snapshot = state.history[state.historyIndex];
      state.elements = JSON.parse(snapshot);
      state.selectedElement = null;
      renderAll();
      updateHistoryButtons();
      showToast('Redo');
    }
  }

  function updateHistoryButtons() {
    undoBtn.disabled = state.historyIndex <= 0;
    redoBtn.disabled = state.historyIndex >= state.history.length - 1;
  }

  // ==========================================
  // 6. Master Render Loop
  // ==========================================
  function renderAll() {
    // 1. Render Background
    if (state.canvasBg === 'transparent') {
      paintCtx.clearRect(0, 0, state.canvasWidth, state.canvasHeight);
      paintCanvas.style.backgroundColor = 'transparent';
    } else {
      paintCtx.fillStyle = state.canvasBg;
      paintCtx.fillRect(0, 0, state.canvasWidth, state.canvasHeight);
      paintCanvas.style.backgroundColor = state.canvasBg;
    }

    // 2. Render all Elements
    state.elements.forEach(el => {
      renderElement(paintCtx, el);
    });

    // 3. Render Selection Bounding Box & Handles on previewCanvas
    previewCtx.clearRect(0, 0, state.canvasWidth, state.canvasHeight);
    if (state.tool === 'select' && state.selectedElement) {
      drawSelectionBox(previewCtx, state.selectedElement);
    }
  }

  function renderElement(ctx, el) {
    ctx.save();
    ctx.globalAlpha = el.opacity ?? 1.0;

    switch (el.type) {
      case 'stroke':
        renderStroke(ctx, el);
        break;

      case 'spray':
        renderSpray(ctx, el);
        break;

      case 'shape':
        renderShapeElement(ctx, el);
        break;

      case 'text':
        renderTextElement(ctx, el);
        break;

      case 'stamp':
        renderStampElement(ctx, el);
        break;

      case 'image':
        renderImageElement(ctx, el);
        break;
    }

    ctx.restore();
  }

  // ==========================================
  // 7. Element Renderers
  // ==========================================
  function renderStroke(ctx, el) {
    if (!el.points || el.points.length < 2) return;

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = el.tool === 'pencil' ? 1.5 : el.size;

    if (el.tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
    } else if (el.tool === 'highlighter') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 0.25;
      ctx.strokeStyle = el.color;
      ctx.lineCap = 'square';
    } else if (el.tool === 'neon') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = el.color;
      ctx.shadowBlur = el.size * 2;
      ctx.shadowColor = el.color;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = el.color;
      ctx.shadowBlur = 0;
    }

    ctx.beginPath();
    const pts = el.points;
    ctx.moveTo(pts[0].x, pts[0].y);

    for (let i = 1; i < pts.length; i++) {
      const p0 = pts[i - 1];
      const p1 = pts[i];
      const midX = (p0.x + p1.x) / 2;
      const midY = (p0.y + p1.y) / 2;
      ctx.quadraticCurveTo(p0.x, p0.y, midX, midY);
    }
    ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
    ctx.stroke();
  }

  function renderSpray(ctx, el) {
    ctx.fillStyle = el.color;
    ctx.globalAlpha = el.opacity * 0.4;
    el.dots.forEach(d => {
      ctx.fillRect(d.x, d.y, 1.5, 1.5);
    });
  }

  function renderShapeElement(ctx, el) {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = el.strokeWidth || 4;
    ctx.strokeStyle = el.color;
    ctx.fillStyle = el.color;

    ctx.beginPath();
    const x = el.x;
    const y = el.y;
    const w = el.width;
    const h = el.height;

    switch (el.shapeType) {
      case 'rectangle':
        if (el.fill) ctx.fillRect(x, y, w, h);
        else ctx.strokeRect(x, y, w, h);
        break;

      case 'circle':
        ctx.ellipse(x + w / 2, y + h / 2, Math.abs(w / 2), Math.abs(h / 2), 0, 0, Math.PI * 2);
        if (el.fill) ctx.fill();
        else ctx.stroke();
        break;

      case 'line':
        ctx.moveTo(x, y);
        ctx.lineTo(x + w, y + h);
        ctx.stroke();
        break;

      case 'arrow':
        drawArrow(ctx, x, y, x + w, y + h, el.strokeWidth);
        break;

      case 'star':
        drawStar(ctx, x + w / 2, y + h / 2, 5, Math.abs(w / 2), Math.abs(w / 4), el.fill);
        break;

      case 'heart':
        drawHeart(ctx, x + w / 2, y + h / 2, Math.abs(w), Math.abs(h), el.fill);
        break;
    }
  }

  function renderTextElement(ctx, el) {
    ctx.font = `600 ${el.fontSize}px 'Plus Jakarta Sans', system-ui, sans-serif`;
    ctx.fillStyle = el.color;
    ctx.textBaseline = 'top';

    const lines = el.text.split('\n');
    const lineHeight = el.fontSize * 1.25;

    lines.forEach((line, index) => {
      ctx.fillText(line, el.x, el.y + index * lineHeight);
    });
  }

  function renderStampElement(ctx, el) {
    ctx.font = `${el.size}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(el.emoji, el.x + el.width / 2, el.y + el.height / 2);
  }

  function renderImageElement(ctx, el) {
    if (!el._imgObj) {
      const img = new Image();
      img.onload = () => {
        el._imgObj = img;
        renderAll();
      };
      img.src = el.src;
    } else {
      ctx.drawImage(el._imgObj, el.x, el.y, el.width, el.height);
    }
  }

  function drawArrow(ctx, fromX, fromY, toX, toY, strokeWidth = 4) {
    const headLen = Math.max(16, strokeWidth * 2.5);
    const angle = Math.atan2(toY - fromY, toX - fromX);

    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(toX, toY);
    ctx.lineTo(toX - headLen * Math.cos(angle - Math.PI / 6), toY - headLen * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(toX - headLen * Math.cos(angle + Math.PI / 6), toY - headLen * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
  }

  function drawStar(ctx, cx, cy, spikes, outerRadius, innerRadius, filled) {
    let rot = (Math.PI / 2) * 3;
    let x = cx;
    let y = cy;
    const step = Math.PI / spikes;

    ctx.beginPath();
    ctx.moveTo(cx, cy - outerRadius);
    for (let i = 0; i < spikes; i++) {
      x = cx + Math.cos(rot) * outerRadius;
      y = cy + Math.sin(rot) * outerRadius;
      ctx.lineTo(x, y);
      rot += step;

      x = cx + Math.cos(rot) * innerRadius;
      y = cy + Math.sin(rot) * innerRadius;
      ctx.lineTo(x, y);
      rot += step;
    }
    ctx.lineTo(cx, cy - outerRadius);
    ctx.closePath();
    if (filled) ctx.fill();
    else ctx.stroke();
  }

  function drawHeart(ctx, cx, cy, w, h, filled) {
    const topCurveHeight = h * 0.3;
    ctx.beginPath();
    ctx.moveTo(cx, cy + h * 0.4);
    ctx.bezierCurveTo(cx, cy + h * 0.1, cx - w / 2, cy - topCurveHeight, cx - w / 2, cy - h * 0.2);
    ctx.bezierCurveTo(cx - w / 2, cy - h * 0.5, cx, cy - h * 0.5, cx, cy - h * 0.1);
    ctx.bezierCurveTo(cx, cy - h * 0.5, cx + w / 2, cy - h * 0.5, cx + w / 2, cy - h * 0.2);
    ctx.bezierCurveTo(cx + w / 2, cy - topCurveHeight, cx, cy + h * 0.1, cx, cy + h * 0.4);
    ctx.closePath();
    if (filled) ctx.fill();
    else ctx.stroke();
  }

  // ==========================================
  // 8. Selection Bounding Box & Handles
  // ==========================================
  function getElementBounds(el) {
    if (el.type === 'stroke') {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      el.points.forEach(p => {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      });
      const padding = el.size / 2;
      return { x: minX - padding, y: minY - padding, width: (maxX - minX) + padding * 2, height: (maxY - minY) + padding * 2 };
    }

    let x = el.x;
    let y = el.y;
    let w = el.width || 0;
    let h = el.height || 0;

    if (w < 0) { x += w; w = Math.abs(w); }
    if (h < 0) { y += h; h = Math.abs(h); }

    return { x, y, width: Math.max(w, 20), height: Math.max(h, 20) };
  }

  function drawSelectionBox(ctx, el) {
    const bounds = getElementBounds(el);
    const p = 6; // padding
    const x = bounds.x - p;
    const y = bounds.y - p;
    const w = bounds.width + p * 2;
    const h = bounds.height + p * 2;

    ctx.save();
    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 4]);
    ctx.strokeRect(x, y, w, h);
    ctx.setLineDash([]);

    // Corner Handles
    const handleSize = 8;
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 2;

    const handles = [
      { x: x, y: y, id: 'nw' },
      { x: x + w, y: y, id: 'ne' },
      { x: x + w, y: y + h, id: 'se' },
      { x: x, y: y + h, id: 'sw' }
    ];

    handles.forEach(h => {
      ctx.fillRect(h.x - handleSize / 2, h.y - handleSize / 2, handleSize, handleSize);
      ctx.strokeRect(h.x - handleSize / 2, h.y - handleSize / 2, handleSize, handleSize);
    });

    ctx.restore();
  }

  function hitTestElement(el, px, py) {
    const b = getElementBounds(el);
    const p = 8;
    return (
      px >= b.x - p &&
      px <= b.x + b.width + p &&
      py >= b.y - p &&
      py <= b.y + b.height + p
    );
  }

  function getHandleUnderCursor(el, px, py) {
    if (!el) return null;
    const bounds = getElementBounds(el);
    const p = 6;
    const x = bounds.x - p;
    const y = bounds.y - p;
    const w = bounds.width + p * 2;
    const h = bounds.height + p * 2;
    const handleRadius = 10;

    const handles = [
      { x: x, y: y, id: 'nw' },
      { x: x + w, y: y, id: 'ne' },
      { x: x + w, y: y + h, id: 'se' },
      { x: x, y: y + h, id: 'sw' }
    ];

    for (let handle of handles) {
      if (Math.hypot(px - handle.x, py - handle.y) <= handleRadius) {
        return handle.id;
      }
    }
    return null;
  }

  // ==========================================
  // 9. Coordinates & Pointer Calculations
  // ==========================================
  function getCoordinates(e) {
    const rect = paintCanvas.getBoundingClientRect();
    let clientX = e.clientX;
    let clientY = e.clientY;

    if (e.touches && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    }

    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  }

  // ==========================================
  // 10. Pointer & Mouse Event Handlers
  // ==========================================
  function handlePointerDown(e) {
    if (e.button !== 0 && e.type !== 'touchstart') return;
    const { x, y } = getCoordinates(e);

    state.startX = x;
    state.startY = y;
    state.lastX = x;
    state.lastY = y;

    // --- SELECT & MOVE TOOL ---
    if (state.tool === 'select') {
      // Check if clicking a resize handle on selected element
      if (state.selectedElement) {
        const handle = getHandleUnderCursor(state.selectedElement, x, y);
        if (handle) {
          state.isResizingElement = true;
          state.resizeHandle = handle;
          return;
        }
      }

      // Check if clicking on an element (from topmost to bottommost)
      let found = null;
      for (let i = state.elements.length - 1; i >= 0; i--) {
        if (hitTestElement(state.elements[i], x, y)) {
          found = state.elements[i];
          break;
        }
      }

      state.selectedElement = found;

      if (found) {
        state.isDraggingElement = true;
        state.dragOffset = { x: x - found.x, y: y - found.y };
        setColor(found.color || state.color);
        if (found.fontSize) setBrushSize(found.fontSize / 2.5);
        showToast(`Selected: ${found.type.toUpperCase()}`);
      }

      renderAll();
      return;
    }

    // --- INLINE TEXT TOOL ---
    if (state.tool === 'text') {
      openInlineTextInput(x, y);
      return;
    }

    // --- COLOR PIPETTE TOOL ---
    if (state.tool === 'pipette') {
      pickColorAt(Math.round(x), Math.round(y));
      return;
    }

    // --- COLOR BUCKET FILL ---
    if (state.tool === 'fill') {
      floodFill(Math.round(x), Math.round(y), state.color);
      saveState();
      return;
    }

    // --- EMOJI STAMP TOOL ---
    if (state.tool === 'stamp') {
      const stampSize = state.size * 3.5;
      const stampEl = {
        id: Date.now(),
        type: 'stamp',
        emoji: state.selectedStamp,
        x: x - stampSize / 2,
        y: y - stampSize / 2,
        width: stampSize,
        height: stampSize,
        size: stampSize,
        opacity: state.opacity,
      };
      state.elements.push(stampEl);

      if (state.symmetryMode) {
        state.elements.push({
          ...stampEl,
          id: Date.now() + 1,
          x: state.canvasWidth - x - stampSize / 2,
        });
      }

      renderAll();
      saveState();
      return;
    }

    // --- FREEHAND BRUSH & SHAPES DRAWING ---
    state.isDrawing = true;
    state.points = [{ x, y }];

    if (state.tool === 'spray') {
      const sprayEl = {
        id: Date.now(),
        type: 'spray',
        color: state.color,
        opacity: state.opacity,
        dots: generateSprayDots(x, y, state.size),
      };
      state.elements.push(sprayEl);
      renderAll();
    } else if (isFreehandTool(state.tool)) {
      const strokeEl = {
        id: Date.now(),
        type: 'stroke',
        tool: state.tool,
        color: state.tool === 'rainbow' ? `hsl(${state.rainbowHue}, 100%, 55%)` : state.color,
        size: state.tool === 'pencil' ? 1.5 : state.size,
        opacity: state.opacity,
        points: [{ x, y }],
      };
      state.elements.push(strokeEl);
      renderAll();
    }
  }

  function handlePointerMove(e) {
    const { x, y } = getCoordinates(e);
    drawCustomCursor(x, y);

    // --- SELECT TOOL: DRAG OR RESIZE ---
    if (state.tool === 'select') {
      if (state.isResizingElement && state.selectedElement) {
        const el = state.selectedElement;
        const dx = x - state.lastX;
        const dy = y - state.lastY;

        if (state.resizeHandle === 'se') {
          el.width = Math.max(15, (el.width || 50) + dx);
          el.height = Math.max(15, (el.height || 50) + dy);
        } else if (state.resizeHandle === 'sw') {
          el.x += dx;
          el.width = Math.max(15, (el.width || 50) - dx);
          el.height = Math.max(15, (el.height || 50) + dy);
        } else if (state.resizeHandle === 'ne') {
          el.y += dy;
          el.width = Math.max(15, (el.width || 50) + dx);
          el.height = Math.max(15, (el.height || 50) - dy);
        } else if (state.resizeHandle === 'nw') {
          el.x += dx;
          el.y += dy;
          el.width = Math.max(15, (el.width || 50) - dx);
          el.height = Math.max(15, (el.height || 50) - dy);
        }

        state.lastX = x;
        state.lastY = y;
        renderAll();
        return;
      }

      if (state.isDraggingElement && state.selectedElement) {
        const el = state.selectedElement;
        const dx = x - state.lastX;
        const dy = y - state.lastY;

        if (el.type === 'stroke') {
          el.points.forEach(p => { p.x += dx; p.y += dy; });
        } else {
          el.x += dx;
          el.y += dy;
        }

        state.lastX = x;
        state.lastY = y;
        renderAll();
        return;
      }

      // Cursor styling for hover
      if (state.selectedElement) {
        const handle = getHandleUnderCursor(state.selectedElement, x, y);
        if (handle) {
          viewport.style.cursor = (handle === 'nw' || handle === 'se') ? 'nwse-resize' : 'nesw-resize';
          return;
        }
      }

      let hoverFound = false;
      for (let i = state.elements.length - 1; i >= 0; i--) {
        if (hitTestElement(state.elements[i], x, y)) {
          viewport.style.cursor = 'move';
          hoverFound = true;
          break;
        }
      }
      if (!hoverFound) viewport.style.cursor = 'default';
      return;
    }

    if (!state.isDrawing) return;
    e.preventDefault();

    // --- FREEHAND DRAWING ---
    if (isFreehandTool(state.tool)) {
      const currentStroke = state.elements[state.elements.length - 1];
      if (currentStroke && currentStroke.type === 'stroke') {
        currentStroke.points.push({ x, y });
        renderAll();
      }
    } else if (state.tool === 'spray') {
      const currentSpray = state.elements[state.elements.length - 1];
      if (currentSpray && currentSpray.type === 'spray') {
        currentSpray.dots.push(...generateSprayDots(x, y, state.size));
        renderAll();
      }
    } else {
      // Shape Preview on previewCanvas
      previewCtx.clearRect(0, 0, state.canvasWidth, state.canvasHeight);
      drawShapePreview(previewCtx, state.tool, state.startX, state.startY, x, y, state.fillShape);

      if (state.symmetryMode) {
        drawShapePreview(
          previewCtx,
          state.tool,
          state.canvasWidth - state.startX,
          state.startY,
          state.canvasWidth - x,
          y,
          state.fillShape
        );
      }
    }
  }

  function handlePointerUp(e) {
    if (state.isDraggingElement || state.isResizingElement) {
      state.isDraggingElement = false;
      state.isResizingElement = false;
      saveState();
      return;
    }

    if (!state.isDrawing) return;
    state.isDrawing = false;

    // --- COMMIT SHAPES AS MOVEABLE OBJECTS ---
    const isShape = ['rectangle', 'circle', 'line', 'arrow', 'star', 'heart'].includes(state.tool);
    if (isShape) {
      const { x, y } = getCoordinates(e.changedTouches ? e.changedTouches[0] : e);
      const shapeEl = {
        id: Date.now(),
        type: 'shape',
        shapeType: state.tool,
        x: Math.min(state.startX, x),
        y: Math.min(state.startY, y),
        width: state.tool === 'line' || state.tool === 'arrow' ? x - state.startX : Math.abs(x - state.startX),
        height: state.tool === 'line' || state.tool === 'arrow' ? y - state.startY : Math.abs(y - state.startY),
        color: state.color,
        fill: state.fillShape,
        strokeWidth: state.size,
        opacity: state.opacity,
      };

      if (state.tool === 'line' || state.tool === 'arrow') {
        shapeEl.x = state.startX;
        shapeEl.y = state.startY;
      }

      state.elements.push(shapeEl);

      if (state.symmetryMode) {
        const mirrored = { ...shapeEl, id: Date.now() + 1 };
        if (state.tool === 'line' || state.tool === 'arrow') {
          mirrored.x = state.canvasWidth - state.startX;
          mirrored.width = -shapeEl.width;
        } else {
          mirrored.x = state.canvasWidth - shapeEl.x - shapeEl.width;
        }
        state.elements.push(mirrored);
      }

      previewCtx.clearRect(0, 0, state.canvasWidth, state.canvasHeight);
    }

    state.points = [];
    renderAll();
    saveState();
  }

  function isFreehandTool(tool) {
    return ['brush', 'pencil', 'neon', 'rainbow', 'highlighter', 'eraser'].includes(tool);
  }

  function generateSprayDots(x, y, size) {
    const density = Math.max(12, size * 2);
    const radius = size * 1.5;
    const dots = [];

    for (let i = 0; i < density; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = Math.random() * radius;
      dots.push({ x: x + Math.cos(angle) * r, y: y + Math.sin(angle) * r });
    }
    return dots;
  }

  function drawShapePreview(ctx, shape, x1, y1, x2, y2, filled) {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = state.size;
    ctx.globalAlpha = state.opacity;
    ctx.strokeStyle = state.color;
    ctx.fillStyle = state.color;

    const w = x2 - x1;
    const h = y2 - y1;

    switch (shape) {
      case 'line':
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        break;

      case 'arrow':
        drawArrow(ctx, x1, y1, x2, y2, state.size);
        break;

      case 'rectangle': {
        const minX = Math.min(x1, x2);
        const minY = Math.min(y1, y2);
        if (filled) ctx.fillRect(minX, minY, Math.abs(w), Math.abs(h));
        else ctx.strokeRect(minX, minY, Math.abs(w), Math.abs(h));
        break;
      }

      case 'circle': {
        ctx.beginPath();
        ctx.ellipse(x1 + w / 2, y1 + h / 2, Math.abs(w / 2), Math.abs(h / 2), 0, 0, Math.PI * 2);
        if (filled) ctx.fill();
        else ctx.stroke();
        break;
      }

      case 'star':
        drawStar(ctx, x1 + w / 2, y1 + h / 2, 5, Math.abs(w / 2), Math.abs(w / 4), filled);
        break;

      case 'heart':
        drawHeart(ctx, x1 + w / 2, y1 + h / 2, Math.abs(w), Math.abs(h), filled);
        break;
    }
    ctx.restore();
  }

  // ==========================================
  // 11. Inline Canvas Typing System
  // ==========================================
  function openInlineTextInput(x, y, existingText = '') {
    commitInlineText();

    activeTextPos = { x, y };
    const fontSize = Math.max(18, state.size * 2.5);

    inlineTextInput.style.left = `${x}px`;
    inlineTextInput.style.top = `${y}px`;
    inlineTextInput.style.fontSize = `${fontSize}px`;
    inlineTextInput.style.color = state.color;
    inlineTextInput.style.opacity = state.opacity;
    inlineTextInput.value = existingText;
    inlineTextInput.classList.remove('hidden');

    setTimeout(() => {
      inlineTextInput.focus();
    }, 10);
  }

  function commitInlineText() {
    if (!activeTextPos || inlineTextInput.classList.contains('hidden')) return;

    const text = inlineTextInput.value.trim();
    if (text) {
      const fontSize = Math.max(18, state.size * 2.5);
      const lines = inlineTextInput.value.split('\n');
      const lineHeight = fontSize * 1.25;

      // Calculate approximate text bounding box
      let maxLineWidth = 0;
      paintCtx.font = `600 ${fontSize}px 'Plus Jakarta Sans', system-ui, sans-serif`;
      lines.forEach(l => {
        const m = paintCtx.measureText(l);
        if (m.width > maxLineWidth) maxLineWidth = m.width;
      });

      const textEl = {
        id: Date.now(),
        type: 'text',
        text: inlineTextInput.value,
        x: activeTextPos.x,
        y: activeTextPos.y,
        width: Math.max(maxLineWidth, 40),
        height: lines.length * lineHeight,
        fontSize: fontSize,
        color: state.color,
        opacity: state.opacity,
      };

      state.elements.push(textEl);

      if (state.symmetryMode) {
        state.elements.push({
          ...textEl,
          id: Date.now() + 1,
          x: state.canvasWidth - activeTextPos.x - textEl.width,
        });
      }

      renderAll();
      saveState();
      showToast('Text element created');
    }

    inlineTextInput.classList.add('hidden');
    inlineTextInput.value = '';
    activeTextPos = null;
  }

  inlineTextInput.addEventListener('blur', () => {
    commitInlineText();
  });

  inlineTextInput.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      commitInlineText();
    } else if (e.key === 'Escape') {
      inlineTextInput.classList.add('hidden');
      inlineTextInput.value = '';
      activeTextPos = null;
    }
  });

  inlineTextInput.addEventListener('input', () => {
    inlineTextInput.style.height = 'auto';
    inlineTextInput.style.height = `${inlineTextInput.scrollHeight}px`;
  });

  // Double click anywhere to start typing or edit text
  viewport.addEventListener('dblclick', (e) => {
    const { x, y } = getCoordinates(e);

    // If double clicking on a text element, edit it
    for (let i = state.elements.length - 1; i >= 0; i--) {
      const el = state.elements[i];
      if (el.type === 'text' && hitTestElement(el, x, y)) {
        state.elements.splice(i, 1);
        renderAll();
        openInlineTextInput(el.x, el.y, el.text);
        return;
      }
    }

    setTool('text');
    openInlineTextInput(x, y);
  });

  // ==========================================
  // 12. Flood Fill & Eyedropper
  // ==========================================
  function floodFill(startX, startY, fillHex) {
    const imgData = paintCtx.getImageData(0, 0, state.canvasWidth, state.canvasHeight);
    const data = imgData.data;

    const targetColor = getPixelColor(data, startX, startY);
    const fillColor = hexToRgba(fillHex, state.opacity);

    if (colorsMatch(targetColor, fillColor, 5)) return;

    const stack = [[startX, startY]];
    const seen = new Uint8Array(state.canvasWidth * state.canvasHeight);

    while (stack.length > 0) {
      const [curX, curY] = stack.pop();
      if (curX < 0 || curX >= state.canvasWidth || curY < 0 || curY >= state.canvasHeight) continue;

      const idx = curY * state.canvasWidth + curX;
      if (seen[idx]) continue;
      seen[idx] = 1;

      const currentColor = getPixelColor(data, curX, curY);
      if (colorsMatch(currentColor, targetColor, 35)) {
        setPixelColor(data, curX, curY, fillColor);

        stack.push([curX + 1, curY]);
        stack.push([curX - 1, curY]);
        stack.push([curX, curY + 1]);
        stack.push([curX, curY - 1]);
      }
    }

    paintCtx.putImageData(imgData, 0, 0);
    showToast('Color Fill applied');
  }

  function getPixelColor(data, x, y) {
    const offset = (y * state.canvasWidth + x) * 4;
    return [data[offset], data[offset + 1], data[offset + 2], data[offset + 3]];
  }

  function setPixelColor(data, x, y, color) {
    const offset = (y * state.canvasWidth + x) * 4;
    data[offset] = color[0];
    data[offset + 1] = color[1];
    data[offset + 2] = color[2];
    data[offset + 3] = color[3];
  }

  function colorsMatch(c1, c2, tolerance = 0) {
    return (
      Math.abs(c1[0] - c2[0]) <= tolerance &&
      Math.abs(c1[1] - c2[1]) <= tolerance &&
      Math.abs(c1[2] - c2[2]) <= tolerance &&
      Math.abs(c1[3] - c2[3]) <= tolerance
    );
  }

  function hexToRgba(hex, alpha = 1.0) {
    let c = hex.replace('#', '');
    if (c.length === 3) {
      c = c.split('').map(x => x + x).join('');
    }
    const num = parseInt(c, 16);
    return [(num >> 16) & 255, (num >> 8) & 255, num & 255, Math.round(alpha * 255)];
  }

  function pickColorAt(x, y) {
    const pixel = paintCtx.getImageData(x, y, 1, 1).data;
    const hex = `#${((1 << 24) + (pixel[0] << 16) + (pixel[1] << 8) + pixel[2]).toString(16).slice(1)}`;
    setColor(hex);
    setTool('brush');
    showToast(`Picked Color: ${hex.toUpperCase()}`);
  }

  // ==========================================
  // 13. Cursor Preview
  // ==========================================
  function drawCustomCursor(x, y) {
    cursorCtx.clearRect(0, 0, state.canvasWidth, state.canvasHeight);

    if (state.tool === 'select') return;

    if (isFreehandTool(state.tool) || state.tool === 'spray') {
      const sz = state.tool === 'pencil' ? 3 : state.size;
      cursorCtx.beginPath();
      cursorCtx.arc(x, y, sz / 2, 0, Math.PI * 2);
      cursorCtx.strokeStyle = state.tool === 'eraser' ? '#ef4444' : '#ffffff';
      cursorCtx.lineWidth = 1.5;
      cursorCtx.stroke();

      if (state.symmetryMode) {
        cursorCtx.beginPath();
        cursorCtx.arc(state.canvasWidth - x, y, sz / 2, 0, Math.PI * 2);
        cursorCtx.stroke();
      }
    }
  }

  // ==========================================
  // 14. Sidebar Collapsing & Zen Mode
  // ==========================================
  function toggleLeftDock(forceState = null) {
    state.leftDockCollapsed = forceState !== null ? forceState : !state.leftDockCollapsed;
    toolDock.classList.toggle('collapsed', state.leftDockCollapsed);
    leftEdgeTrigger.classList.toggle('visible', state.leftDockCollapsed);
    toggleLeftDockBtn.classList.toggle('active-panel-toggle', !state.leftDockCollapsed);
    showToast(state.leftDockCollapsed ? 'Tools Dock hidden' : 'Tools Dock visible');
    setTimeout(resizeCanvases, 300);
  }

  function toggleRightPanel(forceState = null) {
    state.rightPanelCollapsed = forceState !== null ? forceState : !state.rightPanelCollapsed;
    propertiesPanel.classList.toggle('collapsed', state.rightPanelCollapsed);
    rightEdgeTrigger.classList.toggle('visible', state.rightPanelCollapsed);
    toggleRightPanelBtn.classList.toggle('active-panel-toggle', !state.rightPanelCollapsed);
    showToast(state.rightPanelCollapsed ? 'Properties Panel hidden' : 'Properties Panel visible');
    setTimeout(resizeCanvases, 300);
  }

  function toggleZenMode() {
    const bothCollapsed = state.leftDockCollapsed && state.rightPanelCollapsed;
    if (bothCollapsed) {
      toggleLeftDock(false);
      toggleRightPanel(false);
      zenModeBtn.classList.remove('active');
      showToast('Zen Mode Exited');
    } else {
      toggleLeftDock(true);
      toggleRightPanel(true);
      zenModeBtn.classList.add('active');
      showToast('Zen Mode (Press Tab to restore)');
    }
    setTimeout(resizeCanvases, 300);
  }

  // ==========================================
  // 15. UI State Updates
  // ==========================================
  function setTool(toolName) {
    state.tool = toolName;
    if (toolName !== 'select') {
      state.selectedElement = null;
      renderAll();
    }

    toolButtons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tool === toolName);
    });

    quickBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.action === toolName);
    });

    const isShape = ['rectangle', 'circle', 'star', 'heart'].includes(toolName);
    shapeConfig.classList.toggle('hidden', !isShape);
    stampConfig.classList.toggle('hidden', toolName !== 'stamp');

    viewport.style.cursor = toolName === 'select' ? 'default' : 'crosshair';
    showToast(`Tool: ${getToolLabel(toolName)}`);
  }

  function getToolLabel(t) {
    const labels = {
      select: 'Select & Move',
      brush: 'Smooth Brush',
      pencil: 'Fine Pencil',
      neon: 'Neon Glow',
      rainbow: 'Rainbow Stream',
      spray: 'Airbrush / Spray',
      highlighter: 'Highlighter',
      eraser: 'Eraser',
      fill: 'Bucket Fill',
      pipette: 'Eyedropper',
      line: 'Line',
      arrow: 'Arrow',
      rectangle: 'Rectangle',
      circle: 'Circle',
      star: 'Star',
      heart: 'Heart',
      text: 'Text',
      stamp: 'Stamp',
    };
    return labels[t] || t;
  }

  function setColor(hex) {
    state.color = hex;
    activeColorSwatch.style.backgroundColor = hex;
    nativeColorPicker.value = hex;
    bottomColorPicker.value = hex;
    hexCodeBadge.textContent = hex.toUpperCase();
    brushDotPreview.style.backgroundColor = hex;

    swatchButtons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.color.toLowerCase() === hex.toLowerCase());
    });

    quickDots.forEach(dot => {
      dot.classList.toggle('active', dot.dataset.color.toLowerCase() === hex.toLowerCase());
    });

    // Update selected element color live
    if (state.selectedElement) {
      state.selectedElement.color = hex;
      renderAll();
    }
  }

  function setBrushSize(size) {
    state.size = parseInt(size, 10);
    brushSizeSlider.value = state.size;
    sizeBadge.textContent = `${state.size}px`;
    brushDotPreview.style.width = `${Math.min(28, Math.max(4, state.size))}px`;
    brushDotPreview.style.height = `${Math.min(28, Math.max(4, state.size))}px`;

    pillButtons.forEach(pill => {
      pill.classList.toggle('active', parseInt(pill.dataset.size, 10) === state.size);
    });

    // Update selected element size live
    if (state.selectedElement) {
      if (state.selectedElement.fontSize) {
        state.selectedElement.fontSize = Math.max(16, state.size * 2.5);
      } else if (state.selectedElement.strokeWidth) {
        state.selectedElement.strokeWidth = state.size;
      }
      renderAll();
    }
  }

  function setOpacity(val) {
    state.opacity = parseInt(val, 10) / 100;
    brushOpacitySlider.value = val;
    opacityBadge.textContent = `${val}%`;
    brushDotPreview.style.opacity = state.opacity;

    if (state.selectedElement) {
      state.selectedElement.opacity = state.opacity;
      renderAll();
    }
  }

  function updateUI() {
    setColor(state.color);
    setBrushSize(state.size);
    setOpacity(state.opacity * 100);
    setTool(state.tool);
  }

  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove('show'), 1800);
  }

  // ==========================================
  // 16. Event Listeners
  // ==========================================
  window.addEventListener('resize', resizeCanvases);

  viewport.addEventListener('mousedown', handlePointerDown);
  window.addEventListener('mousemove', handlePointerMove);
  window.addEventListener('mouseup', handlePointerUp);

  viewport.addEventListener('touchstart', handlePointerDown, { passive: false });
  window.addEventListener('touchmove', handlePointerMove, { passive: false });
  window.addEventListener('touchend', handlePointerUp, { passive: false });

  // Sidebar Toggles
  toggleLeftDockBtn.addEventListener('click', () => toggleLeftDock());
  collapseDockBtn.addEventListener('click', () => toggleLeftDock(true));
  leftEdgeTrigger.addEventListener('click', () => toggleLeftDock(false));

  toggleRightPanelBtn.addEventListener('click', () => toggleRightPanel());
  collapsePanelBtn.addEventListener('click', () => toggleRightPanel(true));
  rightEdgeTrigger.addEventListener('click', () => toggleRightPanel(false));

  zenModeBtn.addEventListener('click', toggleZenMode);

  // Tools Selection
  toolButtons.forEach(btn => {
    btn.addEventListener('click', () => setTool(btn.dataset.tool));
  });

  brushSizeSlider.addEventListener('input', e => setBrushSize(e.target.value));
  brushOpacitySlider.addEventListener('input', e => setOpacity(e.target.value));

  pillButtons.forEach(pill => {
    pill.addEventListener('click', () => setBrushSize(pill.dataset.size));
  });

  swatchButtons.forEach(swatch => {
    swatch.addEventListener('click', () => setColor(swatch.dataset.color));
  });

  nativeColorPicker.addEventListener('input', e => setColor(e.target.value));
  bottomColorPicker.addEventListener('input', e => setColor(e.target.value));

  stampChoices.forEach(btn => {
    btn.addEventListener('click', () => {
      stampChoices.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.selectedStamp = btn.dataset.emoji;
    });
  });

  shapeFillCheck.addEventListener('change', e => {
    state.fillShape = e.target.checked;
    if (state.selectedElement && state.selectedElement.type === 'shape') {
      state.selectedElement.fill = state.fillShape;
      renderAll();
    }
  });

  // History Actions
  undoBtn.addEventListener('click', undo);
  redoBtn.addEventListener('click', redo);

  clearBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to clear the entire canvas?')) {
      state.elements = [];
      state.selectedElement = null;
      renderAll();
      saveState();
      showToast('Canvas Cleared');
    }
  });

  bgPreset.addEventListener('change', e => {
    state.canvasBg = e.target.value;
    renderAll();
    saveState();
    showToast('Background updated');
  });

  gridToggleBtn.addEventListener('click', () => {
    state.showGrid = !state.showGrid;
    gridToggleBtn.classList.toggle('active', state.showGrid);
    drawGrid();
    showToast(state.showGrid ? 'Grid enabled' : 'Grid disabled');
  });

  symmetryToggleBtn.addEventListener('click', () => {
    state.symmetryMode = !state.symmetryMode;
    symmetryToggleBtn.classList.toggle('active', state.symmetryMode);
    symmetryGuide.classList.toggle('active', state.symmetryMode);
    showToast(state.symmetryMode ? 'Symmetry Mode ON' : 'Symmetry Mode OFF');
  });

  // Zoom
  zoomInBtn.addEventListener('click', () => {
    state.zoom = Math.min(3.0, state.zoom + 0.15);
    canvasBoard.style.transform = `scale(${state.zoom})`;
    zoomLevelDisplay.textContent = `${Math.round(state.zoom * 100)}%`;
  });
  zoomOutBtn.addEventListener('click', () => {
    state.zoom = Math.max(0.3, state.zoom - 0.15);
    canvasBoard.style.transform = `scale(${state.zoom})`;
    zoomLevelDisplay.textContent = `${Math.round(state.zoom * 100)}%`;
  });
  zoomResetBtn.addEventListener('click', () => {
    state.zoom = 1.0;
    canvasBoard.style.transform = 'scale(1)';
    zoomLevelDisplay.textContent = '100%';
  });

  // Quick Bar interactions
  quickBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const act = btn.dataset.action;
      if (act === 'select') setTool('select');
      else if (act === 'brush') setTool('brush');
      else if (act === 'pencil') setTool('pencil');
      else if (act === 'eraser') setTool('eraser');
      else if (act === 'undo') undo();
      else if (act === 'redo') redo();
    });
  });

  quickDots.forEach(dot => {
    dot.addEventListener('click', () => setColor(dot.dataset.color));
  });

  // Export
  exportDropdownBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    exportDropdownWrap.classList.toggle('open');
  });

  document.addEventListener('click', () => {
    exportDropdownWrap.classList.remove('open');
  });

  savePngBtn.addEventListener('click', () => {
    const link = document.createElement('a');
    link.download = `TheCraftXP_${Date.now()}.png`;
    link.href = paintCanvas.toDataURL('image/png');
    link.click();
    showToast('Downloading PNG...');
  });

  saveJpgBtn.addEventListener('click', () => {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = state.canvasWidth;
    tempCanvas.height = state.canvasHeight;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.fillStyle = '#ffffff';
    tempCtx.fillRect(0, 0, state.canvasWidth, state.canvasHeight);
    tempCtx.drawImage(paintCanvas, 0, 0);

    const link = document.createElement('a');
    link.download = `TheCraftXP_${Date.now()}.jpg`;
    link.href = tempCanvas.toDataURL('image/jpeg', 0.95);
    link.click();
    showToast('Downloading JPG...');
  });

  copyClipboardBtn.addEventListener('click', async () => {
    try {
      paintCanvas.toBlob(async (blob) => {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ]);
        showToast('Image copied to clipboard!');
      });
    } catch (err) {
      showToast('Clipboard access failed');
    }
  });

  // Image Import
  imageUploadInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    placeImageFile(file);
  });

  function placeImageFile(file) {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const ratio = Math.min((state.canvasWidth * 0.5) / img.width, (state.canvasHeight * 0.5) / img.height, 1);
        const w = img.width * ratio;
        const h = img.height * ratio;
        const x = (state.canvasWidth - w) / 2;
        const y = (state.canvasHeight - h) / 2;

        const imgEl = {
          id: Date.now(),
          type: 'image',
          src: event.target.result,
          _imgObj: img,
          x: x,
          y: y,
          width: w,
          height: h,
          opacity: 1.0,
        };

        state.elements.push(imgEl);
        state.selectedElement = imgEl;
        setTool('select');
        renderAll();
        saveState();
        showToast('Image added (Select tool active to move/resize)');
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  }

  // Paste image directly from clipboard
  window.addEventListener('paste', (e) => {
    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
    for (let item of items) {
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const blob = item.getAsFile();
        placeImageFile(blob);
        break;
      }
    }
  });

  // Keyboard Shortcuts & Delete Key
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

    // Delete selected element with Delete or Backspace
    if ((e.key === 'Delete' || e.key === 'Backspace') && state.selectedElement) {
      e.preventDefault();
      const idx = state.elements.indexOf(state.selectedElement);
      if (idx !== -1) {
        state.elements.splice(idx, 1);
        state.selectedElement = null;
        renderAll();
        saveState();
        showToast('Element deleted');
      }
      return;
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      toggleZenMode();
      return;
    }

    if (e.ctrlKey || e.metaKey) {
      if (e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undo();
      } else if (e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      } else if (e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggleLeftDock();
      }
      return;
    }

    switch (e.key.toLowerCase()) {
      case 'v': setTool('select'); break;
      case 'b': setTool('brush'); break;
      case 'p': setTool('pencil'); break;
      case 'g': setTool('neon'); break;
      case 'r': setTool('rainbow'); break;
      case 'a': setTool('spray'); break;
      case 'h': setTool('highlighter'); break;
      case 'e': setTool('eraser'); break;
      case 'f': setTool('fill'); break;
      case 'i': setTool('pipette'); break;
      case 't': setTool('text'); break;
      case '[': setBrushSize(Math.max(1, state.size - 4)); break;
      case ']': setBrushSize(Math.min(100, state.size + 4)); break;
    }
  });

  // Initialize
  resizeCanvases();
  updateUI();
});
