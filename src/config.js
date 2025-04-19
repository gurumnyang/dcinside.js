// config.js - 크롤러 설정 파일

/**
 * 디시인사이드 크롤러 기본 설정
 */
const config = {
    // API 엔드포인트
    BASE_URL: 'https://gall.dcinside.com',
    
    // HTTP 요청 관련 설정
    HTTP: {
        USER_AGENT: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        TIMEOUT: 10000, // 요청 타임아웃 (ms)
        RETRY_ATTEMPTS: 3, // 실패 시 재시도 횟수
        RETRY_DELAY: 1000, // 재시도 간격 (ms)
    },

    // 크롤링 설정
    CRAWL: {
        DEFAULT_GALLERY_ID: 'chatgpt',
        DEFAULT_PAGE_SIZE: 100, // 페이지당 게시글 수
        DELAY_BETWEEN_REQUESTS: 500, // 요청 간 지연 시간 (ms)
        MAX_COMMENT_PAGES: 100, // 수집할 최대 댓글 페이지 수
        COMMENT_PAGE_SIZE: 100, // 페이지당 댓글 수
    },
    
    // 디버깅 설정
    DEBUG: {
        ENABLED: false,
        VERBOSE: false,
    }
};

module.exports = config;