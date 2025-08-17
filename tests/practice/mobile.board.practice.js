// 실행 예: node tests/practice/mobile.post.practice.js chatgpt 54001

const { scrapeMobileBoardPage } = require('../../src/scraper/board_mobile');

scrapeMobileBoardPage(1, "chatgpt", { boardType: "all" }).then(posts => {
  console.log(posts);
});