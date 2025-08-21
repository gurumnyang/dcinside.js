import config = require('../../config');
import type { ImageProcessOptions } from '../../types';

const { BASE_URL } = config as any;

const extractText = ($: any, selector: string, defaultValue = ''): string => (
  $(selector).text().trim() || defaultValue
);

const processImages = (element: any, options: ImageProcessOptions = {}): string[] | null => {
  const { mode = 'replace', placeholder = 'image', includeSource = false } = options;
  const imageUrls: string[] = [];

  if (mode === 'extract' || mode === 'both') {
    element.find('img').each((_: any, img: any) => {
      const dataOriginal = img.attribs?.['data-original'] || '';
      const src = img.attribs?.src || '';
      const dataSrc = img.attribs?.['data-src'] || '';
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
    element.find('img').each((i: number, img: any) => {
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

const replaceImagesWithPlaceholder = (element: any, placeholder = 'image'): void => {
  processImages(element, { mode: 'replace', placeholder });
};

export = {
  extractText,
  processImages,
  replaceImagesWithPlaceholder,
};
