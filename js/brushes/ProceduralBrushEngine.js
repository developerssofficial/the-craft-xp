import { brushAssetManager } from './BrushAssetManager.js';
import { BRUSH_CATALOG } from './BrushCatalogData.js';
export { BRUSH_CATALOG };
/**
 * The Craft — Procedural Brush Engine
 * High-performance, 60-120 FPS procedural digital painting engine.
 * Implements 180+ artisan digital brushes organized across 13 creative categories:
 * Airbrush, Basic, Caligraphy, Charcoal, Elements, Hair, Halftone, Inking, Outline, Particles, Pixel, Sketching, Watercolor.
 */

/**
 * High-performance deterministic PRNG based on coordinates & seed.
 * Guarantees that identical stroke coordinates produce 100% deterministic, frozen procedural grain/noise across redraws.
 */
export function coordRand(x, y, seed = 0) {
  const n = Math.sin(x * 12.9898 + y * 78.233 + (seed + 1) * 37.719) * 43758.5453123;
  return n - Math.floor(n);
}

/**
 * Robust color-to-RGBA converter preserving hue and saturation during alpha fade.
 * Guarantees zero dark/dirty rims during radial gradient interpolation.
 */
export function colorToRgba(color, alpha = 1.0) {
  if (!color) return `rgba(99, 102, 241, ${alpha})`;
  if (color.startsWith('#')) {
    let c = color.replace('#', '');
    if (c.length === 3) c = c.split('').map(x => x + x).join('');
    if (c.length === 6) {
      const r = parseInt(c.substring(0, 2), 16);
      const g = parseInt(c.substring(2, 4), 16);
      const b = parseInt(c.substring(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
  } else if (color.startsWith('rgba')) {
    const parts = color.match(/[\d.]+/g);
    if (parts && parts.length >= 3) {
      return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${alpha})`;
    }
  } else if (color.startsWith('rgb')) {
    const parts = color.match(/[\d.]+/g);
    if (parts && parts.length >= 3) {
      return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${alpha})`;
    }
  } else if (color.startsWith('hsl')) {
    return color.replace('hsl(', 'hsla(').replace(')', `, ${alpha})`);
  }
  return color;
}

export const BRUSH_CATEGORIES = [
  { id: 'airbrush', label: 'Airbrush', icon: 'fa-spray-can', count: 8 },
  { id: 'basic', label: 'Basic', icon: 'fa-circle-dot', count: 25 },
  { id: 'caligraphy', label: 'Caligraphy', icon: 'fa-pen-nib', count: 12 },
  { id: 'charcoal', label: 'Charcoal', icon: 'fa-cubes-stacked', count: 4 },
  { id: 'elements', label: 'Elements', icon: 'fa-wind', count: 11 },
  { id: 'hair', label: 'Hair', icon: 'fa-bars-staggered', count: 26 },
  { id: 'halftone', label: 'Halftone', icon: 'fa-braille', count: 23 },
  { id: 'inking', label: 'Inking', icon: 'fa-feather-pointed', count: 18 },
  { id: 'outline', label: 'Outline', icon: 'fa-square-full', count: 6 },
  { id: 'particles', label: 'Particles', icon: 'fa-wand-magic-sparkles', count: 7 },
  { id: 'pixel', label: 'Pixel', icon: 'fa-chess-board', count: 8 },
  { id: 'sketching', label: 'Sketching', icon: 'fa-pencil', count: 14 },
  { id: 'watercolor', label: 'Watercolor', icon: 'fa-droplet', count: 5 }
];


export const DEFAULT_BRUSH_SETTINGS = {
  sizeControl: 'OFF',        // 'OFF' | 'Pressure' | 'Velocity'
  minSize: 1.0,              // 0.5 to 20 px
  opacityControl: 'OFF',     // 'OFF' | 'Pressure' | 'Velocity'
  autoColor: false,          // false | true
  stabilizer: 0.0,           // 0.0 to 1.0
  isFavorite: false          // false | true
};

/**
 * Procedural Brush Engine
 * Handles rendering strokes onto any 2D canvas context.
 */
export class ProceduralBrushEngine {
  constructor() {
    this.stampCache = new Map();
    this.settingsCache = new Map();
    this.assetManager = brushAssetManager;
    this.strokeBufferCanvas = null;
    this.storageKey = 'thecraft_brush_settings_v2';
    this.loadAllSettings();
  }

  
  getStrokeBuffer(width, height) {
    if (!this.strokeBufferCanvas) {
      this.strokeBufferCanvas = document.createElement('canvas');
    }
    const curW = this.strokeBufferCanvas.width;
    const curH = this.strokeBufferCanvas.height;
    if (curW < width || curH < height) {
      this.strokeBufferCanvas.width = Math.max(curW, width);
      this.strokeBufferCanvas.height = Math.max(curH, height);
    }
    return this.strokeBufferCanvas;
  }

  renderTexturedImageBrush(ctx, pts, color, baseSize, usePressure, brush) {
    if (!pts || pts.length === 0) return;

    // 1. Bounding box with safety margin
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const padding = Math.max(40, baseSize * 2.5);
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    minX = Math.floor(minX - padding);
    minY = Math.floor(minY - padding);
    maxX = Math.ceil(maxX + padding);
    maxY = Math.ceil(maxY + padding);
    const width = Math.max(1, maxX - minX);
    const height = Math.max(1, maxY - minY);

    // 2. Offscreen stroke buffer
    const bufCanvas = this.getStrokeBuffer(width, height);
    const bufCtx = bufCanvas.getContext('2d');
    bufCtx.clearRect(0, 0, width, height);

    // 3. Distance spacing along path
    const spacingPercent = (brush.spacing !== undefined && brush.spacing > 0) ? brush.spacing : 15;
    const stepDist = Math.max(1.0, baseSize * (spacingPercent / 100));

    // 4. Dab stamp renderer
    let stampIndex = 0;
    const drawStampAt = (x, y, press, angle) => {
      const dabSize = Math.max(1.0, baseSize * (usePressure ? press : 1.0));
      let dabAlpha = brush.defaultOpacity !== undefined ? brush.defaultOpacity : (brush.opacity !== undefined ? brush.opacity : 1.0);
      if (brush.opacityControl && usePressure) {
        dabAlpha = Math.min(1.0, dabAlpha * press);
      }

      const localX = x - minX;
      const localY = y - minY;

      bufCtx.save();
      bufCtx.translate(localX, localY);
      bufCtx.globalAlpha = Math.max(0.01, Math.min(1.0, dabAlpha));

      // Rotation handling
      if (brush.rotation === 'random') {
        const r = (coordRand(x, y, stampIndex * 7) * 2 - 1) * Math.PI;
        bufCtx.rotate(r);
      } else if (brush.rotation === 'follow' && angle !== undefined) {
        bufCtx.rotate(angle);
      } else if (typeof brush.rotation === 'number') {
        bufCtx.rotate(brush.rotation);
      }

      // Seamless horizontal or parallel flip
      if (brush.seamless === 'horizontal' || brush.seamless === 'parallel') {
        const flip = coordRand(x, y, stampIndex * 13) < 0.5 ? -1 : 1;
        bufCtx.scale(flip, 1);
      }

      // Stamp shape or direct circle
      if (brush.image) {
        const tileIndex = brush.tiled ? (stampIndex % 4) : 0;
        const dab = this.assetManager.getTintedDab(brush.image, color, tileIndex);
        if (dab) {
          bufCtx.drawImage(dab, -dabSize / 2, -dabSize / 2, dabSize, dabSize);
        } else {
          bufCtx.fillStyle = color;
          bufCtx.beginPath();
          bufCtx.arc(0, 0, dabSize / 2, 0, Math.PI * 2);
          bufCtx.fill();
        }
      } else {
        // Direct brush with paper grain texture
        bufCtx.fillStyle = color;
        bufCtx.beginPath();
        bufCtx.arc(0, 0, dabSize / 2, 0, Math.PI * 2);
        bufCtx.fill();
      }

      bufCtx.restore();
      stampIndex++;
    };

    // Walk polyline with stepDist interpolation
    if (pts.length === 1) {
      drawStampAt(pts[0].x, pts[0].y, pts[0].pressure || 0.5, 0);
    } else {
      let prev = pts[0];
      let distAcc = 0;
      drawStampAt(prev.x, prev.y, prev.pressure || 0.5, 0);

      for (let i = 1; i < pts.length; i++) {
        const curr = pts[i];
        const dx = curr.x - prev.x;
        const dy = curr.y - prev.y;
        const segLen = Math.hypot(dx, dy);
        if (segLen === 0) continue;

        const angle = Math.atan2(dy, dx);
        let t = 0;
        while (distAcc + (1 - t) * segLen >= stepDist) {
          const advance = stepDist - distAcc;
          t += advance / segLen;
          distAcc = 0;
          const x = prev.x + dx * t;
          const y = prev.y + dy * t;
          const press = (prev.pressure || 0.5) * (1 - t) + (curr.pressure || 0.5) * t;
          drawStampAt(x, y, press, angle);
        }
        distAcc += (1 - t) * segLen;
        prev = curr;
      }
    }

    // 5. Apply grain texture mask (destination-in)
    if (brush.texture) {
      const grainImg = this.assetManager.getImage(brush.texture);
      if (grainImg) {
        bufCtx.save();
        bufCtx.globalCompositeOperation = brush.composite || 'destination-in';
        const pat = bufCtx.createPattern(grainImg, 'repeat');
        if (pat) {
          if (typeof pat.setTransform === 'function') {
            const matrix = new DOMMatrix().translate(-minX, -minY);
            pat.setTransform(matrix);
          }
          bufCtx.fillStyle = pat;
          bufCtx.fillRect(0, 0, width, height);
        }
        bufCtx.restore();
      }
    }

    // 6. Draw buffered stroke onto canvas context
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(bufCanvas, 0, 0, width, height, minX, minY, width, height);
    ctx.restore();
  }

  loadAllSettings() {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        for (const [k, v] of Object.entries(parsed)) {
          this.settingsCache.set(k, { ...DEFAULT_BRUSH_SETTINGS, ...v });
        }
      }
    } catch (_) {}
  }

  saveAllSettings() {
    try {
      const obj = {};
      for (const [k, v] of this.settingsCache.entries()) {
        obj[k] = v;
      }
      localStorage.setItem(this.storageKey, JSON.stringify(obj));
    } catch (_) {}
  }

  getBrushSettings(brushId) {
    if (!brushId) return { ...DEFAULT_BRUSH_SETTINGS };
    if (!this.settingsCache.has(brushId)) {
      this.settingsCache.set(brushId, { ...DEFAULT_BRUSH_SETTINGS });
    }
    return this.settingsCache.get(brushId);
  }

  updateBrushSetting(brushId, key, value) {
    const s = this.getBrushSettings(brushId);
    s[key] = value;
    this.settingsCache.set(brushId, s);
    this.saveAllSettings();
    return s;
  }

  getFavorites() {
    const favs = [];
    for (const [catId, list] of Object.entries(BRUSH_CATALOG)) {
      for (const b of list) {
        const s = this.getBrushSettings(b.id);
        if (s.isFavorite) {
          favs.push({ ...b, cat: catId });
        }
      }
    }
    return favs;
  }

  getBrushById(brushId) {
    if (!brushId) return null;
    for (const cat of Object.keys(BRUSH_CATALOG)) {
      const found = BRUSH_CATALOG[cat].find(b => b.id === brushId);
      if (found) return found;
    }
    return null;
  }

  getAirbrushDab(color, soft = 0.6, grain = 0) {
    const key = `air_${color}_${soft.toFixed(2)}_${grain.toFixed(2)}`;
    if (this.stampCache.has(key)) return this.stampCache.get(key);

    const dabSize = 64;
    const canvas = document.createElement('canvas');
    canvas.width = dabSize;
    canvas.height = dabSize;
    const ctx = canvas.getContext('2d');
    const r = dabSize / 2;

    const centerAlpha = Math.max(0.04, Math.min(0.25, 0.14 * (1 - soft * 0.4)));
    const coreColor = colorToRgba(color, centerAlpha);
    const transparentColor = colorToRgba(color, 0);

    const grad = ctx.createRadialGradient(r, r, 0, r, r, r);
    grad.addColorStop(0, coreColor);
    grad.addColorStop(0.3, colorToRgba(color, centerAlpha * 0.7));
    grad.addColorStop(0.7, colorToRgba(color, centerAlpha * 0.25));
    grad.addColorStop(1, transparentColor);

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(r, r, r, 0, Math.PI * 2);
    ctx.fill();

    if (grain > 0) {
      const particleCount = Math.floor(r * grain * 3);
      ctx.fillStyle = color;
      for (let k = 0; k < particleCount; k++) {
        const angle = Math.random() * Math.PI * 2;
        const distRatio = Math.sqrt(Math.random());
        const dist = distRatio * (r * 0.95);
        const px = r + Math.cos(angle) * dist;
        const py = r + Math.sin(angle) * dist;
        ctx.globalAlpha = (1 - distRatio) * 0.4;
        ctx.fillRect(px, py, 1.2, 1.2);
      }
    }

    if (this.stampCache.size > 200) {
      this.stampCache.clear();
    }
    this.stampCache.set(key, canvas);
    return canvas;
  }

  getSoftDab(color, hardness = 0.5) {
    const key = `soft_${color}_${hardness.toFixed(2)}`;
    if (this.stampCache.has(key)) return this.stampCache.get(key);

    const dabSize = 64;
    const canvas = document.createElement('canvas');
    canvas.width = dabSize;
    canvas.height = dabSize;
    const ctx = canvas.getContext('2d');
    const r = dabSize / 2;

    const flowAlpha = Math.max(0.1, Math.min(0.35, hardness * 0.4 + 0.1));
    const grad = ctx.createRadialGradient(r, r, r * hardness * 0.6, r, r, r);
    grad.addColorStop(0, colorToRgba(color, flowAlpha));
    grad.addColorStop(hardness, colorToRgba(color, flowAlpha * 0.8));
    grad.addColorStop(1, colorToRgba(color, 0));

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(r, r, r, 0, Math.PI * 2);
    ctx.fill();

    if (this.stampCache.size > 200) {
      this.stampCache.clear();
    }
    this.stampCache.set(key, canvas);
    return canvas;
  }

  /**
   * Renders a stroke element with procedural brush dynamics (supports incremental live segment rendering)
   */
  renderStroke(ctx, stroke) {
    const pts = stroke.points;
    if (!pts || pts.length === 0) return;

    const brush = this.getBrushById(stroke.brushPreset) || (stroke.tool === 'pencil' ? this.getBrushById('sketching_pencil_hb') : null);
    const color = stroke.color || '#6366f1';
    const settings = stroke.brushSettings || this.getBrushSettings(stroke.brushPreset);

    let baseSize = stroke.size || 8;
    if (settings && typeof settings.minSize === 'number') {
      baseSize = Math.max(settings.minSize, baseSize);
    }

    let baseOpacity = stroke.opacity ?? 1.0;
    if (settings && settings.opacityControl === 'Pressure' && pts.length > 0) {
      const avgP = (pts[0].pressure || 0.5);
      baseOpacity = Math.max(0.08, baseOpacity * avgP);
    }

    let usePressure = stroke.usePressure;
    if (settings && settings.sizeControl === 'OFF') {
      usePressure = false;
    } else if (settings && (settings.sizeControl === 'Pressure' || settings.sizeControl === 'Velocity')) {
      usePressure = true;
    }

    ctx.save();
    ctx.globalAlpha = baseOpacity;

    if (!brush) {
      this.renderStandardStroke(ctx, pts, color, baseSize, usePressure);
      ctx.restore();
      return;
    }

    if (brush.image || brush.texture) {
      this.renderTexturedImageBrush(ctx, pts, color, baseSize, usePressure, brush);
      ctx.restore();
      return;
    }

    switch (brush.type) {
      case 'airbrush':
        this.renderAirbrush(ctx, pts, color, baseSize, usePressure, brush);
        break;
      case 'round':
      case 'round_fragmented':
        this.renderRound(ctx, pts, color, baseSize, usePressure, brush);
        break;
      case 'gel':
        this.renderGelPen(ctx, pts, color, baseSize, usePressure);
        break;
      case 'segmented':
        this.renderSegmented(ctx, pts, color, baseSize, usePressure, brush);
        break;
      case 'tube':
        this.renderTube(ctx, pts, color, baseSize, usePressure, brush);
        break;
      case 'barcode':
        this.renderBarcode(ctx, pts, color, baseSize, usePressure, brush);
        break;
      case 'stipple':
        this.renderStipple(ctx, pts, color, baseSize, usePressure, brush);
        break;
      case 'scatter_stipple':
        this.renderScatterStipple(ctx, pts, color, baseSize, usePressure, brush);
        break;
      case 'clods':
        this.renderClods(ctx, pts, color, baseSize, usePressure, brush);
        break;
      case 'square':
      case 'flat':
      case 'polygon':
      case 'trapezoid':
      case 'trapezoid_flat':
        this.renderShapeBrush(ctx, pts, color, baseSize, usePressure, brush);
        break;
      case 'ellipse':
      case 'ellipse_fragmented':
        this.renderEllipse(ctx, pts, color, baseSize, usePressure, brush);
        break;
      case 'caligraphy':
      case 'caligraphy_dir':
      case 'caligraphy_soft':
      case 'hook':
      case 'ribbon':
      case 'ribbon_twisted':
        this.renderCaligraphy(ctx, pts, color, baseSize, usePressure, brush);
        break;
      case 'charcoal':
      case 'chalk':
        this.renderCharcoal(ctx, pts, color, baseSize, usePressure, brush);
        break;
      case 'pencil':
      case 'pencil_tech':
      case 'pencil_round':
      case 'pencil_round_soft':
        this.renderPencil(ctx, pts, color, baseSize, usePressure, brush);
        break;
      case 'crayon':
        this.renderCrayon(ctx, pts, color, baseSize, usePressure, brush);
        break;
      case 'ink':
      case 'ink_smooth':
      case 'ink_fragmented':
      case 'ink_versatile':
      case 'ink_wash':
        this.renderInk(ctx, pts, color, baseSize, usePressure, brush);
        break;
      case 'ink_rough':
      case 'ink_rough_axis':
      case 'ink_dry':
      case 'ink_messy':
        this.renderDryRoughInk(ctx, pts, color, baseSize, usePressure, brush);
        break;
      case 'ink_splatter':
      case 'ink_droplets':
        this.renderInkSplatter(ctx, pts, color, baseSize, usePressure, brush);
        break;
      case 'rake':
        this.renderRake(ctx, pts, color, baseSize, usePressure, brush);
        break;
      case 'hair_multi':
      case 'hair_short':
      case 'hair_flowing':
      case 'hair_lash':
      case 'hair_tangled':
      case 'hair_curly':
      case 'hair_fur':
      case 'hair_tail':
      case 'hair_multi_shape':
        this.renderHair(ctx, pts, color, baseSize, usePressure, brush);
        break;
      case 'halftone_dots':
      case 'halftone_fixed_dots':
      case 'halftone_lines':
      case 'halftone_mesh':
      case 'spray_shader':
      case 'bayer_dither':
        this.renderHalftone(ctx, pts, color, baseSize, usePressure, brush);
        break;
      case 'outline':
      case 'outline_3d':
        this.renderOutline(ctx, pts, color, baseSize, usePressure, brush);
        break;
      case 'particles_noise':
      case 'particles_noise_dyn':
      case 'particles_bubbles':
        this.renderParticles(ctx, pts, color, baseSize, usePressure, brush);
        break;
      case 'pixel':
      case 'pixel_apart':
      case 'pixel_tiles':
      case 'pixel_line':
      case 'pixel_edge':
      case 'pixel_edge_axis':
      case 'pixel_twig':
        this.renderPixel(ctx, pts, color, baseSize, brush);
        break;
      case 'element_smoke':
      case 'element_smoke_flow':
      case 'element_flame':
      case 'element_flame_flow':
      case 'element_cloud':
        this.renderElementFX(ctx, pts, color, baseSize, usePressure, brush);
        break;
      case 'watercolor':
        this.renderWatercolor(ctx, pts, color, baseSize, usePressure, brush);
        break;
      default:
        this.renderStandardStroke(ctx, pts, color, baseSize, usePressure);
        break;
    }

    ctx.restore();
  }

  renderStandardStroke(ctx, pts, color, size, usePressure) {
    if (!pts || pts.length === 0) return;

    if (pts.length === 1) {
      const p = pts[0];
      const r = (p.pressure && usePressure ? size * p.pressure : size) / 2;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0.5, r), 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    if (!usePressure) {
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = color;
      ctx.lineWidth = size;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length - 1; i++) {
        const mx = (pts[i].x + pts[i + 1].x) / 2;
        const my = (pts[i].y + pts[i + 1].y) / 2;
        ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
      }
      ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
      ctx.stroke();
      return;
    }

    // Dynamic pressure ribbon with smooth contiguous polygon rendering (ZERO circular scallops)
    this.renderPressureRibbon(ctx, pts, color, size);
  }

  renderPressureRibbon(ctx, pts, color, size) {
    if (pts.length === 2) {
      const p0 = pts[0];
      const p1 = pts[1];
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = color;
      const w = size * (((p0.pressure || 0.5) + (p1.pressure || 0.5)) / 2);
      ctx.lineWidth = Math.max(0.5, w);
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
      return;
    }

    const n = pts.length;
    const widths = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const p = pts[i].pressure !== undefined ? pts[i].pressure : 0.5;
      widths[i] = Math.max(0.5, (size * Math.max(0.15, p)) / 2);
    }

    // Smooth widths along neighbors to eliminate any micro-jitter
    for (let i = 1; i < n - 1; i++) {
      widths[i] = (widths[i - 1] + widths[i] * 2 + widths[i + 1]) / 4;
    }

    const left = [];
    const right = [];

    for (let i = 0; i < n; i++) {
      let dx, dy;
      if (i === 0) {
        dx = pts[1].x - pts[0].x;
        dy = pts[1].y - pts[0].y;
      } else if (i === n - 1) {
        dx = pts[n - 1].x - pts[n - 2].x;
        dy = pts[n - 1].y - pts[n - 2].y;
      } else {
        dx = pts[i + 1].x - pts[i - 1].x;
        dy = pts[i + 1].y - pts[i - 1].y;
      }

      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      const w = widths[i];

      left.push({ x: pts[i].x + nx * w, y: pts[i].y + ny * w });
      right.push({ x: pts[i].x - nx * w, y: pts[i].y - ny * w });
    }

    ctx.fillStyle = color;

    // Start with smooth rounded tip at origin
    ctx.beginPath();
    ctx.arc(pts[0].x, pts[0].y, widths[0], 0, Math.PI * 2);
    ctx.fill();

    // End rounded tip
    ctx.beginPath();
    ctx.arc(pts[n - 1].x, pts[n - 1].y, widths[n - 1], 0, Math.PI * 2);
    ctx.fill();

    // Continuous body contour
    ctx.beginPath();
    ctx.moveTo(left[0].x, left[0].y);
    for (let i = 0; i < n - 1; i++) {
      const mx = (left[i].x + left[i + 1].x) / 2;
      const my = (left[i].y + left[i + 1].y) / 2;
      ctx.quadraticCurveTo(left[i].x, left[i].y, mx, my);
    }
    ctx.lineTo(left[n - 1].x, left[n - 1].y);
    ctx.lineTo(right[n - 1].x, right[n - 1].y);
    for (let i = n - 1; i > 0; i--) {
      const mx = (right[i].x + right[i - 1].x) / 2;
      const my = (right[i].y + right[i - 1].y) / 2;
      ctx.quadraticCurveTo(right[i].x, right[i].y, mx, my);
    }
    ctx.lineTo(right[0].x, right[0].y);
    ctx.closePath();
    ctx.fill();
  }

  renderAirbrush(ctx, pts, color, size, usePressure, brush) {
    if (!pts || pts.length === 0) return;
    const soft = brush.soft ?? 0.6;
    const grain = brush.grain ?? 0;
    const fuzzy = !!brush.fuzzy;

    // Smooth overlapping spacing with GPU-accelerated cached dab stamp
    const spacing = Math.max(2, size * 0.09);
    const dab = this.getAirbrushDab(color, soft, grain);

    for (let i = 0; i < pts.length - 1; i++) {
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const steps = Math.max(1, Math.floor(dist / spacing));

      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        let x = p1.x + (p2.x - p1.x) * t;
        let y = p1.y + (p2.y - p1.y) * t;
        const press = usePressure ? ((p1.pressure || 0.5) * (1 - t) + (p2.pressure || 0.5) * t) : 1.0;
        let r = Math.max(2, (size * press) / 2);

        if (fuzzy) {
          x += (coordRand(x, y, 1) - 0.5) * (r * 0.2);
          y += (coordRand(x, y, 2) - 0.5) * (r * 0.2);
        }

        ctx.drawImage(dab, x - r, y - r, r * 2, r * 2);
      }
    }
  }

  renderRound(ctx, pts, color, size, usePressure, brush) {
    const hardness = brush.hardness ?? 1.0;
    if (hardness >= 0.7) {
      this.renderStandardStroke(ctx, pts, color, size, usePressure);
      return;
    }

    const spacing = Math.max(2, size * 0.08);
    const dab = this.getSoftDab(color, hardness);

    for (let i = 0; i < pts.length - 1; i++) {
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const steps = Math.max(1, Math.floor(dist / spacing));

      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const x = p1.x + (p2.x - p1.x) * t;
        const y = p1.y + (p2.y - p1.y) * t;
        const press = usePressure ? ((p1.pressure || 0.5) * (1 - t) + (p2.pressure || 0.5) * t) : 1.0;
        const r = Math.max(1, (size * press) / 2);

        ctx.drawImage(dab, x - r, y - r, r * 2, r * 2);
      }
    }
  }

  renderGelPen(ctx, pts, color, size, usePressure) {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = color;
    ctx.lineWidth = size;
    ctx.shadowBlur = 1;
    ctx.shadowColor = color;
    this.renderStandardStroke(ctx, pts, color, size, usePressure);
    ctx.shadowBlur = 0;
  }

  renderSegmented(ctx, pts, color, size, usePressure, brush) {
    if (!pts || pts.length === 0) return;
    const gap = brush.segmentGap || 0.35;
    const spacing = Math.max(3, size * gap);
    ctx.fillStyle = color;

    for (let i = 0; i < pts.length - 1; i++) {
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const steps = Math.max(1, Math.floor(dist / spacing));

      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const x = p1.x + (p2.x - p1.x) * t;
        const y = p1.y + (p2.y - p1.y) * t;
        const press = usePressure ? ((p1.pressure || 0.5) * (1 - t) + (p2.pressure || 0.5) * t) : 1.0;
        const r = Math.max(1.5, (size * press) / 2);

        // Solid rounded segment bead
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();

        // Subtle internal contour collar on segment joint
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = Math.max(0.8, r * 0.25);
        ctx.beginPath();
        ctx.arc(x, y, r * 0.65, -Math.PI * 0.8, -Math.PI * 0.2);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  renderTube(ctx, pts, color, size, usePressure, brush) {
    if (pts.length < 2) {
      this.renderStandardStroke(ctx, pts, color, size, usePressure);
      return;
    }
    const n = pts.length;
    const widths = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const p = pts[i].pressure !== undefined ? pts[i].pressure : 0.5;
      widths[i] = Math.max(2, (size * (usePressure ? Math.max(0.2, p) : 1.0)) / 2);
    }
    for (let i = 1; i < n - 1; i++) {
      widths[i] = (widths[i - 1] + widths[i] * 2 + widths[i + 1]) / 4;
    }

    const left = [];
    const right = [];
    for (let i = 0; i < n; i++) {
      let dx, dy;
      if (i === 0) {
        dx = pts[1].x - pts[0].x;
        dy = pts[1].y - pts[0].y;
      } else if (i === n - 1) {
        dx = pts[n - 1].x - pts[n - 2].x;
        dy = pts[n - 1].y - pts[n - 2].y;
      } else {
        dx = pts[i + 1].x - pts[i - 1].x;
        dy = pts[i + 1].y - pts[i - 1].y;
      }
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      const w = widths[i];
      left.push({ x: pts[i].x + nx * w, y: pts[i].y + ny * w });
      right.push({ x: pts[i].x - nx * w, y: pts[i].y - ny * w });
    }

    // Outer contour boundaries (hollow tube walls)
    const wallW = Math.max(1, size * 0.12);
    ctx.strokeStyle = color;
    ctx.lineWidth = wallW;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Left wall
    ctx.beginPath();
    ctx.moveTo(left[0].x, left[0].y);
    for (let i = 1; i < n - 1; i++) {
      const mx = (left[i].x + left[i + 1].x) / 2;
      const my = (left[i].y + left[i + 1].y) / 2;
      ctx.quadraticCurveTo(left[i].x, left[i].y, mx, my);
    }
    ctx.lineTo(left[n - 1].x, left[n - 1].y);
    ctx.stroke();

    // Right wall
    ctx.beginPath();
    ctx.moveTo(right[0].x, right[0].y);
    for (let i = 1; i < n - 1; i++) {
      const mx = (right[i].x + right[i + 1].x) / 2;
      const my = (right[i].y + right[i + 1].y) / 2;
      ctx.quadraticCurveTo(right[i].x, right[i].y, mx, my);
    }
    ctx.lineTo(right[n - 1].x, right[n - 1].y);
    ctx.stroke();

    // Transverse ribbed contour segments across the tube body
    const ribSpacing = Math.max(4, size * 0.45);
    let accum = 0;
    ctx.lineWidth = Math.max(0.8, wallW * 0.7);
    for (let i = 0; i < n - 1; i++) {
      const segLen = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
      accum += segLen;
      if (accum >= ribSpacing) {
        accum = 0;
        ctx.beginPath();
        ctx.moveTo(left[i].x, left[i].y);
        const midX = (left[i].x + right[i].x) / 2 + (pts[i + 1].x - pts[i].x) * 0.2;
        const midY = (left[i].y + right[i].y) / 2 + (pts[i + 1].y - pts[i].y) * 0.2;
        ctx.quadraticCurveTo(midX, midY, right[i].x, right[i].y);
        ctx.stroke();
      }
    }
  }

  renderBarcode(ctx, pts, color, size, usePressure, brush) {
    if (!pts || pts.length < 2) {
      this.renderStandardStroke(ctx, pts, color, size, usePressure);
      return;
    }
    ctx.strokeStyle = color;
    ctx.lineCap = 'butt';
    const spacing = Math.max(2, size * 0.16);

    for (let i = 0; i < pts.length - 1; i++) {
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const steps = Math.max(1, Math.floor(dist / spacing));
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;

      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const x = p1.x + dx * t;
        const y = p1.y + dy * t;
        const press = usePressure ? ((p1.pressure || 0.5) * (1 - t) + (p2.pressure || 0.5) * t) : 1.0;
        const barLen = Math.max(2, size * press * (0.85 + (coordRand(x, y, 1) - 0.5) * 0.3));
        const barWidth = Math.max(1, (size * 0.1) * (0.6 + coordRand(x, y, 2) * 1.2));

        ctx.lineWidth = barWidth;
        ctx.beginPath();
        ctx.moveTo(x - nx * (barLen / 2), y - ny * (barLen / 2));
        ctx.lineTo(x + nx * (barLen / 2), y + ny * (barLen / 2));
        ctx.stroke();
      }
    }
  }

  renderStipple(ctx, pts, color, size, usePressure, brush) {
    if (!pts || pts.length === 0) return;
    const densityMod = brush.density === 'loose' ? 0.35 : 0.7;
    const spacing = Math.max(2, size * 0.12);
    ctx.fillStyle = color;

    for (let i = 0; i < pts.length - 1; i++) {
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const steps = Math.max(1, Math.floor(dist / spacing));

      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const x = p1.x + (p2.x - p1.x) * t;
        const y = p1.y + (p2.y - p1.y) * t;
        const press = usePressure ? ((p1.pressure || 0.5) * (1 - t) + (p2.pressure || 0.5) * t) : 1.0;
        const r = Math.max(2, (size * press) / 2);
        const dotCount = Math.floor(Math.max(2, r * 1.8 * densityMod));

        for (let k = 0; k < dotCount; k++) {
          const ang = coordRand(x, y, k * 3 + 1) * Math.PI * 2;
          const distRatio = Math.sqrt(coordRand(x, y, k * 3 + 2));
          const d = distRatio * r;
          const px = x + Math.cos(ang) * d;
          const py = y + Math.sin(ang) * d;
          const dotR = Math.max(0.6, (1 - distRatio * 0.5) * 1.4);
          ctx.beginPath();
          ctx.arc(px, py, dotR, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  renderScatterStipple(ctx, pts, color, size, usePressure, brush) {
    if (!pts || pts.length === 0) return;
    const isDense = brush.density === 'dense';
    const spacing = Math.max(2, size * 0.1);
    ctx.fillStyle = color;

    for (let i = 0; i < pts.length - 1; i++) {
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const steps = Math.max(1, Math.floor(dist / spacing));

      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const x = p1.x + (p2.x - p1.x) * t;
        const y = p1.y + (p2.y - p1.y) * t;
        const press = usePressure ? ((p1.pressure || 0.5) * (1 - t) + (p2.pressure || 0.5) * t) : 1.0;
        const r = Math.max(2, (size * press) * (isDense ? 0.7 : 0.9));
        const dotCount = Math.floor(Math.max(3, r * (isDense ? 2.5 : 1.4)));

        for (let k = 0; k < dotCount; k++) {
          const ang = coordRand(x, y, k * 4 + 1) * Math.PI * 2;
          const d = Math.pow(coordRand(x, y, k * 4 + 2), 0.7) * r;
          const px = x + Math.cos(ang) * d;
          const py = y + Math.sin(ang) * d;
          const dotSize = coordRand(x, y, k * 4 + 3) * 1.5 + 0.8;
          ctx.fillRect(px, py, dotSize, dotSize);
        }
      }
    }
  }

  renderClods(ctx, pts, color, size, usePressure, brush) {
    if (!pts || pts.length === 0) return;
    const scale = brush.scale || 1.0;
    const spacing = Math.max(3, size * 0.28 * scale);
    ctx.fillStyle = color;

    for (let i = 0; i < pts.length - 1; i++) {
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const steps = Math.max(1, Math.floor(dist / spacing));

      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const x = p1.x + (p2.x - p1.x) * t;
        const y = p1.y + (p2.y - p1.y) * t;
        const press = usePressure ? ((p1.pressure || 0.5) * (1 - t) + (p2.pressure || 0.5) * t) : 1.0;
        const baseR = Math.max(2.5, (size * press * scale) / 2);

        // Main irregular organic clod clump
        ctx.beginPath();
        const verts = 6;
        for (let v = 0; v < verts; v++) {
          const va = (v * Math.PI * 2) / verts;
          const vr = baseR * (0.6 + coordRand(x, y, v * 2 + 1) * 0.8);
          const vx = x + Math.cos(va) * vr;
          const vy = y + Math.sin(va) * vr;
          if (v === 0) ctx.moveTo(vx, vy);
          else ctx.lineTo(vx, vy);
        }
        ctx.closePath();
        ctx.fill();

        // Satellite organic mud/dirt spatters
        const satellites = Math.floor(coordRand(x, y, 20) * 4 + 2);
        for (let k = 0; k < satellites; k++) {
          const sa = coordRand(x, y, k * 3 + 30) * Math.PI * 2;
          const sd = baseR * (1.1 + coordRand(x, y, k * 3 + 31) * 0.9);
          const sr = Math.max(0.8, baseR * 0.25 * coordRand(x, y, k * 3 + 32));
          ctx.beginPath();
          ctx.arc(x + Math.cos(sa) * sd, y + Math.sin(sa) * sd, sr, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  renderShapeBrush(ctx, pts, color, size, usePressure, brush) {
    const spacing = Math.max(2, size * 0.2);
    ctx.fillStyle = color;

    for (let i = 0; i < pts.length - 1; i++) {
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const steps = Math.max(1, Math.floor(dist / spacing));
      const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);

      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const x = p1.x + (p2.x - p1.x) * t;
        const y = p1.y + (p2.y - p1.y) * t;
        const press = usePressure ? ((p1.pressure || 0.5) * (1 - t) + (p2.pressure || 0.5) * t) : 1.0;
        const sSize = Math.max(2, size * press);

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);

        if (brush.type === 'square' || brush.type === 'flat') {
          ctx.fillRect(-sSize / 2, -sSize / 2, sSize, sSize);
        } else if (brush.type === 'polygon' && brush.sides === 3) {
          ctx.beginPath();
          ctx.moveTo(0, -sSize / 2);
          ctx.lineTo(sSize / 2, sSize / 2);
          ctx.lineTo(-sSize / 2, sSize / 2);
          ctx.closePath();
          ctx.fill();
        } else if (brush.type === 'polygon' && brush.sides === 5) {
          ctx.beginPath();
          for (let k = 0; k < 5; k++) {
            const a = (k * 2 * Math.PI) / 5 - Math.PI / 2;
            const px = Math.cos(a) * (sSize / 2);
            const py = Math.sin(a) * (sSize / 2);
            if (k === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.fill();
        } else {
          ctx.fillRect(-sSize / 2, -sSize / 4, sSize, sSize / 2);
        }
        ctx.restore();
      }
    }
  }

  renderEllipse(ctx, pts, color, size, usePressure, brush) {
    const spacing = Math.max(1.5, size * 0.15);
    const fixedAngle = (brush.angle ?? 45) * (Math.PI / 180);
    const ratio = brush.ratio ?? 0.35;
    ctx.fillStyle = color;

    for (let i = 0; i < pts.length - 1; i++) {
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const steps = Math.max(1, Math.floor(dist / spacing));

      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const x = p1.x + (p2.x - p1.x) * t;
        const y = p1.y + (p2.y - p1.y) * t;
        const press = usePressure ? ((p1.pressure || 0.5) * (1 - t) + (p2.pressure || 0.5) * t) : 1.0;
        const rx = Math.max(1, (size * press) / 2);
        const ry = Math.max(0.5, rx * ratio);

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(fixedAngle);
        ctx.beginPath();
        ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }

  renderCaligraphy(ctx, pts, color, size, usePressure, brush) {
    const spacing = Math.max(1, size * 0.08);
    ctx.fillStyle = color;
    const isDir = brush.type.includes('dir');
    const angleRad = (brush.angle ?? 45) * (Math.PI / 180);
    const ratio = brush.ratio ?? 0.2;

    for (let i = 0; i < pts.length - 1; i++) {
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const steps = Math.max(1, Math.floor(dist / spacing));
      const strokeAngle = Math.atan2(p2.y - p1.y, p2.x - p1.x);

      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const x = p1.x + (p2.x - p1.x) * t;
        const y = p1.y + (p2.y - p1.y) * t;
        const press = usePressure ? ((p1.pressure || 0.5) * (1 - t) + (p2.pressure || 0.5) * t) : 1.0;
        const len = Math.max(2, size * press);
        const curAngle = isDir ? strokeAngle : angleRad;

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(curAngle);
        ctx.fillRect(-len / 2, -len * ratio / 2, len, Math.max(1, len * ratio));
        ctx.restore();
      }
    }
  }

  renderCharcoal(ctx, pts, color, size, usePressure, brush = {}) {
    const charcoalBrush = {
      ...brush,
      image: brush.image || 'assets/brushes/shape/tiled09.png',
      texture: brush.texture || 'assets/brushes/grain/paper7.png',
      composite: brush.composite || 'destination-in',
      spacing: brush.spacing || 70,
      defaultOpacity: brush.defaultOpacity || 0.9,
      tiled: true,
      rotation: 'once',
      pressure: true
    };
    this.renderTexturedImageBrush(ctx, pts, color, size, usePressure, charcoalBrush);
  }

  renderPencil(ctx, pts, color, size, usePressure, brush = {}) {
    const pencilBrush = {
      ...brush,
      image: brush.image || 'assets/brushes/shape/cone8.png',
      texture: brush.texture || 'assets/brushes/grain/paper7.png',
      composite: brush.composite || 'destination-in',
      spacing: brush.spacing || 20,
      defaultOpacity: brush.defaultOpacity || 0.1,
      pressure: true
    };
    this.renderTexturedImageBrush(ctx, pts, color, size, usePressure, pencilBrush);
  }

  renderCrayon(ctx, pts, color, size, usePressure, brush = {}) {
    const crayonBrush = {
      ...brush,
      image: brush.image || 'assets/brushes/shape/52.png',
      texture: brush.texture || 'assets/brushes/grain/paper7.png',
      composite: brush.composite || 'destination-in',
      spacing: brush.spacing || 10,
      defaultOpacity: brush.defaultOpacity || 0.5,
      rotation: 'random',
      pressure: usePressure
    };
    this.renderTexturedImageBrush(ctx, pts, color, size, usePressure, crayonBrush);
  }

  renderInk(ctx, pts, color, size, usePressure, brush) {
    if (!pts || pts.length === 0) return;
    if (brush.type === 'ink_wash') {
      ctx.save();
      ctx.globalAlpha = brush.opacity ?? 0.4;
      this.renderStandardStroke(ctx, pts, color, size * 1.5, usePressure);
      ctx.restore();
      return;
    }
    this.renderStandardStroke(ctx, pts, color, size, usePressure);
  }

  renderDryRoughInk(ctx, pts, color, size, usePressure, brush) {
    ctx.fillStyle = color;
    for (let i = 0; i < pts.length - 1; i++) {
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const steps = Math.max(1, Math.floor(dist / 2));

      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const x = p1.x + (p2.x - p1.x) * t;
        const y = p1.y + (p2.y - p1.y) * t;
        const press = usePressure ? ((p1.pressure || 0.5) * (1 - t) + (p2.pressure || 0.5) * t) : 1.0;
        const w = size * press;

        const bristles = 5;
        for (let b = 0; b < bristles; b++) {
          if (coordRand(x, y, b * 2 + 1) < 0.25) continue;
          const offset = ((b / (bristles - 1)) - 0.5) * w;
          ctx.fillRect(x + offset, y + (coordRand(x, y, b * 2 + 2) - 0.5) * 2, 1.8, 1.8);
        }
      }
    }
  }

  renderInkSplatter(ctx, pts, color, size, usePressure, brush) {
    ctx.fillStyle = color;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const mainR = Math.max(1.5, size * 0.4);
      ctx.beginPath();
      ctx.arc(p.x, p.y, mainR, 0, Math.PI * 2);
      ctx.fill();

      const splatters = Math.floor(coordRand(p.x, p.y, 1) * 4 + 2);
      for (let s = 0; s < splatters; s++) {
        const ang = coordRand(p.x, p.y, s * 3 + 10) * Math.PI * 2;
        const dist = coordRand(p.x, p.y, s * 3 + 11) * (size * 1.5) + mainR;
        const sx = p.x + Math.cos(ang) * dist;
        const sy = p.y + Math.sin(ang) * dist;
        const sr = coordRand(p.x, p.y, s * 3 + 12) * (mainR * 0.4) + 0.5;
        ctx.beginPath();
        ctx.arc(sx, sy, sr, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  renderRake(ctx, pts, color, size, usePressure, brush) {
    if (pts.length < 2) {
      this.renderStandardStroke(ctx, pts, color, size, usePressure);
      return;
    }
    const tines = brush.tines || 5;
    const spread = (brush.spread || 1.0) * size;
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(0.8, size * 0.08);

    const angles = new Array(pts.length);
    let lastAngle = 0;
    for (let i = 0; i < pts.length; i++) {
      const prev = pts[Math.max(0, i - 1)];
      const next = pts[Math.min(pts.length - 1, i + 1)];
      const dx = next.x - prev.x;
      const dy = next.y - prev.y;
      if (Math.hypot(dx, dy) > 0.5) {
        lastAngle = Math.atan2(dy, dx) + Math.PI / 2;
      }
      angles[i] = lastAngle;
    }

    for (let t = 0; t < tines; t++) {
      const offset = ((t / (tines - 1 || 1)) - 0.5) * spread;
      const tinePoints = [];
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        const a = angles[i];
        tinePoints.push({ x: p.x + Math.cos(a) * offset, y: p.y + Math.sin(a) * offset });
      }

      ctx.beginPath();
      ctx.moveTo(tinePoints[0].x, tinePoints[0].y);
      for (let i = 1; i < tinePoints.length - 1; i++) {
        const mx = (tinePoints[i].x + tinePoints[i + 1].x) / 2;
        const my = (tinePoints[i].y + tinePoints[i + 1].y) / 2;
        ctx.quadraticCurveTo(tinePoints[i].x, tinePoints[i].y, mx, my);
      }
      ctx.lineTo(tinePoints[tinePoints.length - 1].x, tinePoints[tinePoints.length - 1].y);
      ctx.stroke();
    }
  }

  renderHair(ctx, pts, color, size, usePressure, brush) {
    if (pts.length < 2) {
      this.renderStandardStroke(ctx, pts, color, size, usePressure);
      return;
    }
    const strands = brush.strands ?? (brush.tines ?? 7);
    const spread = (brush.spread ?? 1.0) * size;
    const isCurly = brush.type === 'hair_curly';
    const isTangled = brush.type === 'hair_tangled';
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(0.6, (brush.fine ? 0.8 : 1.4));

    // Precalculate smoothed tangent angles for all points
    const angles = new Array(pts.length);
    let lastAngle = 0;
    for (let i = 0; i < pts.length; i++) {
      const prev = pts[Math.max(0, i - 1)];
      const next = pts[Math.min(pts.length - 1, i + 1)];
      const dx = next.x - prev.x;
      const dy = next.y - prev.y;
      if (Math.hypot(dx, dy) > 0.5) {
        lastAngle = Math.atan2(dy, dx) + Math.PI / 2;
      }
      angles[i] = lastAngle;
    }

    for (let s = 0; s < strands; s++) {
      const baseOffset = ((s / (strands - 1 || 1)) - 0.5) * spread;

      const strandPoints = [];
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        const angle = angles[i];
        let offset = baseOffset;
        if (isCurly) {
          offset += Math.sin((i / (pts.length || 1)) * Math.PI * 8 + s * 1.5) * (spread * 0.35);
        } else if (isTangled) {
          offset += (coordRand(p.x, p.y, s * 2 + 1) - 0.5) * (spread * 0.4);
        }
        const ox = Math.cos(angle) * offset;
        const oy = Math.sin(angle) * offset;
        strandPoints.push({ x: p.x + ox, y: p.y + oy });
      }

      ctx.beginPath();
      ctx.moveTo(strandPoints[0].x, strandPoints[0].y);
      for (let i = 1; i < strandPoints.length - 1; i++) {
        const mx = (strandPoints[i].x + strandPoints[i + 1].x) / 2;
        const my = (strandPoints[i].y + strandPoints[i + 1].y) / 2;
        ctx.quadraticCurveTo(strandPoints[i].x, strandPoints[i].y, mx, my);
      }
      ctx.lineTo(strandPoints[strandPoints.length - 1].x, strandPoints[strandPoints.length - 1].y);
      ctx.stroke();
    }
  }

  renderHalftone(ctx, pts, color, size, usePressure, brush) {
    const spacing = Math.max(2, size * 0.15);
    ctx.fillStyle = color;
    const freq = brush.freq ?? 12;

    for (let i = 0; i < pts.length - 1; i++) {
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const steps = Math.max(1, Math.floor(dist / spacing));

      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const cx = p1.x + (p2.x - p1.x) * t;
        const cy = p1.y + (p2.y - p1.y) * t;
        const press = usePressure ? ((p1.pressure || 0.5) * (1 - t) + (p2.pressure || 0.5) * t) : 1.0;
        const r = Math.max(2, (size * press) / 2);

        const minX = Math.floor((cx - r) / freq) * freq;
        const maxX = Math.ceil((cx + r) / freq) * freq;
        const minY = Math.floor((cy - r) / freq) * freq;
        const maxY = Math.ceil((cy + r) / freq) * freq;

        for (let gx = minX; gx <= maxX; gx += freq) {
          for (let gy = minY; gy <= maxY; gy += freq) {
            const d = Math.hypot(gx - cx, gy - cy);
            if (d <= r) {
              const dotR = Math.max(0.8, (1 - d / r) * (freq * 0.45));
              ctx.beginPath();
              ctx.arc(gx, gy, dotR, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }
      }
    }
  }

  renderOutline(ctx, pts, color, size, usePressure, brush) {
    if (pts.length < 2) return;
    const rimW = Math.max(1.2, size * 0.12);
    const radius = Math.max(2, size / 2);

    const n = pts.length;
    const left = [];
    const right = [];

    for (let i = 0; i < n; i++) {
      let dx, dy;
      if (i === 0) {
        dx = pts[1].x - pts[0].x;
        dy = pts[1].y - pts[0].y;
      } else if (i === n - 1) {
        dx = pts[n - 1].x - pts[n - 2].x;
        dy = pts[n - 1].y - pts[n - 2].y;
      } else {
        dx = pts[i + 1].x - pts[i - 1].x;
        dy = pts[i + 1].y - pts[i - 1].y;
      }
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      left.push({ x: pts[i].x + nx * radius, y: pts[i].y + ny * radius });
      right.push({ x: pts[i].x - nx * radius, y: pts[i].y - ny * radius });
    }

    ctx.strokeStyle = color;
    ctx.lineWidth = rimW;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Left boundary
    ctx.beginPath();
    ctx.moveTo(left[0].x, left[0].y);
    for (let i = 1; i < n - 1; i++) {
      const mx = (left[i].x + left[i + 1].x) / 2;
      const my = (left[i].y + left[i + 1].y) / 2;
      ctx.quadraticCurveTo(left[i].x, left[i].y, mx, my);
    }
    ctx.lineTo(left[n - 1].x, left[n - 1].y);
    ctx.stroke();

    // Right boundary
    ctx.beginPath();
    ctx.moveTo(right[0].x, right[0].y);
    for (let i = 1; i < n - 1; i++) {
      const mx = (right[i].x + right[i + 1].x) / 2;
      const my = (right[i].y + right[i + 1].y) / 2;
      ctx.quadraticCurveTo(right[i].x, right[i].y, mx, my);
    }
    ctx.lineTo(right[n - 1].x, right[n - 1].y);
    ctx.stroke();

    // End caps
    ctx.beginPath();
    ctx.arc(pts[0].x, pts[0].y, radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(pts[n - 1].x, pts[n - 1].y, radius, 0, Math.PI * 2);
    ctx.stroke();
  }

  renderParticles(ctx, pts, color, size, usePressure, brush) {
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    const isBubble = brush.type === 'particles_bubbles';

    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const count = Math.floor(coordRand(p.x, p.y, 1) * 5 + 3);
      const scatterR = size * 1.2;

      for (let k = 0; k < count; k++) {
        const ang = coordRand(p.x, p.y, k * 3 + 10) * Math.PI * 2;
        const d = coordRand(p.x, p.y, k * 3 + 11) * scatterR;
        const px = p.x + Math.cos(ang) * d;
        const py = p.y + Math.sin(ang) * d;

        if (isBubble) {
          const br = coordRand(p.x, p.y, k * 3 + 12) * (size * 0.4) + 1.5;
          ctx.beginPath();
          ctx.arc(px, py, br, 0, Math.PI * 2);
          ctx.lineWidth = 1.2;
          ctx.stroke();
        } else {
          const pr = coordRand(p.x, p.y, k * 3 + 12) * 2 + 1;
          ctx.fillRect(px, py, pr, pr);
        }
      }
    }
  }

  renderPixel(ctx, pts, color, size, brush) {
    const pxSize = Math.max(1, Math.round(size / 3) || 1);
    ctx.fillStyle = color;

    for (let i = 0; i < pts.length - 1; i++) {
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const steps = Math.max(1, Math.floor(dist / pxSize));

      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const rawX = p1.x + (p2.x - p1.x) * t;
        const rawY = p1.y + (p2.y - p1.y) * t;
        const snapX = Math.floor(rawX / pxSize) * pxSize;
        const snapY = Math.floor(rawY / pxSize) * pxSize;
        ctx.fillRect(snapX, snapY, pxSize, pxSize);
      }
    }
  }

  renderElementFX(ctx, pts, color, size, usePressure, brush) {
    if (!pts || pts.length === 0) return;
    const isSmoke = brush.type.includes('smoke');
    const isFlame = brush.type.includes('flame');
    const isCloud = brush.type.includes('cloud');
    const spacing = Math.max(2, size * (isSmoke ? 0.15 : (isFlame ? 0.08 : 0.18)));

    ctx.save();
    for (let i = 0; i < pts.length - 1; i++) {
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const steps = Math.max(1, Math.floor(dist / spacing));

      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const x = p1.x + (p2.x - p1.x) * t;
        const y = p1.y + (p2.y - p1.y) * t;
        const press = usePressure ? ((p1.pressure || 0.5) * (1 - t) + (p2.pressure || 0.5) * t) : 1.0;
        const baseR = Math.max(3, (size * press) / 2);

        if (isSmoke) {
          // Billowing swirling smoke rings with turbulent eddy offset
          const puffR = baseR * (1.0 + coordRand(x, y, s * 2 + 1) * 0.8);
          const ox = (coordRand(x, y, s * 2 + 2) - 0.5) * (puffR * 0.6);
          const oy = (coordRand(x, y, s * 2 + 3) - 0.5) * (puffR * 0.6);
          const grad = ctx.createRadialGradient(x + ox, y + oy, puffR * 0.1, x + ox, y + oy, puffR);
          grad.addColorStop(0, colorToRgba(color, 0.28));
          grad.addColorStop(0.5, colorToRgba(color, 0.14));
          grad.addColorStop(1, colorToRgba(color, 0));
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(x + ox, y + oy, puffR, 0, Math.PI * 2);
          ctx.fill();
        } else if (isFlame) {
          // Licking flame tendrils with luminous hot core
          const flameR = baseR * (0.8 + coordRand(x, y, s * 2 + 1) * 0.5);
          const flickY = (coordRand(x, y, s * 2 + 2) - 0.5) * (flameR * 0.4) - flameR * 0.3; // rising bias
          const flickX = (coordRand(x, y, s * 2 + 3) - 0.5) * (flameR * 0.4);
          const grad = ctx.createRadialGradient(x + flickX, y + flickY, 0, x + flickX, y + flickY, flameR);
          grad.addColorStop(0, '#ffffff');
          grad.addColorStop(0.35, color);
          grad.addColorStop(0.8, colorToRgba(color, 0.4));
          grad.addColorStop(1, colorToRgba(color, 0));
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(x + flickX, y + flickY, flameR, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Volumetric cumulus cloud clusters
          const cloudR = baseR * (1.2 + coordRand(x, y, s * 3 + 1) * 0.6);
          const ox = (coordRand(x, y, s * 3 + 2) - 0.5) * (cloudR * 0.5);
          const oy = (coordRand(x, y, s * 3 + 3) - 0.5) * (cloudR * 0.5);
          const grad = ctx.createRadialGradient(x + ox, y + oy, cloudR * 0.2, x + ox, y + oy, cloudR);
          grad.addColorStop(0, colorToRgba(color, 0.35));
          grad.addColorStop(0.65, colorToRgba(color, 0.18));
          grad.addColorStop(1, colorToRgba(color, 0));
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(x + ox, y + oy, cloudR, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    ctx.restore();
  }

  renderWatercolor(ctx, pts, color, size, usePressure, brush) {
    if (!pts || pts.length === 0) return;
    const wetness = brush.wetness ?? 0.5;
    const isGranulating = !!brush.granulate;
    const isDry = !!brush.dry;
    const spacing = Math.max(2, size * (isDry ? 0.18 : 0.08));

    ctx.save();
    for (let i = 0; i < pts.length - 1; i++) {
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const steps = Math.max(1, Math.floor(dist / spacing));

      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const x = p1.x + (p2.x - p1.x) * t;
        const y = p1.y + (p2.y - p1.y) * t;
        const press = usePressure ? ((p1.pressure || 0.5) * (1 - t) + (p2.pressure || 0.5) * t) : 1.0;
        const r = Math.max(2.5, (size * press) / 2);

        if (isDry) {
          // Dry brush skips over paper tooth
          if (coordRand(x, y, s) > (0.3 + press * 0.6)) continue;
          ctx.fillStyle = colorToRgba(color, 0.55 + coordRand(x, y, 1) * 0.35);
          const dotW = Math.max(1.5, r * (0.4 + coordRand(x, y, 2) * 0.6));
          ctx.fillRect(x - dotW / 2, y - dotW / 2, dotW, dotW);
        } else {
          // Authentic watercolor wet-edge pooling gradient
          const grad = ctx.createRadialGradient(x, y, r * 0.1, x, y, r);
          const coreAlpha = Math.max(0.04, 0.16 * wetness);
          const rimAlpha = Math.max(0.12, 0.32 * wetness); // darker pooled edge
          grad.addColorStop(0, colorToRgba(color, coreAlpha));
          grad.addColorStop(0.7, colorToRgba(color, coreAlpha * 1.2));
          grad.addColorStop(0.92, colorToRgba(color, rimAlpha));
          grad.addColorStop(1, colorToRgba(color, 0));

          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();

          // Granulation pigment flakes settling into paper hollows
          if (isGranulating) {
            ctx.fillStyle = colorToRgba(color, 0.55);
            const flakes = Math.floor(r * 0.8);
            for (let k = 0; k < flakes; k++) {
              const fa = coordRand(x, y, k * 3 + 10) * Math.PI * 2;
              const fd = Math.sqrt(coordRand(x, y, k * 3 + 11)) * (r * 0.85);
              ctx.fillRect(x + Math.cos(fa) * fd, y + Math.sin(fa) * fd, 1.2, 1.2);
            }
          }
        }
      }
    }
    ctx.restore();
  }

  /**
   * Generates a 2D stroke preview thumbnail for brush selectors in UI
   */
  generatePreviewCanvas(brushId, width = 140, height = 36, strokeColor = '#6366f1') {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    // Subtle dark gradient background
    ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.fillRect(0, 0, width, height);

    // Create an S-shaped preview path
    const pts = [];
    const steps = 24;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = 12 + t * (width - 24);
      const y = (height / 2) + Math.sin(t * Math.PI * 2) * (height * 0.25);
      const pressure = 0.35 + Math.sin(t * Math.PI) * 0.65;
      pts.push({ x, y, pressure });
    }

    const testStroke = {
      points: pts,
      brushPreset: brushId,
      color: strokeColor,
      size: 10,
      opacity: 1.0,
      usePressure: true
    };

    this.renderStroke(ctx, testStroke);
    return canvas.toDataURL('image/png');
  }
}

export const brushEngine = new ProceduralBrushEngine();
