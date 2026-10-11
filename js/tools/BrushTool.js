/**
 * The Craft — Brush Tool
 * Handles smooth brush, pencil, neon glow, rainbow stream, highlighter, and eraser.
 * Full stylus pressure support and optional symmetry/mirror drawing.
 */
import { BaseTool } from './BaseTool.js';
import { DrawCommand } from '../core/commands/DrawCommand.js';

export class BrushTool extends BaseTool {
  constructor(mode = 'brush') {
    super(mode, mode.charAt(0).toUpperCase() + mode.slice(1), 'crosshair');
    this.mode = mode; // 'brush', 'pencil', 'neon', 'rainbow', 'highlighter', 'eraser'
    this.isDrawing = false;
    this.points = [];
    this.symPoints = [];
    this.rainbowHue = 0;
    this.currentRenderer = null;
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

    const p = { x: ctx.x, y: ctx.y, pressure: ctx.pressure };
    this.points = [p];

    if (ctx.isSymmetry) {
      const midX = ctx.doc.width / 2;
      this.symPoints = [{ x: midX * 2 - ctx.x, y: ctx.y, pressure: ctx.pressure }];
    } else {
      this.symPoints = [];
    }

    // Begin live real-time eraser composite session
    if (this.mode === 'eraser' && ctx.renderer && ctx.renderer.beginLiveEraser) {
      ctx.renderer.beginLiveEraser(ctx.activeLayer.id);
    }

    // Set preview cursor
    this.renderPreview(ctx.renderer.previewCtx, ctx);
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

    const p = { x: ctx.x, y: ctx.y, pressure: ctx.pressure };
    this.points.push(p);

    if (ctx.isSymmetry) {
      const midX = ctx.doc.width / 2;
      this.symPoints.push({ x: midX * 2 - ctx.x, y: ctx.y, pressure: ctx.pressure });
    }

    if (this.mode === 'rainbow') {
      this.rainbowHue = (this.rainbowHue + 3) % 360;
    }

    this.renderPreview(ctx.renderer.previewCtx, ctx);
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
      const mainStroke = {
        type: 'stroke',
        tool: this.mode,
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
    ctx.renderer.previewCtx.clearRect(0, 0, ctx.doc.width, ctx.doc.height);

    if (this.mode === 'eraser' && ctx.renderer && ctx.renderer.drawCursorRing) {
      ctx.renderer.drawCursorRing(ctx.x, ctx.y, (ctx.toolState.size || 8) / 2);
    }
  }

  renderPreview(previewCtx, ctx) {
    previewCtx.clearRect(0, 0, ctx.doc.width, ctx.doc.height);
    if (!this.isDrawing || this.points.length === 0) return;

    const color = this.mode === 'rainbow' ? `hsl(${this.rainbowHue}, 100%, 55%)` : ctx.toolState.color;
    const usePressure = ctx.toolState.pressureDynamics !== false;
    const tempStroke = {
      type: 'stroke',
      tool: this.mode,
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
        color: color,
        size: ctx.toolState.size,
        opacity: ctx.toolState.opacity,
        usePressure,
        points: this.symPoints
      } : null;

      // Real-time canvas erasure!
      if (ctx.renderer && ctx.renderer.renderLiveEraser) {
        ctx.renderer.renderLiveEraser(tempStroke, tempMirror);
      }

      // Draw high-visibility circular outline for the active eraser tip
      const lastPt = this.points[this.points.length - 1];
      const radius = (tempStroke.size || 8) / 2;

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
    ctx.renderer.renderStroke(previewCtx, tempStroke);

    if (ctx.isSymmetry && this.symPoints.length >= 1) {
      const tempMirror = {
        type: 'stroke',
        tool: this.mode,
        color: color,
        size: ctx.toolState.size,
        opacity: ctx.toolState.opacity,
        usePressure,
        points: this.symPoints
      };
      ctx.renderer.renderStroke(previewCtx, tempMirror);
    }
  }

  cleanup() {
    this.isDrawing = false;
    this.points = [];
    this.symPoints = [];
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
