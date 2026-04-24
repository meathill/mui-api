import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { GoogleAnalytics } from '@next/third-parties/google';
import { routing } from '@/i18n/routing';
import { getMarketingOgImage, SITE_URL } from '@/lib/seo';

const SITE_NAME = 'MUI Router';

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
    keywords: ['AI API', 'OpenAI', 'Anthropic', 'Google AI', 'API Gateway', 'AI Models', 'ChatGPT', 'Claude', 'Gemini'],
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
    <html lang={locale}>
      <body className="font-sans antialiased">
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
      <GoogleAnalytics gaId="G-JLM9L0BTTV" />
    </html>
  );
}
