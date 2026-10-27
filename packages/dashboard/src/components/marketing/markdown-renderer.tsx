import { isValidElement } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Mermaid } from '@/components/marketing/mermaid';

function highlightJson(json: string): React.ReactNode[] {
  const tokenRegex =
    /("(?:\\u[\da-fA-F]{4}|\\[^u]|[^\\"])*"(?:\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|[{}[\],:])/g;

  const elements: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(json)) !== null) {
    if (match.index > lastIndex) {
      elements.push(json.slice(lastIndex, match.index));
    }

    const token = match[0];
    const key = `json-tok-${elements.length}-${match.index}`;

    if (token.endsWith(':')) {
      const propName = token.slice(0, token.lastIndexOf(':'));
      const colonAndSpace = token.slice(token.lastIndexOf(':'));
      elements.push(
        <span key={key} className="text-[#f3c574]">
          {propName}
        </span>,
        <span key={`${key}-colon`} className="text-[#a89988]">
          {colonAndSpace}
        </span>,
      );
    } else if (token.startsWith('"')) {
      elements.push(
        <span key={key} className="text-[#a9d18a]">
          {token}
        </span>,
      );
    } else if (token === 'true' || token === 'false') {
      elements.push(
        <span key={key} className="text-[#e290dc]">
          {token}
        </span>,
      );
    } else if (token === 'null') {
      elements.push(
        <span key={key} className="text-[#e8775a]">
          {token}
        </span>,
      );
    } else if (/^-?\d/.test(token)) {
      elements.push(
        <span key={key} className="text-[#f08c72]">
          {token}
        </span>,
      );
    } else {
      elements.push(
        <span key={key} className="text-[#a89988]">
          {token}
        </span>,
      );
    }

    lastIndex = tokenRegex.lastIndex;
  }

  if (lastIndex < json.length) {
    elements.push(json.slice(lastIndex));
  }

  return elements;
}

function extractCodeAndLanguage(children: React.ReactNode): { code: string; language: string } {
  let code = '';
  let language = '';

  const child = Array.isArray(children)
    ? children.find((item) => isValidElement(item))
    : isValidElement(children)
      ? children
      : null;

  if (child && typeof child.props === 'object' && child.props !== null) {
    const props = child.props as { className?: string; children?: unknown };
    const rawClass = props.className || '';
    const match = rawClass.match(/language-([a-zA-Z0-9_-]+)/);
    if (match) {
      language = match[1];
    }
    if (typeof props.children === 'string') {
      code = props.children;
    } else if (Array.isArray(props.children)) {
      code = props.children.filter((c): c is string => typeof c === 'string').join('');
    }
  } else if (typeof children === 'string') {
    code = children;
  }

  if (!code && Array.isArray(children)) {
    code = children.filter((c): c is string => typeof c === 'string').join('');
  }

  return { code: code.replace(/\n$/, ''), language };
}

function CodeBlock({ code, language, className }: { code: string; language: string; className?: string }) {
  const isJson = language.toLowerCase() === 'json';

  return (
    <div
      className={[
        'my-6 max-w-4xl overflow-hidden rounded-xl border border-[var(--brand-rule-strong)] bg-[#1e1713] text-[#f4ebd9] shadow-xs',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {language ? (
        <div className="flex items-center justify-between border-b border-white/10 bg-[#282019] px-4 py-2 text-xs font-mono text-[#c2b8a0]">
          <span className="font-semibold tracking-wider">{language.toUpperCase()}</span>
        </div>
      ) : null}
      <pre className="overflow-x-auto p-4 text-xs leading-6 sm:text-sm">
        <code className="block border-0 bg-transparent p-0 font-mono text-inherit">
          {isJson ? highlightJson(code) : code}
        </code>
      </pre>
    </div>
  );
}

/** 博客正文的样式映射，保证排版美观且图表/代码块/宽表格自适应展开。 */
const markdownComponents: Components = {
  h2: ({ node: _node, className, ...props }) => (
    <h2
      className={['mt-14 max-w-3xl text-3xl font-semibold tracking-tight text-foreground', className]
        .filter(Boolean)
        .join(' ')}
      {...props}
    />
  ),
  h3: ({ node: _node, className, ...props }) => (
    <h3
      className={['mt-10 max-w-3xl text-xl font-semibold tracking-tight text-foreground', className]
        .filter(Boolean)
        .join(' ')}
      {...props}
    />
  ),
  p: ({ node: _node, className, ...props }) => (
    <p
      className={['mt-5 max-w-3xl text-base leading-8 text-muted-foreground', className].filter(Boolean).join(' ')}
      {...props}
    />
  ),
  a: ({ node: _node, className, ...props }) => (
    <a
      className={['font-medium text-primary underline-offset-4 hover:underline', className].filter(Boolean).join(' ')}
      {...props}
    />
  ),
  ul: ({ node: _node, className, ...props }) => (
    <ul
      className={['mt-5 max-w-3xl list-disc space-y-3 pl-5 text-base leading-8 text-muted-foreground', className]
        .filter(Boolean)
        .join(' ')}
      {...props}
    />
  ),
  ol: ({ node: _node, className, ...props }) => (
    <ol
      className={['mt-5 max-w-3xl list-decimal space-y-3 pl-5 text-base leading-8 text-muted-foreground', className]
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
        'mt-8 max-w-3xl rounded-lg border border-border bg-muted/50 px-5 py-4 text-base leading-8 text-foreground',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    />
  ),
  table: ({ node: _node, className, ...props }) => (
    <div className="my-8 w-full max-w-6xl lg:max-w-7xl overflow-x-auto rounded-lg border border-border [&_tbody_tr:last-child_td]:border-b-0">
      <table className={['w-full text-left text-sm', className].filter(Boolean).join(' ')} {...props} />
    </div>
  ),
  thead: ({ node: _node, className, ...props }) => (
    <thead className={['bg-muted/70 text-foreground', className].filter(Boolean).join(' ')} {...props} />
  ),
  th: ({ node: _node, className, ...props }) => (
    <th
      className={['border-b border-border px-4 py-3 font-semibold whitespace-nowrap', className]
        .filter(Boolean)
        .join(' ')}
      {...props}
    />
  ),
  td: ({ node: _node, className, ...props }) => (
    <td
      className={['border-b border-border px-4 py-3 text-muted-foreground align-top', className]
        .filter(Boolean)
        .join(' ')}
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
  pre: ({ node: _node, className, children }) => {
    const { code, language } = extractCodeAndLanguage(children);

    if (language === 'mermaid') {
      return <Mermaid chart={code} />;
    }

    return <CodeBlock code={code} language={language} className={className} />;
  },
  hr: ({ node: _node, className, ...props }) => (
    <hr className={['my-12 max-w-3xl border-border', className].filter(Boolean).join(' ')} {...props} />
  ),
};

export function MarkdownRenderer({ content }: { content: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
      {content}
    </ReactMarkdown>
  );
}
