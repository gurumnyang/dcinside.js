// board/index.js - aggregator for board (list) scraping
// Exports:
// - scrapeBoardPage: Mobile (default)
// - scrapeBoardPageLegacy: PC (legacy)

const { scrapeMobileBoardPage } = require('./mobile');
const { scrapeBoardPage: scrapeBoardPageLegacy } = require('./pc');

module.exports = {
  // Default: mobile board page
  scrapeBoardPage: scrapeMobileBoardPage,
  // Legacy: PC board page
  scrapeBoardPageLegacy,
};

