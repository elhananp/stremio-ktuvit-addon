# כתוביות עברית ל-Stremio — Ktuvit Addon

תוסף קהילתי שמספק כתוביות עבריות אוטומטיות לכל סרט וסדרה ב-Stremio, מבוסס על מאגר [ktuvit.me](https://www.ktuvit.me).

---

## התקנה מהירה

לחץ על הלינק הבא בדפדפן:

```
stremio://ktuvit-stremio-addon.onrender.com/manifest.json
```

או פתח את דף ההתקנה:

```
https://ktuvit-stremio-addon.onrender.com
```

---

## איך זה עובד

```
Stremio Player
     │
     ▼
GET /subtitles/movie/{imdbId}/...json
     │
     ▼
שרת Express (Render.com)
     │
     ├─► Cinemeta API ──► שם הסרט לפי IMDB ID
     │
     ├─► ktuvit.me ──► חיפוש כתוביות לפי שם + IMDB
     │
     └─► מחזיר עד 5 כתוביות עם קישורי HTTPS
              │
              ▼
         /sub/:ktuvitId/:subId.srt
         (proxy שמוריד, ממיר UTF-8, ומחזיר)
```

---

## מבנה הפרויקט

```
stremio-ktuvit-addon/
├── index.js          # שרת Express — manifest, subtitle routes, proxy
├── ktuvit.js         # KtuvitClient — login, search, download
├── cinemeta.js       # שליפת שם סרט מ-Cinemeta API לפי IMDB ID
├── public/
│   └── index.html    # דף התקנה עם כפתור "התקן ב-Stremio"
├── .github/
│   └── workflows/
│       └── keepalive.yml  # ping כל 5 דקות למניעת spin-down
├── render.yaml       # הגדרות Render.com
├── .env              # משתני סביבה מקומיים (לא ב-Git)
└── .gitignore
```

---

## משתני סביבה

| משתנה | תיאור |
|-------|-------|
| `KTUVIT_EMAIL` | אימייל חשבון ktuvit.me השיתופי |
| `KTUVIT_HASHED_PASSWORD` | סיסמא מוצפנת (Base64 MD5) |
| `PORT` | פורט השרת (ברירת מחדל: 7000, ב-Render: 10000) |

> ⚠️ לעולם אל תעלה את קובץ `.env` ל-GitHub

---

## הרצה מקומית

```bash
# 1. התקן תלויות
npm install

# 2. צור קובץ .env
cp .env.example .env  # ומלא את הפרטים

# 3. הפעל
npm start

# 4. פתח בדפדפן
open http://localhost:7000
```

---

## API Endpoints

| Method | Path | תיאור |
|--------|------|-------|
| `GET` | `/` | דף התקנה |
| `GET` | `/manifest.json` | Stremio manifest |
| `GET` | `/subtitles/movie/:imdbId.json` | כתוביות לסרט |
| `GET` | `/subtitles/series/:imdbId::s::e.json` | כתוביות לפרק |
| `GET` | `/sub/:ktuvitId/:subId.srt` | הורדת כתובית (UTF-8) |

---

## פריסה (Render.com)

השרת רץ על [Render.com](https://render.com) בתוכנית חינמית.

- **URL ציבורי:** `https://ktuvit-stremio-addon.onrender.com`
- **Auto-deploy:** כל push ל-`main` מפרס אוטומטית
- **Keep-alive:** GitHub Actions מבצע ping כל 5 דקות

### פריסה מחדש
```bash
git push origin main  # Render מפרס אוטומטית
```

---

## פרטים טכניים

- **Session:** התחברות ל-ktuvit.me בהפעלה + חידוש כל 10 שעות
- **Cache:** תוצאות כתוביות נשמרות 6 שעות בזיכרון
- **Encoding:** כתוביות מומרות מ-Windows-1255 ל-UTF-8 אוטומטית
- **מיון:** מוצגות עד 5 כתוביות, ממוינות לפי מספר הורדות

---

## GitHub

[github.com/elhananp/stremio-ktuvit-addon](https://github.com/elhananp/stremio-ktuvit-addon)

---

## רישיון

קוד פתוח · Community Addon · ללא איסוף מידע אישי
