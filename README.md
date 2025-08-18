# @gurumnyang/dcinside.js

<div align="center">
  <a href="https://www.npmjs.com/package/@gurumnyang/dcinside.js">
    <img src="https://img.shields.io/npm/v/@gurumnyang/dcinside.js?color=%2335C757" alt="NPM Version"/>
  </a>
  <a href="https://www.npmjs.com/package/@gurumnyang/dcinside.js">
    <img src="https://img.shields.io/npm/dt/@gurumnyang/dcinside.js" alt="Downloads"/>
  </a>
  <p>디시인사이드 갤러리 크롤링을 위한 Node.js 라이브러리입니다.</p>
</div>


## 설치 방법

```bash
# NPM
npm install @gurumnyang/dcinside.js

# Yarn
yarn add @gurumnyang/dcinside.js
```

## 기능

- 갤러리 페이지에서 게시글 목록 수집
- 게시글 번호로 게시글 내용 가져오기
- 여러 게시글 내용 한 번에 가져오기
- 특정 페이지의 모든 게시글 내용 수집
- 게시글 내의 이미지 URL 추출
- 모든 댓글 페이지 자동 수집
- 통합검색 결과 수집(검색어 기반)
- TypeScript 타입 정의 지원


## 사용 방법

### 마이너 갤러리 페이지에서 게시글 목록 수집

```javascript
const dcCrawler = require('@gurumnyang/dcinside.js');

async function example() {
  const postList = await dcCrawler.getPostList({
    page: 1,
    galleryId: 'programming',
    boardType: 'all', // 'all', 'recommend', 'notice' 중 하나
  });
  
  console.log('수집된 게시글 정보:', postList);
  // 각 게시글의 id, 제목, 작성자, 조회수 등의 정보가 포함되어 있음
}

example();
```

레거시(PC) 목록 파서는 다음과 같이 호출할 수 있습니다.

```javascript
const listPc = await dcCrawler.getPostListLegacy({ page: 1, galleryId: 'programming', boardType: 'all' });
```

### 통합검색 (새 기능)

```javascript
const dcCrawler = require('@gurumnyang/dcinside.js');

async function example() {
  // 기본: 사이트 기본 정렬(정확도)로 검색
  const result = await dcCrawler.search('검색쿼리');
  // result = { query?: string, galleries: SearchGalleryItem[], posts: SearchPost[] }
  console.log(result.galleries.slice(0, 3));
  console.log(result.posts.slice(0, 3));

  // 정렬 지정: 최신순 또는 정확도
  const latest = await dcCrawler.search('검색쿼리', { sort: 'latest' });
  const accuracy = await dcCrawler.search('검색쿼리', { sort: 'accuracy' });
}

// 참고: 통합검색 반환 값에는 갤러리 구분 필드가 포함됩니다.
// - result.galleries[i].galleryType: 'main' | 'mgallery' | 'mini' | 'person'
// - result.posts[i].galleryType: 'main' | 'mgallery' | 'mini' | 'person'
```
#### 검색 결과 타입 상세

```javascript
// SearchGalleryItem 예시
{
  name: '챗지피티(ChatGPT)ⓜ',
  id: 'chatgpt',
  type: 'mgallery',       // 내부 호환용: 'board'|'mgallery'|'mini'|'person'
  galleryType: 'mgallery',// 구분용: 'main'|'mgallery'|'mini'|'person'
  link: 'https://gall.dcinside.com/mgallery/board/lists/?id=chatgpt',
  rank: 153,
  new_post: 12,
  total_post: 345
}

// SearchPost 예시
{
  title: '첫 번째 게시글',
  content: '요약 내용',
  galleryName: '챗지피티(ChatGPT)ⓜ',
  galleryId: 'chatgpt',
  galleryType: 'mgallery', // 'main'|'mgallery'|'mini'|'person'
  date: '2025.08.11 10:00:00',
  link: 'https://gall.dcinside.com/mgallery/board/view/?id=chatgpt&no=1111'
}


example();
```

### 갤러리 게시판 페이지에서 게시글 데이터 불러오기(raw API)

```javascript
const dcCrawler = require('@gurumnyang/dcinside.js');

async function example() {
  // 모바일 기본 파서
  const postInfoList = await dcCrawler.raw.scrapeBoardPage(
    1,
    'programming',
    {
      boardType: 'all', // 'all', 'recommend', 'notice' 중 하나
      id: null,        // 특정 번호만 필터링하려면 지정
      subject: null,    // 특정 말머리만 필터링하려면 지정
      nickname: null,   // 특정 닉네임만 필터링하려면 지정
      ip: null          // 특정 IP만 필터링하려면 지정
    }
  );
  
  console.log('수집된 게시글 정보:', postInfoList);
  // 수집된 각 게시글의 제목, 작성자, 조회수 등 모든 정보 확인 가능
}

example();
```

PC(레거시) 파서를 사용하려면 `raw.scrapeBoardPageLegacy`를 사용하세요.

```javascript
const legacy = await dcCrawler.raw.scrapeBoardPageLegacy(1, 'programming', { boardType: 'all' });
```

### 게시글 번호로 게시글 내용 가져오기

```javascript
const dcCrawler = require('@gurumnyang/dcinside.js');

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

레거시(PC) 본문 파서는 다음과 같이 호출할 수 있습니다.

```javascript
const legacy = await dcCrawler.getPostLegacy({ galleryId: 'programming', postNo: '1234567' });
```

### 여러 게시글 내용 한 번에 가져오기

```javascript
const dcCrawler = require('@gurumnyang/dcinside.js');

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

## 터미널 브라우저(TUI)

간단한 터미널 UI로 게시판 열람, 글 조회, 검색을 사용할 수 있습니다.

```bash
npm run tui
```

메뉴에서 게시판 목록 열람(페이지 이동), 통합검색(정확도/최신), 글 바로 조회(갤ID/번호)를 지원합니다.

### 특정 페이지의 게시글 내용 수집

```javascript
const dcCrawler = require('@gurumnyang/dcinside.js');
const cliProgress = require('cli-progress');

async function example() {
  // 우선 게시글 정보 목록을 가져옴
  const postInfoList = await dcCrawler.getPostList({
    page: 1,
    galleryId: 'programming',
    boardType: 'all'
  });
  
  // 게시글 번호만 추출
  const postNumbers = postInfoList.map(post => post.id);
  
  // 진행 상황 표시용 프로그레스 바
  const progressBar = new cliProgress.SingleBar({
    format: '게시글 진행 |{bar}| {percentage}% || {value}/{total}',
  });
  
  // 수집한 게시글 번호로 게시글 내용 가져오기
  const posts = await dcCrawler.getPosts({
    galleryId: 'programming',
    postNumbers: postNumbers,
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

## 자동완성(Autocomplete)

dcinside 검색 자동완성 API를 지원합니다.

### 빠른 시작

```javascript
const dc = require('@gurumnyang/dcinside.js');

async function main() {
  const result = await dc.getAutocomplete('chatgpt');
  console.log(result);
  // 예: result.gallery.total, result.gallery["0"].ko_name 등
}

main();
```

### Raw API

```javascript
const dc = require('@gurumnyang/dcinside.js');

async function main() {
  const result = await dc.raw.getAutocomplete('chatgpt');
  console.log(result);
}

main();
```

### 응답 구조(요약)

```json
{
  "gallery": {
    "0": {
      "name": "chatgpt",
      "ko_name": "챗지피티(ChatGPT)",
      "gall_type": "M",
      "link": "https://gall.dcinside.com/mgallery/board/lists/?id=chatgpt"
      // new_post, total_post 등은 상황에 따라 존재
    },
    "total": 1
  },
  "prgallery": { "total": "0" },
  "recommend": { "0": { /* gallery와 유사 */ }, "total": "11" },
  "wiki": { "0": { "title": "ChatGPT", "gall_type": "WIKI" } },
  "time": { "time": "1754991744332" }
}
```

### User-Agent 관련 유틸리티 함수

```javascript
const { getRandomUserAgent } = require('@gurumnyang/dcinside.js');

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
        id: "comment_id",
        author: {
          userId: "user_id",
          nickname: "댓글 작성자",
          ip: "1.2.3.*" // IP 표시가 된 경우에만
        },
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

### 게시글 정보 객체 (PostInfo)

```javascript
{
  id: "1234567",               // 게시글 번호
  type: "picture",              // 게시글 유형 ('notice', 'picture', 'text', 'recommended', 'unknown')
  subject: "일반",              // 말머리
  title: "게시글 제목입니다",    // 게시글 제목
  link: "https://gall.dcinside.com/mgallery/board/view/?id=programming&no=1234567", // 게시글 링크
  author: {
    nickname: "작성자닉네임",    // 작성자 닉네임
    userId: "writer_id",        // 작성자 ID (있는 경우만)
    ip: "1.2.3.*"              // 작성자 IP (표시된 경우만)
  },
  date: "2025.04.21 12:34:56",  // 작성 날짜
  count: 123,                   // 조회수
  recommend: 10,                // 추천수
  replyCount: 5                 // 댓글 수
}
```

### 통합검색 결과 객체 (SearchResult)

```javascript
{
  query: '지피티',
  galleries: [
    {
      name: '챗지피티(ChatGPT)ⓜ',
      id: 'chatgpt',
      type: 'mgallery',
      link: 'https://gall.dcinside.com/mgallery/board/lists/?id=chatgpt',
      rank: 153,
      new_post: 615,
      total_post: 52041
    }
  ],
  posts: [
    {
      title: '지피티 수준이 어마어마하긴 함 3(feat.갤럼)',
      content: '비슷한 결과물 나오길 기대하면서 갤럼 그림 빌려서 같은 요청 해봤음 ????? 왜 나만??? - dc official App',
      galleryName: '챗지피티(ChatGPT) 갤러리',
      galleryId: 'chatgpt',
      date: '2025.08.12 21:57',
      link: 'https://gall.dcinside.com/mgallery/board/view/?id=chatgpt&no=52384'
    }
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

## API 레퍼런스

### 핵심 함수

#### `getPostList(options)`

갤러리 페이지에서 게시글 목록을 수집합니다. 기본은 모바일 파서입니다.

**매개변수:**
- `options` (객체)
  - `page` (숫자): 페이지 번호
  - `galleryId` (문자열): 갤러리 ID
  - `boardType` (문자열, 선택): 게시판 유형 ('all', 'recommend', 'notice' 중 하나, 기본값: 'all')
  - `delayMs` (숫자, 선택): 요청 간 지연 시간(ms)

**반환값:**
- `Promise<PostInfo[]>`: 게시글 정보 객체의 배열

---

#### `getPostListLegacy(options)`

PC(레거시) 파서로 갤러리 페이지에서 게시글 목록을 수집합니다. 인터페이스는 `getPostList`와 동일합니다.

---

#### `getPost(options)`

게시글 번호로 게시글 내용을 가져옵니다. 기본은 모바일 파서입니다

**매개변수:**
- `options` (객체)
  - `galleryId` (문자열): 갤러리 ID
  - `postNo` (문자열 또는 숫자): 게시글 번호
  - `extractImages` (불리언, 선택): 이미지 URL 추출 여부 (기본값: false)
  - `includeImageSource` (불리언, 선택): 본문에 이미지 URL 포함 여부 (기본값: false)

**반환값:**
- `Promise<Post | null>`: 게시글 객체 또는 실패 시 null

---

#### `getPostLegacy(options)`

PC(레거시) 파서로 게시글 내용을 가져옵니다. 인터페이스는 `getPost`와 동일합니다.

---

#### `getPosts(options)`

여러 게시글 번호로 게시글 내용을 가져옵니다.

**매개변수:**
- `options` (객체)
  - `galleryId` (문자열): 갤러리 ID
  - `postNumbers` (문자열 또는 숫자의 배열): 게시글 번호 배열
  - `delayMs` (숫자, 선택): 요청 간 지연 시간(ms) (기본값: 100)
  - `extractImages` (불리언, 선택): 이미지 URL 추출 여부 (기본값: false)
  - `includeImageSource` (불리언, 선택): 본문에 이미지 URL 포함 여부 (기본값: false)
  - `onProgress` (함수, 선택): 진행 상황 콜백 함수 (current, total)
  - `retryAttempts` (숫자, 선택): 최대 재시도 횟수
  - `retryDelay` (숫자, 선택): 재시도 간 지연 시간(ms)

**반환값:**
- `Promise<Post[]>`: 수집된 게시글 객체 배열

---

#### `getAutocomplete(query)`

검색어를 입력하면 DCInside 자동완성 결과(JSON)를 반환한다.

**매개변수:**
- `query` (문자열): 검색어

**반환값:**
- `Promise<object>`: 자동완성 결과 객체

---

#### `search(query, options)`

통합검색을 수행하고 결과를 반환한다.

**매개변수:**
- `query` (문자열): 검색어
- `options` (객체, 선택)
  - `sort` ('latest' | 'accuracy', 선택): 정렬 기준

**반환값:**
- `Promise<object>`: 검색 결과 객체 `{ query?, gallery?, posts[] }`

---

### 유틸리티 함수

#### `delay(ms)`

지정된 시간(밀리초) 동안 실행을 지연시킵니다.

**매개변수:**
- `ms` (숫자): 지연할 시간(밀리초)

**반환값:**
- `Promise<void>`

---

#### `getRandomUserAgent()`

무작위 User-Agent 문자열을 반환합니다.

**매개변수:**
- 없음

**반환값:**
- `string`: 무작위 User-Agent 문자열




### TypeScript 타입

- `AutocompleteResponse`, `AutocompleteGalleryItem`, `AutocompleteWikiItem`
- `getAutocomplete(query: string): Promise<AutocompleteResponse>`
- `raw.getAutocomplete(query: string): Promise<AutocompleteResponse>`

## TODO

- [x] 게시판 페이지 크롤링
- [x] 게시글 본문 가져오기
- [x] 댓글 가져오기
- [x] 모든 댓글 페이지 수집
- [x] 재시도 메커니즘 추가
- [x] 게시글 이미지 URL 추출
- [x] 검색 기능 지원
- [ ] 이미지 다운로드 기능
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
