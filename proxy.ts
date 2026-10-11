import { canOpenDashboard, isGuestRoute } from "./lib/guest-access";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { authReady } from "./lib/access";
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  response.headers.set("Cache-Control", "private, no-store");
  if (!authReady()) return response;
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(items) {
          items.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          items.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          response.headers.set("Cache-Control", "private, no-store");
        },
      },
    },
  );
  if (isGuestRoute(request.nextUrl.pathname)) {
    try {
      if (await canOpenDashboard(supabase)) {
        const target = request.nextUrl.clone();
        target.pathname = '/dashboard';
        target.search = '';
        const redirect = NextResponse.redirect(target);
        response.cookies.getAll().forEach(cookie => redirect.cookies.set(cookie));
        redirect.headers.set('Cache-Control', 'private, no-store');
        return redirect;
      }
    } catch { /* Client guest guard offers retry when authentication is unavailable. */ }
  } else {
    await supabase.auth.getClaims();
  }
  return response;
}
export const config = { matcher: ["/", "/login", "/register", "/api/data", "/auth/:path*"] };
