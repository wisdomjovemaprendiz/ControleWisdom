import { serviceClient } from "@/lib/server/client";
import {
  authorizedProfile,
  ApiError,
  apiFailure,
  jsonInput,
} from "@/lib/server/team";
import { validPassword } from "@/lib/accounts";
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
    if (!validPassword(input.password))
      throw new ApiError(400, "A senha deve ter pelo menos 6 caracteres.");
    const changed = await client.auth.admin.updateUserById(profile.id, {
      password: input.password,
    });
    if (changed.error)
      throw new ApiError(
        400,
        "Não foi possível alterar a senha. Escolha outra senha válida.",
      );
    const revoke = await client.auth.admin.signOut(token, "global");
    if (revoke.error)
      throw new ApiError(
        503,
        "Entre novamente para concluir a alteração da senha.",
      );
    const { error } = await client.rpc("complete_password_change", {
      p_id: profile.id,
    });
    if (error)
      throw new ApiError(
        503,
        "Entre novamente para concluir a alteração da senha.",
      );
    return Response.json(
      { ok: true, login_required: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return apiFailure(e);
  }
}
