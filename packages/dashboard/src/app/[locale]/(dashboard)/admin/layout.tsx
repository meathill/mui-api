import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { getSession } from '@/lib/session';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await connection();
  const { user, isAdmin } = await getSession();

  if (!user || !isAdmin) {
    redirect('/app');
  }

  return <>{children}</>;
}
