// 모바일 버전 getPost 스트레스(레이트리밋) 테스트

const { getMobilePostContent } = require('../../src/scraper/post');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function runWorkers(tasks, concurrency) {
  let idx = 0; const stats = { done: 0 };
  const results = new Array(tasks.length);
  const workers = Array.from({ length: concurrency }, async () => {
    while (true) {
      const cur = idx++; if (cur >= tasks.length) break;
      const t = tasks[cur];
      const s = Date.now();
      try { results[cur] = await t(); }
      catch (e) { results[cur] = { ok: false, err: e?.message || String(e) }; }
      finally { stats.done++; if (stats.done % 50 === 0) process.stdout.write(`\r진행 ${stats.done}/${tasks.length}`); }
    }
  });
  await Promise.all(workers);
  process.stdout.write(`\r진행 ${tasks.length}/${tasks.length}\n`);
  return results;
}

async function main() {
  const galleryId = process.argv[2] || 'chatgpt';
  const page = Number(process.argv[3] || 1);
  const sample = Number(process.argv[4] || 20);
  const iterations = Number(10000);
  const concurrency = Number(process.argv[6] || 20);

  const ids = ['54070']
  if (!ids.length) { console.error('유효한 게시글 ID가 없습니다.'); process.exit(1); }
  console.log(`[스트레스] 대상 게시글 수: ${ids.length}, 총 요청 수: ${ids.length * iterations}`);

  // Build task array
  const tasks = [];
  for (let i = 0; i < iterations; i++) {
    for (const no of ids) {
      tasks.push(async () => {
        const started = Date.now();
        try {
          const post = await getMobilePostContent(galleryId, no, { extractImages: false });
          const ms = Date.now() - started;
          return { ok: !!post, ms, no };
        } catch (e) {
          const ms = Date.now() - started;
          return { ok: false, ms, no, err: e?.message || String(e) };
        }
      });
    }
  }

  const t0 = Date.now();
  const out = await runWorkers(tasks, concurrency);
  const elapsed = Date.now() - t0;

  const succ = out.filter(x => x && x.ok);
  const fail = out.filter(x => !x || !x.ok);
  const avg = succ.length ? Math.round(succ.reduce((a, b) => a + b.ms, 0) / succ.length) : 0;
  const p95 = (() => {
    const arr = succ.map(x => x.ms).sort((a, b) => a - b);
    if (!arr.length) return 0;
    return arr[Math.floor(arr.length * 0.95) - 1] || arr[arr.length - 1];
  })();

  console.log('=== 결과 ===');
  console.log(`총 요청: ${out.length}`);
  console.log(`성공: ${succ.length}`);
  console.log(`실패: ${fail.length}`);
  console.log(`평균 응답(ms): ${avg}`);
  console.log(`95퍼센타일(ms): ${p95}`);
  console.log(`총 소요(ms): ${elapsed}`);

  if (fail.length) {
    const top = fail.slice(0, 5).map(f => `${f.no}:${f.err || 'unknown'}`);
    console.log('실패 예시 5개:', top);
  }
}

main().catch(e => { console.error('치명적 오류:', e?.message || e); process.exit(1); });
