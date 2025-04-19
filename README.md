# dcinside-crawler

디시인사이드 갤러리 크롤링을 위한 Node.js 라이브러리입니다.

## 설치 방법

```bash
npm install dcinside-crawler
```

또는

```bash
yarn add dcinside-crawler
```

## 기능

- 갤러리 페이지에서 게시글 목록 수집
- 게시글 번호로 게시글 내용 가져오기
- 여러 게시글 내용 한 번에 가져오기
- 특정 페이지의 모든 게시글 내용 수집
- 게시글 내의 이미지 URL 추출
- 모든 댓글 페이지 자동 수집
- TypeScript 타입 정의 지원

## 필요 사항

- Node.js 16.0.0 이상
- npm 또는 yarn 패키지 매니저

## 사용 방법

### 갤러리 페이지에서 게시글 목록 수집

```javascript
const dcCrawler = require('dcinside-crawler');

async function example() {
  const postList = await dcCrawler.getPostList({
    page: 1,
    galleryId: 'programming',
    boardType: 'all', // 'all', 'recommend', 'notice' 중 하나
  });
  
  console.log('수집된 게시글 번호:', postList);
}

example();
```

### 게시글 번호로 게시글 내용 가져오기

```javascript
const dcCrawler = require('dcinside-crawler');

async function example() {
  const post = await dcCrawler.getPost({
    galleryId: 'programming',
    postNo: '1234567'
  });
  
  if (post) {
    console.log('게시글 제목:', post.title);
    console.log('작성자:', post.author);
    console.log('내용:', post.content);
    console.log('댓글 수:', post.comments.totalCount);
  }
}

example();
```

### 이미지 URL 추출하기

```javascript
const dcCrawler = require('dcinside-crawler');

async function example() {
  const post = await dcCrawler.getPost({
    galleryId: 'programming',
    postNo: '1234567',
    extractImages: true,        // 이미지 URL 추출 활성화
    includeImageSource: false   // 본문에 이미지 URL 표시 비활성화
  });
  
  if (post && post.images) {
    console.log('이미지 URL 목록:', post.images);
    console.log(`총 ${post.images.length}개 이미지 추출됨`);
  }
}

example();
```

### 여러 게시글 내용 한 번에 가져오기

```javascript
const dcCrawler = require('dcinside-crawler');

async function example() {
  const posts = await dcCrawler.getPosts({
    galleryId: 'programming',
    postNumbers: ['1234567', '1234568', '1234569'],
    delayMs: 100,
    extractImages: true,  // 모든 게시글에서 이미지 URL 추출
    onProgress: (current, total) => {
      console.log(`진행 상황: ${current}/${total}`);
    }
  });
  
  console.log(`총 ${posts.length}개 게시글 수집 완료`);
}

example();
```

### 특정 페이지의 게시글 내용 수집

```javascript
const dcCrawler = require('dcinside-crawler');
const cliProgress = require('cli-progress');

async function example() {
  // 우선 게시글 번호 목록을 가져옴
  const postList = await dcCrawler.getPostList({
    page: 1,
    galleryId: 'programming',
    boardType: 'all'
  });
  
  // 진행 상황 표시용 프로그레스 바
  const progressBar = new cliProgress.SingleBar({
    format: '게시글 진행 |{bar}| {percentage}% || {value}/{total}',
  });
  
  // 수집한 게시글 번호로 게시글 내용 가져오기
  const posts = await dcCrawler.getPosts({
    galleryId: 'programming',
    postNumbers: postList,
    delayMs: 100,
    onProgress: (current, total) => {
      if (current === 1) progressBar.start(total, 0);
      progressBar.update(current);
      if (current === total) progressBar.stop();
    }
  });
  
  console.log(`총 ${posts.length}개 게시글 수집 완료`);
}

example();
```

### User-Agent 관련 유틸리티 함수

```javascript
const { getRandomUserAgent } = require('dcinside-crawler');

console.log(getRandomUserAgent()); // 무작위 User-Agent 문자열 반환
```

## 응답 데이터 형식

### 게시글 객체

```javascript
{
  postNo: "1234567",
  title: "게시글 제목",
  author: "작성자 닉네임",
  date: "2025.01.01 12:34:56", 
  content: "게시글 내용...",
  viewCount: "123",
  recommendCount: "10",
  dislikeCount: "2",
  comments: {
    totalCount: 5,
    comments: [
      {
        parent: "0", 
        userId: "user_id",
        name: "댓글 작성자",
        ip: "1.2.3.*", // IP 표시가 된 경우에만
        regDate: "01.01 12:34:56",
        memo: "댓글 내용"
      }
      // ...
    ]
  },
  // 이미지 URL 추출 옵션을 활성화한 경우에만 포함됨
  images: [
    "https://example.com/image1.jpg",
    "https://example.com/image2.jpg"
  ]
}
```

## 에러 처리와 재시도

라이브러리는 요청 실패 시 자동으로 재시도합니다. 기본 설정은 다음과 같습니다:
- 최대 재시도 횟수: 3회
- 재시도 간 지연 시간: 1000ms (지수 백오프 적용)

```javascript
// 설정 옵션
const options = {
  retryAttempts: 5,    // 최대 재시도 횟수 변경 
  retryDelay: 2000     // 재시도 간 지연 시간 변경
  // 다른 옵션...
};
```

## TODO

- [x] 게시판 페이지 크롤링
- [x] 게시글 본문 가져오기
- [x] 댓글 가져오기
- [x] 게시글 이미지 URL 추출
- [x] 모든 댓글 페이지 수집
- [x] 재시도 메커니즘 추가
- [ ] 로그인/로그아웃
- [ ] 게시글 작성/수정/삭제
- [ ] 댓글 작성
- [ ] 댓글 삭제
- [ ] 추천/비추천

## 주의사항

- 디시인사이드의 이용약관을 준수해주세요.
- 과도한 요청은 IP 차단을 유발할 수 있으니 적절한 딜레이(delayMs)를 설정하세요.
- 수집한 데이터는 개인 연구, 분석 등의 비상업적 용도로만 사용해주세요.

## 라이선스

MIT