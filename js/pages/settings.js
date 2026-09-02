async function renderSettingsPage() {
  const app = document.getElementById('app-content');
  const types = await getWorkoutTypes();
  const lastImportBackup = await getLastImportBackup();
  const currentTheme = localStorage.getItem('trackit-theme') || 'dark';

  app.innerHTML = `
    <div class="page page-settings">
      <h2 class="page-title">Einstellungen</h2>

      <!-- Theme Switcher (D6) -->
      <section class="settings-section">
        <h3 class="section-title">Design / Theme</h3>
        <div class="settings-row">
          <div class="settings-info">
            <span class="settings-label">Erscheinungsbild</span>
            <span class="text-muted text-small">Wähle dein bevorzugtes Farbschema.</span>
          </div>
          <select id="theme-select" class="select" style="width: auto; min-width: 170px;" aria-label="Design auswählen">
            <option value="dark" ${currentTheme === 'dark' ? 'selected' : ''}>Dunkel (Standard)</option>
            <option value="oled" ${currentTheme === 'oled' ? 'selected' : ''}>OLED Schwarz</option>
            <option value="light" ${currentTheme === 'light' ? 'selected' : ''}>Hell</option>
          </select>
        </div>
      </section>

      <!-- Workout Types -->
      <section class="settings-section">
        <h3 class="section-title">Workout-Typen</h3>
        <div id="type-list" class="type-list">
          ${types.length > 0 ? types.map((t, index) => `
            <div class="type-item" data-id="${t.id}">
              <div style="display: flex; flex-direction: column;">
                <button class="btn-icon type-move-up" data-id="${t.id}" style="padding: 2px; height: auto;" ${index === 0 ? 'disabled' : ''}>${icon('chevronUp', 16)}</button>
                <button class="btn-icon type-move-down" data-id="${t.id}" style="padding: 2px; height: auto;" ${index === types.length - 1 ? 'disabled' : ''}>${icon('chevronDown', 16)}</button>
              </div>
              <input type="text" class="input type-input" value="${escapeHtml(t.name)}" data-id="${t.id}" data-original-name="${escapeHtml(t.name)}" aria-label="Typ-Name">
              <button class="btn-icon btn-danger-icon type-delete" data-id="${t.id}" aria-label="Typ löschen">${icon('trash', 16)}</button>
            </div>
          `).join('') : `
            <div class="empty-state" style="padding: 24px 0; border: none; background: transparent;">
              <div class="empty-state-icon" style="margin-bottom: 8px;">${icon('settings', 32)}</div>
              <p class="empty-state-text" style="font-size: 14px;">Keine Workout-Typen vorhanden.</p>
              <p class="empty-state-sub" style="font-size: 12px;">Füge einen Typ hinzu, um deine Workouts zu organisieren.</p>
            </div>
          `}
        </div>
        <button class="btn btn-ghost btn-sm" id="add-type">${icon('plus', 14)} Typ hinzufügen</button>
      </section>

      <!-- Data Export/Import -->
      <section class="settings-section">
        <h3 class="section-title">Datensicherung</h3>
        <div class="settings-row">
          <div class="settings-info">
            <span class="settings-label">Daten exportieren</span>
            <span class="text-muted text-small">Alle Workouts und Einstellungen als JSON-Datei herunterladen.</span>
          </div>
          <button class="btn btn-ghost" id="btn-export">${icon('download', 16)} JSON exportieren</button>
        </div>
        <div class="settings-row">
          <div class="settings-info">
            <span class="settings-label">CSV exportieren</span>
            <span class="text-muted text-small">Alle Workouts und Sätze tabellarisch als CSV für Excel exportieren.</span>
          </div>
          <button class="btn btn-ghost" id="btn-export-csv">${icon('download', 16)} CSV exportieren</button>
        </div>
        <div class="settings-row">
          <div class="settings-info">
            <span class="settings-label">Daten importieren</span>
            <span class="text-muted text-small">Daten aus einer JSON-Datei wiederherstellen.</span>
            <label class="toggle-label" style="margin-top: 8px; display: inline-flex; align-items: center; gap: 8px; cursor: pointer;">
              <input type="checkbox" id="import-merge-checkbox">
              <span class="text-small" style="color: var(--text-primary); font-weight: 500;">Bestehende Workouts behalten (Zusammenführen)</span>
            </label>
          </div>
          <button class="btn btn-ghost" id="btn-import">${icon('upload', 16)} Importieren</button>
          <input type="file" id="import-file" accept=".json" style="display:none">
        </div>
        <div class="settings-row">
          <div class="settings-info">
            <span class="settings-label">Letztes Import-Backup</span>
            <span class="text-muted text-small">Automatische Sicherung vor dem letzten Import herunterladen.</span>
          </div>
          <button class="btn btn-ghost" id="btn-download-backup" ${lastImportBackup ? '' : 'disabled'}>${icon('download', 16)} Backup</button>
        </div>
      </section>
    </div>
  `;

  // ── Theme Switcher (D6) ──
  document.getElementById('theme-select')?.addEventListener('change', (e) => {
    const theme = e.target.value;
    localStorage.setItem('trackit-theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
    if (window.haptic) window.haptic.trigger(20);
    showToast('Design aktualisiert');
  });

  // ── Type editing (U4: Safe workout type rename) ──
  const typeList = document.getElementById('type-list');

  async function handleNameChange(e) {
    if (e.target.classList.contains('type-input')) {
      const id = e.target.dataset.id;
      const name = e.target.value.trim();
      const type = types.find(t => t.id === id);
      if (!type) return;

      const oldName = e.target.dataset.originalName || type.name;

      if (!name) {
        e.target.value = oldName;
        return;
      }

      if (oldName !== name) {
        type.name = name;
        e.target.dataset.originalName = name;
        await saveWorkoutType(type);

        if (oldName) {
          showModal({
            title: 'Typ umbenennen',
            bodyText: 'Möchtest du den Namen für alle bestehenden Workouts aktualisieren oder nur für zukünftige Workouts?',
            confirmText: 'Alle aktualisieren',
            cancelText: 'Nur zukünftige',
            onConfirm: async () => {
              const allWorkouts = await getAllWorkouts();
              let updatedCount = 0;
              for (const w of allWorkouts) {
                if (w.type === oldName) {
                  w.type = name;
                  await saveWorkout(w);
                  updatedCount++;
                }
              }
              if (window.haptic) window.haptic.trigger('success');
              showToast(updatedCount > 0 ? `${updatedCount} bestehende Workouts aktualisiert` : 'Typ umbenannt');
            },
            onCancel: () => {
              showToast('Typ für zukünftige Workouts umbenannt');
            }
          });
        } else {
          showToast('Typ gespeichert');
        }
      }
    }
  }

  typeList.addEventListener('change', handleNameChange);

  // Move type up/down
  typeList.addEventListener('click', async (e) => {
    const btnUp = e.target.closest('.type-move-up');
    const btnDown = e.target.closest('.type-move-down');
    
    if (btnUp || btnDown) {
      if (window.haptic) window.haptic.trigger(20);
      const id = (btnUp || btnDown).dataset.id;
      const index = types.findIndex(t => t.id === id);
      
      if (btnUp && index > 0) {
        const tempOrder = types[index].order;
        types[index].order = types[index - 1].order;
        types[index - 1].order = tempOrder;
        await saveWorkoutType(types[index]);
        await saveWorkoutType(types[index - 1]);
        renderSettingsPage();
      } else if (btnDown && index < types.length - 1) {
        const tempOrder = types[index].order;
        types[index].order = types[index + 1].order;
        types[index + 1].order = tempOrder;
        await saveWorkoutType(types[index]);
        await saveWorkoutType(types[index + 1]);
        renderSettingsPage();
      }
      return;
    }

    const btn = e.target.closest('.type-delete');
    if (!btn) return;
    const id = btn.dataset.id;
    if (window.haptic) window.haptic.trigger('error');
    
    showModal({
      title: 'Typ löschen',
      bodyText: 'Möchtest du diesen Workout-Typ wirklich löschen? Vorhandene Workouts behalten diesen Typ in der Historie, er steht aber nicht mehr zur Auswahl.',
      confirmText: 'Löschen',
      cancelText: 'Abbrechen',
      danger: true,
      onConfirm: async () => {
        if (window.haptic) window.haptic.trigger('success');
        await deleteWorkoutType(id);
        const idx = types.findIndex(t => t.id === id);
        if (idx !== -1) types.splice(idx, 1);
        btn.closest('.type-item').remove();
        showToast('Typ gelöscht');
      }
    });
  });

  // Add type
  document.getElementById('add-type').addEventListener('click', async () => {
    if (window.haptic) window.haptic.trigger(40);
    const maxOrder = types.reduce((max, t) => Math.max(max, t.order || 0), 0);
    const newType = { id: uuid(), name: '', order: maxOrder + 1 };
    await saveWorkoutType(newType);
    types.push(newType);
    renderSettingsPage();
  });

  // ── JSON Export ──
  document.getElementById('btn-export').addEventListener('click', async () => {
    if (window.haptic) window.haptic.trigger('success');
    const data = await exportAllData();
    downloadJson(data, `track-it-export-${formatDateDE(new Date().toISOString()).replace(/\./g, '-')}.json`);
    showToast('Export heruntergeladen');
  });

  // ── CSV Export (F10) ──
  document.getElementById('btn-export-csv')?.addEventListener('click', async () => {
    if (window.haptic) window.haptic.trigger('success');
    const allWorkouts = await getAllWorkouts();
    const csvContent = compileWorkoutsToCsv(allWorkouts);
    downloadCsv(csvContent, `track-it-export-${formatDateDE(new Date().toISOString()).replace(/\./g, '-')}.csv`);
    showToast('CSV exportiert');
  });

  document.getElementById('btn-download-backup')?.addEventListener('click', async () => {
    const backup = await getLastImportBackup();
    if (!backup) {
      showToast('Kein Import-Backup vorhanden');
      return;
    }
    downloadJson(backup, `track-it-import-backup-${formatDateDE(new Date().toISOString()).replace(/\./g, '-')}.json`);
    showToast('Backup heruntergeladen');
  });

  // ── JSON Import (T9: Merge option) ──
  const importFile = document.getElementById('import-file');
  document.getElementById('btn-import').addEventListener('click', () => {
    if (window.haptic) window.haptic.trigger(20);
    importFile.click();
  });

  importFile.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    let data = null;
    let analysis = null;
    try {
      data = JSON.parse(await file.text());
      analysis = analyzeImportData(data);
    } catch (err) {
      showModal({
        title: 'Import nicht möglich',
        bodyText: 'Die Datei konnte nicht gelesen werden: ' + err.message,
        confirmText: 'OK',
        cancelText: 'Schließen'
      });
      importFile.value = '';
      return;
    }

    const isMerge = Boolean(document.getElementById('import-merge-checkbox')?.checked);
    const summary = formatImportSummary(analysis);
    if (analysis.errors.length > 0) {
      showModal({
        title: 'Import nicht möglich',
        bodyText: summary,
        confirmText: 'OK',
        cancelText: 'Schließen',
        danger: true
      });
      importFile.value = '';
      return;
    }

    showModal({
      title: isMerge ? 'Daten zusammenführen' : 'Daten importieren',
      bodyText: isMerge
        ? `${summary}\n\nBestehende Workouts bleiben erhalten und neue werden hinzugefügt. Vor dem Import wird automatisch ein lokales Backup angelegt. Fortfahren?`
        : `${summary}\n\nAlle vorhandenen Daten werden ersetzt. Vor dem Import wird automatisch ein lokales Backup angelegt. Fortfahren?`,
      confirmText: isMerge ? 'Zusammenführen' : 'Importieren',
      cancelText: 'Abbrechen',
      danger: !isMerge,
      onConfirm: async () => {
        if (window.haptic) window.haptic.trigger('success');
        try {
          await importAllData(data, { merge: isMerge });
          showToast(isMerge ? 'Daten erfolgreich zusammengeführt' : 'Daten erfolgreich importiert');
          renderSettingsPage();
        } catch (err) {
          showToast('Fehler beim Import: ' + err.message);
        }
      }
    });
    importFile.value = '';
  });
}

function formatImportSummary(analysis) {
  const lines = [
    `Gültige Workouts: ${analysis.summary.valid}`,
    `Reparierte Einträge: ${analysis.summary.repaired}`,
    `Abgelehnte Einträge: ${analysis.summary.rejected}`
  ];
  if (analysis.errors.length > 0) {
    lines.push('', 'Fehler:', ...analysis.errors.slice(0, 5));
    if (analysis.errors.length > 5) lines.push(`... und ${analysis.errors.length - 5} weitere`);
  }
  return lines.join('\n');
}

function downloadJson(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

// ── CSV Export Helpers (F10) ──
function compileWorkoutsToCsv(workouts) {
  const headers = ['Datum', 'Workout', 'Typ', 'Übung', 'Satz', 'Wdh', 'RPE', 'Pause', 'Notiz'];
  const rows = [headers];

  function escapeCsvCell(val) {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes(',') || str.includes(';') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  for (const w of workouts) {
    const dateStr = formatDateDE(w.date);
    const workoutName = w.name || '';
    const workoutType = w.type || '';

    if (Array.isArray(w.exercises) && w.exercises.length > 0) {
      for (const ex of w.exercises) {
        const exName = ex.name || '';
        if (Array.isArray(ex.sets) && ex.sets.length > 0) {
          for (const s of ex.sets) {
            rows.push([
              escapeCsvCell(dateStr),
              escapeCsvCell(workoutName),
              escapeCsvCell(workoutType),
              escapeCsvCell(exName),
              escapeCsvCell(s.label || ''),
              escapeCsvCell(s.skipped ? 'Übersprungen' : (s.reps ?? 0)),
              escapeCsvCell(s.skipped ? '' : (s.rpe ?? 5)),
              escapeCsvCell(s.skipped ? '' : (s.breakSeconds ?? 0)),
              escapeCsvCell(s.note || '')
            ]);
          }
        } else {
          rows.push([
            escapeCsvCell(dateStr),
            escapeCsvCell(workoutName),
            escapeCsvCell(workoutType),
            escapeCsvCell(exName),
            '', '', '', '', ''
          ]);
        }
      }
    }

    if (w.finisher && Array.isArray(w.finisher.entries)) {
      for (const entry of w.finisher.entries) {
        const finName = entry.name ? `Finisher: ${entry.name}` : `Finisher (${w.finisher.type || 'NORMAL'})`;
        if (Array.isArray(entry.sets) && entry.sets.length > 0) {
          for (const s of entry.sets) {
            rows.push([
              escapeCsvCell(dateStr),
              escapeCsvCell(workoutName),
              escapeCsvCell(workoutType),
              escapeCsvCell(finName),
              escapeCsvCell(s.label || ''),
              escapeCsvCell(s.skipped ? 'Übersprungen' : (s.reps ?? 0)),
              escapeCsvCell(s.skipped ? '' : (s.rpe ?? 5)),
              escapeCsvCell(s.skipped ? '' : (s.breakSeconds ?? 0)),
              escapeCsvCell(s.note || '')
            ]);
          }
        } else {
          rows.push([
            escapeCsvCell(dateStr),
            escapeCsvCell(workoutName),
            escapeCsvCell(workoutType),
            escapeCsvCell(finName),
            escapeCsvCell(w.finisher.type || 'Ergebnis'),
            escapeCsvCell(entry.result || ''),
            escapeCsvCell(entry.rpe ?? 5),
            0,
            escapeCsvCell(entry.note || '')
          ]);
        }
      }
    }

    if ((!w.exercises || w.exercises.length === 0) && (!w.finisher || !w.finisher.entries || w.finisher.entries.length === 0)) {
      rows.push([
        escapeCsvCell(dateStr),
        escapeCsvCell(workoutName),
        escapeCsvCell(workoutType),
        '', '', '', '', '', ''
      ]);
    }
  }

  return rows.map(r => r.join(',')).join('\r\n');
}

function downloadCsv(csvContent, filename) {
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}
