import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { Cookie, CookieJar } from 'tough-cookie';
import * as cheerio from 'cheerio';
import { URL } from 'node:url';
import config = require('../config');
import type {
  MobileLoginOptions,
  MobileLoginResult,
  MobileLoginTokens,
  MobileLoginCookie,
} from '../types';

const LOGIN_ORIGIN = 'https://msign.dcinside.com';
const LOGIN_PATH = '/login';
const LOGIN_URL = `${LOGIN_ORIGIN}${LOGIN_PATH}`;
const LOGIN_ACCESS_URL = `${LOGIN_ORIGIN}/login/access`;
const DEFAULT_RETURN_URL = 'https://m.dcinside.com';

const DEFAULT_MOBILE_UA = 'Mozilla/5.0 (Linux; Android 10; SM-G973N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.77 Mobile Safari/537.36';

const MOBILE_HTML_HEADERS = {
  accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
  'accept-language': 'ko,en-US;q=0.9,en;q=0.8',
  'sec-ch-ua': '"Chromium";v="140", "Not=A?Brand";v="24", "Google Chrome";v="140"',
  'sec-ch-ua-mobile': '?1',
  'sec-ch-ua-platform': '"Android"',
  'sec-fetch-dest': 'document',
  'sec-fetch-mode': 'navigate',
  'sec-fetch-site': 'same-site',
  'sec-fetch-user': '?1',
  'upgrade-insecure-requests': '1',
};

const AJAX_HEADERS = {
  accept: '*/*',
  'accept-language': 'ko,en-US;q=0.9,en;q=0.8',
  'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
  'sec-ch-ua': '"Chromium";v="140", "Not=A?Brand";v="24", "Google Chrome";v="140"',
  'sec-ch-ua-mobile': '?1',
  'sec-ch-ua-platform': '"Android"',
  'sec-fetch-dest': 'empty',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'same-origin',
  'x-requested-with': 'XMLHttpRequest',
  origin: LOGIN_ORIGIN,
};

interface LoginPageExtract {
  tokens: MobileLoginTokens;
  html: string;
}

const getCookiesAsync = async (jar: CookieJar, url: string): Promise<Cookie[]> => {
  return (await jar.getCookies(url)) as Cookie[];
};

const toCookieInfo = (cookie: Cookie): MobileLoginCookie => {
  let expires: string | undefined;
  const rawExpires: unknown = (cookie as any).expires;
  if (rawExpires && typeof rawExpires !== 'string' && typeof (rawExpires as Date).getTime === 'function') {
    const time = (rawExpires as Date).getTime();
    if (Number.isFinite(time)) {
      expires = new Date(time).toISOString();
    }
  }
  return {
    key: cookie.key,
    value: cookie.value,
    domain: cookie.domain || '',
    path: cookie.path || '/',
    httpOnly: Boolean(cookie.httpOnly),
    secure: Boolean(cookie.secure),
    expires,
  };
};

const resolveLocation = (fromUrl: string, location: string): string => {
  try {
    return new URL(location, fromUrl).toString();
  } catch (_) {
    return location;
  }
};

const createMobileAxios = (jar: CookieJar, userAgent?: string): AxiosInstance => {
  const headersUA = userAgent || DEFAULT_MOBILE_UA;
  return wrapper(axios.create({
    timeout: config.HTTP.TIMEOUT,
    withCredentials: true,
    headers: {
      ...MOBILE_HTML_HEADERS,
      'User-Agent': headersUA,
    },
    jar,
    maxRedirects: 0,
  } as AxiosRequestConfig));
};

const extractLoginTokens = (html: string, fallbackReturnUrl: string): LoginPageExtract => {
  const $ = cheerio.load(html);
  const csrfToken = $('meta[name="csrf-token"]').attr('content') || '';
  const conKey = $('#conKey').attr('value') || '';
  const rUrl = $('#r_url').attr('value') || fallbackReturnUrl;
  const formToken = $('input[name="_token"]').attr('value') || '';

  if (!csrfToken || !conKey) {
    throw new Error('로그인 페이지에서 토큰을 추출하지 못했습니다.');
  }

  return {
    tokens: {
      csrfToken,
      conKey,
      formToken,
      returnUrl: rUrl,
    },
    html,
  };
};

const fetchLoginPage = async (
  client: AxiosInstance,
  returnUrl: string,
  referer: string,
): Promise<LoginPageExtract> => {
  const response = await client.get(`${LOGIN_URL}?r_url=${encodeURIComponent(returnUrl)}`, {
    responseType: 'text',
    headers: {
      ...MOBILE_HTML_HEADERS,
      referer,
    },
  });
  return extractLoginTokens(response.data as string, returnUrl);
};

const preflightAccessCheck = async (
  client: AxiosInstance,
  tokens: MobileLoginTokens,
  code: string,
): Promise<{ result?: boolean; message?: string; [key: string]: any }> => {
  const payload = new URLSearchParams({
    token_verify: 'dc_login',
    conKey: tokens.conKey,
    code,
    randcode: 'undefined',
  });

  const response = await client.post(LOGIN_ACCESS_URL, payload.toString(), {
    headers: {
      ...AJAX_HEADERS,
      'x-csrf-token': tokens.csrfToken,
      referer: `${LOGIN_URL}?r_url=${encodeURIComponent(tokens.returnUrl)}`,
    },
    validateStatus: status => status >= 200 && status < 300,
  });

  return (typeof response.data === 'object' && response.data) || {};
};

const extractFailureMessage = (html: string): string | undefined => {
  if (!html) return undefined;
  try {
    const $ = cheerio.load(html);
    const candidate = $('.login-alert, .login-error, #error_msg').first().text().trim();
    if (candidate) return candidate;
  } catch (err) {
    // ignore cheerio errors, fallback to regex below
  }
  const alertMatch = html.match(/alert\((['"])(.*?)\1\)/);
  if (alertMatch && alertMatch[2]) {
    return alertMatch[2];
  }
  return undefined;
};

const sanitizeHeaders = (headers: Record<string, any> = {}) => {
  const out: Record<string, any> = {};
  Object.keys(headers || {}).forEach(key => {
    if (!key) return;
    const lower = key.toLowerCase();
    if (lower === 'content-length' || lower === 'accept-encoding') return;
    out[key] = headers[key];
  });
  return out;
};

const followRedirectChain = async (
  client: AxiosInstance,
  initialResponse: AxiosResponse,
  baseHeaders: Record<string, string>,
): Promise<{ finalResponse: AxiosResponse; finalUrl: string; redirectCount: number }> => {
  let currentResponse = initialResponse;
  let currentUrl = currentResponse.config?.url ? currentResponse.config.url : LOGIN_URL;
  let redirects = 0;

  while (currentResponse.status >= 300 && currentResponse.status < 400) {
    const location = currentResponse.headers?.location || currentResponse.headers?.Location;
    if (!location) break;
    if (redirects > 10) {
      throw new Error('로그인 처리 중 리다이렉트가 과도하게 발생했습니다.');
    }

    const absoluteUrl = resolveLocation(currentUrl, location);
    const prevConfig: AxiosRequestConfig = currentResponse.config || {};
    const method = (prevConfig.method || 'get').toString().toLowerCase();
    const repeatMethod = currentResponse.status === 307 || currentResponse.status === 308;
    const shouldRepeatPost = repeatMethod && method === 'post';
    const headers = sanitizeHeaders({
      ...MOBILE_HTML_HEADERS,
      ...(shouldRepeatPost ? (prevConfig.headers as any) : {}),
      ...baseHeaders,
      referer: currentUrl,
    });

    if (shouldRepeatPost) {
      currentResponse = await client.post(absoluteUrl, prevConfig.data, {
        headers,
        validateStatus: status => status >= 200 && status < 400,
        responseType: 'text',
      });
    } else {
      currentResponse = await client.get(absoluteUrl, {
        headers,
        validateStatus: status => status >= 200 && status < 400,
        responseType: 'text',
      });
    }

    currentUrl = absoluteUrl;
    redirects += 1;
  }

  return {
    finalResponse: currentResponse,
    finalUrl: currentUrl,
    redirectCount: redirects,
  };
};

const gatherCookies = async (jar: CookieJar): Promise<MobileLoginCookie[]> => {
  const targets = [
    'https://m.dcinside.com',
    'https://msign.dcinside.com',
    'https://gall.dcinside.com',
    'https://www.dcinside.com',
  ];
  const seen = new Map<string, MobileLoginCookie>();

  for (const url of targets) {
    const cookies = await getCookiesAsync(jar, url);
    for (const cookie of cookies) {
      const key = `${cookie.domain}|${cookie.path}|${cookie.key}`;
      if (!seen.has(key)) {
        seen.set(key, toCookieInfo(cookie));
      }
    }
  }

  return Array.from(seen.values());
};

const buildCookieHeader = async (jar: CookieJar, url: string): Promise<string> => {
  const cookies = await getCookiesAsync(jar, url);
  return cookies.map(c => `${c.key}=${c.value}`).join('; ');
};

export async function mobileLogin(options: MobileLoginOptions): Promise<MobileLoginResult> {
  const {
    code,
    password,
    keepLoggedIn = true,
    returnUrl = DEFAULT_RETURN_URL,
    userAgent,
    jar: providedJar,
  } = options || {};

  if (!code) throw new Error('code(식별 코드)는 필수 입력 값입니다.');
  if (!password) throw new Error('password(비밀번호)는 필수 입력 값입니다.');

  const jar = providedJar || new CookieJar();
  const client = createMobileAxios(jar, userAgent);

  const { tokens, html } = await fetchLoginPage(client, returnUrl, DEFAULT_RETURN_URL);

  const preflight = await preflightAccessCheck(client, tokens, code);
  if (preflight?.result === false) {
    return {
      success: false,
      reason: preflight?.message || '로그인 사전 검증 단계에서 실패했습니다.',
      tokens,
      jar,
      cookies: [],
      cookieHeader: '',
      redirectCount: 0,
      finalUrl: LOGIN_URL,
      finalStatus: 0,
      preflight,
      loginPageHtml: html,
    };
  }

  if (preflight && typeof preflight.Block_key === 'string' && preflight.Block_key) {
    tokens.conKey = preflight.Block_key;
  }

  const payload = new URLSearchParams({
    code,
    password,
    loginCash: keepLoggedIn ? 'on' : '',
    conKey: tokens.conKey,
    r_url: tokens.returnUrl || returnUrl,
    _token: tokens.formToken || tokens.csrfToken || '',
  });

  const loginResponse = await client.post(LOGIN_URL, payload.toString(), {
    headers: {
      ...MOBILE_HTML_HEADERS,
      'content-type': 'application/x-www-form-urlencoded',
      origin: LOGIN_ORIGIN,
      'sec-fetch-site': 'same-origin',
      referer: `${LOGIN_URL}?r_url=${encodeURIComponent(tokens.returnUrl || returnUrl)}`,
      'x-csrf-token': tokens.csrfToken,
    },
    validateStatus: status => status === 200 || status === 302 || status === 303 || status === 307,
    responseType: 'text',
  });

  if (loginResponse.status === 200) {
    const message = extractFailureMessage(loginResponse.data as string) || '아이디 또는 비밀번호가 올바르지 않습니다.';
    return {
      success: false,
      reason: message,
      tokens,
      jar,
      cookies: [],
      cookieHeader: '',
      redirectCount: 0,
      finalUrl: LOGIN_URL,
      finalStatus: loginResponse.status,
      preflight,
      loginPageHtml: loginResponse.data as string,
      finalHtml: loginResponse.data as string,
    };
  }

  const { finalResponse, finalUrl, redirectCount } = await followRedirectChain(client, loginResponse, {
    'User-Agent': userAgent || DEFAULT_MOBILE_UA,
  });

  const cookies = await gatherCookies(jar);
  const cookieHeader = await buildCookieHeader(jar, DEFAULT_RETURN_URL);
  const hasLoginCookie = cookies.some(cookie => ['dc_m_login', 'm_dcinside', 'remember_secret'].includes(cookie.key));

  const success = hasLoginCookie && finalResponse.status >= 200 && finalResponse.status < 400;
  const finalHtml = typeof finalResponse.data === 'string' ? finalResponse.data : undefined;

  return {
    success,
    reason: success ? undefined : '로그인 최종 단계에서 인증 쿠키를 받지 못했습니다.',
    tokens,
    jar,
    cookies,
    cookieHeader,
    redirectCount,
    finalUrl,
    finalStatus: finalResponse.status,
    finalHtml,
    preflight,
    loginPageHtml: html,
  };
}

export const MOBILE_LOGIN_DEFAULTS = {
  loginUrl: LOGIN_URL,
  loginAccessUrl: LOGIN_ACCESS_URL,
  defaultReturnUrl: DEFAULT_RETURN_URL,
  defaultUserAgent: DEFAULT_MOBILE_UA,
};
