document.addEventListener('DOMContentLoaded', async () => {
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
        return () => stopAutoDraft();
    });

    Router.register('/edit/:id', (params) => {
        window.scrollTo(0, 0);
        renderCreateWorkoutPage(params);
        setTimeout(updateActiveNav, 0);
        return () => stopAutoDraft();
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
