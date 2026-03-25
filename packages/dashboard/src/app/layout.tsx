import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

const SITE_URL = 'https://muirouter.com';
const SITE_NAME = 'MUI Router';
const SITE_DESCRIPTION =
  '统一 AI API 网关，一个 Key 调用所有 AI 模型。支持 OpenAI、Anthropic、Google 等主流模型，按量计费，无需 VPN。';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} - 统一 AI API 网关`,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  keywords: [
    'AI API',
    'OpenAI',
    'Anthropic',
    'Google AI',
    'API 网关',
    'AI 模型',
    'ChatGPT',
    'Claude',
    'Gemini',
    'API 代理',
  ],
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    title: `${SITE_NAME} - 一个 Key，调用所有 AI 模型`,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    locale: 'zh_CN',
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SITE_NAME} - 一个 Key，调用所有 AI 模型`,
    description: SITE_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: SITE_URL,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>{children}</body>
    </html>
  );
}
