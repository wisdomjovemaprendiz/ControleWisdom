import test from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loginAddress, validPassword } from "../lib/accounts";
import {
  authorizedProfile,
  createTeamAccount,
  updateTeamAccount,
  resetTeamPassword,
  ApiError,
} from "../lib/server/team";
import { dailyAnalysisResponse } from "../lib/server/daily";
function fakeClient(
  role = "admin",
  options: { active?: boolean; must?: boolean; profileError?: boolean } = {},
) {
  const calls: { kind: string; input?: unknown }[] = [];
  const client = {
    auth: {
      getUser: async (token: string) => {
        calls.push({ kind: "verify", input: token });
        return token === "valid-token"
          ? { data: { user: { id: "actor" } }, error: null }
          : { data: { user: null }, error: {} };
      },
      admin: {
        createUser: async (input: unknown) => {
          calls.push({ kind: "create_auth", input });
          return { data: { user: { id: "new-user" } }, error: null };
        },
        deleteUser: async (id: string) => {
          calls.push({ kind: "cleanup", input: id });
          return { error: null };
        },
        updateUserById: async (id: string, input: unknown) => {
          calls.push({ kind: "reset", input: { id, ...(input as object) } });
          return { error: null };
        },
      },
    },
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          single: async () =>
            table === "units"
              ? { data: { id: "u1" }, error: null }
              : {
                  data: {
                    id: "actor",
                    role,
                    active: options.active !== false,
                    must_change_password: options.must || false,
                  },
                  error: null,
                },
        }),
      }),
    }),
    rpc: async (name: string, input: unknown) => {
      calls.push({ kind: name, input });
      return options.profileError
        ? { data: null, error: {} }
        : {
            data: {
              id: "new-user",
              username: "prof.novo",
              role: "professor",
              unit_id: "u1",
            },
            error: null,
          };
    },
  } as unknown as SupabaseClient;
  return { client, calls };
}
const request = (token?: string) =>
  new Request("http://localhost/api/team", {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
test("login usa nome de usuário e não exige e-mail real; senha com quatro caracteres é rejeitada", () => {
  assert.equal(
    loginAddress(" Ana.Oliveira "),
    "ana.oliveira@accounts.wisdom.invalid",
  );
  assert.throws(() => loginAddress("usuario@email.com"));
  assert.throws(() => loginAddress("joão"));
  assert.equal(validPassword("1234"), false);
  assert.equal(validPassword("UmaSenhaInicial123"), true);
});
test("API valida o token no Auth e rejeita coordenação, professor, sessão inválida e usuário desativado", async () => {
  for (const role of ["coordenacao", "professor", "secretaria"]) {
    const { client } = fakeClient(role);
    await assert.rejects(authorizedProfile(request("valid-token"), client), {
      status: 403,
    });
  }
  const { client } = fakeClient();
  await assert.rejects(authorizedProfile(request(), client), { status: 401 });
  await assert.rejects(authorizedProfile(request("invalid"), client), {
    status: 401,
  });
  await assert.rejects(
    authorizedProfile(
      request("valid-token"),
      fakeClient("admin", { active: false }).client,
    ),
    { status: 403 },
  );
  await assert.rejects(
    authorizedProfile(
      request("valid-token"),
      fakeClient("admin", { must: true }).client,
    ),
    { status: 403 },
  );
});
test("criação usa Auth administrativo e devolve apenas perfil, sem senha", async () => {
  const { client, calls } = fakeClient();
  await authorizedProfile(request("valid-token"), client);
  const result = await createTeamAccount(client, "actor", {
    name: "Professor Novo",
    username: "prof.novo",
    password: "SenhaTemporaria123",
    role: "professor",
    unit_id: "u1",
  });
  assert.equal(
    (calls.find((c) => c.kind === "create_auth")!.input as any).email,
    "prof.novo@accounts.wisdom.invalid",
  );
  assert.equal(
    (calls.find((c) => c.kind === "create_auth")!.input as any).email_confirm,
    true,
  );
  assert.equal(
    (calls.find((c) => c.kind === "admin_create_profile")!.input as any)
      .p_actor,
    "actor",
  );
  assert.ok(!JSON.stringify(result).includes("SenhaTemporaria123"));
});
test("falha ao vincular perfil remove somente a conta Auth recém-criada", async () => {
  const { client, calls } = fakeClient("admin", { profileError: true });
  await assert.rejects(
    createTeamAccount(client, "actor", {
      name: "Professor Novo",
      username: "prof.novo",
      password: "SenhaTemporaria123",
      role: "professor",
      unit_id: "u1",
    }),
  );
  assert.deepEqual(calls.find((c) => c.kind === "cleanup")?.input, "new-user");
});
test("administrador não desativa o próprio acesso; redefinição de outro usuário exige nova troca", async () => {
  const { client, calls } = fakeClient();
  await assert.rejects(
    updateTeamAccount(client, "actor", {
      id: "actor",
      name: "Admin",
      role: "admin",
      unit_id: "u1",
      active: false,
    }),
    { status: 400 },
  );
  await assert.rejects(
    resetTeamPassword(client, "actor", {
      id: "actor",
      password: "SenhaNova123",
    }),
    { status: 400 },
  );
  await resetTeamPassword(client, "actor", {
    id: "teacher",
    password: "SenhaNova123",
  });
  assert.ok(
    calls.findIndex((c) => c.kind === "admin_require_password_change") <
      calls.findIndex((c) => c.kind === "reset"),
  );
});
test("rotina diária não consulta o banco sem segredo válido e não revela erros internos", async () => {
  let calls = 0;
  const secret = "isolated-cron-test-secret-with-32-characters";
  const client = () => {
    calls++;
    return {
      rpc: async () => ({
        data: { units_processed: 2, snapshot_date: "2026-11-03" },
        error: null,
      }),
    } as unknown as SupabaseClient;
  };
  assert.equal(
    (await dailyAnalysisResponse(request(), undefined, client)).status,
    503,
  );
  assert.equal(
    (await dailyAnalysisResponse(request("invalid"), secret, client)).status,
    401,
  );
  assert.equal(calls, 0);
  const response = await dailyAnalysisResponse(request(secret), secret, client);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).units_processed, 2);
  const failed = await dailyAnalysisResponse(
    request(secret),
    secret,
    () =>
      ({
        rpc: async () => ({ error: { message: "sensitive backend detail" } }),
      }) as unknown as SupabaseClient,
  );
  assert.equal(failed.status, 503);
  assert.ok(!(await failed.text()).includes("sensitive"));
});
