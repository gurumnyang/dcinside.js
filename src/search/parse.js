// parse.js - HTML parser for combine search
const cheerio = require('cheerio');
const { CrawlError } = require('../util');

function parseSearchHtml(html, baseUrl = 'https://search.dcinside.com') {
  if (typeof html !== 'string' || !html.trim()) {
    throw new CrawlError('검색 응답이 비어있습니다.', 'parse');
  }

  const $ = cheerio.load(html);
  const query = $('input.in_keyword').attr('value') || undefined;

  const galleries = [];
  const seenGalleryLinks = new Set();
  const gallContainerSelector = 'li, .result, .sch_result, .box_result, tr, .wrap_result, .gall_result, .result_item';
  const gallAnchorSelector = 'a[href*="/board/lists/?id="], a[href*="/mgallery/board/lists/?id="], a[href*="/mini/board/lists/?id="]';

  $(gallContainerSelector).each((_, el) => {
    const container = $(el);
    const anchors = container.find(gallAnchorSelector);
    if (!anchors.length) return;
    let a = anchors.filter((_, x) => $(x).text().trim().length > 0).first();
    if (!a.length) a = anchors.first();
    const link = a.attr('href');
    if (!link || seenGalleryLinks.has(link)) return;

    let name = a.text().trim();
    if (!name) name = container.find('.tit, .title, .name, strong, a').first().text().trim();

    let id, type, galleryType;
    try {
      const u = new URL(link, baseUrl);
      id = u.searchParams.get('id') || undefined;
      if (u.pathname.includes('/mgallery/')) type = 'mgallery';
      else if (u.pathname.includes('/mini/')) type = 'mini';
      else if (u.pathname.includes('/person/')) type = 'person';
      else type = 'board';
      galleryType = type === 'board' ? 'main' : type;
    } catch (_) {}

    const rankEl = container.find('.rank, [class*="rank"]').first();
    const toNum = (t) => { const s = (t || '').replace(/[^\d]/g, ''); return s ? Number(s) : undefined; };
    const rank = rankEl.length ? toNum(rankEl.text()) : undefined;
    const fullText = container.text().replace(/\s+/g, ' ').trim();
    let new_post, total_post;
    const m = fullText.match(/\s*글\s*([\d,]+)\s*\/\s*([\d,]+)/);
    if (m) { new_post = Number(m[1].replace(/,/g, '')); total_post = Number(m[2].replace(/,/g, '')); }

    galleries.push({ name, id, type, galleryType, link, rank, new_post, total_post });
    seenGalleryLinks.add(link);
  });

  const posts = [];
  const seenLinks = new Set();
  const containerSelector = '.sch_result li';

  $(containerSelector).each((_, el) => {
    const container = $(el);
    const anchors = container.find('a[href*="/board/view/?id="]');
    if (!anchors.length) return;
    let a = container.find('a.tit_txt[href*="/board/view/?id="]').first();
    if (!a.length) a = anchors.filter((_, x) => { const t = $(x).text().trim(); return t && !/갤러리/.test(t); }).first();
    if (!a.length) a = anchors.first();

    const link = a.attr('href');
    if (!link || seenLinks.has(link)) return;
    let title = a.text().trim();
    if (!title) title = container.find('.tit, .title, strong, a').first().text().trim();

    let content = container.find('p.link_dsc_txt:not(.dsc_sub)').first().text().replace(/\s+/g, ' ').trim();
    if (!content) {
      const noiseRe = /(최신|정확|검색|공식)/;
      const arr = [];
      container.find('.desc, .txt, .cont, p').each((_, x) => {
        const t = $(x).text().replace(/\s+/g, ' ').trim(); if (t && t.length >= 8 && !noiseRe.test(t)) arr.push(t);
      });
      if (arr.length) { arr.sort((a, b) => b.length - a.length); content = arr[0]; }
    }

    let date = '';
    const ds = container.find('span.date_time').first().text().trim();
    const ct = container.text().replace(/\s+/g, ' ');
    const dm = ds || ct.match(/(\d{4}|\d{2})[./-](\d{1,2})[./-](\d{1,2})(?:\s+(\d{1,2}:\d{2}(?::\d{2})?))?/);
    if (dm) date = typeof dm === 'string' ? dm : dm[0];

    let galleryId, galleryName, galleryType;
    try {
      const u = new URL(link, baseUrl);
      galleryId = u.searchParams.get('id') || undefined;
      if (u.pathname.includes('/mgallery/')) galleryType = 'mgallery';
      else if (u.pathname.includes('/mini/')) galleryType = 'mini';
      else if (u.pathname.includes('/person/')) galleryType = 'person';
      else galleryType = 'main';
    } catch (_) {}

    const nameFromSub = container.find('p.link_dsc_txt.dsc_sub a.sub_txt').first().text().trim();
    const nameFromCate = !nameFromSub ? container.find('.gall, .board, .name, .cate a, .cate, .category').first().text().trim() : '';
    const nameFromSuffix = !nameFromSub ? container.find('*').filter((_, x) => /갤러리/.test($(x).text().trim())).first().text().trim() : '';
    galleryName = nameFromSub || nameFromCate || nameFromSuffix || undefined;

    posts.push({ title, content, galleryName, galleryId, galleryType, date, link });
    seenLinks.add(link);
  });

  return { query, galleries, posts };
}

module.exports = { parseSearchHtml };

