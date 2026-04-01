import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isAdmin } = await getSession();

  if (!user || !isAdmin) {
    redirect('/app');
  }

  return <>{children}</>;
}
