/* ============================================================
   Productivity Monitor 2.0 - Core Module v2.0.0
   Estado global, almacenamiento y utilidades
   ============================================================ */

const APP_VERSION = '2.1.4';

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
