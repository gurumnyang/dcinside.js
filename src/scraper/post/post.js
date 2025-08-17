// post.js - single post scraping
const cheerio = require('cheerio');
const config = require('../../config');
const { getWithRetry } = require('../../http');
const { extractText, processImages } = require('./html');
const { getCommentsForPost } = require('./comments');

const { BASE_URL } = config;

async function getPostContent(galleryId = 'chatgpt', no, options = {}) {
  const { extractImages = true, includeImageSource = false } = options;
  if (no === undefined || no === null) return null;
  const postNo = String(no);
  if (!postNo) return null;

  const url = `${BASE_URL}/mgallery/board/view/?id=${galleryId}&no=${postNo}`;
  try {
    const html = await getWithRetry(url);
    const $ = cheerio.load(html);
    const title = extractText($, 'header .title_subject');
    const author = extractText($, 'header .gall_writer .nickname');
    const date = extractText($, 'header .gall_date');

    const contentEl = $('.gallview_contents .write_div');
    const e_s_n_o = $('input[name="e_s_n_o"]').val() || '';
    if (!title && !contentEl.length && !e_s_n_o) {
      // 비정상 페이지(삭제/부존재 등)로 판단
      return null;
    }
    const imgOpts = { mode: extractImages ? 'both' : 'replace', placeholder: 'image', includeSource: includeImageSource };
    const imageUrls = processImages(contentEl, imgOpts);

    contentEl.find('br').replaceWith('\n');
    contentEl.find('p, div, li').each((_, el) => $(el).after('\n'));
    const content = contentEl.text().trim();

    const viewCount = extractText($, 'header .gall_count').replace('조회', '') || 'null';
    const recommendCount = extractText($, '.btn_recommend_box .up_num_box .up_num', 'null');
    const dislikeCount = extractText($, '.btn_recommend_box .down_num_box .down_num', 'null');

    const comments = await getCommentsForPost(no, galleryId, e_s_n_o);

    const result = { postNo, title, author, date, content, viewCount, recommendCount, dislikeCount, comments };
    if (extractImages && imageUrls && imageUrls.length) result.images = imageUrls;
    return result;
  } catch (e) {
    console.error(`게시글 ${no} 수집 오류: ${e.message} (URL: ${url})`);
    return null;
  }
}

module.exports = { getPostContent };
