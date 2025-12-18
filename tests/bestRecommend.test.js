const { CookieJar } = require('tough-cookie');

jest.mock('../src/post/mobileCommon', () => ({
  AJAX_HEADERS: {
    accept: '*/*',
    'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
    'x-requested-with': 'XMLHttpRequest',
  },
  HTML_HEADERS: {
    Accept: 'text/html',
  },
  WRITE_BASE_URL: 'https://m.dcinside.com',
  createMobileClient: jest.fn(),
  getWithRedirect: jest.fn(),
}));

const mobileCommon = require('../src/post/mobileCommon');
const { recommendBestPost } = require('../src/post/bestRecommend');

describe('recommendBestPost', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('posts recommendation with csrf token and proxy support', async () => {
    const html = `
      <html>
        <head>
          <meta name="csrf-token" content="token123">
        </head>
      </html>
    `;
    mobileCommon.getWithRedirect.mockResolvedValue({ data: html });

    const postMock = jest.fn(() => Promise.resolve({
      status: 200,
      data: { result: true, cause: '추천되었습니다.' },
    }));
    mobileCommon.createMobileClient.mockReturnValue({ post: postMock });

    const proxy = { host: '127.0.0.1', port: 8080 };
    const jar = new CookieJar();

    const result = await recommendBestPost({
      galleryId: 'chatgpt',
      postId: 123,
      jar,
      userAgent: 'UA-TEST',
      proxy,
    });

    expect(mobileCommon.createMobileClient).toHaveBeenCalledWith(jar, 'UA-TEST', proxy);
    expect(mobileCommon.getWithRedirect).toHaveBeenCalledWith(
      expect.any(Object),
      'https://m.dcinside.com/board/chatgpt/123',
      expect.objectContaining({
        headers: expect.objectContaining({ Referer: 'https://m.dcinside.com/board/chatgpt' }),
      })
    );

    expect(postMock).toHaveBeenCalledWith(
      'https://m.dcinside.com/bestcontent/recommend',
      'id=chatgpt&no=123',
      expect.objectContaining({
        headers: expect.objectContaining({
          'x-csrf-token': 'token123',
          Origin: 'https://m.dcinside.com',
          Referer: 'https://m.dcinside.com/board/chatgpt/123',
        }),
        responseType: 'json',
      })
    );

    expect(result).toEqual({
      success: true,
      message: '추천되었습니다.',
      responseStatus: 200,
      raw: { result: true, cause: '추천되었습니다.' },
    });
  });

  test('throws if csrf token missing', async () => {
    mobileCommon.getWithRedirect.mockResolvedValue({ data: '<html></html>' });
    mobileCommon.createMobileClient.mockReturnValue({ post: jest.fn() });

    await expect(recommendBestPost({ galleryId: 'chatgpt', postId: 1 }))
      .rejects.toThrow('CSRF 토큰을 찾을 수 없습니다.');
  });

  test('handles failure response', async () => {
    const html = `
      <html>
        <head>
          <meta name="csrf-token" content="abc123">
        </head>
      </html>
    `;
    mobileCommon.getWithRedirect.mockResolvedValue({ data: html });

    const failure = { result: false, cause: '이미 추천한 게시글입니다.' };
    mobileCommon.createMobileClient.mockReturnValue({
      post: jest.fn(() => Promise.resolve({ status: 200, data: failure })),
    });

    const res = await recommendBestPost({ galleryId: 'chatgpt', postId: 777 });

    expect(res).toEqual({
      success: false,
      message: '이미 추천한 게시글입니다.',
      responseStatus: 200,
      raw: failure,
    });
  });
});
