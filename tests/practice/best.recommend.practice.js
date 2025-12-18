// 실행 예:
//   DC_ID=아이디 DC_PW=비밀번호 node tests/practice/best.recommend.practice.js chatgpt 68960

const dc = require('../../index');

function buildProxyConfig() {
  const proxyUrl = process.env.HTTP_PROXY || process.env.http_proxy || process.env.HTTPS_PROXY || process.env.https_proxy;
  if (!proxyUrl) return undefined;
  try {
    const parsed = new URL(proxyUrl);
    return {
      protocol: parsed.protocol.replace(':', ''),
      host: parsed.hostname,
      port: parsed.port ? Number(parsed.port) : undefined,
      auth: parsed.username ? { username: parsed.username, password: parsed.password } : undefined,
    };
  } catch (err) {
    console.warn('프록시 URL 파싱 실패:', err?.message || err);
    return undefined;
  }
}

async function run() {
  const galleryId = process.argv[2] || 'chatgpt';
  const postNo = process.argv[3] || '68960';

  console.log(`[실베 추천] galleryId=${galleryId}, postNo=${postNo}`);
  const proxy = buildProxyConfig();
  if (proxy) {
    console.log('프록시 사용:', proxy);
  }

  let jar;
  if (process.env.DC_ID && process.env.DC_PW) {
    console.log('로그인 세션 확보 중...');
    const login = await dc.mobileLogin({
      code: process.env.DC_ID,
      password: process.env.DC_PW,
      userAgent: process.env.DC_UA,
    });
    if (!login.success) {
      console.error('로그인 실패:', login.reason);
      process.exitCode = 1;
      return;
    }
    jar = login.jar;
  }

  const result = await dc.recommendBest({
    galleryId,
    postId: postNo,
    jar,
    userAgent: process.env.DC_UA,
    proxy,
  });

  console.log('성공 여부:', result.success);
  console.log('메시지:', result.message);
  console.log('HTTP Status:', result.responseStatus);
  console.log('서버 RAW 응답:', result.raw);
}

run().catch(err => {
  console.error('실행 오류:', err?.message || err);
  process.exitCode = 1;
});
