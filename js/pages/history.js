async function renderHistoryPage() {
  const app = document.getElementById('app-content');
  const workouts = await getAllWorkouts();

  const typeNames = Array.from(new Set(workouts.map(w => w.type || 'Andere')));
  const typeColors = generateTypeColors(typeNames);

  function renderCards(list) {
    if (list.length > 0) {
      return list.map(w => {
        const setCount = w.exercises ? w.exercises.reduce((n, ex) => n + (ex.sets ? ex.sets.length : 0), 0) : 0;
        let wRpe = 0, wSets = 0;
        if (w.exercises) {
          w.exercises.forEach(ex => {
            if (ex.sets) {
              ex.sets.forEach(s => {
                if (!s.skipped) { wRpe += Number(s.rpe) || 0; wSets++; }
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
                <span class="chip">${icon('hash', 12)} ${setCount} Sätze</span>
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

    return `
      <div class="empty-state">
        <div class="empty-state-icon">${icon('search', 40)}</div>
        <p class="empty-state-text">Keine Workouts gefunden</p>
        <p class="empty-state-sub">Keine Einträge für diese Suche vorhanden.</p>
        <button type="button" class="btn btn-ghost mt-2" id="btn-reset-filter">Filter zurücksetzen</button>
      </div>
    `;
  }

  app.innerHTML = `
    <div class="page page-history">
      <div class="page-header">
        <h2 class="page-title">Verlauf</h2>
        <span class="text-muted" id="history-count">${workouts.length} ${workouts.length === 1 ? 'Workout' : 'Workouts'}</span>
      </div>
      <div class="history-filters">
        <input type="search" id="history-search" class="input" placeholder="Workouts oder Übungen suchen..." aria-label="Workouts suchen">
      </div>
      <div class="workout-list" id="history-workout-list">
        ${renderCards(workouts)}
      </div>
    </div>
  `;

  const searchInput = document.getElementById('history-search');
  const listContainer = document.getElementById('history-workout-list');
  const countEl = document.getElementById('history-count');

  function updateFilteredList() {
    const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
    const filtered = workouts.filter(w => {
      if (!query) return true;
      return w.name.toLowerCase().includes(query) ||
        (w.type || '').toLowerCase().includes(query) ||
        (w.exercises || []).some(ex => (ex.name || '').toLowerCase().includes(query));
    });

    if (countEl) {
      countEl.textContent = `${filtered.length} ${filtered.length === 1 ? 'Workout' : 'Workouts'}`;
    }

    if (listContainer) {
      listContainer.innerHTML = renderCards(filtered);
      bindResetFilter();
    }
  }

  function bindResetFilter() {
    document.getElementById('btn-reset-filter')?.addEventListener('click', () => {
      if (searchInput) {
        searchInput.value = '';
        searchInput.focus();
      }
      updateFilteredList();
    });
  }

  searchInput?.addEventListener('input', updateFilteredList);
  bindResetFilter();
}
