/**
 * The Craft — Brush Asset Manager
 * Preloads, caches, and tints brush dab shapes and paper grain textures.
 * Directly integrates all 54 authentic Kreska brush shapes & grain textures.
 */

function resolveAssetUrl(relPath) {
  if (!relPath) return '';
  if (relPath.startsWith('http://') || relPath.startsWith('https://') || relPath.startsWith('data:')) {
    return relPath;
  }
  if (typeof window !== 'undefined' && window.location) {
    const clean = relPath.replace(/^\.?\//, '');
    return new URL(clean, window.location.href).href;
  }
  return relPath.startsWith('/') ? relPath : '/' + relPath;
}

const ALL_SHAPES = [
  '52.png', '53.png', '54.png', '55.png', '61.png', '62.png',
  'airbrush01.png', 'blend01.png', 'cloud.png', 'cone8.png',
  'fuzzy_01.png', 'fuzzy_02.png', 'hair_014.png', 'halftone0331.png',
  'halftone0335.png', 'halftone0336.png', 'ink_01.png', 'ink_02.png',
  'pedzel_07.png', 'pedzel_08.png', 'pedzel_15.png', 'pedzel_16.png',
  'tiled01.png', 'tiled02.png', 'tiled04.png', 'tiled09.png',
  'tiled10.png', 'tiled11.png', 'tiled12.png'
];

const ALL_GRAINS = [
  'cloud.png', 'cloud2.png', 'halftone07.png', 'halftone11.png',
  'halftone111.png', 'halftone12.png', 'halftone122.png', 'halftone13.png',
  'halftone14.png', 'halftone15.png', 'halftone16.png', 'halftone20.png',
  'halftone_pixel_01.png', 'halftone_pixel_02.png', 'halftone_pixel_03.png',
  'halftone_pixel_04.png', 'halftone_pixel_05.png', 'ink_01.png',
  'ink_02.png', 'ink_03.png', 'ink_04.png', 'paper.png',
  'paper7.png', 'paper_66.png', 'sky_01.png'
];

export class BrushAssetManager {
  constructor() {
    this.images = new Map();
    this.tintedDabs = new Map();
    this.preloadAll();
  }

  preloadAll() {
    if (typeof window === 'undefined') return;

    for (const shape of ALL_SHAPES) {
      this.loadImage(`assets/brushes/shape/${shape}`);
    }
    for (const grain of ALL_GRAINS) {
      this.loadImage(`assets/brushes/grain/${grain}`);
    }
  }

  loadImage(relPath) {
    if (this.images.has(relPath)) return this.images.get(relPath);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = resolveAssetUrl(relPath);
    this.images.set(relPath, img);
    return img;
  }

  getImage(relPath) {
    if (!relPath) return null;
    let img = this.images.get(relPath);
    if (!img) {
      img = this.loadImage(relPath);
    }
    return (img && img.complete && img.naturalWidth > 0) ? img : null;
  }

  getTintedDab(shapePath, color, tileIndex = 0) {
    const shapeImg = this.getImage(shapePath);
    if (!shapeImg) return null;

    const safeColor = color || '#000000';
    const key = `${shapePath}_${safeColor}_${tileIndex % 4}`;
    if (this.tintedDabs.has(key)) {
      return this.tintedDabs.get(key);
    }

    const canvas = document.createElement('canvas');
    // If shape is tiled (800x200), each tile is 200x200
    const isTiled = (shapeImg.naturalWidth === 800 && shapeImg.naturalHeight === 200);
    const tileW = isTiled ? 200 : shapeImg.naturalWidth;
    const tileH = isTiled ? 200 : shapeImg.naturalHeight;

    canvas.width = Math.max(1, tileW);
    canvas.height = Math.max(1, tileH);
    const ctx = canvas.getContext('2d');

    if (isTiled) {
      const sx = (tileIndex % 4) * 200;
      ctx.drawImage(shapeImg, sx, 0, 200, 200, 0, 0, tileW, tileH);
    } else {
      ctx.drawImage(shapeImg, 0, 0, tileW, tileH);
    }

    // Tint stamp using source-atop exactly as Kreska does:
    // Keeps shape alpha transparency and fills non-transparent pixels with color
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = safeColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    this.tintedDabs.set(key, canvas);
    return canvas;
  }
}

export const brushAssetManager = new BrushAssetManager();
