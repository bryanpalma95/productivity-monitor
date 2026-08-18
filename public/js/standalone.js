/* ============================================================
   Productivity Monitor - Standalone Version
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
  isRecording: false
};

// ===== Almacenamiento Local =====
const Storage = {
  KEY: 'productivity_monitor_data',
  
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
  toast.textContent = message;
  toast.className = `toast show ${type}`;
  setTimeout(() => toast.classList.remove('show'), 3000);
}

// ===== Navegación =====
function switchView(viewName) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  
  const view = document.getElementById(`view-${viewName}`);
  if (view) view.classList.add('active');
  
  const navItem = document.querySelector(`.nav-item[data-view="${viewName}"]`);
  if (navItem) navItem.classList.add('active');
  
  // Cargar datos según la vista
  if (viewName === 'dashboard') loadDashboard();
  if (viewName === 'sessions') loadSessions();
  if (viewName === 'reports') loadReports();
}

// ===== Dashboard =====
function loadDashboard() {
  const sessions = Storage.getSessions();
  
  // Estadísticas
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
  
  // Sesiones recientes
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
    
    // Iniciar capturas periódicas
    if (App.currentSession) {
      startScreenshotInterval();
    }
    
    // Detectar cuando el usuario detiene el compartir
    App.screenStream.getVideoTracks()[0].addEventListener('ended', () => {
      stopScreenCapture();
    });
    
    showToast('📺 Captura de pantalla iniciada');
  } catch (err) {
    console.error('Error al capturar pantalla:', err);
    showToast('❌ No se pudo iniciar la captura de pantalla', 'error');
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
  preview.innerHTML = `
    <div class="preview-placeholder">
      <i class="fas fa-desktop"></i>
      <p>La captura de pantalla aparecerá aquí</p>
    </div>
  `;
  
  document.getElementById('btnStartScreen').style.display = 'inline-flex';
  document.getElementById('btnStopScreen').style.display = 'none';
  
  const status = document.getElementById('screenStatus');
  status.innerHTML = '<span class="status-badge idle"><i class="fas fa-circle"></i> Inactivo</span>';
}

function startScreenshotInterval() {
  clearInterval(App.screenshotInterval);
  App.screenshotInterval = setInterval(() => {
    if (App.currentSession && App.screenStream) {
      captureScreenshot();
    }
  }, 30000); // Cada 30 segundos
}

function captureScreenshot() {
  if (!App.screenStream || !App.currentSession) return;
  
  const video = document.querySelector('#screenPreview video');
  if (!video) return;
  
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0);
  
  const dataUrl = canvas.toDataURL('image/jpeg', 0.5);
  
  const screenshot = {
    id: generateId(),
    timestamp: Date.now(),
    dataUrl: dataUrl
  };
  
  const session = Storage.getSession(App.currentSession.id);
  if (session) {
    const screenshots = session.screenshots || [];
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
    
    // Visualizador de audio
    setupAudioVisualizer();
    
    // Iniciar reconocimiento de voz
    startSpeechRecognition();
    
    document.getElementById('btnStartAudio').style.display = 'none';
    document.getElementById('btnStopAudio').style.display = 'inline-flex';
    
    const status = document.getElementById('audioStatus');
    status.innerHTML = '<span class="status-badge active"><i class="fas fa-circle"></i> Grabando</span>';
    
    showToast('🎤 Audio y transcripción iniciados');
  } catch (err) {
    console.error('Error al iniciar audio:', err);
    showToast('❌ No se pudo acceder al micrófono', 'error');
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
  
  // Reset visualizer
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
    
    // Actualizar transcripción en vivo
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
    // Reiniciar si sigue activo
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
  
  // Actualizar vista en vivo
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
function startSession() {
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
  
  // Actualizar UI
  document.getElementById('btnStartSession').style.display = 'none';
  document.getElementById('btnEndSession').style.display = 'inline-flex';
  document.getElementById('btnGenerateReport').style.display = 'inline-flex';
  
  // Mostrar indicador de grabación
  showRecordingIndicator();
  
  // Iniciar capturas si la pantalla ya está compartida
  if (App.screenStream) {
    startScreenshotInterval();
  }
  
  showToast('✅ Sesión iniciada');
}

function endSession() {
  if (!App.currentSession) return;
  
  const session = App.currentSession;
  const duration = Date.now() - session.startedAt;
  
  Storage.updateSession(session.id, {
    endedAt: Date.now(),
    duration: duration,
    status: 'ended'
  });
  
  App.currentSession = null;
  App.isRecording = false;
  
  // Actualizar UI
  document.getElementById('btnStartSession').style.display = 'inline-flex';
  document.getElementById('btnEndSession').style.display = 'none';
  document.getElementById('btnGenerateReport').style.display = 'none';
  
  // Ocultar indicador
  hideRecordingIndicator();
  
  // Detener capturas
  clearInterval(App.screenshotInterval);
  App.screenshotInterval = null;
  
  showToast(`✅ Sesión terminada. Duración: ${formatDuration(duration)}`);
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

// ===== Reportes =====
function generateReport() {
  if (!App.currentSession) {
    showToast('⚠️ No hay sesión activa', 'error');
    return;
  }
  
  const session = App.currentSession;
  const transcripts = Storage.getSession(session.id)?.transcripts || [];
  
  if (transcripts.length === 0) {
    showToast('⚠️ No hay transcripciones para generar reporte', 'error');
    return;
  }
  
  // Analizar transcripciones
  const analysis = analyzeTranscripts(transcripts);
  
  const report = {
    id: generateId(),
    sessionId: session.id,
    sessionTitle: session.title,
    createdAt: Date.now(),
    personal: {
      pendientes: analysis.pendientes,
      ideas: analysis.ideas,
      bloqueos: analysis.bloqueos
    },
    gerencial: {
      proyectos: analysis.proyectos,
      personas: analysis.personas,
      hitos: analysis.hitos,
      categorias: analysis.categorias
    }
  };
  
  // Guardar reporte en la sesión
  const currentSession = Storage.getSession(session.id);
  if (currentSession) {
    const reports = currentSession.reports || [];
    reports.push(report);
    Storage.updateSession(session.id, { reports });
  }
  
  showReportModal(report);
  showToast('📄 Reporte generado');
}

function analyzeTranscripts(transcripts) {
  const text = transcripts.map(t => t.text).join(' ').toLowerCase();
  
  // Detectar pendientes
  const pendientes = [];
  const pendientePatterns = [
    /(?:tengo|hay|queda|pendiente|falta|debo|necesito|tenemos que|hay que)\s+([^.,;]+)/g,
    /(?:enviar|hacer|crear|revisar|completar|terminar|preparar|actualizar|implementar|corregir)\s+([^.,;]+)/g
  ];
  
  pendientePatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const item = match[1].trim();
      if (item.length > 3 && !pendientes.includes(item)) {
        pendientes.push(item);
      }
    }
  });
  
  // Detectar ideas
  const ideas = [];
  const ideaPatterns = [
    /(?:idea|propuesta|sugerencia|oportunidad|mejorar|optimizar|innovar)\s+([^.,;]+)/g,
    /(?:podríamos|deberíamos|sería bueno|sería ideal)\s+([^.,;]+)/g
  ];
  
  ideaPatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const item = match[1].trim();
      if (item.length > 3 && !ideas.includes(item)) {
        ideas.push(item);
      }
    }
  });
  
  // Detectar bloqueos
  const bloqueos = [];
  const bloqueoPatterns = [
    /(?:problema|bloqueo|dificultad|impedimento|obstáculo|error|bug|falla)\s+([^.,;]+)/g,
    /(?:no puedo|no funciona|no me deja|está roto|está fallando)\s+([^.,;]+)/g
  ];
  
  bloqueoPatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const item = match[1].trim();
      if (item.length > 3 && !bloqueos.includes(item)) {
        bloqueos.push(item);
      }
    }
  });
  
  // Detectar proyectos
  const proyectos = [];
  const proyectoPatterns = [
    /(?:proyecto|proyectos?)\s+([A-Za-zÁÉÍÓÚáéíóúñÑ0-9_-]+)/g,
    /(?:app|aplicación|sistema|plataforma|sitio|web)\s+([A-Za-zÁÉÍÓÚáéíóúñÑ0-9_-]+)/g
  ];
  
  proyectoPatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const item = match[1].trim();
      if (item.length > 2 && !proyectos.includes(item)) {
        proyectos.push(item);
      }
    }
  });
  
  // Detectar personas
  const personas = [];
  const personaPatterns = [
    /(?:con|para|a|de|hablar con|reunión con|llamar a|escribir a)\s+([A-Z][a-záéíóúñ]+)/g
  ];
  
  personaPatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const item = match[1].trim();
      if (item.length > 2 && !personas.includes(item)) {
        personas.push(item);
      }
    }
  });
  
  // Detectar hitos
  const hitos = [];
  const hitoPatterns = [
    /(?:fecha límite|deadline|entrega|hito|fase|etapa|versión|release)\s+([^.,;]+)/g
  ];
  
  hitoPatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const item = match[1].trim();
      if (item.length > 2 && !hitos.includes(item)) {
        hitos.push(item);
      }
    }
  });
  
  // Categorías
  const categorias = {
    reuniones: (text.match(/reunión|reunión|meeting|junta/g) || []).length,
    desarrollo: (text.match(/código|codigo|desarrollo|implementar|programar|bug|feature/g) || []).length,
    diseño: (text.match(/diseño|diseño|ui|ux|interfaz|mockup/g) || []).length,
    gestión: (text.match(/gestión|gestion|planificar|organizar|priorizar|tarea/g) || []).length,
    comunicación: (text.match(/correo|email|mensaje|whatsapp|slack|llamar|escribir/g) || []).length
  };
  
  return {
    pendientes: pendientes.slice(0, 10),
    ideas: ideas.slice(0, 10),
    bloqueos: bloqueos.slice(0, 10),
    proyectos: proyectos.slice(0, 10),
    personas: personas.slice(0, 10),
    hitos: hitos.slice(0, 10),
    categorias
  };
}

function showReportModal(report) {
  const modal = document.getElementById('reportModal');
  const title = document.getElementById('modalTitle');
  const body = document.getElementById('modalBody');
  
  title.textContent = `Reporte: ${report.sessionTitle}`;
  
  body.innerHTML = `
    <div class="report-tabs">
      <button class="report-tab active" onclick="switchReportTab('personal', this)">Personal</button>
      <button class="report-tab" onclick="switchReportTab('gerencial', this)">Gerencial</button>
    </div>
    
    <div class="report-tab-content active" id="tab-personal">
      <h4><i class="fas fa-tasks"></i> Pendientes</h4>
      ${report.personal.pendientes.length === 0 ? '<p class="empty-state">No se detectaron pendientes</p>' : `
        <ul class="report-list">
          ${report.personal.pendientes.map(p => `<li>${escapeHtml(p)}</li>`).join('')}
        </ul>
      `}
      
      <h4><i class="fas fa-lightbulb"></i> Ideas Clave</h4>
      ${report.personal.ideas.length === 0 ? '<p class="empty-state">No se detectaron ideas</p>' : `
        <ul class="report-list">
          ${report.personal.ideas.map(i => `<li>${escapeHtml(i)}</li>`).join('')}
        </ul>
      `}
      
      <h4><i class="fas fa-exclamation-circle"></i> Bloqueos</h4>
      ${report.personal.bloqueos.length === 0 ? '<p class="empty-state">No se detectaron bloqueos</p>' : `
        <ul class="report-list">
          ${report.personal.bloqueos.map(b => `<li>${escapeHtml(b)}</li>`).join('')}
        </ul>
      `}
    </div>
    
    <div class="report-tab-content" id="tab-gerencial">
      <h4><i class="fas fa-folder"></i> Proyectos Mencionados</h4>
      ${report.gerencial.proyectos.length === 0 ? '<p class="empty-state">No se detectaron proyectos</p>' : `
        <ul class="report-list">
          ${report.gerencial.proyectos.map(p => `<li>${escapeHtml(p)}</li>`).join('')}
        </ul>
      `}
      
      <h4><i class="fas fa-users"></i> Personas Mencionadas</h4>
      ${report.gerencial.personas.length === 0 ? '<p class="empty-state">No se detectaron personas</p>' : `
        <ul class="report-list">
          ${report.gerencial.personas.map(p => `<li>${escapeHtml(p)}</li>`).join('')}
        </ul>
      `}
      
      <h4><i class="fas fa-flag"></i> Hitos y Fechas</h4>
      ${report.gerencial.hitos.length === 0 ? '<p class="empty-state">No se detectaron hitos</p>' : `
        <ul class="report-list">
          ${report.gerencial.hitos.map(h => `<li>${escapeHtml(h)}</li>`).join('')}
        </ul>
      `}
      
      <h4><i class="fas fa-chart-pie"></i> Categorías de Actividad</h4>
      <div class="category-chips">
        ${Object.entries(report.gerencial.categorias).map(([cat, count]) => `
          <span class="category-chip ${cat}">${cat}: ${count}</span>
        `).join('')}
      </div>
    </div>
  `;
  
  modal.style.display = 'flex';
}

function switchReportTab(tabName, btn) {
  document.querySelectorAll('.report-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.report-tab-content').forEach(c => c.classList.remove('active'));
  
  btn.classList.add('active');
  document.getElementById(`tab-${tabName}`).classList.add('active');
}

// ===== Reportes Guardados =====
function loadReports() {
  const sessions = Storage.getSessions();
  const container = document.getElementById('reports-list');
  
  // Recopilar todos los reportes
  const allReports = [];
  sessions.forEach(s => {
    if (s.reports && s.reports.length > 0) {
      s.reports.forEach(r => {
        allReports.push({ ...r, sessionType: s.type });
      });
    }
  });
  
  if (allReports.length === 0) {
    container.innerHTML = `
      <p class="empty-state">
        No hay reportes generados aún.<br>
        Inicia una sesión, habla sobre tu trabajo y genera un reporte al terminarla.
      </p>
    `;
    return;
  }
  
  container.innerHTML = allReports.map(r => `
    <div class="report-item">
      <div class="report-item-header">
        <span class="session-type-badge ${r.sessionType}">${getTypeLabel(r.sessionType)}</span>
        <span class="report-date">${formatDateTime(r.createdAt)}</span>
      </div>
      <div class="report-item-title">${escapeHtml(r.sessionTitle)}</div>
      <div class="report-item-summary">
        <span><i class="fas fa-tasks"></i> ${r.personal.pendientes.length} pendientes</span>
        <span><i class="fas fa-lightbulb"></i> ${r.personal.ideas.length} ideas</span>
        <span><i class="fas fa-exclamation-circle"></i> ${r.personal.bloqueos.length} bloqueos</span>
      </div>
      <button class="btn btn-sm btn-primary" onclick="showReportModal(${JSON.stringify(r).replace(/"/g, '"')})">
        <i class="fas fa-eye"></i> Ver Reporte
      </button>
    </div>
  `).join('');
}

// ===== Buscador =====
function doSearch() {
  const query = document.getElementById('searchInput').value.trim().toLowerCase();
  const resultsContainer = document.getElementById('search-results');
  
  if (!query) {
    resultsContainer.innerHTML = '<p class="empty-state">Escribe algo para buscar en tus transcripciones</p>';
    return;
  }
  
  const sessions = Storage.getSessions();
  const results = [];
  
  sessions.forEach(session => {
    const transcripts = session.transcripts || [];
    transcripts.forEach(t => {
      if (t.text.toLowerCase().includes(query)) {
        results.push({
          sessionId: session.id,
          sessionTitle: session.title,
          sessionType: session.type,
          timestamp: t.timestamp,
          text: t.text
        });
      }
    });
  });
  
  if (results.length === 0) {
    resultsContainer.innerHTML = `
      <div class="search-empty">
        <i class="fas fa-search"></i>
        <p>No se encontraron resultados para "<strong>${escapeHtml(query)}</strong>"</p>
      </div>
    `;
    return;
  }
  
  resultsContainer.innerHTML = `
    <div class="search-summary">
      Se encontraron <strong>${results.length}</strong> resultados para "<strong>${escapeHtml(query)}</strong>"
    </div>
    ${results.map(r => `
      <div class="search-result" onclick="viewSessionDetails('${r.sessionId}')">
        <div class="search-result-header">
          <span class="session-type-badge ${r.sessionType}">${getTypeLabel(r.sessionType)}</span>
          <span class="search-result-time">${formatDateTime(r.timestamp)}</span>
        </div>
        <div class="search-result-session">${escapeHtml(r.sessionTitle)}</div>
        <div class="search-result-text">${highlightMatch(r.text, query)}</div>
      </div>
    `).join('')}
  `;
}

function highlightMatch(text, query) {
  const escaped = escapeHtml(text);
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return escaped.replace(regex, '<mark>$1</mark>');
}

// ===== Gestión de Datos =====
function exportData() {
  const data = Storage.load();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `productivity-monitor-backup-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('📥 Datos exportados correctamente');
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
      if (data.sessions && Array.isArray(data.sessions)) {
        if (confirm('¿Importar datos? Esto reemplazará los datos actuales.')) {
          Storage.save(data);
          loadDashboard();
          loadSessions();
          showToast('📤 Datos importados correctamente');
        }
      } else {
        showToast('❌ Archivo de datos inválido', 'error');
      }
    } catch (err) {
      showToast('❌ Error al leer el archivo', 'error');
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}

function clearAllData() {
  if (confirm('⚠️ ¿Estás seguro? Esto eliminará TODOS tus datos de sesiones, transcripciones y reportes. Esta acción no se puede deshacer.')) {
    if (confirm('¿Confirmas que quieres borrar todos los datos?')) {
      Storage.clearAll();
      App.currentSession = null;
      App.isRecording = false;
      hideRecordingIndicator();
      loadDashboard();
      loadSessions();
      showToast('🗑️ Todos los datos fueron eliminados');
    }
  }
}

// ===== Modo Privacidad =====
function setupPrivacyMode() {
  const privacySwitch = document.getElementById('privacySwitch');
  
  privacySwitch.addEventListener('change', () => {
    App.privacyMode = privacySwitch.checked;
    
    if (App.privacyMode) {
      // Pausar todo el monitoreo
      stopScreenCapture();
      stopAudioCapture();
      
      if (App.currentSession) {
        endSession();
      }
      
      // Mostrar overlay
      const overlay = document.createElement('div');
      overlay.className = 'privacy-overlay';
      overlay.id = 'privacyOverlay';
      overlay.innerHTML = `
        <div class="privacy-overlay-content">
          <i class="fas fa-shield-alt"></i>
          <h2>Modo Privacidad Activado</h2>
          <p>El monitoreo está pausado. Nada se está grabando ni capturando.</p>
          <button class="btn btn-primary" onclick="disablePrivacyMode()">
            <i class="fas fa-play"></i> Reanudar Monitoreo
          </button>
        </div>
      `;
      document.body.appendChild(overlay);
      
      showToast('🔒 Modo privacidad activado');
    } else {
      // Quitar overlay
      const overlay = document.getElementById('privacyOverlay');
      if (overlay) overlay.remove();
      showToast('🔓 Modo privacidad desactivado');
    }
  });
}

function disablePrivacyMode() {
  const privacySwitch = document.getElementById('privacySwitch');
  privacySwitch.checked = false;
  privacySwitch.dispatchEvent(new Event('change'));
}

// ===== Inicialización =====
function init() {
  // Configurar navegación
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => switchView(item.dataset.view));
  });
  
  // Configurar modo privacidad
  setupPrivacyMode();
  
  // Cargar dashboard
  loadDashboard();
  
  // Cerrar modal al hacer clic fuera
  document.getElementById('reportModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('reportModal')) {
      closeModal();
    }
  });
  
  // Prevenir cierre accidental de la página durante grabación
  window.addEventListener('beforeunload', (e) => {
    if (App.isRecording) {
      e.preventDefault();
      e.returnValue = '';
    }
  });
  
  console.log('✅ Productivity Monitor standalone inicializado');
}

// Iniciar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', init);


