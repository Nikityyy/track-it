async function renderSettingsPage() {
  const app = document.getElementById('app-content');
  const types = await getWorkoutTypes();
  const lastImportBackup = await getLastImportBackup();
  const typeUsage = {};
  (await getAllWorkouts()).forEach(w => { typeUsage[w.type] = (typeUsage[w.type] || 0) + 1; });
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

      <section class="settings-section">
        <h3 class="section-title">Training</h3>
        <div class="settings-row">
          <div class="settings-info">
            <span class="settings-label">Links/Rechts-Reihenfolge</span>
            <span class="text-muted text-small">Welche Seite bei neuen Links/Rechts-Sätzen zuerst kommt. Pro Übung umstellbar mit ⇄.</span>
          </div>
          <select id="lr-order-select" class="select" style="width: auto; min-width: 170px;" aria-label="Links/Rechts-Reihenfolge">
            <option value="left" ${getLrOrder() === 'left' ? 'selected' : ''}>Links zuerst</option>
            <option value="right" ${getLrOrder() === 'right' ? 'selected' : ''}>Rechts zuerst</option>
          </select>
        </div>
        <div class="settings-row">
          <div class="settings-info">
            <span class="settings-label">Vibration auf dem iPhone</span>
            <span class="text-muted text-small">Nutzt einen iOS-Trick für spürbares Feedback. Wenn Tippen sich unzuverlässig anfühlt, hier ausschalten.</span>
          </div>
          <label class="toggle-label">
            <input type="checkbox" id="ios-haptics-toggle" ${localStorage.getItem('trackit-ios-haptics') === 'off' ? '' : 'checked'}>
          </label>
        </div>
      </section>

      <!-- Workout Types -->
      <section class="settings-section">
        <h3 class="section-title">Workout-Typen</h3>
        <p class="text-muted text-small type-hint">Zum Sortieren am Griff ziehen. Tippen auf den Namen zum Umbenennen.</p>
        <ul id="type-list" class="type-list">
          ${types.map(t => renderTypeItem(t, typeUsage[t.name] || 0)).join('')}
        </ul>
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

  document.getElementById('lr-order-select')?.addEventListener('change', (e) => {
    setLrOrder(e.target.value);
    if (window.haptic) window.haptic.trigger(20);
    showToast(e.target.value === 'right' ? 'Rechts zuerst' : 'Links zuerst');
  });

  document.getElementById('ios-haptics-toggle')?.addEventListener('change', (e) => {
    localStorage.setItem('trackit-ios-haptics', e.target.checked ? 'on' : 'off');
    showToast(e.target.checked ? 'iPhone-Vibration an' : 'iPhone-Vibration aus');
    // The library wraps the page on load, so switching needs a fresh start
    setTimeout(() => window.location.reload(), 700);
  });

  // ── Workout types: rename, add, delete, drag to reorder ──
  const typeList = document.getElementById('type-list');

  async function handleNameChange(input) {
    const item = input.closest('.type-item');
    const id = item.dataset.id;
    const name = input.value.trim();
    let type = types.find(t => t.id === id);
    const oldName = input.dataset.originalName || '';

    if (!name) {
      if (!type) item.remove(); // a new row left empty is simply dropped
      else input.value = oldName;
      return;
    }
    if (types.some(t => t.id !== id && t.name.trim().toLowerCase() === name.toLowerCase())) {
      showToast(`„${name}“ gibt es schon`);
      if (!type) item.remove();
      else input.value = oldName;
      return;
    }
    if (oldName === name && type) return;

    if (!type) {
      type = { id, name, order: types.length + 1 };
      types.push(type);
      input.dataset.originalName = name;
      await saveWorkoutType(type);
      item.classList.remove('is-new');
      if (window.haptic) window.haptic.trigger(20);
      showToast('Typ hinzugefügt');
      return;
    }

    type.name = name;
    input.dataset.originalName = name;
    await saveWorkoutType(type);

    if (oldName && (typeUsage[oldName] || 0) > 0) {
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
          typeUsage[name] = (typeUsage[name] || 0) + updatedCount;
          delete typeUsage[oldName];
          item.querySelector('.type-count').textContent = typeUsage[name] || '';
          if (window.haptic) window.haptic.trigger('success');
          showToast(updatedCount > 0 ? `${updatedCount} bestehende Workouts aktualisiert` : 'Typ umbenannt');
        },
        onCancel: () => {
          item.querySelector('.type-count').textContent = '';
          showToast('Typ für zukünftige Workouts umbenannt');
        }
      });
    } else {
      showToast('Typ umbenannt');
    }
  }

  typeList.addEventListener('change', (e) => {
    if (e.target.classList.contains('type-input')) handleNameChange(e.target);
  });
  typeList.addEventListener('keydown', (e) => {
    if (e.target.classList.contains('type-input') && e.key === 'Enter') {
      e.preventDefault();
      e.target.blur();
    }
  });
  // A new row that loses focus while still empty disappears
  typeList.addEventListener('focusout', (e) => {
    const item = e.target.closest && e.target.closest('.type-item.is-new');
    if (item && e.target.classList.contains('type-input') && !e.target.value.trim()) item.remove();
  });

  typeList.addEventListener('click', (e) => {
    const btn = e.target.closest('.type-delete');
    if (!btn) return;
    const item = btn.closest('.type-item');
    const id = item.dataset.id;
    const type = types.find(t => t.id === id);
    if (!type) { item.remove(); return; }
    const used = typeUsage[type.name] || 0;
    if (window.haptic) window.haptic.trigger('error');

    showModal({
      title: `„${type.name}“ löschen?`,
      bodyText: used > 0
        ? `${used} ${used === 1 ? 'Workout behält' : 'Workouts behalten'} diesen Typ im Verlauf. Für neue Workouts steht er nicht mehr zur Auswahl.`
        : 'Der Typ steht danach nicht mehr zur Auswahl.',
      confirmText: 'Löschen',
      cancelText: 'Abbrechen',
      danger: true,
      onConfirm: async () => {
        if (window.haptic) window.haptic.trigger('success');
        await deleteWorkoutType(id);
        const idx = types.findIndex(t => t.id === id);
        if (idx !== -1) types.splice(idx, 1);
        item.remove();
        await persistTypeOrder();
        showToast('Typ gelöscht');
      }
    });
  });

  document.getElementById('add-type').addEventListener('click', () => {
    if (window.haptic) window.haptic.trigger(20);
    const pending = typeList.querySelector('.type-item.is-new');
    if (pending) { pending.querySelector('.type-input').focus(); return; }
    typeList.insertAdjacentHTML('beforeend', renderTypeItem({ id: uuid(), name: '' }, 0, true));
    typeList.lastElementChild.querySelector('.type-input').focus();
  });

  // Order = position in the list, written as 1..n so equal or missing
  // order values (e.g. after an import) can never block a move
  async function persistTypeOrder() {
    const ids = Array.from(typeList.querySelectorAll('.type-item:not(.is-new)')).map(el => el.dataset.id);
    for (let i = 0; i < ids.length; i++) {
      const type = types.find(t => t.id === ids[i]);
      if (type && type.order !== i + 1) {
        type.order = i + 1;
        await saveWorkoutType(type);
      }
    }
    types.sort((a, b) => a.order - b.order);
  }

  enableTypeDragging(typeList, persistTypeOrder);

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
              escapeCsvCell(s.skipped ? '' : (s.rpe ?? '–')),
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
              escapeCsvCell(s.skipped ? '' : (s.rpe ?? '–')),
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


function renderTypeItem(type, usage, isNew = false) {
  return `
    <li class="type-item${isNew ? ' is-new' : ''}" data-id="${escapeHtml(type.id)}">
      <span class="type-handle" tabindex="0" aria-label="Verschieben: Pfeiltasten oder ziehen" title="Ziehen zum Sortieren">${icon('gripVertical', 18)}</span>
      <input type="text" class="input type-input" value="${escapeHtml(type.name)}" data-original-name="${escapeHtml(type.name)}" placeholder="Name, z. B. Oberkörper" aria-label="Typ-Name" autocomplete="off" enterkeyhint="done">
      <span class="type-count" title="Workouts mit diesem Typ">${usage || ''}</span>
      <button type="button" class="btn-icon btn-danger-icon type-delete" aria-label="Typ löschen">${icon('trash', 16)}</button>
    </li>`;
}

/* Drag a row by its handle; the others slide out of the way. Rows only move
 * in the DOM on release, so a cancelled drag leaves everything as it was.
 * The handle is deliberately not a <button>: ios-vibrator-pro-max covers
 * buttons with tap overlays, which would swallow the drag. */
function enableTypeDragging(list, onReorder) {
  let drag = null;

  const rows = () => Array.from(list.querySelectorAll('.type-item'));

  list.addEventListener('pointerdown', (e) => {
    const handle = e.target.closest('.type-handle');
    if (!handle || drag) return;
    const item = handle.closest('.type-item');
    if (item.classList.contains('is-new')) return;
    e.preventDefault();
    const all = rows();
    const from = all.indexOf(item);
    const rects = all.map(r => r.getBoundingClientRect());
    drag = { item, handle, all, from, to: from, startY: e.clientY, rects, pointerId: e.pointerId };
    handle.setPointerCapture(e.pointerId);
    item.classList.add('is-dragging');
    list.classList.add('is-sorting');
    if (window.haptic) window.haptic.trigger(20);
  });

  list.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const { item, all, from, rects } = drag;
    const minDy = rects[0].top - rects[from].top;
    const maxDy = rects[rects.length - 1].bottom - rects[from].bottom;
    const dy = Math.max(minDy, Math.min(maxDy, e.clientY - drag.startY));
    item.style.transform = `translateY(${dy}px)`;

    // Which slot is the dragged row's centre over?
    const centre = rects[from].top + rects[from].height / 2 + dy;
    let to = from;
    rects.forEach((r, i) => { if (centre > r.top && centre < r.bottom) to = i; });
    if (to !== drag.to) {
      drag.to = to;
      const shift = rects[from].height;
      all.forEach((row, i) => {
        if (row === item) return;
        let offset = 0;
        if (from < to && i > from && i <= to) offset = -shift;
        if (from > to && i >= to && i < from) offset = shift;
        row.style.transform = offset ? `translateY(${offset}px)` : '';
      });
      if (window.haptic) window.haptic.trigger(10);
    }
  });

  const finish = async (e) => {
    if (!drag || (e && e.pointerId !== drag.pointerId)) return;
    const { item, all, from, to } = drag;
    drag = null;
    list.classList.remove('is-sorting');
    list.classList.add('is-dropping');
    all.forEach(row => { row.style.transform = ''; });
    item.classList.remove('is-dragging');
    if (to !== from) {
      const ref = to > from ? all[to].nextSibling : all[to];
      list.insertBefore(item, ref);
      await onReorder();
    }
    requestAnimationFrame(() => list.classList.remove('is-dropping'));
  };
  list.addEventListener('pointerup', finish);
  list.addEventListener('pointercancel', finish);

  // Keyboard: arrow keys on a focused handle
  list.addEventListener('keydown', async (e) => {
    const handle = e.target.closest && e.target.closest('.type-handle');
    if (!handle || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
    e.preventDefault();
    const item = handle.closest('.type-item');
    const sibling = e.key === 'ArrowUp' ? item.previousElementSibling : item.nextElementSibling;
    if (!sibling || sibling.classList.contains('is-new')) return;
    list.insertBefore(item, e.key === 'ArrowUp' ? sibling : sibling.nextSibling);
    handle.focus();
    if (window.haptic) window.haptic.trigger(15);
    await onReorder();
  });
}
