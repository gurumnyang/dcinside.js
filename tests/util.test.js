const { validateNumberInput, delay } = require('../src/util');

describe('validateNumberInput', () => {
    test('정상적인 숫자 입력 시 해당 숫자 반환', () => {
        expect(validateNumberInput('42', 0)).toBe(42);
        expect(validateNumberInput('0', 99)).toBe(0);
    });
    test('숫자가 아닌 입력 시 기본값 반환', () => {
        expect(validateNumberInput('abc', 7)).toBe(7);
        expect(validateNumberInput('', 5)).toBe(5);
    });
});

describe('delay', () => {
    test('지연 시간이 정상적으로 동작하는지 확인', async () => {
        const start = Date.now();
        await delay(100);
        const elapsed = Date.now() - start;
        expect(elapsed).toBeGreaterThanOrEqual(90); // 시스템 오차 허용
    });
});
