// 실습: 통합검색 API로 '특이점' 검색
// 실행: node tests/search.practice.js

const { search } = require('../../');

(async () => {
  try {
    const query = '지피티';
    console.log(`[검색] query="${query}"`);

    const result = await search(query);

    const gallery = result.gallery || {};
    console.log('갤러리 요약:', {
      name: gallery.name || null,
      rank: gallery.rank ?? null,
      new_post: gallery.new_post ?? null,
      total_post: gallery.total_post ?? null,
    });

    console.log(result);

    console.log(`검색 결과 게시글 수: ${result.posts.length}`);
  } catch (err) {
    console.error('실습 검색 중 오류:', err?.message || err);
  }
})();

