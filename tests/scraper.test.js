const { scrapeBoardPages, getPostContent } = require('../src/scraper');

jest.setTimeout(20000); // 네트워크 테스트는 시간 여유를 둠

describe('scraper 주요 기능', () => {
    test('scrapeBoardPages: 게시글 번호 배열 반환', async () => {
        const posts = await scrapeBoardPages(1, 1, 'chatgpt', { exception_mode: 'all' });
        expect(Array.isArray(posts)).toBe(true);
        expect(posts.length).toBeGreaterThan(0);
        expect(typeof posts[0]).toBe('string');
    });

    test('scrapeBoardPages: 잘못된 갤러리 ID 입력 시 빈 배열 반환', async () => {
        const posts = await scrapeBoardPages(1, 1, '존재하지않는갤러리', { exception_mode: 'all' });
        expect(Array.isArray(posts)).toBe(true);
        expect(posts.length).toBe(0);
    });

    test('getPostContent: 게시글 상세 정보 반환', async () => {
        // 실제 게시글 번호를 사용해야 하므로, 위 테스트에서 얻은 번호를 사용
        const posts = await scrapeBoardPages(1, 1, 'chatgpt', { exception_mode: 'all' });
        const post = await getPostContent('chatgpt', posts[0]);
        expect(post).toHaveProperty('postNo');
        expect(post).toHaveProperty('title');
        expect(post).toHaveProperty('author');
        expect(post).toHaveProperty('date');
        expect(post).toHaveProperty('content');
        expect(post).toHaveProperty('comments');
    });

    test('getPostContent: 존재하지 않는 게시글 번호 입력 시 null 반환', async () => {
        const post = await getPostContent('chatgpt', '999999999999');
        expect(post).toBeNull();
    });

    test('scrapeBoardPages: 페이지 범위가 0 이하일 때 빈 배열 반환', async () => {
        const posts = await scrapeBoardPages(0, 0, 'chatgpt', { exception_mode: 'all' });
        expect(Array.isArray(posts)).toBe(true);
        expect(posts.length).toBe(0);
    });

    test('scrapeBoardPages: 옵션 없이 호출 시 정상 동작', async () => {
        const posts = await scrapeBoardPages(1, 1, 'chatgpt');
        expect(Array.isArray(posts)).toBe(true);
        expect(posts.length).toBeGreaterThan(0);
    });

    test('scrapeBoardPages: 예외 옵션(exception_mode: "skip") 동작 확인', async () => {
        const posts = await scrapeBoardPages(1, 1, 'chatgpt', { exception_mode: 'skip' });
        expect(Array.isArray(posts)).toBe(true);
    });

    test('getPostContent: 잘못된 갤러리 ID 입력 시 null 반환', async () => {
        const posts = await scrapeBoardPages(1, 1, 'chatgpt', { exception_mode: 'all' });
        const post = await getPostContent('존재하지않는갤러리', posts[0]);
        expect(post).toBeNull();
    });

    test('getPostContent: 게시글 번호가 문자열이 아닌 경우 null 반환', async () => {
        const post = await getPostContent('chatgpt', null);
        expect(post).toBeNull();
    });
});
