import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';

// 依赖 cookie/header 的会话读取，禁用静态优化
export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isAdmin } = await getSession();

  if (!user || !isAdmin) {
    redirect('/app');
  }

  return <>{children}</>;
}
