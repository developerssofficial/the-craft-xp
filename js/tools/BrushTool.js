/**
 * The Craft — Brush Tool
 * Handles smooth brush, pencil, neon glow, rainbow stream, highlighter, and eraser.
 * Full stylus pressure support and optional symmetry/mirror drawing.
 */
import { BaseTool } from './BaseTool.js';
import { DrawCommand } from '../core/commands/DrawCommand.js';
import { brushEngine } from '../brushes/ProceduralBrushEngine.js';

export class BrushTool extends BaseTool {
  constructor(mode = 'brush') {
    super(mode, mode.charAt(0).toUpperCase() + mode.slice(1), 'crosshair');
    this.mode = mode; // 'brush', 'pencil', 'neon', 'rainbow', 'highlighter', 'eraser'
    this.isDrawing = false;
    this.points = [];
    this.symPoints = [];
    this.rainbowHue = 0;
    this.currentRenderer = null;
    this.activeBrushSettings = null;
    this.stabilizedX = 0;
    this.stabilizedY = 0;
    this.lastTime = 0;
    this.lastX = 0;
    this.lastY = 0;
    this.currentVelocity = 0;
    this.renderedIndex = 0;
  }

  onPointerDown(e, ctx) {
    if (ctx.activeLayer.locked || !ctx.activeLayer.visible) {
      return;
    }

    this.isDrawing = true;
    this.currentRenderer = ctx.renderer;
    if (ctx.renderer && ctx.renderer.clearCursorRing) {
      ctx.renderer.clearCursorRing();
    }

    this.lastTime = performance.now();
    this.lastX = ctx.x;
    this.lastY = ctx.y;
    this.currentVelocity = 0;
    this.stabilizedX = ctx.x;
    this.stabilizedY = ctx.y;

    const brushPreset = this.mode === 'brush' ? (ctx.toolState.activeBrushPreset || 'basic_medium_round') : null;
    this.activeBrushSettings = brushPreset ? brushEngine.getBrushSettings(brushPreset) : null;

    let initPressure = ctx.pressure !== undefined && ctx.pressure > 0 ? ctx.pressure : 0.5;
    if (this.activeBrushSettings?.sizeControl === 'OFF') {
      initPressure = 1.0;
    }

    const p = { x: ctx.x, y: ctx.y, pressure: initPressure };
    this.points = [p];

    if (ctx.isSymmetry) {
      const midX = ctx.doc.width / 2;
      this.symPoints = [{ x: midX * 2 - ctx.x, y: ctx.y, pressure: initPressure }];
    } else {
      this.symPoints = [];
    }

    // Begin live real-time eraser composite session
    if (this.mode === 'eraser' && ctx.renderer && ctx.renderer.beginLiveEraser) {
      ctx.renderer.beginLiveEraser(ctx.activeLayer.id);
    }

    // Clear preview canvas and render initial dot
    ctx.renderer.previewCtx.clearRect(0, 0, ctx.doc.width, ctx.doc.height);
    this.renderedIndex = 0;
    this.renderPreview(ctx.renderer.previewCtx, ctx, 0);
    this.renderedIndex = 1;
  }

  onPointerMove(e, ctx) {
    this.currentRenderer = ctx.renderer;

    if (!this.isDrawing) {
      // Show cursor ring when hovering with eraser or brush
      if (this.mode === 'eraser' && ctx.renderer && ctx.renderer.drawCursorRing) {
        ctx.renderer.drawCursorRing(ctx.x, ctx.y, (ctx.toolState.size || 8) / 2);
      }
      return;
    }

    const now = performance.now();
    const dt = Math.max(1, now - (this.lastTime || now));
    const dist = Math.hypot(ctx.x - this.lastX, ctx.y - this.lastY);
    const speed = dist / dt; // px per ms
    this.currentVelocity = this.currentVelocity * 0.7 + speed * 0.3;
    this.lastTime = now;
    this.lastX = ctx.x;
    this.lastY = ctx.y;

    let targetX = ctx.x;
    let targetY = ctx.y;
    const settings = this.activeBrushSettings;

    // Apply digital stabilizer smoothing
    if (settings && settings.stabilizer > 0) {
      const weight = Math.max(0.08, 1 - Math.min(0.9, settings.stabilizer * 0.9));
      this.stabilizedX = this.stabilizedX * (1 - weight) + ctx.x * weight;
      this.stabilizedY = this.stabilizedY * (1 - weight) + ctx.y * weight;
      targetX = this.stabilizedX;
      targetY = this.stabilizedY;
    }

    let effPressure = ctx.pressure !== undefined && ctx.pressure > 0 ? ctx.pressure : 0.5;
    if (settings) {
      if (settings.sizeControl === 'OFF') {
        effPressure = 1.0;
      } else if (settings.sizeControl === 'Velocity') {
        const speedNorm = Math.min(1.0, this.currentVelocity / 3.0);
        effPressure = Math.max(0.2, 1.0 - speedNorm * 0.7);
      }
    }

    const p = { x: targetX, y: targetY, pressure: effPressure };
    this.points.push(p);

    if (ctx.isSymmetry) {
      const midX = ctx.doc.width / 2;
      this.symPoints.push({ x: midX * 2 - targetX, y: targetY, pressure: effPressure });
    }

    if (this.mode === 'rainbow') {
      this.rainbowHue = (this.rainbowHue + 3) % 360;
    }

    const fromIdx = Math.max(0, this.renderedIndex - 1);
    this.renderPreview(ctx.renderer.previewCtx, ctx, fromIdx);
    this.renderedIndex = this.points.length;
  }

  onPointerUp(e, ctx) {
    if (!this.isDrawing) return;
    this.isDrawing = false;

    // End live real-time eraser composite session
    if (this.mode === 'eraser' && ctx.renderer && ctx.renderer.endLiveEraser) {
      ctx.renderer.endLiveEraser();
    }

    // Allow single click / tap dots
    if (this.points.length === 1) {
      this.points.push({ ...this.points[0], x: this.points[0].x + 0.1 });
      if (ctx.isSymmetry && this.symPoints.length === 1) {
        this.symPoints.push({ ...this.symPoints[0], x: this.symPoints[0].x + 0.1 });
      }
    }

    if (this.points.length >= 2) {
      const elementsToCommit = [];
      const color = this.mode === 'rainbow' ? `hsl(${this.rainbowHue}, 100%, 55%)` : ctx.toolState.color;
      const usePressure = ctx.toolState.pressureDynamics !== false;
      const brushPreset = this.mode === 'brush' ? (ctx.toolState.activeBrushPreset || 'basic_medium_round') : null;
      const settings = this.activeBrushSettings ? { ...this.activeBrushSettings } : null;

      const mainStroke = {
        type: 'stroke',
        tool: this.mode,
        brushPreset,
        brushSettings: settings,
        color: color,
        size: ctx.toolState.size,
        opacity: ctx.toolState.opacity,
        usePressure,
        points: [...this.points]
      };
      elementsToCommit.push(mainStroke);

      if (ctx.isSymmetry && this.symPoints.length >= 2) {
        const mirrorStroke = {
          type: 'stroke',
          tool: this.mode,
          brushPreset,
          brushSettings: settings,
          color: color,
          size: ctx.toolState.size,
          opacity: ctx.toolState.opacity,
          usePressure,
          points: [...this.symPoints]
        };
        elementsToCommit.push(mirrorStroke);
      }

      ctx.commandManager.execute(new DrawCommand(ctx.doc, ctx.activeLayer.id, elementsToCommit));
    } else {
      ctx.renderer.render();
    }

    this.points = [];
    this.symPoints = [];
    this.renderedIndex = 0;
    ctx.renderer.previewCtx.clearRect(0, 0, ctx.doc.width, ctx.doc.height);

    if (this.mode === 'eraser' && ctx.renderer && ctx.renderer.drawCursorRing) {
      ctx.renderer.drawCursorRing(ctx.x, ctx.y, (ctx.toolState.size || 8) / 2);
    }
  }

  renderPreview(previewCtx, ctx, fromIndex = 0) {
    if (!this.isDrawing || this.points.length === 0) return;

    if (fromIndex === 0) {
      previewCtx.clearRect(0, 0, ctx.doc.width, ctx.doc.height);
    }

    const color = this.mode === 'rainbow' ? `hsl(${this.rainbowHue}, 100%, 55%)` : ctx.toolState.color;
    const usePressure = ctx.toolState.pressureDynamics !== false;
    const brushPreset = this.mode === 'brush' ? (ctx.toolState.activeBrushPreset || 'basic_medium_round') : null;
    const settings = this.activeBrushSettings ? { ...this.activeBrushSettings } : null;

    const tempStroke = {
      type: 'stroke',
      tool: this.mode,
      brushPreset,
      brushSettings: settings,
      color: color,
      size: ctx.toolState.size,
      opacity: ctx.toolState.opacity,
      usePressure,
      points: this.points
    };

    if (this.mode === 'eraser') {
      const tempMirror = (ctx.isSymmetry && this.symPoints.length >= 1) ? {
        type: 'stroke',
        tool: this.mode,
        brushPreset,
        brushSettings: settings,
        color: color,
        size: ctx.toolState.size,
        opacity: ctx.toolState.opacity,
        usePressure,
        points: this.symPoints
      } : null;

      // Real-time canvas erasure!
      if (ctx.renderer && ctx.renderer.renderLiveEraser) {
        ctx.renderer.renderLiveEraser(tempStroke, tempMirror, fromIndex);
      }

      // Draw high-visibility circular outline for the active eraser tip
      const lastPt = this.points[this.points.length - 1];
      const radius = (tempStroke.size || 8) / 2;

      previewCtx.clearRect(0, 0, ctx.doc.width, ctx.doc.height);
      previewCtx.save();
      previewCtx.beginPath();
      previewCtx.arc(lastPt.x, lastPt.y, Math.max(1, radius), 0, Math.PI * 2);
      previewCtx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
      previewCtx.lineWidth = 1.5;
      previewCtx.setLineDash([3, 3]);
      previewCtx.stroke();

      previewCtx.beginPath();
      previewCtx.arc(lastPt.x, lastPt.y, Math.max(1, radius), 0, Math.PI * 2);
      previewCtx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
      previewCtx.lineWidth = 1;
      previewCtx.setLineDash([]);
      previewCtx.stroke();
      previewCtx.restore();
      return;
    }

    // Additive tools (brush, pencil, neon, rainbow, highlighter)
    ctx.renderer.renderStroke(previewCtx, tempStroke, fromIndex);

    if (ctx.isSymmetry && this.symPoints.length >= 1) {
      const tempMirror = {
        type: 'stroke',
        tool: this.mode,
        brushPreset,
        brushSettings: settings,
        color: color,
        size: ctx.toolState.size,
        opacity: ctx.toolState.opacity,
        usePressure,
        points: this.symPoints
      };
      ctx.renderer.renderStroke(previewCtx, tempMirror, fromIndex);
    }
  }

  cleanup() {
    this.isDrawing = false;
    this.points = [];
    this.symPoints = [];
    this.renderedIndex = 0;
    if (this.currentRenderer) {
      if (this.mode === 'eraser' && this.currentRenderer.endLiveEraser) {
        this.currentRenderer.endLiveEraser();
        this.currentRenderer.render();
      }
      if (this.currentRenderer.clearCursorRing) {
        this.currentRenderer.clearCursorRing();
      }
      this.currentRenderer = null;
    }
  }
}
