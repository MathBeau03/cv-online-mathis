const dropZone   = document.getElementById('dropZone');
const fileInput  = document.getElementById('fileInput');
const offerText  = document.getElementById('offerText');
const analyzeBtn = document.getElementById('analyzeBtn');
const errorBox   = document.getElementById('errorBox');
const stepUpload = document.getElementById('step-upload');
const stepResults= document.getElementById('step-results');
const resetBtn   = document.getElementById('resetBtn');

let selectedFile = null;

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

    const res = await fetch('/api/match', { method: 'POST', headers, body });
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

function setLoading(on) {
  analyzeBtn.disabled = on;
  analyzeBtn.classList.toggle('loading', on);
  document.getElementById('loadingOverlay').classList.toggle('visible', on);
}

function showError(msg) {
  errorBox.textContent = msg;
  errorBox.classList.add('visible');
}

function hideError() {
  errorBox.classList.remove('visible');
}

function renderResults(d) {
  document.getElementById('resPoste').textContent = d.poste || 'Poste non précisé';
  document.getElementById('resEntreprise').textContent = d.entreprise || '';

  const badge = document.getElementById('niveauBadge');
  badge.textContent = d.niveau || '—';
  badge.className = 'niveau-badge ' + getNiveauClass(d.score);

  animateScore(d.score || 0);
  renderTags('tagsMatch',   d.competences_match      || [], 'green');
  renderTags('tagsMissing', d.competences_manquantes || [], 'orange');

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

  let current = 0;
  const duration = 1200;
  const start   = performance.now();

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
