/* ============================================================
   Productivity Monitor - App Builder v2.0.0
   Carga los partials HTML y construye la aplicación
   ============================================================ */

const PARTIALS = [
  'partials/header.html',
  'partials/dashboard.html',
  'partials/monitor.html',
  'partials/sessions.html',
  'partials/reports.html',
  'partials/search.html',
  'partials/data.html',
  'partials/footer.html'
];

async function loadApp() {
  const root = document.getElementById('app-root');
  const loading = document.getElementById('app-loading');

  try {
    // Cargar todos los partials en paralelo
    const contents = await Promise.all(
      PARTIALS.map(p => fetch(p).then(r => r.text()))
    );

    // Construir el HTML completo
    root.innerHTML = contents.join('');

    // Ocultar loading
    if (loading) loading.style.display = 'none';

    // Configurar navegación
    setupNavigation();

    // Configurar modo privacidad
    setupPrivacyToggle();

    // Configurar buscador global
    setupGlobalSearch();

    // Configurar menú móvil
    setupMobileMenu();

    // Inicializar la aplicación (dashboard, sesión activa, storage, PWA, atajos)
    initApp();

    // Actualizar UI de autenticación (Firebase) después de cargar los partials
    if (typeof updateAuthUI === 'function') {
      updateAuthUI();
    }

  } catch (err) {
    console.error('Error cargando la aplicación:', err);
    if (loading) {
      loading.innerHTML = `
        <div class="error-loading">
          <i class="fas fa-exclamation-triangle"></i>
          <p>Error al cargar la aplicación</p>
          <p style="font-size:0.8rem;color:#999">${escapeHtml(err.message)}</p>
          <button class="btn btn-primary" onclick="location.reload()">Reintentar</button>
        </div>
      `;
    }
  }
}

// ===== Navegación =====
function setupNavigation() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const view = item.dataset.view;
      switchView(view);
    });
  });

  document.querySelectorAll('.bn-item').forEach(item => {
    item.addEventListener('click', () => {
      const view = item.dataset.view;
      switchView(view);
    });
  });

  // Overlay click para cerrar sidebar
  const overlay = document.getElementById('sidebarOverlay');
  if (overlay) {
    overlay.addEventListener('click', closeSidebar);
  }
}


// ===== Modo Privacidad =====
function setupPrivacyToggle() {
  const switchEl = document.getElementById('privacySwitch');
  if (!switchEl) return;

  switchEl.addEventListener('change', () => {
    App.privacyMode = switchEl.checked;
    if (App.privacyMode) {
      if (App.currentSession) endSession();
      if (App.screenStream) stopScreenCapture();
      if (App.audioStream) stopAudioCapture();
      showToast('🔒 Modo privacidad activado. Monitoreo detenido.');
    } else {
      showToast('🔓 Modo privacidad desactivado');
    }
  });
}

// ===== Buscador global =====
function setupGlobalSearch() {
  const searchInput = document.getElementById('globalSearch');
  if (!searchInput) return;

  searchInput.addEventListener('input', globalSearch);
  searchInput.addEventListener('blur', hideSearchResults);
}

// ===== Menú móvil =====
function setupMobileMenu() {
  const menuBtn = document.getElementById('mhMenuBtn');
  if (!menuBtn) return;

  menuBtn.addEventListener('click', () => {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    sidebar.classList.add('open');
    overlay.classList.add('show');
    document.body.style.overflow = 'hidden';
  });
}

// ===== Iniciar =====
document.addEventListener('DOMContentLoaded', loadApp);
