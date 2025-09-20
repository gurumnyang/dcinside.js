// 실행 예: node tests/practice/mobile.post.practice.js chatgpt 54001

const { getMobilePostContent } = require('../../src/scraper/post');

async function run() {
  const galleryId = process.argv[2] || 'chatgpt';
  const postNo = process.argv[3] || '54073';
  console.log(`[모바일] galleryId=${galleryId}, postNo=${postNo}`);

  const post = await getMobilePostContent(galleryId, postNo, { extractImages: true });
  if (!post) {
    console.error('게시글 수집 실패');
    process.exitCode = 1;
    return;
  }

  console.log(post.comments);

  console.log('제목:', post.title);
  console.log('작성자:', post.author);
  console.log('날짜:', post.date);
  console.log('조회수:', post.viewCount);
  console.log('추천/비추천:', post.recommendCount, '/', post.dislikeCount);
  console.log('본문 길이:', (post.content || '').length);
  console.log('본문:', post.content || '없음');
  console.log('댓글 수:', post.comments?.totalCount || 0);
  if (Array.isArray(post.images)) {
    console.log('이미지 수:', post.images.length);
    console.log('첫 이미지:', post.images[0] || null);
  }
}

run().catch(err => {
  console.error('실행 오류:', err?.message || err);
  process.exitCode = 1;
});
