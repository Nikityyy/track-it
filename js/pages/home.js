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
            <span class="draft-banner-title">${draft.isEdit ? 'Bearbeitung offen' : 'Entwurf vorhanden'}</span>
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
      const exCount = w.exercises ? w.exercises.length : 0;

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
              <span class="chip">${icon('layers', 12)} ${exCount} ${exCount === 1 ? 'Übung' : 'Übungen'}</span>
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
        <a href="#/create" class="btn btn-primary mt-2">Workout erstellen</a>
      </div>
    `;
  }

  // --- Frequency Heatmap & Streak (F12) ---
  const workoutDateMap = {};
  workouts.forEach(w => {
    const d = new Date(w.date);
    if (!Number.isNaN(d.getTime())) {
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (!workoutDateMap[key]) workoutDateMap[key] = [];
      workoutDateMap[key].push(w);
    }
  });

  // Calculate current active streak (consecutive days)
  let streak = 0;
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const yesterdayKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

  let checkDate = new Date(now);
  if (workoutDateMap[todayKey]) {
    streak = 1;
    checkDate.setDate(checkDate.getDate() - 1);
  } else if (workoutDateMap[yesterdayKey]) {
    streak = 1;
    checkDate.setDate(checkDate.getDate() - 2);
  }

  if (streak > 0) {
    while (true) {
      const k = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}`;
      if (workoutDateMap[k]) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }
  }

  // 20 Weeks (Monday to Sunday) - Horizontal GitHub-Style Contribution Graph
  const weeksCount = 20;
  const currMonday = new Date(now);
  const currDay = currMonday.getDay();
  const diffMon = currDay === 0 ? -6 : 1 - currDay;
  currMonday.setDate(currMonday.getDate() + diffMon);
  currMonday.setHours(0, 0, 0, 0);

  // (weeksCount - 1) weeks prior to current Monday gives 20 full weeks
  const startHeatmapDate = new Date(currMonday);
  startHeatmapDate.setDate(startHeatmapDate.getDate() - (weeksCount - 1) * 7);

  const heatmapDays = [];
  const iterDate = new Date(startHeatmapDate);
  const todayZero = new Date(now);
  todayZero.setHours(0, 0, 0, 0);

  for (let i = 0; i < weeksCount * 7; i++) {
    const isoKey = `${iterDate.getFullYear()}-${String(iterDate.getMonth() + 1).padStart(2, '0')}-${String(iterDate.getDate()).padStart(2, '0')}`;
    const dayWorkouts = workoutDateMap[isoKey] || [];
    const isToday = iterDate.getTime() === todayZero.getTime();
    const isFuture = iterDate.getTime() > todayZero.getTime();

    const dayDateStr = `${String(iterDate.getDate()).padStart(2, '0')}.${String(iterDate.getMonth() + 1).padStart(2, '0')}.${iterDate.getFullYear()}`;
    heatmapDays.push({
      dateStr: dayDateStr,
      isoKey,
      count: dayWorkouts.length,
      workouts: dayWorkouts,
      isToday,
      isFuture,
      date: new Date(iterDate)
    });
    iterDate.setDate(iterDate.getDate() + 1);
  }

  // Month labels above week columns
  const monthNames = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
  const monthLabels = [];
  let lastLabeledCol = -4;

  for (let w = 0; w < weeksCount; w++) {
    const weekStart = heatmapDays[w * 7].date;
    const weekEnd = heatmapDays[w * 7 + 6].date;
    const isFirstWeek = w === 0;
    const monthChanged = weekStart.getMonth() !== weekEnd.getMonth();

    if (isFirstWeek || monthChanged) {
      if (w - lastLabeledCol >= 3) {
        const targetMonth = monthChanged ? weekEnd.getMonth() : weekStart.getMonth();
        monthLabels.push({
          col: w + 1,
          name: monthNames[targetMonth]
        });
        lastLabeledCol = w;
      }
    }
  }

  const monthsHtml = monthLabels.map(m => `<span class="github-month-label" style="grid-column: ${m.col};">${m.name}</span>`).join('');

  const heatmapHtml = `
    <div class="card heatmap-widget">
      <div class="heatmap-header">
        <div class="heatmap-title-group">
          <h4 class="chart-title" style="margin: 0;">Aktivität</h4>
          <span class="text-muted text-small">Letzte ${weeksCount} Wochen</span>
        </div>
        <div class="heatmap-streak" title="Aktueller Workout-Streak">
          ${icon('flame', 14)}
          <span>${streak} ${streak === 1 ? 'Tag' : 'Tage'} Streak</span>
        </div>
      </div>
      <div class="github-graph-scroll">
        <div class="github-graph">
          <div class="github-months">
            ${monthsHtml}
          </div>
          <div class="github-graph-body">
            <div class="github-days heatmap-weekdays">
              <span>Mo</span>
              <span></span>
              <span>Mi</span>
              <span></span>
              <span>Fr</span>
              <span></span>
              <span></span>
            </div>
            <div class="github-grid heatmap-grid">
              ${heatmapDays.map(d => {
                let levelClass = 'level-0';
                if (d.count === 1) levelClass = 'level-1';
                else if (d.count === 2) levelClass = 'level-2';
                else if (d.count === 3) levelClass = 'level-3';
                else if (d.count >= 4) levelClass = 'level-4';

                let classes = `heatmap-cell ${levelClass}`;
                if (d.count === 1) classes += ' has-workout';
                if (d.count > 1) classes += ' has-multi-workout';
                if (d.isFuture) classes += ' is-future';
                if (d.isToday) classes += ' is-today';

                const tooltip = d.count > 0
                  ? `${d.dateStr}: ${d.workouts.map(w => w.name).join(', ')} (${d.count} ${d.count === 1 ? 'Workout' : 'Workouts'})`
                  : `${d.dateStr}: Keine Workouts`;

                return `<div class="${classes}" title="${escapeHtml(tooltip)}" data-date="${d.isoKey}"></div>`;
              }).join('')}
            </div>
          </div>
        </div>
      </div>
      <div class="heatmap-footer">
        <div class="heatmap-legend">
          <span>Weniger</span>
          <span class="heatmap-cell level-0 heatmap-legend-cell" title="0 Workouts"></span>
          <span class="heatmap-cell level-1 heatmap-legend-cell" title="1 Workout"></span>
          <span class="heatmap-cell level-2 heatmap-legend-cell" title="2 Workouts"></span>
          <span class="heatmap-cell level-3 heatmap-legend-cell" title="3 Workouts"></span>
          <span class="heatmap-cell level-4 heatmap-legend-cell" title="4+ Workouts"></span>
          <span>Mehr</span>
        </div>
      </div>
    </div>
  `;

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
      ${heatmapHtml}
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
    const path = draft && draft.isEdit && draft.editId ? `/edit/${draft.editId}?draft=1` : '/create?draft=1';
    Router.navigate(path);
  });

  document.getElementById('discard-draft')?.addEventListener('click', () => {
    if (window.haptic) window.haptic.trigger('error');
    showModal({
      title: 'Entwurf verwerfen',
      bodyText: 'Möchtest du den gespeicherten Entwurf wirklich verwerfen?',
      confirmText: 'Verwerfen',
      cancelText: 'Abbrechen',
      danger: true,
      onConfirm: async () => {
        if (window.haptic) window.haptic.trigger('success');
        await clearDraft();
        document.getElementById('draft-banner')?.remove();
        showToast('Entwurf verworfen');
      }
    });
  });

  // --- Draw charts ---
  if (totalWorkouts > 0) {
    renderDoughnutChart('doughnut-chart', 'doughnut-legend', typeCounts, typeColors);
    renderBarChart('bar-chart', weeklyData);
  }
}

// ── Color generation ──
function generateTypeColors(types) {
  const palette = [
    '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
    '#8b5cf6', '#ec4899', '#14b8a6', '#f97316',
    '#0ea5e9', '#84cc16', '#a855f7', '#6366f1'
  ];
  const map = {};
  (types || []).forEach((t, i) => {
    map[t] = palette[i % palette.length];
  });
  return map;
}

// ── Doughnut Chart (Canvas) - Theme Adaptive (D6) ──
function renderDoughnutChart(canvasId, legendId, data, colorMap) {
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

  const styles = getComputedStyle(document.documentElement);
  const textPrimary = styles.getPropertyValue('--text-primary').trim() || '#ededed';
  const textMuted = styles.getPropertyValue('--text-muted').trim() || '#888888';

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

  // Center text (theme-adaptive)
  ctx.fillStyle = textPrimary;
  ctx.font = '700 20px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(total, cx, cy - 6);
  ctx.font = '400 10px Inter, system-ui, sans-serif';
  ctx.fillStyle = textMuted;
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
const drawDoughnutChart = renderDoughnutChart;

// ── Bar Chart (Canvas) - Theme Adaptive (D6) ──
function renderBarChart(canvasId, data) {
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

  const styles = getComputedStyle(document.documentElement);
  const textPrimary = styles.getPropertyValue('--text-primary').trim() || '#ededed';
  const textMuted = styles.getPropertyValue('--text-muted').trim() || '#888888';
  const surface2 = styles.getPropertyValue('--surface-2').trim() || '#222222';
  const colorAccent = styles.getPropertyValue('--color-accent').trim() || '#6366f1';
  const colorAccentHover = styles.getPropertyValue('--color-accent-hover').trim() || '#4f46e5';

  const maxVal = Math.max(...data.map(d => d.count), 1);
  const padding = { top: 24, right: 10, bottom: 28, left: 10 };
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

    // Gradient fill using theme accent
    const isCurrentWeek = i === data.length - 1;
    if (d.count > 0) {
      const grad = ctx.createLinearGradient(x, y, x, padding.top + chartH);
      if (isCurrentWeek) {
        grad.addColorStop(0, colorAccent);
        grad.addColorStop(1, colorAccentHover);
      } else {
        grad.addColorStop(0, colorAccent);
        grad.addColorStop(1, surface2);
      }
      ctx.fillStyle = grad;
    } else {
      ctx.fillStyle = surface2;
      ctx.beginPath();
      ctx.rect(x, padding.top + chartH - 2, barW, 2);
    }
    ctx.fill();

    // Count label (theme-adaptive)
    if (d.count > 0) {
      ctx.fillStyle = textPrimary;
      ctx.font = '600 11px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(d.count, x + barW / 2, y - 3);
    }

    // X-axis label (theme-adaptive)
    ctx.fillStyle = textMuted;
    ctx.font = '400 9px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(d.label, x + barW / 2, padding.top + chartH + 6);
  });
}
const drawBarChart = renderBarChart;
