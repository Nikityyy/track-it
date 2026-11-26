/* Weight plate inventory, per-side solver, and compact visual renderer.
 *
 * Equipment types:
 * - 'barbell'   (LH):    1 bar, 2 equal sides
 * - 'dumbbell'  (1 KH):  1 dumbbell, 2 equal sides
 * - 'dumbbells' (2 KH):  2 dumbbells, 4 equal sides (weight in name = per dumbbell)
 */

const PLATES_CONFIG_KEY = 'trackit-plates-config';

const EQUIPMENT_TYPES = {
    barbell: { id: 'barbell', short: 'LH', label: 'Langhantel', handles: 1, sides: 2 },
    dumbbell: { id: 'dumbbell', short: '1 KH', label: '1 Kurzhantel', handles: 1, sides: 2 },
    dumbbells: { id: 'dumbbells', short: '2 KH', label: '2 Kurzhanteln', handles: 2, sides: 4 }
};

const EQUIPMENT_ORDER = ['barbell', 'dumbbell', 'dumbbells'];

function defaultPlateConfig() {
    return {
        plates: [
            { weight: 2.5, count: 4 },
            { weight: 2, count: 4 },
            { weight: 1.5, count: 4 },
            { weight: 1.25, count: 4 }
        ],
        barWeights: { barbell: 0, dumbbell: 0 }
    };
}

function sanitizePlateConfig(raw) {
    const fallback = defaultPlateConfig();
    if (!raw || typeof raw !== 'object') return fallback;
    const rawPlates = Array.isArray(raw.plates) ? raw.plates : fallback.plates;
    const merged = new Map();
    for (const p of rawPlates) {
        if (!p || typeof p !== 'object') continue;
        const w = Math.round(Number(p.weight) * 100) / 100;
        const c = Math.max(0, Math.round(Number(p.count)));
        if (!Number.isFinite(w) || w <= 0 || !Number.isSafeInteger(c)) continue;
        merged.set(w, (merged.get(w) || 0) + c);
    }
    const plates = Array.from(merged.entries())
        .map(([weight, count]) => ({ weight, count }))
        .sort((a, b) => b.weight - a.weight);

    const bw = raw.barWeights && typeof raw.barWeights === 'object' ? raw.barWeights : {};
    const cleanBar = (val) => {
        const n = Math.round(Number(val) * 100) / 100;
        return Number.isFinite(n) && n >= 0 ? n : 0;
    };
    return {
        plates,
        barWeights: {
            barbell: cleanBar(bw.barbell),
            dumbbell: cleanBar(bw.dumbbell)
        }
    };
}

function getPlateConfig() {
    try {
        const raw = localStorage.getItem(PLATES_CONFIG_KEY);
        if (!raw) return defaultPlateConfig();
        return sanitizePlateConfig(JSON.parse(raw));
    } catch (e) {
        return defaultPlateConfig();
    }
}

function savePlateConfig(config) {
    const clean = sanitizePlateConfig(config);
    try {
        localStorage.setItem(PLATES_CONFIG_KEY, JSON.stringify(clean));
    } catch (e) { /* ignore storage errors */ }
    return clean;
}

function formatWeightDE(val) {
    const rounded = Math.round(Number(val) * 100) / 100;
    return String(rounded).replace('.', ',');
}

/* Enumerate valid per-side plate combinations for targetGrams given sides (2 or 4).
 * Uses integer grams internally so decimals like 1.25 kg stay exact. */
function enumeratePlateCombos(targetGrams, plates, sides, maxResults = 16) {
    const sorted = (plates || [])
        .map(p => ({ weight: p.weight, grams: Math.round(p.weight * 1000), maxPerSide: Math.floor(p.count / sides) }))
        .filter(p => p.grams > 0 && p.maxPerSide > 0)
        .sort((a, b) => b.grams - a.grams);

    if (targetGrams <= 0) {
        return { exact: targetGrams === 0, actualGrams: 0, combos: [[]] };
    }
    if (!sorted.length) {
        return { exact: false, actualGrams: 0, combos: [[]] };
    }

    // Suffix upper bound for pruning
    const suffixMax = new Array(sorted.length + 1).fill(0);
    for (let i = sorted.length - 1; i >= 0; i--) {
        suffixMax[i] = suffixMax[i + 1] + sorted[i].grams * sorted[i].maxPerSide;
    }

    const exactCombos = [];
    let bestDiff = targetGrams;
    let bestGrams = 0;
    let bestCombos = [[]];
    const current = [];

    function dfs(idx, sum) {
        if (sum === targetGrams) {
            exactCombos.push(current.slice());
            return;
        }
        if (sum > targetGrams) return;

        const diff = targetGrams - sum;
        if (diff < bestDiff) {
            bestDiff = diff;
            bestGrams = sum;
            bestCombos = [current.slice()];
        } else if (diff === bestDiff && bestCombos.length < maxResults) {
            bestCombos.push(current.slice());
        }

        if (idx >= sorted.length || sum + suffixMax[idx] < targetGrams - bestDiff) return;
        // Stop branching deeply once we already have plenty of exact combos
        if (exactCombos.length >= maxResults * 3 && diff > 0) return;

        const plate = sorted[idx];
        const maxCount = Math.min(plate.maxPerSide, Math.floor((targetGrams - sum) / plate.grams));
        for (let c = maxCount; c >= 0; c--) {
            if (c > 0) current.push({ weight: plate.weight, grams: plate.grams, count: c });
            dfs(idx + 1, sum + c * plate.grams);
            if (c > 0) current.pop();
        }
    }

    dfs(0, 0);

    const sortByFewest = (list) => list
        .slice()
        .sort((a, b) => totalPlateCount(a) - totalPlateCount(b))
        .slice(0, maxResults);

    if (exactCombos.length) {
        return { exact: true, actualGrams: targetGrams, combos: sortByFewest(exactCombos) };
    }
    return { exact: false, actualGrams: bestGrams, combos: sortByFewest(bestCombos) };
}

function totalPlateCount(combo) {
    let n = 0;
    for (const p of combo) n += p.count;
    return n;
}

function comboToMap(combo) {
    const m = new Map();
    for (const p of combo) m.set(p.weight, (m.get(p.weight) || 0) + p.count);
    return m;
}

function countAddedRemoved(prevCombo, nextCombo) {
    const mp = comboToMap(prevCombo || []);
    const mn = comboToMap(nextCombo || []);
    const keys = new Set([...mp.keys(), ...mn.keys()]);
    let added = 0;
    let removed = 0;
    for (const k of keys) {
        const d = (mn.get(k) || 0) - (mp.get(k) || 0);
        if (d > 0) added += d;
        else if (d < 0) removed += -d;
    }
    return { added, removed };
}

/* Free just enough pairs from idle handles to keep the active load within inventory. */
function freeIdlePlates(loads, activeSlots, inventory) {
    const used = new Map();
    for (const combo of loads) {
        for (const { weight, count } of combo) used.set(weight, (used.get(weight) || 0) + count * 2);
    }

    let removed = 0;
    loads.forEach((combo, slot) => {
        if (activeSlots.includes(slot)) return;
        loads[slot] = combo.map(plate => {
            const overflow = Math.max(0, used.get(plate.weight) - inventory.get(plate.weight));
            const pairs = Math.min(plate.count, Math.ceil(overflow / 2));
            removed += pairs * 2;
            used.set(plate.weight, used.get(plate.weight) - pairs * 2);
            return { ...plate, count: plate.count - pairs };
        }).filter(plate => plate.count > 0);
    });
    return { removed, used };
}

function comparePlateStates(a, b) {
    return a.conflicts - b.conflicts || a.moves - b.moves;
}

/* Look ahead across the workout, preferring to leave idle handles loaded,
 * then minimizing the number of plates to move. A single dumbbell can reuse
 * either handle of the pair. Both sides of every active handle stay balanced. */
function solveWorkoutPlates(exercises, config = getPlateConfig()) {
    const inv = new Map();
    for (const p of config.plates || []) {
        if (p.weight > 0 && p.count > 0) inv.set(p.weight, (inv.get(p.weight) || 0) + p.count);
    }
    const weights = Array.from(inv.keys()).sort((a, b) => a - b);
    const plateHeights = new Map(weights.map((weight, rank) => [
        weight, weights.length === 1 ? 23 : 12 + 18 * rank / (weights.length - 1)
    ]));

    const plans = (exercises || []).map((ex, index) => {
        const equipment = normalizeEquipment(ex && ex.equipment);
        const parsed = typeof exerciseWeight === 'function' ? exerciseWeight(ex && ex.name) : null;
        if (!equipment || !parsed || parsed.unit !== 'kg') return null;

        const meta = EQUIPMENT_TYPES[equipment];
        const barWeight = equipment === 'barbell'
            ? (config.barWeights?.barbell || 0)
            : (config.barWeights?.dumbbell || 0);
        const plateWeightPerHandle = parsed.value - barWeight;
        const targetPerSideGrams = Math.round((plateWeightPerHandle / 2) * 1000);
        const solved = enumeratePlateCombos(targetPerSideGrams, config.plates, meta.sides);

        return {
            index,
            equipment,
            meta,
            plateHeights,
            targetWeight: parsed.value,
            barWeight,
            targetPerSide: plateWeightPerHandle / 2,
            actualWeight: Math.round((barWeight + (solved.actualGrams * 2) / 1000) * 100) / 100,
            actualPerSide: solved.actualGrams / 1000,
            exact: solved.exact && parsed.value >= barWeight,
            combos: solved.combos,
            perSide: solved.combos[0] || [],
            swaps: null,
            parallelOk: true
        };
    });

    const active = plans.filter(Boolean);
    if (!active.length) return plans;

    let states = [{ choices: [], loads: [[], [], []], conflicts: 0, moves: 0 }];
    for (const item of active) {
        const candidateSlots = item.equipment === 'barbell' ? [[0]]
            : item.equipment === 'dumbbells' ? [[1, 2]] : [[1], [2]];
        const nextStates = new Map();
        for (const state of states) {
            for (const combo of item.combos) {
                for (const slots of candidateSlots) {
                    const loads = state.loads.slice();
                    const deltas = slots.map(slot => countAddedRemoved(loads[slot], combo));
                    slots.forEach(slot => { loads[slot] = combo; });

                    const { removed, used } = freeIdlePlates(loads, slots, inv);
                    const moves = deltas.reduce((total, d) => total + (d.added + d.removed) * 2, removed);
                    const previousLoad = slots.some(slot => state.loads[slot].length > 0);
                    const uniformChange = deltas.every(d => d.added === deltas[0].added && d.removed === deltas[0].removed);
                    const delta = previousLoad && uniformChange ? deltas[0] : null;
                    const candidate = {
                        loads,
                        choices: state.choices.concat([{ combo, delta, parallelOk: removed === 0, loadedPlates: used }]),
                        conflicts: state.conflicts + (removed > 0 ? 1 : 0),
                        moves: state.moves + moves
                    };

                    // Exchanging the two dumbbells is physically equivalent.
                    const [barbell, ...dumbbells] = loads.map(plates =>
                        plates.map(plate => `${plate.weight}:${plate.count}`).join(',')
                    );
                    const key = [barbell, ...dumbbells.sort()].join('|');
                    const existing = nextStates.get(key);
                    if (!existing || comparePlateStates(candidate, existing) < 0) nextStates.set(key, candidate);
                }
            }
        }
        states = Array.from(nextStates.values()).sort(comparePlateStates).slice(0, 40);
    }

    active.forEach((plan, i) => {
        const { combo, delta, parallelOk, loadedPlates } = states[0].choices[i];
        plan.loadedPlates = loadedPlates;
        plan.perSide = combo;
        plan.swaps = delta;
        plan.parallelOk = parallelOk;
    });

    return plans;
}

/* Count the largest simultaneous load of each weight along the chosen plan. */
function summarizeWorkoutPlates(plans) {
    const peak = new Map();
    for (const plan of plans) {
        if (!plan) continue;
        for (const [weight, count] of plan.loadedPlates) {
            if (count > (peak.get(weight) || 0)) peak.set(weight, count);
        }
    }
    return Array.from(peak, ([weight, count]) => ({ weight, count }))
        .sort((a, b) => b.weight - a.weight);
}

function renderWorkoutPlateChecklist(plans) {
    const items = summarizeWorkoutPlates(plans);
    if (!items.length) return '';
    return `
        <h4 class="plate-checklist-title">Scheiben bereitlegen</h4>
        <ul class="plate-checklist-items" role="list">
            ${items.map(({ weight, count }) => `
                <li><strong>${count} ×</strong> ${formatWeightDE(weight)} kg</li>
            `).join('')}
        </ul>`;
}

function renderEquipmentSelector(selected, { label = 'Hanteltyp', target = '' } = {}) {
    const active = normalizeEquipment(selected);
    return `
        <div class="equip-segmented" role="group" aria-label="${escapeHtml(label)}" ${target}>
            ${EQUIPMENT_ORDER.map(id => {
                const { label, short } = EQUIPMENT_TYPES[id];
                return `<button type="button" class="equip-btn" data-equipment="${id}" aria-pressed="${active === id}" aria-label="${label}" title="${label}">${short}</button>`;
            }).join('')}
        </div>`;
}

function syncEquipmentButtons(container, equipment) {
    container.querySelectorAll('.equip-btn').forEach(button => {
        button.setAttribute('aria-pressed', String(button.dataset.equipment === equipment));
    });
}

async function handleEquipmentClick(event, onSaved) {
    const button = event.target.closest('.equip-btn');
    const group = button?.closest('[data-workout-id][data-exercise-index]');
    if (!group || group.getAttribute('aria-busy') === 'true') return;
    const equipment = button.getAttribute('aria-pressed') === 'true' ? null : button.dataset.equipment;
    group.setAttribute('aria-busy', 'true');
    try {
        await updateWorkoutEquipment(group.dataset.workoutId, Number(group.dataset.exerciseIndex), equipment);
        onSaved(group, equipment);
        syncEquipmentButtons(group, equipment);
        if (window.haptic) window.haptic.trigger('selection');
        if (group.isConnected) showToast(equipment ? `${EQUIPMENT_TYPES[equipment].label} gespeichert` : 'Hanteltyp entfernt');
    } catch {
        if (group.isConnected) showToast('Hanteltyp konnte nicht gespeichert werden');
    } finally {
        group.removeAttribute('aria-busy');
    }
}

function renderPlateBarVisual(plan, hasPlatesConfigured) {
    if (!plan) return '';
    if (!hasPlatesConfigured && !plan.exact) {
        return `<div class="exercise-plate-strip"><a class="plate-settings-link" href="#/settings">Hantelscheiben hinterlegen</a></div>`;
    }

    const perSide = plan.perSide;
    const combination = perSide.map(({ weight, count }) =>
        `${count > 1 ? `${count}× ` : ''}${formatWeightDE(weight)}`
    ).join(' + ');
    const discs = perSide.flatMap(({ weight, count }) =>
        Array.from({ length: Math.min(count, 5) }, () => weight)
    ).slice(0, 5);
    const stack = discs.map(weight =>
        `<span class="plate-disc" style="--plate-height:${plan.plateHeights.get(weight)}px"></span>`
    ).join('');

    const suffix = plan.equipment === 'dumbbells' ? ' je Hantel' : '';
    let note = suffix ? 'Je Seite an beiden Hanteln' : 'Je Seite';
    let warning = false;
    if (!plan.exact) {
        note = plan.targetWeight < plan.barWeight
            ? `Stange wiegt ${formatWeightDE(plan.barWeight)} kg`
            : `Erreichbar: ${formatWeightDE(plan.actualWeight)} kg${suffix}`;
        warning = true;
    } else if (!plan.parallelOk) {
        note += ' · Scheiben umstecken';
    } else if (plan.swaps) {
        const { added, removed } = plan.swaps;
        const changes = [removed && `−${removed}`, added && `+${added}`].filter(Boolean);
        note += changes.length ? ` · ${changes.join(' / ')} Scheiben` : ' · Beladung bleibt';
    }

    return `
        <div class="exercise-plate-strip">
            <div class="plate-bar-graphic" aria-hidden="true">
                <span class="plate-stack is-mirrored">${stack}</span>
                <span class="plate-stack">${stack}</span>
            </div>
            <div class="plate-strip-copy">
                <strong>${combination ? `${combination} kg` : 'Ohne Scheiben'}${!plan.exact && combination ? ' / Seite' : ''}</strong>
                <span class="plate-strip-note${warning ? ' is-warn' : ''}">${note}</span>
            </div>
        </div>`;
}
