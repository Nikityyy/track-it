document.addEventListener('DOMContentLoaded', async () => {
    // Init theme
    const savedTheme = localStorage.getItem('trackit-theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);

    // Init DB
    await openDB();

    // Build app shell
    const root = document.getElementById('app');
    root.innerHTML = `
    ${renderHeader()}
    <main id="app-content" class="app-content"></main>
  `;

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
    if ('serviceWorker' in navigator) {
        try {
            await navigator.serviceWorker.register('./service-worker.js');
        } catch (e) {
            console.log('SW registration failed:', e);
        }
    }
});
