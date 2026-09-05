import { isValidElement } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Mermaid } from '@/components/marketing/mermaid';

/** 博客正文的样式映射，从旧 mdx-components.tsx 迁移而来，保证迁移前后排版一致。 */
const markdownComponents: Components = {
  h2: ({ node: _node, className, ...props }) => (
    <h2
      className={['mt-14 text-3xl font-semibold tracking-tight text-foreground', className].filter(Boolean).join(' ')}
      {...props}
    />
  ),
  h3: ({ node: _node, className, ...props }) => (
    <h3
      className={['mt-10 text-xl font-semibold tracking-tight text-foreground', className].filter(Boolean).join(' ')}
      {...props}
    />
  ),
  p: ({ node: _node, className, ...props }) => (
    <p className={['mt-5 text-base leading-8 text-muted-foreground', className].filter(Boolean).join(' ')} {...props} />
  ),
  a: ({ node: _node, className, ...props }) => (
    <a
      className={['font-medium text-primary underline-offset-4 hover:underline', className].filter(Boolean).join(' ')}
      {...props}
    />
  ),
  ul: ({ node: _node, className, ...props }) => (
    <ul
      className={['mt-5 list-disc space-y-3 pl-5 text-base leading-8 text-muted-foreground', className]
        .filter(Boolean)
        .join(' ')}
      {...props}
    />
  ),
  ol: ({ node: _node, className, ...props }) => (
    <ol
      className={['mt-5 list-decimal space-y-3 pl-5 text-base leading-8 text-muted-foreground', className]
        .filter(Boolean)
        .join(' ')}
      {...props}
    />
  ),
  li: ({ node: _node, className, ...props }) => (
    <li className={['pl-1', className].filter(Boolean).join(' ')} {...props} />
  ),
  blockquote: ({ node: _node, className, ...props }) => (
    <blockquote
      className={[
        'mt-8 rounded-lg border border-border bg-muted/50 px-5 py-4 text-base leading-8 text-foreground',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    />
  ),
  table: ({ node: _node, className, ...props }) => (
    <div className="mt-8 overflow-x-auto rounded-lg border border-border [&_tbody_tr:last-child_td]:border-b-0">
      <table className={['w-full min-w-[38rem] text-left text-sm', className].filter(Boolean).join(' ')} {...props} />
    </div>
  ),
  thead: ({ node: _node, className, ...props }) => (
    <thead className={['bg-muted/70 text-foreground', className].filter(Boolean).join(' ')} {...props} />
  ),
  th: ({ node: _node, className, ...props }) => (
    <th
      className={['border-b border-border px-4 py-3 font-semibold', className].filter(Boolean).join(' ')}
      {...props}
    />
  ),
  td: ({ node: _node, className, ...props }) => (
    <td
      className={['border-b border-border px-4 py-3 text-muted-foreground', className].filter(Boolean).join(' ')}
      {...props}
    />
  ),
  code: ({ node: _node, className, ...props }) => (
    <code
      className={['rounded-md bg-muted px-1.5 py-0.5 text-[0.9em] font-medium text-foreground', className]
        .filter(Boolean)
        .join(' ')}
      {...props}
    />
  ),
  pre: ({ node: _node, className, children, ...props }) => {
    if (isValidElement(children) && typeof children.props === 'object' && children.props !== null) {
      const childProps = children.props as { className?: string; children?: unknown };
      if (childProps.className?.includes('language-mermaid') && typeof childProps.children === 'string') {
        return <Mermaid chart={childProps.children} />;
      }
    }
    return (
      <pre
        className={[
          'mt-6 overflow-x-auto rounded-lg border border-border bg-foreground p-5 text-sm leading-7 text-background',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        {...props}
      >
        {children}
      </pre>
    );
  },
  hr: ({ node: _node, className, ...props }) => (
    <hr className={['my-12 border-border', className].filter(Boolean).join(' ')} {...props} />
  ),
};

export function MarkdownRenderer({ content }: { content: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
      {content}
    </ReactMarkdown>
  );
}
