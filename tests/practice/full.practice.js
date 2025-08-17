// 종합 실습: 공개 API 전 기능 1회씩 실행
// 실행 예: node tests/practice/full.practice.js chatgpt latest

const api = require('../../');

async function run() {
  const galleryId = process.argv[2] || 'chatgpt';
  const sortArg = (process.argv[3] || '').toLowerCase();
  const sort = sortArg === 'latest' || sortArg === 'accuracy' ? sortArg : undefined;

  console.log(`[설정] galleryId=${galleryId}${sort ? `, search.sort=${sort}` : ''}`);

  // 1) 게시판 목록 수집
  let list = [];
  try {
    list = await api.getPostList({ page: 1, galleryId, boardType: 'all' });
    console.log(`[getPostList] 수집=${list.length}, 첫 항목:`, list[0] || null);
  } catch (e) {
    console.error('[getPostList] 오류:', e?.message || e);
  }

  // 게시글 번호 확보
  const ids = list.map(p => p.id).filter(Boolean);
  const firstId = ids[2];

  // 2) 단일 게시글 수집
  try {
    if (!firstId) throw new Error('게시글 번호가 없습니다');
    const post = await api.getPost({ galleryId, postNo: firstId, extractImages: true });
    console.log(`[getPost] no=${firstId}, title=${post?.title}`);
  } catch (e) {
    console.error('[getPost] 오류:', e?.message || e);
  }

  // 3) 복수 게시글 수집
  try {
    const postNumbers = ids.slice(0, 2).length ? ids.slice(0, 2) : (firstId ? [firstId] : []);
    const posts = await api.getPosts({ galleryId, postNumbers, delayMs: 10, extractImages: false, onProgress: (c,t)=> process.stdout.write(`\r[getPosts] 진행 ${c}/${t}`) });
    process.stdout.write('\n');
    console.log(`[getPosts] 수집=${posts.length}`);
  } catch (e) {
    console.error('[getPosts] 오류:', e?.message || e);
  }

  // 4) 자동완성
  try {
    const result = await api.getAutocomplete('chat');
    console.log('[getAutocomplete] keys:', Object.keys(result || {}));
  } catch (e) {
    console.error('[getAutocomplete] 오류:', e?.message || e);
  }

  // 5) 통합검색
  try {
    const q = 'chatgpt';
    const res = await api.search(q, sort ? { sort } : undefined);
    console.log(`[search] query=${res.query || q}, galleries=${res.galleries?.length||0}, posts=${res.posts?.length||0}`);
  } catch (e) {
    console.error('[search] 오류:', e?.message || e);
  }
}

run().catch(e => {
  console.error('실습 스크립트 치명적 오류:', e?.message || e);
  process.exitCode = 1;
});

