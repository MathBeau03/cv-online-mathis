const dropZone    = document.getElementById('dropZone');
const fileInput   = document.getElementById('fileInput');
const offerText   = document.getElementById('offerText');
const analyzeBtn  = document.getElementById('analyzeBtn');
const errorBox    = document.getElementById('errorBox');
const stepUpload  = document.getElementById('step-upload');
const stepResults = document.getElementById('step-results');
const resetBtn    = document.getElementById('resetBtn');
const exportPdfBtn= document.getElementById('exportPdfBtn');

let selectedFile    = null;
let _progressTimer  = null;
let lastMatchData   = null;

// ── Drag & drop ──────────────────────────────────────────────
dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  const f = e.dataTransfer.files[0];
  if (f) setFile(f);
});
fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) setFile(fileInput.files[0]);
});

function setFile(f) {
  selectedFile = f;
  offerText.value = '';
  const sizeStr = f.size < 1024 * 1024
    ? Math.round(f.size / 1024) + ' Ko'
    : (f.size / (1024 * 1024)).toFixed(1) + ' Mo';
  document.getElementById('fileReadyName').textContent = f.name;
  document.getElementById('fileReadySize').textContent = sizeStr;
  dropZone.classList.add('has-file');
}

// ── Analyse ──────────────────────────────────────────────────
analyzeBtn.addEventListener('click', async () => {
  const hasFile = !!selectedFile;
  const hasText = offerText.value.trim().length > 10;

  if (!hasFile && !hasText) {
    showError('Veuillez fournir un fichier ou coller le texte de l\'offre.');
    return;
  }

  setLoading(true);
  hideError();

  try {
    let body, headers;
    if (hasFile) {
      const fd = new FormData();
      fd.append('file', selectedFile);
      body = fd;
    } else {
      body = JSON.stringify({ text: offerText.value.trim() });
      headers = { 'Content-Type': 'application/json' };
    }

    const res  = await fetch('/api/match', { method: 'POST', headers, body });
    const data = await res.json();

    if (res.status === 429) {
      showError(data.error || 'Limite journalière atteinte (5 analyses/jour). Revenez demain 🙂');
      return;
    }
    if (!res.ok) throw new Error(data.error || 'Erreur serveur');

    renderResults(data);
  } catch (err) {
    const isNetworkError = err instanceof TypeError && err.message.includes('fetch');
    showError(isNetworkError
      ? 'Impossible de joindre le serveur. Vérifiez votre connexion et réessayez.'
      : (err.message || 'Une erreur est survenue. Veuillez réessayer.'));
  } finally {
    setLoading(false);
  }
});

// ── Reset ────────────────────────────────────────────────────
resetBtn.addEventListener('click', () => {
  stepResults.classList.remove('visible');
  stepUpload.style.display = '';
  selectedFile = null;
  fileInput.value = '';
  dropZone.classList.remove('has-file');
  document.getElementById('fileReadyName').textContent = '';
  document.getElementById('fileReadySize').textContent = '';
  offerText.value = '';
  hideError();
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// ── Export PDF ───────────────────────────────────────────────
exportPdfBtn.addEventListener('click', () => {
  if (!lastMatchData) {
    alert('Aucun résultat à exporter. Analysez d\'abord une offre d\'emploi.');
    return;
  }
  if (typeof window.jspdf === 'undefined') {
    alert('La bibliothèque PDF n\'est pas encore chargée. Rechargez la page et réessayez.');
    return;
  }
  generatePDF(lastMatchData);
});

// ── Progress bar ─────────────────────────────────────────────
function startProgress() {
  let pct = 0;
  const bar   = document.getElementById('progressBar');
  const pctEl = document.getElementById('progressPct');
  bar.style.width  = '0%';
  pctEl.textContent = '0 %';

  _progressTimer = setInterval(() => {
    if (pct < 92) {
      const remaining = 92 - pct;
      const step = Math.max(0.4, remaining * 0.055 + Math.random() * 1.8);
      pct = Math.min(92, pct + step);
      const rounded = Math.round(pct);
      bar.style.width  = rounded + '%';
      pctEl.textContent = rounded + ' %';
    }
  }, 200);
}

function completeProgress() {
  clearInterval(_progressTimer);
  const bar   = document.getElementById('progressBar');
  const pctEl = document.getElementById('progressPct');
  bar.style.width  = '100%';
  pctEl.textContent = '100 %';
}

// ── Loading state ────────────────────────────────────────────
function setLoading(on) {
  analyzeBtn.disabled = on;
  analyzeBtn.classList.toggle('loading', on);
  const overlay = document.getElementById('loadingOverlay');
  if (on) {
    overlay.classList.add('visible');
    startProgress();
  } else {
    completeProgress();
    setTimeout(() => overlay.classList.remove('visible'), 380);
  }
}

function showError(msg) {
  errorBox.textContent = msg;
  errorBox.classList.add('visible');
}

function hideError() {
  errorBox.classList.remove('visible');
}

// ── Rendu des résultats ──────────────────────────────────────
function renderResults(d) {
  lastMatchData = d;
  document.getElementById('resPoste').textContent      = d.poste || 'Poste non précisé';
  document.getElementById('resEntreprise').textContent = d.entreprise || '';

  const badge       = document.getElementById('niveauBadge');
  badge.textContent = d.niveau || '—';
  badge.className   = 'niveau-badge ' + getNiveauClass(d.score);

  animateScore(d.score || 0);
  renderTags('tagsMatch',   d.competences_match      || [], 'green');
  renderTags('tagsMissing', d.competences_manquantes || [], 'orange');

  // Points forts
  const ul = document.getElementById('pointsForts');
  ul.innerHTML = '';
  (d.points_forts || []).forEach(p => {
    const li = document.createElement('li');
    li.textContent = p;
    ul.appendChild(li);
  });
  if (!d.points_forts || !d.points_forts.length) {
    ul.innerHTML = '<li style="color:var(--muted);font-style:italic;">Aucun point fort identifié</li>';
  }

  // Soft skills
  const ssList = document.getElementById('softSkillsList');
  const ssCard = document.getElementById('softSkillsCard');
  ssList.innerHTML = '';
  const softSkills = d.soft_skills_match || [];
  if (softSkills.length) {
    softSkills.forEach(s => {
      const li = document.createElement('li');
      li.textContent = s;
      ssList.appendChild(li);
    });
    ssCard.style.display = '';
  } else {
    ssCard.style.display = 'none';
  }

  // Points d'attention
  const attn = document.getElementById('pointsAttention');
  attn.innerHTML = '';
  (d.points_attention || []).forEach(p => {
    const li = document.createElement('li');
    li.textContent = p;
    attn.appendChild(li);
  });
  document.getElementById('attentionCard').style.display =
    (d.points_attention && d.points_attention.length) ? '' : 'none';

  document.getElementById('recommandation').textContent = d.recommandation || '';

  stepUpload.style.display = 'none';
  stepResults.classList.add('visible');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderTags(containerId, items, colorClass) {
  const el = document.getElementById(containerId);
  el.innerHTML = '';
  if (!items.length) {
    el.innerHTML = '<span class="empty-state">Aucune</span>';
    return;
  }
  items.forEach(item => {
    const span = document.createElement('span');
    span.className = 'tag ' + colorClass;
    span.textContent = item;
    el.appendChild(span);
  });
}

function getNiveauClass(score) {
  if (score >= 90) return 'great';
  if (score >= 75) return 'good';
  if (score >= 50) return 'medium';
  return 'low';
}

function getScoreColor(score) {
  if (score >= 75) return '#4caf79';
  if (score >= 50) return '#f5c84c';
  return '#f54c4c';
}

function animateScore(target) {
  const arc   = document.getElementById('scoreArc');
  const numEl = document.getElementById('scoreNumber');
  const circumference = 314.16;

  arc.style.stroke = getScoreColor(target);

  let current      = 0;
  const duration   = 1200;
  const start      = performance.now();

  function step(now) {
    const elapsed  = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const ease     = 1 - Math.pow(1 - progress, 3);
    current        = Math.round(ease * target);
    numEl.textContent = current;
    arc.style.strokeDashoffset = circumference - (circumference * current / 100);
    if (progress < 1) requestAnimationFrame(step);
  }

  requestAnimationFrame(step);
}

// ── Génération PDF (jsPDF) ────────────────────────────────────
function generatePDF(d) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  const M  = 18;
  const PW = 210;
  const W  = PW - M * 2;
  let y    = M;

  const sv = d.score || 0;
  const CS = sv >= 75 ? [40, 160, 90] : sv >= 50 ? [200, 155, 20] : [210, 60, 60];

  // Header band
  doc.setFillColor(20, 21, 30);
  doc.rect(0, 0, PW, 34, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(200, 160, 40);
  doc.text('Mathis Beauchamp', M, 13);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(140, 140, 150);
  const dateStr = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  doc.text('Analyse de matching - ' + dateStr, M, 20);
  doc.text('mathisbeauchamp.fr', M, 27);

  y = 44;

  // Score block
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(40);
  doc.setTextColor(CS[0], CS[1], CS[2]);
  doc.text(String(sv), M, y + 13);
  const scoreW = doc.getTextWidth(String(sv));
  doc.setFontSize(13);
  doc.setTextColor(140, 140, 150);
  doc.text('/100', M + scoreW + 1, y + 13);

  const rx = M + Math.max(scoreW + 22, 30);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 30, 40);
  const posteLines = doc.splitTextToSize(d.poste || 'Poste non precise', W - (rx - M));
  doc.text(posteLines, rx, y + 5);

  let ryOff = posteLines.length * 5.8 + 6;
  if (d.entreprise) {
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(110, 110, 120);
    doc.text(d.entreprise, rx, y + ryOff);
    ryOff += 5.5;
  }
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(CS[0], CS[1], CS[2]);
  doc.text(d.niveau || '', rx, y + ryOff);

  y += 24;
  doc.setDrawColor(215, 215, 220);
  doc.line(M, y, M + W, y);
  y += 8;

  // Helpers
  function checkPage(needed) {
    if (y + (needed || 14) > 274) { doc.addPage(); y = M; }
  }

  function section(title) {
    checkPage(18);
    y += 3;
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(120, 120, 135);
    doc.text(title, M, y);
    y += 4;
    doc.setDrawColor(220, 220, 225);
    doc.line(M, y, M + W, y);
    y += 5;
  }

  function pdfTags(items, cText, cBg) {
    if (!items || !items.length) {
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(160, 160, 170);
      doc.text('Aucune', M, y);
      y += 7;
      return;
    }
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    let x = M;
    items.forEach(item => {
      const tw = doc.getTextWidth(item);
      const bw = tw + 5;
      const bh = 5.5;
      if (x + bw > M + W) { x = M; y += bh + 2.5; checkPage(bh + 5); }
      doc.setFillColor(cBg[0], cBg[1], cBg[2]);
      doc.roundedRect(x, y - 4, bw, bh, 1.5, 1.5, 'F');
      doc.setTextColor(cText[0], cText[1], cText[2]);
      doc.text(item, x + 2.5, y);
      x += bw + 3;
    });
    y += 9;
  }

  function pdfBullets(items, cText) {
    if (!items || !items.length) return;
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(cText[0], cText[1], cText[2]);
    items.forEach(item => {
      checkPage(10);
      const lines = doc.splitTextToSize('- ' + item, W - 4);
      doc.text(lines, M + 2, y);
      y += lines.length * 5.2 + 2;
    });
    y += 2;
  }

  // Sections
  section('COMPETENCES MATCHEES');
  pdfTags(d.competences_match, [25, 100, 60], [215, 240, 228]);

  section('COMPETENCES MANQUANTES');
  pdfTags(d.competences_manquantes, [160, 70, 15], [250, 230, 215]);

  if (d.soft_skills_match && d.soft_skills_match.length) {
    section('SOFT SKILLS DETECTES');
    pdfBullets(d.soft_skills_match, [60, 110, 210]);
  }

  if (d.points_forts && d.points_forts.length) {
    section('POINTS FORTS');
    pdfBullets(d.points_forts, [35, 35, 45]);
  }

  if (d.points_attention && d.points_attention.length) {
    section("POINTS D'ATTENTION");
    pdfBullets(d.points_attention, [180, 80, 20]);
  }

  section('RECOMMANDATION');
  if (d.recommandation) {
    checkPage(20);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(35, 35, 45);
    const rlines = doc.splitTextToSize(d.recommandation, W);
    doc.text(rlines, M, y);
    y += rlines.length * 5.5 + 4;
  }

  // Footer on each page
  const np = doc.internal.getNumberOfPages();
  for (let p = 1; p <= np; p++) {
    doc.setPage(p);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(160, 160, 170);
    doc.text('Mathis Beauchamp - mathisbeauchamp.fr - Page ' + p + '/' + np, M, 289);
  }

  const slug = (d.poste || 'offre').replace(/[^a-z0-9]+/gi, '-').toLowerCase().slice(0, 25);
  doc.save('matching-mathis-beauchamp-' + slug + '.pdf');
}
