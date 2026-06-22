'use strict';

// ── STATE ─────────────────────────────────────────────────────
let currentFile = null;
let currentFilePreviewUrl = null;
let jobAnalysis = null;
let generatedResult = null;
let currentStep = 1;
let photoDataUrl = null;
let linkedinUrl = '';

// ── UTILS ─────────────────────────────────────────────────────
function escapeHtml(str) {
  if (!str && str !== 0) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function setLoading(btn, loading) {
  if (!btn) return;
  const textEl    = btn.querySelector('.btn-text');
  const spinnerEl = btn.querySelector('.btn-spinner');
  btn.disabled = loading;
  if (textEl)    textEl.classList.toggle('hidden', loading);
  if (spinnerEl) {
    spinnerEl.classList.toggle('hidden', !loading);
    if (loading && !spinnerEl.querySelector('.spinner')) {
      const spinnerIcon = document.createElement('span');
      spinnerIcon.className = 'spinner';
      spinnerEl.insertBefore(spinnerIcon, spinnerEl.firstChild);
    }
  }
}

let toastTimer = null;
function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.className = 'toast show ' + type;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
  }, 3500);
}

// ── NAVIGATION ───────────────────────────────────────────────
function goToStep(n) {
  // Update panels
  document.querySelectorAll('.step-panel').forEach(panel => {
    panel.classList.remove('active');
  });
  const target = document.getElementById('step-' + n);
  if (target) target.classList.add('active');

  // Update step indicator
  document.querySelectorAll('.step-item').forEach(item => {
    const step = parseInt(item.dataset.step, 10);
    item.classList.remove('active', 'done');
    if (step === n) item.classList.add('active');
    else if (step < n) item.classList.add('done');
  });

  currentStep = n;
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // When entering step 3, ensure form is populated
  if (n === 3) {
    loadProfileFromStorage();
  }
}

// ── FILE HANDLING ─────────────────────────────────────────────
function handleFile(file) {
  if (!file) return;

  const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    showToast('Type de fichier non supporté. Utilisez PDF, JPG, PNG ou WEBP.', 'error');
    return;
  }
  if (file.size > 15 * 1024 * 1024) {
    showToast('Fichier trop volumineux (max 15 Mo).', 'error');
    return;
  }

  // Revoke previous object URL
  if (currentFilePreviewUrl) {
    URL.revokeObjectURL(currentFilePreviewUrl);
    currentFilePreviewUrl = null;
  }

  currentFile = file;

  const previewEl   = document.getElementById('file-preview');
  const filenameEl  = document.getElementById('preview-filename');
  const contentEl   = document.getElementById('preview-content');

  previewEl.classList.remove('hidden');
  filenameEl.textContent = file.name;
  contentEl.innerHTML = '';

  if (file.type.startsWith('image/')) {
    currentFilePreviewUrl = URL.createObjectURL(file);
    const img = document.createElement('img');
    img.src = currentFilePreviewUrl;
    img.className = 'preview-image';
    img.alt = 'Aperçu de l\'offre';
    contentEl.appendChild(img);
  } else if (file.type === 'application/pdf') {
    const info = document.createElement('div');
    info.className = 'preview-text';
    info.textContent = '📄 Fichier PDF — le texte sera extrait lors de l\'analyse.';
    contentEl.appendChild(info);
  }

  // Hide upload zone visual hints
  document.getElementById('upload-zone').style.opacity = '0.5';
}

function removeFile() {
  if (currentFilePreviewUrl) {
    URL.revokeObjectURL(currentFilePreviewUrl);
    currentFilePreviewUrl = null;
  }
  currentFile = null;

  const previewEl = document.getElementById('file-preview');
  const contentEl = document.getElementById('preview-content');
  previewEl.classList.add('hidden');
  contentEl.innerHTML = '';

  document.getElementById('file-input').value = '';
  document.getElementById('upload-zone').style.opacity = '1';
}

// ── PHOTO UPLOAD ──────────────────────────────────────────────
function initPhotoUpload() {
  const input     = document.getElementById('photo-input');
  const preview   = document.getElementById('photo-preview');
  const removeBtn = document.getElementById('remove-photo');

  if (!input) return;

  input.addEventListener('change', () => {
    const file = input.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showToast('Photo trop volumineuse (max 5 Mo).', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      photoDataUrl = e.target.result;
      preview.innerHTML = `<img src="${photoDataUrl}" alt="Photo de profil" />`;
      if (removeBtn) removeBtn.style.display = 'inline-flex';
    };
    reader.readAsDataURL(file);
  });

  if (removeBtn) {
    removeBtn.addEventListener('click', () => {
      photoDataUrl = null;
      preview.innerHTML = '<span class="photo-placeholder">👤</span>';
      removeBtn.style.display = 'none';
      input.value = '';
    });
  }
}

// ── LINKEDIN PDF IMPORT ────────────────────────────────────────
async function importLinkedinPdf(file) {
  const statusEl = document.getElementById('linkedin-import-status');
  if (statusEl) {
    statusEl.style.display = 'flex';
    statusEl.className = 'linkedin-status loading';
    statusEl.innerHTML = '<span class="spinner" style="border-top-color:#c9a84c"></span> Analyse du profil en cours…';
  }

  const formData = new FormData();
  formData.append('linkedin_pdf', file);

  try {
    const res  = await fetch('/api/generator/parse-linkedin', { method: 'POST', body: formData });
    const data = await res.json();

    if (!res.ok) {
      if (statusEl) {
        statusEl.className = 'linkedin-status';
        statusEl.style.cssText = 'display:flex; border:1px solid var(--error); color:var(--error); padding:0.5rem 1rem; border-radius:8px; font-size:0.85rem; gap:0.5rem;';
        statusEl.innerHTML = '✕ ' + (data.error || 'Erreur lors de l\'import.');
      }
      showToast(data.error || 'Erreur import LinkedIn.', 'error');
      return;
    }

    fillFormWithProfile(data.profile);

    if (statusEl) {
      statusEl.className = 'linkedin-status success';
      statusEl.innerHTML = '✓ Profil importé avec succès !';
    }
    showToast('Profil LinkedIn importé !', 'success');
  } catch (err) {
    console.error(err);
    if (statusEl) {
      statusEl.className = 'linkedin-status';
      statusEl.style.cssText = 'display:flex; border:1px solid var(--error); color:var(--error); padding:0.5rem 1rem; border-radius:8px; font-size:0.85rem; gap:0.5rem;';
      statusEl.innerHTML = '✕ Erreur réseau';
    }
    showToast('Erreur réseau lors de l\'import.', 'error');
  }
}

function fillFormWithProfile(profile) {
  if (!profile) return;
  const form = document.getElementById('profile-form');
  if (!form) return;

  const namedFields = ['prenom','nom','email','telephone','localisation','resume_pro','competences_tech','soft_skills','langues','certifications'];
  namedFields.forEach(name => {
    const el = form.querySelector(`[name="${name}"]`) || document.getElementById(name);
    if (el && profile[name]) el.value = profile[name];
  });

  // Rebuild experiences
  if (profile.experiences && profile.experiences.length > 0) {
    const container = document.getElementById('experiences-container');
    if (container) { container.innerHTML = ''; expCounter = 0; }
    profile.experiences.forEach(exp => addExperience(exp));
  }

  // Rebuild education
  if (profile.education && profile.education.length > 0) {
    const container = document.getElementById('education-container');
    if (container) { container.innerHTML = ''; eduCounter = 0; }
    profile.education.forEach(edu => addEducation(edu));
  }
}

// ── UPLOAD ZONE ───────────────────────────────────────────────
function initUploadZone() {
  const zone      = document.getElementById('upload-zone');
  const fileInput = document.getElementById('file-input');
  const browseBtn = document.getElementById('browse-btn');

  // Click on zone or browse button
  zone.addEventListener('click', (e) => {
    if (e.target === browseBtn || browseBtn.contains(e.target)) return;
    fileInput.click();
  });

  browseBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    fileInput.click();
  });

  // Keyboard accessibility
  zone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInput.click();
    }
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) handleFile(fileInput.files[0]);
  });

  // Drag & drop
  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('drag-over');
  });

  zone.addEventListener('dragleave', (e) => {
    if (!zone.contains(e.relatedTarget)) {
      zone.classList.remove('drag-over');
    }
  });

  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const files = e.dataTransfer.files;
    if (files && files[0]) handleFile(files[0]);
  });

  // Prevent browser from opening dropped files outside the zone
  document.addEventListener('dragover', e => e.preventDefault());
  document.addEventListener('drop', e => e.preventDefault());
}

// ── CLIPBOARD PASTE ───────────────────────────────────────────
function initClipboardPaste() {
  window.addEventListener('paste', (e) => {
    if (!e.clipboardData) return;
    const items = Array.from(e.clipboardData.items);
    const imageItem = items.find(item => item.type.startsWith('image/'));
    if (imageItem) {
      const file = imageItem.getAsFile();
      if (file) {
        // Give it a name
        const ext = file.type.split('/')[1] || 'png';
        const named = new File([file], `paste-${Date.now()}.${ext}`, { type: file.type });
        handleFile(named);
        showToast('Image collée depuis le presse-papiers.', 'success');
      }
    }
  });
}

// ── MANUAL TEXT TOGGLE ────────────────────────────────────────
function initManualToggle() {
  const toggleBtn    = document.getElementById('toggle-manual');
  const manualSection = document.getElementById('manual-section');
  let expanded = false;

  toggleBtn.addEventListener('click', () => {
    expanded = !expanded;
    manualSection.classList.toggle('hidden', !expanded);
    toggleBtn.textContent = expanded
      ? 'Masquer la saisie manuelle'
      : 'Saisir le texte manuellement';
  });
}

// ── ANALYZE (Step 1 → 2) ─────────────────────────────────────
async function analyze() {
  const btn        = document.getElementById('analyze-btn');
  const manualText = document.getElementById('manual-text').value.trim();

  if (!currentFile && !manualText) {
    showToast('Veuillez fournir un fichier ou saisir le texte de l\'offre.', 'error');
    return;
  }

  setLoading(btn, true);

  try {
    const formData = new FormData();
    if (currentFile) {
      formData.append('file', currentFile);
    } else {
      formData.append('text', manualText);
    }

    const res  = await fetch('/api/generator/analyze', { method: 'POST', body: formData });
    const data = await res.json();

    if (!res.ok) {
      showToast(data.error || 'Erreur lors de l\'analyse.', 'error');
      return;
    }

    jobAnalysis = data.analysis;
    renderAnalysis(jobAnalysis);
    goToStep(2);
  } catch (err) {
    console.error(err);
    showToast('Erreur réseau lors de l\'analyse.', 'error');
  } finally {
    setLoading(btn, false);
  }
}

// ── RENDER ANALYSIS (Step 2) ──────────────────────────────────
function renderAnalysis(analysis) {
  const grid = document.getElementById('analysis-grid');
  if (!grid) return;

  const fields = [
    { key: 'poste',          label: 'Poste',           type: 'input' },
    { key: 'entreprise',     label: 'Entreprise',      type: 'input' },
    { key: 'localisation',   label: 'Localisation',    type: 'input' },
    { key: 'type_contrat',   label: 'Type de contrat', type: 'input' },
    { key: 'salaire',        label: 'Salaire',         type: 'input' },
    { key: 'profil_recherche', label: 'Profil recherché', type: 'textarea', full: true },
  ];

  let html = '';

  fields.forEach(f => {
    const val = escapeHtml(analysis[f.key] || '');
    const cls = f.full ? 'analysis-field full-width' : 'analysis-field';
    if (f.type === 'textarea') {
      html += `
        <div class="${cls}">
          <label>${escapeHtml(f.label)}</label>
          <textarea data-key="${f.key}" rows="3">${val}</textarea>
        </div>`;
    } else {
      html += `
        <div class="${cls}">
          <label>${escapeHtml(f.label)}</label>
          <input type="text" data-key="${f.key}" value="${val}" />
        </div>`;
    }
  });

  // Competences
  const competences = analysis.competences_requises || [];
  if (competences.length > 0) {
    const tags = competences.map(c => `<span class="stag">${escapeHtml(c)}</span>`).join('');
    html += `
      <div class="analysis-skills-section">
        <h4>Compétences requises</h4>
        <div class="stag-list">${tags}</div>
      </div>`;
  }

  // Missions
  const missions = analysis.missions || [];
  if (missions.length > 0) {
    const items = missions.map(m => `<li>${escapeHtml(m)}</li>`).join('');
    html += `
      <div class="analysis-skills-section">
        <h4>Missions</h4>
        <ul class="missions-list">${items}</ul>
      </div>`;
  }

  grid.innerHTML = html;
}

// ── COLLECT ANALYSIS ──────────────────────────────────────────
function collectAnalysis() {
  const grid = document.getElementById('analysis-grid');
  if (!grid || !jobAnalysis) return jobAnalysis;

  const updated = Object.assign({}, jobAnalysis);
  grid.querySelectorAll('[data-key]').forEach(el => {
    updated[el.dataset.key] = el.value;
  });
  return updated;
}

// ── EXPERIENCE ITEMS ──────────────────────────────────────────
let expCounter = 0;

function addExperience(data = {}) {
  expCounter++;
  const id  = 'exp-' + expCounter;
  const container = document.getElementById('experiences-container');
  if (!container) return;

  const div = document.createElement('div');
  div.className = 'exp-item';
  div.id = id;
  div.innerHTML = `
    <button class="btn-remove" type="button" data-remove="${id}">✕</button>
    <div class="item-grid-2">
      <div class="form-group">
        <label>Poste / Titre</label>
        <input type="text" name="exp_title" placeholder="Développeur Full Stack" value="${escapeHtml(data.title || '')}" />
      </div>
      <div class="form-group">
        <label>Entreprise</label>
        <input type="text" name="exp_company" placeholder="Société Générale" value="${escapeHtml(data.company || '')}" />
      </div>
      <div class="form-group">
        <label>Lieu</label>
        <input type="text" name="exp_location" placeholder="Paris, France" value="${escapeHtml(data.location || '')}" />
      </div>
      <div class="form-group">
        <label>Période</label>
        <input type="text" name="exp_dates" placeholder="Sept. 2024 – Présent" value="${escapeHtml(data.dates || '')}" />
      </div>
    </div>
    <div class="form-group">
      <label>Description &amp; missions</label>
      <textarea name="exp_desc" rows="3" placeholder="Décrivez vos principales missions et réalisations…">${escapeHtml(data.desc || '')}</textarea>
    </div>
  `;

  div.querySelector('[data-remove]').addEventListener('click', () => {
    div.remove();
  });

  container.appendChild(div);
}

// ── EDUCATION ITEMS ───────────────────────────────────────────
let eduCounter = 0;

function addEducation(data = {}) {
  eduCounter++;
  const id  = 'edu-' + eduCounter;
  const container = document.getElementById('education-container');
  if (!container) return;

  const div = document.createElement('div');
  div.className = 'edu-item';
  div.id = id;
  div.innerHTML = `
    <button class="btn-remove" type="button" data-remove="${id}">✕</button>
    <div class="item-grid-2">
      <div class="form-group">
        <label>Diplôme / Formation</label>
        <input type="text" name="edu_degree" placeholder="Master Management des SI" value="${escapeHtml(data.degree || '')}" />
      </div>
      <div class="form-group">
        <label>École / Université</label>
        <input type="text" name="edu_school" placeholder="Pôle Léonard de Vinci" value="${escapeHtml(data.school || '')}" />
      </div>
      <div class="form-group">
        <label>Année</label>
        <input type="text" name="edu_year" placeholder="2024-2026" value="${escapeHtml(data.year || '')}" />
      </div>
      <div class="form-group">
        <label>Spécialité / Détails</label>
        <input type="text" name="edu_specialty" placeholder="Data, IA, Gestion de projet…" value="${escapeHtml(data.details || '')}" />
      </div>
    </div>
  `;

  div.querySelector('[data-remove]').addEventListener('click', () => {
    div.remove();
  });

  container.appendChild(div);
}

// ── COLLECT PROFILE ───────────────────────────────────────────
function collectProfile() {
  const form = document.getElementById('profile-form');
  const profile = {};

  // Named inputs & textareas (flat fields)
  const namedFields = ['prenom','nom','email','telephone','localisation',
                       'resume_pro','competences_tech','soft_skills','langues','certifications'];
  namedFields.forEach(name => {
    const el = form.querySelector(`[name="${name}"]`);
    if (el) profile[name] = el.value.trim();
  });

  // LinkedIn comes from the dedicated section
  profile.linkedin = linkedinUrl || document.getElementById('linkedin-url')?.value || '';

  // Experiences
  profile.experiences = [];
  form.querySelectorAll('.exp-item').forEach(item => {
    profile.experiences.push({
      title:    (item.querySelector('[name="exp_title"]')?.value   || '').trim(),
      company:  (item.querySelector('[name="exp_company"]')?.value || '').trim(),
      location: (item.querySelector('[name="exp_location"]')?.value || '').trim(),
      dates:    (item.querySelector('[name="exp_dates"]')?.value   || '').trim(),
      desc:     (item.querySelector('[name="exp_desc"]')?.value    || '').trim(),
    });
  });

  // Education
  profile.education = [];
  form.querySelectorAll('.edu-item').forEach(item => {
    profile.education.push({
      degree:  (item.querySelector('[name="edu_degree"]')?.value   || '').trim(),
      school:  (item.querySelector('[name="edu_school"]')?.value   || '').trim(),
      year:    (item.querySelector('[name="edu_year"]')?.value     || '').trim(),
      details: (item.querySelector('[name="edu_specialty"]')?.value || '').trim(),
    });
  });

  return profile;
}

// ── SAVE PROFILE ──────────────────────────────────────────────
function saveProfile(profile) {
  try {
    localStorage.setItem('cv_generator_profile', JSON.stringify(profile));
  } catch (e) {
    console.warn('localStorage unavailable:', e);
  }
}

// ── LOAD PROFILE FROM STORAGE ─────────────────────────────────
function loadProfileFromStorage() {
  let stored;
  try {
    const raw = localStorage.getItem('cv_generator_profile');
    if (!raw) return;
    stored = JSON.parse(raw);
  } catch (e) {
    return;
  }

  const form = document.getElementById('profile-form');
  if (!form) return;

  // Fill flat fields
  const namedFields = ['prenom','nom','email','telephone','localisation',
                       'resume_pro','competences_tech','soft_skills','langues','certifications'];
  namedFields.forEach(name => {
    const el = form.querySelector(`[name="${name}"]`);
    if (el && stored[name]) el.value = stored[name];
  });

  // Restore LinkedIn URL
  if (stored.linkedin) {
    const linkedinEl = document.getElementById('linkedin-url');
    if (linkedinEl) linkedinEl.value = stored.linkedin;
    linkedinUrl = stored.linkedin;
  }

  // Rebuild experiences
  const expContainer = document.getElementById('experiences-container');
  if (expContainer && stored.experiences && stored.experiences.length > 0) {
    expContainer.innerHTML = '';
    expCounter = 0;
    stored.experiences.forEach(exp => addExperience(exp));
  }

  // Rebuild education
  const eduContainer = document.getElementById('education-container');
  if (eduContainer && stored.education && stored.education.length > 0) {
    eduContainer.innerHTML = '';
    eduCounter = 0;
    stored.education.forEach(edu => addEducation(edu));
  }
}

// ── GENERATE (Step 3 → 4) ────────────────────────────────────
async function generate() {
  const btn     = document.getElementById('generate-btn');
  const regenCV  = document.getElementById('regen-cv-btn');
  const regenL   = document.getElementById('regen-letter-btn');

  const profile  = collectProfile();
  saveProfile(profile);

  const analysis = collectAnalysis();
  jobAnalysis    = analysis;

  const activeBtns = [btn, regenCV, regenL].filter(Boolean);
  activeBtns.forEach(b => setLoading(b, true));

  try {
    const res  = await fetch('/api/generator/generate', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ jobAnalysis: analysis, profile }),
    });
    const data = await res.json();

    if (!res.ok) {
      showToast(data.error || 'Erreur lors de la génération.', 'error');
      return;
    }

    generatedResult = data;
    renderCV(data.cv, profile);
    renderLetter(data.letter, profile, analysis);
    goToStep(4);
  } catch (err) {
    console.error(err);
    showToast('Erreur réseau lors de la génération.', 'error');
  } finally {
    activeBtns.forEach(b => setLoading(b, false));
  }
}

// ── RENDER CV ─────────────────────────────────────────────────
function renderCV(cv, profile) {
  const container = document.getElementById('cv-preview');
  if (!container || !cv) return;

  const fullName = [profile.prenom, profile.nom].filter(Boolean).join(' ') || 'Votre Nom';

  // Contact info
  const contactItems = [];
  if (profile.email)        contactItems.push(`✉ ${escapeHtml(profile.email)}`);
  if (profile.telephone)    contactItems.push(`📞 ${escapeHtml(profile.telephone)}`);
  if (profile.localisation) contactItems.push(`📍 ${escapeHtml(profile.localisation)}`);
  if (profile.linkedin)     contactItems.push(`🔗 ${escapeHtml(profile.linkedin)}`);

  const contactHtml = contactItems.map(c => `<span>${c}</span>`).join('');

  // Summary
  const summaryHtml = cv.summary
    ? `<div class="cv-section"><h3>Profil</h3><p class="cv-summary">${escapeHtml(cv.summary)}</p></div>`
    : '';

  // Experiences
  let expHtml = '';
  if (cv.experiences && cv.experiences.length > 0) {
    const items = cv.experiences.map(exp => {
      const bullets = (exp.bullets || [])
        .map(b => `<li>${escapeHtml(b)}</li>`)
        .join('');
      return `
        <div class="cv-exp-item">
          <div class="cv-exp-header">
            <strong>${escapeHtml(exp.title || '')}</strong>
            <span class="cv-exp-dates">${escapeHtml(exp.dates || '')}</span>
          </div>
          <div class="cv-exp-meta">${escapeHtml(exp.company || '')}${exp.location ? ' · ' + escapeHtml(exp.location) : ''}</div>
          ${bullets ? `<ul class="cv-exp-bullets">${bullets}</ul>` : ''}
        </div>`;
    }).join('');
    expHtml = `<div class="cv-section"><h3>Expériences professionnelles</h3>${items}</div>`;
  }

  // Education
  let eduHtml = '';
  if (cv.education && cv.education.length > 0) {
    const items = cv.education.map(edu => `
      <div class="cv-edu-item">
        <div class="cv-edu-header">
          <strong>${escapeHtml(edu.degree || '')}</strong>
          <span class="cv-edu-year">${escapeHtml(edu.year || '')}</span>
        </div>
        <div class="cv-edu-school">${escapeHtml(edu.school || '')}${edu.details ? ' — ' + escapeHtml(edu.details) : ''}</div>
      </div>`).join('');
    eduHtml = `<div class="cv-section"><h3>Formation</h3>${items}</div>`;
  }

  // Skills
  let skillsHtml = '';
  if (cv.skills) {
    const rows = [];
    if (cv.skills.technical && cv.skills.technical.length > 0) {
      const tags = cv.skills.technical.map(s => `<span class="cv-tag">${escapeHtml(s)}</span>`).join('');
      rows.push(`<div class="cv-skills-row"><span class="cv-skills-label">Technique</span><div class="cv-tags">${tags}</div></div>`);
    }
    if (cv.skills.soft && cv.skills.soft.length > 0) {
      const tags = cv.skills.soft.map(s => `<span class="cv-tag">${escapeHtml(s)}</span>`).join('');
      rows.push(`<div class="cv-skills-row"><span class="cv-skills-label">Soft skills</span><div class="cv-tags">${tags}</div></div>`);
    }
    if (cv.skills.languages && cv.skills.languages.length > 0) {
      const tags = cv.skills.languages.map(s => `<span class="cv-tag">${escapeHtml(s)}</span>`).join('');
      rows.push(`<div class="cv-skills-row"><span class="cv-skills-label">Langues</span><div class="cv-tags">${tags}</div></div>`);
    }
    if (rows.length > 0) {
      skillsHtml = `<div class="cv-section"><h3>Compétences</h3><div class="cv-skills-block">${rows.join('')}</div></div>`;
    }
  }

  // Certifications
  let certHtml = '';
  if (cv.certifications && cv.certifications.length > 0) {
    const tags = cv.certifications.map(c => `<span class="cv-tag">${escapeHtml(c)}</span>`).join('');
    certHtml = `<div class="cv-section"><h3>Certifications</h3><div class="cv-tags">${tags}</div></div>`;
  }

  const photoHtml = photoDataUrl
    ? `<img class="cv-photo" src="${photoDataUrl}" alt="Photo de profil" />`
    : '';

  container.innerHTML = `
    <div class="cv-document" id="cv-document">
      <div class="cv-header">
        <div class="cv-header-info">
          <h1>${escapeHtml(fullName)}</h1>
          <h2>${escapeHtml(cv.headline || '')}</h2>
          <div class="cv-contact">${contactHtml}</div>
        </div>
        ${photoHtml}
      </div>
      ${summaryHtml}
      ${expHtml}
      ${eduHtml}
      ${skillsHtml}
      ${certHtml}
    </div>`;
}

// ── RENDER LETTER ─────────────────────────────────────────────
function renderLetter(letterText, profile, analysis) {
  const container = document.getElementById('letter-preview');
  if (!container) return;

  const fullName  = [profile.prenom, profile.nom].filter(Boolean).join(' ') || 'Votre Nom';
  const dateStr   = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  const poste     = analysis?.poste     || 'le poste proposé';
  const entreprise = analysis?.entreprise || '';
  const localisation = analysis?.localisation || '';

  // Build body paragraphs
  const lines     = (letterText || '').split('\n');
  const bodyHtml  = lines
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map(line => `<p>${escapeHtml(line)}</p>`)
    .join('');

  container.innerHTML = `
    <div class="letter-document" id="letter-document">
      <div class="letter-header">
        <div class="letter-sender">
          <strong>${escapeHtml(fullName)}</strong>
          ${profile.localisation ? escapeHtml(profile.localisation) + '<br>' : ''}
          ${profile.telephone    ? escapeHtml(profile.telephone)    + '<br>' : ''}
          ${profile.email        ? escapeHtml(profile.email)                 : ''}
        </div>
        <div class="letter-recipient">
          ${entreprise   ? '<strong>' + escapeHtml(entreprise)   + '</strong><br>' : ''}
          ${localisation ? escapeHtml(localisation)                               : ''}
        </div>
      </div>
      <div class="letter-date">${escapeHtml(dateStr)}</div>
      <div class="letter-subject">Objet : Candidature au poste de ${escapeHtml(poste)}</div>
      <div class="letter-body">${bodyHtml}</div>
    </div>`;
}

// ── TABS ──────────────────────────────────────────────────────
function initTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      // Deactivate all
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      // Activate clicked
      btn.classList.add('active');
      const tabId = 'tab-' + btn.dataset.tab;
      const content = document.getElementById(tabId);
      if (content) content.classList.add('active');
    });
  });
}

// ── EXPORT CV PDF ─────────────────────────────────────────────
function exportCvPdf() {
  const element = document.getElementById('cv-document');
  if (!element) { showToast('Aucun CV à exporter.', 'error'); return; }

  const profile = collectProfile();
  const name    = [profile.prenom, profile.nom].filter(Boolean).join('_') || 'CV';

  const opt = {
    margin:   [10, 10, 10, 10],
    filename: `CV_${name}.pdf`,
    image:    { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF:    { unit: 'mm', format: 'a4', orientation: 'portrait' },
  };

  html2pdf().set(opt).from(element).save()
    .then(() => showToast('CV exporté en PDF !', 'success'))
    .catch(() => showToast('Erreur lors de l\'export PDF.', 'error'));
}

// ── EXPORT LETTER PDF ─────────────────────────────────────────
function exportLetterPdf() {
  const element = document.getElementById('letter-document');
  if (!element) { showToast('Aucune lettre à exporter.', 'error'); return; }

  const profile = collectProfile();
  const name    = [profile.prenom, profile.nom].filter(Boolean).join('_') || 'Lettre';

  const opt = {
    margin:   [15, 15, 15, 15],
    filename: `Lettre_${name}.pdf`,
    image:    { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF:    { unit: 'mm', format: 'a4', orientation: 'portrait' },
  };

  html2pdf().set(opt).from(element).save()
    .then(() => showToast('Lettre exportée en PDF !', 'success'))
    .catch(() => showToast('Erreur lors de l\'export PDF.', 'error'));
}

// ── COPY LETTER ───────────────────────────────────────────────
function copyLetter() {
  const element = document.getElementById('letter-document');
  if (!element) { showToast('Aucune lettre à copier.', 'error'); return; }

  const text = element.innerText || element.textContent || '';
  navigator.clipboard.writeText(text)
    .then(() => showToast('Lettre copiée !', 'success'))
    .catch(() => showToast('Impossible de copier (droits refusés).', 'error'));
}

// ── DOM CONTENT LOADED ────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {

  // Init modules
  initUploadZone();
  initClipboardPaste();
  initManualToggle();
  initTabs();
  initPhotoUpload();

  // LinkedIn PDF import
  document.getElementById('linkedin-pdf-input')?.addEventListener('change', (e) => {
    if (e.target.files[0]) importLinkedinPdf(e.target.files[0]);
  });

  // Track LinkedIn URL state
  document.getElementById('linkedin-url')?.addEventListener('input', (e) => {
    linkedinUrl = e.target.value.trim();
  });

  // Seed default experience/education on load
  addExperience();
  addExperience();
  addEducation();

  // Load saved profile data
  loadProfileFromStorage();

  // ── Step 1 ──
  document.getElementById('remove-file')?.addEventListener('click', removeFile);

  document.getElementById('analyze-btn')?.addEventListener('click', analyze);

  // ── Step 2 ──
  document.getElementById('back-to-1')?.addEventListener('click', () => goToStep(1));

  document.getElementById('continue-to-3')?.addEventListener('click', () => {
    jobAnalysis = collectAnalysis();
    goToStep(3);
  });

  // ── Step 3 ──
  document.getElementById('add-exp')?.addEventListener('click', () => addExperience());
  document.getElementById('add-edu')?.addEventListener('click', () => addEducation());

  document.getElementById('back-to-2')?.addEventListener('click', () => goToStep(2));
  document.getElementById('generate-btn')?.addEventListener('click', generate);

  // ── Step 4 ──
  document.getElementById('back-to-3')?.addEventListener('click', () => goToStep(3));

  document.getElementById('export-cv-btn')?.addEventListener('click', exportCvPdf);
  document.getElementById('export-letter-btn')?.addEventListener('click', exportLetterPdf);
  document.getElementById('copy-letter-btn')?.addEventListener('click', copyLetter);

  document.getElementById('regen-cv-btn')?.addEventListener('click', generate);
  document.getElementById('regen-letter-btn')?.addEventListener('click', generate);

});
