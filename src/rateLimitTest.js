// rateLimitTest.js

const axios = require('axios');

/**
 * 주어진 URL에 대해 지정된 횟수만큼 요청을 보내고,
 * 응답 상태와 시간 등을 기록하여 rate limit 발생 여부를 측정합니다.
 *
 * @param {number} numRequests - 보낼 총 요청 수
 * @param {number} delayBetweenRequests - 요청 사이의 딜레이 (밀리초)
 */
async function testRateLimit(numRequests, delayBetweenRequests) {
    // 테스트 대상 URL (여기선 갤러리 목록 페이지를 예시로 사용)
    const url = 'https://gall.dcinside.com/mgallery/board/lists/?id=chatgpt&list_num=100&search_head=&page=1';

    let successes = 0;
    let rateLimited = 0;
    let otherErrors = 0;
    let totalResponseTime = 0;

    console.log(`총 요청 수: ${numRequests}, 요청 간 딜레이: ${delayBetweenRequests}ms`);

    for (let i = 0; i < numRequests; i++) {
        const startTime = Date.now();
        try {
            const response = await axios.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
                }
            });
            const responseTime = Date.now() - startTime;
            totalResponseTime += responseTime;
            if (response.status === 200) {
                successes++;
                console.log(`요청 ${i + 1}: 성공 (200), 응답 시간: ${responseTime}ms`);
            } else {
                console.log(`요청 ${i + 1}: 상태 코드 ${response.status}, 응답 시간: ${responseTime}ms`);
            }
        } catch (error) {
            const responseTime = Date.now() - startTime;
            totalResponseTime += responseTime;
            if (error.response) {
                if (error.response.status === 429) {
                    rateLimited++;
                    console.log(`요청 ${i + 1}: Rate Limited (429), 응답 시간: ${responseTime}ms`);
                } else {
                    otherErrors++;
                    console.log(`요청 ${i + 1}: 오류 상태 ${error.response.status}, 응답 시간: ${responseTime}ms`);
                }
            } else {
                otherErrors++;
                console.log(`요청 ${i + 1}: 네트워크 오류 - ${error.message}`);
            }
        }
        // 지정된 딜레이 적용
        await new Promise(resolve => setTimeout(resolve, delayBetweenRequests));
    }

    console.log('========== 테스트 결과 ==========');
    console.log(`총 요청: ${numRequests}`);
    console.log(`성공: ${successes}`);
    console.log(`Rate Limited (429): ${rateLimited}`);
    console.log(`기타 오류: ${otherErrors}`);
    const totalMeasured = successes + rateLimited;
    if (totalMeasured > 0) {
        console.log(`평균 응답 시간: ${(totalResponseTime / totalMeasured).toFixed(2)} ms`);
    } else {
        console.log('응답을 받은 요청이 없습니다.');
    }
}

// 테스트 실행: 예를 들어, 20회의 요청을 100ms 간격으로 보냅니다.
testRateLimit(600, 100);
