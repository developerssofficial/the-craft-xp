/**
 * The Craft — Tool Manager
 * Manages tool registration, tool switching, shortcut mapping,
 * and dispatching pointer events to the active tool.
 */
import { events } from '../core/EventBus.js';
import { SelectTool } from './SelectTool.js';
import { BrushTool } from './BrushTool.js';
import { SprayTool } from './SprayTool.js';
import { ShapeTool } from './ShapeTool.js';
import { FillTool } from './FillTool.js';
import { PipetteTool } from './PipetteTool.js';
import { TextTool } from './TextTool.js';
import { StampTool } from './StampTool.js';

export class ToolManager {
  constructor(appContext) {
    this.ctx = appContext;
    this.tools = new Map();
    this.activeTool = null;

    this.toolState = {
      color: '#6366f1',
      size: 8,
      opacity: 1.0,
      fillShape: false,
      selectedStamp: '⭐',
      pressureDynamics: true
    };

    this.registerDefaultTools();
  }

  registerDefaultTools() {
    // Select
    this.registerTool(new SelectTool());

    // Brushes
    this.registerTool(new BrushTool('brush'));
    this.registerTool(new BrushTool('pencil'));
    this.registerTool(new BrushTool('neon'));
    this.registerTool(new BrushTool('rainbow'));
    this.registerTool(new BrushTool('highlighter'));
    this.registerTool(new BrushTool('eraser'));

    // Airbrush
    this.registerTool(new SprayTool());

    // Shapes
    this.registerTool(new ShapeTool('line'));
    this.registerTool(new ShapeTool('arrow'));
    this.registerTool(new ShapeTool('rectangle'));
    this.registerTool(new ShapeTool('circle'));
    this.registerTool(new ShapeTool('star'));
    this.registerTool(new ShapeTool('heart'));

    // Utilities
    this.registerTool(new FillTool());
    this.registerTool(new PipetteTool());
    this.registerTool(new TextTool(this.ctx.inlineTextInput));
    this.registerTool(new StampTool());

    // Set default tool
    this.setActiveTool('select');
  }

  registerTool(tool) {
    this.tools.set(tool.id, tool);
  }

  setActiveTool(toolId) {
    if (!this.tools.has(toolId)) {
      console.warn(`[ToolManager] Unknown tool ID: ${toolId}`);
      return;
    }

    if (this.activeTool) {
      this.activeTool.cleanup();
    }

    this.activeTool = this.tools.get(toolId);
    this.updateCursor();

    events.emit('tool:changed', { toolId, tool: this.activeTool });
  }

  getActiveTool() {
    return this.activeTool;
  }

  updateCursor() {
    if (!this.ctx.viewport) return;
    if (this.activeTool && this.activeTool.cursor) {
      this.ctx.viewport.style.cursor = this.activeTool.cursor;
    } else {
      this.ctx.viewport.style.cursor = 'crosshair';
    }
  }

  getExecutionContext(e) {
    const rect = this.ctx.paintCanvas.getBoundingClientRect();
    const clientX = e.clientX;
    const clientY = e.clientY;

    const rawX = clientX - rect.left;
    const rawY = clientY - rect.top;

    // Scale according to viewport zoom if applicable
    const zoom = this.ctx.viewportModel ? this.ctx.viewportModel.zoom : 1.0;
    const x = rawX / zoom;
    const y = rawY / zoom;

    // Pressure support (defaults to 0.5 for mouse, actual pressure for stylus)
    const pressure = e.pressure !== undefined && e.pressure > 0 ? e.pressure : 0.5;

    return {
      x,
      y,
      pressure,
      isSymmetry: this.ctx.viewportModel ? this.ctx.viewportModel.symmetryMode : false,
      activeLayer: this.ctx.doc.getActiveLayer(),
      doc: this.ctx.doc,
      renderer: this.ctx.renderer,
      commandManager: this.ctx.commandManager,
      toolState: this.toolState
    };
  }

  handlePointerDown(e) {
    if (!this.activeTool) return;
    const ctx = this.getExecutionContext(e);
    if (ctx.activeLayer.locked) {
      events.emit('toast', { message: 'Layer is locked', type: 'warning' });
      return;
    }
    this.activeTool.onPointerDown(e, ctx);
  }

  handlePointerMove(e) {
    if (!this.activeTool) return;
    const ctx = this.getExecutionContext(e);
    this.activeTool.onPointerMove(e, ctx);
  }

  handlePointerUp(e) {
    if (!this.activeTool) return;
    const ctx = this.getExecutionContext(e);
    this.activeTool.onPointerUp(e, ctx);
  }
}
