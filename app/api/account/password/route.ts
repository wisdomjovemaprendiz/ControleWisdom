import { serviceClient } from "@/lib/server/client";
import { authorizedProfile, apiFailure, jsonInput } from "@/lib/server/team";
import { changeOwnPassword } from "@/lib/server/password";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    const client = serviceClient();
    const { profile, token } = await authorizedProfile(
      request,
      client,
      false,
      true,
    );
    const input = await jsonInput(request);
    await changeOwnPassword(client, profile.id, token, input.password);
    return Response.json(
      { ok: true, login_required: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return apiFailure(e);
  }
}
