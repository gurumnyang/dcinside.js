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

- 갤러리 페이지 범위로 게시글 목록 수집
- 게시글 번호로 게시글 내용 가져오기
- 여러 게시글 내용 한 번에 가져오기
- 페이지 범위로 모든 게시글 내용 수집

## 사용 방법

### 갤러리 페이지 범위로 게시글 목록 수집

```javascript
const dcCrawler = require('dcinside-crawler');

async function example() {
  const postList = await dcCrawler.getPostList({
    startPage: 1,
    endPage: 3,
    galleryId: 'programming',
    exceptionMode: 'all', // 'all', 'recommend', 'notice' 중 하나
    delayMs: 100 // 요청 간 딜레이(ms)
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

### 여러 게시글 내용 한 번에 가져오기

```javascript
const dcCrawler = require('dcinside-crawler');

async function example() {
  const posts = await dcCrawler.getPosts({
    galleryId: 'programming',
    postNumbers: ['1234567', '1234568', '1234569'],
    delayMs: 100,
    onProgress: (current, total) => {
      console.log(`진행 상황: ${current}/${total}`);
    }
  });
  
  console.log(`총 ${posts.length}개 게시글 수집 완료`);
}

example();
```

### 페이지 범위로 게시글 내용 수집

```javascript
const dcCrawler = require('dcinside-crawler');
const cliProgress = require('cli-progress');

async function example() {
  // 진행 상황 표시용 프로그레스 바
  const pageBar = new cliProgress.SingleBar({
    format: '페이지 진행 |{bar}| {percentage}% || {value}/{total}',
  });
  
  const postBar = new cliProgress.SingleBar({
    format: '게시글 진행 |{bar}| {percentage}% || {value}/{total}',
  });
  
  const posts = await dcCrawler.crawlGalleryPages({
    startPage: 1,
    endPage: 3,
    galleryId: 'programming',
    exceptionMode: 'all',
    pageDelayMs: 100,
    postDelayMs: 100,
    onPageProgress: (current, total) => {
      if (current === 1) pageBar.start(total, 0);
      pageBar.update(current);
      if (current === total) pageBar.stop();
    },
    onPostProgress: (current, total) => {
      if (current === 1) postBar.start(total, 0);
      postBar.update(current);
      if (current === total) postBar.stop();
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
        parent: "0", // 0이면 일반 댓글, 숫자면 해당 번호 댓글에 대한 답글
        userId: "user_id",
        name: "댓글 작성자",
        ip: "1.2.3.*", // IP 표시가 된 경우에만
        regDate: "01.01 12:34:56",
        memo: "댓글 내용"
      }
      // ...
    ]
  }
}
```

## 주의사항

- 디시인사이드의 이용약관을 준수해주세요.
- 과도한 요청은 IP 차단을 유발할 수 있으니 적절한 딜레이(delayMs)를 설정하세요.
- 개인정보가 포함된 내용을 무단으로 수집하거나 배포하지 마세요.
- 수집한 데이터는 개인 연구, 분석 등의 비상업적 용도로만 사용해주세요.

## 라이선스

MIT