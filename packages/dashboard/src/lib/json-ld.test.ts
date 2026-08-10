import { describe, expect, it } from 'vitest';
import { buildBreadcrumbEntity, buildFaqEntity, buildItemListEntity } from './json-ld';

describe('buildFaqEntity', () => {
  it('把 question/answer 数组转成 FAQPage mainEntity', () => {
    expect(buildFaqEntity([{ question: 'Q1', answer: 'A1' }])).toEqual({
      '@type': 'FAQPage',
      mainEntity: [{ '@type': 'Question', name: 'Q1', acceptedAnswer: { '@type': 'Answer', text: 'A1' } }],
    });
  });
});

describe('buildBreadcrumbEntity', () => {
  it('生成 Home → 当前页两级面包屑，非默认语言路径带前缀', () => {
    expect(buildBreadcrumbEntity('/ai-router', 'zh', 'AI Router')).toEqual({
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://muirouter.com/zh' },
        { '@type': 'ListItem', position: 2, name: 'AI Router', item: 'https://muirouter.com/zh/ai-router' },
      ],
    });
  });

  it('默认语言路径不带前缀', () => {
    const entity = buildBreadcrumbEntity('/ai-router', 'en', 'AI Router');
    expect(entity.itemListElement[1].item).toBe('https://muirouter.com/ai-router');
  });

  it('拒绝空白名称，防止搜索引擎显示未命名面包屑', () => {
    expect(() => buildBreadcrumbEntity('/openai-compatible-router', 'en', '   ')).toThrow('Breadcrumb name 不能为空');
  });
});

describe('buildItemListEntity', () => {
  it('按数组下标生成 position（从 1 开始），url 缺省时省略该字段', () => {
    expect(buildItemListEntity([{ name: 'MuiRouter', url: '/register' }, { name: 'LiteLLM' }])).toEqual({
      '@type': 'ItemList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'MuiRouter', url: '/register' },
        { '@type': 'ListItem', position: 2, name: 'LiteLLM' },
      ],
    });
  });
});
