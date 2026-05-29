import Image from 'next/image';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PawIcon } from '@/components/brand/paw-icon';
import { LanguageSwitcher } from '@/components/language-switcher';
import { HeaderAuthCta } from '@/components/marketing/header-auth-cta';
import { ThemeToggle } from '@/components/theme-toggle';
import { Link } from '@/i18n/navigation';

export default async function MarketingLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  // 显式 setRequestLocale 让 next-intl 在 SSG 时拿到 locale，
  // 否则 getTranslations 会落入 cookie/header 动态读取，导致整树 force dynamic。
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('header');

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex min-h-14 max-w-5xl flex-wrap items-center gap-2 px-4 py-3 sm:gap-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2 font-heading text-xl font-bold tracking-tight">
            <Image
              src="/brand/mui-mark.png"
              alt=""
              width={28}
              height={28}
              className="shrink-0 rounded-md border border-[var(--brand-rule-strong)]"
              aria-hidden
              priority
            />
            MUI Router
          </Link>
          <nav className="flex flex-1 flex-wrap items-center gap-2 sm:gap-3">
            <Link
              href="/pricing"
              className="inline-flex h-9 items-center rounded-lg px-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors sm:px-4"
            >
              {t('pricing')}
            </Link>
            <Link
              href="/blog"
              className="inline-flex h-9 items-center rounded-lg px-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors sm:px-4"
            >
              {t('blog')}
            </Link>
            <Link
              href="/mcp"
              className="inline-flex h-9 items-center rounded-lg px-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors sm:px-4"
            >
              {t('mcp')}
            </Link>
            <span className="min-w-4 flex-1" aria-hidden="true" />
            <ThemeToggle />
            <LanguageSwitcher />
            <HeaderAuthCta />
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-border py-6 text-center text-sm text-muted-foreground">
        &copy; {new Date().getFullYear()} Meathill LLC. All rights reserved.
        <span className="mx-2 text-muted-foreground/50">·</span>
        <span className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-[0.18em] text-[var(--brand-yellow-deep)] align-middle">
          supervised by Mui
          <PawIcon className="size-3.5" />
        </span>
        <span className="ml-2 text-muted-foreground/50">v{process.env.NEXT_PUBLIC_APP_VERSION}</span>
      </footer>
    </div>
  );
}
