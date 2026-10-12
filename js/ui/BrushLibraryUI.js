/**
 * The Craft — Brush Library UI
 * Sleek, glassmorphic flyout drawer providing instant access to all 180+
 * procedural brushes organized across 13 creative categories, plus Favorites.
 * Each brush features individual pro settings matching Kreska / Procreate:
 * Size control (OFF/Pressure/Velocity), Minimum size (px), Opacity control, Auto-color, and Stabilizer strength.
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
    this.expandedSettings = new Set(); // Set of brush IDs with settings panel open

    // Default brush preset
    if (!this.toolManager.toolState.activeBrushPreset) {
      this.toolManager.toolState.activeBrushPreset = 'basic_medium_round';
    }

    // Default: selected brush preset has its settings expanded
    this.expandedSettings.add(this.toolManager.toolState.activeBrushPreset);

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
              <span class="brush-lib-subtitle">180+ procedural digital brushes with pro dynamics</span>
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
            <!-- Dynamically populated in updateCategoryTabs -->
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

    this.updateCategoryTabs();
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

    // Delegated click handling on brush cards & interactive settings controls
    this.gridEl.addEventListener('click', (e) => {
      // 1. Favorite Heart Toggle
      const favBtn = e.target.closest('.brush-fav-btn');
      if (favBtn) {
        e.stopPropagation();
        const brushId = favBtn.dataset.brushId;
        const cur = brushEngine.getBrushSettings(brushId);
        const next = !cur.isFavorite;
        brushEngine.updateBrushSetting(brushId, 'isFavorite', next);
        favBtn.classList.toggle('active', next);
        favBtn.innerHTML = next ? '<i class="fa-solid fa-heart"></i>' : '<i class="fa-regular fa-heart"></i>';
        this.updateCategoryTabs();
        if (this.activeCategory === 'favorites') {
          this.renderBrushGrid();
        }
        return;
      }

      // 2. Settings Slider Toggle Button (🎛️)
      const settingsToggleBtn = e.target.closest('.brush-settings-toggle-btn');
      if (settingsToggleBtn) {
        e.stopPropagation();
        const brushId = settingsToggleBtn.dataset.brushId;
        const panel = this.gridEl.querySelector(`.brush-settings-panel[data-brush-id="${brushId}"]`);
        if (panel) {
          const isExpanded = this.expandedSettings.has(brushId);
          if (isExpanded) {
            this.expandedSettings.delete(brushId);
            panel.classList.add('collapsed');
            settingsToggleBtn.classList.remove('active');
          } else {
            this.expandedSettings.add(brushId);
            panel.classList.remove('collapsed');
            settingsToggleBtn.classList.add('active');
          }
        }
        return;
      }

      // 3. Size Control Toggle (OFF -> Pressure -> Velocity -> OFF)
      const sizeBtn = e.target.closest('.pill-size-control');
      if (sizeBtn) {
        e.stopPropagation();
        const brushId = sizeBtn.dataset.brushId;
        const cur = brushEngine.getBrushSettings(brushId);
        const states = ['OFF', 'Pressure', 'Velocity'];
        const nextIdx = (states.indexOf(cur.sizeControl) + 1) % states.length;
        const nextVal = states[nextIdx];
        brushEngine.updateBrushSetting(brushId, 'sizeControl', nextVal);
        sizeBtn.querySelector('.setting-val').textContent = nextVal;
        sizeBtn.classList.toggle('has-value', nextVal !== 'OFF');
        return;
      }

      // 4. Opacity Control Toggle (OFF -> Pressure -> Velocity -> OFF)
      const opBtn = e.target.closest('.pill-opacity-control');
      if (opBtn) {
        e.stopPropagation();
        const brushId = opBtn.dataset.brushId;
        const cur = brushEngine.getBrushSettings(brushId);
        const states = ['OFF', 'Pressure', 'Velocity'];
        const nextIdx = (states.indexOf(cur.opacityControl) + 1) % states.length;
        const nextVal = states[nextIdx];
        brushEngine.updateBrushSetting(brushId, 'opacityControl', nextVal);
        opBtn.querySelector('.setting-val').textContent = nextVal;
        opBtn.classList.toggle('has-value', nextVal !== 'OFF');
        return;
      }

      // 5. Auto-color Toggle (OFF -> ON -> OFF)
      const autoColorBtn = e.target.closest('.pill-auto-color');
      if (autoColorBtn) {
        e.stopPropagation();
        const brushId = autoColorBtn.dataset.brushId;
        const cur = brushEngine.getBrushSettings(brushId);
        const nextVal = !cur.autoColor;
        brushEngine.updateBrushSetting(brushId, 'autoColor', nextVal);
        autoColorBtn.querySelector('.setting-val').textContent = nextVal ? 'ON' : 'OFF';
        autoColorBtn.classList.toggle('has-value', nextVal);
        return;
      }

      // 6. Card selection (clicking preview or card body)
      const card = e.target.closest('.brush-card');
      if (!card) return;
      if (e.target.closest('input, button')) return;

      const brushId = card.dataset.brushId;
      if (brushId) {
        this.selectBrush(brushId);
        // Automatically expand settings for selected card
        this.expandedSettings.add(brushId);
        const panel = card.querySelector(`.brush-settings-panel`);
        if (panel) panel.classList.remove('collapsed');
        const stBtn = card.querySelector('.brush-settings-toggle-btn');
        if (stBtn) stBtn.classList.add('active');
      }
    });

    // Slider inputs (Minimum size & Stabilizer strength)
    this.gridEl.addEventListener('input', (e) => {
      const slider = e.target;
      if (slider.classList.contains('min-size-slider')) {
        e.stopPropagation();
        const brushId = slider.dataset.brushId;
        const val = parseFloat(slider.value);
        brushEngine.updateBrushSetting(brushId, 'minSize', val);
        const badge = slider.closest('.pill-min-size')?.querySelector('.circular-val-badge');
        if (badge) badge.textContent = val.toFixed(1);
      } else if (slider.classList.contains('stabilizer-slider')) {
        e.stopPropagation();
        const brushId = slider.dataset.brushId;
        const val = parseFloat(slider.value);
        brushEngine.updateBrushSetting(brushId, 'stabilizer', val);
        const badge = slider.closest('.pill-stabilizer')?.querySelector('.circular-val-badge');
        if (badge) badge.textContent = val.toFixed(1);
      }
    });
  }

  updateCategoryTabs() {
    const favCount = brushEngine.getFavorites().length;
    const allCategories = [
      { id: 'favorites', label: 'Favorites', icon: 'fa-heart', count: favCount },
      ...BRUSH_CATEGORIES
    ];

    this.catListEl.innerHTML = allCategories.map(cat => `
      <button class="brush-cat-btn ${cat.id === this.activeCategory ? 'active' : ''}" data-cat="${cat.id}">
        <div class="cat-label-wrap">
          <i class="fa-solid ${cat.icon} cat-icon ${cat.id === 'favorites' ? 'fav-cat-icon' : ''}"></i>
          <span>${cat.label}</span>
        </div>
        <span class="cat-badge">${cat.count}</span>
      </button>
    `).join('');

    const activeCatObj = allCategories.find(c => c.id === this.activeCategory);
    if (activeCatObj) {
      this.titleEl.textContent = activeCatObj.label;
      this.countEl.textContent = `${activeCatObj.count} Brushes`;
    }
  }

  getFilteredBrushes() {
    if (this.activeCategory === 'favorites') {
      const favs = brushEngine.getFavorites();
      if (!this.searchQuery) return favs;
      return favs.filter(b => b.name.toLowerCase().includes(this.searchQuery) || b.desc.toLowerCase().includes(this.searchQuery));
    }

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
          <i class="fa-solid fa-paintbrush"></i>
          <h4>${this.activeCategory === 'favorites' ? 'No favorites yet' : 'No brushes found'}</h4>
          <p>${this.activeCategory === 'favorites' ? 'Click the heart icon on any brush card to save it here for quick access.' : 'Try searching for words like "soft", "pencil", "rake", or "grainy".'}</p>
        </div>
      `;
      return;
    }

    this.gridEl.innerHTML = brushes.map(b => {
      const isSelected = activePreset === b.id;
      const settings = brushEngine.getBrushSettings(b.id);
      const isExpanded = this.expandedSettings.has(b.id) || isSelected;

      return `
        <div class="brush-card ${isSelected ? 'selected' : ''}" data-brush-id="${b.id}">
          <!-- Card Header: Title & Favorite Heart -->
          <div class="brush-card-header">
            <span class="brush-card-title">${b.name}</span>
            <button class="brush-fav-btn ${settings.isFavorite ? 'active' : ''}" data-brush-id="${b.id}" title="${settings.isFavorite ? 'Remove Favorite' : 'Add to Favorites'}">
              <i class="${settings.isFavorite ? 'fa-solid fa-heart' : 'fa-regular fa-heart'}"></i>
            </button>
          </div>

          <!-- Card Preview: S-Curve Image & Settings Toggle Icon -->
          <div class="brush-card-preview-wrap">
            <img class="brush-card-preview" id="preview_${b.id}" alt="${b.name}" />
            <button class="brush-settings-toggle-btn ${isExpanded ? 'active' : ''}" data-brush-id="${b.id}" title="Toggle Brush Dynamics Settings">
              <i class="fa-solid fa-sliders"></i>
            </button>
          </div>

          <!-- Brush Settings Panel (Exact layout matching pro image) -->
          <div class="brush-settings-panel ${isExpanded ? '' : 'collapsed'}" data-brush-id="${b.id}">
            <!-- 1. Size control -->
            <button class="brush-setting-pill pill-size-control ${settings.sizeControl !== 'OFF' ? 'has-value' : ''}" data-brush-id="${b.id}" title="Toggle Size Control (OFF / Pressure / Velocity)">
              <span>Size control <strong class="setting-val">${settings.sizeControl}</strong></span>
            </button>

            <!-- 2. Minimum size (px) with circular badge & interactive slider -->
            <div class="brush-setting-pill pill-min-size" data-brush-id="${b.id}" title="Adjust Minimum Stroke Size">
              <div class="pill-row-top">
                <div class="circular-val-badge">${settings.minSize.toFixed(1)}</div>
                <span class="pill-label">Minimum size (px)</span>
              </div>
              <input type="range" class="pill-slider min-size-slider" min="0.5" max="20" step="0.5" value="${settings.minSize}" data-brush-id="${b.id}" />
            </div>

            <!-- 3. Opacity control -->
            <button class="brush-setting-pill pill-opacity-control ${settings.opacityControl !== 'OFF' ? 'has-value' : ''}" data-brush-id="${b.id}" title="Toggle Opacity Control (OFF / Pressure / Velocity)">
              <span>Opacity control <strong class="setting-val">${settings.opacityControl}</strong></span>
            </button>

            <!-- 4. Auto-color -->
            <button class="brush-setting-pill pill-auto-color ${settings.autoColor ? 'has-value' : ''}" data-brush-id="${b.id}" title="Toggle Auto-color">
              <span>Auto-color <strong class="setting-val">${settings.autoColor ? 'ON' : 'OFF'}</strong></span>
            </button>

            <!-- 5. Stabilizer strength with circular badge & interactive slider -->
            <div class="brush-setting-pill pill-stabilizer" data-brush-id="${b.id}" title="Adjust Stroke Stabilizer / Streamline Strength">
              <div class="pill-row-top">
                <div class="circular-val-badge">${settings.stabilizer.toFixed(1)}</div>
                <span class="pill-label">Stabilizer strength</span>
              </div>
              <input type="range" class="pill-slider stabilizer-slider" min="0.0" max="1.0" step="0.1" value="${settings.stabilizer}" data-brush-id="${b.id}" />
            </div>
          </div>
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
          const previewUrl = brushEngine.generatePreviewCanvas(b.id, 160, 42, curColor);
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
      if (typeof this.toolManager.setActiveTool === 'function') {
        this.toolManager.setActiveTool('brush');
      } else if (typeof this.toolManager.setTool === 'function') {
        this.toolManager.setTool('brush');
      }
    }

    this.updateActiveBadge();

    // Re-render grid selection indicator
    const cards = this.gridEl.querySelectorAll('.brush-card');
    cards.forEach(c => {
      if (c.dataset.brushId === brushId) {
        c.classList.add('selected');
      } else {
        c.classList.remove('selected');
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
