// util.js
const inquirer = require('inquirer').default;

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

/**
 * 크롤링 관련 에러 클래스
 */
class CrawlError extends Error {
    /**
     * @param {string} message - 에러 메시지
     * @param {string} type - 에러 유형 ('network', 'parse', 'notFound', 'rate_limit', 'auth', 'unknown')
     * @param {Error|null} originalError - 원본 에러 객체
     * @param {object} metadata - 추가 메타데이터
     */
    constructor(message, type = 'unknown', originalError = null, metadata = {}) {
        super(message);
        this.name = 'CrawlError';
        this.type = type;
        this.originalError = originalError;
        this.metadata = metadata;
        this.timestamp = new Date();
        
        // 원본 에러의 스택 트레이스 보존
        if (originalError && originalError.stack) {
            this.stack = `${this.stack}\nCaused by: ${originalError.stack}`;
        }
    }
    
    /**
     * 에러 로그를 콘솔에 출력합니다.
     * @param {boolean} verbose - 상세 정보 포함 여부
     */
    logError(verbose = false) {
        console.error(`[${this.timestamp.toISOString()}] ${this.name}(${this.type}): ${this.message}`);
        
        if (verbose) {
            if (Object.keys(this.metadata).length) {
                console.error('메타데이터:', this.metadata);
            }
            if (this.originalError) {
                console.error('원본 에러:', this.originalError);
            }
        }
    }
    
    /**
     * 재시도 가능한 에러인지 확인합니다.
     * @returns {boolean} - 재시도 가능 여부
     */
    isRetryable() {
        return ['network', 'rate_limit', 'server'].includes(this.type);
    }
}

/**
 * HTTP 상태 코드에 따라 적절한 에러 객체를 생성합니다.
 * @param {Error} error - Axios 에러 객체
 * @param {string} defaultMessage - 기본 에러 메시지
 * @param {object} metadata - 추가 메타데이터
 * @returns {CrawlError} - CrawlError 인스턴스
 */
const createHttpError = (error, defaultMessage, metadata = {}) => {
    const status = error.response?.status;
    const url = error.config?.url || '';
    
    // HTTP 상태 코드별 에러 유형 결정
    let type = 'network';
    let message = defaultMessage;
    
    if (status) {
        if (status === 404) {
            type = 'notFound';
            message = `리소스를 찾을 수 없습니다: ${url}`;
        } else if (status === 429) {
            type = 'rate_limit';
            message = `요청 한도 초과: ${url}`;
        } else if (status === 403) {
            type = 'auth';
            message = `접근이 거부되었습니다: ${url}`;
        } else if (status >= 500) {
            type = 'server';
            message = `서버 에러 (${status}): ${url}`;
        }
    } else if (error.code === 'ECONNABORTED') {
        type = 'timeout';
        message = `요청 시간 초과: ${url}`;
    } else if (error.code === 'ECONNREFUSED') {
        type = 'connection';
        message = `연결이 거부되었습니다: ${url}`;
    }
    
    return new CrawlError(message, type, error, {
        ...metadata,
        url,
        status
    });
};

/**
 * 지정된 함수를 재시도하는 래퍼 함수
 * @param {Function} fn - 실행할 함수
 * @param {object} options - 재시도 옵션
 * @param {number} options.maxRetries - 최대 재시도 횟수
 * @param {number} options.delayMs - 재시도 간 지연 시간(ms)
 * @param {boolean} options.exponentialBackoff - 지수 증가 지연 사용 여부
 * @returns {Promise<any>} - 함수 실행 결과
 */
const withRetry = async (fn, options = {}) => {
    const { 
        maxRetries = 3, 
        delayMs = 1000, 
        exponentialBackoff = true 
    } = options;
    
    let lastError;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            
            // 재시도 가능한 에러인지 확인
            if (error instanceof CrawlError && !error.isRetryable()) {
                throw error;
            }
            
            // 마지막 시도였다면 에러 던지기
            if (attempt === maxRetries) {
                throw error;
            }
            
            // 다음 시도까지 대기
            const waitTime = exponentialBackoff 
                ? delayMs * Math.pow(2, attempt) 
                : delayMs;
                
            console.warn(`시도 ${attempt + 1}/${maxRetries + 1} 실패. ${waitTime}ms 후 재시도...`);
            await delay(waitTime);
        }
    }
    
    // 여기까지 오면 모든 시도 실패
    throw lastError;
};

module.exports = {
    askQuestion,
    validateNumberInput,
    delay,
    getRandomUserAgent,
    CrawlError,
    createHttpError,
    withRetry
};