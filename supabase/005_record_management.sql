begin;
do $$ declare tbl text;begin
 foreach tbl in array array['units','profiles','offerings','classes','students','lessons','attendance','pedagogy','contacts'] loop
 execute format('alter table public.%I add column if not exists archived_at timestamptz, add column if not exists record_archive_reason text default %L',tbl,'');
 end loop;
end $$;
grant select,insert,update,delete on public.units,public.profiles,public.offerings,public.classes,public.students,public.lessons,public.attendance,public.pedagogy,public.contacts to service_role;
create or replace function public.current_role() returns text language sql stable security definer set search_path='' as $$ select role from public.profiles where id=auth.uid() and active and not must_change_password and archived_at is null $$;
create or replace function public.current_unit() returns uuid language sql stable security definer set search_path='' as $$ select unit_id from public.profiles where id=auth.uid() and active and not must_change_password and archived_at is null $$;
-- Deleting an unused Auth account removes its profile. Historical authorship
-- references still prevent deletion; archiving is always available instead.
alter table public.profiles drop constraint profiles_id_fkey;
alter table public.profiles add constraint profiles_id_fkey foreign key(id) references auth.users(id) on delete cascade;
alter table public.account_events alter column target_id drop not null;
alter table public.account_events drop constraint account_events_actor_id_fkey;
alter table public.account_events add constraint account_events_actor_id_fkey foreign key(actor_id) references auth.users(id) on delete set null;
alter table public.account_events drop constraint account_events_target_id_fkey;
alter table public.account_events add constraint account_events_target_id_fkey foreign key(target_id) references auth.users(id) on delete set null;
alter table public.audit_log drop constraint audit_log_actor_id_fkey;
alter table public.audit_log add constraint audit_log_actor_id_fkey foreign key(actor_id) references auth.users(id) on delete set null;
create or replace function public.guard_profile_delete() returns trigger language plpgsql security definer set search_path='' as $$ begin
 if old.role='admin' and old.active then perform pg_advisory_xact_lock(174110);if not exists(select 1 from public.profiles where id<>old.id and role='admin' and active) then raise exception 'Mantenha pelo menos um administrador ativo.';end if;end if;return old;
end $$;
drop trigger if exists guard_profile_delete on public.profiles;
create trigger guard_profile_delete before delete on public.profiles for each row execute function public.guard_profile_delete();
create or replace function public.guard_record_parents() returns trigger language plpgsql security definer set search_path='' as $$ declare row_data jsonb:=to_jsonb(new);old_data jsonb;parent record;is_archived boolean;begin
 if TG_OP='UPDATE' then old_data:=to_jsonb(old);end if;
 for parent in select * from (values('unit_id','units'),('class_id','classes'),('student_id','students'),('lesson_id','lessons'),('offering_id','offerings')) as x(field,tbl) loop
 if row_data ? parent.field and nullif(row_data->>parent.field,'') is not null and (TG_OP='INSERT' or row_data->>parent.field is distinct from old_data->>parent.field) then
 execute format('select archived_at is not null from public.%I where id=$1',parent.tbl) into is_archived using (row_data->>parent.field)::uuid;
 if is_archived then raise exception 'O registro relacionado está arquivado. Restaure-o antes de vincular novos dados.';end if;
 end if;
 end loop;
 return new;end $$;
do $$ declare tbl text;begin foreach tbl in array array['profiles','offerings','classes','students','lessons','attendance','pedagogy','contacts'] loop
 execute format('drop trigger if exists guard_record_parents on public.%I',tbl);
 execute format('create trigger guard_record_parents before insert or update on public.%I for each row execute function public.guard_record_parents()',tbl);
end loop;end $$;
create or replace function public.manage_record(p_actor uuid,p_table text,p_id uuid,p_action text,p_changes jsonb default '{}'::jsonb,p_reason text default '') returns jsonb language plpgsql security definer set search_path='' as $$
declare existing jsonb;result jsonb;allowed text[];col text;assignments text:='';row_unit uuid;begin
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
 when 'students' then array['name','birth_date','class_id','offering_id','phone','guardian','guardian_phone','email','address','enrollment_date','status','archive_reason']
 when 'lessons' then array['topic','date']
 when 'attendance' then array['status']
 when 'pedagogy' then array['date','kind','skill','level','notes','intervention','follow_up']
 when 'contacts' then array['date','reason','outcome','next_contact'] end;
 if p_changes ? 'name' and length(trim(p_changes->>'name'))<2 then raise exception 'Informe um nome com pelo menos dois caracteres.';end if;
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
 elsif p_table='students' then execute 'update public.students set archived_at=now(),record_archive_reason=$2,status=case when status=''ativo'' then ''cancelamento'' else status end,archive_reason=case when archive_reason='''' then $2 else archive_reason end where id=$1' using p_id,p_reason;
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
 insert into public.audit_log(actor_id,unit_id,entity,entity_id,operation) values(p_actor,row_unit,p_table,p_id,'MANAGE_'||upper(p_action));
 return result;
end $$;
revoke all on function public.manage_record(uuid,text,uuid,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.manage_record(uuid,text,uuid,text,jsonb,text) to service_role;
grant insert on public.audit_log to service_role;
-- Update guards also apply to administrative corrections.
drop trigger if exists guard_pedagogy on public.pedagogy;
create trigger guard_pedagogy before insert or update on public.pedagogy for each row execute function public.guard_pedagogy();
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
 (select count(*) from public.students s where s.archived_at is null and s.unit_id=u.id and s.status='ativo' and (s.guardian='' or s.guardian_phone='' or s.birth_date='' or s.address='')),now()
 from public.units u where u.archived_at is null
 on conflict(unit_id,snapshot_date) do update set active_students=excluded.active_students,new_enrollments=excluded.new_enrollments,archived_students=excluded.archived_students,total_classes=excluded.total_classes,idle_classes=excluded.idle_classes,present_count=excluded.present_count,absent_count=excluded.absent_count,late_count=excluded.late_count,incomplete_registrations=excluded.incomplete_registrations,computed_at=excluded.computed_at;
 get diagnostics processed=row_count;return jsonb_build_object('snapshot_date',target_date,'units_processed',processed,'completed_at',now());end $$;
commit;
