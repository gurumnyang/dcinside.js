const cliProgress = require('cli-progress');
const path = require('path');
const fs = require('fs');
const { getPostList, getPosts, delay } = require('../..');

async function scrapeBoardPagesWithProgress(startPage, endPage, galleryId, typeParam = 'all') {
  const postNumbers = [];
  const bar = new cliProgress.SingleBar({ format: '페이지 진행 |{bar}| {percentage}% || {value}/{total}' });
  bar.start(endPage - startPage + 1, 0);
  for (let page = startPage; page <= endPage; page++) {
    const list = await getPostList({ page, galleryId, boardType: typeParam, delayMs: 10 });
    postNumbers.push(...list.map(p => p.id));
    bar.increment();
    await delay(1000);
  }
  bar.stop();
  const dedup = Array.from(new Set(postNumbers));
  // 게시글 수집 진행바
  const postBar = new cliProgress.SingleBar({ format: '게시글 진행 |{bar}| {percentage}% || {value}/{total}' });
  postBar.start(dedup.length, 0);
  const posts = await getPosts({ galleryId, postNumbers: dedup, delayMs: 50, onProgress: () => postBar.increment() });
  postBar.stop();
  return posts;
}

async function scrapeBoardInfoOnly(startPage, endPage, galleryId, typeParam = 'all') {
  let postInfoList = [];
  const bar = new cliProgress.SingleBar({ format: '페이지 진행 |{bar}| {percentage}% || {value}/{total}' });
  bar.start(endPage - startPage + 1, 0);
  for (let page = startPage; page <= endPage; page++) {
    const list = await getPostList({ page, galleryId, boardType: typeParam, delayMs: 10 });
    postInfoList.push(...list);
    bar.increment();
    await delay(100);
  }
  bar.stop();
  const seen = new Set();
  postInfoList = postInfoList.filter(p => (seen.has(p.id) ? false : (seen.add(p.id), true)));
  return postInfoList;
}

function saveCsv(posts, filePath) {
  const headers = ['title', 'author', 'viewCount', 'recommendCount'];
  const lines = [headers.join(','), ...posts.map(p => [
    `"${(p.title||'').replace(/"/g,'""')}"`,
    `"${(p.author?.nickname||'').replace(/"/g,'""')}"`,
    p.count||0,
    p.recommend||0,
  ].join(','))];
  fs.writeFileSync(filePath, lines.join('\n'));
}

module.exports = { scrapeBoardPagesWithProgress, scrapeBoardInfoOnly, saveCsv };
