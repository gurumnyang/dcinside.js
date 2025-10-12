// thin aggregator for scraper API (folder index)
const board = require('./board');
const post = require('./post');

module.exports = {
  // Board (list)
  scrapeBoardPages: board.scrapeBoardPage,
  scrapeBoardPage: board.scrapeBoardPage, // default: mobile
  scrapeBoardPageLegacy: board.scrapeBoardPageLegacy, // legacy: PC
  // PC post-related (legacy)
  getPostContent: post.getPostContent,
  getCommentsForPost: post.getCommentsForPost,
  extractText: post.extractText,
  replaceImagesWithPlaceholder: post.replaceImagesWithPlaceholder,
  processImages: post.processImages,
  // Mobile post-related
  getMobilePostContent: post.getMobilePostContent,
  parseMobilePostHtml: post.parseMobilePostHtml,
  createMobilePost: post.createMobilePost,
  deleteMobilePost: post.deleteMobilePost,
  createMobileComment: post.createMobileComment,
  deleteMobileComment: post.deleteMobileComment,
};
