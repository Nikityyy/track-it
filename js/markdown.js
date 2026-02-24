function exportWorkoutMarkdown(workout) {
    const dateStr = formatDateDE(workout.date);
    let md = `# ${workout.type} – ${dateStr}\n\n`;

    // Übungen
    if (workout.exercises && workout.exercises.length > 0) {
        md += `## Übungen\n\n`;
        for (const ex of workout.exercises) {
            md += `### ${ex.name || 'Unbenannte Übung'}\n`;
            for (const set of ex.sets) {
                const noteText = set.note && set.note.trim() ? set.note.trim() : '–';
                md += `- ${set.label}: ${set.reps} Wdh | RPE ${set.rpe} | Notiz: ${noteText}\n`;
            }
            md += '\n';
        }
    }

    // Finisher
    if (workout.finisher && workout.finisher.type) {
        md += `## Finisher (${workout.finisher.type})\n\n`;
        if (workout.finisher.entries) {
            for (const entry of workout.finisher.entries) {
                md += `### ${entry.name || 'Unbenannt'}\n`;
                if (workout.finisher.type === 'NORMAL' && entry.sets && entry.sets.length > 0) {
                    // Set-based finisher
                    for (const set of entry.sets) {
                        const noteText = set.note && set.note.trim() ? set.note.trim() : '–';
                        md += `- ${set.label}: ${set.reps} Wdh | RPE ${set.rpe} | Notiz: ${noteText}\n`;
                    }
                } else {
                    // AMRAP / EMOM — result-based
                    md += `- Ergebnis: ${entry.result || '–'} | RPE ${entry.rpe}\n`;
                    const noteText = entry.note && entry.note.trim() ? entry.note.trim() : '–';
                    md += `- Notiz: ${noteText}\n`;
                }
                md += '\n';
            }
        }
    }

    return md.trimEnd() + '\n';
}

async function copyMarkdownToClipboard(workout) {
    const md = exportWorkoutMarkdown(workout);
    try {
        await navigator.clipboard.writeText(md);
        showToast('Markdown kopiert!');
    } catch (e) {
        // Fallback
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
