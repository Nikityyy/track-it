/*! ios-vibrator-pro-max 3.0.3 | ISC License | (c) Sam Denty | https://github.com/samdenty/ios-vibrator-pro-max | bundled from the npm package for static hosting; six small patches, marked "Track It! patch" */
(() => {
  // x/package/dist/utils/supported-versions.js
  function getSafariVersion() {
    if (typeof navigator === "undefined") {
      return null;
    }
    const userAgent = navigator.userAgent;
    if (userAgent.indexOf("Safari") !== -1 && userAgent.indexOf("Chrome") === -1) {
      const versionRegex = /Version\/(\d+(\.\d+)?)/;
      const match = userAgent.match(versionRegex);
      if (match?.[1]) {
        return Number.parseFloat(match[1]);
      }
    }
    if (userAgent.indexOf("iPhone OS")) {
      const versionRegex = /iPhone OS (\d+(_\d+)?)/;
      const match = userAgent.match(versionRegex);
      if (match?.[1]) {
        return Number.parseFloat(match[1].replace("_", "."));
      }
    }
    return null;
  }
  var SAFARI_VERSION = getSafariVersion();
  var polyfillKind = SAFARI_VERSION && !navigator.vibrate ? SAFARI_VERSION >= 18.4 ? "granted" : SAFARI_VERSION >= 18 ? "full" : null : null;

  // x/package/dist/utils/styles/update-styles.js
  var elementCallbacks = /* @__PURE__ */ new Map();
  var pendingUpdate = false;
  function applyStyles(element, callbacks) {
    let mergedStyles = [];
    for (const callback of callbacks) {
      const styles = callback();
      if (styles.includes("all: unset") || styles.includes("all: revert")) {
        mergedStyles = [];
      }
      mergedStyles.push(...styles);
    }
    // Track It! patch (6/6): rewriting an unchanged style still restyles the
    // page; this runs for every overlay every 500ms and on focus changes
    const style = mergedStyles.map((style2) => `${style2} !important`).join("; ");
    if (element.getAttribute("style") !== style) {
      element.setAttribute("style", style);
    }
  }
  function updateStyles() {
    pendingUpdate = false;
    for (const [element, callbacks] of elementCallbacks) {
      applyStyles(element, callbacks);
    }
  }
  setInterval(updateStyles, 500);
  function registerStyleUpdater(element, callback) {
    let callbacks = elementCallbacks.get(element);
    if (!callbacks) {
      callbacks = /* @__PURE__ */ new Set();
      elementCallbacks.set(element, callbacks);
    }
    callbacks.add(callback);
    if (!pendingUpdate) {
      requestAnimationFrame(updateStyles);
    }
    pendingUpdate = true;
    return [
      () => {
        applyStyles(element, callbacks);
      },
      () => {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          elementCallbacks.delete(element);
        }
      }
    ];
  }

  // x/package/dist/utils/styles/pseudo-styles.js
  function getPseudoStyles(element, pseudoSelector) {
    let width = null;
    let height = null;
    let borderRadius = null;
    try {
      const styles = window.getComputedStyle(element, "::-webkit-slider-thumb");
      width = Number.parseFloat(styles.width);
      height = Number.parseFloat(styles.height) || width;
      borderRadius = styles.borderRadius;
    } catch (e) {
    }
    if (width && height) {
      return { width, height, borderRadius };
    }
    for (const sheet of document.styleSheets) {
      try {
        const rules = sheet.cssRules || sheet.rules;
        if (!rules)
          continue;
        for (const rule of rules) {
          if (rule.type !== 1) {
            continue;
          }
          const styleRule = rule;
          const selectorText = styleRule.selectorText || "";
          if (!selectorText.includes(pseudoSelector)) {
            continue;
          }
          const baseSelector = selectorText.replace(new RegExp(`::?${pseudoSelector.slice(2)}`), "").trim();
          if (baseSelector && element.matches(baseSelector)) {
            const style2 = element.getAttribute("style");
            element.style.setProperty("width", styleRule.style.width);
            element.style.setProperty("height", styleRule.style.height);
            element.style.setProperty("border-radius", styleRule.style.borderRadius);
            const computedStyle = getComputedStyle(element);
            if (styleRule.style.width) {
              width = Number.parseFloat(computedStyle.getPropertyValue("width"));
            }
            if (styleRule.style.height) {
              height = Number.parseFloat(computedStyle.getPropertyValue("height"));
            }
            if (styleRule.style.borderRadius) {
              borderRadius = computedStyle.getPropertyValue("border-radius");
            }
            if (style2) {
              element.setAttribute("style", style2);
            } else {
              element.removeAttribute("style");
            }
          }
        }
      } catch {
      }
    }
    if (!width) {
      width = 24;
    }
    if (!height) {
      height = 16;
    }
    if (!borderRadius) {
      borderRadius = "50%";
    }
    return { width, height, borderRadius };
  }

  // x/package/dist/utils/styles/touch-action-candidates.js
  var MOVABLE_TOUCH_ACTION = /\bnone\b|\bpan-/;
  function isMovableTouchAction(value) {
    return !!value && MOVABLE_TOUCH_ACTION.test(value);
  }
  var cachedSelectors = [];
  var stylesheetsDirty = true;
  function collectSelectors() {
    if (!stylesheetsDirty) {
      return cachedSelectors;
    }
    stylesheetsDirty = false;
    const selectors = /* @__PURE__ */ new Set();
    const walk = (rules) => {
      for (const rule of rules) {
        const styleRule = rule;
        if (styleRule.selectorText && styleRule.style && // `&`-prefixed nested selectors can't be queried standalone.
        !styleRule.selectorText.includes("&") && isMovableTouchAction(styleRule.style.getPropertyValue("touch-action"))) {
          selectors.add(styleRule.selectorText);
        }
        const nested = rule.cssRules;
        if (nested) {
          walk(nested);
        }
      }
    };
    for (const sheet of document.styleSheets) {
      try {
        const rules = sheet.cssRules;
        if (rules) {
          walk(rules);
        }
      } catch {
      }
    }
    cachedSelectors = [...selectors];
    return cachedSelectors;
  }
  var candidates = null;
  function getTouchActionCandidates() {
    if (candidates) {
      return candidates;
    }
    candidates = /* @__PURE__ */ new Set();
    for (const selector of collectSelectors()) {
      try {
        for (const element of document.querySelectorAll(selector)) {
          candidates.add(element);
        }
      } catch {
      }
    }
    for (const element of document.querySelectorAll('[style*="touch-action"]')) {
      candidates.add(element);
    }
    requestAnimationFrame(() => {
      candidates = null;
    });
    return candidates;
  }
  function markStylesheetsDirty() {
    stylesheetsDirty = true;
    candidates = null;
  }

  // x/package/dist/utils/wait.js
  function blockingWait(ms) {
    if (ms < 0) {
      return ms;
    }
    const start = Date.now();
    new Function("start", "ms", "while (Date.now() - start < ms) {}")(start, ms);
    return 0;
  }
  async function asyncWait(ms) {
    const start = Date.now();
    await new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
    return ms - (Date.now() - start);
  }

  // x/package/dist/utils/merge-vibrations.js
  function mergeVibrations(patterns, startAtTime = "latest") {
    if (patterns.length === 0) {
      return [];
    }
    const normalizedPatterns = patterns.map(([start, intervals]) => [
      Math.round(start),
      intervals.map((interval) => Math.max(0, Math.round(interval)))
      // Ensure at least 1ms
    ]);
    const startTimes = normalizedPatterns.map(([start]) => start);
    const startTime = typeof startAtTime === "number" ? startAtTime : startAtTime === "first" ? Math.min(...startTimes) : Math.max(...startTimes);
    const endTimes = normalizedPatterns.map(([start, pattern]) => {
      return start + pattern.reduce((sum, dur) => sum + dur, 0);
    });
    const maxEndTime = Math.max(...endTimes);
    const timeline = new Array(maxEndTime - startTime).fill(false);
    normalizedPatterns.forEach(([patternStart, intervals]) => {
      let currentTime = patternStart;
      let isVibrating = true;
      for (const interval of intervals) {
        if (isVibrating) {
          const fromIndex = Math.max(0, currentTime - startTime);
          const toIndex = Math.max(0, Math.min(timeline.length, currentTime - startTime + interval));
          timeline.fill(true, fromIndex, toIndex);
        }
        currentTime += interval;
        isVibrating = !isVibrating;
      }
    });
    const result = [];
    const length = timeline.length;
    let currentState = timeline[0];
    let currentCount = 0;
    for (let i = 0; i <= length; i++) {
      const newState = i < length ? timeline[i] : !currentState;
      if (newState !== currentState) {
        if (currentCount > 0) {
          result.push(currentCount);
        }
        currentState = newState;
        currentCount = 1;
      } else {
        currentCount++;
      }
    }
    if (result.length > 0 && !timeline[0]) {
      result.unshift(0);
    }
    if (result.length > 0 && !timeline[timeline.length - 1]) {
      result.pop();
    }
    return result;
  }
  function trimVibrations(amount, patterns) {
    const result = [];
    let remainingAmount = amount;
    for (let i = 0; i < patterns.length; i++) {
      const currentVibration = patterns[i];
      if (remainingAmount > 0) {
        const remaining = currentVibration - remainingAmount;
        if (remaining > 0) {
          if (!result.length && i % 2) {
            result.push(0);
          }
          result.push(remaining);
          remainingAmount = 0;
        } else {
          remainingAmount = Math.abs(remaining);
        }
      } else {
        if (!result.length && i % 2) {
          result.push(0);
        }
        result.push(currentVibration);
      }
    }
    return result;
  }

  // x/package/dist/utils/throttle.js
  function throttle(func, limitMs) {
    let lastRun = 0;
    let timeoutId = null;
    return () => {
      const now = Date.now();
      const timeElapsed = now - lastRun;
      if (timeElapsed < limitMs) {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        const timeRemaining = limitMs - timeElapsed;
        timeoutId = setTimeout(() => {
          lastRun = Date.now();
          func();
        }, timeRemaining);
        return;
      }
      lastRun = now;
      func();
    };
  }

  // x/package/dist/vibration.js
  var ignoredElements = /* @__PURE__ */ new WeakSet([]);
  var rootTrigger = createVibrationTrigger();
  var hiddenTrigger = createVibrationTrigger();
  hiddenTrigger?.label.appendChild(hiddenTrigger?.input);
  var vibration = [Date.now(), []];
  function setVibration(patterns) {
    vibration = [Date.now(), patterns];
    return patterns;
  }
  function getVibration() {
    setVibration(trimVibrations(Date.now() - vibration[0], vibration[1]));
    return vibration[1];
  }
  function shouldVibrate() {
    const vibration2 = getVibration();
    return vibration2[0] > 0;
  }
  function createVibrationTrigger() {
    if (typeof document === "undefined") {
      return null;
    }
    const label = document.createElement("label");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.setAttribute("switch", "");
    input.setAttribute("style", "display: none !important");
    setTimeout(() => {
      label.tabIndex = -1;
      input.tabIndex = -1;
    });
    ignoredElements.add(label);
    ignoredElements.add(input);
    return { label, input };
  }

  // x/package/dist/methods/click-grant/index.js
  var blockMainThread = false;
  function enableMainThreadBlocking(enabled = true) {
    blockMainThread = enabled;
  }
  var lastGrant = null;
  var MAGIC_NUMBER = 26.26;
  var GRANT_TIMEOUT = 850;
  async function authorizeVibrations({ target, isTrusted }) {
    if (target === hiddenTrigger?.label || target === hiddenTrigger?.input || backgroundPopup && !popupConnected && lastGrant || !isTrusted) {
      return;
    }
    lastGrant = Date.now();
    allowVibrationsDuringGrant();
    if (backgroundPopup && !popupConnected) {
      openBackgroundPopup();
    }
  }
  // Track It! patch (4/6): every tap and keystroke started another copy of
  // this endless loop, so after a workout thousands of timers fired each
  // second. One loop does the same job.
  var grantLoopRunning = false;
  async function allowVibrationsDuringGrant() {
    if (grantLoopRunning) {
      return;
    }
    grantLoopRunning = true;
    let adjustment = 0;
    while (true) {
      const [vibrateMs, waitMs] = getVibration();
      if (vibrateMs == null) {
        const waitDuration = noVibrationCount > 5 ? Math.min(MAX_NO_VIBRATION_WAIT, avgLatency * 0.5) : Math.min(MAX_NO_VIBRATION_WAIT * 0.5, avgLatency * 0.3);
        const adjustment2 = backgroundPopup === true ? fetchLatest() : 0;
        await wait(waitDuration + adjustment2);
        continue;
      }
      const shouldVibrate2 = vibrateMs > 0;
      const waitTime = (shouldVibrate2 ? MAGIC_NUMBER : waitMs ?? 0) + adjustment;
      if (shouldVibrate2) {
        hiddenTrigger?.label.click();
      }
      if (!shouldVibrate2 && backgroundPopup === true && waitTime > avgLatency * 1.5) {
        adjustment = fetchLatest();
        adjustment = blockingWait(waitTime + adjustment);
      } else {
        adjustment = await wait(waitTime);
      }
    }
  }
  function getTimeUntilGrantExpires() {
    if (polyfillKind === "full" || popupConnected) {
      return Number.POSITIVE_INFINITY;
    }
    if (!lastGrant) {
      return 0;
    }
    return Math.max(0, (backgroundPopup ? 250 : GRANT_TIMEOUT) - (Date.now() - lastGrant));
  }
  async function wait(duration) {
    const grantTimeout = getTimeUntilGrantExpires();
    if (blockMainThread && grantTimeout <= 0) {
      return blockingWait(duration);
    }
    if (!blockMainThread || grantTimeout > duration) {
      return asyncWait(duration);
    }
    const adjustment = await asyncWait(grantTimeout);
    const wait2 = duration - grantTimeout - adjustment;
    return blockingWait(wait2);
  }

  // x/package/dist/methods/background-popup/index.js
  var uuid = globalThis?.localStorage?.getItem("pro-max-vibrator-uuid") || uuidv4();
  globalThis?.localStorage?.setItem("pro-max-vibrator-uuid", uuid);
  var popupConnected = false;
  var backgroundPopup = false;
  var fetchConnected;
  var hasBackgroundPopup = polyfillKind === "granted" ? new Promise((resolve) => {
    fetchConnected = resolve;
  }).then(() => fetch(`https://api.vibrator.dev/connected/${uuid}`).then(({ ok }) => ok)) : null;
  function enableBackgroundPopup(enabled = true) {
    if (polyfillKind !== "granted" || backgroundPopup === enabled) {
      return;
    }
    backgroundPopup = enabled;
    if (enabled) {
      fetchConnected();
      setBackgroundVibration([0]);
      window.addEventListener("unload", unload);
    } else {
      window.removeEventListener("unload", unload);
    }
  }
  var lastFetch = 0;
  var networkLatencies = [100];
  var avgLatency = 100;
  var noVibrationCount = 0;
  var MAX_NO_VIBRATION_WAIT = 40;
  function setBackgroundVibration(patterns) {
    if (!backgroundPopup) {
      return;
    }
    fetch(`https://api.vibrator.dev/${uuid}`, {
      method: "POST",
      body: JSON.stringify(patterns)
    }).then((res) => {
      popupConnected = res.ok;
    });
  }
  function openBackgroundPopup() {
    enableMainThreadBlocking(popupConnected);
    setVibration([]);
    window.open(`https://api.vibrator.dev/redirect#${location.href}`, "_blank", "noopener noreferrer");
    document.body.innerText = "\u{1F4F3}";
    document.body.style.all = "unset";
    document.body.style.display = "flex";
    document.body.style.justifyContent = "center";
    document.body.style.alignItems = "center";
    document.body.style.backgroundColor = "white";
    document.body.style.color = "white";
    document.body.style.fontSize = `${Math.min(window.innerWidth, window.innerHeight) / 2}px`;
    document.title = "ios-vibrator-pro-max \u{1F4F3}";
  }
  function fetchLatest() {
    try {
      lastFetch = Date.now();
      const xhr = new XMLHttpRequest();
      xhr.open("GET", `https://api.vibrator.dev/${uuid}`, false);
      xhr.send(null);
      const response = JSON.parse(xhr.responseText);
      if (response === null) {
        window.close();
      }
      const [start, newPatterns] = response;
      noVibrationCount = 0;
      const vibration2 = trimVibrations(Date.now() - start, newPatterns);
      setVibration(vibration2);
      if (!vibration2.length) {
        setVibration(newPatterns);
      }
    } catch {
    } finally {
      const latency = Date.now() - lastFetch;
      networkLatencies.push(latency);
      if (networkLatencies.length > 10) {
        networkLatencies.shift();
      }
      avgLatency = networkLatencies.reduce((sum, val) => sum + val, 0) / networkLatencies.length;
      return -latency;
    }
  }
  function unload() {
    navigator.sendBeacon(`https://api.vibrator.dev/${uuid}`, JSON.stringify(null));
  }
  function uuidv4() {
    return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) => (+c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> +c / 4).toString(16));
  }

  // x/package/dist/methods/click-passthrough/inputable.js
  var hiddenTriggers = /* @__PURE__ */ new Set();
  function isInputRangeElement(element) {
    return element.tagName.toLowerCase() === "input" && element.type === "range";
  }
  function isInputableElement(element) {
    const tagName = element.tagName.toLowerCase();
    return tagName === "input" && element.type === "text" || tagName === "textarea" || tagName === "select";
  }
  function handleInputRange(inputRange) {
    const trigger = clickableTriggers.get(inputRange);
    if (!trigger || !isInputRangeElement(inputRange)) {
      return;
    }
    let lastValue = inputRange.value;
    let lastInputValue = inputRange.value;
    let preventChange = false;
    const updateValue = (event) => {
      const { width, x } = inputRange.getBoundingClientRect();
      const percentage = (event.clientX - x) / width;
      const min = Number.parseFloat(inputRange.min) || 0;
      const max = Number.parseFloat(inputRange.max) || 100;
      const step = Number.parseFloat(inputRange.step) || 1;
      const possibleRange = max - min;
      const newValue = min + percentage * possibleRange;
      inputRange.value = `${inputRange.step === "any" ? newValue : Math.round(newValue / step) * step}`;
      if (lastValue !== inputRange.value && event.type === "click") {
        lastInputValue = inputRange.value;
        lastValue = inputRange.value;
        inputRange.dispatchEvent(new Event("change"));
      } else if (lastInputValue !== inputRange.value && event.type !== "click") {
        lastInputValue = inputRange.value;
        inputRange.dispatchEvent(new Event("input"));
      }
      updateStyles2();
    };
    const onChange = (event) => {
      if (preventChange) {
        event.preventDefault();
        event.stopPropagation();
        preventChange = false;
        resetValueOnTouch();
        return;
      }
      lastInputValue = inputRange.value;
      lastValue = inputRange.value;
      updateStyles2();
    };
    const resetValueOnTouch = () => {
      const resetToValue = lastValue;
      inputRange.value = resetToValue;
      updateStyles2();
      requestAnimationFrame(() => {
        if (lastValue !== resetToValue) {
          return;
        }
        inputRange.value = resetToValue;
        updateStyles2();
      });
    };
    const onPointerDown = (event) => {
      preventChange = false;
      if (event.target === trigger.label) {
        return resetValueOnTouch();
      }
      updateValue(event);
    };
    const onPointerUp = (event) => {
      if (event.target === trigger.label) {
        preventChange = true;
        return resetValueOnTouch();
      }
    };
    const onPointerMove = (event) => {
      if (event.target === trigger.label) {
        return resetValueOnTouch();
      }
      updateValue(event);
    };
    const onClick = (event) => {
      updateValue(event);
    };
    const [updateStyles2, disposeStyles] = registerStyleUpdater(trigger.clip, () => {
      const { width, height, borderRadius } = getPseudoStyles(inputRange, "::-webkit-slider-thumb");
      const min = Number.parseFloat(inputRange.min) || 0;
      const max = Number.parseFloat(inputRange.max) || 100;
      const value = Number.parseFloat(inputRange.value);
      const percentage = (value - min) / (max - min);
      const left = `calc(${percentage * 100}% - ${width * percentage}px)`;
      return [
        "all: revert",
        "position: absolute",
        "top: 50%",
        `left: ${left}`,
        "transform: translateY(-50%)",
        `width: ${width}px`,
        `height: ${height}px`,
        `border-radius: ${borderRadius}`
      ];
    });
    const disposeClick = trigger.onSimulateClick(onClick);
    inputRange.addEventListener("change", onChange, true);
    trigger.label.addEventListener("pointerdown", onPointerDown, true);
    trigger.label.addEventListener("pointermove", onPointerMove, true);
    trigger.label.addEventListener("pointerup", onPointerUp, true);
    return () => {
      disposeStyles();
      disposeClick();
      inputRange.removeEventListener("change", onChange);
      trigger.label.removeEventListener("pointerdown", onPointerDown);
      trigger.label.removeEventListener("pointermove", onPointerMove);
      trigger.label.removeEventListener("pointerup", onPointerUp);
    };
  }
  function handleInputable(element) {
    const disposeInputRange = handleInputRange(element);
    if (disposeInputRange) {
      return disposeInputRange;
    }
    const trigger = clickableTriggers.get(element);
    if (!trigger || !isInputableElement(element)) {
      return;
    }
    const onClick = () => {
      element.focus();
    };
    const dispose = trigger.onSimulateClick(onClick);
    return () => {
      dispose();
    };
  }
  var lastActiveTrigger = typeof document !== "undefined" ? document.activeElement : null;
  // Track It! patch (4/6): was a 0ms interval (about 250 runs a second)
  setInterval(() => {
    const activeElement = typeof document !== "undefined" ? document.activeElement : null;
    if (activeElement === lastActiveTrigger) {
      return;
    }
    if (lastActiveTrigger) {
      const trigger2 = clickableTriggers.get(lastActiveTrigger);
      if (trigger2 && hiddenTriggers.has(trigger2.label)) {
        triggersRoot.appendChild(trigger2.label);
      }
    }
    lastActiveTrigger = activeElement;
    if (activeElement && !isInputableElement(activeElement)) {
      return;
    }
    if (!activeElement || hiddenTriggers.has(activeElement)) {
      return;
    }
    const trigger = clickableTriggers.get(activeElement);
    if (!trigger) {
      return;
    }
    hiddenTriggers.add(trigger.label);
    trigger.label.remove();
  }, 100);

  // x/package/dist/methods/click-passthrough/forward-events.js
  function clonePointerEvent(type, event) {
    return new PointerEvent(type, {
      bubbles: true,
      altKey: event.altKey,
      cancelable: event.cancelable,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      shiftKey: event.shiftKey,
      view: event.view,
      detail: event.detail,
      which: event.which,
      composed: event.composed,
      button: event.button,
      buttons: event.buttons,
      clientX: event.clientX,
      clientY: event.clientY,
      movementX: event.movementX,
      movementY: event.movementY,
      screenX: event.screenX,
      screenY: event.screenY,
      isPrimary: event.isPrimary,
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      pressure: event.pressure,
      tangentialPressure: event.tangentialPressure,
      tiltX: event.tiltX,
      tiltY: event.tiltY,
      twist: event.twist,
      width: event.width,
      height: event.height,
      relatedTarget: event.relatedTarget
    });
  }
  // Track It! patch (6/6): the element under the finger, ignoring the tap
  // overlays. Hiding all overlays to ask (as before) re-laid out the whole page
  // several times per tap, which delayed whatever the tap opened.
  function elementBelowOverlays(x, y) {
    return document.elementsFromPoint(x, y).find((el) => !triggersRoot.contains(el));
  }
  function forwardEvents(element) {
    const trigger = clickableTriggers.get(element);
    const isInputRange = isInputRangeElement(element);
    if (!trigger) {
      return;
    }
    let pointerTarget = null;
    let touchTarget = null;
    let mouseTarget = null;
    const getTarget = (clientX, clientY) => {
      if (isInputRange || clientX == null || clientY == null) {
        return element;
      }
      return elementBelowOverlays(clientX, clientY) ?? element;
    };
    const onPointerEvent = (event) => {
      pointerTarget ??= getTarget(event.clientX, event.clientY);
      const forwardedEvent = clonePointerEvent(event.type, event);
      pointerTarget.dispatchEvent(forwardedEvent);
      if (event.type === "pointerup" || event.type === "pointercancel") {
        pointerTarget = null;
      }
    };
    const onMouseEvent = (event) => {
      mouseTarget ??= pointerTarget ?? getTarget(event.clientX, event.clientY);
      const forwardedEvent = clonePointerEvent(event.type, event);
      mouseTarget.dispatchEvent(forwardedEvent);
      if (event.type === "mouseup" || event.type === "mousecancel") {
        mouseTarget = null;
      }
    };
    const onTouchEvent = (event) => {
      touchTarget ??= pointerTarget ?? getTarget(event.targetTouches[0]?.clientX, event.targetTouches[0]?.clientY);
      const forwardedEvent = new TouchEvent(event.type, {
        bubbles: true,
        altKey: event.altKey,
        cancelable: event.cancelable,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        shiftKey: event.shiftKey,
        touches: mapTouches(touchTarget, event.touches),
        changedTouches: mapTouches(touchTarget, event.changedTouches),
        targetTouches: mapTouches(touchTarget, event.targetTouches),
        view: event.view,
        detail: event.detail,
        which: event.which,
        composed: event.composed
      });
      touchTarget.dispatchEvent(forwardedEvent);
      if (event.type === "touchend" || event.type === "touchcancel") {
        touchTarget = null;
      }
    };
    trigger.label.addEventListener("mousedown", onMouseEvent, true);
    trigger.label.addEventListener("mousemove", onMouseEvent, true);
    trigger.label.addEventListener("mouseup", onMouseEvent, true);
    trigger.label.addEventListener("pointerdown", onPointerEvent, true);
    trigger.label.addEventListener("pointermove", onPointerEvent, true);
    trigger.label.addEventListener("pointerup", onPointerEvent, true);
    trigger.label.addEventListener("pointercancel", onPointerEvent, true);
    trigger.label.addEventListener("touchstart", onTouchEvent, true);
    trigger.label.addEventListener("touchmove", onTouchEvent, true);
    trigger.label.addEventListener("touchend", onTouchEvent, true);
    trigger.label.addEventListener("touchcancel", onTouchEvent, true);
    return () => {
      trigger.label.removeEventListener("mousedown", onMouseEvent);
      trigger.label.removeEventListener("mousemove", onMouseEvent);
      trigger.label.removeEventListener("mouseup", onMouseEvent);
      trigger.label.removeEventListener("pointerdown", onPointerEvent);
      trigger.label.removeEventListener("pointermove", onPointerEvent);
      trigger.label.removeEventListener("pointerup", onPointerEvent);
      trigger.label.removeEventListener("pointercancel", onPointerEvent);
      trigger.label.removeEventListener("touchstart", onTouchEvent);
      trigger.label.removeEventListener("touchmove", onTouchEvent);
      trigger.label.removeEventListener("touchend", onTouchEvent);
      trigger.label.removeEventListener("touchcancel", onTouchEvent);
    };
  }
  function mapTouches(element, touches) {
    return [...touches].map((touch) => {
      return new Touch({
        altitudeAngle: touch.altitudeAngle,
        azimuthAngle: touch.azimuthAngle,
        clientX: touch.clientX,
        clientY: touch.clientY,
        force: touch.force,
        identifier: touch.identifier,
        pageX: touch.pageX,
        pageY: touch.pageY,
        radiusX: touch.radiusX,
        radiusY: touch.radiusY,
        rotationAngle: touch.rotationAngle,
        screenX: touch.screenX,
        screenY: touch.screenY,
        target: element,
        touchType: touch.touchType
      });
    });
  }

  // x/package/dist/methods/click-passthrough/movable.js
  var cachedIsMovable = /* @__PURE__ */ new WeakMap();
  function isMovableElement(element) {
    if (isInputRangeElement(element)) {
      return true;
    }
    if (!cachedIsMovable.has(element)) {
      if (!getTouchActionCandidates().has(element)) {
        return false;
      }
      const touchAction = getComputedStyle(element).touchAction;
      const isMovable = isMovableTouchAction(touchAction);
      cachedIsMovable.set(element, isMovable);
      requestAnimationFrame(() => {
        cachedIsMovable.delete(element);
      });
    }
    return cachedIsMovable.get(element);
  }
  function handleMovable(element) {
    const trigger = clickableTriggers.get(element);
    const isInputRange = isInputRangeElement(element);
    if (!trigger || !isMovableElement(element)) {
      return;
    }
    let pointerDown = null;
    let pointerMove = false;
    let startX = 0;
    let startY = 0;
    let x = 0;
    let y = 0;
    let flippedDirection = false;
    function onPointerDown(event) {
      const box = element.getBoundingClientRect();
      startX = event.clientX - box.x;
      startY = event.clientY - box.y;
      x = startX;
      y = startY;
      pointerMove = false;
      pointerDown = event;
      updateClipStyles();
      updateInputStyles();
    }
    const onPointerMove = (event) => {
      const box = element.getBoundingClientRect();
      x = event.clientX - box.x;
      y = event.clientY - box.y;
      pointerMove = true;
      flippedDirection = !flippedDirection;
      updateClipStyles();
    };
    const onPointerUp = () => {
      if (!pointerMove && pointerDown) {
        trigger.simulateClick(clonePointerEvent("click", {
          altKey: pointerDown.altKey,
          cancelable: pointerDown.cancelable,
          ctrlKey: pointerDown.ctrlKey,
          metaKey: pointerDown.metaKey,
          shiftKey: pointerDown.shiftKey,
          view: pointerDown.view,
          detail: pointerDown.detail,
          which: pointerDown.which,
          composed: pointerDown.composed,
          clientX: pointerDown.clientX,
          clientY: pointerDown.clientY,
          screenX: pointerDown.screenX,
          screenY: pointerDown.screenY
        }));
        if (!shouldVibrate()) {
          trigger.input.disabled = true;
          setTimeout(() => {
            trigger.input.disabled = false;
          });
        }
      }
      trigger.input.checked = false;
      pointerMove = false;
      pointerDown = null;
      updateClipStyles();
      updateInputStyles();
      requestAnimationFrame(() => {
        trigger.input.checked = false;
        updateClipStyles();
        updateInputStyles();
      });
    };
    const [updateInputStyles, disposeInputStyles] = registerStyleUpdater(trigger.input, () => {
      return [
        "all: revert",
        "position: absolute",
        "width: 100%",
        "height: 100%",
        "top: 50%",
        "left: 50%",
        "transform: translate(-50%, -50%)",
        "touch-action: none"
      ];
    });
    const [updateClipStyles, disposeClipStyles] = registerStyleUpdater(trigger.clip, () => {
      const opacity = debugMode ? 0.4 : 0;
      if (!pointerMove || !pointerDown) {
        const computedStyle = getComputedStyle(element);
        if (isInputRange) {
          return [
            "overflow: hidden",
            `opacity: ${opacity}`,
            `clip-path: inset(0 round ${computedStyle.borderRadius})`
          ];
        }
        return [
          "all: revert",
          "width: 100%",
          "height: 100%",
          "overflow: hidden",
          `opacity: ${opacity}`,
          `clip-path: inset(0 round ${computedStyle.borderRadius})`
        ];
      }
      const scale = 0.4;
      const height = 31 * scale;
      const width = 70 * scale;
      const vibrate = shouldVibrate();
      const top = (vibrate ? startY : y) - height / 2;
      const left = (vibrate ? startX : x) - width / 2;
      const deltaX = x - startX;
      const deltaY = y - startY;
      const angleDeg = Math.atan2(deltaY, deltaX) * (180 / Math.PI);
      const angleDeg360 = (angleDeg % 360 + 360) % 360;
      return [
        "all: unset",
        "position: absolute",
        "overflow: hidden",
        `height: ${height}px`,
        `width: ${width}px`,
        "top: 0",
        "left: 0",
        `direction: ${!vibrate || flippedDirection ? "rtl" : "ltr"}`,
        `transform: translate(${left}px, ${top}px) rotate(${angleDeg360}deg) translateX(${vibrate ? 0 : 50}px)`,
        `opacity: ${opacity}`
      ];
    });
    const setPointerCapture = element.setPointerCapture;
    const releasePointerCapture = element.releasePointerCapture;
    element.setPointerCapture = () => {
    };
    element.releasePointerCapture = () => {
    };
    trigger.input.addEventListener("pointerdown", onPointerDown, true);
    trigger.input.addEventListener("pointermove", onPointerMove, true);
    trigger.input.addEventListener("pointerup", onPointerUp, true);
    return () => {
      disposeClipStyles();
      disposeInputStyles();
      element.setPointerCapture = setPointerCapture;
      element.releasePointerCapture = releasePointerCapture;
      trigger.input.removeEventListener("pointerdown", onPointerDown);
      trigger.input.removeEventListener("pointermove", onPointerMove);
      trigger.input.removeEventListener("pointerup", onPointerUp);
    };
  }
  function isNativeMovableElement(element) {
    if (element.draggable) {
      return true;
    }
    const tagName = element.tagName.toLowerCase();
    const switchAttribute = element.getAttribute("switch");
    return tagName === "input" && element.type === "checkbox" && switchAttribute !== null && switchAttribute !== "false";
  }

  // x/package/dist/methods/click-passthrough/clickable.js
  var triggersRoot = typeof document !== "undefined" ? document.createElement("div") : null;
  if (triggersRoot && hiddenTrigger) {
    triggersRoot.setAttribute("for", "ios-vibrator-pro-max-content-triggers");
    triggersRoot.appendChild(hiddenTrigger.label);
    ignoredElements.add(triggersRoot);
  }
  var CLICKABLE = /* @__PURE__ */ new Set([
    "button",
    "input",
    "textarea",
    "select",
    "label"
  ]);
  var clickableTriggers = /* @__PURE__ */ new Map();
  var CLICKABLE_ROLES = /* @__PURE__ */ new Set([
    "button",
    "input",
    "textarea",
    "select",
    "checkbox",
    "label",
    "slider",
    "range",
    "spinbutton",
    "switch",
    "tab",
    "tabpanel",
    "treeitem"
  ]);
  function isClickableElement(element) {
    const tagName = element.tagName.toLowerCase();
    if (isNativeMovableElement(element)) {
      return false;
    }
    if (isMovableElement(element)) {
      return true;
    }
    return CLICKABLE_ROLES.has(element.role ?? "") || CLICKABLE.has(tagName);
  }
  var anchorId = 1;
  var ignoreRootClick = false;
  rootTrigger?.label.addEventListener("click", (event) => {
    if (isNativeMovableElement(event.target)) {
      return;
    }
    // Track It! patch (3/6): a real tap that already reached a control (for
    // example through its enlarged hit area, outside its overlay) has been
    // handled once; re-dispatching a copy here made it count twice.
    if (!ignoreRootClick && event.isTrusted && event.target.closest &&
      event.target.closest('button, a[href], input, select, textarea, [role="button"], [role="radio"], [role="tab"], [role="option"]')) {
      return;
    }
    if (ignoreRootClick) {
      if (ignoreRootClick === "prevent") {
        event.preventDefault();
      }
      return;
    }
    event.stopPropagation();
    ignoreRootClick = "prevent";
    const clickEvent = clonePointerEvent("click", event);
    event.target.dispatchEvent(clickEvent);
    ignoreRootClick = false;
    if (shouldVibrate()) {
      return;
    }
    event.preventDefault();
  });
  // Track It! patch (5/6): overlays sit above everything. Behind an open
  // dialog (the page is made inert) they covered the dialog's text field, and
  // while typing they made every keystroke re-lay out one overlay per button.
  // Hide them in both cases; taps then reach the real element directly.
  var TEXT_ENTRY = 'textarea, select, input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="button"]):not([type="submit"]):not([type="reset"])';
  function isOverlaySuspended(element) {
    if (element.closest && element.closest("[inert]")) {
      return true;
    }
    const active = document.activeElement;
    return !!(active && active !== element && active.matches && active.matches(TEXT_ENTRY));
  }
  if (typeof document !== "undefined") {
    document.addEventListener("focusin", (event) => {
      if (event.target.matches && event.target.matches(TEXT_ENTRY)) {
        updateStyles();
      }
    }, true);
    // Bring them back only after the tap that moved focus away has ended;
    // returning mid-tap, they would catch its end and lose the click
    document.addEventListener("focusout", () => setTimeout(updateStyles, 350), true);
    new MutationObserver(() => updateStyles()).observe(document.documentElement, { attributes: true, subtree: true, attributeFilter: ["inert"] });
  }
  function handleClickable(element, force = false) {
    // Track It! patch (1/6): no overlay on text entry fields. A tap routed
    // through the overlay focuses the field with the caret at the start.
    if (!force && element.matches && element.matches('textarea, select, input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="button"]):not([type="submit"]):not([type="reset"])')) {
      return;
    }
    const isInputRange = isInputRangeElement(element);
    if (!force && !isClickableElement(element)) {
      return;
    }
    if (clickableTriggers.has(element)) {
      return;
    }
    const trigger = {
      ...createVibrationTrigger(),
      clip: document.createElement("div"),
      simulateClick,
      onSimulateClick
    };
    ignoredElements.add(trigger.clip);
    trigger.clip.appendChild(trigger.input);
    trigger.clip.setAttribute("style", "display: none !important");
    trigger.label.appendChild(trigger.clip);
    const anchorName = `--ios-vibrator-pro-max-${anchorId++}`;
    let stopPointerEvents = false;
    let misdirectedTarget = null;
    function onPointerDown(event) {
      if (isInputRange && event.target === trigger.input) {
        return;
      }
      // Track It! patch (2/6): overlays sit at the top z-index, above modals
      // and fixed bars too. Remember what is really under the finger when it
      // is not this overlay's element, and send the tap there instead.
      const stack = document.elementsFromPoint(event.clientX, event.clientY);
      const realTarget = stack.find((el) => !triggersRoot.contains(el)) ?? null;
      misdirectedTarget = realTarget && realTarget !== element && !element.contains(realTarget) ? realTarget : null;
      // What the finger reaches without this overlay; only switch its
      // pointer events off (a style change, costly) when that is not the element
      const touchedElement = stack.find((el) => el !== trigger.label && !trigger.label.contains(el));
      if (touchedElement !== element) {
        stopPointerEvents = true;
        updateStyles2();
      }
    }
    function onPointerUp() {
      stopPointerEvents = false;
      updateStyles2();
    }
    function onClick(event) {
      if (event.target !== trigger.label) {
        return;
      }
      if (misdirectedTarget) {
        const realTarget = misdirectedTarget;
        misdirectedTarget = null;
        rootTrigger.input.disabled = true;
        ignoreRootClick = true;
        realTarget.dispatchEvent(clonePointerEvent("click", event));
        ignoreRootClick = false;
        rootTrigger.input.disabled = false;
        if (realTarget.matches && realTarget.matches("input, textarea, select")) realTarget.focus();
        if (!shouldVibrate()) {
          event.preventDefault();
        }
        return;
      }
      simulateClick(event);
      if (!shouldVibrate()) {
        event.preventDefault();
      }
    }
    const callbacks = /* @__PURE__ */ new Set();
    function onSimulateClick(callback) {
      callbacks.add(callback);
      return () => {
        callbacks.delete(callback);
      };
    }
    function simulateClick(event) {
      rootTrigger.input.disabled = true;
      ignoreRootClick = true;
      element.dispatchEvent(clonePointerEvent("click", event));
      ignoreRootClick = false;
      rootTrigger.input.disabled = false;
      callbacks.forEach((callback) => callback(event));
    }
    const computedStyle = getComputedStyle(element);
    const existingAnchorName = computedStyle.getPropertyValue("anchor-name");
    element.style.setProperty("anchor-name", `${anchorName}${existingAnchorName !== "none" ? `, ${existingAnchorName}` : ""}`);
    const [updateStyles2, disposeStyles] = registerStyleUpdater(trigger.label, () => {
      if (isOverlaySuspended(element)) {
        return ["all: unset", "display: none"];
      }
      const computedStyle2 = getComputedStyle(element);
      const highlightColor = computedStyle2.getPropertyValue("-webkit-tap-highlight-color");
      return [
        "all: unset",
        "position: absolute",
        "z-index: 2147483647",
        "top: anchor(top)",
        "left: anchor(left)",
        "bottom: anchor(bottom)",
        "right: anchor(right)",
        `position-anchor: ${anchorName}`,
        `border-radius: ${computedStyle2.borderRadius}`,
        `pointer-events: ${stopPointerEvents ? "none" : "auto"}`,
        `-webkit-tap-highlight-color: ${highlightColor}`
      ];
    });
    const triggers = /* @__PURE__ */ new Set();
    triggers.add(trigger.label);
    clickableTriggers.set(element, trigger);
    triggersRoot.appendChild(trigger.label);
    trigger.label.addEventListener("pointerdown", onPointerDown, true);
    trigger.label.addEventListener("pointerup", onPointerUp, true);
    trigger.label.addEventListener("click", onClick, true);
    return () => {
      disposeStyles();
      trigger.label.removeEventListener("pointerdown", onPointerDown);
      trigger.label.removeEventListener("pointerup", onPointerUp);
      trigger.label.removeEventListener("click", onClick);
      clickableTriggers.delete(element);
      trigger.label.remove();
    };
  }
  rootTrigger?.label.addEventListener("click", (event) => {
    if (event.target !== rootTrigger?.label) {
      return;
    }
    const { clientX, clientY } = event;
    const rects = [...clickableTriggers].filter(([element]) => !isOverlaySuspended(element)).map(([element, trigger2]) => {
      const rect = element.getBoundingClientRect();
      const dx = Math.max(rect.left - clientX, 0, clientX - rect.right);
      const dy = Math.max(rect.top - clientY, 0, clientY - rect.bottom);
      const distance2 = Math.sqrt(dx * dx + dy * dy);
      return [distance2, trigger2];
    });
    if (!rects.length) {
      return;
    }
    rects.sort(([d1], [d2]) => d1 - d2);
    const [distance, trigger] = rects[0];
    if (distance && distance <= 15) {
      const clickEvent = clonePointerEvent("click", event);
      trigger.simulateClick(clickEvent);
    }
  }, true);

  // x/package/dist/methods/click-passthrough/index.js
  var elementDisposers = /* @__PURE__ */ new WeakMap();
  var debugMode = false;
  function enableDebugMode(enabled = true) {
    debugMode = enabled;
    updateStyles();
  }
  function handleAddElement(element) {
    if (elementDisposers.has(element)) {
      return () => {
      };
    }
    for (const child of element.childNodes) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        handleAddElement(child);
      }
    }
    const disposers = [
      handleClickable(element),
      handleInputable(element),
      forwardEvents(element),
      handleMovable(element)
    ];
    elementDisposers.set(element, () => {
      disposers.reverse();
      for (const dispose of disposers) {
        dispose?.();
      }
    });
    return () => {
      handleRemoveElement(element);
    };
  }
  function handleRemoveElement(element) {
    const dispose = elementDisposers.get(element);
    dispose?.();
    elementDisposers.delete(element);
    for (const child of element.childNodes) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        handleRemoveElement(child);
      }
    }
  }

  // x/package/dist/polyfill.js
  function polyfill(rawPatterns) {
    const patterns = typeof rawPatterns === "number" ? [rawPatterns] : [...rawPatterns];
    if (!patterns.length || patterns.some((pattern) => typeof pattern !== "number")) {
      return false;
    }
    setVibration(patterns);
    setBackgroundVibration(patterns);
    return true;
  }
  var style = null;
  if (rootTrigger) {
    style = document.createElement("style");
    rootTrigger.label.htmlFor = "ios-vibrator-pro-max";
    triggersRoot.appendChild(rootTrigger.input);
    rootTrigger.input.id = "ios-vibrator-pro-max";
    rootTrigger.input.name = "ios-vibrator-pro-max";
  }
  async function initPolyfill() {
    window.addEventListener("click", authorizeVibrations);
    window.addEventListener("touchend", authorizeVibrations);
    window.addEventListener("keyup", authorizeVibrations);
    window.addEventListener("keypress", authorizeVibrations);
    await asyncWait(250);
    if (!rootTrigger || !style) {
      return;
    }
    document.head.appendChild(style);
    document.body.prepend(rootTrigger.label);
    document.body.appendChild(triggersRoot);
    for (const attribute of document.body.attributes) {
      rootTrigger.label.setAttribute(attribute.name, attribute.value);
    }
    const body = document.body;
    let raf = null;
    let ignoreMutation = false;
    const updateBodyStyles = throttle(() => {
      raf = null;
      ignoreMutation = true;
      if (rootTrigger.label.className !== body.className) {
        rootTrigger.label.className = body.className;
      }
      style.remove();
      const bodyStyles = getComputedStyle(body);
      const rootTriggerStyles = getComputedStyle(rootTrigger.label);
      let styles = "";
      for (const style2 of bodyStyles) {
        if (rootTriggerStyles.getPropertyValue(style2) === bodyStyles.getPropertyValue(style2)) {
          continue;
        }
        styles += `${style2}: ${bodyStyles.getPropertyValue(style2)} !important;
`;
      }
      style.textContent = `
      label[for="ios-vibrator-pro-max"] {
        ${styles}
        -webkit-tap-highlight-color: transparent !important;
      }

      label[for="ios-vibrator-pro-max"] > * {
        -webkit-tap-highlight-color: initial !important;
      }

      html > body {
        display: contents !important;
      }

      html {
        background: ${bodyStyles.background} !important;
      }
    `;
      document.head.appendChild(style);
      setTimeout(() => {
        ignoreMutation = false;
      });
    }, 500);
    updateBodyStyles();
    for (const child of [...document.body.childNodes]) {
      if (ignoredElements.has(child)) {
        continue;
      }
      rootTrigger.label.appendChild(child);
      if (child.nodeType === Node.ELEMENT_NODE) {
        handleAddElement(child);
      }
    }
    const reparentObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (!ignoredElements.has(node)) {
            rootTrigger.label.appendChild(node);
          }
        }
      }
    });
    reparentObserver.observe(body, { childList: true });
    const observer = new MutationObserver((mutations) => {
      if (ignoreMutation) {
        return;
      }
      // Track It! patch (6/6): re-reading every body style (and swapping the
      // stylesheet, which restyles the whole page) ran before the next frame
      // after any change, e.g. a dialog opening. Only do it when the body's
      // own attributes or a stylesheet changed.
      if (mutations.some(affectsBodyStyles)) {
        raf ??= requestAnimationFrame(updateBodyStyles);
      }
      ignoreMutation = true;
      for (const mutation of mutations) {
        if (mutation.type === "characterData") {
          markStylesheetsDirty();
        }
        if (mutation.type === "childList") {
          for (const node of [...mutation.addedNodes, ...mutation.removedNodes]) {
            const name = node.nodeName;
            if (name === "STYLE" || name === "LINK") {
              markStylesheetsDirty();
            }
          }
        }
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            handleAddElement(node);
          }
        }
        for (const node of mutation.removedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            handleRemoveElement(node);
          }
        }
      }
      ignoreMutation = false;
    });
    function affectsBodyStyles(mutation) {
      if (mutation.target === rootTrigger.label && mutation.type === "attributes") {
        return true;
      }
      if (mutation.type === "characterData") {
        return mutation.target.parentNode?.nodeName === "STYLE";
      }
      return [...mutation.addedNodes, ...mutation.removedNodes].some((node) => node.nodeName === "STYLE" || node.nodeName === "LINK");
    }
    // The theme lives on <html>; the body's colours follow it
    new MutationObserver(() => {
      raf ??= requestAnimationFrame(updateBodyStyles);
    }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "style"] });
    observer.observe(rootTrigger.label, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      // Selectors targeting `touch-action` overwhelmingly key off these.
      attributeFilter: ["style", "class", "id"]
    });
    Object.defineProperty(document, "body", {
      get() {
        return rootTrigger.label;
      }
    });
  }
  if (polyfillKind) {
    navigator.vibrate = polyfill;
    if (document.readyState === "complete") {
      initPolyfill();
    } else {
      window.addEventListener("load", () => {
        initPolyfill();
      });
    }
  }
})();
