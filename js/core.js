/* ============================================================
   Productivity Monitor 2.0 - Core Module v2.0.0
   Estado global, almacenamiento y utilidades
   ============================================================ */

const APP_VERSION = '2.3.1';

// ===== Estado Global =====
const App = {
  sessions: [],
  currentSession: null,
  screenStream: null,
  systemAudioStream: null,
  audioStream: null,
  recognition: null,
  transcriptBuffer: [],
  screenshotInterval: null,
  systemTranscriptionInterval: null,
  micTranscriptionInterval: null,
  audioContext: null,
  analyser: null,
  visualizerInterval: null,
  privacyMode: false,
  isRecording: false,
  restoredSession: null
};

// ===== Almacenamiento Local =====
const Storage = {
  KEY: 'productivity_monitor_2_data',
  META_KEY: 'productivity_monitor_2_meta',
  MAX_SCREENSHOTS_PER_SESSION: 50,

  load() {
    try {
      const data = localStorage.getItem(this.KEY);
      return data ? JSON.parse(data) : { sessions: [] };
    } catch (e) {
      console.error('Error cargando datos:', e);
      return { sessions: [] };
    }
  },

  save(data) {
    try {
      localStorage.setItem(this.KEY, JSON.stringify(data));
    } catch (e) {
      console.error('Error guardando datos:', e);
      showToast('âš ï¸ Error al guardar datos. El almacenamiento estÃ¡ lleno.', 'error');
    }
  },

  getSessions() {
    return this.load().sessions || [];
  },

  saveSessions(sessions) {
    const data = this.load();
    data.sessions = sessions;
    this.save(data);
  },

  addSession(session) {
    const sessions = this.getSessions();
    sessions.unshift(session);
    this.saveSessions(sessions);
    this.syncToCloud();
  },

  updateSession(sessionId, updates) {
    const sessions = this.getSessions();
    const idx = sessions.findIndex(s => s.id === sessionId);
    if (idx !== -1) {
      sessions[idx] = { ...sessions[idx], ...updates };
      this.saveSessions(sessions);
      this.syncToCloud();
    }
  },

  getSession(sessionId) {
    return this.getSessions().find(s => s.id === sessionId);
  },

  deleteSession(sessionId) {
    const sessions = this.getSessions().filter(s => s.id !== sessionId);
    this.saveSessions(sessions);
    this.syncToCloud();
  },

  clearAll() {
    localStorage.removeItem(this.KEY);
    localStorage.removeItem(this.META_KEY);
    localStorage.removeItem('project_context');
    this.syncToCloud();
  },

  // ===== Contexto del Proyecto para Resumen IA =====
  PROJECT_CONTEXT_KEY: 'project_context',

  getProjectContext() {
    return localStorage.getItem(this.PROJECT_CONTEXT_KEY) || '';
  },

  saveProjectContext(text) {
    if (text && text.trim()) {
      localStorage.setItem(this.PROJECT_CONTEXT_KEY, text.trim());
    } else {
      localStorage.removeItem(this.PROJECT_CONTEXT_KEY);
    }
  },

  clearProjectContext() {
    localStorage.removeItem(this.PROJECT_CONTEXT_KEY);
  },

  // ===== Proveedor IA Configurable =====
  AI_PROVIDER_KEY: 'ai_provider_config',

  AI_PROVIDERS: {
    openrouter: {
      name: 'OpenRouter (gratuito)',
      url: 'https://openrouter.ai/api/v1/chat/completions',
      models: [
        { id: 'nvidia/nemotron-3-ultra-550b-a55b:free', name: 'Nemotron Ultra 550B (gratis, 1M ctx)' },
        { id: 'nvidia/nemotron-3-super-120b-a12b:free', name: 'Nemotron Super 120B (gratis, 262K ctx)' },
        { id: 'openrouter/auto', name: 'Auto (mejor modelo disponible)' },
        { id: 'qwen/qwen3-next-80b-a3b-instruct:free', name: 'Qwen3 Next 80B (gratis)' }
      ],
      defaultModel: 'nvidia/nemotron-3-ultra-550b-a55b:free',
      keyPlaceholder: 'sk-or-...',
      headers: (key) => ({
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': window.location.origin,
        'X-Title': 'Productivity Monitor'
      })
    },
    openai: {
      name: 'OpenAI (GPT-4o, GPT-4)',
      url: 'https://api.openai.com/v1/chat/completions',
      models: [
        { id: 'gpt-4o', name: 'GPT-4o (recomendado)' },
        { id: 'gpt-4o-mini', name: 'GPT-4o Mini (económico)' },
        { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
        { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' }
      ],
      defaultModel: 'gpt-4o',
      keyPlaceholder: 'sk-...',
      headers: (key) => ({
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json'
      })
    },
    groq: {
      name: 'Groq (rápido)',
      url: 'https://api.groq.com/openai/v1/chat/completions',
      models: [
        { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B' },
        { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B (rápido)' },
        { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B' }
      ],
      defaultModel: 'llama-3.3-70b-versatile',
      keyPlaceholder: 'gsk_...',
      headers: (key) => ({
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json'
      })
    },
    anthropic: {
      name: 'Anthropic (Claude)',
      url: 'https://api.anthropic.com/v1/messages',
      models: [
        { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4' },
        { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku (rápido)' }
      ],
      defaultModel: 'claude-sonnet-4-20250514',
      keyPlaceholder: 'sk-ant-...',
      format: 'anthropic',
      headers: (key) => ({
        'x-api-key': key,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      })
    },
    mistral: {
      name: 'Mistral AI',
      url: 'https://api.mistral.ai/v1/chat/completions',
      models: [
        { id: 'mistral-large-latest', name: 'Mistral Large' },
        { id: 'mistral-small-latest', name: 'Mistral Small' }
      ],
      defaultModel: 'mistral-large-latest',
      keyPlaceholder: 'API key...',
      headers: (key) => ({
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json'
      })
    },
    custom: {
      name: 'Personalizado (Custom URL)',
      url: '',
      models: [],
      defaultModel: '',
      keyPlaceholder: 'API key...',
      headers: (key) => ({
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json'
      })
    }
  },

  getAIProviderConfig() {
    try {
      const saved = localStorage.getItem(this.AI_PROVIDER_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return {
      provider: 'openrouter',
      model: 'nvidia/nemotron-3-ultra-550b-a55b:free',
      apiKey: localStorage.getItem('openrouter_api_key') || '',
      customUrl: ''
    };
  },

  saveAIProviderConfig(config) {
    localStorage.setItem(this.AI_PROVIDER_KEY, JSON.stringify(config));
    if (config.provider === 'openrouter' && config.apiKey) {
      localStorage.setItem('openrouter_api_key', config.apiKey);
    }
  },

  // Sincronizar con la nube si el usuario estÃ¡ autenticado
  syncToCloud() {
    if (typeof isLoggedIn === 'function' && isLoggedIn() && typeof pushToCloud === 'function') {
      pushToCloud();
    }
  },


  // MÃ©tricas de almacenamiento
  getUsage() {
    let total = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      const value = localStorage.getItem(key);
      total += (key.length + (value ? value.length : 0)) * 2;
    }
    return total;
  },

  getQuota() {
    return 5 * 1024 * 1024;
  },

  getUsagePercent() {
    const usage = this.getUsage();
    const quota = this.getQuota();
    return Math.min(100, Math.round((usage / quota) * 100));
  },

  // CompresiÃ³n de capturas
  compressScreenshot(dataUrl, maxWidth = 1280) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.75));
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  }
};

// ===== Utilidades =====
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatDate(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

function formatDateTime(ts) {
  return `${formatDate(ts)} ${formatTime(ts)}`;
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.className = `toast show ${type}`;
  setTimeout(() => toast.classList.remove('show'), 3000);
}

// Notificaciones del sistema
function showSystemNotification(title, body) {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted') {
    new Notification(title, { body, icon: 'favicon.svg' });
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission().then(perm => {
      if (perm === 'granted') {
        new Notification(title, { body, icon: 'favicon.svg' });
      }
    });
  }
}

// ===== NavegaciÃ³n =====
function switchView(viewName) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelectorAll('.bn-item').forEach(n => n.classList.remove('active'));

  const view = document.getElementById(`view-${viewName}`);
  if (view) view.classList.add('active');

  const navItem = document.querySelector(`.nav-item[data-view="${viewName}"]`);
  if (navItem) navItem.classList.add('active');

  const bnItem = document.querySelector(`.bn-item[data-view="${viewName}"]`);
  if (bnItem) bnItem.classList.add('active');

  if (window.innerWidth < 768) {
    closeSidebar();
  }

  if (viewName === 'dashboard') loadDashboard();
  if (viewName === 'sessions') loadSessions();
  if (viewName === 'reports') loadReports();
  if (viewName === 'data') {
    updateStorageIndicator();
    if (typeof initGroqKeyUI === 'function') initGroqKeyUI();
    if (typeof initProjectContextUI === 'function') initProjectContextUI();
    if (typeof initAIProviderUI === 'function') initAIProviderUI();
  }

  // Persistir vista en el hash para sobrevivir recargas
  history.replaceState(null, '', '#' + viewName);

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Restaura la vista desde el hash de la URL (si existe)
function restoreViewFromHash() {
  const valid = ['dashboard', 'monitor', 'sessions', 'reports', 'search', 'data'];
  const hash = window.location.hash.replace('#', '');
  switchView(valid.includes(hash) ? hash : 'dashboard');
}

function closeSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  sidebar?.classList.remove('open');
  overlay?.classList.remove('show');
  document.body.style.overflow = '';
}

function getTypeLabel(type) {
  const labels = {
    work: 'Trabajo',
    meeting: 'ReuniÃ³n',
    individual: 'Individual',
    study: 'Estudio'
  };
  return labels[type] || type;
}
