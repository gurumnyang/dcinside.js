// index.test.js (improved: offline, deterministic)

jest.mock('../src/scraper', () => ({
  scrapeBoardPage: jest.fn(),
  getPostContent: jest.fn(),
  getMobilePostContent: jest.fn(),
}));

jest.mock('../src/util', () => ({
  delay: jest.fn(() => Promise.resolve()),
  getRandomUserAgent: jest.fn(() => 'Mock-UA'),
}));

const { scrapeBoardPage, getPostContent, getMobilePostContent } = require('../src/scraper');
const { delay, getRandomUserAgent } = require('../src/util');

// Require after mocks
const api = require('../index');

jest.setTimeout(5000);

beforeAll(() => {
  jest.spyOn(global.console, 'warn').mockImplementation(() => {});
  jest.spyOn(global.console, 'error').mockImplementation(() => {});
});

afterAll(() => {
  console.warn.mockRestore();
  console.error.mockRestore();
});

describe('Public API (index.js) - unit (mocked)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('getPostList delegates to scrapeBoardPage and returns list', async () => {
    const fakeList = [
      { id: '1', title: 'T1', link: 'L1', author: {}, date: '', count: 0, recommend: 0, replyCount: 0, type: 'text', subject: '' },
    ];
    scrapeBoardPage.mockResolvedValue(fakeList);

    const res = await api.getPostList({ page: 1, galleryId: 'g', boardType: 'all' });

    expect(scrapeBoardPage).toHaveBeenCalledWith(1, 'g', { boardType: 'all' });
    expect(res).toEqual(fakeList);
  });

    test('getPost delegates to mobile getMobilePostContent with rest options including retryCount', async () => {
    const fakePost = { postNo: '123', title: 'Hello', author: 'me', date: '', content: '', comments: { totalCount: 0, items: [] } };
    getMobilePostContent.mockResolvedValue(fakePost);

    const res = await api.getPost({ galleryId: 'g', postNo: '123', extractImages: true, retryCount: 5 });

    expect(getMobilePostContent).toHaveBeenCalledWith('g', '123', { extractImages: true, retryCount: 5 });
    expect(res).toEqual(fakePost);
  });

  test('getPostLegacy delegates to legacy getPostContent', async () => {
    const fakePost = { postNo: '321', title: 'Legacy', author: 'me', date: '', content: '', comments: { totalCount: 0, items: [] } };
    getPostContent.mockResolvedValue(fakePost);
    const res = await api.getPostLegacy({ galleryId: 'g', postNo: '321' });
    expect(getPostContent).toHaveBeenCalledWith('g', '321', {});
    expect(res).toEqual(fakePost);
  });

  test('getPosts iterates via mobile parser, calls delay, onProgress, and returns posts', async () => {
    const numbers = ['1', { id: 2 }, 'bad', 3];
    // Configure mobile getMobilePostContent responses
    getMobilePostContent
      .mockResolvedValueOnce({ postNo: '1', title: 'P1', author: '', date: '', content: '', comments: { totalCount: 0, items: [] } })
      .mockResolvedValueOnce({ postNo: '2', title: 'P2', author: '', date: '', content: '', comments: { totalCount: 0, items: [] } })
      .mockResolvedValueOnce({ postNo: 'bad', title: 'PB', author: '', date: '', content: '', comments: { totalCount: 0, items: [] } })
      .mockResolvedValueOnce({ postNo: '3', title: 'P3', author: '', date: '', content: '', comments: { totalCount: 0, items: [] } });

    let progressCalls = 0;
    const res = await api.getPosts({
      galleryId: 'g',
      postNumbers: numbers,
      delayMs: 10,
      onProgress: () => { progressCalls++; },
      extractImages: true,
      retryCount: 2,
    });

    // getPostContent should receive normalized ids: '1', 2, 'bad', 3
  expect(getMobilePostContent).toHaveBeenNthCalledWith(1, 'g', '1', { extractImages: true, retryCount: 2 });
  expect(getMobilePostContent).toHaveBeenNthCalledWith(2, 'g', 2, { extractImages: true, retryCount: 2 });
  expect(getMobilePostContent).toHaveBeenNthCalledWith(3, 'g', 'bad', { extractImages: true, retryCount: 2 });
  expect(getMobilePostContent).toHaveBeenNthCalledWith(4, 'g', 3, { extractImages: true, retryCount: 2 });

    // delay is called between iterations (n-1 times)
    expect(delay).toHaveBeenCalledTimes(numbers.length - 1);
    expect(progressCalls).toBe(numbers.length);
    expect(Array.isArray(res)).toBe(true);
    expect(res.length).toBe(4);
  });

  test('getRandomUserAgent comes from util (mocked)', () => {
    const ua = api.getRandomUserAgent();
    expect(ua).toBe('Mock-UA');
    expect(getRandomUserAgent).toHaveBeenCalled();
  });
});
