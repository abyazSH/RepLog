import GuestOnly from "@/components/guest-only";
import { authReady } from "@/lib/access";
import Login from "@/components/login";
export const dynamic = "force-dynamic";
export default function Page() {
  return <GuestOnly><Login ready={authReady()} /></GuestOnly>;
}
