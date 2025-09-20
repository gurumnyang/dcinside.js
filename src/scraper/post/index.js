// post/index.js - aggregator for post-related scrapers (PC + Mobile)
const { getPostContent } = require('./post');
const { getCommentsForPost } = require('./comments');
const { extractText, replaceImagesWithPlaceholder, processImages } = require('./html');
const { getMobilePostContent, parseMobilePostHtml } = require('./mobilePost');
const { createMobilePost, deleteMobilePost } = require('../../post/mobileWrite');
const { deleteMobileComment } = require('../../comment/mobileComment');

module.exports = {
  // legacy PC
  getPostContent,
  getCommentsForPost,
  extractText,
  replaceImagesWithPlaceholder,
  processImages,
  // mobile
  getMobilePostContent,
  parseMobilePostHtml,
  createMobilePost,
  deleteMobilePost,
  deleteMobileComment,
};
