require('dotenv').config();

const express = require('express');
const path = require('path');
const KtuvitClient = require('./ktuvit');
const { getTitle } = require('./cinemeta');

const PORT = process.env.PORT || 7000;
const KTUVIT_EMAIL = process.env.KTUVIT_EMAIL;
const KTUVIT_HASHED_PASSWORD = process.env.KTUVIT_HASHED_PASSWORD;

if (!KTUVIT_EMAIL || !KTUVIT_HASHED_PASSWORD) {
  console.error('❌ חסר KTUVIT_EMAIL או KTUVIT_HASHED_PASSWORD ב-.env');
  process.exit(1);
}

// ─── Ktuvit client (חשבון שיתופי אחד) ───────────────────────────────────────

const ktuvit = new KtuvitClient();
let ready = false;

ktuvit.login(KTUVIT_EMAIL, KTUVIT_HASHED_PASSWORD)
  .then(() => { ready = true; console.log('✅ מחובר ל-ktuvit.me'); })
  .catch(err => { console.error('❌ Login נכשל:', err.message); process.exit(1); });

// Re-login every 10 hours (session expiry)
setInterval(async () => {
  try {
    await ktuvit.login(KTUVIT_EMAIL, KTUVIT_HASHED_PASSWORD);
    console.log('🔄 Session renewed');
  } catch (e) {
    console.error('⚠️  Session renewal failed:', e.message);
  }
}, 10 * 60 * 60 * 1000);

// ─── Manifest ─────────────────────────────────────────────────────────────────

const manifest = {
  id: 'community.ktuvit-hebrew-subtitles',
  version: '1.0.0',
  name: 'כתוביות עברית — Ktuvit',
  description: 'כתוביות עבריות אוטומטיות מ-ktuvit.me לכל סרט וסדרה',
  resources: ['subtitles'],
  types: ['movie', 'series'],
  idPrefixes: ['tt'],
  catalogs: [],
  behaviorHints: { adult: false },
};

// ─── Cache ────────────────────────────────────────────────────────────────────

const subCache = new Map();
const CACHE_TTL = 6 * 60 * 60 * 1000;

// ─── Express ──────────────────────────────────────────────────────────────────

const app = express();

app.set('trust proxy', 1); // trust Render's reverse proxy so req.protocol = 'https'

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', '*');
  next();
});

// דף הגדרות
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// Manifest
app.get('/manifest.json', (req, res) => res.json(manifest));

// Subtitles
// סרט:   /subtitles/movie/tt1234567.json
// סדרה:  /subtitles/series/tt1234567:1:1.json
app.get('/subtitles/:type/:id.json', async (req, res) => {
  if (!ready) return res.json({ subtitles: [] });

  const { type } = req.params;
  const parts = req.params.id.split(':');
  const imdbId = parts[0];
  const season  = parts[1] || null;
  const episode = parts[2] || null;

  const cacheKey = type === 'series' ? `${imdbId}:${season}:${episode}` : imdbId;
  const cached = subCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return res.json({ subtitles: cached.subtitles });
  }

  try {
    console.log(`[search] ${type} ${imdbId}${season ? ` S${season}E${episode}` : ''}`);

    const name = await getTitle(type, imdbId);
    if (!name) return res.json({ subtitles: [] });

    const ktuvitId = await ktuvit.getKtuvitID(imdbId, name);
    if (!ktuvitId) {
      console.log(`[miss] "${name}" לא נמצא ב-ktuvit`);
      return res.json({ subtitles: [] });
    }

    let subList;
    if (type === 'series' && season && episode) {
      subList = await ktuvit.getEpisodeSubtitles(ktuvitId, season, episode);
    } else {
      subList = await ktuvit.getMovieSubtitles(ktuvitId);
    }

    if (!subList.length) return res.json({ subtitles: [] });

    console.log(`[found] ${subList.length} כתוביות עבור "${name}"`);

    const base = `${req.protocol}://${req.get('host')}`;
    const subtitles = subList
      .sort((a, b) => b.downloads - a.downloads)
      .slice(0, 5)
      .map(sub => ({
        id: `ktuvit-${sub.id}`,
        url: `${base}/sub/${ktuvitId}/${sub.id}.srt`,
        lang: 'heb',
      }));

    subCache.set(cacheKey, { subtitles, ts: Date.now() });
    res.json({ subtitles });

  } catch (err) {
    console.error(`[error] ${err.message}`);
    res.json({ subtitles: [] });
  }
});

// Subtitle proxy — מוריד מ-ktuvit ומחזיר UTF-8
app.get('/sub/:ktuvitId/:filename', async (req, res) => {
  if (!ready) return res.status(503).send('Not ready');
  const { ktuvitId } = req.params;
  const subId = req.params.filename.replace('.srt', '');
  try {
    const content = await ktuvit.downloadSubtitle(ktuvitId, subId);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(content);
  } catch (err) {
    console.error(`[dl error] ${err.message}`);
    res.status(500).send('Download failed');
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log('');
  console.log('══════════════════════════════════════════════');
  console.log('  כתוביות עברית — Ktuvit Stremio Addon');
  console.log('══════════════════════════════════════════════');
  console.log(`  http://localhost:${PORT}/manifest.json`);
  console.log('══════════════════════════════════════════════');
});
