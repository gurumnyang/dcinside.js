import { CookieJar } from 'tough-cookie';
import * as cheerio from 'cheerio';
import FormData from 'form-data';
import type {
  MobileCreatePostOptions,
  MobileCreatePostResult,
  MobileDeletePostOptions,
  MobileDeletePostResult,
} from '../types';
import {
  AJAX_HEADERS,
  DEFAULT_MOBILE_UA,
  HTML_HEADERS,
  WRITE_BASE_URL,
  WRITE_UPLOAD_URL,
  DELETE_POST_ENDPOINT,
  createMobileClient,
  getCookiesAsync,
  getWithRedirect,
  findBlockOrConKey,
  parseRedirectFromHtml,
} from './mobileCommon';

//CSRF 토큰 추출
function collectFormFields(html: string) {
  const $ = cheerio.load(html);
  const form = $('#writeForm');
  if (!form.length) throw new Error('글쓰기 폼을 찾을 수 없습니다.');

  const csrfToken = $('meta[name="csrf-token"]').attr('content') || '';
  const fields: Record<string, string> = {};
  form.find('input[name], textarea[name], select[name]').each((_, el) => {
    const name = $(el).attr('name');
    if (!name) return;
    if ($(el).is('textarea')) {
      fields[name] = $(el).text() || '';
    } else if ($(el).is('select')) {
      const selected = $(el).find('option:selected');
      fields[name] = selected.attr('value') ?? $(el).attr('value') ?? '';
    } else {
      fields[name] = $(el).attr('value') ?? '';
    }
  });

  return { fields, csrfToken };
}

// 비로그인 글쓰기용 닉네임/비밀번호 필드 채우기
function applyGuestFields(fields: Record<string, string>, nickname: string, password: string) {
  if ('name' in fields) fields.name = nickname;
  if ('password' in fields) fields.password = password;
  if ('gall_nickname' in fields) fields.gall_nickname = nickname;
  if ('use_gall_nickname' in fields) fields.use_gall_nickname = '0';
  if ('user_id' in fields) fields.user_id = fields.user_id || '';
}

function normaliseHeadText(value: string | number | undefined, current: string | undefined) {
  if (value === undefined || value === null) return current ?? '0';
  if (typeof value === 'number') return String(value);
  return value;
}

export async function createMobilePost(options: MobileCreatePostOptions): Promise<MobileCreatePostResult> {
  const {
    galleryId,
    subject,
    content,
    headText,
    nickname,
    password,
    useGallNickname,
    jar: providedJar,
    userAgent,
    extraFields,
  } = options;

  if (!galleryId) throw new Error('galleryId는 필수입니다.');
  if (!subject) throw new Error('subject는 필수입니다.');
  if (!content) throw new Error('content는 필수입니다.');

  const usingLogin = Boolean(providedJar);
  if (!usingLogin) {
    if (!nickname) throw new Error('비로그인 글쓰기는 nickname이 필요합니다.');
    if (!password) throw new Error('비로그인 글쓰기는 password가 필요합니다.');
  }

  const jar = providedJar || new CookieJar();
  const client = createMobileClient(jar, userAgent);

  const writeUrl = `${WRITE_BASE_URL}/write/${encodeURIComponent(galleryId)}`;
  const refererBoard = `${WRITE_BASE_URL}/board/${encodeURIComponent(galleryId)}`;

  if (usingLogin) {
    try {
      await getWithRedirect(client, refererBoard, {
        headers: {
          ...HTML_HEADERS,
          Referer: `${WRITE_BASE_URL}/`,
        },
        responseType: 'text',
      });
    } catch (err) {
      // ignore; just warming up cookies
    }
  }

  //hidden input, 토큰 추출
  const writePage = await getWithRedirect(client, writeUrl, {
    headers: {
      ...HTML_HEADERS,
      Referer: refererBoard,
    },
    responseType: 'text',
  });

  const { fields, csrfToken } = collectFormFields(writePage.data as string);
  if (!csrfToken) throw new Error('CSRF 토큰을 찾을 수 없습니다.');

  fields.id = galleryId;
  fields.route_id = fields.route_id || galleryId;
  fields.subject = subject;
  fields.memo = content;
  fields.headtext = normaliseHeadText(headText, fields.headtext);
  if (useGallNickname !== undefined && 'use_gall_nickname' in fields) {
    fields.use_gall_nickname = useGallNickname ? '1' : '0';
  }

  if (!usingLogin && nickname && password) {
    applyGuestFields(fields, nickname, password);
  } else if (usingLogin) {
    if ('password' in fields) delete fields.password;
    if ('name' in fields) delete fields.name;
    if (nickname && 'gall_nickname' in fields) fields.gall_nickname = nickname;
  }

  const honeyFieldName = Object.keys(fields).find(key => key.startsWith('honey_'));
  if (honeyFieldName) {
    fields.GEY3JWF = honeyFieldName;
  }

  if (extraFields) {
    for (const [key, value] of Object.entries(extraFields)) {
      if (value === undefined) continue;
      fields[key] = value;
    }
  }

  const resolvedNickname = nickname || fields.gall_nickname || fields.user_id || '';
  if (resolvedNickname && !usingLogin) {
    if ('gall_nickname' in fields && !fields.gall_nickname) fields.gall_nickname = resolvedNickname;
    if ('name' in fields && !fields.name) fields.name = resolvedNickname;
  }

  const ajaxHeaders = {
    ...AJAX_HEADERS,
    'x-csrf-token': csrfToken,
    Referer: writeUrl,
  };

  const accessRes = await client.post(`${WRITE_BASE_URL}/ajax/access`, new URLSearchParams({ token_verify: 'dc_check2' }).toString(), {
    headers: ajaxHeaders,
    validateStatus: status => status >= 200 && status < 400,
  });

  const accessKey = findBlockOrConKey(accessRes.data);
  if (accessKey) fields.Block_key = accessKey;

  const filterPayload = new URLSearchParams({
    subject,
    memo: content,
    id: galleryId,
    mode: 'write',
    is_mini: '0',
    is_person: '0',
  });

  const filterRes = await client.post(`${WRITE_BASE_URL}/ajax/w_filter`, filterPayload.toString(), {
    headers: ajaxHeaders,
    validateStatus: status => status >= 200 && status < 400,
  });

  const blockKey = findBlockOrConKey(filterRes.data);
  if (blockKey) fields.Block_key = blockKey;

  if (!fields.dcblock) {
    const cookiesAfterFilter = await getCookiesAsync(jar, WRITE_BASE_URL);
    const dcblockCookie = cookiesAfterFilter.find(cookie => cookie.key && cookie.key.length >= 30 && /^\w+$/.test(cookie.key));
    if (dcblockCookie) {
      fields.dcblock = dcblockCookie.value || '';
      if (!fields.Block_key) fields.Block_key = dcblockCookie.value || '';
    }
  }

  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    const val = value ?? '';
    if (key === 'files') continue;
    form.append(key, val);
  }

  // ensure files field exists even when empty
  form.append('files', Buffer.from(''), { filename: '', contentType: 'application/octet-stream' });

  const submitHeaders = {
    ...form.getHeaders(),
    ...HTML_HEADERS,
    Referer: writeUrl,
    'User-Agent': userAgent || DEFAULT_MOBILE_UA,
    'x-csrf-token': csrfToken,
    'sec-fetch-site': 'same-site',
    'sec-fetch-mode': 'navigate',
    'sec-fetch-dest': 'document',
    'sec-fetch-user': '?1',
  };

  const submitRes = await client.post(WRITE_UPLOAD_URL, form, {
    headers: submitHeaders,
    responseType: 'text',
    maxRedirects: 0,
    validateStatus: status => status >= 200 && status < 400,
  });

  const html = submitRes.data as string | undefined;
  const { url: redirectUrl, postId, message } = parseRedirectFromHtml(html);
  const success = submitRes.status >= 200 && submitRes.status < 400 && (!message || /등록되었습니다/.test(message));

  return {
    success,
    postId,
    redirectUrl,
    message,
    finalHtml: html,
    responseStatus: submitRes.status,
  };
}

// 모바일 글삭제
export async function deleteMobilePost(options: MobileDeletePostOptions): Promise<MobileDeletePostResult> {
  const { galleryId, postId, jar: providedJar, password, userAgent } = options;
  if (!galleryId) throw new Error('galleryId는 필수입니다.');
  if (postId === undefined || postId === null) throw new Error('postId는 필수입니다.');

  const jar = providedJar || new CookieJar();
  const client = createMobileClient(jar, userAgent);

  const postUrl = `${WRITE_BASE_URL}/board/${encodeURIComponent(galleryId)}/${encodeURIComponent(String(postId))}`;
  const boardReferer = `${WRITE_BASE_URL}/board/${encodeURIComponent(galleryId)}`;

  const usingLogin = Boolean(providedJar);

  if (usingLogin) {
    try {
      await getWithRedirect(client, boardReferer, {
        headers: {
          ...HTML_HEADERS,
          Referer: `${WRITE_BASE_URL}/`,
        },
        responseType: 'text',
      });
    } catch (err) {
      // ignore warm-up failure
    }
  }

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

  const accessRes = await client.post(
    `${WRITE_BASE_URL}/ajax/access`,
    new URLSearchParams({ token_verify: 'board_Del' }).toString(),
    {
      headers: accessHeaders,
      validateStatus: status => status >= 200 && status < 400,
    }
  );

  const conKey = findBlockOrConKey(accessRes.data);
  if (!conKey) throw new Error('삭제용 키(con_key)를 얻지 못했습니다.');

  const deleteParams = new URLSearchParams({
    id: galleryId,
    no: String(postId),
    con_key: conKey,
  });
  if (password) {
    deleteParams.set('password', password);
  }

  const deleteRes = await client.post(DELETE_POST_ENDPOINT, deleteParams.toString(), {
    headers: accessHeaders,
    responseType: 'text',
    validateStatus: status => status >= 200 && status < 400,
  });

  const responseHtml = deleteRes.data as string | undefined;

  let success = deleteRes.status >= 200 && deleteRes.status < 400;
  let message: string | undefined;

  if (responseHtml) {
    const trimmed = responseHtml.trim();
    if (trimmed.startsWith('{')) {
      try {
        const json = JSON.parse(trimmed);
        if (typeof json.result !== 'undefined') {
          success = Boolean(json.result);
        }
        message = json.cause || json.message || message;
      } catch (err) {
        // fall back to HTML parsing
      }
    }
    if (!message) {
      const parsed = parseRedirectFromHtml(responseHtml);
      message = parsed.message;
      if (parsed.message && !/삭제되었습니다|완료/.test(parsed.message)) {
        success = false;
      }
    }
  }

  return {
    success,
    message,
    finalHtml: responseHtml,
    responseStatus: deleteRes.status,
  };
}
