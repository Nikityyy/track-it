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

  // Calculate average RPE (excluding skipped)
  let totalRpe = 0;
  let totalSets = 0;

  if (workout.exercises) {
    workout.exercises.forEach(ex => {
      if (ex.sets && ex.sets.length) {
        ex.sets.forEach(s => {
          if (s.skipped || s.rpe == null) return;
          totalRpe += Number(s.rpe) || 0;
          totalSets++;
        });
      }
    });
  }

  if (workout.finisher && workout.finisher.entries) {
    workout.finisher.entries.forEach(entry => {
      if (entry.skipped) return;
      if (workout.finisher.type === 'NORMAL' && entry.sets) {
        entry.sets.forEach(s => {
          if (s.skipped || s.rpe == null) return;
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
        <h3 class="detail-exercise-name">${ex.name && exerciseKey(ex.name)
          ? `<a href="#/exercise/${encodeURIComponent(exerciseBaseName(ex.name))}" class="exercise-link">${escapeHtml(ex.name)}</a>`
          : escapeHtml(ex.name || 'Unbenannte Übung')}</h3>
        <span class="badge">${ex.mode === 'lr' ? 'Links/Rechts' : 'Normal'}</span>
      </div>
      <div class="detail-sets">
        <div class="detail-sets-header">
          <span>Satz</span>
          <span>Wdh</span>
          <span>RPE</span>
          <span>Pause</span>
          <span>Notiz</span>
        </div>
        ${ex.sets.map(s => `
          <div class="detail-set-row${s.skipped ? ' detail-skipped' : ''}">
            <span class="detail-set-label">${escapeHtml(s.label)}</span>
            ${s.skipped
      ? `<span class="detail-set-reps skipped-text">Übersprungen</span>`
      : `<span class="detail-set-reps">${s.reps} Wdh</span>
                 <span class="detail-set-rpe">${s.rpe ?? '–'}</span>
                 ${s.breakSeconds ? `<span class="detail-set-break">${formatDuration(s.breakSeconds)}</span>` : ''}
                 ${s.note ? `<span class="detail-set-note">${escapeHtml(s.note)}</span>` : ''}`
    }
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');

  // Finisher HTML
  let finisherHtml = '';
  if (workout.finisher && workout.finisher.type) {
    const fin = workout.finisher;
    const finTitle = fin.name ? escapeHtml(fin.name) : `Finisher (${escapeHtml(fin.type)})`;
    finisherHtml = `
      <div class="section">
        <h3 class="section-title">${finTitle}</h3>
        ${fin.entries.map(entry => `
          <div class="card detail-exercise${entry.skipped ? ' detail-skipped-card' : ''}">
            <h4 class="detail-exercise-name">${escapeHtml(entry.name || 'Unbenannt')}${entry.skipped ? ' <span class="badge badge-skipped">Übersprungen</span>' : ''}</h4>
            ${entry.skipped ? '' : (fin.type === 'NORMAL' && entry.sets && entry.sets.length > 0 ? `
              <div class="detail-sets">
                <div class="detail-sets-header">
                  <span>Satz</span>
                  <span>Wdh</span>
                  <span>RPE</span>
                  <span>Pause</span>
                  <span>Notiz</span>
                </div>
                ${entry.sets.map(s => `
                  <div class="detail-set-row${s.skipped ? ' detail-skipped' : ''}">
                    <span class="detail-set-label">${escapeHtml(s.label)}</span>
                    ${s.skipped
        ? `<span class="detail-set-reps skipped-text">Übersprungen</span>`
        : `<span class="detail-set-reps">${s.reps} Wdh</span>
                         <span class="detail-set-rpe">${s.rpe ?? '–'}</span>
                         ${s.breakSeconds ? `<span class="detail-set-break">${formatDuration(s.breakSeconds)}</span>` : ''}
                         ${s.note ? `<span class="detail-set-note">${escapeHtml(s.note)}</span>` : ''}`
      }
                  </div>
                `).join('')}
              </div>
            ` : `
              <div class="detail-sets">
                <div class="detail-set-row detail-result-row">
                  <span class="detail-set-label">Ergebnis</span>
                  <span class="detail-set-reps">${escapeHtml(entry.result || '–')}</span>
                  <span class="detail-set-rpe">RPE ${entry.rpe}</span>
                </div>
                ${entry.note ? `<div class="detail-set-row"><span class="detail-set-label">Notiz</span><span class="detail-set-note">${escapeHtml(entry.note)}</span></div>` : ''}
              </div>
            `)}
          </div>
        `).join('')}
      </div>
    `;
  }

  app.innerHTML = `
    <div class="page page-detail">
      <div class="page-header">
        <button type="button" class="btn-icon" id="btn-back-workout" aria-label="Zurück">${icon('chevronLeft', 20)}</button>
        <div>
          <h2 class="page-title">${escapeHtml(workout.name)}</h2>
          <div style="display: flex; align-items: center; gap: 8px; margin-top: 4px;">
            <span class="text-muted" style="font-size: 13px;">${formatDateTimeDE(workout.date)}</span>
            ${totalSets > 0 ? `<span class="badge" style="background: var(--surface-2); color: var(--text-muted); font-size: 12px; font-weight: 500;">Ø RPE ${avgRpeVal}</span>` : ''}
          </div>
        </div>
      </div>

      <div class="detail-actions">
        <button class="btn btn-ghost" id="btn-share-workout">
          ${icon('share2', 16)} Teilen
        </button>
        <button class="btn btn-ghost" id="btn-edit-workout">
          ${icon('edit', 16)} Bearbeiten
        </button>
        <button class="btn btn-ghost" id="btn-copy-workout">
          ${icon('copy', 16)} Kopieren
        </button>
        <button class="btn btn-ghost" id="btn-repeat-workout">
          ${icon('repeat', 16)} Wiederholen
        </button>
        <button class="btn btn-ghost btn-danger-ghost" id="btn-delete-workout">
          ${icon('trash', 16)} Löschen
        </button>
      </div>

      ${workout.notes && workout.notes.trim() ? `
        <div class="card detail-notes">
          <div class="detail-notes-header">Notizen</div>
          <div class="detail-notes-content">${escapeHtml(workout.notes)}</div>
        </div>
      ` : ''}

      <section class="section">
        <h3 class="section-title">Übungen</h3>
        ${exercisesHtml}
      </section>

      ${finisherHtml}
    </div>
  `;

  // Events
  document.getElementById('btn-back-workout')?.addEventListener('click', (e) => {
    e.preventDefault();
    Router.back('/history');
  });

  document.getElementById('btn-share-workout')?.addEventListener('click', () => {
    if (window.haptic) window.haptic.trigger(20);
    shareWorkoutGraphic(workout);
  });

  document.getElementById('btn-edit-workout').addEventListener('click', () => {
    Router.navigate(`/edit/${workout.workoutId}`);
  });

  document.getElementById('btn-repeat-workout').addEventListener('click', () => {
    Router.navigate(`/create?from=${encodeURIComponent(workout.workoutId)}`);
  });

  document.getElementById('btn-copy-workout').addEventListener('click', () => {
    if (window.haptic) window.haptic.trigger('success');
    copyWorkoutToClipboard(workout);
  });

  document.getElementById('btn-delete-workout').addEventListener('click', () => {
    if (window.haptic) window.haptic.trigger('error');
    showModal({
      title: 'Workout löschen',
      bodyHtml: `<p>Möchtest du <strong>${escapeHtml(workout.name)}</strong> wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.</p>`,
      confirmText: 'Löschen',
      cancelText: 'Abbrechen',
      danger: true,
      onConfirm: async () => {
        if (window.haptic) window.haptic.trigger('success');
        await deleteWorkout(workout.workoutId);
        const draft = await getDraft();
        if (draft && draft.isEdit && draft.editId === workout.workoutId) await clearDraft();
        showToast('Workout gelöscht');
        Router.back('/history');
      }
    });
  });
}

// ── Shareable Graphic Workout Card (F15) ──
async function shareWorkoutGraphic(workout) {
  try {
    let totalRpe = 0;
    let totalSets = 0;
    if (workout.exercises) {
      workout.exercises.forEach(ex => {
        if (ex.sets) {
          ex.sets.forEach(s => {
            if (!s.skipped && s.rpe != null) {
              totalRpe += Number(s.rpe) || 0;
              totalSets++;
            }
          });
        }
      });
    }

    if (workout.finisher && workout.finisher.entries) {
      workout.finisher.entries.forEach(entry => {
        if (entry.skipped) return;
        if (workout.finisher.type === 'NORMAL' && entry.sets) {
          entry.sets.forEach(s => {
            if (!s.skipped && s.rpe != null) {
              totalRpe += Number(s.rpe) || 0;
              totalSets++;
            }
          });
        } else if (entry.rpe) {
          totalRpe += Number(entry.rpe) || 0;
          totalSets++;
        }
      });
    }

    const avgRpe = totalSets > 0 ? (totalRpe / totalSets).toFixed(1).replace('.0', '') : '-';

    const baseWidth = 580;
    const padding = 24;
    const contentWidth = baseWidth - padding * 2;

    function drawRoundedRect(ctx, x, y, w, h, r, fill, stroke) {
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(x, y, w, h, r);
      } else {
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
      }
      if (fill) {
        ctx.fillStyle = fill;
        ctx.fill();
      }
      if (stroke) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    function truncateText(ctx, text, maxWidth) {
      if (!text) return '';
      if (ctx.measureText(text).width <= maxWidth) return text;
      let s = String(text);
      while (s.length > 0 && ctx.measureText(s + '...').width > maxWidth) {
        s = s.slice(0, -1);
      }
      return s + '...';
    }

    function wrapText(ctx, text, maxWidth) {
      const words = String(text).replace(/\r\n/g, '\n').split(/\s+/);
      const lines = [];
      let currentLine = '';
      for (const word of words) {
        const testLine = currentLine ? currentLine + ' ' + word : word;
        if (ctx.measureText(testLine).width > maxWidth && currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) lines.push(currentLine);
      return lines;
    }

    function drawBadge(ctx, text, x, y, bgColor, borderColor, textColor, fontSize = 11) {
      ctx.font = `600 ${fontSize}px Archivo, system-ui, -apple-system, sans-serif`;
      const textWidth = ctx.measureText(text).width;
      const badgeH = fontSize + 8;
      const badgeW = textWidth + 14;
      drawRoundedRect(ctx, x, y, badgeW, badgeH, 4, bgColor, borderColor);
      ctx.fillStyle = textColor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, x + badgeW / 2, y + badgeH / 2);
      return badgeW;
    }

    // Measure element heights
    const measureCanvas = document.createElement('canvas');
    const mCtx = measureCanvas.getContext('2d') || {
      measureText: () => ({ width: 100 })
    };

    let estHeight = padding;
    estHeight += 24 + 14;
    estHeight += 26 + 8;
    estHeight += 24 + 20;

    let noteLines = [];
    if (workout.notes && workout.notes.trim()) {
      mCtx.font = '400 13px Archivo, system-ui, -apple-system, sans-serif';
      noteLines = wrapText(mCtx, workout.notes.trim(), contentWidth - 32);
      estHeight += 14 + 16 + 8 + noteLines.length * 20 + 14 + 14;
    }

    const exercises = workout.exercises || [];
    exercises.forEach(ex => {
      const setCount = (ex.sets || []).length;
      estHeight += 26 + 10 + 20 + Math.max(1, setCount) * 26 + 28 + 14;
    });

    if (workout.finisher && workout.finisher.type) {
      const fin = workout.finisher;
      const entries = fin.entries || [];
      estHeight += 24 + 8;
      entries.forEach(entry => {
        if (fin.type === 'NORMAL' && entry.sets && entry.sets.length > 0) {
          estHeight += 24 + 10 + 20 + entry.sets.length * 26 + 24 + 12;
        } else {
          estHeight += 24 + 26 + (entry.note ? 22 : 0) + 24 + 12;
        }
      });
      estHeight += 6;
    }

    estHeight += 24 + padding;

    const totalHeight = Math.ceil(estHeight);

    const dpr = 2;
    const canvas = document.createElement('canvas');
    canvas.width = baseWidth * dpr;
    canvas.height = totalHeight * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      showToast('Grafik konnte nicht erstellt werden');
      return;
    }
    ctx.scale(dpr, dpr);

    // Load logo image
    const logoImg = new Image();
    logoImg.src = 'icons/icon-512.png';
    await new Promise(resolve => {
      if (logoImg.complete && logoImg.naturalWidth > 0) return resolve();
      logoImg.onload = () => resolve();
      logoImg.onerror = () => resolve();
      setTimeout(resolve, 200);
    });

    // Canvas background
    ctx.fillStyle = '#0f0e0c';
    ctx.fillRect(0, 0, baseWidth, totalHeight);

    // Subtle inner border
    drawRoundedRect(ctx, 8, 8, baseWidth - 16, totalHeight - 16, 16, null, '#2a2824');

    let y = padding;

    // Header: Circular logo + "Track It!" branding
    ctx.save();
    ctx.beginPath();
    ctx.arc(padding + 12, y + 12, 12, 0, Math.PI * 2);
    ctx.clip();
    if (logoImg.complete && logoImg.naturalWidth > 0) {
      ctx.drawImage(logoImg, padding, y, 24, 24);
    } else {
      ctx.fillStyle = '#ff6b1f';
      ctx.fillRect(padding, y, 24, 24);
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 12px Archivo, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('T', padding + 12, y + 12);
    }
    ctx.restore();

    ctx.fillStyle = '#ededed';
    ctx.font = '700 14px Archivo, system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('Track It!', padding + 32, y + 12);
    y += 36;

    // Workout Name
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 22px Archivo, system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const workoutName = truncateText(ctx, workout.name || 'Workout', contentWidth);
    ctx.fillText(workoutName, padding, y);
    y += 28;

    // Meta row: Date/time + Type badge + Ø RPE badge
    ctx.font = '400 13px Archivo, system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#a1a1aa';
    ctx.textBaseline = 'middle';
    const dateStr = formatDateTimeDE(workout.date);
    ctx.fillText(dateStr, padding, y + 10);
    let metaX = padding + ctx.measureText(dateStr).width + 12;

    if (workout.type) {
      const typeBadgeW = drawBadge(ctx, workout.type, metaX, y, 'rgba(255, 255, 255, 0.06)', 'rgba(255, 255, 255, 0.12)', '#d4d4d8', 11);
      metaX += typeBadgeW + 8;
    }

    if (totalSets > 0) {
      const rpeBadgeW = drawBadge(ctx, `Ø RPE ${avgRpe}`, metaX, y, 'rgba(255, 107, 31, 0.12)', 'rgba(255, 107, 31, 0.3)', '#ff8540', 11);
      metaX += rpeBadgeW + 8;
    }

    y += 34;

    // Notes Card
    if (workout.notes && workout.notes.trim() && noteLines.length > 0) {
      const noteCardH = 14 + 14 + 6 + noteLines.length * 20 + 12;
      drawRoundedRect(ctx, padding, y, contentWidth, noteCardH, 10, '#171613', '#2a2824');

      ctx.fillStyle = '#a1a1aa';
      ctx.font = '600 10px Archivo, system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('NOTIZEN', padding + 16, y + 14);

      ctx.fillStyle = '#e4e4e7';
      ctx.font = '400 13px Archivo, system-ui, -apple-system, sans-serif';
      let ny = y + 32;
      noteLines.forEach(line => {
        ctx.fillText(line, padding + 16, ny);
        ny += 20;
      });

      y += noteCardH + 14;
    }

    // Exercises Cards
    exercises.forEach(ex => {
      const sets = ex.sets || [];
      const exCardH = 14 + 20 + 10 + 20 + Math.max(1, sets.length) * 26 + 14;
      drawRoundedRect(ctx, padding, y, contentWidth, exCardH, 10, '#171613', '#2a2824');

      ctx.fillStyle = '#ffffff';
      ctx.font = '600 15px Archivo, system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const modeText = ex.mode === 'lr' ? 'Links/Rechts' : 'Normal';
      const badgeW = 76;
      const exName = truncateText(ctx, ex.name || 'Unbenannte Übung', contentWidth - 32 - badgeW - 10);
      ctx.fillText(exName, padding + 16, y + 24);

      drawBadge(ctx, modeText, padding + contentWidth - 16 - badgeW, y + 14, 'rgba(255, 255, 255, 0.05)', 'rgba(255, 255, 255, 0.1)', '#a1a1aa', 10);

      const tableY = y + 44;
      const colX = {
        satz: padding + 16,
        wdh: padding + 68,
        rpe: padding + 140,
        pause: padding + 212,
        notiz: padding + 292
      };

      ctx.fillStyle = '#71717a';
      ctx.font = '600 10px Archivo, system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('SATZ', colX.satz, tableY + 8);
      ctx.fillText('WDH', colX.wdh, tableY + 8);
      ctx.fillText('RPE', colX.rpe, tableY + 8);
      ctx.fillText('PAUSE', colX.pause, tableY + 8);
      ctx.fillText('NOTIZ', colX.notiz, tableY + 8);

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padding + 16, tableY + 18);
      ctx.lineTo(padding + contentWidth - 16, tableY + 18);
      ctx.stroke();

      let setY = tableY + 24;
      sets.forEach((s, sIdx) => {
        ctx.textBaseline = 'middle';

        ctx.fillStyle = '#f4f4f5';
        ctx.font = '600 12px Archivo, system-ui, -apple-system, sans-serif';
        ctx.fillText(s.label || String(sIdx + 1), colX.satz, setY + 8);

        if (s.skipped) {
          ctx.fillStyle = '#71717a';
          ctx.font = 'italic 12px Archivo, system-ui, -apple-system, sans-serif';
          ctx.fillText('Übersprungen', colX.wdh, setY + 8);
        } else {
          ctx.fillStyle = '#d4d4d8';
          ctx.font = '500 12px Archivo, system-ui, -apple-system, sans-serif';
          ctx.fillText(`${s.reps} Wdh`, colX.wdh, setY + 8);

          ctx.fillStyle = '#d4d4d8';
          ctx.font = '500 12px Archivo, system-ui, -apple-system, sans-serif';
          ctx.fillText(`RPE ${s.rpe ?? '–'}`, colX.rpe, setY + 8);

          ctx.fillStyle = '#a1a1aa';
          ctx.font = '400 12px Archivo, system-ui, -apple-system, sans-serif';
          const pauseStr = s.breakSeconds ? `${s.breakSeconds}s` : '–';
          ctx.fillText(pauseStr, colX.pause, setY + 8);

          ctx.fillStyle = '#71717a';
          ctx.font = '400 11px Archivo, system-ui, -apple-system, sans-serif';
          const maxNoteW = contentWidth - (colX.notiz - padding) - 16;
          const noteStr = s.note ? truncateText(ctx, s.note, maxNoteW) : '–';
          ctx.fillText(noteStr, colX.notiz, setY + 8);
        }

        if (sIdx < sets.length - 1) {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
          ctx.beginPath();
          ctx.moveTo(padding + 16, setY + 21);
          ctx.lineTo(padding + contentWidth - 16, setY + 21);
          ctx.stroke();
        }

        setY += 26;
      });

      y += exCardH + 14;
    });

    // Finisher Card
    if (workout.finisher && workout.finisher.type) {
      const fin = workout.finisher;
      const finTitle = fin.name || `Finisher (${fin.type})`;

      ctx.fillStyle = '#ffffff';
      ctx.font = '700 15px Archivo, system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(finTitle, padding, y);
      y += 24;

      (fin.entries || []).forEach(entry => {
        if (fin.type === 'NORMAL' && entry.sets && entry.sets.length > 0) {
          const entryH = 14 + 20 + 10 + 20 + entry.sets.length * 26 + 14;
          drawRoundedRect(ctx, padding, y, contentWidth, entryH, 10, '#171613', '#2a2824');

          ctx.fillStyle = '#ffffff';
          ctx.font = '600 14px Archivo, system-ui, -apple-system, sans-serif';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(truncateText(ctx, entry.name || 'Unbenannt', contentWidth - 40), padding + 16, y + 20);

          const tableY = y + 36;
          const colX = {
            satz: padding + 16,
            wdh: padding + 68,
            rpe: padding + 140,
            pause: padding + 212,
            notiz: padding + 292
          };

          ctx.fillStyle = '#71717a';
          ctx.font = '600 10px Archivo, system-ui, -apple-system, sans-serif';
          ctx.fillText('SATZ', colX.satz, tableY + 8);
          ctx.fillText('WDH', colX.wdh, tableY + 8);
          ctx.fillText('RPE', colX.rpe, tableY + 8);
          ctx.fillText('PAUSE', colX.pause, tableY + 8);
          ctx.fillText('NOTIZ', colX.notiz, tableY + 8);

          ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
          ctx.beginPath();
          ctx.moveTo(padding + 16, tableY + 18);
          ctx.lineTo(padding + contentWidth - 16, tableY + 18);
          ctx.stroke();

          let setY = tableY + 24;
          entry.sets.forEach((s, sIdx) => {
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#f4f4f5';
            ctx.font = '600 12px Archivo, system-ui, -apple-system, sans-serif';
            ctx.fillText(s.label || String(sIdx + 1), colX.satz, setY + 8);

            if (s.skipped) {
              ctx.fillStyle = '#71717a';
              ctx.font = 'italic 12px Archivo, system-ui, -apple-system, sans-serif';
              ctx.fillText('Übersprungen', colX.wdh, setY + 8);
            } else {
              ctx.fillStyle = '#d4d4d8';
              ctx.font = '500 12px Archivo, system-ui, -apple-system, sans-serif';
              ctx.fillText(`${s.reps} Wdh`, colX.wdh, setY + 8);
              ctx.fillText(`RPE ${s.rpe ?? '–'}`, colX.rpe, setY + 8);
              ctx.fillStyle = '#a1a1aa';
              ctx.font = '400 12px Archivo, system-ui, -apple-system, sans-serif';
              ctx.fillText(s.breakSeconds ? `${s.breakSeconds}s` : '–', colX.pause, setY + 8);
              ctx.fillStyle = '#71717a';
              ctx.font = '400 11px Archivo, system-ui, -apple-system, sans-serif';
              ctx.fillText(s.note ? truncateText(ctx, s.note, 190) : '–', colX.notiz, setY + 8);
            }

            setY += 26;
          });

          y += entryH + 12;
        } else {
          const entryH = 14 + 20 + 24 + (entry.note ? 22 : 0) + 14;
          drawRoundedRect(ctx, padding, y, contentWidth, entryH, 10, '#171613', '#2a2824');

          ctx.fillStyle = '#ffffff';
          ctx.font = '600 14px Archivo, system-ui, -apple-system, sans-serif';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(truncateText(ctx, entry.name || 'Unbenannt', contentWidth - 40), padding + 16, y + 20);

          ctx.font = '500 12px Archivo, system-ui, -apple-system, sans-serif';
          ctx.fillStyle = '#d4d4d8';
          ctx.fillText(`Ergebnis: ${entry.result || '–'}   ·   RPE: ${entry.rpe || '–'}`, padding + 16, y + 44);

          if (entry.note) {
            ctx.font = '400 11px Archivo, system-ui, -apple-system, sans-serif';
            ctx.fillStyle = '#71717a';
            ctx.fillText(`Notiz: ${entry.note}`, padding + 16, y + 66);
          }

          y += entryH + 12;
        }
      });
      y += 6;
    }

    // Footer branding
    ctx.fillStyle = '#52525b';
    ctx.font = '500 11px Archivo, system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('Track It! · Offline & Privat', baseWidth / 2, totalHeight - padding + 10);

    canvas.toBlob(async (blob) => {
      if (!blob) {
        showToast('Grafik konnte nicht erstellt werden');
        return;
      }
      const cleanName = (workout.name || 'workout').toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_');
      const filename = `${cleanName}-${formatDateDE(workout.date).replace(/\./g, '-')}.png`;
      const file = new File([blob], filename, { type: 'image/png' });

      if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share) {
        try {
          await navigator.share({
            files: [file],
            title: workout.name,
            text: `Workout ${workout.name} mit Track It!`
          });
          showToast('Workout geteilt');
          return;
        } catch (err) {
          if (err && err.name === 'AbortError') return;
        }
      }

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
      showToast('Workout-Grafik heruntergeladen');
    }, 'image/png');
  } catch (err) {
    showToast('Grafik konnte nicht erstellt werden');
  }
}
