/* ============================================================
   Productivity Monitor - Dashboard Module v2.0.0
   Dashboard, gráficos, puntaje de productividad y tendencias
   ============================================================ */

// ===== Dashboard =====
function loadDashboard() {
  const sessions = Storage.getSessions();

  let totalMs = 0;
  let totalTranscripts = 0;
  let totalScreenshots = 0;

  sessions.forEach(s => {
    if (s.duration) totalMs += s.duration;
    if (s.transcripts) totalTranscripts += s.transcripts.length;
    if (s.screenshots) totalScreenshots += s.screenshots.length;
  });

  document.getElementById('stat-duration').textContent = formatDuration(totalMs);
  document.getElementById('stat-sessions').textContent = sessions.length;
  document.getElementById('stat-transcripts').textContent = totalTranscripts;
  document.getElementById('stat-screenshots').textContent = totalScreenshots;

  renderActivityChart();
  renderTypeChart();
  renderProductivityScore();
  renderWeeklyTrend();

  const recentContainer = document.getElementById('recent-sessions');
  const recent = sessions.slice(0, 5);

  if (recent.length === 0) {
    recentContainer.innerHTML = '<p class="empty-state">No hay sesiones registradas aún. Inicia el monitoreo para comenzar.</p>';
    return;
  }

  recentContainer.innerHTML = recent.map(s => `
    <div class="session-item" onclick="viewSessionDetails('${s.id}')">
      <div class="session-item-header">
        <span class="session-type-badge ${s.type}">${getTypeLabel(s.type)}</span>
        <span class="session-date">${formatDateTime(s.startedAt)}</span>
      </div>
      <div class="session-item-title">${escapeHtml(s.title || 'Sesión sin título')}</div>
      <div class="session-item-meta">
        <span><i class="fas fa-clock"></i> ${formatDuration(s.duration || 0)}</span>
        <span><i class="fas fa-comment-dots"></i> ${s.transcripts ? s.transcripts.length : 0} transcripciones</span>
        <span><i class="fas fa-camera"></i> ${s.screenshots ? s.screenshots.length : 0} capturas</span>
      </div>
    </div>
  `).join('');
}

// ===== Puntaje de productividad =====
function calculateProductivityScore(sessions) {
  if (sessions.length === 0) return 0;

  let score = 0;
  let count = 0;

  sessions.forEach(s => {
    if (!s.duration || s.duration < 60000) return;

    let sessionScore = 50;

    const minutes = s.duration / 60000;
    if (minutes >= 30) sessionScore += 20;
    else if (minutes >= 15) sessionScore += 10;

    const transcriptCount = (s.transcripts || []).length;
    if (transcriptCount >= 10) sessionScore += 15;
    else if (transcriptCount >= 5) sessionScore += 10;
    else if (transcriptCount >= 1) sessionScore += 5;

    const screenshotCount = (s.screenshots || []).length;
    if (screenshotCount >= 5) sessionScore += 10;
    else if (screenshotCount >= 1) sessionScore += 5;

    const reports = s.reports || [];
    const bloqueos = reports.reduce((acc, r) => acc + (r.personal?.bloqueos?.length || 0), 0);
    if (bloqueos > 3) sessionScore -= 10;

    score += Math.max(0, Math.min(100, sessionScore));
    count++;
  });

  return count > 0 ? Math.round(score / count) : 0;
}

function renderProductivityScore() {
  const container = document.getElementById('productivity-score');
  if (!container) return;

  const sessions = Storage.getSessions();
  const score = calculateProductivityScore(sessions);

  let color = '#f87171';
  let label = 'Baja';
  if (score >= 80) { color = '#4ade80'; label = 'Excelente'; }
  else if (score >= 60) { color = '#a3e635'; label = 'Buena'; }
  else if (score >= 40) { color = '#fbbf24'; label = 'Regular'; }

  container.innerHTML = `
    <div class="score-circle" style="--score-color:${color};--score:${score * 3.6}deg">
      <div class="score-value">${score}</div>
      <div class="score-label">${label}</div>
    </div>
    <div class="score-details">
      <p><i class="fas fa-info-circle"></i> Puntaje promedio basado en duración, transcripciones y capturas.</p>
    </div>
  `;
}

// ===== Tendencia semanal =====
function renderWeeklyTrend() {
  const container = document.getElementById('weekly-trend');
  if (!container) return;

  const sessions = Storage.getSessions();
  if (sessions.length === 0) {
    container.innerHTML = '<p class="empty-state">Inicia sesiones para ver tu tendencia</p>';
    return;
  }

  const weeks = [];
  const now = new Date();
  const currentWeekStart = new Date(now);
  currentWeekStart.setHours(0, 0, 0, 0);
  currentWeekStart.setDate(currentWeekStart.getDate() - currentWeekStart.getDay() + 1);

  for (let i = 7; i >= 0; i--) {
    const start = new Date(currentWeekStart);
    start.setDate(start.getDate() - (i * 7));
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    weeks.push({
      start,
      end,
      label: start.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }),
      total: 0
    });
  }

  sessions.forEach(s => {
    const sDate = new Date(s.startedAt);
    const week = weeks.find(w => sDate >= w.start && sDate < w.end);
    if (week) week.total += s.duration || 0;
  });

  const maxTotal = Math.max(...weeks.map(w => w.total), 1);

  container.innerHTML = `
    <div class="bar-chart">
      ${weeks.map(w => {
        const height = Math.max(4, (w.total / maxTotal) * 120);
        const hours = (w.total / 3600000).toFixed(1);
        return `
          <div class="bar-col">
            <span class="bar-value">${w.total > 0 ? hours + 'h' : ''}</span>
            <div class="bar" style="height:${height}px;background:var(--accent)" title="${hours}h"></div>
            <span class="bar-label">${w.label}</span>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

// ===== Gráficos =====
function renderActivityChart() {
  const container = document.getElementById('activity-chart');
  const sessions = Storage.getSessions();

  if (sessions.length === 0) {
    container.innerHTML = '<p class="empty-state">Inicia sesiones para ver tu actividad</p>';
    return;
  }

  const days = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    days.push({
      date: d,
      label: d.toLocaleDateString('es-ES', { weekday: 'short' }),
      total: 0
    });
  }

  sessions.forEach(s => {
    const sDate = new Date(s.startedAt);
    sDate.setHours(0, 0, 0, 0);

    const day = days.find(d => d.date.getTime() === sDate.getTime());
    if (day) {
      day.total += s.duration || 0;
    }
  });

  const maxTotal = Math.max(...days.map(d => d.total), 1);

  container.innerHTML = `
    <div class="bar-chart">
      ${days.map(d => {
        const height = Math.max(4, (d.total / maxTotal) * 140);
        const hours = (d.total / 3600000).toFixed(1);
        return `
          <div class="bar-col">
            <span class="bar-value">${d.total > 0 ? hours + 'h' : ''}</span>
            <div class="bar" style="height:${height}px" title="${hours}h"></div>
            <span class="bar-label">${d.label}</span>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function renderTypeChart() {
  const container = document.getElementById('type-chart');
  const sessions = Storage.getSessions();

  if (sessions.length === 0) {
    container.innerHTML = '<p class="empty-state">Inicia sesiones para ver la distribución</p>';
    return;
  }

  const typeCounts = {};
  sessions.forEach(s => {
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
  if (total === 0) {
    container.innerHTML = '<p class="empty-state">Inicia sesiones para ver la distribución</p>';
    return;
  }

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
  `;
}
