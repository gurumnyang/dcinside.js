#!/usr/bin/env node
// Terminal DCInside browser
// Features: Board list, Post view, Search (latest/accuracy)

const inquirer = require('inquirer').default;
const api = require('../..');

const DEFAULT_GALLERY = 'chatgpt';

function truncate(str, n = 80) {
  if (!str) return '';
  const s = String(str).replace(/\s+/g, ' ').trim();
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

function safeNum(s) {
  if (s == null) return 0;
  const m = String(s).match(/[\d,]+/);
  return m ? Number(m[0].replace(/,/g, '')) : 0;
}

function parseNoFromLink(link) {
  try {
    const u = new URL(link);
    const no = u.searchParams.get('no') || '';
    return no || null;
  } catch (_) {
    return null;
  }
}

function printPost(post, opts = {}) {
  const width = process.stdout.columns || 100;
  const line = '-'.repeat(Math.min(width, 100));
  const header = `${post.title}\n${post.author} | ${post.date} | 조회 ${post.viewCount} | 추천 ${post.recommendCount} / 비추천 ${post.dislikeCount}`;
  const content = (post.content || '').replace(/\r/g, '');
  console.log(line);
  console.log(header);
  console.log(line);
  console.log(content);
  console.log(line);
  const total = post.comments?.totalCount || 0;
  const items = post.comments?.items || [];
  if (total > 0) {
    const show = Math.min(items.length, opts.commentsLimit || 10);
    console.log(`댓글 ${total}개 (표시: ${show}/${items.length})`);
    for (let i = 0; i < show; i++) {
      const c = items[i];
      const nick = c?.author?.nickname || '익명';
      const ip = c?.author?.ip ? ` (${c.author.ip})` : '';
      console.log(`- ${nick}${ip} | ${c.regDate}\n  ${c.memo}`);
    }
  } else {
    console.log('댓글 0개');
  }
  if (Array.isArray(post.images) && post.images.length) {
    console.log(line);
    console.log(`이미지 ${post.images.length}개:`);
    for (const img of post.images.slice(0, 5)) console.log(`- ${img}`);
    if (post.images.length > 5) console.log(`... (${post.images.length - 5}개 더 있음)`);
  }
  console.log(line);
}

async function promptMain() {
  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: '메뉴를 선택하세요',
      choices: [
        { name: '게시판 열람', value: 'board' },
        { name: '검색', value: 'search' },
        { name: '글 바로 조회(갤ID/번호)', value: 'view' },
        { name: '종료', value: 'exit' },
      ],
    },
  ]);
  return action;
}

async function flowBoard() {
  let galleryId = (await inquirer.prompt([{ type: 'input', name: 'g', message: '갤러리 ID', default: DEFAULT_GALLERY }])).g || DEFAULT_GALLERY;
  let page = Number((await inquirer.prompt([{ type: 'number', name: 'p', message: '페이지 번호', default: 1 }])).p || 1);
  let type = (await inquirer.prompt([{ type: 'list', name: 't', message: '게시판 유형', choices: [
    { name: '전체글', value: 'all' },
    { name: '개념글', value: 'recommend' },
    { name: '공지', value: 'notice' },
  ], default: 'all' }])).t;

  while (true) {
    let list = [];
    try {
      list = await api.getPostList({ page, galleryId, boardType: type });
    } catch (e) {
      console.error('목록 수집 실패:', e?.message || e);
    }
    if (!Array.isArray(list) || list.length === 0) {
      const { cont } = await inquirer.prompt([{ type: 'confirm', name: 'cont', message: '목록이 비었습니다. 다시 시도할까요?', default: true }]);
      if (!cont) return;
      continue;
    }

    const choices = list.map(p => ({
      name: `(${p.id}) [${p.subject}] ${truncate(p.title, 80)} | ${p.author?.nickname || ''} | ${p.date} | 조회 ${p.count} | 댓 ${p.replyCount}`,
      value: p.id,
    }));
    choices.push(new inquirer.Separator());
    choices.push({ name: '이전 페이지', value: '__prev' });
    choices.push({ name: '다음 페이지', value: '__next' });
    choices.push({ name: '메인으로', value: '__back' });

    const { pick } = await inquirer.prompt([{ type: 'list', name: 'pick', message: `${galleryId} - ${page}페이지`, pageSize: 20, choices }]);
    if (pick === '__back') return;
    if (pick === '__prev') { page = Math.max(1, page - 1); continue; }
    if (pick === '__next') { page = page + 1; continue; }

    const no = pick;
    try {
      const post = await api.getPost({ galleryId, postNo: no, extractImages: true, includeImageSource: false });
      if (!post) {
        console.log('게시글을 불러오지 못했습니다.');
      } else {
        printPost(post, { commentsLimit: 10 });
      }
    } catch (e) {
      console.error('글 조회 실패:', e?.message || e);
    }

    const { next } = await inquirer.prompt([{ type: 'list', name: 'next', message: '다음 작업', choices: [
      { name: '목록으로', value: 'list' },
      { name: '메인으로', value: 'back' },
    ] }]);
    if (next === 'back') return;
  }
}

async function flowSearch() {
  const { q } = await inquirer.prompt([{ type: 'input', name: 'q', message: '검색어' }]);
  if (!q || !q.trim()) return;
  const { sort } = await inquirer.prompt([{ type: 'list', name: 'sort', message: '정렬', choices: [
    { name: '기본(정확도)', value: 'accuracy' },
    { name: '최신순', value: 'latest' },
  ], default: 'accuracy' }]);

  let res;
  try { res = await api.search(q, { sort }); }
  catch (e) { console.error('검색 실패:', e?.message || e); return; }

  const posts = Array.isArray(res?.posts) ? res.posts : [];
  if (!posts.length) { console.log('검색 결과가 없습니다.'); return; }

  const choices = posts.slice(0, 50).map((p, i) => ({
    name: `${i + 1}. ${truncate(p.title, 80)} | ${p.galleryName || ''} | ${p.date || ''}`,
    value: p,
  }));
  choices.push(new inquirer.Separator());
  choices.push({ name: '메인으로', value: null });

  const { sel } = await inquirer.prompt([{ type: 'list', name: 'sel', message: `검색 결과 (${posts.length}건)`, pageSize: 20, choices }]);
  if (!sel) return;

  // Try to parse galleryId + post no from link
  let galleryId = sel.galleryId || '';
  let no = parseNoFromLink(sel.link);
  if (!galleryId) {
    try { galleryId = new URL(sel.link).searchParams.get('id') || ''; } catch (_) {}
  }
  if (!galleryId || !no) {
    console.log('링크에서 갤러리/번호를 파싱할 수 없습니다.');
    return;
  }

  try {
    const post = await api.getPost({ galleryId, postNo: no, extractImages: true, includeImageSource: false });
    if (!post) console.log('게시글을 불러오지 못했습니다.');
    else printPost(post, { commentsLimit: 10 });
  } catch (e) {
    console.error('글 조회 실패:', e?.message || e);
  }
}

async function flowView() {
  const ans = await inquirer.prompt([
    { type: 'input', name: 'galleryId', message: '갤러리 ID', default: DEFAULT_GALLERY },
    { type: 'input', name: 'postNo', message: '게시글 번호' },
  ]);
  if (!ans.postNo) return;
  try {
    const post = await api.getPost({ galleryId: ans.galleryId, postNo: ans.postNo, extractImages: true });
    if (!post) console.log('게시글을 불러오지 못했습니다.');
    else printPost(post, { commentsLimit: 10 });
  } catch (e) {
    console.error('글 조회 실패:', e?.message || e);
  }
}

async function main() {
  console.log('DCInside 터미널 브라우저');
  // main loop
  while (true) {
    const action = await promptMain();
    if (action === 'exit') break;
    if (action === 'board') await flowBoard();
    else if (action === 'search') await flowSearch();
    else if (action === 'view') await flowView();
    await api.delay(50);
  }
  console.log('종료합니다.');
}

if (require.main === module) {
  main().catch(err => {
    console.error('치명적 오류:', err?.message || err);
    process.exit(1);
  });
}

