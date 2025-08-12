// tests/autocomplete.test.js

jest.mock('axios', () => {
  let getImpl = () => Promise.resolve({ data: '' });
  const create = jest.fn(() => ({
    get: (...args) => getImpl(...args)
  }));
  return {
    create,
    __setGetImpl: (fn) => { getImpl = fn; }
  };
});

const axios = require('axios');
const { getAutocomplete, encodeAutocompleteKey } = require('../src/autocomplete');
const { CrawlError } = require('../src/util');

describe('autocomplete encoding', () => {
  test('encodes ASCII correctly', () => {
    expect(encodeAutocompleteKey('A')).toBe('.41');
    expect(encodeAutocompleteKey('chatgpt')).toBe('.63.68.61.74.67.70.74');
  });

  test('encodes UTF-8 (Korean) correctly', () => {
    // '가' (U+AC00) => EA B0 80
    expect(encodeAutocompleteKey('가')).toBe('.EA.B0.80');
  });
});

describe('getAutocomplete', () => {
  test('returns parsed JSON from JSONP', async () => {
    let capturedParams;
    axios.__setGetImpl((url, options) => {
      capturedParams = options.params;
      const payload = { gallery: { total: 1 } };
      return Promise.resolve({ data: `${capturedParams.callback}(${JSON.stringify(payload)})` });
    });

    const query = 'chatgpt';
    const result = await getAutocomplete(query);
    expect(result).toBeDefined();
    expect(result.gallery.total).toBe(1);
    // k 파라미터 인코딩 확인
    expect(capturedParams.k).toBe(encodeAutocompleteKey(query));
  });

  test('throws on empty query', async () => {
    await expect(getAutocomplete('')).rejects.toBeInstanceOf(CrawlError);
  });

  test('throws CrawlError on invalid JSONP', async () => {
    axios.__setGetImpl(() => Promise.resolve({ data: 'invalid_payload' }));
    await expect(getAutocomplete('test')).rejects.toBeInstanceOf(CrawlError);
  });
});

