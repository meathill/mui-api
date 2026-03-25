import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '登录',
  description: '登录 MUI Router，开始使用统一 AI API 网关服务。',
  robots: { index: false, follow: false },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
