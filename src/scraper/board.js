// board.js - board page scraping
const cheerio = require('cheerio');
const config = require('../config');
const { getWithRetry } = require('../http');

const { BASE_URL } = config;

async function scrapeBoardPage(page, galleryId, options = {}) {
  const { boardType = 'all', id, subject, nickname, ip } = options;
  if (page <= 0) return [];

  const url = `${BASE_URL}/mgallery/board/lists/?id=${galleryId}` +
    `&list_num=100&search_head=&page=${page}&exception_mode=${boardType}`;

  try {
    const html = await getWithRetry(url);
    const $ = cheerio.load(html);
    const posts = [];
    const types = [
      { dataType: 'icon_notice', type: 'notice' },
      { dataType: 'icon_pic', type: 'picture' },
      { dataType: 'icon_txt', type: 'text' },
      { dataType: 'icon_survey', type: 'survey' },
    ];

    $('.ub-content').each((_, el) => {
      const $el = $(el);
      const iconClass = $el.find('.icon_img').attr('class') || '';
      const type = types.find(t => iconClass.includes(t.dataType))?.type || 'unknown';

      const pid = $el.find('.gall_num').text().trim();
      const subj = (() => {
        const $td = $el.find('.gall_subject');
        return $td.attr('onmouseover') ? $td.find('.subject_inner').text().trim() : $td.text().trim();
      })();

      const titA = $el.find('.gall_tit a').first();
      const title = titA.text().trim().replace(/\s+/g, ' ');
      const link = titA.attr('href') || '';
      const fullLink = link.startsWith('javascript') ? '' : (link.startsWith('http') ? link : `https://gall.dcinside.com${link}`);

      const writer = $el.find('.gall_writer');
      const nick = writer.attr('data-nick') || writer.find('b').text().trim() || writer.find('.nickname em').text().trim() || '익명';
      const uid = writer.attr('data-uid') || '';
      const ipAddr = writer.attr('data-ip') || '';

      const dateEl = $el.find('.gall_date');
      const date = dateEl.attr('title') || dateEl.text().trim();

      const countText = $el.find('.gall_count').text().trim();
      const count = countText === '-' ? 0 : parseInt(countText, 10) || 0;
      const recText = $el.find('.gall_recommend').text().trim();
      const recommend = recText === '-' ? 0 : parseInt(recText, 10) || 0;
      const replyText = ($el.find('.reply_num').text() || '0').replace(/[\[\]]/g, '');
      const replyCount = parseInt(replyText, 10) || 0;

      const skip = (id && id !== pid) || (subject && subject !== subj) || (nickname && nickname !== nick) || (ip && ip !== ipAddr);
      if (skip) return;

      posts.push({ id: pid, type, subject: subj, title, link: fullLink, author: { nickname: nick, userId: uid, ip: ipAddr }, date, count, recommend, replyCount });
    });

    return [...posts];
  } catch (e) {
    console.error(`게시판 ${page} 수집 오류: ${e.message}`);
    return [];
  }
}

module.exports = { scrapeBoardPage };

