begin;
-- Individual enrollment is a student relationship, never a synthetic class.
alter table public.students add column enrollment_mode text not null default 'class' check(enrollment_mode in ('class','individual'));
alter table public.students add column individual_hours numeric check(individual_hours between 0.5 and 10000);
alter table public.students add column individual_days integer[] not null default '{}' check(individual_days <@ array[0,1,2,3,4,5,6]);
alter table public.students add column individual_duration_minutes integer check(individual_duration_minutes between 5 and 480);
alter table public.students add column individual_teacher_id uuid references public.profiles(id);
alter table public.students add column offboarding jsonb not null default '{}' check(jsonb_typeof(offboarding)='object' and octet_length(offboarding::text)<24000);
alter table public.students add constraint individual_without_class check(enrollment_mode<>'individual' or class_id is null);
alter table public.lessons alter column class_id drop not null;
alter table public.lessons add column student_id uuid;
alter table public.lessons add column duration_minutes integer check(duration_minutes between 5 and 480);
alter table public.lessons add constraint lesson_individual_student_fk foreign key(student_id,unit_id) references public.students(id,unit_id);
alter table public.lessons add constraint lesson_exactly_one_group check((class_id is null)<>(student_id is null));
alter table public.lessons add constraint lesson_individual_duration_required check(student_id is null or duration_minutes is not null);
create unique index lessons_individual_day on public.lessons(student_id,date) where student_id is not null;
alter table public.pedagogy alter column class_id drop not null;
alter table public.pedagogy add constraint pedagogy_group_or_student check(class_id is not null or student_id is not null);
create function public.can_teach_context(p_class uuid,p_student uuid) returns boolean language sql stable security definer set search_path='' as $$
 select case when p_class is not null then public.can_teach(p_class) else exists(select 1 from public.students s where s.id=p_student and s.enrollment_mode='individual' and public.can_access(s.unit_id) and (public.current_role() in ('admin','coordenacao') or (public.current_role()='professor' and (s.individual_teacher_id is null or s.individual_teacher_id=auth.uid())))) end
$$;
revoke all on function public.can_teach_context(uuid,uuid) from public;
grant execute on function public.can_teach_context(uuid,uuid) to authenticated;
drop policy lesson_insert on public.lessons;drop policy lesson_update on public.lessons;
create policy lesson_insert on public.lessons for insert to authenticated with check(public.can_access(unit_id) and public.can_teach_context(class_id,student_id) and teacher_id=auth.uid());
create policy lesson_update on public.lessons for update to authenticated using(public.can_access(unit_id) and public.can_teach_context(class_id,student_id)) with check(public.can_access(unit_id) and public.can_teach_context(class_id,student_id) and teacher_id=auth.uid());
drop policy attendance_insert on public.attendance;drop policy attendance_update on public.attendance;
create policy attendance_insert on public.attendance for insert to authenticated with check(public.can_access(unit_id) and exists(select 1 from public.lessons l where l.id=lesson_id and public.can_teach_context(l.class_id,l.student_id)));
create policy attendance_update on public.attendance for update to authenticated using(public.can_access(unit_id) and exists(select 1 from public.lessons l where l.id=lesson_id and public.can_teach_context(l.class_id,l.student_id))) with check(public.can_access(unit_id) and exists(select 1 from public.lessons l where l.id=lesson_id and public.can_teach_context(l.class_id,l.student_id)));
drop policy pedagogy_insert on public.pedagogy;
create policy pedagogy_insert on public.pedagogy for insert to authenticated with check(public.can_access(unit_id) and public.can_teach_context(class_id,student_id) and author_id=auth.uid());
create or replace function public.guard_attendance() returns trigger language plpgsql security definer set search_path='' as $$ begin
 new.arrival_time:=case when new.status='atrasado' then coalesce(new.arrival_time,'') else '' end;
 new.justification:=case when new.status='justificado' then trim(coalesce(new.justification,'')) else '' end;
 if TG_OP='INSERT' or new.student_id is distinct from old.student_id or new.lesson_id is distinct from old.lesson_id or new.unit_id is distinct from old.unit_id then
 if not exists(select 1 from public.students s join public.lessons l on ((l.class_id=s.class_id and l.student_id is null) or (l.class_id is null and l.student_id=s.id)) and l.unit_id=s.unit_id where s.id=new.student_id and l.id=new.lesson_id) then raise exception 'Aluno não pertence à turma desta aula.';end if;end if;
 return new;end $$;
create or replace function public.save_lesson_attendance(lesson_data jsonb,attendance_data jsonb) returns void language plpgsql security invoker set search_path='' as $$
declare l public.lessons; row public.attendance; total integer;
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
end $$;
create or replace function public.guard_pedagogy() returns trigger language plpgsql security definer set search_path='' as $$ declare parent public.pedagogy;begin
 if TG_OP='INSERT' then new.created_at:=clock_timestamp();end if;
 if new.parent_record_id is not null then
  select * into parent from public.pedagogy where id=new.parent_record_id for update;
  if parent.id is null or parent.archived_at is not null or parent.unit_id<>new.unit_id or parent.class_id is distinct from new.class_id or parent.student_id is distinct from new.student_id then raise exception 'A evolução deve manter a turma, aluno e unidade do registro de origem.';end if;
  if parent.follow_up='' or new.kind<>'Evolução' or new.date<parent.date then raise exception 'Vincule a evolução a um acompanhamento agendado e confira a data.';end if;
  if coalesce(new.support_plan->>'outcome','') not in ('not_assessed','progress','achieved','unchanged','review') or length(trim(coalesce(new.support_plan->>'evidence','')))<3 then raise exception 'Informe o resultado observado e as evidências da evolução.';end if;
 elsif TG_OP='INSERT' or new.student_id is distinct from old.student_id or new.class_id is distinct from old.class_id or new.unit_id is distinct from old.unit_id then
  if new.student_id is not null and not exists(select 1 from public.students where id=new.student_id and ((new.class_id is not null and class_id=new.class_id) or (new.class_id is null and enrollment_mode='individual')) and unit_id=new.unit_id) then raise exception 'Aluno não pertence à turma.';end if;
 end if;
 if TG_OP='INSERT' and (new.date>current_date or length(trim(new.skill))<2 or length(trim(new.notes))<3) then raise exception 'Confira a data, habilidade e observações do registro.';end if;
 if new.follow_up<>'' and new.follow_up::date<new.date then raise exception 'O acompanhamento não pode ser anterior ao registro.';end if;
 return new;
end $$;
create or replace function public.save_pedagogical_record(record_data jsonb) returns public.pedagogy language plpgsql security invoker set search_path='' as $$ declare row public.pedagogy;result public.pedagogy;begin
 row:=jsonb_populate_record(null::public.pedagogy,record_data);
 if row.author_id<>auth.uid() or not public.can_access(row.unit_id) or not public.can_teach_context(row.class_id,row.student_id) then raise exception 'Sem permissão para este registro pedagógico.';end if;
 insert into public.pedagogy(id,unit_id,class_id,student_id,author_id,date,kind,skill,level,notes,intervention,follow_up,parent_record_id,support_plan)
 values(row.id,row.unit_id,row.class_id,row.student_id,row.author_id,row.date,row.kind,row.skill,row.level,row.notes,coalesce(row.intervention,''),coalesce(row.follow_up,''),row.parent_record_id,coalesce(row.support_plan,'{}'::jsonb)) returning * into result;
 return result;end $$;

create table public.offboarding_steps(id uuid primary key default gen_random_uuid(),label text not null check(length(trim(label)) between 3 and 180),position integer not null default 0,active boolean not null default true);
insert into public.offboarding_steps(label,position) values('Retirou o aluno do grupo de WhatsApp da turma?',0);
alter table public.offboarding_steps enable row level security;
grant select,insert,update on public.offboarding_steps to authenticated,service_role;
create policy offboarding_read on public.offboarding_steps for select to authenticated using(public.current_role() is not null);
create policy offboarding_insert on public.offboarding_steps for insert to authenticated with check(public.current_role() in ('admin','coordenacao'));
create policy offboarding_update on public.offboarding_steps for update to authenticated using(public.current_role() in ('admin','coordenacao')) with check(public.current_role() in ('admin','coordenacao'));
create function public.guard_student_lifecycle() returns trigger language plpgsql security definer set search_path='' as $$
declare actor uuid:=coalesce(auth.uid(),nullif(current_setting('wisdom.management_actor',true),'')::uuid); snapshot jsonb;begin
 if new.individual_teacher_id is not null and (TG_OP='INSERT' or new.individual_teacher_id is distinct from old.individual_teacher_id) and not exists(select 1 from public.profiles where id=new.individual_teacher_id and unit_id=new.unit_id and active and archived_at is null and role in ('admin','coordenacao','professor')) then raise exception 'O professor deve estar ativo e pertencer à unidade do aluno.';end if;
 if TG_OP='UPDATE' and ((old.status='ativo' and new.status<>'ativo') or (old.archived_at is null and new.archived_at is not null)) then
  if not exists(select 1 from public.profiles where id=actor and active and not must_change_password and role in ('admin','coordenacao','secretaria')) then raise exception 'Sem permissão para desligar o aluno.';end if;
  -- Lock the template against edits while recording the completed snapshot.
  lock table public.offboarding_steps in share mode;
  if not exists(select 1 from public.offboarding_steps where active) then raise exception 'Configure ao menos uma etapa de desligamento.';end if;
  if exists(select 1 from public.offboarding_steps step where active and not exists(select 1 from jsonb_array_elements(coalesce(new.offboarding->'steps','[]')) x where x->>'id'=step.id::text and x->>'completed'='true')) then raise exception 'Conclua todas as etapas do checklist de desligamento.';end if;
  select jsonb_agg(jsonb_build_object('id',step.id,'label',step.label,'completed',true) order by position,id) into snapshot from public.offboarding_steps step where active;
  new.offboarding:=jsonb_build_object('steps',snapshot,'completed_by',actor,'completed_by_name',(select name from public.profiles where id=actor),'completed_at',clock_timestamp());
 elsif TG_OP='UPDATE' then new.offboarding:=old.offboarding;
 else new.offboarding:='{}';if new.status<>'ativo' then raise exception 'Cadastre o aluno ativo antes de iniciar o desligamento.';end if;end if;
 return new;
end $$;
create trigger guard_student_lifecycle before insert or update on public.students for each row execute function public.guard_student_lifecycle();
-- Preserve actor names even if a user is later deleted. Never store passwords or keys.
alter table public.audit_log add column actor_name text not null default '';
alter table public.audit_log add column before_data jsonb;
alter table public.audit_log add column after_data jsonb;
create or replace function public.record_audit() returns trigger language plpgsql security definer set search_path='' as $$
declare actor uuid:=coalesce(auth.uid(),nullif(current_setting('wisdom.management_actor',true),'')::uuid);before_row jsonb;after_row jsonb;target jsonb;keys text[]:=array['name','class_id','student_id','unit_id','status','archived_at','archive_reason','enrollment_mode','individual_teacher_id','individual_hours','individual_days','individual_duration_minutes','offboarding','role','active','must_change_password','label','position','teacher_id','teacher','course','schedule','capacity','date','topic','closed','arrival_time','justification','kind','skill','level','notes','intervention','follow_up','reason','outcome','next_contact'];before_safe jsonb;after_safe jsonb;begin
 if TG_OP<>'INSERT' then before_row:=to_jsonb(old);end if;if TG_OP<>'DELETE' then after_row:=to_jsonb(new);end if;
 target:=coalesce(after_row,before_row);
 select jsonb_object_agg(key,value) into before_safe from jsonb_each(before_row) where key=any(keys);
 select jsonb_object_agg(key,value) into after_safe from jsonb_each(after_row) where key=any(keys);
 insert into public.audit_log(actor_id,actor_name,unit_id,entity,entity_id,operation,before_data,after_data) values(actor,coalesce((select name from public.profiles where id=actor),'Sistema'),(target->>'unit_id')::uuid,TG_TABLE_NAME,(target->>'id')::uuid,TG_OP,before_safe,after_safe);
 return coalesce(new,old);
end $$;
do $$declare tbl text;begin
 foreach tbl in array array['students','classes','lessons','attendance','pedagogy','contacts','units','offerings','profiles','offboarding_steps'] loop
 execute format('drop trigger if exists audit_%I on public.%I',tbl,tbl);
 execute format('create trigger audit_%I after insert or update or delete on public.%I for each row execute function public.record_audit()',tbl,tbl);
 end loop;end $$;
-- Service-only management stamps the verified caller inside the transaction.
create or replace function public.manage_record(p_actor uuid,p_table text,p_id uuid,p_action text,p_changes jsonb default '{}'::jsonb,p_reason text default '') returns jsonb language plpgsql security definer set search_path='' as $$
declare existing jsonb;result jsonb;allowed text[];col text;assignments text:='';row_unit uuid;begin
 perform set_config('wisdom.management_actor',p_actor::text,true);
 if not exists(select 1 from public.profiles where id=p_actor and role='admin' and active and not must_change_password) then raise exception 'Apenas administradores podem gerenciar todos os registros.';end if;
 if p_table not in ('units','profiles','offerings','classes','students','lessons','attendance','pedagogy','contacts') or p_action not in ('edit','archive','restore','delete') then raise exception 'Operação inválida.';end if;
 execute format('select to_jsonb(r) from public.%I r where id=$1 for update',p_table) into existing using p_id;
 if existing is null then raise exception 'Registro não encontrado. Atualize a lista.';end if;
 if p_table='profiles' and p_id=p_actor and (p_action<>'edit' or coalesce(p_changes->>'role','admin')<>'admin' or coalesce(p_changes->>'active','true')<>'true') then raise exception 'Você não pode excluir, arquivar ou remover o próprio acesso administrativo.';end if;
 if p_action='delete' and p_table='profiles' then raise exception 'Exclusão de usuário deve utilizar a API de contas.';end if;
 row_unit:=case when p_table='units' then p_id else (existing->>'unit_id')::uuid end;
 if p_action='edit' then
 allowed:=case p_table
 when 'units' then array['name','address']
 when 'profiles' then array['name','role','unit_id','active']
 when 'offerings' then array['name','kind','duration_months','courses']
 when 'classes' then array['name','course','teacher_id','schedule','capacity','whatsapp']
 when 'students' then array['name','birth_date','class_id','offering_id','phone','guardian','guardian_phone','email','address','enrollment_date','status','archive_reason','enrollment_mode','individual_hours','individual_days','individual_duration_minutes','individual_teacher_id','offboarding']
 when 'lessons' then array['topic','date']
 when 'attendance' then array['status','arrival_time','justification']
 when 'pedagogy' then array['date','kind','skill','level','notes','intervention','follow_up']
 when 'contacts' then array['date','reason','outcome','next_contact'] end;
 if p_table<>'students' and p_changes ? 'name' and length(trim(p_changes->>'name'))<2 then raise exception 'Informe um nome com pelo menos dois caracteres.';end if;
 if jsonb_typeof(p_changes)<>'object' or p_changes='{}'::jsonb then raise exception 'Informe as alterações.';end if;
 for col in select jsonb_object_keys(p_changes) loop
 if not col=any(allowed) then raise exception 'Campo não permitido: %',col;end if;
 if assignments<>'' then assignments:=assignments||',';end if;
 assignments:=assignments||format('%I=(jsonb_populate_record(null::public.%I,$2)).%I',col,p_table,col);
 end loop;
 if p_table='classes' and p_changes ? 'teacher_id' then p_changes:=p_changes||jsonb_build_object('teacher',(select name from public.profiles where id=(p_changes->>'teacher_id')::uuid));assignments:=assignments||',teacher=(jsonb_populate_record(null::public.classes,$2)).teacher';end if;
 execute format('update public.%I set %s where id=$1 returning to_jsonb(%I.*)',p_table,assignments,p_table) into result using p_id,p_changes;
 elsif p_action='delete' then
 begin
 if p_table='units' then delete from public.daily_analytics where unit_id=p_id;end if;
 execute format('delete from public.%I where id=$1',p_table) using p_id;
 exception when foreign_key_violation then raise exception 'Este registro possui vínculos ou histórico. Transfira ou exclua os vínculos primeiro, ou arquive para preservar o histórico.';end;
 result:=existing;
 elsif p_action='archive' then
 if length(trim(p_reason))<3 then raise exception 'Informe o motivo do arquivamento.';end if;
 if p_table='profiles' then execute 'update public.profiles set archived_at=now(),record_archive_reason=$2,active=false where id=$1' using p_id,p_reason;
 elsif p_table='students' then execute 'update public.students set archived_at=now(),record_archive_reason=$2,offboarding=$3,status=case when status=''ativo'' then ''cancelamento'' else status end,archive_reason=case when archive_reason='''' then $2 else archive_reason end where id=$1' using p_id,p_reason,coalesce(p_changes->'offboarding','{}'::jsonb);
 else execute format('update public.%I set archived_at=now(),record_archive_reason=$2 where id=$1',p_table) using p_id,p_reason;end if;
 result:=existing;
 else
 -- Parent links must be active when restoring dependent records.
 if p_table<>'units' and exists(select 1 from public.units where id=row_unit and archived_at is not null) then raise exception 'Restaure a unidade antes deste registro.';end if;
 if existing ? 'class_id' and exists(select 1 from public.classes where id=(existing->>'class_id')::uuid and archived_at is not null) then raise exception 'Restaure a turma antes deste registro.';end if;
 if existing ? 'student_id' and exists(select 1 from public.students where id=(existing->>'student_id')::uuid and archived_at is not null) then raise exception 'Restaure o aluno antes deste registro.';end if;
 if existing ? 'lesson_id' and exists(select 1 from public.lessons where id=(existing->>'lesson_id')::uuid and archived_at is not null) then raise exception 'Restaure a aula antes deste registro.';end if;
 if p_table='profiles' then execute 'update public.profiles set archived_at=null,record_archive_reason='''',active=true where id=$1' using p_id;
 else execute format('update public.%I set archived_at=null,record_archive_reason=%L where id=$1',p_table,'') using p_id;end if;
 result:=existing;
 end if;
 return result;
end $$;
create or replace function public.run_daily_analytics() returns jsonb language plpgsql security definer set search_path='' as $$ declare target_date date:=(timezone('America/Sao_Paulo',now()))::date;processed integer;begin
 insert into public.daily_analytics(unit_id,snapshot_date,active_students,new_enrollments,archived_students,total_classes,idle_classes,present_count,absent_count,late_count,incomplete_registrations,computed_at)
 select u.id,target_date,
 (select count(*) from public.students s where s.archived_at is null and s.unit_id=u.id and s.status='ativo'),
 (select count(*) from public.students s where s.archived_at is null and s.unit_id=u.id and s.enrollment_date=target_date),
 (select count(*) from public.students s where s.archived_at is null and s.unit_id=u.id and s.status<>'ativo'),
 (select count(*) from public.classes c where c.archived_at is null and c.unit_id=u.id),
 (select count(*) from public.classes c where c.archived_at is null and c.unit_id=u.id and not exists(select 1 from public.students s where s.archived_at is null and s.class_id=c.id and s.status='ativo')),
 (select count(*) from public.attendance a join public.lessons l on l.id=a.lesson_id where a.archived_at is null and l.archived_at is null and l.unit_id=u.id and l.date=target_date and a.status='presente'),
 (select count(*) from public.attendance a join public.lessons l on l.id=a.lesson_id where a.archived_at is null and l.archived_at is null and l.unit_id=u.id and l.date=target_date and a.status='falta'),
 (select count(*) from public.attendance a join public.lessons l on l.id=a.lesson_id where a.archived_at is null and l.archived_at is null and l.unit_id=u.id and l.date=target_date and a.status='atrasado'),
 (select count(*) from public.students s where s.archived_at is null and s.unit_id=u.id and s.status='ativo' and (s.registration_stage<>'complete' or trim(s.name)='' or (s.class_id is null and s.enrollment_mode<>'individual') or s.guardian='' or s.guardian_phone='' or s.birth_date='' or s.address='')),now()
 from public.units u where u.archived_at is null
 on conflict(unit_id,snapshot_date) do update set active_students=excluded.active_students,new_enrollments=excluded.new_enrollments,archived_students=excluded.archived_students,total_classes=excluded.total_classes,idle_classes=excluded.idle_classes,present_count=excluded.present_count,absent_count=excluded.absent_count,late_count=excluded.late_count,incomplete_registrations=excluded.incomplete_registrations,computed_at=excluded.computed_at;
 get diagnostics processed=row_count;return jsonb_build_object('snapshot_date',target_date,'units_processed',processed,'completed_at',now());end $$;
create or replace function public.admin_create_profile(p_actor uuid,p_id uuid,p_username text,p_name text,p_role text,p_unit uuid) returns public.profiles language plpgsql security definer set search_path='' as $$ declare result public.profiles;begin
 perform set_config('wisdom.management_actor',p_actor::text,true);
 if not exists(select 1 from public.profiles where id=p_actor and role='admin' and active and not must_change_password) then raise exception 'Apenas administradores podem criar contas.';end if;
 insert into public.profiles(id,username,name,role,unit_id,active,must_change_password) values(p_id,p_username,p_name,p_role,p_unit,true,true) returning * into result;
 insert into public.account_events(actor_id,target_id,action) values(p_actor,p_id,'account_created');return result;end $$;
create or replace function public.admin_update_profile(p_actor uuid,p_id uuid,p_name text,p_role text,p_unit uuid,p_active boolean) returns public.profiles language plpgsql security definer set search_path='' as $$ declare result public.profiles;begin
 perform set_config('wisdom.management_actor',p_actor::text,true);
 if not exists(select 1 from public.profiles where id=p_actor and role='admin' and active and not must_change_password) then raise exception 'Apenas administradores podem alterar contas.';end if;
 if p_actor=p_id and (p_role<>'admin' or not p_active) then raise exception 'Você não pode desativar ou remover o seu próprio acesso administrativo.';end if;
 update public.profiles set name=p_name,role=p_role,unit_id=p_unit,active=p_active where id=p_id returning * into result;if result.id is null then raise exception 'Conta não encontrada.';end if;
 insert into public.account_events(actor_id,target_id,action) values(p_actor,p_id,'account_updated');return result;end $$;
create or replace function public.admin_require_password_change(p_actor uuid,p_id uuid) returns void language plpgsql security definer set search_path='' as $$ begin
 perform set_config('wisdom.management_actor',p_actor::text,true);
 if not exists(select 1 from public.profiles where id=p_actor and role='admin' and active and not must_change_password) then raise exception 'Apenas administradores podem redefinir senhas.';end if;
 update public.profiles set must_change_password=true where id=p_id;if not found then raise exception 'Conta não encontrada.';end if;
 insert into public.account_events(actor_id,target_id,action) values(p_actor,p_id,'password_reset_required');end $$;
create or replace function public.complete_password_change(p_id uuid) returns void language plpgsql security definer set search_path='' as $$ begin
 perform set_config('wisdom.management_actor',p_id::text,true);
 update public.profiles set must_change_password=false where id=p_id and active;if not found then raise exception 'Conta indisponível.';end if;
 insert into public.account_events(actor_id,target_id,action) values(p_id,p_id,'password_changed');end $$;
notify pgrst,'reload schema';
commit;
