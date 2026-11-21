;(function (browser, factory) {
  "use strict";
  var api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (browser) {
    browser.DreamsClientCalculators = api;
  }
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";

  var DEFAULTS = {
    desk: 40,
    nonDesk: 15,
    years: 8,
    sources: 5,
    country: "USA",
    industry: "other"
  };
  var FIELDS = [
    { key: "desk", id: "cl-desk", min: 0, max: 100000, headcount: true },
    { key: "nonDesk", id: "cl-nondesk", min: 0, max: 100000, headcount: true },
    { key: "years", id: "cl-years", min: 0, max: 100, sliderMax: 20 },
    { key: "sources", id: "cl-sources", min: 5, max: 15, sliderMax: 15 }
  ];
  var HEADCOUNT_STEPS = [0];
  var HEADCOUNT_RANGES = [[20, 1], [100, 5], [500, 25], [1000, 50], [5000, 250]];
  var INITIALIZED_KEY = "dreamsClientCalculatorsInitialized";

  HEADCOUNT_RANGES.forEach(function (range) {
    for (var value = HEADCOUNT_STEPS[HEADCOUNT_STEPS.length - 1] + range[1];
      value <= range[0]; value += range[1]) {
      HEADCOUNT_STEPS.push(value);
    }
  });

  function clampInput(value, min, max) {
    var numeric = typeof value === "number" ? value : Number(value);
    return Number.isFinite(numeric)
      ? Math.min(max, Math.max(min, Math.trunc(numeric)))
      : min;
  }

  function round10k(value) {
    return Math.round(value / 10000) * 10000;
  }

  function nearestHeadcountStep(value) {
    var nearest = 0;
    for (var index = 1; index < HEADCOUNT_STEPS.length; index += 1) {
      if (Math.abs(HEADCOUNT_STEPS[index] - value) <
          Math.abs(HEADCOUNT_STEPS[nearest] - value)) {
        nearest = index;
      }
    }
    return nearest;
  }

  // Compact USD amounts, matching the original display precision.
  function formatAmount(amount) {
    return amount >= 1000000
      ? "$" + (amount / 1000000).toFixed(2).replace(/0$/, "").replace(/\.0$/, "") + "M"
      : "$" + Math.round(amount / 1000) + "K";
  }

  function calculateClientEstimate(raw) {
    raw = raw || {};
    var inputs = {
      desk: clampInput(raw.desk, 0, 100000),
      nonDesk: clampInput(raw.nonDesk, 0, 100000),
      years: clampInput(raw.years, 0, 100),
      sources: clampInput(raw.sources, 5, 15),
      industry: raw.industry === "legal" || raw.industry === "specialist"
        ? raw.industry : "other",
      country: raw.country === "Canada" ? "Canada" : "USA"
    };
    var countryMultiplier = inputs.country === "Canada" ? 0.75 : 1;
    var industryMultiplier = inputs.industry === "other" ? 1 : 1.3;
    var sourceBoost = 1 + 0.1 * (inputs.sources - 5);
    var total = inputs.desk * 2400 + inputs.nonDesk * 240 + 16500 + inputs.years * 12250;
    var subtotal = total + Math.min(145000, total * 1.5);
    var offer = subtotal * 1.025 * 0.6 * countryMultiplier * industryMultiplier * sourceBoost;
    var low = round10k(offer * 0.7 * 1.15 * 1.1);
    var high = round10k(offer * 1.05 * 1.35 * 1.25 * 2);
    var warning = inputs.desk < 20
      ? "The published source model flags desk teams below 20 for closer review."
      : inputs.years < 3
        ? "The published source model flags histories below 3 years for closer review."
        : null;

    return {
      low: low,
      high: high,
      refreshLow: round10k(low * 0.8),
      refreshHigh: round10k(high * 0.8),
      eligibility: "not-determined",
      warning: warning,
      inputs: inputs,
      total: total,
      subtotal: subtotal,
      offer: offer,
      countryMultiplier: countryMultiplier,
      industryMultiplier: industryMultiplier,
      sourceBoost: sourceBoost
    };
  }

  // Call after the existing calculator markup is rendered; no automatic page hooks.
  // The marker is data-dreams-client-calculators-initialized on the supplied root.
  function init(root) {
    if (!root && typeof document !== "undefined") {
      root = document.querySelector("#client-estimate");
    }
    if (!root || typeof root.querySelector !== "function") {
      return null;
    }
    var marker = root.dataset ? root : root.documentElement;
    if (!marker || !marker.dataset) {
      return null;
    }
    if (marker.dataset[INITIALIZED_KEY] === "true") {
      return root;
    }

    var fields = FIELDS.map(function (field) {
      return {
        config: field,
        number: root.querySelector("#" + field.id),
        slider: root.querySelector("#" + field.id + "-slider")
      };
    });
    var country = root.querySelector("#cl-country");
    var industry = root.querySelector("#cl-industry");
    var result = root.querySelector(".cl-calc-result");
    var amount = result && result.querySelector(".cl-calc-amount");
    var refresh = result && result.querySelector(".cl-calc-refresh strong");
    var live = result && result.querySelector("[aria-live]");
    var reset = root.querySelector(".cl-calc-reset");

    // An incomplete embed may be initialized again once its markup is present.
    if (!country || !industry || !amount || amount.children.length < 3 ||
        !refresh || !live || !reset || fields.some(function (field) {
          return !field.number || !field.slider;
        })) {
      return null;
    }

    function update() {
      var raw = { country: country.value, industry: industry.value };
      fields.forEach(function (field) {
        raw[field.config.key] = field.number.value;
      });
      var estimate = calculateClientEstimate(raw);
      fields.forEach(function (field) {
        var numeric = estimate.inputs[field.config.key];
        var sliderValue = field.config.headcount
          ? nearestHeadcountStep(numeric)
          : Math.min(numeric, field.config.sliderMax);
        field.slider.value = String(sliderValue);
        if (field.config.headcount) {
          field.slider.setAttribute("aria-valuetext",
            HEADCOUNT_STEPS[sliderValue].toLocaleString("en-US") + " people");
        }
      });

      // Keep the middle div and its small 'to' label intact.
      amount.children[0].textContent = formatAmount(estimate.low);
      amount.children[2].textContent = formatAmount(estimate.high);
      refresh.textContent = formatAmount(estimate.refreshLow) + " to " +
        formatAmount(estimate.refreshHigh);

      // Only the first live region owns the warning; never touch the disclaimer.
      var note = live.querySelector("p.cl-calc-note");
      if (estimate.warning) {
        if (!note) {
          note = live.ownerDocument.createElement("p");
          note.className = "cl-calc-note";
          live.appendChild(note);
        }
        note.textContent = estimate.warning;
      } else if (note) {
        note.parentNode.removeChild(note);
      }
      return estimate;
    }

    fields.forEach(function (field) {
      var config = field.config;
      field.number.min = String(config.min);
      field.number.max = String(config.max);
      field.number.step = "1";
      field.slider.min = String(config.headcount ? 0 : config.min);
      field.slider.max = String(config.headcount ? HEADCOUNT_STEPS.length - 1 : config.sliderMax);
      field.slider.step = "1";

      // Preserve in-progress typing, including a temporarily blank number field.
      field.number.addEventListener("input", update);
      field.number.addEventListener("blur", function () {
        field.number.value = String(clampInput(field.number.value, config.min, config.max));
        update();
      });
      function onSlider() {
        var sliderValue = clampInput(field.slider.value,
          config.headcount ? 0 : config.min,
          config.headcount ? HEADCOUNT_STEPS.length - 1 : config.sliderMax);
        field.number.value = String(config.headcount ? HEADCOUNT_STEPS[sliderValue] : sliderValue);
        update();
      }
      field.slider.addEventListener("input", onSlider);
      field.slider.addEventListener("change", onSlider);
    });
    country.addEventListener("change", update);
    industry.addEventListener("change", update);
    reset.addEventListener("click", function (event) {
      event.preventDefault();
      fields.forEach(function (field) {
        field.number.value = String(DEFAULTS[field.config.key]);
      });
      country.value = DEFAULTS.country;
      industry.value = DEFAULTS.industry;
      update();
    });

    marker.dataset[INITIALIZED_KEY] = "true";
    update();
    return root;
  }

  return { calculateClientEstimate: calculateClientEstimate, init: init };
});


/* Shared native interactions. No forms, tracking, cookies, or network requests. */
(function () {
  'use strict';
  if (typeof document === 'undefined') return;
  function start() {
    var root = document.getElementById('dreams-client-embed');
    if (!root) return false;
    if (root.dataset.dreamsPageReady === 'true') return true;
    root.dataset.dreamsPageReady = 'true';
    if (window.DreamsClientCalculators) window.DreamsClientCalculators.init(root);
    var menu = root.querySelector('.an-menu-button, .cl-menu');
    var nav = root.querySelector('.an-nav, .cl-nav');
    if (menu && nav) {
      var originalIcon = menu.innerHTML;
      var closeIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';
      function setMenu(open) {
        nav.classList.toggle('is-open', open);
        menu.setAttribute('aria-expanded', String(open));
        menu.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
        menu.innerHTML = open ? closeIcon : originalIcon;
      }
      menu.addEventListener('click', function () { setMenu(menu.getAttribute('aria-expanded') !== 'true'); });
      nav.querySelectorAll('a').forEach(function (a) { a.addEventListener('click', function () { setMenu(false); }); });
      root.addEventListener('keydown', function (event) { if (event.key === 'Escape') setMenu(false); });
    }
    root.querySelectorAll('dialog').forEach(function (dialog) {
      dialog.addEventListener('click', function (event) { if (event.target === dialog) dialog.close(); });
      var close = dialog.querySelector('.an-dialog-close, .cl-dialog-close');
      if (close) close.addEventListener('click', function () { dialog.close(); });
    });
    root.querySelectorAll('.an-logo-expand, .cl-logo-expand, .an-graphic-open, .cl-image-open').forEach(function (button) {
      button.addEventListener('click', function () {
        var dialog = button.parentElement.querySelector('dialog');
        if (!dialog) return;
        if (typeof dialog.showModal === 'function') dialog.showModal();
        else { var image = dialog.querySelector('img'); if (image) window.open(image.src, '_blank', 'noopener'); }
      });
    });
    root.querySelectorAll('video').forEach(function (video) {
      video.addEventListener('play', function () { root.querySelectorAll('video').forEach(function (other) { if (other !== video) other.pause(); }); });
    });
    var demo = root.querySelector('.cl-privacy-demo');
    if (demo) {
      var buttons = demo.querySelectorAll('.cl-demo-switch button');
      var mark = demo.querySelector('mark');
      var status = demo.querySelector('.cl-demo-status span');
      buttons.forEach(function (button, index) {
        button.addEventListener('click', function () {
          var original = index === 1;
          buttons.forEach(function (b, i) { b.setAttribute('aria-pressed', String(original ? i === 1 : i === 0)); });
          mark.textContent = original ? 'Dana Ruiz' : 'Customer 0412';
          mark.classList.toggle('is-original', original);
          status.textContent = original ? 'Fictional name shown for comparison.' : 'Name replaced. The workflow context remains.';
        });
      });
    }
    return true;
  }
  function ready() {
    if (start()) return;
    var observer = new MutationObserver(function () { if (start()) observer.disconnect(); });
    observer.observe(document.body, {childList:true, subtree:true});
    window.setTimeout(function () { observer.disconnect(); }, 30000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready, {once:true});
  else ready();
}());

