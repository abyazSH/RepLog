import GuestOnly from "@/components/guest-only";
import { authReady } from '@/lib/access';
import Login from '@/components/login';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Daftar — RepLog' };
export default function Page() { return <GuestOnly><Login ready={authReady()} register /></GuestOnly>; }
