/* Exercise index built from saved workouts.
 *
 * Weights live in the exercise name ("Bankdrücken 72.5kg"), so the same
 * exercise at different weights would look like different exercises. The key
 * strips the weight and normalises case and accents; the weight is parsed out
 * separately so the progress view can chart it. */

const WEIGHT_PATTERN = /(\d+(?:[.,]\d+)?)\s*(kg|lbs?)\b/i;
// The whole weight expression with what usually surrounds it: "(72.5kg)",
// "@ 72.5 kg", "+10kg", "– 70kg", "60-70kg", "2x20kg", "2x 12.5kg"
const WEIGHT_EXPRESSION = /[\s(@+–—-]*(?:\d+\s*[x×]\s*)?(?:\d+(?:[.,]\d+)?\s*[-–]\s*)?\d+(?:[.,]\d+)?\s*(?:kg|lbs?)\b\s*\)?/gi;

function exerciseWeight(name) {
    // "60-70kg" reads as the top weight; "2x20kg" as the weight per hand
    const match = String(name || '').match(/(\d+(?:[.,]\d+)?)\s*(kg|lbs?)\b/i);
    if (!match) return null;
    const value = parseFloat(match[1].replace(',', '.'));
    return Number.isFinite(value) ? { value, unit: match[2].toLowerCase() === 'kg' ? 'kg' : 'lb' } : null;
}

function exerciseBaseName(name) {
    return String(name || '')
        .replace(WEIGHT_EXPRESSION, ' ')
        .replace(/\(\s*\)/g, ' ')
        .replace(/\s+[@+–—-]\s*$/, '')
        .replace(/^[\s|·:,–—-]+|[\s|·:,–—-]+$/g, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
}

function normalizeForSearch(text) {
    return String(text || '')
        .toLowerCase()
        .replace(/ß/g, 'ss')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function exerciseKey(name) {
    return normalizeForSearch(exerciseBaseName(name));
}

/* Every exercise (and finisher entry with sets) across all workouts, newest
 * session first. */
function buildExerciseIndex(workouts) {
    const map = new Map();
    const add = (rawName, sets, mode, workout, source) => {
        const name = String(rawName || '');
        const key = exerciseKey(name);
        if (!key) return;
        let item = map.get(key);
        if (!item) {
            item = { key, name: exerciseBaseName(name), latestName: name.trim(), count: 0, lastDate: null, types: {}, sessions: [] };
            map.set(key, item);
        }
        item.count++;
        const type = workout.type || 'Andere';
        item.types[type] = (item.types[type] || 0) + 1;
        item.sessions.push({
            workoutId: workout.workoutId,
            workoutName: workout.name || workout.type || '',
            date: workout.date,
            fullName: name.trim(),
            weight: exerciseWeight(name),
            mode: mode === 'lr' ? 'lr' : 'normal',
            sets: Array.isArray(sets) ? sets : [],
            source
        });
    };

    for (const w of workouts || []) {
        for (const ex of w.exercises || []) add(ex.name, ex.sets, ex.mode, w, 'exercise');
        if (w.finisher && w.finisher.type === 'NORMAL') {
            for (const entry of w.finisher.entries || []) {
                if (entry.sets && entry.sets.length) add(entry.name, entry.sets, entry.mode, w, 'finisher');
            }
        }
    }

    for (const item of map.values()) {
        item.sessions.sort((a, b) => new Date(b.date) - new Date(a.date));
        item.lastDate = item.sessions[0] ? item.sessions[0].date : null;
        // Show the name the way it was written most recently
        item.name = exerciseBaseName(item.sessions[0].fullName) || item.name;
        item.latestName = item.sessions[0].fullName;
    }
    return map;
}

/* Names for the suggestion list: everything that matches what is typed and
 * was done within the last month, most often done first (ties: most recent). */
function suggestExercises(index, query, options = {}) {
    const q = normalizeForSearch(query);
    const exclude = new Set((options.exclude || []).map(exerciseKey));
    const limit = options.limit || 5;
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - 1);

    const matches = [];
    for (const item of index.values()) {
        if (exclude.has(item.key)) continue;
        if (!item.lastDate || new Date(item.lastDate) < cutoff) continue;
        if (q && !item.key.includes(q)) continue;
        if (q && item.key === q) continue; // already typed in full
        matches.push(item);
    }
    matches.sort((a, b) => b.count - a.count || new Date(b.lastDate) - new Date(a.lastDate));
    return matches.slice(0, limit);
}

/* Mark the matched part of a name for the suggestion list (HTML-escaped). */
function highlightMatch(name, query) {
    const q = normalizeForSearch(query);
    if (!q) return escapeHtml(name);
    const folded = normalizeForSearch(name);
    const at = folded.indexOf(q);
    // Accent folding can shift lengths (ß -> ss); only highlight when it maps 1:1
    if (at < 0 || folded.length !== name.length) return escapeHtml(name);
    return escapeHtml(name.slice(0, at)) + '<mark>' + escapeHtml(name.slice(at, at + q.length)) + '</mark>' + escapeHtml(name.slice(at + q.length));
}
