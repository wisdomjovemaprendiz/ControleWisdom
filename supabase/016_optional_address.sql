-- Address remains optional and does not generate a registration pending task.
begin;
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
 (select count(*) from public.students s where s.archived_at is null and s.unit_id=u.id and s.status='ativo' and (s.registration_stage<>'complete' or trim(s.name)='' or (s.class_id is null and s.enrollment_mode<>'individual') or s.guardian='' or s.guardian_phone='' or s.birth_date='')),now()
 from public.units u where u.archived_at is null
 on conflict(unit_id,snapshot_date) do update set active_students=excluded.active_students,new_enrollments=excluded.new_enrollments,archived_students=excluded.archived_students,total_classes=excluded.total_classes,idle_classes=excluded.idle_classes,present_count=excluded.present_count,absent_count=excluded.absent_count,late_count=excluded.late_count,incomplete_registrations=excluded.incomplete_registrations,computed_at=excluded.computed_at;
 get diagnostics processed=row_count;return jsonb_build_object('snapshot_date',target_date,'units_processed',processed,'completed_at',now());end $$;

select public.run_daily_analytics();
commit;
