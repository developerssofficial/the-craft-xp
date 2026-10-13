/**
 * The Craft — Storage Service (IndexedDB Autosave)
 * Automatically persists document state, layer scene graphs, and raster image Blobs
 * to IndexedDB with debouncing and restores them on page load.
 */
import { events } from './EventBus.js';
import { supabaseService } from './supabaseClient.js';

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
    this.currentCloudId = null;
    this.currentTitle = 'My Artwork';

    this.initDB();
    this.initCloudEvents();
  }

  initCloudEvents() {
    events.on('cloud:save-requested', async (payload = {}) => {
      await this.saveToCloudManual(payload.forceNew);
    });

    // When user logs in or out, update session
    supabaseService.onAuthStateChange(async (user) => {
      if (user) {
        console.log('[StorageService] User authenticated:', user.email);
      } else {
        this.currentCloudId = null;
      }
    });
  }

  async saveToCloudManual(forceNew = false) {
    const user = supabaseService.getCurrentUser();
    if (!user) {
      events.emit('toast', { message: 'Please sign in first to save to cloud.', type: 'warning' });
      return;
    }

    if (forceNew) {
      const title = prompt('Enter a title for this new cloud drawing:', 'Untitled Drawing');
      if (title === null) return;
      this.currentTitle = title.trim() || 'Untitled Drawing';
      this.currentCloudId = null;
    }

    this.updateStatusBadge('saving');
    events.emit('toast', { message: 'Saving to your private cloud...' });

    try {
      const record = await this.buildSerializedRecord();
      const thumb = this.generateThumbnail();

      const saved = await supabaseService.saveDrawing({
        id: this.currentCloudId,
        title: this.currentTitle,
        thumbnail: thumb,
        data: record,
        isAnimation: false
      });

      if (saved && saved.id) {
        this.currentCloudId = saved.id;
      }

      this.updateStatusBadge('saved');
      events.emit('toast', { message: `Saved "${this.currentTitle}" to cloud!` });
    } catch (err) {
      console.error('[StorageService] Manual cloud save error:', err);
      this.updateStatusBadge('error');
      events.emit('toast', { message: 'Cloud save failed: ' + err.message, type: 'danger' });
    }
  }

  generateThumbnail() {
    try {
      if (this.renderer && this.renderer.paintCanvas) {
        return this.renderer.paintCanvas.toDataURL('image/jpeg', 0.6);
      }
    } catch (_) {}
    return '';
  }

  async buildSerializedRecord() {
    const layerDataPromises = this.doc.layers.map(async (layer) => {
      let rasterBlob = null;
      if (layer.rasterCanvas && layer.rasterDirty) {
        rasterBlob = await new Promise(resolve => {
          layer.rasterCanvas.toBlob(blob => resolve(blob), 'image/png');
        });
        layer._cachedRasterBlob = rasterBlob;
        layer.rasterDirty = false;
      } else if (layer._cachedRasterBlob) {
        rasterBlob = layer._cachedRasterBlob;
      }

      return {
        id: layer.id,
        name: layer.name,
        visible: layer.visible,
        locked: layer.locked,
        opacity: layer.opacity,
        blendMode: layer.blendMode,
        type: layer.type,
        elements: layer.elements,
        rasterBlob: rasterBlob
      };
    });

    const serializedLayers = await Promise.all(layerDataPromises);

    return {
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
        activeBrushPreset: this.toolManager.toolState.activeBrushPreset || 'basic_medium_round',
        fillShape: this.toolManager.toolState.fillShape,
        selectedStamp: this.toolManager.toolState.selectedStamp,
        pressureDynamics: this.toolManager.toolState.pressureDynamics !== false
      }
    };
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
      const record = await this.buildSerializedRecord();

      // Determine user-isolated storage key
      const user = supabaseService.getCurrentUser();
      const sessionKey = user ? `session_${user.id}` : AUTOSAVE_KEY;

      // 1. Save to local IndexedDB (isolated per user)
      await new Promise((resolve, reject) => {
        const tx = this.db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(record, sessionKey);
        req.onsuccess = () => resolve();
        req.onerror = (e) => reject(e.target.error);
      });

      // 2. Sync to Supabase cloud if user is authenticated
      if (user && supabaseService.isConfigured()) {
        try {
          const thumb = this.generateThumbnail();
          const saved = await supabaseService.saveDrawing({
            id: this.currentCloudId,
            title: this.currentTitle || 'Autosaved Drawing',
            thumbnail: thumb,
            data: record,
            isAnimation: false
          });
          if (saved && saved.id) {
            this.currentCloudId = saved.id;
          }
        } catch (cloudErr) {
          console.warn('[StorageService] Cloud sync warning:', cloudErr);
        }
      }

      this.updateStatusBadge('saved');
    } catch (err) {
      console.error('[StorageService] Autosave failed:', err);
      this.updateStatusBadge('error');
    } finally {
      this.isSaving = false;
    }
  }

  async loadSession() {
    const user = supabaseService.getCurrentUser();

    // 1. If user is logged in, attempt to restore their latest private cloud drawing
    if (user && supabaseService.isConfigured()) {
      try {
        const userDrawings = await supabaseService.getUserDrawings(false);
        if (userDrawings && userDrawings.length > 0) {
          const latestCloud = await supabaseService.getDrawingById(userDrawings[0].id);
          if (latestCloud && latestCloud.data && latestCloud.data.layers) {
            this.currentCloudId = latestCloud.id;
            this.currentTitle = latestCloud.title;
            console.log(`[StorageService] Restored cloud drawing "${latestCloud.title}" for ${user.email}`);
            return latestCloud.data;
          }
        }
      } catch (cloudErr) {
        console.warn('[StorageService] Cloud load fallback to local:', cloudErr);
      }
    }

    if (!this.db) {
      await this.initDB();
    }

    const sessionKey = user ? `session_${user.id}` : AUTOSAVE_KEY;

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(sessionKey);

      req.onsuccess = async () => {
        let record = req.result;
        // Fallback to legacy AUTOSAVE_KEY if user session is empty
        if (!record && sessionKey !== AUTOSAVE_KEY) {
          const fallbackReq = store.get(AUTOSAVE_KEY);
          fallbackReq.onsuccess = async () => {
            record = fallbackReq.result;
            if (!record || !record.layers || record.layers.length === 0) {
              resolve(null);
              return;
            }
            resolve(await this.reconstructRecord(record));
          };
          return;
        }

        if (!record || !record.layers || record.layers.length === 0) {
          resolve(null);
          return;
        }

        resolve(await this.reconstructRecord(record));
      };

      req.onerror = (e) => reject(e.target.error);
    });
  }

  async reconstructRecord(record) {
    try {
      for (const layerData of record.layers) {
        if (layerData.rasterBlob) {
          const bitmap = await createImageBitmap(layerData.rasterBlob);
          layerData.rasterDataBitmap = bitmap;
        }
      }
      return record;
    } catch (e) {
      console.error('[StorageService] Error reconstructing session:', e);
      return record;
    }
  }

  async clearSession() {
    if (!this.db) return;
    const user = supabaseService.getCurrentUser();
    const sessionKey = user ? `session_${user.id}` : AUTOSAVE_KEY;
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(sessionKey);
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
