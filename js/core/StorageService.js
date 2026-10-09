/**
 * The Craft — Storage Service (IndexedDB Autosave)
 * Automatically persists document state, layer scene graphs, and raster image Blobs
 * to IndexedDB with debouncing and restores them on page load.
 */
import { events } from './EventBus.js';

const DB_NAME = 'TheCraftStudioDB';
const DB_VERSION = 1;
const STORE_NAME = 'project_autosave';
const AUTOSAVE_KEY = 'latest_session';

export class StorageService {
  constructor(doc, renderer, toolManager) {
    this.doc = doc;
    this.renderer = renderer;
    this.toolManager = toolManager;
    this.db = null;
    this.debounceTimer = null;
    this.isSaving = false;
    this.saveStatusEl = null;

    this.initDB();
  }

  async initDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };

      request.onsuccess = (e) => {
        this.db = e.target.result;
        resolve(this.db);
      };

      request.onerror = (e) => {
        console.error('[StorageService] IndexedDB open error:', e.target.error);
        reject(e.target.error);
      };
    });
  }

  scheduleAutosave(delayMs = 1200) {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.updateStatusBadge('editing');

    this.debounceTimer = setTimeout(() => {
      this.saveSession();
    }, delayMs);
  }

  async saveSession() {
    if (!this.db || this.isSaving) return;
    this.isSaving = true;
    this.updateStatusBadge('saving');

    try {
      const layerDataPromises = this.doc.layers.map(async (layer) => {
        let rasterBlob = null;
        if (layer.rasterCanvas) {
          rasterBlob = await new Promise(resolve => {
            layer.rasterCanvas.toBlob(blob => resolve(blob), 'image/png');
          });
        }

        return {
          id: layer.id,
          name: layer.name,
          visible: layer.visible,
          locked: layer.locked,
          opacity: layer.opacity,
          blendMode: layer.blendMode,
          type: layer.type,
          elements: JSON.parse(JSON.stringify(layer.elements)),
          rasterBlob: rasterBlob
        };
      });

      const serializedLayers = await Promise.all(layerDataPromises);

      const record = {
        version: this.doc.version || 1,
        timestamp: Date.now(),
        width: this.doc.width,
        height: this.doc.height,
        backgroundColor: this.doc.backgroundColor,
        activeLayerId: this.doc.activeLayerId,
        nextLayerNumber: this.doc.nextLayerNumber,
        layers: serializedLayers,
        settings: {
          color: this.toolManager.toolState.color,
          size: this.toolManager.toolState.size,
          opacity: this.toolManager.toolState.opacity,
          fillShape: this.toolManager.toolState.fillShape,
          selectedStamp: this.toolManager.toolState.selectedStamp,
          pressureDynamics: this.toolManager.toolState.pressureDynamics !== false
        }
      };

      await new Promise((resolve, reject) => {
        const tx = this.db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(record, AUTOSAVE_KEY);
        req.onsuccess = () => resolve();
        req.onerror = (e) => reject(e.target.error);
      });

      this.updateStatusBadge('saved');
    } catch (err) {
      console.error('[StorageService] Autosave failed:', err);
      this.updateStatusBadge('error');
    } finally {
      this.isSaving = false;
    }
  }

  async loadSession() {
    if (!this.db) {
      await this.initDB();
    }

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(AUTOSAVE_KEY);

      req.onsuccess = async () => {
        const record = req.result;
        if (!record || !record.layers || record.layers.length === 0) {
          resolve(null);
          return;
        }

        try {
          // Rebuild layers with raster canvas data
          for (const layerData of record.layers) {
            if (layerData.rasterBlob) {
              const bitmap = await createImageBitmap(layerData.rasterBlob);
              layerData.rasterDataBitmap = bitmap;
            }
          }
          resolve(record);
        } catch (e) {
          console.error('[StorageService] Error reconstructing session:', e);
          resolve(null);
        }
      };

      req.onerror = (e) => reject(e.target.error);
    });
  }

  async clearSession() {
    if (!this.db) return;
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(AUTOSAVE_KEY);
      req.onsuccess = () => resolve();
      req.onerror = (e) => reject(e.target.error);
    });
  }

  setStatusBadgeElement(el) {
    this.saveStatusEl = el;
  }

  updateStatusBadge(status) {
    if (!this.saveStatusEl) return;
    switch (status) {
      case 'editing':
        this.saveStatusEl.textContent = 'Unsaved changes';
        this.saveStatusEl.className = 'save-status-badge editing';
        break;
      case 'saving':
        this.saveStatusEl.textContent = 'Saving...';
        this.saveStatusEl.className = 'save-status-badge saving';
        break;
      case 'saved':
        this.saveStatusEl.textContent = 'Autosaved';
        this.saveStatusEl.className = 'save-status-badge saved';
        break;
      case 'error':
        this.saveStatusEl.textContent = 'Save error';
        this.saveStatusEl.className = 'save-status-badge error';
        break;
    }
  }
}
