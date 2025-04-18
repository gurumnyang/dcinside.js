// util.js
const inquirer = require('inquirer');

/**
 * 사용자에게 질문을 하고 입력값을 반환합니다.
 * @param {string} query - 사용자에게 표시될 질문
 * @returns {Promise<string>} - 사용자가 입력한 답변 (공백 제거됨)
 */
async function askQuestion(query) {
    const { answer } = await inquirer.prompt([
        {
            type: 'input',
            name: 'answer',
            message: query,
        },
    ]);
    return answer.trim();
}

/**
 * 입력값이 유효한 숫자인지 검증하고, 유효하지 않을 경우 기본값을 반환합니다.
 * @param {string|number} input - 검증할 입력값
 * @param {number} defaultValue - 유효하지 않은 경우 반환할 기본값
 * @returns {number} - 검증된 숫자 또는 기본값
 */
function validateNumberInput(input, defaultValue) {
    const number = parseInt(input, 10);
    return isNaN(number) ? defaultValue : number;
}

/**
 * 지정된 시간(밀리초) 동안 실행을 지연시킵니다.
 * @param {number} ms - 지연할 시간(밀리초)
 * @returns {Promise} - setTimeout을 래핑한 Promise 객체
 */
function delay(ms) {
    // 유효한 정수인지 검증
    if (typeof ms !== 'number' || isNaN(ms)) {
        ms = 100; // 기본값 설정
        console.warn(`delay 함수에 유효하지 않은 값이 전달되어 기본값(${ms}ms)을 사용합니다.`);
    }
    
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 다양한 User-Agent 문자열 중 하나를 무작위로 반환합니다.
 * 크롤링 시 봇 차단을 우회하는 데 유용합니다.
 * @returns {string} - 무작위로 선택된 User-Agent 문자열
 */
function getRandomUserAgent() {
    const agents = [
        // Windows
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/125.0.0.0 Safari/537.36',
        // Mac
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_6_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_6_6) AppleWebKit/537.36 (KHTML, like Gecko) Firefox/125.0',
        // Linux
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Mozilla/5.0 (X11; Linux x86_64) Gecko/20100101 Firefox/125.0',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Ubuntu Chromium/124.0.0.0 Chrome/124.0.0.0 Safari/537.36'
    ];
    return agents[Math.floor(Math.random() * agents.length)];
}

module.exports = {
    askQuestion,
    validateNumberInput,
    delay,
    getRandomUserAgent
}