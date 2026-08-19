/* ============================================================
   Productivity Monitor - Standalone Version v2.1.0
   Funciona 100% en el navegador usando localStorage
   No requiere servidor, instalación ni configuración
   ============================================================ */

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
      audio: true
    });

    // Separar el audio del sistema del stream de pantalla
    const audioTracks = App.screenStream.getAudioTracks();
    if (audioTracks.length > 0) {
      App.systemAudioStream = new MediaStream(audioTracks);
    }

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

  // Detener también el audio del sistema capturado
  if (App.systemAudioStream) {
    App.systemAudioStream.getTracks().forEach(t => t.stop());
    App.systemAudioStream = null;
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
          <i class="fas fa-trash"></i> Eliminar
        </button>
      </div>
    </div>
  `).join('');
}

function deleteSession(sessionId) {
  if (confirm('¿Seguro que quieres eliminar esta sesión?')) {
    Storage.deleteSession(sessionId);
    loadSessions();
    loadDashboard();
    showToast('🗑️ Sesión eliminada');
  }
}

// ===== Edición de sesión =====
function editSession(sessionId) {
  const session = Storage.getSession(sessionId);
  if (!session) return;

  const modal = document.getElementById('reportModal');
  const title = document.getElementById('modalTitle');
  const body = document.getElementById('modalBody');

  title.textContent = 'Editar Sesión';
  body.innerHTML = `
    <div class="edit-session">
      <div class="form-group">
        <label for="editTitle">Título</label>
        <input type="text" id="editTitle" value="${escapeHtml(session.title)}">
      </div>
      <div class="form-group">
        <label for="editType">Tipo</label>
        <select id="editType">
          <option value="work" ${session.type === 'work' ? 'selected' : ''}>Trabajo</option>
          <option value="meeting" ${session.type === 'meeting' ? 'selected' : ''}>Reunión</option>
          <option value="individual" ${session.type === 'individual' ? 'selected' : ''}>Individual</option>
          <option value="study" ${session.type === 'study' ? 'selected' : ''}>Estudio</option>
        </select>
      </div>
      <div class="edit-actions" style="display:flex;gap:12px;margin-top:16px">
        <button class="btn btn-success" onclick="saveSessionEdit('${session.id}')">
          <i class="fas fa-save"></i> Guardar
        </button>
        <button class="btn btn-secondary" onclick="closeModal()">
          <i class="fas fa-times"></i> Cancelar
        </button>
      </div>
    </div>
  `;
  modal.style.display = 'flex';
}

function saveSessionEdit(sessionId) {
  const title = document.getElementById('editTitle').value.trim();
  const type = document.getElementById('editType').value;

  if (!title) {
    showToast('⚠️ El título no puede estar vacío', 'error');
    return;
  }

  Storage.updateSession(sessionId, { title, type });
  closeModal();
  loadSessions();
  loadDashboard();
  showToast('✅ Sesión actualizada');
}

// ===== Detalles de sesión =====
function viewSessionDetails(sessionId) {
  const session = Storage.getSession(sessionId);
  if (!session) return;

  const modal = document.getElementById('reportModal');
  const title = document.getElementById('modalTitle');
  const body = document.getElementById('modalBody');

  title.textContent = session.title;

  const transcripts = session.transcripts || [];
  const screenshots = session.screenshots || [];

  body.innerHTML = `
    <div class="session-detail">
      <div class="session-detail-header">
        <span class="session-type-badge ${session.type}">${getTypeLabel(session.type)}</span>
        <span class="session-status ${session.status}">${session.status === 'active' ? '● Activa' : '✓ Terminada'}</span>
      </div>
      <div class="session-detail-meta">
        <p><i class="fas fa-calendar"></i> Inicio: ${formatDateTime(session.startedAt)}</p>
        ${session.endedAt ? `<p><i class="fas fa-calendar-check"></i> Fin: ${formatDateTime(session.endedAt)}</p>` : ''}
        <p><i class="fas fa-clock"></i> Duración: ${formatDuration(session.duration || 0)}</p>
      </div>

      <div class="export-actions">
        <button class="btn btn-primary" onclick="generateAISummary('${session.id}')">
          <i class="fas fa-robot"></i> Resumen IA
        </button>
        <button class="btn btn-secondary" onclick="exportReportPDF('${session.id}')">
          <i class="fas fa-file-pdf"></i> PDF
        </button>
        <button class="btn btn-secondary" onclick="exportReportExcel('${session.id}')">
          <i class="fas fa-file-excel"></i> Excel
        </button>
        <button class="btn btn-secondary" onclick="exportScreenshots('${session.id}')">
          <i class="fas fa-images"></i> Capturas
        </button>
      </div>

      <h4><i class="fas fa-comment-dots"></i> Transcripciones (${transcripts.length})</h4>

      ${transcripts.length === 0 ? '<p class="empty-state">Sin transcripciones</p>' : `
        <div class="transcript-list">
          ${transcripts.map(t => `
            <div class="transcript-entry">
              <span class="transcript-time">${formatTime(t.timestamp)}</span>
              <span class="transcript-text">${escapeHtml(t.text)}</span>
            </div>
          `).join('')}
        </div>
      `}

      <h4><i class="fas fa-camera"></i> Capturas (${screenshots.length})</h4>
      ${screenshots.length === 0 ? '<p class="empty-state">Sin capturas</p>' : `
        <div class="screenshot-grid">
          ${screenshots.slice(-6).map(s => `
            <div class="screenshot-thumb">
              <img src="${s.dataUrl}" alt="Captura ${formatTime(s.timestamp)}" onclick="window.open(this.src)">
              <span>${formatTime(s.timestamp)}</span>
            </div>
          `).join('')}
        </div>
      `}
    </div>
  `;

  modal.style.display = 'flex';
}

function closeModal() {
  document.getElementById('reportModal').style.display = 'none';
}

// ===== Exportar capturas =====
function exportScreenshots(sessionId) {
  const session = Storage.getSession(sessionId);
  if (!session) return;

  const screenshots = session.screenshots || [];
  if (screenshots.length === 0) {
    showToast('⚠️ No hay capturas para exportar', 'error');
    return;
  }

  // Crear un HTML con todas las capturas para imprimir/guardar
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Capturas - ${session.title}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        h1 { color: #1a73e8; }
        .screenshot { margin: 20px 0; page-break-inside: avoid; }
        .screenshot img { max-width: 100%; border: 1px solid #ddd; border-radius: 5px; }
        .screenshot .time { color: #666; font-size: 12px; margin-top: 5px; }
      </style>
    </head>
    <body>
      <h1>Capturas de Sesión</h1>
      <p><strong>${session.title}</strong> - ${formatDateTime(session.startedAt)}</p>
      ${screenshots.map(s => `
        <div class="screenshot">
          <img src="${s.dataUrl}" alt="Captura">
          <div class="time">${formatDateTime(s.timestamp)}</div>
        </div>
      `).join('')}
    </body>
    </html>
  `;

  const win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();
  win.focus();
  win.print();
}

// ===== Reportes =====
function loadReports() {
  const sessions = Storage.getSessions();
  const container = document.getElementById('reports-list');

  if (sessions.length === 0) {
    container.innerHTML = '<p class="empty-state">No hay sesiones para generar reportes.</p>';
    return;
  }

  container.innerHTML = sessions.map(s => `
    <div class="report-item">
      <div class="report-item-header">
        <span class="session-type-badge ${s.type}">${getTypeLabel(s.type)}</span>
        <span class="session-date">${formatDateTime(s.startedAt)}</span>
      </div>
      <div class="report-item-title">${escapeHtml(s.title)}</div>
      <div class="report-item-meta">
        <span><i class="fas fa-clock"></i> ${formatDuration(s.duration || 0)}</span>
        <span><i class="fas fa-comment-dots"></i> ${s.transcripts ? s.transcripts.length : 0} transcripciones</span>
      </div>
      <div class="report-item-actions">
        <button class="btn btn-sm btn-primary" onclick="generateReport('${s.id}')">
          <i class="fas fa-file-alt"></i> Generar Reporte
        </button>
        <button class="btn btn-sm btn-secondary" onclick="exportReportPDF('${s.id}')">
          <i class="fas fa-file-pdf"></i> PDF
        </button>
        <button class="btn btn-sm btn-secondary" onclick="exportReportExcel('${s.id}')">
          <i class="fas fa-file-excel"></i> Excel
        </button>
      </div>
    </div>
  `).join('');
}

function generateReport(sessionId) {
  const session = Storage.getSession(sessionId);
  if (!session) return;

  const modal = document.getElementById('reportModal');
  const title = document.getElementById('modalTitle');
  const body = document.getElementById('modalBody');

  title.textContent = 'Reporte de Sesión';

  const transcripts = session.transcripts || [];
  const screenshots = session.screenshots || [];

  body.innerHTML = `
    <div class="report-content">
      <h3>${escapeHtml(session.title)}</h3>
      <p><strong>Tipo:</strong> ${getTypeLabel(session.type)}</p>
      <p><strong>Inicio:</strong> ${formatDateTime(session.startedAt)}</p>
      ${session.endedAt ? `<p><strong>Fin:</strong> ${formatDateTime(session.endedAt)}</p>` : ''}
      <p><strong>Duración:</strong> ${formatDuration(session.duration || 0)}</p>
      <p><strong>Transcripciones:</strong> ${transcripts.length}</p>
      <p><strong>Capturas:</strong> ${screenshots.length}</p>

      <h4>Transcripciones</h4>
      ${transcripts.length === 0 ? '<p class="empty-state">Sin transcripciones</p>' : `
        <div class="transcript-list">
          ${transcripts.map(t => `
            <div class="transcript-entry">
              <span class="transcript-time">${formatTime(t.timestamp)}</span>
              <span class="transcript-text">${escapeHtml(t.text)}</span>
            </div>
          `).join('')}
        </div>
      `}
    </div>
  `;

  modal.style.display = 'flex';
}

function generateFullReport() {
  const sessions = Storage.getSessions();
  if (sessions.length === 0) {
    showToast('⚠️ No hay sesiones para generar un reporte completo', 'error');
    return;
  }

  const modal = document.getElementById('reportModal');
  const title = document.getElementById('modalTitle');
  const body = document.getElementById('modalBody');

  title.textContent = 'Reporte Completo';

  let totalMs = 0;
  let totalTranscripts = 0;
  let totalScreenshots = 0;

  sessions.forEach(s => {
    if (s.duration) totalMs += s.duration;
    if (s.transcripts) totalTranscripts += s.transcripts.length;
    if (s.screenshots) totalScreenshots += s.screenshots.length;
  });

  body.innerHTML = `
    <div class="report-content">
      <h3>Resumen General</h3>
      <p><strong>Sesiones:</strong> ${sessions.length}</p>
      <p><strong>Tiempo total:</strong> ${formatDuration(totalMs)}</p>
      <p><strong>Transcripciones:</strong> ${totalTranscripts}</p>
      <p><strong>Capturas:</strong> ${totalScreenshots}</p>

      <h4>Sesiones</h4>
      ${sessions.map(s => `
        <div class="report-session">
          <strong>${escapeHtml(s.title)}</strong> - ${getTypeLabel(s.type)} - ${formatDuration(s.duration || 0)}
        </div>
      `).join('')}
    </div>
  `;

  modal.style.display = 'flex';
}

// ===== Exportar PDF =====
function exportReportPDF(sessionId) {
  const session = Storage.getSession(sessionId);
  if (!session) return;

  const transcripts = session.transcripts || [];

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Reporte - ${session.title}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        h1 { color: #1a73e8; }
        h2 { color: #333; border-bottom: 2px solid #1a73e8; padding-bottom: 5px; }
        .meta { color: #666; margin-bottom: 20px; }
        .transcript { margin: 10px 0; padding: 10px; background: #f5f5f5; border-radius: 5px; }
        .time { color: #999; font-size: 12px; }
      </style>
    </head>
    <body>
      <h1>Reporte de Sesión</h1>
      <div class="meta">
        <p><strong>${session.title}</strong></p>
        <p>Tipo: ${getTypeLabel(session.type)}</p>
        <p>Inicio: ${formatDateTime(session.startedAt)}</p>
        ${session.endedAt ? `<p>Fin: ${formatDateTime(session.endedAt)}</p>` : ''}
        <p>Duración: ${formatDuration(session.duration || 0)}</p>
      </div>
      <h2>Transcripciones (${transcripts.length})</h2>
      ${transcripts.length === 0 ? '<p>Sin transcripciones</p>' : transcripts.map(t => `
        <div class="transcript">
          <div class="time">${formatDateTime(t.timestamp)}</div>
          <div>${escapeHtml(t.text)}</div>
        </div>
      `).join('')}
    </body>
    </html>
  `;

  const win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();
  win.focus();
  win.print();
}

// ===== Exportar Excel =====
function exportReportExcel(sessionId) {
  const session = Storage.getSession(sessionId);
  if (!session) return;

  const transcripts = session.transcripts || [];

  let csv = 'Tiempo,Transcripción\n';
  transcripts.forEach(t => {
    const time = formatDateTime(t.timestamp);
    const text = t.text.replace(/"/g, '""');
    csv += `"${time}","${text}"\n`;
  });

  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `reporte_${session.title.replace(/[^a-z0-9]/gi, '_')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('📊 Reporte Excel exportado');
}

// ===== Exportar todos los datos =====
function exportAllData() {
  const data = Storage.load();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `productivity_monitor_backup_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('💾 Datos exportados');
}

function exportJSON() {
  exportAllData();
}

// ===== Resumen IA =====
async function callOmniRoute(messages) {
  try {
    const response = await fetch('https://omniroute.vercel.app/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages })
    });
    if (!response.ok) throw new Error('Error en la API');
    const data = await response.json();
    return data.choices?.[0]?.message?.content || data.content || '';
  } catch (err) {
    console.error('Error llamando a OmniRoute:', err);
    throw err;
  }
}

function splitTranscriptIntoChunks(transcripts, chunkSize = 3000) {
  const chunks = [];
  let current = '';
  transcripts.forEach(t => {
    const text = `${formatTime(t.timestamp)}: ${t.text}\n`;
    if ((current + text).length > chunkSize && current) {
      chunks.push(current);
      current = text;
    } else {
      current += text;
    }
  });
  if (current) chunks.push(current);
  return chunks;
}

async function generateAISummary(sessionId) {
  const session = Storage.getSession(sessionId);
  if (!session) return;

  const modal = document.getElementById('reportModal');
  const title = document.getElementById('modalTitle');
  const body = document.getElementById('modalBody');

  title.textContent = 'Resumen IA';
  body.innerHTML = `
    <div class="ai-summary">
      <p class="empty-state"><i class="fas fa-spinner fa-spin"></i> Generando resumen con IA...</p>
    </div>
  `;
  modal.style.display = 'flex';

  try {
    const transcripts = session.transcripts || [];
    if (transcripts.length === 0) {
      body.innerHTML = '<p class="empty-state">No hay transcripciones para resumir.</p>';
      return;
    }

    const chunks = splitTranscriptIntoChunks(transcripts);
    const summaries = [];

    for (let i = 0; i < chunks.length; i++) {
      const messages = [
        {
          role: 'system',
          content: 'Eres un asistente que resume reuniones y sesiones de trabajo en español. Sé conciso y estructurado.'
        },
        {
          role: 'user',
          content: `Resume la siguiente parte (${i + 1}/${chunks.length}) de la sesión "${session.title}" (${getTypeLabel(session.type)}):\n\n${chunks[i]}`
        }
      ];
      const summary = await callOmniRoute(messages);
      summaries.push(summary);
    }

    const fullSummary = summaries.join('\n\n---\n\n');
    renderAISummaryResult(body, sessionId, fullSummary);
  } catch (err) {
    console.error('Error generando resumen:', err);
    body.innerHTML = `
      <p class="empty-state">❌ Error al generar el resumen. Intenta nuevamente.</p>
      <button class="btn btn-primary" onclick="generateAISummary('${sessionId}')">
        <i class="fas fa-redo"></i> Reintentar
      </button>
    `;
  }
}

function renderAISummaryResult(body, sessionId, summary) {
  body.innerHTML = `
    <div class="ai-summary">
      <div class="ai-summary-content">
        ${summary.split('\n').map(line => {
          if (line.startsWith('#')) {
            const level = line.match(/^#+/)[0].length;
            const text = line.replace(/^#+\s*/, '');
            return `<h${Math.min(level, 4)}>${escapeHtml(text)}</h${Math.min(level, 4)}>`;
          }
          if (line.trim() === '') return '<br>';
          if (line.startsWith('- ') || line.startsWith('* ')) {
            return `<li>${escapeHtml(line.slice(2))}</li>`;
          }
          return `<p>${escapeHtml(line)}</p>`;
        }).join('')}
      </div>
      <div class="ai-summary-actions" style="display:flex;gap:12px;margin-top:16px;flex-wrap:wrap">
        <button class="btn btn-secondary" onclick="copyAISummary()">
          <i class="fas fa-copy"></i> Copiar
        </button>
        <button class="btn btn-secondary" onclick="downloadAISummary('${sessionId}')">
          <i class="fas fa-download"></i> Descargar
        </button>
        <button class="btn btn-primary" onclick="generateAISummary('${sessionId}')">
          <i class="fas fa-redo"></i> Regenerar
        </button>
      </div>
    </div>
  `;
}

function copyAISummary() {
  const content = document.querySelector('.ai-summary-content');
  if (!content) return;
  const text = content.innerText;
  navigator.clipboard.writeText(text).then(() => {
    showToast('📋 Resumen copiado al portapapeles');
  });
}

function downloadAISummary(sessionId) {
  const session = Storage.getSession(sessionId);
  if (!session) return;
  const content = document.querySelector('.ai-summary-content');
  if (!content) return;

  const blob = new Blob([content.innerText], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `resumen_${session.title.replace(/[^a-z0-9]/gi, '_')}.txt`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('📄 Resumen descargado');
}

// ===== Gráficos del Dashboard =====
function renderActivityChart() {
  const container = document.getElementById('activity-chart');
  if (!container) return;

  const sessions = Storage.getSessions();
  if (sessions.length === 0) {
    container.innerHTML = '<p class="empty-state">Sin datos de actividad</p>';
    return;
  }

  const days = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    days.push({
      label: d.toLocaleDateString('es-ES', { weekday: 'short' }),
      total: 0
    });
  }

  sessions.forEach(s => {
    const sDate = new Date(s.startedAt);
    const day = days.find(d => {
      const dd = new Date(sDate);
      return dd.toDateString() === new Date(now.getFullYear(), now.getMonth(), now.getDate() - (6 - days.indexOf(d))).toDateString();
    });
    if (day) day.total += s.duration || 0;
  });

  const maxTotal = Math.max(...days.map(d => d.total), 1);

  container.innerHTML = `
    <div class="bar-chart">
      ${days.map(d => {
        const height = Math.max(4, (d.total / maxTotal) * 120);
        const hours = (d.total / 3600000).toFixed(1);
        return `
          <div class="bar-col">
            <span class="bar-value">${d.total > 0 ? hours + 'h' : ''}</span>
            <div class="bar" style="height:${height}px;background:var(--accent)" title="${hours}h"></div>
            <span class="bar-label">${d.label}</span>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function renderTypeChart() {
  const container = document.getElementById('type-chart');
  if (!container) return;

  const sessions = Storage.getSessions();
  if (sessions.length === 0) {
    container.innerHTML = '<p class="empty-state">Sin datos de tipos</p>';
    return;
  }

  const types = {};
  sessions.forEach(s => {
    const type = s.type || 'work';
    types[type] = (types[type] || 0) + (s.duration || 0);
  });

  const total = Object.values(types).reduce((a, b) => a + b, 0) || 1;
  const colors = { work: '#1a73e8', meeting: '#34a853', individual: '#fbbc04', study: '#ea4335' };

  container.innerHTML = `
    <div class="donut-chart">
      ${Object.entries(types).map(([type, ms]) => {
        const pct = Math.round((ms / total) * 100);
        return `
          <div class="donut-item">
            <span class="donut-dot" style="background:${colors[type] || '#888'}"></span>
            <span>${getTypeLabel(type)}</span>
            <span class="donut-pct">${pct}%</span>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

// ===== Inicialización =====
function initApp() {
  setupNavigation();
  setupPrivacyToggle();
  setupGlobalSearch();
  setupMobileMenu();
  loadDashboard();
  checkForActiveSession();
  updateStorageIndicator();
  registerServiceWorker();
}

function togglePrivacyMode() {
  App.privacyMode = !App.privacyMode;
  const btn = document.getElementById('privacyToggle');
  if (btn) {
    btn.classList.toggle('active', App.privacyMode);
    btn.innerHTML = App.privacyMode
      ? '<i class="fas fa-lock"></i> Privacidad ON'
      : '<i class="fas fa-unlock"></i> Privacidad OFF';
  }
  showToast(App.privacyMode ? '🔒 Modo privacidad activado' : '🔓 Modo privacidad desactivado');
}

function clearAllData() {
  if (confirm('¿Seguro que quieres borrar TODOS los datos? Esta acción no se puede deshacer.')) {
    Storage.clearAll();
    loadDashboard();
    loadSessions();
    loadReports();
    showToast('🗑️ Todos los datos eliminados');
  }
}

function importData() {
  document.getElementById('importFile').click();
}

function handleImport(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (data.sessions) {
        Storage.save(data);
        loadDashboard();
        loadSessions();
        loadReports();
        showToast('✅ Datos importados correctamente');
      } else {
        showToast('❌ Archivo inválido', 'error');
      }
    } catch (err) {
      showToast('❌ Error al importar datos', 'error');
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}

function updateStorageIndicator() {
  const indicator = document.getElementById('storageIndicator');
  if (!indicator) return;

  const usage = Storage.getUsagePercent();
  const usageMB = (Storage.getUsage() / (1024 * 1024)).toFixed(2);
  indicator.innerHTML = `
    <i class="fas fa-database"></i>
    <span>${usageMB} MB / 5 MB (${usage}%)</span>
  `;
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(err => {
      console.error('Error registrando SW:', err);
    });
  }
}

// ===== Búsqueda global =====
function globalSearch() {
  const query = document.getElementById('globalSearchInput').value.trim();
  if (!query) {
    hideSearchResults();
    return;
  }
  doSearch(query);
}

function hideSearchResults() {
  const results = document.getElementById('searchResults');
  if (results) results.style.display = 'none';
}

function doSearch(query) {
  const sessions = Storage.getSessions();
  const results = [];

  sessions.forEach(s => {
    if ((s.title || '').toLowerCase().includes(query.toLowerCase())) {
      results.push({ session: s, type: 'title', text: s.title });
    }
    (s.transcripts || []).forEach(t => {
      if (t.text.toLowerCase().includes(query.toLowerCase())) {
        results.push({ session: s, type: 'transcript', text: t.text });
      }
    });
  });

  const container = document.getElementById('searchResults');
  if (!container) return;

  if (results.length === 0) {
    container.innerHTML = '<p class="empty-state">Sin resultados</p>';
  } else {
    container.innerHTML = results.slice(0, 10).map(r => `
      <div class="search-result" onclick="viewSessionDetails('${r.session.id}')">
        <div class="search-result-title">${highlightMatch(r.session.title, query)}</div>
        <div class="search-result-text">${highlightMatch(r.text, query)}</div>
        <div class="search-result-meta">${formatDateTime(r.session.startedAt)}</div>
      </div>
    `).join('');
  }
  container.style.display = 'block';
}

function highlightMatch(text, query) {
  if (!text || !query) return escapeHtml(text);
  const escaped = escapeHtml(text);
  const escapedQuery = escapeHtml(query);
  const regex = new RegExp(`(${escapedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return escaped.replace(regex, '<mark>$1</mark>');
}

function exportBackup() {
  exportAllData();
}

// ===== Navegación =====
function setupNavigation() {
  document.querySelectorAll('.nav-item, .bn-item').forEach(item => {
    item.addEventListener('click', () => {
      const view = item.dataset.view;
      if (view) switchView(view);
    });
  });
}

function setupPrivacyToggle() {
  const btn = document.getElementById('privacyToggle');
  if (btn) {
    btn.addEventListener('click', togglePrivacyMode);
  }
}

function setupGlobalSearch() {
  const input = document.getElementById('globalSearchInput');
  if (input) {
    input.addEventListener('input', globalSearch);
    input.addEventListener('blur', () => setTimeout(hideSearchResults, 200));
  }
}

function setupMobileMenu() {
  const btn = document.getElementById('mobileMenuBtn');
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  if (btn) {
    btn.addEventListener('click', () => {
      sidebar?.classList.add('open');
      overlay?.classList.add('show');
      document.body.style.overflow = 'hidden';
    });
  }
  if (overlay) {
    overlay.addEventListener('click', closeSidebar);
  }
}

// Inicializar la app
document.addEventListener('DOMContentLoaded', initApp);
