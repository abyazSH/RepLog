import { NextResponse } from "next/server";
import { serverClient, authorizedUser } from "@/lib/supabase/server";
import { authReady, appOrigin } from "@/lib/access";
export async function GET(request: Request) {
  if (!authReady())
    return Response.json(
      { error: "Login belum dikonfigurasi." },
      { status: 503 },
    );
  const supabase = await serverClient();
  const code = new URL(request.url).searchParams.get("code");
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && (await authorizedUser()))
      return NextResponse.redirect(appOrigin() + "/");
  }
  await supabase.auth.signOut({ scope: "local" });
  return NextResponse.redirect(appOrigin() + "/login?error=access");
}
