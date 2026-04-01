import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { getSession } from '@/lib/session';
import { LanguageSwitcher } from '@/components/language-switcher';

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const { user } = await getSession();
  const t = await getTranslations('header');

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
          <Link href="/" className="text-lg font-bold tracking-tight">
            MUI Router
          </Link>
          <nav className="flex items-center gap-3">
            <LanguageSwitcher />
            <Link
              href="/pricing"
              className="inline-flex h-9 items-center rounded-lg px-4 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {t('pricing')}
            </Link>
            {user ? (
              <Link
                href="/app"
                className="inline-flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                {t('dashboard')}
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="inline-flex h-9 items-center rounded-lg px-4 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  {t('login')}
                </Link>
                <Link
                  href="/register"
                  className="inline-flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  {t('register')}
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
