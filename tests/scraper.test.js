const { scrapeBoardPage, getPostContent } = require('../src/scraper');

jest.setTimeout(20000); // 네트워크 테스트는 시간 여유를 둠

beforeAll(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
});
  
afterAll(() => {
    console.warn.mockRestore();
    console.error.mockRestore();
});

describe('scraper 주요 기능', () => {

    const testPostNo = '22690'; // 실제 게시글 번호로 대체 필요
    const testCommentPostNo = '22690'; // 댓글이 있는 게시글 번호

    test('scrapeBoardPage 게시글 번호 배열 반환', async () => {
        const posts = await scrapeBoardPage(1, 'chatgpt', { boardType: 'all' });
        expect(Array.isArray(posts)).toBe(true);
        expect(posts.length).toBeGreaterThan(0);
        expect(typeof posts[0]).toBe('object');
    });

    test('scrapeBoardPage: 잘못된 갤러리 ID 입력 시 빈 배열 반환', async () => {
        const posts = await scrapeBoardPage(1, '존재하지않는갤러리', { boardType: 'all' });
        expect(Array.isArray(posts)).toBe(true);
        expect(posts.length).toBe(0);
    });

    test('getPostContent: 게시글 상세 정보 반환', async () => {
        // 실제 게시글 번호를 사용해야 하므로, 위 테스트에서 얻은 번호를 사용
        const post = await getPostContent('chatgpt', testPostNo);
        expect(post).toHaveProperty('postNo');
        expect(post).toHaveProperty('title');
        expect(post).toHaveProperty('author');
        expect(post).toHaveProperty('date');
        expect(post).toHaveProperty('content');
        expect(post).toHaveProperty('comments');
    });

    // 댓글이 있는 게시글 번호로 테스트
    test('getPostContent: 댓글이 있는 게시글 번호로 호출 시 댓글 정보 포함', async () => {
        const post = await getPostContent('chatgpt', testCommentPostNo);
        expect(post).toHaveProperty('comments');
        expect(post.comments).toHaveProperty('totalCount');
        expect(post.comments).toHaveProperty('items');
        expect(Array.isArray(post.comments.items)).toBe(true);
    });

    test('getPostContent: 존재하지 않는 게시글 번호 입력 시 null 반환', async () => {
        const post = await getPostContent('chatgpt', '999999999999');
        expect(post).toBeNull();
    });

    test('scrapeBoardPage: 페이지 범위가 0 이하일 때 빈 배열 반환', async () => {
        const posts = await scrapeBoardPage(0, 'chatgpt', { boardType: 'all' });
        expect(Array.isArray(posts)).toBe(true);
        expect(posts.length).toBe(0);
    });

    test('scrapeBoardPage: 옵션 없이 호출 시 정상 동작', async () => {
        const posts = await scrapeBoardPage(1, 'chatgpt');
        expect(Array.isArray(posts)).toBe(true);
        expect(posts.length).toBeGreaterThan(0);
    });

    test('getPostContent: 잘못된 갤러리 ID 입력 시 null 반환', async () => {
        const posts = await scrapeBoardPage(1, 'chatgpt', { boardType: 'all' });
        const post = await getPostContent('존재하지않는갤러리', posts[0].id);
        expect(post).toBeNull();
    });

    test('getPostContent: 게시글 번호가 문자열이 아닌 경우 null 반환', async () => {
        const post = await getPostContent('chatgpt', null);
        expect(post).toBeNull();
    });
});
