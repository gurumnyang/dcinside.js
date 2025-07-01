// run.js
const fs = require('fs');
const path = require('path');
const cliProgress = require('cli-progress');
const { getPostList, getPost, getPosts, delay } = require('./index');
const { validateNumberInput } = require('./src/util');
const askQuestion = require('./src/askQuestion');

const OUTPUT_DIR = './output';

/**
 * 게시글 번호 범위로 크롤링을 진행합니다.
 * @param {number} startNo 시작 게시글 번호
 * @param {number} endNo 종료 게시글 번호
 * @param {string} galleryId 갤러리 식별자
 * @returns {Promise<Object[]>} 크롤링된 게시글 배열
 */
async function scrapePostsWithProgress(startNo, endNo, galleryId) {
    // 시작번호와 종료번호를 정렬하여 배열 생성
    if (startNo > endNo) {
        [startNo, endNo] = [endNo, startNo];
    }
    const numbers = Array.from({ length: endNo - startNo + 1 }, (_, i) => startNo + i);
    return scrapePostsWithArray(numbers, galleryId);
}

/**
 * 주어진 게시글 번호 배열을 사용해 게시글을 크롤링합니다.
 * @param {number[]} numbers 게시글 번호 배열
 * @param {string} galleryId 갤러리 식별자
 * @returns {Promise<Object[]>} 크롤링된 게시글 배열
 */
async function scrapePostsWithArray(numbers, galleryId) {
    const totalPosts = numbers.length;
    const progressBar = new cliProgress.SingleBar({
        format: '게시글 크롤링 진행 |{bar}| {percentage}% || {value}/{total} 게시글',
        hideCursor: true
    }, cliProgress.Presets.shades_classic);
    progressBar.start(totalPosts, 0);
    const posts = await getPosts({
        galleryId,
        postNumbers: numbers,
        delayMs: 50,
        onProgress: () => progressBar.increment()
    });
    progressBar.stop();
    return posts;
}

/**
 * 게시판 페이지 범위로 게시글을 크롤링합니다.
 * @param {number} startPage 시작 페이지 번호
 * @param {number} endPage 종료 페이지 번호
 * @param {string} galleryId 갤러리 식별자
 * @param {string} [typeParam='all'] 게시판 유형 ('all', 'recommend', 'notice')
 * @returns {Promise<Object[]>} 크롤링된 게시글 배열
 */
async function scrapeBoardPagesWithProgress(startPage, endPage, galleryId, typeParam = 'all') {
    // 게시글 번호 수집
    let postNumbers = [];
    
    // 페이지 진행상황 표시 막대
    const pageBar = new cliProgress.SingleBar({
        format: '페이지 진행 |{bar}| {percentage}% || {value}/{total} 페이지',
        hideCursor: true
    }, cliProgress.Presets.shades_classic);
    
    pageBar.start(endPage - startPage + 1, 0);
    
    // 각 페이지별로 게시글 번호 수집
    for (let page = startPage; page <= endPage; page++) {
        const pagePostNumbers = await getPostList({
            page,
            galleryId,
            boardType: typeParam,
            delayMs: 10
        });
        postNumbers.push(...pagePostNumbers);
        pageBar.increment();
        await delay(1000); // 페이지 간 딜레이
    }
    
    pageBar.stop();

    postNumbers = postNumbers.map(post => post.id);
    
    // 중복 제거
    postNumbers = Array.from(new Set(postNumbers));
    
    // 이미 구현된 scrapePostsWithArray 함수 재활용
    return await scrapePostsWithArray(postNumbers, galleryId);
}

/**
 * 게시판 페이지 범위로 게시글 정보만 스크랩합니다 (내용 제외)
 * @param {number} startPage 시작 페이지 번호
 * @param {number} endPage 종료 페이지 번호
 * @param {string} galleryId 갤러리 식별자
 * @param {string} [typeParam='all'] 게시판 유형 ('all', 'recommend', 'notice')
 * @returns {Promise<Object[]>} 스크랩된 게시글 정보 배열
 */
async function scrapeBoardInfoOnly(startPage, endPage, galleryId, typeParam = 'all') {
    let postInfoList = [];
    
    // 페이지 진행상황 표시 막대
    const pageBar = new cliProgress.SingleBar({
        format: '페이지 진행 |{bar}| {percentage}% || {value}/{total} 페이지',
        hideCursor: true
    }, cliProgress.Presets.shades_classic);
    
    pageBar.start(endPage - startPage + 1, 0);
    
    // 각 페이지별로 게시글 정보 수집
    for (let page = startPage; page <= endPage; page++) {
        const pagePostInfo = await getPostList({
            page,
            galleryId,
            boardType: typeParam,
            delayMs: 10
        });
        postInfoList.push(...pagePostInfo);
        pageBar.increment();
        await delay(100); // 페이지 간 딜레이
    }
    
    pageBar.stop();
    console.log(`총 ${postInfoList.length}개의 게시글 정보가 수집되었습니다.`);
    
    // 중복 제거 (id 기준)
    const uniquePostIds = new Set();
    postInfoList = postInfoList.filter(post => {
        if (uniquePostIds.has(post.id)) {
            return false;
        }
        uniquePostIds.add(post.id);
        return true;
    });
    
    console.log(`중복 제거 후 ${postInfoList.length}개의 게시글 정보가 남았습니다.`);
    return postInfoList;
}

/**
 * 메인 실행 함수: 사용자 입력에 따라 적절한 크롤링 작업을 수행합니다.
 */
async function main() {
    try {
        console.log('DCInside 갤러리 크롤링 프로그램');

        // 갤러리 ID 입력 받기
        const galleryInput = await askQuestion('갤러리 ID(기본:chatgpt): ');
        const galleryId = galleryInput || 'chatgpt';

        // 옵션 선택
        console.log("==========================");
        console.log('옵션을 선택하세요(기본:1):');
        console.log('1: 게시글 번호 범위로 크롤링');
        console.log('2: 게시판 페이지 범위로 크롤링');
        console.log('3: 게시글 번호로 크롤링');
        console.log('4: 게시판 정보만 스크랩 (내용 제외)');

        const option = await askQuestion('옵션 선택 (1~4): ');
        if (!['1', '2', '3', '4'].includes(option)) {
            console.log('올바르지 않은 옵션입니다.');
            return;
        }

        let typeParam = 'all';
        if (option === '2' || option === '4') {
            console.log("==========================");
            console.log('게시판을 선택하세요(기본:1):');
            console.log('1: 전체글');
            console.log('2: 개념글');
            console.log('3: 공지');

            const typeInput = await askQuestion('게시판 선택 (1~3): ');
            switch (typeInput) {
                case '1':
                    typeParam = 'all';
                    break;
                case '2':
                    typeParam = 'recommend';
                    break;
                case '3':
                    typeParam = 'notice';
                    break;
                default:
                    console.log('올바르지 않은 게시판입니다. 전체글로 설정합니다.');
                    typeParam = 'all';
                    break;
            }
        }

        let posts = [];
        let outputFormat = 'json'; // 기본 출력 형식

        if (option === '1') {
            const startNo = validateNumberInput(await askQuestion('시작 게시글 번호: '), 1);
            const endNo = validateNumberInput(await askQuestion('끝 게시글 번호: '), startNo);
            posts = await scrapePostsWithProgress(startNo, endNo, galleryId);
        } else if (option === '2') {
            const startPage = validateNumberInput(await askQuestion('시작 페이지 번호: '), 1);
            const endPage = validateNumberInput(await askQuestion('끝 페이지 번호: '), startPage);
            posts = await scrapeBoardPagesWithProgress(startPage, endPage, galleryId, typeParam);
        } else if (option === '3') {
            const input = await askQuestion('게시글 번호 (쉼표로 구분): ');
            const numbers = input.split(',').map(num => parseInt(num.trim())).filter(num => !isNaN(num));
            if (numbers.length === 0) {
                console.log('유효한 게시글 번호가 없습니다.');
                return;
            }
            posts = await scrapePostsWithArray(numbers, galleryId);
        } else if (option === '4') {
            const startPage = validateNumberInput(await askQuestion('시작 페이지 번호: '), 1);
            const endPage = validateNumberInput(await askQuestion('끝 페이지 번호: '), startPage);
            posts = await scrapeBoardInfoOnly(startPage, endPage, galleryId, typeParam);
            
            console.log("==========================");
            console.log('출력 형식을 선택하세요(기본:1):');
            console.log('1: JSON 형식');
            console.log('2: CSV 형식');
            
            const formatInput = await askQuestion('출력 형식 (1~2): ');
            outputFormat = formatInput === '2' ? 'csv' : 'json';
        }

        console.log('크롤링 완료!');
        if (posts.length > 3) {
            console.log(`게시글 개수: ${posts.length}`);
            console.log('게시글 일부 미리보기:');
            console.log(JSON.stringify(posts.slice(0, 3), null, 2));
        } else {
            console.log(JSON.stringify(posts, null, 2));
        }

        // output 디렉토리가 없으면 생성
        if (!fs.existsSync(OUTPUT_DIR)) {
            fs.mkdirSync(OUTPUT_DIR);
        }

        //YYMMDD-HHMMSS.json
        const timestamp = new Date().toISOString()
            .slice(2, 19)
            .replace(/[-:T]/g, '')
            .replace(/(\d{6})/, '$1-');

        // 파일 저장
        if (outputFormat === 'csv' && option === '4') {
            // CSV 형식으로 저장 (게시판 정보만 스크랩 시)
            const csvFilePath = path.join(OUTPUT_DIR, `${timestamp}.csv`);
            const headers = ['title', 'author', 'viewCount', 'recommendCount'];
            
            const csvContent = [
                headers.join(','),
                ...posts.map(post => [
                    `"${post.title.replace(/"/g, '""')}"`,
                    `"${post.author?.nickname?.replace(/"/g, '""') || ''}"`,
                    post.count || 0,
                    post.recommend || 0
                ].join(','))
            ].join('\n');
            
            fs.writeFile(csvFilePath, csvContent, err => {
                if (err) {
                    console.error('CSV 파일 저장 실패:', err);
                } else {
                    console.log(`크롤링 결과가 ${csvFilePath} 파일에 저장되었습니다.`);
                }
            });
        }
        
        // 항상 JSON 형식으로도 저장
        const jsonFilename = `${timestamp}.json`;
        const jsonFilePath = path.join(OUTPUT_DIR, jsonFilename);
        
        fs.writeFile(jsonFilePath, JSON.stringify(posts, null, 2), err => {
            if (err) {
                console.error('JSON 파일 저장 실패:', err);
            } else {
                console.log(`크롤링 결과가 ${jsonFilePath} 파일에 저장되었습니다.`);
            }
        });
    } catch (error) {
        console.error('프로그램 실행 중 에러 발생:', error.message);
    }
}

main();
