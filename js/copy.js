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
        // Sides come from the set labels, so "right first" exercises stay correct
        const pairs = [];
        for (let i = 0; i < sets.length; i += 2) {
            const first = sets[i];
            const second = sets[i + 1];
            const firstSide = sideOfSet(first, 'L');
            pairs.push({
                first,
                second,
                L: firstSide === 'L' ? first : second,
                R: firstSide === 'L' ? second : first
            });
        }
        const order = pairs.length && sideOfSet(pairs[0].first, 'L') === 'R' ? ['R', 'L'] : ['L', 'R'];
        const pauses = pairs.map(copyPairPause);
        const sameSides = pairs.every(p => p.second &&
            copyReps(p.L) === copyReps(p.R) &&
            copyRpe(p.L) === copyRpe(p.R));

        if (sameSides) {
            const rpes = pairs.map(p => copyRpe(p.first));
            lines.push(copyLine(`${name} (L=R): ${pairs.map(p => copyReps(p.first)).join('/')}`, rpes, pauses));
        } else {
            const side = s => pairs.map(p => p[s]);
            const rpe = s => side(s).map(copyRpe);
            const head = `${name}: ${order.map(s => `${s}: ${side(s).map(copyReps).join('/')}`).join(' · ')}`;
            const parts = [head];
            if (order.some(s => hasValues(rpe(s)))) parts.push(`RPE ${order.map(s => `${s}: ${rpe(s).join('/')}`).join(' · ')}`);
            if (hasValues(pauses)) parts.push(`P ${pauses.join('/')}`);
            lines.push(parts.join(' · '));
        }

        pairs.forEach((p, i) => {
            for (const s of order) {
                if (copyNote(p[s])) notes.push(`S${i + 1} ${s}: ${copyNote(p[s])}`);
            }
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

// The pause of a left/right pair is the one after its second side. A pause
// logged after the first side as well is kept as "first+second".
function copyPairPause(pair) {
    const last = copyPause(pair.second || pair.first);
    const between = pair.second ? copyDuration(pair.first && pair.first.breakSeconds) : '';
    return between ? `${between}+${last}` : last;
}

function sideOfSet(set, fallback) {
    const label = String(set && set.label || '');
    if (label.includes('rechts')) return 'R';
    if (label.includes('links')) return 'L';
    return fallback;
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
