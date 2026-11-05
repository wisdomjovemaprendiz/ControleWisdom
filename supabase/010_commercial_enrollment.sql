begin;
alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles add constraint profiles_role_check check(role in ('admin','coordenacao','secretaria','professor','comercial'));
alter table public.classes add column if not exists enrollment_open boolean not null default true;
alter table public.classes add column if not exists enrollment_priority integer not null default 3 check(enrollment_priority between 1 and 3);
alter table public.classes add column if not exists whatsapp_qr_path text;
alter table public.classes add constraint classes_group_link_check check(whatsapp='' or whatsapp ~ '^https://chat[.]whatsapp[.]com/[A-Za-z0-9_-]{6,128}/?([?][^[:space:]]*)?$') not valid;
alter table public.classes add constraint classes_qr_path_check check(whatsapp_qr_path is null or whatsapp_qr_path ~ ('^'||unit_id::text||'/'||id::text||'/[0-9a-f-]{36}[.]png$'));
create or replace function public.clear_changed_group_qr() returns trigger language plpgsql set search_path='' as $$ begin
 if new.whatsapp is distinct from old.whatsapp then new.whatsapp_qr_path:=null;end if;return new;end $$;
create trigger clear_changed_group_qr before update on public.classes for each row execute function public.clear_changed_group_qr();
alter table public.students add column if not exists registration_stage text not null default 'complete' check(registration_stage in ('pre_enrollment','pending','complete'));
alter table public.students add column if not exists completed_by uuid references public.profiles(id);
alter table public.students add column if not exists completed_at timestamptz;
create index students_pre_enrollment_queue on public.students(unit_id,registration_stage) where archived_at is null;
create or replace function public.guard_student() returns trigger language plpgsql security definer set search_path='' as $$ declare cap integer;occupied integer;role text:=public.current_role();begin
 if TG_OP='INSERT' then new.created_by:=auth.uid();new.completed_at:=null;new.completed_by:=null;else new.created_by:=old.created_by;end if;
 if TG_OP='UPDATE' and old.unit_id<>new.unit_id then raise exception 'Transferência entre unidades requer novo vínculo.';end if;
 if role='comercial' then
  if TG_OP='INSERT' then new.registration_stage:='pre_enrollment';new.completed_at:=null;new.completed_by:=null;
  elsif old.created_by<>auth.uid() or old.created_by is null or old.registration_stage<>'pre_enrollment' then raise exception 'O comercial pode editar somente suas próprias pré-matrículas pendentes.';
  elsif new.registration_stage<>old.registration_stage or new.completed_by is distinct from old.completed_by or new.completed_at is distinct from old.completed_at or new.birth_date<>old.birth_date or new.email<>old.email or new.address<>old.address or new.enrollment_date<>old.enrollment_date then raise exception 'A conferência e os dados complementares são responsabilidade da secretaria.';end if;
  if new.status<>'ativo' or new.archive_reason<>'' or new.archived_at is not null then raise exception 'O comercial não pode arquivar ou alterar a situação da matrícula.';end if;
  if new.class_id is not null and (TG_OP='INSERT' or new.class_id is distinct from old.class_id) and not exists(select 1 from public.classes where id=new.class_id and unit_id=new.unit_id and enrollment_open and archived_at is null) then raise exception 'Esta turma não está aberta para matrícula. Escolha uma turma disponível.';end if;
 elsif TG_OP='UPDATE' and role='professor' and (new.status<>old.status or new.archive_reason<>old.archive_reason or new.registration_stage<>old.registration_stage or new.completed_at is distinct from old.completed_at or new.completed_by is distinct from old.completed_by) then raise exception 'A situação e a conferência da matrícula são responsabilidade da secretaria.';end if;
 if TG_OP='UPDATE' and new.registration_stage is distinct from old.registration_stage then
  if role is not null and role not in ('admin','coordenacao','secretaria') then raise exception 'Sem permissão para concluir o cadastro.';end if;
  if new.registration_stage='complete' then new.completed_at:=now();new.completed_by:=auth.uid();else new.completed_at:=null;new.completed_by:=null;end if;
 elsif TG_OP='UPDATE' then new.completed_at:=old.completed_at;new.completed_by:=old.completed_by;end if;
 if new.class_id is null then return new;end if;
 select capacity into cap from public.classes where id=new.class_id and unit_id=new.unit_id for update;
 if cap is null then raise exception 'Turma inválida.';end if;
 select count(*) into occupied from public.students where class_id=new.class_id and status='ativo' and id<>new.id;
 if new.status='ativo' and occupied>=cap then raise exception 'Turma sem vagas.';end if;
 return new;end $$;
drop policy if exists pedagogy_read on public.pedagogy;
create policy pedagogy_read on public.pedagogy for select to authenticated using(public.can_access(unit_id) and public.current_role()<>'comercial');
-- The sales role may use photos only for an editable pre-enrollment.
drop policy if exists wisdom_student_photo_insert on storage.objects;
drop policy if exists wisdom_student_photo_delete on storage.objects;
create policy wisdom_student_photo_insert on storage.objects for insert to authenticated with check(bucket_id='student-photos' and exists(select 1 from public.students s where s.unit_id::text=(storage.foldername(storage.objects.name))[1] and s.id::text=(storage.foldername(storage.objects.name))[2] and public.can_access(s.unit_id) and (public.current_role()<>'comercial' or (s.created_by=auth.uid() and s.registration_stage='pre_enrollment'))));
create policy wisdom_student_photo_delete on storage.objects for delete to authenticated using(bucket_id='student-photos' and exists(select 1 from public.students s where s.unit_id::text=(storage.foldername(storage.objects.name))[1] and s.id::text=(storage.foldername(storage.objects.name))[2] and public.can_access(s.unit_id) and (public.current_role()<>'comercial' or (s.created_by=auth.uid() and s.registration_stage='pre_enrollment'))));
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('class-qr-codes','class-qr-codes',false,358400,array['image/png']) on conflict(id) do update set public=false,file_size_limit=358400,allowed_mime_types=array['image/png'];
create policy wisdom_class_qr_read on storage.objects for select to authenticated using(bucket_id='class-qr-codes' and exists(select 1 from public.classes c where c.unit_id::text=(storage.foldername(storage.objects.name))[1] and c.id::text=(storage.foldername(storage.objects.name))[2] and public.can_access(c.unit_id)));
create policy wisdom_class_qr_insert on storage.objects for insert to authenticated with check(bucket_id='class-qr-codes' and public.current_role() in ('admin','coordenacao','secretaria') and exists(select 1 from public.classes c where c.unit_id::text=(storage.foldername(storage.objects.name))[1] and c.id::text=(storage.foldername(storage.objects.name))[2] and public.can_access(c.unit_id)));
create policy wisdom_class_qr_delete on storage.objects for delete to authenticated using(bucket_id='class-qr-codes' and public.current_role() in ('admin','coordenacao','secretaria') and exists(select 1 from public.classes c where c.unit_id::text=(storage.foldername(storage.objects.name))[1] and c.id::text=(storage.foldername(storage.objects.name))[2] and public.can_access(c.unit_id)));
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
 (select count(*) from public.students s where s.archived_at is null and s.unit_id=u.id and s.status='ativo' and (s.registration_stage<>'complete' or trim(s.name)='' or s.class_id is null or s.guardian='' or s.guardian_phone='' or s.birth_date='' or s.address='')),now()
 from public.units u where u.archived_at is null
 on conflict(unit_id,snapshot_date) do update set active_students=excluded.active_students,new_enrollments=excluded.new_enrollments,archived_students=excluded.archived_students,total_classes=excluded.total_classes,idle_classes=excluded.idle_classes,present_count=excluded.present_count,absent_count=excluded.absent_count,late_count=excluded.late_count,incomplete_registrations=excluded.incomplete_registrations,computed_at=excluded.computed_at;
 get diagnostics processed=row_count;return jsonb_build_object('snapshot_date',target_date,'units_processed',processed,'completed_at',now());end $$;
notify pgrst,'reload schema';
commit;
