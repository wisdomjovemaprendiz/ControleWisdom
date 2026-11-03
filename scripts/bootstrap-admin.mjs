import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
nextEnv.loadEnvConfig(process.cwd());
const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
  key = process.env.SUPABASE_SERVICE_ROLE_KEY,
  password = process.env.WISDOM_BOOTSTRAP_ADMIN_PASSWORD;
const username = (process.env.WISDOM_BOOTSTRAP_ADMIN_LOGIN || "admin")
    .trim()
    .toLowerCase(),
  unitName = (
    process.env.WISDOM_BOOTSTRAP_UNIT_NAME || "Unidade Principal"
  ).trim();
if (!url || !key || !password) {
  console.error(
    "Configure a URL, SUPABASE_SERVICE_ROLE_KEY e WISDOM_BOOTSTRAP_ADMIN_PASSWORD nos campos seguros. Nenhuma conta foi criada.",
  );
  process.exit(1);
}
if (
  !/^[a-z][a-z0-9._-]{2,31}$/.test(username) ||
  password.length < 6 ||
  password.length > 128
) {
  console.error(
    "Login inválido ou senha inicial fora do limite de 6 a 128 caracteres. Nenhuma conta foi criada.",
  );
  process.exit(1);
}
const client = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
try {
  const check = await client
    .from("profiles")
    .select("id")
    .eq("role", "admin")
    .limit(1);
  if (check.error)
    throw new Error("Prepare primeiro o esquema completo do banco.");
  if (check.data.length)
    throw new Error(
      "Já existe administrador. Nenhuma conta ou senha foi alterada.",
    );
  const created = await client.auth.admin.createUser({
    email: `${username}@accounts.wisdom.invalid`,
    password,
    email_confirm: true,
    app_metadata: { wisdom_managed: true },
  });
  if (created.error || !created.data.user)
    throw new Error(
      "Não foi possível criar o login. Verifique se ele já existe e a política de senha do projeto.",
    );
  const id = created.data.user.id;
  const saved = await client.rpc("bootstrap_admin", {
    p_id: id,
    p_username: username,
    p_name: "Administrador Wisdom",
    p_unit_name: unitName,
  });
  if (saved.error) {
    const cleanup = await client.auth.admin.deleteUser(id);
    if (cleanup.error)
      throw new Error(
        "Vínculo não confirmado. Solicite suporte antes de repetir o procedimento.",
      );
    throw new Error(
      "O vínculo administrativo não foi concluído. Confira as migrações.",
    );
  }
  console.log(
    `Administrador criado: ${username}. Unidade: ${unitName}. A senha deve ser trocada no primeiro acesso. Nenhuma senha foi exibida ou gravada em arquivos pelo script.`,
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
