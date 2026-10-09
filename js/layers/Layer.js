/**
 * The Craft — Layer Model
 * Encapsulates layer attributes, vector elements, and raster data.
 */
let layerCounter = 1;

export class Layer {
  constructor(options = {}) {
    this.id = options.id || `layer_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    this.name = options.name || `Layer ${layerCounter++}`;
    this.visible = options.visible !== undefined ? options.visible : true;
    this.locked = options.locked !== undefined ? options.locked : false;
    this.opacity = options.opacity !== undefined ? options.opacity : 1.0;
    this.blendMode = options.blendMode || 'source-over'; // standard Canvas globalCompositeOperation
    this.type = options.type || 'vector';
    this.elements = Array.isArray(options.elements) ? [...options.elements] : [];
    
    // Optional raster backing canvas for pixel-based tools (fill, raster brushes)
    this.rasterCanvas = null;
    this.rasterCtx = null;
    if (options.rasterDataUrl) {
      this.loadRasterFromDataUrl(options.rasterDataUrl);
    }
  }

  ensureRasterCanvas(width, height) {
    if (!this.rasterCanvas) {
      this.rasterCanvas = document.createElement('canvas');
      this.rasterCanvas.width = width || 1920;
      this.rasterCanvas.height = height || 1080;
      this.rasterCtx = this.rasterCanvas.getContext('2d', { willReadFrequently: true });
    } else if (width && height && (this.rasterCanvas.width !== width || this.rasterCanvas.height !== height)) {
      const temp = document.createElement('canvas');
      temp.width = this.rasterCanvas.width;
      temp.height = this.rasterCanvas.height;
      temp.getContext('2d').drawImage(this.rasterCanvas, 0, 0);

      this.rasterCanvas.width = width;
      this.rasterCanvas.height = height;
      this.rasterCtx = this.rasterCanvas.getContext('2d', { willReadFrequently: true });
      this.rasterCtx.drawImage(temp, 0, 0);
    }
    return this.rasterCanvas;
  }

  addElement(element) {
    if (!element.id) {
      element.id = `el_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    }
    this.elements.push(element);
    return element;
  }

  removeElement(elementId) {
    const idx = this.elements.findIndex(el => el.id === elementId);
    if (idx !== -1) {
      return this.elements.splice(idx, 1)[0];
    }
    return null;
  }

  clear() {
    this.elements = [];
    if (this.rasterCtx) {
      this.rasterCtx.clearRect(0, 0, this.rasterCanvas.width, this.rasterCanvas.height);
    }
  }

  clone() {
    const cloned = new Layer({
      name: `${this.name} Copy`,
      visible: this.visible,
      locked: this.locked,
      opacity: this.opacity,
      blendMode: this.blendMode,
      type: this.type,
      elements: JSON.parse(JSON.stringify(this.elements))
    });
    if (this.rasterCanvas) {
      cloned.ensureRasterCanvas(this.rasterCanvas.width, this.rasterCanvas.height);
      cloned.rasterCtx.drawImage(this.rasterCanvas, 0, 0);
    }
    return cloned;
  }

  loadRasterFromDataUrl(dataUrl) {
    const img = new Image();
    img.onload = () => {
      this.ensureRasterCanvas(img.width, img.height);
      this.rasterCtx.drawImage(img, 0, 0);
    };
    img.src = dataUrl;
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      visible: this.visible,
      locked: this.locked,
      opacity: this.opacity,
      blendMode: this.blendMode,
      type: this.type,
      elements: JSON.parse(JSON.stringify(this.elements)),
      rasterDataUrl: this.rasterCanvas ? this.rasterCanvas.toDataURL('image/png') : null
    };
  }

  static fromJSON(data) {
    return new Layer(data);
  }
}
