import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '注册',
  description: '注册 MUI Router 账户，免费开始使用统一 AI API 网关，一个 Key 调用所有模型。',
};

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
