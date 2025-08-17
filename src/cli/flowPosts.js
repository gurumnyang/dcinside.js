const cliProgress = require('cli-progress');
const { getPosts } = require('../..');

async function scrapePostsWithProgress(startNo, endNo, galleryId) {
  if (startNo > endNo) [startNo, endNo] = [endNo, startNo];
  const numbers = Array.from({ length: endNo - startNo + 1 }, (_, i) => startNo + i);
  return scrapePostsWithArray(numbers, galleryId);
}

async function scrapePostsWithArray(numbers, galleryId) {
  const total = numbers.length;
  const bar = new cliProgress.SingleBar({ format: '게시글 진행 |{bar}| {percentage}% || {value}/{total}' });
  bar.start(total, 0);
  const posts = await getPosts({ galleryId, postNumbers: numbers, delayMs: 50, onProgress: () => bar.increment() });
  bar.stop();
  return posts;
}

module.exports = { scrapePostsWithProgress, scrapePostsWithArray };

