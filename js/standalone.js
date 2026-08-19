/* ============================================================
   Productivity Monitor - Standalone Version v2.0.0
   Funciona 100% en el navegador usando localStorage
   No requiere servidor, instalación ni configuración
   ============================================================ */

// ===== Estado Global =====
const App = {
  sessions: [],
  currentSession: null,
  screenStream: null,
  audioStream: null,
  recognition: null,
  transcriptBuffer: [],
  screenshotInterval: null,
  audioContext: null,
  analyser: null,
  visualizerInterval: null,
  privacyMode: false,
  isRecording: false,
  restoredSession: null
};

// ===== Almacenamiento Local =====
const Storage = {
  KEY: 'productivity_monitor_data',
  META_KEY: 'productivity_monitor_meta',
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
      showToast('⚠️ Error al guardar datos. El almacenamiento está lleno.', 'error');
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
  },

  updateSession(sessionId, updates) {
    const sessions = this.getSessions();
    const idx = sessions.findIndex(s => s.id === sessionId);
    if (idx !== -1) {
      sessions[idx] = { ...sessions[idx], ...updates };
      this.saveSessions(sessions);
    }
  },

  getSession(sessionId) {
    return this.getSessions().find(s => s.id === sessionId);
  },

  deleteSession(sessionId) {
    const sessions = this.getSessions().filter(s => s.id !== sessionId);
    this.saveSessions(sessions);
  },

  clearAll() {
    localStorage.removeItem(this.KEY);
    localStorage.removeItem(this.META_KEY);
  },

  // Métricas de almacenamiento
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

  // Compresión de capturas
  compressScreenshot(dataUrl, maxWidth = 640) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.4));
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

// ===== Navegación =====
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

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function closeSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  sidebar?.classList.remove('open');
  overlay?.classList.remove('show');
  document.body.style.overflow = '';
}

// ===== Dashboard =====
function loadDashboard() {
  const sessions = Storage.getSessions();

  let totalMs = 0;
  let totalTranscripts = 0;
  let totalScreenshots = 0;

  sessions.forEach(s => {
    if (s.duration) totalMs += s.duration;
    if (s.transcripts) totalTranscripts += s.transcripts.length;
    if (s.screenshots) totalScreenshots += s.screenshots.length;
  });

  document.getElementById('stat-duration').textContent = formatDuration(totalMs);
  document.getElementById('stat-sessions').textContent = sessions.length;
  document.getElementById('stat-transcripts').textContent = totalTranscripts;
  document.getElementById('stat-screenshots').textContent = totalScreenshots;

  renderActivityChart();
  renderTypeChart();
  renderProductivityScore();
  renderWeeklyTrend();

  const recentContainer = document.getElementById('recent-sessions');
  const recent = sessions.slice(0, 5);

  if (recent.length === 0) {
    recentContainer.innerHTML = '<p class="empty-state">No hay sesiones registradas aún. Inicia el monitoreo para comenzar.</p>';
    return;
  }

  recentContainer.innerHTML = recent.map(s => `
    <div class="session-item" onclick="viewSessionDetails('${s.id}')">
      <div class="session-item-header">
        <span class="session-type-badge ${s.type}">${getTypeLabel(s.type)}</span>
        <span class="session-date">${formatDateTime(s.startedAt)}</span>
      </div>
      <div class="session-item-title">${escapeHtml(s.title || 'Sesión sin título')}</div>
      <div class="session-item-meta">
        <span><i class="fas fa-clock"></i> ${formatDuration(s.duration || 0)}</span>
        <span><i class="fas fa-comment-dots"></i> ${s.transcripts ? s.transcripts.length : 0} transcripciones</span>
        <span><i class="fas fa-camera"></i> ${s.screenshots ? s.screenshots.length : 0} capturas</span>
      </div>
    </div>
  `).join('');
}

function getTypeLabel(type) {
  const labels = {
    work: 'Trabajo',
    meeting: 'Reunión',
    individual: 'Individual',
    study: 'Estudio'
  };
  return labels[type] || type;
}

// ===== Puntaje de productividad =====
function calculateProductivityScore(sessions) {
  if (sessions.length === 0) return 0;

  let score = 0;
  let count = 0;

  sessions.forEach(s => {
    if (!s.duration || s.duration < 60000) return;

    let sessionScore = 50;

    const minutes = s.duration / 60000;
    if (minutes >= 30) sessionScore += 20;
    else if (minutes >= 15) sessionScore += 10;

    const transcriptCount = (s.transcripts || []).length;
    if (transcriptCount >= 10) sessionScore += 15;
    else if (transcriptCount >= 5) sessionScore += 10;
    else if (transcriptCount >= 1) sessionScore += 5;

    const screenshotCount = (s.screenshots || []).length;
    if (screenshotCount >= 5) sessionScore += 10;
    else if (screenshotCount >= 1) sessionScore += 5;

    const reports = s.reports || [];
    const bloqueos = reports.reduce((acc, r) => acc + (r.personal?.bloqueos?.length || 0), 0);
    if (bloqueos > 3) sessionScore -= 10;

    score += Math.max(0, Math.min(100, sessionScore));
    count++;
  });

  return count > 0 ? Math.round(score / count) : 0;
}

function renderProductivityScore() {
  const container = document.getElementById('productivity-score');
  if (!container) return;

  const sessions = Storage.getSessions();
  const score = calculateProductivityScore(sessions);

  let color = '#f87171';
  let label = 'Baja';
  if (score >= 80) { color = '#4ade80'; label = 'Excelente'; }
  else if (score >= 60) { color = '#a3e635'; label = 'Buena'; }
  else if (score >= 40) { color = '#fbbf24'; label = 'Regular'; }

  container.innerHTML = `
    <div class="score-circle" style="--score-color:${color};--score:${score * 3.6}deg">
      <div class="score-value">${score}</div>
      <div class="score-label">${label}</div>
    </div>
    <div class="score-details">
      <p><i class="fas fa-info-circle"></i> Puntaje promedio basado en duración, transcripciones y capturas.</p>
    </div>
  `;
}

// ===== Tendencia semanal =====
function renderWeeklyTrend() {
  const container = document.getElementById('weekly-trend');
  if (!container) return;

  const sessions = Storage.getSessions();
  if (sessions.length === 0) {
    container.innerHTML = '<p class="empty-state">Inicia sesiones para ver tu tendencia</p>';
    return;
  }

  const weeks = [];
  const now = new Date();
  const currentWeekStart = new Date(now);
  currentWeekStart.setHours(0, 0, 0, 0);
  currentWeekStart.setDate(currentWeekStart.getDate() - currentWeekStart.getDay() + 1);

  for (let i = 7; i >= 0; i--) {
    const start = new Date(currentWeekStart);
    start.setDate(start.getDate() - (i * 7));
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    weeks.push({
      start,
      end,
      label: start.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }),
      total: 0
    });
  }

  sessions.forEach(s => {
    const sDate = new Date(s.startedAt);
    const week = weeks.find(w => sDate >= w.start && sDate < w.end);
    if (week) week.total += s.duration || 0;
  });

  const maxTotal = Math.max(...weeks.map(w => w.total), 1);

  container.innerHTML = `
    <div class="bar-chart">
      ${weeks.map(w => {
        const height = Math.max(4, (w.total / maxTotal) * 120);
        const hours = (w.total / 3600000).toFixed(1);
        return `
          <div class="bar-col">
            <span class="bar-value">${w.total > 0 ? hours + 'h' : ''}</span>
            <div class="bar" style="height:${height}px;background:var(--accent)" title="${hours}h"></div>
            <span class="bar-label">${w.label}</span>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

// ===== Monitoreo - Captura de Pantalla =====
async function startScreenCapture() {
  if (App.privacyMode) {
    showToast('🔒 Modo privacidad activado. Desactívalo para monitorear.', 'error');
    return;
  }

  try {
    App.screenStream = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: 5 },
      audio: false
    });

    const video = document.createElement('video');
    video.srcObject = App.screenStream;
    video.autoplay = true;
    video.muted = true;
    video.style.width = '100%';
    video.style.borderRadius = '8px';

    const preview = document.getElementById('screenPreview');
    preview.innerHTML = '';
    preview.appendChild(video);

    document.getElementById('btnStartScreen').style.display = 'none';
    document.getElementById('btnStopScreen').style.display = 'inline-flex';

    const status = document.getElementById('screenStatus');
    status.innerHTML = '<span class="status-badge active"><i class="fas fa-circle"></i> Capturando</span>';

    if (App.currentSession) {
      startScreenshotInterval();
    }

    App.screenStream.getVideoTracks()[0].addEventListener('ended', () => {
      stopScreenCapture();
    });

    showToast('📺 Captura de pantalla iniciada');
  } catch (err) {
    console.error('Error al capturar pantalla:', err);
    if (err.name === 'NotAllowedError') {
      showToast('❌ Permiso de pantalla denegado. Acepta el diálogo para compartir.', 'error');
    } else if (err.name === 'AbortError') {
      showToast('ℹ️ Captura de pantalla cancelada', 'info');
    } else {
      showToast('❌ No se pudo iniciar la captura de pantalla', 'error');
    }
  }
}

function stopScreenCapture() {
  if (App.screenStream) {
    App.screenStream.getTracks().forEach(t => t.stop());
    App.screenStream = null;
  }

  clearInterval(App.screenshotInterval);
  App.screenshotInterval = null;

  const preview = document.getElementById('screenPreview');
  if (preview) {
    preview.innerHTML = `
      <div class="preview-placeholder">
        <i class="fas fa-desktop"></i>
        <p>La captura de pantalla aparecerá aquí</p>
      </div>
    `;
  }

  const btnStart = document.getElementById('btnStartScreen');
  const btnStop = document.getElementById('btnStopScreen');
  if (btnStart) btnStart.style.display = 'inline-flex';
  if (btnStop) btnStop.style.display = 'none';

  const status = document.getElementById('screenStatus');
  if (status) status.innerHTML = '<span class="status-badge idle"><i class="fas fa-circle"></i> Inactivo</span>';
}

function startScreenshotInterval() {
  clearInterval(App.screenshotInterval);
  App.screenshotInterval = setInterval(() => {
    if (App.currentSession && App.screenStream) {
      captureScreenshot();
    }
  }, 30000);
}

async function captureScreenshot() {
  if (!App.screenStream || !App.currentSession) return;

  const video = document.querySelector('#screenPreview video');
  if (!video) return;

  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0);

  const dataUrl = canvas.toDataURL('image/jpeg', 0.5);
  const compressed = await Storage.compressScreenshot(dataUrl);

  const screenshot = {
    id: generateId(),
    timestamp: Date.now(),
    dataUrl: compressed
  };

  const session = Storage.getSession(App.currentSession.id);
  if (session) {
    const screenshots = session.screenshots || [];
    if (screenshots.length >= Storage.MAX_SCREENSHOTS_PER_SESSION) {
      screenshots.shift();
    }
    screenshots.push(screenshot);
    Storage.updateSession(session.id, { screenshots });
  }
}

// ===== Monitoreo - Audio y Transcripción =====
async function startAudioCapture() {
  if (App.privacyMode) {
    showToast('🔒 Modo privacidad activado. Desactívalo para monitorear.', 'error');
    return;
  }

  try {
    App.audioStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });

    setupAudioVisualizer();
    startSpeechRecognition();

    document.getElementById('btnStartAudio').style.display = 'none';
    document.getElementById('btnStopAudio').style.display = 'inline-flex';

    const status = document.getElementById('audioStatus');
    status.innerHTML = '<span class="status-badge active"><i class="fas fa-circle"></i> Grabando</span>';

    showToast('🎤 Audio y transcripción iniciados');
  } catch (err) {
    console.error('Error al iniciar audio:', err);
    if (err.name === 'NotAllowedError') {
      showToast('❌ Permiso de micrófono denegado. Habilítalo en la configuración del navegador.', 'error');
    } else {
      showToast('❌ No se pudo acceder al micrófono', 'error');
    }
  }
}

function stopAudioCapture() {
  if (App.audioStream) {
    App.audioStream.getTracks().forEach(t => t.stop());
    App.audioStream = null;
  }

  if (App.recognition) {
    App.recognition.stop();
    App.recognition = null;
  }

  if (App.audioContext) {
    App.audioContext.close();
    App.audioContext = null;
  }

  clearInterval(App.visualizerInterval);
  App.visualizerInterval = null;

  document.querySelectorAll('#visualizerBars span').forEach(bar => {
    bar.style.height = '5px';
  });

  document.getElementById('btnStartAudio').style.display = 'inline-flex';
  document.getElementById('btnStopAudio').style.display = 'none';

  const status = document.getElementById('audioStatus');
  status.innerHTML = '<span class="status-badge idle"><i class="fas fa-circle"></i> Inactivo</span>';

  const transcriptStatus = document.getElementById('transcriptStatus');
  transcriptStatus.innerHTML = '<span class="status-badge idle"><i class="fas fa-circle"></i> Detenido</span>';
}

function setupAudioVisualizer() {
  App.audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const source = App.audioContext.createMediaStreamSource(App.audioStream);
  App.analyser = App.audioContext.createAnalyser();
  App.analyser.fftSize = 256;
  source.connect(App.analyser);

  const dataArray = new Uint8Array(App.analyser.frequencyBinCount);

  clearInterval(App.visualizerInterval);
  App.visualizerInterval = setInterval(() => {
    if (!App.analyser) return;
    App.analyser.getByteFrequencyData(dataArray);

    const bars = document.querySelectorAll('#visualizerBars span');
    bars.forEach((bar, i) => {
      const value = dataArray[i * 2] || 0;
      const height = Math.max(5, (value / 255) * 60);
      bar.style.height = `${height}px`;
    });
  }, 100);
}

function startSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    showToast('⚠️ Tu navegador no soporta reconocimiento de voz. Usa Chrome o Edge.', 'error');
    return;
  }

  App.recognition = new SpeechRecognition();
  App.recognition.lang = 'es-ES';
  App.recognition.continuous = true;
  App.recognition.interimResults = true;

  let finalTranscript = '';

  App.recognition.onresult = (event) => {
    let interim = '';

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        finalTranscript += transcript + ' ';
        addTranscriptEntry(transcript);
      } else {
        interim += transcript;
      }
    }

    const liveTranscript = document.getElementById('liveTranscript');
    if (interim) {
      liveTranscript.innerHTML = `
        <div class="transcript-entry interim">
          <span class="transcript-time">${formatTime(Date.now())}</span>
          <span class="transcript-text">${escapeHtml(interim)}</span>
        </div>
      `;
    }
  };

  App.recognition.onerror = (event) => {
    console.error('Error de reconocimiento:', event.error);
    if (event.error === 'not-allowed') {
      showToast('❌ Permiso de micrófono denegado', 'error');
    }
  };

  App.recognition.onend = () => {
    if (App.audioStream && !App.privacyMode) {
      try {
        App.recognition.start();
      } catch (e) {}
    }
  };

  App.recognition.start();

  const transcriptStatus = document.getElementById('transcriptStatus');
  transcriptStatus.innerHTML = '<span class="status-badge active"><i class="fas fa-circle"></i> Escuchando...</span>';
}

function addTranscriptEntry(text) {
  if (!App.currentSession) return;

  const entry = {
    id: generateId(),
    timestamp: Date.now(),
    text: text.trim()
  };

  const session = Storage.getSession(App.currentSession.id);
  if (session) {
    const transcripts = session.transcripts || [];
    transcripts.push(entry);
    Storage.updateSession(session.id, { transcripts });
  }

  const liveTranscript = document.getElementById('liveTranscript');
  const entryEl = document.createElement('div');
  entryEl.className = 'transcript-entry';
  entryEl.innerHTML = `
    <span class="transcript-time">${formatTime(entry.timestamp)}</span>
    <span class="transcript-text">${escapeHtml(entry.text)}</span>
  `;

  if (liveTranscript.querySelector('.empty-state')) {
    liveTranscript.innerHTML = '';
  }
  liveTranscript.appendChild(entryEl);
  liveTranscript.scrollTop = liveTranscript.scrollHeight;
}

// ===== Sesiones =====
async function startSession() {
  if (App.privacyMode) {
    showToast('🔒 Modo privacidad activado. Desactívalo para iniciar sesión.', 'error');
    return;
  }

  const title = document.getElementById('sessionTitle').value.trim();
  const type = document.getElementById('sessionType').value;

  const session = {
    id: generateId(),
    title: title || `Sesión ${formatDateTime(Date.now())}`,
    type: type,
    startedAt: Date.now(),
    endedAt: null,
    duration: 0,
    transcripts: [],
    screenshots: [],
    status: 'active'
  };

  Storage.addSession(session);
  App.currentSession = session;
  App.isRecording = true;

  saveActiveSessionMeta(session.id);

  document.getElementById('btnStartSession').style.display = 'none';
  document.getElementById('btnEndSession').style.display = 'inline-flex';
  document.getElementById('btnGenerateReport').style.display = 'inline-flex';

  showRecordingIndicator();

  if (!App.screenStream) {
    try {
      await startScreenCapture();
    } catch (e) {
      console.error('Error iniciando captura de pantalla:', e);
    }
  } else {
    startScreenshotInterval();
  }

  if (!App.audioStream) {
    try {
      await startAudioCapture();
    } catch (e) {
      console.error('Error iniciando audio:', e);
    }
  }

  showToast('✅ Sesión iniciada: captura y transcripción activas');
}

function endSession() {
  if (!App.currentSession) return;

  const sessionId = App.currentSession.id;
  const duration = Date.now() - App.currentSession.startedAt;

  clearInterval(App.screenshotInterval);
  App.screenshotInterval = null;

  Storage.updateSession(sessionId, {
    endedAt: Date.now(),
    duration: duration,
    status: 'ended'
  });

  App.currentSession = null;
  App.isRecording = false;

  clearActiveSessionMeta();

  document.getElementById('btnStartSession').style.display = 'inline-flex';
  document.getElementById('btnEndSession').style.display = 'none';
  document.getElementById('btnGenerateReport').style.display = 'none';

  hideRecordingIndicator();

  if (App.screenStream) {
    stopScreenCapture();
  }

  if (App.audioStream) {
    stopAudioCapture();
  }

  showToast(`✅ Sesión terminada. Duración: ${formatDuration(duration)}`);
}

// ===== Recuperación de sesión activa =====
function saveActiveSessionMeta(sessionId) {
  try {
    localStorage.setItem(Storage.META_KEY, JSON.stringify({ activeSessionId: sessionId, savedAt: Date.now() }));
  } catch (e) {
    console.error('Error guardando meta:', e);
  }
}

function clearActiveSessionMeta() {
  try {
    localStorage.removeItem(Storage.META_KEY);
  } catch (e) {}
}

function checkForActiveSession() {
  try {
    const meta = JSON.parse(localStorage.getItem(Storage.META_KEY) || 'null');
    if (!meta || !meta.activeSessionId) return;

    const session = Storage.getSession(meta.activeSessionId);
    if (!session || session.status !== 'active') {
      clearActiveSessionMeta();
      return;
    }

    const modal = document.getElementById('reportModal');
    const title = document.getElementById('modalTitle');
    const body = document.getElementById('modalBody');

    title.textContent = 'Sesión activa detectada';
    body.innerHTML = `
      <div class="session-recovery">
        <i class="fas fa-exclamation-triangle" style="font-size:3rem;color:var(--warning);margin-bottom:16px"></i>
        <h4>Se encontró una sesión activa sin terminar</h4>
        <p><strong>${escapeHtml(session.title)}</strong></p>
        <p>Iniciada el ${formatDateTime(session.startedAt)}</p>
        <p>¿Qué deseas hacer?</p>
        <div class="recovery-actions" style="display:flex;gap:12px;margin-top:16px;flex-wrap:wrap">
          <button class="btn btn-success" onclick="resumeActiveSession('${session.id}')">
            <i class="fas fa-play"></i> Retomar Sesión
          </button>
          <button class="btn btn-danger" onclick="closeActiveSession('${session.id}')">
            <i class="fas fa-stop"></i> Cerrar Sesión
          </button>
          <button class="btn btn-secondary" onclick="closeModal()">
            <i class="fas fa-times"></i> Ignorar
          </button>
        </div>
      </div>
    `;
    modal.style.display = 'flex';
  } catch (e) {
    console.error('Error verificando sesión activa:', e);
  }
}

function resumeActiveSession(sessionId) {
  const session = Storage.getSession(sessionId);
  if (!session) return;

  App.currentSession = session;
  App.isRecording = true;

  document.getElementById('btnStartSession').style.display = 'none';
  document.getElementById('btnEndSession').style.display = 'inline-flex';
  document.getElementById('btnGenerateReport').style.display = 'inline-flex';

  showRecordingIndicator();
  closeModal();

  if (!App.screenStream) {
    startScreenCapture().catch(() => {});
  } else {
    startScreenshotInterval();
  }

  if (!App.audioStream) {
    startAudioCapture().catch(() => {});
  }

  showToast('✅ Sesión retomada');
}

function closeActiveSession(sessionId) {
  const session = Storage.getSession(sessionId);
  if (!session) return;

  const duration = Date.now() - session.startedAt;
  Storage.updateSession(sessionId, {
    endedAt: Date.now(),
    duration: duration,
    status: 'ended'
  });

  clearActiveSessionMeta();
  closeModal();
  loadSessions();
  loadDashboard();
  showToast('✅ Sesión cerrada correctamente');
}

function showRecordingIndicator() {
  const existing = document.querySelector('.recording-indicator');
  if (existing) existing.remove();

  const indicator = document.createElement('div');
  indicator.className = 'recording-indicator';
  indicator.innerHTML = `
    <span class="pulse-dot"></span>
    <span>Grabando sesión...</span>
  `;
  document.body.appendChild(indicator);
}

function hideRecordingIndicator() {
  const indicator = document.querySelector('.recording-indicator');
  if (indicator) indicator.remove();
}

// ===== Lista de Sesiones =====
function loadSessions() {
  const sessions = Storage.getSessions();
  const container = document.getElementById('sessions-list');

  if (sessions.length === 0) {
    container.innerHTML = '<p class="empty-state">No hay sesiones registradas. Inicia el monitoreo para comenzar.</p>';
    return;
  }

  container.innerHTML = sessions.map(s => `
    <div class="session-item" onclick="viewSessionDetails('${s.id}')">
      <div class="session-item-header">
        <span class="session-type-badge ${s.type}">${getTypeLabel(s.type)}</span>
        <span class="session-status ${s.status}">${s.status === 'active' ? '● Activa' : '✓ Terminada'}</span>
        <span class="session-date">${formatDateTime(s.startedAt)}</span>
      </div>
      <div class="session-item-title">${escapeHtml(s.title)}</div>
      <div class="session-item-meta">
        <span><i class="fas fa-clock"></i> ${formatDuration(s.duration || 0)}</span>
        <span><i class="fas fa-comment-dots"></i> ${s.transcripts ? s.transcripts.length : 0} transcripciones</span>
        <span><i class="fas fa-camera"></i> ${s.screenshots ? s.screenshots.length : 0} capturas</span>
      </div>
      <div class="session-item-actions">
        <button class="btn btn-sm btn-secondary" onclick="event.stopPropagation();viewSessionDetails('${s.id}')">
          <i class="fas fa-eye"></i> Ver
        </button>
        <button class="btn btn-sm btn-primary" onclick="event.stopPropagation();editSession('${s.id}')">
          <i class="fas fa-edit"></i> Editar
        </button>
        <button class="btn btn-sm btn-danger" onclick="event.stopPropagation();deleteSession('${s.id}')">
          <i class="fas fa-trash"></i> Eliminar
        </button>
      </div>
    </div>
  `).join('');
}

function filterSessions() {
  const search = document.getElementById('sessionSearch').value.toLowerCase();
  const filter = document.getElementById('sessionFilter').value;

  let sessions = Storage.getSessions();

  if (filter === 'active') sessions = sessions.filter(s => s.status === 'active');
  if (filter === 'ended') sessions = sessions.filter(s => s.status === 'ended');

  if (search) {
    sessions = sessions.filter(s =>
      (s.title || '').toLowerCase().includes(search) ||
      (s.transcripts || []).some(t => t.text.toLowerCase().includes(search))
    );
  }

  const container = document.getElementById('sessions-list');
  if (sessions.length === 0) {
    container.innerHTML = '<p class="empty-state">No se encontraron sesiones.</p>';
    return;
  }

  container.innerHTML = sessions.map(s => `
    <div class="session-item" onclick="viewSessionDetails('${s.id}')">
      <div class="session-item-header">
        <span class="session-type-badge ${s.type}">${getTypeLabel(s.type)}</span>
        <span class="session-status ${s.status}">${s.status === 'active' ? '● Activa' : '✓ Terminada'}</span>
        <span class="session-date">${formatDateTime(s.startedAt)}</span>
      </div>
      <div class="session-item-title">${escapeHtml(s.title)}</div>
      <div class="session-item-meta">
        <span><i class="fas fa-clock"></i> ${formatDuration(s.duration || 0)}</span>
        <span><i class="fas fa-comment-dots"></i> ${s.transcripts ? s.transcripts.length : 0} transcripciones</span>
        <span><i class="fas fa-camera"></i> ${s.screenshots ? s.screenshots.length : 0} capturas</span>
      </div>
      <div class="session-item-actions">
        <button class="btn btn-sm btn-secondary" onclick="event.stopPropagation();viewSessionDetails('${s.id}')">
          <i class="fas fa-eye"></i> Ver
        </button>
        <button class="btn btn-sm btn-primary" onclick="event.stopPropagation();editSession('${s.id}')">
          <i class="fas fa-edit"></i> Editar
        </button>
        <button class="btn btn-sm btn-danger" onclick="event.stopPropagation();deleteSession('${s.id}')">
          <i class="fas fa