/**
 * The Craft — Base Tool Interface
 * Common contract for all drawing, shape, typography, and editing tools.
 * Supports standard pointer events with dynamic stylus pressure.
 */
export class BaseTool {
  constructor(id, name, cursor = 'crosshair') {
    this.id = id;
    this.name = name;
    this.cursor = cursor;
  }

  /**
   * Called on pointerdown
   * @param {PointerEvent} e 
   * @param {Object} context { x, y, pressure, isSymmetry, activeLayer, doc, renderer, commandManager, toolState }
   */
  onPointerDown(e, context) {}

  /**
   * Called on pointermove
   * @param {PointerEvent} e 
   * @param {Object} context { x, y, pressure, isSymmetry, activeLayer, doc, renderer, commandManager, toolState }
   */
  onPointerMove(e, context) {}

  /**
   * Called on pointerup / pointercancel
   * @param {PointerEvent} e 
   * @param {Object} context { x, y, pressure, isSymmetry, activeLayer, doc, renderer, commandManager, toolState }
   */
  onPointerUp(e, context) {}

  /**
   * Optional live preview render during drag
   * @param {CanvasRenderingContext2D} previewCtx 
   * @param {Object} context 
   */
  renderPreview(previewCtx, context) {}

  /**
   * Cleanup any active interactions when switching away from this tool
   */
  cleanup() {}
}
