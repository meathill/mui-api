import { redirect } from 'next/navigation';
import { AppSidebar } from '@/components/app-sidebar';
import { TermsConsentDialog } from '@/components/auth/terms-consent-dialog';
import { getSession } from '@/lib/session';

// 登录后内容必须 request-time，不能进任何共享缓存。
export const dynamic = 'force-dynamic';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, isAdmin } = await getSession();

  if (!user) {
    redirect('/login');
  }

  return (
    <div className="flex h-screen bg-background">
      <AppSidebar user={user} isAdmin={isAdmin} />
      <main className="flex-1 overflow-auto p-6">{children}</main>
      <TermsConsentDialog />
    </div>
  );
}
