import { redirect } from 'next/navigation';
import PasswordRecovery from '@/components/password-recovery';
import { authReady } from '@/lib/access';
import { serverClient } from '@/lib/supabase/server';
export const dynamic = 'force-dynamic';
export const metadata = {title: 'Password baru — RepLog', referrer: 'no-referrer' as const};
export default async function Page() {
  const ready = authReady();
  if (ready) {
    const supabase = await serverClient();
    const {data, error} = await supabase.auth.getUser();
    if (error || !data.user) redirect('/forgot-password?error=expired');
  }
  return <PasswordRecovery ready={ready} reset/>;
}
