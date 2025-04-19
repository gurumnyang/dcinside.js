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
    
    console.log('디시인사이드 갤러리 크롤링 시작...\n');
    
    // 여러 페이지 크롤링
    const startPage = 1;
    const endPage = 2;
    const allPosts = [];
    const allImageUrls = []; // 수집한 이미지 URL을 저장할 배열
    
    // 페이지 진행 프로그레스 바 초기화
    pageBar = multibar.create(endPage - startPage + 1, 0, { title: '페이지 수집 진행' });
    
    for (let page = startPage; page <= endPage; page++) {
      // 우선 해당 페이지의 게시글 번호를 수집합니다
      const postNumbers = await dcCrawler.getPostList({
        page: page,
        galleryId: galleryId,
        boardType: 'all'
      });
      
      // 이제 수집한 게시글 번호를 이용하여 게시글 내용을 수집합니다
      // 새로운 옵션: 이미지 URL 추출 활성화
      const posts = await dcCrawler.getPosts({
        galleryId: galleryId,
        postNumbers: postNumbers,
        delayMs: 200,
        // 새로운 기능: 이미지 URL 추출
        extractImages: true,
        includeImageSource: false,
        // 새로운 기능: 재시도 옵션 설정
        retryAttempts: 3,
        retryDelay: 1000,
        onProgress: (current, total) => {
          if (current === 1) {
            postBar = multibar.create(total, 0, { title: `페이지 ${page} 게시글 수집` });
          }
          postBar.update(current);
        }
      });
      
      // 이미지 URL 수집
      posts.forEach(post => {
        if (post.images && post.images.length > 0) {
          allImageUrls.push(...post.images);
        }
      });
      
      allPosts.push(...posts);
      pageBar.update(page - startPage + 1);
      
      // 다음 페이지로 넘어가기 전에 잠시 대기
      await dcCrawler.delay(500);
    }
    
    // 멀티바 종료
    multibar.stop();
    
    // 2. 결과 처리
    console.log(`\n크롤링 완료! 총 ${allPosts.length}개 게시글 수집됨\n`);
    
    // 간단한 통계 계산
    const authorStats = {};
    let totalComments = 0;
    
    allPosts.forEach(post => {
      // 작성자 통계
      authorStats[post.author] = (authorStats[post.author] || 0) + 1;
      
      // 댓글 수 합계
      totalComments += post.comments.totalCount;
    });
    
    console.log('=== 수집 통계 ===');
    console.log(`- 총 게시글: ${allPosts.length}개`);
    console.log(`- 총 댓글: ${totalComments}개`);
    console.log(`- 총 이미지: ${allImageUrls.length}개`); // 이미지 통계 추가
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
    
    // JSON 파일 저장
    const outputPath = path.join(outputDir, `${galleryId}_${timestamp}.json`);
    fs.writeFileSync(outputPath, JSON.stringify(allPosts, null, 2));
    console.log(`\n수집 결과가 ${outputPath} 파일에 저장되었습니다.`);
    
    // 이미지 URL 저장 (새 기능)
    if (allImageUrls.length > 0) {
      const imageOutputPath = path.join(outputDir, `${galleryId}_${timestamp}_images.txt`);
      fs.writeFileSync(imageOutputPath, allImageUrls.join('\n'));
      console.log(`${allImageUrls.length}개 이미지 URL이 ${imageOutputPath} 파일에 저장되었습니다.`);
      
      // 새로운 기능: 이미지 URL로부터 실제 이미지 파일 다운로드 예시
      console.log('\n이미지 다운로드 방법 예시:');
      console.log('```bash');
      console.log(`# Linux/macOS`);
      console.log(`mkdir -p images && cat ${path.basename(imageOutputPath)} | xargs -I {} wget -P images {}`);
      console.log(`\n# Windows (PowerShell)`);
      console.log(`New-Item -ItemType Directory -Force -Path images; Get-Content ${path.basename(imageOutputPath)} | ForEach-Object { Invoke-WebRequest $_ -OutFile "images\\$(Split-Path $_ -Leaf)" }`);
      console.log('```');
    }
    
    // 4. 에러 처리 예제 (새 기능)
    console.log('\n=== 에러 처리 예제 ===');
    console.log('크롤링 중 발생할 수 있는 에러와 재시도 처리 방법:');
    console.log('```javascript');
    console.log(`try {
  const posts = await dcCrawler.getPosts({
    galleryId: 'example',
    postNumbers: ['12345678'],
    // 재시도 관련 설정
    retryAttempts: 5,    // 최대 5회 재시도
    retryDelay: 2000,    // 재시도 간 2초 지연
    // 지수 백오프가 자동 적용됨 (1회: 2초, 2회: 4초, 3회: 8초...)
  });
} catch (error) {
  // CrawlError 인스턴스인 경우 보다 상세한 처리 가능
  if (error instanceof dcCrawler.CrawlError) {
    console.error(\`에러 유형: \${error.type}\`);
    console.error(\`발생 시간: \${error.timestamp}\`);
    error.logError(true); // 상세 로그 출력
  } else {
    console.error(error);
  }
}`);
    console.log('```');
    
  } catch (error) {
    console.error('크롤링 중 에러 발생:', error.message);
  }
}

main();