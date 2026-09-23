import { authorizedUser } from "@/lib/supabase/server";
import { appOrigin } from "@/lib/access";
import { emptyData, stateSchema } from "@/lib/model";
import { z } from "zod";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}
export async function GET() {
  try {
    const identity = await authorizedUser();
    if (!identity)
      return json({ error: "Silakan login dengan akun yang diizinkan." }, 401);
    const { data, error } = await identity.supabase
      .from("workout_state")
      .select("data,revision")
      .eq("user_id", identity.user.id)
      .maybeSingle();
    if (error) throw error;
    return json({
      data: data?.data ?? emptyData(),
      revision: data?.revision ?? 0,
    });
  } catch {
    return json({ error: "Database belum dapat dihubungi. Coba lagi." }, 503);
  }
}
export async function PUT(request: Request) {
  try {
    const identity = await authorizedUser();
    if (!identity)
      return json(
        { error: "Sesi login berakhir atau akun tidak diizinkan." },
        401,
      );
    if (request.headers.get("origin") !== appOrigin())
      return json({ error: "Permintaan tidak diizinkan." }, 403);
    if (!request.headers.get("content-type")?.startsWith("application/json"))
      return json({ error: "Format permintaan tidak valid." }, 415);
    const text = await request.text();
    if (text.length > 1_000_000)
      return json(
        { error: "Data terlalu besar. Ekspor dan arsipkan riwayat lama." },
        413,
      );
    let raw;
    try {
      raw = JSON.parse(text);
    } catch {
      return json({ error: "JSON tidak valid." }, 400);
    }
    const input = z
      .object({
        revision: z.number().int().nonnegative().max(2147483646),
        data: stateSchema,
      })
      .safeParse(raw);
    if (!input.success)
      return json(
        { error: input.error.issues[0]?.message ?? "Data tidak valid." },
        400,
      );
    const result = await identity.supabase.rpc("replog_save_state", {
      expected_revision: input.data.revision,
      new_data: input.data.data,
    });
    if (result.error) {
      if (result.error.code === "40001")
        return json(
          {
            error:
              "Data berubah di perangkat lain. Ekspor cadangan lalu muat ulang sebelum melanjutkan.",
          },
          409,
        );
      if (result.error.code === "42501")
        return json({ error: "Akun tidak lagi diizinkan." }, 403);
      throw result.error;
    }
    return json({ revision: result.data });
  } catch {
    return json(
      {
        error: "Belum tersimpan online. Pertahankan halaman ini dan coba lagi.",
      },
      503,
    );
  }
}
