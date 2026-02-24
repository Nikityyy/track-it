async function renderWorkoutDetailPage(params) {
  const app = document.getElementById('app-content');
  const workout = await getWorkout(params.id);

  if (!workout) {
    app.innerHTML = `
      <div class="page">
        <div class="empty-state">
          <p class="empty-state-text">Workout nicht gefunden.</p>
          <a href="#/history" class="btn btn-ghost">Zurück zum Verlauf</a>
        </div>
      </div>
    `;
    return;
  }

  // Calculate average RPE
  let totalRpe = 0;
  let totalSets = 0;

  if (workout.exercises) {
    workout.exercises.forEach(ex => {
      if (ex.sets && ex.sets.length) {
        ex.sets.forEach(s => {
          totalRpe += Number(s.rpe) || 0;
          totalSets++;
        });
      }
    });
  }

  if (workout.finisher && workout.finisher.entries) {
    workout.finisher.entries.forEach(entry => {
      if (workout.finisher.type === 'NORMAL' && entry.sets) {
        entry.sets.forEach(s => {
          totalRpe += Number(s.rpe) || 0;
          totalSets++;
        });
      } else if (entry.rpe) {
        totalRpe += Number(entry.rpe) || 0;
        totalSets++;
      }
    });
  }

  const avgRpeVal = totalSets > 0 ? (totalRpe / totalSets).toFixed(1).replace('.0', '') : '-';

  // Exercises HTML
  const exercisesHtml = workout.exercises.map(ex => `
    <div class="card detail-exercise">
      <div class="detail-exercise-header">
        <h3 class="detail-exercise-name">${escapeHtml(ex.name || 'Unbenannte Übung')}</h3>
        <span class="badge">${ex.mode === 'lr' ? 'Links/Rechts' : 'Normal'}</span>
      </div>
      <div class="detail-sets">
        ${ex.sets.map(s => `
          <div class="detail-set-row">
            <span class="detail-set-label">${escapeHtml(s.label)}</span>
            <span class="detail-set-reps">${s.reps} Wdh</span>
            <span class="detail-set-rpe">RPE ${s.rpe}</span>
            ${s.note ? `<span class="detail-set-note">${escapeHtml(s.note)}</span>` : ''}
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');

  // Finisher HTML
  let finisherHtml = '';
  if (workout.finisher && workout.finisher.type) {
    const fin = workout.finisher;
    finisherHtml = `
      <div class="section">
        <h3 class="section-title">Finisher (${escapeHtml(fin.type)})</h3>
        ${fin.entries.map(entry => `
          <div class="card detail-exercise">
            <h4 class="detail-exercise-name">${escapeHtml(entry.name || 'Unbenannt')}</h4>
            ${fin.type === 'NORMAL' && entry.sets && entry.sets.length > 0 ? `
              <div class="detail-sets">
                ${entry.sets.map(s => `
                  <div class="detail-set-row">
                    <span class="detail-set-label">${escapeHtml(s.label)}</span>
                    <span class="detail-set-reps">${s.reps} Wdh</span>
                    <span class="detail-set-rpe">RPE ${s.rpe}</span>
                    ${s.note ? `<span class="detail-set-note">${escapeHtml(s.note)}</span>` : ''}
                  </div>
                `).join('')}
              </div>
            ` : `
              <div class="detail-sets">
                <div class="detail-set-row">
                  <span class="detail-set-label">Ergebnis</span>
                  <span class="detail-set-reps">${escapeHtml(entry.result || '–')}</span>
                  <span class="detail-set-rpe">RPE ${entry.rpe}</span>
                </div>
                ${entry.note ? `<div class="detail-set-row"><span class="detail-set-label">Notiz</span><span class="detail-set-note">${escapeHtml(entry.note)}</span></div>` : ''}
              </div>
            `}
          </div>
        `).join('')}
      </div>
    `;
  }

  app.innerHTML = `
    <div class="page page-detail">
      <div class="page-header">
        <a href="#/history" class="btn-icon" aria-label="Zurück">${icon('chevronLeft', 20)}</a>
        <div>
          <h2 class="page-title">${escapeHtml(workout.name)}</h2>
          <div style="display: flex; align-items: center; gap: 8px; margin-top: 4px;">
            <span class="text-muted" style="font-size: 13px;">${formatDateTimeDE(workout.date)}</span>
            ${totalSets > 0 ? `<span class="badge" style="background: var(--surface-2); color: var(--text-muted); font-size: 12px; font-weight: 500;">Ø RPE ${avgRpeVal}</span>` : ''}
          </div>
        </div>
      </div>

      <div class="detail-actions">
        <button class="btn btn-ghost" id="btn-edit-workout">
          ${icon('edit', 16)} Bearbeiten
        </button>
        <button class="btn btn-ghost" id="btn-copy-md">
          ${icon('copy', 16)} Kopieren (Markdown)
        </button>
        <button class="btn btn-ghost btn-danger-ghost" id="btn-delete-workout">
          ${icon('trash', 16)} Löschen
        </button>
      </div>

      <section class="section">
        <h3 class="section-title">Übungen</h3>
        ${exercisesHtml}
      </section>

      ${finisherHtml}
    </div>
  `;

  // Events
  document.getElementById('btn-edit-workout').addEventListener('click', () => {
    Router.navigate(`/edit/${workout.workoutId}`);
  });

  document.getElementById('btn-copy-md').addEventListener('click', () => {
    copyMarkdownToClipboard(workout);
  });

  document.getElementById('btn-delete-workout').addEventListener('click', () => {
    showModal({
      title: 'Workout löschen',
      body: `<p>Möchtest du <strong>${escapeHtml(workout.name)}</strong> wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.</p>`,
      confirmText: 'Löschen',
      cancelText: 'Abbrechen',
      danger: true,
      onConfirm: async () => {
        await deleteWorkout(workout.workoutId);
        showToast('Workout gelöscht');
        Router.navigate('/history');
      }
    });
  });
}
