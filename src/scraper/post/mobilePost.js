// mobilePost.js - mobile (m.dcinside.com) single post scraping
const cheerio = require('cheerio');
const { getWithRetry } = require('../../http');

const MOBILE_BASE_URL = 'https://m.dcinside.com';

function normalizeText(t) {
  return (t || '').replace(/\s+/g, ' ').trim();
}

function extractTextPreserveNewlines($, $container) {
  if (!$container || !$container.length) return '';
  // Convert HTML breaks to literal newlines and add line breaks after block-ish elements
  $container.find('br').replaceWith('\n');
  $container.find('p, div, li, h1, h2, h3, h4, h5, h6').each((_, el) => $(el).after('\n'));
  const raw = $container.text().replace(/\r/g, '');
  // Collapse excessive blank lines but keep intended line structure
  return raw.replace(/\n{3,}/g, '\n\n').trim();
}

function extractNumber(text, fallback = '0') {
  const m = (text || '').toString().match(/([\d,]+)/);
  return m ? m[1].replace(/,/g, '') : fallback;
}

function processImagesMobile($container, options = {}) {
  const { mode = 'replace', placeholder = 'image', includeSource = false } = options;
  const imageUrls = [];

  $container.find('img').each((i, img) => {
    const dataOriginal = img.attribs?.['data-original'] || '';
    const dataSrc = img.attribs?.['data-src'] || '';
    const src = img.attribs?.src || '';
    let imageUrl = dataOriginal || dataSrc || src;
    if (!imageUrl) return;
    if (!/^https?:\/\//i.test(imageUrl)) {
      const leadingSlash = imageUrl.startsWith('/') ? '' : '/';
      imageUrl = `${MOBILE_BASE_URL}${leadingSlash}${imageUrl}`;
    }
    imageUrls.push(imageUrl);
  });

  if (mode === 'replace' || mode === 'both') {
    $container.find('img').each((i, img) => {
      const replacement = includeSource && imageUrls[i]
        ? `[${placeholder}(${i}):"${imageUrls[i]}"]\n`
        : `[${placeholder}(${i})]\n`;
      img.tagName = 'span';
      img.attribs = {};
      img.children = [{ data: replacement, type: 'text' }];
    });
  }

  return (mode === 'extract' || mode === 'both') ? imageUrls : null;
}

/**
 * 모바일 웹(m.dcinside.com) 게시글 크롤링
 * @param {string} galleryId 
 * @param {string|number} no 
 * @param {{ extractImages?: boolean, includeImageSource?: boolean }} options
 * @returns {Promise<{
 *  postNo: string,
 *  title: string,
 *  author: string,
 *  date: string,
 *  content: string,
 *  viewCount: string,
 *  recommendCount: string,
 *  dislikeCount: string,
 *  comments: { totalCount: number, items: Array<any> },
 *  images?: string[]
 * } | null>}
 */
function parseMobilePostHtml(html, options = {}) {
  const { extractImages = true, includeImageSource = false } = options;
  const $ = cheerio.load(html);

    // Title: prefer in-page span.tit (not the comment header), fallback to og:title (left part before ' - ')
    let title = normalizeText($('span.tit').first().text());
    if (!title) {
      const ogt = $('meta[property="og:title"]').attr('content') || '';
      title = normalizeText(ogt.split(' - ')[0] || ogt);
    }
    // Remove leading category like [정보]
    title = title.replace(/^\[[^\]]+\]\s*/, '').trim();

    // Author/Date: from the first .ginfo2 list just under header
    const headerInfo = $('ul.ginfo2').first().find('li');
    const author = normalizeText(headerInfo.eq(0).text());
    const date = normalizeText(headerInfo.eq(1).text());

    // Content: main container
    const contentEl = $('.thum-txtin');
    const imgOpts = { mode: extractImages ? 'both' : 'replace', placeholder: 'image', includeSource: includeImageSource };
    const imageUrls = processImagesMobile(contentEl, imgOpts);
    const content = extractTextPreserveNewlines($, contentEl);

    // Counts
    let viewCount = '0';
    let recommendCount = '0';
    let dislikeCount = '0';

    $('ul.ginfo2 li').each((_, li) => {
      const t = $(li).text();
      if (/^\s*조회(수)?/i.test(t)) viewCount = extractNumber(t, '0');
      if (/^\s*추천/i.test(t)) recommendCount = extractNumber(t, recommendCount);
    });
    // Fallback to button counters if present
    const recommBtn = $('#recomm_btn').text();
    if (recommBtn) recommendCount = extractNumber(recommBtn, recommendCount);
    const nonRecommBtn = $('#nonrecomm_btn').text();
    if (nonRecommBtn) dislikeCount = extractNumber(nonRecommBtn, dislikeCount);

    // Comments (parsed inline from mobile HTML)
    let totalCount = 0;
    const totalHidden = $('#reple_totalCnt').attr('value');
    if (totalHidden) totalCount = parseInt(totalHidden, 10) || 0;
    const items = [];
    $('.all-comment-lst > li').each((_, li) => {
      const $li = $(li);
      const id = String($li.attr('no') || '').trim();
      const a = $li.find('a.nick').first();
      const nameRaw = normalizeText(a.text()).replace(/^글쓴\s*/, '');
      const userId = a.find('.blockCommentId').attr('data-info') || '';
      const ip = ($li.find('.ip').first().text() || '').replace(/[()]/g, '').trim();
      const regDate = normalizeText($li.find('span.date').first().text());
      const memoEl = $li.find('p.txt').first();
      memoEl.find('br').replaceWith('\n');
      const memo = memoEl.text().replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim();
      if (!id && !nameRaw && !memo) return;
      items.push({
        parent: '0',
        id,
        author: { userId, nickname: nameRaw, ip },
        regDate,
        memo,
      });
    });
    if (!totalCount) totalCount = items.length;

  return { title, author, date, content, viewCount, recommendCount, dislikeCount, comments: { totalCount, items }, images: (extractImages && imageUrls && imageUrls.length) ? imageUrls : undefined };
}

async function getMobilePostContent(galleryId = 'chatgpt', no, options = {}) {
  const { extractImages = true, includeImageSource = false } = options;
  if (no === undefined || no === null) return null;
  const postNo = String(no);
  if (!postNo) return null;

  const url = `${MOBILE_BASE_URL}/board/${encodeURIComponent(galleryId)}/${encodeURIComponent(postNo)}`;
  try {
    const MOBILE_HEADERS = {
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1 Mobile/15E148 Safari/604.1',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
      'Referer': 'https://m.dcinside.com/',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
    };
    const html = await getWithRetry(url, { responseType: 'text', headers: MOBILE_HEADERS });
    const parsed = parseMobilePostHtml(html, { extractImages, includeImageSource });
    if (!parsed) return null;
    return { postNo, ...parsed };
  } catch (e) {
    console.error(`모바일 게시글 ${no} 수집 오류: ${e.message} (URL: ${url})`);
    return null;
  }
}

module.exports = { getMobilePostContent, parseMobilePostHtml };
