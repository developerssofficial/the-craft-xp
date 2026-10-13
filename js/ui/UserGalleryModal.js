/**
 * The Craft — Private Cloud Gallery Modal
 * Displays strictly isolated drawings belonging to the authenticated user.
 */
import { supabaseService } from '../core/supabaseClient.js';
import { events } from '../core/EventBus.js';

export class UserGalleryModal {
  constructor(projectManager = null) {
    this.projectManager = projectManager;
    this.modalEl = null;
    this.drawings = [];
    this.isLoading = false;

    this.createModalDOM();
  }

  createModalDOM() {
    this.modalEl = document.createElement('div');
    this.modalEl.className = 'modal-backdrop hidden';
    this.modalEl.id = 'galleryModalBackdrop';
    this.modalEl.innerHTML = `
      <div class="gallery-modal-card">
        <!-- Header -->
        <div class="gallery-modal-header">
          <div class="gallery-header-left">
            <i class="fa-solid fa-cloud brand-accent"></i>
            <div>
              <h3>My Private Cloud Drawings</h3>
              <p class="gallery-subtitle">Protected by Supabase Row Level Security (RLS) — only visible to you.</p>
            </div>
          </div>
          <div class="gallery-header-actions">
            <button id="galleryNewDrawingBtn" class="btn primary-btn small-btn" title="Save current canvas as new cloud drawing">
              <i class="fa-solid fa-plus"></i>
              <span>Save Current as New</span>
            </button>
            <button class="modal-close-btn" id="galleryModalCloseBtn" title="Close (Esc)">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
        </div>

        <!-- Drawings Grid Container -->
        <div class="gallery-modal-body">
          <div id="galleryLoadingSpinner" class="gallery-loading hidden">
            <i class="fa-solid fa-circle-notch fa-spin"></i>
            <span>Loading your private drawings...</span>
          </div>
          <div id="galleryEmptyState" class="gallery-empty-state hidden">
            <i class="fa-regular fa-image"></i>
            <h4>No saved cloud drawings yet</h4>
            <p>Draw something on the canvas and click "Save Current as New" to keep it securely in your private cloud.</p>
          </div>
          <div id="galleryGrid" class="gallery-grid"></div>
        </div>
      </div>
    `;

    document.body.appendChild(this.modalEl);

    // Event listeners
    this.modalEl.querySelector('#galleryModalCloseBtn').addEventListener('click', () => this.close());
    this.modalEl.addEventListener('click', (e) => {
      if (e.target === this.modalEl) this.close();
    });

    this.modalEl.querySelector('#galleryNewDrawingBtn').addEventListener('click', () => {
      events.emit('cloud:save-requested', { forceNew: true });
    });
  }

  async open() {
    if (!this.modalEl) return;
    const user = supabaseService.getCurrentUser();
    if (!user) {
      events.emit('toast', { message: 'Please sign in to access your cloud drawings.', type: 'warning' });
      return;
    }

    this.modalEl.classList.remove('hidden');
    await this.fetchAndRenderDrawings();
  }

  close() {
    if (!this.modalEl) return;
    this.modalEl.classList.add('hidden');
  }

  async fetchAndRenderDrawings() {
    const spinner = this.modalEl.querySelector('#galleryLoadingSpinner');
    const emptyState = this.modalEl.querySelector('#galleryEmptyState');
    const grid = this.modalEl.querySelector('#galleryGrid');

    spinner.classList.remove('hidden');
    emptyState.classList.add('hidden');
    grid.innerHTML = '';

    try {
      this.drawings = await supabaseService.getUserDrawings();
      spinner.classList.add('hidden');

      if (!this.drawings || this.drawings.length === 0) {
        emptyState.classList.remove('hidden');
        return;
      }

      this.renderGrid(this.drawings);
    } catch (err) {
      spinner.classList.add('hidden');
      grid.innerHTML = `<div class="gallery-error"><i class="fa-solid fa-triangle-exclamation"></i> Error loading drawings: ${err.message}</div>`;
    }
  }

  renderGrid(drawings) {
    const grid = this.modalEl.querySelector('#galleryGrid');
    grid.innerHTML = '';

    drawings.forEach(d => {
      const card = document.createElement('div');
      card.className = 'gallery-card';
      card.dataset.id = d.id;

      const dateStr = new Date(d.updated_at || d.created_at).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      const thumbImg = d.thumbnail
        ? `<img src="${d.thumbnail}" class="gallery-card-thumb" alt="${d.title}">`
        : `<div class="gallery-card-placeholder"><i class="fa-regular fa-image"></i></div>`;

      card.innerHTML = `
        <div class="gallery-card-preview">
          ${thumbImg}
          <div class="gallery-card-overlay">
            <button class="btn primary-btn small-btn load-drawing-btn" title="Open this drawing">
              <i class="fa-solid fa-folder-open"></i>
              <span>Open</span>
            </button>
          </div>
        </div>
        <div class="gallery-card-info">
          <div class="gallery-card-title-row">
            <span class="gallery-card-title" title="${d.title}">${d.title || 'Untitled Artwork'}</span>
            <div class="gallery-card-actions">
              <button class="icon-btn small rename-drawing-btn" title="Rename">
                <i class="fa-solid fa-pencil"></i>
              </button>
              <button class="icon-btn small danger delete-drawing-btn" title="Delete">
                <i class="fa-regular fa-trash-can"></i>
              </button>
            </div>
          </div>
          <span class="gallery-card-date">${dateStr}</span>
        </div>
      `;

      // Bind actions
      card.querySelector('.load-drawing-btn').addEventListener('click', () => {
        this.loadDrawing(d.id);
      });

      card.querySelector('.rename-drawing-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        this.renameDrawing(d.id, d.title);
      });

      card.querySelector('.delete-drawing-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        this.deleteDrawing(d.id, d.title);
      });

      grid.appendChild(card);
    });
  }

  async loadDrawing(drawingId) {
    try {
      events.emit('toast', { message: 'Loading drawing from cloud...' });
      const full = await supabaseService.getDrawingById(drawingId);
      if (!full || !full.data) {
        throw new Error('Drawing data is empty or invalid.');
      }

      if (this.projectManager) {
        await this.projectManager.loadProjectData(full.data, full.title, drawingId);
        events.emit('toast', { message: `Opened "${full.title}"` });
        this.close();
      }
    } catch (err) {
      events.emit('toast', { message: 'Failed to load drawing: ' + err.message, type: 'danger' });
    }
  }

  async renameDrawing(drawingId, currentTitle) {
    const newTitle = prompt('Enter new drawing title:', currentTitle);
    if (!newTitle || newTitle.trim() === currentTitle) return;

    try {
      await supabaseService.renameDrawing(drawingId, newTitle.trim());
      events.emit('toast', { message: 'Drawing renamed successfully.' });
      await this.fetchAndRenderDrawings();
    } catch (err) {
      events.emit('toast', { message: 'Rename failed: ' + err.message, type: 'danger' });
    }
  }

  async deleteDrawing(drawingId, title) {
    if (!confirm(`Are you sure you want to delete "${title || 'Untitled'}"? This cannot be undone.`)) {
      return;
    }

    try {
      await supabaseService.deleteDrawing(drawingId);
      events.emit('toast', { message: 'Drawing deleted.' });
      await this.fetchAndRenderDrawings();
    } catch (err) {
      events.emit('toast', { message: 'Delete failed: ' + err.message, type: 'danger' });
    }
  }
}
