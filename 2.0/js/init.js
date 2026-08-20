/* ============================================================
   Productivity Monitor - Init Module v3.0.0
   Inicialización, privacidad, gestión de datos y PWA
   ============================================================ */

// ===== Inicialización =====
function initApp() {
  // Restaurar la vista que estaba activa antes de recargar (via hash)
  restoreViewFromHash();

  // Inyectar versión dinámica en el header — fuente de verdad: APP_VERSION en core.js
  const versionEl = document.getElementById('app-version-display');
  if (versionEl && typeof APP_VERSION !== 'undefined') {
    versionEl.textContent = 'v' + APP_VERSION;
  }

  // Verificar sesión activa
  setTimeout(checkForActiveSession, 500);

  // Actualizar indicador de almacenamiento
  updateStorageIndicator();

  // Registrar service worker para PWA
  registerServiceWorker();

  // Solicitar permiso de notificaciones
  if ('Notification' in window && Notification.permission === 'default') {
    setTimeout(() => {
      Notification.requestPermission();
    }, 5000);
  }

  // Detectar cierre de pestaña para guardar sesión activa
  window.addEventListener('beforeunload', () => {
    if (App.currentSession) {
      saveActiveSessionMeta(App.currentSession.id);
    }
  });

  // Atajos de teclado
  document.addEventListener('keydown', (e) => {
    // Ctrl+Enter para iniciar/detener sesión
    if (e.ctrlKey && e.key === 'Enter') {
      e.preventDefault();
      if (App.currentSession) {
        endSession();
      } else {
        startSession();
      }
    }
    // Escape para cerrar modal
    if (e.key === 'Escape') {
      closeModal();
      _closeLightbox();
      if (typeof closeAuthModal === 'function') closeAuthModal();
    }
  });
}

// ===== Modo Privacidad =====
function togglePrivacyMode() {
  App.privacyMode = !App.privacyMode;

  const btn = document.getElementById('btnPrivacy');
  if (btn) {
    btn.classList.toggle('active', App.privacyMode);
    btn.innerHTML = App.privacyMode
      ? '<i class="fas fa-lock"></i> Privacidad ON'
      : '<i class="fas fa-unlock"></i> Privacidad OFF';
  }

  if (App.privacyMode) {
    // Detener monitoreo activo
    if (App.currentSession) {
      endSession();
    }
    if (App.screenStream) stopScreenCapture();
    if (App.audioStream) stopAudioCapture();
    showToast('🔒 Modo privacidad activado. Monitoreo detenido.');
  } else {
    showToast('🔓 Modo privacidad desactivado');
  }
}

// ===== Gestión de Datos =====
function clearAllData() {
  if (confirm('⚠️ ¿Seguro que quieres eliminar TODOS los datos? Esta acción no se puede deshacer.')) {
    Storage.clearAll();
    App.currentSession = null;
    App.isRecording = false;
    hideRecordingIndicator();
    clearActiveSessionMeta();
    loadDashboard();
    loadSessions();
    loadReports();
    updateStorageIndicator();
    showToast('🗑️ Todos los datos eliminados');
  }
}

function importData() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (data.sessions && Array.isArray(data.sessions)) {
          localStorage.setItem(Storage.KEY, JSON.stringify(data));
          loadDashboard();
          loadSessions();
          loadReports();
          updateStorageIndicator();
          showToast('✅ Datos importados correctamente');
        } else {
          showToast('❌ Formato de archivo inválido', 'error');
        }
      } catch (err) {
        showToast('❌ Error al importar datos', 'error');
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

// ===== Manejar importación desde el input oculto de la vista Datos =====
function handleImport(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const data = JSON.parse(ev.target.result);
      if (data.sessions && Array.isArray(data.sessions)) {
        localStorage.setItem(Storage.KEY, JSON.stringify(data));
        loadDashboard();
        loadSessions();
        loadReports();
        updateStorageIndicator();
        showToast('✅ Datos importados correctamente');
      } else {
        showToast('❌ Formato de archivo inválido', 'error');
      }
    } catch (err) {
      showToast('❌ Error al importar datos', 'error');
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}


// ===== Indicador de almacenamiento =====
function updateStorageIndicator() {
  const indicator = document.getElementById('storageIndicator');
  if (!indicator) return;

  const usageBytes = Storage.getUsage();
  const quotaBytes = Storage.getQuota();
  const percent = Math.min(100, Math.round((usageBytes / quotaBytes) * 100));
  const usageMB = (usageBytes / (1024 * 1024)).toFixed(2);
  const quotaMB = (quotaBytes / (1024 * 1024)).toFixed(0);

  let color, label, labelClass;
  if (percent >= 90) {
    color = '#ef4444'; label = '🔴 Crítico — elimina sesiones antiguas'; labelClass = 'storage-critical';
  } else if (percent >= 70) {
    color = '#f87171'; label = '⚠️ Casi lleno'; labelClass = 'storage-warning';
  } else if (percent >= 50) {
    color = '#fbbf24'; label = '⚠️ Espacio moderado'; labelClass = 'storage-moderate';
  } else {
    color = '#4ade80'; label = '✓ Espacio disponible'; labelClass = '';
  }

  // Desglose por sesión (top 3 más pesadas)
  const sessions = Storage.getSessions();
  const sessionSizes = sessions.map(s => ({
    title: s.title,
    kb: Math.round((JSON.stringify(s).length * 2) / 1024),
    screenshots: (s.screenshots || []).length
  })).sort((a, b) => b.kb - a.kb).slice(0, 3);

  const topSessions = sessionSizes.length > 0 ? `
    <div class="storage-breakdown">
      <span class="storage-breakdown-title">Sesiones más pesadas:</span>
      ${sessionSizes.map(s => `
        <div class="storage-breakdown-row">
          <span class="storage-breakdown-name">${escapeHtml(s.title.slice(0, 25))}</span>
          <span class="storage-breakdown-size">${s.kb >= 1024 ? (s.kb/1024).toFixed(1)+'MB' : s.kb+'KB'} · ${s.screenshots} capturas</span>
        </div>
      `).join('')}
    </div>
  ` : '';

  indicator.innerHTML = `
    <div class="storage-indicator">
      <div class="storage-bar">
        <div class="storage-fill" style="width:${percent}%;background:${color}"></div>
      </div>
      <div class="storage-info-row">
        <span class="storage-label ${labelClass}">${usageMB} / ${quotaMB} MB (${percent}%)</span>
        <span class="${labelClass}">${label}</span>
      </div>
      ${topSessions}
    </div>
  `;
}

// ===== PWA / Service Worker =====
function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  // Registrar el SW después de que la app cargó completamente
  // para que esta sesión use los archivos frescos de red
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').then((reg) => {

      const activateWaiting = (worker) => {
        worker.postMessage({ type: 'SKIP_WAITING' });
      };

      if (reg.waiting) {
        activateWaiting(reg.waiting);
      }

      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            activateWaiting(newWorker);
          }
        });
      });

      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      });

    }).catch(err => {
      console.log('Service Worker no disponible:', err);
    });
  });
}

// ===== Buscador global =====
function globalSearch() {
  const query = document.getElementById('globalSearch').value.toLowerCase().trim();
  const resultsContainer = document.getElementById('searchResults');

  if (!query) {
    resultsContainer.innerHTML = '';
    resultsContainer.classList.remove('show');
    return;
  }

  const sessions = Storage.getSessions();
  const results = [];

  sessions.forEach(s => {
    // Buscar en título
    if ((s.title || '').toLowerCase().includes(query)) {
      results.push({ type: 'session', session: s, match: s.title });
    }
    // Buscar en transcripciones
    (s.transcripts || []).forEach(t => {
      if (t.text.toLowerCase().includes(query)) {
        results.push({ type: 'transcript', session: s, match: t.text, time: t.timestamp });
      }
    });
  });

  if (results.length === 0) {
    resultsContainer.innerHTML = '<p class="search-empty">No se encontraron resultados</p>';
  } else {
    resultsContainer.innerHTML = results.slice(0, 10).map(r => `
      <div class="search-result" onclick="viewSessionDetails('${r.session.id}')">
        <div class="search-result-type">
          ${r.type === 'session' ? '<i class="fas fa-list"></i>' : '<i class="fas fa-comment-dots"></i>'}
        </div>
        <div class="search-result-content">
          <div class="search-result-title">${escapeHtml(r.session.title)}</div>
          <div class="search-result-match">${escapeHtml(r.match).slice(0, 100)}</div>
          ${r.time ? `<div class="search-result-time">${formatDateTime(r.time)}</div>` : ''}
        </div>
      </div>
    `).join('');
  }

  resultsContainer.classList.add('show');
}

function hideSearchResults() {
  setTimeout(() => {
    const results = document.getElementById('searchResults');
    if (results) results.classList.remove('show');
  }, 200);
}

// ===== Buscador de la vista "Buscar" =====
function doSearch() {
  const input = document.getElementById('searchInput');
  const container = document.getElementById('search-results');
  if (!input || !container) return;

  const query = input.value.trim().toLowerCase();
  if (!query) {
    container.innerHTML = '<p class="empty-state">Escribe un término para buscar en tus transcripciones</p>';
    return;
  }

  const sessions = Storage.getSessions();
  const results = [];

  sessions.forEach(s => {
    (s.transcripts || []).forEach(t => {
      if (t.text.toLowerCase().includes(query)) {
        results.push({ session: s, text: t.text, time: t.timestamp });
      }
    });
  });

  if (results.length === 0) {
    container.innerHTML = `
      <div class="search-empty">
        <i class="fas fa-search"></i>
        <p>No se encontraron resultados para "<strong>${escapeHtml(query)}</strong>"</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <p class="search-summary">${results.length} resultado(s) para "<strong>${escapeHtml(query)}</strong>"</p>
    ${results.map(r => `
      <div class="search-result" onclick="viewSessionDetails('${r.session.id}')">
        <div class="search-result-header">
          <i class="fas fa-comment-dots" style="color:var(--primary)"></i>
          <span class="search-result-session">${escapeHtml(r.session.title)}</span>
          <span class="search-result-time">${formatDateTime(r.time)}</span>
        </div>
        <div class="search-result-text">${highlightMatch(escapeHtml(r.text), query)}</div>
      </div>
    `).join('')}
  `;
}

function highlightMatch(text, query) {
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  return text.replace(regex, '<mark>$1</mark>');
}


// ===== Exportar backup JSON =====
function exportBackup() {
  const data = Storage.load();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `productivity-monitor-backup-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('💾 Backup exportado');
}


