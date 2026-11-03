import type { SupabaseClient } from "@supabase/supabase-js";
import { loginAddress, normalizeUsername, validPassword } from "../accounts";
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function authorizedProfile(
  request: Request,
  client: SupabaseClient,
  adminOnly = true,
  allowPasswordChange = false,
) {
  const token = request.headers
    .get("authorization")
    ?.match(/^Bearer (.+)$/)?.[1];
  if (!token) throw new ApiError(401, "Entre na sua conta para continuar.");
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user)
    throw new ApiError(401, "Sua sessão expirou. Entre novamente.");
  const { data: profile, error: profileError } = await client
    .from("profiles")
    .select("*")
    .eq("id", data.user.id)
    .single();
  if (profileError || !profile || !profile.active)
    throw new ApiError(
      403,
      "Seu acesso está indisponível. Procure a administração.",
    );
  if (!allowPasswordChange && profile.must_change_password)
    throw new ApiError(403, "Altere sua senha inicial antes de continuar.");
  if (adminOnly && profile.role !== "admin")
    throw new ApiError(403, "Apenas administradores podem gerenciar contas.");
  return { profile, token };
}
function checkProfile(input: Record<string, unknown>) {
  if (
    typeof input.name !== "string" ||
    input.name.trim().length < 2 ||
    input.name.length > 100
  )
    throw new ApiError(400, "Informe o nome completo.");
  if (
    !["admin", "coordenacao", "secretaria", "professor"].includes(
      String(input.role),
    )
  )
    throw new ApiError(400, "Perfil inválido.");
  if (typeof input.unit_id !== "string" || !input.unit_id)
    throw new ApiError(400, "Selecione uma unidade.");
}
export async function createTeamAccount(
  client: SupabaseClient,
  actor: string,
  input: Record<string, unknown>,
) {
  checkProfile(input);
  if (!validPassword(input.password))
    throw new ApiError(400, "A senha inicial deve ter de 6 a 128 caracteres.");
  let email: string;
  const username = normalizeUsername(String(input.username || ""));
  try {
    email = loginAddress(username);
  } catch (e) {
    throw new ApiError(400, (e as Error).message);
  }
  const { data: unit, error: unitError } = await client
    .from("units")
    .select("id")
    .eq("id", input.unit_id)
    .single();
  if (unitError || !unit) throw new ApiError(400, "Unidade não encontrada.");
  const { data, error } = await client.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
    app_metadata: { wisdom_managed: true },
  });
  if (error || !data.user)
    throw new ApiError(
      error?.status === 422 ? 409 : 400,
      "Não foi possível criar o login. Verifique se ele já está cadastrado.",
    );
  const { data: profile, error: saveError } = await client.rpc(
    "admin_create_profile",
    {
      p_actor: actor,
      p_id: data.user.id,
      p_username: username,
      p_name: input.name,
      p_role: input.role,
      p_unit: input.unit_id,
    },
  );
  if (saveError) {
    const cleanup = await client.auth.admin.deleteUser(data.user.id);
    if (cleanup.error)
      throw new ApiError(
        503,
        "A criação não foi concluída. Solicite suporte antes de tentar o mesmo login novamente.",
      );
    throw new ApiError(
      400,
      "Não foi possível vincular o usuário à equipe. Confira a unidade e o perfil.",
    );
  }
  return profile;
}
export async function updateTeamAccount(
  client: SupabaseClient,
  actor: string,
  input: Record<string, unknown>,
) {
  checkProfile(input);
  if (typeof input.id !== "string" || typeof input.active !== "boolean")
    throw new ApiError(400, "Conta inválida.");
  if (input.id === actor && (input.active === false || input.role !== "admin"))
    throw new ApiError(
      400,
      "Você não pode remover o seu próprio acesso administrativo.",
    );
  const { data, error } = await client.rpc("admin_update_profile", {
    p_actor: actor,
    p_id: input.id,
    p_name: input.name,
    p_role: input.role,
    p_unit: input.unit_id,
    p_active: input.active,
  });
  if (error)
    throw new ApiError(
      400,
      "Não foi possível alterar a conta. Mantenha um administrador ativo e confira as turmas atribuídas.",
    );
  return data;
}
export async function resetTeamPassword(
  client: SupabaseClient,
  actor: string,
  input: Record<string, unknown>,
) {
  if (typeof input.id !== "string" || !validPassword(input.password))
    throw new ApiError(
      400,
      "Informe uma senha inicial com pelo menos 6 caracteres.",
    );
  if (input.id === actor)
    throw new ApiError(400, "Use a opção de alterar sua própria senha.");
  const { error } = await client.rpc("admin_require_password_change", {
    p_actor: actor,
    p_id: input.id,
  });
  if (error)
    throw new ApiError(400, "Conta não encontrada ou operação indisponível.");
  const result = await client.auth.admin.updateUserById(input.id, {
    password: input.password,
  });
  if (result.error)
    throw new ApiError(
      503,
      "A redefinição não foi confirmada. O usuário deverá alterar a senha ao entrar; tente novamente com uma senha válida.",
    );
}
export function apiFailure(error: unknown) {
  const known = error instanceof ApiError;
  return Response.json(
    {
      error: known
        ? error.message
        : "Operação indisponível. Procure a administração para concluir a configuração.",
    },
    {
      status: known ? error.status : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
export async function jsonInput(request: Request) {
  const text = await request.text();
  if (text.length > 8000) throw new ApiError(413, "Solicitação muito grande.");
  try {
    const value = JSON.parse(text);
    if (!value || Array.isArray(value) || typeof value !== "object")
      throw new Error();
    return value as Record<string, unknown>;
  } catch {
    throw new ApiError(400, "Dados inválidos.");
  }
}
