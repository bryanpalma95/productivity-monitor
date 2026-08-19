/* ============================================================
   Productivity Monitor - Reports Module v2.0.0
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
  const transcriptText = transcripts.map(t => t.text).join(' ').slice(0, 3000);

  try {
    const response = await fetch('https://omniroute.vercel.app/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'auto/best-chat',
        messages: [
          {
            role: 'system',
            content: 'Eres un asistente que resume sesiones de trabajo. Genera un resumen conciso en español con: 1) Temas principales, 2) Tareas realizadas, 3) Puntos de acción.'
          },
          {
            role: 'user',
            content: `Sesión: ${session.title}\nTipo: ${getTypeLabel(session.type)}\nDuración: ${formatDuration(session.duration || 0)}\nTranscripciones:\n${transcriptText || 'Sin transcripciones disponibles'}`
          }
        ]
      })
    });

    if (!response.ok) throw new Error('Error en la API');

    const data = await response.json();
    const summary = data.choices?.[0]?.message?.content || data.message?.content || 'No se pudo generar el resumen.';

    body.innerHTML = `
      <div class="ai-summary">
        <div class="ai-result">
          <h4><i class="fas fa-robot"></i> Resumen generado</h4>
          <div class="ai-text">${escapeHtml(summary).replace(/\n/g, '<br>')}</div>
        </div>
        <div class="edit-actions" style="display:flex;gap:12px;margin-top:16px">
          <button class="btn btn-secondary" onclick="closeModal()">
            <i class="fas fa-times"></i> Cerrar
          </button>
        </div>
      </div>
    `;
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
