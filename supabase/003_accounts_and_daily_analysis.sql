begin;
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check(role in ('admin','coordenacao','secretaria','professor'));
alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists active boolean not null default true;
alter table public.profiles add column if not exists must_change_password boolean not null default false;
create unique index if not exists profiles_username_unique on public.profiles(username) where username is not null;
alter table public.profiles drop constraint if exists profiles_username_check;
alter table public.profiles add constraint profiles_username_check check(username is null or username ~ '^[a-z][a-z0-9._-]{2,31}$');
create or replace function public.current_role() returns text language sql stable security definer set search_path='' as $$ select role from public.profiles where id=auth.uid() and active and not must_change_password $$;
create or replace function public.current_unit() returns uuid language sql stable security definer set search_path='' as $$ select unit_id from public.profiles where id=auth.uid() and active and not must_change_password $$;
create or replace function public.can_access(target uuid) returns boolean language sql stable security definer set search_path='' as $$ select coalesce(public.current_role() in ('admin','coordenacao') or public.current_unit()=target,false) $$;
create or replace function public.can_teach(target uuid) returns boolean language sql stable security definer set search_path='' as $$ select coalesce(public.current_role() in ('admin','coordenacao') or (public.current_role()='professor' and exists(select 1 from public.classes c where c.id=target and c.teacher_id=auth.uid() and c.unit_id=public.current_unit())),false) $$;
drop policy if exists profile_read on public.profiles;
create policy profile_read on public.profiles for select to authenticated using(id=auth.uid() or public.can_access(unit_id));
drop policy if exists profile_insert on public.profiles;drop policy if exists profile_update on public.profiles;
revoke insert,update,delete on public.profiles from authenticated;
drop policy if exists unit_insert on public.units;drop policy if exists unit_update on public.units;
create policy unit_insert on public.units for insert to authenticated with check(public.current_role() in ('admin','coordenacao'));
create policy unit_update on public.units for update to authenticated using(public.current_role() in ('admin','coordenacao')) with check(public.current_role() in ('admin','coordenacao'));
drop policy if exists offering_insert on public.offerings;drop policy if exists offering_update on public.offerings;
create policy offering_insert on public.offerings for insert to authenticated with check(public.can_access(unit_id) and public.current_role() in ('admin','coordenacao','secretaria'));
create policy offering_update on public.offerings for update to authenticated using(public.can_access(unit_id) and public.current_role() in ('admin','coordenacao','secretaria')) with check(public.can_access(unit_id) and public.current_role() in ('admin','coordenacao','secretaria'));
drop policy if exists class_insert on public.classes;drop policy if exists class_update on public.classes;
create policy class_insert on public.classes for insert to authenticated with check(public.can_access(unit_id) and public.current_role() in ('admin','coordenacao','secretaria'));
create policy class_update on public.classes for update to authenticated using(public.can_access(unit_id) and public.current_role() in ('admin','coordenacao','secretaria')) with check(public.can_access(unit_id) and public.current_role() in ('admin','coordenacao','secretaria'));
drop policy if exists audit_read on public.audit_log;
create policy audit_read on public.audit_log for select to authenticated using(public.current_role() in ('admin','coordenacao'));
create or replace function public.guard_class() returns trigger language plpgsql security definer set search_path='' as $$ begin
 if not exists(select 1 from public.profiles where id=new.teacher_id and unit_id=new.unit_id and role in ('admin','coordenacao','professor') and active) then raise exception 'Professor deve pertencer à unidade da turma e estar ativo.';end if;
 if TG_OP='UPDATE' and old.unit_id<>new.unit_id then raise exception 'A unidade de uma turma não pode ser alterada.';end if;
 if (select count(*) from public.students where class_id=new.id and status='ativo')>new.capacity then raise exception 'Capacidade inferior ao número de alunos ativos.';end if;return new;end $$;
create table if not exists public.account_events(id bigint generated always as identity primary key,actor_id uuid references auth.users(id),target_id uuid not null references auth.users(id),action text not null,occurred_at timestamptz not null default now());
alter table public.account_events enable row level security;
drop policy if exists account_events_read on public.account_events;
create policy account_events_read on public.account_events for select to authenticated using(public.current_role()='admin');
grant select on public.account_events to authenticated;
create or replace function public.guard_profile() returns trigger language plpgsql security definer set search_path='' as $$ begin
 if old.unit_id<>new.unit_id and exists(select 1 from public.classes where teacher_id=new.id) then raise exception 'Transfira as turmas atribuídas antes de alterar a unidade.';end if;
 if old.role='admin' and old.active and (new.role<>'admin' or not new.active) then
 perform pg_advisory_xact_lock(174110);
 if not exists(select 1 from public.profiles where id<>old.id and role='admin' and active) then raise exception 'Mantenha pelo menos um administrador ativo.';end if;end if;
 return new;end $$;
drop trigger if exists guard_profile on public.profiles;
create trigger guard_profile before update on public.profiles for each row execute function public.guard_profile();
create or replace function public.admin_create_profile(p_actor uuid,p_id uuid,p_username text,p_name text,p_role text,p_unit uuid) returns public.profiles language plpgsql security definer set search_path='' as $$ declare result public.profiles;begin
 if not exists(select 1 from public.profiles where id=p_actor and role='admin' and active and not must_change_password) then raise exception 'Apenas administradores podem criar contas.';end if;
 insert into public.profiles(id,username,name,role,unit_id,active,must_change_password) values(p_id,p_username,p_name,p_role,p_unit,true,true) returning * into result;
 insert into public.account_events(actor_id,target_id,action) values(p_actor,p_id,'account_created');return result;end $$;
create or replace function public.admin_update_profile(p_actor uuid,p_id uuid,p_name text,p_role text,p_unit uuid,p_active boolean) returns public.profiles language plpgsql security definer set search_path='' as $$ declare result public.profiles;begin
 if not exists(select 1 from public.profiles where id=p_actor and role='admin' and active and not must_change_password) then raise exception 'Apenas administradores podem alterar contas.';end if;
 if p_actor=p_id and (p_role<>'admin' or not p_active) then raise exception 'Você não pode desativar ou remover o seu próprio acesso administrativo.';end if;
 update public.profiles set name=p_name,role=p_role,unit_id=p_unit,active=p_active where id=p_id returning * into result;if result.id is null then raise exception 'Conta não encontrada.';end if;
 insert into public.account_events(actor_id,target_id,action) values(p_actor,p_id,'account_updated');return result;end $$;
create or replace function public.admin_require_password_change(p_actor uuid,p_id uuid) returns void language plpgsql security definer set search_path='' as $$ begin
 if not exists(select 1 from public.profiles where id=p_actor and role='admin' and active and not must_change_password) then raise exception 'Apenas administradores podem redefinir senhas.';end if;
 update public.profiles set must_change_password=true where id=p_id;if not found then raise exception 'Conta não encontrada.';end if;
 insert into public.account_events(actor_id,target_id,action) values(p_actor,p_id,'password_reset_required');end $$;
create or replace function public.complete_password_change(p_id uuid) returns void language plpgsql security definer set search_path='' as $$ begin
 update public.profiles set must_change_password=false where id=p_id and active;if not found then raise exception 'Conta indisponível.';end if;
 insert into public.account_events(actor_id,target_id,action) values(p_id,p_id,'password_changed');end $$;
create or replace function public.bootstrap_admin(p_id uuid,p_username text,p_name text,p_unit_name text) returns public.profiles language plpgsql security definer set search_path='' as $$ declare target_unit uuid;result public.profiles;begin
 lock table public.profiles in share row exclusive mode;
 if exists(select 1 from public.profiles where role='admin') then raise exception 'Já existe administrador. Use a gestão de equipe.';end if;
 select id into target_unit from public.units where name=p_unit_name limit 1;
 if target_unit is null then insert into public.units(name,address) values(p_unit_name,'') returning id into target_unit;end if;
 insert into public.profiles(id,username,name,role,unit_id,active,must_change_password) values(p_id,p_username,p_name,'admin',target_unit,true,true) returning * into result;
 insert into public.account_events(actor_id,target_id,action) values(p_id,p_id,'admin_bootstrapped');return result;end $$;
create table if not exists public.daily_analytics(unit_id uuid not null references public.units(id),snapshot_date date not null,active_students integer not null,new_enrollments integer not null,archived_students integer not null,total_classes integer not null,idle_classes integer not null,present_count integer not null,absent_count integer not null,late_count integer not null,incomplete_registrations integer not null,computed_at timestamptz not null default now(),primary key(unit_id,snapshot_date));
alter table public.daily_analytics enable row level security;
drop policy if exists daily_analytics_read on public.daily_analytics;
create policy daily_analytics_read on public.daily_analytics for select to authenticated using(public.current_role() in ('admin','coordenacao') and public.can_access(unit_id));
grant select on public.daily_analytics to authenticated;
create or replace function public.run_daily_analytics() returns jsonb language plpgsql security definer set search_path='' as $$ declare target_date date:=(timezone('America/Sao_Paulo',now()))::date;processed integer;begin
 insert into public.daily_analytics(unit_id,snapshot_date,active_students,new_enrollments,archived_students,total_classes,idle_classes,present_count,absent_count,late_count,incomplete_registrations,computed_at)
 select u.id,target_date,
 (select count(*) from public.students s where s.unit_id=u.id and s.status='ativo'),
 (select count(*) from public.students s where s.unit_id=u.id and s.enrollment_date=target_date),
 (select count(*) from public.students s where s.unit_id=u.id and s.status<>'ativo'),
 (select count(*) from public.classes c where c.unit_id=u.id),
 (select count(*) from public.classes c where c.unit_id=u.id and not exists(select 1 from public.students s where s.class_id=c.id and s.status='ativo')),
 (select count(*) from public.attendance a join public.lessons l on l.id=a.lesson_id where l.unit_id=u.id and l.date=target_date and a.status='presente'),
 (select count(*) from public.attendance a join public.lessons l on l.id=a.lesson_id where l.unit_id=u.id and l.date=target_date and a.status='falta'),
 (select count(*) from public.attendance a join public.lessons l on l.id=a.lesson_id where l.unit_id=u.id and l.date=target_date and a.status='atrasado'),
 (select count(*) from public.students s where s.unit_id=u.id and s.status='ativo' and (s.guardian='' or s.guardian_phone='' or s.birth_date='' or s.address='')),now()
 from public.units u
 on conflict(unit_id,snapshot_date) do update set active_students=excluded.active_students,new_enrollments=excluded.new_enrollments,archived_students=excluded.archived_students,total_classes=excluded.total_classes,idle_classes=excluded.idle_classes,present_count=excluded.present_count,absent_count=excluded.absent_count,late_count=excluded.late_count,incomplete_registrations=excluded.incomplete_registrations,computed_at=excluded.computed_at;
 get diagnostics processed=row_count;return jsonb_build_object('snapshot_date',target_date,'units_processed',processed,'completed_at',now());end $$;
revoke all on function public.admin_create_profile(uuid,uuid,text,text,text,uuid),public.admin_update_profile(uuid,uuid,text,text,uuid,boolean),public.admin_require_password_change(uuid,uuid),public.complete_password_change(uuid),public.bootstrap_admin(uuid,text,text,text),public.run_daily_analytics() from public,anon,authenticated;
grant execute on function public.admin_create_profile(uuid,uuid,text,text,text,uuid),public.admin_update_profile(uuid,uuid,text,text,uuid,boolean),public.admin_require_password_change(uuid,uuid),public.complete_password_change(uuid),public.bootstrap_admin(uuid,text,text,text),public.run_daily_analytics() to service_role;
grant all on public.account_events,public.daily_analytics,public.profiles to service_role;
commit;
