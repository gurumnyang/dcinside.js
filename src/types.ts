// Core public types for dcinside.js

export interface AuthorInfo {
  nickname: string;
  userId: string;
  ip: string;
}

export interface CommentItem {
  parent: string;
  id: string;
  author: AuthorInfo;
  regDate: string;
  memo: string;
  isDeleted?: string | number | boolean;
}

export interface Comments {
  totalCount: number;
  items: CommentItem[];
}

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
  images?: string[];
}

export interface PostInfo {
  id: string;
  type: 'notice' | 'picture' | 'text' | 'recommended' | 'unknown' | string;
  subject: string;
  title: string;
  link: string;
  author: AuthorInfo;
  date: string;
  count: number;
  recommend: number;
  replyCount: number;
}

export interface GetPostListOptions {
  page: number;
  galleryId: string;
  boardType?: 'all' | 'recommend' | 'notice';
  delayMs?: number;
}

export interface GetPostOptions {
  galleryId: string;
  postNo: string | number;
  extractImages?: boolean;
  includeImageSource?: boolean;
  retryCount?: number;
}

export interface GetPostsOptions {
  galleryId: string;
  postNumbers: Array<string | number>;
  delayMs?: number;
  extractImages?: boolean;
  includeImageSource?: boolean;
  onProgress?: (current: number, total: number) => void;
  retryCount?: number;
}

export interface ImageProcessOptions {
  mode?: 'replace' | 'extract' | 'both';
  placeholder?: string;
  includeSource?: boolean;
}

export interface AutocompleteGalleryItem {
  name: string;
  ko_name: string;
  gall_type: string;
  new_post?: string;
  total_post?: string;
  total_score?: string;
  member_count?: string;
  rank?: string;
  pr_profile?: string;
  state?: string;
  link?: string;
}

export interface AutocompleteWikiItem {
  title: string;
  gall_type: string;
}

export interface AutocompleteResponse {
  gallery?: Record<string, AutocompleteGalleryItem> & { total?: number | string };
  prgallery?: Record<string, AutocompleteGalleryItem> & { total?: number | string };
  recommend?: Record<string, AutocompleteGalleryItem> & { total?: number | string };
  wiki?: Record<string, AutocompleteWikiItem>;
  time?: { time: string };
}

export interface SearchPost {
  title: string;
  content?: string;
  galleryName?: string;
  galleryId?: string;
  galleryType?: 'main' | 'mgallery' | 'mini' | 'person';
  date?: string;
  link: string;
}

export interface SearchGalleryItem {
  name?: string;
  id?: string;
  type?: 'board' | 'mgallery' | 'mini' | 'person';
  galleryType?: 'main' | 'mgallery' | 'mini' | 'person';
  link: string;
  rank?: number;
  new_post?: number;
  total_post?: number;
}

export interface SearchResult {
  query?: string;
  galleries: SearchGalleryItem[];
  posts: SearchPost[];
}

