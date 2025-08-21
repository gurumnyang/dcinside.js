import * as cheerio from 'cheerio';
import config = require('../../config');
import { getWithRetry } from '../../http';
const { extractText, processImages } = require('./html');
const { getCommentsForPost } = require('./comments');
import type { Post } from '../../types';

const { BASE_URL } = config as any;

async function getPostContent(galleryId: string = 'chatgpt', no: string | number, options: { extractImages?: boolean; includeImageSource?: boolean } = {}): Promise<Post | null> {
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
      return null;
    }
    const imgOpts = { mode: extractImages ? 'both' as const : 'replace' as const, placeholder: 'image', includeSource: includeImageSource };
    const imageUrls = processImages(contentEl, imgOpts) || undefined;

    contentEl.find('br').replaceWith('\n');
    contentEl.find('p, div, li').each((_, el) => $(el).after('\n'));
    const content = contentEl.text().trim();

    const viewCount = extractText($, 'header .gall_count').replace('조회', '') || 'null';
    const recommendCount = extractText($, '.btn_recommend_box .up_num_box .up_num', 'null');
    const dislikeCount = extractText($, '.btn_recommend_box .down_num_box .down_num', 'null');

    const comments = await getCommentsForPost(no, galleryId, String(e_s_n_o));

    const result: Post = { postNo, title, author, date, content, viewCount, recommendCount, dislikeCount, comments: comments || { totalCount: 0, items: [] } };
    if (extractImages && imageUrls && imageUrls.length) (result as any).images = imageUrls;
    return result;
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error(`게시글 ${no} 수집 오류: ${e.message} (URL: ${url})`);
    return null;
  }
}

export = { getPostContent };
