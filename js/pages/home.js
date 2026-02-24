async function renderHomePage() {
  const app = document.getElementById('app-content');
  const draft = await getDraft();
  const workouts = await getAllWorkouts();
  const recent = workouts.slice(0, 5);

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

  let recentHtml = '';
  if (recent.length > 0) {
    recentHtml = recent.map(w => `
      <a href="#/workout/${w.workoutId}" class="card workout-card">
        <div class="workout-card-left">
          <span class="workout-card-type">${escapeHtml(w.type)}</span>
          <span class="workout-card-name">${escapeHtml(w.name)}</span>
        </div>
        <div class="workout-card-right">
          <span class="workout-card-date">${formatDateDE(w.date)}</span>
          <span class="workout-card-exercises">${w.exercises.length} ${w.exercises.length === 1 ? 'Übung' : 'Übungen'}</span>
        </div>
      </a>
    `).join('');
  } else {
    recentHtml = `
      <div class="empty-state">
        <div class="empty-state-icon">${icon('dumbbell', 40)}</div>
        <p class="empty-state-text">Noch keine Workouts vorhanden.</p>
        <p class="empty-state-sub">Erstelle dein erstes Workout!</p>
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

  // Event listeners
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
}
