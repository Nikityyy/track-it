function showModal({ title, body, confirmText, cancelText, onConfirm, danger }) {
  // Prevent duplicate modals
  const existing = document.querySelector('.modal-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', title);

  overlay.innerHTML = `
    <div class="modal-card">
      <div class="modal-header">
        <h3 class="modal-title">${escapeHtml(title)}</h3>
        <button class="btn-icon modal-close" aria-label="Schließen">${icon('x', 18)}</button>
      </div>
      <div class="modal-body">${body}</div>
      <div class="modal-footer">
        <button class="btn btn-ghost modal-cancel">${escapeHtml(cancelText || 'Abbrechen')}</button>
        <button class="btn ${danger ? 'btn-danger' : 'btn-primary'} modal-confirm">${escapeHtml(confirmText || 'Bestätigen')}</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('modal-overlay--visible'));

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    overlay.classList.remove('modal-overlay--visible');
    // Reliable removal — don't rely solely on transitionend
    const fallback = setTimeout(() => overlay.remove(), 200);
    overlay.addEventListener('transitionend', () => {
      clearTimeout(fallback);
      overlay.remove();
    }, { once: true });
  };

  overlay.querySelector('.modal-close').addEventListener('click', close);
  overlay.querySelector('.modal-cancel').addEventListener('click', close);
  overlay.querySelector('.modal-confirm').addEventListener('click', () => {
    // Grab any data from the modal BEFORE closing/removing it
    if (onConfirm) onConfirm();
    close();
  });
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  // Focus confirm
  overlay.querySelector('.modal-confirm').focus();
}
