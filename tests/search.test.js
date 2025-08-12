// tests/search.test.js

jest.mock('axios', () => {
  let getImpl = () => Promise.resolve({ data: '' });
  const create = jest.fn(() => ({
    get: (...args) => getImpl(...args)
  }));
  return {
    create,
    __setGetImpl: (fn) => { getImpl = fn; }
  };
});

const axios = require('axios');
const { parseSearchHtml, search } = require('../src/search');
const { CrawlError } = require('../src/util');

const SAMPLE_HTML = `
<!doctype html>
<html lang="ko">
  <head><meta charset="utf-8" /></head>
  <body>
    <form>
      <input class="in_keyword" value="검색쿼리" />
    </form>

    <div class="some-gallery-section">
      <ul>
        <li>
          <a href="https://gall.dcinside.com/mgallery/board/lists/?id=chatgpt">챗지피티(ChatGPT)ⓜ</a>
          <span class="rank">153</span>
          <span class="meta">새 글 12/345</span>
        </li>
      </ul>
    </div>

    <ul class="sch_result">
      <li>
        <a class="tit_txt" href="https://gall.dcinside.com/mgallery/board/view/?id=chatgpt&no=1111">첫 번째 게시글</a>
        <p class="link_dsc_txt">첫 번째 요약 내용</p>
        <p class="link_dsc_txt dsc_sub">
          <a class="sub_txt" href="https://gall.dcinside.com/mgallery/board/lists/?id=chatgpt">챗지피티(ChatGPT)ⓜ</a>
        </p>
        <span class="date_time">2025.08.11 10:00:00</span>
      </li>
      <li>
        <a class="tit_txt" href="https://gall.dcinside.com/board/view/?id=programming&no=2222">두 번째 게시글</a>
        <p class="link_dsc_txt">두 번째 요약 내용</p>
        <p class="link_dsc_txt dsc_sub">
          <a class="sub_txt" href="https://gall.dcinside.com/board/lists/?id=programming">프로그래밍 갤러리</a>
        </p>
        <span class="date_time">2025.08.11 11:00:00</span>
      </li>
    </ul>
  </body>
 </html>`;

describe('search parsing', () => {
  test('parseSearchHtml extracts query, galleries and posts', () => {
    const res = parseSearchHtml(SAMPLE_HTML, 'https://search.dcinside.com');
    expect(res.query).toBe('검색쿼리');

    // galleries
    expect(Array.isArray(res.galleries)).toBe(true);
    expect(res.galleries.length).toBeGreaterThanOrEqual(1);
    expect(res.galleries[0]).toMatchObject({
      name: expect.stringContaining('챗지피티'),
      id: 'chatgpt',
      type: 'mgallery',
    });

    // posts
    expect(Array.isArray(res.posts)).toBe(true);
    expect(res.posts.length).toBeGreaterThanOrEqual(2);
    expect(res.posts[0]).toMatchObject({
      title: '첫 번째 게시글',
      content: '첫 번째 요약 내용',
      galleryName: expect.stringContaining('챗지피티'),
      galleryId: 'chatgpt',
    });
    expect(res.posts[0].link).toContain('/board/view/?id=chatgpt');
    expect(res.posts[0].date).toContain('2025');
  });

  test('search() fetches and parses HTML', async () => {
    axios.__setGetImpl(() => Promise.resolve({ data: SAMPLE_HTML }));
    const res = await search('검색쿼리');
    expect(res.posts.length).toBeGreaterThan(0);
    expect(res.galleries.length).toBeGreaterThan(0);
  });

  test('search() throws on empty query', async () => {
    await expect(search('')).rejects.toBeInstanceOf(CrawlError);
  });
});

