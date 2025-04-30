// index.test.js
const dcCrawler = require('../index');

jest.setTimeout(30000); // 네트워크 테스트는 시간 여유를 둠

beforeAll(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterAll(() => {
  console.warn.mockRestore();
  console.error.mockRestore();
});

describe('@gurumnyang/dcinside.js 라이브러리 주요 API 테스트', () => {
  // 테스트에 사용할 갤러리 ID
  const testGalleryId = 'chatgpt';
  const testPostNo = '22690'; // 실제 게시글 번호로 대체 필요
  const testImagePostNo = '22720'
  
  describe('getPostList 함수', () => {
    test('갤러리 게시글 번호 목록을 반환해야 함', async () => {
      const postList = await dcCrawler.getPostList({
        page: 1,
        galleryId: testGalleryId,
        boardType: 'all'
      });
      
      expect(Array.isArray(postList)).toBe(true);
      expect(postList.length).toBeGreaterThan(0);
      expect(typeof postList[0]).toBe('object');
      expect(postList[0]).toHaveProperty('id');
      expect(postList[0]).toHaveProperty('title');
      expect(postList[0]).toHaveProperty('link');
      expect(postList[0]).toHaveProperty('author');
      expect(postList[0]).toHaveProperty('date');
      expect(postList[0]).toHaveProperty('count');
      expect(postList[0]).toHaveProperty('recommend');
      expect(postList[0]).toHaveProperty('replyCount');
      expect(postList[0]).toHaveProperty('type');
      expect(postList[0]).toHaveProperty('subject');
      expect(postList[0].type).toMatch(/notice|picture|text|recommended|survey|unknown/);
    });

    test('잘못된 갤러리 ID로 호출 시 빈 배열 반환', async () => {
      const postList = await dcCrawler.getPostList({
        page: 1,
        galleryId: '존재하지않는갤러리',
        boardType: 'all'
      });
      
      expect(Array.isArray(postList)).toBe(true);
      expect(postList.length).toBe(0);
    });

    test('다양한 boardType으로 호출 가능', async () => {
      const types = ['all', 'recommend', 'notice'];
      
      for (const boardType of types) {
        const postList = await dcCrawler.getPostList({
          page: 1,
          galleryId: testGalleryId,
          boardType
        });
        
        expect(Array.isArray(postList)).toBe(true);
        // notice는 게시글이 없을 수도 있으므로 검증하지 않음
        if (boardType !== 'notice') {
          expect(postList.length).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('getPost 함수', () => {
    test('게시글 상세 정보 반환', async () => {

      const post = await dcCrawler.getPost({
        galleryId: testGalleryId,
        postNo: testPostNo
      });
      
      expect(post).not.toBeNull();
      expect(post).toHaveProperty('postNo');
      expect(post).toHaveProperty('title');
      expect(post).toHaveProperty('author');
      expect(post).toHaveProperty('date');
      expect(post).toHaveProperty('content');
      expect(post).toHaveProperty('comments');
      expect(post.comments).toHaveProperty('totalCount');
      expect(post.comments).toHaveProperty('items');
      expect(Array.isArray(post.comments.items)).toBe(true);
    });

    test('이미지 URL 추출 옵션 테스트', async () => {
      const post = await dcCrawler.getPost({
        galleryId: testGalleryId,
        postNo: testImagePostNo,
        extractImages: true
      });
      
      expect(post).not.toBeNull();
      expect(post).toHaveProperty('images');
      expect(Array.isArray(post.images)).toBe(true);
    });
    
    test('이미지 소스 포함 옵션 테스트', async () => {
      const post = await dcCrawler.getPost({
        galleryId: testGalleryId,
        postNo: testImagePostNo,
        extractImages: true,
        includeImageSource: true
      });
      
      expect(post).not.toBeNull();
      expect(post).toHaveProperty('content');
      // 이미지 URL 포함 형식 테스트: [image(0):"URL"]
      expect(post.content).toMatch(/\[image\(\d+\)\:"https?:\/\/.*?"\]/);
    });

    test('존재하지 않는 게시글 번호 요청 시 null 반환', async () => {
      const post = await dcCrawler.getPost({
        galleryId: testGalleryId,
        postNo: '999999999999'
      });
      
      expect(post).toBeNull();
    });
  });

  describe('getPosts 함수', () => {
    test('여러 게시글 정보를 배열로 반환', async () => {
      const postList = await dcCrawler.getPostList({
        page: 1,
        galleryId: testGalleryId,
        boardType: 'all'
      });
      
      // 게시글이 2개 이상인 경우에만 테스트
      if (postList.length >= 2) {
        const testPostNumbers = postList.slice(0, 2); // 처음 2개만 테스트
        
        let progressCalled = false;
        const posts = await dcCrawler.getPosts({
          galleryId: testGalleryId,
          postNumbers: testPostNumbers,
          delayMs: 100,
          onProgress: (current, total) => {
            progressCalled = true;
            expect(typeof current).toBe('number');
            expect(typeof total).toBe('number');
            expect(current).toBeLessThanOrEqual(total);
          }
        });
        
        expect(Array.isArray(posts)).toBe(true);
        expect(posts.length).toBeLessThanOrEqual(testPostNumbers.length);
        
        // 최소 하나의 게시글은 성공적으로 가져와야 함
        if (posts.length > 0) {
          const post = posts[0];
          expect(post).toHaveProperty('postNo');
          expect(post).toHaveProperty('title');
          expect(post).toHaveProperty('author');
          expect(post).toHaveProperty('content');
        }
        
        // 진행 상황 콜백이 호출되었는지 확인
        expect(progressCalled).toBe(true);
      }
    });
    
    test('빈 배열 요청 시 빈 배열 반환', async () => {
      const posts = await dcCrawler.getPosts({
        galleryId: testGalleryId,
        postNumbers: [],
        delayMs: 100
      });
      
      expect(Array.isArray(posts)).toBe(true);
      expect(posts.length).toBe(0);
    });
  });
  
  describe('유틸리티 함수', () => {
    test('getRandomUserAgent 함수는 문자열 반환', () => {
      const userAgent = dcCrawler.getRandomUserAgent();
      expect(typeof userAgent).toBe('string');
      expect(userAgent.length).toBeGreaterThan(0);
    });
  });
});