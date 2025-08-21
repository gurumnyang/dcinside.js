import config = require('../../config');
import { delay } from '../../util';
import { postWithRetry } from '../../http';
import type { Comments } from '../../types';

const { BASE_URL } = config as any;
const HEADERS = { 'User-Agent': (config as any).HTTP.USER_AGENT };

async function getCommentsForPost(no: string | number, galleryId: string, e_s_n_o: string): Promise<Comments | null> {
  const url = `${BASE_URL}/board/comment/`;
  let items: any[] = [];
  let page = 1;
  let totalCount = 0;
  const maxPages = (config as any).CRAWL.MAX_COMMENT_PAGES as number;

  try {
    while (page <= maxPages) {
      const params = new URLSearchParams({ id: String(galleryId), no: String(no), cmt_id: String(galleryId), cmt_no: String(no), e_s_n_o, comment_page: String(page), _GALLTYPE_: 'M' });
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
      const mapped = comments.map((c: any) => ({
        parent: c.parent,
        id: c.no,
        author: { nickname: c.name, userId: c.user_id, ip: c.ip },
        regDate: c.reg_date,
        memo: c.memo,
        isDeleted: c.is_delete,
      })).filter((c: any) => c.author.nickname !== '관리자' || c.author.ip !== '');

      items = items.concat(mapped);
      if (!comments.length || comments.length < (config as any).CRAWL.COMMENT_PAGE_SIZE) break;
      await delay((config as any).CRAWL.DELAY_BETWEEN_REQUESTS);
      page++;
    }
    return { totalCount, items } as Comments;
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error(`댓글 수집 오류 (게시글 ${no}): ${e.message}`);
    return null;
  }
}

export = { getCommentsForPost };
