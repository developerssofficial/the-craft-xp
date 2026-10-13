/**
 * The Craft — Supabase Client & User Authentication Service
 * Provides complete authentication (Google / Gmail OAuth, Email Magic Link, Password)
 * and strictly isolated private cloud storage for drawings.
 */

// Dynamic loader for Supabase SDK supporting both NPM bundlers & Native Browser ESM
let createClientFn = null;

async function getCreateClient() {
  if (createClientFn) return createClientFn;
  try {
    const mod = await import('@supabase/supabase-js');
    createClientFn = mod.createClient;
    return createClientFn;
  } catch (err) {
    // Fallback to CDN ESM
    const mod = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    createClientFn = mod.createClient;
    return createClientFn;
  }
}

const CONFIG_STORAGE_KEY = 'thecraft_supabase_config_v1';

// Clean default configuration — zero credentials committed to source code
export const DEFAULT_SUPABASE_CONFIG = {
  url: '',
  anonKey: ''
};

class SupabaseService {
  constructor() {
    this.client = null;
    this.currentUser = null;
    this.authListeners = new Set();
    this.config = { ...DEFAULT_SUPABASE_CONFIG };
    this.initPromise = null;
    this.init();
  }

  async loadRuntimeConfig() {
    // 1. Try serverless backend endpoint /api/auth-config (Production / Vercel with env vars)
    try {
      const res = await fetch('/api/auth-config');
      if (res.ok) {
        const data = await res.json();
        if (data && data.url && data.anonKey) {
          return data;
        }
      }
    } catch (_) {}

    // 2. Try local untracked config file (local dev server with .auth-config.json)
    try {
      const res = await fetch('/.auth-config.json');
      if (res.ok) {
        const data = await res.json();
        if (data && data.url && data.anonKey) {
          return data;
        }
      }
    } catch (_) {}

    // 3. Fallback to localStorage if previously configured
    try {
      const stored = localStorage.getItem(CONFIG_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.url && parsed.anonKey && parsed.url.startsWith('https://')) {
          return parsed;
        }
      }
    } catch (_) {}

    return { ...DEFAULT_SUPABASE_CONFIG };
  }

  saveConfig(url, anonKey) {
    this.config = {
      url: (url || '').trim(),
      anonKey: (anonKey || '').trim()
    };
    try {
      localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(this.config));
    } catch (_) {}
    this.client = null;
    return this.init();
  }

  isConfigured() {
    return !!(this.config.url && this.config.anonKey && this.config.url.startsWith('https://'));
  }

  async init() {
    if (this.initPromise) return this.initPromise;
    this.initPromise = this._doInit();
    return this.initPromise;
  }

  async _doInit() {
    if (!this.isConfigured()) {
      this.config = await this.loadRuntimeConfig();
    }

    if (!this.isConfigured()) {
      this.client = null;
      this.currentUser = null;
      this.notifyAuthChange(null);
      return null;
    }

    try {
      const createClient = await getCreateClient();
      this.client = createClient(this.config.url, this.config.anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      });

      // Get initial user session
      const { data: { session } } = await this.client.auth.getSession();
      this.currentUser = session?.user || null;
      this.notifyAuthChange(this.currentUser);

      // Subscribe to auth state updates
      this.client.auth.onAuthStateChange((event, session) => {
        this.currentUser = session?.user || null;
        this.notifyAuthChange(this.currentUser);
      });

      return this.client;
    } catch (err) {
      console.error('[SupabaseService] Initialization failed:', err);
      this.client = null;
      return null;
    } finally {
      this.initPromise = null;
    }
  }

  async ensureClient() {
    if (!this.client) {
      await this.init();
    }
    return this.client;
  }

  getClient() {
    return this.client;
  }

  getCurrentUser() {
    return this.currentUser;
  }

  onAuthStateChange(callback) {
    this.authListeners.add(callback);
    // Immediately notify with current state
    callback(this.currentUser);
    return () => this.authListeners.delete(callback);
  }

  notifyAuthChange(user) {
    for (const listener of this.authListeners) {
      try {
        listener(user);
      } catch (e) {
        console.error('[SupabaseService] Listener error:', e);
      }
    }
  }

  // -------------------------------------------------------------
  // AUTHENTICATION METHODS (Gmail / Google, Email, Magic Link)
  // -------------------------------------------------------------

  /**
   * One-click Google / Gmail OAuth sign-in.
   * Redirects user to Google OAuth consent screen.
   */
  async signInWithGoogle() {
    const client = await this.ensureClient();
    if (!client) throw new Error('Authentication service is currently initializing. Please try again in a moment.');
    
    const redirectTo = window.location.origin + window.location.pathname;
    const { data, error } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent'
        }
      }
    });

    if (error) throw error;
    return data;
  }

  /**
   * Send a passwordless Magic Link to any Gmail / Email address.
   */
  async signInWithOtp(email) {
    const client = await this.ensureClient();
    if (!client) throw new Error('Authentication service is currently initializing. Please try again in a moment.');
    
    const emailRedirectTo = window.location.origin + window.location.pathname;
    const { data, error } = await client.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo
      }
    });

    if (error) throw error;
    return data;
  }

  /**
   * Standard Email & Password Sign In
   */
  async signInWithPassword(email, password) {
    const client = await this.ensureClient();
    if (!client) throw new Error('Authentication service is currently initializing. Please try again in a moment.');
    
    const { data, error } = await client.auth.signInWithPassword({
      email: email.trim(),
      password
    });

    if (error) throw error;
    this.currentUser = data.user;
    this.notifyAuthChange(this.currentUser);
    return data;
  }

  /**
   * Standard Email & Password Sign Up
   */
  async signUp(email, password, fullName = '') {
    const client = await this.ensureClient();
    if (!client) throw new Error('Authentication service is currently initializing. Please try again in a moment.');
    
    const emailRedirectTo = window.location.origin + window.location.pathname;
    const { data, error } = await client.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo,
        data: {
          full_name: fullName.trim() || email.split('@')[0]
        }
      }
    });

    if (error) throw error;
    return data;
  }

  /**
   * Log out active user session
   */
  async signOut() {
    if (!this.client) return;
    const { error } = await this.client.auth.signOut();
    this.currentUser = null;
    this.notifyAuthChange(null);
    if (error) throw error;
  }

  // -------------------------------------------------------------
  // USER DRAWINGS STORAGE (100% Isolated via Supabase RLS)
  // -------------------------------------------------------------

  /**
   * Save or update an artwork in the user's private Supabase account.
   * RLS strictly ensures that user_id matches auth.uid().
   */
  async saveDrawing({ id = null, title = 'Untitled Artwork', thumbnail = '', data = {}, isAnimation = false }) {
    if (!this.client || !this.currentUser) {
      throw new Error('User must be logged in to save to cloud storage.');
    }

    const payload = {
      user_id: this.currentUser.id,
      title: title.trim() || 'Untitled Artwork',
      thumbnail,
      data,
      is_animation: !!isAnimation,
      updated_at: new Date().toISOString()
    };

    if (id) {
      payload.id = id;
    }

    const { data: record, error } = await this.client
      .from('drawings')
      .upsert(payload)
      .select('id, title, updated_at')
      .single();

    if (error) throw error;
    return record;
  }

  /**
   * Fetch all drawings belonging strictly to the current authenticated user.
   * RLS prevents any user from seeing another user's artwork.
   */
  async getUserDrawings(isAnimation = false) {
    if (!this.client || !this.currentUser) {
      return [];
    }

    const { data, error } = await this.client
      .from('drawings')
      .select('id, title, thumbnail, is_animation, created_at, updated_at')
      .eq('is_animation', !!isAnimation)
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  /**
   * Fetch full drawing data by ID for the current authenticated user.
   */
  async getDrawingById(drawingId) {
    if (!this.client || !this.currentUser) {
      throw new Error('User must be logged in to load artwork from cloud.');
    }

    const { data, error } = await this.client
      .from('drawings')
      .select('*')
      .eq('id', drawingId)
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Delete drawing by ID (only owner can delete via RLS).
   */
  async deleteDrawing(drawingId) {
    if (!this.client || !this.currentUser) {
      throw new Error('User must be logged in to delete artwork.');
    }

    const { error } = await this.client
      .from('drawings')
      .delete()
      .eq('id', drawingId);

    if (error) throw error;
    return true;
  }

  /**
   * Rename drawing by ID.
   */
  async renameDrawing(drawingId, newTitle) {
    if (!this.client || !this.currentUser) {
      throw new Error('User must be logged in to rename artwork.');
    }

    const { data, error } = await this.client
      .from('drawings')
      .update({ title: newTitle.trim(), updated_at: new Date().toISOString() })
      .eq('id', drawingId)
      .select('id, title')
      .single();

    if (error) throw error;
    return data;
  }
}

export const supabaseService = new SupabaseService();
