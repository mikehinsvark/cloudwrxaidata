/* CloudWRX referral routing. The incoming link is authoritative; no visitor cookie overrides it. */
(function (factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else {
    function ready() {
      document.querySelectorAll('#dreams-agent-embed, #dreams-client-embed').forEach(function (root) {
        api.mount(root, window.location.search);
      });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready, {once:true});
    else ready();
    var observer = new MutationObserver(ready);
    observer.observe(document.documentElement, {childList:true, subtree:true});
    window.setTimeout(function () { observer.disconnect(); }, 15000);
  }
}(function () {
  'use strict';
  var DEFAULT_CODE = 'bbq4pucskp';
  function normalize(value) {
    var code = String(value == null ? '' : value).trim();
    return /^[A-Za-z0-9_-]{1,64}$/.test(code) ? code : null;
  }
  function readCode(search) {
    var query = new URLSearchParams(search);
    if (!query.has('ref')) return DEFAULT_CODE;
    return normalize(query.get('ref'));
  }
  function destination(kind, code) {
    if (!normalize(code)) return null;
    var urls = {
      partner: 'https://cloudwrx.ai/partners',
      provider: 'https://cloudwrx.ai/',
      client: 'https://cloudwrxaidata.com/',
      agent: 'https://cloudwrxai.com/'
    };
    if (kind === 'fit') return 'https://historypays.com/r/' + encodeURIComponent(code) + '?utm_source=cloudwrx.ai';
    if (!urls[kind]) return null;
    var url = new URL(urls[kind]);
    url.searchParams.set('ref', code);
    return url.toString();
  }
  function mount(root, search) {
    if (root.dataset.cloudwrxReady) return;
    root.dataset.cloudwrxReady = 'true';
    var code = readCode(search);
    root.querySelectorAll('[data-cloudwrx-kind]').forEach(function (link) {
      var url = destination(link.getAttribute('data-cloudwrx-kind'), code);
      if (url) link.setAttribute('href', url);
      else {
        link.removeAttribute('href');
        link.setAttribute('aria-disabled', 'true');
        link.addEventListener('click', function (event) { event.preventDefault(); });
      }
    });
    root.querySelectorAll('[data-cloudwrx-code]').forEach(function (label) {
      label.textContent = code || 'Invalid referral code';
    });
    if (!code) {
      var message = document.createElement('p');
      message.setAttribute('role', 'alert');
      message.style.cssText = 'padding:20px;margin:0;background:#fff4d6;color:#402900;font:600 16px/1.5 sans-serif';
      message.textContent = 'This referral link has an invalid code. Please ask the person who shared it for a corrected link before continuing.';
      root.prepend(message);
    }
  }
  return {normalize:normalize, readCode:readCode, destination:destination, mount:mount};
}));
