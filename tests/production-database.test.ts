import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
const id = (n: number) =>
  `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
test("esquema de produção: contas, fotos privadas e análise diária", async (t) => {
  const db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,metadata jsonb);alter table storage.objects enable row level security;create function storage.foldername(path text) returns text[] language sql immutable as $$select (string_to_array(path,'/'))[1:greatest(array_length(string_to_array(path,'/'),1)-1,0)]$$;grant usage on schema storage to authenticated;grant select,insert,delete on storage.objects to authenticated;`,
  );
  for (const file of [
    "001_schema.sql",
    "002_bulk_enrollment.sql",
    "003_accounts_and_daily_analysis.sql",
    "004_student_photos.sql",
  ])
    await db.exec(
      readFileSync(
        new URL("../supabase/" + file, import.meta.url),
        "utf8",
      ).replace("create extension if not exists pgcrypto;", ""),
    );
  await db.exec(
    readFileSync(
      new URL(
        "../supabase/003_accounts_and_daily_analysis.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await db.exec(
    readFileSync(
      new URL("../supabase/004_student_photos.sql", import.meta.url),
      "utf8",
    ),
  );
  await db.exec(
    `insert into auth.users(id) values('${id(1)}'),('${id(2)}'),('${id(3)}'),('${id(4)}'),('${id(5)}'),('${id(6)}');insert into public.units(id,name) values('${id(11)}','Centro'),('${id(12)}','Vila Nova');insert into public.profiles(id,name,username,role,unit_id) values('${id(2)}','Ana','ana','professor','${id(11)}'),('${id(3)}','Secretaria','secretaria','secretaria','${id(11)}'),('${id(4)}','Pedro','pedro','professor','${id(12)}'),('${id(5)}','Coordenação','coordenacao','coordenacao','${id(12)}');insert into public.classes(id,unit_id,name,course,teacher_id,teacher,schedule,capacity) values('${id(21)}','${id(11)}','Turma A','Informática','${id(2)}','Ana','Segunda',4),('${id(22)}','${id(12)}','Turma B','Informática','${id(4)}','Pedro','Terça',4),('${id(23)}','${id(11)}','Turma vazia','Informática','${id(2)}','Ana','Quarta',4);insert into public.students(id,unit_id,class_id,name,guardian_phone) values('${id(31)}','${id(11)}','${id(21)}','Aluno Centro',''),('${id(32)}','${id(12)}','${id(22)}','Aluno Vila','');`,
  );
  const as = async (n: number) =>
    db.exec(
      `reset role;select set_config('request.jwt.claim.sub','${id(n)}',false);set role authenticated;`,
    );
  const service = async () => db.exec("reset role;set role service_role;");
  await t.test(
    "primeiro administrador é único e não acessa a escola antes de trocar a senha",
    async () => {
      await service();
      await db.query("select public.bootstrap_admin($1,$2,$3,$4)", [
        id(1),
        "admin",
        "Administrador",
        "Centro",
      ]);
      await assert.rejects(
        db.query("select public.bootstrap_admin($1,$2,$3,$4)", [
          id(6),
          "outro.admin",
          "Outro",
          "Centro",
        ]),
        /Já existe/,
      );
      await as(1);
      assert.equal(
        (await db.query("select * from public.students")).rows.length,
        0,
      );
      assert.equal(
        (await db.query("select * from public.profiles")).rows.length,
        1,
      );
      await assert.rejects(
        db.query("select public.complete_password_change($1)", [id(1)]),
        /permission denied/,
      );
      await service();
      await db.query("select public.complete_password_change($1)", [id(1)]);
      await as(1);
      assert.equal(
        (await db.query("select * from public.students")).rows.length,
        2,
      );
    },
  );
  await t.test(
    "coordenação e professor não criam nem promovem contas diretamente",
    async () => {
      for (const actor of [2, 5]) {
        await as(actor);
        await assert.rejects(
          db.exec(
            `update public.profiles set role='admin' where id='${id(actor)}'`,
          ),
          /permission denied/,
        );
        await assert.rejects(
          db.query("select public.admin_create_profile($1,$2,$3,$4,$5,$6)", [
            id(actor),
            id(6),
            "novo",
            "Novo",
            "admin",
            id(11),
          ]),
          /permission denied/,
        );
      }
    },
  );
  await t.test(
    "admin cria usuário com troca obrigatória e acesso apenas após nova senha",
    async () => {
      await service();
      await db.query("select public.admin_create_profile($1,$2,$3,$4,$5,$6)", [
        id(1),
        id(6),
        "prof.novo",
        "Novo Professor",
        "professor",
        id(11),
      ]);
      await as(6);
      assert.equal(
        (await db.query("select * from public.students")).rows.length,
        0,
      );
      await service();
      await db.query("select public.complete_password_change($1)", [id(6)]);
      await as(6);
      assert.equal(
        (await db.query("select * from public.students")).rows.length,
        1,
      );
    },
  );
  const photo = `${id(11)}/${id(31)}/${id(51)}.webp`;
  await t.test(
    "foto privada respeita aluno, unidade e permite limpeza da foto antiga",
    async () => {
      await as(2);
      await db.query(
        "insert into storage.objects(bucket_id,name) values($1,$2)",
        ["student-photos", photo],
      );
      await db.query("update public.students set photo_path=$1 where id=$2", [
        photo,
        id(31),
      ]);
      assert.equal(
        (await db.query("select * from storage.objects")).rows.length,
        1,
      );
      await assert.rejects(
        db.query("update public.students set photo_path=$1 where id=$2", [
          `${id(11)}/${id(32)}/${id(51)}.webp`,
          id(31),
        ]),
        /check constraint/,
      );
      await as(4);
      assert.equal(
        (await db.query("select * from storage.objects")).rows.length,
        0,
      );
      await assert.rejects(
        db.query("insert into storage.objects(bucket_id,name) values($1,$2)", [
          "student-photos",
          photo,
        ]),
        /row-level security/,
      );
      await as(2);
      await db.query("update public.students set photo_path=null where id=$1", [
        id(31),
      ]);
      await db.exec("delete from storage.objects");
      assert.equal(
        (await db.query("select * from storage.objects")).rows.length,
        0,
      );
    },
  );
  await t.test(
    "desativação bloqueia dados mesmo com sessão previamente emitida",
    async () => {
      await service();
      await db.query("select public.admin_update_profile($1,$2,$3,$4,$5,$6)", [
        id(1),
        id(6),
        "Novo Professor",
        "professor",
        id(11),
        false,
      ]);
      await as(6);
      assert.equal(
        (await db.query("select * from public.students")).rows.length,
        0,
      );
      assert.equal(
        (await db.query("select * from storage.objects")).rows.length,
        0,
      );
    },
  );
  await t.test(
    "não é possível remover o último administrador ativo",
    async () => {
      await service();
      await assert.rejects(
        db.exec(`update public.profiles set active=false where id='${id(1)}'`),
        /Mantenha pelo menos/,
      );
      await assert.rejects(
        db.query("select public.admin_update_profile($1,$2,$3,$4,$5,$6)", [
          id(1),
          id(1),
          "Admin",
          "professor",
          id(11),
          true,
        ]),
        /próprio acesso/,
      );
    },
  );
  await t.test(
    "análise diária consolida dados reais sem duplicar snapshots e só gestores consultam",
    async () => {
      await as(2);
      await db.exec(
        `insert into public.lessons(id,unit_id,class_id,teacher_id,teacher,date,topic,closed) values('${id(41)}','${id(11)}','${id(21)}','${id(2)}','Ana',(timezone('America/Sao_Paulo',now()))::date,'Conteúdo',true);insert into public.attendance(unit_id,lesson_id,student_id,status) values('${id(11)}','${id(41)}','${id(31)}','presente');`,
      );
      await assert.rejects(
        db.exec("select public.run_daily_analytics()"),
        /permission denied/,
      );
      await service();
      await db.exec(
        "select public.run_daily_analytics();select public.run_daily_analytics();",
      );
      await as(1);
      const result = await db.query<{
        active_students: number;
        idle_classes: number;
        present_count: number;
      }>("select * from public.daily_analytics where unit_id=$1", [id(11)]);
      assert.equal(result.rows.length, 1);
      assert.equal(result.rows[0].active_students, 1);
      assert.equal(result.rows[0].idle_classes, 1);
      assert.equal(result.rows[0].present_count, 1);
      assert.equal(
        (await db.query("select * from public.daily_analytics")).rows.length,
        2,
      );
      await as(2);
      assert.equal(
        (await db.query("select * from public.daily_analytics")).rows.length,
        0,
      );
    },
  );
  await db.close();
});
