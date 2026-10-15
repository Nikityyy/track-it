const HISTORY_FILTER_KEY = 'trackit-history-filter';

const HISTORY_PERIODS = [
  { id: 'all', label: 'Alle', days: null },
  { id: '30', label: '30 Tage', days: 30 },
  { id: '90', label: '3 Monate', days: 90 },
  { id: '365', label: '12 Monate', days: 365 }
];

function readHistoryFilter() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(HISTORY_FILTER_KEY) || '{}');
    return { view: 'workouts', query: '', type: '', period: 'all', ...saved };
  } catch (e) {
    return { view: 'workouts', query: '', type: '', period: 'all' };
  }
}

function writeHistoryFilter(state) {
  try { sessionStorage.setItem(HISTORY_FILTER_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
}

async function renderHistoryPage() {
  const app = document.getElementById('app-content');
  const workouts = await getAllWorkouts();

  const typeNames = Array.from(new Set(workouts.map(w => w.type || 'Andere')));
  const typeColors = generateTypeColors(typeNames);

  const state = readHistoryFilter();
  const viewParam = new URLSearchParams(window.location.hash.split('?')[1] || '').get('view');
  if (viewParam === 'exercises' || viewParam === 'workouts') state.view = viewParam;
  if (state.type && !typeNames.includes(state.type)) state.type = '';

  function renderCards(list) {
    if (list.length > 0) {
      return list.map(w => {
        const setCount = w.exercises ? w.exercises.reduce((n, ex) => n + (ex.sets ? ex.sets.length : 0), 0) : 0;
        let wRpe = 0, wSets = 0;
        if (w.exercises) {
          w.exercises.forEach(ex => {
            if (ex.sets) {
              ex.sets.forEach(s => {
                if (!s.skipped && s.rpe != null) { wRpe += Number(s.rpe) || 0; wSets++; }
              });
            }
          });
        }
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
                <span class="chip">${icon('hash', 12)} ${setCount} ${setCount === 1 ? 'Satz' : 'Sätze'}</span>
                ${wAvg ? `<span class="chip chip-rpe">RPE ${wAvg}</span>` : ''}
                ${w.finisher && w.finisher.type ? `<span class="chip">${icon('zap', 12)} Finisher</span>` : ''}
              </div>
            </div>
          </a>
        `;
      }).join('');
    }

    if (workouts.length === 0) {
      return `
        <div class="empty-state">
          <div class="empty-state-icon">${icon('history', 40)}</div>
          <p class="empty-state-text">Kein Verlauf vorhanden.</p>
          <p class="empty-state-sub">Erstelle dein erstes Workout, um es hier zu sehen.</p>
          <a href="#/create" class="btn btn-primary mt-2">Workout erstellen</a>
        </div>
      `;
    }

    return renderNoMatches();
  }

  function renderNoMatches() {
    return `
      <div class="empty-state">
        <div class="empty-state-icon">${icon('search', 40)}</div>
        <p class="empty-state-text">Keine Treffer</p>
        <p class="empty-state-sub">Für diese Suche und Filter gibt es nichts.</p>
        <button type="button" class="btn btn-ghost mt-2" id="btn-reset-filter">Filter zurücksetzen</button>
      </div>
    `;
  }

  function renderExerciseRows(items) {
    if (!items.length) return workouts.length ? renderNoMatches() : renderCards([]);
    return items.map(item => {
      const latest = item.sessions[0];
      const weight = latest && latest.weight ? `${String(latest.weight.value).replace('.', ',')} ${latest.weight.unit}` : '';
      return `
        <a href="#/exercise/${encodeURIComponent(item.name)}" class="card workout-card-v2 exercise-row">
          <div class="workout-card-body">
            <div class="workout-card-top">
              <span class="workout-card-name">${escapeHtml(item.name)}</span>
              ${weight ? `<span class="exercise-row-weight">${escapeHtml(weight)}</span>` : ''}
            </div>
            <div class="workout-card-chips">
              <span class="chip">${item.count}× trainiert</span>
              <span class="chip">zuletzt ${formatDateDE(item.lastDate)}</span>
            </div>
          </div>
          <span class="exercise-row-chevron" aria-hidden="true">${icon('chevronRight', 18)}</span>
        </a>
      `;
    }).join('');
  }

  // Chips are radio options, not <button>s: ios-vibrator-pro-max lays a tap
  // overlay over every button, and for chips scrolled out of view sideways
  // that overlay sticks out of the page and makes it scroll horizontally.
  const chip = (attr, value, label, selected) =>
    `<span class="filter-chip" role="radio" tabindex="0" ${attr}="${escapeHtml(value)}" aria-checked="${selected}">${escapeHtml(label)}</span>`;
  const periodChips = HISTORY_PERIODS.map(p => chip('data-period', p.id, p.label, state.period === p.id)).join('');
  const typeChips = [chip('data-type', '', 'Alle Typen', !state.type)]
    .concat(typeNames.map(t => chip('data-type', t, t, state.type === t))).join('');

  app.innerHTML = `
    <div class="page page-history">
      <div class="page-header">
        <h2 class="page-title">Verlauf</h2>
        <span class="text-muted" id="history-count"></span>
      </div>
      <div class="segmented" role="tablist" aria-label="Ansicht">
        <button type="button" class="segmented-option" role="tab" data-view="workouts" aria-selected="${state.view === 'workouts'}">Workouts</button>
        <button type="button" class="segmented-option" role="tab" data-view="exercises" aria-selected="${state.view === 'exercises'}">Übungen</button>
      </div>
      <div class="history-filters">
        <input type="search" id="history-search" class="input" placeholder="Suchen …" aria-label="Workouts oder Übungen suchen" value="${escapeHtml(state.query)}">
        <div class="filter-row" role="radiogroup" aria-label="Zeitraum">${periodChips}</div>
        ${typeNames.length > 1 ? `<div class="filter-row" role="radiogroup" aria-label="Workout-Typ">${typeChips}</div>` : ''}
      </div>
      <div class="workout-list" id="history-workout-list"></div>
    </div>
  `;

  const searchInput = document.getElementById('history-search');
  const listContainer = document.getElementById('history-workout-list');
  const countEl = document.getElementById('history-count');

  function inPeriod(date) {
    const period = HISTORY_PERIODS.find(p => p.id === state.period);
    if (!period || !period.days) return true;
    return Date.now() - new Date(date).getTime() <= period.days * 86400000;
  }

  function matchesWorkout(w, query, folded) {
    if (!query) return true;
    const haystack = [
      w.name, w.type, w.notes,
      ...(w.exercises || []).map(ex => ex.name),
      w.finisher ? w.finisher.name : '',
      ...(w.finisher && w.finisher.entries ? w.finisher.entries.map(e => e.name) : [])
    ];
    return w.name.toLowerCase().includes(query) ||
      (w.exercises || []).some(ex => (ex.name || '').toLowerCase().includes(query)) ||
      haystack.some(text => normalizeForSearch(text).includes(folded));
  }

  function updateFilteredList() {
    const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
    const folded = normalizeForSearch(query);
    state.query = searchInput ? searchInput.value : '';
    writeHistoryFilter(state);

    const scoped = workouts.filter(w => inPeriod(w.date) && (!state.type || (w.type || 'Andere') === state.type));

    if (state.view === 'exercises') {
      const index = buildExerciseIndex(scoped);
      const items = Array.from(index.values())
        .filter(item => !folded || item.key.includes(folded))
        .sort((a, b) => new Date(b.lastDate) - new Date(a.lastDate));
      if (countEl) countEl.textContent = `${items.length} ${items.length === 1 ? 'Übung' : 'Übungen'}`;
      listContainer.innerHTML = renderExerciseRows(items);
    } else {
      const filtered = scoped.filter(w => matchesWorkout(w, query, folded));
      if (countEl) countEl.textContent = `${filtered.length} ${filtered.length === 1 ? 'Workout' : 'Workouts'}`;
      listContainer.innerHTML = renderCards(filtered);
    }
    bindResetFilter();
  }

  function bindResetFilter() {
    document.getElementById('btn-reset-filter')?.addEventListener('click', () => {
      state.query = '';
      state.type = '';
      state.period = 'all';
      if (searchInput) searchInput.value = '';
      syncChips();
      updateFilteredList();
    });
  }

  function syncChips() {
    app.querySelectorAll('.filter-chip[data-period]').forEach(c => c.setAttribute('aria-checked', String(c.dataset.period === state.period)));
    app.querySelectorAll('.filter-chip[data-type]').forEach(c => c.setAttribute('aria-checked', String(c.dataset.type === state.type)));
    app.querySelectorAll('.segmented-option').forEach(c => c.setAttribute('aria-selected', String(c.dataset.view === state.view)));
  }

  app.querySelector('.page-history').addEventListener('click', (e) => {
    const chip = e.target.closest('.filter-chip');
    const tab = e.target.closest('.segmented-option');
    if (!chip && !tab) return;
    if (chip && chip.dataset.period !== undefined) state.period = chip.dataset.period;
    if (chip && chip.dataset.type !== undefined) state.type = chip.dataset.type;
    if (tab) state.view = tab.dataset.view;
    if (window.haptic) window.haptic.trigger(15);
    syncChips();
    updateFilteredList();
  });

  // Chips are not buttons, so give them the keyboard behaviour of one
  app.querySelector('.page-history').addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('filter-chip')) {
      e.preventDefault();
      e.target.click();
    }
  });

  searchInput?.addEventListener('input', updateFilteredList);
  updateFilteredList();
}
