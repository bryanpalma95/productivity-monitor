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

// ===== Contexto del Proyecto — UI =====
function initProjectContextUI() {
  const textarea = document.getElementById('projectContextInput');
  const stats = document.getElementById('projectContextStats');
  if (!textarea) return;

  const saved = Storage.getProjectContext();
  if (saved) {
    textarea.value = saved;
    _updateProjectContextStats(saved);
  }
}

function _updateProjectContextStats(text) {
  const stats = document.getElementById('projectContextStats');
  if (!stats || !text) { if (stats) stats.innerHTML = ''; return; }
  const words = text.trim().split(/\s+/).length;
  const chars = text.length;
  const color = words > 3000 ? 'var(--warning)' : 'var(--muted)';
  stats.innerHTML = `<span>${words} palabras</span><span>${chars} caracteres</span><span style="color:${color}">${words > 3000 ? '⚠️ Supera recomendación (3000)' : '✓ Dentro del límite'}</span>`;
}

function saveProjectContext() {
  const textarea = document.getElementById('projectContextInput');
  if (!textarea) return;
  Storage.saveProjectContext(textarea.value);
  _updateProjectContextStats(textarea.value);
  const status = document.getElementById('projectContextStatus');
  if (status) status.innerHTML = '<i class="fas fa-check-circle" style="color:var(--success)"></i> Contexto guardado — se usará en el próximo resumen IA.';
  showToast('✅ Contexto del proyecto guardado');
}

function clearProjectContextUI() {
  if (!confirm('¿Limpiar el contexto del proyecto?')) return;
  Storage.clearProjectContext();
  const textarea = document.getElementById('projectContextInput');
  if (textarea) textarea.value = '';
  _updateProjectContextStats('');
  const status = document.getElementById('projectContextStatus');
  if (status) status.innerHTML = '';
  showToast('🗑️ Contexto eliminado');
}

function loadArcherContext() {
  const template = `CONTEXTO DEL PROYECTO (Proyecto Archer GRC SaaS — Transbank):

GLOSARIO TÉCNICO:
- Archer: plataforma SaaS GRC (Governance, Risk & Compliance) — reemplaza OpenPage/IBM
- Snowflake: base de datos cloud (Datalake Personas de Transbank — ~600 registros colaboradores)
- Jira: herramienta de gestión de proyectos/incidentes (transbankcl.atlassian.net)
- QlikSense: plataforma BI para dashboards ejecutivos
- Lambda: funciones serverless AWS que ejecutan las integraciones
- API Gateway: punto de entrada REST en AWS
- S3: almacenamiento de archivos en AWS (CSV intermedios)
- CAWA / Control-M: orquestador de mallas batch
- GRC: Governance, Risk and Compliance
- Full Refresh: actualización que reemplaza TODA la data (no incremental)
- ODA: On-Demand Application (módulo custom de Archer)
- C2/C4: controles de riesgo que Archer actualiza en Jira
- Feature 01-08: las 8 integraciones a certificar

CORRECCIONES FONÉTICAS (errores comunes de speech-to-text):
- "snoflex", "NoFlex", "snowflex", "snow flex" → Snowflake
- "Gira", "chira", "jira" → Jira
- "ACTIV", "activ" → Archer (la plataforma)
- "Asertiva", "assertiva" → Asertiva (proveedor de soporte)
- "Contralm", "contralo" → Contraloría
- "datalake personas", "data lake" → Datalake Personas (Snowflake)
- "caua", "cava" → CAWA (Control-M)

EQUIPO DEL PROYECTO:
- Brian (Bryan, Braia): QA Engineer — el que graba las sesiones
- Mariela (Mari): Coordinadora del proyecto
- Chris (Crisler): BA — explica historias de usuario
- Carlos: Arquitecto de solución
- Nico: Desarrollador de APIs (AWS Lambda)
- Ariel: Reportes QlikSense
- Jorlani: Usuaria de negocio (Riesgo)
- Tommy / Tomás: Infraestructura
- Felipe Olmos: Proveedor Asertiva (Archer)
- Tito: Gestiones internas
- Carola: Contraloría
- Oscar: Miembro del equipo QA
- Álvaro: Miembro del equipo (certificación, pruebas)
- Virginia: Gestión de recursos

STREAMS DEL PROYECTO:
1. Snowflake → Archer (Colaboradores/Personas) — PP: 24 Sep — FOCO PRINCIPAL
2. Jira ↔ Archer (Incidentes + Portafolio + C2/C4) — PP: 29 Oct
3. Archer → QlikSense (Auditorías + Planes Riesgo N2) — PP: 10 Sep
4. QlikSense Auditoría — PP: 27 Ago (ya certificado por Ariel)

REGLAS DE NEGOCIO CLAVE:
- Unidad de negocio: prioridad Area hija > Subgerencia > Gerencia
- Colaboradores inactivos: no se eliminan, no son asignables como nuevos responsables
- Exclusión RECO: iniciativas Jira con tipo/categoría RECO no se integran
- C2/C4: no editables en Jira, solo Archer los actualiza, no sobreescribir con vacíos
- 4 campos rechazados en Incidentes (Proceso origen, Proceso afectado, Producto, Proveedor)
- Registro de trazabilidad: campos son procesados/exitosos/con error (NO "imputados")
- Flujo técnico: Snowflake COPY INTO → S3 (CSV) → Lambda → API Gateway → Archer consume`;

  const textarea = document.getElementById('projectContextInput');
  if (textarea) {
    textarea.value = template;
    _updateProjectContextStats(template);
  }
  showToast('📋 Plantilla Archer cargada — revisa y guarda');
}

// ===== Proveedor IA — UI =====
function initAIProviderUI() {
  const config = Storage.getAIProviderConfig();
  const select = document.getElementById('aiProviderSelect');
  if (!select) return;

  select.value = config.provider;
  _populateAIModels(config.provider, config.model);

  const keyInput = document.getElementById('aiProviderKeyInput');
  if (keyInput) keyInput.value = config.apiKey || '';

  const customUrl = document.getElementById('aiCustomUrl');
  if (customUrl) customUrl.value = config.customUrl || '';

  _toggleCustomUrlField(config.provider);
}

function onAIProviderChange() {
  const provider = document.getElementById('aiProviderSelect').value;
  const providerDef = Storage.AI_PROVIDERS[provider];
  _populateAIModels(provider, providerDef?.defaultModel || '');
  _toggleCustomUrlField(provider);

  const keyInput = document.getElementById('aiProviderKeyInput');
  if (keyInput) keyInput.placeholder = providerDef?.keyPlaceholder || 'API key...';
}

function _populateAIModels(provider, selectedModel) {
  const select = document.getElementById('aiModelSelect');
  const customInput = document.getElementById('aiModelCustom');
  if (!select) return;

  const providerDef = Storage.AI_PROVIDERS[provider];

  if (provider === 'custom' || !providerDef?.models?.length) {
    select.style.display = 'none';
    if (customInput) { customInput.style.display = 'block'; customInput.value = selectedModel || ''; }
    return;
  }

  select.style.display = 'block';
  if (customInput) customInput.style.display = 'none';

  select.innerHTML = providerDef.models.map(m =>
    `<option value="${m.id}" ${m.id === selectedModel ? 'selected' : ''}>${m.name}</option>`
  ).join('');
}

function _toggleCustomUrlField(provider) {
  const group = document.getElementById('aiCustomUrlGroup');
  if (group) group.style.display = provider === 'custom' ? 'block' : 'none';
}

function toggleAIProviderKeyVisibility() {
  const input = document.getElementById('aiProviderKeyInput');
  const icon = document.getElementById('aiProviderKeyEyeIcon');
  if (!input) return;
  if (input.type === 'password') {
    input.type = 'text';
    if (icon) icon.className = 'fas fa-eye-slash';
  } else {
    input.type = 'password';
    if (icon) icon.className = 'fas fa-eye';
  }
}

function saveAIProviderUI() {
  const provider = document.getElementById('aiProviderSelect').value;
  const modelSelect = document.getElementById('aiModelSelect');
  const modelCustom = document.getElementById('aiModelCustom');
  const keyInput = document.getElementById('aiProviderKeyInput');
  const customUrl = document.getElementById('aiCustomUrl');

  const model = (provider === 'custom' || modelSelect?.style.display === 'none')
    ? (modelCustom?.value || '').trim()
    : (modelSelect?.value || '');

  const apiKey = (keyInput?.value || '').trim();

  if (!apiKey) {
    showToast('⚠️ Ingresa una API key', 'error');
    return;
  }

  const config = { provider, model, apiKey, customUrl: (customUrl?.value || '').trim() };
  Storage.saveAIProviderConfig(config);

  const status = document.getElementById('aiProviderStatus');
  const providerName = Storage.AI_PROVIDERS[provider]?.name || provider;
  if (status) status.innerHTML = `<i class="fas fa-check-circle" style="color:var(--success)"></i> Guardado: <strong>${providerName}</strong> · ${model}`;
  showToast(`✅ Proveedor guardado: ${providerName}`);
}

async function testAIProviderConnection() {
  const provider = document.getElementById('aiProviderSelect').value;
  const modelSelect = document.getElementById('aiModelSelect');
  const modelCustom = document.getElementById('aiModelCustom');
  const keyInput = document.getElementById('aiProviderKeyInput');
  const customUrl = document.getElementById('aiCustomUrl');
  const status = document.getElementById('aiProviderStatus');

  const model = (provider === 'custom' || modelSelect?.style.display === 'none')
    ? (modelCustom?.value || '').trim()
    : (modelSelect?.value || '');

  const apiKey = (keyInput?.value || '').trim();
  if (!apiKey) { showToast('⚠️ Ingresa una API key primero', 'error'); return; }

  if (status) status.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Probando conexión...';

  try {
    const providerDef = Storage.AI_PROVIDERS[provider];
    const url = provider === 'custom' ? (customUrl?.value || '').trim() : providerDef.url;
    const headers = providerDef.headers(apiKey);

    let body;
    if (providerDef.format === 'anthropic') {
      body = JSON.stringify({ model, max_tokens: 20, messages: [{ role: 'user', content: 'Responde solo: OK' }] });
    } else {
      body = JSON.stringify({ model, messages: [{ role: 'user', content: 'Responde solo: OK' }], max_tokens: 20 });
    }

    const res = await fetch(url, { method: 'POST', headers, body });

    if (res.ok) {
      if (status) status.innerHTML = '<i class="fas fa-check-circle" style="color:var(--success)"></i> ✅ Conexión exitosa — modelo disponible.';
      showToast('✅ Conexión OK');
    } else {
      const errText = await res.text();
      if (status) status.innerHTML = `<i class="fas fa-times-circle" style="color:var(--error)"></i> Error ${res.status}: ${errText.slice(0, 150)}`;
      showToast(`❌ Error ${res.status}`, 'error');
    }
  } catch (err) {
    if (status) status.innerHTML = `<i class="fas fa-times-circle" style="color:var(--error)"></i> Error de red: ${err.message}`;
    showToast('❌ Error de conexión', 'error');
  }
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


