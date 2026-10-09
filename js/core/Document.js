/**
 * The Craft — Document Model (Scene Graph)
 * Manages layer stack, active layer, canvas dimensions, and document state.
 */
import { Layer } from '../layers/Layer.js';
import { events } from './EventBus.js';

export class Document {
  constructor(options = {}) {
    this.version = 1;
    this.width = options.width || window.innerWidth;
    this.height = options.height || (window.innerHeight - 56);
    this.backgroundColor = options.backgroundColor || '#0f1117';
    this.layers = [];
    this.activeLayerId = null;

    if (Array.isArray(options.layers) && options.layers.length > 0) {
      this.layers = options.layers.map(l => (l instanceof Layer ? l : Layer.fromJSON(l)));
      this.activeLayerId = options.activeLayerId || this.layers[0].id;
    } else {
      // Default initial layer
      const initialLayer = new Layer({ name: 'Layer 1' });
      this.layers.push(initialLayer);
      this.activeLayerId = initialLayer.id;
    }
  }

  getActiveLayer() {
    return this.layers.find(l => l.id === this.activeLayerId) || this.layers[this.layers.length - 1];
  }

  setActiveLayer(layerId) {
    if (this.layers.some(l => l.id === layerId)) {
      this.activeLayerId = layerId;
      events.emit('layer:activated', { layerId, layer: this.getActiveLayer() });
      events.emit('document:changed');
      return true;
    }
    return false;
  }

  addLayer(name = null, insertIndex = null) {
    const newLayer = new Layer({ name: name || undefined });
    if (insertIndex !== null && insertIndex >= 0 && insertIndex <= this.layers.length) {
      this.layers.splice(insertIndex, 0, newLayer);
    } else {
      // Insert on top of active layer, or at the top of stack
      const activeIdx = this.layers.findIndex(l => l.id === this.activeLayerId);
      if (activeIdx !== -1) {
        this.layers.splice(activeIdx + 1, 0, newLayer);
      } else {
        this.layers.push(newLayer);
      }
    }
    this.activeLayerId = newLayer.id;
    events.emit('layer:added', { layer: newLayer });
    events.emit('document:changed');
    return newLayer;
  }

  removeLayer(layerId) {
    if (this.layers.length <= 1) {
      events.emit('toast', { message: 'Cannot delete the only layer', type: 'warning' });
      return null;
    }
    const idx = this.layers.findIndex(l => l.id === layerId);
    if (idx === -1) return null;

    const removed = this.layers.splice(idx, 1)[0];
    if (this.activeLayerId === layerId) {
      const nextIdx = Math.max(0, idx - 1);
      this.activeLayerId = this.layers[nextIdx].id;
    }
    events.emit('layer:removed', { layer: removed });
    events.emit('document:changed');
    return removed;
  }

  duplicateLayer(layerId) {
    const idx = this.layers.findIndex(l => l.id === layerId);
    if (idx === -1) return null;

    const original = this.layers[idx];
    const cloned = original.clone();
    this.layers.splice(idx + 1, 0, cloned);
    this.activeLayerId = cloned.id;

    events.emit('layer:added', { layer: cloned });
    events.emit('document:changed');
    return cloned;
  }

  reorderLayers(fromIndex, toIndex) {
    if (fromIndex < 0 || fromIndex >= this.layers.length || toIndex < 0 || toIndex >= this.layers.length) {
      return false;
    }
    const [moved] = this.layers.splice(fromIndex, 1);
    this.layers.splice(toIndex, 0, moved);
    events.emit('layers:reordered', { layers: this.layers });
    events.emit('document:changed');
    return true;
  }

  mergeDown(layerId) {
    const idx = this.layers.findIndex(l => l.id === layerId);
    if (idx <= 0) {
      events.emit('toast', { message: 'Cannot merge the bottom-most layer', type: 'warning' });
      return null;
    }

    const currentLayer = this.layers[idx];
    const targetLayer = this.layers[idx - 1];

    // Combine vector elements
    targetLayer.elements.push(...currentLayer.elements);

    // Combine raster canvases if present
    if (currentLayer.rasterCanvas) {
      targetLayer.ensureRasterCanvas(this.width, this.height);
      targetLayer.rasterCtx.save();
      targetLayer.rasterCtx.globalAlpha = currentLayer.opacity;
      targetLayer.rasterCtx.globalCompositeOperation = currentLayer.blendMode;
      targetLayer.rasterCtx.drawImage(currentLayer.rasterCanvas, 0, 0);
      targetLayer.rasterCtx.restore();
    }

    // Remove the current layer
    this.layers.splice(idx, 1);
    this.activeLayerId = targetLayer.id;

    events.emit('layer:merged', { targetLayer });
    events.emit('document:changed');
    return targetLayer;
  }

  setLayerProperty(layerId, property, value) {
    const layer = this.layers.find(l => l.id === layerId);
    if (!layer) return false;

    layer[property] = value;
    events.emit('layer:updated', { layerId, property, value });
    events.emit('document:changed');
    return true;
  }

  resize(width, height) {
    this.width = width;
    this.height = height;
    this.layers.forEach(layer => {
      if (layer.rasterCanvas) {
        layer.ensureRasterCanvas(width, height);
      }
    });
    events.emit('document:resized', { width, height });
    events.emit('document:changed');
  }

  toJSON() {
    return {
      version: this.version,
      width: this.width,
      height: this.height,
      backgroundColor: this.backgroundColor,
      activeLayerId: this.activeLayerId,
      layers: this.layers.map(l => l.toJSON())
    };
  }

  static fromJSON(data) {
    return new Document(data);
  }
}
