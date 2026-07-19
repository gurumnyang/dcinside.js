// post/index.js - aggregator for post-related scrapers (PC + Mobile)
const { getPostContent } = require('./post');
const { getCommentsForPost } = require('./comments');
const { extractText, replaceImagesWithPlaceholder, processImages } = require('./html');
const { getMobilePostContent, parseMobilePostHtml } = require('./mobilePost');
const { createMobilePost, deleteMobilePost } = require('../../post/mobileWrite');
const { createMobileComment, deleteMobileComment } = require('../../comment/mobileComment');
const { recommendBestPost } = require('../../post/bestRecommend');
const { bumpManagerPost } = require('../../post/managerBump');
const { getGalleryHeadTexts, changePostHeadText } = require('../../post/managerHeadText');

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
  createMobileComment,
  deleteMobileComment,
  recommendBestPost,
  bumpManagerPost,
  getGalleryHeadTexts,
  changePostHeadText,
};
