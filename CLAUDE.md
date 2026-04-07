# Stremio Ktuvit Hebrew Subtitles Addon

## מה הפרויקט
תוסף קהילתי ל-Stremio שמספק כתוביות עבריות אוטומטיות מ-ktuvit.me.
שרת Express.js רץ על Render.com ועונה לבקשות כתוביות מ-Stremio.

## פרודקשן
- URL: `https://ktuvit-stremio-addon.onrender.com`
- Render service ID: `srv-d7a21g2a214c73ct44ug`
- GitHub repo: `elhananp/stremio-ktuvit-addon`
- Auto-deploy: כל push ל-main → Render מפרס אוטומטית
- Keep-alive: cron-job.org (job ID: 7459126) + GitHub Actions — פינג כל 5 דקות

## קבצים חשובים
- `index.js` — שרת Express: manifest, subtitle routes, proxy
- `ktuvit.js` — KtuvitClient: login, search, subtitle download
- `cinemeta.js` — שליפת שם סרט מ-Cinemeta לפי IMDB ID
- `.env` — לא ב-Git! מכיל KTUVIT_EMAIL + KTUVIT_HASHED_PASSWORD

## משתני סביבה נדרשים
```
KTUVIT_EMAIL=...
KTUVIT_HASHED_PASSWORD=...   # Base64(MD5(password))
PORT=7000
```
ב-Render הם מוגדרים כ-environment variables (לא בקוד).

## הרצה מקומית
```bash
npm install
npm start   # http://localhost:7000
```

## נקודות חשובות לעבודה
- Stremio שולח בקשות בפורמט: `/subtitles/movie/:id/:extra` (עם מידע על הקובץ בסוף) — הנתיב כבר מטופל
- כתוביות מוחזרות כ-UTF-8 (המרה מ-Windows-1255 דרך iconv-lite)
- Cache בזיכרון — 6 שעות TTL
- Session ktuvit.me מתחדש כל 10 שעות
- `app.set('trust proxy', 1)` — חיוני ל-HTTPS URLs מאחורי Render

## מה לא לשנות בלי סיבה
- מבנה ה-manifest (idPrefixes, resources format)
- הנתיב `/sub/:ktuvitId/:filename` — Stremio מצפה לו
- לוגיקת ה-login ב-ktuvit.js
