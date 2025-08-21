// Public API (index.ts)
const scraper = require('./src/scraper');
const { delay, getRandomUserAgent } = require('./src/util');
const autocomplete = require('./src/autocomplete');
const searchModule = require('./src/search');

async function getPostList({ page, galleryId, boardType = 'all' }: { page: number, galleryId: string, boardType?: 'all'|'recommend'|'notice' }) {
  return scraper.scrapeBoardPage(page, galleryId, { boardType });
}

// Legacy: PC board list
async function getPostListLegacy({ page, galleryId, boardType = 'all' }: { page: number, galleryId: string, boardType?: 'all'|'recommend'|'notice' }) {
  return scraper.scrapeBoardPageLegacy(page, galleryId, { boardType });
}

// New default: use mobile post content
async function getPost({ galleryId, postNo, ...rest }: any) {
  return scraper.getMobilePostContent(galleryId, postNo, rest);
}

// Legacy PC version retained for compatibility
async function getPostLegacy({ galleryId, postNo, ...rest }: any) {
  return scraper.getPostContent(galleryId, postNo, rest);
}

async function getPosts({ galleryId, postNumbers, delayMs = 100, onProgress, ...rest }: any) {
  const out: any[] = [];
  for (let i = 0; i < postNumbers.length; i++) {
    let no: any = postNumbers[i];
    if (typeof no !== 'string' && typeof no !== 'number') {
      if (no && typeof no === 'object' && (typeof no.id === 'string' || typeof no.id === 'number')) no = no.id;
      else { console.warn('Invalid post number entry, skip'); continue; }
    }
    try {
      const post = await scraper.getPostContent(galleryId, no, rest);
      if (post) out.push(post);
    } catch (e: any) { console.error(`post ${no} error: ${e.message}`); }
    if (typeof onProgress === 'function') onProgress(i + 1, postNumbers.length);
    if (i < postNumbers.length - 1) await delay(delayMs);
  }
  return out;
}

async function getAutocomplete(query: string) { return autocomplete.getAutocomplete(query); }
async function search(query: string, options: any = {}) { return searchModule.search(query, options); }

export = {
  getPostList,
  getPost,
  getPostListLegacy,
  getPostLegacy,
  getPosts,
  getAutocomplete,
  search,
  getPostNumbers: getPostList,
  delay,
  getRandomUserAgent,
  raw: { ...scraper, ...autocomplete, ...searchModule },
};

