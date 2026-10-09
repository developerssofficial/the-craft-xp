/**
 * The Craft — Project Manager (.craft File Format)
 * Enables saving and loading entire multi-layer projects as portable .craft files.
 */
import { events } from '../core/EventBus.js';
import { Layer } from '../layers/Layer.js';

export class ProjectManager {
  constructor(doc, renderer, commandManager, toolManager, storageService) {
    this.doc = doc;
    this.renderer = renderer;
    this.commandManager = commandManager;
    this.toolManager = toolManager;
    this.storageService = storageService;

    this.fileInput = null;
    this.createHiddenFileInput();
  }

  createHiddenFileInput() {
    this.fileInput = document.createElement('input');
    this.fileInput.type = 'file';
    this.fileInput.accept = '.craft,application/json';
    this.fileInput.style.display = 'none';
    document.body.appendChild(this.fileInput);

    this.fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        this.openProjectFile(file);
      }
      this.fileInput.value = '';
    });
  }

  triggerOpenDialog() {
    if (this.fileInput) {
      this.fileInput.click();
    }
  }

  async saveProject() {
    events.emit('toast', { message: 'Preparing .craft project file...' });

    try {
      const projectData = {
        app: 'The Craft',
        version: 1,
        timestamp: Date.now(),
        exportedAt: new Date().toISOString(),
        width: this.doc.width,
        height: this.doc.height,
        backgroundColor: this.doc.backgroundColor,
        activeLayerId: this.doc.activeLayerId,
        nextLayerNumber: this.doc.nextLayerNumber,
        layers: this.doc.layers.map(layer => layer.toJSON())
      };

      const jsonStr = JSON.stringify(projectData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.download = `TheCraft_Project_${Date.now()}.craft`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);

      events.emit('toast', { message: 'Project saved as .craft file' });
    } catch (err) {
      console.error('[ProjectManager] Save project error:', err);
      events.emit('toast', { message: 'Failed to save project', type: 'danger' });
    }
  }

  async openProjectFile(file) {
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!data.layers || !Array.isArray(data.layers)) {
        throw new Error('Invalid .craft project file format');
      }

      // Reconstruct document
      this.doc.backgroundColor = data.backgroundColor || '#0f1117';
      this.doc.nextLayerNumber = data.nextLayerNumber || (data.layers.length + 1);

      // Reconstruct layers
      const reconstructedLayers = [];
      for (const layerData of data.layers) {
        const layer = new Layer({
          id: layerData.id,
          name: layerData.name,
          visible: layerData.visible !== false,
          locked: !!layerData.locked,
          opacity: layerData.opacity !== undefined ? layerData.opacity : 1.0,
          blendMode: layerData.blendMode || 'source-over',
          type: layerData.type || 'vector',
          elements: Array.isArray(layerData.elements) ? layerData.elements : []
        });

        if (layerData.rasterDataUrl) {
          await new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
              layer.ensureRasterCanvas(this.doc.width, this.doc.height);
              layer.rasterCtx.drawImage(img, 0, 0);
              resolve();
            };
            img.onerror = () => resolve();
            img.src = layerData.rasterDataUrl;
          });
        }

        reconstructedLayers.push(layer);
      }

      this.doc.layers = reconstructedLayers;
      this.doc.activeLayerId = data.activeLayerId && reconstructedLayers.some(l => l.id === data.activeLayerId)
        ? data.activeLayerId
        : reconstructedLayers[0].id;

      // Clear history
      this.commandManager.clear();

      // Render canvas and update UI
      this.renderer.render();
      events.emit('document:changed');
      events.emit('toast', { message: `Opened project: ${file.name}` });

      // Trigger autosave
      if (this.storageService) {
        this.storageService.scheduleAutosave(300);
      }
    } catch (err) {
      console.error('[ProjectManager] Error opening project file:', err);
      events.emit('toast', { message: 'Failed to open project file', type: 'danger' });
    }
  }
}
