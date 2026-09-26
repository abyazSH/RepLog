import { authReady } from '@/lib/access';
import Login from '@/components/login';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Daftar — RepLog' };
export default function Page() { return <Login ready={authReady()} register />; }
