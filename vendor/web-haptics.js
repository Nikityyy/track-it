/**
 * WebHaptics - Self-contained offline haptic feedback wrapper
 * Supports both Android / standard vibration (navigator.vibrate)
 * and iOS 17.4+ WebKit Taptic Engine via <input type="checkbox" switch> label clicks.
 */
class WebHaptics {
  constructor() {
    this.patterns = {
      success: [20, 60, 40],
      warning: [40, 60, 40],
      error: [60, 40, 60, 40, 60],
      light: 20,
      medium: 40,
      heavy: 60,
      selection: 15
    };
    this._label = null;
    this._initIOS();
  }

  _initIOS() {
    if (typeof document === 'undefined') return;

    const setup = () => {
      if (this._label) return;
      let container = document.getElementById('web-haptics-container');
      if (!container) {
        container = document.createElement('div');
        container.id = 'web-haptics-container';
        // Note: Never use display:none; iOS Safari skips layout and suppresses the Taptic Engine!
        container.setAttribute(
          'style',
          'opacity: 0; pointer-events: none; position: fixed; top: -100px; left: -100px; width: 1px; height: 1px; overflow: hidden;'
        );
        container.setAttribute('aria-hidden', 'true');
        if (typeof container.addEventListener === 'function') {
          container.addEventListener('click', (e) => {
            if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
          });
        }

        const label = document.createElement('label');
        label.htmlFor = 'web-haptics-switch';
        label.id = 'web-haptics-label';

        const input = document.createElement('input');
        input.type = 'checkbox';
        input.setAttribute('switch', '');
        input.id = 'web-haptics-switch';
        input.setAttribute('style', 'all: initial; appearance: auto;');

        label.appendChild(input);
        container.appendChild(label);
        document.body.appendChild(container);
        this._label = label;
      } else {
        this._label = document.getElementById('web-haptics-label');
      }
    };

    if (document.body && typeof document.body.appendChild === 'function') {
      setup();
    } else if (typeof document.addEventListener === 'function') {
      document.addEventListener('DOMContentLoaded', setup, { once: true });
    }
  }

  _tapIOS() {
    if (this._isTapping) return;
    if (!this._label && typeof document !== 'undefined') {
      this._label = document.getElementById('web-haptics-label');
      if (!this._label && document.body) {
        this._initIOS();
      }
    }
    if (this._label && typeof this._label.click === 'function') {
      this._isTapping = true;
      try {
        this._label.click();
      } catch {} finally {
        this._isTapping = false;
      }
    }
  }

  _triggerIOSPattern(pattern) {
    if (typeof pattern === 'string') {
      const key = pattern.toLowerCase();
      if (key === 'success') {
        this._tapIOS();
        setTimeout(() => this._tapIOS(), 60);
      } else if (key === 'error') {
        this._tapIOS();
        setTimeout(() => this._tapIOS(), 40);
        setTimeout(() => this._tapIOS(), 80);
      } else if (key === 'warning') {
        this._tapIOS();
        setTimeout(() => this._tapIOS(), 80);
      } else {
        this._tapIOS();
      }
    } else if (Array.isArray(pattern)) {
      let delay = 0;
      for (let i = 0; i < pattern.length; i += 2) {
        setTimeout(() => this._tapIOS(), delay);
        delay += (pattern[i] || 0) + (pattern[i + 1] || 0);
      }
    } else {
      this._tapIOS();
    }
  }

  /**
   * Triggers haptic feedback.
   * @param {number|string|number[]} [pattern=20] - Vibration duration in ms, pattern name, or pattern array
   * @returns {boolean}
   */
  trigger(pattern = 20) {
    let triggered = false;

    // 1. Android / standard vibration
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        let vibPattern = pattern;
        if (typeof pattern === 'string') {
          const key = pattern.toLowerCase();
          vibPattern = this.patterns[key] !== undefined ? this.patterns[key] : 20;
        } else if (typeof pattern === 'number') {
          vibPattern = Math.max(0, Math.round(pattern));
        } else if (Array.isArray(pattern)) {
          vibPattern = pattern.map(n => Math.max(0, Math.round(Number(n) || 0)));
        }
        triggered = Boolean(navigator.vibrate(vibPattern));
      } catch {
        triggered = false;
      }
    }

    // 2. iOS Safari / WebKit Taptic Engine via switch element. On iOS 18+
    //    ios-vibrator-pro-max provides navigator.vibrate, so only fall back
    //    to the switch here when no vibrate call went through (iOS 17.4–17.x).
    if (!triggered) this._triggerIOSPattern(pattern);

    return triggered || true;
  }
}

if (typeof window !== 'undefined') {
  window.WebHaptics = WebHaptics;
  window.haptic = new WebHaptics();
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { WebHaptics };
}
