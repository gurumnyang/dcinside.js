declare module "@gurumnyang/dcinside.js" {
  /**
   * 게시글 데이터 타입
   */
  export interface Post {
    postNo: string;
    title: string;
    author: string;
    date: string;
    content: string;
    viewCount: string;
    recommendCount: string;
    dislikeCount: string;
    comments: Comments;
    /** 이미지 URL 배열 (extractImages 옵션이 활성화된 경우에만 포함) */
    images?: string[];
  }

  /**
   * 댓글 데이터 타입
   */
  export interface Comments {
    totalCount: number;
    items: Array<{
      parent: string;
      id: string;
      author: {
        nickname: string;
        userId: string;
        ip: string;
      };
      regDate: string;
      memo: string;
    }>;
  }

  /**
   * 게시글 정보 객체 타입
   */
  export interface PostInfo {
    /** 게시글 번호 */
    id: string;
    /** 게시글 유형 ('notice', 'picture', 'text', 'recommended', 'unknown') */
    type: string;
    /** 말머리 */
    subject: string;
    /** 게시글 제목 */
    title: string;
    /** 게시글 링크 */
    link: string;
    /** 작성자 정보 */
    author: {
      /** 작성자 닉네임 */
      nickname: string;
      /** 작성자 ID */
      userId: string;
      /** 작성자 IP */
      ip: string;
    };
    /** 작성 날짜 */
    date: string;
    /** 조회수 */
    count: number;
    /** 추천수 */
    recommend: number;
    /** 댓글 수 */
    replyCount: number;
  }

  /**
   * getPostList 함수의 옵션 타입
   */
  export interface GetPostListOptions {
    page: number;
    galleryId: string;
    boardType?: 'all' | 'recommend' | 'notice';
    delayMs?: number;
  }

  /**
   * getPost 함수의 옵션 타입
   */
  export interface GetPostOptions {
    galleryId: string;
    postNo: string | number;
    /** 이미지 URL 추출 여부 */
    extractImages?: boolean;
    /** 본문 텍스트에 이미지 URL 포함 여부 */
    includeImageSource?: boolean;
  }

  /**
   * getPosts 함수의 옵션 타입
   */
  export interface GetPostsOptions {
    galleryId: string;
    postNumbers: Array<string | number>;
    delayMs?: number;
    /** 이미지 URL 추출 여부 */
    extractImages?: boolean;
    /** 본문 텍스트에 이미지 URL 포함 여부 */
    includeImageSource?: boolean;
    onProgress?: (current: number, total: number) => void;
    /** 최대 재시도 횟수 */
    retryAttempts?: number;
    /** 재시도 간 지연 시간(ms) */
    retryDelay?: number;
  }

  /**
   * 이미지 처리 옵션 타입
   */
  export interface ImageProcessOptions {
    /** 처리 모드 ('replace', 'extract', 'both') */
    mode?: 'replace' | 'extract' | 'both';
    /** 이미지 대체 텍스트 */
    placeholder?: string;
    /** 이미지 URL 표시 여부 */
    includeSource?: boolean;
  }

  /**
   * 페이지 범위로 게시글 목록을 수집합니다.
   */
  export function getPostList(options: GetPostListOptions): Promise<PostInfo[]>;

  /**
   * 게시글 번호로 게시글 내용을 가져옵니다.
   */
  export function getPost(options: GetPostOptions): Promise<Post | null>;

  /**
   * 여러 게시글 번호로 게시글 내용을 가져옵니다.
   */
  export function getPosts(options: GetPostsOptions): Promise<Post[]>;

  /**
   * 지정된 시간(밀리초) 동안 실행을 지연시킵니다.
   */
  export function delay(ms: number): Promise<void>;

  /**
   * 무작위 User-Agent 문자열을 반환합니다.
   */
  export function getRandomUserAgent(): string;
  
  /**
   * @deprecated getPostList를 사용하세요
   */
  export function getPostNumbers(options: GetPostListOptions): Promise<string[]>;

  /**
   * 크롤링 관련 에러 클래스
   */
  export class CrawlError extends Error {
    /** 에러 유형 ('network', 'parse', 'notFound', 'rate_limit', 'auth', 'unknown') */
    type: string;
    /** 원본 에러 객체 */
    originalError: Error | null;
    /** 추가 메타데이터 */
    metadata: Record<string, any>;
    /** 에러 발생 시간 */
    timestamp: Date;
    
    /**
     * 에러 로그를 콘솔에 출력합니다.
     * @param verbose 상세 정보 포함 여부
     */
    logError(verbose?: boolean): void;
    
    /**
     * 재시도 가능한 에러인지 확인합니다.
     */
    isRetryable(): boolean;
  }

  /**
   * 원본 스크레이퍼 함수들
   */
  export const raw: {
    scrapeBoardPage: (
      page: number, 
      galleryId: string, 
      options?: { 
        boardType?: string;
        id?: string | null;
        subject?: string | null;
        nickname?: string | null;
        ip?: string | null;
      }
    ) => Promise<PostInfo[]>;
    
    getPostContent: (
      galleryId: string, 
      no: string | number,
      options?: {
        extractImages?: boolean;
        includeImageSource?: boolean;
      }
    ) => Promise<Post | null>;
    
    getCommentsForPost: (
      no: string | number,
      galleryId: string,
      e_s_n_o: string
    ) => Promise<Comments | null>;
    
    extractText: (
      $: any,
      selector: string,
      defaultValue?: string
    ) => string;
    
    replaceImagesWithPlaceholder: (
      element: any,
      placeholder?: string
    ) => void;
    
    processImages: (
      element: any,
      options?: ImageProcessOptions
    ) => string[] | null;
  };
}