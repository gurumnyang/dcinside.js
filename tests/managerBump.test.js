const { CookieJar, Cookie } = require('tough-cookie');

jest.mock('axios', () => ({
  __esModule: true,
  default: { create: jest.fn() },
  create: jest.fn(),
}));

jest.mock('axios-cookiejar-support', () => ({
  wrapper: jest.fn(client => client),
}));

const axios = require('axios').default;
const { bumpManagerPost } = require('../src/post/managerBump');

describe('bumpManagerPost', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('uses the authenticated manager contract for a minor-gallery post', async () => {
    const jar = new CookieJar();
    await jar.setCookie(new Cookie({ key: 'ci_c', value: 'csrf-cookie', domain: 'gall.dcinside.com', path: '/' }), 'https://gall.dcinside.com');

    const get = jest.fn().mockResolvedValue({
      status: 200,
      data: '<script type="text/x-jquery-tmpl"><button onclick="update_bump()">끌올</button></script>',
    });
    const post = jest.fn().mockResolvedValue({
      status: 200,
      data: { result: 'success', msg: '끌올되었습니다.' },
    });
    axios.create.mockReturnValue({ get, post });

    const result = await bumpManagerPost({
      galleryId: 'chatgpt',
      postId: 12345,
      jar,
      userAgent: 'UA-TEST',
      proxy: false,
    });

    expect(get).toHaveBeenCalledWith(
      'https://gall.dcinside.com/mgallery/board/lists/?id=chatgpt',
      { responseType: 'text' },
    );
    expect(post).toHaveBeenCalledWith(
      'https://gall.dcinside.com/ajax/minor_manager_board_ajax/update_bump',
      'ci_t=csrf-cookie&id=chatgpt&_GALLTYPE_=M&nos%5B%5D=12345',
      expect.objectContaining({
        headers: expect.objectContaining({
          origin: 'https://gall.dcinside.com',
          referer: 'https://gall.dcinside.com/mgallery/board/lists/?id=chatgpt',
          'x-requested-with': 'XMLHttpRequest',
        }),
        responseType: 'json',
      }),
    );
    expect(result).toEqual({
      success: true,
      message: '끌올되었습니다.',
      responseStatus: 200,
      raw: { result: 'success', msg: '끌올되었습니다.' },
    });
  });

  test('refuses to post when manager bump controls are absent', async () => {
    const jar = new CookieJar();
    const post = jest.fn();
    axios.create.mockReturnValue({
      get: jest.fn().mockResolvedValue({ status: 200, data: '<html>일반 이용자 화면</html>' }),
      post,
    });

    await expect(bumpManagerPost({ galleryId: 'chatgpt', postId: 123, jar }))
      .rejects.toThrow('끌올 관리자 권한이 없습니다.');
    expect(post).not.toHaveBeenCalled();
  });

  test('requires an authenticated CookieJar', async () => {
    await expect(bumpManagerPost({ galleryId: 'chatgpt', postId: 123 }))
      .rejects.toThrow('jar는 필수입니다.');
  });
});
