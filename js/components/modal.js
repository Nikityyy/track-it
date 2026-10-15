function showModal({ title, body, bodyText, bodyHtml, confirmText, cancelText, onConfirm, onCancel, danger }) {
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
      <div class="modal-body"></div>
      <div class="modal-footer">
        <button class="btn btn-ghost modal-cancel">${escapeHtml(cancelText || 'Abbrechen')}</button>
        <button class="btn ${danger ? 'btn-danger' : 'btn-primary'} modal-confirm">${escapeHtml(confirmText || 'Bestätigen')}</button>
      </div>
    </div>
  `;

  const modalBody = overlay.querySelector('.modal-body');
  if (typeof Node !== 'undefined' && body instanceof Node) {
    modalBody.appendChild(body);
  } else if (bodyHtml !== undefined) {
    modalBody.innerHTML = bodyHtml;
  } else {
    modalBody.textContent = bodyText !== undefined ? bodyText : String(body || '');
  }

  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('modal-overlay--visible'));

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    overlay.classList.remove('modal-overlay--visible');
    const fallback = setTimeout(() => overlay.remove(), 200);
    overlay.addEventListener('transitionend', () => {
      clearTimeout(fallback);
      overlay.remove();
    }, { once: true });
  };

  overlay.querySelector('.modal-close').addEventListener('click', () => {
    if (onCancel) onCancel();
    close();
  });
  overlay.querySelector('.modal-cancel').addEventListener('click', () => {
    if (onCancel) onCancel();
    close();
  });
  overlay.querySelector('.modal-confirm').addEventListener('click', () => {
    if (window.haptic && !danger) window.haptic.trigger(20);
    if (onConfirm) onConfirm();
    close();
  });
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      if (onCancel) onCancel();
      close();
    }
  });

  // Focus trap
  overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' || e.keyCode === 27) {
        if (onCancel) onCancel();
        close();
        return;
    }

    const isTabPressed = e.key === 'Tab' || e.keyCode === 9;
    if (!isTabPressed) return;

    const focusableElements = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const focusableContent = overlay.querySelectorAll(focusableElements);
    if (focusableContent.length === 0) return;
    
    const firstFocusableElement = focusableContent[0];
    const lastFocusableElement = focusableContent[focusableContent.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === firstFocusableElement) {
        lastFocusableElement.focus();
        e.preventDefault();
      }
    } else {
      if (document.activeElement === lastFocusableElement) {
        firstFocusableElement.focus();
        e.preventDefault();
      }
    }
  });

  if (danger) {
    overlay.querySelector('.modal-cancel').focus();
  } else {
    overlay.querySelector('.modal-confirm').focus();
  }
}
