/**
 * The Craft PRO — Automated Production Build & Obfuscation Pipeline
 * 
 * Generates an optimized, domain-locked, and clone-protected production build in /dist.
 * Preserves the original source code in /js and root for continuous development.
 * Keeps serverless /api untouched at the project root for Vercel.
 */

import fs from 'fs';
import path from 'path';
import JavaScriptObfuscator from 'javascript-obfuscator';
import { minify } from 'html-minifier-terser';

const ROOT_DIR = process.cwd();
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const JS_DIR = path.join(ROOT_DIR, 'js');
const ASSETS_DIR = path.join(ROOT_DIR, 'assets');

// High-performance obfuscation configuration (60fps canvas safe)
const OBFUSCATION_OPTIONS = {
  compact: true,
  controlFlowFlattening: false,       // Keep false to avoid canvas render loop lag
  deadCodeInjection: false,           // Keep false to prevent memory bloat
  identifierNamesGenerator: 'hexadecimal',
  identifiersPrefix: '_c',
  renameGlobals: false,               // Crucial for ES module exports/imports
  stringArray: true,
  stringArrayEncoding: ['base64'],
  stringArrayThreshold: 0.8,
  transformObjectKeys: false,         // Preserves canvas 2D context & event properties
  domainLock: [
    'thecraft.dev.cv',
    'the-craft-xp.vercel.app',
    'localhost',
    '127.0.0.1'
  ],
  domainLockRedirectUrl: 'about:blank',
  target: 'browser'
};

const HTML_MINIFY_OPTIONS = {
  collapseWhitespace: true,
  removeComments: true,
  minifyCSS: true,
  removeAttributeQuotes: false
};

/**
 * Minifies CSS by removing comments and unnecessary whitespace
 */
function minifyCss(cssContent) {
  return cssContent
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([{}:;,])\s*/g, '$1')
    .replace(/;}/g, '}')
    .trim();
}

/**
 * Recursively copies a directory
 */
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

/**
 * Recursively gathers all files in a directory matching an extension
 */
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
  console.log('🚀 Starting The Craft PRO Production Build...');
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

  // Copy local auth config if present (fallback for local preview server)
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

  // 4. Obfuscate JavaScript files
  console.log('🔒 Obfuscating JavaScript ES modules with Domain Lock...');
  const jsFiles = getAllFiles(JS_DIR, '.js');
  let obfuscatedCount = 0;

  for (const jsFile of jsFiles) {
    const relPath = path.relative(JS_DIR, jsFile);
    const destPath = path.join(DIST_DIR, 'js', relPath);
    fs.mkdirSync(path.dirname(destPath), { recursive: true });

    const rawCode = fs.readFileSync(jsFile, 'utf8');
    try {
      const obfuscationResult = JavaScriptObfuscator.obfuscate(rawCode, OBFUSCATION_OPTIONS);
      fs.writeFileSync(destPath, obfuscationResult.getObfuscatedCode(), 'utf8');
      obfuscatedCount++;
    } catch (err) {
      console.warn(`⚠️ Warning: Failed to obfuscate ${relPath}, falling back to original:`, err.message);
      fs.writeFileSync(destPath, rawCode, 'utf8');
    }
  }
  console.log(`   ✓ Successfully obfuscated ${obfuscatedCount} JS modules.`);

  // 5. Process & Minify HTML pages (index.html, animation.html, login.html)
  console.log('📄 Minifying HTML files & securing inline scripts...');
  const htmlFiles = ['index.html', 'animation.html', 'login.html'];
  for (const file of htmlFiles) {
    const srcPath = path.join(ROOT_DIR, file);
    if (!fs.existsSync(srcPath)) continue;

    let htmlContent = fs.readFileSync(srcPath, 'utf8');

    // If file is login.html, obfuscate its inline module script as well
    if (file === 'login.html') {
      const scriptRegex = /(<script type="module">)([\s\S]*?)(<\/script>)/i;
      const match = htmlContent.match(scriptRegex);
      if (match && match[2].trim()) {
        try {
          const inlineJs = match[2];
          const obfuscatedInline = JavaScriptObfuscator.obfuscate(inlineJs, OBFUSCATION_OPTIONS).getObfuscatedCode();
          htmlContent = htmlContent.replace(scriptRegex, `$1${obfuscatedInline}$3`);
          console.log('   ✓ Obfuscated inline script in login.html');
        } catch (err) {
          console.warn('   ⚠️ Failed to obfuscate login.html inline script:', err.message);
        }
      }
    }

    try {
      const minifiedHtml = await minify(htmlContent, HTML_MINIFY_OPTIONS);
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
