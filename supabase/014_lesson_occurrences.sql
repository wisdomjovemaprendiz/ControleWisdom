begin;
create table public.occurrences (
 id uuid primary key default gen_random_uuid(), unit_id uuid not null references public.units(id),
 lesson_id uuid not null references public.lessons(id), student_id uuid references public.students(id),
 codes text[] not null default '{}', notes text not null default '' check(length(notes)<=2000),
 author_id uuid references public.profiles(id), author_name text not null default '',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique nulls not distinct(lesson_id,student_id),
 check(cardinality(codes)>0 or length(trim(notes))>0),
 check(codes <@ array['phone','talk','lateness','interruption','task','materials','respect','conflict','participation','equipment','support','collaboration']::text[])
);
create index occurrences_unit on public.occurrences(unit_id);
create index occurrences_student on public.occurrences(student_id);
alter table public.occurrences enable row level security;
revoke all on public.occurrences from public,anon;
grant select,insert,update,delete on public.occurrences to authenticated,service_role;
create policy occurrences_read on public.occurrences for select to authenticated using (
 public.can_access(unit_id) and (public.current_role() in ('admin','coordenacao','secretaria') or public.current_role()='professor' and exists(select 1 from public.lessons l where l.id=lesson_id and public.can_teach_context(l.class_id,l.student_id)))
);
create policy occurrences_insert on public.occurrences for insert to authenticated with check (
 public.can_access(unit_id) and public.current_role() in ('admin','coordenacao','professor') and exists(select 1 from public.lessons l where l.id=lesson_id and public.can_teach_context(l.class_id,l.student_id))
);
create policy occurrences_update on public.occurrences for update to authenticated using (
 public.can_access(unit_id) and public.current_role() in ('admin','coordenacao','professor') and exists(select 1 from public.lessons l where l.id=lesson_id and public.can_teach_context(l.class_id,l.student_id))
) with check(public.can_access(unit_id));
create policy occurrences_delete on public.occurrences for delete to authenticated using (
 public.can_access(unit_id) and public.current_role() in ('admin','coordenacao','professor') and exists(select 1 from public.lessons l where l.id=lesson_id and public.can_teach_context(l.class_id,l.student_id))
);
create function public.guard_occurrence() returns trigger language plpgsql security definer set search_path='' as $$
declare lesson public.lessons;begin
 select * into lesson from public.lessons where id=new.lesson_id;
 if lesson.id is null or lesson.unit_id<>new.unit_id or lesson.archived_at is not null then raise exception 'Aula ou unidade inválida para a ocorrência.';end if;
 if new.student_id is not null and not exists(select 1 from public.attendance a where a.lesson_id=new.lesson_id and a.student_id=new.student_id and a.unit_id=new.unit_id) then raise exception 'O aluno não pertence à chamada desta ocorrência.';end if;
 if lesson.class_id is null and new.student_id is distinct from lesson.student_id then raise exception 'Vincule a ocorrência ao aluno da aula individual.';end if;
 if TG_OP='UPDATE' then
  if new.lesson_id<>old.lesson_id or new.unit_id<>old.unit_id or new.student_id is distinct from old.student_id then raise exception 'Não altere o vínculo de uma ocorrência.';end if;
  new.author_id:=old.author_id;new.author_name:=old.author_name;new.created_at:=old.created_at;
 else
  new.author_id:=auth.uid();new.author_name:=coalesce((select name from public.profiles where id=auth.uid()),'Sistema');new.created_at:=now();
 end if;
 new.updated_at:=now();return new;
end $$;
create trigger guard_occurrence before insert or update on public.occurrences for each row execute function public.guard_occurrence();
create function public.audit_occurrence() returns trigger language plpgsql security definer set search_path='' as $$
declare row_data jsonb:=coalesce(to_jsonb(new),to_jsonb(old));begin
 insert into public.audit_log(actor_id,actor_name,unit_id,entity,entity_id,operation,before_data,after_data)
 values(auth.uid(),coalesce((select name from public.profiles where id=auth.uid()),'Sistema'),(row_data->>'unit_id')::uuid,'occurrences',(row_data->>'id')::uuid,TG_OP,case when TG_OP<>'INSERT' then to_jsonb(old) end,case when TG_OP<>'DELETE' then to_jsonb(new) end);
 return coalesce(new,old);
end $$;
create trigger audit_occurrence after insert or update or delete on public.occurrences for each row execute function public.audit_occurrence();
revoke all on function public.guard_occurrence() from public,anon,authenticated;
revoke all on function public.audit_occurrence() from public,anon,authenticated;
create or replace function public.save_lesson_attendance(lesson_data jsonb,attendance_data jsonb) returns void language plpgsql security invoker set search_path='' as $$
declare l public.lessons; row public.attendance; total integer; occurrence jsonb; occurrence_ids uuid[] := array[]::uuid[];
begin
 l:=jsonb_populate_record(null::public.lessons,lesson_data);
 if not public.can_teach_context(l.class_id,l.student_id) or not public.can_access(l.unit_id) or l.teacher_id<>auth.uid() then raise exception 'Sem permissão para esta chamada.';end if;
 if l.student_id is not null and l.duration_minutes is null then raise exception 'Informe a duração da aula individual.';end if;
 if exists(select 1 from public.lessons x where x.id=l.id and (x.class_id is distinct from l.class_id or x.student_id is distinct from l.student_id or x.unit_id<>l.unit_id or x.date<>l.date)) then raise exception 'Não altere o vínculo de uma aula existente.';end if;
 if l.date>current_date then raise exception 'Data futura não permitida.';end if;
 select count(*) into total from public.students where ((l.class_id is not null and class_id=l.class_id) or (l.class_id is null and id=l.student_id and enrollment_mode='individual')) and unit_id=l.unit_id and archived_at is null and status='ativo';
 if total=0 or jsonb_array_length(attendance_data)<>total then raise exception 'Marque todos os alunos ativos.';end if;
 if (select count(distinct x.student_id) from jsonb_populate_recordset(null::public.attendance,attendance_data) x)<>total then raise exception 'Alunos duplicados.';end if;
 insert into public.lessons select l.* on conflict(id) do update set topic=excluded.topic,teacher=excluded.teacher,teacher_id=excluded.teacher_id,closed=excluded.closed,duration_minutes=excluded.duration_minutes;
 for row in select * from jsonb_populate_recordset(null::public.attendance,attendance_data) loop
 if row.lesson_id<>l.id or row.unit_id<>l.unit_id or not exists(select 1 from public.students s where s.id=row.student_id and ((l.class_id is not null and s.class_id=l.class_id) or (l.class_id is null and s.id=l.student_id and s.enrollment_mode='individual')) and s.unit_id=l.unit_id and s.archived_at is null and s.status='ativo') then raise exception 'Presença inválida.';end if;
 insert into public.attendance(id,unit_id,lesson_id,student_id,status,arrival_time,justification) values(row.id,row.unit_id,row.lesson_id,row.student_id,row.status,coalesce(row.arrival_time,''),coalesce(row.justification,'')) on conflict(lesson_id,student_id) do update set status=excluded.status,arrival_time=excluded.arrival_time,justification=excluded.justification;
 end loop;
 if lesson_data ? 'occurrences' then
  if jsonb_typeof(lesson_data->'occurrences') <> 'array' or jsonb_array_length(lesson_data->'occurrences')>501 then raise exception 'Ocorrências inválidas.';end if;
  for occurrence in select * from jsonb_array_elements(lesson_data->'occurrences') loop
   if (occurrence->>'id')::uuid=any(occurrence_ids) then raise exception 'Ocorrência duplicada.';end if;
   if exists(select 1 from public.occurrences o where o.id=(occurrence->>'id')::uuid and (o.lesson_id<>l.id or o.student_id is distinct from nullif(occurrence->>'student_id','')::uuid)) then raise exception 'Não altere o vínculo de uma ocorrência.';end if;
   occurrence_ids:=array_append(occurrence_ids,(occurrence->>'id')::uuid);
   insert into public.occurrences(id,unit_id,lesson_id,student_id,codes,notes,author_id,author_name)
   values((occurrence->>'id')::uuid,l.unit_id,l.id,nullif(occurrence->>'student_id','')::uuid,array(select jsonb_array_elements_text(occurrence->'codes')),coalesce(occurrence->>'notes',''),auth.uid(),(select name from public.profiles where id=auth.uid()))
   on conflict(id) do update set codes=excluded.codes,notes=excluded.notes;
  end loop;
  delete from public.occurrences where lesson_id=l.id and not(id=any(occurrence_ids));
 end if;
end $$;
notify pgrst,'reload schema';
commit;
