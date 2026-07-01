import type { MDXComponents } from 'mdx/types';

const components: MDXComponents = {
  h2: ({ className, ...props }) => (
    <h2
      className={['mt-14 text-3xl font-semibold tracking-tight text-foreground', className].filter(Boolean).join(' ')}
      {...props}
    />
  ),
  h3: ({ className, ...props }) => (
    <h3
      className={['mt-10 text-xl font-semibold tracking-tight text-foreground', className].filter(Boolean).join(' ')}
      {...props}
    />
  ),
  p: ({ className, ...props }) => (
    <p className={['mt-5 text-base leading-8 text-muted-foreground', className].filter(Boolean).join(' ')} {...props} />
  ),
  a: ({ className, ...props }) => (
    <a
      className={['font-medium text-primary underline-offset-4 hover:underline', className].filter(Boolean).join(' ')}
      {...props}
    />
  ),
  ul: ({ className, ...props }) => (
    <ul
      className={['mt-5 list-disc space-y-3 pl-5 text-base leading-8 text-muted-foreground', className]
        .filter(Boolean)
        .join(' ')}
      {...props}
    />
  ),
  ol: ({ className, ...props }) => (
    <ol
      className={['mt-5 list-decimal space-y-3 pl-5 text-base leading-8 text-muted-foreground', className]
        .filter(Boolean)
        .join(' ')}
      {...props}
    />
  ),
  li: ({ className, ...props }) => <li className={['pl-1', className].filter(Boolean).join(' ')} {...props} />,
  blockquote: ({ className, ...props }) => (
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
  table: ({ className, ...props }) => (
    <div className="mt-8 overflow-x-auto rounded-lg border border-border [&_tbody_tr:last-child_td]:border-b-0">
      <table className={['w-full min-w-[38rem] text-left text-sm', className].filter(Boolean).join(' ')} {...props} />
    </div>
  ),
  thead: ({ className, ...props }) => (
    <thead className={['bg-muted/70 text-foreground', className].filter(Boolean).join(' ')} {...props} />
  ),
  th: ({ className, ...props }) => (
    <th
      className={['border-b border-border px-4 py-3 font-semibold', className].filter(Boolean).join(' ')}
      {...props}
    />
  ),
  td: ({ className, ...props }) => (
    <td
      className={['border-b border-border px-4 py-3 text-muted-foreground', className].filter(Boolean).join(' ')}
      {...props}
    />
  ),
  code: ({ className, ...props }) => (
    <code
      className={['rounded-md bg-muted px-1.5 py-0.5 text-[0.9em] font-medium text-foreground', className]
        .filter(Boolean)
        .join(' ')}
      {...props}
    />
  ),
  pre: ({ className, ...props }) => (
    <pre
      className={[
        'mt-6 overflow-x-auto rounded-lg border border-border bg-foreground p-5 text-sm leading-7 text-background',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    />
  ),
  hr: ({ className, ...props }) => (
    <hr className={['my-12 border-border', className].filter(Boolean).join(' ')} {...props} />
  ),
};

export function useMDXComponents(overrides: MDXComponents): MDXComponents {
  return {
    ...components,
    ...overrides,
  };
}
