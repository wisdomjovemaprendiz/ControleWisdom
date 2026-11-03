begin;
-- Validate enrollment/teacher links when they are created or changed. Historical
-- corrections and archiving must remain possible after a student transfer or a
-- teacher's deactivation.
create or replace function public.guard_class() returns trigger language plpgsql security definer set search_path='' as $$ begin
 if TG_OP='INSERT' or new.teacher_id is distinct from old.teacher_id or new.unit_id is distinct from old.unit_id then
 if not exists(select 1 from public.profiles where id=new.teacher_id and unit_id=new.unit_id and role in ('admin','coordenacao','professor') and active and archived_at is null) then raise exception 'Professor deve pertencer à unidade da turma e estar ativo.';end if;end if;
 if TG_OP='UPDATE' and old.unit_id<>new.unit_id then raise exception 'A unidade de uma turma não pode ser alterada.';end if;
 if (select count(*) from public.students where class_id=new.id and status='ativo' and archived_at is null)>new.capacity then raise exception 'Capacidade inferior ao número de alunos ativos.';end if;
 return new;end $$;
create or replace function public.guard_attendance() returns trigger language plpgsql security definer set search_path='' as $$ begin
 if TG_OP='INSERT' or new.student_id is distinct from old.student_id or new.lesson_id is distinct from old.lesson_id or new.unit_id is distinct from old.unit_id then
 if not exists(select 1 from public.students s join public.lessons l on l.class_id=s.class_id and l.unit_id=s.unit_id where s.id=new.student_id and l.id=new.lesson_id) then raise exception 'Aluno não pertence à turma desta aula.';end if;end if;
 return new;end $$;
create or replace function public.guard_pedagogy() returns trigger language plpgsql security definer set search_path='' as $$ begin
 if TG_OP='INSERT' or new.student_id is distinct from old.student_id or new.class_id is distinct from old.class_id or new.unit_id is distinct from old.unit_id then
 if new.student_id is not null and not exists(select 1 from public.students where id=new.student_id and class_id=new.class_id and unit_id=new.unit_id) then raise exception 'Aluno não pertence à turma.';end if;end if;
 return new;end $$;
commit;
