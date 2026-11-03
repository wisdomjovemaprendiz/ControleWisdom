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
    "005_record_management.sql",
    "006_archive_permissions.sql",
    "007_historical_record_edits.sql",
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
  // After replaying older migrations for idempotency, restore the latest guards.
  for (const file of [
    "005_record_management.sql",
    "006_archive_permissions.sql",
    "007_historical_record_edits.sql",
  ])
    await db.exec(
      readFileSync(new URL("../supabase/" + file, import.meta.url), "utf8"),
    );
  await db.exec(
    readFileSync(
      new URL("../supabase/008_pedagogical_support.sql", import.meta.url),
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
  const service = async () =>
    db.exec(
      "reset role;select set_config('request.jwt.claim.sub','',false);set role service_role;",
    );
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
  await t.test(
    "gestão administrativa edita, arquiva, restaura e exclui com vínculos protegidos",
    async () => {
      await service();
      const manage = (
        table: string,
        row: number,
        action: string,
        changes = {},
        reason = "Reorganização",
      ) =>
        db.query("select public.manage_record($1,$2,$3,$4,$5::jsonb,$6)", [
          id(1),
          table,
          id(row),
          action,
          JSON.stringify(changes),
          reason,
        ]);
      await manage("units", 11, "edit", {
        name: "Centro atualizado",
        address: "Rua Nova",
      });
      assert.equal(
        (
          await db.query<{ name: string }>(
            "select name from public.units where id=$1",
            [id(11)],
          )
        ).rows[0].name,
        "Centro atualizado",
      );
      await assert.rejects(
        manage("students", 31, "edit", { unit_id: id(12) }),
        /Campo não permitido/,
      );
      await assert.rejects(manage("profiles", 1, "archive"), /próprio acesso/);
      await assert.rejects(manage("students", 31, "delete"), /vínculos/);
      await manage("classes", 23, "archive");
      assert.ok(
        (
          await db.query<{ archived_at: string }>(
            "select archived_at from public.classes where id=$1",
            [id(23)],
          )
        ).rows[0].archived_at,
      );
      await assert.rejects(
        db.exec(
          `insert into public.students(id,unit_id,class_id,name,guardian_phone) values('${id(90)}','${id(11)}','${id(23)}','Bloqueado','')`,
        ),
        /arquivado/,
      );
      await manage("classes", 23, "restore");
      await manage("classes", 23, "delete");
      assert.equal(
        (await db.query("select id from public.classes where id=$1", [id(23)]))
          .rows.length,
        0,
      );
      await manage("students", 31, "archive");
      assert.equal(
        (
          await db.query<{ status: string }>(
            "select status from public.students where id=$1",
            [id(31)],
          )
        ).rows[0].status,
        "cancelamento",
      );
      await manage("students", 31, "restore");
      await manage("students", 31, "edit", {
        status: "ativo",
        archive_reason: "",
      });
      await as(2);
      await assert.rejects(
        db.query("update public.students set archived_at=now() where id=$1", [
          id(31),
        ]),
        /Apenas administradores/,
      );
      await assert.rejects(
        db.query("select public.manage_record($1,$2,$3,$4)", [
          id(1),
          "units",
          id(11),
          "delete",
        ]),
        /permission denied/,
      );
      await service();
      await assert.rejects(
        db.query("select public.manage_record($1,$2,$3,$4)", [
          id(2),
          "units",
          id(11),
          "delete",
        ]),
        /Apenas administradores/,
      );
      await db.exec("reset role");
      await assert.rejects(
        db.query("delete from auth.users where id=$1", [id(1)]),
        /Mantenha pelo menos/,
      );
    },
  );
  await t.test(
    "ciclo completo de todos os tipos de registro e remoção de usuário sem histórico",
    async () => {
      await service();
      await db.exec(
        `insert into public.contacts(id,unit_id,student_id,author_id,reason,outcome) values('${id(81)}','${id(11)}','${id(31)}','${id(2)}','Contato','Concluído');insert into public.pedagogy(id,unit_id,class_id,student_id,author_id,kind,skill,level,notes) values('${id(82)}','${id(11)}','${id(21)}','${id(31)}','${id(2)}','Evolução','Comunicação',3,'Registro');insert into public.offerings(id,unit_id,name,kind,duration_months,courses) values('${id(83)}','${id(11)}','Curso temporário','individual',2,'Informática');insert into public.lessons(id,unit_id,class_id,teacher_id,teacher,date,topic) values('${id(84)}','${id(12)}','${id(22)}','${id(4)}','Pedro','2026-10-01','Aula temporária');insert into public.attendance(id,unit_id,lesson_id,student_id,status) values('${id(85)}','${id(12)}','${id(84)}','${id(32)}','presente');insert into public.units(id,name) values('${id(86)}','Unidade temporária');`,
      );
      for (const [table, row, changes] of [
        ["attendance", 85, { status: "atrasado" }],
        ["lessons", 84, { topic: "Conteúdo corrigido" }],
        ["contacts", 81, { outcome: "Retorno atualizado" }],
        ["pedagogy", 82, { level: 4, notes: "Evolução corrigida" }],
        ["offerings", 83, { name: "Curso corrigido", duration_months: 3 }],
        ["units", 86, { address: "Endereço corrigido" }],
      ] as const) {
        for (const action of ["edit", "archive", "restore", "delete"])
          await db.query(
            "select public.manage_record($1,$2,$3,$4,$5::jsonb,$6)",
            [
              id(1),
              table,
              id(row),
              action,
              JSON.stringify(changes),
              "Registro temporário",
            ],
          );
        assert.equal(
          (
            await db.query(`select id from public.${table} where id=$1`, [
              id(row),
            ])
          ).rows.length,
          0,
        );
      }
      await db.exec("reset role");
      await db.query("insert into auth.users(id) values($1)", [id(87)]);
      await service();
      await db.query("select public.admin_create_profile($1,$2,$3,$4,$5,$6)", [
        id(1),
        id(87),
        "temporario",
        "Usuário temporário",
        "secretaria",
        id(11),
      ]);
      for (const action of ["edit", "archive", "restore"])
        await db.query(
          "select public.manage_record($1,'profiles',$2,$3,$4::jsonb,'Ajuste')",
          [id(1), id(87), action, JSON.stringify({ name: "Nome corrigido" })],
        );
      await db.exec("reset role");
      await db.query("delete from auth.users where id=$1", [id(87)]);
      assert.equal(
        (await db.query("select id from public.profiles where id=$1", [id(87)]))
          .rows.length,
        0,
      );
      assert.ok(
        (
          await db.query(
            "select id from public.account_events where target_id is null",
          )
        ).rows.length > 0,
      );
    },
  );
  await t.test(
    "históricos continuam editáveis após transferência e desativação do professor",
    async () => {
      await service();
      // Same-unit transfer to a newly created class preserves previous attendance.
      await db.exec(
        `insert into public.classes(id,unit_id,name,course,teacher_id,teacher,schedule,capacity) values('${id(91)}','${id(11)}','Nova turma','Informática','${id(2)}','Ana','Terça',20)`,
      );
      await db.query("update public.students set class_id=$1 where id=$2", [
        id(91),
        id(31),
      ]);
      const mark = (
        await db.query<{ id: string }>(
          "select id from public.attendance where student_id=$1 limit 1",
          [id(31)],
        )
      ).rows[0];
      await db.query(
        "select public.manage_record($1,'attendance',$2,'edit',$3::jsonb)",
        [id(1), mark.id, JSON.stringify({ status: "atrasado" })],
      );
      await db.query(
        "select public.manage_record($1,'attendance',$2,'archive','{}'::jsonb,'Correção histórica')",
        [id(1), mark.id],
      );
      await db.query("update public.profiles set active=false where id=$1", [
        id(2),
      ]);
      await db.query(
        "select public.manage_record($1,'classes',$2,'archive','{}'::jsonb,'Encerramento')",
        [id(1), id(91)],
      );
      assert.ok(
        (
          await db.query<{ archived_at: string }>(
            "select archived_at from public.classes where id=$1",
            [id(91)],
          )
        ).rows[0].archived_at,
      );
    },
  );
  await t.test(
    "registro assistido e evolução preservam origem, permissões e evidências",
    async () => {
      await service();
      await db.query("update public.profiles set active=true where id=$1", [
        id(2),
      ]);
      await db.query("update public.students set class_id=$1 where id=$2", [
        id(21),
        id(31),
      ]);
      await as(2);
      const day = (
        await db.query<{ day: string }>("select current_date::text as day")
      ).rows[0].day;
      const base = {
        id: id(101),
        unit_id: id(11),
        class_id: id(21),
        student_id: id(31),
        author_id: id(2),
        date: day,
        kind: "Intervenção",
        skill: "Organização",
        level: 2,
        notes: "Precisa de três lembretes para concluir a tarefa.",
        intervention: "Lista de etapas com apoio graduado",
        follow_up: day,
        parent_record_id: null,
        support_plan: {
          mode: "assisted",
          observation_scores: { task_planning: 2 },
          strategy_ids: ["plan_checklist"],
          goal: "Concluir com menos lembretes",
          criteria: "Comparar a mesma tarefa",
          sources: ["cast"],
          catalogue_version: "v1",
        },
      };
      const save = (row: object) =>
        db.query("select public.save_pedagogical_record($1::jsonb)", [
          JSON.stringify(row),
        ]);
      await save(base);
      const child = {
        ...base,
        id: id(102),
        kind: "Evolução",
        parent_record_id: id(101),
        follow_up: "",
        support_plan: {
          ...base.support_plan,
          outcome: "progress",
          evidence: "Concluiu com dois lembretes na tarefa comparada.",
        },
      };
      await assert.rejects(
        save({ ...child, id: id(104), student_id: null }),
        /manter a turma/,
      );
      await assert.rejects(
        save({ ...child, id: id(104), support_plan: {} }),
        /resultado observado/,
      );
      await assert.rejects(
        save({ ...child, id: id(104), author_id: id(1) }),
        /Sem permissão/,
      );
      await save(child);
      await assert.rejects(
        save({ ...child, id: id(103) }),
        /unique constraint/,
      );
      assert.equal(
        (
          await db.query<{ parent_record_id: string }>(
            "select parent_record_id from public.pedagogy where id=$1",
            [id(102)],
          )
        ).rows[0].parent_record_id,
        id(101),
      );
      await as(3);
      await assert.rejects(
        save({ ...base, id: id(105), author_id: id(3) }),
        /Sem permissão/,
      );
      await as(4);
      assert.equal(
        (
          await db.query("select id from public.pedagogy where id=$1", [
            id(101),
          ])
        ).rows.length,
        0,
      );
    },
  );
  await t.test(
    "cadastro sem campos e detalhes opcionais de frequência preservam RLS e transação",
    async () => {
      await db.exec("reset role");
      await db.exec(
        readFileSync(
          new URL(
            "../supabase/009_camera_attendance_optional_students.sql",
            import.meta.url,
          ),
          "utf8",
        ),
      );
      await as(2);
      await db.query("insert into public.students(id,unit_id) values($1,$2)", [
        id(110),
        id(11),
      ]);
      const empty = (
        await db.query<{
          name: string;
          class_id: null;
          guardian_phone: string;
        }>(
          "select name,class_id,guardian_phone from public.students where id=$1",
          [id(110)],
        )
      ).rows[0];
      assert.equal(empty.name, "");
      assert.equal(empty.class_id, null);
      assert.equal(empty.guardian_phone, "");
      await assert.rejects(
        db.query("insert into public.students(id,unit_id) values($1,$2)", [
          id(111),
          id(12),
        ]),
        /row-level security/,
      );
      const day = (
        await db.query<{ day: string }>("select current_date::text as day")
      ).rows[0].day;
      const lesson = {
        id: id(112),
        unit_id: id(11),
        class_id: id(21),
        teacher_id: id(2),
        teacher: "Ana",
        date: day,
        topic: "Aula com horários",
        closed: true,
      };
      // Reuse the existing same-day lesson so the attendance transaction updates it.
      const existing = (
        await db.query<{ id: string }>(
          "select id from public.lessons where class_id=$1 and date=$2",
          [id(21), day],
        )
      ).rows[0];
      if (existing) lesson.id = existing.id;
      const students = (
        await db.query<{ id: string }>(
          "select id from public.students where class_id=$1 and status='ativo'",
          [id(21)],
        )
      ).rows;
      const rows = students.map((s, i) => ({
        id: id(113 + i),
        unit_id: id(11),
        lesson_id: lesson.id,
        student_id: s.id,
        status: "atrasado",
        arrival_time: "14:25",
        justification: "",
      }));
      await db.query(
        "select public.save_lesson_attendance($1::jsonb,$2::jsonb)",
        [JSON.stringify(lesson), JSON.stringify(rows)],
      );
      assert.equal(
        (
          await db.query<{ arrival_time: string }>(
            "select arrival_time from public.attendance where lesson_id=$1 and student_id=$2",
            [lesson.id, students[0].id],
          )
        ).rows[0].arrival_time,
        "14:25",
      );
      const justified = rows.map((r) => ({
        ...r,
        status: "justificado",
        arrival_time: "",
        justification: "Consulta médica",
      }));
      await db.query(
        "select public.save_lesson_attendance($1::jsonb,$2::jsonb)",
        [JSON.stringify(lesson), JSON.stringify(justified)],
      );
      const saved = (
        await db.query<{ justification: string; arrival_time: string }>(
          "select justification,arrival_time from public.attendance where lesson_id=$1 and student_id=$2",
          [lesson.id, students[0].id],
        )
      ).rows[0];
      assert.equal(saved.justification, "Consulta médica");
      assert.equal(saved.arrival_time, "");
      await db.query(
        "select public.save_lesson_attendance($1::jsonb,$2::jsonb)",
        [
          JSON.stringify(lesson),
          JSON.stringify(rows.map(({ arrival_time, ...r }) => r)),
        ],
      );
      await assert.rejects(
        db.query("select public.save_lesson_attendance($1::jsonb,$2::jsonb)", [
          JSON.stringify({ ...lesson, topic: "Não deve ser salvo" }),
          JSON.stringify(rows.map((r) => ({ ...r, arrival_time: "29:99" }))),
        ]),
        /arrival_time_check/,
      );
      assert.equal(
        (
          await db.query<{ topic: string }>(
            "select topic from public.lessons where id=$1",
            [lesson.id],
          )
        ).rows[0].topic,
        "Aula com horários",
      );
    },
  );
  await db.close();
});
