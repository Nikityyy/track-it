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
                    md += `- Ergebnis: ${entry.result || '–'} | RPE ${entry.rpe}\n`;
                    const noteText = entry.note && entry.note.trim() ? entry.note.trim() : '–';
                    md += `- Notiz: ${noteText}\n\n`;
                }
            }
        }
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
            md += `| ${escapeMarkdownCell(set.label)} | ${set.reps} | ${set.rpe} | ${pauseText} | ${noteText} |\n`;
        }
    }
    return md + '\n';
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
