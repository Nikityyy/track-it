function uuid() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
}

function formatDateDE(dateStr) {
    const d = new Date(dateStr);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}.${mm}.${yyyy}`;
}

function formatDateTimeDE(dateStr) {
    const d = new Date(dateStr);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${dd}.${mm}.${yyyy} ${hh}:${min}`;
}

function formatDateInputValue(dateStr) {
    const d = dateStr ? new Date(dateStr) : new Date();
    if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${yyyy}-${mm}-${dd}`;
}

function formatTimeInputValue(dateStr) {
    const d = dateStr ? new Date(dateStr) : new Date();
    if (Number.isNaN(d.getTime())) return new Date().toTimeString().slice(0, 5);
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${min}`;
}

function parseGermanDateInput(dateValue, fallbackIso) {
    const fallback = fallbackIso && !Number.isNaN(new Date(fallbackIso).getTime())
        ? new Date(fallbackIso)
        : new Date();
    if (!dateValue) return fallback;
    const trimmed = String(dateValue).trim();
    const germanMatch = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (germanMatch) {
        const [, dd, mm, yyyy] = germanMatch.map(Number);
        const d = new Date(fallback);
        d.setFullYear(yyyy, mm - 1, dd);
        return d;
    }
    const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (isoMatch) {
        const [, yyyy, mm, dd] = isoMatch.map(Number);
        const d = new Date(fallback);
        d.setFullYear(yyyy, mm - 1, dd);
        return d;
    }
    return fallback;
}

function parseTimeInput(timeValue, fallbackIso) {
    const fallback = fallbackIso && !Number.isNaN(new Date(fallbackIso).getTime())
        ? new Date(fallbackIso)
        : new Date();
    const match = String(timeValue || '').trim().match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return { hours: fallback.getHours(), minutes: fallback.getMinutes() };
    const hours = Math.max(0, Math.min(23, Number(match[1])));
    const minutes = Math.max(0, Math.min(59, Number(match[2])));
    return { hours, minutes };
}

function dateInputToISO(dateValue, fallbackIso) {
    const fallback = fallbackIso && !Number.isNaN(new Date(fallbackIso).getTime())
        ? new Date(fallbackIso)
        : new Date();
    if (!dateValue) return fallback.toISOString();
    const [yyyy, mm, dd] = dateValue.split('-').map(Number);
    if (!yyyy || !mm || !dd) return fallback.toISOString();
    const d = new Date(fallback);
    d.setFullYear(yyyy, mm - 1, dd);
    return d.toISOString();
}

function dateTimeInputToISO(dateValue, timeValue, fallbackIso) {
    const fallback = fallbackIso && !Number.isNaN(new Date(fallbackIso).getTime())
        ? new Date(fallbackIso)
        : new Date();
    const d = parseGermanDateInput(dateValue, fallback.toISOString());
    const { hours, minutes } = parseTimeInput(timeValue, fallback.toISOString());
    d.setHours(hours, minutes, 0, 0);
    return d.toISOString();
}

function formatDuration(seconds) {
    const total = Number(seconds) || 0;
    if (total <= 0) return '';
    const min = Math.floor(total / 60);
    const sec = total % 60;
    if (min && sec) return `${min}:${String(sec).padStart(2, '0')} min`;
    if (min) return `${min} min`;
    return `${sec} s`;
}

function generateWorkoutName(type) {
    return `${type} – ${formatDateDE(new Date().toISOString())}`;
}

function createEmptySet(index, mode, pairIndex) {
    if (mode === 'lr') {
        const sn = pairIndex !== undefined ? pairIndex + 1 : Math.floor(index / 2) + 1;
        const side = index % 2 === 0 ? 'links' : 'rechts';
        return {
            setId: uuid(),
            label: `Satz ${sn} (${side})`,
            reps: 0,
            rpe: 5,
            breakSeconds: 0,
            note: ''
        };
    }
    return {
        setId: uuid(),
        label: `Satz ${index + 1}`,
        reps: 0,
        rpe: 5,
        breakSeconds: 0,
        note: ''
    };
}

function createEmptyExercise() {
    return {
        exerciseId: uuid(),
        name: '',
        mode: 'normal',
        sets: [createEmptySet(0, 'normal')]
    };
}

function createEmptyWorkout(type) {
    const now = new Date().toISOString();
    return {
        workoutId: uuid(),
        type: type || '',
        name: type ? generateWorkoutName(type) : '',
        date: now,
        exercises: [createEmptyExercise()],
        finisher: null,
        createdAt: now,
        updatedAt: now
    };
}

function createEmptyFinisherEntry() {
    return {
        id: uuid(),
        name: '',
        result: '',
        rpe: 5,
        note: '',
        sets: []
    };
}

function rebuildSetLabels(exercise) {
    exercise.sets.forEach((set, i) => {
        if (exercise.mode === 'lr') {
            const pairNum = Math.floor(i / 2) + 1;
            const side = i % 2 === 0 ? 'links' : 'rechts';
            set.label = `Satz ${pairNum} (${side})`;
        } else {
            set.label = `Satz ${i + 1}`;
        }
    });
}

function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/\n/g, '&#10;')
        .replace(/\r/g, '');
}

/* Simple SPA Router */
const Router = {
    _routes: {},
    _currentCleanup: null,

    register(path, handler) {
        this._routes[path] = handler;
    },

    navigate(path) {
        // We set a flag to avoid double haptic when hashchange triggers _resolve
        this._isNavigating = true;
        if (window.haptic) window.haptic.trigger(20);
        window.location.hash = path;
    },

    _resolve() {
        if (!this._isNavigating) {
            if (window.haptic) window.haptic.trigger(20);
        }
        this._isNavigating = false;
        
        const rawHash = window.location.hash.slice(1) || '/';
        // Strip query string for route matching but preserve it for page access
        const hash = rawHash.split('?')[0] || '/';
        const parts = hash.split('/').filter(Boolean);

        // Try exact match first
        if (this._routes[hash]) {
            this._run(hash, {});
            return;
        }

        // Try pattern match (e.g. /workout/:id)
        for (const [pattern, handler] of Object.entries(this._routes)) {
            const patternParts = pattern.split('/').filter(Boolean);
            if (patternParts.length !== parts.length) continue;

            const params = {};
            let match = true;
            for (let i = 0; i < patternParts.length; i++) {
                if (patternParts[i].startsWith(':')) {
                    params[patternParts[i].slice(1)] = parts[i];
                } else if (patternParts[i] !== parts[i]) {
                    match = false;
                    break;
                }
            }
            if (match) {
                this._run(pattern, params);
                return;
            }
        }

        // Fallback
        this._run('/', {});
    },

    _run(pattern, params) {
        if (this._currentCleanup) {
            this._currentCleanup();
            this._currentCleanup = null;
        }
        const handler = this._routes[pattern];
        if (handler) {
            const cleanup = handler(params);
            if (typeof cleanup === 'function') {
                this._currentCleanup = cleanup;
            }
        }
    },

    init() {
        window.addEventListener('hashchange', () => this._resolve());
        this._resolve();
    }
};
