function renderHeader() {
  return `
    <header class="app-header">
      <div class="header-inner">
        <a href="#/" class="header-brand" aria-label="Track It! Startseite">
          <span class="header-icon"><img src="icons/icon-512.png" alt="Track It! Icon" width="22" height="22"></span>
          <span class="header-title">Track It!</span>
        </a>
        <nav class="header-nav" aria-label="Hauptnavigation">
          <a href="#/" class="nav-link" data-nav="home" aria-label="Startseite">${icon('home', 18)}</a>
          <a href="#/history" class="nav-link" data-nav="history" aria-label="Verlauf">${icon('history', 18)}</a>
          <a href="#/settings" class="nav-link" data-nav="settings" aria-label="Einstellungen">${icon('settings', 18)}</a>
        </nav>
      </div>
    </header>
  `;
}

function updateActiveNav() {
  const hash = window.location.hash.slice(1) || '/';
  document.querySelectorAll('.nav-link').forEach(link => {
    const nav = link.dataset.nav;
    const isActive =
      (nav === 'home' && (hash === '/' || hash === '')) ||
      (nav === 'history' && hash.startsWith('/history')) ||
      (nav === 'settings' && hash === '/settings');
    link.classList.toggle('active', isActive);
  });
}
