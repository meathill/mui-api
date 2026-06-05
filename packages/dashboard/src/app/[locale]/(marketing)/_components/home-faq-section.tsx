import { useTranslations } from 'next-intl';

interface HomeFaqItem {
  question: string;
  answer: string;
}

/**
 * 首页 FAQ：首要目标是消解 Material UI 歧义（最高权重页面上明确「不是 MUI 组件库」），
 * 并补充 FAQPage 结构化数据。
 */
export function HomeFaqSection() {
  const t = useTranslations('homeFaq');
  const faq = t.raw('faq') as HomeFaqItem[];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  };

  return (
    <section className="py-14 px-6 bg-muted/40">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="mx-auto max-w-3xl">
        <h2 className="text-3xl font-bold tracking-tight text-center mb-8">{t('title')}</h2>
        <dl className="space-y-6">
          {faq.map((item) => (
            <div key={item.question} className="rounded-lg border border-border bg-card p-5">
              <dt className="font-semibold text-base mb-2">{item.question}</dt>
              <dd className="text-sm text-muted-foreground leading-relaxed">{item.answer}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
