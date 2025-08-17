// search/index.js - thin aggregator
const config = require('../config');
const { getWithRetry } = require('../http');
const { CrawlError } = require('../util');
const { encodeAutocompleteKey } = require('../autocomplete');
const { parseSearchHtml } = require('./parse');

const DEFAULT_HEADERS = {
  'User-Agent': config.HTTP.USER_AGENT,
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
  'Referer': 'https://www.dcinside.com/',
};

async function fetchWithRetry(url, options = {}) {
  return getWithRetry(url, { ...options, headers: { ...DEFAULT_HEADERS, ...(options.headers || {}) }, responseType: 'text' });
}

async function search(query, options = {}) {
  if (!query || typeof query !== 'string') throw new CrawlError('유효한 검색어(query)가 필요합니다', 'parse');
  const k = encodeAutocompleteKey(query);
  const sort = options && (options.sort === 'latest' || options.sort === 'accuracy') ? options.sort : undefined;
  const sortPath = sort ? `/sort/${sort}` : '';
  const url = `https://search.dcinside.com/combine${sortPath}/q/${k}`;
  const html = await fetchWithRetry(url);
  return parseSearchHtml(html, 'https://search.dcinside.com');
}

module.exports = { search, parseSearchHtml };

