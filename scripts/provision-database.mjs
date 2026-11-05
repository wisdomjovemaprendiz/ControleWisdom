import nextEnv from "@next/env";
import { readFile } from "node:fs/promises";
nextEnv.loadEnvConfig(process.cwd());
const token = process.env.SUPABASE_ACCESS_TOKEN,
  url = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!token || !url) {
  console.error(
    "Configure SUPABASE_ACCESS_TOKEN e NEXT_PUBLIC_SUPABASE_URL nos campos seguros do ambiente.",
  );
  process.exit(1);
}
const ref = new URL(url).hostname.split(".")[0];
if (!/^[a-z0-9]{20}$/.test(ref)) throw new Error("Projeto Supabase inválido.");
async function request(path, method, body) {
  const response = await fetch(
    `https://api.supabase.com/v1/projects/${ref}${path}`,
    {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );
  if (!response.ok)
    throw new Error(
      `Operação administrativa não concluída (HTTP ${response.status}). Nenhuma credencial foi registrada no log.`,
    );
  return response.status === 204 ? null : response.json();
}
const sql = async (query) => request("/database/query", "POST", { query });
try {
  const existing = await sql(
    "select tablename from pg_tables where schemaname='public' and tablename in ('units','profiles','offerings','classes','students','lessons','attendance','pedagogy','contacts','audit_log')",
  );
  const ledger = await sql(
    "select to_regclass('public.wisdom_schema_migrations') as name",
  );
  if (
    existing.length &&
    !ledger[0]?.name &&
    !process.argv.includes("--adopt-existing")
  )
    throw new Error(
      "Já existe um esquema sem histórico de migrações. Revise-o antes de usar --adopt-existing; o script não sobrescreve tabelas existentes.",
    );
  if (existing.length && !ledger[0]?.name && existing.length !== 10)
    throw new Error(
      "Esquema parcial: revise as tabelas existentes antes de continuar.",
    );
  await sql(
    "create table if not exists public.wisdom_schema_migrations(version text primary key,applied_at timestamptz not null default now());alter table public.wisdom_schema_migrations enable row level security;revoke all on public.wisdom_schema_migrations from anon,authenticated;",
  );
  if (existing.length && !ledger[0]?.name)
    await sql(
      "insert into public.wisdom_schema_migrations(version) values('001') on conflict do nothing",
    );
  const done = await sql("select version from public.wisdom_schema_migrations");
  for (const file of [
    "001_schema.sql",
    "002_bulk_enrollment.sql",
    "003_accounts_and_daily_analysis.sql",
    "004_student_photos.sql",
    "005_record_management.sql",
    "006_archive_permissions.sql",
    "007_historical_record_edits.sql",
    "008_pedagogical_support.sql",
    "009_camera_attendance_optional_students.sql",
    "010_commercial_enrollment.sql",
    "011_individual_lifecycle_audit.sql",
    "012_class_identity.sql",
  ]) {
    const version = file.slice(0, 3);
    if (done.some((row) => row.version === version)) {
      console.log(`${version}: já aplicada`);
      continue;
    }
    let contents = await readFile(
      new URL("../supabase/" + file, import.meta.url),
      "utf8",
    );
    contents = contents
      .replace(/^begin;\s*$/im, "")
      .replace(/commit;\s*$/i, "");
    await sql(
      `begin;\n${contents}\ninsert into public.wisdom_schema_migrations(version) values('${version}');\ncommit;`,
    );
    console.log(`${version}: aplicada`);
  }
  await request("/config/auth", "PATCH", { disable_signup: true });
  console.log(
    "Esquema, políticas, armazenamento privado e autenticação preparados. Cadastros públicos desativados. A criação do primeiro administrador é uma etapa separada.",
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
