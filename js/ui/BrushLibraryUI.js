/**
 * The Craft — Brush Library UI
 * Sleek, glassmorphic flyout drawer providing instant access to all 180+
 * procedural brushes organized across 13 creative categories.
 */
import { BRUSH_CATEGORIES, BRUSH_CATALOG, brushEngine } from '../brushes/ProceduralBrushEngine.js';
import { events } from '../core/EventBus.js';

export class BrushLibraryUI {
  constructor(toolManager) {
    this.toolManager = toolManager;
    this.activeCategory = 'airbrush';
    this.searchQuery = '';
    this.isOpen = false;
    this.previewCache = new Map();

    // Default brush preset
    if (!this.toolManager.toolState.activeBrushPreset) {
      this.toolManager.toolState.activeBrushPreset = 'basic_medium_round';
    }

    this.createDom();
    this.bindEvents();
  }

  createDom() {
    this.container = document.createElement('div');
    this.container.id = 'brushLibraryModal';
    this.container.className = 'brush-library-overlay hidden';

    this.container.innerHTML = `
      <div class="brush-library-panel" id="brushLibraryPanel">
        <!-- Panel Header -->
        <div class="brush-lib-header">
          <div class="brush-lib-title-wrap">
            <div class="brush-lib-icon-badge">
              <i class="fa-solid fa-paintbrush"></i>
            </div>
            <div>
              <h2 class="brush-lib-title">Brush Library</h2>
              <span class="brush-lib-subtitle">180+ handcrafted procedural digital brushes</span>
            </div>
          </div>

          <div class="brush-lib-search-box">
            <i class="fa-solid fa-magnifying-glass search-icon"></i>
            <input type="text" id="brushSearchInput" placeholder="Search brushes (e.g. Grainy, 6B, Hair, Smoke)..." autocomplete="off" />
            <button id="clearBrushSearchBtn" class="clear-search-btn hidden">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>

          <button id="closeBrushLibBtn" class="brush-lib-close-btn" title="Close Library (Esc)">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <!-- Panel Body -->
        <div class="brush-lib-body">
          <!-- Left Categories Sidebar -->
          <aside class="brush-lib-sidebar" id="brushCategoriesList">
            ${BRUSH_CATEGORIES.map(cat => `
              <button class="brush-cat-btn ${cat.id === this.activeCategory ? 'active' : ''}" data-cat="${cat.id}">
                <div class="cat-label-wrap">
                  <i class="fa-solid ${cat.icon} cat-icon"></i>
                  <span>${cat.label}</span>
                </div>
                <span class="cat-badge">${cat.count}</span>
              </button>
            `).join('')}
          </aside>

          <!-- Right Brush Grid Content -->
          <main class="brush-lib-content">
            <div class="brush-grid-header">
              <h3 id="currentCategoryTitle" class="current-cat-name">Airbrush</h3>
              <span id="currentCategoryCount" class="current-cat-meta">8 Brushes</span>
            </div>
            <div class="brush-grid" id="brushGrid">
              <!-- Dynamically populated -->
            </div>
          </main>
        </div>

        <!-- Panel Footer -->
        <div class="brush-lib-footer">
          <div class="active-brush-pill" id="activeBrushPill">
            <span class="active-pill-label">Active:</span>
            <strong id="activeBrushName">Medium Round</strong>
            <span class="active-pill-cat" id="activeBrushCat">[Basic]</span>
          </div>
          <button id="doneBrushLibBtn" class="btn primary-btn done-btn">Done</button>
        </div>
      </div>
    `;

    document.body.appendChild(this.container);

    this.panelEl = this.container.querySelector('#brushLibraryPanel');
    this.gridEl = this.container.querySelector('#brushGrid');
    this.catListEl = this.container.querySelector('#brushCategoriesList');
    this.searchInput = this.container.querySelector('#brushSearchInput');
    this.clearSearchBtn = this.container.querySelector('#clearBrushSearchBtn');
    this.titleEl = this.container.querySelector('#currentCategoryTitle');
    this.countEl = this.container.querySelector('#currentCategoryCount');
    this.activeNameEl = this.container.querySelector('#activeBrushName');
    this.activeCatEl = this.container.querySelector('#activeBrushCat');

    this.renderBrushGrid();
    this.updateActiveBadge();
  }

  bindEvents() {
    // Category click
    this.catListEl.addEventListener('click', (e) => {
      const btn = e.target.closest('.brush-cat-btn');
      if (!btn) return;
      const catId = btn.dataset.cat;
      if (catId) {
        this.activeCategory = catId;
        this.searchQuery = '';
        this.searchInput.value = '';
        this.clearSearchBtn.classList.add('hidden');
        this.updateCategoryTabs();
        this.renderBrushGrid();
      }
    });

    // Search input
    this.searchInput.addEventListener('input', (e) => {
      this.searchQuery = e.target.value.trim().toLowerCase();
      if (this.searchQuery) {
        this.clearSearchBtn.classList.remove('hidden');
      } else {
        this.clearSearchBtn.classList.add('hidden');
      }
      this.renderBrushGrid();
    });

    this.clearSearchBtn.addEventListener('click', () => {
      this.searchQuery = '';
      this.searchInput.value = '';
      this.clearSearchBtn.classList.add('hidden');
      this.renderBrushGrid();
    });

    // Close buttons
    this.container.querySelector('#closeBrushLibBtn').addEventListener('click', () => this.close());
    this.container.querySelector('#doneBrushLibBtn').addEventListener('click', () => this.close());

    // Click outside panel to close
    this.container.addEventListener('click', (e) => {
      if (e.target === this.container) {
        this.close();
      }
    });

    // Keyboard ESC
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.close();
      }
    });

    // Grid selection click
    this.gridEl.addEventListener('click', (e) => {
      const card = e.target.closest('.brush-card');
      if (!card) return;
      const brushId = card.dataset.brushId;
      if (brushId) {
        this.selectBrush(brushId);
      }
    });
  }

  updateCategoryTabs() {
    const btns = this.catListEl.querySelectorAll('.brush-cat-btn');
    btns.forEach(btn => {
      if (btn.dataset.cat === this.activeCategory) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    const catObj = BRUSH_CATEGORIES.find(c => c.id === this.activeCategory);
    if (catObj) {
      this.titleEl.textContent = catObj.label;
      this.countEl.textContent = `${catObj.count} Brushes`;
    }
  }

  getFilteredBrushes() {
    if (!this.searchQuery) {
      return (BRUSH_CATALOG[this.activeCategory] || []).map(b => ({ ...b, cat: this.activeCategory }));
    }

    // Search across all categories
    const results = [];
    for (const [catId, list] of Object.entries(BRUSH_CATALOG)) {
      for (const brush of list) {
        if (
          brush.name.toLowerCase().includes(this.searchQuery) ||
          brush.desc.toLowerCase().includes(this.searchQuery) ||
          catId.toLowerCase().includes(this.searchQuery)
        ) {
          results.push({ ...brush, cat: catId });
        }
      }
    }
    return results;
  }

  renderBrushGrid() {
    const brushes = this.getFilteredBrushes();
    const activePreset = this.toolManager.toolState.activeBrushPreset;
    const curColor = this.toolManager.toolState.color || '#6366f1';

    if (this.searchQuery) {
      this.titleEl.textContent = `Search Results`;
      this.countEl.textContent = `${brushes.length} found for "${this.searchQuery}"`;
    }

    if (brushes.length === 0) {
      this.gridEl.innerHTML = `
        <div class="brush-empty-state">
          <i class="fa-solid fa-magnifying-glass"></i>
          <h4>No brushes found</h4>
          <p>Try searching for words like "soft", "pencil", "rake", or "dots".</p>
        </div>
      `;
      return;
    }

    this.gridEl.innerHTML = brushes.map(b => {
      const isSelected = activePreset === b.id;
      return `
        <div class="brush-card ${isSelected ? 'selected' : ''}" data-brush-id="${b.id}" title="${b.desc}">
          <div class="brush-card-preview-wrap">
            <img class="brush-card-preview" id="preview_${b.id}" alt="${b.name}" />
          </div>
          <div class="brush-card-info">
            <span class="brush-card-name">${b.name}</span>
            <span class="brush-card-desc">${b.desc}</span>
          </div>
          ${isSelected ? '<div class="brush-card-active-check"><i class="fa-solid fa-check"></i></div>' : ''}
        </div>
      `;
    }).join('');

    // Generate and inject preview thumbnails asynchronously
    requestAnimationFrame(() => {
      brushes.forEach(b => {
        const img = this.gridEl.querySelector(`#preview_${b.id}`);
        if (!img) return;

        const cacheKey = `${b.id}_${curColor}`;
        if (this.previewCache.has(cacheKey)) {
          img.src = this.previewCache.get(cacheKey);
        } else {
          const previewUrl = brushEngine.generatePreviewCanvas(b.id, 140, 36, curColor);
          this.previewCache.set(cacheKey, previewUrl);
          img.src = previewUrl;
        }
      });
    });
  }

  selectBrush(brushId) {
    const brush = brushEngine.getBrushById(brushId);
    if (!brush) return;

    this.toolManager.toolState.activeBrushPreset = brushId;

    // Ensure active tool is BrushTool
    if (this.toolManager.activeTool?.id !== 'brush') {
      this.toolManager.setTool('brush');
    }

    this.updateActiveBadge();

    // Re-render grid selection indicator
    const cards = this.gridEl.querySelectorAll('.brush-card');
    cards.forEach(c => {
      if (c.dataset.brushId === brushId) {
        c.classList.add('selected');
        if (!c.querySelector('.brush-card-active-check')) {
          const check = document.createElement('div');
          check.className = 'brush-card-active-check';
          check.innerHTML = '<i class="fa-solid fa-check"></i>';
          c.appendChild(check);
        }
      } else {
        c.classList.remove('selected');
        const check = c.querySelector('.brush-card-active-check');
        if (check) check.remove();
      }
    });

    events.emit('brush:selected', { brushId, brush });

    // Toast feedback
    if (window.showToast) {
      window.showToast(`Selected Brush: ${brush.name}`, 'info');
    }
  }

  updateActiveBadge() {
    const activePreset = this.toolManager.toolState.activeBrushPreset;
    const brush = brushEngine.getBrushById(activePreset);
    if (brush) {
      this.activeNameEl.textContent = brush.name;
      const catObj = BRUSH_CATEGORIES.find(c => c.id === (brush.category || this.activeCategory));
      this.activeCatEl.textContent = `[${catObj ? catObj.label : 'Basic'}]`;

      // Update button on toolbar/dock if it exists
      const btnLabel = document.getElementById('activeBrushDockLabel');
      if (btnLabel) {
        btnLabel.textContent = brush.name;
      }
    }
  }

  open() {
    this.isOpen = true;
    this.container.classList.remove('hidden');
    this.updateActiveBadge();
    this.updateCategoryTabs();
    this.renderBrushGrid();
    setTimeout(() => {
      this.searchInput.focus();
    }, 50);
  }

  close() {
    this.isOpen = false;
    this.container.classList.add('hidden');
  }

  toggle() {
    if (this.isOpen) this.close();
    else this.open();
  }
}
