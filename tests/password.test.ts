import test from "node:test";
import assert from "node:assert/strict";
import {
  AuthApiError,
  AuthSessionMissingError,
  type AuthError,
  type SupabaseClient,
} from "@supabase/supabase-js";
import { changeOwnPassword } from "../lib/server/password";

function fake(
  options: {
    changeError?: boolean;
    revokeError?: AuthError;
    rpcError?: boolean;
  } = {},
) {
  const calls: string[] = [];
  let mustChange = true;
  const client = {
    auth: {
      admin: {
        updateUserById: async (id: string) => {
          assert.equal(id, "verified-user");
          calls.push("password");
          return {
            error: options.changeError
              ? new AuthApiError("Rejected", 422, undefined)
              : null,
          };
        },
        signOut: async (token: string, scope: string) => {
          assert.equal(token, "verified-token");
          assert.equal(scope, "global");
          calls.push("logout");
          return { error: options.revokeError || null };
        },
      },
    },
    rpc: async (name: string, args: unknown) => {
      calls.push("complete");
      assert.equal(name, "complete_password_change");
      assert.deepEqual(args, { p_id: "verified-user" });
      if (!options.rpcError) mustChange = false;
      return { error: options.rpcError ? { message: "DB unavailable" } : null };
    },
  } as unknown as SupabaseClient;
  return { client, calls, mustChange: () => mustChange };
}
const change = (
  client: SupabaseClient,
  password: unknown = "PasswordForTest123!",
) => changeOwnPassword(client, "verified-user", "verified-token", password);

test("senha salva e sessão já invalidada concluem primeiro acesso sem ciclo", async () => {
  for (const revokeError of [
    undefined,
    new AuthSessionMissingError(),
    new AuthApiError("Session gone", 403, "session_not_found"),
    new AuthApiError("Session expired", 401, "session_expired"),
  ]) {
    const state = fake({ revokeError });
    await change(state.client);
    assert.deepEqual(state.calls, ["password", "logout", "complete"]);
    assert.equal(state.mustChange(), false);
  }
});
test("senha inválida ou recusada nunca libera o perfil", async () => {
  const invalid = fake();
  await assert.rejects(change(invalid.client, "1234"), { status: 400 });
  assert.deepEqual(invalid.calls, []);
  const rejected = fake({ changeError: true });
  await assert.rejects(change(rejected.client), { status: 400 });
  assert.deepEqual(rejected.calls, ["password"]);
  assert.equal(rejected.mustChange(), true);
});
test("falhas reais de revogação e de banco não são tratadas como sucesso", async () => {
  const logout = fake({
    revokeError: new AuthApiError("Unavailable", 503, undefined),
  });
  await assert.rejects(change(logout.client), { status: 503 });
  assert.deepEqual(logout.calls, ["password", "logout"]);
  assert.equal(logout.mustChange(), true);
  const database = fake({ rpcError: true });
  await assert.rejects(change(database.client), { status: 503 });
  assert.equal(database.mustChange(), true);
});
