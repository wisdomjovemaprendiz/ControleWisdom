import {
  isAuthSessionMissingError,
  type SupabaseClient,
} from "@supabase/supabase-js";
import { validPassword } from "../accounts";
import { ApiError } from "./team";

// The caller must verify the session and active profile before invoking this.
export async function changeOwnPassword(
  client: SupabaseClient,
  userId: string,
  token: string,
  password: unknown,
) {
  if (!validPassword(password))
    throw new ApiError(400, "A senha deve ter de 6 a 128 caracteres.");
  const changed = await client.auth.admin.updateUserById(userId, {
    password: password as string,
  });
  if (changed.error)
    throw new ApiError(
      400,
      "Não foi possível alterar a senha. Escolha outra senha válida.",
    );

  const revoke = await client.auth.admin.signOut(token, "global");
  // A password change can already invalidate the session. That is the desired
  // result of logout, so it must not prevent completing the first-login flag.
  if (
    revoke.error &&
    !isAuthSessionMissingError(revoke.error) &&
    !["session_not_found", "session_expired"].includes(revoke.error.code || "")
  )
    throw new ApiError(
      503,
      "A senha foi atualizada, mas não foi possível encerrar as sessões. Tente novamente para concluir.",
    );

  const { error } = await client.rpc("complete_password_change", {
    p_id: userId,
  });
  if (error)
    throw new ApiError(
      503,
      "A senha foi atualizada, mas a liberação do acesso não foi concluída. Procure a administração.",
    );
}
