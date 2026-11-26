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
    const add = (rawName, sets, mode, equipment, workout, source, position) => {
        const name = String(rawName || '');
        const key = exerciseKey(name);
        if (!key) return;
        let item = map.get(key);
        if (!item) {
            item = { key, name: exerciseBaseName(name), latestName: name.trim(), count: 0, lastDate: null, types: {}, typeStats: {}, primaryType: null, sessions: [] };
            map.set(key, item);
        }
        item.count++;
        const type = workout.type || 'Andere';
        item.types[type] = (item.types[type] || 0) + 1;
        const cleanEq = source === 'exercise' && equipment !== undefined ? normalizeEquipment(equipment) : undefined;
        item.sessions.push({
            workoutId: workout.workoutId,
            workoutType: type,
            workoutName: workout.name || workout.type || '',
            date: workout.date,
            fullName: name.trim(),
            weight: exerciseWeight(name),
            mode: mode === 'lr' ? 'lr' : 'normal',
            equipment: cleanEq,
            sets: Array.isArray(sets) ? sets : [],
            source,
            position: Number.isInteger(position) ? position : null
        });
    };

    for (const w of workouts || []) {
        (w.exercises || []).forEach((ex, i) => add(ex.name, ex.sets, ex.mode, ex.equipment, w, 'exercise', i));
        if (w.finisher && w.finisher.type === 'NORMAL') {
            (w.finisher.entries || []).forEach((entry, i) => {
                if (entry.sets && entry.sets.length) add(entry.name, entry.sets, entry.mode, null, w, 'finisher', i);
            });
        }
    }

    for (const item of map.values()) {
        item.sessions.sort((a, b) => new Date(b.date) - new Date(a.date));
        item.lastDate = item.sessions[0] ? item.sessions[0].date : null;
        // Show the name the way it was written most recently
        item.name = exerciseBaseName(item.sessions[0].fullName) || item.name;
        item.latestName = item.sessions[0].fullName;

        const stats = {};
        for (const s of item.sessions) {
            const type = s.workoutType || 'Andere';
            if (!stats[type]) {
                stats[type] = {
                    count: 0,
                    lastDate: s.date,
                    exercise: { count: 0, posSum: 0, posCount: 0 },
                    finisher: { count: 0, posSum: 0, posCount: 0 }
                };
            }
            const ts = stats[type];
            ts.count++;
            if (new Date(s.date) > new Date(ts.lastDate)) ts.lastDate = s.date;
            const bucket = s.source === 'finisher' ? ts.finisher : ts.exercise;
            bucket.count++;
            if (Number.isInteger(s.position)) {
                bucket.posSum += s.position;
                bucket.posCount++;
            }
        }
        item.typeStats = stats;

        let bestType = null;
        let bestStat = null;
        for (const [type, st] of Object.entries(stats)) {
            st.defaults = inferExerciseDefaults(item.sessions.filter(s => (s.workoutType || 'Andere') === type));
            if (!bestStat || st.count > bestStat.count || (st.count === bestStat.count && new Date(st.lastDate) > new Date(bestStat.lastDate))) {
                bestType = type;
                bestStat = st;
            }
        }
        item.primaryType = bestType;
        item.defaults = inferExerciseDefaults(item.sessions);
    }
    return map;
}

/* Typical mode ('normal' | 'lr') and logical set count (pairs for 'lr') from
 * recent sessions (newest-first). Uses the most frequent value over the last
 * 5 sessions, breaking ties in favor of the most recent session. */
function inferExerciseDefaults(sessions) {
    if (!sessions || !sessions.length) return { mode: 'normal', sets: 1, equipment: null };
    const recent = sessions.slice(0, 5);
    let normalCount = 0;
    let lrCount = 0;
    for (const s of recent) {
        if (s.mode === 'lr') lrCount++;
        else normalCount++;
    }
    const mode = lrCount > normalCount ? 'lr'
        : normalCount > lrCount ? 'normal'
        : (recent[0].mode === 'lr' ? 'lr' : 'normal');

    const bestEquipment = sessions.find(s => s.equipment !== undefined)?.equipment ?? null;

    const matching = recent.filter(s => (s.mode === 'lr' ? 'lr' : 'normal') === mode && Array.isArray(s.sets) && s.sets.length > 0);
    const sourceList = matching.length ? matching : recent.filter(s => Array.isArray(s.sets) && s.sets.length > 0);
    if (!sourceList.length) return { mode, sets: 1, equipment: bestEquipment };

    const counts = new Map();
    sourceList.forEach((s, idx) => {
        const logicalSets = s.mode === 'lr'
            ? Math.max(1, Math.round(s.sets.length / 2))
            : s.sets.length;
        const entry = counts.get(logicalSets);
        if (entry) entry.freq++;
        else counts.set(logicalSets, { freq: 1, firstIdx: idx });
    });

    let bestSets = 1;
    let bestFreq = -1;
    let bestIdx = Infinity;
    for (const [setCount, info] of counts.entries()) {
        if (info.freq > bestFreq || (info.freq === bestFreq && info.firstIdx < bestIdx)) {
            bestSets = setCount;
            bestFreq = info.freq;
            bestIdx = info.firstIdx;
        }
    }
    return { mode, sets: bestSets, equipment: bestEquipment };
}

function scoreTypeMatch(typeStat, position, source) {
    if (!typeStat) return 0;
    let factor = 1;
    if (Number.isInteger(position) && position >= 0) {
        const preferred = source === 'finisher' ? typeStat.finisher : typeStat.exercise;
        const fallback = source === 'finisher' ? typeStat.exercise : typeStat.finisher;
        const bucket = preferred && preferred.posCount > 0 ? preferred : (fallback && fallback.posCount > 0 ? fallback : null);
        if (bucket) {
            const avgPos = bucket.posSum / bucket.posCount;
            const distance = Math.abs(avgPos - position);
            factor = 1 + 0.65 / (1 + distance);
            if (preferred && preferred.count === 0) factor *= 0.85;
        }
    }
    return typeStat.count * factor;
}

/* Names for the suggestion list: prioritizes exercises logged in the active
 * workoutType (weighted by type frequency, typical card position, and recency),
 * then falls back to other workout types. Empty queries stay within the last
 * month; typed searches also surface older exercises. */
function suggestExercises(index, query, options = {}) {
    const q = normalizeForSearch(query);
    const exclude = new Set((options.exclude || []).map(exerciseKey));
    const limit = options.limit || 5;
    const workoutType = String(options.workoutType || '').trim();
    const position = Number.isInteger(options.position) && options.position >= 0 ? options.position : null;
    const source = options.source === 'finisher' ? 'finisher' : (options.source === 'exercise' ? 'exercise' : null);
    const now = options.now ? new Date(options.now) : new Date();
    const cutoff = new Date(now);
    cutoff.setMonth(cutoff.getMonth() - 1);

    const typeMatches = [];
    const otherMatches = [];

    for (const item of index.values()) {
        if (exclude.has(item.key)) continue;
        const isRecent = !!(item.lastDate && new Date(item.lastDate) >= cutoff);
        // Empty input: hide exercises not done in the last month; typing searches all history
        if (!q && !isRecent) continue;
        if (q && !item.key.includes(q)) continue;
        if (q && item.key === q) continue; // already typed in full

        const startsWith = q ? item.key.startsWith(q) : false;
        const typeStat = workoutType && item.typeStats ? item.typeStats[workoutType] : null;
        if (typeStat && typeStat.count > 0) {
            const defs = typeStat.defaults || item.defaults || { mode: 'normal', sets: 1, equipment: null };
            typeMatches.push({
                ...item,
                matchType: 'type',
                typeCount: typeStat.count,
                typeLastDate: typeStat.lastDate,
                defaultMode: defs.mode,
                defaultSets: defs.sets,
                defaultEquipment: item.defaults?.equipment ?? null,
                isOlder: !isRecent,
                _startsWith: startsWith,
                _score: scoreTypeMatch(typeStat, position, source)
            });
        } else {
            const defs = item.defaults || { mode: 'normal', sets: 1, equipment: null };
            otherMatches.push({
                ...item,
                matchType: workoutType ? 'other' : 'recent',
                typeCount: 0,
                typeLastDate: null,
                defaultMode: defs.mode,
                defaultSets: defs.sets,
                defaultEquipment: defs.equipment || null,
                isOlder: !isRecent,
                _startsWith: startsWith
            });
        }
    }

    typeMatches.sort((a, b) => {
        if (q) {
            if (a.isOlder !== b.isOlder) return a.isOlder ? 1 : -1;
            if (a._startsWith !== b._startsWith) return a._startsWith ? -1 : 1;
        }
        return (b._score - a._score)
            || (new Date(b.typeLastDate) - new Date(a.typeLastDate))
            || (b.count - a.count)
            || (new Date(b.lastDate) - new Date(a.lastDate));
    });

    otherMatches.sort((a, b) => {
        if (q) {
            if (a.isOlder !== b.isOlder) return a.isOlder ? 1 : -1;
            if (a._startsWith !== b._startsWith) return a._startsWith ? -1 : 1;
        }
        return (b.count - a.count) || (new Date(b.lastDate) - new Date(a.lastDate));
    });

    return typeMatches.slice(0, limit).concat(otherMatches).slice(0, limit).map(entry => {
        const { _startsWith, _score, ...clean } = entry;
        return clean;
    });
}

/* Relative German age label for suggestion metadata (e.g. "heute", "vor 3 T."). */
function formatSuggestionAge(dateStr, now = new Date()) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return '';
    const ref = new Date(now);
    const startOfRef = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
    const startOfDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const days = Math.max(0, Math.round((startOfRef - startOfDate) / 86400000));
    if (days === 0) return 'heute';
    if (days === 1) return 'gestern';
    if (days < 14) return `vor ${days} T.`;
    const weeks = Math.round(days / 7);
    if (days < 45) return `vor ${weeks} W.`;
    const months = Math.max(2, Math.round(days / 30));
    return `vor ${months} M.`;
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
