// http.js - shared axios client with retry helpers
// @ts-check

const axios = require('axios');
const { wrapper } = require('axios-cookiejar-support');
const { withRetry, createHttpError, getRandomUserAgent } = require('./util');
const config = require('./config');

const { USER_AGENT, TIMEOUT, RETRY_ATTEMPTS, RETRY_DELAY } = config.HTTP;

// Default headers for DCInside traffic
const DEFAULT_HEADERS = {
  'User-Agent': USER_AGENT,
};

// Reusable axios instance
// axios types in JSDoc can be strict; cast for create()
const axiosInstance = (/** @type {any} */(axios)).create({
  timeout: TIMEOUT,
  headers: DEFAULT_HEADERS,
});

/**
 * Create a cookie-jar aware axios instance.
 * NOTE: The jar is NOT included in error metadata to avoid leaking cookies.
 * @param {import('tough-cookie').CookieJar} jar
 * @returns {import('axios').AxiosInstance}
 */
function createJarAxiosInstance(jar) {
  // axios-cookiejar-support wires CookieJar <-> request/response headers.
  // The jar itself is shared (caller owns it), so recreating the axios instance is fine.
  const client = (/** @type {any} */(axios)).create({
    timeout: TIMEOUT,
    headers: DEFAULT_HEADERS,
    jar,
    withCredentials: true,
  });
  return wrapper(client);
}

/**
 * Redact sensitive headers/capabilities from error metadata.
 * @param {any} options
 */
function sanitizeOptionsForError(options) {
  if (!options || typeof options !== 'object') return options;
  const out = { ...options };
  if ('jar' in out) delete out.jar;
  if (out.headers && typeof out.headers === 'object') {
    const nextHeaders = { ...out.headers };
    for (const key of Object.keys(nextHeaders)) {
      if (!key) continue;
      const lower = key.toLowerCase();
      if (lower === 'cookie' || lower === 'authorization') {
        nextHeaders[key] = '[redacted]';
      }
    }
    out.headers = nextHeaders;
  }
  return out;
}

/**
 * Perform GET with retry/backoff. Optionally overrides headers.
 * @param {string} url
 * @param {(import('axios').AxiosRequestConfig & { retryCount?: number, jar?: import('tough-cookie').CookieJar })} [options] axios options
 * @returns {Promise<any>} response.data
 */
async function getWithRetry(url, options = {}) {
  const { retryCount, jar, ...axiosConfig } = /** @type {any} */ (options || {});
  const retryOptions = {
    maxRetries: retryCount || RETRY_ATTEMPTS,
    delayMs: RETRY_DELAY,
    exponentialBackoff: true,
  };
  const client = jar ? createJarAxiosInstance(jar) : axiosInstance;

  try {
    return await withRetry(async () => {
      const finalOptions = { ...axiosConfig };
      if (config.CRAWL && config.CRAWL.RANDOM_USER_AGENT) {
        finalOptions.headers = {
          ...(axiosConfig.headers || {}),
          'User-Agent': getRandomUserAgent(),
        };
      }
      return (await client.get(url, finalOptions)).data;
    }, retryOptions);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw createHttpError(error, `GET failed: ${url}`, { method: 'GET', options: sanitizeOptionsForError(options) });
    }
    throw error;
  }
}

/**
 * Perform POST with retry/backoff. Optionally overrides headers.
 * @param {string} url
 * @param {any} data
 * @param {(import('axios').AxiosRequestConfig & { retryCount?: number, jar?: import('tough-cookie').CookieJar })} [options] axios options
 * @returns {Promise<any>} response.data
 */
async function postWithRetry(url, data, options = {}) {
  const { retryCount, jar, ...axiosConfig } = /** @type {any} */ (options || {});
  const retryOptions = {
    maxRetries: RETRY_ATTEMPTS,
    delayMs: RETRY_DELAY,
    exponentialBackoff: true,
  };
  const client = jar ? createJarAxiosInstance(jar) : axiosInstance;

  try {
    return await withRetry(async () => {
      const finalOptions = { ...axiosConfig };
      if (config.CRAWL && config.CRAWL.RANDOM_USER_AGENT) {
        finalOptions.headers = {
          ...(axiosConfig.headers || {}),
          'User-Agent': getRandomUserAgent(),
        };
      }
      return (await client.post(url, data, finalOptions)).data;
    }, retryOptions);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw createHttpError(error, `POST failed: ${url}`, { method: 'POST', options: sanitizeOptionsForError(options) });
    }
    throw error;
  }
}

module.exports = {
  axiosInstance,
  getWithRetry,
  postWithRetry,
};
