(() => {
  'use strict';

  const form = document.getElementById('delete-account-form');
  const dialog = document.getElementById('confirm-delete-dialog');
  const receiptSection = document.getElementById('delete-receipt');
  const formCard = document.getElementById('delete-form-card');

  if (!form || !dialog) return;

  const supportsUserInvalid = CSS.supports('selector(:user-invalid)');
  const dirtyState = new WeakMap();
  const flagged = new WeakSet();
  const announced = new WeakSet();

  // Single centralized polite live region for validation announcements
  const announcer = document.createElement('div');
  announcer.setAttribute('aria-live', 'polite');
  announcer.classList.add('visually-hidden');
  document.body.append(announcer);
  let announceTimer;
  let announcedField;

  const spokenText = (node) => {
    const copy = node.cloneNode(true);
    copy.querySelectorAll('[aria-hidden="true"]').forEach((n) => n.remove());
    copy.querySelectorAll('[role="img"][aria-label]').forEach((n) => {
      n.replaceWith(`${n.getAttribute('aria-label')}: `);
    });
    return copy.textContent.replace(/\s+/g, ' ').trim();
  };

  const linkError = (el, shown) => {
    const errorId = el.dataset.error;
    if (!errorId) return;
    const ids = (el.getAttribute('aria-describedby') || '')
      .split(/\s+/)
      .filter((id) => id && id !== errorId);
    if (shown) ids.push(errorId);
    if (ids.length) el.setAttribute('aria-describedby', ids.join(' '));
    else el.removeAttribute('aria-describedby');
  };

  const announceError = (el) => {
    const errorEl = document.getElementById(el.dataset.error);
    if (!errorEl) return;
    const labelText = el.labels?.[0] ? `${spokenText(el.labels[0])}: ` : '';
    clearTimeout(announceTimer);
    announcer.textContent = '';
    announcedField = el;
    announceTimer = setTimeout(() => {
      announcer.textContent = labelText + spokenText(errorEl);
    }, 500);
  };

  const isFieldInvalid = (el) => {
    if (supportsUserInvalid) {
      return el.matches(':user-invalid');
    }
    return el.classList.contains('user-invalid-fallback');
  };

  const syncAria = (el, shouldAnnounce = false) => {
    if (!el.matches?.('input, select, textarea')) return;
    if (el.type === 'radio') return;

    const invalid = isFieldInvalid(el);
    if (invalid) {
      if (shouldAnnounce && !announced.has(el)) {
        announceError(el);
        announced.add(el);
      }
      el.setAttribute('aria-invalid', 'true');
      linkError(el, true);
      flagged.add(el);
    } else if (flagged.has(el) || el.getAttribute('aria-invalid') !== 'true') {
      el.setAttribute('aria-invalid', 'false');
      linkError(el, false);
      flagged.delete(el);
      announced.delete(el);
      if (announcedField === el) {
        clearTimeout(announceTimer);
        announcer.textContent = '';
      }
    }
  };

  const controls = Array.from(form.querySelectorAll('input, select, textarea'));
  controls.forEach((el) => {
    if (el.type !== 'radio') {
      el.setAttribute('aria-invalid', 'false');
    }
  });

  // Fallback tracking when :user-invalid is missing
  if (!supportsUserInvalid) {
    const updateFallback = (input, shouldAnnounce) => {
      const valid = input.validity.valid;
      input.classList.toggle('user-invalid-fallback', !valid);
      input.classList.toggle('user-valid-fallback', valid);
      syncAria(input, shouldAnnounce);
    };

    form.addEventListener(
      'blur',
      (e) => {
        const input = e.target;
        if (!input.checkValidity || input.type === 'radio') return;
        const state = dirtyState.get(input) || { hasInteracted: false, hasBlurred: false };
        state.hasBlurred = true;
        dirtyState.set(input, state);
        if (state.hasInteracted) updateFallback(input, true);
      },
      true
    );

    form.addEventListener('input', (e) => {
      const input = e.target;
      if (!input.checkValidity || input.type === 'radio') return;
      const state = dirtyState.get(input) || { hasInteracted: false, hasBlurred: false };
      state.hasInteracted = true;
      dirtyState.set(input, state);
      if (state.hasBlurred) updateFallback(input, false);
    });

    form.addEventListener('change', (e) => {
      const input = e.target;
      if (!input.checkValidity || input.type === 'radio') return;
      const state = dirtyState.get(input) || { hasInteracted: true, hasBlurred: true };
      state.hasInteracted = true;
      state.hasBlurred = true;
      dirtyState.set(input, state);
      updateFallback(input, true);
    });

    form.addEventListener(
      'invalid',
      (e) => {
        const input = e.target;
        dirtyState.set(input, { hasInteracted: true, hasBlurred: true });
        announced.add(input);
        updateFallback(input, false);
      },
      true
    );
  } else {
    form.addEventListener('blur', (e) => syncAria(e.target, true), true);
    form.addEventListener('input', (e) => {
      if (e.target.hasAttribute('aria-invalid')) syncAria(e.target, false);
    });
    form.addEventListener('change', (e) => syncAria(e.target, true), true);
    form.addEventListener(
      'invalid',
      (e) => {
        announced.add(e.target);
        syncAria(e.target, false);
      },
      true
    );
  }

  // ------------------------------------------------------------------------
  // Top-Layer Dialog Exit Animation Probe & Fallback (Firefox/Safari)
  // ------------------------------------------------------------------------
  let supportsDisplayTransition;
  const canTransitionDisplay = () => {
    if (supportsDisplayTransition !== undefined) return supportsDisplayTransition;
    if (!window.CSS?.supports?.('transition-behavior', 'allow-discrete') || !document.body) {
      return false;
    }
    const probe = document.createElement('div');
    probe.style.cssText = 'transition: display 1s allow-discrete !important; display: block;';
    document.body.appendChild(probe);
    getComputedStyle(probe).display;
    probe.style.display = 'none';
    supportsDisplayTransition = getComputedStyle(probe).display === 'block';
    probe.remove();
    return supportsDisplayTransition;
  };

  const supportsTopLayerExit = () =>
    Boolean(window.CSS?.supports?.('overlay', 'auto') && canTransitionDisplay());

  const closeTopLayer = async (dlg, returnVal = '') => {
    if (!supportsTopLayerExit()) {
      dlg.setAttribute('data-closing', '');
      const animations = dlg.getAnimations({ subtree: true });
      if (animations.length > 0) {
        await Promise.race([
          Promise.allSettled(animations.map((a) => a.finished)),
          new Promise((r) => setTimeout(r, 1200))
        ]);
      }
      if (!dlg.hasAttribute('data-closing')) return;
      dlg.removeAttribute('data-closing');
    }
    dlg.close(returnVal);
  };

  // Fallback for closedby="any" light dismiss in Safari
  if (!('closedBy' in HTMLDialogElement.prototype)) {
    const outside = (e, dlg) => {
      const r = dlg.getBoundingClientRect();
      return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    };
    let pressedOutside = false;
    dialog.addEventListener('pointerdown', (e) => {
      pressedOutside = outside(e, dialog);
    });
    dialog.addEventListener('pointerup', (e) => {
      if (pressedOutside && outside(e, dialog)) {
        closeTopLayer(dialog, '');
      }
    });
  }

  // Intercept Esc / cancel so exit animation plays cleanly
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    closeTopLayer(dialog, '');
  });

  // Intercept modal buttons when exit fallback is needed
  dialog.querySelectorAll('button[value]').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      if (!supportsTopLayerExit()) {
        event.preventDefault();
        closeTopLayer(dialog, btn.value);
      }
    });
  });

  // ------------------------------------------------------------------------
  // Form Submission -> Confirmation Modal -> Receipt
  // ------------------------------------------------------------------------
  const summaryEmail = document.getElementById('dialog-summary-email');
  const summaryScope = document.getElementById('dialog-summary-scope');

  form.addEventListener('submit', (event) => {
    event.preventDefault();

    if (!form.checkValidity()) {
      const firstInvalid = form.querySelector(':invalid');
      controls.forEach((ctrl) => syncAria(ctrl, false));
      firstInvalid?.focus();
      return;
    }

    const formData = new FormData(form);
    const email = String(formData.get('email') || '').trim();
    const scope = String(formData.get('deletion_scope') || 'full-account');

    if (summaryEmail) summaryEmail.textContent = email;
    if (summaryScope) {
      summaryScope.textContent =
        scope === 'google-disconnect'
          ? 'Revoke Google Business Profile access & delete synced profile cache'
          : 'Permanent GrahakHubAI account & all associated data deletion';
    }

    dialog.showModal();
  });

  dialog.addEventListener('close', () => {
    const choice = dialog.returnValue;
    dialog.returnValue = '';

    if (choice !== 'confirm-delete') return;

    const formData = new FormData(form);
    const email = String(formData.get('email') || '').trim();
    const scope = String(formData.get('deletion_scope') || 'full-account');

    const refIdEl = document.getElementById('receipt-ref-id');
    const receiptEmailEl = document.getElementById('receipt-email');
    const receiptScopeEl = document.getElementById('receipt-scope');
    const receiptTimeEl = document.getElementById('receipt-timestamp');

    const randomCode = Math.random().toString(36).slice(2, 8).toUpperCase();
    const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');

    if (refIdEl) refIdEl.textContent = `GH-DEL-${datePart}-${randomCode}`;
    if (receiptEmailEl) receiptEmailEl.textContent = email;
    if (receiptScopeEl) {
      receiptScopeEl.textContent =
        scope === 'google-disconnect'
          ? 'Google Business Profile disconnect & cache purge'
          : 'Full account & data deletion';
    }
    if (receiptTimeEl) {
      receiptTimeEl.textContent = new Date().toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short'
      });
    }

    if (formCard) formCard.hidden = true;
    if (receiptSection) {
      receiptSection.hidden = false;
      const heading = receiptSection.querySelector('h2');
      heading?.focus();
    }

    announcer.textContent = 'Account deletion request submitted. Your reference number is displayed.';
  });

  const resetReceiptBtn = document.getElementById('new-request-btn');
  if (resetReceiptBtn) {
    resetReceiptBtn.addEventListener('click', () => {
      form.reset();
      controls.forEach((ctrl) => {
        dirtyState.delete(ctrl);
        ctrl.classList.remove('user-invalid-fallback', 'user-valid-fallback');
        syncAria(ctrl, false);
      });
      if (receiptSection) receiptSection.hidden = true;
      if (formCard) formCard.hidden = false;
      document.getElementById('del-email')?.focus();
    });
  }
})();
