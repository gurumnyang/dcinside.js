// config.ts - 크롤러 설정 파일 (TS)

interface HttpConfig {
  USER_AGENT: string;
  TIMEOUT: number;
  RETRY_ATTEMPTS: number;
  RETRY_DELAY: number;
}

interface CrawlConfig {
  DEFAULT_GALLERY_ID: string;
  DEFAULT_PAGE_SIZE: number;
  DELAY_BETWEEN_REQUESTS: number;
  MAX_COMMENT_PAGES: number;
  COMMENT_PAGE_SIZE: number;
  RANDOM_USER_AGENT?: boolean;
}

interface DebugConfig {
  ENABLED: boolean;
  VERBOSE: boolean;
}

const config = {
  BASE_URL: 'https://gall.dcinside.com',
  HTTP: {
    USER_AGENT: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    TIMEOUT: 10000,
    RETRY_ATTEMPTS: 3,
    RETRY_DELAY: 1000,
  } as HttpConfig,
  CRAWL: {
    DEFAULT_GALLERY_ID: 'chatgpt',
    DEFAULT_PAGE_SIZE: 100,
    DELAY_BETWEEN_REQUESTS: 500,
    MAX_COMMENT_PAGES: 100,
    COMMENT_PAGE_SIZE: 100,
    // RANDOM_USER_AGENT: true,
  } as CrawlConfig,
  DEBUG: {
    ENABLED: false,
    VERBOSE: false,
  } as DebugConfig,
};

export = config;
