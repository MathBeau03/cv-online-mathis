// ── Consentement cookies (RGPD/CNIL) + Google Analytics (GA4) ──
// Charge GA4 uniquement après acceptation explicite. Aucun cookie
// analytics n'est posé tant que l'utilisateur n'a pas cliqué "Accepter".
(function () {
  'use strict';

  var GA_ID = 'G-775Z07NCG9';
  var STORAGE_KEY = 'cookie_consent';

  function loadGA() {
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
    document.head.appendChild(s);

    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', GA_ID, { anonymize_ip: true });
  }

  function injectStyles() {
    var style = document.createElement('style');
    style.textContent =
      '.cookie-banner{position:fixed;left:1rem;right:1rem;bottom:1rem;max-width:480px;' +
      'margin:0 auto;background:rgba(10,11,17,0.97);border:1px solid rgba(245,200,76,0.25);' +
      'border-radius:14px;padding:1.1rem 1.3rem;box-shadow:0 20px 50px rgba(0,0,0,0.5);' +
      'z-index:10000;font-family:system-ui,-apple-system,BlinkMacSystemFont,sans-serif;color:#f5f5f5;}' +
      '.cookie-banner p{font-size:0.85rem;line-height:1.5;margin:0 0 0.9rem;color:#d0d0d8;}' +
      '.cookie-banner .cookie-actions{display:flex;gap:0.6rem;justify-content:flex-end;}' +
      '.cookie-banner button{border-radius:999px;padding:0.45rem 1.1rem;font-size:0.85rem;' +
      'cursor:pointer;border:1px solid transparent;font-family:inherit;}' +
      '.cookie-banner .cookie-accept{background:linear-gradient(135deg,#f5c84c,#f3a93a);' +
      'color:#1b1306;font-weight:600;}' +
      '.cookie-banner .cookie-decline{background:transparent;border-color:rgba(255,255,255,0.18);' +
      'color:#d0d0d8;}' +
      '@media (max-width:520px){.cookie-banner{left:0.6rem;right:0.6rem;bottom:0.6rem;}}';
    document.head.appendChild(style);
  }

  function setChoice(value) {
    try { localStorage.setItem(STORAGE_KEY, value); } catch (e) { /* ignore */ }
  }

  function getChoice() {
    try { return localStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
  }

  function showBanner() {
    injectStyles();
    var div = document.createElement('div');
    div.className = 'cookie-banner';
    div.setAttribute('role', 'dialog');
    div.setAttribute('aria-label', 'Consentement cookies');
    div.innerHTML =
      '<p>Ce site utilise Google Analytics pour mesurer l’audience, uniquement avec votre accord. ' +
      'Aucune donnée personnelle n’est vendue ni partagée.</p>' +
      '<div class="cookie-actions">' +
      '<button type="button" class="cookie-decline">Refuser</button>' +
      '<button type="button" class="cookie-accept">Accepter</button>' +
      '</div>';
    document.body.appendChild(div);

    div.querySelector('.cookie-accept').addEventListener('click', function () {
      setChoice('accepted');
      div.remove();
      loadGA();
    });
    div.querySelector('.cookie-decline').addEventListener('click', function () {
      setChoice('declined');
      div.remove();
    });
  }

  var stored = getChoice();
  if (stored === 'accepted') {
    loadGA();
  } else if (stored !== 'declined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', showBanner);
    } else {
      showBanner();
    }
  }
})();
