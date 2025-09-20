// 실행 예: node tests/practice/mobile.login.practice.js your_id your_password

const api = require('../../');

async function run() {
  const code = process.argv[2] || process.env.DCINSIDE_CODE;
  const password = process.argv[3] || process.env.DCINSIDE_PASSWORD;

  if (!code || !password) {
    console.error('식별 코드와 비밀번호를 인자로 전달하거나 환경 변수 DCINSIDE_CODE / DCINSIDE_PASSWORD로 설정해 주세요.');
    process.exitCode = 1;
    return;
  }

  try {
    const result = await api.mobileLogin({ code, password, keepLoggedIn: true });
    console.log('로그인 성공 여부:', result.success);
    if (!result.success) {
      console.log('실패 사유:', result.reason || '(알 수 없음)');
    }
    console.log('최종 URL:', result.finalUrl);
    console.log('리다이렉트 횟수:', result.redirectCount);
    console.log('쿠키 수:', result.cookies.length);
    if (result.success) {
      const printable = result.cookies
        .filter(cookie => cookie.domain.includes('dcinside'))
        .map(cookie => `${cookie.key}=${cookie.value} (domain=${cookie.domain}, expires=${cookie.expires || 'session'})`);
      console.log('dcinside 관련 쿠키:', printable.join('\n  '));
    }
  } catch (e) {
    console.error('로그인 실행 오류:', e?.message || e);
    process.exitCode = 1;
  }
}

run();
