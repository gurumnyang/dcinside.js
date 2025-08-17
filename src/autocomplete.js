// autocomplete.js

const { CrawlError } = require('./util');
const config = require('./config');
const { getWithRetry } = require('./http');

const { USER_AGENT } = config.HTTP;

const DEFAULT_HEADERS = {
  'User-Agent': USER_AGENT,
  'Accept': '*/*',
  'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
  'Referer': 'https://www.dcinside.com/'
};

/**
 * DCInside 검색 자동완성 API용 쿼리(k) 인코딩.
 * UTF-8 바이트를 대문자 16진수로 변환하여 ".EA.B2.80" 형태로 이어붙입니다.
 * @param {string} query
 * @returns {string}
 */
function encodeAutocompleteKey(query) {
  if (typeof query !== 'string') return '';
  const bytes = Buffer.from(query, 'utf8');
  return Array.from(bytes)
    .map(b => '.' + b.toString(16).toUpperCase().padStart(2, '0'))
    .join('');
}

/**
 * jQuery JSONP callback 문자열 생성
 * @returns {{ callback: string, ts: number }}
 */
function buildJsonpCallback() {
  const ts = Date.now();
  const rand = Math.floor(Math.random() * 1e17).toString().padStart(17, '0');
  return { callback: `jQuery${rand}_${ts}`, ts };
}

/**
 * 내부: 재시도 옵션으로 GET 요청 수행
 */
async function fetchWithRetry(url, options = {}) {
  // Delegate to shared HTTP helper
  return getWithRetry(url, { ...options, headers: { ...DEFAULT_HEADERS, ...(options.headers || {}) } });
}

/**
 * DCInside 검색 자동완성(JSONP) 결과를 가져와 JSON으로 반환합니다.
 * @param {string} query - 검색어(한글 가능)
 * @returns {Promise<object>} - 자동완성 결과 객체
 */
async function getAutocomplete(query) {
  if (!query || typeof query !== 'string') {
    throw new CrawlError('유효한 검색어(query)가 필요합니다.', 'parse');
  }

  const { callback, ts } = buildJsonpCallback();
  const url = 'https://search.dcinside.com/autocomplete';

  const params = {
    callback,
    t: ts,
    k: encodeAutocompleteKey(query),
    _: ts
  };

  try {
    const data = await fetchWithRetry(url, {
      params,
      responseType: 'text'
    });

    if (typeof data !== 'string') {
      throw new CrawlError('자동완성 응답이 문자열이 아닙니다.', 'parse');
    }

    const start = data.indexOf('(');
    const end = data.lastIndexOf(')');
    if (start === -1 || end === -1 || end <= start) {
      throw new CrawlError('자동완성 JSONP 파싱 실패', 'parse', null, { snippet: data.slice(0, 120) });
    }
    const jsonText = data.slice(start + 1, end).trim();
    return JSON.parse(jsonText);
  } catch (error) {
    if (error instanceof CrawlError) throw error;
    throw new CrawlError(`자동완성 처리 중 오류: ${error.message}`, 'unknown', error);
  }
}

module.exports = {
  getAutocomplete,
  encodeAutocompleteKey
};
