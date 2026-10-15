/* One exercise over time: how often, the progress chart, and every session.
 * Sessions of the same exercise at different weights belong together (the
 * weight is part of the name, see exercises.js). */

async function renderExercisePage(params) {
  const app = document.getElementById('app-content');
  const requested = decodeURIComponent(params.name || '');
  const workouts = await getAllWorkouts();
  const index = buildExerciseIndex(workouts);
  const item = index.get(exerciseKey(requested));

  if (!item) {
    app.innerHTML = `
      <div class="page">
        <div class="empty-state">
          <p class="empty-state-text">Übung nicht gefunden.</p>
          <a href="#/history?view=exercises" class="btn btn-ghost mt-2">Zu den Übungen</a>
        </div>
      </div>`;
    return;
  }

  const sessions = item.sessions;
  const chronological = sessions.slice().reverse();
  // Only chart the unit used most recently, so kg and lb never share an axis
  const lastUnit = (sessions.find(s => s.weight) || {}).weight?.unit;
  const weighted = chronological.filter(s => s.weight && s.weight.unit === lastUnit);
  const useWeight = weighted.length >= 2;
  const points = useWeight
    ? weighted.map(s => ({ date: s.date, value: s.weight.value, session: s }))
    : chronological.map(s => ({ date: s.date, value: bestReps(s.sets), session: s })).filter(p => p.value > 0);
  const unit = useWeight ? weighted[weighted.length - 1].weight.unit : 'Wdh';

  const best = points.length ? Math.max(...points.map(p => p.value)) : null;
  const latest = points.length ? points[points.length - 1].value : null;
  const totalSets = sessions.reduce((n, s) => n + s.sets.filter(set => !set.skipped).length, 0);

  const heroLabel = useWeight ? 'Aktuelles Gewicht' : 'Meiste Wdh in einem Satz, zuletzt';
  const heroValue = latest !== null ? formatNumberDE(latest) : '–';
  const bestLine = best !== null && best !== latest
    ? `Bestwert ${formatNumberDE(best)} ${unit}`
    : best !== null ? 'Das ist dein Bestwert' : '';

  app.innerHTML = `
    <div class="page page-exercise">
      <div class="page-header">
        <button type="button" class="btn-icon" id="btn-back-exercise" aria-label="Zurück">${icon('chevronLeft', 20)}</button>
        <div>
          <h2 class="page-title">${escapeHtml(item.name)}</h2>
          <span class="text-muted">${item.count}× trainiert · ${totalSets} ${totalSets === 1 ? 'Satz' : 'Sätze'} · zuletzt ${formatDateDE(item.lastDate)}</span>
        </div>
      </div>

      <section class="exercise-hero">
        <span class="exercise-hero-label">${heroLabel}</span>
        <div class="exercise-hero-value"><span class="num">${heroValue}</span><span class="exercise-hero-unit">${unit}</span></div>
        ${bestLine ? `<span class="exercise-hero-sub">${bestLine}</span>` : ''}
      </section>

      ${points.length >= 2 ? `
        <section class="card exercise-chart" aria-label="Verlauf ${useWeight ? 'Gewicht' : 'Wiederholungen'}">
          <div class="exercise-chart-head">
            <h3 class="chart-title">${useWeight ? `Gewicht (${unit})` : 'Meiste Wdh pro Einheit'}</h3>
            <span class="exercise-chart-readout" id="chart-readout" aria-live="polite"></span>
          </div>
          <div class="exercise-chart-plot" id="exercise-chart"></div>
        </section>` : ''}

      <section class="section">
        <div class="section-header">
          <h3 class="section-title">Einheiten</h3>
        </div>
        <div class="workout-list">
          ${sessions.map(s => `
            <a href="#/workout/${s.workoutId}" class="card workout-card-v2 session-row">
              <div class="workout-card-body">
                <div class="workout-card-top">
                  <span class="workout-card-type">${escapeHtml(s.workoutName)}</span>
                  <span class="workout-card-date">${formatDateDE(s.date)}</span>
                </div>
                <div class="session-sets num">${escapeHtml(sessionSummary(s))}</div>
                ${s.weight ? `<div class="session-meta">${escapeHtml(s.fullName)}</div>` : ''}
              </div>
            </a>`).join('')}
        </div>
      </section>
    </div>
  `;

  document.getElementById('btn-back-exercise')?.addEventListener('click', () => Router.back('/history?view=exercises'));

  if (points.length >= 2) renderProgressChart(document.getElementById('exercise-chart'), points, unit);
}

function bestReps(sets) {
  return (sets || []).reduce((max, s) => (!s.skipped && Number(s.reps) > max ? Number(s.reps) : max), 0);
}

function formatNumberDE(value) {
  return String(Math.round(value * 100) / 100).replace('.', ',');
}

// "8/7/6 · RPE 7/8/9" — the same shorthand as the copy text
function sessionSummary(session) {
  const line = copySetLines('', session.sets, session.mode)[0] || '';
  return line.replace(/^\s*(\(L=R\))?:\s*/, (m, lr) => (lr ? 'L=R ' : ''));
}

/* Single-series line chart, inline SVG.
 * One hue (the chart accent), 2px line, 8px markers with a surface ring,
 * recessive grid, direct labels on the latest and the best point only, and a
 * tap/hover readout for every point. */
function renderProgressChart(host, points, unit) {
  const width = host.clientWidth || 340;
  const height = 180;
  const pad = { top: 22, right: 18, bottom: 26, left: 34 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const values = points.map(p => p.value);
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) { min -= 1; max += 1; }
  const span = max - min;
  min = Math.max(0, min - span * 0.15);
  max = max + span * 0.15;

  const x = i => pad.left + (points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW);
  const y = v => pad.top + plotH - ((v - min) / (max - min)) * plotH;

  const ticks = niceTicks(min, max, 3);
  const bestIndex = values.lastIndexOf(Math.max(...values));
  const lastIndex = points.length - 1;
  const short = d => { const t = new Date(d); return `${String(t.getDate()).padStart(2, '0')}.${String(t.getMonth() + 1).padStart(2, '0')}.`; };

  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const labelFor = i => `${formatNumberDE(points[i].value)}`;

  host.innerHTML = `
    <svg class="progress-svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img"
         aria-label="Verlauf von ${formatNumberDE(values[0])} auf ${formatNumberDE(values[lastIndex])} ${unit}">
      ${ticks.map(t => `
        <line class="chart-grid" x1="${pad.left}" x2="${width - pad.right}" y1="${y(t)}" y2="${y(t)}"></line>
        <text class="chart-axis" x="${pad.left - 8}" y="${y(t) + 4}" text-anchor="end">${formatNumberDE(t)}</text>`).join('')}
      <text class="chart-axis" x="${x(0)}" y="${height - 6}" text-anchor="start">${short(points[0].date)}</text>
      <text class="chart-axis" x="${x(lastIndex)}" y="${height - 6}" text-anchor="end">${short(points[lastIndex].date)}</text>
      <path class="chart-line" d="${path}"></path>
      ${points.map((p, i) => `<circle class="chart-dot${i === lastIndex ? ' is-latest' : ''}" cx="${x(i)}" cy="${y(p.value)}" r="${i === lastIndex ? 5 : 4}"></circle>`).join('')}
      ${bestIndex !== lastIndex ? `<text class="chart-label" x="${x(bestIndex)}" y="${y(values[bestIndex]) - 10}" text-anchor="middle">${labelFor(bestIndex)}</text>` : ''}
      <text class="chart-label is-latest" x="${x(lastIndex)}" y="${y(values[lastIndex]) - 10}" text-anchor="end">${labelFor(lastIndex)}</text>
      <line class="chart-crosshair" id="chart-crosshair" x1="0" x2="0" y1="${pad.top}" y2="${pad.top + plotH}" visibility="hidden"></line>
      ${points.map((p, i) => {
        const left = i === 0 ? pad.left : (x(i - 1) + x(i)) / 2;
        const right = i === lastIndex ? width - pad.right : (x(i) + x(i + 1)) / 2;
        return `<rect class="chart-hit" data-i="${i}" x="${left}" y="0" width="${Math.max(1, right - left)}" height="${height}"></rect>`;
      }).join('')}
    </svg>`;

  const readout = document.getElementById('chart-readout');
  const crosshair = host.querySelector('#chart-crosshair');
  const show = (i) => {
    const p = points[i];
    crosshair.setAttribute('x1', x(i));
    crosshair.setAttribute('x2', x(i));
    crosshair.setAttribute('visibility', 'visible');
    host.querySelectorAll('.chart-dot').forEach((dot, j) => dot.classList.toggle('is-active', j === i));
    if (readout) readout.textContent = `${formatDateDE(p.date)} · ${formatNumberDE(p.value)} ${unit}`;
  };
  const clear = () => {
    crosshair.setAttribute('visibility', 'hidden');
    host.querySelectorAll('.chart-dot').forEach(dot => dot.classList.remove('is-active'));
    if (readout) readout.textContent = '';
  };
  host.querySelectorAll('.chart-hit').forEach(rect => {
    const i = Number(rect.dataset.i);
    rect.addEventListener('pointerenter', () => show(i));
    rect.addEventListener('pointerdown', () => show(i));
  });
  host.querySelector('svg').addEventListener('pointerleave', clear);
}

function niceTicks(min, max, count) {
  const raw = (max - min) / count;
  const magnitude = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map(m => m * magnitude).find(s => s >= raw) || raw;
  const ticks = [];
  for (let t = Math.ceil(min / step) * step; t <= max + 1e-9; t += step) ticks.push(Math.round(t * 100) / 100);
  return ticks;
}
