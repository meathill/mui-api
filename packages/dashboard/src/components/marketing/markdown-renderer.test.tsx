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

    expect(html).toContain('<h2 class="mt-14 text-3xl font-semibold tracking-tight text-foreground">');
    expect(html).toContain('href="https://example.com"');
  });

  it('支持 GFM 表格（调价文章大量使用）', () => {
    const table = ['| 模型 | 价格 |', '| --- | --- |', '| gpt-5-6 | $1.25 |'].join('\n');
    const html = renderToStaticMarkup(<MarkdownRenderer content={table} />);

    expect(html).toContain('<table');
    expect(html).toContain('<thead class="bg-muted/70 text-foreground"');
    expect(html).toContain('$1.25');
  });

  it('把 mermaid 代码块渲染为 Mermaid 组件而不是 pre', () => {
    const html = renderToStaticMarkup(<MarkdownRenderer content={'```mermaid\nflowchart TD\n  A --> B\n```'} />);

    expect(html).toContain('data-testid="mermaid"');
    expect(html).toContain('flowchart TD');
    expect(html).not.toContain('<pre');
  });

  it('普通代码块保持 pre 包裹', () => {
    const html = renderToStaticMarkup(<MarkdownRenderer content={'```bash\npnpm install\n```'} />);

    expect(html).toContain('<pre');
    expect(html).not.toContain('data-testid="mermaid"');
  });
});
