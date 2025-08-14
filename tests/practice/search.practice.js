// 실습: 통합검색 API로 '지피티' 검색
// 실행 예: node tests/practice/search.practice.js [latest|accuracy]

const { search } = require('../../');

(async () => {
  try {
    const query = '지피티';
    const sortArg = (process.argv[2] || '').toLowerCase();
    const sort = sortArg === 'latest' || sortArg === 'accuracy' ? sortArg : undefined;
    console.log(`[검색] query="${query}"${sort ? `, sort=${sort}` : ''}`);

    const result = await search(query, sort ? { sort } : undefined);

    console.log(result.posts);
    console.log(`검색 결과 게시글 수: ${result.posts.length}`);
    //매핑 후 table로 출력(링크 제외)
  } catch (err) {
    console.error('실습 검색 중 오류:', err?.message || err);
  }
})();
