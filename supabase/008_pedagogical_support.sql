begin;
alter table public.pedagogy add column if not exists parent_record_id uuid;
alter table public.pedagogy add column if not exists created_at timestamptz not null default now();
alter table public.pedagogy add column if not exists support_plan jsonb not null default '{}'::jsonb;
alter table public.pedagogy add constraint pedagogy_id_unit_unique unique(id,unit_id);
alter table public.pedagogy add constraint pedagogy_parent_fk foreign key(parent_record_id,unit_id) references public.pedagogy(id,unit_id);
alter table public.pedagogy add constraint pedagogy_not_own_parent check(parent_record_id is null or parent_record_id<>id);
alter table public.pedagogy add constraint pedagogy_support_object check(jsonb_typeof(support_plan)='object' and octet_length(support_plan::text)<=24000);
create unique index pedagogy_one_active_followup on public.pedagogy(parent_record_id) where parent_record_id is not null and archived_at is null;
create index pedagogy_followup_due on public.pedagogy(follow_up) where follow_up<>'' and archived_at is null;
create or replace function public.guard_pedagogy() returns trigger language plpgsql security definer set search_path='' as $$ declare parent public.pedagogy;begin
 if TG_OP='INSERT' then new.created_at:=clock_timestamp();end if;
 if new.parent_record_id is not null then
  select * into parent from public.pedagogy where id=new.parent_record_id for update;
  if parent.id is null or parent.archived_at is not null or parent.unit_id<>new.unit_id or parent.class_id<>new.class_id or parent.student_id is distinct from new.student_id then raise exception 'A evolução deve manter a turma, aluno e unidade do registro de origem.';end if;
  if parent.follow_up='' or new.kind<>'Evolução' or new.date<parent.date then raise exception 'Vincule a evolução a um acompanhamento agendado e confira a data.';end if;
  if coalesce(new.support_plan->>'outcome','') not in ('not_assessed','progress','achieved','unchanged','review') or length(trim(coalesce(new.support_plan->>'evidence','')))<3 then raise exception 'Informe o resultado observado e as evidências da evolução.';end if;
 elsif TG_OP='INSERT' or new.student_id is distinct from old.student_id or new.class_id is distinct from old.class_id or new.unit_id is distinct from old.unit_id then
  if new.student_id is not null and not exists(select 1 from public.students where id=new.student_id and class_id=new.class_id and unit_id=new.unit_id) then raise exception 'Aluno não pertence à turma.';end if;
 end if;
 if TG_OP='INSERT' and (new.date>current_date or length(trim(new.skill))<2 or length(trim(new.notes))<3) then raise exception 'Confira a data, habilidade e observações do registro.';end if;
 if new.follow_up<>'' and new.follow_up::date<new.date then raise exception 'O acompanhamento não pode ser anterior ao registro.';end if;
 return new;
end $$;
create or replace function public.save_pedagogical_record(record_data jsonb) returns public.pedagogy language plpgsql security invoker set search_path='' as $$ declare row public.pedagogy;result public.pedagogy;begin
 row:=jsonb_populate_record(null::public.pedagogy,record_data);
 if row.author_id<>auth.uid() or not public.can_access(row.unit_id) or not public.can_teach(row.class_id) then raise exception 'Sem permissão para este registro pedagógico.';end if;
 insert into public.pedagogy(id,unit_id,class_id,student_id,author_id,date,kind,skill,level,notes,intervention,follow_up,parent_record_id,support_plan)
 values(row.id,row.unit_id,row.class_id,row.student_id,row.author_id,row.date,row.kind,row.skill,row.level,row.notes,coalesce(row.intervention,''),coalesce(row.follow_up,''),row.parent_record_id,coalesce(row.support_plan,'{}'::jsonb)) returning * into result;
 return result;end $$;
revoke all on function public.save_pedagogical_record(jsonb) from public,anon;
grant execute on function public.save_pedagogical_record(jsonb) to authenticated;
notify pgrst, 'reload schema';
commit;
