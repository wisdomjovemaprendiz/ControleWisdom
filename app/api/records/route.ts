import { serviceClient } from "@/lib/server/client";
import {
  authorizedProfile,
  apiFailure,
  ApiError,
  jsonInput,
} from "@/lib/server/team";
import { recordTables } from "@/lib/records";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    const client = serviceClient();
    const { profile } = await authorizedProfile(request, client);
    const input = await jsonInput(request);
    const { table, id, action } = input;
    if (
      !recordTables.includes(table as never) ||
      typeof id !== "string" ||
      !["edit", "archive", "restore", "delete"].includes(String(action))
    )
      throw new ApiError(400, "Operação inválida.");
    if (action === "delete" && input.confirmation !== "EXCLUIR")
      throw new ApiError(
        400,
        "Digite EXCLUIR para confirmar a exclusão definitiva.",
      );
    if (table === "profiles" && action === "delete") {
      if (id === profile.id)
        throw new ApiError(400, "Você não pode excluir sua própria conta.");
      const { data: target, error: lookup } = await client
        .from("profiles")
        .select("id,unit_id")
        .eq("id", id)
        .single();
      if (lookup || !target) throw new ApiError(404, "Usuário não encontrado.");
      const deleted = await client.auth.admin.deleteUser(id);
      if (deleted.error)
        throw new ApiError(
          409,
          "Não foi possível excluir. O usuário pode ter turmas ou registros vinculados, ou ser o último administrador. Transfira os vínculos ou arquive a conta.",
        );
      const logged = await client
        .from("audit_log")
        .insert({
          actor_id: profile.id,
          unit_id: target.unit_id,
          entity: "profiles",
          entity_id: id,
          operation: "MANAGE_DELETE",
        });
      if (logged.error) console.error("USER_DELETE_AUDIT_FAILED");
    } else {
      const result = await client.rpc("manage_record", {
        p_actor: profile.id,
        p_table: table,
        p_id: id,
        p_action: action,
        p_changes: input.changes || {},
        p_reason: input.reason || "",
      });
      if (result.error) {
        const message =
          result.error.code === "23505"
            ? "Já existe outro registro com esses dados."
            : result.error.code === "23503"
              ? "Há vínculos que impedem esta alteração. Transfira os vínculos ou arquive o registro."
              : result.error.code === "P0001"
                ? result.error.message
                : "Não foi possível alterar. Confira os campos, vínculos e limites do cadastro.";
        throw new ApiError(409, message);
      }
      if (
        table === "students" &&
        action === "delete" &&
        result.data?.photo_path
      ) {
        const removed = await client.storage
          .from("student-photos")
          .remove([result.data.photo_path]);
        if (removed.error)
          return Response.json(
            {
              ok: true,
              warning:
                "Aluno excluído. A limpeza da foto no armazenamento ficou pendente.",
            },
            { headers: { "Cache-Control": "no-store" } },
          );
      }
    }
    return Response.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiFailure(error);
  }
}
