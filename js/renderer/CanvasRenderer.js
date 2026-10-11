/**
 * The Craft — Canvas Renderer
 * High-performance multi-layer compositing engine supporting blend modes,
 * layer opacity, vector elements, offscreen raster buffers, and selection bounds.
 */
export class CanvasRenderer {
  constructor(canvasElements, documentModel) {
    this.paintCanvas = canvasElements.paintCanvas;
    this.previewCanvas = canvasElements.previewCanvas;
    this.gridCanvas = canvasElements.gridCanvas;
    this.cursorCanvas = canvasElements.cursorCanvas;

    this.paintCtx = this.paintCanvas.getContext('2d', { willReadFrequently: true });
    this.previewCtx = this.previewCanvas.getContext('2d');
    this.gridCtx = this.gridCanvas.getContext('2d');
    this.cursorCtx = this.cursorCanvas.getContext('2d');

    this.doc = documentModel;
    this.showGrid = false;
    this.symmetryMode = false;
    this.selectedElement = null;

    // Offscreen layer buffer to render elements of a single layer before compositing
    this.layerBuffer = document.createElement('canvas');
    this.layerCtx = this.layerBuffer.getContext('2d', { willReadFrequently: true });

    // Live real-time eraser offscreen buffers
    this.isLiveErasing = false;
    this.targetLiveLayer = null;
    this.liveBelowBuffer = null;
    this.liveBelowCtx = null;
    this.liveLayerBuffer = null;
    this.liveLayerCtx = null;
    this.liveAboveBuffer = null;
    this.liveAboveCtx = null;

    // IMMEDIATELY initialize all canvas resolutions to match the document
    if (this.doc.width && this.doc.height) {
      this.resize(this.doc.width, this.doc.height);
    }
  }

  resize(width, height) {
    [this.paintCanvas, this.previewCanvas, this.gridCanvas, this.cursorCanvas, this.layerBuffer].forEach(cv => {
      cv.width = width;
      cv.height = height;
    });
    [this.liveBelowBuffer, this.liveLayerBuffer, this.liveAboveBuffer].forEach(cv => {
      if (cv) {
        cv.width = width;
        cv.height = height;
      }
    });
    this.render();
  }

  render() {
    const width = this.doc.width;
    const height = this.doc.height;

    // 1. Render Background
    if (this.doc.backgroundColor === 'transparent') {
      this.paintCtx.clearRect(0, 0, width, height);
      this.paintCanvas.style.backgroundColor = 'transparent';
    } else {
      this.paintCtx.fillStyle = this.doc.backgroundColor;
      this.paintCtx.fillRect(0, 0, width, height);
      this.paintCanvas.style.backgroundColor = this.doc.backgroundColor;
    }

    // 2. Composite all visible layers from bottom to top
    this.doc.layers.forEach(layer => {
      if (!layer.visible) return;

      // Clear offscreen layer buffer
      this.layerCtx.clearRect(0, 0, width, height);

      // Render raster data if present first (so vector strokes and erasers can composite over it)
      if (layer.rasterCanvas) {
        this.layerCtx.drawImage(layer.rasterCanvas, 0, 0);
      }

      // Render vector elements on this layer buffer
      if (layer.elements && layer.elements.length > 0) {
        layer.elements.forEach(el => {
          this.renderElement(this.layerCtx, el);
        });
      }

      // Composite the layer onto the master paint canvas
      this.paintCtx.save();
      this.paintCtx.globalAlpha = layer.opacity !== undefined ? layer.opacity : 1.0;
      this.paintCtx.globalCompositeOperation = layer.blendMode || 'source-over';
      this.paintCtx.drawImage(this.layerBuffer, 0, 0);
      this.paintCtx.restore();
    });

    // 3. Render Grid Overlay
    this.drawGrid();

    // 4. Render Selection Overlay on Preview Canvas
    this.previewCtx.clearRect(0, 0, width, height);
    if (this.selectedElement) {
      this.drawSelectionBox(this.previewCtx, this.selectedElement);
    }
  }

  drawGrid() {
    this.gridCtx.clearRect(0, 0, this.doc.width, this.doc.height);
    if (!this.showGrid) return;

    this.gridCtx.save();
    this.gridCtx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    this.gridCtx.lineWidth = 1;
    const step = 32;

    for (let x = 0; x <= this.doc.width; x += step) {
      this.gridCtx.beginPath();
      this.gridCtx.moveTo(x, 0);
      this.gridCtx.lineTo(x, this.doc.height);
      this.gridCtx.stroke();
    }

    for (let y = 0; y <= this.doc.height; y += step) {
      this.gridCtx.beginPath();
      this.gridCtx.moveTo(0, y);
      this.gridCtx.lineTo(this.doc.width, y);
      this.gridCtx.stroke();
    }
    this.gridCtx.restore();
  }

  /**
   * Pre-renders layer partitions before an eraser drag begins.
   * Caches underlying layers (and canvas background), target layer, and overlying layers.
   */
  beginLiveEraser(targetLayerId) {
    this.isLiveErasing = true;
    const width = this.doc.width;
    const height = this.doc.height;

    if (!this.liveBelowBuffer) {
      this.liveBelowBuffer = document.createElement('canvas');
      this.liveBelowCtx = this.liveBelowBuffer.getContext('2d');
    }
    if (!this.liveLayerBuffer) {
      this.liveLayerBuffer = document.createElement('canvas');
      this.liveLayerCtx = this.liveLayerBuffer.getContext('2d');
    }
    if (!this.liveAboveBuffer) {
      this.liveAboveBuffer = document.createElement('canvas');
      this.liveAboveCtx = this.liveAboveBuffer.getContext('2d');
    }

    [this.liveBelowBuffer, this.liveLayerBuffer, this.liveAboveBuffer].forEach(b => {
      if (b.width !== width || b.height !== height) {
        b.width = width;
        b.height = height;
      }
    });

    this.liveBelowCtx.clearRect(0, 0, width, height);
    this.liveLayerCtx.clearRect(0, 0, width, height);
    this.liveAboveCtx.clearRect(0, 0, width, height);

    // 1. Draw Canvas Background into liveBelowBuffer
    if (this.doc.backgroundColor !== 'transparent') {
      this.liveBelowCtx.fillStyle = this.doc.backgroundColor;
      this.liveBelowCtx.fillRect(0, 0, width, height);
    }

    // 2. Partition layers into below, target active layer, and above
    let isBelow = true;
    this.targetLiveLayer = null;

    this.doc.layers.forEach(layer => {
      if (!layer.visible) return;

      if (layer.id === targetLayerId) {
        isBelow = false;
        this.targetLiveLayer = layer;
        // Pre-render all existing elements and raster data of target layer into liveLayerBuffer
        if (layer.rasterCanvas) {
          this.liveLayerCtx.drawImage(layer.rasterCanvas, 0, 0);
        }
        if (layer.elements && layer.elements.length > 0) {
          layer.elements.forEach(el => this.renderElement(this.liveLayerCtx, el));
        }
        return;
      }

      const destCtx = isBelow ? this.liveBelowCtx : this.liveAboveCtx;
      this.layerCtx.clearRect(0, 0, width, height);
      if (layer.rasterCanvas) {
        this.layerCtx.drawImage(layer.rasterCanvas, 0, 0);
      }
      if (layer.elements && layer.elements.length > 0) {
        layer.elements.forEach(el => this.renderElement(this.layerCtx, el));
      }

      destCtx.save();
      destCtx.globalAlpha = layer.opacity !== undefined ? layer.opacity : 1.0;
      destCtx.globalCompositeOperation = layer.blendMode || 'source-over';
      destCtx.drawImage(this.layerBuffer, 0, 0);
      destCtx.restore();
    });
  }

  /**
   * Renders the in-progress eraser stroke on the active layer in real-time,
   * cutting out pixels instantaneously at 60-120 FPS.
   */
  renderLiveEraser(tempStroke, tempMirror = null) {
    if (!this.isLiveErasing || !this.targetLiveLayer) return;
    const width = this.doc.width;
    const height = this.doc.height;

    // 1. Copy the pristine layer snapshot into the layer working buffer
    this.layerCtx.clearRect(0, 0, width, height);
    this.layerCtx.drawImage(this.liveLayerBuffer, 0, 0);

    // 2. Apply destination-out eraser stroke(s) live onto the working layer buffer
    if (tempStroke) {
      this.renderElement(this.layerCtx, tempStroke);
    }
    if (tempMirror) {
      this.renderElement(this.layerCtx, tempMirror);
    }

    // 3. Composite onto master paintCanvas
    this.paintCtx.clearRect(0, 0, width, height);
    this.paintCtx.drawImage(this.liveBelowBuffer, 0, 0);

    const layer = this.targetLiveLayer;
    this.paintCtx.save();
    this.paintCtx.globalAlpha = layer.opacity !== undefined ? layer.opacity : 1.0;
    this.paintCtx.globalCompositeOperation = layer.blendMode || 'source-over';
    this.paintCtx.drawImage(this.layerBuffer, 0, 0);
    this.paintCtx.restore();

    this.paintCtx.drawImage(this.liveAboveBuffer, 0, 0);

    // 4. Grid overlay
    this.drawGrid();
  }

  /**
   * Ends the live eraser session.
   */
  endLiveEraser() {
    this.isLiveErasing = false;
    this.targetLiveLayer = null;
  }

  /**
   * Draws a circular outline indicating the exact eraser or brush tip size.
   */
  drawCursorRing(x, y, radius) {
    if (!this.cursorCtx) return;
    this.cursorCtx.clearRect(0, 0, this.doc.width, this.doc.height);
    if (x === null || y === null || radius <= 0) return;

    this.cursorCtx.save();
    this.cursorCtx.beginPath();
    this.cursorCtx.arc(x, y, Math.max(1, radius), 0, Math.PI * 2);
    this.cursorCtx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    this.cursorCtx.lineWidth = 1.5;
    this.cursorCtx.setLineDash([3, 3]);
    this.cursorCtx.stroke();

    this.cursorCtx.beginPath();
    this.cursorCtx.arc(x, y, Math.max(1, radius), 0, Math.PI * 2);
    this.cursorCtx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
    this.cursorCtx.lineWidth = 1;
    this.cursorCtx.setLineDash([]);
    this.cursorCtx.stroke();
    this.cursorCtx.restore();
  }

  /**
   * Clears the cursor outline.
   */
  clearCursorRing() {
    if (this.cursorCtx) {
      this.cursorCtx.clearRect(0, 0, this.doc.width, this.doc.height);
    }
  }

  /**
   * Detects if element color matches or contrasts poorly against the canvas background
   * (e.g. pure white strokes drawn on a pure white canvas)
   */
  isContrastConflict(color) {
    if (!color || typeof color !== 'string') return false;
    const bg = this.doc?.backgroundColor;
    if (!bg || bg === 'transparent') return false;

    let c1 = color.trim().toLowerCase().replace('#', '');
    let c2 = bg.trim().toLowerCase().replace('#', '');
    if (c1.length === 3) c1 = c1.split('').map(x => x + x).join('');
    if (c2.length === 3) c2 = c2.split('').map(x => x + x).join('');
    if (c1.length !== 6 || c2.length !== 6) return false;

    const lum = (hex) => {
      const r = parseInt(hex.substr(0, 2), 16) / 255;
      const g = parseInt(hex.substr(2, 2), 16) / 255;
      const b = parseInt(hex.substr(4, 2), 16) / 255;
      const f = v => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      return f(r) * 0.2126 + f(g) * 0.7152 + f(b) * 0.0722;
    };

    const l1 = lum(c1);
    const l2 = lum(c2);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    const ratio = (lighter + 0.05) / (darker + 0.05);

    // If contrast ratio is under 1.45 (e.g. #ffffff on #ffffff where ratio is 1.0)
    return ratio < 1.45;
  }

  getBgLuminance() {
    const bg = this.doc?.backgroundColor;
    if (!bg || bg === 'transparent') return 1.0;
    let c = bg.trim().toLowerCase().replace('#', '');
    if (c.length === 3) c = c.split('').map(x => x + x).join('');
    if (c.length !== 6) return 1.0;
    const r = parseInt(c.substr(0, 2), 16) / 255;
    const g = parseInt(c.substr(2, 2), 16) / 255;
    const b = parseInt(c.substr(4, 2), 16) / 255;
    const f = v => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    return f(r) * 0.2126 + f(g) * 0.7152 + f(b) * 0.0722;
  }

  renderElement(ctx, el) {
    ctx.save();
    ctx.globalAlpha = el.opacity ?? 1.0;

    switch (el.type) {
      case 'stroke':
        this.renderStroke(ctx, el);
        break;
      case 'spray':
        this.renderSpray(ctx, el);
        break;
      case 'shape':
        this.renderShape(ctx, el);
        break;
      case 'text':
        this.renderText(ctx, el);
        break;
      case 'stamp':
        this.renderStamp(ctx, el);
        break;
      case 'image':
        this.renderImage(ctx, el);
        break;
    }

    ctx.restore();
  }

  drawPath(ctx, pts, size) {
    if (!pts || pts.length === 0) return;
    if (pts.length === 1) {
      ctx.beginPath();
      ctx.arc(pts[0].x, pts[0].y, size / 2, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    if (pts.length === 2) {
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      ctx.lineTo(pts[1].x, pts[1].y);
      ctx.stroke();
      return;
    }
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length - 1; i++) {
      const p0 = pts[i];
      const p1 = pts[i + 1];
      const midX = (p0.x + p1.x) / 2;
      const midY = (p0.y + p1.y) / 2;
      ctx.quadraticCurveTo(p0.x, p0.y, midX, midY);
    }
    const last = pts[pts.length - 1];
    ctx.lineTo(last.x, last.y);
    ctx.stroke();
  }

  renderStroke(ctx, el) {
    if (!el.points || el.points.length === 0) return;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const baseSize = el.tool === 'pencil' ? 1.5 : (el.size || 8);
    ctx.lineWidth = baseSize;

    const conflict = this.isContrastConflict(el.color);

    if (el.tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
      ctx.fillStyle = 'rgba(0,0,0,1)';
    } else if (el.tool === 'highlighter') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 0.25;
      ctx.strokeStyle = el.color;
      ctx.fillStyle = el.color;
      ctx.lineCap = 'square';
      if (conflict) {
        ctx.shadowColor = 'rgba(0, 0, 0, 0.40)';
        ctx.shadowBlur = 3;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 1;
      }
    } else if (el.tool === 'neon') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = el.color;
      ctx.fillStyle = el.color;
      ctx.shadowBlur = baseSize * 2;
      ctx.shadowColor = conflict ? 'rgba(99, 102, 241, 0.85)' : el.color;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = el.color;
      ctx.fillStyle = el.color;

      // PASS 1 (Contrast outline): If white on white or matching, render a distinct crisp border underneath
      if (conflict) {
        const isLightBg = this.getBgLuminance() > 0.5;
        const outlineColor = isLightBg ? 'rgba(15, 23, 42, 0.65)' : 'rgba(255, 255, 255, 0.70)';
        const outlineWidth = baseSize + Math.max(4, Math.round(baseSize * 0.3));

        ctx.save();
        ctx.lineWidth = outlineWidth;
        ctx.strokeStyle = outlineColor;
        ctx.fillStyle = outlineColor;
        this.drawPath(ctx, el.points, outlineWidth);
        ctx.restore();

        // Also add soft ambient shadow for 3D embossed look
        ctx.shadowColor = isLightBg ? 'rgba(0, 0, 0, 0.45)' : 'rgba(255, 255, 255, 0.50)';
        ctx.shadowBlur = Math.max(3, baseSize * 0.4);
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 1;
      } else {
        ctx.shadowBlur = 0;
      }
    }

    // PASS 2: Render the actual stroke in genuine element color
    this.drawPath(ctx, el.points, baseSize);

    ctx.restore();
  }

  renderSpray(ctx, el) {
    if (!el.drops || el.drops.length === 0) return;
    ctx.fillStyle = el.color;
    if (this.isContrastConflict(el.color)) {
      const isLightBg = this.getBgLuminance() > 0.5;
      ctx.shadowColor = isLightBg ? 'rgba(0, 0, 0, 0.45)' : 'rgba(255, 255, 255, 0.55)';
      ctx.shadowBlur = 2;
      ctx.shadowOffsetY = 1;
    }
    el.drops.forEach(d => {
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.radius || 1, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  renderShape(ctx, el) {
    ctx.lineWidth = el.size || 4;
    ctx.strokeStyle = el.color;
    ctx.fillStyle = el.color;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (this.isContrastConflict(el.color)) {
      const isLightBg = this.getBgLuminance() > 0.5;
      ctx.shadowColor = isLightBg ? 'rgba(0, 0, 0, 0.45)' : 'rgba(255, 255, 255, 0.55)';
      ctx.shadowBlur = Math.max(3, (el.size || 4) * 0.45);
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 1;
    } else {
      ctx.shadowBlur = 0;
    }

    const { x, y, width, height, shapeType, fill } = el;

    ctx.beginPath();
    switch (shapeType) {
      case 'line':
        ctx.moveTo(x, y);
        ctx.lineTo(x + width, y + height);
        ctx.stroke();
        break;

      case 'arrow':
        this.drawArrow(ctx, x, y, x + width, y + height, el.size || 4);
        break;

      case 'rectangle':
        if (fill) {
          ctx.fillRect(x, y, width, height);
        } else {
          ctx.strokeRect(x, y, width, height);
        }
        break;

      case 'circle': {
        const rx = Math.abs(width) / 2;
        const ry = Math.abs(height) / 2;
        const cx = x + width / 2;
        const cy = y + height / 2;
        ctx.ellipse(cx, cy, Math.max(1, rx), Math.max(1, ry), 0, 0, Math.PI * 2);
        if (fill) ctx.fill(); else ctx.stroke();
        break;
      }

      case 'star':
        this.drawStar(ctx, x + width / 2, y + height / 2, Math.max(Math.abs(width), Math.abs(height)) / 2, fill);
        break;

      case 'heart':
        this.drawHeart(ctx, x, y, width, height, fill);
        break;
    }
  }

  drawArrow(ctx, fromX, fromY, toX, toY, headLength = 12) {
    const angle = Math.atan2(toY - fromY, toX - fromX);
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(toX, toY);
    ctx.lineTo(toX - headLength * Math.cos(angle - Math.PI / 6), toY - headLength * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(toX - headLength * Math.cos(angle + Math.PI / 6), toY - headLength * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
  }

  drawStar(ctx, cx, cy, outerRadius, fill) {
    const innerRadius = outerRadius / 2.2;
    const spikes = 5;
    let rot = Math.PI / 2 * 3;
    const step = Math.PI / spikes;

    ctx.beginPath();
    ctx.moveTo(cx, cy - outerRadius);
    for (let i = 0; i < spikes; i++) {
      let x = cx + Math.cos(rot) * outerRadius;
      let y = cy + Math.sin(rot) * outerRadius;
      ctx.lineTo(x, y);
      rot += step;

      x = cx + Math.cos(rot) * innerRadius;
      y = cy + Math.sin(rot) * innerRadius;
      ctx.lineTo(x, y);
      rot += step;
    }
    ctx.lineTo(cx, cy - outerRadius);
    ctx.closePath();
    if (fill) ctx.fill(); else ctx.stroke();
  }

  drawHeart(ctx, x, y, w, h, fill) {
    const topCurveHeight = h * 0.3;
    ctx.beginPath();
    ctx.moveTo(x + w / 2, y + topCurveHeight);
    ctx.bezierCurveTo(x + w / 2, y, x, y, x, y + topCurveHeight);
    ctx.bezierCurveTo(x, y + (h + topCurveHeight) / 2, x + w / 2, y + (h + topCurveHeight) / 2, x + w / 2, y + h);
    ctx.bezierCurveTo(x + w / 2, y + (h + topCurveHeight) / 2, x + w, y + (h + topCurveHeight) / 2, x + w, y + topCurveHeight);
    ctx.bezierCurveTo(x + w, y, x + w / 2, y, x + w / 2, y + topCurveHeight);
    ctx.closePath();
    if (fill) ctx.fill(); else ctx.stroke();
  }

  renderText(ctx, el) {
    ctx.font = `${el.fontWeight || '600'} ${el.fontSize || 32}px 'Plus Jakarta Sans', system-ui, sans-serif`;
    ctx.fillStyle = el.color;
    ctx.textBaseline = 'top';

    if (this.isContrastConflict(el.color)) {
      const isLightBg = this.getBgLuminance() > 0.5;
      ctx.shadowColor = isLightBg ? 'rgba(0, 0, 0, 0.45)' : 'rgba(255, 255, 255, 0.55)';
      ctx.shadowBlur = 3;
      ctx.shadowOffsetY = 1;
    }

    const lines = (el.text || '').split('\n');
    const lineHeight = (el.fontSize || 32) * 1.25;
    lines.forEach((line, index) => {
      ctx.fillText(line, el.x, el.y + index * lineHeight);
    });
  }

  renderStamp(ctx, el) {
    ctx.font = `${el.size || 40}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(el.emoji || '⭐', el.x, el.y);
  }

  renderImage(ctx, el) {
    if (el.imgElement && el.imgElement.complete) {
      ctx.drawImage(el.imgElement, el.x, el.y, el.width, el.height);
    } else if (el.src) {
      const img = new Image();
      img.onload = () => {
        el.imgElement = img;
        this.render();
      };
      img.src = el.src;
    }
  }

  drawSelectionBox(ctx, el) {
    const b = this.getElementBounds(el);
    if (!b) return;

    ctx.save();
    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(b.x - 4, b.y - 4, b.width + 8, b.height + 8);

    // Draw 4 resize handles
    ctx.setLineDash([]);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 2;

    const handles = [
      { x: b.x - 4, y: b.y - 4 },
      { x: b.x + b.width + 4, y: b.y - 4 },
      { x: b.x + b.width + 4, y: b.y + b.height + 4 },
      { x: b.x - 4, y: b.y + b.height + 4 }
    ];

    handles.forEach(h => {
      ctx.beginPath();
      ctx.arc(h.x, h.y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });
    ctx.restore();
  }

  getElementBounds(el) {
    if (!el) return null;
    if (el.type === 'stroke') {
      if (!el.points || el.points.length === 0) return null;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      el.points.forEach(p => {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
      });
      const pad = (el.size || 8) / 2;
      return { x: minX - pad, y: minY - pad, width: (maxX - minX) + pad * 2, height: (maxY - minY) + pad * 2 };
    } else if (el.type === 'shape' || el.type === 'image') {
      const x = Math.min(el.x, el.x + el.width);
      const y = Math.min(el.y, el.y + el.height);
      const width = Math.abs(el.width);
      const height = Math.abs(el.height);
      return { x, y, width, height };
    } else if (el.type === 'text') {
      const fontSize = el.fontSize || 32;
      const lines = (el.text || '').split('\n');
      const height = lines.length * fontSize * 1.25;
      const width = Math.max(...lines.map(l => l.length)) * fontSize * 0.6;
      return { x: el.x, y: el.y, width: Math.max(40, width), height };
    } else if (el.type === 'stamp') {
      const s = el.size || 40;
      return { x: el.x - s / 2, y: el.y - s / 2, width: s, height: s };
    }
    return null;
  }

  getLayerThumbnail(layer, thumbWidth = 56, thumbHeight = 40) {
    const thumbCanvas = document.createElement('canvas');
    thumbCanvas.width = thumbWidth;
    thumbCanvas.height = thumbHeight;
    const thumbCtx = thumbCanvas.getContext('2d');

    // Checkerboard for transparency
    thumbCtx.fillStyle = '#1e2235';
    thumbCtx.fillRect(0, 0, thumbWidth, thumbHeight);

    const scaleX = thumbWidth / Math.max(1, this.doc.width);
    const scaleY = thumbHeight / Math.max(1, this.doc.height);
    const scale = Math.min(scaleX, scaleY);

    thumbCtx.save();
    thumbCtx.scale(scale, scale);

    if (layer.elements) {
      layer.elements.forEach(el => this.renderElement(thumbCtx, el));
    }
    if (layer.rasterCanvas) {
      thumbCtx.drawImage(layer.rasterCanvas, 0, 0);
    }
    thumbCtx.restore();

    return thumbCanvas.toDataURL('image/png');
  }

  exportCompositeBlob(format = 'image/png', quality = 0.95, transparentBg = false) {
    const expCanvas = document.createElement('canvas');
    expCanvas.width = this.doc.width;
    expCanvas.height = this.doc.height;
    const expCtx = expCanvas.getContext('2d');

    // Background
    if (!transparentBg && this.doc.backgroundColor !== 'transparent') {
      expCtx.fillStyle = this.doc.backgroundColor;
      expCtx.fillRect(0, 0, expCanvas.width, expCanvas.height);
    } else if (format === 'image/jpeg') {
      // JPEG requires solid background
      expCtx.fillStyle = '#ffffff';
      expCtx.fillRect(0, 0, expCanvas.width, expCanvas.height);
    }

    // Composite all visible layers
    const layerBuffer = document.createElement('canvas');
    layerBuffer.width = this.doc.width;
    layerBuffer.height = this.doc.height;
    const lbCtx = layerBuffer.getContext('2d');

    this.doc.layers.forEach(layer => {
      if (!layer.visible) return;

      lbCtx.clearRect(0, 0, this.doc.width, this.doc.height);

      if (layer.rasterCanvas) {
        lbCtx.drawImage(layer.rasterCanvas, 0, 0);
      }
      if (layer.elements && layer.elements.length > 0) {
        layer.elements.forEach(el => this.renderElement(lbCtx, el));
      }

      expCtx.save();
      expCtx.globalAlpha = layer.opacity !== undefined ? layer.opacity : 1.0;
      expCtx.globalCompositeOperation = layer.blendMode || 'source-over';
      expCtx.drawImage(layerBuffer, 0, 0);
      expCtx.restore();
    });

    return new Promise(resolve => {
      expCanvas.toBlob(blob => resolve(blob), format, quality);
    });
  }
}
