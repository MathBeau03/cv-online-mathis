require('dotenv').config();
const express  = require('express');
const path     = require('path');
const fs       = require('fs');
const multer   = require('multer');
const pdfParse = require('pdf-parse');

const app = express();
app.set('trust proxy', 1); // IP correcte derrière Render/Heroku/nginx

// ── Origines autorisées ───────────────────────────────────────
// Remplacez par vos domaines réels en production
const ALLOWED_ORIGINS = new Set([
  'https://mathisbeauchamp.fr',
  'https://www.mathisbeauchamp.fr',
  'https://portfolio-mathis-beauchamp-production.up.railway.app',
  // Décommentez pour le dev local :
  // 'http://localhost:3000',
]);

// ── CORS ─────────────────────────────────────────────────────
app.use((req, res, next) => {
  const origin = req.headers.origin;
  // En local (pas d'origin header) ou origin autorisée
  if (!origin || ALLOWED_ORIGINS.has(origin)) {
    if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Vary', 'Origin');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ── Headers de sécurité HTTP ──────────────────────────────────
app.use((req, res, next) => {
  // Empêche le MIME sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // Empêche l'intégration dans des iframes tierces
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  // XSS Filter (legacy, la CSP est la vraie protection)
  res.setHeader('X-XSS-Protection', '1; mode=block');
  // Referrer limité
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  // HTTPS strict (activé uniquement en prod)
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  }
  // Désactive les APIs sensibles non utilisées
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), payment=()');
  // Content Security Policy
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' https://cdn.jsdelivr.net",
    "style-src 'self' 'unsafe-inline'",         // unsafe-inline pour le CSS inline (à réduire si possible)
    "img-src 'self' data: https:",
    "connect-src 'self' https://api.emailjs.com https://api.anthropic.com",
    "font-src 'self'",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; '));
  next();
});

app.use(express.json({ limit: '2mb' }));

// ── Blocage des fichiers serveur (jamais servis en statique) ──
const BLOCKED_STATIC = new Set([
  '/server.js', '/package.json', '/package-lock.json', '/.env',
]);
app.use((req, res, next) => {
  if (BLOCKED_STATIC.has(req.path)) return res.status(403).end();
  next();
});

// ── Routes HTML (AVANT express.static) ───────────────────────
app.get('/',          (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/generator', (req, res) => res.redirect(301, '/'));
app.get('/matcher',   (req, res) => res.sendFile(path.join(__dirname, 'matcher',   'index.html')));

// ── Assets statiques ─────────────────────────────────────────
app.use(express.static(__dirname, {
  dotfiles: 'deny',
  etag: true,
  maxAge: '1d',
}));

// ── Rate Limiter (in-memory, par IP + fingerprint, reset quotidien) ──
const _rateCounts = new Map();
const _rateToday  = () => new Date().toISOString().slice(0, 10);

function getUserFingerprint(req) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  // Ajout d'un hash partiel du User-Agent pour complexifier le contournement
  const ua = (req.headers['user-agent'] || '').slice(0, 40);
  return ip + '|' + ua;
}

function checkLimit(req, endpoint, max) {
  const fp  = getUserFingerprint(req);
  const key = `${fp}|${endpoint}|${_rateToday()}`;
  const n   = (_rateCounts.get(key) || 0) + 1;
  _rateCounts.set(key, n);
  return { allowed: n <= max, used: n, max };
}

// Nettoyage horaire des entrées périmées
setInterval(() => {
  const t = _rateToday();
  for (const k of _rateCounts.keys()) {
    if (!k.includes(`|${t}`)) _rateCounts.delete(k);
  }
}, 3_600_000);

// ── Chargement des PDFs au démarrage ─────────────────────────
let docFormation   = '';
let docExperiences = '';

async function loadDocuments() {
  try {
    const bufFormation   = fs.readFileSync(path.join(__dirname, 'Mathis_Beauchamp_Formation_Certifications.pdf'));
    const bufExperiences = fs.readFileSync(path.join(__dirname, 'Mathis_Beauchamp_Experiences_Professionnelles.pdf'));
    docFormation   = (await pdfParse(bufFormation)).text.trim();
    docExperiences = (await pdfParse(bufExperiences)).text.trim();
    console.log('✅ PDFs chargés — Formation:', docFormation.length, 'chars | Expériences:', docExperiences.length, 'chars');
  } catch (err) {
    console.error('❌ Erreur chargement PDFs:', err.message);
  }
}

// ── Profil Mathis hardcodé (jamais exposé au client) ─────────
const MATHIS_PROFILE = `
PROFIL COMPLET — Mathis Beauchamp
LinkedIn : linkedin.com/in/mathis-beauchamp
Localisation : Île-de-France (Paris)
Disponibilité : CDI à partir de septembre 2026

FORMATION :
- Master 2 Management des Systèmes d'Information et Data — EMLV (École de Management Léonard de Vinci), 2024–2026 (en alternance chez Société Générale). Compétences : Data Analysis, SQL, Python, Tableau Desktop, MicroStrategy, Gestion de projet agile, Machine Learning, IT Cloud Architecture, Cybersecurity & Quality Mgmt.
- Semestre international — JAMK University of Applied Sciences (Finlande), Août–Décembre 2023. Bachelor's degree International Business. Cours 100% anglais, communication interculturelle, business international.
- Stage CEO Assistant — EIC Montréal (Canada), Mars–Août 2024. Business Operations, CRM, automatisation workflows.
- Programme Grande École — EMLV, 2021–2022. Statut SHN Volley-ball. Fondamentaux Business, Marketing, Finance, Digital.
- Baccalauréat général Mention Bien — Maths, Physique-Chimie, NSI — 2021.

EXPÉRIENCES PROFESSIONNELLES :
1. Société Générale — Chargé de mise en œuvre projet (Alternance, La Défense, Sept 2024–2026)
   - Pilotage de projets de performance opérationnelle (filière Financement Immobilier Particuliers, Direction Opérations Banque de Détail)
   - Automatisation de 13+ procédures via Excel et macros VBA — délai ramené de J+20 à J sur les contrôles
   - 2 projets data stratégiques dont 1 classé dans les projets prioritaires SGRF ; 5+ KPI suivis
   - Analyse de données fiabilisant les opérations de 7 Centres de Services
   - Compétences : Excel avancé, Macros VBA, C3P (outil visualisation processus), Data Analysis, Gestion de projet, Conformité, Collaboration transverse

2. EIC — Experience Internship Canada — Business Operations & CEO Assistant (Stage, Montréal, Mars–Août 2024, 6 mois)
   - Mise en place d'une dizaine de workflows (CRM, base de données, automatisation emailing) pour 100+ utilisateurs
   - Accompagnement de 50+ étudiants internationaux dans leurs démarches administratives et intégration au Canada
   - Compétences : CRM, Automatisation emailing, Gestion de projet, Communication, Service client

3. BNP Paribas (Copartis) — Employé Administratif / Analyste Conformité (Stage, Rueil-Malmaison, Janv–Mars 2024, 3 mois)
   - Retour à la conformité du traitement des alertes : délai ramené de J+23 à J+1
   - Surveillance des flux financiers, détection d'activités frauduleuses, prévention des risques financiers
   - Compétences : Conformité LCB-FT, KYC/AML, Analyse de risques, Monitoring financier

COMPÉTENCES CLÉS :
- Data & Analyse : Python (certifié), SQL, R, Tableau Desktop, MicroStrategy, Power BI, Excel avancé / Macros VBA
- IA & Machine Learning : Claude API, Prompt Engineering, scikit-learn, Régression, Classification, Clustering
- Gestion de projet : Méthodes Agiles, Scrum (certifié PSM I), Design Thinking (certifié)
- Développement web : HTML, CSS, JavaScript, Node.js/Express
- Secteur bancaire : 2 expériences (Société Générale + BNP Paribas), processus bancaires, conformité réglementaire
- Langues : Français (natif), Anglais (C1 — semestre Finlande + stage Canada 6 mois)

CERTIFICATIONS :
- Professional Scrum Master I (PSM I) — Scrum.org (2024)
- TOSA Excel Avancé — Tosa Certifications (2025)
- Design Thinker
- Bases du langage Python — OpenClassrooms (2023)

PROJETS PERSONNELS :
- Portfolio IA (ce site) : Full-stack Node.js/Express + Claude API, matching IA, générateur de lettre, chatbot RAG
- RPG Python "La Planète des Singes" : architecture modulaire 10+ modules, pytest, POO
- Analyse stratégique hypermarché européen sous Tableau Desktop : dashboards interactifs, KPI rentabilité
- Portfolio de notebooks Data Science : Pandas, NumPy, scikit-learn sur datasets réels

ATOUTS DIFFÉRENCIANTS :
- ~2 ans d'alternance au siège de la Société Générale (Direction Opérations Banque de Détail)
- Double culture bancaire : banque de détail (SG) + conformité/compliance (BNP Paribas)
- Expérience internationale : stage 6 mois au Canada + semestre en Finlande
- Profil polyvalent : data + gestion de projet + automatisation + conformité + développement IA
- Sportif semi-professionnel (volleyball, Coupe de France Fédérale 2026) : résilience, esprit d'équipe, leadership
- Passionné d'IA : intègre des solutions IA dans ses projets personnels (Claude API, RAG, chatbot)
`.trim();

// ── Constructeur de prompts RAG ───────────────────────────────
function buildSystemPrompt(topic) {
  if (topic === 'general') {
    return `
Tu es l'assistant IA personnel de Mathis Beauchamp, intégré à son portfolio professionnel.
Ton rôle : répondre aux questions des recruteurs, RH et professionnels qui visitent son portfolio.

RÈGLES ABSOLUES :
1. Tu réponds UNIQUEMENT à partir du profil fourni ci-dessous.
2. Si une information n'est pas dans le profil, réponds poliment sans l'inventer. Exemple : "Je n'ai pas cette information précise. N'hésitez pas à contacter Mathis directement."
3. Tu peux répondre à des questions générales sur le profil : formation, expériences, compétences, projets, soft skills, disponibilité, motivations.
4. Sois positif, professionnel et vendeur — tu représentes Mathis. Mets en valeur ses points forts.
5. N'invente rien, ne complète pas par tes connaissances extérieures.
6. Réponds en français (anglais si l'utilisateur écrit en anglais). Sois concis : 3-5 phrases max sauf si une réponse longue est vraiment nécessaire.
7. Si on te demande pourquoi recruter Mathis, mets en avant ses atouts différenciants : double expérience bancaire, profil data + gestion projet + IA, disponibilité CDI 2026.

═══════════════════════════════════════════
PROFIL — Mathis Beauchamp
═══════════════════════════════════════════
${MATHIS_PROFILE}
═══════════════════════════════════════════
`.trim();
  }

  if (topic === 'formation') {
    return `
Tu es un assistant RAG dédié à la FORMATION et aux CERTIFICATIONS de Mathis Beauchamp.

RÈGLES ABSOLUES :
1. Tu réponds UNIQUEMENT à partir du document fourni ci-dessous. C'est ta seule source de vérité.
2. Si la réponse n'est pas dans le document, réponds poliment sans mentionner l'existence d'un document. Exemple : "Je ne suis pas en mesure de vous répondre sur ce point. N'hésitez pas à contacter Mathis directement."
3. Tu ne réponds PAS aux questions hors formation/certifications. Redirige poliment : "Je suis dédié aux questions sur la formation de Mathis. Pour toute autre question, utilisez la section appropriée."
4. N'invente rien, ne complète pas par tes connaissances extérieures.
5. Réponds en français (anglais si l'utilisateur écrit en anglais). Sois concis : 2-4 phrases max.

═══════════════════════════════════════════
DOCUMENT SOURCE — Formation & Certifications
═══════════════════════════════════════════
${docFormation}
═══════════════════════════════════════════
`.trim();
  }

  if (topic === 'experiences') {
    return `
Tu es un assistant RAG dédié aux EXPÉRIENCES PROFESSIONNELLES et PROJETS de Mathis Beauchamp.

RÈGLES ABSOLUES :
1. Tu réponds UNIQUEMENT à partir du document fourni ci-dessous. C'est ta seule source de vérité.
2. Si la réponse n'est pas dans le document, réponds poliment sans mentionner l'existence d'un document. Exemple : "Je ne suis pas en mesure de vous répondre sur ce point. N'hésitez pas à contacter Mathis directement."
3. Tu ne réponds PAS aux questions hors expériences/projets. Redirige poliment : "Je suis dédié aux questions sur les expériences de Mathis."
4. N'invente rien, ne complète pas par tes connaissances extérieures.
5. Réponds en français (anglais si l'utilisateur écrit en anglais). Sois concis : 2-4 phrases max.

═══════════════════════════════════════════
DOCUMENT SOURCE — Expériences & Projets
═══════════════════════════════════════════
${docExperiences}
═══════════════════════════════════════════
`.trim();
  }

  return '';
}

// ── Route proxy API Claude — Chat ─────────────────────────────
app.post('/api/chat', async (req, res) => {
  const limit = checkLimit(req, 'chat', 10); // Augmenté à 10 pour le bot général
  if (!limit.allowed) {
    return res.status(429).json({
      error: `Limite journalière atteinte (${limit.max} messages/jour). Revenez demain 🙂`,
      limit: true,
    });
  }

  const { messages, topic } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages manquants' });
  }
  if (messages.length > 30) {
    return res.status(400).json({ error: 'Historique trop long.' });
  }

  // Validation & sanitisation
  const sanitized = messages
    .filter(m => m && typeof m.role === 'string' && typeof m.content === 'string')
    .map(m => ({
      role:    m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content.slice(0, 2000).replace(/<[^>]*>/g, ''), // strip HTML basique
    }));

  if (!sanitized.length) {
    return res.status(400).json({ error: 'Messages invalides.' });
  }

  const validTopics = ['general', 'formation', 'experiences'];
  if (!topic || !validTopics.includes(topic)) {
    return res.status(400).json({ error: 'topic invalide' });
  }

  const systemPrompt = buildSystemPrompt(topic);
  if (!systemPrompt) {
    return res.status(400).json({ error: 'Impossible de construire le prompt.' });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-haiku-4-5-20251001', // Haiku : rapide + économique pour le chat
        max_tokens: topic === 'general' ? 400 : 300,
        system:     systemPrompt,
        messages:   sanitized,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('Anthropic error:', data);
      return res.status(502).json({ error: 'Erreur API Claude' });
    }

    res.json({ reply: data.content[0].text });
  } catch (err) {
    console.error('Server error /api/chat:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ── Multer configs ────────────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Type de fichier non supporté'));
  },
});

// Gestionnaire d'erreur Multer
function handleMulterError(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'Fichier trop volumineux (max 15 MB).' });
    }
    return res.status(400).json({ error: err.message });
  }
  if (err) {
    return res.status(400).json({ error: err.message });
  }
  next();
}

// ── Matcher route ─────────────────────────────────────────────
app.post('/api/match', upload.single('file'), handleMulterError, async (req, res) => {
  const limit = checkLimit(req, 'match', 3);
  if (!limit.allowed) {
    return res.status(429).json({
      error: `Limite journalière atteinte (3 analyses/jour). Revenez demain 🙂`,
      limit: true,
    });
  }
  if (req.body?.text && req.body.text.length > 20_000) {
    return res.status(400).json({ error: 'Texte trop long (max 20 000 caractères).' });
  }

  try {
    let claudeContent = [];

    if (req.file) {
      const mime = req.file.mimetype;
      if (mime === 'application/pdf') {
        const parsed = await pdfParse(req.file.buffer);
        let offerText = parsed.text || '';
        if (!offerText.trim()) offerText = '[PDF sans texte extractible — contenu scanné probable]';
        claudeContent = [{ type: 'text', text: `Offre d'emploi (extrait PDF) :\n\n${offerText}` }];
      } else {
        const b64 = req.file.buffer.toString('base64');
        claudeContent = [
          { type: 'image', source: { type: 'base64', media_type: mime, data: b64 } },
          { type: 'text', text: "Voici une image d'une offre d'emploi. Analyse-la." },
        ];
      }
    } else if (req.body?.text?.trim()) {
      claudeContent = [{ type: 'text', text: `Offre d'emploi :\n\n${req.body.text.trim()}` }];
    } else {
      return res.status(400).json({ error: 'Aucun fichier ni texte fourni.' });
    }

    const matchPrompt = `Tu es un expert en recrutement RH. Analyse le matching entre le profil candidat suivant et l'offre d'emploi fournie.

${MATHIS_PROFILE}

Évalue le matching de manière rigoureuse et objective. Retourne UNIQUEMENT un objet JSON valide (sans balises markdown) :
{
  "score": <entier 0-100>,
  "niveau": "<Faible match|Moyen match|Bon match|Excellent match>",
  "competences_match": ["compétence1", "compétence2"],
  "competences_manquantes": ["compétence1", "compétence2"],
  "points_forts": ["point fort 1", "point fort 2"],
  "points_attention": ["point d'attention 1"],
  "recommandation": "Texte de recommandation détaillé (3-4 phrases)",
  "poste": "intitulé du poste",
  "entreprise": "nom de l'entreprise ou vide si non mentionné"
}

Barème :
- 0–49 : Faible match (peu de compétences communes)
- 50–74 : Moyen match (quelques compétences communes, manques significatifs)
- 75–89 : Bon match (bonne adéquation, compétences clés présentes)
- 90–100 : Excellent match (profil quasi-idéal)

Sois rigoureux. Ne surestime pas le score.`.trim();

    claudeContent.push({ type: 'text', text: matchPrompt });

    const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-sonnet-4-6',
        max_tokens: 2000,
        messages:   [{ role: 'user', content: claudeContent }],
      }),
    });

    const data = await apiRes.json();
    if (!apiRes.ok) {
      console.error('Anthropic match error:', data);
      return res.status(502).json({ error: 'Erreur API Claude lors du matching.' });
    }

    let raw = data.content[0].text.trim()
      .replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();

    let result;
    try {
      result = JSON.parse(raw);
    } catch (e) {
      console.error('JSON parse error:', e, '\nRaw:', raw);
      return res.status(502).json({ error: 'Réponse Claude invalide (JSON attendu).', raw });
    }

    res.json(result);
  } catch (err) {
    console.error('Match route error:', err);
    res.status(500).json({ error: 'Erreur serveur lors du matching.' });
  }
});

// ── Gestionnaire d'erreur global ──────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Erreur interne du serveur.' });
});

// ── Démarrage ─────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
loadDocuments().then(() => {
  app.listen(PORT, () => {
    console.log(`✓ CV Online démarré → http://localhost:${PORT}`);
    console.log(`  Environnement : ${process.env.NODE_ENV || 'development'}`);
  });
});
