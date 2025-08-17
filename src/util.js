// util.js - thin aggregator
const { validateNumberInput, delay, getRandomUserAgent, withRetry } = require('./utils/core');
const { CrawlError, createHttpError } = require('./utils/error');

module.exports = {
  validateNumberInput,
  delay,
  getRandomUserAgent,
  CrawlError,
  createHttpError,
  withRetry,
};
