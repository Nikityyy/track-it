function exportWorkoutMarkdown(workout) {
    const dateStr = formatDateDE(workout.date);
    let md = `# ${workout.name || workout.type + ' - ' + dateStr}\n\n`;

    if (workout.exercises && workout.exercises.length > 0) {
        md += `## Übungen\n\n`;
        for (const ex of workout.exercises) {
            md += `### ${ex.name || 'Unbenannte Übung'}\n`;
            md += exportSetsMarkdownTable(ex.sets);
        }
    }

    if (workout.finisher && workout.finisher.type) {
        const finTitle = workout.finisher.name || `Finisher (${workout.finisher.type})`;
        md += `## ${finTitle}\n\n`;
        if (workout.finisher.entries) {
            for (const entry of workout.finisher.entries) {
                md += `### ${entry.name || 'Unbenannt'}`;
                if (entry.skipped) {
                    md += ` ~~Übersprungen~~\n\n`;
                    continue;
                }
                md += '\n';
                if (workout.finisher.type === 'NORMAL' && entry.sets && entry.sets.length > 0) {
                    md += exportSetsMarkdownTable(entry.sets);
                } else {
                    md += `- Ergebnis: ${entry.result || '–'} | RPE ${entry.rpe ?? '–'}\n`;
                    const noteText = entry.note && entry.note.trim() ? entry.note.trim() : '–';
                    md += `- Notiz: ${noteText}\n\n`;
                }
            }
        }
    }

    const notes = (workout.notes || workout.note || '').trim();
    if (notes) {
        md += `## Notizen\n\n${notes}\n\n`;
    }

    return md.trimEnd() + '\n';
}

function exportSetsMarkdownTable(sets) {
    let md = '| Satz | Wdh | RPE | Pause | Notiz |\n';
    md += '|---|---:|---:|---:|---|\n';
    for (const set of sets || []) {
        const noteText = set.note && set.note.trim() ? escapeMarkdownCell(set.note.trim()) : '–';
        const pauseText = set.breakSeconds ? formatDuration(set.breakSeconds) : '–';
        if (set.skipped) {
            md += `| ${escapeMarkdownCell(set.label)} | Übersprungen | – | ${pauseText} | ${noteText} |\n`;
        } else {
            md += `| ${escapeMarkdownCell(set.label)} | ${set.reps} | ${set.rpe ?? '–'} | ${pauseText} | ${noteText} |\n`;
        }
    }
    return md + '\n';
}

function exportWorkoutCompact(workout) {
    const dateStr = formatDateDE(workout.date);
    const lines = [`# ${workout.name || workout.type + ' – ' + dateStr}`];

    for (const ex of workout.exercises || []) {
        const name = normalizeWeightDecimals(ex.name || 'Unbenannte Übung');
        lines.push(...compactSetLines(name, ex.sets || [], ex.mode));
    }

    if (workout.finisher && workout.finisher.type) {
        for (const entry of workout.finisher.entries || []) {
            const name = normalizeWeightDecimals(entry.name || 'Unbenannt');
            if (entry.skipped) {
                lines.push(`Finisher ${name}: x`);
            } else if (workout.finisher.type === 'NORMAL' && entry.sets && entry.sets.length > 0) {
                lines.push(...compactSetLines(`Finisher ${name}`, entry.sets, entry.mode));
            } else {
                lines.push(`Finisher ${name}: ${entry.result || '–'} · RPE ${compactValue(entry.rpe)}`);
            }
        }
    }

    const notes = (workout.notes || workout.note || '').trim();
    if (notes) lines.push(`Notizen: ${notes}`);

    return lines.join('\n') + '\n';
}

function compactSetLines(name, sets, mode) {
    const lines = [];
    const notes = [];

    if (mode === 'lr') {
        const pairs = [];
        for (let i = 0; i < sets.length; i += 2) {
            pairs.push({ left: sets[i], right: sets[i + 1] });
        }
        const pauses = pairs.map(p => compactPause(p.right || p.left));
        const sameSides = pairs.every(p => p.right &&
            compactReps(p.left) === compactReps(p.right) &&
            compactRpe(p.left) === compactRpe(p.right));

        if (sameSides) {
            lines.push(`${name} (L=R): ${pairs.map(p => compactReps(p.left)).join('/')} · RPE ${pairs.map(p => compactRpe(p.left)).join('/')} · P ${pauses.join('/')}`);
        } else {
            const left = pairs.map(p => p.left);
            const right = pairs.map(p => p.right);
            lines.push(`${name}: L: ${left.map(compactReps).join('/')} · R: ${right.map(compactReps).join('/')} · RPE L: ${left.map(compactRpe).join('/')} · R: ${right.map(compactRpe).join('/')} · P ${pauses.join('/')}`);
        }

        pairs.forEach((p, i) => {
            if (compactNote(p.left)) notes.push(`S${i + 1} L: ${compactNote(p.left)}`);
            if (compactNote(p.right)) notes.push(`S${i + 1} R: ${compactNote(p.right)}`);
        });
    } else {
        lines.push(`${name}: ${sets.map(compactReps).join('/')} · RPE ${sets.map(compactRpe).join('/')} · P ${sets.map(compactPause).join('/')}`);
        sets.forEach((set, i) => {
            if (compactNote(set)) notes.push(`S${i + 1}: ${compactNote(set)}`);
        });
    }

    if (notes.length > 0) lines.push(`Notiz: ${notes.join('; ')}`);
    return lines;
}

function compactValue(value) {
    return value === null || value === undefined || value === '' ? '–' : String(value);
}

function compactReps(set) {
    if (!set) return '–';
    return set.skipped ? 'x' : compactValue(set.reps);
}

function compactRpe(set) {
    if (!set) return '–';
    return set.skipped ? 'x' : compactValue(set.rpe);
}

function compactPause(set) {
    if (!set) return '–';
    if (set.skipped) return 'x';
    const total = Number(set.breakSeconds) || 0;
    if (total <= 0) return '–';
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

function compactNote(set) {
    return set && set.note ? set.note.trim().replace(/\s*\r?\n\s*/g, ' ') : '';
}

function normalizeWeightDecimals(name) {
    return String(name).replace(/(\d+)\.(\d+)(?=\s*kg\b)/gi, '$1,$2');
}

function escapeMarkdownCell(value) {
    return String(value == null ? '' : value)
        .replace(/\|/g, '\\|')
        .replace(/\r?\n/g, '<br>');
}

async function copyMarkdownToClipboard(workout) {
    const md = exportWorkoutMarkdown(workout);
    try {
        await navigator.clipboard.writeText(md);
        showToast('Markdown kopiert!');
    } catch (e) {
        const ta = document.createElement('textarea');
        ta.value = md;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        showToast('Markdown kopiert!');
    }
}

async function copyCompactToClipboard(workout) {
    const text = exportWorkoutCompact(workout);
    try {
        await navigator.clipboard.writeText(text);
        showToast('Kompakt kopiert!');
    } catch (e) {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        showToast('Kompakt kopiert!');
    }
}
