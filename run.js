// run.js

const readline = require('readline');
const fs = require('fs');
const axios = require('axios');
const cheerio = require('cheerio');
const cliProgress = require('cli-progress');
const path = require('path');

const { getPostContent } = require('./src/scraper');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const galleryId = 'chatgpt'; // 갤러리 ID

function askQuestion(query) {
    return new Promise(resolve => {
        rl.question(query, answer => {
            resolve(answer);
        });
    });
}

async function scrapePostsWithProgress(startNo, endNo) {
    const totalPosts = endNo - startNo + 1;
    const progressBar = new cliProgress.SingleBar({
        format: '게시글 번호 크롤링 진행 |{bar}| {percentage}% || {value}/{total} 게시글',
        hideCursor: true
    }, cliProgress.Presets.shades_classic);
    progressBar.start(totalPosts, 0);

    const posts = [];
    for (let no = startNo; no <= endNo; no++) {
        const post = await getPostContent(no);
        posts.push(post);
        progressBar.increment();
        await new Promise(resolve => setTimeout(resolve, 50));
    }
    progressBar.stop();
    return posts;
}

async function scrapeBoardPagesWithProgress(startPage, endPage) {
    // 1단계: 게시판 목록 페이지에서 게시글 번호 수집
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

    // 중복 제거
    postNumbers = [...new Set(postNumbers)];

    // 2단계: 수집된 게시글 번호에 대해 개별 게시글 크롤링
    const totalPosts = postNumbers.length;
    const postBar = new cliProgress.SingleBar({
        format: '게시글 크롤링 진행 |{bar}| {percentage}% || {value}/{total} 게시글',
        hideCursor: true
    }, cliProgress.Presets.shades_classic);
    postBar.start(totalPosts, 0);

    const posts = [];
    for (const no of postNumbers) {
        const post = await getPostContent(no);
        posts.push(post);
        postBar.increment();
        await new Promise(resolve => setTimeout(resolve, 50));
    }
    postBar.stop();
    return posts;
}

async function main() {
    console.log('DCInside 갤러리 크롤링 프로그램');
    console.log('옵션을 선택하세요:');
    console.log('1: 게시글 번호 범위로 크롤링');
    console.log('2: 게시판 페이지 범위로 크롤링');

    const option = await askQuestion('옵션 선택 (1 또는 2): ');
    let posts = [];
    if (option === '1') {
        const startNo = parseInt(await askQuestion('시작 게시글 번호: '), 10);
        const endNo = parseInt(await askQuestion('끝 게시글 번호: '), 10);
        posts = await scrapePostsWithProgress(startNo, endNo);
    } else if (option === '2') {
        const startPage = parseInt(await askQuestion('시작 페이지 번호: '), 10);
        const endPage = parseInt(await askQuestion('끝 페이지 번호: '), 10);
        posts = await scrapeBoardPagesWithProgress(startPage, endPage);
    } else {
        console.log('올바르지 않은 옵션입니다.');
        rl.close();
        return;
    }

    console.log('크롤링 완료!');
    if(posts.length > 3) {
        console.log(`게시글 개수: ${posts.length}`);
        console.log('게시글 일부 미리보기:');
        console.log(JSON.stringify(posts.slice(0, 3), null, 2));
    } else {
        console.log(JSON.stringify(posts, null, 2));
    }

    const filename = new Date().toISOString().replace(/[-:T]/g, '').slice(2, 8) + '-' + new Date().toTimeString().slice(0, 8).replace(/:/g, '') + '.json';

    if(!fs.existsSync('./output')) {
        fs.mkdirSync('./output');
    }
    
    fs.writeFile(path.join("./output/", filename), JSON.stringify(posts, null, 2), (err) => {
        if (err) {
            console.error('JSON 파일 저장 실패:', err);
        } else {
            console.log(`크롤링 결과가 ${filename} 파일에 저장되었습니다.`);
        }
        rl.close();
    });
}

main();
