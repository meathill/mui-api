import { ArrowUpRight, Check, X } from '@phosphor-icons/react/ssr';
import { Link } from '@/i18n/navigation';

export interface ToolCopy {
  name: string;
  tagline: string;
  description: string;
  pros: string[];
  cons?: string[];
  bestFor?: string;
}

export interface ToolEntry {
  id: string;
  href?: string;
  isMuiRouter?: boolean;
}

interface ToolListSectionProps {
  title: string;
  entries: ToolEntry[];
  copy: Record<string, ToolCopy>;
}

/**
 * 榜单卡片列表：entries 是代码字面量（id + 站外 href + 是否 MuiRouter 自身），
 * copy 来自 i18n（namespace.tools.<id>）。MuiRouter 条目高亮、CTA 走站内 /register，
 * 其余条目是真实编辑性引用外链，不加 nofollow。
 */
export function ToolListSection({ title, entries, copy }: ToolListSectionProps) {
  return (
    <section className="py-14 px-6">
      <div className="mx-auto max-w-4xl">
        <h2 className="text-3xl font-bold tracking-tight text-center mb-8">{title}</h2>
        <ol className="space-y-4">
          {entries.map((entry, index) => {
            const tool = copy[entry.id];
            return (
              <li
                key={entry.id}
                className={`rounded-lg border p-5 ${
                  entry.isMuiRouter ? 'border-[var(--brand-corgi)] bg-[var(--brand-fluff)]' : 'border-border bg-card'
                }`}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
                  <h3 className="text-lg font-semibold">
                    <span className="mr-2 text-muted-foreground">{index + 1}.</span>
                    {tool.name}
                  </h3>
                  {entry.isMuiRouter ? (
                    <Link
                      href="/register"
                      className="inline-flex items-center gap-1 text-sm font-medium text-[var(--brand-yellow-deep)] hover:underline"
                    >
                      {tool.tagline}
                      <ArrowUpRight size={14} />
                    </Link>
                  ) : (
                    <a
                      href={entry.href}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
                    >
                      {tool.tagline}
                      <ArrowUpRight size={14} />
                    </a>
                  )}
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground mb-3">{tool.description}</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <ul className="space-y-1">
                    {tool.pros.map((pro) => (
                      <li key={pro} className="flex items-start gap-1.5 text-sm">
                        <Check size={16} className="mt-0.5 shrink-0 text-success" />
                        <span>{pro}</span>
                      </li>
                    ))}
                  </ul>
                  {tool.cons && tool.cons.length > 0 && (
                    <ul className="space-y-1">
                      {tool.cons.map((con) => (
                        <li key={con} className="flex items-start gap-1.5 text-sm text-muted-foreground">
                          <X size={16} className="mt-0.5 shrink-0 text-[var(--brand-tongue)]" />
                          <span>{con}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {tool.bestFor && <p className="mt-3 text-xs text-muted-foreground">{tool.bestFor}</p>}
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
