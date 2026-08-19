/* ============================================================
   Productivity Monitor - Sessions Module v2.1.0
   Sesiones, edición, recuperación y detalles
   ============================================================ */

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
