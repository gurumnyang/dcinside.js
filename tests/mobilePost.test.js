const { parseMobilePostHtml } = require('../src/scraper/post/mobilePost');

describe('모바일 게시글 본문 파서', () => {
  test('본문 내부 광고와 실행 요소를 제외한다', () => {
    const html = `
      <html>
        <body>
          <span class="tit">테스트 제목</span>
          <ul class="ginfo2"><li>작성자</li><li>2026.07.10 12:00</li></ul>
          <div class="thum-txtin">
            <p>실제 본문</p>
            <div class="adv-groupin">
              <script>(function () { window.dcAd = true; })();</script>
              <ins>광고 문구</ins>
            </div>
            <style>.hidden { display: none; }</style>
            <noscript>스크립트를 켜세요</noscript>
          </div>
        </body>
      </html>
    `;

    const post = parseMobilePostHtml(html);

    expect(post.content).toBe('실제 본문');
    expect(post.content).not.toContain('window.dcAd');
    expect(post.content).not.toContain('광고 문구');
  });
});
