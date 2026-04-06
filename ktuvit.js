/**
 * ktuvit.js — HTTP client for ktuvit.me
 * Based on the open-source ktuvit-api by Maor Magori (MIT License)
 */

const axios = require('axios');
const cheerio = require('cheerio');
const iconv = require('iconv-lite');
const jschardet = require('jschardet');

const BASE = 'https://www.ktuvit.me';

class KtuvitClient {
  constructor() {
    this.loginCookie = null;
    // Cache: imdbId -> ktuvitId (avoids repeated searches)
    this._idCache = new Map();
  }

  // ─── Authentication ──────────────────────────────────────────────────────────

  /**
   * Login with email and hashed password.
   * Returns the session cookie value (also saves it internally).
   */
  async login(email, hashedPassword) {
    const res = await axios.post(
      `${BASE}/Services/MembershipService.svc/Login`,
      { request: { Email: email, Password: hashedPassword } },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000,
      }
    );

    const cookies = res.headers['set-cookie'] || [];
    const loginCookieHeader = cookies
      .map(c => c.split(';')[0])
      .find(c => c.startsWith('Login='));

    if (!loginCookieHeader) {
      throw new Error('Login failed — wrong email or hashed password');
    }

    this.loginCookie = loginCookieHeader.replace('Login=', '');
    return this.loginCookie;
  }

  get _headers() {
    return {
      Accept: 'application/json, text/javascript, */*; q=0.01',
      Cookie: `Login=${this.loginCookie}`,
      'Content-Type': 'application/json',
    };
  }

  // ─── Search ──────────────────────────────────────────────────────────────────

  /**
   * Find the ktuvit internal ID for a title.
   * @param {string} imdbId  e.g. 'tt1234567'
   * @param {string} name    Movie/series name in any language
   * @returns {string|null}  ktuvit ID or null if not found
   */
  async getKtuvitID(imdbId, name) {
    if (this._idCache.has(imdbId)) return this._idCache.get(imdbId);

    const res = await axios.post(
      `${BASE}/Services/ContentProvider.svc/SearchPage_search`,
      {
        request: {
          FilmName: name || '',
          Actors: [],
          Studios: null,
          Directors: [],
          Genres: [],
          Countries: [],
          Languages: [],
          Year: '',
          Rating: [],
          Page: 1,
          SearchType: '-1',
          WithSubsOnly: false,
        },
      },
      { headers: this._headers, timeout: 10000 }
    );

    const parsed = JSON.parse(res.data.d);
    const films = parsed?.Films || [];

    // Match by IMDB ID (ktuvit stores it without leading zeros sometimes)
    const match = films.find(f => f.ImdbID && imdbId.toLowerCase().includes(f.ImdbID.toLowerCase()));
    const ktuvitId = match?.ID || null;

    if (ktuvitId) this._idCache.set(imdbId, ktuvitId);
    return ktuvitId;
  }

  // ─── Subtitle Lists ──────────────────────────────────────────────────────────

  /**
   * Get list of available subtitles for a movie.
   * @param {string} ktuvitId
   * @returns {Array} [{id, name, downloads}]
   */
  async getMovieSubtitles(ktuvitId) {
    const res = await axios.get(
      `${BASE}/MovieInfo.aspx?ID=${ktuvitId}`,
      { headers: this._headers, timeout: 10000 }
    );
    return this._parseSubtitleList(res.data, true);
  }

  /**
   * Get list of available subtitles for a specific episode.
   * @param {string} ktuvitId  Series ktuvit ID
   * @param {string|number} season
   * @param {string|number} episode
   * @returns {Array} [{id, name, downloads}]
   */
  async getEpisodeSubtitles(ktuvitId, season, episode) {
    const qs = `moduleName=SubtitlesList&SeriesID=${ktuvitId}&Season=${season}&Episode=${episode}`;
    const res = await axios.get(
      `${BASE}/Services/GetModuleAjax.ashx?${qs}`,
      { headers: this._headers, timeout: 10000 }
    );
    return this._parseSubtitleList(res.data, false);
  }

  /**
   * Parse the HTML table of subtitles from a ktuvit page.
   */
  _parseSubtitleList(html, isFullPage) {
    const wrappedHtml = isFullPage
      ? html
      : `<!DOCTYPE html><table id="subtitlesList"><thead><tr/></thead>${html}</table>`;

    const $ = cheerio.load(wrappedHtml);
    const subtitles = [];

    $('#subtitlesList tr').slice(1).each((_, row) => {
      const cells = $(row).find('td');
      if (cells.length < 6) return;

      const id = $(cells[5]).find('[data-subtitle-id]').attr('data-subtitle-id');
      const name = $(cells[0]).find('div').first().clone().children('small').remove().end().text().trim();
      const downloads = parseInt($(cells[4]).text()) || 0;
      const uploadDate = $(cells[3]).text().trim();
      const credit = $(cells[0]).find('small').text().trim();

      if (id) {
        subtitles.push({ id, name, downloads, uploadDate, credit });
      }
    });

    return subtitles;
  }

  // ─── Download ────────────────────────────────────────────────────────────────

  /**
   * Download a subtitle file and return it as UTF-8 text.
   * Handles Windows-1255 / ISO-8859-8 encoding automatically.
   *
   * @param {string} ktuvitId
   * @param {string} subId
   * @returns {string} SRT content in UTF-8
   */
  async downloadSubtitle(ktuvitId, subId) {
    // Step 1: Request a download identifier (single-use token)
    const identRes = await axios.post(
      `${BASE}/Services/ContentProvider.svc/RequestSubtitleDownload`,
      {
        request: {
          FilmID: ktuvitId,
          SubtitleID: subId,
          FontSize: 0,
          FontColor: '',
          PredefinedLayout: -1,
        },
      },
      { headers: this._headers, timeout: 10000 }
    );

    const downloadIdentifier = JSON.parse(identRes.data.d)?.DownloadIdentifier;
    if (!downloadIdentifier) throw new Error('Could not get download identifier from ktuvit');

    // Step 2: Download the actual file as raw bytes
    const fileRes = await axios.get(
      `${BASE}/Services/DownloadFile.ashx?DownloadIdentifier=${downloadIdentifier}`,
      {
        headers: this._headers,
        responseType: 'arraybuffer',
        timeout: 15000,
      }
    );

    // Step 3: Detect encoding and convert to UTF-8
    const buffer = Buffer.from(fileRes.data);
    const detected = jschardet.detect(buffer);
    const encoding = detected?.encoding || 'windows-1255';

    try {
      return iconv.decode(buffer, encoding);
    } catch {
      // Fallback to Windows-1255 (most common for Hebrew subtitles)
      return iconv.decode(buffer, 'windows-1255');
    }
  }
}

module.exports = KtuvitClient;
