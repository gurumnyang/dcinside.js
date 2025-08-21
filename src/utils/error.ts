export type CrawlErrorType =
  | 'network'
  | 'parse'
  | 'notFound'
  | 'rate_limit'
  | 'auth'
  | 'server'
  | 'timeout'
  | 'connection'
  | 'unknown';

export class CrawlError extends Error {
  type: CrawlErrorType;
  originalError: any;
  metadata: Record<string, any>;
  timestamp: Date;

  constructor(
    message: string,
    type: CrawlErrorType = 'unknown',
    originalError: any = null,
    metadata: Record<string, any> = {}
  ) {
    super(message);
    this.name = 'CrawlError';
    this.type = type;
    this.originalError = originalError;
    this.metadata = metadata;
    this.timestamp = new Date();
    if (originalError && (originalError as any).stack) {
      this.stack = `${this.stack}\nCaused by: ${(originalError as any).stack}`;
    }
  }

  logError(verbose = false) {
    // eslint-disable-next-line no-console
    console.error(`[${this.timestamp.toISOString()}] ${this.name}(${this.type}): ${this.message}`);
    if (verbose) {
      if (Object.keys(this.metadata).length) console.error('메타데이터', this.metadata);
      if (this.originalError) console.error('원본 오류:', this.originalError);
    }
  }

  isRetryable() {
    return ['network', 'rate_limit', 'server'].includes(this.type);
  }
}

export const createHttpError = (
  error: any,
  defaultMessage: string,
  metadata: Record<string, any> = {}
) => {
  const status = error?.response?.status as number | undefined;
  const url = error?.config?.url || '';
  let type: CrawlErrorType = 'network';
  let message = defaultMessage;

  if (typeof status === 'number') {
    if (status === 404) { type = 'notFound'; message = `리소스를 찾을 수 없습니다: ${url}`; }
    else if (status === 429) { type = 'rate_limit'; message = `요청 한도 초과: ${url}`; }
    else if (status === 403) { type = 'auth'; message = `접근이 거부되었습니다: ${url}`; }
    else if (status >= 500) { type = 'server'; message = `서버 오류 (${status}): ${url}`; }
  } else if (error?.code === 'ECONNABORTED') { type = 'timeout'; message = `요청 시간 초과: ${url}`; }
  else if (error?.code === 'ECONNREFUSED') { type = 'connection'; message = `연결이 거부되었습니다: ${url}`; }

  return new CrawlError(message, type, error, { ...metadata, url, status });
};

