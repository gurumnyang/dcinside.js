// Warning: 실행 시 실제 댓글이 작성됩니다. 대상 갤러리/게시글/댓글 내용을 반드시 확인하세요.
// 실행 예 (로그인):
//   DCINSIDE_CODE=식별코드 DCINSIDE_PASSWORD=비밀번호 \
//   node tests/practice/mobile.comment.create.practice.js chatgpt 123456 "테스트 댓글" --login --use-gall-nickname
// 실행 예 (비로그인):
//   node tests/practice/mobile.comment.create.practice.js chatgpt 123456 "테스트 댓글" --guest --nickname 닉네임 --password 글비밀번호 --captcha 캡차코드

const api = require('../../');
const { CrawlError } = require('../../src/util');

function parseArgs(argv) {
  const [, , galleryId, postId, ...rest] = argv;
  let content;
  const options = {
    galleryId,
    postId,
    content: undefined,
    mode: 'login',
    nickname: undefined,
    password: undefined,
    captchaCode: undefined,
    captchaKey: undefined,
    useGallNickname: undefined,
  };

  const tokens = [...rest];
  // First non-flag token after gallery/post is treated as comment content
  if (tokens.length && !tokens[0].startsWith('--')) {
    content = tokens.shift();
    options.content = content;
  }

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token === '--guest') options.mode = 'guest';
    else if (token === '--login') options.mode = 'login';
    else if (token === '--nickname') options.nickname = tokens[++i];
    else if (token === '--password') options.password = tokens[++i];
    else if (token === '--captcha') options.captchaCode = tokens[++i];
    else if (token === '--captcha-key') options.captchaKey = tokens[++i];
    else if (token === '--use-gall-nickname') options.useGallNickname = true;
    else if (token === '--no-gall-nickname') options.useGallNickname = false;
    else {
      // allow spaces in content: remaining tokens appended
      options.content = options.content ? `${options.content} ${token}` : token;
    }
  }

  return options;
}

function printCaptchaHelp(metadata) {
  console.error('[안내] 캡차 입력이 필요합니다.');
  if (metadata?.captchaUrl) {
    console.error(' - 캡차 이미지 URL:', metadata.captchaUrl);
  }
  if (metadata?.captchaKey) {
    console.error(' - 캡차 키:', metadata.captchaKey);
    console.error('   (스크립트 실행 시 --captcha <코드> 옵션과 함께 사용하세요. 키가 변경되면 --captcha-key <새키> 로 전달 가능합니다.)');
  }
}

async function run() {
  const {
    galleryId,
    postId,
    content,
    mode,
    nickname,
    password,
    captchaCode,
    captchaKey,
    useGallNickname,
  } = parseArgs(process.argv);

  if (!galleryId || !postId || !content) {
    console.error('사용법: node tests/practice/mobile.comment.create.practice.js <galleryId> <postId> "<comment>" [--login|--guest ...]');
    console.error('옵션: --guest --nickname <닉네임> --password <비번> --captcha <코드> --captcha-key <키> --use-gall-nickname --no-gall-nickname');
    process.exitCode = 1;
    return;
  }

  let jar;
  try {
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
      console.log('[정보] 로그인 성공. 댓글을 작성합니다.');
    } else {
      if (!nickname || !password) {
        console.error('[오류] 게스트 모드에는 --nickname 닉네임 --password 글비밀번호 옵션이 필요합니다.');
        process.exitCode = 1;
        return;
      }
      if (!captchaCode) {
        console.warn('[경고] 게스트 댓글은 캡차가 필요할 수 있습니다. 오류 발생 시 캡차 코드를 --captcha 옵션으로 전달해주세요.');
      }
    }

    const result = await api.createComment({
      galleryId,
      postId,
      content,
      jar,
      nickname: mode === 'guest' ? nickname : undefined,
      password: mode === 'guest' ? password : undefined,
      captchaCode,
      captchaKey,
      useGallNickname,
    });

    console.log('[결과] 성공 여부:', result.success);
    if (result.commentId) console.log('[결과] commentId:', result.commentId);
    if (result.message) console.log('[결과] message:', result.message);
    console.log('[결과] status:', result.responseStatus);
    if (result.captchaKey) console.log('[결과] captchaKey:', result.captchaKey);
    if (result.captchaImageUrl) console.log('[결과] captchaImageUrl:', result.captchaImageUrl);
    if (result.raw && typeof result.raw === 'object') console.log('[결과] raw:', JSON.stringify(result.raw));
  } catch (err) {
    if (err instanceof CrawlError) {
      console.error('[오류]', err.message);
      if (err.metadata) printCaptchaHelp(err.metadata);
    } else {
      console.error('[오류]', err?.message || err);
    }
    process.exitCode = 1;
  }
}

run();
