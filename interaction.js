/* Dreams client export: local section navigation and visual-only pointer glow.
 * No network requests, tracking, persistence, submissions, or runtime dependencies.
 * Behavior copied from ClientSectionNavigator.tsx, useClientCardGlow.ts,
 * and lib/client-sections.ts. The saved markup and scoped CSS own the design.
 */
(function () {
  'use strict';

  var CLIENT_SECTIONS = [
    { id: 'client-top', label: 'Introduction' },
    { id: 'client-opportunity', label: 'The opportunity' },
    { id: 'client-records', label: 'Everyday records' },
    { id: 'client-estimate', label: 'Explore your value' },
    { id: 'client-examples', label: 'Provider examples' },
    { id: 'client-privacy', label: 'Privacy first' },
    { id: 'client-fit', label: 'Business fit' },
    { id: 'client-process', label: 'The process' },
    { id: 'client-questions', label: 'Questions' },
    { id: 'client-next-step', label: 'Next step' }
  ];
  var CLIENT_SECTION_ACTIVATION_RATIO = 0.32;
  var CARD_SELECTOR = [
    '.cl-record-grid article',
    '.cl-case-grid article',
    '.cl-fit-grid article',
    '.cl-process-grid article',
    '.cl-calc-controls',
    '.cl-calc-result',
    '.cl-privacy-demo',
    '.cl-range-float',
    '.cl-value-factors'
  ].join(', ');

  // Viewport-relative tops in canonical order; null means a missing target.
  function getActiveClientSectionIndex(sectionTops, viewportHeight, atPageBottom) {
    if (atPageBottom === undefined) atPageBottom = false;
    if (sectionTops.length === 0) return 0;
    if (atPageBottom) return sectionTops.length - 1;

    var activationLine = Math.max(0, viewportHeight) * CLIENT_SECTION_ACTIVATION_RATIO;
    var activeIndex = 0;
    sectionTops.forEach(function (top, index) {
      if (top !== null && Number.isFinite(top) && top <= activationLine) {
        activeIndex = index;
      }
    });
    return activeIndex;
  }

  function isClientPageBottom(scrollY, viewportHeight, scrollHeight) {
    return scrollHeight > viewportHeight &&
      scrollY + viewportHeight >= scrollHeight - 2;
  }

  function formatClientSectionNumber(index) {
    return String(index + 1).padStart(2, '0');
  }

  // Optional Node-only exports for source-model checks; no browser globals.
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      CLIENT_SECTIONS: CLIENT_SECTIONS,
      CLIENT_SECTION_ACTIVATION_RATIO: CLIENT_SECTION_ACTIVATION_RATIO,
      CARD_SELECTOR: CARD_SELECTOR,
      getActiveClientSectionIndex: getActiveClientSectionIndex,
      isClientPageBottom: isClientPageBottom,
      formatClientSectionNumber: formatClientSectionNumber
    };
  }
  if (typeof document === 'undefined' || typeof window === 'undefined') return;

  function initialize() {
    var root = document.getElementById('dreams-client-embed');
    var page = root && root.querySelector('.client-page');
    if (!page) return false;
    if (page.getAttribute('data-client-interaction-ready') === 'true') return true;

    var navigator = page.querySelector('.cl-section-navigator');
    if (!navigator) return false;
    var arrows = navigator.querySelectorAll('.cl-section-navigator__arrow');
    var dotLinks = navigator.querySelectorAll('.cl-section-navigator__dot-link');
    var picker = navigator.querySelector('.cl-section-navigator__picker');
    var toggle = navigator.querySelector('.cl-section-navigator__toggle');
    var number = navigator.querySelector('.cl-section-navigator__number');
    var sectionLinks = navigator.querySelectorAll('.cl-section-navigator__section-link');
    // GHL may insert a fragment in stages. Do not mark partially rendered UI ready.
    if (arrows.length !== 2 || !picker || !toggle || !number ||
        dotLinks.length !== CLIENT_SECTIONS.length ||
        sectionLinks.length !== CLIENT_SECTIONS.length) return false;
    page.setAttribute('data-client-interaction-ready', 'true');

    var activeIndex = 0;
    var pendingFrame = null;

    function getTarget(section) {
      var target = section && document.getElementById(section.id);
      // Keep the exported behavior inside its embed, including its top wrapper.
      return target && root.contains(target) ? target : null;
    }

    function updateArrow(arrow, section, direction, boundaryLabel) {
      if (section) {
        arrow.setAttribute('href', '#' + section.id);
        arrow.setAttribute('aria-label', direction + ' section: ' + section.label);
        arrow.removeAttribute('aria-disabled');
        arrow.removeAttribute('tabindex');
      } else {
        arrow.removeAttribute('href');
        arrow.setAttribute('aria-label', direction + ' section (you are at the ' + boundaryLabel + ' section)');
        arrow.setAttribute('aria-disabled', 'true');
        arrow.setAttribute('tabindex', '-1');
      }
    }

    function renderActiveSection(index) {
      activeIndex = index;
      var currentNumber = formatClientSectionNumber(index);
      number.textContent = currentNumber;
      toggle.setAttribute('aria-label', 'Section ' + currentNumber + ' of ' +
        CLIENT_SECTIONS.length + ': ' + CLIENT_SECTIONS[index].label + '. Browse sections');
      dotLinks.forEach(function (link, linkIndex) {
        if (linkIndex === index) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
      sectionLinks.forEach(function (link, linkIndex) {
        if (linkIndex === index) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
      updateArrow(arrows[0], CLIENT_SECTIONS[index - 1], 'Previous', 'first');
      updateArrow(arrows[1], CLIENT_SECTIONS[index + 1], 'Next', 'last');
    }

    function updateActiveSection() {
      pendingFrame = null;
      var viewportHeight = window.innerHeight;
      var scrollHeight = Math.max(
        document.documentElement.scrollHeight,
        document.body ? document.body.scrollHeight : 0
      );
      var sectionTops = CLIENT_SECTIONS.map(function (section) {
        var target = getTarget(section);
        return target ? target.getBoundingClientRect().top : null;
      });
      var nextIndex = getActiveClientSectionIndex(
        sectionTops,
        viewportHeight,
        isClientPageBottom(window.scrollY, viewportHeight, scrollHeight)
      );
      if (activeIndex !== nextIndex) renderActiveSection(nextIndex);
    }

    function scheduleUpdate() {
      if (pendingFrame === null) {
        pendingFrame = window.requestAnimationFrame(updateActiveSection);
      }
    }

    function closeOutside(event) {
      if (picker.open && event.target instanceof Node &&
          !navigator.contains(event.target)) {
        picker.open = false;
      }
    }

    function closeOnEscape(event) {
      if (event.key === 'Escape' && picker.open) {
        event.preventDefault();
        picker.open = false;
        toggle.focus({ preventScroll: true });
      }
    }

    function navigateToSection(event, index, fromPanel) {
      if (picker.open) {
        picker.open = false;
        // As in the source, never strand keyboard focus in a closed panel.
        if (fromPanel) toggle.focus({ preventScroll: true });
      }
      // Modified clicks and missing targets retain their native anchor path.
      if (event.defaultPrevented || event.button !== 0 || event.metaKey ||
          event.ctrlKey || event.shiftKey || event.altKey) return;

      var section = CLIENT_SECTIONS[index];
      var target = getTarget(section);
      if (!target) return;
      event.preventDefault();
      var hash = '#' + section.id;
      if (window.location.hash !== hash) {
        window.history.pushState(window.history.state, '', hash);
      }
      var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      target.scrollIntoView({
        behavior: reducedMotion ? 'instant' : 'smooth',
        block: 'start'
      });
      // Only measured positions update the active links, number, and arrows.
    }

    arrows[0].addEventListener('click', function (event) {
      if (CLIENT_SECTIONS[activeIndex - 1]) navigateToSection(event, activeIndex - 1, false);
    });
    arrows[1].addEventListener('click', function (event) {
      if (CLIENT_SECTIONS[activeIndex + 1]) navigateToSection(event, activeIndex + 1, false);
    });
    dotLinks.forEach(function (link, index) {
      link.addEventListener('click', function (event) {
        navigateToSection(event, index, false);
      });
    });
    sectionLinks.forEach(function (link, index) {
      link.addEventListener('click', function (event) {
        navigateToSection(event, index, true);
      });
    });
    // Native details/summary owns disclosure; scoped CSS owns responsive dots.
    document.addEventListener('pointerdown', closeOutside, { passive: true });
    document.addEventListener('focusin', closeOutside);
    document.addEventListener('keydown', closeOnEscape);
    window.addEventListener('scroll', scheduleUpdate, { passive: true });
    window.addEventListener('resize', scheduleUpdate, { passive: true });
    window.addEventListener('hashchange', scheduleUpdate);
    document.addEventListener('load', scheduleUpdate, true);

    renderActiveSection(0);
    var initialSection = CLIENT_SECTIONS.find(function (section) {
      return '#' + section.id === window.location.hash;
    });
    var initialTarget = getTarget(initialSection);
    if (initialTarget) initialTarget.scrollIntoView({ behavior: 'instant', block: 'start' });
    scheduleUpdate();

    // Exact delegated glow contract; reduced-motion treatment is CSS-owned.
    var glowFrame = 0;
    var currentCard = null;
    var pointerX = 0;
    var pointerY = 0;

    function clearGlow() {
      window.cancelAnimationFrame(glowFrame);
      glowFrame = 0;
      if (currentCard) currentCard.removeAttribute('data-glow-active');
      currentCard = null;
    }

    function updateGlow() {
      glowFrame = 0;
      if (!currentCard) return;
      var bounds = currentCard.getBoundingClientRect();
      currentCard.style.setProperty('--cl-pointer-x', (pointerX - bounds.left) + 'px');
      currentCard.style.setProperty('--cl-pointer-y', (pointerY - bounds.top) + 'px');
    }

    function moveGlow(event) {
      if (event.pointerType === 'touch') return;
      var target = event.target instanceof Element ? event.target : null;
      var card = target ? target.closest(CARD_SELECTOR) : null;
      if (!card || !page.contains(card)) {
        clearGlow();
        return;
      }
      if (card !== currentCard) {
        if (currentCard) currentCard.removeAttribute('data-glow-active');
        currentCard = card;
        currentCard.setAttribute('data-glow-active', 'true');
      }
      pointerX = event.clientX;
      pointerY = event.clientY;
      if (!glowFrame) glowFrame = window.requestAnimationFrame(updateGlow);
    }

    page.addEventListener('pointermove', moveGlow, { passive: true });
    page.addEventListener('pointerleave', clearGlow);
    page.addEventListener('pointercancel', clearGlow);
    return true;
  }

  function ready() {
    if (initialize()) return;
    var timeout;
    var observer = new MutationObserver(function () {
      if (initialize()) {
        observer.disconnect();
        window.clearTimeout(timeout);
      }
    });
    observer.observe(document.body || document.documentElement, { childList: true, subtree: true });
    timeout = window.setTimeout(function () { observer.disconnect(); }, 30000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ready, { once: true });
  } else {
    ready();
  }
}());
