import * as cheerio from 'cheerio';
import { CookieJar } from 'tough-cookie';
import type { MobileDeleteCommentOptions, MobileDeleteCommentResult } from '../types';
import {
  AJAX_HEADERS,
  DELETE_COMMENT_ENDPOINT,
  HTML_HEADERS,
  WRITE_BASE_URL,
  createMobileClient,
  findBlockOrConKey,
  getWithRedirect,
  parseRedirectFromHtml,
} from '../post/mobileCommon';

// 모바일 댓글 삭제 엔드포인트를 호출해 단일 댓글을 제거한다.
export async function deleteMobileComment(
  options: MobileDeleteCommentOptions,
): Promise<MobileDeleteCommentResult> {
  const { galleryId, postId, commentId, jar: providedJar, password, userAgent } = options;
  if (!galleryId) throw new Error('galleryId는 필수입니다.');
  if (postId === undefined || postId === null) throw new Error('postId는 필수입니다.');
  if (!commentId) throw new Error('commentId는 필수입니다.');

  const jar = providedJar || new CookieJar();
  const client = createMobileClient(jar, userAgent);

  const postUrl = `${WRITE_BASE_URL}/board/${encodeURIComponent(galleryId)}/${encodeURIComponent(String(postId))}`;
  const boardReferer = `${WRITE_BASE_URL}/board/${encodeURIComponent(galleryId)}`;

  const viewRes = await getWithRedirect(client, postUrl, {
    headers: {
      ...HTML_HEADERS,
      Referer: boardReferer,
    },
    responseType: 'text',
  });

  const $ = cheerio.load(viewRes.data as string);
  const csrfToken = $('meta[name="csrf-token"]').attr('content') || '';
  if (!csrfToken) throw new Error('CSRF 토큰을 찾을 수 없습니다.');

  const accessHeaders = {
    ...AJAX_HEADERS,
    'x-csrf-token': csrfToken,
    Referer: postUrl,
  };

  const conKeyPayload = new URLSearchParams({ token_verify: 'com_submitDel' }).toString();
  const accessRes = await client.post(`${WRITE_BASE_URL}/ajax/access`, conKeyPayload, {
    headers: accessHeaders,
    validateStatus: status => status >= 200 && status < 400,
  });

  const conKey = findBlockOrConKey(accessRes.data);
  if (!conKey) throw new Error('댓글 삭제용 키(con_key)를 얻지 못했습니다.');

  const boardId = $('input[name="board_id"]').attr('value') || '';
  const bestChk = $('input[name="best_chk"]').attr('value');

  const deleteParams = new URLSearchParams({
    id: galleryId,
    no: String(postId),
    comment_no: String(commentId),
    con_key: conKey,
  });
  if (boardId) deleteParams.set('board_id', boardId);
  if (bestChk !== undefined) deleteParams.set('best_chk', bestChk || '');
  if (password) deleteParams.set('password', password);

  const deleteRes = await client.post(DELETE_COMMENT_ENDPOINT, deleteParams.toString(), {
    headers: accessHeaders,
    responseType: 'text',
    validateStatus: status => status >= 200 && status < 400,
  });

  const responseHtml = deleteRes.data as string | undefined;
  const { message } = parseRedirectFromHtml(responseHtml || '');
  const success = deleteRes.status >= 200 && deleteRes.status < 400 && (!message || /삭제되었습니다|완료/.test(message));

  return {
    success,
    message,
    finalHtml: responseHtml,
    responseStatus: deleteRes.status,
  };
}
