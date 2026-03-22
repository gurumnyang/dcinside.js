import { URL } from 'node:url';
import * as cheerio from 'cheerio';
import { CookieJar } from 'tough-cookie';
import type {
  MobileCreateCommentOptions,
  MobileCreateCommentResult,
  MobileDeleteCommentOptions,
  MobileDeleteCommentResult,
} from '../types';
import { CrawlError } from '../util';
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

const COMMENT_WRITE_ENDPOINT = `${WRITE_BASE_URL}/ajax/comment-write`;
const COMMENT_ACCESS_TOKEN = 'com_submit';
const COMMENT_DELETE_ACCESS_TOKEN = 'com_submitDel';


/**
 * 상대 경로 -> 절대 경로
 */
function toAbsoluteUrl(url?: string): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url, WRITE_BASE_URL).toString();
  } catch (_) {
    return url;
  }
}

function normalizeContent(value: string): string {
  return (value || '').replace(/\s+/g, ' ').trim();
}

function truncateSubject(subject: string): string {
  const normalized = normalizeContent(subject);
  return normalized.length > 40 ? normalized.slice(0, 40) : normalized;
}

/**
 * token_verify=com_submit 호출 후 임시 쿠키(cmtw_chk)를 설정
 */
function setCookieAsync(jar: CookieJar, cookie: string, url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    jar.setCookie(cookie, url, err => {
      if (err) reject(err);
      else resolve();
    });
  });
}

// ----------------------------------------------------------------------------
// 모바일 댓글 생성 로직
// -------------------------------------------------------------------------

/**
 *  1. 게시글 페이지를 받아와 CSRF Token, hidden field, capture info를 수집
 *  2. token_verify=com_submit로 /ajax/access를 호출해 con_key 획득
 *  3. 응답으로 받은 cmtw_chk 쿠키를 저장해 스팸 필터를 통과
 *  4. /ajax/comment-write에 필요한 값들을 모아 전송하고 결과를 해석
 */
export async function createMobileComment(
  options: MobileCreateCommentOptions,
): Promise<MobileCreateCommentResult> {
  const {
    galleryId,
    postId,
    content,
    jar: providedJar,
    nickname,
    password,
    userAgent,
    captchaCode,
    captchaKey,
    useGallNickname,
    proxy,
  } = options || ({} as MobileCreateCommentOptions);

  if (!galleryId) throw new Error('galleryId는 필수입니다.');
  if (postId === undefined || postId === null) throw new Error('postId는 필수입니다.');
  const memo = (content ?? '').trim();
  if (!memo) throw new Error('content는 비어 있을 수 없습니다.');

  const jar = providedJar || new CookieJar();
  const client = createMobileClient(jar, userAgent, proxy);

  const postUrl = `${WRITE_BASE_URL}/board/${encodeURIComponent(galleryId)}/${encodeURIComponent(String(postId))}`;
  const boardReferer = `${WRITE_BASE_URL}/board/${encodeURIComponent(galleryId)}`;

  // 1단계: 게시글 HTML을 불러 히든필드, CSRF, 캡차 시드 등을 확보
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

  const userId = $('#user_id').attr('value') || '';
  const isLoggedIn = Boolean(userId);

  const boardId = $('#board_id').attr('value') || '';
  const repleId = $('#reple_id').attr('value') || '';
  const bestChk = $('#best_chk').attr('value') || '';
  const commentNoField = $('#comment_no').attr('value') || '';
  const cpage = $('#cpage').attr('value') || '1';
  const gallNickname = $('#gall_nickname').attr('value');
  const defaultUseGallNickname = $('#use_gall_nickname').attr('value');
  const hideRobotName = $('.comment-write .hide-robot').attr('name') || '';
  const pageCaptchaKey = $('#rand_codeC').attr('value') || '';
  const captchaImageSrc = $('.comment-write img[src*="/captcha/"]').attr('src') || '';
  const subjectRaw = $('.gallview-tit-box .tit').first().text() || '';
  const subject = truncateSubject(subjectRaw);
  const formNickname = $('#comment_nick').attr('value') || '';
  const formPassword = $('#comment_pw').attr('value') || '';
  const normalizedUseGallNickname = typeof useGallNickname !== 'undefined'
    ? (useGallNickname ? '1' : '0')
    : (typeof defaultUseGallNickname === 'string' ? defaultUseGallNickname : '');

  // 게스트 댓글은 모바일 UI처럼 닉네임/비밀번호/캡차 요구사항을 그대로 검증
  if (!isLoggedIn) {
    const guestNickname = (nickname ?? formNickname).trim();
    if (!guestNickname) throw new Error('nickname은 게스트 댓글 작성 시 필수입니다.');
    const guestPassword = password ?? formPassword;
    if (!guestPassword) throw new Error('password는 게스트 댓글 작성 시 필수입니다.');
    if (guestPassword.length < 2) throw new Error('password는 2자 이상이어야 합니다.');
    if (/^\s/.test(guestPassword) || /\s$/.test(guestPassword)) {
      throw new Error('password의 처음과 끝에는 공백을 사용할 수 없습니다.');
    }
  }

  const resolvedCaptchaKey = captchaKey || pageCaptchaKey;
  if (resolvedCaptchaKey && !captchaCode) {
    const captchaUrl = toAbsoluteUrl(captchaImageSrc || `/captcha/code?id=${galleryId}&dccode=${resolvedCaptchaKey}&type=C`);
    throw new CrawlError('댓글 작성에는 캡차 코드가 필요합니다.', 'auth', null, {
      captchaKey: resolvedCaptchaKey,
      captchaUrl,
    });
  }

  const accessHeaders = {
    ...AJAX_HEADERS,
    'x-csrf-token': csrfToken,
    Referer: postUrl,
  };

  // 2단계: /ajax/access에서 댓글 전송용 키(con_key)를 획득
  const accessPayload = new URLSearchParams({ token_verify: COMMENT_ACCESS_TOKEN }).toString();
  const accessRes = await client.post(`${WRITE_BASE_URL}/ajax/access`, accessPayload, {
    headers: accessHeaders,
    validateStatus: status => status >= 200 && status < 400,
  });

  const conKey = findBlockOrConKey(accessRes.data);
  if (!conKey) throw new Error('댓글 작성용 키(con_key)를 얻지 못했습니다.');

  // 3단계: 브라우저가 설정하는 `cmtw_chk` 쿠키를 동일하게 기록
  try {
    await setCookieAsync(jar, `cmtw_chk=${conKey}; Max-Age=180; Path=/`, WRITE_BASE_URL);
  } catch (err) {
    // ignore cookie write failures; server may still accept the request
  }

  // 모바일 UI가 보내는 필드 구성과 동일하게 본문/숨은값/캡차/허니팟
  const params = new URLSearchParams();
  params.set('comment_memo', memo);
  params.set('mode', 'com_write');
  params.set('comment_no', commentNoField);
  const nicknameToSend = (nickname ?? formNickname).trim();
  params.set('comment_nick', nicknameToSend);
  const passwordToSend = password ?? formPassword ?? '';
  params.set('comment_pw', passwordToSend);
  params.set('id', galleryId);
  params.set('no', String(postId));
  params.set('best_chk', bestChk);
  params.set('board_id', boardId);
  params.set('reple_id', repleId);
  params.set('cpage', cpage);
  if (subject) params.set('subject', subject);
  params.set('con_key', conKey);

  const robotField = hideRobotName || 'bbcdd3';
  params.set(robotField, '1');

  if (normalizedUseGallNickname) {
    params.set('use_gall_nickname', normalizedUseGallNickname);
  }
  if (gallNickname && !nickname && normalizedUseGallNickname === '1') {
    params.set('gall_nickname', gallNickname);
  }

  if (resolvedCaptchaKey && captchaCode) {
    params.set('captcha_code', captchaCode);
    params.set('rand_code', resolvedCaptchaKey);
  }

  // 4단계: 완성된 폼 데이터를 /ajax/comment-write로 전송
  const commentRes = await client.post(COMMENT_WRITE_ENDPOINT, params.toString(), {
    headers: accessHeaders,
    responseType: 'json',
    validateStatus: status => status >= 200 && status < 400,
  });

  const responseData = commentRes.data;
  let parsed: any = responseData;
  if (typeof responseData === 'string') {
    try {
      parsed = JSON.parse(responseData);
    } catch (_) {
      parsed = { result: 0, cause: 'unexpected_response', raw: responseData };
    }
  }

  const resultValue = parsed?.result;
  const success = resultValue === 1 || resultValue === true || resultValue === '1';
  const message = typeof parsed?.cause === 'string' ? parsed.cause : undefined;
  const commentId = parsed?.comment_no || parsed?.comment_id || parsed?.commentId || parsed?.data;
  const nextCaptchaKey = typeof parsed?.ran_code === 'string' ? parsed.ran_code : undefined;
  const nextCaptchaUrl = nextCaptchaKey
    ? toAbsoluteUrl(`/captcha/code?id=${galleryId}&dccode=${nextCaptchaKey}&type=F`)
    : undefined;

  if (!success) {
    return {
      success: false,
      message: message || '댓글 등록에 실패했습니다.',
      responseStatus: commentRes.status,
      captchaKey: nextCaptchaKey,
      captchaImageUrl: nextCaptchaUrl,
      raw: typeof parsed === 'object' ? parsed : undefined,
      finalHtml: typeof responseData === 'string' ? responseData : undefined,
    };
  }

  return {
    success: true,
    message,
    commentId: commentId ? String(commentId) : undefined,
    responseStatus: commentRes.status,
    captchaKey: nextCaptchaKey,
    captchaImageUrl: nextCaptchaUrl,
    raw: typeof parsed === 'object' ? parsed : undefined,
  };
}

// 모바일 댓글 삭제 엔드포인트를 호출해 단일 댓글을 제거한다.
export async function deleteMobileComment(
  options: MobileDeleteCommentOptions,
): Promise<MobileDeleteCommentResult> {
  const { galleryId, postId, commentId, jar: providedJar, password, userAgent, proxy } = options;
  if (!galleryId) throw new Error('galleryId는 필수입니다.');
  if (postId === undefined || postId === null) throw new Error('postId는 필수입니다.');
  if (!commentId) throw new Error('commentId는 필수입니다.');

  const jar = providedJar || new CookieJar();
  const client = createMobileClient(jar, userAgent, proxy);

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

  const conKeyPayload = new URLSearchParams({ token_verify: COMMENT_DELETE_ACCESS_TOKEN }).toString();
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
