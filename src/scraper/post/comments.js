// comments.js - comments scraping
const config = require('../../config');
const { delay } = require('../../util');
const { postWithRetry } = require('../../http');

const { BASE_URL } = config;
const HEADERS = { 'User-Agent': config.HTTP.USER_AGENT };

async function getCommentsForPost(no, galleryId, e_s_n_o) {
  const url = `${BASE_URL}/board/comment/`;
  let items = [];
  let page = 1;
  let totalCount = 0;
  const maxPages = config.CRAWL.MAX_COMMENT_PAGES;

  try {
    while (page <= maxPages) {
      const params = new URLSearchParams({ id: galleryId, no, cmt_id: galleryId, cmt_no: no, e_s_n_o, comment_page: String(page), _GALLTYPE_: 'M' });
      const data = await postWithRetry(url, params.toString(), {
        headers: {
          ...HEADERS,
          'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'x-requested-with': 'XMLHttpRequest',
          'Referer': `${BASE_URL}/mgallery/board/view/?id=${galleryId}&no=${no}`,
        },
      });
      const comments = data.comments || [];
      totalCount = data.total_cnt;
      const mapped = comments.map(c => ({
        parent: c.parent,
        id: c.no,
        author: { nickname: c.name, userId: c.user_id, ip: c.ip },
        regDate: c.reg_date,
        memo: c.memo,
        isDeleted: c.is_delete,
      })).filter(c => c.author.nickname !== '관리자' || c.author.ip !== '');

      items = items.concat(mapped);
      if (!comments.length || comments.length < config.CRAWL.COMMENT_PAGE_SIZE) break;
      await delay(config.CRAWL.DELAY_BETWEEN_REQUESTS);
      page++;
    }
    return { totalCount, items };
  } catch (e) {
    console.error(`댓글 수집 오류 (게시글 ${no}): ${e.message}`);
    return null;
  }
}

module.exports = { getCommentsForPost };
