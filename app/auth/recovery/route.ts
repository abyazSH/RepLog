import { NextResponse } from 'next/server';
import { appOrigin, authReady } from '@/lib/access';
import { recoveryDestination } from '@/lib/password-recovery';
import { serverClient } from '@/lib/supabase/server';
export async function GET(request: Request) {
  if (!authReady()) return Response.json({error: 'Login belum dikonfigurasi.'}, {status: 503});
  const supabase = await serverClient();
  const path = await recoveryDestination(supabase.auth, request.url);
  const response = NextResponse.redirect(appOrigin() + path);
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('Referrer-Policy', 'no-referrer');
  return response;
}
