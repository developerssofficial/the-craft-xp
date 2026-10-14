/**
 * The Craft — Storage Service (IndexedDB Autosave + Per-User Cloud Sync)
 * Automatically persists document state, layer scene graphs, and raster image Blobs
 * to IndexedDB with non-blocking idle serialization, and synchronizes to cloud storage (/api/save)
 * when a user is authenticated via Supabase.
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
    this.localDebounceTimer = null;
    this.cloudSyncTimer = null;
    this.isSavingLocal = false;
    this.isSyncingCloud = false;
    this.saveStatusEl = null;
    this.currentCloudId = null;
    this.currentTitle = 'My Artwork';
    this.lastLocalSaveTimestamp = 0;

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
        console.log('[StorageService] User session active:', user.email);
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

      // 1. Save to Supabase private user table
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

      // 2. Also sync to /api/save (MongoDB Atlas)
      await this.syncToApiSave(user, record);

      this.updateStatusBadge('cloud_saved');
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

  async buildSerializedRecord(forNetwork = false) {
    const layerDataPromises = this.doc.layers.map(async (layer) => {
      let rasterBlob = null;
      let rasterDataUrl = null;

      if (layer.rasterCanvas && layer.rasterDirty) {
        rasterBlob = await new Promise(resolve => {
          layer.rasterCanvas.toBlob(blob => resolve(blob), 'image/png');
        });
        layer._cachedRasterBlob = rasterBlob;
        layer._cachedRasterDataUrl = layer.rasterCanvas.toDataURL('image/png');
        layer.rasterDirty = false;
      } else if (layer._cachedRasterBlob) {
        rasterBlob = layer._cachedRasterBlob;
      }

      if (forNetwork || !rasterBlob) {
        rasterDataUrl = layer._cachedRasterDataUrl || (layer.rasterCanvas ? layer.rasterCanvas.toDataURL('image/png') : null);
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
        rasterBlob: forNetwork ? null : rasterBlob,
        rasterDataUrl: rasterDataUrl
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
        color: this.toolManager?.toolState?.color || '#6366f1',
        size: this.toolManager?.toolState?.size || 8,
        opacity: this.toolManager?.toolState?.opacity || 100,
        activeBrushPreset: this.toolManager?.toolState?.activeBrushPreset || 'basic_medium_round',
        fillShape: this.toolManager?.toolState?.fillShape || false,
        selectedStamp: this.toolManager?.toolState?.selectedStamp || '⭐',
        pressureDynamics: this.toolManager?.toolState?.pressureDynamics !== false
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

  /**
   * Schedules a debounced local autosave (1500ms).
   * Will never interrupt an active brush stroke (isDrawing === true).
   */
  scheduleAutosave(delayMs = 1500) {
    if (this.localDebounceTimer) {
      clearTimeout(this.localDebounceTimer);
    }
    this.updateStatusBadge('editing');

    this.localDebounceTimer = setTimeout(() => {
      // Guard against saving while drawing
      if (this.toolManager?.activeTool?.isDrawing) {
        // Postpone autosave until stroke is finished
        this.scheduleAutosave(1000);
        return;
      }

      // Execute non-blocking in idle callback if supported
      if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        window.requestIdleCallback(() => this.saveSession(), { timeout: 2000 });
      } else {
        this.saveSession();
      }
    }, delayMs);
  }

  async saveSession() {
    if (!this.db || this.isSavingLocal) return;

    // Double check that user is not currently drawing
    if (this.toolManager?.activeTool?.isDrawing) {
      this.scheduleAutosave(1000);
      return;
    }

    this.isSavingLocal = true;
    this.updateStatusBadge('saving');

    try {
      const record = await this.buildSerializedRecord(false);
      this.lastLocalSaveTimestamp = record.timestamp;

      // Determine user-isolated storage key
      const user = supabaseService.getCurrentUser();
      const sessionKey = user ? `session_${user.id}` : AUTOSAVE_KEY;

      // 1. Save to local IndexedDB (fast binary blob)
      await new Promise((resolve, reject) => {
        const tx = this.db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(record, sessionKey);
        req.onsuccess = () => resolve();
        req.onerror = (e) => reject(e.target.error);
      });

      this.updateStatusBadge('saved');

      // 2. Schedule debounced background cloud sync if user is logged in
      if (user) {
        this.scheduleCloudSync(user);
      }
    } catch (err) {
      console.error('[StorageService] Autosave failed:', err);
      this.updateStatusBadge('error');
    } finally {
      this.isSavingLocal = false;
    }
  }

  /**
   * Debounces background cloud synchronization (5 seconds after last change)
   */
  scheduleCloudSync(user, delayMs = 4500) {
    if (this.cloudSyncTimer) {
      clearTimeout(this.cloudSyncTimer);
    }

    this.cloudSyncTimer = setTimeout(async () => {
      // Don't sync if drawing
      if (this.toolManager?.activeTool?.isDrawing) {
        this.scheduleCloudSync(user, 2000);
        return;
      }
      await this.syncToCloud(user);
    }, delayMs);
  }

  async syncToCloud(user) {
    if (this.isSyncingCloud || !user) return;
    this.isSyncingCloud = true;
    this.updateStatusBadge('syncing');

    try {
      const networkRecord = await this.buildSerializedRecord(true);

      // A. Sync to /api/save (MongoDB Atlas)
      await this.syncToApiSave(user, networkRecord);

      // B. Sync to Supabase user gallery table if available
      if (supabaseService.isConfigured()) {
        try {
          const thumb = this.generateThumbnail();
          const saved = await supabaseService.saveDrawing({
            id: this.currentCloudId,
            title: this.currentTitle || 'Autosaved Drawing',
            thumbnail: thumb,
            data: networkRecord,
            isAnimation: false
          });
          if (saved && saved.id) {
            this.currentCloudId = saved.id;
          }
        } catch (_) {}
      }

      this.updateStatusBadge('cloud_saved');
    } catch (err) {
      console.warn('[StorageService] Cloud background sync warning:', err);
      this.updateStatusBadge('saved'); // Fallback to local saved
    } finally {
      this.isSyncingCloud = false;
    }
  }

  async syncToApiSave(user, record) {
    try {
      const response = await fetch('/api/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user.id
        },
        body: JSON.stringify({
          userId: user.id,
          userEmail: user.email,
          type: 'drawing',
          data: record,
          timestamp: record.timestamp || Date.now()
        })
      });
      return response.ok;
    } catch (e) {
      console.warn('[StorageService] /api/save network failure:', e);
      return false;
    }
  }

  /**
   * Loads user session with intelligent Cloud-first + IndexedDB fallback
   */
  async loadSession() {
    const user = supabaseService.getCurrentUser();

    // 1. If user is logged in, try loading their saved cloud drawing from /api/load
    if (user) {
      try {
        const cloudRes = await fetch(`/api/load?userId=${user.id}&type=drawing`, {
          headers: { 'x-user-id': user.id }
        });

        if (cloudRes.ok) {
          const cloudPayload = await cloudRes.json();
          const cloudData = cloudPayload.data || cloudPayload;

          if (cloudData && cloudData.layers && cloudData.layers.length > 0) {
            // Also inspect local IndexedDB to check which is newer
            const localData = await this.readLocalSession(`session_${user.id}`);
            if (localData && localData.timestamp && localData.timestamp > (cloudData.timestamp || 0)) {
              console.log('[StorageService] Local session is newer than cloud. Using local and scheduling sync.');
              this.scheduleCloudSync(user, 3000);
              return await this.reconstructRecord(localData);
            }

            console.log(`[StorageService] Restored cloud drawing from /api/load for ${user.email}`);
            return await this.reconstructRecord(cloudData);
          }
        }
      } catch (cloudErr) {
        console.warn('[StorageService] /api/load failed, falling back to local:', cloudErr);
      }

      // Secondary cloud fallback: Supabase user gallery
      if (supabaseService.isConfigured()) {
        try {
          const userDrawings = await supabaseService.getUserDrawings(false);
          if (userDrawings && userDrawings.length > 0) {
            const latestCloud = await supabaseService.getDrawingById(userDrawings[0].id);
            if (latestCloud && latestCloud.data && latestCloud.data.layers) {
              this.currentCloudId = latestCloud.id;
              this.currentTitle = latestCloud.title;
              return await this.reconstructRecord(latestCloud.data);
            }
          }
        } catch (_) {}
      }
    }

    // 2. Load from local IndexedDB (user isolated or guest fallback)
    const sessionKey = user ? `session_${user.id}` : AUTOSAVE_KEY;
    let localRecord = await this.readLocalSession(sessionKey);

    // Fallback to legacy AUTOSAVE_KEY if user session is empty
    if (!localRecord && sessionKey !== AUTOSAVE_KEY) {
      localRecord = await this.readLocalSession(AUTOSAVE_KEY);
    }

    if (!localRecord || !localRecord.layers || localRecord.layers.length === 0) {
      return null;
    }

    return await this.reconstructRecord(localRecord);
  }

  async readLocalSession(key) {
    if (!this.db) {
      await this.initDB();
    }
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = (e) => reject(e.target.error);
    });
  }

  async reconstructRecord(record) {
    try {
      for (const layerData of record.layers) {
        if (layerData.rasterBlob) {
          const bitmap = await createImageBitmap(layerData.rasterBlob);
          layerData.rasterDataBitmap = bitmap;
        } else if (layerData.rasterDataUrl) {
          const img = new Image();
          await new Promise((resolve) => {
            img.onload = resolve;
            img.onerror = resolve;
            img.src = layerData.rasterDataUrl;
          });
          if (img.width && img.height) {
            layerData.rasterDataBitmap = await createImageBitmap(img);
          }
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
      case 'syncing':
        this.saveStatusEl.textContent = 'Syncing...';
        this.saveStatusEl.className = 'save-status-badge saving';
        break;
      case 'saved':
        this.saveStatusEl.textContent = 'Autosaved';
        this.saveStatusEl.className = 'save-status-badge saved';
        break;
      case 'cloud_saved':
        this.saveStatusEl.textContent = 'Saved to Cloud';
        this.saveStatusEl.className = 'save-status-badge saved';
        clearTimeout(this._badgeTimer);
        this._badgeTimer = setTimeout(() => {
          if (this.saveStatusEl.textContent === 'Saved to Cloud') {
            this.saveStatusEl.textContent = 'Autosaved';
          }
        }, 3000);
        break;
      case 'error':
        this.saveStatusEl.textContent = 'Save error';
        this.saveStatusEl.className = 'save-status-badge error';
        break;
    }
  }
}
