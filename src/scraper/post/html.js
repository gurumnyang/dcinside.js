// html.js - content helpers
const config = require('../../config');

const { BASE_URL } = config;

const extractText = ($, selector, defaultValue = '') => (
  $(selector).text().trim() || defaultValue
);

const processImages = (element, options = {}) => {
  const { mode = 'replace', placeholder = 'image', includeSource = false } = options;
  const imageUrls = [];

  if (mode === 'extract' || mode === 'both') {
    element.find('img').each((_, img) => {
      const dataOriginal = img.attribs['data-original'] || '';
      const src = img.attribs.src || '';
      const dataSrc = img.attribs['data-src'] || '';
      const imageUrl = dataOriginal || dataSrc || src;
      if (imageUrl) {
        const fullUrl = imageUrl.startsWith('http')
          ? imageUrl
          : `${BASE_URL}${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}`;
        imageUrls.push(fullUrl);
      }
    });
  }

  if (mode === 'replace' || mode === 'both') {
    element.find('img').each((i, img) => {
      const replacement = includeSource && imageUrls[i]
        ? `[${placeholder}(${i}):"${imageUrls[i]}"]\n`
        : `[${placeholder}(${i})]\n`;
      img.tagName = 'span';
      img.attribs = {};
      img.children = [{ data: replacement, type: 'text' }];
    });
  }

  return mode === 'extract' || mode === 'both' ? imageUrls : null;
};

const replaceImagesWithPlaceholder = (element, placeholder = 'image') => {
  processImages(element, { mode: 'replace', placeholder });
};

module.exports = {
  extractText,
  processImages,
  replaceImagesWithPlaceholder,
};
