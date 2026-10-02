/**
 * CanvasCraft Studio — Pro Drawing & Canvas Engine
 * Modern, High-Performance Canvas Application in Pure JavaScript
 * 100% Fullscreen Edge-to-Edge Responsive Canvas
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

  const gridCtx = gridCanvas.getContext('2d');
  const paintCtx = paintCanvas.getContext('2d', { willReadFrequently: true });
  const previewCtx = previewCanvas.getContext('2d');
  const cursorCtx = cursorCanvas.getContext('2d');

  // Sidebar Elements & Collapsers
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

  // Modal & Toast
  const textInputModal = document.getElementById('textInputModal');
  const canvasTextInput = document.getElementById('canvasTextInput');
  const modalFontSize = document.getElementById('modalFontSize');
  const confirmTextBtn = document.getElementById('confirmTextBtn');
  const cancelTextBtn = document.getElementById('cancelTextBtn');
  const modalCloseBtn = document.getElementById('modalCloseBtn');
  const toast = document.getElementById('toast');

  // ==========================================
  // 2. Application State
  // ==========================================
  const state = {
    tool: 'brush',
    color: '#6366f1',
    size: 8,
    opacity: 1.0,
    fillShape: false,
    selectedStamp: '⭐',
    isDrawing: false,
    startX: 0,
    startY: 0,
    points: [],
    rainbowHue: 0,
    showGrid: false,
    symmetryMode: false,
    zoom: 1.0,
    canvasBg: '#0f1117',
    textPendingCoords: null,
    history: [],
    historyIndex: -1,
    maxHistory: 30,
    leftDockCollapsed: false,
    rightPanelCollapsed: false,
    canvasWidth: 0,
    canvasHeight: 0,
  };

  // ==========================================
  // 3. Dynamic Fullscreen Canvas Resize
  // ==========================================
  function resizeCanvases() {
    const width = viewport.clientWidth || window.innerWidth;
    const height = viewport.clientHeight || (window.innerHeight - 56);

    if (state.canvasWidth === width && state.canvasHeight === height) return;

    // Save previous drawing if exists
    let previousImage = null;
    if (state.canvasWidth > 0 && state.canvasHeight > 0) {
      previousImage = paintCtx.getImageData(0, 0, state.canvasWidth, state.canvasHeight);
    }

    state.canvasWidth = width;
    state.canvasHeight = height;

    [gridCanvas, paintCanvas, previewCanvas, cursorCanvas].forEach(canvas => {
      canvas.width = width;
      canvas.height = height;
    });

    if (previousImage) {
      fillCanvasBackground(state.canvasBg);
      paintCtx.putImageData(previousImage, 0, 0);
    } else {
      fillCanvasBackground(state.canvasBg);
      saveState();
    }

    drawGrid();
  }

  function fillCanvasBackground(bgColor) {
    if (bgColor === 'transparent') {
      paintCtx.clearRect(0, 0, state.canvasWidth, state.canvasHeight);
      paintCanvas.style.backgroundColor = 'transparent';
    } else {
      paintCtx.fillStyle = bgColor;
      paintCtx.fillRect(0, 0, state.canvasWidth, state.canvasHeight);
      paintCanvas.style.backgroundColor = bgColor;
    }
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
  // 5. History (Undo / Redo) Stack
  // ==========================================
  function saveState() {
    if (state.historyIndex < state.history.length - 1) {
      state.history = state.history.slice(0, state.historyIndex + 1);
    }

    const imageData = paintCtx.getImageData(0, 0, state.canvasWidth, state.canvasHeight);
    state.history.push(imageData);

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
      paintCtx.putImageData(snapshot, 0, 0);
      updateHistoryButtons();
      showToast('Undo');
    }
  }

  function redo() {
    if (state.historyIndex < state.history.length - 1) {
      state.historyIndex++;
      const snapshot = state.history[state.historyIndex];
      paintCtx.putImageData(snapshot, 0, 0);
      updateHistoryButtons();
      showToast('Redo');
    }
  }

  function updateHistoryButtons() {
    undoBtn.disabled = state.historyIndex <= 0;
    redoBtn.disabled = state.historyIndex >= state.history.length - 1;
  }

  // ==========================================
  // 6. 1:1 Pixel Coordinates Calculation
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
  // 7. Drawing Event Handlers
  // ==========================================
  function startDrawing(e) {
    if (e.button !== 0 && e.type !== 'touchstart') return;
    e.preventDefault();

    const { x, y } = getCoordinates(e);
    state.startX = x;
    state.startY = y;
    state.points = [{ x, y }];

    if (state.tool === 'fill') {
      floodFill(Math.round(x), Math.round(y), state.color);
      saveState();
      return;
    }

    if (state.tool === 'pipette') {
      pickColorAt(Math.round(x), Math.round(y));
      return;
    }

    if (state.tool === 'text') {
      state.textPendingCoords = { x, y };
      textInputModal.classList.remove('hidden');
      canvasTextInput.value = '';
      canvasTextInput.focus();
      return;
    }

    if (state.tool === 'stamp') {
      drawStamp(paintCtx, state.selectedStamp, x, y, state.size * 3.5);
      if (state.symmetryMode) {
        drawStamp(paintCtx, state.selectedStamp, state.canvasWidth - x, y, state.size * 3.5);
      }
      saveState();
      return;
    }

    state.isDrawing = true;

    if (state.tool === 'spray') {
      drawSpray(paintCtx, x, y);
      if (state.symmetryMode) drawSpray(paintCtx, state.canvasWidth - x, y);
    } else if (isFreehandTool(state.tool)) {
      paintCtx.save();
      configureBrushContext(paintCtx);
      paintCtx.beginPath();
      paintCtx.arc(x, y, (state.tool === 'pencil' ? 1.5 : state.size) / 2, 0, Math.PI * 2);
      paintCtx.fill();

      if (state.symmetryMode) {
        paintCtx.beginPath();
        paintCtx.arc(state.canvasWidth - x, y, (state.tool === 'pencil' ? 1.5 : state.size) / 2, 0, Math.PI * 2);
        paintCtx.fill();
      }
      paintCtx.restore();
    }
  }

  function draw(e) {
    const { x, y } = getCoordinates(e);
    drawCustomCursor(x, y);

    if (!state.isDrawing) return;
    e.preventDefault();

    if (state.tool === 'spray') {
      drawSpray(paintCtx, x, y);
      if (state.symmetryMode) drawSpray(paintCtx, state.canvasWidth - x, y);
    } else if (isFreehandTool(state.tool)) {
      state.points.push({ x, y });
      drawSmoothStroke(paintCtx, state.points);

      if (state.symmetryMode) {
        const mirroredPoints = state.points.map(p => ({
          x: state.canvasWidth - p.x,
          y: p.y
        }));
        drawSmoothStroke(paintCtx, mirroredPoints);
      }
    } else {
      previewCtx.clearRect(0, 0, state.canvasWidth, state.canvasHeight);
      drawShape(previewCtx, state.tool, state.startX, state.startY, x, y, state.fillShape);

      if (state.symmetryMode) {
        drawShape(
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

  function stopDrawing(e) {
    if (!state.isDrawing) return;
    state.isDrawing = false;

    if (!isFreehandTool(state.tool) && state.tool !== 'spray' && state.tool !== 'fill' && state.tool !== 'pipette' && state.tool !== 'text' && state.tool !== 'stamp') {
      const { x, y } = getCoordinates(e.changedTouches ? e.changedTouches[0] : e);
      drawShape(paintCtx, state.tool, state.startX, state.startY, x, y, state.fillShape);
      if (state.symmetryMode) {
        drawShape(
          paintCtx,
          state.tool,
          state.canvasWidth - state.startX,
          state.startY,
          state.canvasWidth - x,
          y,
          state.fillShape
        );
      }
      previewCtx.clearRect(0, 0, state.canvasWidth, state.canvasHeight);
    }

    state.points = [];
    saveState();
  }

  function isFreehandTool(tool) {
    return ['brush', 'pencil', 'neon', 'rainbow', 'highlighter', 'eraser'].includes(tool);
  }

  // ==========================================
  // 8. Brush Context & Stroke Styling
  // ==========================================
  function configureBrushContext(ctx, overrideColor = null) {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = state.tool === 'pencil' ? 1.5 : state.size;

    if (state.tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
      ctx.fillStyle = 'rgba(0,0,0,1)';
      return;
    }

    ctx.globalCompositeOperation = 'source-over';

    if (state.tool === 'highlighter') {
      ctx.globalAlpha = 0.25;
      ctx.strokeStyle = overrideColor || state.color;
      ctx.fillStyle = overrideColor || state.color;
      ctx.lineCap = 'square';
      return;
    }

    ctx.globalAlpha = state.opacity;

    if (state.tool === 'neon') {
      ctx.strokeStyle = overrideColor || state.color;
      ctx.shadowBlur = state.size * 2;
      ctx.shadowColor = overrideColor || state.color;
    } else if (state.tool === 'rainbow') {
      state.rainbowHue = (state.rainbowHue + 2) % 360;
      const rainbowCol = `hsl(${state.rainbowHue}, 100%, 55%)`;
      ctx.strokeStyle = rainbowCol;
      ctx.shadowBlur = 0;
    } else {
      ctx.strokeStyle = overrideColor || state.color;
      ctx.shadowBlur = 0;
    }

    ctx.fillStyle = ctx.strokeStyle;
  }

  function drawSmoothStroke(ctx, pts) {
    if (pts.length < 2) return;

    ctx.save();
    configureBrushContext(ctx);

    ctx.beginPath();
    const len = pts.length;
    const p1 = pts[len - 2];
    const p2 = pts[len - 1];

    if (len === 2) {
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
    } else {
      const p0 = pts[len - 3];
      const mid1X = (p0.x + p1.x) / 2;
      const mid1Y = (p0.y + p1.y) / 2;
      const mid2X = (p1.x + p2.x) / 2;
      const mid2Y = (p1.y + p2.y) / 2;

      ctx.moveTo(mid1X, mid1Y);
      ctx.quadraticCurveTo(p1.x, p1.y, mid2X, mid2Y);
    }

    ctx.stroke();
    ctx.restore();
  }

  function drawSpray(ctx, x, y) {
    ctx.save();
    ctx.fillStyle = state.color;
    ctx.globalAlpha = state.opacity * 0.4;
    const density = Math.max(15, state.size * 2);
    const radius = state.size * 1.5;

    for (let i = 0; i < density; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = Math.random() * radius;
      const dotX = x + Math.cos(angle) * r;
      const dotY = y + Math.sin(angle) * r;
      ctx.fillRect(dotX, dotY, 1.5, 1.5);
    }
    ctx.restore();
  }

  // ==========================================
  // 9. Shape Engine
  // ==========================================
  function drawShape(ctx, shape, x1, y1, x2, y2, filled) {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = state.size;
    ctx.globalAlpha = state.opacity;
    ctx.strokeStyle = state.color;
    ctx.fillStyle = state.color;

    ctx.beginPath();

    switch (shape) {
      case 'line':
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        break;

      case 'arrow':
        drawArrow(ctx, x1, y1, x2, y2);
        break;

      case 'rectangle': {
        const x = Math.min(x1, x2);
        const y = Math.min(y1, y2);
        const w = Math.abs(x2 - x1);
        const h = Math.abs(y2 - y1);
        if (filled) ctx.fillRect(x, y, w, h);
        else ctx.strokeRect(x, y, w, h);
        break;
      }

      case 'circle': {
        const radiusX = Math.abs(x2 - x1) / 2;
        const radiusY = Math.abs(y2 - y1) / 2;
        const centerX = Math.min(x1, x2) + radiusX;
        const centerY = Math.min(y1, y2) + radiusY;
        ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
        if (filled) ctx.fill();
        else ctx.stroke();
        break;
      }

      case 'heart': {
        drawHeart(ctx, (x1 + x2) / 2, (y1 + y2) / 2, Math.abs(x2 - x1), Math.abs(y2 - y1), filled);
        break;
      }

      case 'star':
        drawStar(ctx, (x1 + x2) / 2, (y1 + y2) / 2, 5, Math.abs(x2 - x1) / 2, Math.abs(x2 - x1) / 4, filled);
        break;
    }

    ctx.restore();
  }

  function drawArrow(ctx, fromX, fromY, toX, toY) {
    const headLen = Math.max(16, state.size * 2);
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
  // 10. Stamp & Text Helpers
  // ==========================================
  function drawStamp(ctx, emoji, x, y, size) {
    ctx.save();
    ctx.font = `${size}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji, x, y);
    ctx.restore();
  }

  function commitText(text, fontSize) {
    if (!state.textPendingCoords || !text) return;
    const { x, y } = state.textPendingCoords;

    paintCtx.save();
    paintCtx.font = `600 ${fontSize}px 'Plus Jakarta Sans', sans-serif`;
    paintCtx.fillStyle = state.color;
    paintCtx.globalAlpha = state.opacity;
    paintCtx.fillText(text, x, y);

    if (state.symmetryMode) {
      paintCtx.fillText(text, state.canvasWidth - x, y);
    }
    paintCtx.restore();

    state.textPendingCoords = null;
    saveState();
    showToast('Text inserted on canvas');
  }

  // ==========================================
  // 11. Flood Fill
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
  // 12. Cursor Preview
  // ==========================================
  function drawCustomCursor(x, y) {
    cursorCtx.clearRect(0, 0, state.canvasWidth, state.canvasHeight);

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
  // 13. Sidebar Collapsing & Zen Mode
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
  // 14. UI State Updates
  // ==========================================
  function setTool(toolName) {
    state.tool = toolName;
    toolButtons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tool === toolName);
    });

    quickBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.action === toolName);
    });

    const isShape = ['rectangle', 'circle', 'star', 'heart'].includes(toolName);
    shapeConfig.classList.toggle('hidden', !isShape);
    stampConfig.classList.toggle('hidden', toolName !== 'stamp');

    showToast(`Tool: ${getToolLabel(toolName)}`);
  }

  function getToolLabel(t) {
    const labels = {
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
  }

  function setOpacity(val) {
    state.opacity = parseInt(val, 10) / 100;
    brushOpacitySlider.value = val;
    opacityBadge.textContent = `${val}%`;
    brushDotPreview.style.opacity = state.opacity;
  }

  function updateUI() {
    setColor(state.color);
    setBrushSize(state.size);
    setOpacity(state.opacity * 100);
  }

  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove('show'), 1800);
  }

  // ==========================================
  // 15. Event Listeners
  // ==========================================
  window.addEventListener('resize', resizeCanvases);

  viewport.addEventListener('mousedown', startDrawing);
  window.addEventListener('mousemove', draw);
  window.addEventListener('mouseup', stopDrawing);

  viewport.addEventListener('touchstart', startDrawing, { passive: false });
  window.addEventListener('touchmove', draw, { passive: false });
  window.addEventListener('touchend', stopDrawing, { passive: false });

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
  });

  // History Actions
  undoBtn.addEventListener('click', undo);
  redoBtn.addEventListener('click', redo);

  clearBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to clear the canvas?')) {
      fillCanvasBackground(state.canvasBg);
      saveState();
      showToast('Canvas Cleared');
    }
  });

  bgPreset.addEventListener('change', e => {
    state.canvasBg = e.target.value;
    fillCanvasBackground(state.canvasBg);
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
      if (act === 'brush') setTool('brush');
      else if (act === 'pencil') setTool('pencil');
      else if (act === 'neon') setTool('neon');
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
        const ratio = Math.min((state.canvasWidth * 0.8) / img.width, (state.canvasHeight * 0.8) / img.height, 1);
        const w = img.width * ratio;
        const h = img.height * ratio;
        const x = (state.canvasWidth - w) / 2;
        const y = (state.canvasHeight - h) / 2;

        paintCtx.drawImage(img, x, y, w, h);
        saveState();
        showToast('Image imported onto canvas');
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  }

  // Paste image from clipboard
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

  // Text Modal
  confirmTextBtn.addEventListener('click', () => {
    const text = canvasTextInput.value.trim();
    const size = parseInt(modalFontSize.value, 10);
    commitText(text, size);
    textInputModal.classList.add('hidden');
  });

  cancelTextBtn.addEventListener('click', () => {
    textInputModal.classList.add('hidden');
    state.textPendingCoords = null;
  });

  modalCloseBtn.addEventListener('click', () => {
    textInputModal.classList.add('hidden');
    state.textPendingCoords = null;
  });

  canvasTextInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') confirmTextBtn.click();
    else if (e.key === 'Escape') cancelTextBtn.click();
  });

  // Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

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

  // Initialize Fullscreen Canvas
  resizeCanvases();
  updateUI();
});
