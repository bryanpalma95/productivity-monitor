/* ============================================================
   Productivity Monitor - Monitor Module v3.0.0
   Transcripción: Groq Whisper (si hay API key) → Web Speech API (fallback)
   ============================================================ */

// ===== Groq API Key helpers =====
function getGroqApiKey() {
  return localStorage.getItem('groq_api_key') || '';
}

function saveGroqApiKey() {
  const input = document.getElementById('groqApiKeyInput');
  if (!input) return;
  const key = input.value.trim();
  if (!key) { showToast('⚠️ Ingresa una API key primero', 'error'); return; }
  // Groq keys pueden empezar con gsk_ o grok_ según la versión
  if (key.length < 20) { showToast('⚠️ La key parece demasiado corta', 'error'); return; }
  localStorage.setItem('groq_api_key', key);
  updateGroqKeyStatus();
  showToast('✅ API key de Groq guardada. Puedes verificarla en la consola: localStorage.getItem("groq_api_key")');
  console.log('[Groq] Key guardada:', key.slice(0, 8) + '...' + key.slice(-4));
}

function clearGroqApiKey() {
  localStorage.removeItem('groq_api_key');
  const input = document.getElementById('groqApiKeyInput');
  if (input) input.value = '';
  updateGroqKeyStatus();
  showToast('🗑️ API key eliminada');
}

function onGroqKeyInput() {
  // no-op — solo para forzar reactividad si se necesita
}

function toggleGroqKeyVisibility() {
  const input = document.getElementById('groqApiKeyInput');
  const icon = document.getElementById('groqKeyEyeIcon');
  if (!input) return;
  if (input.type === 'password') {
    input.type = 'text';
    icon.className = 'fas fa-eye-slash';
  } else {
    input.type = 'password';
    icon.className = 'fas fa-eye';
  }
}

function updateGroqKeyStatus() {
  const key = getGroqApiKey();
  const statusEl = document.getElementById('groqKeyStatus');
  const input = document.getElementById('groqApiKeyInput');
  if (!statusEl) return;
  if (key) {
    if (input && !input.value) input.value = key; // rellenar si está vacío
    statusEl.innerHTML = '<i class="fas fa-check-circle" style="color:var(--success)"></i> API key configurada — la transcripción usará <strong>Groq Whisper</strong>.';
  } else {
    statusEl.innerHTML = '<i class="fas fa-info-circle"></i> Sin API key — usando reconocimiento de voz del navegador como fallback.';
  }
}

// Llamar al cargar la vista de datos
function initGroqKeyUI() {
  const key = getGroqApiKey();
  const input = document.getElementById('groqApiKeyInput');
  if (input && key) input.value = key;
  updateGroqKeyStatus();
}

// ===== Variables de módulo =====
let _systemMediaRecorder = null;
let _micMediaRecorder = null;
let _speechRetryCount = 0;
let _speechRetryTimer = null;
const _MAX_SPEECH_RETRIES = 10;

// ===== Captura de Pantalla =====
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

  // Solo limpiar la referencia; las pistas ya fueron detenidas con screenStream
  App.systemAudioStream = null;

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

// ===== Audio y Transcripción =====

function handleAudioSourceChange() {
  const hasMic = document.getElementById('audioSourceMic')?.checked;
  const hasSystem = document.getElementById('audioSourceSystem')?.checked;
  const hint = document.getElementById('audioSourceHint');
  const btnStart = document.getElementById('btnStartAudio');
  const sysInstructions = document.getElementById('systemAudioInstructions');

  if (sysInstructions) sysInstructions.style.display = hasSystem ? 'block' : 'none';

  if (!hint || !btnStart) return;
  if (!hasMic && !hasSystem) {
    hint.innerHTML = '<i class="fas fa-exclamation-triangle" style="color:var(--warning)"></i> <span>Selecciona al menos una fuente.</span>';
    btnStart.disabled = true;
    return;
  }
  btnStart.disabled = false;

  const hasGroq = !!getGroqApiKey();
  const parts = [];
  if (hasMic) parts.push('🎤 Micrófono');
  if (hasSystem) parts.push('🔊 Sistema');
  let msg = parts.join(' + ') + '. ';
  if (hasMic) msg += hasGroq ? 'Transcripción Groq Whisper.' : 'Transcripción Speech API.';
  hint.innerHTML = `<i class="fas fa-info-circle"></i> <span>${msg}</span>`;
}

async function startAudioCapture() {
  if (App.privacyMode) {
    showToast('🔒 Modo privacidad activado.', 'error');
    return;
  }

  const useMic    = document.getElementById('audioSourceMic')?.checked ?? true;
  const useSystem = document.getElementById('audioSourceSystem')?.checked ?? false;

  if (!useMic && !useSystem) {
    showToast('⚠️ Selecciona al menos una fuente de audio.', 'error');
    return;
  }

  try {
    // ── 1. Micrófono via getUserMedia ──
    if (useMic) {
      App.audioStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      });
    }

    // ── 2. Audio del sistema via getDisplayMedia (igual que videollamadas) ──
    if (useSystem) {
      try {
        const displayStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,          // requerido por la API, lo silenciamos enseguida
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
            suppressLocalAudioPlayback: false  // Chrome 109+ — no suprimir el propio audio
          }
        });

        // Detener la pista de video de inmediato (solo queremos el audio)
        displayStream.getVideoTracks().forEach(t => t.stop());

        const audioTracks = displayStream.getAudioTracks();
        const statusMsg = document.getElementById('systemAudioStatusMsg');

        if (audioTracks.length === 0) {
          // El usuario no marcó "Compartir audio del sistema" en el diálogo
          if (statusMsg) statusMsg.innerHTML =
            '<span style="color:var(--warning)">⚠️ No se detectó audio del sistema. ' +
            'Asegúrate de marcar <strong>"Compartir audio del sistema"</strong> en el diálogo antes de hacer clic en "Compartir".</span>';
          showToast('⚠️ Sin audio del sistema — marca la opción en el diálogo del navegador', 'error');
        } else {
          App.systemAudioStream = new MediaStream(audioTracks);

          // Escuchar si el usuario cierra el diálogo de compartir
          audioTracks[0].addEventListener('ended', () => {
            App.systemAudioStream = null;
            const s = document.getElementById('audioStatus');
            if (s) s.innerHTML = '<span class="status-badge idle"><i class="fas fa-circle"></i> Sistema detenido</span>';
          });

          startSystemAudioTranscription();

          const hasGroq = !!getGroqApiKey();
          if (statusMsg) statusMsg.innerHTML = hasGroq
            ? '<span style="color:var(--success)">✅ Audio del sistema capturado. Transcribiendo con Groq Whisper cada 15 seg.</span>'
            : '<span style="color:var(--warning)">⚠️ Audio del sistema capturado, pero <strong>necesitas una Groq API key</strong> para transcribirlo. Configúrala en <strong>Mis Datos</strong>.</span>';
          showToast('🔊 Audio del sistema capturado' + (hasGroq ? '' : ' (sin transcripción — falta Groq key)'));
        }
      } catch (sysErr) {
        if (sysErr.name === 'NotAllowedError' || sysErr.name === 'AbortError') {
          showToast('ℹ️ Diálogo de pantalla cancelado. Continuando solo con micrófono.', 'info');
        } else {
          console.error('Error getDisplayMedia:', sysErr);
          showToast('⚠️ No se pudo abrir el diálogo de pantalla: ' + sysErr.message, 'error');
        }
        if (!useMic) return;
      }
    }

    // ── 3. Visualizador — usar mic si existe, si no sistema ──
    const vizStream = App.audioStream || App.systemAudioStream;
    if (vizStream) setupAudioVisualizer(vizStream);

    // ── 4. Transcripción del micrófono ──
    if (useMic && App.audioStream) startMicTranscription();

    document.getElementById('btnStartAudio').style.display = 'none';
    document.getElementById('btnStopAudio').style.display = 'inline-flex';

    const statusParts = [];
    if (useMic && App.audioStream) statusParts.push('🎤 Mic');
    if (useSystem && App.systemAudioStream) statusParts.push('🔊 Sistema');

    document.getElementById('audioStatus').innerHTML =
      `<span class="status-badge active"><i class="fas fa-circle"></i> ${statusParts.join(' + ') || 'Grabando'}</span>`;

    if (statusParts.length) showToast('🎙️ Audio: ' + statusParts.join(' + '));

  } catch (err) {
    console.error('Error al iniciar audio:', err);
    if (err.name === 'NotAllowedError') {
      showToast('❌ Permiso denegado. Habilita el micrófono en tu navegador.', 'error');
    } else {
      showToast('❌ Error al iniciar audio: ' + err.message, 'error');
    }
  }
}

// ===== Transcripción del Audio del Sistema (via Groq Whisper) =====
function startSystemAudioTranscription() {
  clearInterval(App.systemTranscriptionInterval);
  App.systemTranscriptionInterval = null;

  const transcriptStatus = document.getElementById('transcriptStatus');

  // Si no hay sesión, esperar a que haya una
  if (!App.currentSession) {
    if (transcriptStatus) transcriptStatus.innerHTML =
      '<span class="status-badge idle"><i class="fas fa-circle"></i> Inicia sesión para transcribir...</span>';
    App.systemTranscriptionInterval = setInterval(() => {
      if (App.currentSession && App.systemAudioStream) {
        clearInterval(App.systemTranscriptionInterval);
        App.systemTranscriptionInterval = null;
        startSystemAudioTranscription();
      }
    }, 2000);
    return;
  }

  // Verificar pistas activas
  const tracks = App.systemAudioStream ? App.systemAudioStream.getAudioTracks() : [];
  console.log('[Sistema] Pistas:', tracks.length, tracks.map(t => `${t.label}(${t.readyState})`));

  if (!tracks.length || tracks[0].readyState !== 'live') {
    if (transcriptStatus) transcriptStatus.innerHTML =
      '<span class="status-badge idle"><i class="fas fa-circle"></i> Sin audio del sistema</span>';
    console.warn('[Sistema] Stream sin pistas activas');
    return;
  }

  if (transcriptStatus) transcriptStatus.innerHTML =
    '<span class="status-badge active"><i class="fas fa-circle"></i> Grabando sistema...</span>';

  // Grabación casi continua: iniciar chunk cada 15s, cada chunk graba 14s
  // → solo 1s de gap entre chunks para no perder nada
  _runSystemChunk();
  App.systemTranscriptionInterval = setInterval(() => {
    if (!App.systemAudioStream || !App.currentSession) {
      clearInterval(App.systemTranscriptionInterval);
      return;
    }
    const t = App.systemAudioStream.getAudioTracks();
    if (!t.length || t[0].readyState !== 'live') {
      clearInterval(App.systemTranscriptionInterval);
      return;
    }
    _runSystemChunk();
  }, 15000);
}

function _runSystemChunk() {
  if (_systemMediaRecorder && _systemMediaRecorder.state !== 'inactive') {
    console.log('[Sistema] Recorder ocupado, saltando');
    return;
  }

  const apiKey = getGroqApiKey();
  const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4']
    .find(m => MediaRecorder.isTypeSupported(m)) || '';

  // Capturar timestamp al inicio del chunk para la transcripción
  const chunkStartTime = Date.now();

  console.log('[Sistema] Chunk iniciado. MIME:', mimeType || 'default', '| Groq:', apiKey ? apiKey.slice(0,8)+'...' : 'NO — ve a Mis Datos y guarda la key');

  try {
    _systemMediaRecorder = new MediaRecorder(App.systemAudioStream, mimeType ? { mimeType } : {});
  } catch (e) {
    console.error('[Sistema] MediaRecorder no se pudo crear:', e);
    _systemMediaRecorder = null;
    return;
  }

  const chunks = [];

  _systemMediaRecorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) {
      chunks.push(e.data);
    }
  };

  _systemMediaRecorder.onstop = async () => {
    _systemMediaRecorder = null;
    const total = chunks.reduce((s, c) => s + c.size, 0);
    console.log('[Sistema] Stop. Chunks:', chunks.length, '| Total:', total, 'bytes');

    if (!chunks.length || total < 512) {
      console.warn('[Sistema] Sin audio real — stream silencioso o sin datos');
      return;
    }

    const blobType = mimeType || 'audio/webm';
    const blob = new Blob(chunks, { type: blobType });

    if (!apiKey) {
      console.info('[Sistema] Audio OK pero sin Groq key para transcribir');
      showToast('ℹ️ Audio del sistema grabado — configura Groq key en Mis Datos', 'info');
      return;
    }

    const ext = blobType.includes('ogg') ? 'ogg' : blobType.includes('mp4') ? 'mp4' : 'webm';
    const formData = new FormData();
    formData.append('file', blob, `system.${ext}`);
    formData.append('model', 'whisper-large-v3-turbo');
    formData.append('language', 'es');
    formData.append('response_format', 'json');

    console.log('[Sistema] Enviando a Groq:', blob.size, 'bytes');
    try {
      const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}` },
        body: formData
      });
      console.log('[Sistema] Groq status:', res.status);
      if (res.status === 401) { showToast('❌ Groq key inválida', 'error'); return; }
      if (!res.ok) { console.warn('[Sistema] Groq error:', await res.text()); return; }
      const data = await res.json();
      console.log('[Sistema] Transcripción:', data.text);
      // Usar el timestamp del inicio del chunk para marcar cuándo se dijo
      if (data.text && data.text.trim()) {
        addTranscriptEntry('[🔊] ' + data.text.trim(), chunkStartTime);
      }
    } catch (err) {
      console.error('[Sistema] Fetch falló:', err);
    }
  };

  _systemMediaRecorder.onerror = (e) => {
    console.error('[Sistema] Error:', e);
    _systemMediaRecorder = null;
  };

  _systemMediaRecorder.start(1000); // timeslice 1s para datos continuos

  // Grabar 14s de cada ciclo de 15s → solo 1s de gap
  setTimeout(() => {
    if (_systemMediaRecorder && _systemMediaRecorder.state !== 'inactive') {
      _systemMediaRecorder.stop();
    }
  }, 14000);
}

// Alias para compatibilidad
async function transcribeSystemAudioChunk() { _runSystemChunk(); }

// ===== Transcripción del Micrófono (Groq Whisper → fallback Web Speech API) =====
function startMicTranscription() {
  _speechRetryCount = 0;
  clearTimeout(_speechRetryTimer);
  _speechRetryTimer = null;

  if (getGroqApiKey()) {
    _startGroqMicTranscription();
  } else {
    _initSpeechRecognition();
  }
}

// ----- Groq Whisper -----
function _startGroqMicTranscription() {
  const transcriptStatus = document.getElementById('transcriptStatus');
  if (transcriptStatus) {
    transcriptStatus.innerHTML = '<span class="status-badge active"><i class="fas fa-circle"></i> Escuchando (Groq Whisper)...</span>';
  }

  clearInterval(App.micTranscriptionInterval);
  App.micTranscriptionInterval = setInterval(() => {
    if (!App.audioStream || !App.currentSession) return;
    _transcribeWithGroq();
  }, 15000);
}

async function _transcribeWithGroq() {
  if (!App.audioStream || !App.currentSession) return;
  if (_micMediaRecorder && _micMediaRecorder.state === 'recording') return;

  const apiKey = getGroqApiKey();
  if (!apiKey) return;

  try {
    const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4']
      .find(m => MediaRecorder.isTypeSupported(m)) || '';

    _micMediaRecorder = new MediaRecorder(App.audioStream, mimeType ? { mimeType } : {});
    const chunks = [];

    _micMediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };

    _micMediaRecorder.onstop = async () => {
      _micMediaRecorder = null;
      if (!chunks.length) return;

      const blobType = mimeType || 'audio/webm';
      const blob = new Blob(chunks, { type: blobType });
      if (blob.size < 1024) return; // silencio

      const ext = blobType.includes('ogg') ? 'ogg' : blobType.includes('mp4') ? 'mp4' : 'webm';
      const formData = new FormData();
      formData.append('file', blob, `mic.${ext}`);
      formData.append('model', 'whisper-large-v3-turbo');
      formData.append('language', 'es');
      formData.append('response_format', 'json');

      try {
        const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${apiKey}` },
          body: formData
        });

        if (res.status === 401) {
          showToast('❌ API key de Groq inválida. Verifica en Mis Datos.', 'error');
          stopMicTranscription();
          return;
        }
        if (!res.ok) {
          console.warn('Groq transcripción falló:', res.status);
          return;
        }

        const data = await res.json();
        const text = data.text || '';
        if (text.trim()) addTranscriptEntry(text.trim());

      } catch (err) {
        console.error('Error Groq transcripción:', err);
      }
    };

    _micMediaRecorder.onerror = () => { _micMediaRecorder = null; };
    _micMediaRecorder.start();

    setTimeout(() => {
      if (_micMediaRecorder && _micMediaRecorder.state === 'recording') {
        _micMediaRecorder.stop();
      }
    }, 10000);

  } catch (err) {
    console.error('Error iniciando grabación Groq:', err);
    _micMediaRecorder = null;
  }
}

// ----- Web Speech API (fallback) -----

function _initSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    showToast('⚠️ Tu navegador no soporta reconocimiento de voz. Usa Chrome o Edge.', 'error');
    stopAudioCapture();
    return;
  }

  // Limpiar instancia anterior
  if (App.recognition) {
    try { App.recognition.abort(); } catch (e) {}
    App.recognition = null;
  }

  const rec = new SpeechRecognition();
  rec.lang = 'es-ES';
  rec.continuous = true;
  rec.interimResults = true;
  rec.maxAlternatives = 1;

  App.recognition = rec;

  rec.onstart = () => {
    _speechRetryCount = 0; // Reiniciar contador al conectar exitosamente
    const ts = document.getElementById('transcriptStatus');
    if (ts) ts.innerHTML = '<span class="status-badge active"><i class="fas fa-circle"></i> Escuchando...</span>';
  };

  rec.onresult = (event) => {
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        if (transcript.trim()) addTranscriptEntry(transcript.trim());
      } else {
        interim += transcript;
      }
    }
    const liveTranscript = document.getElementById('liveTranscript');
    if (liveTranscript && interim) {
      // Mostrar texto provisional sin guardarlo
      const existing = liveTranscript.querySelector('.interim');
      if (existing) {
        existing.querySelector('.transcript-text').textContent = interim;
      } else {
        const div = document.createElement('div');
        div.className = 'transcript-entry interim';
        div.innerHTML = `<span class="transcript-time">${formatTime(Date.now())}</span><span class="transcript-text">${escapeHtml(interim)}</span>`;
        if (liveTranscript.querySelector('.empty-state')) liveTranscript.innerHTML = '';
        liveTranscript.appendChild(div);
        liveTranscript.scrollTop = liveTranscript.scrollHeight;
      }
    }
  };

  rec.onerror = (event) => {
    console.warn('SpeechRecognition error:', event.error);
    const ts = document.getElementById('transcriptStatus');

    if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
      showToast('❌ Permiso de micrófono denegado o servicio bloqueado.', 'error');
      stopAudioCapture();
      return;
    }

    if (event.error === 'network') {
      // Error transitorio de red — reintentar con backoff
      _speechRetryCount++;
      const delay = Math.min(2000 * _speechRetryCount, 15000);
      if (ts) ts.innerHTML = `<span class="status-badge idle"><i class="fas fa-circle"></i> Reintentando (${_speechRetryCount})...</span>`;

      if (_speechRetryCount <= _MAX_SPEECH_RETRIES) {
        clearTimeout(_speechRetryTimer);
        _speechRetryTimer = setTimeout(() => {
          if (App.audioStream && !App.privacyMode) {
            _initSpeechRecognition();
          }
        }, delay);
      } else {
        showToast('❌ No se pudo conectar al servicio de voz tras varios intentos.', 'error');
        if (ts) ts.innerHTML = '<span class="status-badge idle"><i class="fas fa-circle"></i> Sin conexión al servicio de voz</span>';
      }
      return;
    }

    // no-speech, audio-capture: errores normales, onend reiniciará
  };

  rec.onend = () => {
    // Limpiar texto provisional
    const liveTranscript = document.getElementById('liveTranscript');
    if (liveTranscript) {
      const interim = liveTranscript.querySelector('.interim');
      if (interim) interim.remove();
    }

    // Reiniciar solo si el audio sigue activo, no fue parado intencionalmente,
    // y no hay un reintento por error de red ya programado
    if (App.audioStream && !App.privacyMode && App.recognition && !_speechRetryTimer) {
      try {
        App.recognition.start();
      } catch (e) {
        // Puede fallar si ya está iniciando — ignorar
      }
    }
  };

  try {
    rec.start();
  } catch (e) {
    console.error('Error iniciando SpeechRecognition:', e);
  }
}

function stopMicTranscription() {
  clearTimeout(_speechRetryTimer);
  _speechRetryTimer = null;
  _speechRetryCount = 0;

  // Detener intervalo de Groq
  clearInterval(App.micTranscriptionInterval);
  App.micTranscriptionInterval = null;

  // Detener MediaRecorder del mic si está activo
  if (_micMediaRecorder && _micMediaRecorder.state !== 'inactive') {
    try { _micMediaRecorder.stop(); } catch (e) {}
  }
  _micMediaRecorder = null;

  // Detener SpeechRecognition si estaba activo
  if (App.recognition) {
    const rec = App.recognition;
    App.recognition = null;
    try { rec.abort(); } catch (e) {}
  }
}

// transcribeMicChunk eliminado — reemplazado por SpeechRecognition robusta

function stopAudioCapture() {
  // Detener el MediaRecorder del sistema si está activo
  if (_systemMediaRecorder && _systemMediaRecorder.state !== 'inactive') {
    try { _systemMediaRecorder.stop(); } catch (e) {}
  }
  _systemMediaRecorder = null;

  // Detener SpeechRecognition y Groq con sus timers
  stopMicTranscription();

  // Detener intervalo de transcripción del sistema
  clearInterval(App.systemTranscriptionInterval);
  App.systemTranscriptionInterval = null;

  // Detener stream del micrófono
  if (App.audioStream) {
    App.audioStream.getTracks().forEach(t => t.stop());
    App.audioStream = null;
  }

  // Detener stream del sistema (clonado — seguro detenerlo sin afectar screenStream)
  if (App.systemAudioStream) {
    App.systemAudioStream.getTracks().forEach(t => t.stop());
    App.systemAudioStream = null;
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

function setupAudioVisualizer(stream) {
  // Usar el stream pasado como argumento, o App.audioStream como fallback
  const src = stream || App.audioStream;
  if (!src) return;

  App.audioContext = new (window.AudioContext || window.webkitAudioContext)();
  if (App.audioContext.state === 'suspended') {
    App.audioContext.resume().catch(err => console.warn('AudioContext resume fallido:', err));
  }

  const source = App.audioContext.createMediaStreamSource(src);
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

// startSpeechRecognition() eliminado — reemplazado por transcribeMicChunk() via Whisper
// para garantizar funcionamiento en HTTPS/GitHub Pages sin depender de la API del navegador

function addTranscriptEntry(text, timestamp) {
  if (!App.currentSession) return;

  const ts = timestamp || Date.now();
  const entry = {
    id: generateId(),
    timestamp: ts,
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

  // Estilo diferente para entradas del sistema vs micrófono
  const isSystem = text.startsWith('[🔊]');
  entryEl.className = 'transcript-entry' + (isSystem ? ' transcript-system' : '');
  entryEl.innerHTML = `
    <span class="transcript-time">${formatTime(ts)}</span>
    <span class="transcript-text">${escapeHtml(entry.text)}</span>
  `;

  if (liveTranscript.querySelector('.empty-state')) {
    liveTranscript.innerHTML = '';
  }
  liveTranscript.appendChild(entryEl);
  liveTranscript.scrollTop = liveTranscript.scrollHeight;
}
