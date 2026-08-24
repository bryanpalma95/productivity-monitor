/* ============================================================
   Productivity Monitor 2.0 - Reports Module
   Reportes, exportación y análisis con IA
   ============================================================ */

// ===== Reportes =====
function loadReports() {
  const sessions = Storage.getSessions();
  const container = document.getElementById('reports-content');

  if (sessions.length === 0) {
    container.innerHTML = '<p class="empty-state">No hay datos para generar reportes. Inicia sesiones primero.</p>';
    return;
  }

  // Resumen general
  let totalMs = 0;
  let totalTranscripts = 0;
  let totalScreenshots = 0;
  const typeCounts = {};

  sessions.forEach(s => {
    if (s.duration) totalMs += s.duration;
    if (s.transcripts) totalTranscripts += s.transcripts.length;
    if (s.screenshots) totalScreenshots += s.screenshots.length;
    const type = s.type || 'work';
    typeCounts[type] = (typeCounts[type] || 0) + (s.duration || 0);
  });

  const typeLabels = {
    work: 'Trabajo',
    meeting: 'Reunión',
    individual: 'Individual',
    study: 'Estudio'
  };

  const typeColors = {
    work: '#40c4ff',
    meeting: '#b388ff',
    individual: '#69f0ae',
    study: '#ffb74d'
  };

  const total = Object.values(typeCounts).reduce((a, b) => a + b, 0);

  let gradient = '';
  let cumulative = 0;
  const entries = Object.entries(typeCounts);
  entries.forEach(([type, ms], i) => {
    const pct = (ms / total) * 100;
    const start = cumulative;
    cumulative += pct;
    const color = typeColors[type] || '#888';
    gradient += `${color} ${start}% ${cumulative}%${i < entries.length - 1 ? ',' : ''}`;
  });

  container.innerHTML = `
    <div class="report-summary">
      <div class="report-stats">
        <div class="stat-card">
          <div class="stat-icon"><i class="fas fa-clock"></i></div>
          <div class="stat-value">${formatDuration(totalMs)}</div>
          <div class="stat-label">Tiempo total</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon"><i class="fas fa-list"></i></div>
          <div class="stat-value">${sessions.length}</div>
          <div class="stat-label">Sesiones</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon"><i class="fas fa-comment-dots"></i></div>
          <div class="stat-value">${totalTranscripts}</div>
          <div class="stat-label">Transcripciones</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon"><i class="fas fa-camera"></i></div>
          <div class="stat-value">${totalScreenshots}</div>
          <div class="stat-label">Capturas</div>
        </div>
      </div>

      <div class="report-charts">
        <div class="chart-card">
          <h3><i class="fas fa-chart-pie"></i> Distribución por tipo</h3>
          <div class="pie-chart">
            <div class="pie" style="background: conic-gradient(${gradient})">
              <div class="pie-center">${Math.round(total / 3600000)}h</div>
            </div>
            <div class="pie-legend">
              ${entries.map(([type, ms]) => `
                <div class="pie-legend-item">
                  <span class="color-dot" style="background:${typeColors[type] || '#888'}"></span>
                  <span class="legend-label">${typeLabels[type] || type}</span>
                  <span class="legend-value">${(ms / 3600000).toFixed(1)}h (${Math.round((ms / total) * 100)}%)</span>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      </div>

      <div class="report-actions">
        <button class="btn btn-primary" onclick="generateFullReport()">
          <i class="fas fa-file-pdf"></i> Exportar Reporte PDF
        </button>
        <button class="btn btn-secondary" onclick="exportAllData()">
          <i class="fas fa-file-excel"></i> Exportar Excel
        </button>
        <button class="btn btn-secondary" onclick="exportJSON()">
          <i class="fas fa-file-code"></i> Exportar JSON
        </button>
      </div>
    </div>
  `;
}

// ===== Exportación PDF =====
function exportReportPDF(sessionId) {
  const session = sessionId ? Storage.getSession(sessionId) : null;
  const sessions = session ? [session] : Storage.getSessions();

  if (sessions.length === 0) {
    showToast('⚠️ No hay datos para exportar', 'error');
    return;
  }

  let totalMs = 0;
  let totalTranscripts = 0;
  let totalScreenshots = 0;

  sessions.forEach(s => {
    if (s.duration) totalMs += s.duration;
    if (s.transcripts) totalTranscripts += s.transcripts.length;
    if (s.screenshots) totalScreenshots += s.screenshots.length;
  });

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Reporte de Productividad</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 30px; color: #333; }
        h1 { color: #1a73e8; border-bottom: 2px solid #1a73e8; padding-bottom: 10px; }
        h2 { color: #1a73e8; margin-top: 30px; }
        .stats { display: flex; gap: 20px; flex-wrap: wrap; margin: 20px 0; }
        .stat { background: #f5f5f5; padding: 15px; border-radius: 8px; flex: 1; min-width: 150px; }
        .stat .value { font-size: 24px; font-weight: bold; color: #1a73e8; }
        .stat .label { font-size: 12px; color: #666; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background: #1a73e8; color: white; }
        .footer { margin-top: 40px; font-size: 12px; color: #999; text-align: center; }
        .session { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 8px; }
        .session h3 { margin: 0 0 10px 0; color: #1a73e8; }
        .transcript { margin: 5px 0; padding: 5px; background: #f9f9f9; border-radius: 4px; }
        .screenshot-grid-pdf { display: flex; flex-wrap: wrap; gap: 10px; margin: 10px 0; }
        .screenshot-pdf { flex: 0 0 calc(33% - 10px); page-break-inside: avoid; }
        .screenshot-pdf img { width: 100%; border: 1px solid #ddd; border-radius: 4px; }
        .screenshot-time-pdf { font-size: 10px; color: #666; text-align: center; margin-top: 3px; }
      </style>
    </head>
    <body>
      <h1>📊 Reporte de Productividad</h1>
      <p>Generado: ${formatDateTime(Date.now())}</p>

      <div class="stats">
        <div class="stat"><div class="value">${formatDuration(totalMs)}</div><div class="label">Tiempo total</div></div>
        <div class="stat"><div class="value">${sessions.length}</div><div class="label">Sesiones</div></div>
        <div class="stat"><div class="value">${totalTranscripts}</div><div class="label">Transcripciones</div></div>
        <div class="stat"><div class="value">${totalScreenshots}</div><div class="label">Capturas</div></div>
      </div>

      <h2>Sesiones</h2>
      <table>
        <tr><th>Título</th><th>Tipo</th><th>Inicio</th><th>Duración</th><th>Transcripciones</th><th>Capturas</th></tr>
        ${sessions.map(s => `
          <tr>
            <td>${s.title}</td>
            <td>${getTypeLabel(s.type)}</td>
            <td>${formatDateTime(s.startedAt)}</td>
            <td>${formatDuration(s.duration || 0)}</td>
            <td>${s.transcripts ? s.transcripts.length : 0}</td>
            <td>${s.screenshots ? s.screenshots.length : 0}</td>
          </tr>
        `).join('')}
      </table>

      ${sessions.map(s => `
        <div class="session">
          <h3>${s.title}</h3>
          <p><strong>Tipo:</strong> ${getTypeLabel(s.type)} | <strong>Inicio:</strong> ${formatDateTime(s.startedAt)} | <strong>Duración:</strong> ${formatDuration(s.duration || 0)}</p>
          ${s.transcripts && s.transcripts.length > 0 ? `
            <h4>Transcripciones:</h4>
            ${s.transcripts.map(t => `<div class="transcript">[${formatTime(t.timestamp)}] ${t.text}</div>`).join('')}
          ` : ''}
          ${s.screenshots && s.screenshots.length > 0 ? `
            <h4>Capturas (${s.screenshots.length}):</h4>
            <div class="screenshot-grid-pdf">
              ${s.screenshots.map(sc => `
                <div class="screenshot-pdf">
                  <img src="${sc.dataUrl}" alt="Captura">
                  <div class="screenshot-time-pdf">${formatDateTime(sc.timestamp)}</div>
                </div>
              `).join('')}
            </div>
          ` : ''}
        </div>
      `).join('')}

      <div class="footer">Generado por Productivity Monitor</div>
    </body>
    </html>
  `;

  const win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();
  win.focus();
  win.print();
}

function generateFullReport() {
  exportReportPDF(null);
}

// ===== Generar reporte de la sesión activa =====
function generateReport() {
  if (!App.currentSession) {
    showToast('⚠️ No hay una sesión activa para generar reporte', 'error');
    return;
  }
  exportReportPDF(App.currentSession.id);
}


// ===== Exportación Excel =====
function exportReportExcel(sessionId) {
  // Redirige a exportación Markdown
  exportReportMarkdown(sessionId);
}

function exportReportMarkdown(sessionId) {
  const session = sessionId ? Storage.getSession(sessionId) : null;
  const sessions = session ? [session] : Storage.getSessions();

  if (sessions.length === 0) {
    showToast('⚠️ No hay datos para exportar', 'error');
    return;
  }

  let md = `# Reporte de Productividad\n\nGenerado: ${formatDateTime(Date.now())}\n\n---\n\n`;

  sessions.forEach(s => {
    const transcripts = s.transcripts || [];
    const screenshots = s.screenshots || [];

    md += `## ${s.title}\n\n`;
    md += `| Campo | Valor |\n|-------|-------|\n`;
    md += `| Tipo | ${getTypeLabel(s.type)} |\n`;
    md += `| Inicio | ${formatDateTime(s.startedAt)} |\n`;
    md += `| Fin | ${s.endedAt ? formatDateTime(s.endedAt) : 'Activa'} |\n`;
    md += `| Duración | ${formatDuration(s.duration || 0)} |\n`;
    md += `| Transcripciones | ${transcripts.length} |\n`;
    md += `| Capturas | ${screenshots.length} |\n`;
    md += `| Estado | ${s.status === 'active' ? 'Activa' : 'Terminada'} |\n\n`;

    if (transcripts.length > 0) {
      md += `### Transcripción\n\n`;
      transcripts.forEach(t => {
        md += `- **[${formatTime(t.timestamp)}]** ${t.text}\n`;
      });
      md += `\n`;
    }

    if (s.aiSummary) {
      md += `### Resumen IA (guardado)\n\n${s.aiSummary}\n\n`;
    }

    md += `---\n\n`;
  });

  md += `*Exportado desde Productivity Monitor 2.0*\n`;

  const title = session
    ? (session.title || 'sesion').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)
    : 'todas-las-sesiones';

  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${title}.md`;
  a.click();
  URL.revokeObjectURL(url);

  showToast('📝 Reporte Markdown exportado');
}

function exportAllData() {
  exportReportMarkdown(null);
}

// ===== Exportación JSON =====
function exportJSON() {
  const data = Storage.load();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `productivity-monitor-backup-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('💾 Backup JSON exportado');
}

// ===== Resumen IA =====
const AI_CHUNK_SIZE = 8000;
const AI_MAX_CHUNKS = 20;

// Función central de llamada a IA — usa la config del proveedor seleccionado por el usuario.
// Compatible con OpenAI, OpenRouter, Groq, Mistral (formato OpenAI) y Anthropic (formato propio).
async function callAI(messages) {
  const config = Storage.getAIProviderConfig();
  const providerDef = Storage.AI_PROVIDERS[config.provider] || Storage.AI_PROVIDERS.openrouter;
  const apiKey = config.apiKey;
  const model = config.model || providerDef.defaultModel;
  const url = config.provider === 'custom' ? config.customUrl : providerDef.url;

  if (!apiKey) throw new Error('No hay API key configurada. Ve a Mis Datos → Resumen IA — Proveedor y agrega tu key.');
  if (!url) throw new Error('URL del proveedor no configurada.');

  const headers = providerDef.headers(apiKey);

  let body, parseResponse;

  if (providerDef.format === 'anthropic') {
    // Anthropic tiene formato diferente: system va separado, no en messages
    const systemMsg = messages.find(m => m.role === 'system');
    const userMsgs = messages.filter(m => m.role !== 'system');

    body = JSON.stringify({
      model,
      max_tokens: 8192,
      ...(systemMsg ? { system: systemMsg.content } : {}),
      messages: userMsgs
    });

    parseResponse = (data) => {
      if (data.content && data.content[0]) return data.content[0].text;
      return 'No se pudo generar el resumen.';
    };
  } else {
    // Formato OpenAI-compatible (OpenRouter, OpenAI, Groq, Mistral, Custom)
    body = JSON.stringify({
      model,
      messages,
      temperature: 0.3,
      max_tokens: 8192
    });

    parseResponse = (data) => {
      return data.choices?.[0]?.message?.content || 'No se pudo generar el resumen.';
    };
  }

  const res = await fetch(url, { method: 'POST', headers, body });

  if (res.status === 401) throw new Error('API key inválida. Verifica en Mis Datos → Proveedor IA.');
  if (res.status === 404) throw new Error('Modelo no disponible. Verifica el modelo seleccionado en Mis Datos.');
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Error ${config.provider}: ${res.status} — ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  return parseResponse(data);
}

// Alias para retrocompatibilidad (funciones que aún llaman callGroqChat)
function callGroqChat(messages) { return callAI(messages); }

// Elimina entradas de ruido antes de enviar a la IA:
//   - Textos muy cortos sin contenido real (< 3 chars)
//   - Palabras de relleno conocidas ("Gracias.", "Ok.", etc.) que el micrófono
//     capta del fondo y no aportan información
//   - Repeticiones consecutivas exactas del mismo texto
// Conserva SIEMPRE las entradas del sistema [🔊] sin filtrar.
function cleanTranscriptsForAI(transcripts) {
  const NOISE_PATTERNS = [
    /^gracias\.?$/i,
    /^ok\.?$/i,
    /^sí\.?$/i,
    /^no\.?$/i,
    /^\.{1,3}$/,
    /^¿?qué\??\.?$/i,
    /^claro\.?$/i,
    /^perfecto\.?$/i,
    /^entendido\.?$/i,
    /^de acuerdo\.?$/i,
  ];

  let lastText = null;
  return transcripts.filter(t => {
    const text = (t.text || '').trim();

    // Descartar vacíos o demasiado cortos
    if (text.length < 3) return false;

    // Las entradas del sistema [🔊] siempre pasan sin filtro
    if (text.startsWith('[🔊]')) {
      lastText = text;
      return true;
    }

    // Descartar ruido de fondo conocido
    if (NOISE_PATTERNS.some(p => p.test(text))) return false;

    // Descartar repetición consecutiva exacta
    if (text === lastText) return false;

    lastText = text;
    return true;
  });
}

// Función para dividir la transcripción en fragmentos
function splitTranscriptIntoChunks(transcripts, chunkSize) {
  const chunks = [];
  let current = [];

  transcripts.forEach(t => {
    const line = `[${formatTime(t.timestamp)}] ${t.text}`;
    const currentLength = current.join('\n').length;
    if (currentLength + line.length > chunkSize && current.length > 0) {
      chunks.push(current.join('\n'));
      current = [line];
    } else {
      current.push(line);
    }
  });

  if (current.length > 0) chunks.push(current.join('\n'));
  return chunks;
}

async function generateAISummary(sessionId, forceRegenerate = false) {
  const session = Storage.getSession(sessionId);
  if (!session) return;

  // Obtener contexto del proyecto si está configurado
  const projectContext = (typeof Storage.getProjectContext === 'function')
    ? Storage.getProjectContext()
    : localStorage.getItem('project_context') || '';

  const contextBlock = projectContext
    ? `\n\nCONTEXTO DEL PROYECTO ACTIVO (úsalo para interpretar términos técnicos, nombres y corregir errores fonéticos de la transcripción):\n${projectContext}`
    : '';

  const modal = document.getElementById('reportModal');
  const title = document.getElementById('modalTitle');
  const body = document.getElementById('modalBody');

  // Asegurar que el modal esté visible (puede llamarse desde fuera del modal en móvil)
  modal.style.display = 'flex';
  title.textContent = 'Resumen IA';

  // Si ya hay un resumen guardado y no se fuerza regenerar, mostrarlo directamente
  if (!forceRegenerate && session.aiSummary) {
    window._lastAISummary = { text: session.aiSummary, sessionId };
    renderAISummaryResult(body, session.id, session.aiSummary, true);
    return;
  }

  body.innerHTML = `
    <div class="ai-summary">
      <div class="ai-loading">
        <i class="fas fa-spinner fa-spin"></i>
        <p>Generando resumen con IA...</p>
      </div>
    </div>
  `;

  const transcripts = session.transcripts || [];
  const screenshots = session.screenshots || [];
  const sessionDate = session.startedAt ? formatDateTime(session.startedAt) : 'Desconocida';

  // Limpiar ruido antes de chunking — filtra "Gracias." ×50, repeticiones, etc.
  const cleanedTranscripts = cleanTranscriptsForAI(transcripts);

  // Dividir la transcripción limpia en fragmentos
  const chunks = splitTranscriptIntoChunks(cleanedTranscripts, AI_CHUNK_SIZE);
  const chunksToProcess = chunks.slice(0, AI_MAX_CHUNKS);
  const totalChunks = chunks.length;
  const isTruncated = totalChunks > AI_MAX_CHUNKS;

  try {
    // Si hay 1 solo fragmento, generar el resumen directamente
    if (chunksToProcess.length <= 1) {
      const transcriptText = chunksToProcess[0] || '';

      const summary = await callGroqChat([
        {
          role: 'system',
          content: `Eres un asistente experto en síntesis ejecutiva de reuniones de trabajo. Analizas transcripciones automáticas y generas resúmenes concisos, priorizados y accionables.

CONTEXTO DE LA TRANSCRIPCIÓN:
- Líneas con [🔊] = audio del SISTEMA (otros participantes en la reunión)
- Líneas SIN prefijo = audio del MICRÓFONO (siempre es Bryan, quien graba)
- Timestamps [HH:MM] indican cuándo se dijo cada frase
- Puede contener errores fonéticos de speech-to-text

Genera un RESUMEN EJECUTIVO en español con el siguiente formato Markdown. Prioriza la síntesis sobre la exhaustividad — cada punto debe aportar valor.

# [Título descriptivo de la sesión]

## 📌 Resumen Ejecutivo
(2-3 oraciones. QUÉ se discutió, QUÉ se decidió, QUÉ queda pendiente. Directo al grano.)

## 📊 Métricas de la Sesión
| | |
|---|---|
| 📅 Fecha | FECHA_REAL |
| ⏱ Duración | DURACION_REAL |
| 👥 Participantes | (solo quienes hablan directamente) |
| ✅ Estado | Terminada |

## 🔑 Puntos Clave
(Los N puntos más importantes de la sesión. Cada uno con una etiqueta de contexto entre los siguientes tipos: Decisión / Acción inmediata / Información / Riesgo / Pendiente. Máximo 8 puntos.)

- **[Título corto del punto]** \`[Etiqueta]\`
  Descripción concisa de qué se dijo o decidió sobre este punto. 1-2 oraciones máximo.

## 📋 Pendientes y Próximos Pasos
(Numerados. Cada uno con contexto suficiente para actuar sin releer la transcripción.)

- **P1** — [Descripción del pendiente con contexto] — Responsable: [nombre o "Sin asignar"]
- **P2** — [Descripción]

## ⚠️ Riesgos o Bloqueos
(Solo si hay. Si no hay ninguno, omite esta sección completamente.)
- [Riesgo o bloqueo identificado]

---
*Productivity Monitor 2.0 · Resumen ejecutivo · Sesión FECHA*

REGLAS:
- Sé CONCISO. Menos es más. Cada punto debe caber en 1-2 oraciones.
- Prioriza: lo más importante primero.
- Usa los datos reales (Fecha, Duración, Tipo) en la tabla.
- Nunca inventes información que no esté en la transcripción.
- Si un punto no tiene información, omítelo (no pongas "Sin información").
- PARTICIPANTES: solo quienes hablan (su voz está en la transcripción).
- ERRORES FONÉTICOS: corrige por contexto si es evidente. Si no puedes, déjalo.
- HABLANTES: líneas sin [🔊] = Bryan. Líneas con [🔊] = otros — infiere por contexto.
- NO generes secciones vacías. Si no hay riesgos, omite esa sección.
- El título del informe debe ser descriptivo del contenido, no genérico.${contextBlock}`
        },
        {
          role: 'user',
          content: `Sesión: ${session.title}
Tipo: ${getTypeLabel(session.type)}
Fecha: ${sessionDate}
Duración: ${formatDuration(session.duration || 0)}
Capturas de pantalla: ${screenshots.length}
Líneas de transcripción: ${cleanedTranscripts.length} (de ${transcripts.length} totales, ruido filtrado)

Transcripción completa:
${transcriptText || 'Sin transcripciones disponibles'}`
        }
      ]);

      window._lastAISummary = { text: summary, sessionId };
      Storage.updateSession(sessionId, { aiSummary: summary, aiSummaryDate: Date.now() });

      // Detectar si el resumen se cortó (no tiene el footer esperado)
      const isTruncatedSummary = !summary.includes('Generado automáticamente') && !summary.includes('Productivity Monitor');
      if (isTruncatedSummary) {
        const truncNote = '\n\n---\n⚠️ *El resumen puede estar incompleto. El modelo alcanzó su límite de tokens. Prueba con una sesión más corta o regenera.*';
        window._lastAISummary.text = summary + truncNote;
      }

      renderAISummaryResult(body, session.id, window._lastAISummary.text);
      return;
    }

    // Si hay múltiples fragmentos, generar resumen parcial de cada uno
    const partialSummaries = [];
    for (let i = 0; i < chunksToProcess.length; i++) {
      // Actualizar el indicador de progreso
      body.innerHTML = `
        <div class="ai-summary">
          <div class="ai-loading">
            <i class="fas fa-spinner fa-spin"></i>
            <p>Analizando parte ${i + 1} de ${chunksToProcess.length}...</p>
            <div class="ai-progress">
              <div class="ai-progress-bar" style="width:${Math.round(((i) / chunksToProcess.length) * 100)}%"></div>
            </div>
          </div>
        </div>
      `;

      const partial = await callGroqChat([
        {
          role: 'system',
          content: `Eres un analista experto en productividad. Analiza este FRAGMENTO de una sesión de trabajo.

CONTEXTO:
- Líneas con [🔊] = audio del sistema (reunión, videollamada, presentación)
- Líneas sin prefijo = audio del micrófono del usuario
- Puede haber imperfecciones de reconocimiento de voz

Genera un resumen estructurado en español (máximo 400 palabras) con:
1) **Temas principales** — qué se discutió con detalles concretos
2) **Personas mencionadas** — nombres y su contexto
3) **Tareas realizadas** — lo que se mencionó como hecho
4) **Pendientes o compromisos** — tareas prometidas o asignadas con responsable
5) **Problemas identificados** — bloqueos o impedimentos mencionados
6) **Fechas o plazos** — cualquier fecha, deadline o plazo mencionado

Este es el fragmento ${i + 1} de ${chunksToProcess.length} de una sesión más larga. Sé específico y extrae datos concretos.${contextBlock}`
        },
        {
          role: 'user',
          content: `Fragmento ${i + 1} de ${chunksToProcess.length} de la sesión "${session.title}":
${chunksToProcess[i]}`
        }
      ]);

      partialSummaries.push(partial);
    }

    // Actualizar el indicador de progreso
    body.innerHTML = `
      <div class="ai-summary">
        <div class="ai-loading">
          <i class="fas fa-spinner fa-spin"></i>
          <p>Combinando resúmenes parciales...</p>
          <div class="ai-progress">
            <div class="ai-progress-bar" style="width:100%"></div>
          </div>
        </div>
      </div>
    `;

    // Combinar los resúmenes parciales en un resumen final
    const combinedSummaries = partialSummaries.map((s, i) => `--- Parte ${i + 1} ---\n${s}`).join('\n\n');

    const finalSummary = await callGroqChat([
      {
        role: 'system',
        content: `Eres un asistente experto en productividad personal y toma de minutas. Recibes resúmenes parciales de una sesión de trabajo larga, dividida en fragmentos.

Tu tarea es consolidar TODA la información en un informe final cohesivo, sin repeticiones pero sin omitir nada relevante.

Genera el informe en español usando exactamente este formato Markdown:

# 📋 Informe de Sesión

## 📌 Resumen Ejecutivo
(2-3 oraciones que describan QUÉ ocurrió en esta sesión en su totalidad, el contexto y el resultado principal. Sé específico.)

## 🗓️ Datos de la Sesión
| Campo | Valor |
|-------|-------|
| Fecha | FECHA_REAL |
| Duración | DURACION_REAL |
| Tipo | TIPO_REAL |
| Participantes | (SOLO quienes hablan directamente, no los mencionados por otros) |

## 🎯 Temas Tratados
(Consolida todos los temas de todos los fragmentos, sin repetir. Si no hay, escribe "Sin temas identificados".)
- **[Nombre del tema]**: descripción concreta

## ✅ Decisiones y Acuerdos
(Todas las decisiones de todos los fragmentos. Si no hay, escribe "Sin decisiones registradas".)
- [Decisión concreta]

## 📅 Fechas y Plazos Mencionados
(Todas las fechas y plazos de todos los fragmentos. Si no hay, escribe "Sin fechas mencionadas".)
- [Fecha o plazo y su contexto]

## ✔️ Tareas Realizadas
(Todo lo mencionado como completado. Si no hay, escribe "Sin tareas completadas mencionadas".)
- [Tarea completada]

## 📋 Compromisos y Pendientes
(Todos los compromisos de todos los fragmentos con responsable. Si no hay, escribe "Sin compromisos registrados".)
- [ ] [Tarea pendiente] — Responsable: [nombre o "Sin asignar"]

## 💡 Problemas e Impedimentos
(Todos los problemas y bloqueos de todos los fragmentos. Si no hay, escribe "Sin problemas reportados".)
- [Problema y su contexto]

---
*Generado automáticamente · Productivity Monitor 2.0*

REGLAS OBLIGATORIAS:
- Usa los datos reales de la sesión en la tabla (Fecha, Duración, Tipo)
- Consolida sin repetir información, pero no omitas nada importante
- Nunca inventes datos
- Si un apartado no tiene información, usa el texto de fallback indicado${contextBlock}`
        },
        {
          role: 'user',
          content: `Sesión: ${session.title}
Tipo: ${getTypeLabel(session.type)}
Fecha: ${sessionDate}
Duración: ${formatDuration(session.duration || 0)}
${isTruncated ? `⚠️ Nota: sesión con ${totalChunks} partes, se analizaron las primeras ${chunksToProcess.length}.` : ''}

Resúmenes parciales a consolidar:
${combinedSummaries}`
        }
      ]);

      window._lastAISummary = { text: finalSummary, sessionId };
      Storage.updateSession(sessionId, { aiSummary: finalSummary, aiSummaryDate: Date.now() });
      renderAISummaryResult(body, session.id, finalSummary);

  } catch (err) {
    console.error('Error generando resumen IA:', err);
    body.innerHTML = `
      <div class="ai-summary">
        <div class="ai-error">
          <i class="fas fa-exclamation-triangle" style="font-size:3rem;color:var(--warning);margin-bottom:16px"></i>
          <h4>No se pudo generar el resumen</h4>
          <p>${escapeHtml(err.message)}</p>
          <p>Verifica tu conexión a internet o intenta nuevamente.</p>
        </div>
        <div class="edit-actions" style="display:flex;gap:12px;margin-top:16px">
          <button class="btn btn-primary" onclick="generateAISummary('${session.id}')">
            <i class="fas fa-redo"></i> Reintentar
          </button>
          <button class="btn btn-secondary" onclick="closeModal()">
            <i class="fas fa-times"></i> Cerrar
          </button>
        </div>
      </div>
    `;
  }
}

// ===== Informe Detallado =====
async function generateDetailedReport(sessionId) {
  const session = Storage.getSession(sessionId);
  if (!session) return;

  const projectContext = (typeof Storage.getProjectContext === 'function')
    ? Storage.getProjectContext()
    : localStorage.getItem('project_context') || '';

  const contextBlock = projectContext
    ? `\n\nCONTEXTO DEL PROYECTO ACTIVO:\n${projectContext}`
    : '';

  const modal = document.getElementById('reportModal');
  const title = document.getElementById('modalTitle');
  const body = document.getElementById('modalBody');

  modal.style.display = 'flex';
  title.textContent = 'Informe Detallado';

  body.innerHTML = `
    <div class="ai-summary">
      <div class="ai-loading">
        <i class="fas fa-spinner fa-spin"></i>
        <p>Generando informe detallado con IA...</p>
        <p style="font-size:0.8rem;color:var(--muted)">Esto puede tardar más que el resumen ejecutivo</p>
      </div>
    </div>
  `;

  const transcripts = session.transcripts || [];
  const screenshots = session.screenshots || [];
  const sessionDate = session.startedAt ? formatDateTime(session.startedAt) : 'Desconocida';
  const cleanedTranscripts = cleanTranscriptsForAI(transcripts);
  const chunks = splitTranscriptIntoChunks(cleanedTranscripts, AI_CHUNK_SIZE);
  const chunksToProcess = chunks.slice(0, AI_MAX_CHUNKS);
  const totalChunks = chunks.length;
  const isTruncated = totalChunks > AI_MAX_CHUNKS;

  try {
    let transcriptText;
    if (chunksToProcess.length <= 1) {
      transcriptText = chunksToProcess[0] || '';
    } else {
      const partials = [];
      for (let i = 0; i < chunksToProcess.length; i++) {
        body.querySelector('.ai-loading p').textContent = `Analizando parte ${i + 1} de ${chunksToProcess.length}...`;
        const partial = await callGroqChat([
          { role: 'system', content: `Extrae TODA la información de este fragmento de reunión sin omitir nada. Lista: temas discutidos con detalle completo, nombres, campos técnicos mencionados, decisiones, reglas de negocio, escenarios, dependencias y pendientes. Sé exhaustivo (máximo 600 palabras). Fragmento ${i + 1} de ${chunksToProcess.length}.${contextBlock}` },
          { role: 'user', content: chunksToProcess[i] }
        ]);
        partials.push(partial);
      }
      transcriptText = partials.map((p, i) => `--- Parte ${i + 1} ---\n${p}`).join('\n\n');
    }

    body.querySelector('.ai-loading p').textContent = 'Generando informe final...';

    const report = await callGroqChat([
      {
        role: 'system',
        content: `Eres un analista técnico experto. Generas informes DETALLADOS y EXHAUSTIVOS de reuniones de trabajo. Tu objetivo es documentar TODO lo discutido de forma que alguien que no asistió pueda entender completamente qué pasó.

CONTEXTO DE LA TRANSCRIPCIÓN:
- Líneas con [🔊] = audio del SISTEMA (otros participantes)
- Líneas SIN prefijo = audio del MICRÓFONO (Bryan, quien graba)
- Puede contener errores fonéticos de speech-to-text

Genera un INFORME DETALLADO en español con el siguiente formato Markdown. Sé EXHAUSTIVO — documenta todo.

# [Título descriptivo de la sesión]

## 📌 Contexto y Apertura
(Descripción del inicio de la sesión, participantes, contexto previo relevante mencionado. 2-4 oraciones.)

## 📊 Datos de la Sesión
| | |
|---|---|
| 📅 Fecha | FECHA_REAL |
| ⏱ Horario | HH:MM – HH:MM hrs |
| ⌛ Duración | DURACION_REAL |
| 📝 Transcripciones | N |
| 👥 Participantes | (solo quienes hablan) |
| ✅ Estado | Terminada |

## 📑 Temas Revisados en Detalle
(Para CADA tema discutido, crea una subsección con:)

### [Nombre del tema o HU]
**Objetivo:** Qué se busca lograr con este tema.
**Detalle:** Descripción completa de lo discutido — incluye campos, reglas, flujos, sistemas involucrados.
**Criterios/Escenarios:** Si se mencionaron escenarios de validación o criterios de aceptación, listarlos.
**Decisiones:** Qué se decidió sobre este tema.
**Notas:** Cualquier observación adicional relevante.

(Repite para cada tema principal.)

## 🔄 Flujos de Integración Identificados
(Si se discutieron integraciones entre sistemas, listarlas en formato tabla:)
| Origen | → | Destino | Frecuencia | Detalle |
|--------|---|---------|------------|---------|

## 📋 Pendientes y Próximos Pasos
(Numerados con contexto completo para actuar sin releer la transcripción.)
1. **[Pendiente]** — Contexto y detalle — Responsable: [nombre]

## ⚠️ Riesgos, Bloqueos o Puntos de Atención
(Si hay. Si no hay, omite la sección.)

---
*Productivity Monitor 2.0 · Informe detallado · Sesión FECHA*

REGLAS:
- Sé EXHAUSTIVO — documenta todo lo que se discutió, no resumas.
- Incluye campos técnicos, nombres de sistemas, reglas de negocio si se mencionaron.
- Usa los datos reales (Fecha, Duración) en la tabla.
- Nunca inventes información.
- PARTICIPANTES: solo quienes hablan directamente.
- ERRORES FONÉTICOS: corrige por contexto si es evidente.
- HABLANTES: sin [🔊] = Bryan. Con [🔊] = otros.
- Si se discutieron múltiples temas/HUs, cada uno merece su propia subsección completa.
- NO omitas detalles técnicos (campos, valores, reglas).${contextBlock}`
      },
      {
        role: 'user',
        content: `Sesión: ${session.title}
Tipo: ${getTypeLabel(session.type)}
Fecha: ${sessionDate}
Duración: ${formatDuration(session.duration || 0)}
Capturas: ${screenshots.length}
Transcripciones: ${cleanedTranscripts.length} (de ${transcripts.length} totales)
${isTruncated ? `⚠️ Sesión con ${totalChunks} partes, se analizaron ${chunksToProcess.length}.` : ''}

${chunksToProcess.length <= 1 ? 'Transcripción completa:' : 'Contenido extraído de la sesión:'}
${transcriptText || 'Sin transcripciones disponibles'}`
      }
    ]);

    window._lastAISummary = { text: report, sessionId };
    renderAISummaryResult(body, session.id, report);

  } catch (err) {
    console.error('Error generando informe detallado:', err);
    body.innerHTML = `
      <div class="ai-summary">
        <div class="ai-error">
          <i class="fas fa-exclamation-triangle" style="font-size:3rem;color:var(--warning);margin-bottom:16px"></i>
          <h4>No se pudo generar el informe</h4>
          <p>${escapeHtml(err.message)}</p>
        </div>
        <div style="display:flex;gap:12px;margin-top:16px;justify-content:center">
          <button class="btn btn-primary" onclick="generateDetailedReport('${sessionId}')">
            <i class="fas fa-redo"></i> Reintentar
          </button>
          <button class="btn btn-secondary" onclick="closeModal()">Cerrar</button>
        </div>
      </div>
    `;
  }
}

// Convierte Markdown básico a HTML para renderizar el resumen
function renderMarkdown(text) {
  return text
    // Escapar HTML primero para seguridad
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    // Encabezados
    .replace(/^# (.+)$/gm, '<h2 class="ai-h1">$1</h2>')
    .replace(/^## (.+)$/gm, '<h3 class="ai-h2">$1</h3>')
    .replace(/^### (.+)$/gm, '<h4 class="ai-h3">$1</h4>')
    // Tablas Markdown simples: | col | col |
    .replace(/^\|(.+)\|$/gm, (match) => {
      const cols = match.split('|').slice(1, -1);
      const isSeparator = cols.every(c => /^[\s\-:]+$/.test(c));
      if (isSeparator) return '<tr class="ai-table-sep"></tr>';
      const tag = 'td';
      return '<tr>' + cols.map(c => `<${tag} class="ai-td">${c.trim()}</${tag}>`).join('') + '</tr>';
    })
    // Envolver filas de tabla en <table>
    .replace(/(<tr>[\s\S]*?<\/tr>(\n<tr class="ai-table-sep"><\/tr>)?(\n<tr>[\s\S]*?<\/tr>)*)/g, (match) => {
      const rows = match.replace(/<tr class="ai-table-sep"><\/tr>\n?/g, '');
      return `<table class="ai-table">${rows}</table>`;
    })
    // Checkboxes
    .replace(/^- \[ \] (.+)$/gm, '<li class="ai-check ai-unchecked"><span class="ai-checkbox">☐</span> $1</li>')
    .replace(/^- \[x\] (.+)$/gmi, '<li class="ai-check ai-checked"><span class="ai-checkbox">☑</span> $1</li>')
    // Listas
    .replace(/^- \*\*(.+?)\*\*: (.+)$/gm, '<li><strong>$1</strong>: $2</li>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    // Envolver <li> consecutivos en <ul>
    .replace(/(<li[\s\S]*?<\/li>(\n<li[\s\S]*?<\/li>)*)/g, '<ul class="ai-list">$1</ul>')
    // Bold e italic
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Separador horizontal
    .replace(/^---$/gm, '<hr class="ai-hr">')
    // Cursiva para líneas que empiezan con *
    .replace(/^\*(.+)\*$/gm, '<p class="ai-footnote"><em>$1</em></p>')
    // Párrafos: líneas que no son tags HTML
    .replace(/^(?!<[a-z]).+$/gm, (line) => line.trim() ? `<p>${line}</p>` : '')
    // Limpiar líneas vacías múltiples
    .replace(/\n{3,}/g, '\n\n');
}

// Función para renderizar el resultado del resumen IA
function renderAISummaryResult(body, sessionId, summary, fromCache = false) {
  const session = Storage.getSession(sessionId);
  const summaryDate = session?.aiSummaryDate ? formatDateTime(session.aiSummaryDate) : '';
  const cacheNote = fromCache && summaryDate
    ? `<span class="ai-cache-badge" title="Resumen guardado — generado el ${summaryDate}"><i class="fas fa-bolt"></i> Guardado · ${summaryDate}</span>`
    : '';

  body.innerHTML = `
    <div class="ai-summary">
      <div class="ai-result">
        <h4><i class="fas fa-robot"></i> Resumen generado</h4>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:14px">
          <div class="ai-model-badge" title="Proveedor IA configurado en Mis Datos">
            <i class="fas fa-microchip"></i> ${Storage.getAIProviderConfig().provider} / ${Storage.getAIProviderConfig().model?.split('/').pop() || 'auto'}
          </div>
          ${cacheNote}
        </div>
        <div class="ai-text">${renderMarkdown(summary)}</div>
      </div>
      <div class="edit-actions" style="display:flex;gap:12px;margin-top:16px;flex-wrap:wrap">
        <button class="btn btn-secondary" onclick="copyAISummary()">
          <i class="fas fa-copy"></i> Copiar
        </button>
        <button class="btn btn-secondary" onclick="downloadAISummary('${sessionId}')">
          <i class="fas fa-download"></i> Descargar
        </button>
        <button class="btn btn-primary" onclick="generateAISummary('${sessionId}', true)">
          <i class="fas fa-redo"></i> Regenerar
        </button>
        <button class="btn btn-secondary" onclick="closeModal()">
          <i class="fas fa-times"></i> Cerrar
        </button>
      </div>
    </div>
  `;
}

// ===== Copiar resumen IA al portapapeles =====
function copyAISummary() {
  const entry = window._lastAISummary;
  const summary = entry?.text || entry; // compatibilidad con formato viejo
  if (!summary) {
    showToast('⚠️ No hay resumen para copiar', 'error');
    return;
  }
  navigator.clipboard.writeText(summary).then(() => {
    showToast('📋 Resumen copiado al portapapeles');
  }).catch(() => {
    showToast('❌ No se pudo copiar', 'error');
  });
}

// ===== Descargar resumen IA como archivo de texto =====
function downloadAISummary(sessionId) {
  const entry = window._lastAISummary;
  const summary = entry?.text || entry; // compatibilidad con formato viejo
  if (!summary) {
    showToast('⚠️ No hay resumen para descargar', 'error');
    return;
  }
  const session = Storage.getSession(sessionId);
  const filename = `${(session?.title || 'sesion').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}-resumen.md`;
  const blob = new Blob([summary], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  showToast('💾 Resumen descargado');
}
