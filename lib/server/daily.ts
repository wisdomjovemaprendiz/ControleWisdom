import { timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
export async function dailyAnalysisResponse(
  request: Request,
  secret: string | undefined,
  client: () => SupabaseClient,
) {
  const headers = { "Cache-Control": "no-store" };
  if (!secret || secret.length < 32)
    return Response.json(
      { error: "Rotina não configurada." },
      { status: 503, headers },
    );
  const provided = request.headers.get("authorization") || "",
    expected = `Bearer ${secret}`;
  if (
    Buffer.byteLength(provided) !== Buffer.byteLength(expected) ||
    !timingSafeEqual(Buffer.from(provided), Buffer.from(expected))
  )
    return Response.json(
      { error: "Não autorizado." },
      { status: 401, headers },
    );
  try {
    const { data, error } = await client().rpc("run_daily_analytics");
    if (error) throw error;
    return Response.json({ ok: true, ...data }, { headers });
  } catch {
    return Response.json(
      { error: "Não foi possível concluir a análise diária." },
      { status: 503, headers },
    );
  }
}
