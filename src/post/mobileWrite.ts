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
  IMAGE_UPLOAD_URL,
  DELETE_POST_ENDPOINT,
  createMobileClient,
  getCookiesAsync,
  getWithRedirect,
  findBlockOrConKey,
  parseRedirectFromHtml,
} from './mobileCommon';

function imageHostForGallery(galleryId: string) {
  const first = String(galleryId || '').replace(/^mi\$/, '').replace(/^pr\$/, '').charAt(0);
  if (/^[0-9a-f]$/i.test(first)) return 'https://dcimg6.dcinside.co.kr';
  if (/^[g-m]$/i.test(first)) return 'https://dcimg7.dcinside.co.kr';
  return 'https://dcimg8.dcinside.co.kr';
}

async function uploadPostImages({ client, galleryId, images, csrfToken, writeUrl, userAgent }: {
  client: ReturnType<typeof createMobileClient>;
  galleryId: string;
  images: NonNullable<MobileCreatePostOptions['images']>;
  csrfToken: string;
  writeUrl: string;
  userAgent?: string;
}) {
  if (!images.length) return [];
  const ajaxHeaders = {
    ...AJAX_HEADERS,
    'x-csrf-token': csrfToken,
    Referer: writeUrl,
  };
  const permissionRes = await client.post(
    `${WRITE_BASE_URL}/ajax/i_filter`,
    new URLSearchParams({ id: galleryId }).toString(),
    { headers: ajaxHeaders, validateStatus: status => status >= 200 && status < 400 },
  );
  if (permissionRes.data?.result === false) {
    throw new Error(permissionRes.data?.cause || permissionRes.data?.msg || '이미지 업로드가 거부되었습니다.');
  }

  const uploadForm = new FormData();
  uploadForm.append('id', galleryId);
  for (const image of images) {
    uploadForm.append('upload[]', image.data, {
      filename: image.filename,
      contentType: image.contentType,
      knownLength: image.data.length,
    });
  }
  const uploadRes = await client.post(IMAGE_UPLOAD_URL, uploadForm, {
    headers: {
      ...uploadForm.getHeaders(),
      Accept: 'application/json, text/javascript, */*; q=0.01',
      Origin: WRITE_BASE_URL,
      Referer: writeUrl,
      'User-Agent': userAgent || DEFAULT_MOBILE_UA,
    },
    responseType: 'json',
    maxRedirects: 0,
    validateStatus: status => status >= 200 && status < 400,
  });
  const payload = typeof uploadRes.data === 'string' ? JSON.parse(uploadRes.data) : uploadRes.data;
  const thumbs = Array.isArray(payload?.thumb) ? payload.thumb : [];
  if (payload?.result !== true || thumbs.length !== images.length) {
    throw new Error(payload?.msg || `이미지 업로드 결과가 올바르지 않습니다. (${thumbs.length}/${images.length})`);
  }
  const host = imageHostForGallery(galleryId);
  return thumbs.map((thumb: unknown) => `${host}/viewimageM.php?no=${encodeURIComponent(String(thumb))}`);
}

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

async function findCreatedPostId(
  client: ReturnType<typeof createMobileClient>,
  galleryId: string,
  subject: string,
  expectedUserId?: string,
) {
  const boardUrl = `${WRITE_BASE_URL}/board/${encodeURIComponent(galleryId)}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise(resolve => setTimeout(resolve, 250));
    const response = await getWithRedirect(client, boardUrl, {
      headers: { ...HTML_HEADERS, Referer: `${WRITE_BASE_URL}/write/${encodeURIComponent(galleryId)}` },
      responseType: 'text',
    });
    const $ = cheerio.load(response.data as string);
    let matchedId: string | undefined;
    $('ul.gall-detail-lst > li').each((_, element) => {
      if (matchedId) return;
      const item = $(element);
      if (item.find('.subjectin').first().text().trim() !== subject.trim()) return;
      const authorId = String(item.find('.blockInfo').first().attr('data-info') || '').trim();
      if (expectedUserId && authorId && authorId !== expectedUserId) return;
      const href = item.find('a.lt').first().attr('href') || '';
      const match = href.match(/\/board\/[^/?#]+\/(\d+)(?:[/?#]|$)/);
      if (match) matchedId = match[1];
    });
    if (matchedId) return matchedId;
  }
  return undefined;
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
    proxy,
    extraFields,
    images,
    signmark = false,
  } = options;

  if (!galleryId) throw new Error('galleryId는 필수입니다.');
  if (!subject) throw new Error('subject는 필수입니다.');
  if (!content) throw new Error('content는 필수입니다.');
  if (images !== undefined && !Array.isArray(images)) throw new Error('images는 배열이어야 합니다.');
  if (typeof signmark !== 'boolean') throw new Error('signmark는 boolean이어야 합니다.');
  for (const [index, image] of (images || []).entries()) {
    if (!image || !Buffer.isBuffer(image.data) || image.data.length === 0) {
      throw new Error(`images[${index}].data는 비어 있지 않은 Buffer여야 합니다.`);
    }
    if (!String(image.filename || '').trim()) {
      throw new Error(`images[${index}].filename은 필수입니다.`);
    }
    if (/[\r\n]/.test(image.filename)) {
      throw new Error(`images[${index}].filename에는 개행 문자를 사용할 수 없습니다.`);
    }
    if (!/^image\/[a-z0-9.+-]+$/i.test(String(image.contentType || ''))) {
      throw new Error(`images[${index}].contentType은 image/* MIME 타입이어야 합니다.`);
    }
  }

  const usingLogin = Boolean(providedJar);
  if (!usingLogin) {
    if (!nickname) throw new Error('비로그인 글쓰기는 nickname이 필요합니다.');
    if (!password) throw new Error('비로그인 글쓰기는 password가 필요합니다.');
  }

  const jar = providedJar || new CookieJar();
  const client = createMobileClient(jar, userAgent, proxy);

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

  const imageUrls = await uploadPostImages({ client, galleryId, images: images || [], csrfToken, writeUrl, userAgent });
  const contentWithImages = imageUrls.length
    ? `${content}${imageUrls.map(url => `<div class="block" contenteditable="false"><span class="cont img"><span class="cont-inr"><button type="button" class="sp-imgclose" style="z-index:9999;display:none;"><span class="blind">삭제</span></button><img src="${url}" onload="showRemoveBtn(this);"><span class="pos" style="display:none;"><span class="order-handle"></span></span></span></span></div><p><br></p>`).join('')}`
    : content;

  fields.id = galleryId;
  fields.route_id = fields.route_id || galleryId;
  fields.subject = subject;
  fields.memo = contentWithImages;
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

  // 브라우저는 체크되지 않은 add_watermark를 전송하지 않습니다.
  // 글쓰기 폼에서 자동 수집된 기본값이나 extraFields 값은 제거하고
  // 명시적으로 signmark=true인 경우에만 활성화합니다.
  delete fields.add_watermark;
  if (signmark) fields.add_watermark = '1';

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
    memo: contentWithImages,
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

  // 이미지는 upload_img.php에서 먼저 업로드하고 본문에 CDN URL로 삽입합니다.
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
  const parsed = parseRedirectFromHtml(html);
  let redirectUrl = parsed.url;
  let postId = parsed.postId;
  const message = parsed.message;
  const success = submitRes.status >= 200 && submitRes.status < 400 && (!message || /등록되었습니다/.test(message));
  if (success && !postId) {
    try {
      postId = await findCreatedPostId(client, galleryId, subject, fields.user_id);
      if (postId) redirectUrl = `${WRITE_BASE_URL}/board/${encodeURIComponent(galleryId)}/${postId}`;
    } catch {
      // 게시 자체는 성공했을 수 있으므로 조회 실패를 등록 실패로 바꾸지 않습니다.
    }
  }

  return {
    success,
    postId,
    redirectUrl,
    message,
    finalHtml: html,
    responseStatus: submitRes.status,
    imageUrls,
  };
}

// 모바일 글삭제
export async function deleteMobilePost(options: MobileDeletePostOptions): Promise<MobileDeletePostResult> {
  const { galleryId, postId, jar: providedJar, password, userAgent, proxy } = options;
  if (!galleryId) throw new Error('galleryId는 필수입니다.');
  if (postId === undefined || postId === null) throw new Error('postId는 필수입니다.');

  const jar = providedJar || new CookieJar();
  const client = createMobileClient(jar, userAgent, proxy);

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
