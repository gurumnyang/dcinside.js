// search.js - DCInside 통합검색 리버스 및 파싱

const axios = require('axios');
const cheerio = require('cheerio');
const { withRetry, CrawlError } = require('./util');
const { encodeAutocompleteKey } = require('./autocomplete');
const config = require('./config');

const { USER_AGENT, TIMEOUT, RETRY_ATTEMPTS, RETRY_DELAY } = config.HTTP;

const DEFAULT_HEADERS = {
  'User-Agent': USER_AGENT,
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
  'Referer': 'https://www.dcinside.com/'
};

const axiosInstance = axios.create({
  timeout: TIMEOUT,
  headers: DEFAULT_HEADERS
});

/**
 * 내부: 재시도 옵션으로 GET 요청 수행
 */
async function fetchWithRetry(url, options = {}) {
  const retryOptions = {
    maxRetries: RETRY_ATTEMPTS,
    delayMs: RETRY_DELAY,
    exponentialBackoff: true
  };

  return withRetry(async () => {
    const response = await axiosInstance.get(url, { ...options, responseType: 'text' });
    return response.data;
  }, retryOptions);
}

/**
 * DCInside 통합검색 HTML을 파싱하여 결과를 구조화합니다.
 * 최대한 보편적인 셀렉터/휴리스틱으로 게시글과 갤러리 정보를 추출합니다.
 * @param {string} html
 * @param {string} baseUrl
 * @returns {{ query?: string, gallery?: object, posts: Array<object> }}
 */
function parseSearchHtml(html, baseUrl = 'https://search.dcinside.com') {
  if (typeof html !== 'string' || !html.trim()) {
    throw new CrawlError('검색 응답이 비어있습니다.', 'parse');
  }

  const $ = cheerio.load(html);

  // 페이지 상단 검색 인풋에서 현재 쿼리 추출 시도
  let query = $('input.in_keyword').attr('value') || undefined;

  // 갤러리 결과 파싱: lists 링크를 가진 앵커를 기준으로 컨테이너에서 정보 추출
  const galleries = [];
  const seenGalleryLinks = new Set();
  const gallContainerSelector = 'li, .result, .sch_result, .box_result, tr, .wrap_result, .gall_result, .result_item';
  const gallAnchorSelector = 'a[href*="/board/lists/?id="], a[href*="/mgallery/board/lists/?id="], a[href*="/mini/board/lists/?id="]';

  $(gallContainerSelector).each((_, el) => {
    const container = $(el);
    const anchors = container.find(gallAnchorSelector);
    if (!anchors.length) return;

    // 이름 텍스트가 있는 앵커 우선
    let a = anchors.filter((_, x) => $(x).text().trim().length > 0).first();
    if (!a.length) a = anchors.first();
    const link = a.attr('href');
    if (!link || seenGalleryLinks.has(link)) return;

    let name = a.text().trim();
    if (!name) {
      const nameCand = container.find('.tit, .title, .name, strong, a').first().text().trim();
      if (nameCand) name = nameCand;
    }

    // 갤러리 id/type 파싱 및 갤러리 구분 추가
    let id, type, galleryType;
    try {
      const u = new URL(link, baseUrl);
      id = u.searchParams.get('id') || undefined;
      if (u.pathname.includes('/mgallery/')) type = 'mgallery';
      else if (u.pathname.includes('/mini/')) type = 'mini';
      else if (u.pathname.includes('/person/')) type = 'person';
      else type = 'board';
      galleryType = type === 'board' ? 'main' : type; // main | mgallery | mini | person
    } catch (_) {}

    // 부가 정보: 숫자(랭크/새글/전체글)

    const rankEl = container.find('.rank, [class*="rank"]').first();
    const toNum = (t) => {
      const s = (t || '').replace(/[^\d]/g, '');
      return s ? Number(s) : undefined;
    };
    let rank = rankEl.length ? toNum(rankEl.text()) : undefined; // 순위가 없으면 비워둠

    // 일간/총 게시글: '새글 {일간}/{총}' 패턴을 정규식으로 단순 파싱
    const fullText = container.text().replace(/\s+/g, ' ').trim();
    let new_post, total_post;
    const m = fullText.match(/새\s*글\s*([\d,]+)\s*\/\s*([\d,]+)/);
    if (m) {
      new_post = Number(m[1].replace(/,/g, ''));
      total_post = Number(m[2].replace(/,/g, ''));
    }

    galleries.push({ name, id, type, galleryType, link, rank, new_post, total_post });
    seenGalleryLinks.add(link);
  });

  // 게시글 리스트 파싱: 컨테이너 단위로 처리하여 중복 제거
  const posts = [];
  const seenLinks = new Set();
  const containerSelector = '.sch_result li';

  $(containerSelector).each((idx, el) => {
    try {
      const container = $(el);
      const anchors = container.find('a[href*="/board/view/?id="]');
      if (!anchors.length) return;

      // 우선순위: a.tit_txt(검색 결과 제목) → 일반 앵커(갤러리 링크 제외)
      let a = container.find('a.tit_txt[href*="/board/view/?id="]').first();
      if (!a.length) {
        a = anchors.filter((_, x) => {
          const t = $(x).text().trim();
          return t && !/갤러리$/.test(t);
        }).first();
      }
      if (!a.length) {
        // 2) 그 외 첫 번째 앵커 사용
        a = anchors.first();
      }

      const link = a.attr('href');
      if (!link) return;
      if (seenLinks.has(link)) return; // 중복 제거

      let title = a.text().trim();
      if (!title) {
        // fallback: 제목 후보 찾기
        title = container.find('.tit, .title, strong, a').first().text().trim();
      }

      // 본문 요약: p.link_dsc_txt(부제 제외) 우선
      let content = '';
      const primaryDesc = container.find('p.link_dsc_txt:not(.dsc_sub)').first().text().replace(/\s+/g, ' ').trim();
      if (primaryDesc) {
        content = primaryDesc;
      } else {
        // 보편 후보(노이즈 제거)
        const noiseRe = /(최신순|정렬|검색|결과|공지)/;
        const contentCandidates = [];
        container.find('.desc, .txt, .cont, p').each((_, x) => {
          const t = $(x).text().replace(/\s+/g, ' ').trim();
          if (t && t.length >= 8 && !noiseRe.test(t)) contentCandidates.push(t);
        });
        if (contentCandidates.length) {
          contentCandidates.sort((a, b) => b.length - a.length);
          content = contentCandidates[0];
        }
      }

      // 날짜 후보: YYYY.MM.DD 패턴
      let date = '';
      const dateFromSpan = container.find('span.date_time').first().text().trim();
      const containerText = container.text().replace(/\s+/g, ' ');
      const dateMatch = dateFromSpan || containerText.match(/(\d{4}|\d{2})[./-](\d{1,2})[./-](\d{1,2})(?:\s+(\d{1,2}:\d{2}(?::\d{2})?))?/);
      if (dateMatch) {
        date = typeof dateMatch === 'string' ? dateMatch : dateMatch[0];
      }

      // 갤러리 ID/이름/구분
      let galleryId, galleryName, galleryType;
      try {
        const urlObj = new URL(link, baseUrl);
        galleryId = urlObj.searchParams.get('id') || undefined;
        if (urlObj.pathname.includes('/mgallery/')) galleryType = 'mgallery';
        else if (urlObj.pathname.includes('/mini/')) galleryType = 'mini';
        else if (urlObj.pathname.includes('/person/')) galleryType = 'person';
        else galleryType = 'main';
      } catch (_) { /* noop */ }

      // 갤러리명: p.link_dsc_txt.dsc_sub a.sub_txt 우선
      const nameFromSub = container.find('p.link_dsc_txt.dsc_sub a.sub_txt').first().text().trim();
      const nameFromSuffix = !nameFromSub ? container.find('*').filter((_, x) => /갤러리$/.test($(x).text().trim())).first().text().trim() : '';
      const nameFromCate = !nameFromSub ? container.find('.gall, .board, .name, .cate a, .cate, .category').first().text().trim() : '';
      galleryName = nameFromSub || nameFromCate || nameFromSuffix || undefined;

      posts.push({ title, content, galleryName, galleryId, galleryType, date, link });
      seenLinks.add(link);
    } catch (e) {
      // 개별 항목 실패는 무시
    }
  });

  return { query, galleries, posts };
}

/**
 * 통합검색을 수행하고 파싱된 결과를 반환합니다.
 * @param {string} query 검색어(한글 가능)
 * @param {{ sort?: 'latest' | 'accuracy' }} [options] 정렬 옵션
 * @returns {Promise<{ query?: string, gallery?: object, posts: Array<object> }>} 결과
 */
async function search(query, options = {}) {
  if (!query || typeof query !== 'string') {
    throw new CrawlError('유효한 검색어(query)가 필요합니다.', 'parse');
  }

  const k = encodeAutocompleteKey(query);
  const sort = options && (options.sort === 'latest' || options.sort === 'accuracy')
    ? options.sort
    : undefined;

  const sortPath = sort ? `/sort/${sort}` : '';
  const url = `https://search.dcinside.com/combine${sortPath}/q/${k}`;

  const html = await fetchWithRetry(url);
  return parseSearchHtml(html, 'https://search.dcinside.com');
}

module.exports = {
  search,
  parseSearchHtml
};
