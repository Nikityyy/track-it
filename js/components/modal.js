function showModal({ title, body, bodyText, bodyHtml, confirmText, cancelText, onConfirm, onCancel, danger, focus }) {
  // A dialog replaced by a new one counts as dismissed, so whoever waits on
  // its answer still gets one
  const existing = document.querySelector('.modal-overlay');
  if (existing) {
    if (existing._dismiss) existing._dismiss();
    existing.remove();
  }

  const opener = document.activeElement;
  const scrollYAtOpen = window.scrollY;

  const overlay = document.createElement('div');
  // A dialog for typing sits up top from the start, where it stays when the
  // keyboard opens, instead of jumping up out of the centre
  const forTyping = !!(focus && focus.matches && focus.matches('textarea, input'));
  overlay.className = forTyping ? 'modal-overlay modal-overlay--typing' : 'modal-overlay';
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
  setPageBehindModal(true);
  const stopFollowingViewport = followVisualViewport(overlay);
  // On screen in the very first frame, together with the tap's vibration
  overlay.classList.add('modal-overlay--visible');

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    stopFollowingViewport();
    // The fading dialog no longer takes taps; the page does again right away
    overlay.classList.add('modal-overlay--closing');
    overlay.inert = true;
    setPageBehindModal(false);
    document.dispatchEvent(new Event('trackit:modalclose'));
    if (window.scrollY !== scrollYAtOpen) window.scrollTo(0, scrollYAtOpen);
    if (opener && opener.isConnected && opener.matches && opener.matches('button, a[href]')) {
      opener.focus({ preventScroll: true });
    }
    overlay.classList.remove('modal-overlay--visible');
    const fallback = setTimeout(() => overlay.remove(), 200);
    overlay.addEventListener('transitionend', (e) => {
      if (e.target !== overlay) return;
      clearTimeout(fallback);
      overlay.remove();
    });
  };
  // Each answer runs once, however many click events one tap produces
  const cancel = () => {
    if (closed) return;
    close();
    if (onCancel) onCancel();
  };
  const confirm = () => {
    if (closed) return;
    if (window.haptic && !danger) window.haptic.trigger(20);
    close();
    if (onConfirm) onConfirm();
  };
  overlay._dismiss = cancel;

  overlay.querySelector('.modal-close').addEventListener('click', cancel);
  overlay.querySelector('.modal-cancel').addEventListener('click', cancel);
  overlay.querySelector('.modal-confirm').addEventListener('click', confirm);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) cancel();
  });

  // Focus trap
  overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' || e.keyCode === 27) {
        cancel();
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

  // Focus now, inside the tap that opened the dialog: iOS only shows the
  // keyboard for a text field focused during the tap itself
  if (focus) {
    focus.focus({ preventScroll: true });
    if (typeof focus.setSelectionRange === 'function') focus.setSelectionRange(focus.value.length, focus.value.length);
  } else if (danger) {
    overlay.querySelector('.modal-cancel').focus({ preventScroll: true });
  } else {
    overlay.querySelector('.modal-confirm').focus({ preventScroll: true });
  }
}

/* While a dialog is open the page behind it neither scrolls nor takes taps
 * or focus (`inert` also hides the haptics library's tap overlays there). */
function setPageBehindModal(open) {
  const app = document.getElementById('app');
  if (app) app.inert = open;
  document.documentElement.classList.toggle('modal-open', open);
}

/* Keep the dialog inside the part of the screen that is visible. When the
 * iPhone keyboard opens, only the visual viewport shrinks; without this the
 * dialog stays centred on the whole screen with its buttons under the keyboard. */
function followVisualViewport(overlay) {
  const vv = window.visualViewport;
  if (!vv) return () => {};
  const fit = () => {
    overlay.style.top = `${vv.offsetTop}px`;
    overlay.style.height = `${vv.height}px`;
    overlay.style.bottom = 'auto';
  };
  // Measuring forces a layout; do it once the first frame is on screen
  requestAnimationFrame(() => setTimeout(fit));
  vv.addEventListener('resize', fit);
  vv.addEventListener('scroll', fit);
  return () => {
    vv.removeEventListener('resize', fit);
    vv.removeEventListener('scroll', fit);
  };
}
