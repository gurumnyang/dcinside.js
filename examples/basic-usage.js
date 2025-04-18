// basic-usage.js
// 기본적인 라이브러리 사용 예제

const dcCrawler = require('../index'); // 실제 사용 시에는 'dcinside-crawler'

async function main() {
  try {
    console.log('갤러리에서 게시글 번호 수집 중...');
    const postList = await dcCrawler.getPostList({
      startPage: 1,
      endPage: 1,
      galleryId: 'chatgpt',
      exceptionMode: 'all'
    });

    console.log(`총 ${postList.length}개의 게시글 번호 수집 완료`);
    console.log('수집된 번호:', postList.slice(0, 5), postList.length > 5 ? '...' : '');

    if (postList.length > 0) {
      console.log('\n수집된 게시글 번호로 내용 가져오는 중...');
      const sampleSize = Math.min(3, postList.length);
      const sampleNumbers = postList.slice(0, sampleSize);

      const posts = await dcCrawler.getPosts({
        galleryId: 'chatgpt',
        postNumbers: sampleNumbers,
        onProgress: (current, total) => {
          console.log(`진행 상황: ${current}/${total}`);
        }
      });

      console.log(`\n총 ${posts.length}개 게시글 수집 완료\n`);
      
      // 수집된 게시글 정보 출력
      posts.forEach((post, index) => {
        console.log(`=== 게시글 ${index + 1} ===`);
        console.log(`제목: ${post.title}`);
        console.log(`작성자: ${post.author}`);
        console.log(`날짜: ${post.date}`);
        console.log(`조회수: ${post.viewCount}`);
        console.log(`내용 길이: ${post.content.length}자`);
        console.log(`댓글 수: ${post.comments.totalCount}`);
        console.log('');
      });
    }
  } catch (error) {
    console.error('에러 발생:', error.message);
  }
}

main();