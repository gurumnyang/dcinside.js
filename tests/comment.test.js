const { CookieJar } = require('tough-cookie');
const { CrawlError } = require('../src/util');

jest.mock('../src/post/mobileCommon', () => ({
  AJAX_HEADERS: { 'content-type': 'application/x-www-form-urlencoded; charset=UTF-8' },
  DELETE_COMMENT_ENDPOINT: 'https://m.dcinside.com/del/comment',
  HTML_HEADERS: {},
  WRITE_BASE_URL: 'https://m.dcinside.com',
  createMobileClient: jest.fn(),
  getWithRedirect: jest.fn(),
  findBlockOrConKey: jest.fn(),
  getWithRedirectToHtml: jest.fn(),
  parseRedirectFromHtml: jest.fn(),
}));

const mobileCommon = require('../src/post/mobileCommon');
const { createMobileComment } = require('../src/comment/mobileComment');

const { createMobileClient, getWithRedirect, findBlockOrConKey } = mobileCommon;

const loggedInHtml = `
<html>
  <head>
    <meta name="csrf-token" content="csrf-member" />
  </head>
  <body>
    <input id="user_id" value="member123" />
    <input id="board_id" value="board123" />
    <input id="reple_id" value="" />
    <input id="best_chk" value="" />
    <input id="comment_no" value="" />
    <input id="cpage" value="1" />
    <input id="gall_nickname" value="갤닉" />
    <input id="use_gall_nickname" value="1" />
    <input id="rand_codeC" value="" />
    <input id="comment_nick" value="" />
    <input id="comment_pw" value="" />
    <div class="comment-write">
      <input type="text" name="bot_field" class="hide-robot" />
    </div>
    <div class="gallview-tit-box"><span class="tit">테스트 제목</span></div>
  </body>
</html>
`;

const guestHtml = `
<html>
  <head>
    <meta name="csrf-token" content="csrf-guest" />
  </head>
  <body>
    <input id="user_id" value="" />
    <input id="board_id" value="board123" />
    <input id="reple_id" value="" />
    <input id="best_chk" value="" />
    <input id="comment_no" value="" />
    <input id="cpage" value="1" />
    <input id="comment_nick" value="" />
    <input id="comment_pw" value="" />
    <input id="rand_codeC" value="guestRand" />
    <div class="comment-write">
      <input type="text" name="guest_robot" class="hide-robot" />
      <img src="/captcha/code?id=chatgpt&dccode=guestRand&type=C" />
    </div>
    <div class="gallview-tit-box"><span class="tit">게스트 제목</span></div>
  </body>
</html>
`;

beforeEach(() => {
  jest.clearAllMocks();
  findBlockOrConKey.mockReturnValue('mock-con-key');
});

test('createMobileComment uses logged-in session tokens and posts comment', async () => {
  const postMock = jest.fn((url, body) => {
    if (url.endsWith('/ajax/access')) {
      expect(body).toBe('token_verify=com_submit');
      return Promise.resolve({ data: { Block_key: 'mock-con-key' }, status: 200 });
    }
    expect(url).toBe('https://m.dcinside.com/ajax/comment-write');
    expect(body).toContain('comment_memo=Hello+world');
    expect(body).toContain('mode=com_write');
    expect(body).toContain('comment_no=');
    expect(body).toContain('comment_pw=');
    expect(body).toContain('bot_field=1');
    expect(body).toContain('use_gall_nickname=1');
    expect(body).toContain('con_key=mock-con-key');
    expect(body).toContain('subject=%ED%85%8C%EC%8A%A4%ED%8A%B8+%EC%A0%9C%EB%AA%A9');
    return Promise.resolve({ data: { result: 1, comment_no: '555', cause: 'ok' }, status: 200 });
  });

  createMobileClient.mockReturnValue({ post: postMock });
  getWithRedirect.mockResolvedValue({ data: loggedInHtml });

  const result = await createMobileComment({
    galleryId: 'chatgpt',
    postId: 16,
    content: 'Hello world',
    jar: new CookieJar(),
  });

  expect(result.success).toBe(true);
  expect(result.commentId).toBe('555');
  expect(postMock).toHaveBeenCalledTimes(2);
});

test('guest comment requires nickname', async () => {
  createMobileClient.mockReturnValue({ post: jest.fn() });
  getWithRedirect.mockResolvedValue({ data: guestHtml });

  await expect(createMobileComment({ galleryId: 'chatgpt', postId: 42, content: 'hi' }))
    .rejects.toThrow('nickname은 게스트 댓글 작성 시 필수입니다.');
});

test('guest comment without captcha code raises CrawlError', async () => {
  createMobileClient.mockReturnValue({ post: jest.fn() });
  getWithRedirect.mockResolvedValue({ data: guestHtml });

  const err = await createMobileComment({
    galleryId: 'chatgpt',
    postId: 42,
    content: 'hello',
    nickname: '비회원',
    password: 'pw12',
  }).catch(e => e);

  expect(err).toBeInstanceOf(CrawlError);
  expect(err.metadata.captchaKey).toBe('guestRand');
  expect(err.metadata.captchaUrl).toContain('guestRand');
});

test('guest comment succeeds with captcha code', async () => {
  const postMock = jest.fn((url, body) => {
    if (url.endsWith('/ajax/access')) {
      return Promise.resolve({ data: { Block_key: 'mock-con-key' }, status: 200 });
    }
    expect(body).toContain('comment_nick=%EB%B9%84%ED%9A%8C%EC%9B%90');
    expect(body).toContain('comment_pw=pw12');
    expect(body).toContain('captcha_code=abcd');
    expect(body).toContain('rand_code=guestRand');
    expect(body).toContain('guest_robot=1');
    return Promise.resolve({ data: { result: 1, comment_no: '987' }, status: 200 });
  });

  createMobileClient.mockReturnValue({ post: postMock });
  getWithRedirect.mockResolvedValue({ data: guestHtml });

  const result = await createMobileComment({
    galleryId: 'chatgpt',
    postId: 42,
    content: 'guest comment',
    nickname: '비회원',
    password: 'pw12',
    captchaCode: 'abcd',
  });

  expect(result.success).toBe(true);
  expect(result.commentId).toBe('987');
  expect(postMock).toHaveBeenCalledTimes(2);
});

test('createMobileComment treats boolean result true as success', async () => {
  const postMock = jest.fn((url) => {
    if (url.endsWith('/ajax/access')) {
      return Promise.resolve({ data: { Block_key: 'mock-con-key' }, status: 200 });
    }
    return Promise.resolve({ data: { result: true, data: 12345 }, status: 200 });
  });

  createMobileClient.mockReturnValue({ post: postMock });
  getWithRedirect.mockResolvedValue({ data: loggedInHtml });

  const result = await createMobileComment({
    galleryId: 'chatgpt',
    postId: 1,
    content: 'hello',
    jar: new CookieJar(),
  });

  expect(result.success).toBe(true);
  expect(result.commentId).toBe('12345');
});
