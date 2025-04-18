// scraper.js

const axios = require('axios');
const cheerio = require('cheerio');
// cli-progress 제거
const { delay } = require('./util');

// 상수 정의
const BASE_URL = 'https://gall.dcinside.com';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)';
const HEADERS = { 'User-Agent': USER_AGENT };

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
 * HTML 요소 내의 이미지를 지정된 텍스트로 대체합니다.
 * @param {CheerioElement} element - 이미지를 포함하는 Cheerio 요소
 * @param {string} placeholder - 이미지 대체 텍스트
 */
const replaceImagesWithPlaceholder = (element, placeholder = '[이미지]\n') => {
    element.find('img').replaceWith(placeholder);
};

/**
 * 게시판 페이지를 크롤링하여 게시글 번호 목록을 반환합니다.
 * @param {number} startPage - 시작 페이지 번호
 * @param {number} endPage - 끝 페이지 번호
 * @param {string} galleryId - 갤러리 ID
 * @param {object} options - 크롤링 옵션
 * @param {string} options.boardType - 게시판 유형 ('all', 'recommend', 'notice')
 * @param {string|null} options.num - 게시글 번호 필터
 * @param {string|null} options.subject - 말머리 필터
 * @param {string|null} options.nickname - 닉네임 필터
 * @param {string|null} options.ip - IP 필터
 * @param {number} options.delay - 요청 간 딜레이(ms)
 * @returns {Promise<string[]>} - 수집된 게시글 번호 배열
 */
async function scrapeBoardPages(startPage, endPage, galleryId, options = {
    boardType: 'all',
    num: null,
    subject: null,
    nickname: null,
    ip: null,
    delay: 100
}) {
    // 페이지 범위가 유효하지 않은 경우 빈 배열 반환
    if (startPage <= 0 || endPage <= 0 || startPage > endPage) {
        return [];
    }
    
    const totalPages = endPage - startPage + 1;
    // console.log(`게시판 페이지 번호 수집 시작 (총 ${totalPages} 페이지)`);

    let postNumbers = [];
    for (let page = startPage; page <= endPage; page++) {
        const url = `${BASE_URL}/mgallery/board/lists/?id=${galleryId}&list_num=100&search_head=&page=${page}&exception_mode=${options.boardType}`;
        try {
            const { data } = await axios.get(url, { headers: HEADERS });
            // console.log(`\n${data.length}\n`)
            const $ = cheerio.load(data);

            $('.ub-content').each((_, element) => {

                const num = $(element).find(".gall_num").text();
                const subject = $(element).find(".gall_subject").text();
                const link = $(element).find('.gall_tit a').attr('href');
                const nickname = $(element).find(".gall_writer").attr("data-nick")
                const ip = $(element).find(".gall_writer").attr("data-ip")

                // 필터 조건에 맞지 않는 게시물은 건너뛰기
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
        // console.log(`페이지 ${page}/${endPage} 처리 완료 (${Math.round((page - startPage + 1) / totalPages * 100)}%)`);
        await delay(options?.delay); // 요청 간 딜레이
    }
    // console.log(`게시판 페이지 번호 수집 완료, 총 ${postNumbers.length}개 게시글 번호 수집됨`);

    return [...new Set(postNumbers)]; // 중복 제거 후 반환
}

/**
 * 지정된 게시글 번호의 내용을 크롤링합니다.
 * @param {string} galleryId - 갤러리 ID (기본값: chatgpt)
 * @param {string} no - 게시글 번호
 * @returns {Promise<object|null>} - 게시글 내용 객체 또는 실패 시 null
 */
async function getPostContent(galleryId="chatgpt", no) {
    // 게시글 번호가 없거나 유효하지 않은 경우 null 반환
    if (!no || typeof no !== 'string') {
        console.error('유효하지 않은 게시글 번호:', no);
        return null;
    }

    const url = `${BASE_URL}/mgallery/board/view/?id=${galleryId}&no=${no}`;
    try {
        const { data } = await axios.get(url, { headers: HEADERS });
        const $ = cheerio.load(data);

        const title = extractText($, 'header .title_subject');
        const author = extractText($, 'header .gall_writer .nickname');
        const date = extractText($, 'header .gall_date');

        const contentElement = $('.gallview_contents .write_div');
        replaceImagesWithPlaceholder(contentElement);
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

        return {
            postNo: no,
            title,
            author,
            date,
            content,
            viewCount,
            recommendCount,
            dislikeCount,
            comments
        };
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
    const params = new URLSearchParams({
        id: galleryId,
        no,
        cmt_id: galleryId,
        cmt_no: no,
        e_s_n_o,
        comment_page: '1',
        _GALLTYPE_: 'M'
    });

    try {
        const { data } = await axios.post(url, params.toString(), {
            headers: {
                ...HEADERS,
                "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
                "x-requested-with": "XMLHttpRequest",
                "Referer": `${BASE_URL}/mgallery/board/view/?id=${galleryId}&no=${no}`
            }
        });

        const comments = data.comments || [];
        const totalCount = data.total_cnt;

        const processedComments = comments.map(comment => ({
            parent: comment.parent,
            userId: comment.user_id,
            name: comment.name,
            ip: comment.ip,
            regDate: comment.reg_date,
            memo: comment.memo
        })).filter(comment => comment.name !== '댓글돌이' || comment.ip !== '');

        return { totalCount, comments: processedComments };
    } catch (error) {
        console.error(`댓글 불러오기 에러 (게시글 ${no}): ${error.message} (URL: ${url})`);
        return null;
    }
}


module.exports = {
    scrapeBoardPages,
    getPostContent
};
