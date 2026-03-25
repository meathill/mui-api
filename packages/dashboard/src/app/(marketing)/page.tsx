import type { Metadata } from 'next';
import { HeroSection } from './_components/hero-section';
import { ModelsSection } from './_components/models-section';
import { AdvantagesSection } from './_components/advantages-section';
import { StepsSection } from './_components/steps-section';
import { CodeSection } from './_components/code-section';
import { CtaSection } from './_components/cta-section';

export const metadata: Metadata = {
  title: 'MUI Router - 一个 Key，调用所有 AI 模型',
  description:
    '统一 AI API 网关，支持 OpenAI、Anthropic、Google 等主流 AI 模型。兼容 OpenAI SDK，按量计费，无需 VPN，全球 300+ 节点加速。',
  alternates: {
    canonical: '/',
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      name: 'MUI Router',
      url: 'https://muirouter.com',
      logo: 'https://muirouter.com/favicon.svg',
    },
    {
      '@type': 'WebApplication',
      name: 'MUI Router',
      url: 'https://muirouter.com',
      applicationCategory: 'DeveloperApplication',
      operatingSystem: 'All',
      description: '统一 AI API 网关，一个 Key 调用所有 AI 模型',
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'CNY',
        description: '按量计费，无月费',
      },
    },
  ],
};

export default function LandingPage() {
  return (
    <div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <HeroSection />
      <ModelsSection />
      <AdvantagesSection />
      <StepsSection />
      <CodeSection />
      <CtaSection />
    </div>
  );
}
