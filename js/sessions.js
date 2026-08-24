/* ============================================================
   Productivity Monitor 2.0 - Sessions Module
   Sesiones, edición, recuperación, detalles y paginación
   ============================================================ */

// ===== Paginación =====
const SESSIONS_PER_PAGE = 10;
let _sessionsCurrentPage = 0;   // índice de página actual (0-based)
let _sessionsFiltered = null;   // cache de la lista filtrada activa

// ===== Cronómetro de sesión =====
let _sessionTimerInterval = null;

function startSessionTimer(startedAt) {
  clearInterval(_sessionTimerInterval);
  const display = document.getElementById('sessionTimerDisplay');
  const text = document.getElementById('sessionTimerText');
  if (display) display.style.display = 'block';

  function tick() {
    const elapsed = Date.now() - startedAt;
    const h = Math.floor(elapsed / 3600000);
    const m = Math.floor((elapsed % 3600000) / 60000);
    const s = Math.floor((elapsed % 60000) / 1000);
    if (text) text.textContent =
      String(h).padStart(2, '0') + ':' +
      String(m).padStart(2, '0') + ':' +
      String(s).padStart(2, '0');
  }
  tick();
  _sessionTimerInterval = setInterval(tick, 1000);
}

function stopSessionTimer() {
  clearInterval(_sessionTimerInterval);
  _sessionTimerInterval = null;
  const display = document.getElementById('sessionTimerDisplay');
  if (display) display.style.display = 'none';
  const text = document.getElementById('sessionTimerText');
  if (text) text.textContent = '00:00:00';
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

  startSessionTimer(session.startedAt);
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
  stopSessionTimer();

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
  startSessionTimer(session.startedAt);
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

// ===== Helpers de renderizado =====

// Construye el HTML de una tarjeta de sesión en la lista
function _sessionCardHTML(s) {
  const aiBadge = s.aiSummary
    ? `<span class="session-ai-badge" title="Resumen IA generado"><i class="fas fa-robot"></i> IA</span>`
    : '';

  return `
    <div class="session-item" onclick="viewSessionDetails('${s.id}')">
      <div class="session-item-header">
        <span class="session-type-badge ${s.type}">${getTypeLabel(s.type)}</span>
        <span class="session-status ${s.status}">${s.status === 'active' ? '● Activa' : '✓ Terminada'}</span>
        ${aiBadge}
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
  `;
}

// Renderiza una página de la lista con controles de paginación
function _renderSessionsPage(sessions, page) {
  const container = document.getElementById('sessions-list');
  if (!container) return;

  if (sessions.length === 0) {
    container.innerHTML = '<p class="empty-state">No se encontraron sesiones.</p>';
    return;
  }

  const totalPages = Math.ceil(sessions.length / SESSIONS_PER_PAGE);
  const safePage = Math.max(0, Math.min(page, totalPages - 1));
  _sessionsCurrentPage = safePage;

  const start = safePage * SESSIONS_PER_PAGE;
  const pageItems = sessions.slice(start, start + SESSIONS_PER_PAGE);

  const pagination = totalPages > 1 ? `
    <div class="sessions-pagination">
      <button class="btn btn-sm btn-secondary" onclick="_goToSessionPage(${safePage - 1})" ${safePage === 0 ? 'disabled' : ''}>
        <i class="fas fa-chevron-left"></i> Anterior
      </button>
      <span class="pagination-info">Página ${safePage + 1} de ${totalPages} (${sessions.length} sesiones)</span>
      <button class="btn btn-sm btn-secondary" onclick="_goToSessionPage(${safePage + 1})" ${safePage >= totalPages - 1 ? 'disabled' : ''}>
        Siguiente <i class="fas fa-chevron-right"></i>
      </button>
    </div>
  ` : `<div class="sessions-pagination-info">${sessions.length} sesión${sessions.length !== 1 ? 'es' : ''}</div>`;

  container.innerHTML = pageItems.map(_sessionCardHTML).join('') + pagination;
}

// Navega a una página específica conservando el filtro activo
function _goToSessionPage(page) {
  const sessions = _sessionsFiltered !== null ? _sessionsFiltered : Storage.getSessions();
  _renderSessionsPage(sessions, page);
  document.getElementById('view-sessions')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ===== Lista de Sesiones =====
function loadSessions() {
  _sessionsCurrentPage = 0;
  _sessionsFiltered = null;
  const sessions = Storage.getSessions();
  _renderSessionsPage(sessions, 0);
}

let _filterSessionsTimer;
function debouncedFilterSessions() {
  clearTimeout(_filterSessionsTimer);
  _filterSessionsTimer = setTimeout(filterSessions, 220);
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

  // Guardar lista filtrada y resetear a página 0
  _sessionsFiltered = sessions;
  _sessionsCurrentPage = 0;
  _renderSessionsPage(sessions, 0);
}

function deleteSession(sessionId) {
  const session = Storage.getSession(sessionId);
  if (!session) return;

  const screenshots = session.screenshots || [];
  const transcripts = session.transcripts || [];
  const approxKB = Math.round((JSON.stringify(session).length * 2) / 1024);
  const sizeStr = approxKB >= 1024 ? (approxKB / 1024).toFixed(1) + ' MB' : approxKB + ' KB';

  const storageCount = screenshots.filter(s => s.storageUrl).length;
  const storageNote = storageCount > 0
    ? `\n${storageCount} capturas se eliminarán también de Firebase Storage.`
    : '';

  const msg = `¿Eliminar "${session.title}"?\n\n` +
    `Se liberarán aprox. ${sizeStr} ` +
    `(${screenshots.length} capturas, ${transcripts.length} transcripciones).${storageNote}`;

  if (confirm(msg)) {
    // Eliminar capturas de Firebase Storage en background (no bloquear la UI)
    if (typeof deleteSessionScreenshotsFromStorage === 'function') {
      deleteSessionScreenshotsFromStorage(sessionId, screenshots);
    }
    Storage.deleteSession(sessionId);
    closeModal();
    loadSessions();
    loadDashboard();
    updateStorageIndicator();
    showToast(`🗑️ Sesión eliminada — ${sizeStr} liberados`);
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
        ${session.aiSummary
          ? `<button class="btn btn-primary ai-summary-cached" onclick="generateAISummary('${session.id}')" title="Resumen guardado — clic para ver">
              <i class="fas fa-robot"></i> Resumen IA <i class="fas fa-bolt ai-cached-icon"></i>
             </button>`
          : transcripts.length > 0
            ? `<button class="btn btn-primary" onclick="generateAISummary('${session.id}')">
                <i class="fas fa-robot"></i> Resumen IA
               </button>`
            : `<button class="btn btn-primary" disabled title="Sin transcripciones — el resumen no tendrá contenido" style="opacity:0.45;cursor:not-allowed">
                <i class="fas fa-robot"></i> Resumen IA
               </button>`
        }
        ${transcripts.length > 0
          ? `<button class="btn btn-secondary" onclick="generateDetailedReport('${session.id}')">
              <i class="fas fa-file-alt"></i> Informe Detallado
             </button>`
          : ''
        }
        <button class="btn btn-secondary" onclick="exportReportPDF('${session.id}')">
          <i class="fas fa-file-pdf"></i> PDF
        </button>
        <button class="btn btn-secondary" onclick="exportReportExcel('${session.id}')">
          <i class="fas fa-file-alt"></i> Markdown
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
        <div id="screenshots-modal-container" data-session-id="${session.id}">
          ${_renderScreenshotPage(screenshots, 0, session.id)}
        </div>
      `}
    </div>
  `;

  modal.style.display = 'flex';
}

function closeModal() {
  document.getElementById('reportModal').style.display = 'none';
}

// ===== Capturas: paginación y descarga individual =====
const SCREENSHOTS_PER_PAGE = 6;

function _renderScreenshotPage(screenshots, page, sessionId) {
  const total = screenshots.length;
  const totalPages = Math.ceil(total / SCREENSHOTS_PER_PAGE);
  const safePage = Math.max(0, Math.min(page, totalPages - 1));
  const start = safePage * SCREENSHOTS_PER_PAGE;
  const pageItems = screenshots.slice(start, start + SCREENSHOTS_PER_PAGE);

  const grid = pageItems.map(s => {
    const imgSrc = s.dataUrl || s.storageUrl || '';
    const dlHref = s.dataUrl || s.storageUrl || '';
    return `
    <div class="screenshot-thumb">
      <img src="${imgSrc}" alt="Captura ${formatTime(s.timestamp)}"
           onclick="_openLightbox('${s.id}', '${sessionId}')"
           title="Clic para ver en pantalla completa" style="cursor:zoom-in">
      <div class="screenshot-thumb-footer">
        <span class="screenshot-time">${formatTime(s.timestamp)}</span>
        <a class="btn-screenshot-dl" href="${dlHref}"
           download="captura-${formatTime(s.timestamp).replace(/:/g,'-')}.jpg"
           onclick="event.stopPropagation()" title="Descargar">
          <i class="fas fa-download"></i>
        </a>
      </div>
    </div>
  `;}).join('');

  const pagination = totalPages > 1 ? `
    <div class="screenshots-pagination">
      <button class="btn btn-sm btn-secondary"
        onclick="_goToScreenshotPage('${sessionId}', ${safePage - 1})"
        ${safePage === 0 ? 'disabled' : ''}>
        <i class="fas fa-chevron-left"></i>
      </button>
      <span class="pagination-info">${start + 1}–${Math.min(start + SCREENSHOTS_PER_PAGE, total)} de ${total}</span>
      <button class="btn btn-sm btn-secondary"
        onclick="_goToScreenshotPage('${sessionId}', ${safePage + 1})"
        ${safePage >= totalPages - 1 ? 'disabled' : ''}>
        <i class="fas fa-chevron-right"></i>
      </button>
    </div>
  ` : `<p class="screenshots-pagination-info">${total} captura${total !== 1 ? 's' : ''}</p>`;

  return `<div class="screenshot-grid">${grid}</div>${pagination}`;
}

function _goToScreenshotPage(sessionId, page) {
  const session = Storage.getSession(sessionId);
  if (!session) return;
  const container = document.getElementById('screenshots-modal-container');
  if (!container) return;
  container.innerHTML = _renderScreenshotPage(session.screenshots || [], page, sessionId);
}

// ===== Lightbox inline para ver captura a pantalla completa =====
function _openLightbox(screenshotId, sessionId) {
  const session = Storage.getSession(sessionId);
  if (!session) return;

  const screenshots = session.screenshots || [];
  const idx = screenshots.findIndex(s => s.id === screenshotId);
  if (idx === -1) return;

  // Eliminar lightbox anterior si existe
  const existing = document.getElementById('screenshot-lightbox');
  if (existing) existing.remove();

  const s = screenshots[idx];
  const total = screenshots.length;

  const lb = document.createElement('div');
  lb.id = 'screenshot-lightbox';
  lb.innerHTML = `
    <div class="lb-backdrop" onclick="_closeLightbox()"></div>
    <div class="lb-container">
      <button class="lb-close" onclick="_closeLightbox()" title="Cerrar (Esc)">
        <i class="fas fa-times"></i>
      </button>
      <button class="lb-nav lb-prev" onclick="_lbNavigate('${sessionId}', ${idx - 1}, ${total})"
        ${idx === 0 ? 'disabled' : ''} title="Anterior">
        <i class="fas fa-chevron-left"></i>
      </button>
      <div class="lb-img-wrap">
        <img src="${s.dataUrl || s.storageUrl || ''}" alt="Captura ${formatTime(s.timestamp)}" class="lb-img">
        <div class="lb-caption">
          <span>${formatDateTime(s.timestamp)}</span>
          <span class="lb-counter">${idx + 1} / ${total}</span>
          <a href="${s.dataUrl || s.storageUrl || ''}" download="captura-${formatTime(s.timestamp).replace(/:/g,'-')}.jpg"
             class="lb-dl" title="Descargar" onclick="_lbMarkDownloaded('${s.id}')">
            <i class="fas fa-download"></i> Descargar
          </a>
          <button class="lb-delete" onclick="_deleteScreenshotFromLightbox('${s.id}', '${sessionId}', ${idx}, ${total})"
            title="Eliminar esta captura">
            <i class="fas fa-trash"></i> Eliminar
          </button>
        </div>
      </div>
      <button class="lb-nav lb-next" onclick="_lbNavigate('${sessionId}', ${idx + 1}, ${total})"
        ${idx >= total - 1 ? 'disabled' : ''} title="Siguiente">
        <i class="fas fa-chevron-right"></i>
      </button>
    </div>
  `;

  document.body.appendChild(lb);
  requestAnimationFrame(() => lb.classList.add('lb-visible'));
}

function _closeLightbox() {
  const lb = document.getElementById('screenshot-lightbox');
  if (lb) lb.remove();
}

function _lbNavigate(sessionId, newIdx, total) {
  if (newIdx < 0 || newIdx >= total) return;
  const session = Storage.getSession(sessionId);
  if (!session) return;
  const s = session.screenshots[newIdx];
  if (!s) return;
  _openLightbox(s.id, sessionId);
}

// Marca visualmente que la captura fue descargada (feedback al usuario)
function _lbMarkDownloaded(screenshotId) {
  const dlBtn = document.querySelector('.lb-dl');
  if (dlBtn) {
    dlBtn.innerHTML = '<i class="fas fa-check"></i> Descargado';
    dlBtn.style.borderColor = '#4ade80';
    dlBtn.style.color = '#4ade80';
  }
}

// Elimina una captura individual desde el lightbox
function _deleteScreenshotFromLightbox(screenshotId, sessionId, currentIdx, total) {
  if (!confirm('¿Eliminar esta captura del historial? No se puede deshacer.')) return;

  const session = Storage.getSession(sessionId);
  if (!session) return;

  const toDelete = (session.screenshots || []).find(s => s.id === screenshotId);

  // Eliminar de Firebase Storage si corresponde (en background)
  if (toDelete?.storageUrl && typeof deleteScreenshotFromStorage === 'function') {
    deleteScreenshotFromStorage(sessionId, screenshotId);
  }

  const screenshots = (session.screenshots || []).filter(s => s.id !== screenshotId);
  Storage.updateSession(sessionId, { screenshots });

  // Actualizar grid del modal si está abierto
  const container = document.getElementById('screenshots-modal-container');
  if (container) {
    container.innerHTML = _renderScreenshotPage(screenshots, 0, sessionId);
  }

  updateStorageIndicator();

  const remaining = screenshots.length;
  if (remaining === 0) {
    _closeLightbox();
    showToast('🗑️ Captura eliminada — sin más capturas en esta sesión');
    return;
  }

  // Navegar a la siguiente captura (o anterior si era la última)
  const nextIdx = Math.min(currentIdx, remaining - 1);
  _openLightbox(screenshots[nextIdx].id, sessionId);
  showToast('🗑️ Captura eliminada');
}

// ===== Exportar capturas =====
// exportScreenshots: si JSZip disponible → ZIP, si no → HTML imprimible (fallback)
function exportScreenshots(sessionId) {
  const session = Storage.getSession(sessionId);
  if (!session) return;

  const screenshots = session.screenshots || [];
  if (screenshots.length === 0) {
    showToast('⚠️ No hay capturas para exportar', 'error');
    return;
  }

  if (typeof JSZip !== 'undefined') {
    exportScreenshotsZip(sessionId);
    return;
  }

  // Fallback: HTML imprimible
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

// exportScreenshotsZip: descarga todas las capturas como .zip con archivos JPEG individuales
async function exportScreenshotsZip(sessionId) {
  const session = Storage.getSession(sessionId);
  if (!session) return;

  const screenshots = session.screenshots || [];
  if (screenshots.length === 0) {
    showToast('⚠️ No hay capturas para exportar', 'error');
    return;
  }

  if (typeof JSZip === 'undefined') {
    showToast('⚠️ JSZip no disponible — usando vista de impresión', 'error');
    exportScreenshots(sessionId);
    return;
  }

  showToast('📦 Generando ZIP...');

  const zip = new JSZip();
  const folderName = (session.title || 'sesion').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
  const folder = zip.folder(folderName);

  screenshots.forEach((s, i) => {
    const time = formatDateTime(s.timestamp).replace(/[/:, ]/g, '-');
    const filename = `captura-${String(i + 1).padStart(3, '0')}-${time}.jpg`;

    if (s.dataUrl) {
      // Captura local: base64 directo
      const base64 = s.dataUrl.split(',')[1];
      if (base64) folder.file(filename, base64, { base64: true });
    } else if (s.storageUrl) {
      // Captura en Firebase Storage: incluir URL como referencia en el ZIP
      folder.file(filename.replace('.jpg', '.url.txt'), s.storageUrl);
    }
  });

  try {
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `capturas-${folderName}-${Date.now()}.zip`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`✅ ZIP descargado con ${screenshots.length} capturas`);

    // Ofrecer eliminar capturas para liberar espacio
    const approxMB = ((JSON.stringify(screenshots).length * 2) / (1024 * 1024)).toFixed(1);
    setTimeout(() => {
      if (confirm(
        `ZIP descargado (${screenshots.length} capturas).\n\n` +
        `¿Eliminar las capturas del historial para liberar ~${approxMB} MB?\n\n` +
        `Las capturas quedarán en tu ZIP descargado.`
      )) {
        Storage.updateSession(sessionId, { screenshots: [] });
        const container = document.getElementById('screenshots-modal-container');
        if (container) container.innerHTML = '<p class="empty-state">Sin capturas</p>';
        updateStorageIndicator();
        showToast(`🗑️ ${screenshots.length} capturas eliminadas — ${approxMB} MB liberados`);
      }
    }, 500);
  } catch (err) {
    console.error('Error generando ZIP:', err);
    showToast('❌ Error generando ZIP', 'error');
  }
}
