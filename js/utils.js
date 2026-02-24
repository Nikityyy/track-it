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
            note: ''
        };
    }
    return {
        setId: uuid(),
        label: `Satz ${index + 1}`,
        reps: 0,
        rpe: 5,
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
        window.location.hash = path;
    },

    _resolve() {
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
