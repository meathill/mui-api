import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/marketing/mermaid', () => ({
  Mermaid: ({ chart }: { chart: string }) => <div data-testid="mermaid">{chart}</div>,
}));

import { MarkdownRenderer } from './markdown-renderer';

describe('MarkdownRenderer', () => {
  it('渲染段落、链接与标题样式', () => {
    const html = renderToStaticMarkup(
      <MarkdownRenderer content={'## 定价调整\n\n参考 [官方公告](https://example.com) 的说明。'} />,
    );

    expect(html).toContain('mt-14 max-w-3xl text-3xl font-semibold tracking-tight text-foreground');
    expect(html).toContain('href="https://example.com"');
  });

  it('支持 GFM 表格且容器允许宽屏展开', () => {
    const table = ['| 模型 | 价格 |', '| --- | --- |', '| gpt-5-6 | $1.25 |'].join('\n');
    const html = renderToStaticMarkup(<MarkdownRenderer content={table} />);

    expect(html).toContain('<table');
    expect(html).toContain('max-w-6xl');
    expect(html).toContain('whitespace-nowrap');
    expect(html).toContain('<thead class="bg-muted/70 text-foreground"');
    expect(html).toContain('$1.25');
  });

  it('把 mermaid 代码块渲染为 Mermaid 组件而不是 pre', () => {
    const html = renderToStaticMarkup(<MarkdownRenderer content={'```mermaid\nflowchart TD\n  A --> B\n```'} />);

    expect(html).toContain('data-testid="mermaid"');
    expect(html).toContain('flowchart TD');
    expect(html).not.toContain('<pre');
  });

  it('普通代码块保持 pre 包裹并展示语言标识', () => {
    const html = renderToStaticMarkup(<MarkdownRenderer content={'```bash\npnpm install\n```'} />);

    expect(html).toContain('<pre');
    expect(html).toContain('BASH');
    expect(html).not.toContain('data-testid="mermaid"');
  });

  it('JSON 代码块提供语法着色且无 inline pill 样式', () => {
    const json = '```json\n{\n  "model": "gpt-6.1-terra",\n  "active": true,\n  "count": 42\n}\n```';
    const html = renderToStaticMarkup(<MarkdownRenderer content={json} />);

    expect(html).toContain('<pre');
    expect(html).toContain('JSON');
    // 验证 key、string、bool、number 着色 span 存在
    expect(html).toContain('text-[#f3c574]'); // key
    expect(html).toContain('text-[#a9d18a]'); // string
    expect(html).toContain('text-[#e290dc]'); // bool
    expect(html).toContain('text-[#f08c72]'); // number
    // 验证 block 内的 code 不含行内 pill 的 bg-muted
    expect(html).not.toContain('<code class="rounded-md bg-muted px-1.5 py-0.5');
  });
});
