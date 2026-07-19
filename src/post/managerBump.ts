import axios, { AxiosInstance } from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import type { ManagerBumpOptions, ManagerBumpResult, ManagerGalleryType } from '../types';
import { getCookiesAsync } from './mobileCommon';

const MANAGER_ORIGIN = 'https://gall.dcinside.com';
const DEFAULT_PC_UA =
  'Mozilla/5.0 (X11; Linux aarch64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';

const GALLERY_CONFIG: Record<ManagerGalleryType, { path: string; endpoint: string; gallType: string }> = {
  minor: { path: 'mgallery', endpoint: 'minor', gallType: 'M' },
  mini: { path: 'mini', endpoint: 'mini', gallType: 'MI' },
  person: { path: 'person', endpoint: 'person', gallType: 'PR' },
};

function createManagerClient(options: ManagerBumpOptions): AxiosInstance {
  return wrapper(axios.create({
    jar: options.jar,
    withCredentials: true,
    timeout: 15000,
    maxRedirects: 5,
    proxy: options.proxy,
    headers: {
      'User-Agent': options.userAgent || DEFAULT_PC_UA,
      'Accept-Language': 'ko,en-US;q=0.9,en;q=0.8',
    },
  } as any));
}

function parseSuccess(data: any): boolean {
  const value = data?.result ?? data?.success ?? data?.status;
  if (value === undefined || value === null || value === '') return true;
  if (value === true || value === 1) return true;
  if (value === false || value === 0) return false;
  const normalized = String(value).toLowerCase();
  return ['1', 'true', 'ok', 'success'].includes(normalized);
}

/**
 * PC 관리자 화면과 동일한 요청으로 특정 게시글을 끌어올립니다.
 * mobileLogin()으로 인증된 관리자 CookieJar가 필요합니다.
 */
export async function bumpManagerPost(options: ManagerBumpOptions): Promise<ManagerBumpResult> {
  const { galleryId, postId, jar, galleryType = 'minor' } = options || ({} as ManagerBumpOptions);
  if (!galleryId) throw new Error('galleryId는 필수입니다.');
  if (postId === undefined || postId === null || String(postId).trim() === '') {
    throw new Error('postId는 필수입니다.');
  }
  if (!jar) throw new Error('관리자 로그인 세션이 담긴 jar는 필수입니다.');

  const gallery = GALLERY_CONFIG[galleryType];
  if (!gallery) throw new Error(`지원하지 않는 galleryType입니다: ${galleryType}`);

  const encodedGalleryId = encodeURIComponent(galleryId);
  const listUrl = `${MANAGER_ORIGIN}/${gallery.path}/board/lists/?id=${encodedGalleryId}`;
  const endpoint = `${MANAGER_ORIGIN}/ajax/${gallery.endpoint}_manager_board_ajax/update_bump`;
  const client = createManagerClient(options);

  // 관리자 계정에만 내려오는 끌올 UI를 확인하고 ci_c 쿠키도 준비한다.
  const listResponse = await client.get(listUrl, { responseType: 'text' });
  const listHtml = typeof listResponse.data === 'string' ? listResponse.data : '';
  if (!/update_bump\s*\(/.test(listHtml)) {
    throw new Error('이 계정에는 해당 갤러리의 끌올 관리자 권한이 없습니다.');
  }

  const cookies = await getCookiesAsync(jar, MANAGER_ORIGIN);
  const ciCookie = cookies.find(cookie => cookie.key === 'ci_c');
  if (!ciCookie?.value) throw new Error('관리자 요청에 필요한 ci_c 쿠키를 찾을 수 없습니다.');

  const payload = new URLSearchParams();
  payload.set('ci_t', ciCookie.value);
  payload.set('id', galleryId);
  payload.set('_GALLTYPE_', gallery.gallType);
  payload.append('nos[]', String(postId));

  const response = await client.post(endpoint, payload.toString(), {
    headers: {
      accept: 'application/json, text/javascript, */*; q=0.01',
      'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
      origin: MANAGER_ORIGIN,
      referer: listUrl,
      'x-requested-with': 'XMLHttpRequest',
    },
    responseType: 'json',
    validateStatus: (status: number) => status >= 200 && status < 300,
  });

  let data: any = response.data;
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch (_) {
      data = { msg: data };
    }
  }

  return {
    success: parseSuccess(data),
    message: typeof data?.msg === 'string'
      ? data.msg
      : (typeof data?.message === 'string' ? data.message : undefined),
    responseStatus: response.status,
    raw: typeof data === 'object' ? data : undefined,
  };
}

export const MANAGER_BUMP_DEFAULTS = {
  origin: MANAGER_ORIGIN,
  defaultGalleryType: 'minor' as ManagerGalleryType,
  defaultUserAgent: DEFAULT_PC_UA,
};
