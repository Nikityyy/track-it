async function renderSettingsPage() {
  const app = document.getElementById('app-content');
  const types = await getWorkoutTypes();

  app.innerHTML = `
    <div class="page page-settings">
      <h2 class="page-title">Einstellungen</h2>

      <!-- Workout Types -->
      <section class="settings-section">
        <h3 class="section-title">Workout-Typen</h3>
        <div id="type-list" class="type-list">
          ${types.map(t => `
            <div class="type-item" data-id="${t.id}">
              <input type="text" class="input type-input" value="${escapeHtml(t.name)}" data-id="${t.id}" aria-label="Typ-Name">
              <button class="btn-icon btn-danger-icon type-delete" data-id="${t.id}" aria-label="Typ löschen">${icon('trash', 16)}</button>
            </div>
          `).join('')}
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
      </section>

    </div>
  `;


  // ── Type editing ──
  const typeList = document.getElementById('type-list');

  // Save on blur
  typeList.addEventListener('change', async (e) => {
    if (e.target.classList.contains('type-input')) {
      const id = e.target.dataset.id;
      const name = e.target.value.trim();
      if (name) {
        await saveWorkoutType({ id, name });
      }
    }
  });

  typeList.addEventListener('focusout', async (e) => {
    if (e.target.classList.contains('type-input')) {
      const id = e.target.dataset.id;
      const name = e.target.value.trim();
      if (name) {
        await saveWorkoutType({ id, name });
      }
    }
  });

  // Delete type
  typeList.addEventListener('click', async (e) => {
    const btn = e.target.closest('.type-delete');
    if (!btn) return;
    const id = btn.dataset.id;
    await deleteWorkoutType(id);
    btn.closest('.type-item').remove();
    showToast('Typ gelöscht');
  });

  // Add type
  document.getElementById('add-type').addEventListener('click', async () => {
    const newType = { id: uuid(), name: '' };
    await saveWorkoutType(newType);
    const item = document.createElement('div');
    item.className = 'type-item';
    item.dataset.id = newType.id;
    item.innerHTML = `
      <input type="text" class="input type-input" value="" data-id="${newType.id}" aria-label="Typ-Name" placeholder="Neuer Typ…">
      <button class="btn-icon btn-danger-icon type-delete" data-id="${newType.id}" aria-label="Typ löschen">${icon('trash', 16)}</button>
    `;
    typeList.appendChild(item);
    item.querySelector('input').focus();
  });

  // ── Export ──
  document.getElementById('btn-export').addEventListener('click', async () => {
    const data = await exportAllData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `track-it-export-${formatDateDE(new Date().toISOString()).replace(/\./g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Export heruntergeladen');
  });

  // ── Import ──
  const importFile = document.getElementById('import-file');
  document.getElementById('btn-import').addEventListener('click', () => {
    importFile.click();
  });
  importFile.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    showModal({
      title: 'Daten importieren',
      body: '<p>Alle vorhandenen Daten werden durch die importierten Daten ersetzt. Fortfahren?</p>',
      confirmText: 'Importieren',
      cancelText: 'Abbrechen',
      danger: true,
      onConfirm: async () => {
        try {
          const text = await file.text();
          const data = JSON.parse(text);
          await importAllData(data);
          showToast('Daten erfolgreich importiert');
          renderSettingsPage(); // Refresh
        } catch (err) {
          showToast('Fehler beim Import: ' + err.message);
        }
      }
    });
    importFile.value = '';
  });
}
