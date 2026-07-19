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
const {
  parseGalleryHeadTexts,
  getGalleryHeadTexts,
  changePostHeadText,
} = require('../src/post/managerHeadText');

const headTextHtml = `
  <a href="javascript:;" onclick="listSearchHead(0)">잡담</a>
  <a href="javascript:;" onclick="listSearchHead(120)">❓질문</a>
  <a href="javascript:;" onclick="listSearchHead(10)">💡정보</a>
`;

describe('manager head-text helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('parses unique head-text id/name pairs', () => {
    expect(parseGalleryHeadTexts(`${headTextHtml}<a onclick="listSearchHead(10)">중복</a><a class="font_red" onclick="listSearchHead(999)">매니저</a>`)).toEqual([
      { id: '0', name: '잡담' },
      { id: '120', name: '❓질문' },
      { id: '10', name: '💡정보' },
    ]);
  });

  test('excludes the manager-only 999 search bucket from changeable head texts', () => {
    expect(parseGalleryHeadTexts('<a class="font_red" onclick="listSearchHead(999)">매니저</a>')).toEqual([]);
  });

  test('loads public gallery head texts without a login jar', async () => {
    const get = jest.fn().mockResolvedValue({ status: 200, data: headTextHtml });
    axios.create.mockReturnValue({ get });

    const items = await getGalleryHeadTexts({ galleryId: 'chatgpt' });

    expect(get).toHaveBeenCalledWith(
      'https://gall.dcinside.com/mgallery/board/lists/?id=chatgpt',
      { responseType: 'text' },
    );
    expect(items).toEqual([
      { id: '0', name: '잡담' },
      { id: '120', name: '❓질문' },
      { id: '10', name: '💡정보' },
    ]);
  });

  test('changes one post head text through the manager-only endpoint', async () => {
    const jar = new CookieJar();
    await jar.setCookie(new Cookie({ key: 'ci_c', value: 'csrf-cookie', domain: 'gall.dcinside.com', path: '/' }), 'https://gall.dcinside.com');
    const get = jest.fn().mockResolvedValue({
      status: 200,
      data: `${headTextHtml}<script>chg_headtext_batch(10)</script>`,
    });
    const post = jest.fn().mockResolvedValue({
      status: 200,
      data: { result: 'success', msg: '말머리가 변경되었습니다.' },
    });
    axios.create.mockReturnValue({ get, post });

    const result = await changePostHeadText({
      galleryId: 'chatgpt',
      postId: 115586,
      headTextId: 10,
      jar,
    });

    expect(post).toHaveBeenCalledWith(
      'https://gall.dcinside.com/ajax/minor_manager_board_ajax/chg_headtext',
      'ci_t=csrf-cookie&id=chatgpt&no=115586&headtext=10&_GALLTYPE_=M',
      expect.objectContaining({
        headers: expect.objectContaining({
          origin: 'https://gall.dcinside.com',
          'x-requested-with': 'XMLHttpRequest',
        }),
        responseType: 'json',
      }),
    );
    expect(result).toEqual({
      success: true,
      message: '말머리가 변경되었습니다.',
      responseStatus: 200,
      headText: { id: '10', name: '💡정보' },
      raw: { result: 'success', msg: '말머리가 변경되었습니다.' },
    });
  });

  test('rejects an unknown head-text id before posting', async () => {
    const jar = new CookieJar();
    const post = jest.fn();
    axios.create.mockReturnValue({
      get: jest.fn().mockResolvedValue({ data: `${headTextHtml}<script>chg_headtext_batch(10)</script>` }),
      post,
    });

    await expect(changePostHeadText({ galleryId: 'chatgpt', postId: 1, headTextId: 9999, jar }))
      .rejects.toThrow('유효하지 않은 말머리 ID');
    expect(post).not.toHaveBeenCalled();
  });
});
