import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { AppSidebar } from '@/components/app-sidebar';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, isAdmin } = await getSession();

  if (!user) {
    redirect('/login');
  }

  return (
    <div className="flex h-screen bg-background">
      <AppSidebar user={user} isAdmin={isAdmin} />
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  );
}
