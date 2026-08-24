import { GoogleAnalytics } from '@next/third-parties/google';
import type { Metadata } from 'next';
import { Fraunces, JetBrains_Mono, Nunito } from 'next/font/google';
import { notFound } from 'next/navigation';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import { getMarketingOgImage, SITE_URL } from '@/lib/seo';

const SITE_NAME = 'MuiRouter';

// Tailwind class 实际只用到 normal/medium/semibold/bold（400-700），
// 砍掉未使用的 800 字重以缩小字体文件总体积。
const fontSans = Nunito({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-nunito',
  display: 'swap',
});
const fontHeading = Fraunces({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-fraunces',
  display: 'swap',
});
const fontMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'metadata' });
  const ogImage = getMarketingOgImage(locale);

  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: `${SITE_NAME} - ${t('title')}`,
      template: `%s | ${SITE_NAME}`,
    },
    description: t('description'),
    keywords: [
      'MCP router',
      'mcp-router',
      'Model Context Protocol router',
      'OpenRouter alternative',
      'OpenRouter alternatives',
      'LiteLLM alternative',
      'AI gateway',
      'AI router',
      'LLM router',
      'AI API router',
      'OpenAI-compatible API',
      'OpenAI compatible router',
      'LLM gateway',
      'MCP server',
      'AI API',
      'OpenAI',
      'Anthropic',
      'Claude',
      'Gemini',
      'xAI',
      'Grok',
    ],
    openGraph: {
      type: 'website',
      siteName: SITE_NAME,
      title: `${SITE_NAME} - ${t('ogTitle')}`,
      description: t('description'),
      url: SITE_URL,
      locale,
      images: [ogImage],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${SITE_NAME} - ${t('ogTitle')}`,
      description: t('description'),
      images: [ogImage.url],
    },
    icons: {
      icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }],
      apple: [{ url: '/brand/mui-mark.png', sizes: '256x256' }],
    },
    robots: {
      index: true,
      follow: true,
    },
    alternates: {
      canonical: SITE_URL,
      languages: Object.fromEntries(
        routing.locales.map((l) => [l, l === routing.defaultLocale ? SITE_URL : `${SITE_URL}/${l}`]),
      ),
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);

  return (
    <html
      lang={locale}
      className={`${fontSans.variable} ${fontHeading.variable} ${fontMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script
          // 防 FOUC：渲染前同步读 localStorage / 系统偏好，先把 .dark 加到 <html>
          // biome-ignore lint/security/noDangerouslySetInnerHtml: 仅注入静态字符串
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var k='mui-theme';var s=localStorage.getItem(k);var d=s==='dark'||((s===null||s==='system')&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.classList.add('dark');}catch(e){}})();`,
          }}
        />
      </head>
      <body className="font-sans antialiased">
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
      <GoogleAnalytics gaId="G-JLM9L0BTTV" />
    </html>
  );
}
