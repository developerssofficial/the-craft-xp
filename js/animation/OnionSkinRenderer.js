/**
 * The Craft — Onion Skin Renderer
 * Renders translucent ghost previews of neighboring previous/next frames on a dedicated canvas layer.
 * Overlays are strictly non-destructive and never appear in exported animations.
 */
export class OnionSkinRenderer {
  constructor(canvas, project, renderer = null) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.project = project;
    this.renderer = renderer;

    // Configurable Onion Skin Settings
    this.enabled = true;
    this.prevFramesCount = 2; // 0 to 5
    this.nextFramesCount = 1; // 0 to 5
    this.baseOpacity = 0.35;   // 0.05 to 0.8
    this.tintMode = 'original';  // 'original' (natural colors at low opacity), 'color' (past red/future cyan), or 'grayscale'

    // Solid tint colors for source-in blending (prevents double opacity multiplication)
    this.prevTint = '#ef4444'; // Red/warm
    this.nextTint = '#06b6d4'; // Cyan/cool

    // Offscreen render buffers for compositing
    this.tempFrameCanvas = document.createElement('canvas');
    this.tempFrameCtx = this.tempFrameCanvas.getContext('2d');

    this.tintCanvas = document.createElement('canvas');
    this.tintCtx = this.tintCanvas.getContext('2d');
  }

  resize(width, height) {
    this.canvas.width = width;
    this.canvas.height = height;
    this.tempFrameCanvas.width = width;
    this.tempFrameCanvas.height = height;
    this.tintCanvas.width = width;
    this.tintCanvas.height = height;
  }

  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  render(currentFrameIndex, isPlaying = false) {
    this.clear();
    if (!this.enabled || isPlaying) return;

    const frames = this.project.frames;
    const width = this.canvas.width;
    const height = this.canvas.height;
    if (frames.length <= 1) return;

    // 1. Render Previous Frames (Past)
    if (this.prevFramesCount > 0) {
      for (let offset = this.prevFramesCount; offset >= 1; offset--) {
        const frameIdx = currentFrameIndex - offset;
        if (frameIdx < 0) continue;

        const frame = frames[frameIdx];
        if (!frame) continue;

        // Falloff alpha: earlier frames are more faded
        const distanceFactor = Math.pow(0.65, offset - 1);
        const alpha = Math.max(0.06, this.baseOpacity * distanceFactor);

        this.renderGhostFrame(frame, alpha, 'prev');
      }
    }

    // 2. Render Next Frames (Future)
    if (this.nextFramesCount > 0) {
      for (let offset = this.nextFramesCount; offset >= 1; offset--) {
        const frameIdx = currentFrameIndex + offset;
        if (frameIdx >= frames.length) continue;

        const frame = frames[frameIdx];
        if (!frame) continue;

        const distanceFactor = Math.pow(0.65, offset - 1);
        const alpha = Math.max(0.06, this.baseOpacity * distanceFactor);

        this.renderGhostFrame(frame, alpha, 'next');
      }
    }
  }

  renderGhostFrame(frame, alpha, direction) {
    const width = this.canvas.width;
    const height = this.canvas.height;

    // Composite frame's visible layers into temp canvas
    this.tempFrameCtx.clearRect(0, 0, width, height);

    frame.layers.forEach(layer => {
      if (!layer.visible) return;

      this.tempFrameCtx.save();
      this.tempFrameCtx.globalAlpha = layer.opacity !== undefined ? layer.opacity : 1.0;
      this.tempFrameCtx.globalCompositeOperation = layer.blendMode || 'source-over';

      if (layer.rasterCanvas) {
        this.tempFrameCtx.drawImage(layer.rasterCanvas, 0, 0);
      }
      if (layer.elements && layer.elements.length > 0) {
        layer.elements.forEach(el => this.renderElement(this.tempFrameCtx, el));
      }
      this.tempFrameCtx.restore();
    });

    // Apply tint if enabled
    if (this.tintMode === 'color') {
      this.tintCtx.clearRect(0, 0, width, height);
      this.tintCtx.drawImage(this.tempFrameCanvas, 0, 0);

      // Multiply with tint color
      this.tintCtx.save();
      this.tintCtx.globalCompositeOperation = 'source-in';
      this.tintCtx.fillStyle = direction === 'prev' ? this.prevTint : this.nextTint;
      this.tintCtx.fillRect(0, 0, width, height);
      this.tintCtx.restore();

      // Blend onto onion canvas
      this.ctx.save();
      this.ctx.globalAlpha = alpha;
      this.ctx.drawImage(this.tintCanvas, 0, 0);
      this.ctx.restore();
    } else if (this.tintMode === 'grayscale') {
      this.ctx.save();
      this.ctx.globalAlpha = alpha;
      this.ctx.filter = 'grayscale(100%)';
      this.ctx.drawImage(this.tempFrameCanvas, 0, 0);
      this.ctx.filter = 'none';
      this.ctx.restore();
    } else {
      // Natural original colors with translucency
      this.ctx.save();
      this.ctx.globalAlpha = alpha;
      this.ctx.drawImage(this.tempFrameCanvas, 0, 0);
      this.ctx.restore();
    }
  }

  renderElement(ctx, el) {
    if (this.renderer && typeof this.renderer.renderElement === 'function') {
      this.renderer.renderElement(ctx, el);
      return;
    }

    ctx.save();
    ctx.globalAlpha = el.opacity ?? 1.0;

    switch (el.type) {
      case 'stroke':
        this.renderStroke(ctx, el);
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
    }
    ctx.restore();
  }

  renderStroke(ctx, el) {
    if (!el.points || el.points.length === 0) return;
    const pts = el.points;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = el.color || '#6366f1';
    ctx.lineWidth = el.size || 6;

    if (pts.length === 1) {
      ctx.beginPath();
      ctx.arc(pts[0].x, pts[0].y, (el.size || 6) / 2, 0, Math.PI * 2);
      ctx.fillStyle = el.color || '#6366f1';
      ctx.fill();
      ctx.restore();
      return;
    }

    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x, pts[i].y);
    }
    ctx.stroke();
    ctx.restore();
  }

  renderShape(ctx, el) {
    ctx.save();
    ctx.strokeStyle = el.color || '#6366f1';
    ctx.lineWidth = el.size || 4;
    ctx.fillStyle = el.fillColor || el.color;

    const x = el.x !== undefined ? el.x : (el.startX ?? 0);
    const y = el.y !== undefined ? el.y : (el.startY ?? 0);
    const w = el.width !== undefined ? el.width : ((el.endX ?? x) - x);
    const h = el.height !== undefined ? el.height : ((el.endY ?? y) - y);
    const shape = el.shapeType || el.shape || 'rectangle';
    const fill = el.fill !== undefined ? el.fill : (el.filled ?? false);

    ctx.beginPath();
    if (shape === 'rectangle') {
      if (fill) ctx.fillRect(x, y, w, h);
      ctx.strokeRect(x, y, w, h);
    } else if (shape === 'circle') {
      const rx = Math.abs(w / 2);
      const ry = Math.abs(h / 2);
      const cx = x + w / 2;
      const cy = y + h / 2;
      ctx.ellipse(cx, cy, Math.max(1, rx), Math.max(1, ry), 0, 0, Math.PI * 2);
      if (fill) ctx.fill();
      ctx.stroke();
    } else if (shape === 'line') {
      ctx.moveTo(x, y);
      ctx.lineTo(x + w, y + h);
      ctx.stroke();
    }
    ctx.restore();
  }

  renderText(ctx, el) {
    ctx.save();
    ctx.fillStyle = el.color || '#ffffff';
    ctx.font = `${el.fontSize || 32}px 'Plus Jakarta Sans', sans-serif`;
    ctx.fillText(el.text, el.x, el.y);
    ctx.restore();
  }

  renderStamp(ctx, el) {
    ctx.save();
    ctx.font = `${el.size || 48}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(el.stamp || '⭐', el.x, el.y);
    ctx.restore();
  }
}
