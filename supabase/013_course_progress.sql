begin;
alter table public.offerings add column total_hours numeric check(total_hours between 0.25 and 100000);
alter table public.offerings alter column duration_months drop not null;
alter table public.classes add column offering_id uuid;
alter table public.classes add constraint classes_offering_unit_fk foreign key(offering_id,unit_id) references public.offerings(id,unit_id);
alter table public.classes add column lesson_duration_minutes integer check(lesson_duration_minutes between 5 and 480);
alter table public.classes add column lesson_days integer[] not null default '{}' check(lesson_days <@ array[0,1,2,3,4,5,6]);
alter table public.students add column course_start_date date;
alter table public.students add column last_installment_date date;
alter table public.students add column opening_hours numeric not null default 0 check(opening_hours between 0 and 100000);
alter table public.attendance add column course_offering_id uuid;
alter table public.attendance add constraint attendance_course_unit_fk foreign key(course_offering_id,unit_id) references public.offerings(id,unit_id);
create function public.guard_course_dates() returns trigger language plpgsql security definer set search_path='' as $$begin
 if (TG_OP='INSERT' and new.opening_hours<>0) or (TG_OP='UPDATE' and new.opening_hours is distinct from old.opening_hours) then
 if auth.uid() is not null and public.current_role() not in ('admin','coordenacao','secretaria') then raise exception 'Somente secretaria e gestão podem informar horas anteriores.';end if;end if;
 if public.current_role()='professor' and ((TG_OP='INSERT' and new.last_installment_date is not null) or (TG_OP='UPDATE' and new.last_installment_date is distinct from old.last_installment_date)) then raise exception 'A data do boleto é responsabilidade da secretaria ou gestão.';end if;
 return new;end $$;
create trigger guard_course_dates before insert or update on public.students for each row execute function public.guard_course_dates();
create function public.snapshot_lesson_duration() returns trigger language plpgsql security definer set search_path='' as $$declare existing_duration integer;begin
 if new.class_id is not null then
  if TG_OP='UPDATE' and nullif(current_setting('wisdom.management_actor',true),'') is not null and exists(select 1 from public.profiles where id=nullif(current_setting('wisdom.management_actor',true),'')::uuid and role='admin' and active and not must_change_password) then return new;end if;
  if TG_OP='UPDATE' then existing_duration:=old.duration_minutes;
  else select duration_minutes into existing_duration from public.lessons where id=new.id;end if;
  new.duration_minutes:=coalesce(existing_duration,(select lesson_duration_minutes from public.classes where id=new.class_id and unit_id=new.unit_id));
 end if;
 return new;end $$;
create trigger snapshot_lesson_duration before insert or update on public.lessons for each row execute function public.snapshot_lesson_duration();
-- Once configured, initialize older calls with no duration. Later edits never rewrite snapshots.
create function public.initialize_class_lesson_hours() returns trigger language plpgsql security definer set search_path='' as $$begin
 if new.lesson_duration_minutes is not null and new.lesson_duration_minutes is distinct from old.lesson_duration_minutes then
 update public.lessons set duration_minutes=new.lesson_duration_minutes where class_id=new.id and unit_id=new.unit_id and duration_minutes is null;
 end if;return new;end $$;
create trigger initialize_class_lesson_hours after update on public.classes for each row execute function public.initialize_class_lesson_hours();
create or replace function public.guard_attendance() returns trigger language plpgsql security definer set search_path='' as $$ begin
 new.arrival_time:=case when new.status='atrasado' then coalesce(new.arrival_time,'') else '' end;
 new.justification:=case when new.status='justificado' then trim(coalesce(new.justification,'')) else '' end;
 if TG_OP='INSERT' or new.student_id is distinct from old.student_id or new.lesson_id is distinct from old.lesson_id or new.unit_id is distinct from old.unit_id then
 if not exists(select 1 from public.students s join public.lessons l on ((l.class_id=s.class_id and l.student_id is null) or (l.class_id is null and l.student_id=s.id)) and l.unit_id=s.unit_id where s.id=new.student_id and l.id=new.lesson_id) then raise exception 'Aluno não pertence à turma desta aula.';end if;end if;
 if TG_OP='INSERT' or (TG_OP='UPDATE' and (new.student_id is distinct from old.student_id or new.lesson_id is distinct from old.lesson_id)) then
 select coalesce(st.offering_id,c.offering_id) into new.course_offering_id from public.students st join public.lessons l on l.id=new.lesson_id left join public.classes c on c.id=l.class_id where st.id=new.student_id;
 elsif TG_OP='UPDATE' then new.course_offering_id:=old.course_offering_id;end if;
 return new;end $$;
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
 when 'offerings' then array['name','kind','duration_months','courses','total_hours']
 when 'classes' then array['name','course','teacher_id','schedule','capacity','whatsapp','offering_id','lesson_duration_minutes','lesson_days']
 when 'students' then array['name','birth_date','class_id','offering_id','phone','guardian','guardian_phone','email','address','enrollment_date','status','archive_reason','enrollment_mode','individual_hours','individual_days','individual_duration_minutes','individual_teacher_id','offboarding','course_start_date','last_installment_date','opening_hours']
 when 'lessons' then array['topic','date','duration_minutes']
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
create or replace function public.record_audit() returns trigger language plpgsql security definer set search_path='' as $$
declare actor uuid:=coalesce(auth.uid(),nullif(current_setting('wisdom.management_actor',true),'')::uuid);before_row jsonb;after_row jsonb;target jsonb;keys text[]:=array['total_hours','offering_id','lesson_duration_minutes','duration_minutes','lesson_days','course_start_date','last_installment_date','opening_hours','course_offering_id','color','name','class_id','student_id','unit_id','status','archived_at','archive_reason','enrollment_mode','individual_teacher_id','individual_hours','individual_days','individual_duration_minutes','offboarding','role','active','must_change_password','label','position','teacher_id','teacher','course','schedule','capacity','date','topic','closed','arrival_time','justification','kind','skill','level','notes','intervention','follow_up','reason','outcome','next_contact'];before_safe jsonb;after_safe jsonb;begin
 if TG_OP<>'INSERT' then before_row:=to_jsonb(old);end if;if TG_OP<>'DELETE' then after_row:=to_jsonb(new);end if;
 target:=coalesce(after_row,before_row);
 select jsonb_object_agg(key,value) into before_safe from jsonb_each(before_row) where key=any(keys);
 select jsonb_object_agg(key,value) into after_safe from jsonb_each(after_row) where key=any(keys);
 insert into public.audit_log(actor_id,actor_name,unit_id,entity,entity_id,operation,before_data,after_data) values(actor,coalesce((select name from public.profiles where id=actor),'Sistema'),(target->>'unit_id')::uuid,TG_TABLE_NAME,(target->>'id')::uuid,TG_OP,before_safe,after_safe);
 return coalesce(new,old);
end $$;
revoke all on function public.guard_course_dates(),public.snapshot_lesson_duration(),public.initialize_class_lesson_hours() from public;
notify pgrst,'reload schema';
commit;
