(() => {
  'use strict';

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  // ------------------------------------------------------------------------
  // 1. Hero Live Stage Switcher (Accessible Tabs + Gentle Auto-Cycle)
  // ------------------------------------------------------------------------
  const stageTabs = Array.from(document.querySelectorAll('.stage-tab'));
  const stagePanels = Array.from(document.querySelectorAll('[data-stage-panel]'));

  if (stageTabs.length > 0 && stagePanels.length > 0) {
    let activeIdx = 0;
    let userInteracted = false;

    const activateStageTab = (index, moveFocus = false) => {
      activeIdx = (index + stageTabs.length) % stageTabs.length;
      stageTabs.forEach((tab, idx) => {
        const selected = idx === activeIdx;
        tab.setAttribute('aria-selected', String(selected));
        tab.tabIndex = selected ? 0 : -1;
        if (selected && moveFocus) tab.focus();
      });
      stagePanels.forEach((panel, idx) => {
        panel.hidden = idx !== activeIdx;
      });
    };

    stageTabs.forEach((tab, idx) => {
      tab.addEventListener('click', () => {
        userInteracted = true;
        activateStageTab(idx);
      });

      tab.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowRight') {
          event.preventDefault();
          userInteracted = true;
          activateStageTab(idx + 1, true);
        } else if (event.key === 'ArrowLeft') {
          event.preventDefault();
          userInteracted = true;
          activateStageTab(idx - 1, true);
        } else if (event.key === 'Home') {
          event.preventDefault();
          userInteracted = true;
          activateStageTab(0, true);
        } else if (event.key === 'End') {
          event.preventDefault();
          userInteracted = true;
          activateStageTab(stageTabs.length - 1, true);
        }
      });
    });

    setInterval(() => {
      if (
        userInteracted ||
        prefersReducedMotion.matches ||
        document.documentElement.dataset.motionPaused === 'true'
      ) {
        return;
      }
      activateStageTab(activeIdx + 1);
    }, 5200);
  }

  // ------------------------------------------------------------------------
  // 2. Interactive AI GBP Simulator
  // ------------------------------------------------------------------------
  const SCENARIOS = {
    'five-star': {
      badge: 'Google Review • 5.0 ★★★★★',
      author: 'Priya S. • Local Guide',
      prompt:
        '"Super clean store, quick checkout, and the staff guided me to the exact product I needed. Easily the best spot in Indiranagar!"',
      keywords: ['#IndiranagarStore', '#TopRatedService', '#LocalFavorite'],
      actionLabel: 'Publish Reply to Google',
      outputs: {
        warm:
          'Thank you so much, Priya! We are thrilled our Indiranagar team made your visit effortless and welcoming. We look forward to seeing you again soon!',
        professional:
          'Dear Priya, thank you for sharing your 5-star review. Delivering fast checkout and attentive guidance at our Indiranagar branch is our top priority. We appreciate your support.',
        seo:
          'Thank you, Priya, for choosing our Indiranagar store! Our team takes pride in providing fast, helpful service across every product aisle. Visit us again anytime for the best local shopping experience.'
      }
    },
    'three-star': {
      badge: 'Google Review • 3.0 ★★★☆☆',
      author: 'Rohan M. • Verified Customer',
      prompt:
        '"Food quality and coffee were awesome, though weekend evening parking took a bit of waiting."',
      keywords: ['#ValetSupport', '#CustomerCare', '#FreshCoffee'],
      actionLabel: 'Publish Recovery Reply',
      outputs: {
        warm:
          'Hi Rohan! Thank you for loving our coffee and food—and we truly appreciate your honest note about Saturday parking. We have added weekend parking assistance after 6 PM so your next visit is much smoother!',
        professional:
          'Thank you for your feedback, Rohan. While we are glad you enjoyed our menu, we apologize for the weekend parking wait. We are expanding dedicated parking signage and evening support this month.',
        seo:
          'Thanks for reviewing our café, Rohan! We are happy our specialty coffee hit the mark and are actively improving weekend parking convenience for our neighborhood guests.'
      }
    },
    'festive-post': {
      badge: 'Google Business Post • Offer',
      author: 'AI Post Generator • Auto-Scheduled',
      prompt:
        'Prompt: "Create a weekend festive combo post with 20% off and strong Google Maps CTA for walk-in shoppers."',
      keywords: ['#WeekendOffer', '#GoogleMapsCTA', '#FestiveSpecial'],
      actionLabel: 'Schedule Google Post',
      outputs: {
        warm:
          'Celebrate this weekend with 20% OFF our signature combos! Drop by our store before Sunday 9 PM, tap "Directions" on Google Maps, and let our team treat you to something special.',
        professional:
          'Limited-Time Festive Offer: Enjoy 20% off selected store combos through Sunday. View our live inventory, hours, and instant driving directions directly on our Google Business Profile.',
        seo:
          'Festive Weekend Sale — Flat 20% OFF in-store! Searching for the best festive deals near you? Tap Directions on our Google Profile to claim your exclusive walk-in offer before Sunday.'
      }
    },
    'hours-sync': {
      badge: 'Multi-Location Sync • 12 Branches',
      author: 'AI Profile Guard • Holiday Alert',
      prompt:
        'Alert: Upcoming public holiday detected on calendar. Confirming special hours across 12 Google Business locations.',
      keywords: ['#ZeroClosedSurprises', '#12BranchesSynced', '#ProfileGuard'],
      actionLabel: 'Sync Hours Across 12 Profiles',
      outputs: {
        warm:
          'All 12 storefront profiles updated for the upcoming holiday (10:00 AM – 8:00 PM) with a friendly Google update post so customers never face unexpected closed doors!',
        professional:
          'Holiday special hours (10:00 AM – 8:00 PM) validated and staged for all 12 verified locations. Automated Q&A updated to display accurate open times in Google Search & Maps.',
        seo:
          'Special Holiday Hours synced across 12 local Google Business Profiles: Open 10 AM – 8 PM. Keeping Maps hours 100% accurate boosts "Open Now" local search visibility.'
      }
    }
  };

  const scenarioButtons = Array.from(document.querySelectorAll('.sim-scenario-btn'));
  const toneButtons = Array.from(document.querySelectorAll('.tone-btn'));
  const simBadge = document.getElementById('sim-badge');
  const simAuthor = document.getElementById('sim-author');
  const simPrompt = document.getElementById('sim-prompt');
  const simOutputText = document.getElementById('sim-output-text');
  const simKeywords = document.getElementById('sim-keywords');
  const simPublishBtn = document.getElementById('sim-publish-btn');
  const simRegenerateBtn = document.getElementById('sim-regenerate-btn');
  const simStatus = document.getElementById('sim-status');

  if (scenarioButtons.length > 0 && simOutputText) {
    let currentScenario = 'five-star';
    let currentTone = 'warm';
    let streamTimer = null;

    const renderSimulation = (animateTyping = true) => {
      const data = SCENARIOS[currentScenario];
      if (!data) return;

      if (streamTimer) {
        clearInterval(streamTimer);
        streamTimer = null;
      }

      if (simBadge) simBadge.textContent = data.badge;
      if (simAuthor) simAuthor.textContent = data.author;
      if (simPrompt) simPrompt.textContent = data.prompt;
      if (simPublishBtn) simPublishBtn.textContent = data.actionLabel;
      if (simStatus) simStatus.textContent = '';

      if (simKeywords) {
        simKeywords.replaceChildren(
          ...data.keywords.map((kw) => {
            const span = document.createElement('span');
            span.className = 'seo-chip';
            span.textContent = kw;
            return span;
          })
        );
      }

      const targetText = data.outputs[currentTone] || data.outputs.warm;
      const shouldSkipMotion =
        !animateTyping ||
        prefersReducedMotion.matches ||
        document.documentElement.dataset.motionPaused === 'true';

      if (shouldSkipMotion) {
        simOutputText.textContent = targetText;
        return;
      }

      const words = targetText.split(' ');
      let wordIdx = 0;
      simOutputText.textContent = '';

      streamTimer = setInterval(() => {
        wordIdx += 2;
        simOutputText.textContent = words.slice(0, wordIdx).join(' ');
        if (wordIdx >= words.length) {
          clearInterval(streamTimer);
          streamTimer = null;
        }
      }, 36);
    };

    scenarioButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        currentScenario = btn.dataset.scenario || 'five-star';
        scenarioButtons.forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
        renderSimulation(true);
      });
    });

    toneButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        currentTone = btn.dataset.tone || 'warm';
        toneButtons.forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
        renderSimulation(true);
      });
    });

    if (simRegenerateBtn) {
      simRegenerateBtn.addEventListener('click', () => {
        renderSimulation(true);
      });
    }

    if (simPublishBtn && simStatus) {
      simPublishBtn.addEventListener('click', () => {
        const scenarioData = SCENARIOS[currentScenario];
        simStatus.textContent = `Simulated: "${scenarioData.actionLabel}" queued to Google Business Profile.`;
      });
    }

    renderSimulation(false);
  }
})();
