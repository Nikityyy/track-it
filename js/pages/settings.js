async function renderSettingsPage() {
  const app = document.getElementById('app-content');
  const types = await getWorkoutTypes();
  const lastImportBackup = await getLastImportBackup();

  app.innerHTML = `
    <div class="page page-settings">

  app.innerHTML = `
    <div class="page page-settings">
      <h2 class="page-title">Einstellungen</h2>

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
              <input type="text" class="input type-input" value="${escapeHtml(t.name)}" data-id="${t.id}" aria-label="Typ-Name">
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
          <button class="btn btn-ghost" id="btn-export">${icon('download', 16)} Exportieren</button>
        </div>
        <div class="settings-row">
          <div class="settings-info">
            <span class="settings-label">Daten importieren</span>
            <span class="text-muted text-small">Daten aus einer JSON-Datei wiederherstellen. Vorhandene Daten werden überschrieben.</span>
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


  // ── Type editing ──
  const typeList = document.getElementById('type-list');

  async function handleNameChange(e) {
    if (e.target.classList.contains('type-input')) {
      const id = e.target.dataset.id;
      const name = e.target.value.trim();
      if (name) {
        const type = types.find(t => t.id === id) || { id, name };
        const oldName = type.name;
        if (oldName !== name) {
          type.name = name;
          await saveWorkoutType(type);
          
          if (oldName) {
            const allWorkouts = await getAllWorkouts();
            let needsUpdate = false;
            for (const w of allWorkouts) {
              if (w.type === oldName) {
                w.type = name;
                await saveWorkout(w);
                needsUpdate = true;
              }
            }
            if (needsUpdate) {
              showToast('Vorhandene Workouts aktualisiert');
            }
          }
        }
      }
    }
  }

  typeList.addEventListener('change', handleNameChange);
  typeList.addEventListener('focusout', handleNameChange);

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
    types.push(newType); // update local state so moving works
    renderSettingsPage();
  });

  // ── Export ──
  document.getElementById('btn-export').addEventListener('click', async () => {
    if (window.haptic) window.haptic.trigger('success');
    const data = await exportAllData();
    downloadJson(data, `track-it-export-${formatDateDE(new Date().toISOString()).replace(/\./g, '-')}.json`);
    showToast('Export heruntergeladen');
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

  // ── Import ──
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
      title: 'Daten importieren',
      bodyText: `${summary}\n\nAlle vorhandenen Daten werden ersetzt. Vor dem Import wird automatisch ein lokales Backup angelegt. Fortfahren?`,
      confirmText: 'Importieren',
      cancelText: 'Abbrechen',
      danger: true,
      onConfirm: async () => {
        if (window.haptic) window.haptic.trigger('success');
        try {
          await importAllData(data);
          showToast('Daten erfolgreich importiert');
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
  a.click();
  URL.revokeObjectURL(url);
}
