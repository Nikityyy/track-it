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

/* Left/right order for L/R exercises. Which side a set belongs to is always
 * read from its label ("Satz 1 (links)"), never from its position, so old
 * workouts keep their order whatever this setting says. */
const LR_ORDER_KEY = 'trackit-lr-order';

function getLrOrder() {
    try {
        return localStorage.getItem(LR_ORDER_KEY) === 'right' ? 'right' : 'left';
    } catch (e) {
        return 'left';
    }
}

function setLrOrder(order) {
    try { localStorage.setItem(LR_ORDER_KEY, order === 'right' ? 'right' : 'left'); } catch (e) { /* ignore */ }
}

function lrSides(order) {
    return (order || getLrOrder()) === 'right' ? ['rechts', 'links'] : ['links', 'rechts'];
}

function setSide(set) {
    const label = String(set && set.label || '');
    if (label.includes('rechts')) return 'R';
    if (label.includes('links')) return 'L';
    return null;
}

function createEmptySet(index, mode, pairIndex) {
    if (mode === 'lr') {
        const sn = pairIndex !== undefined ? pairIndex + 1 : Math.floor(index / 2) + 1;
        const side = lrSides()[index % 2];
        return {
            setId: uuid(),
            label: `Satz ${sn} (${side})`,
            reps: 0,
            rpe: null,
            breakSeconds: 0,
            note: ''
        };
    }
    return {
        setId: uuid(),
        label: `Satz ${index + 1}`,
        reps: 0,
        rpe: null,
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
            const side = lrSides()[i % 2];
            set.label = `Satz ${pairNum} (${side})`;
        } else {
            set.label = `Satz ${i + 1}`;
        }
    });
}

function generateTypeColors(types) {
    const palette = [
        '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
        '#8b5cf6', '#ec4899', '#14b8a6', '#f97316',
        '#0ea5e9', '#84cc16', '#a855f7', '#6366f1'
    ];
    const map = {};
    (types || []).forEach((t, i) => {
        map[t] = palette[i % palette.length];
    });
    return map;
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

/* Simple SPA Router
 * Keeps its own view of the history stack (depth + hashes) so "back" can
 * return to the real previous screen, and flows like save can replace the
 * editor entry instead of stacking another page on top of it. */
const ROUTER_STACK_KEY = 'trackit-nav-stack';

const Router = {
    _routes: {},
    _currentCleanup: null,
    _depth: 0,
    _stack: [],
    _pendingReplace: false,

    register(path, handler) {
        this._routes[path] = handler;
    },

    navigate(path, options = {}) {
        // We set a flag to avoid double haptic when hashchange triggers _resolve
        this._isNavigating = true;
        if (window.haptic) window.haptic.trigger(20);
        const target = '#' + path;
        if (options.replace) {
            this._pendingReplace = true;
            if (window.location.hash === target) {
                this._pendingReplace = false;
                this._resolve();
                return;
            }
            window.location.replace(target);
        } else {
            window.location.hash = path;
        }
    },

    /* Go to the previous in-app screen, or to `fallback` when the app was
     * opened directly on this screen (nothing of ours to go back to). */
    back(fallback = '/') {
        if (this._depth > 0) {
            this._isNavigating = true;
            if (window.haptic) window.haptic.trigger(20);
            window.history.back();
        } else {
            this.navigate(fallback, { replace: true });
        }
    },

    previousHash() {
        return this._depth > 0 ? this._stack[this._depth - 1] || null : null;
    },

    _syncHistoryEntry() {
        const hash = window.location.hash || '#/';
        const state = window.history.state;
        if (this._pendingReplace) {
            this._pendingReplace = false;
        } else if (state && typeof state.trackitDepth === 'number') {
            this._depth = state.trackitDepth;
        } else if (this._initialized) {
            this._depth = this._depth + 1;
            this._stack = this._stack.slice(0, this._depth);
        }
        this._stack[this._depth] = hash;
        try {
            window.history.replaceState({ ...(state || {}), trackitDepth: this._depth }, '', window.location.href);
        } catch (e) { /* history API unavailable */ }
        try {
            sessionStorage.setItem(ROUTER_STACK_KEY, JSON.stringify(this._stack.slice(0, this._depth + 1)));
        } catch (e) { /* storage unavailable */ }
    },

    _resolve() {
        this._syncHistoryEntry();

        if (!this._isNavigating) {
            if (window.haptic) window.haptic.trigger(20);
        }
        this._isNavigating = false;

        const rawHash = window.location.hash.slice(1) || '/';
        this._lastHash = window.location.hash;

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
        if (!this._lastHash) this._lastHash = window.location.hash || '#/';
        const state = window.history.state;
        if (state && typeof state.trackitDepth === 'number') {
            // Reload of an existing entry: restore what we knew about the stack
            this._depth = state.trackitDepth;
            try {
                const saved = JSON.parse(sessionStorage.getItem(ROUTER_STACK_KEY) || '[]');
                if (Array.isArray(saved)) this._stack = saved.slice(0, this._depth + 1);
            } catch (e) { /* ignore */ }
        }
        window.addEventListener('hashchange', () => this._resolve());
        this._resolve();
        this._initialized = true;
    }
};

if (typeof window !== 'undefined') {
    window.Router = Router;
}

