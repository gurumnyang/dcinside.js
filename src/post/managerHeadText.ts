import axios, { AxiosInstance } from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import * as cheerio from 'cheerio';
import type {
  ChangePostHeadTextOptions,
  ChangePostHeadTextResult,
  GalleryHeadText,
  GetGalleryHeadTextsOptions,
  ManagerGalleryType,
} from '../types';
import { getCookiesAsync } from './mobileCommon';

const MANAGER_ORIGIN = 'https://gall.dcinside.com';
const DEFAULT_PC_UA =
  'Mozilla/5.0 (X11; Linux aarch64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';

const GALLERY_CONFIG: Record<ManagerGalleryType, { path: string; endpoint: string; gallType: string }> = {
  minor: { path: 'mgallery', endpoint: 'minor', gallType: 'M' },
  mini: { path: 'mini', endpoint: 'mini', gallType: 'MI' },
  person: { path: 'person', endpoint: 'person', gallType: 'PR' },
};

function resolveGallery(galleryType: ManagerGalleryType) {
  const gallery = GALLERY_CONFIG[galleryType];
  if (!gallery) throw new Error(`지원하지 않는 galleryType입니다: ${galleryType}`);
  return gallery;
}

function createClient(options: GetGalleryHeadTextsOptions): AxiosInstance {
  const config: any = {
    timeout: 15000,
    maxRedirects: 5,
    proxy: options.proxy,
    headers: {
      'User-Agent': options.userAgent || DEFAULT_PC_UA,
      'Accept-Language': 'ko,en-US;q=0.9,en;q=0.8',
    },
  };
  if (options.jar) {
    config.jar = options.jar;
    config.withCredentials = true;
  }
  const client = axios.create(config);
  return options.jar ? wrapper(client) : client;
}

export function parseGalleryHeadTexts(html: string): GalleryHeadText[] {
  const $ = cheerio.load(html || '');
  const seen = new Set<string>();
  const items: GalleryHeadText[] = [];

  $('a[onclick*="listSearchHead("]').each((_, element) => {
    const onclick = $(element).attr('onclick') || '';
    const match = onclick.match(/listSearchHead\(\s*['"]?(\d+)/);
    const id = match?.[1];
    const name = $(element).text().replace(/\s+/g, ' ').trim();
    // 999는 관리자 자신의 전체 글 수정에서만 쓰이는 특수 말머리다.
    // 관리자 검색 필터에는 나타나지만 타인 글 말머리 변경 API는 지원하지 않는다.
    if (!id || id === '999' || !name || seen.has(id)) return;
    seen.add(id);
    items.push({ id, name });
  });

  return items;
}

/** 갤러리 목록 화면에서 사용 가능한 말머리 ID와 이름을 가져옵니다. */
export async function getGalleryHeadTexts(options: GetGalleryHeadTextsOptions): Promise<GalleryHeadText[]> {
  const { galleryId, galleryType = 'minor' } = options || ({} as GetGalleryHeadTextsOptions);
  if (!galleryId) throw new Error('galleryId는 필수입니다.');

  const gallery = resolveGallery(galleryType);
  const listUrl = `${MANAGER_ORIGIN}/${gallery.path}/board/lists/?id=${encodeURIComponent(galleryId)}`;
  const response = await createClient(options).get(listUrl, { responseType: 'text' });
  const items = parseGalleryHeadTexts(typeof response.data === 'string' ? response.data : '');
  if (!items.length) throw new Error('갤러리 말머리 목록을 찾을 수 없습니다.');
  return items;
}

function parseSuccess(data: any): boolean {
  const value = data?.result ?? data?.success ?? data?.status;
  if (value === undefined || value === null || value === '') return true;
  if (value === true || value === 1) return true;
  if (value === false || value === 0) return false;
  return ['1', 'true', 'ok', 'success'].includes(String(value).toLowerCase());
}

/** 관리자 세션으로 특정 게시글의 말머리를 변경합니다. */
export async function changePostHeadText(options: ChangePostHeadTextOptions): Promise<ChangePostHeadTextResult> {
  const { galleryId, postId, headTextId, jar, galleryType = 'minor' } = options || ({} as ChangePostHeadTextOptions);
  if (!galleryId) throw new Error('galleryId는 필수입니다.');
  if (postId === undefined || postId === null || String(postId).trim() === '') throw new Error('postId는 필수입니다.');
  if (headTextId === undefined || headTextId === null || String(headTextId).trim() === '') {
    throw new Error('headTextId는 필수입니다.');
  }
  if (!jar) throw new Error('관리자 로그인 세션이 담긴 jar는 필수입니다.');

  const gallery = resolveGallery(galleryType);
  const listUrl = `${MANAGER_ORIGIN}/${gallery.path}/board/lists/?id=${encodeURIComponent(galleryId)}`;
  const client = createClient(options);
  const listResponse = await client.get(listUrl, { responseType: 'text' });
  const listHtml = typeof listResponse.data === 'string' ? listResponse.data : '';
  if (!/chg_headtext(?:_batch)?\s*\(/.test(listHtml)) {
    throw new Error('이 계정에는 해당 갤러리의 말머리 변경 관리자 권한이 없습니다.');
  }

  const headTexts = parseGalleryHeadTexts(listHtml);
  const selected = headTexts.find(item => item.id === String(headTextId));
  if (!selected) throw new Error(`유효하지 않은 말머리 ID입니다: ${headTextId}`);

  const cookies = await getCookiesAsync(jar, MANAGER_ORIGIN);
  const ciCookie = cookies.find(cookie => cookie.key === 'ci_c');
  if (!ciCookie?.value) throw new Error('관리자 요청에 필요한 ci_c 쿠키를 찾을 수 없습니다.');

  const payload = new URLSearchParams({
    ci_t: ciCookie.value,
    id: galleryId,
    no: String(postId),
    headtext: String(headTextId),
    _GALLTYPE_: gallery.gallType,
  });
  const endpoint = `${MANAGER_ORIGIN}/ajax/${gallery.endpoint}_manager_board_ajax/chg_headtext`;
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
    headText: selected,
    raw: typeof data === 'object' ? data : undefined,
  };
}
