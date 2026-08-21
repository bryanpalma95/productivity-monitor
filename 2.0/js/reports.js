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
  const session = sessionId ? Storage.getSession(sessionId) : null;
  const sessions = session ? [session] : Storage.getSessions();

  if (sessions.length === 0) {
    showToast('⚠️ No hay datos para exportar', 'error');
    return;
  }

  // CSV con separador de punto y coma (compatible con Excel en español)
  const rows = [
    ['Título', 'Tipo', 'Inicio', 'Fin', 'Duración (min)', 'Transcripciones', 'Capturas', 'Estado']
  ];

  sessions.forEach(s => {
    rows.push([
      s.title,
      getTypeLabel(s.type),
      formatDateTime(s.startedAt),
      s.endedAt ? formatDateTime(s.endedAt) : 'Activa',
      Math.round((s.duration || 0) / 60000),
      s.transcripts ? s.transcripts.length : 0,
      s.screenshots ? s.screenshots.length : 0,
      s.status === 'active' ? 'Activa' : 'Terminada'
    ]);
  });

  // Agregar transcripciones
  rows.push([]);
  rows.push(['=== TRANSCRIPCIONES ===']);
  rows.push(['Sesión', 'Hora', 'Texto']);

  sessions.forEach(s => {
    (s.transcripts || []).forEach(t => {
      rows.push([s.title, formatTime(t.timestamp), t.text]);
    });
  });

  const csv = rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(';')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `reporte-productividad-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);

  showToast('📊 Reporte Excel exportado');
}

function exportAllData() {
  exportReportExcel(null);
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
const AI_CHUNK_SIZE = 8000;  // aumentado — OpenRouter soporta contextos grandes
const AI_MAX_CHUNKS = 20;

// Proveedor IA: OpenRouter — un endpoint estable con 20+ modelos gratuitos
// Usamos un modelo específico con contexto largo (128K) en vez de 'auto'
// para evitar que rutee a modelos con contexto corto que cortan el resumen.
const AI_PROVIDER = 'openrouter';
const AI_MODEL = 'nvidia/nemotron-3-super-120b-a12b:free';
const AI_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const AI_MODEL_UPDATED = '2026-08-20';

// Llama a OpenRouter para generar texto
// Requiere una API key de OpenRouter (gratuita, sin tarjeta): https://openrouter.ai/keys
async function callGroqChat(messages) {
  const apiKey = (typeof getOpenRouterApiKey === 'function') ? getOpenRouterApiKey()
    : localStorage.getItem('openrouter_api_key') || '';

  if (!apiKey) throw new Error('No hay API key de OpenRouter configurada. Ve a Mis Datos → Resumen IA y agrega tu key (gratis en openrouter.ai/keys).');

  const res = await fetch(AI_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': window.location.origin,
      'X-Title': 'Productivity Monitor'
    },
    body: JSON.stringify({
      model: AI_MODEL,
      messages,
      temperature: 0.3,
      max_tokens: 8192
    })
  });

  if (res.status === 401) throw new Error('API key inválida. Verifica en Mis Datos (openrouter.ai/keys).');
  if (!res.ok) {
    const err = await res.text();
    throw new Error('Error OpenRouter: ' + res.status + ' — ' + err.slice(0, 200));
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || 'No se pudo generar el resumen.';
}

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
          content: `Eres un asistente experto en productividad personal y toma de minutas. Analizas transcripciones automáticas de sesiones de trabajo grabadas con un monitor de productividad.

CONTEXTO IMPORTANTE sobre la transcripción:
- Las líneas con prefijo [🔊] son audio del SISTEMA (lo que escuchan los demás: reuniones, videollamadas, presentaciones)
- Las líneas SIN prefijo son audio del MICRÓFONO (lo que dice el usuario que graba)
- Los timestamps [HH:MM] indican el momento en que se dijo cada frase
- La transcripción puede tener imperfecciones de reconocimiento de voz

Genera un informe COMPLETO en español usando exactamente este formato Markdown. Extrae TODA la información concreta: nombres de personas, proyectos, fechas, números, decisiones, problemas y compromisos mencionados.

# 📋 Informe de Sesión

## 📌 Resumen Ejecutivo
(2-3 oraciones que describan QUÉ ocurrió en esta sesión, el contexto y el resultado principal. Sé específico, no genérico.)

## 🗓️ Datos de la Sesión
| Campo | Valor |
|-------|-------|
| Fecha | FECHA_REAL |
| Duración | DURACION_REAL |
| Tipo | TIPO_REAL |
| Participantes | (lista SOLO los nombres de quienes HABLAN directamente en la reunión, no los que son mencionados por otros) |

## 🎯 Temas Tratados
(Lista cada tema con una descripción concreta de qué se discutió. Si no hay temas identificables, escribe "Sin temas identificados".)
- **[Nombre del tema]**: qué se dijo específicamente sobre este tema

## ✅ Decisiones y Acuerdos
(Decisiones concretas tomadas. Si no hay ninguna, escribe "Sin decisiones registradas".)
- [Decisión concreta]

## 📅 Fechas y Plazos Mencionados
(Extrae TODAS las fechas, deadlines o plazos. Si no hay, escribe "Sin fechas mencionadas".)
- [Fecha o plazo concreto y su contexto]

## ✔️ Tareas Realizadas
(Lo que se mencionó como ya hecho o completado. Si no hay, escribe "Sin tareas completadas mencionadas".)
- [Tarea completada]

## 📋 Compromisos y Pendientes
(Tareas prometidas, asignadas o pendientes. Incluye responsable si se mencionó. Si no hay, escribe "Sin compromisos registrados".)
- [ ] [Tarea pendiente] — Responsable: [nombre o "Sin asignar"]

## 💡 Problemas e Impedimentos
(Bloqueos, errores, problemas técnicos o de proceso mencionados. Si no hay, escribe "Sin problemas reportados".)
- [Problema identificado y su contexto]

---
*Generado automáticamente · Productivity Monitor 2.0*

REGLAS OBLIGATORIAS:
- Usa los datos reales de la sesión en la tabla (Fecha, Duración, Tipo) — no dejes los valores como texto entre paréntesis
- Extrae nombres propios, proyectos, sistemas y datos concretos que aparezcan en la transcripción
- Nunca inventes información que no esté en la transcripción
- Si un apartado no tiene información real, usa el texto de fallback indicado (no lo omitas)
- Distingue entre lo que dice el usuario [micrófono] y lo que escucha [🔊 sistema]
- PARTICIPANTES: lista solo a quienes hablan directamente (su voz aparece en la transcripción). Las personas mencionadas por otros van en la sección de Temas o Compromisos, no en Participantes.
- ERRORES FONÉTICOS: la transcripción viene de speech-to-text y puede contener errores. Si una palabra no tiene sentido en el contexto pero fonéticamente se parece a un término técnico conocido, usa el término correcto. Si no puedes inferirlo, déjalo como está sin inventar.
- IDENTIFICACIÓN DE HABLANTES: cuando puedas inferir quién habla basándote en el contexto (rol, tema, estilo, contenido), indica el nombre entre corchetes antes de la cita relevante: **[Nico]** "ya terminé la API". Si no puedes inferir con confianza, usa [Participante]. El audio [🔊] mezcla todas las voces; el micrófono siempre es el usuario que graba.${contextBlock}`
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
          <div class="ai-model-badge" title="Proveedor: OpenRouter — enruta al mejor modelo gratuito disponible.">
            <i class="fas fa-microchip"></i> ${AI_PROVIDER} / auto
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
  const filename = `resumen-${(session?.title || 'sesion').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}.md`;
  const blob = new Blob([summary], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  showToast('💾 Resumen descargado');
}
