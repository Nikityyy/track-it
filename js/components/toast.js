function showToast(message, duration = 2500) {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.setAttribute('aria-live', 'polite');
        container.setAttribute('role', 'status');
        document.body.appendChild(container);
    }

    // Limit active toasts to prevent stacking off-screen
    while (container.children.length >= 3) {
        container.removeChild(container.firstChild);
    }

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    container.appendChild(toast);

    requestAnimationFrame(() => {
        toast.classList.add('toast--visible');
    });

    setTimeout(() => {
        toast.classList.remove('toast--visible');
        toast.addEventListener('transitionend', () => toast.remove());
    }, duration);
}
