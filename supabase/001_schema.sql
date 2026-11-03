-- Execute uma vez no SQL Editor de um projeto Supabase novo.
begin;
create extension if not exists pgcrypto;
create table public.units (id uuid primary key default gen_random_uuid(), name text not null check(length(trim(name))>0), address text not null default '');
create table public.profiles (id uuid primary key references auth.users(id) on delete restrict, name text not null, role text not null check(role in ('coordenacao','secretaria','professor')), unit_id uuid not null references public.units(id));
create table public.offerings (id uuid primary key default gen_random_uuid(),unit_id uuid not null references public.units(id),name text not null,kind text not null check(kind in ('individual','pacote')),duration_months integer not null check(duration_months between 1 and 120),courses text not null, unique(id,unit_id));
create table public.classes (id uuid primary key default gen_random_uuid(), unit_id uuid not null references public.units(id), name text not null, course text not null, teacher_id uuid not null references public.profiles(id), teacher text not null, schedule text not null, capacity integer not null check(capacity between 1 and 500), whatsapp text not null default '', unique(id,unit_id));
create table public.students (id uuid primary key default gen_random_uuid(), unit_id uuid not null references public.units(id), class_id uuid not null, offering_id uuid, name text not null check(length(trim(name))>0),birth_date text not null default '', phone text not null default '', guardian text not null default '',guardian_phone text not null check(length(regexp_replace(guardian_phone,'[^0-9]','','g'))>=10), email text not null default '',address text not null default '',created_by uuid references public.profiles(id) default auth.uid(),enrollment_date date not null default current_date,status text not null default 'ativo' check(status in ('ativo','conclusao','inadimplencia','abandono','cancelamento')), archive_reason text not null default '',unique(id,unit_id),foreign key(class_id,unit_id) references public.classes(id,unit_id),foreign key(offering_id,unit_id) references public.offerings(id,unit_id),check(status='ativo' or length(trim(archive_reason))>0));
create table public.lessons (id uuid primary key default gen_random_uuid(),unit_id uuid not null references public.units(id),class_id uuid not null,teacher_id uuid not null references public.profiles(id),teacher text not null,date date not null,topic text not null check(length(trim(topic))>0),closed boolean not null default false,unique(id,unit_id),unique(class_id,date),foreign key(class_id,unit_id) references public.classes(id,unit_id));
create table public.attendance (id uuid primary key default gen_random_uuid(),unit_id uuid not null references public.units(id),lesson_id uuid not null,student_id uuid not null,status text not null check(status in ('presente','falta','atrasado','justificado')),unique(lesson_id,student_id),foreign key(lesson_id,unit_id) references public.lessons(id,unit_id),foreign key(student_id,unit_id) references public.students(id,unit_id));
create table public.pedagogy (id uuid primary key default gen_random_uuid(),unit_id uuid not null references public.units(id),class_id uuid not null,student_id uuid,author_id uuid not null references public.profiles(id),date date not null default current_date,kind text not null check(kind in ('Diagnóstico','Evolução','Intervenção')),skill text not null,level integer not null check(level between 1 and 5),notes text not null,intervention text not null default '',follow_up text not null default '',foreign key(class_id,unit_id) references public.classes(id,unit_id),foreign key(student_id,unit_id) references public.students(id,unit_id));
create table public.contacts (id uuid primary key default gen_random_uuid(),unit_id uuid not null references public.units(id),student_id uuid not null,author_id uuid not null references public.profiles(id),date date not null default current_date,reason text not null,outcome text not null,next_contact text not null default '',foreign key(student_id,unit_id) references public.students(id,unit_id));
create table public.audit_log(id bigint generated always as identity primary key,actor_id uuid references auth.users(id),unit_id uuid,entity text not null,entity_id uuid not null,operation text not null,occurred_at timestamptz not null default now());
create index on public.profiles(unit_id);create index on public.offerings(unit_id);create index on public.students(unit_id,class_id);create index on public.classes(unit_id);create index on public.lessons(unit_id,date);create index on public.attendance(student_id);create index on public.pedagogy(unit_id,student_id);create index on public.contacts(unit_id,student_id);
-- Helpers não consultam RLS recursivamente. Nenhum dado pessoal é retornado.
create function public.current_role() returns text language sql stable security definer set search_path='' as $$ select role from public.profiles where id=auth.uid() $$;
create function public.current_unit() returns uuid language sql stable security definer set search_path='' as $$ select unit_id from public.profiles where id=auth.uid() $$;
create function public.can_access(target uuid) returns boolean language sql stable security definer set search_path='' as $$ select coalesce(public.current_role()='coordenacao' or public.current_unit()=target,false) $$;
create function public.can_teach(target uuid) returns boolean language sql stable security definer set search_path='' as $$ select coalesce(public.current_role()='coordenacao' or (public.current_role()='professor' and exists(select 1 from public.classes c where c.id=target and c.teacher_id=auth.uid() and c.unit_id=public.current_unit())),false) $$;
alter table public.units enable row level security;alter table public.profiles enable row level security;alter table public.offerings enable row level security;alter table public.classes enable row level security;alter table public.students enable row level security;alter table public.lessons enable row level security;alter table public.attendance enable row level security;alter table public.pedagogy enable row level security;alter table public.contacts enable row level security;alter table public.audit_log enable row level security;
create policy unit_read on public.units for select to authenticated using(public.can_access(id));
create policy unit_insert on public.units for insert to authenticated with check(public.current_role()='coordenacao');
create policy unit_update on public.units for update to authenticated using(public.current_role()='coordenacao') with check(public.current_role()='coordenacao');
create policy profile_read on public.profiles for select to authenticated using(public.can_access(unit_id));
create policy profile_insert on public.profiles for insert to authenticated with check(public.current_role()='coordenacao');
create policy profile_update on public.profiles for update to authenticated using(public.current_role()='coordenacao') with check(public.current_role()='coordenacao');
create policy offering_read on public.offerings for select to authenticated using(public.can_access(unit_id));
create policy offering_insert on public.offerings for insert to authenticated with check(public.can_access(unit_id) and public.current_role() in ('coordenacao','secretaria'));
create policy offering_update on public.offerings for update to authenticated using(public.can_access(unit_id) and public.current_role() in ('coordenacao','secretaria')) with check(public.can_access(unit_id) and public.current_role() in ('coordenacao','secretaria'));
create policy class_read on public.classes for select to authenticated using(public.can_access(unit_id));
create policy class_insert on public.classes for insert to authenticated with check(public.can_access(unit_id) and public.current_role() in ('coordenacao','secretaria'));
create policy class_update on public.classes for update to authenticated using(public.can_access(unit_id) and public.current_role() in ('coordenacao','secretaria')) with check(public.can_access(unit_id) and public.current_role() in ('coordenacao','secretaria'));
create policy student_read on public.students for select to authenticated using(public.can_access(unit_id));
create policy student_insert on public.students for insert to authenticated with check(public.can_access(unit_id));
create policy student_update on public.students for update to authenticated using(public.can_access(unit_id)) with check(public.can_access(unit_id));
create policy lesson_read on public.lessons for select to authenticated using(public.can_access(unit_id));
create policy lesson_insert on public.lessons for insert to authenticated with check(public.can_access(unit_id) and public.can_teach(class_id) and teacher_id=auth.uid());
create policy lesson_update on public.lessons for update to authenticated using(public.can_access(unit_id) and public.can_teach(class_id)) with check(public.can_access(unit_id) and public.can_teach(class_id) and teacher_id=auth.uid());
create policy attendance_read on public.attendance for select to authenticated using(public.can_access(unit_id));
create policy attendance_insert on public.attendance for insert to authenticated with check(public.can_access(unit_id) and exists(select 1 from public.lessons l where l.id=lesson_id and public.can_teach(l.class_id)));
create policy attendance_update on public.attendance for update to authenticated using(public.can_access(unit_id) and exists(select 1 from public.lessons l where l.id=lesson_id and public.can_teach(l.class_id))) with check(public.can_access(unit_id) and exists(select 1 from public.lessons l where l.id=lesson_id and public.can_teach(l.class_id)));
create policy pedagogy_read on public.pedagogy for select to authenticated using(public.can_access(unit_id));
create policy pedagogy_insert on public.pedagogy for insert to authenticated with check(public.can_access(unit_id) and public.can_teach(class_id) and author_id=auth.uid());
create policy contact_read on public.contacts for select to authenticated using(public.can_access(unit_id));
create policy contact_insert on public.contacts for insert to authenticated with check(public.can_access(unit_id) and author_id=auth.uid());
create policy audit_read on public.audit_log for select to authenticated using(public.current_role()='coordenacao');
-- Impede arquivamento pelo professor, mudanças de unidade e lotação acima do limite.
create function public.guard_student() returns trigger language plpgsql security definer set search_path='' as $$
declare cap integer; occupied integer;
begin
 if TG_OP='INSERT' then new.created_by:=auth.uid();else new.created_by:=old.created_by;end if;
 if TG_OP='UPDATE' and old.unit_id<>new.unit_id then raise exception 'Transferência entre unidades requer novo vínculo.';end if;
 if TG_OP='UPDATE' and public.current_role()='professor' and (new.status<>old.status or new.archive_reason<>old.archive_reason) then raise exception 'Arquivamento é responsabilidade da secretaria ou coordenação.';end if;
 select capacity into cap from public.classes where id=new.class_id and unit_id=new.unit_id for update;
 if cap is null then raise exception 'Turma inválida.';end if;
 select count(*) into occupied from public.students where class_id=new.class_id and status='ativo' and id<>new.id;
 if new.status='ativo' and occupied>=cap then raise exception 'Turma sem vagas.';end if;
 return new;
end $$;
create trigger guard_student before insert or update on public.students for each row execute function public.guard_student();
create function public.guard_class() returns trigger language plpgsql security definer set search_path='' as $$ begin
 if not exists(select 1 from public.profiles where id=new.teacher_id and unit_id=new.unit_id and role in ('professor','coordenacao')) then raise exception 'Professor deve pertencer à unidade da turma.';end if;
 if TG_OP='UPDATE' and (old.unit_id<>new.unit_id) then raise exception 'A unidade de uma turma não pode ser alterada.';end if;
 if (select count(*) from public.students where class_id=new.id and status='ativo')>new.capacity then raise exception 'Capacidade inferior ao número de alunos ativos.';end if;
 return new;end $$;
create trigger guard_class before insert or update on public.classes for each row execute function public.guard_class();
create function public.guard_attendance() returns trigger language plpgsql security definer set search_path='' as $$ begin
 if not exists(select 1 from public.students s join public.lessons l on l.class_id=s.class_id and l.unit_id=s.unit_id where s.id=new.student_id and l.id=new.lesson_id) then raise exception 'Aluno não pertence à turma desta aula.';end if;return new;end $$;
create trigger guard_attendance before insert or update on public.attendance for each row execute function public.guard_attendance();
create function public.guard_pedagogy() returns trigger language plpgsql security definer set search_path='' as $$ begin
 if new.student_id is not null and not exists(select 1 from public.students where id=new.student_id and class_id=new.class_id and unit_id=new.unit_id) then raise exception 'Aluno não pertence à turma.';end if;return new;end $$;
create trigger guard_pedagogy before insert on public.pedagogy for each row execute function public.guard_pedagogy();
-- A chamada inteira é atômica: falhas revertem aula e presenças.
create function public.save_lesson_attendance(lesson_data jsonb,attendance_data jsonb) returns void language plpgsql security invoker set search_path='' as $$
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
 insert into public.attendance select row.* on conflict(lesson_id,student_id) do update set status=excluded.status;
 end loop;
end $$;
create function public.record_audit() returns trigger language plpgsql security definer set search_path='' as $$ begin insert into public.audit_log(actor_id,unit_id,entity,entity_id,operation) values(auth.uid(),new.unit_id,TG_TABLE_NAME,new.id,TG_OP);return new;end $$;
create trigger audit_students after insert or update on public.students for each row execute function public.record_audit();
create trigger audit_lessons after insert or update on public.lessons for each row execute function public.record_audit();
create trigger audit_contacts after insert on public.contacts for each row execute function public.record_audit();
create trigger audit_pedagogy after insert on public.pedagogy for each row execute function public.record_audit();
revoke all on all tables in schema public from anon;
grant select,insert,update on public.units,public.profiles,public.offerings,public.classes,public.students,public.lessons,public.attendance to authenticated;
grant select,insert on public.pedagogy,public.contacts to authenticated;
grant select on public.audit_log to authenticated;
revoke all on function public.current_role(),public.current_unit(),public.can_access(uuid),public.can_teach(uuid),public.save_lesson_attendance(jsonb,jsonb) from public;
grant execute on function public.current_role(),public.current_unit(),public.can_access(uuid),public.can_teach(uuid),public.save_lesson_attendance(jsonb,jsonb) to authenticated;
commit;
