/* ============================================================
   Productivity Monitor - Firebase Integration v1.0.0
   Autenticación + Sincronización en la nube (Firestore)
   ============================================================ */

// ===== Inicialización de Firebase =====
let firebaseApp = null;
let firebaseAuth = null;
let firebaseDB = null;
let firebaseStorage = null;
let firebaseUser = null;
let syncInProgress = false;

function initFirebase() {
  if (typeof firebase === 'undefined') {
    console.warn('Firebase SDK no cargado. La sincronización en la nube no estará disponible.');
    return false;
  }
  try {
    firebaseApp = firebase.initializeApp(FIREBASE_CONFIG);
    firebaseAuth = firebase.auth();
    firebaseDB = firebase.firestore();
    firebaseDB.settings({ ignoreUndefinedProperties: true });
    firebaseStorage = firebase.storage();
    return true;
  } catch (e) {
    console.error('Error inicializando Firebase:', e);
    return false;
  }
}

// ===== Estado de autenticación =====
function setupAuthListener() {
  if (!firebaseAuth) return;
  firebaseAuth.onAuthStateChanged((user) => {
    firebaseUser = user;
    updateAuthUI();
    if (user) {
      // Al iniciar sesión, sincronizar datos desde la nube
      syncFromCloud().then(() => {
        refreshAllViews();
      });
    }
  });
}

function isLoggedIn() {
  return !!firebaseUser;
}

function getCurrentUser() {
  return firebaseUser;
}

// ===== Autenticación =====
async function signUpWithEmail(email, password, displayName) {
  if (!firebaseAuth) return { ok: false, error: 'Firebase no disponible' };
  try {
    const cred = await firebaseAuth.createUserWithEmailAndPassword(email, password);
    if (displayName) {
      await cred.user.updateProfile({ displayName });
    }
    showToast('✅ Cuenta creada correctamente');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: getAuthErrorMessage(e.code) };
  }
}

async function signInWithEmail(email, password) {
  if (!firebaseAuth) return { ok: false, error: 'Firebase no disponible' };
  try {
    await firebaseAuth.signInWithEmailAndPassword(email, password);
    showToast('✅ Sesión iniciada');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: getAuthErrorMessage(e.code) };
  }
}

async function signInWithGoogle() {
  if (!firebaseAuth) return { ok: false, error: 'Firebase no disponible' };
  try {
    const provider = new firebase.auth.GoogleAuthProvider();
    await firebaseAuth.signInWithPopup(provider);
    showToast('✅ Sesión iniciada con Google');
    return { ok: true };
  } catch (e) {
    if (e.code === 'auth/popup-closed-by-user') return { ok: false, error: 'Ventana cerrada' };
    return { ok: false, error: getAuthErrorMessage(e.code) };
  }
}

async function signOut() {
  if (!firebaseAuth) return;
  try {
    await firebaseAuth.signOut();
    firebaseUser = null;
    showToast('👋 Sesión cerrada');
  } catch (e) {
    console.error('Error al cerrar sesión:', e);
  }
}

function getAuthErrorMessage(code) {
  const messages = {
    'auth/email-already-in-use': 'Este correo ya está registrado',
    'auth/invalid-email': 'Correo electrónico inválido',
    'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres',
    'auth/user-not-found': 'No existe una cuenta con este correo',
    'auth/wrong-password': 'Contraseña incorrecta',
    'auth/too-many-requests': 'Demasiados intentos. Intenta más tarde',
    'auth/network-request-failed': 'Error de red. Verifica tu conexión',
    'auth/popup-blocked': 'El navegador bloqueó la ventana. Permite popups'
  };
  return messages[code] || 'Error de autenticación';
}

// ===== Firebase Storage — Capturas =====

// Sube una captura a Storage y devuelve la URL pública de descarga.
// Path: screenshots/{uid}/{sessionId}/{screenshotId}.jpg
async function uploadScreenshot(sessionId, screenshotId, dataUrl) {
  if (!firebaseStorage || !firebaseUser) return null;
  try {
    const base64 = dataUrl.split(',')[1];
    if (!base64) return null;

    const path = `screenshots/${firebaseUser.uid}/${sessionId}/${screenshotId}.jpg`;
    const ref = firebaseStorage.ref(path);

    // Convertir base64 a Blob
    const byteChars = atob(base64);
    const byteArr = new Uint8Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i);
    const blob = new Blob([byteArr], { type: 'image/jpeg' });

    const snapshot = await ref.put(blob, { contentType: 'image/jpeg' });
    const url = await snapshot.ref.getDownloadURL();
    console.log(`[Storage] Captura subida: ${screenshotId}`);
    return url;
  } catch (e) {
    console.error('[Storage] Error subiendo captura:', e);
    return null;
  }
}

// Elimina una captura de Storage por sessionId + screenshotId.
async function deleteScreenshotFromStorage(sessionId, screenshotId) {
  if (!firebaseStorage || !firebaseUser) return;
  try {
    const path = `screenshots/${firebaseUser.uid}/${sessionId}/${screenshotId}.jpg`;
    await firebaseStorage.ref(path).delete();
    console.log(`[Storage] Captura eliminada: ${screenshotId}`);
  } catch (e) {
    // 404 = ya no existe, no es error crítico
    if (e.code !== 'storage/object-not-found') {
      console.warn('[Storage] Error eliminando captura:', e);
    }
  }
}

// Elimina todas las capturas de una sesión en Storage.
async function deleteSessionScreenshotsFromStorage(sessionId, screenshots) {
  if (!firebaseStorage || !firebaseUser || !screenshots?.length) return;
  await Promise.all(
    screenshots
      .filter(s => s.storageUrl) // solo las que están en Storage
      .map(s => deleteScreenshotFromStorage(sessionId, s.id))
  );
}

// ===== Sincronización con Firestore =====
function getCloudRef() {
  if (!firebaseUser || !firebaseDB) return null;
  return firebaseDB.collection('users').doc(firebaseUser.uid).collection('data').doc('sessions');
}

// Subir todas las sesiones locales a la nube
// Las capturas con dataUrl (base64) se omiten — solo se suben las storageUrl.
// Esto evita superar el límite de 1 MB por documento de Firestore.
async function pushToCloud() {
  if (!firebaseUser || !firebaseDB || syncInProgress) return false;
  syncInProgress = true;
  try {
    const sessions = Storage.getSessions();
    const ref = getCloudRef();
    if (!ref) return false;

    // Serializar sesiones sin los dataUrl base64 (pueden superar 1 MB en Firestore)
    const sessionsSafe = sessions.map(s => ({
      ...s,
      screenshots: (s.screenshots || []).map(sc => ({
        id: sc.id,
        timestamp: sc.timestamp,
        // storageUrl = URL de Firebase Storage (segura para Firestore)
        // dataUrl = base64 local (NO se sube a Firestore)
        ...(sc.storageUrl ? { storageUrl: sc.storageUrl } : {})
      }))
    }));

    await ref.set({
      sessions: sessionsSafe,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    return true;
  } catch (e) {
    console.error('Error subiendo a la nube:', e);
    showToast('⚠️ Error al sincronizar con la nube', 'error');
    return false;
  } finally {
    syncInProgress = false;
  }
}

// Descargar sesiones de la nube y fusionar con las locales
async function syncFromCloud() {
  if (!firebaseUser || !firebaseDB || syncInProgress) return false;
  syncInProgress = true;
  try {
    const ref = getCloudRef();
    if (!ref) return false;

    const doc = await ref.get();
    if (!doc.exists) {
      // No hay datos en la nube, subir los locales
      await pushToCloud();
      return true;
    }

    const cloudData = doc.data();
    const cloudSessions = cloudData.sessions || [];
    const localSessions = Storage.getSessions();

    // Fusionar por ID (la nube tiene prioridad si existe, pero conserva las locales nuevas)
    const merged = mergeSessions(localSessions, cloudSessions);

    // Guardar fusionadas localmente
    Storage.saveSessions(merged);

    // Subir la versión fusionada a la nube
    await ref.set({
      sessions: merged,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    showToast('☁️ Datos sincronizados con la nube');
    return true;
  } catch (e) {
    console.error('Error descargando de la nube:', e);
    showToast('⚠️ Error al sincronizar con la nube', 'error');
    return false;
  } finally {
    syncInProgress = false;
  }
}

// Fusionar sesiones locales y de la nube por ID
function mergeSessions(local, cloud) {
  const map = new Map();
  // Primero las locales
  local.forEach(s => map.set(s.id, s));
  // Luego las de la nube (sobrescriben si el ID existe, agregan si no)
  cloud.forEach(s => {
    if (map.has(s.id)) {
      // Si ambas existen, tomar la más reciente
      const localS = map.get(s.id);
      const localTime = localS.updatedAt || localS.endTime || localS.startTime || 0;
      const cloudTime = s.updatedAt || s.endTime || s.startTime || 0;
      if (cloudTime > localTime) map.set(s.id, s);
    } else {
      map.set(s.id, s);
    }
  });
  // Ordenar por fecha de inicio descendente
  return Array.from(map.values()).sort((a, b) => (b.startTime || 0) - (a.startTime || 0));
}

// ===== UI de autenticación =====
function updateAuthUI() {
  const authSection = document.getElementById('authSection');
  const userInfo = document.getElementById('userInfo');
  const userName = document.getElementById('userName');
  const userEmail = document.getElementById('userEmail');
  const syncStatus = document.getElementById('syncStatus');

  // Elementos de la vista "Mis Datos"
  const dataAuthSection = document.getElementById('dataAuthSection');
  const dataUserInfo = document.getElementById('dataUserInfo');
  const dataUserName = document.getElementById('dataUserName');
  const dataUserEmail = document.getElementById('dataUserEmail');
  const dataSyncStatus = document.getElementById('dataSyncStatus');

  if (firebaseUser) {
    // Sidebar
    if (authSection) authSection.style.display = 'none';
    if (userInfo) {
      userInfo.style.display = 'block';
      if (userName) userName.textContent = firebaseUser.displayName || 'Usuario';
      if (userEmail) userEmail.textContent = firebaseUser.email || '';
    }
    if (syncStatus) {
      syncStatus.innerHTML = '<i class="fas fa-cloud"></i> Sincronizado';
      syncStatus.className = 'sync-status synced';
    }

    // Vista Mis Datos
    if (dataAuthSection) dataAuthSection.style.display = 'none';
    if (dataUserInfo) {
      dataUserInfo.style.display = 'block';
      if (dataUserName) dataUserName.textContent = firebaseUser.displayName || 'Usuario';
      if (dataUserEmail) dataUserEmail.textContent = firebaseUser.email || '';
    }
    if (dataSyncStatus) {
      dataSyncStatus.innerHTML = '<i class="fas fa-cloud"></i> Sincronizado';
      dataSyncStatus.className = 'sync-status synced';
    }
  } else {
    // Sidebar
    if (authSection) authSection.style.display = 'block';
    if (userInfo) userInfo.style.display = 'none';
    if (syncStatus) {
      syncStatus.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> Sin sincronizar';
      syncStatus.className = 'sync-status';
    }

    // Vista Mis Datos
    if (dataAuthSection) dataAuthSection.style.display = 'block';
    if (dataUserInfo) dataUserInfo.style.display = 'none';
    if (dataSyncStatus) {
      dataSyncStatus.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> Sin sincronizar';
      dataSyncStatus.className = 'sync-status';
    }
  }
}


// ===== Modal de autenticación =====
function openAuthModal() {
  const modal = document.getElementById('authModal');
  if (modal) modal.style.display = 'flex';
}

function closeAuthModal() {
  const modal = document.getElementById('authModal');
  if (modal) modal.style.display = 'none';
}

function switchAuthMode(mode) {
  const loginForm = document.getElementById('loginForm');
  const signupForm = document.getElementById('signupForm');
  const loginTab = document.getElementById('authTabLogin');
  const signupTab = document.getElementById('authTabSignup');

  if (mode === 'signup') {
    if (loginForm) loginForm.style.display = 'none';
    if (signupForm) signupForm.style.display = 'block';
    if (loginTab) loginTab.classList.remove('active');
    if (signupTab) signupTab.classList.add('active');
  } else {
    if (loginForm) loginForm.style.display = 'block';
    if (signupForm) signupForm.style.display = 'none';
    if (loginTab) loginTab.classList.add('active');
    if (signupTab) signupTab.classList.remove('active');
  }
}

async function handleLoginSubmit(event) {
  event.preventDefault();
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const errorEl = document.getElementById('loginError');

  if (!email || !password) {
    if (errorEl) errorEl.textContent = 'Completa todos los campos';
    return;
  }

  const result = await signInWithEmail(email, password);
  if (result.ok) {
    closeAuthModal();
  } else {
    if (errorEl) errorEl.textContent = result.error;
  }
}

async function handleSignupSubmit(event) {
  event.preventDefault();
  const name = document.getElementById('signupName').value.trim();
  const email = document.getElementById('signupEmail').value.trim();
  const password = document.getElementById('signupPassword').value;
  const errorEl = document.getElementById('signupError');

  if (!name || !email || !password) {
    if (errorEl) errorEl.textContent = 'Completa todos los campos';
    return;
  }

  const result = await signUpWithEmail(email, password, name);
  if (result.ok) {
    closeAuthModal();
  } else {
    if (errorEl) errorEl.textContent = result.error;
  }
}

async function handleGoogleLogin() {
  const result = await signInWithGoogle();
  if (result.ok) {
    closeAuthModal();
  }
}

// ===== Sincronización manual =====
async function manualSync() {
  if (!firebaseUser) {
    openAuthModal();
    return;
  }
  const btn = document.getElementById('btnSync');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sincronizando...';
  }
  const ok = await syncFromCloud();
  if (btn) {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-sync"></i> Sincronizar ahora';
  }
  if (ok) refreshAllViews();
}

// ===== Refrescar todas las vistas =====
function refreshAllViews() {
  if (typeof loadDashboard === 'function') loadDashboard();
  if (typeof loadSessions === 'function') loadSessions();
  if (typeof loadReports === 'function') loadReports();
  if (typeof updateStorageIndicator === 'function') updateStorageIndicator();
}

// ===== Inicializar =====
document.addEventListener('DOMContentLoaded', () => {
  if (initFirebase()) {
    setupAuthListener();
  }
});
