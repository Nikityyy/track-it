async function renderHistoryPage() {
  const app = document.getElementById('app-content');
  const workouts = await getAllWorkouts();

  let listHtml = '';
  if (workouts.length > 0) {
    listHtml = workouts.map(w => `
      <a href="#/workout/${w.workoutId}" class="card workout-card">
        <div class="workout-card-left">
          <span class="workout-card-type">${escapeHtml(w.type)}</span>
          <span class="workout-card-name">${escapeHtml(w.name)}</span>
        </div>
        <div class="workout-card-right">
          <span class="workout-card-date">${formatDateDE(w.date)}</span>
          <span class="workout-card-meta">
            ${w.exercises.length} ${w.exercises.length === 1 ? 'Übung' : 'Übungen'}
            ${w.finisher && w.finisher.type ? ' · Finisher' : ''}
          </span>
        </div>
      </a>
    `).join('');
  } else {
    listHtml = `
      <div class="empty-state">
        <div class="empty-state-icon">${icon('history', 40)}</div>
        <p class="empty-state-text">Kein Verlauf vorhanden.</p>
        <p class="empty-state-sub">Erstelle dein erstes Workout, um es hier zu sehen.</p>
      </div>
    `;
  }

  app.innerHTML = `
    <div class="page page-history">
      <div class="page-header">
        <h2 class="page-title">Verlauf</h2>
        <span class="text-muted">${workouts.length} ${workouts.length === 1 ? 'Workout' : 'Workouts'}</span>
      </div>
      <div class="workout-list">
        ${listHtml}
      </div>
    </div>
  `;
}
