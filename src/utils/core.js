const { CrawlError } = require('./error');

function validateNumberInput(input, defaultValue) {
  const n = parseInt(input, 10);
  return isNaN(n) ? defaultValue : n;
}

function delay(ms) {
  if (typeof ms !== 'number' || isNaN(ms)) {
    ms = 100;
    console.warn(`delay 함수의 유효하지 않은 값, 기본 ${ms}ms 사용`);
  }
  return new Promise(res => setTimeout(res, ms));
}

function getRandomUserAgent() {
  const agents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/125.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_6_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_6_6) AppleWebKit/537.36 (KHTML, like Gecko) Firefox/125.0',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) Gecko/20100101 Firefox/125.0',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Ubuntu Chromium/124.0.0.0 Chrome/124.0.0.0 Safari/537.36',
  ];
  return agents[Math.floor(Math.random() * agents.length)];
}

const withRetry = async (fn, options = {}) => {
  const { maxRetries = 3, delayMs = 1000, exponentialBackoff = true } = options;
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try { return await fn(); }
    catch (error) {
      lastError = error;
      if (error instanceof CrawlError && !error.isRetryable()) throw error;
      if (attempt === maxRetries) throw error;
      const wait = exponentialBackoff ? delayMs * Math.pow(2, attempt) : delayMs;
      console.warn(`시도 ${attempt + 1}/${maxRetries + 1} 실패. ${wait}ms 후 재시도..`);
      await delay(wait);
    }
  }
  throw lastError;
};

module.exports = {
  validateNumberInput,
  delay,
  getRandomUserAgent,
  withRetry,
};

