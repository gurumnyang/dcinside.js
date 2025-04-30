/**
 * @gurumnyang/dcinside.js
 * 디시인사이드 갤러리 크롤링을 위한 Node.js 라이브러리
 * @module @gurumnyang/dcinside.js
 */

const { scrapeBoardPage, getPostContent } = require('./src/scraper');
const { delay, getRandomUserAgent } = require('./src/util');
const scraper = require('./src/scraper');

/**
 * 게시글 정보 객체 타입 정의
 * @typedef {Object} PostInfo
 * @property {string} num - 게시글 번호
 * @property {string} type - 게시글 유형 ('notice', 'picture', 'text', 'recommended', 'unknown')
 * @property {string} subject - 말머리
 * @property {string} title - 게시글 제목
 * @property {string} link - 게시글 URL
 * @property {Object} author - 작성자 정보
 * @property {string} author.nickname - 작성자 닉네임
 * @property {string} author.userId - 작성자 ID
 * @property {string} author.ip - 작성자 IP
 * @property {string} date - 작성 날짜
 * @property {number} count - 조회수
 * @property {number} recommend - 추천수
 * @property {number} replyCount - 댓글 수
 */

/**
 * 특정 페이지의 게시글 목록을 수집합니다.
 *
 * @param {Object} options - 크롤링 옵션
 * @param {number} options.page - 페이지 번호
 * @param {string} options.galleryId - 갤러리 ID
 * @param {string} [options.boardType='all'] - 게시판 유형 ('all', 'recommend', 'notice')
 * @returns {Promise<Array<PostInfo>>}
 */
async function getPostList(options) {
  const { page, galleryId, boardType = 'all'} = options;
  
  return await scrapeBoardPage(
    page, 
    galleryId, 
    { 
      boardType
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

      if(typeof postNumbers[i] !== 'string' && typeof postNumbers[i] !== 'number') {
        console.warn(`options.postNumbers는 숫자 또는 문자열 배열이어야 합니다.`);
        if(typeof postNumbers[i] === 'object' && postNumbers[i] !== null) {
          if(typeof postNumbers[i].id === 'string' || typeof postNumbers[i].id === 'number') {
            postNumbers[i] = postNumbers[i].id;
          } else {
            console.warn(`게시글 번호 ${postNumbers[i]}는 무시됩니다.`);
            continue;
          }
        }
      }

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

module.exports = {
  // 노출할 주요 함수들
  getPostList,
  getPost,
  getPosts,
  
  // 이전 함수명도 호환성을 위해 유지
  getPostNumbers: getPostList,
  
  // 유틸리티 함수
  delay,
  getRandomUserAgent,
  
  // 원본 함수들도 노출 (고급 사용자를 위해)
  raw: scraper
};