import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { Cookie, CookieJar } from 'tough-cookie';
import * as cheerio from 'cheerio';
import { URL } from 'node:url';

export const WRITE_BASE_URL = 'https://m.dcinside.com';
export const WRITE_UPLOAD_URL = 'https://mupload.dcinside.com/write_new.php';
export const DELETE_POST_ENDPOINT = 'https://m.dcinside.com/del/board';
export const DELETE_COMMENT_ENDPOINT = 'https://m.dcinside.com/del/comment';

export const DEFAULT_MOBILE_UA =
  'Mozilla/5.0 (Linux; Android 10; SM-G973N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.77 Mobile Safari/537.36';

export const HTML_HEADERS = {
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
  'Accept-Language': 'ko,en-US;q=0.9,en;q=0.8',
  'Upgrade-Insecure-Requests': '1',
};

export const AJAX_HEADERS = {
  accept: '*/*',
  'accept-language': 'ko,en-US;q=0.9,en;q=0.8',
  'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
  'sec-fetch-dest': 'empty',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'same-origin',
  'x-requested-with': 'XMLHttpRequest',
};

export function createMobileClient(jar: CookieJar, userAgent?: string): AxiosInstance {
  const client = axios.create({
    jar,
    withCredentials: true,
    timeout: 15000,
    headers: {
      ...HTML_HEADERS,
      'User-Agent': userAgent || DEFAULT_MOBILE_UA,
      'sec-ch-ua': '"Chromium";v="140", "Not=A?Brand";v="24", "Google Chrome";v="140"',
      'sec-ch-ua-mobile': '?1',
      'sec-ch-ua-platform': '"Android"',
    },
    maxRedirects: 0,
  });
  return wrapper(client);
}

export function getCookiesAsync(jar: CookieJar, url: string): Promise<Cookie[]> {
  return new Promise((resolve, reject) => {
    jar.getCookies(url, (err, cookies) => {
      if (err) reject(err);
      else resolve(cookies as Cookie[]);
    });
  });
}

export async function getWithRedirect(
  client: AxiosInstance,
  url: string,
  options: Record<string, any> = {},
  maxRedirects: number = 5,
): Promise<AxiosResponse<any>> {
  let currentUrl = url;
  let redirects = 0;
  const baseOptions = {
    validateStatus: (status: number) => status >= 200 && status < 400,
    ...options,
  };
  let response: AxiosResponse<any> | undefined;

  while (redirects <= maxRedirects) {
    response = await client.get(currentUrl, baseOptions);
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers?.location || response.headers?.Location;
      if (!location) break;
      currentUrl = new URL(location, currentUrl).toString();
      redirects += 1;
      continue;
    }
    break;
  }

  return response!;
}

export function findBlockOrConKey(data: any): string | undefined {
  if (!data) return undefined;
  if (typeof data === 'string') {
    try {
      return findBlockOrConKey(JSON.parse(data));
    } catch (_) {
      return undefined;
    }
  }
  return data.Block_key || data.block_key || data.con_key || data.Con_key || undefined;
}

export function parseRedirectFromHtml(html?: string): { url?: string; postId?: string; message?: string } {
  if (!html) return {};
  const locationMatch = html.match(/location\.(?:href|replace)\s*\(\s*['"]([^'";]+)['"]/);
  const alertMatch = html.match(/alert\((['"])(.*?)\1\)/);
  let message = alertMatch ? alertMatch[2] : undefined;
  if (!message) {
    try {
      const $ = cheerio.load(html);
      const alertText = $('.alert-box .txt').first().text().trim();
      if (alertText) message = alertText;
    } catch (err) {
      // ignore parse errors
    }
  }
  const redirectUrl = locationMatch ? locationMatch[1] : undefined;
  const postMatch = redirectUrl?.match(/\/(\d+)(?:\?|$)/);
  return {
    url: redirectUrl,
    postId: postMatch ? postMatch[1] : undefined,
    message,
  };
}
