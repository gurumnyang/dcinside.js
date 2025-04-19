// scraper.js

const axios = require('axios');
const cheerio = require('cheerio');
const { delay, CrawlError, createHttpError, withRetry, getRandomUserAgent } = require('./util');
const config = require('./config');

// 설정에서 상수 불러오기
const { BASE_URL } = config;
const { USER_AGENT, TIMEOUT, RETRY_ATTEMPTS, RETRY_DELAY } = config.HTTP;
const { DEFAULT_GALLERY_ID, DELAY_BETWEEN_REQUESTS } = config.CRAWL;
const HEADERS = { 'User-Agent': USER_AGENT };

// Axios 인스턴스 생성
const axiosInstance = axios.create({
    timeout: TIMEOUT,
    headers: HEADERS,
});

/**
 * HTTP GET 요청을 수행하고 필요시 재시도합니다.
 * @param {string} url - 요청 URL
 * @param {object} options - axios 옵션
 * @returns {Promise<object>} - 응답 데이터
 * @throws {CrawlError} - 요청 실패 시
 */
async function fetchWithRetry(url, options = {}) {
    const retryOptions = {
        maxRetries: RETRY_ATTEMPTS,
        delayMs: RETRY_DELAY,
        exponentialBackoff: true
    };

    try {
        return await withRetry(async () => {
            // 매 요청마다 다른 User-Agent 사용 (선택적)
            if (config.CRAWL.RANDOM_USER_AGENT) {
                options.headers = {
                    ...options.headers,
                    'User-Agent': getRandomUserAgent()
                };
            }
            
            const response = await axiosInstance.get(url, options);
            return response.data;
        }, retryOptions);
    } catch (error) {
        // HTTP 에러를 적절한 CrawlError로 변환
        if (axios.isAxiosError(error)) {
            const crawlError = createHttpError(error, `GET 요청 실패: ${url}`, {
                method: 'GET',
                options
            });
            
            // DEBUG 모드일 경우 상세 로깅
            if (config.DEBUG.ENABLED) {
                crawlError.logError(config.DEBUG.VERBOSE);
            } else {
                console.error(`요청 실패: ${url} - ${crawlError.message}`);
            }
            
            throw crawlError;
        }
        
        throw new CrawlError(`알 수 없는 에러: ${error.message}`, 'unknown', error);
    }
}

/**
 * HTTP POST 요청을 수행하고 필요시 재시도합니다.
 * @param {string} url - 요청 URL
 * @param {string|object} data - POST 요청 데이터
 * @param {object} options - axios 옵션
 * @returns {Promise<object>} - 응답 데이터
 * @throws {CrawlError} - 요청 실패 시
 */
async function postWithRetry(url, data, options = {}) {
    const retryOptions = {
        maxRetries: RETRY_ATTEMPTS,
        delayMs: RETRY_DELAY,
        exponentialBackoff: true
    };

    try {
        return await withRetry(async () => {
            // 매 요청마다 다른 User-Agent 사용 (선택적)
            if (config.CRAWL.RANDOM_USER_AGENT) {
                options.headers = {
                    ...options.headers,
                    'User-Agent': getRandomUserAgent()
                };
            }
            
            const response = await axiosInstance.post(url, data, options);
            return response.data;
        }, retryOptions);
    } catch (error) {
        // HTTP 에러를 적절한 CrawlError로 변환
        if (axios.isAxiosError(error)) {
            const crawlError = createHttpError(error, `POST 요청 실패: ${url}`, {
                method: 'POST',
                options
            });
            
            // DEBUG 모드일 경우 상세 로깅
            if (config.DEBUG.ENABLED) {
                crawlError.logError(config.DEBUG.VERBOSE);
            } else {
                console.error(`요청 실패: ${url} - ${crawlError.message}`);
            }
            
            throw crawlError;
        }
        
        throw new CrawlError(`알 수 없는 에러: ${error.message}`, 'unknown', error);
    }
}

/**
 * 선택자에 해당하는 텍스트를 추출합니다.
 * @param {CheerioStatic} $ - Cheerio 객체
 * @param {string} selector - CSS 선택자
 * @param {string} defaultValue - 텍스트가 없을 경우 반환할 기본값
 * @returns {string} - 추출된 텍스트 또는 기본값
 */
const extractText = ($, selector, defaultValue = '') => {
    return $(selector).text().trim() || defaultValue;
};

/**
 * HTML 요소 내의 이미지를 처리합니다.
 * @param {CheerioElement} element - 이미지를 포함하는 Cheerio 요소
 * @param {object} options - 이미지 처리 옵션
 * @param {string} options.mode - 처리 모드 ('replace', 'extract', 'both')
 * @param {string} options.placeholder - 이미지 대체 텍스트
 * @param {boolean} options.includeSource - 이미지 소스 URL 포함 여부
 * @returns {Array<string>|null} - 'extract' 모드일 경우 이미지 URL 배열, 아닌 경우 null
 */
const processImages = (element, options = {}) => {
    const {
        mode = 'replace',
        placeholder = '[이미지]\n',
        includeSource = false,
    } = options;
    
    const imageUrls = [];
    
    // 이미지 URL 추출
    if (mode === 'extract' || mode === 'both') {
        element.find('img').each((_, img) => {
            const src = img.attribs.src || '';
            const dataSrc = img.attribs['data-src'] || '';
            const imageUrl = dataSrc || src;
            
            if (imageUrl) {
                // 상대 경로인 경우 절대 경로로 변환
                const fullUrl = imageUrl.startsWith('http') 
                    ? imageUrl 
                    : `${BASE_URL}${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}`;
                
                imageUrls.push(fullUrl);
            }
        });
    }
    
    // 이미지 텍스트로 대체
    if (mode === 'replace' || mode === 'both') {
        element.find('img').each((i, img) => {
            const replacement = includeSource && imageUrls[i] 
                ? `[이미지: ${imageUrls[i]}]\n` 
                : placeholder;
            
            img.tagName = 'span';
            img.attribs = {};
            img.children = [{
                data: replacement,
                type: 'text'
            }];
        });
    }
    
    return mode === 'extract' || mode === 'both' ? imageUrls : null;
};

/**
 * 이미지를 텍스트로 대체하는 레거시 함수 (호환성 유지)
 * @param {CheerioElement} element - 이미지를 포함하는 Cheerio 요소
 * @param {string} placeholder - 이미지 대체 텍스트
 */
const replaceImagesWithPlaceholder = (element, placeholder = '[이미지]\n') => {
    processImages(element, { mode: 'replace', placeholder });
};

/**
 * 게시판 페이지를 크롤링하여 게시글 번호 목록을 반환합니다.
 * @param {number} page - 페이지 번호
 * @param {string} galleryId - 갤러리 ID
 * @param {object} options - 크롤링 옵션
 * @param {string} options.boardType - 게시판 유형 ('all', 'recommend', 'notice')
 * @param {string|null} options.num - 게시글 번호 필터
 * @param {string|null} options.subject - 말머리 필터
 * @param {string|null} options.nickname - 닉네임 필터
 * @param {string|null} options.ip - IP 필터
 * @returns {Promise<string[]>} - 수집된 게시글 번호 배열
 */
async function scrapeBoardPages(page, galleryId, options = {
    boardType: 'all',
    num: null,
    subject: null,
    nickname: null,
    ip: null,
}) {
    // 페이지 범위가 유효하지 않은 경우 빈 배열 반환
    if (page <= 0) {
        return [];
    }
    
    let postNumbers = [];
    const url = `${BASE_URL}/mgallery/board/lists/?id=${galleryId}&list_num=100&search_head=&page=${page}&exception_mode=${options.boardType}`;
    try {
        const data = await fetchWithRetry(url);
        const $ = cheerio.load(data);

        $('.ub-content').each((_, element) => {
            const num = $(element).find(".gall_num").text();
            const subject = $(element).find(".gall_subject").text();
            const link = $(element).find('.gall_tit a').attr('href');
            const nickname = $(element).find(".gall_writer").attr("data-nick")
            const ip = $(element).find(".gall_writer").attr("data-ip")

            // 필터 조건에 맞지 않는 게시물 제외
            const shouldSkip = (
                (options.num && options.num !== num) ||
                (options.subject && options.subject !== subject) ||
                (options.nickname && options.nickname !== nickname) ||
                (options.ip && options.ip !== ip)
            );
            
            if (shouldSkip) return;

            if (link) {
                const match = link.match(/no=(\d+)/);
                if (match) {
                    postNumbers.push(match[1]);
                }
            }
        });
    } catch (error) {
        console.error(`게시판 페이지 ${page} 크롤링 중 에러 발생: ${error.message}`);
    }

    return [...new Set(postNumbers)]; // 중복 제거 후 반환
}

/**
 * 지정된 게시글 번호의 내용을 크롤링합니다.
 * @param {string} galleryId - 갤러리 ID (기본값: chatgpt)
 * @param {string|number} no - 게시글 번호 (문자열 또는 숫자 타입)
 * @param {object} options - 크롤링 옵션
 * @param {boolean} options.extractImages - 이미지 URL 추출 여부 (기본값: false)
 * @param {boolean} options.includeImageSource - 본문에 이미지 URL 포함 여부 (기본값: false)
 * @returns {Promise<object|null>} - 게시글 내용 객체 또는 실패 시 null
 */
async function getPostContent(galleryId="chatgpt", no, options = {}) {
    // 옵션 기본값 설정
    const {
        extractImages = false,
        includeImageSource = false
    } = options;

    // 게시글 번호 유효성 검증 및 문자열 변환
    if (no === undefined || no === null) {
        console.error('게시글 번호가 제공되지 않았습니다.');
        return null;
    }
    
    // 숫자 또는 문자열 타입을 문자열로 통일
    const postNo = String(no);
    
    if (!postNo) {
        console.error('유효하지 않은 게시글 번호:', no);
        return null;
    }

    const url = `${BASE_URL}/mgallery/board/view/?id=${galleryId}&no=${postNo}`;
    try {
        const data = await fetchWithRetry(url);
        const $ = cheerio.load(data);

        const title = extractText($, 'header .title_subject');
        const author = extractText($, 'header .gall_writer .nickname');
        const date = extractText($, 'header .gall_date');

        const contentElement = $('.gallview_contents .write_div');
        
        // 이미지 처리 옵션 설정
        const imageOptions = {
            mode: extractImages ? 'both' : 'replace',
            placeholder: '[이미지]\n',
            includeSource: includeImageSource
        };
        
        // 이미지 처리하고 URL 추출
        const imageUrls = processImages(contentElement, imageOptions);
        
        // 줄바꿈 처리 개선
        contentElement.find('br').replaceWith('\n');
        contentElement.find('p, div, li').each((_, element) => {
            const $element = $(element);
            $element.after('\n');
        });
        const content = contentElement.text().trim();

        const viewCount = extractText($, 'header .gall_count').replace("조회", "") || 'null';
        const recommendCount = extractText($, '.btn_recommend_box .up_num_box .up_num', 'null');
        const dislikeCount = extractText($, '.btn_recommend_box .down_num_box .down_num', 'null');

        const e_s_n_o = $('input[name="e_s_n_o"]').val() || '';
        const comments = await getCommentsForPost(no, galleryId, e_s_n_o);

        const result = {
            postNo,
            title,
            author,
            date,
            content,
            viewCount,
            recommendCount,
            dislikeCount,
            comments
        };
        
        // 이미지 URL이 추출되었으면 결과에 추가
        if (extractImages && imageUrls && imageUrls.length > 0) {
            result.images = imageUrls;
        }

        return result;
    } catch (error) {
        console.error(`게시글 ${no} 크롤링 중 에러 발생: ${error.message} (URL: ${url})`);
        return null;
    }
}

/**
 * 게시글의 댓글을 크롤링합니다.
 * @param {string} no - 게시글 번호
 * @param {string} galleryId - 갤러리 ID
 * @param {string} e_s_n_o - 댓글 로드에 필요한 CSRF 토큰 값
 * @returns {Promise<object|null>} - 댓글 정보 객체 또는 실패 시 null
 */
async function getCommentsForPost(no, galleryId, e_s_n_o) {
    const url = `${BASE_URL}/board/comment/`;
    let allComments = [];
    let currentPage = 1;
    let totalCount = 0;
    const maxPages = config.CRAWL.MAX_COMMENT_PAGES;

    try {
        // 모든 댓글 페이지를 순회하면서 수집
        while (currentPage <= maxPages) {
            const params = new URLSearchParams({
                id: galleryId,
                no,
                cmt_id: galleryId,
                cmt_no: no,
                e_s_n_o,
                comment_page: currentPage.toString(),
                _GALLTYPE_: 'M'
            });

            const data = await postWithRetry(url, params.toString(), {
                headers: {
                    ...HEADERS,
                    "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
                    "x-requested-with": "XMLHttpRequest",
                    "Referer": `${BASE_URL}/mgallery/board/view/?id=${galleryId}&no=${no}`
                }
            });

            const comments = data.comments || [];
            totalCount = data.total_cnt;

            // 이 페이지의 댓글 처리
            const processedComments = comments.map(comment => ({
                parent: comment.parent,
                userId: comment.user_id,
                name: comment.name,
                ip: comment.ip,
                regDate: comment.reg_date,
                memo: comment.memo
            })).filter(comment => comment.name !== '댓글돌이' || comment.ip !== '');

            allComments = [...allComments, ...processedComments];
            
            // 더 이상 댓글이 없으면 중단
            if (!comments.length || comments.length < config.CRAWL.COMMENT_PAGE_SIZE) {
                break;
            }

            // 너무 많은 요청을 방지하기 위한 지연
            await delay(DELAY_BETWEEN_REQUESTS);
            currentPage++;
        }

        return { totalCount, comments: allComments };
    } catch (error) {
        console.error(`댓글 불러오기 에러 (게시글 ${no}): ${error.message} (URL: ${url})`);
        return null;
    }
}


module.exports = {
    scrapeBoardPages,
    getPostContent,
    getCommentsForPost,  // 댓글 수집 함수 외부 노출
    extractText,         // 유틸리티 함수 외부 노출
    replaceImagesWithPlaceholder,  // 이미지 처리 유틸리티 함수 외부 노출
    processImages        // 이미지 처리 유틸리티 함수 외부 노출
};
