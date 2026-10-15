// The header markup is static HTML in index.html, so it is there from the first frame.

function updateActiveNav() {
  const hash = window.location.hash.slice(1) || '/';
  document.querySelectorAll('.nav-link').forEach(link => {
    const nav = link.dataset.nav;
    const isActive =
      (nav === 'home' && (hash === '/' || hash === '')) ||
      (nav === 'history' && (hash.startsWith('/history') || hash.startsWith('/exercise/'))) ||
      (nav === 'settings' && hash === '/settings');
    link.classList.toggle('active', isActive);
  });
}
