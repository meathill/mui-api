import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { getSession } from '@/lib/session';
import { LanguageSwitcher } from '@/components/language-switcher';

// 依赖 cookie/header 的会话读取，禁用静态优化
export const dynamic = 'force-dynamic';

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const { user } = await getSession();
  const t = await getTranslations('header');

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex min-h-14 max-w-5xl flex-wrap items-center gap-2 px-4 py-3 sm:gap-3 sm:px-6">
          <Link href="/" className="text-lg font-bold tracking-tight">
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
            <span className="min-w-4 flex-1" aria-hidden="true" />
            <LanguageSwitcher />
            {user ? (
              <Link
                href="/app"
                className="inline-flex h-9 items-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors sm:px-4"
              >
                {t('dashboard')}
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="inline-flex h-9 items-center rounded-lg px-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors sm:px-4"
                >
                  {t('signIn')}
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-border py-6 text-center text-sm text-muted-foreground">
        &copy; {new Date().getFullYear()} MUI Router. All rights reserved.
        <span className="ml-2 text-muted-foreground/50">v{process.env.NEXT_PUBLIC_APP_VERSION}</span>
      </footer>
    </div>
  );
}
