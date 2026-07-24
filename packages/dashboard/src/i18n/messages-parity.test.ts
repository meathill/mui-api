import { describe, expect, it } from 'vitest';
import deMessages from '../../messages/de.json';
import enMessages from '../../messages/en.json';
import esMessages from '../../messages/es.json';
import frMessages from '../../messages/fr.json';
import jaMessages from '../../messages/ja.json';
import ptMessages from '../../messages/pt.json';
import thMessages from '../../messages/th.json';
import zhMessages from '../../messages/zh.json';
import { locales } from './config';

const MESSAGES_BY_LOCALE: Record<(typeof locales)[number], unknown> = {
  en: enMessages,
  zh: zhMessages,
  fr: frMessages,
  es: esMessages,
  pt: ptMessages,
  de: deMessages,
  th: thMessages,
  ja: jaMessages,
};

/**
 * 把 messages 树的每个叶子值替换成 typeof 标记，保留 object/array 骨架（含数组长度）。
 * 用于跨语言比较"结构"而非具体文案——能拦住漏 key、多 key、数组长度不一致（如某语言
 * comparisonRows/features/faq/tools 比其他语言少一项）、叶子类型不一致；拦不住语义错位
 * （如 comparisonRows 某行 values[] 内部顺序被打乱但长度不变），后者需人工核对翻译。
 */
function extractShape(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(extractShape);
  }
  if (value !== null && typeof value === 'object') {
    const shape: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      shape[key] = extractShape((value as Record<string, unknown>)[key]);
    }
    return shape;
  }
  return typeof value;
}

describe('messages 8 语言结构一致性', () => {
  const enShape = extractShape(enMessages);

  for (const locale of locales) {
    if (locale === 'en') continue;

    it(`${locale}.json 与 en.json 结构（含数组长度）完全一致`, () => {
      expect(extractShape(MESSAGES_BY_LOCALE[locale])).toEqual(enShape);
    });
  }
});
