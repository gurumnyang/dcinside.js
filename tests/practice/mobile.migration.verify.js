// 실행 예: node tests/practice/mobile.migration.verify.js chatgpt 1 10
// chatgpt 갤러리 1페이지에서 최근 글 10개를 대상으로
// PC(getPostContent) vs Mobile(getMobilePostContent) 비교 검증

const { scrapeBoardPage, getPostContent, getMobilePostContent } = require('../../src/scraper');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function toNum(x) {
  if (x == null) return null;
  const s = String(x).replace(/[^\d]/g, '');
  return s ? Number(s) : null;
}

function compareOne(pc, mob) {
  const issues = [];

  // title
  const titleOk = !!pc?.title && !!mob?.title && pc.title.trim() === mob.title.trim();
  if (!titleOk) issues.push(`title mismatch: pc="${pc?.title}" mob="${mob?.title}"`);

  // author
  const authorOk = !!pc?.author && !!mob?.author && pc.author.trim() === mob.author.trim();
  if (!authorOk) issues.push(`author mismatch: pc="${pc?.author}" mob="${mob?.author}"`);

  // date (pc has seconds, mobile often minute precision) -> startsWith check
  const dateOk = !!pc?.date && !!mob?.date && (pc.date.startsWith(mob.date) || mob.date.startsWith(pc.date));
  if (!dateOk) issues.push(`date mismatch: pc="${pc?.date}" mob="${mob?.date}"`);

  // recommend / dislike
  const pcUp = toNum(pc?.recommendCount); const mobUp = toNum(mob?.recommendCount);
  const pcDown = toNum(pc?.dislikeCount); const mobDown = toNum(mob?.dislikeCount);
  const upOk = pcUp != null && mobUp != null && pcUp === mobUp;
  const downOk = pcDown != null && mobDown != null && pcDown === mobDown;
  if (!upOk) issues.push(`recommend mismatch: pc=${pcUp} mob=${mobUp}`);
  if (!downOk) issues.push(`dislike mismatch: pc=${pcDown} mob=${mobDown}`);

  // content similarity: allow differences due to mobile rendering; require both non-empty and similar length
  const pcLen = (pc?.content || '').length;
  const mobLen = (mob?.content || '').length;
  const lenOk = pcLen > 0 && mobLen > 0 && (Math.min(pcLen, mobLen) / Math.max(pcLen, mobLen)) >= 0.6;
  if (!lenOk) issues.push(`content length ratio low: pc=${pcLen} mob=${mobLen}`);

  // comments tolerance (mobile hidden may include 삭제댓글): <= 2 차이면 OK
  const pcC = Number(pc?.comments?.totalCount || 0);
  const mobC = Number(mob?.comments?.totalCount || 0);
  const cOk = Math.abs(pcC - mobC) <= 2;
  if (!cOk) issues.push(`comments mismatch: pc=${pcC} mob=${mobC}`);

  const ok = issues.length === 0;
  return { ok, issues };
}

async function main() {
  const galleryId = process.argv[2] || 'chatgpt';
  const page = Number(process.argv[3] || 1);
  const take = Number(process.argv[4] || 10);

  console.log(`[설정] galleryId=${galleryId}, page=${page}, take=${take}`);
  const list = await scrapeBoardPage(page, galleryId, { boardType: 'all' });
  if (!Array.isArray(list) || !list.length) {
    console.error('목록 수집 실패 또는 비어있음');
    process.exit(1);
  }
  const ids = list.slice(0, take).map(p => Number(p.id)).filter(Number.isInteger);
  console.log(`[수집] 대상 게시글 수: ${ids.length}`);

  const results = [];
  for (let i = 0; i < ids.length; i++) {
    const no = ids[i];
    process.stdout.write(`\r[${i + 1}/${ids.length}] 수집 중: ${no} `);
    let pc = null, mob = null, error = null;
    try { pc = await getPostContent(galleryId, no, { extractImages: true }); } catch (e) { error = e; }
    await sleep(200); // 너무 세게 두드리지 않도록 약간 쉼
    try { mob = await getMobilePostContent(galleryId, no, { extractImages: true }); } catch (e) { error = e; }

    if (!pc || !mob) {
      results.push({ no, ok: false, error: `pc=${!!pc}, mob=${!!mob}, err=${error?.message || ''}` });
      continue;
    }
    const cmp = compareOne(pc, mob);
    results.push({ no, ok: cmp.ok, issues: cmp.issues });
    await sleep(200);
  }
  process.stdout.write('\n');

  const passed = results.filter(r => r.ok).length;
  const failed = results.length - passed;
  console.log(`검증 완료: PASS=${passed}, FAIL=${failed}`);
  if (failed) {
    console.log('\n실패 상세:');
    results.filter(r => !r.ok).forEach(r => {
      console.log(`- no=${r.no}: ${r.issues ? r.issues.join(' | ') : r.error}`);
    });
  }
}

main().catch(e => { console.error('치명적 오류:', e?.message || e); process.exit(1); });
