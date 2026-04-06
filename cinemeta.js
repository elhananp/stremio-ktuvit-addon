/**
 * cinemeta.js — Fetch movie/series title by IMDB ID
 * Uses Stremio's free Cinemeta API (no key needed)
 */

const axios = require('axios');

const _cache = new Map();

/**
 * @param {'movie'|'series'} type
 * @param {string} imdbId  e.g. 'tt1234567'
 * @returns {string|null}  Title name or null
 */
async function getTitle(type, imdbId) {
  const key = `${type}:${imdbId}`;
  if (_cache.has(key)) return _cache.get(key);

  try {
    const res = await axios.get(
      `https://v3-cinemeta.strem.io/meta/${type}/${imdbId}.json`,
      { timeout: 8000 }
    );
    const name = res.data?.meta?.name || null;
    if (name) _cache.set(key, name);
    return name;
  } catch {
    return null;
  }
}

module.exports = { getTitle };
