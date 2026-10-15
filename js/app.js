document.addEventListener('DOMContentLoaded', async () => {
    // Init theme
    const savedTheme = localStorage.getItem('trackit-theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);

    // Init DB (the app shell itself is static HTML in index.html)
    await openDB();

    // In-app links navigate through the router instead of the browser default.
    // ios-vibrator-pro-max re-dispatches taps as synthetic clicks and cancels
    // their default action, which would otherwise swallow taps on <a href="#/…">.
    document.addEventListener('click', (e) => {
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        const link = e.target.closest && e.target.closest('a[href^="#/"]');
        if (!link) return;
        e.preventDefault();
        Router.navigate(link.getAttribute('href').slice(1));
    });

    // Hairline under the header once content scrolls beneath it
    const header = document.querySelector('.app-header');
    const syncHeader = () => header && header.classList.toggle('is-scrolled', window.scrollY > 4);
    window.addEventListener('scroll', syncHeader, { passive: true });
    window.addEventListener('hashchange', () => requestAnimationFrame(syncHeader));
    syncHeader();

    // Routes
    Router.register('/', () => {
        window.scrollTo(0, 0);
        renderHomePage();
        setTimeout(updateActiveNav, 0);
    });

    Router.register('/create', () => {
        window.scrollTo(0, 0);
        renderCreateWorkoutPage({});
        setTimeout(updateActiveNav, 0);
        return leaveWorkoutEditor;
    });

    Router.register('/edit/:id', (params) => {
        window.scrollTo(0, 0);
        renderCreateWorkoutPage(params);
        setTimeout(updateActiveNav, 0);
        return leaveWorkoutEditor;
    });

    Router.register('/workout/:id', (params) => {
        window.scrollTo(0, 0);
        renderWorkoutDetailPage(params);
        setTimeout(updateActiveNav, 0);
    });

    Router.register('/history', () => {
        window.scrollTo(0, 0);
        renderHistoryPage();
        setTimeout(updateActiveNav, 0);
    });

    Router.register('/exercise/:name', (params) => {
        window.scrollTo(0, 0);
        renderExercisePage(params);
        setTimeout(updateActiveNav, 0);
    });

    Router.register('/settings', () => {
        window.scrollTo(0, 0);
        renderSettingsPage();
        setTimeout(updateActiveNav, 0);
    });

    // Auto-render Lucide icons safely on DOM mutations
    const observer = new MutationObserver((mutations) => {
        let shouldRender = false;
        for (const m of mutations) {
            if (m.addedNodes.length > 0) {
                for (const node of m.addedNodes) {
                    if (node.nodeType === 1) {
                        if ((node.tagName === 'I' && node.hasAttribute('data-lucide')) || node.querySelector('i[data-lucide]')) {
                            shouldRender = true;
                            break;
                        }
                    }
                }
            }
            if (shouldRender) break;
        }
        if (shouldRender && window.lucide) {
            window.lucide.createIcons();
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // Reopening the app with an unsaved workout goes straight back into it
    const launchHash = window.location.hash;
    if (launchHash === '' || launchHash === '#' || launchHash === '#/') {
        try {
            const draft = await getDraft();
            const age = draft && draft.savedAt ? Date.now() - new Date(draft.savedAt).getTime() : Infinity;
            if (draft && draft.workout && age < DRAFT_AUTO_OPEN_MAX_AGE_MS) {
                history.replaceState(null, '', '#' + getDraftPath(draft));
            }
        } catch (e) { /* fall through to home */ }
    }

    Router.init();

    // Register service worker
    if (sessionStorage.getItem('trackit-updated')) {
        sessionStorage.removeItem('trackit-updated');
        setTimeout(() => showToast('Neue Version geladen'), 400);
    }

    registerServiceWorker();
});

/* Updates: check on launch, whenever the app comes back to the foreground
 * (iOS mostly resumes PWAs instead of reloading them) and every 30 minutes.
 * A new version installs completely in the background; when it takes over,
 * the page reloads into it. Workouts are in IndexedDB and drafts/timers in
 * localStorage, so a reload loses nothing; an open workout is saved first
 * and reopened after the reload. */
async function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    let registration;
    try {
        registration = await navigator.serviceWorker.register('./service-worker.js', { updateViaCache: 'none' });
    } catch (e) {
        console.log('SW registration failed:', e);
        return;
    }

    const checkForUpdate = () => registration.update().catch(() => {});
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') checkForUpdate();
    });
    setInterval(checkForUpdate, 30 * 60 * 1000);

    // The very first install also hands control to a worker; that page already
    // runs the current files, so only later handovers mean a new version
    let controlled = !!navigator.serviceWorker.controller;
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!controlled) { controlled = true; return; }
        if (reloading) return;
        reloading = true;
        reloadIntoNewVersion();
    });
}

function isTyping() {
    const el = document.activeElement;
    return !!el && (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && !['checkbox', 'radio', 'button'].includes(el.type)));
}

function reloadIntoNewVersion() {
    // Never pull the page away mid-typing: wait for the field to lose focus
    // or for the app to be backgrounded, whichever comes first
    if (isTyping()) {
        const retry = () => {
            if (isTyping() && document.visibilityState === 'visible') return;
            document.removeEventListener('focusout', onFocusOut, true);
            document.removeEventListener('visibilitychange', retry);
            reloadIntoNewVersion();
        };
        const onFocusOut = () => setTimeout(retry, 0);
        document.addEventListener('focusout', onFocusOut, true);
        document.addEventListener('visibilitychange', retry);
        return;
    }

    // Save an open workout synchronously, then reopen exactly it after the reload
    if (document.getElementById('workout-form') && typeof saveCurrentDraft === 'function') {
        saveCurrentDraft();
        const draft = typeof readDraftMirror === 'function' ? readDraftMirror() : null;
        if (draft && draft.workout && typeof getDraftPath === 'function') {
            history.replaceState(history.state, '', '#' + getDraftPath(draft));
        }
    }
    try { sessionStorage.setItem('trackit-updated', '1'); } catch (e) { /* ignore */ }
    window.location.reload();
}
