const { parseRedirectFromHtml } = require('../src/post/mobileCommon');

test('parseRedirectFromHtml extracts a post ID from location.href assignment', () => {
  expect(parseRedirectFromHtml(`
    <script>location.href = 'https://m.dcinside.com/board/chatgpt/115085';</script>
  `)).toMatchObject({
    url: 'https://m.dcinside.com/board/chatgpt/115085',
    postId: '115085',
  });
});

test('parseRedirectFromHtml extracts a post ID from location.replace call', () => {
  expect(parseRedirectFromHtml(`
    <script>window.location.replace('/board/chatgpt/115086?from=write');</script>
  `)).toMatchObject({
    url: '/board/chatgpt/115086?from=write',
    postId: '115086',
  });
});

test('parseRedirectFromHtml extracts a post ID from PC query URL', () => {
  expect(parseRedirectFromHtml(`
    <script>parent.location.href='https://gall.dcinside.com/mgallery/board/view/?id=chatgpt&no=115087';</script>
  `)).toMatchObject({ postId: '115087' });
});

test('parseRedirectFromHtml reads a meta refresh board URL without inventing a post ID', () => {
  expect(parseRedirectFromHtml(`
    <meta http-equiv="refresh" content="0; url=https://m.dcinside.com/board/chatgpt">
  `)).toEqual({
    url: 'https://m.dcinside.com/board/chatgpt',
    postId: undefined,
    message: undefined,
  });
});
