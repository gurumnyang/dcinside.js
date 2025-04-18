/**
 * dcinside-crawler
 * 디시인사이드 갤러리 크롤링을 위한 Node.js 라이브러리
 * @module dcinside-crawler
 */

const { scrapeBoardPages, getPostContent } = require('./src/scraper');
const { delay, getRandomUserAgent } = require('./src/util');
const scraper = require('./src/scraper');

/**
 * 페이지 범위로 게시글 번호 목록을 수집합니다.
 *
 * @param {Object} options - 크롤링 옵션
 * @param {number} options.startPage - 시작 페이지 번호
 * @param {number} options.endPage - 끝 페이지 번호
 * @param {string} options.galleryId - 갤러리 ID
 * @param {string} [options.exceptionMode='all'] - 게시판 유형 ('all', 'recommend', 'notice')
 * @param {number} [options.delayMs=100] - 요청 간 지연 시간(ms)
 * @returns {Promise<string[]>} 수집된 게시글 번호 배열
 */
async function getPostList(options) {
  const { startPage, endPage, galleryId, exceptionMode = 'all', delayMs = 100 } = options;
  
  return await scrapeBoardPages(
    startPage, 
    endPage, 
    galleryId, 
    { 
      exception_mode: exceptionMode,
      delay: delayMs
    }
  );
}

/**
 * 게시글 번호로 게시글 내용을 가져옵니다.
 *
 * @param {Object} options - 크롤링 옵션
 * @param {string} options.galleryId - 갤러리 ID
 * @param {string} options.postNo - 게시글 번호
 * @returns {Promise<Object|null>} 게시글 내용 객체 또는 실패 시 null
 */
async function getPost(options) {
  const { galleryId, postNo } = options;
  return await getPostContent(galleryId, postNo);
}

/**
 * 여러 게시글 번호로 게시글 내용을 가져옵니다.
 *
 * @param {Object} options - 크롤링 옵션
 * @param {string} options.galleryId - 갤러리 ID
 * @param {string[]} options.postNumbers - 게시글 번호 배열
 * @param {number} [options.delayMs=100] - 요청 간 지연 시간(ms)
 * @param {function} [options.onProgress] - 진행 상황 콜백 함수 (current, total)
 * @returns {Promise<Object[]>} 수집된 게시글 객체 배열
 */
async function getPosts(options) {
  const { galleryId, postNumbers, delayMs = 100, onProgress } = options;
  
  const posts = [];
  const total = postNumbers.length;
  
  for (let i = 0; i < total; i++) {
    try {
      const post = await getPostContent(galleryId, postNumbers[i]);
      if (post) {
        posts.push(post);
      }
    } catch (error) {
      console.error(`게시글 ${postNumbers[i]} 크롤링 중 에러 발생: ${error.message}`);
    }
    
    if (typeof onProgress === 'function') {
      onProgress(i + 1, total);
    }
    
    if (i < total - 1) {
      await delay(delayMs);
    }
  }
  
  return posts;
}

/**
 * 페이지 범위로 게시글을 수집합니다.
 *
 * @param {Object} options - 크롤링 옵션
 * @param {number} options.startPage - 시작 페이지 번호
 * @param {number} options.endPage - 끝 페이지 번호
 * @param {string} options.galleryId - 갤러리 ID
 * @param {string} [options.exceptionMode='all'] - 게시판 유형 ('all', 'recommend', 'notice')
 * @param {number} [options.pageDelayMs=100] - 페이지 요청 간 지연 시간(ms)
 * @param {number} [options.postDelayMs=100] - 게시글 요청 간 지연 시간(ms)
 * @param {function} [options.onPageProgress] - 페이지 진행 상황 콜백 함수 (current, total)
 * @param {function} [options.onPostProgress] - 게시글 진행 상황 콜백 함수 (current, total)
 * @returns {Promise<Object[]>} 수집된 게시글 객체 배열
 */
async function crawlGalleryPages(options) {
  const { 
    startPage, 
    endPage, 
    galleryId, 
    exceptionMode = 'all', 
    pageDelayMs = 100,
    postDelayMs = 100,
    onPageProgress,
    onPostProgress
  } = options;
  
  // 페이지에서 게시글 번호 수집
  const postNumbers = await getPostList({
    startPage,
    endPage,
    galleryId,
    exceptionMode,
    delayMs: pageDelayMs,
    onProgress: onPageProgress
  });
  
  // 게시글 내용 수집
  return await getPosts({
    galleryId,
    postNumbers,
    delayMs: postDelayMs,
    onProgress: onPostProgress
  });
}

module.exports = {
  // 노출할 주요 함수들
  getPostList,
  getPost,
  getPosts,
  crawlGalleryPages,
  
  // 이전 함수명도 호환성을 위해 유지
  getPostNumbers: getPostList,
  scrapePages: crawlGalleryPages,
  
  // 유틸리티 함수
  delay,
  getRandomUserAgent,
  
  // 원본 함수들도 노출 (고급 사용자를 위해)
  raw: scraper
};