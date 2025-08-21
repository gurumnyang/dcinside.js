import * as cheerio from 'cheerio';
import { getWithRetry } from '../../http';

const MOBILE_BASE_URL = 'https://m.dcinside.com';

async function scrapeMobileBoardPage(
  page: number,
  galleryId: string,
  options: { boardType?: 'all' | 'recommend' | 'notice'; id?: string; subject?: string; nickname?: string; ip?: string } = {}
): Promise<any[]> {
  const { boardType = 'all', id, subject, nickname, ip } = options;
  if (boardType === 'notice') {
    const { scrapeBoardPage } = require('./pc');
    return scrapeBoardPage(page, galleryId, { boardType, id, subject, nickname, ip });
  }
  if (page <= 0) return [];

  const qs = boardType === 'recommend' ? `recommend=1&page=${page}` : `page=${page}`;
  const url = `${MOBILE_BASE_URL}/board/${encodeURIComponent(galleryId)}?${qs}`;

  try {
    const html = await getWithRetry(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; SM-G973N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.77 Mobile Safari/537.36',
        'Cookie': 'list_count=100',
      }
    });
    const $ = cheerio.load(html);
    const posts: any[] = [];

    $('ul.gall-detail-lst > li').each((_, el) => {
      const $el = $(el);
      if ($el.find('.pwlink').length || $el.find('.power-lst').length) return;

      const TYPE: Record<string, string> = {
        'sp-lst-txt': 'text',
        'sp-lst-img': 'picture',
        'sp-lst-recoimg': 'recommended',
        'sp-lst-recotxt': 'recommended',
      };

      const href = $el.find('a').attr('href') || '';
      const idMatch = href.match(/\/board\/[^/]+\/(\d+)/);

      const nicknameAttr = $el.find('.blockInfo').attr('data-name') || '';
      const dataInfo = $el.find('.blockInfo').attr('data-info') || '';

      const rawDate = $el.find('.ginfo > li:nth-child(3)').text().trim();
      let date = rawDate;
      if (/^\d{2}:\d{2}$/.test(rawDate)) {
        const today = new Date();
        date = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, '0')}.${String(today.getDate()).padStart(2, '0')} ${rawDate}`;
      } else if (/^\d{2}\.\d{2}$/.test(rawDate)) {
        const today = new Date();
        date = `${today.getFullYear()}.${rawDate}`;
      }

      const klass = ($el.find('.subject-add .sp-lst').attr('class') || '').split(' ');
      const key = klass.find(cls => cls.startsWith('sp-lst-')) || '';

      const post = {
        id: idMatch ? idMatch[1] : '',
        type: TYPE[key] || 'unknown',
        subject: $el.find('.ginfo > li:nth-child(1)').text().trim(),
        title: $el.find('.subjectin').text().trim(),
        link: href,
        author: {
          nickname: nicknameAttr,
          userId: (dataInfo.includes('.') ? '' : dataInfo),
          ip: (dataInfo.includes('.') ? dataInfo : '')
        },
        date,
        count: Number(($el.find('.ginfo > li:nth-child(4)').text().trim().replace(/^조회\s*/, '') || '0').replace(/,/g, '')),
        recommend: Number(($el.find('.ginfo > li:nth-child(5)').text().trim().replace(/^추천\s*/, '') || '0').replace(/,/g, '')),
        replyCount: Number(($el.find('.ct').text().trim() || '0').replace(/[^\d]/g, '')),
      };

      const skipFilter = (
        (id && String(id) !== String(post.id)) ||
        (subject && subject !== post.subject) ||
        (nickname && nickname !== post.author.nickname) ||
        (ip && ip !== post.author.ip)
      );
      if (!skipFilter) posts.push(post);
    });

    return posts;
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error(`모바일 게시판 ${page} 수집 오류: ${e.message}`);
    return [];
  }
}

export = { scrapeMobileBoardPage };
