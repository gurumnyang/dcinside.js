// extract-images.js - 이미지 URL 추출 기능 예제
// 실제 사용 시에는 '@gurumnyang/dcinside.js'의 함수 사용

const fs = require('fs');
const path = require('path');
const { getPostContent } = require('../src/scraper');
const { askQuestion } = require('../src/askQuestion');

/**
 * 이미지 URL을 파일로 저장합니다.
 * @param {Array<string>} imageUrls - 이미지 URL 배열
 * @param {string} outputPath - 출력 경로
 */
function saveImageUrls(imageUrls, outputPath) {
  if (!imageUrls || imageUrls.length === 0) {
    console.log('추출된 이미지가 없습니다.');
    return;
  }
  
  const content = imageUrls.join('\n');
  fs.writeFileSync(outputPath, content);
  console.log(`${imageUrls.length}개의 이미지 URL이 ${outputPath}에 저장되었습니다.`);
}

/**
 * 게시글에서 이미지를 추출하는 예제 메인 함수
 */
async function main() {
  try {
    console.log('\n--- 디시인사이드 게시글 이미지 URL 추출기 ---\n');
    
    // 사용자 입력 받기
    const galleryId = await askQuestion('갤러리 ID (기본: chatgpt): ') || 'chatgpt';
    const postNo = await askQuestion('게시글 번호: ');
    
    if (!postNo) {
      console.error('게시글 번호가 필요합니다.');
      return;
    }

    console.log(`\n${galleryId} 갤러리의 ${postNo} 게시글에서 이미지를 추출합니다...`);
    
    // 게시글 내용 가져오기 (이미지 URL 추출 옵션 활성화)
    const post = await getPostContent(galleryId, postNo, {
      extractImages: true,      // 이미지 URL 추출
      includeImageSource: true  // 본문에 이미지 URL 포함
    });
    
    if (!post) {
      console.error('게시글을 가져오지 못했습니다.');
      return;
    }
    
    // 결과 출력
    console.log('\n=== 게시글 정보 ===');
    console.log(`제목: ${post.title}`);
    console.log(`작성자: ${post.author}`);
    console.log(`작성일: ${post.date}`);
    console.log(`조회수: ${post.viewCount}`);
    
    // 이미지 URL 정보
    if (post.images && post.images.length > 0) {
      console.log(`\n=== 이미지 (총 ${post.images.length}개) ===`);
      post.images.forEach((url, index) => {
        console.log(`[${index + 1}] ${url}`);
      });
      
      // 이미지 URL을 파일로 저장
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
      const outputFileName = `${galleryId}_${postNo}_images_${timestamp}.txt`;
      const outputPath = path.join(__dirname, '..', 'output', outputFileName);
      
      saveImageUrls(post.images, outputPath);
    } else {
      console.log('\n게시글에 이미지가 없습니다.');
    }
    
  } catch (error) {
    console.error('에러 발생:', error.message);
  }
}

// 스크립트 실행
main().catch(console.error);