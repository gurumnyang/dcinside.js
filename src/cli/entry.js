const fs = require('fs');
const path = require('path');
const { validateNumberInput } = require('../util');
const askQuestion = require('../askQuestion');
const { scrapePostsWithProgress, scrapePostsWithArray } = require('./flowPosts');
const { scrapeBoardPagesWithProgress, scrapeBoardInfoOnly, saveCsv } = require('./flowPages');

const OUTPUT_DIR = './output';

async function main() {
  console.log('DCInside 갤러리 크롤러');
  const galleryId = (await askQuestion('갤러리ID(기본:chatgpt): ')) || 'chatgpt';
  console.log('==========================');
  console.log('옵션 선택(기본:1):');
  console.log('1: 게시글 번호 범위 크롤링');
  console.log('2: 게시판 페이지 범위 크롤링');
  console.log('3: 게시글 번호 나열 크롤링');
  console.log('4: 게시판 정보만 크롤링(내용 제외)');
  const option = await askQuestion('옵션 선택 (1~4): ');
  if (!['1','2','3','4'].includes(option)) return console.log('잘못된 선택입니다.');

  let typeParam = 'all';
  if (option === '2' || option === '4') {
    console.log('==========================');
    console.log('게시판 유형 선택(기본:1): 1 전체글 / 2 개념글 / 3 공지');
    const t = await askQuestion('유형 (1~3): ');
    typeParam = t === '2' ? 'recommend' : t === '3' ? 'notice' : 'all';
  }

  let posts = [];
  let outputFormat = 'json';

  if (option === '1') {
    const startNo = validateNumberInput(await askQuestion('시작 게시글 번호: '), 1);
    const endNo = validateNumberInput(await askQuestion('끝 게시글 번호: '), startNo);
    posts = await scrapePostsWithProgress(startNo, endNo, galleryId);
  } else if (option === '2') {
    const startPage = validateNumberInput(await askQuestion('시작 페이지 번호: '), 1);
    const endPage = validateNumberInput(await askQuestion('끝 페이지 번호: '), startPage);
    posts = await scrapeBoardPagesWithProgress(startPage, endPage, galleryId, typeParam);
  } else if (option === '3') {
    const input = await askQuestion('게시글 번호(쉼표구분): ');
    const numbers = input.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n));
    if (!numbers.length) return console.log('유효한 번호가 없습니다.');
    posts = await scrapePostsWithArray(numbers, galleryId);
  } else if (option === '4') {
    const startPage = validateNumberInput(await askQuestion('시작 페이지 번호: '), 1);
    const endPage = validateNumberInput(await askQuestion('끝 페이지 번호: '), startPage);
    posts = await scrapeBoardInfoOnly(startPage, endPage, galleryId, typeParam);
    console.log('==========================');
    const f = await askQuestion('출력 형식(1 JSON / 2 CSV, 기본:1): ');
    outputFormat = f === '2' ? 'csv' : 'json';
  }

  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR);
  const timestamp = new Date().toISOString().slice(2, 19).replace(/[-:T]/g, '').replace(/(\d{6})/, '$1-');
  if (outputFormat === 'csv' && option === '4') {
    const csvPath = path.join(OUTPUT_DIR, `${timestamp}.csv`);
    saveCsv(posts, csvPath);
    console.log(`CSV 저장: ${csvPath}`);
  } else {
    const jsonPath = path.join(OUTPUT_DIR, `${timestamp}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(posts, null, 2));
    console.log(`JSON 저장: ${jsonPath}`);
  }
}

module.exports = { main };

