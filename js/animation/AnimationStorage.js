/**
 * The Craft — Animation Storage Service
 * Handles independent IndexedDB autosave and .craftanim file import/export.
 * Completely isolated from normal drawing projects.
 */
import { AnimationProject } from './AnimationModel.js';
import { events } from '../core/EventBus.js';

const ANIM_DB_NAME = 'TheCraftAnimationDB';
const ANIM_DB_VERSION = 1;
const ANIM_STORE_NAME = 'animation_autosave';
const ANIM_AUTOSAVE_KEY = 'latest_animation_session';

export class AnimationStorage {
  constructor(project) {
    this.project = project;
    this.db = null;
    this.debounceTimer = null;
    this.isSaving = false;
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
      case 'saved':
        this.statusBadgeEl.textContent = 'Autosaved';
        this.statusBadgeEl.className = 'save-status-badge saved';
        break;
      case 'error':
        this.statusBadgeEl.textContent = 'Save error';
        this.statusBadgeEl.className = 'save-status-badge error';
        break;
    }
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
      const serializedData = this.project.toJSON();

      await new Promise((resolve, reject) => {
        const tx = this.db.transaction(ANIM_STORE_NAME, 'readwrite');
        const store = tx.objectStore(ANIM_STORE_NAME);
        const req = store.put(serializedData, ANIM_AUTOSAVE_KEY);
        req.onsuccess = () => resolve();
        req.onerror = (e) => reject(e.target.error);
      });

      this.updateStatusBadge('saved');
    } catch (err) {
      console.error('[AnimationStorage] Autosave failed:', err);
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
      const tx = this.db.transaction(ANIM_STORE_NAME, 'readonly');
      const store = tx.objectStore(ANIM_STORE_NAME);
      const req = store.get(ANIM_AUTOSAVE_KEY);

      req.onsuccess = () => {
        const record = req.result;
        if (!record || !record.frames || record.frames.length === 0) {
          resolve(null);
          return;
        }
        try {
          const loadedProject = AnimationProject.fromJSON(record);
          resolve(loadedProject);
        } catch (err) {
          console.error('[AnimationStorage] Error parsing saved animation:', err);
          resolve(null);
        }
      };

      req.onerror = (e) => reject(e.target.error);
    });
  }

  async clearSession() {
    if (!this.db) await this.initDB();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(ANIM_STORE_NAME, 'readwrite');
      const store = tx.objectStore(ANIM_STORE_NAME);
      const req = store.delete(ANIM_AUTOSAVE_KEY);
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
