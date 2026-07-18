import { describe, expect, it } from 'vitest';
import { getKimiImageInputError } from './playground-media-results';

describe('playground 媒体结果 helpers', () => {
  it('Kimi 图片输入支持 PNG/JPEG/WebP/GIF，并限制原始文件合计 50MB', () => {
    expect(
      getKimiImageInputError([
        new File(['x'], 'one.png', { type: 'image/png' }),
        new File(['x'], 'two.gif', { type: 'image/gif' }),
      ]),
    ).toBeNull();
    expect(getKimiImageInputError([new File(['x'], 'bad.svg', { type: 'image/svg+xml' })])).toBe(
      'kimiImageUnsupportedError',
    );
    const oversizedImage = new File(['x'], 'huge.jpg', { type: 'image/jpeg' });
    Object.defineProperty(oversizedImage, 'size', { value: 50_000_001 });
    expect(getKimiImageInputError([oversizedImage])).toBe('kimiImageTooLargeError');
  });
});
