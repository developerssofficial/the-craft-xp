/**
 * The Craft — Viewport Controller
 * Manages canvas stage sizing, zoom, grid overlays, symmetry guides, and zen mode.
 */
import { events } from '../core/EventBus.js';

export class Viewport {
  constructor(elements, doc, renderer) {
    this.viewportEl = elements.viewport;
    this.canvasBoard = elements.canvasBoard;
    this.symmetryGuide = elements.symmetryGuide;
    this.zoomLevelDisplay = elements.zoomLevelDisplay;

    this.doc = doc;
    this.renderer = renderer;

    this.zoom = 1.0;
    this.minZoom = 0.25;
    this.maxZoom = 4.0;
    this.zoomStep = 0.15;

    this.showGrid = false;
    this.symmetryMode = false;
    this.isZenMode = false;

    this.init();
  }

  init() {
    window.addEventListener('resize', () => this.handleResize());
    this.handleResize(true);
  }

  handleResize(force = false) {
    const width = this.viewportEl.clientWidth || window.innerWidth;
    const height = this.viewportEl.clientHeight || (window.innerHeight - 56);

    const canvasMismatch = !this.renderer.paintCanvas.width ||
      this.renderer.paintCanvas.width !== width ||
      this.renderer.paintCanvas.height !== height;

    if (!force && !canvasMismatch && this.doc.width === width && this.doc.height === height) {
      return;
    }

    this.doc.resize(width, height);
    this.renderer.resize(width, height);
  }

  setZoom(newZoom) {
    this.zoom = Math.min(Math.max(newZoom, this.minZoom), this.maxZoom);
    this.canvasBoard.style.transform = `scale(${this.zoom})`;
    if (this.zoomLevelDisplay) {
      this.zoomLevelDisplay.textContent = `${Math.round(this.zoom * 100)}%`;
    }
    events.emit('viewport:zoom', { zoom: this.zoom });
  }

  zoomIn() {
    this.setZoom(this.zoom + this.zoomStep);
  }

  zoomOut() {
    this.setZoom(this.zoom - this.zoomStep);
  }

  resetZoom() {
    this.setZoom(1.0);
  }

  toggleGrid() {
    this.showGrid = !this.showGrid;
    this.renderer.showGrid = this.showGrid;
    this.renderer.drawGrid();
    events.emit('viewport:grid', { showGrid: this.showGrid });
    return this.showGrid;
  }

  toggleSymmetry() {
    this.symmetryMode = !this.symmetryMode;
    this.renderer.symmetryMode = this.symmetryMode;
    if (this.symmetryGuide) {
      this.symmetryGuide.classList.toggle('active', this.symmetryMode);
    }
    events.emit('viewport:symmetry', { symmetryMode: this.symmetryMode });
    return this.symmetryMode;
  }

  toggleZenMode() {
    this.isZenMode = !this.isZenMode;
    document.body.classList.toggle('zen-mode', this.isZenMode);
    setTimeout(() => this.handleResize(), 150);
    events.emit('viewport:zen', { isZenMode: this.isZenMode });
    return this.isZenMode;
  }
}
