// advanced-usage.js
// 프로그레스 바를 이용한 고급 사용법 예제

const dcCrawler = require('../index'); // 실제 사용 시에는 'dcinside-crawler'
const cliProgress = require('cli-progress');
const fs = require('fs');
const path = require('path');

async function main() {
  try {
    // 갤러리 ID 설정
    const galleryId = 'chatgpt';
    
    // 프로그레스 바 설정
    const multibar = new cliProgress.MultiBar({
      clearOnComplete: false,
      hideCursor: true,
      format: '{bar} | {percentage}% | {value}/{total} | {title}'
    }, cliProgress.Presets.shades_classic);
    
    // 페이지 진행 프로그레스 바
    let pageBar;
    
    // 게시글 진행 프로그레스 바
    let postBar;
    
    console.log('디시인사이드 프로그래밍 갤러리 크롤링 시작...\n');
    
    // 1. 페이지 범위로 게시글 수집
    const posts = await dcCrawler.crawlGalleryPages({
      startPage: 1,
      endPage: 2,
      galleryId: galleryId,
      exceptionMode: 'all',
      pageDelayMs: 300,
      postDelayMs: 200,
      onPageProgress: (current, total) => {
        if (current === 1) {
          pageBar = multibar.create(total, 0, { title: '페이지 수집 진행' });
        }
        pageBar.update(current);
      },
      onPostProgress: (current, total) => {
        if (current === 1) {
          postBar = multibar.create(total, 0, { title: '게시글 수집 진행' });
        }
        postBar.update(current);
      }
    });
    
    // 멀티바 종료
    multibar.stop();
    
    // 2. 결과 처리
    console.log(`\n크롤링 완료! 총 ${posts.length}개 게시글 수집됨\n`);
    
    // 간단한 통계 계산
    const authorStats = {};
    let totalComments = 0;
    
    posts.forEach(post => {
      // 작성자 통계
      authorStats[post.author] = (authorStats[post.author] || 0) + 1;
      
      // 댓글 수 합계
      totalComments += post.comments.totalCount;
    });
    
    console.log('=== 수집 통계 ===');
    console.log(`- 총 게시글: ${posts.length}개`);
    console.log(`- 총 댓글: ${totalComments}개`);
    console.log(`- 작성자 수: ${Object.keys(authorStats).length}명`);
    
    // Top 3 작성자
    const topAuthors = Object.entries(authorStats)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
    
    if (topAuthors.length > 0) {
      console.log('\n=== 게시글 작성 순위 ===');
      topAuthors.forEach((author, index) => {
        console.log(`${index + 1}위: ${author[0]} (${author[1]}개)`);
      });
    }
    
    // 3. 결과 저장
    const timestamp = new Date().toISOString()
      .replace(/[:-T]/g, '')
      .slice(0, 14);
    
    const outputDir = path.join(__dirname, '..', 'output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir);
    }
    
    const outputPath = path.join(outputDir, `${galleryId}_${timestamp}.json`);
    fs.writeFileSync(outputPath, JSON.stringify(posts, null, 2));
    
    console.log(`\n수집 결과가 ${outputPath} 파일에 저장되었습니다.`);
    
  } catch (error) {
    console.error('크롤링 중 에러 발생:', error.message);
  }
}

main();