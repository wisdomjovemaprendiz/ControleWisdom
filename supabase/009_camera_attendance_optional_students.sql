begin;
alter table public.students drop constraint if exists students_name_check;
alter table public.students drop constraint if exists students_check;
alter table public.students alter column name set default '';
alter table public.students alter column guardian_phone set default '';
alter table public.students alter column class_id drop not null;
create or replace function public.guard_student() returns trigger language plpgsql security definer set search_path='' as $$ declare cap integer;occupied integer;begin
 if TG_OP='INSERT' then new.created_by:=auth.uid();else new.created_by:=old.created_by;end if;
 if TG_OP='UPDATE' and old.unit_id<>new.unit_id then raise exception 'Transferência entre unidades requer novo vínculo.';end if;
 if TG_OP='UPDATE' and public.current_role()='professor' and (new.status<>old.status or new.archive_reason<>old.archive_reason) then raise exception 'Arquivamento é responsabilidade da secretaria ou coordenação.';end if;
 if new.class_id is null then return new;end if;
 select capacity into cap from public.classes where id=new.class_id and unit_id=new.unit_id for update;
 if cap is null then raise exception 'Turma inválida.';end if;
 select count(*) into occupied from public.students where class_id=new.class_id and status='ativo' and id<>new.id;
 if new.status='ativo' and occupied>=cap then raise exception 'Turma sem vagas.';end if;
 return new;end $$;
alter table public.attendance add column if not exists arrival_time text not null default '';
alter table public.attendance add column if not exists justification text not null default '';
alter table public.attendance add constraint attendance_arrival_time_check check(arrival_time='' or arrival_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
alter table public.attendance add constraint attendance_justification_length check(length(justification)<=2000);
create or replace function public.guard_attendance() returns trigger language plpgsql security definer set search_path='' as $$ begin
 new.arrival_time:=case when new.status='atrasado' then coalesce(new.arrival_time,'') else '' end;
 new.justification:=case when new.status='justificado' then trim(coalesce(new.justification,'')) else '' end;
 if TG_OP='INSERT' or new.student_id is distinct from old.student_id or new.lesson_id is distinct from old.lesson_id or new.unit_id is distinct from old.unit_id then
 if not exists(select 1 from public.students s join public.lessons l on l.class_id=s.class_id and l.unit_id=s.unit_id where s.id=new.student_id and l.id=new.lesson_id) then raise exception 'Aluno não pertence à turma desta aula.';end if;end if;
 return new;end $$;
create or replace function public.save_lesson_attendance(lesson_data jsonb,attendance_data jsonb) returns void language plpgsql security invoker set search_path='' as $$
declare l public.lessons; row public.attendance; total integer;
begin
 l:=jsonb_populate_record(null::public.lessons,lesson_data);
 if not public.can_teach(l.class_id) or not public.can_access(l.unit_id) or l.teacher_id<>auth.uid() then raise exception 'Sem permissão para esta chamada.';end if;
 if l.date>current_date then raise exception 'Data futura não permitida.';end if;
 select count(*) into total from public.students where class_id=l.class_id and status='ativo';
 if total=0 or jsonb_array_length(attendance_data)<>total then raise exception 'Marque todos os alunos ativos.';end if;
 if (select count(distinct x.student_id) from jsonb_populate_recordset(null::public.attendance,attendance_data) x)<>total then raise exception 'Alunos duplicados.';end if;
 insert into public.lessons select l.* on conflict(id) do update set topic=excluded.topic,teacher=excluded.teacher,teacher_id=excluded.teacher_id,closed=excluded.closed;
 for row in select * from jsonb_populate_recordset(null::public.attendance,attendance_data) loop
 if row.lesson_id<>l.id or row.unit_id<>l.unit_id or not exists(select 1 from public.students s where s.id=row.student_id and s.class_id=l.class_id and s.status='ativo') then raise exception 'Presença inválida.';end if;
 insert into public.attendance(id,unit_id,lesson_id,student_id,status,arrival_time,justification) values(row.id,row.unit_id,row.lesson_id,row.student_id,row.status,coalesce(row.arrival_time,''),coalesce(row.justification,'')) on conflict(lesson_id,student_id) do update set status=excluded.status,arrival_time=excluded.arrival_time,justification=excluded.justification;
 end loop;
end $$;
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
 (select count(*) from public.students s where s.archived_at is null and s.unit_id=u.id and s.status='ativo' and (trim(s.name)='' or s.class_id is null or s.guardian='' or s.guardian_phone='' or s.birth_date='' or s.address='')),now()
 from public.units u where u.archived_at is null
 on conflict(unit_id,snapshot_date) do update set active_students=excluded.active_students,new_enrollments=excluded.new_enrollments,archived_students=excluded.archived_students,total_classes=excluded.total_classes,idle_classes=excluded.idle_classes,present_count=excluded.present_count,absent_count=excluded.absent_count,late_count=excluded.late_count,incomplete_registrations=excluded.incomplete_registrations,computed_at=excluded.computed_at;
 get diagnostics processed=row_count;return jsonb_build_object('snapshot_date',target_date,'units_processed',processed,'completed_at',now());end $$;
notify pgrst, 'reload schema';
commit;
