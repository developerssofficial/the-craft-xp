/**
 * The Craft PRO — Core Security & Anti-Theft Guard
 * 
 * Features:
 * 1. Domain Lock: Restricts execution to authorized origins (thecraft.dev.cv, local dev, Vercel deployments).
 * 2. Anti-Theft: Disables right-click context menu, browser page saving (Ctrl+S), source viewing (Ctrl+U),
 *    and DevTools shortcuts (F12, Ctrl+Shift+I/J/C) without disrupting canvas drawing or app hotkeys.
 */

const ALLOWED_HOSTS = [
  'thecraft.dev.cv',
  'the-craft-xp.vercel.app',
  'localhost',
  '127.0.0.1',
  '0.0.0.0'
];

/**
 * Validates current execution host against allowed whitelist
 */
function isAuthorizedOrigin() {
  try {
    if (typeof window === 'undefined' || !window.location) return true;
    
    // Disallow offline local files (file://)
    if (window.location.protocol === 'file:') return false;

    const hostname = (window.location.hostname || '').toLowerCase();
    
    // Direct match
    if (ALLOWED_HOSTS.includes(hostname)) return true;

    // Allowed subdomains (*.thecraft.dev.cv or *.vercel.app for deployment previews)
    if (hostname.endsWith('.thecraft.dev.cv')) return true;
    if (hostname.endsWith('.vercel.app')) return true;

    return false;
  } catch (err) {
    return false;
  }
}

/**
 * Softly replaces the DOM with an unauthorized message and disables canvas loops
 */
function triggerUnauthorizedLockout() {
  try {
    // 1. Immediately wipe and disable all active canvases
    const canvases = document.querySelectorAll('canvas');
    canvases.forEach(cv => {
      try {
        const ctx = cv.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, cv.width, cv.height);
      } catch (e) {}
      cv.style.pointerEvents = 'none';
      cv.style.filter = 'blur(10px)';
    });

    // 2. Halt animation loops
    if (window._craftRafId) {
      cancelAnimationFrame(window._craftRafId);
    }

    // 3. Render soft, elegant unauthorized lockout overlay
    const overlay = document.createElement('div');
    overlay.id = 'craft-unauthorized-overlay';
    overlay.setAttribute('style', `
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      background: #0b0c10;
      color: #f3f4f6;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
      box-sizing: border-box;
    `);

    overlay.innerHTML = `
      <div style="
        max-width: 480px;
        width: 100%;
        background: #141721;
        border: 1px solid rgba(239, 68, 68, 0.35);
        border-radius: 20px;
        padding: 36px 32px;
        text-align: center;
        box-shadow: 0 25px 60px rgba(0, 0, 0, 0.7);
      ">
        <div style="
          width: 64px;
          height: 64px;
          margin: 0 auto 20px auto;
          background: rgba(239, 68, 68, 0.12);
          color: #ef4444;
          border-radius: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 28px;
        ">
          <i class="fa-solid fa-shield-halved"></i>
        </div>
        <h2 style="margin: 0 0 10px 0; font-size: 22px; font-weight: 700; letter-spacing: -0.02em; color: #fff;">
          Unauthorized Domain
        </h2>
        <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.6; color: #94a3b8;">
          This copy of <strong>The Craft PRO</strong> is domain-locked and cannot be executed on an unauthorized domain or offline mirror.
        </p>
        <a href="https://thecraft.dev.cv" style="
          display: inline-block;
          background: linear-gradient(135deg, #3b82f6, #6366f1);
          color: #ffffff;
          text-decoration: none;
          font-weight: 600;
          font-size: 14px;
          padding: 12px 28px;
          border-radius: 12px;
          box-shadow: 0 8px 20px rgba(59, 130, 246, 0.35);
          transition: transform 0.15s ease;
        ">
          Launch Official Studio
        </a>
      </div>
    `;

    // Ensure document body is available
    if (document.body) {
      document.body.appendChild(overlay);
    } else {
      document.addEventListener('DOMContentLoaded', () => {
        document.body.appendChild(overlay);
      });
    }
  } catch (e) {
    console.error('Lockout failure:', e);
  }

  // Prevent subsequent scripts from running
  throw new Error('[The Craft PRO Security] Execution terminated: unauthorized origin.');
}

/**
 * Initializes anti-theft keyboard and mouse listeners
 */
function initAntiTheftGuard() {
  if (typeof window === 'undefined') return;

  // 1. Prevent Right-Click Context Menu (Anti-inspect/Anti-save)
  // Does not interfere with left-click, touch, or stylus drawing pointer events
  window.addEventListener('contextmenu', (e) => {
    e.preventDefault();
  }, { capture: true });

  // 2. Prevent DevTools shortcuts and browser page saving
  window.addEventListener('keydown', (e) => {
    const key = e.key;
    const code = e.code;
    const ctrlOrMeta = e.ctrlKey || e.metaKey;
    const shift = e.shiftKey;

    // A. F12 (DevTools)
    if (key === 'F12' || code === 'F12') {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    // B. Ctrl+Shift+I / J / C (DevTools Inspect & Console)
    if (ctrlOrMeta && shift && ['I', 'i', 'J', 'j', 'C', 'c'].includes(key)) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    // C. Ctrl+U / Cmd+Option+U (View Page Source)
    if (ctrlOrMeta && (key === 'u' || key === 'U')) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    // D. Ctrl+S / Cmd+S (Browser Save Page)
    if (ctrlOrMeta && !shift && (key === 's' || key === 'S')) {
      // Prevent browser "Save webpage as HTML" popup
      e.preventDefault();
      // DO NOT call stopPropagation(): this allows in-app listeners (e.g. AnimationApp's downloadProjectFile) to handle it
      return;
    }
  }, { capture: true });
}

/**
 * Main security entry point
 */
export function initSecurityGuard() {
  if (!isAuthorizedOrigin()) {
    triggerUnauthorizedLockout();
    return false;
  }

  initAntiTheftGuard();
  return true;
}

// Auto-run verification on import
if (typeof window !== 'undefined') {
  initSecurityGuard();
}
