(() => {
  'use strict';

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const supportsHover = window.matchMedia('(hover: hover)');

  // ------------------------------------------------------------------------
  // 1. Conditional Popover Polyfill (Only when native Popover is missing)
  // ------------------------------------------------------------------------
  if (!Object.hasOwn(HTMLElement.prototype, 'popover')) {
    import('https://unpkg.com/@oddbird/popover-polyfill@latest/dist/popover.min.js').catch(() => {});
  }

  // ------------------------------------------------------------------------
  // 2. Responsive Navbar Measurement (ResizeObserver + Popover Sync)
  // ------------------------------------------------------------------------
  const header = document.querySelector('.site-header');
  const headerInner = header?.querySelector('.header-inner');
  const siteMenu = document.getElementById('site-menu');

  if (header && headerInner && siteMenu) {
    let lastMeasuredWidth = 0;

    const updateNavLayout = () => {
      const wasOpen = siteMenu.matches(':popover-open') || siteMenu.classList.contains(':popover-open');

      header.classList.add('is-measuring');
      header.classList.add('is-wide');
      siteMenu.removeAttribute('popover');

      const fitsInline = headerInner.scrollWidth <= headerInner.clientWidth + 1;

      if (!fitsInline) {
        header.classList.remove('is-wide');
        siteMenu.setAttribute('popover', 'auto');
        if (wasOpen && typeof siteMenu.showPopover === 'function') {
          try {
            siteMenu.showPopover();
          } catch {
            // Ignore if already open or polyfill pending
          }
        }
      }

      lastMeasuredWidth = header.getBoundingClientRect().width;
      requestAnimationFrame(() => {
        header.classList.remove('is-measuring');
      });
    };

    const resizeObserver = new ResizeObserver((entries) => {
      const currentWidth = entries[0]?.contentRect?.width ?? header.getBoundingClientRect().width;
      const isCurrentlyWide = header.classList.contains('is-wide');
      if (isCurrentlyWide || currentWidth > lastMeasuredWidth + 2 || lastMeasuredWidth === 0) {
        updateNavLayout();
      }
    });

    resizeObserver.observe(header);
    resizeObserver.observe(siteMenu);

    if (document.fonts?.ready) {
      document.fonts.ready.then(updateNavLayout);
    }

    // Close mobile popover when clicking an anchor link on the same page
    siteMenu.addEventListener('click', (event) => {
      const link = event.target.closest('a[href^="#"]');
      if (link && !header.classList.contains('is-wide') && typeof siteMenu.hidePopover === 'function') {
        try {
          siteMenu.hidePopover();
        } catch {
          // Safe no-op
        }
      }
    });
  }

  // Sticky Header Shadow on Scroll
  if (header) {
    const syncHeaderScroll = () => {
      header.classList.toggle('is-scrolled', window.scrollY > 12);
    };
    syncHeaderScroll();
    window.addEventListener('scroll', syncHeaderScroll, { passive: true });
  }

  // ------------------------------------------------------------------------
  // 3. Scroll Progress Indicator JS Fallback
  // ------------------------------------------------------------------------
  const scrollProgress = document.getElementById('scroll-progress');
  if (
    scrollProgress &&
    !CSS.supports('animation-timeline', 'scroll()') &&
    !prefersReducedMotion.matches
  ) {
    const updateProgress = () => {
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      const ratio = maxScroll > 0 ? Math.min(1, Math.max(0, window.scrollY / maxScroll)) : 0;
      scrollProgress.style.transform = `scaleX(${ratio})`;
    };
    updateProgress();
    window.addEventListener('scroll', updateProgress, { passive: true });
    window.addEventListener('resize', updateProgress, { passive: true });
  }

  // ------------------------------------------------------------------------
  // 4. Scrollspy (Native scroll-target-group + IntersectionObserver Fallback)
  // ------------------------------------------------------------------------
  const tocLinks = Array.from(document.querySelectorAll('.toc-nav a[href^="#"]'));
  if (tocLinks.length > 0) {
    const supportsScrollTargetGroup = CSS.supports('scroll-target-group', 'auto');

    if (supportsScrollTargetGroup) {
      const syncAriaCurrent = () => {
        const activeLink = document.querySelector('.toc-nav a:target-current');
        tocLinks.forEach((link) => {
          if (link === activeLink) {
            link.setAttribute('aria-current', 'true');
          } else {
            link.removeAttribute('aria-current');
          }
        });
      };
      syncAriaCurrent();
      document.addEventListener('scrollend', syncAriaCurrent, { passive: true });
    } else {
      const sectionMap = new Map();
      tocLinks.forEach((link) => {
        const targetId = link.getAttribute('href')?.slice(1);
        const targetEl = targetId ? document.getElementById(targetId) : null;
        if (targetEl) sectionMap.set(targetEl, link);
      });

      const tocObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            const activeLink = sectionMap.get(entry.target);
            tocLinks.forEach((link) => {
              const isActive = link === activeLink;
              link.classList.toggle('target-current', isActive);
              if (isActive) link.setAttribute('aria-current', 'true');
              else link.removeAttribute('aria-current');
            });
          });
        },
        { rootMargin: '-22% 0px -65% 0px', threshold: 0 }
      );

      sectionMap.forEach((_, sectionEl) => tocObserver.observe(sectionEl));
    }
  }

  // ------------------------------------------------------------------------
  // 5. Spring-Eased Scroll Reveals & Animated KPI Counters
  // ------------------------------------------------------------------------
  const revealTargets = Array.from(document.querySelectorAll('[data-reveal]'));
  const counterTargets = Array.from(document.querySelectorAll('[data-count-to]'));

  const animateCounter = (el) => {
    if (el.dataset.counted === 'true') return;
    el.dataset.counted = 'true';

    const target = Number(el.dataset.countTo);
    const decimals = Number(el.dataset.countDecimals || 0);
    const prefix = el.dataset.countPrefix || '';
    const suffix = el.dataset.countSuffix || '';

    if (prefersReducedMotion.matches || Number.isNaN(target)) {
      el.textContent = `${prefix}${target.toFixed(decimals)}${suffix}`;
      return;
    }

    const duration = 1150;
    const start = performance.now();

    const step = (now) => {
      const elapsed = Math.min(1, (now - start) / duration);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - elapsed, 3);
      const current = target * eased;
      el.textContent = `${prefix}${current.toFixed(decimals)}${suffix}`;
      if (elapsed < 1) {
        requestAnimationFrame(step);
      } else {
        el.textContent = `${prefix}${target.toFixed(decimals)}${suffix}`;
      }
    };
    requestAnimationFrame(step);
  };

  if (revealTargets.length > 0 && !prefersReducedMotion.matches && 'IntersectionObserver' in window) {
    document.documentElement.classList.add('js-reveal-enabled');

    const markRevealed = (el) => {
      el.setAttribute('data-reveal', 'visible');
      const staggerMs = Number(el.style.getPropertyValue('--stagger') || 0) * 75;
      setTimeout(() => {
        if (el.getAttribute('data-reveal') === 'visible') {
          el.setAttribute('data-reveal', 'done');
        }
      }, 850 + staggerMs);
    };

    const revealObserver = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            markRevealed(entry.target);
            obs.unobserve(entry.target);
          }
        });
      },
      { rootMargin: '0px 0px -6% 0px', threshold: 0.08 }
    );

    revealTargets.forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight * 0.92) {
        markRevealed(el);
      } else {
        revealObserver.observe(el);
      }
    });
  } else {
    revealTargets.forEach((el) => el.setAttribute('data-reveal', 'visible'));
  }

  if (counterTargets.length > 0 && 'IntersectionObserver' in window) {
    const countObserver = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            animateCounter(entry.target);
            obs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.35 }
    );
    counterTargets.forEach((el) => countObserver.observe(el));
  } else {
    counterTargets.forEach(animateCounter);
  }

  // ------------------------------------------------------------------------
  // 6. Pause / Resume Ambient Motion Control (WCAG 2.2.2)
  // ------------------------------------------------------------------------
  const motionToggle = document.getElementById('motion-toggle');
  if (motionToggle) {
    const labelSpan = motionToggle.querySelector('.motion-toggle-label');
    const syncMotionLabel = (paused) => {
      document.documentElement.dataset.motionPaused = paused ? 'true' : 'false';
      if (labelSpan) {
        labelSpan.textContent = paused ? 'Play animations' : 'Pause animations';
      }
    };

    if (prefersReducedMotion.matches) {
      syncMotionLabel(true);
    }

    motionToggle.addEventListener('click', () => {
      const currentlyPaused = document.documentElement.dataset.motionPaused === 'true';
      syncMotionLabel(!currentlyPaused);
    });
  }

  // ------------------------------------------------------------------------
  // 7. Pointer Spotlight on Bento Cards & Hero Stage Micro-Tilt
  // ------------------------------------------------------------------------
  if (supportsHover.matches && !prefersReducedMotion.matches) {
    document.querySelectorAll('.bento-card').forEach((card) => {
      card.addEventListener('pointermove', (event) => {
        const rect = card.getBoundingClientRect();
        card.style.setProperty('--pointer-x', `${event.clientX - rect.left}px`);
        card.style.setProperty('--pointer-y', `${event.clientY - rect.top}px`);
      });
    });

    const stageCard = document.querySelector('.stage-card');
    if (stageCard) {
      stageCard.addEventListener('pointermove', (event) => {
        if (document.documentElement.dataset.motionPaused === 'true') return;
        const rect = stageCard.getBoundingClientRect();
        const relX = (event.clientX - rect.left) / rect.width - 0.5;
        const relY = (event.clientY - rect.top) / rect.height - 0.5;
        stageCard.style.transform = `perspective(950px) rotateX(${(-relY * 5).toFixed(2)}deg) rotateY(${(relX * 6).toFixed(2)}deg)`;
      });
      stageCard.addEventListener('pointerleave', () => {
        stageCard.style.transform = '';
      });
    }
  }

  // ------------------------------------------------------------------------
  // 8. Accordion Expand All / Collapse All (Invoker Commands + Fallback)
  // ------------------------------------------------------------------------
  const toggleAllHandler = (button, accordion) => {
    const expand = button.getAttribute('aria-expanded') !== 'true';
    accordion.querySelectorAll('details').forEach((item) => {
      item.open = expand;
    });
    button.setAttribute('aria-expanded', String(expand));
  };

  if (Object.hasOwn(HTMLButtonElement.prototype, 'commandForElement')) {
    document.addEventListener(
      'command',
      (event) => {
        if (event.command !== '--toggle-all') return;
        toggleAllHandler(event.source, event.target);
      },
      { capture: true }
    );
  } else {
    document.querySelectorAll('[command="--toggle-all"]').forEach((button) => {
      button.addEventListener('click', () => {
        const targetId = button.getAttribute('commandfor');
        const target = targetId ? document.getElementById(targetId) : null;
        if (target) toggleAllHandler(button, target);
      });
    });
  }

  document.addEventListener(
    'toggle',
    (event) => {
      if (!event.target.matches('.accordion-list details')) return;
      const accordion = event.target.closest('.accordion-list');
      if (!accordion) return;
      const button = document.querySelector(`[command="--toggle-all"][commandfor="${CSS.escape(accordion.id)}"]`);
      if (!button) return;
      const items = Array.from(accordion.querySelectorAll('details'));
      const allOpen = items.length > 0 && items.every((d) => d.open);
      button.setAttribute('aria-expanded', String(allOpen));
    },
    { capture: true }
  );

  // ------------------------------------------------------------------------
  // 9. Copy-to-Clipboard Helper
  // ------------------------------------------------------------------------
  document.addEventListener('click', async (event) => {
    const btn = event.target.closest('[data-copy-source]');
    if (!btn) return;
    const sourceEl = document.getElementById(btn.dataset.copySource);
    const textToCopy = sourceEl?.textContent?.trim();
    if (!textToCopy) return;

    const originalText = btn.textContent;
    try {
      await navigator.clipboard.writeText(textToCopy);
      btn.textContent = 'Copied!';
      setTimeout(() => {
        btn.textContent = originalText;
      }, 2000);
    } catch {
      btn.textContent = 'Select & copy';
      setTimeout(() => {
        btn.textContent = originalText;
      }, 2000);
    }
  });
})();
