const { scrapeBoardPages, getPostContent } = require('../src/scraper');

jest.setTimeout(20000); // 네트워크 테스트는 시간 여유를 둠

describe('scraper 주요 기능', () => {
    test('scrapeBoardPages: 게시글 번호 배열 반환', async () => {
        const posts = await scrapeBoardPages(1, 1, 'chatgpt', { exception_mode: 'all' });
        expect(Array.isArray(posts)).toBe(true);
        expect(posts.length).toBeGreaterThan(0);
        expect(typeof posts[0]).toBe('string');
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
});
