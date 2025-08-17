const { scrapeBoardPage, getPostContent, getMobilePostContent } = require('./src/scraper');
const { delay, getRandomUserAgent } = require('./src/util');
const scraper = require('./src/scraper');
const autocomplete = require('./src/autocomplete');
const searchModule = require('./src/search');

async function getPostList({ page, galleryId, boardType = 'all' }) {
  return scrapeBoardPage(page, galleryId, { boardType });
}

// New default: use mobile post content
async function getPost({ galleryId, postNo, ...rest }) {
  return getMobilePostContent(galleryId, postNo, rest);
}

// Legacy PC version retained for compatibility
async function getPostLegacy({ galleryId, postNo, ...rest }) {
  return getPostContent(galleryId, postNo, rest);
}

async function getPosts({ galleryId, postNumbers, delayMs = 100, onProgress, ...rest }) {
  const out = [];
  for (let i = 0; i < postNumbers.length; i++) {
    let no = postNumbers[i];
    if (typeof no !== 'string' && typeof no !== 'number') {
      if (no && typeof no === 'object' && (typeof no.id === 'string' || typeof no.id === 'number')) no = no.id;
      else { console.warn('Invalid post number entry, skip'); continue; }
    }
    try {
      const post = await getPostContent(galleryId, no, rest);
      if (post) out.push(post);
    } catch (e) { console.error(`post ${no} error: ${e.message}`); }
    if (typeof onProgress === 'function') onProgress(i + 1, postNumbers.length);
    if (i < postNumbers.length - 1) await delay(delayMs);
  }
  return out;
}

async function getAutocomplete(query) { return autocomplete.getAutocomplete(query); }
async function search(query, options = {}) { return searchModule.search(query, options); }

module.exports = {
  getPostList,
  getPost,
  getPostLegacy,
  getPosts,
  getAutocomplete,
  search,
  getPostNumbers: getPostList,
  delay,
  getRandomUserAgent,
  raw: { ...scraper, ...autocomplete, ...searchModule },
};
