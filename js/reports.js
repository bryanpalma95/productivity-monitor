/* ============================================================
   Productivity Monitor - Reports Module v3.1.1
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
const AI_CHUNK_SIZE = 4000;
const AI_MAX_CHUNKS = 20;

// Proveedor IA: OpenRouter — un endpoint estable con 20+ modelos gratuitos
// El modelo 'openrouter/auto' enruta automáticamente al mejor modelo gratuito disponible
// Docs: https://openrouter.ai/docs
const AI_PROVIDER = 'openrouter';
const AI_MODEL = 'openrouter/auto';
const AI_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const AI_MODEL_UPDATED = '2026-08-19'; // Migrado desde Groq (modelos deprecados frecuentemente)

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
      max_tokens: 1024
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

async function generateAISummary(sessionId) {
  const session = Storage.getSession(sessionId);
  if (!session) return;

  const modal = document.getElementById('reportModal');
  const title = document.getElementById('modalTitle');
  const body = document.getElementById('modalBody');

  title.textContent = 'Resumen IA';
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

  // Dividir la transcripción completa en fragmentos
  const chunks = splitTranscriptIntoChunks(transcripts, AI_CHUNK_SIZE);
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
          content: `Eres un analista experto en productividad y gestión del tiempo. 
Analiza la sesión de trabajo y genera un resumen profesional en español con el siguiente formato Markdown:

## 📌 Resumen Ejecutivo
(2-3 oraciones que resuman el propósito y resultado de la sesión)

## 🎯 Temas Principales
- Tema 1
- Tema 2
- Tema 3

## ✅ Tareas Realizadas
- Tarea 1
- Tarea 2

## 📋 Pendientes / Puntos de Acción
- [ ] Acción 1
- [ ] Acción 2

## 💡 Observaciones
(1-2 oraciones con insights, riesgos o recomendaciones)

Reglas:
- Sé conciso y específico, basado SOLO en la información proporcionada
- No inventes datos que no estén en la transcripción
- Si no hay transcripciones, indícalo y sugiere qué información faltó`
        },
        {
          role: 'user',
          content: `Sesión: ${session.title}
Tipo: ${getTypeLabel(session.type)}
Fecha: ${sessionDate}
Duración: ${formatDuration(session.duration || 0)}
Capturas de pantalla: ${screenshots.length}
Transcripciones: ${transcripts.length}

Transcripción:
${transcriptText || 'Sin transcripciones disponibles'}`
        }
      ]);

      window._lastAISummary = summary;
      renderAISummaryResult(body, session.id, summary);
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
          content: `Eres un analista experto en productividad. Analiza este FRAGMENTO de una sesión de trabajo y genera un resumen breve en español con:
1) Temas principales
2) Tareas realizadas
3) Pendientes o puntos de acción

Sé conciso (máximo 150 palabras). Este es el fragmento ${i + 1} de ${chunksToProcess.length} de una sesión más larga.`
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
        content: `Eres un analista experto en productividad y gestión del tiempo. 
Recibes los resúmenes parciales de una sesión de trabajo completa (dividida en partes). 
Genera un resumen FINAL consolidado y profesional en español con el siguiente formato Markdown:

## 📌 Resumen Ejecutivo
(2-3 oraciones que resuman el propósito y resultado de TODA la sesión)

## 🎯 Temas Principales
- Tema 1
- Tema 2
- Tema 3

## ✅ Tareas Realizadas
- Tarea 1
- Tarea 2

## 📋 Pendientes / Puntos de Acción
- [ ] Acción 1
- [ ] Acción 2

## 💡 Observaciones
(1-2 oraciones con insights, riesgos o recomendaciones)

Reglas:
- Consolida la información de TODAS las partes sin repetir
- Sé conciso y específico
- No inventes datos que no estén en los resúmenes parciales`
        },
        {
          role: 'user',
          content: `Sesión: ${session.title}
Tipo: ${getTypeLabel(session.type)}
Fecha: ${sessionDate}
Duración: ${formatDuration(session.duration || 0)}
Capturas de pantalla: ${screenshots.length}
Transcripciones: ${transcripts.length}
${isTruncated ? `\n⚠️ Nota: La sesión tiene ${totalChunks} partes, pero solo se analizaron las primeras ${chunksToProcess.length} por límite de procesamiento.` : ''}

Resúmenes parciales:
${combinedSummaries}`
        }
      ]);

      window._lastAISummary = finalSummary;
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

// Función para renderizar el resultado del resumen IA
function renderAISummaryResult(body, sessionId, summary) {
  body.innerHTML = `
    <div class="ai-summary">
      <div class="ai-result">
        <h4><i class="fas fa-robot"></i> Resumen generado</h4>
        <div class="ai-model-badge" title="Proveedor: OpenRouter — enruta al mejor modelo gratuito disponible. Actualizado el ${AI_MODEL_UPDATED}">
          <i class="fas fa-microchip"></i> ${AI_PROVIDER} / auto
        </div>
        <div class="ai-text">${escapeHtml(summary).replace(/\n/g, '<br>')}</div>
      </div>
      <div class="edit-actions" style="display:flex;gap:12px;margin-top:16px;flex-wrap:wrap">
        <button class="btn btn-secondary" onclick="copyAISummary()">
          <i class="fas fa-copy"></i> Copiar
        </button>
        <button class="btn btn-secondary" onclick="downloadAISummary('${sessionId}')">
          <i class="fas fa-download"></i> Descargar
        </button>
        <button class="btn btn-primary" onclick="generateAISummary('${sessionId}')">
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
  const summary = window._lastAISummary;
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
  const summary = window._lastAISummary;
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
