import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { buildMetadata, getResolvedLocale } from '@/lib/seo';
import { ContactForm } from './contact-form';

export function generateStaticParams() {
  return [
    { locale: 'en' },
    { locale: 'zh' },
    { locale: 'fr' },
    { locale: 'es' },
    { locale: 'pt' },
    { locale: 'de' },
    { locale: 'th' },
    { locale: 'ja' },
  ];
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const resolved = getResolvedLocale(locale);
  const title = resolved === 'zh' ? '联系我们 - MuiRouter' : 'Contact - MuiRouter';
  const description =
    resolved === 'zh' ? '联系 MuiRouter，支持邮箱与反馈表单。' : 'Contact MuiRouter via email or feedback form.';
  return buildMetadata({ path: '/contact', title, description, locale: resolved });
}

export default async function ContactPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const resolved = getResolvedLocale(locale);
  setRequestLocale(resolved);
  const isZh = resolved === 'zh';
  return (
    <div className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
      <h1 className="text-3xl font-bold tracking-tight">{isZh ? '联系我们' : 'Contact us'}</h1>
      <p className="mt-3 text-muted-foreground leading-7">
        {isZh ? (
          <>
            邮箱：
            <a href="mailto:support@muirouter.com" className="text-primary underline-offset-4 hover:underline">
              support@muirouter.com
            </a>
            。 你也可以通过下方表单提交反馈，我们会同步到内部反馈系统。
          </>
        ) : (
          <>
            Email us at{' '}
            <a href="mailto:support@muirouter.com" className="text-primary underline-offset-4 hover:underline">
              support@muirouter.com
            </a>{' '}
            or use the form below. Submissions are forwarded to our internal feedback system.
          </>
        )}
      </p>
      <div className="mt-8">
        <ContactForm locale={resolved} />
      </div>
      <p className="mt-6 text-sm text-muted-foreground">
        {isZh ? '也可直接访问 ' : 'You can also visit '}
        <a
          href="https://feedback.meathill.com"
          target="_blank"
          rel="noreferrer"
          className="text-primary underline-offset-4 hover:underline"
        >
          feedback.meathill.com
        </a>
        {isZh ? ' 提交反馈。' : ' to submit feedback.'}
      </p>
    </div>
  );
}
