// scraper.js

const axios = require('axios');
const cheerio = require('cheerio');
const cliProgress = require('cli-progress');

// 상수 정의
const BASE_URL = 'https://gall.dcinside.com';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)';
const HEADERS = { 'User-Agent': USER_AGENT };

// 유틸리티 함수
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const extractText = ($, selector, defaultValue = '') => {
    return $(selector).text().trim() || defaultValue;
};

const replaceImagesWithPlaceholder = (element, placeholder = '[이미지]\n') => {
    element.find('img').replaceWith(placeholder);
};


// 게시판 페이지 크롤링
/**
 *
 * @param startPage
 * @param endPage
 * @param galleryId
 * @param options
 * @return {Promise<*[]>}
 */
async function scrapeBoardPages(startPage, endPage, galleryId, options = {
    exception_mode: 'all',
    num: null,
    subject: null,
    nickname: null,
    ip: null
}) {
    const totalPages = endPage - startPage + 1;
    const pageBar = new cliProgress.SingleBar({
        format: '게시판 페이지 번호 수집 |{bar}| {percentage}% || {value}/{total} 페이지',
        hideCursor: true
    }, cliProgress.Presets.shades_classic);
    pageBar.start(totalPages, 0);

    let postNumbers = [];
    for (let page = startPage; page <= endPage; page++) {
        const url = `${BASE_URL}/mgallery/board/lists/?id=${galleryId}&list_num=100&search_head=&page=${page}&exception_mode=${options.exception_mode}`;
        try {
            const { data } = await axios.get(url, { headers: HEADERS });
            const $ = cheerio.load(data);

            $('.ub-content').each((_, element) => {

                const num = $(element).find(".gall_num").text();
                const subject = $(element).find(".gall_subject").text();
                const link = $(element).find('.gall_tit a').attr('href');
                const nickname = $(element).find(".gall_writer").attr("data-nick")
                const ip = $(element).find(".gall_writer").attr("data-ip")

                if(options.num && options.num !== num) return;
                if(options.subject && options.subject !== subject) return;
                if(options.nickname && options.nickname !== nickname) return;
                if(options.ip && options.ip !== ip) return;

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
        pageBar.increment()
        await delay(100); // 요청 간 딜레이
    }
    pageBar.stop();

    return [...new Set(postNumbers)]; // 중복 제거 후 반환
}

/**
 *
 * @param galleryId
 * @param no
 * @param type - 'all', 'recommend', 'notice'
 */
async function getPostContent(galleryId="chatgpt", no, type="all") {
    const url = `${BASE_URL}/mgallery/board/view/?id=${galleryId}&no=${no}&exception_mode=${type}`;
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

// 댓글 크롤링
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

// 게시글 번호 범위 크롤링
async function scrapePostsRange(startNo, endNo, galleryId) {
    const posts = [];
    for (let no = startNo; no <= endNo; no++) {
        console.log(`게시글 ${no} 크롤링 중...`);
        const post = await getPostContent(galleryId, no);
        if (post) posts.push(post);
        await delay(50); // 요청 간 딜레이
    }
    return posts;
}


module.exports = {
    scrapeBoardPages,
    getPostContent
};
