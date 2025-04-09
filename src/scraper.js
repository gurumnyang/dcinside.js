// scraper.js

const axios = require('axios');
const cheerio = require('cheerio');

const galleryId = 'chatgpt';

/**
 * 추출 항목: 게시글 번호, 제목, 작성자, 작성일, 본문, 조회수, 추천수, 비추천수, 댓글
 */
async function getPostContent(no) {
    const url = `https://gall.dcinside.com/mgallery/board/view/?id=${galleryId}&no=${no}`;
    try {
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
            }
        });
        const $ = cheerio.load(data);

        // HTML 선택자는 DCInside의 실제 페이지 구조에 따라 수정이 필요할 수 있습니다.
        const title = $('header .title_subject').text().trim();
        // 작성자: 페이지에 따라 '.gall_writer .nickname' 또는 다른 선택자가 필요할 수 있음
        const author = $('header .gall_writer .nickname').text().trim();
        const date = $('header .gall_date').text().trim();

        // 본문 영역 처리:
        // 1. 해당 영역의 cheerio 객체를 얻습니다.
        // 2. 내부의 <img> 태그를 [이미지] 로 대체한 후 텍스트로 추출합니다.
        const contentElement = $('.gallview_contents .write_div');
        contentElement.find('img').replaceWith('[이미지]\n');
        const content = contentElement.text().trim();

        // 조회수, 추천수, 비추천수 예시 (페이지 구조에 따라 선택자 조정)
        const viewCount = $('header .gall_count').text().replace("조회", "").trim() || 'null';
        const recommendCount = $('.btn_recommend_box .up_num_box .up_num').text().trim() || 'null';
        const dislikeCount = $('.btn_recommend_box .down_num_box .down_num').text().trim() || 'null';

        const e_s_n_o = $('input[name="e_s_n_o"]').val() || '';

        const comments = await getCommentsForPost(no, e_s_n_o);

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
        console.error(`게시글 ${no} 크롤링 중 에러 발생: ${error.message}`);
        return null;
    }
}

/**
 * @param {number|string} no - 게시글 번호
 * @param {string} e_s_n_o - 페이지 내 숨겨진 값
 * @returns {object|null} 댓글 데이터 (JSON) 또는 null (에러 발생 시)
 */
async function getCommentsForPost(no, e_s_n_o) {
    const url = 'https://gall.dcinside.com/board/comment/';
    const params = new URLSearchParams();
    params.append('id', galleryId);
    params.append('no', no);
    params.append('cmt_id', galleryId);
    params.append('cmt_no', no);
    params.append('focus_cno', '');
    params.append('focus_pno', '');
    params.append('e_s_n_o', e_s_n_o);
    params.append('comment_page', '1'); // 첫 페이지 댓글
    params.append('sort', '');
    params.append('prevCnt', '');
    params.append('board_type', '');
    params.append('_GALLTYPE_', 'M');

    try {
        const response = await axios.post(url, params.toString(), {
            headers: {
                "accept": "application/json, text/javascript, */*; q=0.01",
                "accept-language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
                "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
                "sec-ch-ua": "\"Chromium\";v=\"134\", \"Whale\";v=\"4\", \"Not.A/Brand\";v=\"99\"",
                "sec-ch-ua-mobile": "?0",
                "sec-ch-ua-platform": "\"Windows\"",
                "sec-fetch-dest": "empty",
                "sec-fetch-mode": "cors",
                "sec-fetch-site": "same-origin",
                "x-requested-with": "XMLHttpRequest",
                "Referer": `https://gall.dcinside.com/mgallery/board/view/?id=${galleryId}&no=${no}&exception_mode=recommend&page=1`,
                "Referrer-Policy": "unsafe-url"
            }
        });
        const comments = response.data.comments || [];
        const totalCount = response.data.total_cnt;
        let processedComments = comments.map(comment => ({
            parent: comment.parent,
            userId: comment.user_id,
            name: comment.name,
            ip: comment.ip,
            regDate: comment.reg_date,
            memo: comment.memo
        })).filter(comment => comment.name !== '댓글돌이' || comment.ip !== '');

        return {
            totalCount,
            comments: processedComments
        };

    } catch (error) {
        console.error(`댓글 불러오기 에러 (게시글 ${no}):`, error.message);
        return null;
    }
}

async function scrapePostsRange(startNo, endNo) {
    const posts = [];
    for (let no = startNo; no <= endNo; no++) {
        console.log(`게시글 ${no} 크롤링 중...`);
        const post = await getPostContent(no);
        if (post) posts.push(post);
        // 요청 간 1초 딜레이 (서버 부하 방지)
        await new Promise(resolve => setTimeout(resolve, 50));
    }
    return posts;
}

async function scrapeBoardPages(startPage, endPage) {
    const postNumbers = [];
    for (let page = startPage; page <= endPage; page++) {
        const url = `https://gall.dcinside.com/mgallery/board/lists/?id=${galleryId}&list_num=100&search_head=&page=${page}`;
        try {
            console.log(`게시판 페이지 ${page} 크롤링 중...`);
            const { data } = await axios.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0'
                }
            });
            const $ = cheerio.load(data);
            // 게시글 링크를 선택: 실제 페이지 구조에 따라 선택자 수정 필요합니다.
            $('.ub-content .gall_tit a').each((index, element) => {
                const link = $(element).attr('href');
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
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    // 중복 제거
    const uniquePostNumbers = [...new Set(postNumbers)];

    // 게시글 번호로 개별 게시글 크롤링
    const posts = [];
    for (const no of uniquePostNumbers) {
        console.log(`게시글 ${no} 크롤링 중...`);
        const post = await getPostContent(no);
        if (post) posts.push(post);
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    return posts;
}

module.exports = {
    getPostContent,
    scrapePostsRange,
    scrapeBoardPages
};
