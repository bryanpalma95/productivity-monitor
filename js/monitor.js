/* ============================================================
   Productivity Monitor - Monitor Module v2.2.0
   Captura de pantalla, audio y transcripción en vivo
   ============================================================ */

// Referencia al MediaRecorder activo del audio del sistema (evita instancias zombie)
let _systemMediaRecorder = null;

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
  const source = document.getElementById('audioSource').value;
  const hint = document.getElementById('audioSourceHint');
  const btnStart = document.getElementById('btnStartAudio');

  if (source === 'system') {
    hint.innerHTML = '<i class="fas fa-info-circle"></i> <span>El audio del sistema requiere compartir pantalla con audio. Se transcribe usando IA (OmniRoute).</span>';
    btnStart.innerHTML = '<i class="fas fa-volume-up"></i> Iniciar Audio del Sistema';
  } else {
    hint.innerHTML = '<i class="fas fa-info-circle"></i> <span>El micrófono usa reconocimiento de voz del navegador (Chrome/Edge).</span>';
    btnStart.innerHTML = '<i class="fas fa-microphone"></i> Iniciar Audio';
  }
}

async function startAudioCapture() {
  if (App.privacyMode) {
    showToast('🔒 Modo privacidad activado. Desactívalo para monitorear.', 'error');
    return;
  }

  const source = document.getElementById('audioSource').value;

  try {
    if (source === 'system') {
      // Audio del sistema: requiere captura de pantalla con audio
      if (!App.screenStream) {
        showToast('⚠️ Primero comparte tu pantalla con audio para capturar el audio del sistema.', 'error');
        return;
      }

      const audioTracks = App.screenStream.getAudioTracks();
      if (audioTracks.length === 0) {
        showToast('⚠️ La captura de pantalla no incluye audio. Vuelve a compartir pantalla marcando la opción de audio.', 'error');
        return;
      }

      // Clonar las pistas para que detener el audioStream NO afecte al screenStream
      const clonedTracks = audioTracks.map(t => t.clone());
      App.audioStream = new MediaStream(clonedTracks);
      setupAudioVisualizer();
      startSystemAudioTranscription();

      document.getElementById('btnStartAudio').style.display = 'none';
      document.getElementById('btnStopAudio').style.display = 'inline-flex';

      const status = document.getElementById('audioStatus');
      status.innerHTML = '<span class="status-badge active"><i class="fas fa-circle"></i> Grabando sistema</span>';

      showToast('🔊 Audio del sistema y transcripción iniciados');
    } else {
      // Micrófono: usa getUserMedia + SpeechRecognition
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
    }
  } catch (err) {
    console.error('Error al iniciar audio:', err);
    if (err.name === 'NotAllowedError') {
      showToast('❌ Permiso de micrófono denegado. Habilítalo en la configuración del navegador.', 'error');
    } else {
      showToast('❌ No se pudo acceder al audio', 'error');
    }
  }
}

// ===== Transcripción del Audio del Sistema (via OmniRoute) =====
function startSystemAudioTranscription() {
  const transcriptStatus = document.getElementById('transcriptStatus');

  // Si no hay sesión activa, seguir en modo "esperando sesión" — el intervalo
  // verificará por sí mismo cuando haya sesión antes de grabar
  if (!App.currentSession) {
    transcriptStatus.innerHTML = '<span class="status-badge idle"><i class="fas fa-circle"></i> Esperando sesión...</span>';
    showToast('ℹ️ Audio listo. La transcripción comenzará cuando inicies una sesión.', 'info');
  } else {
    transcriptStatus.innerHTML = '<span class="status-badge active"><i class="fas fa-circle"></i> Transcribiendo (IA)...</span>';
  }

  // Intervalo de transcripción cada 15 segundos
  clearInterval(App.systemTranscriptionInterval);
  App.systemTranscriptionInterval = setInterval(() => {
    if (!App.audioStream) return;
    if (!App.currentSession) return; // Esperar sesión sin detener el intervalo

    // Actualizar status si estaba en "esperando"
    const ts = document.getElementById('transcriptStatus');
    if (ts && ts.querySelector('.idle')) {
      ts.innerHTML = '<span class="status-badge active"><i class="fas fa-circle"></i> Transcribiendo (IA)...</span>';
    }

    transcribeSystemAudioChunk();
  }, 15000);
}

async function transcribeSystemAudioChunk() {
  if (!App.audioStream || !App.currentSession) return;

  // Si hay un recorder activo de la ronda anterior, no crear otro
  if (_systemMediaRecorder && _systemMediaRecorder.state === 'recording') return;

  try {
    // Determinar el MIME type soportado por el navegador
    const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4']
      .find(m => MediaRecorder.isTypeSupported(m)) || '';

    const recorderOptions = mimeType ? { mimeType } : {};
    _systemMediaRecorder = new MediaRecorder(App.audioStream, recorderOptions);
    const chunks = [];

    _systemMediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };

    _systemMediaRecorder.onstop = async () => {
      _systemMediaRecorder = null;
      if (chunks.length === 0) return;

      const blobType = mimeType || 'audio/webm';
      const blob = new Blob(chunks, { type: blobType });

      // Verificar que el blob tiene contenido real (>1KB) para evitar enviar silencio
      if (blob.size < 1024) return;

      // Enviar a la API de transcripción de OmniRoute
      const formData = new FormData();
      // Usar extensión según el tipo de audio
      const ext = blobType.includes('ogg') ? 'ogg' : blobType.includes('mp4') ? 'mp4' : 'webm';
      formData.append('file', blob, `audio.${ext}`);
      formData.append('model', 'af/whisper-1');

      try {
        const response = await fetch('https://omniroute.vercel.app/api/audio', {
          method: 'POST',
          body: formData
        });

        if (!response.ok) {
          console.warn('Transcripción falló:', response.status);
          return;
        }

        const data = await response.json();
        const text = data.text || data.transcript || '';

        if (text && text.trim()) {
          addTranscriptEntry(text.trim());
        }
      } catch (err) {
        console.error('Error en transcripción:', err);
      }
    };

    _systemMediaRecorder.onerror = (e) => {
      console.error('MediaRecorder error:', e.error);
      _systemMediaRecorder = null;
    };

    _systemMediaRecorder.start();

    // Detener después de 10 segundos para enviar el chunk
    setTimeout(() => {
      if (_systemMediaRecorder && _systemMediaRecorder.state === 'recording') {
        _systemMediaRecorder.stop();
      }
    }, 10000);

  } catch (err) {
    console.error('Error capturando audio del sistema:', err);
    _systemMediaRecorder = null;
  }
}

function stopAudioCapture() {
  // Detener el MediaRecorder del sistema si está activo
  if (_systemMediaRecorder && _systemMediaRecorder.state !== 'inactive') {
    try { _systemMediaRecorder.stop(); } catch (e) {}
  }
  _systemMediaRecorder = null;

  // Detener transcripción del audio del sistema
  clearInterval(App.systemTranscriptionInterval);
  App.systemTranscriptionInterval = null;

  if (App.audioStream) {
    // Detener las pistas del stream de audio (son clones si era audio del sistema,
    // o pistas reales del mic — en ambos casos es seguro detenerlas)
    App.audioStream.getTracks().forEach(t => t.stop());
    App.audioStream = null;
  }

  if (App.recognition) {
    const rec = App.recognition;
    App.recognition = null; // Nullificar antes de stop() para que onend no reinicie
    rec.stop();
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

  // En HTTPS/Chrome el AudioContext puede arrancar suspendido — reactivarlo
  if (App.audioContext.state === 'suspended') {
    App.audioContext.resume().catch(err => console.warn('AudioContext resume fallido:', err));
  }

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
      stopAudioCapture();
    } else if (event.error === 'network') {
      showToast('⚠️ Speech Recognition requiere conexión. Reintentando...', 'info');
      // network error es transitorio — onend lo reiniciará
    } else if (event.error === 'service-not-allowed') {
      showToast('❌ El servicio de voz no está disponible en este navegador/dominio.', 'error');
      stopAudioCapture();
    } else if (event.error === 'no-speech') {
      // No es error real, el navegador detectó silencio — onend reiniciará
    } else {
      console.warn('SpeechRecognition error:', event.error);
    }
  };

  App.recognition.onend = () => {
    // Solo reiniciar si el stream sigue activo y el recognition no fue detenido intencionalmente
    if (App.audioStream && !App.privacyMode && App.recognition) {
      try {
        App.recognition.start();
      } catch (e) {
        // Ignorar errores de inicio (e.g. ya está iniciado)
      }
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
