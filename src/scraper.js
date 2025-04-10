// scraper.js

const axios = require('axios');
const cheerio = require('cheerio');

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

// 게시글 내용 크롤링
async function getPostContent(galleryId, no) {
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

// 게시판 페이지 범위 크롤링
async function scrapeBoardPages(galleryId, startPage, endPage) {
    const postNumbers = [];
    for (let page = startPage; page <= endPage; page++) {
        const url = `${BASE_URL}/mgallery/board/lists/?id=${galleryId}&list_num=100&page=${page}`;
        try {
            console.log(`게시판 페이지 ${page} 크롤링 중...`);
            const { data } = await axios.get(url, { headers: HEADERS });
            const $ = cheerio.load(data);

            $('.ub-content .gall_tit a').each((_, element) => {
                const link = $(element).attr('href');
                const match = link?.match(/no=(\d+)/);
                if (match) postNumbers.push(match[1]);
            });
        } catch (error) {
            console.error(`게시판 페이지 ${page} 크롤링 중 에러 발생: ${error.message} (URL: ${url})`);
        }
        await delay(100);
    }

    const uniquePostNumbers = [...new Set(postNumbers)];
    const posts = [];
    for (const no of uniquePostNumbers) {
        console.log(`게시글 ${no} 크롤링 중...`);
        const post = await getPostContent(galleryId, no);
        if (post) posts.push(post);
        await delay(100);
    }
    return posts;
}

module.exports = {
    getPostContent,
    scrapePostsRange,
    scrapeBoardPages
};
