// 실행 예: node tests/practice/mobile.from_md.practice.js
// 루트의 m_dcinside_post.md에서 HTML 블록을 추출하여 오프라인 파싱 검증

const fs = require('fs');
const path = require('path');
const { parseMobilePostHtml } = require('../../src/scraper/post');

function extractHtmlFromMd(mdText) {
  // 첫 번째 "```" 이후부터 마지막 "```" 전까지를 HTML로 가정
  const fence = '```';
  const start = mdText.indexOf(fence);
  if (start === -1) return '';
  const start2 = mdText.indexOf(fence, start + fence.length);
  if (start2 === -1) return '';
  const html = mdText.slice(start2 + fence.length);
  const end = html.lastIndexOf(fence);
  return end !== -1 ? html.slice(0, end) : html;
}

function main() {
  const mdPath = path.join(__dirname, '..', '..', 'm_dcinside_post.md');
  if (!fs.existsSync(mdPath)) {
    console.error('m_dcinside_post.md 파일을 찾을 수 없습니다.');
    process.exit(1);
  }
  const md = fs.readFileSync(mdPath, 'utf8');
  const html = extractHtmlFromMd(md);
  if (!html.trim()) {
    console.error('MD에서 HTML 블록을 추출하지 못했습니다.');
    process.exit(1);
  }

  const parsed = parseMobilePostHtml(html, { extractImages: true, includeImageSource: false });
  console.log('파싱 결과 요약:');
  console.log({
    title: parsed.title,
    author: parsed.author,
    date: parsed.date,
    viewCount: parsed.viewCount,
    recommendCount: parsed.recommendCount,
    dislikeCount: parsed.dislikeCount,
    comments: parsed.comments?.totalCount,
    contentLen: (parsed.content || '').length,
    images: parsed.images?.length || 0,
  });
}

main();
