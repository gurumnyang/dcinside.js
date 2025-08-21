import { CrawlError } from './util';
import config = require('./config');
import { getWithRetry } from './http';

const { USER_AGENT } = config.HTTP;

const DEFAULT_HEADERS = {
  'User-Agent': USER_AGENT,
  'Accept': '*/*',
  'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
  'Referer': 'https://www.dcinside.com/'
};

function encodeAutocompleteKey(query: string): string {
  if (typeof query !== 'string') return '';
  const bytes = Buffer.from(query, 'utf8');
  return Array.from(bytes)
    .map(b => '.' + b.toString(16).toUpperCase().padStart(2, '0'))
    .join('');
}

function buildJsonpCallback(): { callback: string, ts: number } {
  const ts = Date.now();
  const rand = Math.floor(Math.random() * 1e17).toString().padStart(17, '0');
  return { callback: `jQuery${rand}_${ts}`, ts };
}

async function fetchWithRetry(url: string, options: any = {}) {
  return getWithRetry(url, { ...options, headers: { ...DEFAULT_HEADERS, ...(options.headers || {}) } });
}

async function getAutocomplete(query: string): Promise<any> {
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
  } catch (error: any) {
    if (error instanceof CrawlError) throw error;
    throw new CrawlError(`자동완성 처리 중 오류: ${error.message}`, 'unknown', error);
  }
}

export = { getAutocomplete, encodeAutocompleteKey };
