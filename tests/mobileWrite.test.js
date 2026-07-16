const { CookieJar } = require('tough-cookie');

const formInstances = [];

jest.mock('form-data', () => {
  return class MockFormData {
    constructor() {
      this.parts = [];
      formInstances.push(this);
    }

    append(name, value, options) {
      this.parts.push({ name, value, options });
    }

    getHeaders() {
      return { 'content-type': 'multipart/form-data; boundary=test' };
    }
  };
});

jest.mock('../src/post/mobileCommon', () => ({
  AJAX_HEADERS: {},
  DEFAULT_MOBILE_UA: 'Mock-UA',
  HTML_HEADERS: {},
  WRITE_BASE_URL: 'https://m.dcinside.com',
  WRITE_UPLOAD_URL: 'https://mupload.dcinside.com/write_new.php',
  IMAGE_UPLOAD_URL: 'https://mupload.dcinside.com/upload_img.php',
  DELETE_POST_ENDPOINT: 'https://m.dcinside.com/del/board',
  createMobileClient: jest.fn(),
  getCookiesAsync: jest.fn().mockResolvedValue([]),
  getWithRedirect: jest.fn(),
  findBlockOrConKey: jest.fn().mockReturnValue('block-key'),
  parseRedirectFromHtml: jest.fn(),
}));

const mobileCommon = require('../src/post/mobileCommon');
const { createMobilePost } = require('../src/post/mobileWrite');

const writeHtml = `
  <html>
    <head><meta name="csrf-token" content="csrf-token" /></head>
    <body>
      <form id="writeForm">
        <input name="id" value="chatgpt" />
        <input name="route_id" value="chatgpt" />
        <input name="subject" value="" />
        <textarea name="memo"></textarea>
        <input name="headtext" value="0" />
      </form>
    </body>
  </html>
`;

beforeEach(() => {
  jest.clearAllMocks();
  formInstances.length = 0;
  mobileCommon.getWithRedirect.mockResolvedValue({ data: writeHtml, status: 200 });
  mobileCommon.getCookiesAsync.mockResolvedValue([]);
  mobileCommon.findBlockOrConKey.mockReturnValue('block-key');
  mobileCommon.parseRedirectFromHtml.mockReturnValue({
    url: 'https://m.dcinside.com/board/chatgpt/123',
    postId: '123',
    message: '등록되었습니다.',
  });
});

test('createMobilePost appends images to upload[] in order', async () => {
  const post = jest.fn((url) => {
    if (url.endsWith('/ajax/i_filter')) return Promise.resolve({ data: { result: true }, status: 200 });
    if (url.endsWith('/upload_img.php')) {
      return Promise.resolve({ data: { result: true, thumb: ['thumb-1', 'thumb-2'] }, status: 200 });
    }
    return Promise.resolve({ data: 'ok', status: 200 });
  });
  mobileCommon.createMobileClient.mockReturnValue({ post });

  const first = Buffer.from('first-image');
  const second = Buffer.from('second-image');
  const result = await createMobilePost({
    galleryId: 'chatgpt',
    subject: 'image post',
    content: 'body',
    jar: new CookieJar(),
    images: [
      { data: first, filename: 'first.jpg', contentType: 'image/jpeg' },
      { data: second, filename: 'second.png', contentType: 'image/png' },
    ],
  });

  const imageParts = formInstances[0].parts.filter(part => part.name === 'upload[]');
  expect(imageParts).toHaveLength(2);
  expect(imageParts[0]).toEqual({
    name: 'upload[]',
    value: first,
    options: { filename: 'first.jpg', contentType: 'image/jpeg', knownLength: first.length },
  });
  expect(imageParts[1].options.filename).toBe('second.png');
  const finalForm = formInstances[1];
  const memo = finalForm.parts.find(part => part.name === 'memo').value;
  expect(memo).toContain('body');
  expect(memo).toContain('https://dcimg6.dcinside.co.kr/viewimageM.php?no=thumb-1');
  expect(memo).toContain('https://dcimg6.dcinside.co.kr/viewimageM.php?no=thumb-2');
  expect(memo).toContain('class="block" contenteditable="false"');
  expect(memo).toContain('class="cont img"');
  expect(finalForm.parts.filter(part => part.name === 'files')).toHaveLength(1);
  expect(result).toMatchObject({
    success: true,
    postId: '123',
    imageUrls: [
      'https://dcimg6.dcinside.co.kr/viewimageM.php?no=thumb-1',
      'https://dcimg6.dcinside.co.kr/viewimageM.php?no=thumb-2',
    ],
  });
});

test('createMobilePost preserves the text-only empty files field', async () => {
  mobileCommon.createMobileClient.mockReturnValue({
    post: jest.fn().mockResolvedValue({ data: 'ok', status: 200 }),
  });

  await createMobilePost({
    galleryId: 'chatgpt',
    subject: 'text post',
    content: 'body',
    jar: new CookieJar(),
  });

  expect(formInstances[0].parts.filter(part => part.name === 'files')).toHaveLength(1);
  expect(formInstances[0].parts.some(part => part.name === 'upload[]')).toBe(false);
});

test('createMobilePost resolves the post ID from the latest board list after meta refresh', async () => {
  const boardHtml = `
    <ul class="gall-detail-lst">
      <li>
        <div class="gall-detail-lnktb">
          <a href="https://m.dcinside.com/board/chatgpt/456" class="lt">
            <span class="subjectin">lookup post</span>
          </a>
        </div>
        <span class="blockInfo" data-info="member123"></span>
      </li>
    </ul>
  `;
  mobileCommon.parseRedirectFromHtml.mockReturnValue({
    url: 'https://m.dcinside.com/board/chatgpt',
    postId: undefined,
    message: undefined,
  });
  mobileCommon.getWithRedirect
    .mockResolvedValueOnce({ data: writeHtml, status: 200 })
    .mockResolvedValueOnce({ data: writeHtml, status: 200 })
    .mockResolvedValueOnce({ data: boardHtml, status: 200 });
  mobileCommon.createMobileClient.mockReturnValue({
    post: jest.fn().mockResolvedValue({ data: 'ok', status: 200 }),
  });

  const result = await createMobilePost({
    galleryId: 'chatgpt',
    subject: 'lookup post',
    content: 'body',
    jar: new CookieJar(),
  });

  expect(result).toMatchObject({
    success: true,
    postId: '456',
    redirectUrl: 'https://m.dcinside.com/board/chatgpt/456',
  });
});

test('createMobilePost rejects malformed image input before network access', async () => {
  await expect(createMobilePost({
    galleryId: 'chatgpt',
    subject: 'bad image',
    content: 'body',
    jar: new CookieJar(),
    images: [{ data: Buffer.alloc(0), filename: 'empty.jpg', contentType: 'image/jpeg' }],
  })).rejects.toThrow('비어 있지 않은 Buffer');

  expect(mobileCommon.createMobileClient).not.toHaveBeenCalled();
});

test('createMobilePost rejects newline characters in image filenames', async () => {
  await expect(createMobilePost({
    galleryId: 'chatgpt',
    subject: 'bad filename',
    content: 'body',
    jar: new CookieJar(),
    images: [{ data: Buffer.from('image'), filename: 'bad\r\nname.jpg', contentType: 'image/jpeg' }],
  })).rejects.toThrow('개행 문자를 사용할 수 없습니다');

  expect(mobileCommon.createMobileClient).not.toHaveBeenCalled();
});
