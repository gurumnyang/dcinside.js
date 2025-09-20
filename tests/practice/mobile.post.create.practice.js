// Warning: 실행 시 실제로 게시글이 등록됩니다. 테스트 전 반드시 갤러리, 제목, 본문을 확인하세요.
// 실행 예 (로그인):
//   DCINSIDE_CODE=식별코드 DCINSIDE_PASSWORD=비밀번호 node tests/practice/mobile.post.create.practice.js chatgpt "제목" "<p>본문</p>" --login
// 실행 예 (비로그인):
//   node tests/practice/mobile.post.create.practice.js chatgpt "제목" "<p>본문</p>" --guest --nickname 닉네임 --password 비밀번호

const api = require('../../');

function parseArgs(argv) {
  const [, , galleryId, subject, content, ...rest] = argv;
  const options = { galleryId, subject, content, mode: 'login', nickname: undefined, password: undefined };
  for (let i = 0; i < rest.length; i++) {
    const token = rest[i];
    if (token === '--guest') options.mode = 'guest';
    else if (token === '--login') options.mode = 'login';
    else if (token === '--nickname') options.nickname = rest[++i];
    else if (token === '--password') options.password = rest[++i];
  }
  return options;
}

async function run() {
  const { galleryId, subject, content, mode, nickname, password } = parseArgs(process.argv);
  if (!galleryId || !subject || !content) {
    console.error('사용법: node tests/practice/mobile.post.create.practice.js <galleryId> <subject> <htmlContent> [--login|--guest ...]');
    process.exitCode = 1;
    return;
  }

  try {
    let jar;
    if (mode === 'login') {
      const code = process.env.DCINSIDE_CODE;
      const pw = process.env.DCINSIDE_PASSWORD;
      if (!code || !pw) {
        console.error('[오류] 로그인 모드에는 환경 변수 DCINSIDE_CODE, DCINSIDE_PASSWORD가 필요합니다.');
        process.exitCode = 1;
        return;
      }
      console.log('[정보] 모바일 로그인 시도 중...');
      const login = await api.mobileLogin({ code, password: pw, keepLoggedIn: true });
      if (!login.success) {
        console.error('[오류] 로그인 실패:', login.reason || '알 수 없음');
        process.exitCode = 1;
        return;
      }
      jar = login.jar;
      console.log('[정보] 로그인 성공. 게시글을 등록합니다.');
    } else {
      if (!nickname || !password) {
        console.error('[오류] 게스트 모드에는 --nickname 닉네임 --password 비밀번호 옵션이 필요합니다.');
        process.exitCode = 1;
        return;
      }
    }

    const result = await api.createPost({
      galleryId,
      subject,
      content,
      jar,
      nickname,
      password,
    });

    console.log('[결과] 성공 여부:', result.success);
    if (result.postId) console.log('[결과] postId:', result.postId);
    if (result.redirectUrl) console.log('[결과] redirectUrl:', result.redirectUrl);
    if (result.message) console.log('[결과] message:', result.message);
    console.log('[결과] status:', result.responseStatus);
  } catch (err) {
    console.error('[오류]', err?.message || err);
    process.exitCode = 1;
  }
}

run();

