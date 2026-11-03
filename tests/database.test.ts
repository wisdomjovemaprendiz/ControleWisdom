import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
const uid = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
test("migração PostgreSQL e políticas RLS reais", async (t) => {
  const db = new PGlite();
  await db.exec(
    `create role anon; create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`,
  );
  // gen_random_uuid é nativa do PostgreSQL. A extensão pgcrypto não é necessária no motor WASM.
  const schema = readFileSync(
    new URL("../supabase/001_schema.sql", import.meta.url),
    "utf8",
  ).replace("create extension if not exists pgcrypto;", "");
  await db.exec(schema);
  await db.exec(
    `insert into auth.users values('${uid(1)}'),('${uid(2)}'),('${uid(3)}'),('${uid(4)}');insert into public.units(id,name) values('${uid(11)}','Centro'),('${uid(12)}','Vila Nova');insert into public.profiles values('${uid(1)}','Coord','coordenacao','${uid(11)}'),('${uid(2)}','Prof','professor','${uid(11)}'),('${uid(3)}','Secretaria','secretaria','${uid(11)}'),('${uid(4)}','Prof 2','professor','${uid(12)}');insert into public.classes(id,unit_id,name,course,teacher_id,teacher,schedule,capacity) values('${uid(21)}','${uid(11)}','Turma A','Informática','${uid(2)}','Prof','Seg',2),('${uid(22)}','${uid(12)}','Turma B','Informática','${uid(4)}','Prof 2','Ter',20);insert into public.students(id,unit_id,class_id,name,guardian_phone) values('${uid(31)}','${uid(11)}','${uid(21)}','Aluno A','5511999999999'),('${uid(32)}','${uid(12)}','${uid(22)}','Aluno B','5511999999999');`,
  );
  const as = async (n: number) => {
    await db.exec(
      `reset role;select set_config('request.jwt.claim.sub','${uid(n)}',false);set role authenticated;`,
    );
  };
  await t.test(
    "professor vê somente alunos e unidades da própria unidade",
    async () => {
      await as(2);
      assert.equal(
        (await db.query("select * from public.students")).rows.length,
        1,
      );
      assert.equal(
        (await db.query("select * from public.units")).rows.length,
        1,
      );
      await assert.rejects(
        db.exec(
          `insert into public.students(unit_id,class_id,name,guardian_phone) values('${uid(12)}','${uid(22)}','Invasor','5511999999999')`,
        ),
        /row-level security/,
      );
    },
  );
  await t.test(
    "professor não pode promover o próprio perfil nem arquivar aluno",
    async () => {
      await as(2);
      await db.exec(
        `update public.profiles set role='coordenacao' where id='${uid(2)}'`,
      );
      assert.equal(
        (
          await db.query<{ role: string }>(
            `select role from public.profiles where id='${uid(2)}'`,
          )
        ).rows[0].role,
        "professor",
      );
      await assert.rejects(
        db.exec(
          `update public.students set status='abandono',archive_reason='Motivo' where id='${uid(31)}'`,
        ),
        /Arquivamento/,
      );
    },
  );
  await t.test("secretaria arquiva aluno e não vê outra unidade", async () => {
    await as(3);
    assert.equal(
      (
        await db.query(
          `select * from public.students where unit_id='${uid(12)}'`,
        )
      ).rows.length,
      0,
    );
    await db.exec(
      `update public.students set status='conclusao',archive_reason='Curso concluído' where id='${uid(31)}'`,
    );
    assert.equal(
      (
        await db.query<{ status: string }>(
          `select status from public.students where id='${uid(31)}'`,
        )
      ).rows[0].status,
      "conclusao",
    );
    await db.exec(
      `update public.students set status='ativo',archive_reason='' where id='${uid(31)}'`,
    );
  });
  const lesson = {
    id: uid(41),
    unit_id: uid(11),
    class_id: uid(21),
    teacher_id: uid(2),
    teacher: "Prof",
    date: "2026-01-01",
    topic: "Planilhas",
    closed: true,
  };
  const rows = [
    {
      id: uid(51),
      unit_id: uid(11),
      lesson_id: uid(41),
      student_id: uid(31),
      status: "presente",
    },
  ];
  await t.test("chamada grava aula e presença de forma atômica", async () => {
    await as(2);
    await db.query(
      "select public.save_lesson_attendance($1::jsonb,$2::jsonb)",
      [JSON.stringify(lesson), JSON.stringify(rows)],
    );
    assert.equal(
      (await db.query(`select * from public.attendance`)).rows.length,
      1,
    );
  });
  await t.test(
    "chamada com aluno de outra unidade falha sem deixar aula parcial",
    async () => {
      await as(2);
      const invalid = { ...lesson, id: uid(42), date: "2026-01-02" };
      await assert.rejects(
        db.query("select public.save_lesson_attendance($1::jsonb,$2::jsonb)", [
          JSON.stringify(invalid),
          JSON.stringify([
            {
              ...rows[0],
              id: uid(52),
              lesson_id: uid(42),
              student_id: uid(32),
            },
          ]),
        ]),
        /Presença inválida/,
      );
      assert.equal(
        (await db.query(`select * from public.lessons where id='${uid(42)}'`))
          .rows.length,
        0,
      );
    },
  );
  await t.test(
    "coordenação vê as duas unidades e trilha de auditoria",
    async () => {
      await as(1);
      assert.equal(
        (await db.query("select * from public.students")).rows.length,
        2,
      );
      assert.equal(
        (await db.query("select * from public.units")).rows.length,
        2,
      );
      assert.ok(
        (await db.query("select * from public.audit_log")).rows.length >= 3,
      );
    },
  );
  await t.test("limite de vagas é aplicado no banco", async () => {
    await as(3);
    await db.exec(
      `insert into public.students(unit_id,class_id,name,guardian_phone) values('${uid(11)}','${uid(21)}','Aluno C','5511999999999')`,
    );
    await assert.rejects(
      db.exec(
        `insert into public.students(unit_id,class_id,name,guardian_phone) values('${uid(11)}','${uid(21)}','Aluno D','5511999999999')`,
      ),
      /Turma sem vagas/,
    );
  });
  await db.close();
});
