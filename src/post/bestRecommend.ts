import { CookieJar } from 'tough-cookie';
import * as cheerio from 'cheerio';
import type { BestRecommendOptions, BestRecommendResult } from '../types';
import {
  AJAX_HEADERS,
  HTML_HEADERS,
  WRITE_BASE_URL,
  createMobileClient,
  getWithRedirect,
} from './mobileCommon';

const RECOMMEND_ENDPOINT = `${WRITE_BASE_URL}/bestcontent/recommend`;

export async function recommendBestPost(options: BestRecommendOptions): Promise<BestRecommendResult> {
  const { galleryId, postId, jar: providedJar, userAgent, proxy } = options || {};
  if (!galleryId) throw new Error('galleryId는 필수입니다.');
  if (postId === undefined || postId === null) throw new Error('postId는 필수입니다.');

  const jar = providedJar || new CookieJar();
  const client = createMobileClient(jar, userAgent, proxy);

  const encodedGalleryId = encodeURIComponent(galleryId);
  const encodedPostId = encodeURIComponent(String(postId));

  const postUrl = `${WRITE_BASE_URL}/board/${encodedGalleryId}/${encodedPostId}`;
  const boardReferer = `${WRITE_BASE_URL}/board/${encodedGalleryId}`;

  const viewRes = await getWithRedirect(client, postUrl, {
    headers: {
      ...HTML_HEADERS,
      Referer: boardReferer,
    },
    responseType: 'text',
  });

  const html = viewRes.data as string;
  const $ = cheerio.load(html);
  const csrfToken = $('meta[name="csrf-token"]').attr('content') || '';
  if (!csrfToken) throw new Error('CSRF 토큰을 찾을 수 없습니다.');

  const payload = new URLSearchParams({
    id: galleryId,
    no: String(postId),
  });

  const headers = {
    ...AJAX_HEADERS,
    Origin: WRITE_BASE_URL,
    Referer: postUrl,
    'x-csrf-token': csrfToken,
  };

  const response = await client.post(RECOMMEND_ENDPOINT, payload.toString(), {
    headers,
    responseType: 'json',
    validateStatus: status => status >= 200 && status < 400,
  });

  let data: any = response.data;
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch (_) {
      data = { result: false, cause: data };
    }
  }

  const resultValue = data?.result;
  const success = resultValue === true || resultValue === 1 || resultValue === '1';
  const message = typeof data?.cause === 'string' ? data.cause : undefined;

  return {
    success,
    message,
    responseStatus: response.status,
    raw: typeof data === 'object' ? data : undefined,
  };
}
