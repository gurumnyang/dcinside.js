// thin aggregator for scraper API (folder index)
const { scrapeBoardPage } = require('./board');
const post = require('./post');

module.exports = {
  scrapeBoardPages: scrapeBoardPage,
  scrapeBoardPage,
  // PC post-related (legacy)
  getPostContent: post.getPostContent,
  getCommentsForPost: post.getCommentsForPost,
  extractText: post.extractText,
  replaceImagesWithPlaceholder: post.replaceImagesWithPlaceholder,
  processImages: post.processImages,
  // Mobile post-related
  getMobilePostContent: post.getMobilePostContent,
};
