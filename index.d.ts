declare module "dcinside-crawler" {
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
  }

  /**
   * 댓글 데이터 타입
   */
  export interface Comments {
    totalCount: number;
    comments: Array<{
      parent: string;
      userId: string;
      name: string;
      ip: string;
      regDate: string;
      memo: string;
    }>;
  }

  /**
   * getPostList 함수의 옵션 타입
   */
  export interface GetPostListOptions {
    startPage: number;
    endPage: number;
    galleryId: string;
    boardType?: 'all' | 'recommend' | 'notice';
    delayMs?: number;
  }

  /**
   * getPost 함수의 옵션 타입
   */
  export interface GetPostOptions {
    galleryId: string;
    postNo: string;
  }

  /**
   * getPosts 함수의 옵션 타입
   */
  export interface GetPostsOptions {
    galleryId: string;
    postNumbers: string[];
    delayMs?: number;
    onProgress?: (current: number, total: number) => void;
  }

  /**
   * crawlGalleryPages 함수의 옵션 타입
   */
  export interface CrawlGalleryPagesOptions {
    startPage: number;
    endPage: number;
    galleryId: string;
    boardType?: 'all' | 'recommend' | 'notice';
    pageDelayMs?: number;
    postDelayMs?: number;
    onPageProgress?: (current: number, total: number) => void;
    onPostProgress?: (current: number, total: number) => void;
  }

  /**
   * 페이지 범위로 게시글 번호 목록을 수집합니다.
   */
  export function getPostList(options: GetPostListOptions): Promise<string[]>;

  /**
   * 게시글 번호로 게시글 내용을 가져옵니다.
   */
  export function getPost(options: GetPostOptions): Promise<Post | null>;

  /**
   * 여러 게시글 번호로 게시글 내용을 가져옵니다.
   */
  export function getPosts(options: GetPostsOptions): Promise<Post[]>;

  /**
   * 페이지 범위로 게시글을 수집합니다.
   */
  export function crawlGalleryPages(options: CrawlGalleryPagesOptions): Promise<Post[]>;

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
   * @deprecated crawlGalleryPages를 사용하세요
   */
  export function scrapePages(options: CrawlGalleryPagesOptions): Promise<Post[]>;

  /**
   * 원본 스크레이퍼 함수들
   */
  export const raw: {
    scrapeBoardPages: (
      startPage: number, 
      endPage: number, 
      galleryId: string, 
      options?: { 
        boardType?: string;
        num?: string | null;
        subject?: string | null;
        nickname?: string | null;
        ip?: string | null;
        delay?: number;
      }
    ) => Promise<string[]>;
    
    getPostContent: (
      galleryId: string, 
      no: string
    ) => Promise<Post | null>;
  };
}