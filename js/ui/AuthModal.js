/**
 * The Craft — User Authentication & Account Modal
 * Supports Google / Gmail OAuth, Passwordless Magic Link, Email & Password,
 * and Supabase Project Configuration.
 */
import { supabaseService } from '../core/supabaseClient.js';
import { events } from '../core/EventBus.js';

export class AuthModal {
  constructor(userGalleryModal = null) {
    this.userGalleryModal = userGalleryModal;
    this.currentUser = null;
    this.modalEl = null;
    this.userNavBtn = null;
    this.userDropdownEl = null;

    this.init();
  }

  init() {
    this.createModalDOM();
    this.injectNavButton();

    // Listen to Supabase auth changes
    supabaseService.onAuthStateChange((user) => {
      this.currentUser = user;
      this.updateNavButton(user);
    });
  }

  injectNavButton() {
    // Find header-right in navbar
    const headerRight = document.querySelector('.header-right');
    if (!headerRight) return;

    const authContainer = document.createElement('div');
    authContainer.className = 'user-auth-container';
    authContainer.id = 'userAuthContainer';
    authContainer.innerHTML = `
      <button id="userNavBtn" class="btn secondary-btn user-nav-btn" title="Account & Cloud Storage">
        <i class="fa-solid fa-user-circle"></i>
        <span class="user-btn-text">Sign In</span>
      </button>
      <div id="userDropdown" class="user-dropdown hidden">
        <div class="user-dropdown-header">
          <div class="user-avatar-circle" id="userDropdownAvatar">U</div>
          <div class="user-dropdown-info">
            <span class="user-dropdown-name" id="userDropdownName">User</span>
            <span class="user-dropdown-email" id="userDropdownEmail">user@example.com</span>
          </div>
        </div>
        <div class="dropdown-divider"></div>
        <button id="userMyDrawingsBtn" class="dropdown-item">
          <i class="fa-solid fa-images"></i>
          <span>My Cloud Drawings</span>
        </button>
        <button id="userSaveCloudBtn" class="dropdown-item">
          <i class="fa-solid fa-cloud-arrow-up"></i>
          <span>Save Current to Cloud</span>
        </button>
        <div class="dropdown-divider"></div>
        <button id="userLogoutBtn" class="dropdown-item danger-item">
          <i class="fa-solid fa-arrow-right-from-bracket"></i>
          <span>Sign Out</span>
        </button>
      </div>
    `;

    // Insert before the export dropdown
    const exportWrap = document.getElementById('exportDropdownWrap');
    if (exportWrap) {
      headerRight.insertBefore(authContainer, exportWrap);
    } else {
      headerRight.appendChild(authContainer);
    }

    this.userNavBtn = authContainer.querySelector('#userNavBtn');
    this.userDropdownEl = authContainer.querySelector('#userDropdown');

    this.userNavBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!this.currentUser) {
        window.location.href = '/login.html';
      } else {
        this.userDropdownEl.classList.toggle('hidden');
      }
    });

    document.addEventListener('click', (e) => {
      if (!authContainer.contains(e.target)) {
        this.userDropdownEl.classList.add('hidden');
      }
    });

    // Dropdown action bindings
    authContainer.querySelector('#userMyDrawingsBtn').addEventListener('click', () => {
      this.userDropdownEl.classList.add('hidden');
      if (this.userGalleryModal) {
        this.userGalleryModal.open();
      }
    });

    authContainer.querySelector('#userSaveCloudBtn').addEventListener('click', () => {
      this.userDropdownEl.classList.add('hidden');
      events.emit('cloud:save-requested');
    });

    authContainer.querySelector('#userLogoutBtn').addEventListener('click', async () => {
      this.userDropdownEl.classList.add('hidden');
      try {
        await supabaseService.signOut();
        events.emit('toast', { message: 'Successfully signed out.' });
      } catch (err) {
        events.emit('toast', { message: 'Sign out failed: ' + err.message, type: 'danger' });
      }
    });
  }

  updateNavButton(user) {
    if (!this.userNavBtn) return;
    const textEl = this.userNavBtn.querySelector('.user-btn-text');

    if (!user) {
      this.userNavBtn.innerHTML = `
        <i class="fa-solid fa-user"></i>
        <span class="user-btn-text">Sign In</span>
      `;
      this.userNavBtn.classList.remove('logged-in');
    } else {
      const name = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Artist';
      const initial = name.charAt(0).toUpperCase();
      const avatar = user.user_metadata?.avatar_url;

      if (avatar) {
        this.userNavBtn.innerHTML = `
          <img src="${avatar}" class="user-nav-avatar" alt="User">
          <span class="user-btn-text">${name}</span>
        `;
      } else {
        this.userNavBtn.innerHTML = `
          <div class="user-nav-initial">${initial}</div>
          <span class="user-btn-text">${name}</span>
        `;
      }
      this.userNavBtn.classList.add('logged-in');

      // Update dropdown info
      const ddName = document.getElementById('userDropdownName');
      const ddEmail = document.getElementById('userDropdownEmail');
      const ddAvatar = document.getElementById('userDropdownAvatar');
      if (ddName) ddName.textContent = name;
      if (ddEmail) ddEmail.textContent = user.email || '';
      if (ddAvatar) {
        if (avatar) {
          ddAvatar.innerHTML = `<img src="${avatar}" class="avatar-img" alt="Avatar">`;
        } else {
          ddAvatar.textContent = initial;
        }
      }
    }
  }

  createModalDOM() {
    this.modalEl = document.createElement('div');
    this.modalEl.className = 'modal-backdrop hidden';
    this.modalEl.id = 'authModalBackdrop';
    this.modalEl.innerHTML = `
      <div class="auth-modal-card">
        <!-- Modal Header -->
        <div class="auth-modal-header">
          <div class="auth-header-title">
            <i class="fa-solid fa-wand-magic-sparkles brand-accent"></i>
            <span>The Craft Account</span>
          </div>
          <button class="modal-close-btn" id="authModalCloseBtn" title="Close (Esc)">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <!-- Auth Navigation Tabs -->
        <div class="auth-tabs">
          <button class="auth-tab-btn active" data-tab="signin">Sign In</button>
          <button class="auth-tab-btn" data-tab="signup">Create Account</button>
        </div>

        <!-- TAB 1: SIGN IN -->
        <div class="auth-tab-pane active" id="paneSignIn">
          <!-- Google / Gmail Sign In Button -->
          <button class="google-auth-btn" id="googleSignInBtn">
            <svg class="google-icon" viewBox="0 0 24 24" width="20" height="20">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
            </svg>
            <span>Continue with Google (Gmail)</span>
          </button>

          <div class="auth-divider">
            <span>or sign in with email</span>
          </div>

          <form id="signInForm" class="auth-form">
            <div class="form-group">
              <label for="signInEmail">Email Address</label>
              <input type="email" id="signInEmail" placeholder="your.email@gmail.com" required>
            </div>
            <div class="form-group">
              <label for="signInPassword">Password</label>
              <input type="password" id="signInPassword" placeholder="••••••••" required>
            </div>
            <button type="submit" class="auth-submit-btn">
              <span>Sign In</span>
            </button>
            <button type="button" class="magic-link-btn" id="magicLinkSignInBtn">
              <i class="fa-solid fa-paper-plane"></i>
              <span>Send Passwordless Magic Link to Gmail</span>
            </button>
          </form>
        </div>

        <!-- TAB 2: SIGN UP -->
        <div class="auth-tab-pane" id="paneSignUp">
          <!-- Google Sign Up -->
          <button class="google-auth-btn" id="googleSignUpBtn">
            <svg class="google-icon" viewBox="0 0 24 24" width="20" height="20">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
            </svg>
            <span>Sign Up with Google (Gmail)</span>
          </button>

          <div class="auth-divider">
            <span>or create an account with email</span>
          </div>

          <form id="signUpForm" class="auth-form">
            <div class="form-group">
              <label for="signUpName">Full Name</label>
              <input type="text" id="signUpName" placeholder="Your Name" required>
            </div>
            <div class="form-group">
              <label for="signUpEmail">Email Address</label>
              <input type="email" id="signUpEmail" placeholder="your.email@gmail.com" required>
            </div>
            <div class="form-group">
              <label for="signUpPassword">Create Password</label>
              <input type="password" id="signUpPassword" placeholder="Minimum 6 characters" minlength="6" required>
            </div>
            <button type="submit" class="auth-submit-btn">
              <span>Create Account</span>
            </button>
          </form>
        </div>

        <!-- Auth Status Banner -->
        <div id="authStatusMessage" class="auth-status-msg hidden"></div>
      </div>
    `;

    document.body.appendChild(this.modalEl);

    // Bind event listeners
    this.modalEl.querySelector('#authModalCloseBtn').addEventListener('click', () => this.closeModal());
    this.modalEl.addEventListener('click', (e) => {
      if (e.target === this.modalEl) this.closeModal();
    });

    // Tab buttons
    const tabBtns = this.modalEl.querySelectorAll('.auth-tab-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        this.switchTab(tab);
      });
    });

    // Form handlers
    this.bindAuthActions();
  }

  switchTab(tabName) {
    const tabBtns = this.modalEl.querySelectorAll('.auth-tab-btn');
    const panes = {
      signin: this.modalEl.querySelector('#paneSignIn'),
      signup: this.modalEl.querySelector('#paneSignUp')
    };

    tabBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    Object.entries(panes).forEach(([name, pane]) => {
      if (pane) pane.classList.toggle('active', name === tabName);
    });

    this.clearStatus();
  }

  bindAuthActions() {
    // 1. Google / Gmail Sign In
    const googleBtns = [
      this.modalEl.querySelector('#googleSignInBtn'),
      this.modalEl.querySelector('#googleSignUpBtn')
    ];
    googleBtns.forEach(btn => {
      btn?.addEventListener('click', async () => {
        try {
          this.showStatus('Connecting to Google (Gmail)...', 'info');
          await supabaseService.signInWithGoogle();
        } catch (err) {
          this.showStatus(err.message, 'danger');
        }
      });
    });

    // 2. Email & Password Sign In
    const signInForm = this.modalEl.querySelector('#signInForm');
    signInForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = this.modalEl.querySelector('#signInEmail').value;
      const pass = this.modalEl.querySelector('#signInPassword').value;
      try {
        this.showStatus('Signing in...', 'info');
        await supabaseService.signInWithPassword(email, pass);
        this.showStatus('Signed in successfully!', 'success');
        setTimeout(() => this.closeModal(), 800);
      } catch (err) {
        this.showStatus(err.message, 'danger');
      }
    });

    // 3. Passwordless Magic Link to Gmail
    const magicLinkBtn = this.modalEl.querySelector('#magicLinkSignInBtn');
    magicLinkBtn?.addEventListener('click', async () => {
      const email = this.modalEl.querySelector('#signInEmail').value;
      if (!email) {
        this.showStatus('Please enter your Gmail / Email address above.', 'warning');
        return;
      }
      try {
        this.showStatus('Sending magic link to ' + email + '...', 'info');
        await supabaseService.signInWithOtp(email);
        this.showStatus(`Magic link sent! Check your Gmail inbox at ${email}.`, 'success');
      } catch (err) {
        this.showStatus(err.message, 'danger');
      }
    });

    // 4. Email & Password Sign Up
    const signUpForm = this.modalEl.querySelector('#signUpForm');
    signUpForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = this.modalEl.querySelector('#signUpName').value;
      const email = this.modalEl.querySelector('#signUpEmail').value;
      const pass = this.modalEl.querySelector('#signUpPassword').value;
      try {
        this.showStatus('Creating account...', 'info');
        await supabaseService.signUp(email, pass, name);
        this.showStatus('Account created! Verification link sent to your email.', 'success');
      } catch (err) {
        this.showStatus(err.message, 'danger');
      }
    });
  }

  openModal(tab = 'signin') {
    if (!this.modalEl) return;
    this.modalEl.classList.remove('hidden');
    this.switchTab(tab);
  }

  closeModal() {
    if (!this.modalEl) return;
    this.modalEl.classList.add('hidden');
    this.clearStatus();
  }

  showStatus(msg, type = 'info') {
    const el = this.modalEl?.querySelector('#authStatusMessage');
    if (!el) return;
    el.textContent = msg;
    el.className = `auth-status-msg ${type}`;
    el.classList.remove('hidden');
  }

  clearStatus() {
    const el = this.modalEl?.querySelector('#authStatusMessage');
    if (el) el.classList.add('hidden');
  }
}
