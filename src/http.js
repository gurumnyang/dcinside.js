// http.js - shared axios client with retry helpers
// @ts-check

const axios = require('axios');
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
 * Perform GET with retry/backoff. Optionally overrides headers.
 * @param {string} url
 * @param {import('axios').AxiosRequestConfig} [options] axios options
 * @returns {Promise<any>} response.data
 */
async function getWithRetry(url, options = {}) {
  const { retryCount, ...axiosConfig } = /** @type {any} */ (options || {});
  const retryOptions = {
    maxRetries: retryCount || RETRY_ATTEMPTS,
    delayMs: RETRY_DELAY,
    exponentialBackoff: true,
  };

  try {
    return await withRetry(async () => {
      const finalOptions = { ...axiosConfig };
      if (config.CRAWL && config.CRAWL.RANDOM_USER_AGENT) {
        finalOptions.headers = {
          ...(axiosConfig.headers || {}),
          'User-Agent': getRandomUserAgent(),
        };
      }
      return (await axiosInstance.get(url, finalOptions)).data;
    }, retryOptions);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw createHttpError(error, `GET failed: ${url}`, { method: 'GET', options });
    }
    throw error;
  }
}

/**
 * Perform POST with retry/backoff. Optionally overrides headers.
 * @param {string} url
 * @param {any} data
 * @param {import('axios').AxiosRequestConfig} [options] axios options
 * @returns {Promise<any>} response.data
 */
async function postWithRetry(url, data, options = {}) {
  const { retryCount, ...axiosConfig } = /** @type {any} */ (options || {});
  const retryOptions = {
    maxRetries: RETRY_ATTEMPTS,
    delayMs: RETRY_DELAY,
    exponentialBackoff: true,
  };

  try {
    return await withRetry(async () => {
      const finalOptions = { ...axiosConfig };
      if (config.CRAWL && config.CRAWL.RANDOM_USER_AGENT) {
        finalOptions.headers = {
          ...(axiosConfig.headers || {}),
          'User-Agent': getRandomUserAgent(),
        };
      }
      return (await axiosInstance.post(url, data, finalOptions)).data;
    }, retryOptions);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw createHttpError(error, `POST failed: ${url}`, { method: 'POST', options });
    }
    throw error;
  }
}

module.exports = {
  axiosInstance,
  getWithRetry,
  postWithRetry,
};
