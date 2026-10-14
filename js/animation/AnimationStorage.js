/**
 * The Craft — Animation Storage Service
 * Handles independent IndexedDB autosave, per-user cloud sync (/api/save & /api/load),
 * and .craftanim file import/export. Completely isolated from normal drawing projects.
 */
import { AnimationProject } from './AnimationModel.js';
import { events } from '../core/EventBus.js';
import { supabaseService } from '../core/supabaseClient.js';

const ANIM_DB_NAME = 'TheCraftAnimationDB';
const ANIM_DB_VERSION = 1;
const ANIM_STORE_NAME = 'animation_autosave';
const ANIM_AUTOSAVE_KEY = 'latest_animation_session';

export class AnimationStorage {
  constructor(project) {
    this.project = project;
    this.db = null;
    this.debounceTimer = null;
    this.cloudSyncTimer = null;
    this.isSaving = false;
    this.isSyncingCloud = false;
    this.statusBadgeEl = null;

    this.initDB();
  }

  async initDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(ANIM_DB_NAME, ANIM_DB_VERSION);

      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(ANIM_STORE_NAME)) {
          db.createObjectStore(ANIM_STORE_NAME);
        }
      };

      request.onsuccess = (e) => {
        this.db = e.target.result;
        resolve(this.db);
      };

      request.onerror = (e) => {
        console.error('[AnimationStorage] IndexedDB open error:', e.target.error);
        reject(e.target.error);
      };
    });
  }

  setStatusBadgeElement(el) {
    this.statusBadgeEl = el;
  }

  updateStatusBadge(status) {
    if (!this.statusBadgeEl) return;
    switch (status) {
      case 'editing':
        this.statusBadgeEl.textContent = 'Unsaved changes';
        this.statusBadgeEl.className = 'save-status-badge editing';
        break;
      case 'saving':
        this.statusBadgeEl.textContent = 'Saving...';
        this.statusBadgeEl.className = 'save-status-badge saving';
        break;
      case 'syncing':
        this.statusBadgeEl.textContent = 'Syncing...';
        this.statusBadgeEl.className = 'save-status-badge saving';
        break;
      case 'saved':
        this.statusBadgeEl.textContent = 'Autosaved';
        this.statusBadgeEl.className = 'save-status-badge saved';
        break;
      case 'cloud_saved':
        this.statusBadgeEl.textContent = 'Saved to Cloud';
        this.statusBadgeEl.className = 'save-status-badge saved';
        clearTimeout(this._badgeTimer);
        this._badgeTimer = setTimeout(() => {
          if (this.statusBadgeEl.textContent === 'Saved to Cloud') {
            this.statusBadgeEl.textContent = 'Autosaved';
          }
        }, 3000);
        break;
      case 'error':
        this.statusBadgeEl.textContent = 'Save error';
        this.statusBadgeEl.className = 'save-status-badge error';
        break;
    }
  }

  scheduleAutosave(delayMs = 1500) {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.updateStatusBadge('editing');

    this.debounceTimer = setTimeout(() => {
      if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        window.requestIdleCallback(() => this.saveSession(), { timeout: 2000 });
      } else {
        this.saveSession();
      }
    }, delayMs);
  }

  async saveSession() {
    if (!this.db || this.isSaving) return;
    this.isSaving = true;
    this.updateStatusBadge('saving');

    try {
      const serializedData = this.project.toJSON();
      serializedData.timestamp = Date.now();
      const user = supabaseService.getCurrentUser();
      const sessionKey = user ? `anim_${user.id}` : ANIM_AUTOSAVE_KEY;

      // 1. Local IndexedDB save
      await new Promise((resolve, reject) => {
        const tx = this.db.transaction(ANIM_STORE_NAME, 'readwrite');
        const store = tx.objectStore(ANIM_STORE_NAME);
        const req = store.put(serializedData, sessionKey);
        req.onsuccess = () => resolve();
        req.onerror = (e) => reject(e.target.error);
      });

      this.updateStatusBadge('saved');

      // 2. Schedule debounced cloud sync if user is logged in
      if (user) {
        this.scheduleCloudSync(user, serializedData);
      }
    } catch (err) {
      console.error('[AnimationStorage] Autosave failed:', err);
      this.updateStatusBadge('error');
    } finally {
      this.isSaving = false;
    }
  }

  scheduleCloudSync(user, data, delayMs = 4500) {
    if (this.cloudSyncTimer) {
      clearTimeout(this.cloudSyncTimer);
    }

    this.cloudSyncTimer = setTimeout(async () => {
      if (this.isSyncingCloud) return;
      this.isSyncingCloud = true;
      this.updateStatusBadge('syncing');

      try {
        const res = await fetch('/api/save', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': user.id
          },
          body: JSON.stringify({
            userId: user.id,
            userEmail: user.email,
            type: 'animation',
            data: data,
            timestamp: data.timestamp || Date.now()
          })
        });

        if (res.ok) {
          this.updateStatusBadge('cloud_saved');
        } else {
          this.updateStatusBadge('saved');
        }
      } catch (err) {
        console.warn('[AnimationStorage] Cloud sync failed:', err);
        this.updateStatusBadge('saved');
      } finally {
        this.isSyncingCloud = false;
      }
    }, delayMs);
  }

  async loadSession() {
    const user = supabaseService.getCurrentUser();

    // 1. If user is logged in, attempt to fetch their cloud animation from /api/load
    if (user) {
      try {
        const cloudRes = await fetch(`/api/load?userId=${user.id}&type=animation`, {
          headers: { 'x-user-id': user.id }
        });

        if (cloudRes.ok) {
          const cloudPayload = await cloudRes.json();
          const cloudData = cloudPayload.data || cloudPayload;

          if (cloudData && cloudData.frames && cloudData.frames.length > 0) {
            // Also inspect local IndexedDB to check which is newer
            const localData = await this.readLocalSession(`anim_${user.id}`);
            if (localData && localData.timestamp && localData.timestamp > (cloudData.timestamp || 0)) {
              console.log('[AnimationStorage] Local animation session is newer than cloud.');
              this.scheduleCloudSync(user, localData, 3000);
              return AnimationProject.fromJSON(localData);
            }

            console.log(`[AnimationStorage] Restored cloud animation from /api/load for ${user.email}`);
            return AnimationProject.fromJSON(cloudData);
          }
        }
      } catch (cloudErr) {
        console.warn('[AnimationStorage] /api/load animation fallback to local:', cloudErr);
      }
    }

    // 2. Load from local IndexedDB
    const sessionKey = user ? `anim_${user.id}` : ANIM_AUTOSAVE_KEY;
    let record = await this.readLocalSession(sessionKey);

    if (!record && sessionKey !== ANIM_AUTOSAVE_KEY) {
      record = await this.readLocalSession(ANIM_AUTOSAVE_KEY);
    }

    if (!record || !record.frames || record.frames.length === 0) {
      return null;
    }

    try {
      return AnimationProject.fromJSON(record);
    } catch (err) {
      console.error('[AnimationStorage] Error parsing saved animation:', err);
      return null;
    }
  }

  async readLocalSession(key) {
    if (!this.db) {
      await this.initDB();
    }
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(ANIM_STORE_NAME, 'readonly');
      const store = tx.objectStore(ANIM_STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = (e) => reject(e.target.error);
    });
  }

  async clearSession() {
    if (!this.db) await this.initDB();
    const user = supabaseService.getCurrentUser();
    const sessionKey = user ? `anim_${user.id}` : ANIM_AUTOSAVE_KEY;

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(ANIM_STORE_NAME, 'readwrite');
      const store = tx.objectStore(ANIM_STORE_NAME);
      const req = store.delete(sessionKey);
      req.onsuccess = () => resolve();
      req.onerror = (e) => reject(e.target.error);
    });
  }

  // Export to .craftanim file
  downloadProjectFile() {
    try {
      const projectData = this.project.toJSON();
      const jsonStr = JSON.stringify(projectData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const filename = `${this.project.name.replace(/[^a-z0-9_-]/gi, '_')}_${Date.now()}.craftanim`;
      const link = document.createElement('a');
      link.download = filename;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);

      events.emit('toast', { message: `Project saved as ${filename}` });
    } catch (err) {
      console.error('[AnimationStorage] File export failed:', err);
      events.emit('toast', { message: 'Failed to download animation project file', type: 'danger' });
    }
  }

  // Open .craftanim file
  async openProjectFile(file) {
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!data.frames || !Array.isArray(data.frames)) {
        throw new Error('Invalid .craftanim project file');
      }

      const importedProject = AnimationProject.fromJSON(data);
      return importedProject;
    } catch (err) {
      console.error('[AnimationStorage] Failed to read project file:', err);
      events.emit('toast', { message: 'Invalid or corrupted animation project file', type: 'danger' });
      return null;
    }
  }
}
