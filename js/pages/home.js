async function renderHomePage() {
  const app = document.getElementById('app-content');
  const draft = await getDraft();
  const workouts = await getAllWorkouts();
  const recent = workouts.slice(0, 5);

  // --- Stats computation ---
  const totalWorkouts = workouts.length;

  // Workouts this week
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1)); // Monday
  weekStart.setHours(0, 0, 0, 0);
  const thisWeekCount = workouts.filter(w => new Date(w.date) >= weekStart).length;

  // Avg RPE across all workouts
  let totalRpe = 0, totalSets = 0;
  workouts.forEach(w => {
    if (w.exercises) {
      w.exercises.forEach(ex => {
        if (ex.sets) ex.sets.forEach(s => {
          if (!s.skipped) { totalRpe += Number(s.rpe) || 0; totalSets++; }
        });
      });
    }
  });
  const avgRpe = totalSets > 0 ? (totalRpe / totalSets).toFixed(1) : '-';

  // Type distribution for doughnut
  const typeCounts = {};
  workouts.forEach(w => {
    const t = w.type || 'Andere';
    typeCounts[t] = (typeCounts[t] || 0) + 1;
  });

  // Weekly frequency (last 8 weeks)
  const weeklyData = [];
  for (let i = 7; i >= 0; i--) {
    const wStart = new Date(weekStart);
    wStart.setDate(wStart.getDate() - i * 7);
    const wEnd = new Date(wStart);
    wEnd.setDate(wEnd.getDate() + 7);
    const count = workouts.filter(w => {
      const d = new Date(w.date);
      return d >= wStart && d < wEnd;
    }).length;
    const label = `${String(wStart.getDate()).padStart(2, '0')}.${String(wStart.getMonth() + 1).padStart(2, '0')}`;
    weeklyData.push({ label, count });
  }

  // --- Draft banner ---
  let draftBanner = '';
  if (draft && draft.workout) {
    draftBanner = `
      <div class="card draft-banner" id="draft-banner">
        <div class="draft-banner-content">
          <div class="draft-banner-icon">${icon('fileText', 20)}</div>
          <div class="draft-banner-text">
            <span class="draft-banner-title">Entwurf vorhanden</span>
            <span class="draft-banner-sub">${escapeHtml(draft.workout.name || 'Unbenanntes Workout')}</span>
          </div>
        </div>
        <div class="draft-banner-actions">
          <button class="btn btn-primary btn-sm" id="resume-draft">Fortsetzen</button>
          <button class="btn btn-ghost btn-sm" id="discard-draft">Verwerfen</button>
        </div>
      </div>
    `;
  }

  // --- Workout cards ---
  const typeColors = generateTypeColors(Object.keys(typeCounts));

  let recentHtml = '';
  if (recent.length > 0) {
    recentHtml = recent.map(w => {
      const setCount = w.exercises ? w.exercises.reduce((n, ex) => n + (ex.sets ? ex.sets.length : 0), 0) : 0;
      let wRpe = 0, wSets = 0;
      if (w.exercises) w.exercises.forEach(ex => {
        if (ex.sets) ex.sets.forEach(s => {
          if (!s.skipped) { wRpe += Number(s.rpe) || 0; wSets++; }
        });
      });
      const wAvg = wSets > 0 ? (wRpe / wSets).toFixed(1).replace('.0', '') : null;
      const accentColor = typeColors[w.type || 'Andere'] || 'var(--text-muted)';

      return `
        <a href="#/workout/${w.workoutId}" class="card workout-card-v2">
          <div class="workout-card-accent" style="background: ${accentColor};"></div>
          <div class="workout-card-body">
            <div class="workout-card-top">
              <span class="workout-card-type">${escapeHtml(w.type)}</span>
              <span class="workout-card-date">${formatDateDE(w.date)}</span>
            </div>
            <div class="workout-card-name">${escapeHtml(w.name)}</div>
            <div class="workout-card-chips">
              <span class="chip">${icon('layers', 12)} ${w.exercises.length} ${w.exercises.length === 1 ? 'Übung' : 'Übungen'}</span>
              <span class="chip">${icon('hash', 12)} ${setCount} Sätze</span>
              ${wAvg ? `<span class="chip chip-rpe">RPE ${wAvg}</span>` : ''}
            </div>
          </div>
        </a>
      `;
    }).join('');
  } else {
    recentHtml = `
      <div class="empty-state">
        <div class="empty-state-icon">${icon('dumbbell', 40)}</div>
        <p class="empty-state-text">Noch keine Workouts vorhanden.</p>
        <p class="empty-state-sub">Erstelle dein erstes Workout!</p>
      </div>
    `;
  }

  // --- Stats section (only if we have data) ---
  let statsHtml = '';
  if (totalWorkouts > 0) {
    statsHtml = `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">${totalWorkouts}</div>
          <div class="stat-label">Gesamt</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${thisWeekCount}</div>
          <div class="stat-label">Diese Woche</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${avgRpe}</div>
          <div class="stat-label">Ø RPE</div>
        </div>
      </div>
      <div class="charts-row">
        <div class="chart-container">
          <h4 class="chart-title">Verteilung</h4>
          <canvas id="doughnut-chart" width="160" height="160"></canvas>
          <div id="doughnut-legend" class="chart-legend"></div>
        </div>
        <div class="chart-container chart-container-bar">
          <h4 class="chart-title">Letzte 8 Wochen</h4>
          <canvas id="bar-chart" width="300" height="140"></canvas>
        </div>
      </div>
    `;
  }

  app.innerHTML = `
    <div class="page page-home">
      ${draftBanner}
      
      <div class="home-hero">
        <h2 class="page-title">Dashboard</h2>
        <button class="btn btn-primary" id="btn-new-workout">
          ${icon('plus', 18)}
          <span>Neues Workout</span>
        </button>
      </div>

      ${statsHtml}

      <section class="section">
        <div class="section-header">
          <h3 class="section-title">Letzte Workouts</h3>
          ${recent.length > 0 ? `<a href="#/history" class="section-link">Alle anzeigen ${icon('chevronRight', 14)}</a>` : ''}
        </div>
        <div class="workout-list">
          ${recentHtml}
        </div>
      </section>
    </div>
  `;

  // --- Event listeners ---
  document.getElementById('btn-new-workout')?.addEventListener('click', () => {
    Router.navigate('/create');
  });

  document.getElementById('resume-draft')?.addEventListener('click', () => {
    Router.navigate('/create?draft=1');
  });

  document.getElementById('discard-draft')?.addEventListener('click', async () => {
    await clearDraft();
    document.getElementById('draft-banner')?.remove();
    showToast('Entwurf verworfen');
  });

  // --- Draw charts ---
  if (totalWorkouts > 0) {
    drawDoughnutChart('doughnut-chart', 'doughnut-legend', typeCounts, typeColors);
    drawBarChart('bar-chart', weeklyData);
  }
}

// ── Color generation ──
function generateTypeColors(types) {
  const palette = [
    '#6366f1', '#8b5cf6', '#ec4899', '#f97316',
    '#14b8a6', '#3b82f6', '#f59e0b', '#10b981',
    '#ef4444', '#06b6d4', '#84cc16', '#a855f7'
  ];
  const map = {};
  types.forEach((t, i) => {
    map[t] = palette[i % palette.length];
  });
  return map;
}

// ── Doughnut Chart (Canvas) ──
function drawDoughnutChart(canvasId, legendId, data, colorMap) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.width;
  const h = canvas.height;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  ctx.scale(dpr, dpr);

  const entries = Object.entries(data);
  const total = entries.reduce((s, [, v]) => s + v, 0);
  if (total === 0) return;

  const cx = w / 2;
  const cy = h / 2;
  const outerR = Math.min(cx, cy) - 8;
  const innerR = outerR * 0.58;

  let startAngle = -Math.PI / 2;
  entries.forEach(([label, value]) => {
    const sliceAngle = (value / total) * Math.PI * 2;
    const color = colorMap[label] || '#666';

    ctx.beginPath();
    ctx.arc(cx, cy, outerR, startAngle, startAngle + sliceAngle);
    ctx.arc(cx, cy, innerR, startAngle + sliceAngle, startAngle, true);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();

    startAngle += sliceAngle;
  });

  // Center text
  ctx.fillStyle = '#fff';
  ctx.font = '700 20px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(total, cx, cy - 6);
  ctx.font = '400 10px Inter, system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillText('Workouts', cx, cy + 10);

  // Legend
  const legendEl = document.getElementById(legendId);
  if (legendEl) {
    legendEl.innerHTML = entries.map(([label, value]) => {
      const pct = Math.round((value / total) * 100);
      const color = colorMap[label] || '#666';
      return `<div class="legend-item"><span class="legend-dot" style="background:${color}"></span><span class="legend-label">${escapeHtml(label)}</span><span class="legend-value">${pct}%</span></div>`;
    }).join('');
  }
}

// ── Bar Chart (Canvas) ──
function drawBarChart(canvasId, data) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.width;
  const h = canvas.height;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  ctx.scale(dpr, dpr);

  const maxVal = Math.max(...data.map(d => d.count), 1);
  const padding = { top: 10, right: 10, bottom: 28, left: 10 };
  const chartW = w - padding.left - padding.right;
  const chartH = h - padding.top - padding.bottom;
  const barGap = 6;
  const barW = (chartW - barGap * (data.length - 1)) / data.length;

  data.forEach((d, i) => {
    const x = padding.left + i * (barW + barGap);
    const barH = (d.count / maxVal) * chartH;
    const y = padding.top + chartH - barH;

    // Bar with rounded top
    const radius = Math.min(4, barW / 2);
    ctx.beginPath();
    ctx.moveTo(x, y + radius);
    ctx.arcTo(x, y, x + barW, y, radius);
    ctx.arcTo(x + barW, y, x + barW, y + barH, radius);
    ctx.lineTo(x + barW, padding.top + chartH);
    ctx.lineTo(x, padding.top + chartH);
    ctx.closePath();

    // Gradient fill
    const isCurrentWeek = i === data.length - 1;
    if (d.count > 0) {
      const grad = ctx.createLinearGradient(x, y, x, padding.top + chartH);
      if (isCurrentWeek) {
        grad.addColorStop(0, '#6366f1');
        grad.addColorStop(1, '#4338ca');
      } else {
        grad.addColorStop(0, 'rgba(99, 102, 241, 0.5)');
        grad.addColorStop(1, 'rgba(99, 102, 241, 0.2)');
      }
      ctx.fillStyle = grad;
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.04)';
      // Draw a tiny placeholder bar
      ctx.beginPath();
      ctx.rect(x, padding.top + chartH - 2, barW, 2);
    }
    ctx.fill();

    // Count label
    if (d.count > 0) {
      ctx.fillStyle = '#fff';
      ctx.font = '600 11px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(d.count, x + barW / 2, y - 3);
    }

    // X-axis label
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '400 9px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(d.label, x + barW / 2, padding.top + chartH + 6);
  });
}
