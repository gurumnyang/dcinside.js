// run.js

const readline = require('readline');
const fs = require('fs');
const axios = require('axios');
const cheerio = require('cheerio');
const cliProgress = require('cli-progress');
const path = require('path');

const { getPostContent } = require('./src/scraper');

const OUTPUT_DIR = './output';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function askQuestion(query) {
    return new Promise(resolve => {
        rl.question(query, answer => {
            resolve(answer.trim());
        });
    });
}

function validateNumberInput(input, defaultValue) {
    const number = parseInt(input, 10);
    return isNaN(number) ? defaultValue : number;
}

async function scrapePostsWithProgress(startNo, endNo, galleryId) {
    const totalPosts = endNo - startNo + 1;
    const progressBar = new cliProgress.SingleBar({
        format: '게시글 번호 크롤링 진행 |{bar}| {percentage}% || {value}/{total} 게시글',
        hideCursor: true
    }, cliProgress.Presets.shades_classic);
    progressBar.start(totalPosts, 0);

    const posts = [];
    for (let no = startNo; no <= endNo; no++) {
        try {
            const post = await getPostContent(galleryId, no);
            posts.push(post);
        } catch (error) {
            console.error(`게시글 ${no} 크롤링 중 에러 발생: ${error.message}`);
        }
        progressBar.increment();
        await new Promise(resolve => setTimeout(resolve, 50));
    }
    progressBar.stop();
    return posts;
}

async function scrapeBoardPagesWithProgress(startPage, endPage, galleryId) {
    let postNumbers = [];
    const totalPages = endPage - startPage + 1;
    const pageBar = new cliProgress.SingleBar({
        format: '게시판 페이지 번호 수집 |{bar}| {percentage}% || {value}/{total} 페이지',
        hideCursor: true
    }, cliProgress.Presets.shades_classic);
    pageBar.start(totalPages, 0);

    for (let page = startPage; page <= endPage; page++) {
        const url = `https://gall.dcinside.com/mgallery/board/lists/?id=${galleryId}&list_num=100&search_head=&page=${page}`;
        try {
            const { data } = await axios.get(url, {
                headers: { 'User-Agent': 'Mozilla/5.0' }
            });
            const $ = cheerio.load(data);
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
        pageBar.increment();
    }
    pageBar.stop();

    postNumbers = [...new Set(postNumbers)];

    const totalPosts = postNumbers.length;
    const postBar = new cliProgress.SingleBar({
        format: '게시글 크롤링 진행 |{bar}| {percentage}% || {value}/{total} 게시글',
        hideCursor: true
    }, cliProgress.Presets.shades_classic);
    postBar.start(totalPosts, 0);

    const posts = [];
    for (const no of postNumbers) {
        try {
            const post = await getPostContent(galleryId, no);
            posts.push(post);
        } catch (error) {
            console.error(`게시글 ${no} 크롤링 중 에러 발생: ${error.message}`);
        }
        postBar.increment();
        await new Promise(resolve => setTimeout(resolve, 50));
    }
    postBar.stop();
    return posts;
}

async function main() {
    try {
        console.log('DCInside 갤러리 크롤링 프로그램');
        console.log('크롤링할 갤러리 ID를 입력하세요:');

        let galleryId = await askQuestion('갤러리 ID(기본:chatgpt): ');
        if (!galleryId) {
            galleryId = 'chatgpt';
        }

        console.log("==========================");
        console.log('옵션을 선택하세요(기본:1):');
        console.log('1: 게시글 번호 범위로 크롤링');
        console.log('2: 게시판 페이지 범위로 크롤링');

        const option = await askQuestion('옵션 선택 (1 또는 2): ');
        console.log("==========================");

        let posts = [];
        if (option === '1') {
            const startNo = validateNumberInput(await askQuestion('시작 게시글 번호: '), 1);
            const endNo = validateNumberInput(await askQuestion('끝 게시글 번호: '), startNo);
            posts = await scrapePostsWithProgress(startNo, endNo, galleryId);
        } else if (option === '2') {
            const startPage = validateNumberInput(await askQuestion('시작 페이지 번호: '), 1);
            const endPage = validateNumberInput(await askQuestion('끝 페이지 번호: '), startPage);
            posts = await scrapeBoardPagesWithProgress(startPage, endPage, galleryId);
        } else {
            console.log('올바르지 않은 옵션입니다.');
            return;
        }

        console.log('크롤링 완료!');
        if (posts.length > 3) {
            console.log(`게시글 개수: ${posts.length}`);
            console.log('게시글 일부 미리보기:');
            console.log(JSON.stringify(posts.slice(0, 3), null, 2));
        } else {
            console.log(JSON.stringify(posts, null, 2));
        }

        if (!fs.existsSync(OUTPUT_DIR)) {
            fs.mkdirSync(OUTPUT_DIR);
        }

        const filename = `${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 15)}.json`;
        const filePath = path.join(OUTPUT_DIR, filename);

        fs.writeFile(filePath, JSON.stringify(posts, null, 2), (err) => {
            if (err) {
                console.error('JSON 파일 저장 실패:', err);
            } else {
                console.log(`크롤링 결과가 ${filePath} 파일에 저장되었습니다.`);
            }
        });
    } catch (error) {
        console.error('프로그램 실행 중 에러 발생:', error.message);
    } finally {
        rl.close();
    }
}

main();
