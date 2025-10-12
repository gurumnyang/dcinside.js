// Public API (index.ts)
const scraper = require('./src/scraper');
const { delay, getRandomUserAgent } = require('./src/util');
const autocomplete = require('./src/autocomplete');
const searchModule = require('./src/search');
const auth = require('./src/auth');
import type {
  GetPostListOptions,
  PostInfo,
  GetPostOptions,
  Post,
  GetPostsOptions,
  MobileLoginOptions,
  MobileLoginResult,
  MobileCreatePostOptions,
  MobileCreatePostResult,
  MobileDeletePostOptions,
  MobileDeletePostResult,
  MobileCreateCommentOptions,
  MobileCreateCommentResult,
  MobileDeleteCommentOptions,
  MobileDeleteCommentResult,
} from './src/types';

async function getPostList({ page, galleryId, boardType = 'all' }: GetPostListOptions): Promise<PostInfo[]> {
  return scraper.scrapeBoardPage(page, galleryId, { boardType });
}

// Legacy: PC board list
async function getPostListLegacy({ page, galleryId, boardType = 'all' }: GetPostListOptions): Promise<PostInfo[]> {
  return scraper.scrapeBoardPageLegacy(page, galleryId, { boardType });
}

// New default: use mobile post content
async function getPost({ galleryId, postNo, ...rest }: GetPostOptions): Promise<Post | null> {
  return scraper.getMobilePostContent(galleryId, postNo, rest);
}

// Legacy PC version retained for compatibility
async function getPostLegacy({ galleryId, postNo, ...rest }: GetPostOptions): Promise<Post | null> {
  return scraper.getPostContent(galleryId, postNo, rest);
}

async function getPosts({ galleryId, postNumbers, delayMs = 100, onProgress, ...rest }: GetPostsOptions): Promise<Post[]> {
  const out: Post[] = [];
  for (let i = 0; i < postNumbers.length; i++) {
    let no: any = postNumbers[i];
    if (typeof no !== 'string' && typeof no !== 'number') {
      if (no && typeof no === 'object' && (typeof no.id === 'string' || typeof no.id === 'number')) no = no.id;
      else { console.warn('Invalid post number entry, skip'); continue; }
    }
    try {
      const post = await scraper.getMobilePostContent(galleryId, no, rest);
      if (post) out.push(post);
    } catch (e: any) { console.error(`post ${no} error: ${e.message}`); }
    if (typeof onProgress === 'function') onProgress(i + 1, postNumbers.length);
    if (i < postNumbers.length - 1) await delay(delayMs);
  }
  return out;
}

async function getAutocomplete(query: string) { return autocomplete.getAutocomplete(query); }
async function search(query: string, options: any = {}) { return searchModule.search(query, options); }

async function mobileLogin(options: MobileLoginOptions): Promise<MobileLoginResult> {
  return auth.mobileLogin(options);
}

async function createPost(options: MobileCreatePostOptions): Promise<MobileCreatePostResult> {
  return scraper.createMobilePost(options);
}

async function deletePost(options: MobileDeletePostOptions): Promise<MobileDeletePostResult> {
  return scraper.deleteMobilePost(options);
}

async function createComment(options: MobileCreateCommentOptions): Promise<MobileCreateCommentResult> {
  return scraper.createMobileComment(options);
}

async function deleteComment(options: MobileDeleteCommentOptions): Promise<MobileDeleteCommentResult> {
  return scraper.deleteMobileComment(options);
}

export = {
  getPostList,
  getPost,
  getPostListLegacy,
  getPostLegacy,
  getPosts,
  getAutocomplete,
  search,
  mobileLogin,
  createPost,
  createComment,
  deletePost,
  deleteComment,
  getPostNumbers: getPostList,
  delay,
  getRandomUserAgent,
  raw: { ...scraper, ...autocomplete, ...searchModule, ...auth },
};
