import * as cheerio from 'cheerio';
import { getWithRetry } from '../../http';

const MOBILE_BASE_URL = 'https://m.dcinside.com';

function normalizeText(t: string): string {
  return (t || '').replace(/\s+/g, ' ').trim();
}

function extractTextPreserveNewlines($: any, $container: cheerio.Cheerio): string {
  if (!$container || !$container.length) return '';
  $container.find('br').replaceWith('\n');
  $container.find('p, div, li, h1, h2, h3, h4, h5, h6').each((_, el) => $(el).after('\n'));
  const raw = $container.text().replace(/\r/g, '');
  return raw.replace(/\n{3,}/g, '\n\n').trim();
}

function extractNumber(text: string, fallback: string = '0'): string {
  const m = (text || '').toString().match(/([\d,]+)/);
  return m ? m[1].replace(/,/g, '') : fallback;
}

function processImagesMobile($container: cheerio.Cheerio, options: { mode?: 'replace'|'extract'|'both', placeholder?: string, includeSource?: boolean } = {}) {
  const { mode = 'replace', placeholder = 'image', includeSource = false } = options;
  const imageUrls: string[] = [];

  $container.find('img').each((i, img) => {
    const attribs = (img as any).attribs || {};
    const dataOriginal = attribs['data-original'] || '';
    const dataSrc = attribs['data-src'] || '';
    const src = attribs['src'] || '';
    let imageUrl = (dataOriginal || dataSrc || src) as string;
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
      (img as any).tagName = 'span';
      (img as any).attribs = {};
      (img as any).children = [{ data: replacement, type: 'text' }];
    });
  }

  return (mode === 'extract' || mode === 'both') ? imageUrls : null;
}

function parseMobilePostHtml(html: string, options: { extractImages?: boolean, includeImageSource?: boolean } = {}) {
  const { extractImages = true, includeImageSource = false } = options;
  const $ = cheerio.load(html);

  let title = normalizeText($('span.tit').first().text());
  if (!title) {
    const ogt = $('meta[property="og:title"]').attr('content') || '';
    title = normalizeText(ogt.split(' - ')[0] || ogt);
  }
  title = title.replace(/^\[[^\]]+\]\s*/, '').trim();

  const headerInfo = $('ul.ginfo2').first().find('li');
  const author = normalizeText(headerInfo.eq(0).text());
  const date = normalizeText(headerInfo.eq(1).text());

  const contentEl = $('.thum-txtin');
  const imgOpts = { mode: extractImages ? 'both' as const : 'replace' as const, placeholder: 'image', includeSource: includeImageSource };
  const imageUrls = processImagesMobile(contentEl, imgOpts) || undefined;
  const content = extractTextPreserveNewlines($, contentEl);

  let viewCount = '0';
  let recommendCount = '0';
  let dislikeCount = '0';

  $('ul.ginfo2 li').each((_, li) => {
    const t = $(li).text();
    if (/^\s*조회(수)?/i.test(t)) viewCount = extractNumber(t, '0');
    if (/^\s*추천/i.test(t)) recommendCount = extractNumber(t, recommendCount);
  });
  const recommBtn = $('#recomm_btn').text();
  if (recommBtn) recommendCount = extractNumber(recommBtn, recommendCount);
  const nonRecommBtn = $('#nonrecomm_btn').text();
  if (nonRecommBtn) dislikeCount = extractNumber(nonRecommBtn, dislikeCount);

  let totalCount = 0;
  const totalHidden = $('#reple_totalCnt').attr('value');
  if (totalHidden) totalCount = parseInt(totalHidden, 10) || 0;
  const items: any[] = [];
  let currentParentId = '0';

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
    const klass = $li.attr('class') || '';
    const isReply = /\bcomment-add\b/.test(klass);
    const parent = isReply ? (currentParentId || '0') : '0';
    if (!isReply) currentParentId = id || currentParentId;
    items.push({
      parent,
      id,
      author: { userId, nickname: nameRaw, ip },
      regDate,
      memo,
    });
  });
  if (!totalCount) totalCount = items.length;

  return { title, author, date, content, viewCount, recommendCount, dislikeCount, comments: { totalCount, items }, images: (extractImages && imageUrls && imageUrls.length) ? imageUrls : undefined };
}

async function getMobilePostContent(galleryId: string = 'chatgpt', no: string | number, options: { extractImages?: boolean, includeImageSource?: boolean, retryCount?: number } = {}) {
  const { extractImages = true, includeImageSource = false, retryCount } = options;
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
    const html = await getWithRetry(url, { responseType: 'text', headers: MOBILE_HEADERS, retryCount } as any);
    const parsed = parseMobilePostHtml(html, { extractImages, includeImageSource });
    if (!parsed) return null;
    return { postNo, ...parsed };
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error(`모바일 게시글 ${no} 수집 오류: ${e.message} (URL: ${url})`);
    return null;
  }
}

export = { getMobilePostContent, parseMobilePostHtml };
