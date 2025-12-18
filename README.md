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

- 갤러리 게시판 조회, 게시글 내용 조회
- 게시글 댓글 조회
- 게시글 내의 이미지 URL 추출
- 통합검색 결과 수집
- 로그인 및 인증 쿠키 수집
- 게시글 게시, 삭제
- 댓글 게시, 삭제
- 실시간 베스트 추천(실베추)


## 사용 방법

### 빠른 시작

```javascript
const dc = require('@gurumnyang/dcinside.js');

(async () => {
  // 1) 페이지별 게시글 목록 (모바일 파서 기본)
  const list = await dc.getPostList({ page: 1, galleryId: 'chatgpt', boardType: 'all' });

  // 2) 단일 게시글 본문/댓글
  const post = await dc.getPost({ galleryId: 'chatgpt', postNo: list[0].id, extractImages: true });

  // 3) 통합검색
  const search = await dc.search('챗지피티');

  console.log(list.length, post?.title, search.posts.length);
})();
```

레거시(PC) 목록 파서는 다음과 같이 호출할 수 있습니다.

```javascript
const listPc = await dcCrawler.getPostListLegacy({ page: 1, galleryId: 'programming', boardType: 'all' });
```

#### 타입 상세

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
```


### 모바일 로그인 & 글쓰기 예시

모바일 로그인 세션을 확보하면 쿠키를 그대로 재사용해 글쓰기/삭제에 활용할 수 있습니다(PC 미지원)

캡차에 걸릴 경우 success:false를 반환합니다

```javascript
const dc = require('@gurumnyang/dcinside.js');

(async () => {
  const login = await dc.mobileLogin({ code: process.env.DC_ID, password: process.env.DC_PW });
  if (!login.success) {
    throw new Error(`로그인 실패: ${login.reason}`);
  }

  const write = await dc.createMobilePost({
    galleryId: 'dragonlake',
    subject: '테스트 제목',
    content: '테스트 본문입니다.',
    jar: login.jar, // 로그인 시 얻은 쿠키를 그대로 사용
  });

  if (!write.success) {
    console.log(write.message || '글쓰기 실패');
    return;
  }

  console.log('등록된 게시글 번호:', write.postId, '이동 URL:', write.redirectUrl);

  const remove = await dc.deleteMobilePost({
    galleryId: 'dragonlake',
    postId: write.postId,
    jar: login.jar,
  });

  console.log('삭제 성공 여부:', remove.success, '메시지:', remove.message);
})();
```

> 댓글을 제거하려면 `await dc.deleteComment({ galleryId: 'dragonlake', postId: 글번호, commentId: 댓글번호, jar: login.jar });` 형태로 호출하면 됩니다.
> 댓글을 작성하려면 `await dc.createComment({ galleryId: 'dragonlake', postId: 글번호, content: '댓글 내용', jar: login.jar });` 형태로 호출하면 됩니다. 게스트는 `nickname`, `password`, `captchaCode`를 함께 전달하세요.

### 실시간 베스트 추천(실베추)

실시간 베스트 추천을 수행합니다.

```javascript
const dc = require('@gurumnyang/dcinside.js');

(async () => {
  // (선택) 로그인 세션이 있다면 jar을 전달할 수 있습니다.
  // const login = await dc.mobileLogin({ code: process.env.DC_ID, password: process.env.DC_PW });
  // const jar = login.success ? login.jar : undefined;

  // (선택) 프록시 사용 예시 (Axios ProxyConfig 형식)
  const proxy = process.env.HTTP_PROXY
    ? (() => {
        const u = new URL(process.env.HTTP_PROXY);
        return {
          protocol: u.protocol.replace(':', ''),
          host: u.hostname,
          port: u.port ? Number(u.port) : undefined,
          auth: u.username ? { username: u.username, password: u.password } : undefined,
        };
      })()
    : undefined;

  const result = await dc.recommendBest({
    galleryId: 'chatgpt',
    postId: 68960,
    // jar,
    userAgent: process.env.DC_UA,
    proxy,
  });

  console.log('성공 여부:', result.success);
  console.log('메시지:', result.message);
  console.log('HTTP Status:', result.responseStatus);
})();
```


## 터미널 브라우저(TUI)

간단한 터미널 UI로 게시판 열람, 글 조회, 검색을 사용할 수 있습니다.

```bash
npm run tui
```

메뉴에서 게시판 목록 열람(페이지 이동), 통합검색(정확도/최신), 글 바로 조회(갤ID/번호)를 지원합니다.

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

개별 호출 단위로 재시도 횟수를 바꾸고 싶다면 다음처럼 `retryCount`를 지정하세요.

```javascript
await dc.getPost({ galleryId: 'chatgpt', postNo: 12345, retryCount: 5 });
await dc.getPosts({ galleryId: 'chatgpt', postNumbers: [111, 222], retryCount: 5 });
```

## API 레퍼런스

### 핵심 함수

#### `getPostList(options)`

갤러리 페이지에서 게시글 목록을 수집합니다. 기본은 모바일 파서입니다.

**매개변수:**
- `options` (GetPostListOptions)
  - `page` (number): 페이지 번호
  - `galleryId` (string): 갤러리 ID
  - `boardType` (boardType, 선택): 게시판 유형 ('all', 'recommend', 'notice' 중 하나, 기본값: 'all')
  - `delayMs` (number, 선택): 요청 간 지연 시간(ms)

**반환값:**
- `Promise<PostInfo[]>`: 게시글 정보 객체의 배열

---

#### `getPostListLegacy(options)`

PC(레거시) 파서로 갤러리 페이지에서 게시글 목록을 수집합니다. 인터페이스는 `getPostList`와 동일합니다.

---

#### `getPost(options)`

게시글 번호로 게시글 내용을 가져옵니다. 기본은 모바일 파서입니다

**매개변수:**
- `options` (GetPostOptions)
  - `galleryId` (string): 갤러리 ID
  - `postNo` (string | number): 게시글 번호
  - `extractImages` (boolean, 선택): 이미지 URL 추출 여부 (기본값: false)
  - `includeImageSource` (boolean, 선택): 본문에 이미지 URL 포함 여부 (기본값: false)
  - `retryCount` (number, 선택): 이 호출에서 사용할 재시도 횟수 (전역 기본값을 덮어씀)

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
  - `retryCount` (숫자, 선택): 각 게시글 요청에서 사용할 재시도 횟수 (전역 기본값을 덮어씀)

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

#### `mobileLogin(options)`

모바일 로그인 페이지를 통해 인증 쿠키를 획득합니다.

**매개변수:**
- `options` (MobileLoginOptions)
  - `code` (문자열): 디시인사이드 식별 코드(ID)
  - `password` (문자열): 비밀번호
  - `keepLoggedIn` (불리언, 선택): 자동 로그인 여부 (기본값: `true`)
  - `userAgent` (문자열, 선택): 커스텀 User-Agent
  - `jar` (CookieJar, 선택): 외부에서 생성한 쿠키 저장소를 재사용할 때 전달

**반환값:**
- `Promise<MobileLoginResult>`: 성공 여부, 쿠키 목록, `CookieJar`, 리다이렉트 정보 등을 포함한 객체

---

#### `createMobilePost(options)`

모바일 글쓰기 폼을 사용해 게시글을 등록합니다.

**매개변수:**
- `options` (MobileCreatePostOptions)
  - `galleryId` (문자열): 갤러리 ID (필수)
  - `subject` (문자열): 말머리/제목 (필수)
  - `content` (문자열): 본문 (필수)
  - `headText` (문자열 | 숫자, 선택): 말머리 코드
  - `nickname` (문자열, 선택): 비로그인 글쓰기용 닉네임
  - `password` (문자열, 선택): 비로그인 글쓰기용 비밀번호
  - `useGallNickname` (불리언, 선택): 갤러리 닉네임 사용 여부
  - `jar` (CookieJar, 선택): 로그인으로 확보한 쿠키를 전달할 때 사용
  - `userAgent` (문자열, 선택): 커스텀 User-Agent
  - `extraFields` (객체, 선택): 추가 폼 필드 강제 입력

**반환값:**
- `Promise<MobileCreatePostResult>`: 성공 여부, 게시글 번호, 리다이렉트 URL, 서버 메시지 등을 담은 객체

---

#### `deleteMobilePost(options)`

모바일 게시글 삭제 엔드포인트를 호출합니다.

**매개변수:**
- `options` (MobileDeletePostOptions)
  - `galleryId` (문자열): 갤러리 ID (필수)
  - `postId` (문자열 | 숫자): 삭제할 게시글 번호 (필수)
  - `jar` (CookieJar, 선택): 로그인 쿠키가 담긴 저장소
  - `password` (문자열, 선택): 비로그인 삭제 시 사용하는 비밀번호
  - `userAgent` (문자열, 선택): 커스텀 User-Agent

**반환값:**
- `Promise<MobileDeletePostResult>`: 성공 여부와 서버 메시지를 담은 객체

---

#### `deleteMobileComment(options)`

모바일 댓글 삭제 엔드포인트를 호출합니다.

**매개변수:**
- `options` (MobileDeleteCommentOptions)
  - `galleryId` (문자열): 갤러리 ID (필수)
  - `postId` (문자열 | 숫자): 댓글이 달린 게시글 번호 (필수)
  - `commentId` (문자열 | 숫자): 삭제할 댓글 번호 (필수)
  - `jar` (CookieJar, 선택): 로그인 쿠키가 담긴 저장소
  - `password` (문자열, 선택): 비로그인 댓글 삭제 시 사용하는 비밀번호
  - `userAgent` (문자열, 선택): 커스텀 User-Agent

**반환값:**
- `Promise<MobileDeleteCommentResult>`: 성공 여부와 서버 메시지를 담은 객체

---

#### `recommendBest(options)`

모바일 페이지에서 해당 게시글을 조회해 CSRF 토큰을 얻은 뒤 실시간 베스트 추천(실베추) 엔드포인트로 요청을 전송합니다.

**매개변수:**
- `options` (BestRecommendOptions)
  - `galleryId` (문자열): 갤러리 ID (필수)
  - `postId` (문자열 | 숫자): 추천할 게시글 번호 (필수)
  - `jar` (CookieJar, 선택): 로그인(세션) 쿠키 저장소
  - `userAgent` (문자열, 선택): 커스텀 User-Agent
  - `proxy` (ProxyConfig, 선택): Axios 프록시 설정 객체 또는 `false`

**반환값:**
- `Promise<BestRecommendResult>`
  - `success` (불리언): 성공 여부
  - `message` (문자열, 선택): 서버가 전달한 메시지(예: 이미 추천함 등)
  - `responseStatus` (숫자): HTTP 상태 코드
  - `raw` (임의, 선택): 서버 원본 응답 객체

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
- [x] 모바일 로그인/쿠키 수집
- [x] 모바일 게시글 작성/삭제
- [x] 모바일 댓글 삭제
- [ ] 게시글 수정
- [x] 댓글 작성
- [ ] 추천/비추천
- [x] 실시간 베스트 추천(실베추)

## 주의사항

- 디시인사이드의 이용약관을 준수해주세요.
- 과도한 요청은 IP 차단을 유발할 수 있으니 적절한 딜레이(delayMs)를 설정하세요.
- 수집한 데이터는 개인 연구, 분석 등의 비상업적 용도로만 사용해주세요.

## 라이선스

MIT
