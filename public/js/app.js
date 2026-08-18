// ============================================================
// PRODUCTIVITY MONITOR - Frontend Logic
// Captura de pantalla, audio, transcripción y dashboard
// ============================================================

// ===== Estado Global =====
const state = {
  currentSession: null,
  screenStream: null,
  audioStream: null,
  mediaRecorder: null,
  recordedChunks: [],
  recognition: null,
  isRecording: false,
  isPrivacyMode: false,
  screenshotInterval: null,
  transcriptEntries: [],
  sessions: [],
  reports: []
};

// ===== API Base =====
const API = {
  base: '',
  
  async request(path, options = {}) {
    try {
      const res = await fetch(`${this.base}${path}`, {
        headers: { 'Content-Type': 'application/json' },
        ...options
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error en la petición');
      return data;
    } catch (e) {
      console.error('API Error:', e);
      throw e;
    }
  },
  
  get(path) { return this.request(path); },
  post(path, body) { return this.request(path, { method: 'POST', body: JSON.stringify(body) }); },
  put(path, body) { return this.request(path, { method: 'PUT', body: JSON.stringify(body) }); },
  del(path) { return this.request(path, { method: 'DELETE' }); }
};

// ===== Inicialización =====
document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  initPrivacyMode();
  checkServerHealth();
  loadDashboard();
  loadSessions();
  loadReports();
  initSpeechRecognition();
});

// ===== Navegación =====
function initNavigation() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const view = item.dataset.view;
      switchView(view);
    });
  });
}

function switchView(view) {
  document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
  document.querySelector(`.nav-item[data-view="${view}"]`)?.classList.add('active');
  
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(`view-${view}`)?.classList.add('active');
  
  // Cargar datos según la vista
  if (view === 'dashboard') loadDashboard();
  if (view === 'sessions') loadSessions();
  if (view === 'reports') loadReports();
}

// ===== Health Check =====
async function checkServerHealth() {
  try {
    const data = await API.get('/api/health');
    setStatus('online', 'Servidor conectado');
  } catch (e) {
    setStatus('offline', 'Servidor desconectado');
  }
}

function setStatus(status, text) {
  const dot = document.getElementById('status-dot');
  const textEl = document.getElementById('status-text');
  dot.className = `status-dot ${status}`;
  textEl.textContent = text;
}

// ===== Modo Privacidad =====
function initPrivacyMode() {
  const privacySwitch = document.getElementById('privacySwitch');
  privacySwitch.addEventListener('change', () => {
    state.isPrivacyMode = privacySwitch.checked;
    
    if (state.isPrivacyMode) {
      // Pausar monitoreo
      stopScreenCapture();
      stopAudioCapture();
      showToast('Modo privacidad activado. Monitoreo pausado.', 'warning');
    } else {
      showToast('Modo privacidad desactivado. Puedes reanudar el monitoreo.', 'info');
    }
  });
}

// ===== Dashboard =====
async function loadDashboard() {
  try {
    const stats = await API.get('/api/stats');
    
    const hours = Math.floor(stats.totalDuration / 3600);
    const minutes = Math.floor((stats.totalDuration % 3600) / 60);
    
    document.getElementById('stat-duration').textContent = `${hours}h ${minutes}m`;
    document.getElementById('stat-sessions').textContent = stats.totalSessions;
    document.getElementById('stat-transcripts').textContent = stats.totalTranscripts;
    document.getElementById('stat-screenshots').textContent = stats.totalScreenshots;
    
    // Cargar sesiones recientes
    const { sessions } = await API.get('/api/sessions');
    const recent = sessions.slice(0, 5);
    renderRecentSessions(recent);
  } catch (e) {
    console.error('Error cargando dashboard:', e);
  }
}

function renderRecentSessions(sessions) {
  const container = document.getElementById('recent-sessions');
  
  if (sessions.length === 0) {
    container.innerHTML = '<p class="empty-state">No hay sesiones registradas aún.</p>';
    return;
  }
  
  container.innerHTML = sessions.map(session => `
    <div class="session-item">
      <div class="session-info">
        <div class="session-title">${escapeHtml(session.title)}</div>
        <div class="session-meta">
          ${formatDate(session.startedAt)} · ${formatDuration(session.duration)} · ${session.transcriptCount} transcripciones
        </div>
      </div>
      <span class="session-status ${session.status}">${session.status === 'active' ? 'Activa' : 'Terminada'}</span>
    </div>
  `).join('');
}

// ===== Sesiones =====
async function loadSessions() {
  try {
    const { sessions } = await API.get('/api/sessions');
    state.sessions = sessions;
    renderSessions(sessions);
  } catch (e) {
    console.error('Error cargando sesiones:', e);
  }
}

function renderSessions(sessions) {
  const container = document.getElementById('sessions-list');
  
  if (sessions.length === 0) {
    container.innerHTML = '<p class="empty-state">No hay sesiones registradas.</p>';
    return;
  }
  
  container.innerHTML = sessions.map(session => `
    <div class="session-item">
      <div class="session-info">
        <div class="session-title">${escapeHtml(session.title)}</div>
        <div class="session-meta">
          ${formatDate(session.startedAt)} · ${formatDuration(session.duration)} · ${session.transcriptCount} transcripciones · ${session.screenshots} capturas
        </div>
      </div>
      <span class="session-status ${session.status}">${session.status === 'active' ? 'Activa' : 'Terminada'}</span>
      <div class="session-actions">
        <button class="btn btn-secondary" onclick="viewSession('${session.id}')">
          <i class="fas fa-eye"></i> Ver
        </button>
        <button class="btn btn-danger" onclick="deleteSession('${session.id}')">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    </div>
  `).join('');
}

function filterSessions() {
  const search = document.getElementById('sessionSearch').value.toLowerCase();
  const filter = document.getElementById('sessionFilter').value;
  
  let filtered = state.sessions;
  
  if (filter !== 'all') {
    filtered = filtered.filter(s => s.status === filter);
  }
  
  if (search) {
    filtered = filtered.filter(s => 
      s.title.toLowerCase().includes(search) || 
      s.type.toLowerCase().includes(search)
    );
  }
  
  renderSessions(filtered);
}

async function viewSession(id) {
  try {
    const session = await API.get(`/api/sessions/${id}`);
    const transcripts = await API.get(`/api/sessions/${id}/transcripts`);
    
    const modalBody = document.getElementById('modalBody');
    document.getElementById('modalTitle').textContent = `Sesión: ${session.title}`;
    
    modalBody.innerHTML = `
      <div class="report-section">
        <h4>Información</h4>
        <p><strong>Estado:</strong> ${session.status === 'active' ? 'Activa' : 'Terminada'}</p>
        <p><strong>Inicio:</strong> ${formatDate(session.startedAt)}</p>
        <p><strong>Duración:</strong> ${formatDuration(session.duration)}</p>
        <p><strong>Transcripciones:</strong> ${session.transcriptCount}</p>
        <p><strong>Capturas:</strong> ${session.screenshots}</p>
      </div>
      <div class="report-section">
        <h4>Transcripciones (${transcripts.entries.length})</h4>
        ${transcripts.entries.length === 0 
          ? '<p>No hay transcripciones en esta sesión.</p>'
          : `<ul>${transcripts.entries.map(e => 
              `<li><strong>${formatTime(e.timestamp)}:</strong> ${escapeHtml(e.text)}</li>`
            ).join('')}</ul>`
        }
      </div>
    `;
    
    document.getElementById('reportModal').style.display = 'flex';
  } catch (e) {
    showToast('Error al ver la sesión', 'error');
  }
}

async function deleteSession(id) {
  if (!confirm('¿Seguro que deseas eliminar esta sesión?')) return;
  
  try {
    await API.del(`/api/sessions/${id}`);
    showToast('Sesión eliminada', 'success');
    loadSessions();
    loadDashboard();
  } catch (e) {
    showToast('Error al eliminar la sesión', 'error');
  }
}

// ===== Monitoreo: Captura de Pantalla =====
async function startScreenCapture() {
  if (state.isPrivacyMode) {
    showToast('Modo privacidad activado. Desactívalo para monitorear.', 'warning');
    return;
  }
  
  try {
    state.screenStream = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: { ideal: 5 } },
      audio: false
    });
    
    const preview = document.getElementById('screenPreview');
    preview.innerHTML = '<video id="screenVideo" autoplay muted></video>';
    const video = document.getElementById('screenVideo');
    video.srcObject = state.screenStream;
    
    // Actualizar UI
    document.getElementById('btnStartScreen').style.display = 'none';
    document.getElementById('btnStopScreen').style.display = 'inline-flex';
    document.getElementById('screenStatus').innerHTML = 
      '<span class="status-badge active"><i class="fas fa-circle"></i> Capturando</span>';
    
    // Iniciar capturas periódicas
    startScreenshotInterval();
    
    showToast('Captura de pantalla iniciada', 'success');
    
    // Detectar cuando el usuario detiene el compartir
    state.screenStream.getVideoTracks()[0].addEventListener('ended', () => {
      stopScreenCapture();
    });
  } catch (e) {
    console.error('Error al capturar pantalla:', e);
    showToast('No se pudo iniciar la captura de pantalla', 'error');
  }
}

function stopScreenCapture() {
  if (state.screenStream) {
    state.screenStream.getTracks().forEach(track => track.stop());
    state.screenStream = null;
  }
  
  clearInterval(state.screenshotInterval);
  state.screenshotInterval = null;
  
  const preview = document.getElementById('screenPreview');
  preview.innerHTML = `
    <div class="preview-placeholder">
      <i class="fas fa-desktop"></i>
      <p>La captura de pantalla aparecerá aquí</p>
    </div>
  `;
  
  document.getElementById('btnStartScreen').style.display = 'inline-flex';
  document.getElementById('btnStopScreen').style.display = 'none';
  document.getElementById('screenStatus').innerHTML = 
    '<span class="status-badge idle"><i class="fas fa-circle"></i> Inactivo</span>';
}

function startScreenshotInterval() {
  // Tomar captura cada 30 segundos
  state.screenshotInterval = setInterval(async () => {
    if (!state.screenStream || !state.currentSession || state.isPrivacyMode) return;
    
    try {
      const video = document.getElementById('screenVideo');
      if (!video) return;
      
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0);
      
      const imageData = canvas.toDataURL('image/png');
      
      await API.post(`/api/sessions/${state.currentSession.id}/screenshots`, {
        imageData,
        timestamp: new Date().toISOString()
      });
      
      console.log('Captura de pantalla guardada');
    } catch (e) {
      console.error('Error al guardar captura:', e);
    }
  }, 30000);
}

// ===== Monitoreo: Audio y Transcripción =====
async function startAudioCapture() {
  if (state.isPrivacyMode) {
    showToast('Modo privacidad activado. Desactívalo para monitorear.', 'warning');
    return;
  }
  
  try {
    state.audioStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });
    
    // Actualizar UI
    document.getElementById('btnStartAudio').style.display = 'none';
    document.getElementById('btnStopAudio').style.display = 'inline-flex';
    document.getElementById('audioStatus').innerHTML = 
      '<span class="status-badge active"><i class="fas fa-circle"></i> Grabando</span>';
    document.getElementById('visualizerBars').classList.add('active');
    
    // Iniciar reconocimiento de voz
    startSpeechRecognition();
    
    showToast('Audio y transcripción iniciados', 'success');
  } catch (e) {
    console.error('Error al capturar audio:', e);
    showToast('No se pudo acceder al micrófono', 'error');
  }
}

function stopAudioCapture() {
  if (state.audioStream) {
    state.audioStream.getTracks().forEach(track => track.stop());
    state.audioStream = null;
  }
  
  if (state.recognition) {
    state.recognition.stop();
  }
  
  document.getElementById('btnStartAudio').style.display = 'inline-flex';
  document.getElementById('btnStopAudio').style.display = 'none';
  document.getElementById('audioStatus').innerHTML = 
    '<span class="status-badge idle"><i class="fas fa-circle"></i> Inactivo</span>';
  document.getElementById('visualizerBars').classList.remove('active');
}

// ===== Reconocimiento de Voz =====
function initSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    console.warn('Speech Recognition no soportado en este navegador');
    return;
  }
  
  state.recognition = new SpeechRecognition();
  state.recognition.lang = 'es-ES';
  state.recognition.continuous = true;
  state.recognition.interimResults = true;
  
  state.recognition.onresult = (event) => {
    let interimText = '';
    let finalText = '';
    
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        finalText += transcript;
      } else {
        interimText += transcript;
      }
    }
    
    if (finalText.trim()) {
      addTranscriptEntry(finalText.trim(), 'microphone');
    }
    
    updateInterimTranscript(interimText);
  };
  
  state.recognition.onerror = (event) => {
    console.error('Speech recognition error:', event.error);
    if (event.error === 'not-allowed') {
      showToast('Permiso de micrófono denegado', 'error');
    }
  };
  
  state.recognition.onend = () => {
    // Reiniciar si aún estamos grabando
    if (state.audioStream && !state.isPrivacyMode) {
      try {
        state.recognition.start();
      } catch (e) {}
    }
  };
}

function startSpeechRecognition() {
  if (state.recognition) {
    try {
      state.recognition.start();
      document.getElementById('transcriptStatus').innerHTML = 
        '<span class="status-badge active"><i class="fas fa-circle"></i> Escuchando...</span>';
    } catch (e) {
      console.error('Error iniciando reconocimiento:', e);
    }
  }
}

function addTranscriptEntry(text, source) {
  const entry = {
    text,
    source,
    timestamp: new Date().toISOString()
  };
  
  state.transcriptEntries.push(entry);
  renderTranscriptEntry(entry);
  
  // Guardar en el servidor si hay sesión activa
  if (state.currentSession) {
    API.post(`/api/sessions/${state.currentSession.id}/transcripts`, entry)
      .catch(e => console.error('Error guardando transcripción:', e));
  }
}

function renderTranscriptEntry(entry) {
  const container = document.getElementById('liveTranscript');
  
  if (container.querySelector('.empty-state')) {
    container.innerHTML = '';
  }
  
  const div = document.createElement('div');
  div.className = 'transcript-entry';
  div.innerHTML = `
    <span class="entry-time">${formatTime(entry.timestamp)}</span>
    <span class="entry-text">${escapeHtml(entry.text)}</span>
  `;
  
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function updateInterimTranscript(text) {
  if (!text.trim()) return;
  
  const container = document.getElementById('liveTranscript');
  let interimEl = container.querySelector('.interim');
  
  if (!interimEl) {
    interimEl = document.createElement('div');
    interimEl.className = 'transcript-entry interim';
    interimEl.style.opacity = '0.6';
    container.appendChild(interimEl);
  }
  
  interimEl.innerHTML = `
    <span class="entry-time">${formatTime(new Date().toISOString())}</span>
    <span class="entry-text">${escapeHtml(text)}</span>
  `;
  container.scrollTop = container.scrollHeight;
}

// ===== Sesión =====
async function startSession() {
  const title = document.getElementById('sessionTitle').value.trim() || 'Nueva Sesión';
  const type = document.getElementById('sessionType').value;
  
  try {
    const session = await API.post('/api/sessions', { title, type });
    state.currentSession = session;
    
    // Actualizar UI
    document.getElementById('btnStartSession').style.display = 'none';
    document.getElementById('btnEndSession').style.display = 'inline-flex';
    document.getElementById('btnGenerateReport').style.display = 'inline-flex';
    
    showToast(`Sesión "${title}" iniciada`, 'success');
    
    // Auto-iniciar captura de pantalla y audio
    await startScreenCapture();
    await startAudioCapture();
  } catch (e) {
    showToast('Error al iniciar la sesión', 'error');
  }
}

async function endSession() {
  if (!state.currentSession) return;
  
  try {
    await API.post(`/api/sessions/${state.currentSession.id}/end`);
    
    stopScreenCapture();
    stopAudioCapture();
    
    // Actualizar UI
    document.getElementById('btnStartSession').style.display = 'inline-flex';
    document.getElementById('btnEndSession').style.display = 'none';
    document.getElementById('btnGenerateReport').style.display = 'none';
    
    showToast('Sesión terminada', 'success');
    state.currentSession = null;
    
    loadSessions();
    loadDashboard();
  } catch (e) {
    showToast('Error al terminar la sesión', 'error');
  }
}

async function generateReport() {
  if (!state.currentSession) {
    showToast('No hay sesión activa', 'warning');
    return;
  }
  
  try {
    const report = await API.post(`/api/sessions/${state.currentSession.id}/report`);
    showToast('Reporte generado correctamente', 'success');
    loadReports();
    
    // Mostrar el reporte
    viewReport(report.id);
  } catch (e) {
    showToast('Error al generar el reporte', 'error');
  }
}

// ===== Reportes =====
async function loadReports() {
  try {
    const { reports } = await API.get('/api/reports');
    state.reports = reports;
    renderReports(reports);
  } catch (e) {
    console.error('Error cargando reportes:', e);
  }
}

function renderReports(reports) {
  const container = document.getElementById('reports-list');
  
  if (reports.length === 0) {
    container.innerHTML = '<p class="empty-state">No hay reportes generados. Inicia una sesión y genera un reporte.</p>';
    return;
  }
  
  container.innerHTML = reports.map(report => `
    <div class="report-item">
      <div class="report-header">
        <span class="report-title">${escapeHtml(report.sessionTitle)}</span>
        <span class="report-date">${formatDate(report.createdAt)}</span>
      </div>
      <div class="report-summary">
        ${report.summary && report.summary.overview ? escapeHtml(report.summary.overview) : 'Reporte generado'}
      </div>
      <div class="report-actions">
        <button class="btn btn-primary" onclick="viewReport('${report.id}')">
          <i class="fas fa-eye"></i> Ver Reporte
        </button>
        <button class="btn btn-secondary" onclick="downloadReport('${report.id}')">
          <i class="fas fa-download"></i> Descargar
        </button>
      </div>
    </div>
  `).join('');
}

async function viewReport(id) {
  try {
    const report = await API.get(`/api/reports/${id}`);
    
    const modalBody = document.getElementById('modalBody');
    document.getElementById('modalTitle').textContent = `Reporte: ${report.sessionTitle}`;
    
    const personal = report.personal || {};
    const managerial = report.managerial || {};
    
    modalBody.innerHTML = `
      <div class="report-section">
        <h4>📊 Resumen</h4>
        <p>${report.summary && report.summary.overview ? escapeHtml(report.summary.overview) : ''}</p>
        <p><strong>Duración:</strong> ${formatDuration(report.duration)}</p>
        <p><strong>Transcripciones:</strong> ${report.transcriptCount}</p>
      </div>
      
      <div class="report-section">
        <h4>📋 Reporte Personal</h4>
        <p>${personal.resumen ? escapeHtml(personal.resumen) : ''}</p>
        
        ${personal.pendientes && personal.pendientes.length > 0 ? `
          <h4 style="margin-top:12px">Pendientes</h4>
          <ul>${personal.pendientes.map(p => `<li>${escapeHtml(p)}</li>`).join('')}</ul>
        ` : ''}
        
        ${personal.ideasClave && personal.ideasClave.length > 0 ? `
          <h4 style="margin-top:12px">Ideas Clave</h4>
          <ul>${personal.ideasClave.map(p => `<li>${escapeHtml(p)}</li>`).join('')}</ul>
        ` : ''}
        
        ${personal.bloqueos && personal.bloqueos.length > 0 ? `
          <h4 style="margin-top:12px">Bloqueos</h4>
          <ul>${personal.bloqueos.map(p => `<li>${escapeHtml(p)}</li>`).join('')}</ul>
        ` : ''}
      </div>
      
      <div class="report-section">
        <h4>🏢 Reporte Gerencial</h4>
        <p>${managerial.resumen ? escapeHtml(managerial.resumen) : ''}</p>
        
        ${managerial.proyectos && managerial.proyectos.length > 0 ? `
          <h4 style="margin-top:12px">Proyectos</h4>
          <ul>${managerial.proyectos.map(p => `<li>${escapeHtml(p)}</li>`).join('')}</ul>
        ` : ''}
        
        ${managerial.personas && managerial.personas.length > 0 ? `
          <h4 style="margin-top:12px">Personas</h4>
          <ul>${managerial.personas.map(p => `<li>${escapeHtml(p)}</li>`).join('')}</ul>
        ` : ''}
        
        ${managerial.hitos && managerial.hitos.length > 0 ? `
          <h4 style="margin-top:12px">Hitos</h4>
          <ul>${managerial.hitos.map(p => `<li>${escapeHtml(p)}</li>`).join('')}</ul>
        ` : ''}
      </div>
    `;
    
    document.getElementById('reportModal').style.display = 'flex';
  } catch (e) {
    showToast('Error al ver el reporte', 'error');
  }
}

function downloadReport(id) {
  const report = state.reports.find(r => r.id === id);
  if (!report) return;
  
  const content = JSON.stringify(report, null, 2);
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `reporte-${report.sessionTitle.replace(/\s+/g, '-').toLowerCase()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// ===== Búsqueda =====
async function doSearch() {
  const query = document.getElementById('searchInput').value.trim();
  if (!query) {
    showToast('Ingresa un término de búsqueda', 'warning');
    return;
  }
  
  try {
    const { results, count } = await API.get(`/api/search?q=${encodeURIComponent(query)}`);
    renderSearchResults(results, count, query);
  } catch (e) {
    showToast('Error en la búsqueda', 'error');
  }
}

function renderSearchResults(results, count, query) {
  const container = document.getElementById('search-results');
  
  if (count === 0) {
    container.innerHTML = `<p class="empty-state">No se encontraron resultados para "${escapeHtml(query)}"</p>`;
    return;
  }
  
  container.innerHTML = `
    <p style="color:var(--text-secondary);margin-bottom:12px;font-size:0.85rem">
      Se encontraron ${count} resultado(s) para "${escapeHtml(query)}"
    </p>
    ${results.map(r => `
      <div class="search-result-item">
        <div class="search-result-text">${escapeHtml(r.text)}</div>
        <div class="search-result-meta">
          <span><i class="fas fa-folder"></i> ${escapeHtml(r.sessionTitle)}</span>
          <span><i class="fas fa-clock"></i> ${formatDate(r.timestamp)}</span>
          ${r.speaker ? `<span><i class="fas fa-user"></i> ${escapeHtml(r.speaker)}</span>` : ''}
        </div>
      </div>
    `).join('')}
  `;
}

// ===== Modal =====
function closeModal() {
  document.getElementById('reportModal').style.display = 'none';
}

// ===== Utilidades =====
function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast ${type} show`;
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  return date.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatTime(dateStr) {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  return date.toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatDuration(seconds) {
  if (!seconds) return '0m';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
