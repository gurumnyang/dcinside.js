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

  test('현재 모바일 댓글 구조에서 작성자 정보를 추출한다', () => {
    const html = `
      <html>
        <body>
          <span class="tit">테스트 제목</span>
          <ul class="ginfo2"><li>작성자</li><li>2026.07.29 13:40</li></ul>
          <div class="thum-txtin">본문</div>
          <ul class="all-comment-lst">
            <li class="comment" no="360793">
              <div class="ginfo-area">
                <button type="button" class="nick">ㅇㅇ</button>
                <a href="/gallog/scarce3318">
                  <span class="blockCommentId" data-info="scarce3318"></span>
                </a>
              </div>
              <p class="txt">댓글 내용</p>
              <span class="date">07.29 13:40</span>
            </li>
          </ul>
        </body>
      </html>
    `;

    const post = parseMobilePostHtml(html);

    expect(post.comments.items).toEqual([
      expect.objectContaining({
        id: '360793',
        author: {
          nickname: 'ㅇㅇ',
          userId: 'scarce3318',
          ip: '',
        },
      }),
    ]);
  });

  test('기존 a.nick 댓글 구조도 계속 지원한다', () => {
    const html = `
      <html>
        <body>
          <span class="tit">테스트 제목</span>
          <ul class="ginfo2"><li>작성자</li><li>2026.07.29 13:40</li></ul>
          <div class="thum-txtin">본문</div>
          <ul class="all-comment-lst">
            <li class="comment" no="360794">
              <a class="nick">
                글쓴 기존작성자
                <span class="blockCommentId" data-info="legacy-user"></span>
              </a>
              <span class="ip">(127.0.0.1)</span>
              <p class="txt">기존 댓글</p>
              <span class="date">07.29 13:41</span>
            </li>
          </ul>
        </body>
      </html>
    `;

    const post = parseMobilePostHtml(html);

    expect(post.comments.items[0].author).toEqual({
      nickname: '기존작성자',
      userId: 'legacy-user',
      ip: '127.0.0.1',
    });
  });
});
