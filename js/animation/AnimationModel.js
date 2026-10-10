/**
 * The Craft — Animation Data Models
 * Encapsulates AnimationFrame and AnimationProject with multi-layer support per frame.
 */
import { Layer } from '../layers/Layer.js';

let frameCounter = 1;

export class AnimationFrame {
  constructor(options = {}) {
    this.id = options.id || `frame_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    this.name = options.name || `Frame ${frameCounter++}`;
    this.layers = [];
    this.activeLayerId = null;
    this.duration = options.duration || 1; // Hold multiplier if needed

    if (Array.isArray(options.layers) && options.layers.length > 0) {
      this.layers = options.layers.map(l => (l instanceof Layer ? l : Layer.fromJSON(l)));
      this.activeLayerId = options.activeLayerId || this.layers[0].id;
    } else {
      // Default initial layer for this frame
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
      return true;
    }
    return false;
  }

  addLayer(name = null) {
    const layerNum = this.layers.length + 1;
    const layerName = name || `Layer ${layerNum}`;
    const newLayer = new Layer({ name: layerName });
    this.layers.push(newLayer);
    this.activeLayerId = newLayer.id;
    return newLayer;
  }

  removeLayer(layerId) {
    if (this.layers.length <= 1) return null; // Cannot delete only layer
    const idx = this.layers.findIndex(l => l.id === layerId);
    if (idx === -1) return null;
    const removed = this.layers.splice(idx, 1)[0];
    if (this.activeLayerId === layerId) {
      this.activeLayerId = this.layers[Math.max(0, idx - 1)].id;
    }
    return removed;
  }

  duplicateLayer(layerId) {
    const idx = this.layers.findIndex(l => l.id === layerId);
    if (idx === -1) return null;
    const original = this.layers[idx];
    const cloned = original.clone();
    this.layers.splice(idx + 1, 0, cloned);
    this.activeLayerId = cloned.id;
    return cloned;
  }

  reorderLayers(fromIndex, toIndex) {
    if (fromIndex < 0 || fromIndex >= this.layers.length || toIndex < 0 || toIndex >= this.layers.length) {
      return false;
    }
    const [moved] = this.layers.splice(fromIndex, 1);
    this.layers.splice(toIndex, 0, moved);
    return true;
  }

  clone(newName = null) {
    const clonedLayers = this.layers.map(layer => layer.clone());
    const cloned = new AnimationFrame({
      name: newName || `${this.name} Copy`,
      layers: clonedLayers,
      activeLayerId: this.activeLayerId,
      duration: this.duration
    });
    return cloned;
  }

  clear() {
    this.layers.forEach(l => l.clear());
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      activeLayerId: this.activeLayerId,
      duration: this.duration,
      layers: this.layers.map(l => l.toJSON())
    };
  }

  static fromJSON(data) {
    const frame = new AnimationFrame({
      id: data.id,
      name: data.name,
      activeLayerId: data.activeLayerId,
      duration: data.duration,
      layers: (data.layers || []).map(l => Layer.fromJSON(l))
    });
    return frame;
  }
}

export class AnimationProject {
  constructor(options = {}) {
    this.id = options.id || `proj_${Date.now()}`;
    this.name = options.name || 'Untitled Animation';
    this.width = options.width || 1280;
    this.height = options.height || 720;
    this.backgroundColor = options.backgroundColor || '#ffffff';
    this.fps = options.fps || 12;
    this.loop = options.loop !== undefined ? options.loop : true;
    this.frames = [];
    this.currentFrameIndex = 0;
    this.clipboardFrame = null;

    if (Array.isArray(options.frames) && options.frames.length > 0) {
      this.frames = options.frames.map(f => (f instanceof AnimationFrame ? f : AnimationFrame.fromJSON(f)));
      this.currentFrameIndex = Math.min(options.currentFrameIndex || 0, this.frames.length - 1);
    } else {
      // Default initial frame
      const initialFrame = new AnimationFrame({ name: 'Frame 1' });
      this.frames.push(initialFrame);
      this.currentFrameIndex = 0;
    }
  }

  getCurrentFrame() {
    if (this.currentFrameIndex < 0 || this.currentFrameIndex >= this.frames.length) {
      this.currentFrameIndex = 0;
    }
    return this.frames[this.currentFrameIndex] || null;
  }

  setCurrentFrame(index) {
    if (index >= 0 && index < this.frames.length) {
      this.currentFrameIndex = index;
      return true;
    }
    return false;
  }

  addFrame(insertIndex = null, name = null) {
    const frameNum = this.frames.length + 1;
    const newFrame = new AnimationFrame({ name: name || `Frame ${frameNum}` });
    if (insertIndex !== null && insertIndex >= 0 && insertIndex <= this.frames.length) {
      this.frames.splice(insertIndex, 0, newFrame);
      this.currentFrameIndex = insertIndex;
    } else {
      const nextIdx = this.currentFrameIndex + 1;
      this.frames.splice(nextIdx, 0, newFrame);
      this.currentFrameIndex = nextIdx;
    }
    return newFrame;
  }

  duplicateFrame(index = null) {
    const targetIdx = index !== null ? index : this.currentFrameIndex;
    if (targetIdx < 0 || targetIdx >= this.frames.length) return null;
    const original = this.frames[targetIdx];
    const cloned = original.clone(`${original.name} Copy`);
    this.frames.splice(targetIdx + 1, 0, cloned);
    this.currentFrameIndex = targetIdx + 1;
    return cloned;
  }

  deleteFrame(index = null) {
    if (this.frames.length <= 1) return null; // Minimum 1 frame
    const targetIdx = index !== null ? index : this.currentFrameIndex;
    if (targetIdx < 0 || targetIdx >= this.frames.length) return null;

    const removed = this.frames.splice(targetIdx, 1)[0];
    if (this.currentFrameIndex >= this.frames.length) {
      this.currentFrameIndex = Math.max(0, this.frames.length - 1);
    }
    return removed;
  }

  moveFrame(fromIndex, toIndex) {
    if (fromIndex < 0 || fromIndex >= this.frames.length || toIndex < 0 || toIndex >= this.frames.length) {
      return false;
    }
    const [moved] = this.frames.splice(fromIndex, 1);
    this.frames.splice(toIndex, 0, moved);
    this.currentFrameIndex = toIndex;
    return true;
  }

  copyFrame(index = null) {
    const targetIdx = index !== null ? index : this.currentFrameIndex;
    if (targetIdx < 0 || targetIdx >= this.frames.length) return null;
    this.clipboardFrame = this.frames[targetIdx].clone();
    return this.clipboardFrame;
  }

  pasteFrame(insertIndex = null) {
    if (!this.clipboardFrame) return null;
    const pasted = this.clipboardFrame.clone(`${this.clipboardFrame.name} (Pasted)`);
    const targetIdx = insertIndex !== null ? insertIndex : this.currentFrameIndex + 1;
    this.frames.splice(targetIdx, 0, pasted);
    this.currentFrameIndex = targetIdx;
    return pasted;
  }

  toJSON() {
    return {
      app: 'The Craft Animation',
      version: 1,
      id: this.id,
      name: this.name,
      timestamp: Date.now(),
      width: this.width,
      height: this.height,
      backgroundColor: this.backgroundColor,
      fps: this.fps,
      loop: this.loop,
      currentFrameIndex: this.currentFrameIndex,
      frames: this.frames.map(f => f.toJSON())
    };
  }

  static fromJSON(data) {
    const proj = new AnimationProject({
      id: data.id,
      name: data.name,
      width: data.width || 1280,
      height: data.height || 720,
      backgroundColor: data.backgroundColor || '#ffffff',
      fps: data.fps || 12,
      loop: data.loop !== undefined ? data.loop : true,
      currentFrameIndex: data.currentFrameIndex || 0,
      frames: (data.frames || []).map(f => AnimationFrame.fromJSON(f))
    });
    return proj;
  }
}
