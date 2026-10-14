/* Copy text export: everything a workout holds, in as few characters as
 * possible (short to paste, cheap in tokens). Only what was actually entered
 * appears: no empty exercises, no empty finisher, no all-empty RPE/pause parts.
 *
 *   # Push – Brust schwer
 *   Bankdrücken 72,5kg: 8/7/6 · RPE 7/8/9 · P 2:30/2:30/3:00
 *   Notiz: S2: Letzte Wdh zäh
 *   Finisher Liegestütz-AMRAP (AMRAP)
 *   Liegestütze: 4 Runden + 7 · RPE 9
 *   Notizen: …
 */
function workoutCopyText(workout) {
    const dateStr = formatDateDE(workout.date);
    const lines = [`# ${workout.name || workout.type + ' – ' + dateStr}`];

    for (const ex of workout.exercises || []) {
        const sets = ex.sets || [];
        if (!(ex.name || '').trim() && !sets.some(setHasContent)) continue;
        const name = normalizeWeightDecimals((ex.name || '').trim() || 'Unbenannte Übung');
        lines.push(...copySetLines(name, sets, ex.mode));
    }

    if (workout.finisher && workout.finisher.type) {
        const fin = workout.finisher;
        const usesSets = (entry) => fin.type === 'NORMAL' && Array.isArray(entry.sets) && entry.sets.some(setHasContent);
        const entries = (fin.entries || []).filter(entry =>
            (entry.name || '').trim() || (entry.result || '').trim() || copyNote(entry) || usesSets(entry));
        if (entries.length > 0) {
            const finName = (fin.name || '').trim();
            lines.push(`Finisher ${finName ? normalizeWeightDecimals(finName) + ' ' : ''}(${fin.type})`);
            for (const entry of entries) {
                const name = normalizeWeightDecimals((entry.name || '').trim() || 'Unbenannt');
                if (entry.skipped) {
                    lines.push(`${name}: x`);
                } else if (usesSets(entry)) {
                    lines.push(...copySetLines(name, entry.sets, entry.mode));
                    continue;
                } else {
                    const parts = [];
                    if ((entry.result || '').trim()) parts.push(entry.result.trim());
                    if (copyValue(entry.rpe) !== '–') parts.push(`RPE ${entry.rpe}`);
                    lines.push(parts.length ? `${name}: ${parts.join(' · ')}` : name);
                }
                if (copyNote(entry)) lines.push(`Notiz: ${copyNote(entry)}`);
            }
        }
    }

    const notes = (workout.notes || workout.note || '').trim();
    if (notes) lines.push(`Notizen: ${notes}`);

    return lines.join('\n') + '\n';
}

function copySetLines(name, sets, mode) {
    const lines = [];
    const notes = [];

    if (mode === 'lr') {
        const pairs = [];
        for (let i = 0; i < sets.length; i += 2) {
            pairs.push({ left: sets[i], right: sets[i + 1] });
        }
        const pauses = pairs.map(copyPairPause);
        const sameSides = pairs.every(p => p.right &&
            copyReps(p.left) === copyReps(p.right) &&
            copyRpe(p.left) === copyRpe(p.right));

        if (sameSides) {
            const rpes = pairs.map(p => copyRpe(p.left));
            lines.push(copyLine(`${name} (L=R): ${pairs.map(p => copyReps(p.left)).join('/')}`, rpes, pauses));
        } else {
            const left = pairs.map(p => p.left);
            const right = pairs.map(p => p.right);
            const rpeL = left.map(copyRpe);
            const rpeR = right.map(copyRpe);
            const head = `${name}: L: ${left.map(copyReps).join('/')} · R: ${right.map(copyReps).join('/')}`;
            const parts = [head];
            if (hasValues(rpeL) || hasValues(rpeR)) parts.push(`RPE L: ${rpeL.join('/')} · R: ${rpeR.join('/')}`);
            if (hasValues(pauses)) parts.push(`P ${pauses.join('/')}`);
            lines.push(parts.join(' · '));
        }

        pairs.forEach((p, i) => {
            if (copyNote(p.left)) notes.push(`S${i + 1} L: ${copyNote(p.left)}`);
            if (copyNote(p.right)) notes.push(`S${i + 1} R: ${copyNote(p.right)}`);
        });
    } else {
        lines.push(copyLine(`${name}: ${sets.map(copyReps).join('/')}`, sets.map(copyRpe), sets.map(copyPause)));
        sets.forEach((set, i) => {
            if (copyNote(set)) notes.push(`S${i + 1}: ${copyNote(set)}`);
        });
    }

    if (notes.length > 0) lines.push(`Notiz: ${notes.join('; ')}`);
    return lines;
}

// "RPE …" and "P …" only appear when at least one set has a value there
function copyLine(head, rpes, pauses) {
    const parts = [head];
    if (hasValues(rpes)) parts.push(`RPE ${rpes.join('/')}`);
    if (hasValues(pauses)) parts.push(`P ${pauses.join('/')}`);
    return parts.join(' · ');
}

function hasValues(values) {
    return values.some(v => v !== '–' && v !== 'x');
}

function setHasContent(set) {
    if (!set) return false;
    return Boolean(set.skipped) || (Number(set.reps) || 0) > 0 ||
        (set.rpe !== null && set.rpe !== undefined && set.rpe !== '') ||
        (Number(set.breakSeconds) || 0) > 0 || Boolean(copyNote(set));
}

function copyValue(value) {
    return value === null || value === undefined || value === '' ? '–' : String(value);
}

function copyReps(set) {
    if (!set) return '–';
    return set.skipped ? 'x' : copyValue(set.reps);
}

function copyRpe(set) {
    if (!set) return '–';
    return set.skipped ? 'x' : copyValue(set.rpe);
}

function copyDuration(seconds) {
    const total = Number(seconds) || 0;
    if (total <= 0) return '';
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

function copyPause(set) {
    if (!set) return '–';
    const time = copyDuration(set.breakSeconds);
    if (set.skipped) return time || 'x';
    return time || '–';
}

// The pause of a left/right pair is the one after the right side. A pause
// logged after the left side as well is kept as "left+right".
function copyPairPause(pair) {
    const right = copyPause(pair.right || pair.left);
    const left = pair.right ? copyDuration(pair.left && pair.left.breakSeconds) : '';
    return left ? `${left}+${right}` : right;
}

function copyNote(item) {
    return item && item.note ? String(item.note).trim().replace(/\s*\r?\n\s*/g, ' ') : '';
}

function normalizeWeightDecimals(name) {
    return String(name).replace(/(\d+)\.(\d+)(?=\s*kg\b)/gi, '$1,$2');
}

async function copyWorkoutToClipboard(workout) {
    const text = workoutCopyText(workout);
    try {
        await navigator.clipboard.writeText(text);
        showToast('Kopiert');
    } catch (e) {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        showToast('Kopiert');
    }
}
