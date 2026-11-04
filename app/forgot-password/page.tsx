import PasswordRecovery from '@/components/password-recovery';
import { authReady } from '@/lib/access';
export const dynamic = 'force-dynamic';
export const metadata = {title: 'Lupa kata sandi — RepLog', referrer: 'no-referrer' as const};
export default function Page() {
  return <PasswordRecovery ready={authReady()}/>;
}
