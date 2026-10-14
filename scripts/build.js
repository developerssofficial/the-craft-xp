/**
 * The Craft PRO — High-Performance Production Build & Obfuscation Pipeline
 * 
 * Performance & Security Architecture:
 * 1. Entry Security Guards (securityGuard.js, app.js, AnimationApp.js, login.html):
 *    Protected with Domain Lock + Light String Array (stringArrayEncoding: [] — zero runtime decoding lag).
 * 2. Hot-Path Canvas/Engine Modules (brushes, tools, canvas renderer, layers, math):
 *    Processed with Terser minification & identifier mangling ONLY.
 *    No string array indirection or control-flow wrapping on pointermove/requestAnimationFrame loops.
 *    Guarantees native 60fps canvas drawing and silky smooth animation playback.
 */

import fs from 'fs';
import path from 'path';
import JavaScriptObfuscator from 'javascript-obfuscator';
import { minify as terserMinify } from 'terser';
import { minify as htmlMinify } from 'html-minifier-terser';

const ROOT_DIR = process.cwd();
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const JS_DIR = path.join(ROOT_DIR, 'js');
const ASSETS_DIR = path.join(ROOT_DIR, 'assets');

// Zero-overhead obfuscation for entry security checkpoints
const ENTRY_OBFUSCATION_OPTIONS = {
  compact: true,
  controlFlowFlattening: false,
  deadCodeInjection: false,
  identifierNamesGenerator: 'hexadecimal',
  identifiersPrefix: '_c',
  renameGlobals: false,
  stringArray: true,
  stringArrayEncoding: [],       // NO base64/rc4 decryption overhead!
  stringArrayThreshold: 0.75,
  transformObjectKeys: false,
  domainLock: [
    'thecraft.dev.cv',
    'the-craft-xp.vercel.app',
    'localhost',
    '127.0.0.1'
  ],
  domainLockRedirectUrl: 'about:blank',
  target: 'browser'
};

// Pure native minification + mangling for 60fps hot path modules
const HOTPATH_TERSER_OPTIONS = {
  module: true,
  mangle: {
    toplevel: false // preserve module-level export/import symbols
  },
  compress: {
    passes: 1,
    drop_console: false
  },
  format: {
    comments: false
  }
};

const HTML_MINIFY_OPTIONS = {
  collapseWhitespace: true,
  removeComments: true,
  minifyCSS: true,
  removeAttributeQuotes: false
};

function isEntrySecurityFile(relPath) {
  const norm = relPath.replace(/\\/g, '/');
  return (
    norm === 'core/securityGuard.js' ||
    norm === 'app.js' ||
    norm === 'animation/AnimationApp.js'
  );
}

function minifyCss(cssContent) {
  return cssContent
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([{}:;,])\s*/g, '$1')
    .replace(/;}/g, '}')
    .trim();
}

function copyDirSync(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function getAllFiles(dir, ext) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir, { withFileTypes: true });
  for (const file of list) {
    const fullPath = path.join(dir, file.name);
    if (file.isDirectory()) {
      results = results.concat(getAllFiles(fullPath, ext));
    } else if (!ext || fullPath.endsWith(ext)) {
      results.push(fullPath);
    }
  }
  return results;
}

async function build() {
  const startTime = Date.now();
  console.log('----------------------------------------------------');
  console.log('⚡ Starting The Craft PRO 60fps Production Build...');
  console.log('----------------------------------------------------');

  // 1. Clean & recreate dist
  if (fs.existsSync(DIST_DIR)) {
    console.log('🧹 Cleaning previous dist/ directory...');
    fs.rmSync(DIST_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(DIST_DIR, { recursive: true });

  // 2. Copy assets
  if (fs.existsSync(ASSETS_DIR)) {
    console.log('📦 Copying static assets (brushes, textures, stamps)...');
    copyDirSync(ASSETS_DIR, path.join(DIST_DIR, 'assets'));
  }

  // Copy local auth config if present (fallback for local dev preview server)
  const localAuthConfig = path.join(ROOT_DIR, '.auth-config.json');
  if (fs.existsSync(localAuthConfig)) {
    fs.copyFileSync(localAuthConfig, path.join(DIST_DIR, '.auth-config.json'));
  }

  // 3. Process & Minify CSS
  console.log('🎨 Minifying stylesheets (style.css, animation.css)...');
  const cssFiles = ['style.css', 'animation.css'];
  for (const file of cssFiles) {
    const srcPath = path.join(ROOT_DIR, file);
    if (fs.existsSync(srcPath)) {
      const cssContent = fs.readFileSync(srcPath, 'utf8');
      const minified = minifyCss(cssContent);
      fs.writeFileSync(path.join(DIST_DIR, file), minified, 'utf8');
    }
  }

  // 4. Process JavaScript files (Selective Guard Obfuscation vs High-Speed Native Terser)
  console.log('🔒 Processing JavaScript modules (Entry Guards + 60fps Native Hot-Paths)...');
  const jsFiles = getAllFiles(JS_DIR, '.js');
  let guardCount = 0;
  let hotpathCount = 0;

  for (const jsFile of jsFiles) {
    const relPath = path.relative(JS_DIR, jsFile);
    const destPath = path.join(DIST_DIR, 'js', relPath);
    fs.mkdirSync(path.dirname(destPath), { recursive: true });

    const rawCode = fs.readFileSync(jsFile, 'utf8');

    if (isEntrySecurityFile(relPath)) {
      // Security Entry Guard: Obfuscate with domain lock & light string table (zero base64 overhead)
      try {
        const obfuscated = JavaScriptObfuscator.obfuscate(rawCode, ENTRY_OBFUSCATION_OPTIONS).getObfuscatedCode();
        fs.writeFileSync(destPath, obfuscated, 'utf8');
        guardCount++;
      } catch (err) {
        console.warn(`   ⚠️ Guard obfuscation warning on ${relPath}:`, err.message);
        fs.writeFileSync(destPath, rawCode, 'utf8');
      }
    } else {
      // Hot-path canvas engine / brushes / tools: Terser minification + mangling ONLY
      try {
        const terserResult = await terserMinify(rawCode, HOTPATH_TERSER_OPTIONS);
        fs.writeFileSync(destPath, terserResult.code || rawCode, 'utf8');
        hotpathCount++;
      } catch (err) {
        console.warn(`   ⚠️ Terser minification warning on ${relPath}:`, err.message);
        fs.writeFileSync(destPath, rawCode, 'utf8');
      }
    }
  }
  console.log(`   ✓ Protected ${guardCount} Security Entry Guards (Domain-Locked, Zero Decrypt Overhead).`);
  console.log(`   ✓ Minified & Mangled ${hotpathCount} Hot-Path Modules for Native 60fps Canvas Speed.`);

  // 5. Process & Minify HTML pages (index.html, animation.html, login.html)
  console.log('📄 Minifying HTML files & securing login scripts...');
  const htmlFiles = ['index.html', 'animation.html', 'login.html'];
  for (const file of htmlFiles) {
    const srcPath = path.join(ROOT_DIR, file);
    if (!fs.existsSync(srcPath)) continue;

    let htmlContent = fs.readFileSync(srcPath, 'utf8');

    // If file is login.html, obfuscate its inline module script with ENTRY_OBFUSCATION_OPTIONS
    if (file === 'login.html') {
      const scriptRegex = /(<script type="module">)([\s\S]*?)(<\/script>)/i;
      const match = htmlContent.match(scriptRegex);
      if (match && match[2].trim()) {
        try {
          const inlineJs = match[2];
          const obfuscatedInline = JavaScriptObfuscator.obfuscate(inlineJs, ENTRY_OBFUSCATION_OPTIONS).getObfuscatedCode();
          htmlContent = htmlContent.replace(scriptRegex, `$1${obfuscatedInline}$3`);
          console.log('   ✓ Protected inline script in login.html');
        } catch (err) {
          console.warn('   ⚠️ Failed to obfuscate login.html inline script:', err.message);
        }
      }
    }

    try {
      const minifiedHtml = await htmlMinify(htmlContent, HTML_MINIFY_OPTIONS);
      fs.writeFileSync(path.join(DIST_DIR, file), minifiedHtml, 'utf8');
    } catch (err) {
      console.warn(`   ⚠️ HTML minification error in ${file}, using raw:`, err.message);
      fs.writeFileSync(path.join(DIST_DIR, file), htmlContent, 'utf8');
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log('----------------------------------------------------');
  console.log(`✨ Build completed successfully in ${duration}s!`);
  console.log(`📁 Production bundle ready at: ${DIST_DIR}`);
  console.log('----------------------------------------------------');
}

build().catch(err => {
  console.error('❌ Build failed:', err);
  process.exit(1);
});
