// ============================================================
// Hamburger menu (mobile)
// ============================================================
const navToggle = document.getElementById('navToggle');
const navLinks  = document.getElementById('navLinks');

if (navToggle && navLinks) {
  navToggle.addEventListener('click', () => {
    const isOpen = navLinks.classList.toggle('open');
    navToggle.classList.toggle('open', isOpen);
    navToggle.setAttribute('aria-expanded', isOpen);
  });

  navLinks.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      navLinks.classList.remove('open');
      navToggle.classList.remove('open');
      navToggle.setAttribute('aria-expanded', 'false');
    });
  });

  document.addEventListener('click', e => {
    if (!navToggle.contains(e.target) && !navLinks.contains(e.target)) {
      navLinks.classList.remove('open');
      navToggle.classList.remove('open');
      navToggle.setAttribute('aria-expanded', 'false');
    }
  });
}

// ============================================================
// Scroll reveal
// ============================================================
const reveals = document.querySelectorAll('.reveal');

function activateReveal(el) {
  el.classList.add('visible');
  observer.unobserve(el);
}

const observer = new IntersectionObserver(
  entries => entries.forEach(entry => {
    if (entry.isIntersecting) activateReveal(entry.target);
  }),
  { threshold: 0.05, rootMargin: '0px 0px -20px 0px' }
);

reveals.forEach(el => observer.observe(el));

// Affiche immédiatement les éléments déjà dans le viewport (ancres, scroll rapide)
function checkVisibleReveals() {
  reveals.forEach(el => {
    if (!el.classList.contains('visible')) {
      const r = el.getBoundingClientRect();
      if (r.top < window.innerHeight && r.bottom > 0) activateReveal(el);
    }
  });
}
checkVisibleReveals();

// Re-vérifie après navigation par ancre
window.addEventListener('hashchange', () => setTimeout(checkVisibleReveals, 60));

// Filet de sécurité : force tout ce qui reste invisible après 900 ms
setTimeout(checkVisibleReveals, 900);

// ============================================================
// Bouton "Remonter en haut"
// ============================================================
const scrollTopBtn = document.getElementById('scroll-top');

if (scrollTopBtn) {
  window.addEventListener('scroll', () => {
    scrollTopBtn.classList.toggle('show', window.scrollY > 300);
  }, { passive: true });

  scrollTopBtn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

// ============================================================
// Année dynamique dans le footer
// ============================================================
const yearSpan = document.getElementById('year');
if (yearSpan) {
  yearSpan.textContent = new Date().getFullYear();
}

// ============================================================
// EmailJS — Configuration
// (initialisé après defer, donc disponible au moment de l'exécution)
// ============================================================
const EMAILJS_PUBLIC_KEY  = 'ssVHWkvMHgphte_il';
const EMAILJS_SERVICE_ID  = 'service_ij7am2p';
const EMAILJS_TEMPLATE_ID = 'template_68ghn95';

// Initialisation sécurisée (emailjs peut être indisponible si bloqué par un adblocker)
try {
  if (typeof emailjs !== 'undefined') {
    emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });
  }
} catch (e) {
  console.warn('EmailJS non disponible:', e);
}

// ============================================================
// Formulaire de contact principal
// (listener attaché ici pour respecter la CSP sans 'unsafe-inline')
// ============================================================
document.querySelector('.contact-form')?.addEventListener('submit', handleFormSubmit);

function handleFormSubmit(event) {
  event.preventDefault();
  const form     = event.target;
  const feedback = document.getElementById('form-feedback');
  const btn      = form.querySelector('button[type="submit"]');

  btn.disabled    = true;
  btn.textContent = 'Envoi en cours…';
  if (feedback) { feedback.textContent = ''; feedback.style.color = ''; }

  // Utilise form.elements pour éviter le conflit avec l'attribut .name de l'élément form
  const params = {
    from_name:  (form.elements['name']    || {value: ''}).value.trim(),
    from_email: (form.elements['email']   || {value: ''}).value.trim(),
    message:    (form.elements['message'] || {value: ''}).value.trim(),
    reply_to:   (form.elements['email']   || {value: ''}).value.trim(),
  };

  if (typeof emailjs === 'undefined') {
    if (feedback) {
      feedback.textContent = '✗ Service d\'email indisponible. Contactez-moi directement : mathis.beau.job@outlook.fr';
      feedback.style.color = '#ff6b6b';
    }
    btn.disabled    = false;
    btn.textContent = 'Envoyer';
    return;
  }

  emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, params)
    .then(() => {
      feedback.textContent = '✓ Message envoyé ! Je te réponds rapidement.';
      feedback.style.color = 'var(--accent)';
      form.reset();
    })
    .catch(err => {
      console.error('EmailJS error:', err);
      feedback.textContent = '✗ Erreur lors de l\'envoi. Contactez-moi directement par email.';
      feedback.style.color = '#ff6b6b';
    })
    .finally(() => {
      btn.disabled    = false;
      btn.textContent = 'Envoyer';
    });
}

// ============================================================
// Experience Slider — vertical avec peek
// ============================================================
function setupExperienceSlider() {
  const sliderEl = document.querySelector('.exp-slider');
  if (!sliderEl) return;

  const viewport = sliderEl.querySelector('.exp-viewport');
  const track    = sliderEl.querySelector('.exp-track');
  const cards    = Array.from(sliderEl.querySelectorAll('.exp-card'));
  const dots     = Array.from(sliderEl.querySelectorAll('.exp-dot'));
  const counter  = sliderEl.querySelector('.exp-counter');
  const prevBtn  = sliderEl.querySelector('.exp-btn--prev');
  const nextBtn  = sliderEl.querySelector('.exp-btn--next');

  if (!track || !cards.length) return;

  const total = cards.length;
  const PEEK  = 72;
  const GAP   = 22;
  let current = 0;
  let isAnimating = false;

  function updateTrack() {
    const gap = parseFloat(getComputedStyle(track).rowGap) || GAP;
    let activeTop = 0;
    for (let i = 0; i < current; i++) {
      activeTop += cards[i].offsetHeight + gap;
    }
    const hasPrev = current > 0;
    const hasNext = current < total - 1;
    const topPeek = hasPrev ? PEEK + gap : 0;
    const botPeek = hasNext ? gap + PEEK : 0;
    const activeH = cards[current].offsetHeight;
    if (viewport) viewport.style.height = (topPeek + activeH + botPeek) + 'px';
    const translateY = -(activeTop - topPeek);
    track.style.transform = `translateY(${translateY}px)`;
  }

  function applyStates() {
    cards.forEach((card, i) => {
      card.className = 'exp-card ' + (
        i < current ? 'state-prev' : i > current ? 'state-next' : 'state-active'
      );
    });
    dots.forEach((dot, i) => {
      dot.classList.toggle('active', i === current);
      dot.setAttribute('aria-selected', String(i === current));
    });
    if (counter) {
      counter.textContent =
        String(current + 1).padStart(2, '0') + ' / ' + String(total).padStart(2, '0');
    }
    if (prevBtn) prevBtn.disabled = current === 0;
    if (nextBtn) nextBtn.disabled = current === total - 1;
  }

  function goTo(index) {
    if (isAnimating || index < 0 || index >= total || index === current) return;
    isAnimating = true;
    current = index;
    applyStates();
    updateTrack();
    setTimeout(() => { isAnimating = false; }, 580);
  }

  track.style.transition = 'none';
  if (viewport) viewport.style.transition = 'none';
  applyStates();
  requestAnimationFrame(() => {
    updateTrack();
    requestAnimationFrame(() => {
      track.style.transition = '';
      if (viewport) viewport.style.transition = '';
    });
  });

  prevBtn?.addEventListener('click', () => goTo(current - 1));
  nextBtn?.addEventListener('click', () => goTo(current + 1));
  dots.forEach((dot, i) => dot.addEventListener('click', () => goTo(i)));

  sliderEl.addEventListener('keydown', e => {
    if (e.key === 'ArrowUp')   { e.preventDefault(); goTo(current - 1); }
    if (e.key === 'ArrowDown') { e.preventDefault(); goTo(current + 1); }
  });

  let wheelTimer = null;
  viewport?.addEventListener('wheel', e => {
    e.preventDefault();
    if (wheelTimer) return;
    if (e.deltaY > 25)       goTo(current + 1);
    else if (e.deltaY < -25) goTo(current - 1);
    wheelTimer = setTimeout(() => { wheelTimer = null; }, 650);
  }, { passive: false });

  let touchStartY = 0;
  viewport?.addEventListener('touchstart', e => { touchStartY = e.touches[0].clientY; }, { passive: true });
  viewport?.addEventListener('touchend', e => {
    const delta = touchStartY - e.changedTouches[0].clientY;
    if (Math.abs(delta) > 45) goTo(delta > 0 ? current + 1 : current - 1);
  }, { passive: true });

  window.addEventListener('resize', updateTrack, { passive: true });
}

// ============================================================
// Carousel horizontal générique (Skills + Projects)
// ============================================================
function setupTrackCarousel({ sliderSel, trackSel, cardSel, dotSel, prevSel, nextSel, baseClass }) {
  const sliderEl = document.querySelector(sliderSel);
  if (!sliderEl) return;

  const viewport = sliderEl.querySelector('[class*="viewport"]');
  const track    = sliderEl.querySelector(trackSel);
  const cards    = Array.from(sliderEl.querySelectorAll(cardSel));
  const dots     = Array.from(sliderEl.querySelectorAll(dotSel));
  const prevBtn  = sliderEl.querySelector(prevSel);
  const nextBtn  = sliderEl.querySelector(nextSel);

  if (!track || !cards.length) return;

  const total = cards.length;
  let current = 0;
  let isAnimating = false;

  function updateTrack() {
    const cardW = cards[0].offsetWidth;
    const gap   = parseFloat(getComputedStyle(track).columnGap) || 22;
    const vpW   = viewport ? viewport.offsetWidth : sliderEl.offsetWidth;
    const offset = (vpW / 2) - (cardW / 2) - current * (cardW + gap);
    track.style.transform = `translateX(${offset}px)`;
  }

  function applyStates() {
    cards.forEach((card, i) => {
      const extra = Array.from(card.classList)
        .filter(c => c !== baseClass && !c.startsWith('state-') && c !== baseClass + '--soft' && c !== baseClass + '--cert')
        .join(' ');
      const modSoft = card.classList.contains(baseClass + '--soft') ? ' ' + baseClass + '--soft' : '';
      const modCert = card.classList.contains(baseClass + '--cert') ? ' ' + baseClass + '--cert' : '';
      card.className = baseClass + modSoft + modCert + (extra ? ' ' + extra : '') + ' ' + (
        i < current ? 'state-prev' : i > current ? 'state-next' : 'state-active'
      );
    });
    dots.forEach((dot, i) => {
      dot.classList.toggle('active', i === current);
      dot.setAttribute('aria-selected', String(i === current));
    });
    if (prevBtn) prevBtn.disabled = current === 0;
    if (nextBtn) nextBtn.disabled = current === total - 1;
  }

  function goTo(index) {
    if (isAnimating || index < 0 || index >= total || index === current) return;
    isAnimating = true;
    current = index;
    applyStates();
    updateTrack();
    setTimeout(() => { isAnimating = false; }, 560);
  }

  track.style.transition = 'none';
  applyStates();
  requestAnimationFrame(() => {
    updateTrack();
    requestAnimationFrame(() => { track.style.transition = ''; });
  });

  prevBtn?.addEventListener('click', () => goTo(current - 1));
  nextBtn?.addEventListener('click', () => goTo(current + 1));
  dots.forEach((dot, i) => dot.addEventListener('click', () => goTo(i)));

  sliderEl.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft')  { e.preventDefault(); goTo(current - 1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); goTo(current + 1); }
  });

  let wheelTimer = null;
  viewport?.addEventListener('wheel', e => {
    e.preventDefault();
    if (wheelTimer) return;
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (delta > 25)       goTo(current + 1);
    else if (delta < -25) goTo(current - 1);
    wheelTimer = setTimeout(() => { wheelTimer = null; }, 620);
  }, { passive: false });

  let touchStartX = 0;
  viewport?.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; }, { passive: true });
  viewport?.addEventListener('touchend', e => {
    const delta = touchStartX - e.changedTouches[0].clientX;
    if (Math.abs(delta) > 45) goTo(delta > 0 ? current + 1 : current - 1);
  }, { passive: true });

  window.addEventListener('resize', updateTrack, { passive: true });
}

// ============================================================
// Initialisation des sliders
// ============================================================
setupExperienceSlider();

setupTrackCarousel({
  sliderSel: '.skills-slider',
  trackSel:  '.skills-track',
  cardSel:   '.skill-card',
  dotSel:    '.skills-dot',
  prevSel:   '.skills-btn--prev',
  nextSel:   '.skills-btn--next',
  baseClass: 'skill-card',
});

setupTrackCarousel({
  sliderSel: '.proj-slider',
  trackSel:  '.proj-track',
  cardSel:   '.proj-card',
  dotSel:    '.proj-dot',
  prevSel:   '.proj-btn--prev',
  nextSel:   '.proj-btn--next',
  baseClass: 'proj-card',
});

// ============================================================
// Formation — Navigation horizontale carte par carte
// ============================================================
function setupEduNav() {
  const wrap = document.querySelector('.edu-timeline-wrap');
  const prev = document.querySelector('.edu-btn--prev');
  const next = document.querySelector('.edu-btn--next');
  const pips = Array.from(document.querySelectorAll('.edu-pip'));
  if (!wrap || !prev || !next || !pips.length) return;

  const steps = Array.from(document.querySelectorAll('.edu-step'));
  if (!steps.length) return;

  let current = 0;

  function stepWidth() { return steps[0].offsetWidth; }

  function goTo(index) {
    if (index < 0 || index >= steps.length) return;
    current = index;
    wrap.scrollTo({ left: index * stepWidth(), behavior: 'smooth' });
    updateUI();
  }

  function updateUI() {
    const maxScroll = wrap.scrollWidth - wrap.clientWidth;
    if (maxScroll < 2) {
      prev.disabled = true;
      next.disabled = true;
    } else {
      prev.disabled = current <= 0;
      next.disabled = current >= steps.length - 1;
    }
    pips.forEach((pip, i) => pip.classList.toggle('active', i === current));
  }

  let scrollTimer = null;
  wrap.addEventListener('scroll', () => {
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => {
      const sw = stepWidth();
      if (sw > 0) {
        current = Math.max(0, Math.min(Math.round(wrap.scrollLeft / sw), steps.length - 1));
        updateUI();
      }
    }, 80);
  }, { passive: true });

  prev.addEventListener('click', () => goTo(current - 1));
  next.addEventListener('click', () => goTo(current + 1));
  pips.forEach((pip, i) => pip.addEventListener('click', () => goTo(i)));
  window.addEventListener('resize', () => setTimeout(updateUI, 60), { passive: true });

  updateUI();
}
setupEduNav();

// ============================================================
// Chat Hub — Menu + Panels
// ============================================================
(function setupChatHub() {
  const toggleBtn = document.getElementById('chat-hub-toggle');
  const menu      = document.getElementById('chat-hub-menu');
  if (!toggleBtn || !menu) return;

  let _autoOpenDone = false;

  function markAutoSeen() { _autoOpenDone = true; }

  function openMenu() {
    closeAllPanels();
    menu.classList.add('open');
    menu.setAttribute('aria-hidden', 'false');
    toggleBtn.setAttribute('aria-expanded', 'true');
  }

  function closeMenu() {
    menu.classList.remove('open');
    menu.setAttribute('aria-hidden', 'true');
    toggleBtn.setAttribute('aria-expanded', 'false');
  }

  function closeAllPanels() {
    document.querySelectorAll('.chat-hub-panel.open').forEach(p => {
      p.classList.remove('open');
      p.setAttribute('aria-hidden', 'true');
    });
  }

  function closeAll() {
    closeMenu();
    closeAllPanels();
  }

  function openPanel(id) {
    closeMenu();
    const panel = document.getElementById('panel-' + id);
    if (!panel) return;
    panel.classList.add('open');
    panel.setAttribute('aria-hidden', 'false');
    const input = panel.querySelector('.chatbot-input');
    if (input) setTimeout(() => input.focus(), 50);
  }

  toggleBtn.addEventListener('click', e => {
    e.stopPropagation();
    const anyPanelOpen = !!document.querySelector('.chat-hub-panel.open');
    if (anyPanelOpen || menu.classList.contains('open')) closeAll();
    else openMenu();
  });

  document.addEventListener('click', e => {
    if (toggleBtn.contains(e.target)) return;
    if (menu.contains(e.target)) return;
    if (document.querySelector('.chat-hub-panel.open')?.contains(e.target)) return;
    closeAll();
  });

  // Fermeture sur Escape
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeAll();
  });

  document.getElementById('chat-hub-close')?.addEventListener('click', closeMenu);

  document.querySelectorAll('.chat-hub-option').forEach(btn => {
    btn.addEventListener('click', () => openPanel(btn.dataset.panel));
  });

  document.querySelectorAll('.panel-back').forEach(btn => {
    btn.addEventListener('click', () => { closeAllPanels(); openMenu(); });
  });
  document.querySelectorAll('.panel-close').forEach(btn => {
    btn.addEventListener('click', closeAll);
  });

  // ── Formulaire rappel ────────────────────────────────────────
  const callbackForm     = document.getElementById('callback-form');
  const callbackFeedback = document.getElementById('callback-feedback');
  const callbackSubmit   = document.getElementById('callback-submit');

  if (callbackForm) {
    callbackForm.addEventListener('submit', async e => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(callbackForm));
      callbackSubmit.disabled = true;
      callbackSubmit.textContent = 'Envoi en cours…';
      callbackFeedback.textContent = '';

      try {
        if (typeof emailjs === 'undefined') throw new Error('EmailJS indisponible');
        await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
          from_name:  `${data.prenom} ${data.nom}${data.entreprise ? ' (' + data.entreprise + ')' : ''}`,
          from_email: data.email,
          message:    `📞 Demande de rappel\n\nPrénom : ${data.prenom}\nNom : ${data.nom}\nEntreprise : ${data.entreprise || 'Non renseignée'}\nTéléphone : ${data.telephone}\nEmail : ${data.email}`,
          reply_to:   data.email,
        });
        callbackFeedback.style.color = '#4ade80';
        callbackFeedback.textContent = '✓ Demande envoyée ! Je vous rappelle sous 24h.';
        callbackForm.reset();
      } catch {
        callbackFeedback.style.color = '#f87171';
        callbackFeedback.textContent = '✗ Erreur lors de l\'envoi. Contactez-moi par email.';
      } finally {
        callbackSubmit.disabled = false;
        callbackSubmit.textContent = 'Envoyer ma demande';
      }
    });
  }

  // ── Factory des panels chatbot ───────────────────────────────
  function setupChatPanel(panelId, topic) {
    const messagesEl = document.getElementById(panelId + '-messages');
    const input      = document.getElementById(panelId + '-input');
    const sendBtn    = document.getElementById(panelId + '-send');
    if (!messagesEl || !input || !sendBtn) return;

    const history = [];
    let isLoading = false;

    function appendMessage(role, text) {
      const div = document.createElement('div');
      div.className = 'chatbot-msg ' + role;
      const p = document.createElement('p');
      p.textContent = text;
      div.appendChild(p);
      messagesEl.appendChild(div);
      messagesEl.scrollTop = messagesEl.scrollHeight;
      return div;
    }

    function showTyping() {
      const div = document.createElement('div');
      div.className = 'chatbot-msg assistant typing';
      div.setAttribute('aria-label', 'L\'assistant réfléchit…');
      div.innerHTML = '<p></p>';
      messagesEl.appendChild(div);
      messagesEl.scrollTop = messagesEl.scrollHeight;
      return div;
    }

    async function sendMessage() {
      const text = input.value.trim();
      if (!text || isLoading) return;
      input.value = '';
      isLoading = true;
      sendBtn.disabled = true;
      appendMessage('user', text);
      history.push({ role: 'user', content: text });
      const typingEl = showTyping();

      try {
        const res = await fetch('/api/chat', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ messages: history, topic }),
        });
        const data = await res.json();
        typingEl.remove();

        if (res.status === 429) {
          appendMessage('assistant', data.error || 'Limite journalière atteinte. Revenez demain 🙂');
          history.pop();
          return;
        }
        const reply = data.reply || "Désolé, je n'ai pas pu répondre. Réessayez.";
        appendMessage('assistant', reply);
        history.push({ role: 'assistant', content: reply });
      } catch {
        typingEl.remove();
        appendMessage('assistant', 'Une erreur s\'est produite. Vérifiez votre connexion.');
      } finally {
        isLoading = false;
        sendBtn.disabled = false;
        input.focus();
      }
    }

    sendBtn.addEventListener('click', sendMessage);
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    });
  }

  // Lancer les 3 panels chatbot
  setupChatPanel('general',     'general');
  setupChatPanel('formation',   'formation');
  setupChatPanel('experiences', 'experiences');

  // Auto-ouverture menu après 10s — une fois par chargement, desktop uniquement
  if (window.innerWidth >= 640) {
    setTimeout(() => {
      if (_autoOpenDone) return;
      _autoOpenDone = true;
      if (document.querySelector('.chat-hub-panel.open') || menu.classList.contains('open')) return;
      openMenu();
    }, 10000);
  }
})();
