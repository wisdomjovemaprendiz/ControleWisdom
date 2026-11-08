begin;
create table public.calendar_events (
 id uuid primary key default gen_random_uuid(),unit_id uuid references public.units(id),class_id uuid references public.classes(id),
 title text not null check(length(trim(title)) between 1 and 160),kind text not null check(kind in ('holiday','recess','no_class')),
 start_date date not null,end_date date not null,enabled boolean not null default true,
 source_key text unique,source_url text,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check(end_date>=start_date and end_date<=start_date+731),check(class_id is null or unit_id is not null)
);
create index calendar_events_dates on public.calendar_events(start_date,end_date);
create index calendar_events_unit on public.calendar_events(unit_id);
alter table public.calendar_events enable row level security;
revoke all on public.calendar_events from public,anon;
grant select,insert,update,delete on public.calendar_events to authenticated,service_role;
create policy calendar_read on public.calendar_events for select to authenticated using(public.current_role() is not null and (unit_id is null or public.can_access(unit_id)));
create policy calendar_insert on public.calendar_events for insert to authenticated with check((unit_id is null and public.current_role() in ('admin','coordenacao')) or (unit_id is not null and public.can_access(unit_id) and public.current_role() in ('admin','coordenacao','secretaria')));
create policy calendar_update on public.calendar_events for update to authenticated using((unit_id is null and public.current_role() in ('admin','coordenacao')) or (unit_id is not null and public.can_access(unit_id) and public.current_role() in ('admin','coordenacao','secretaria'))) with check((unit_id is null and public.current_role() in ('admin','coordenacao')) or (unit_id is not null and public.can_access(unit_id) and public.current_role() in ('admin','coordenacao','secretaria')));
create policy calendar_delete on public.calendar_events for delete to authenticated using((unit_id is null and public.current_role() in ('admin','coordenacao')) or (unit_id is not null and public.can_access(unit_id) and public.current_role() in ('admin','coordenacao','secretaria')));
create function public.guard_calendar_event() returns trigger language plpgsql security definer set search_path='' as $$ begin
 if new.class_id is not null and not exists(select 1 from public.classes where id=new.class_id and unit_id=new.unit_id and archived_at is null) then raise exception 'A turma deve pertencer à unidade selecionada e estar ativa.';end if;
 new.title:=trim(new.title);new.updated_at:=now();if TG_OP='UPDATE' then new.created_at:=old.created_at;else new.created_at:=now();end if;
 return new;end $$;
create trigger guard_calendar_event before insert or update on public.calendar_events for each row execute function public.guard_calendar_event();
create function public.audit_calendar_event() returns trigger language plpgsql security definer set search_path='' as $$ declare row_data jsonb:=coalesce(to_jsonb(new),to_jsonb(old));begin
 insert into public.audit_log(actor_id,actor_name,unit_id,entity,entity_id,operation,before_data,after_data) values(auth.uid(),coalesce((select name from public.profiles where id=auth.uid()),'Sistema'),(row_data->>'unit_id')::uuid,'calendar_events',(row_data->>'id')::uuid,TG_OP,case when TG_OP<>'INSERT' then to_jsonb(old) end,case when TG_OP<>'DELETE' then to_jsonb(new) end);
 return coalesce(new,old);end $$;
create trigger audit_calendar_event after insert or update or delete on public.calendar_events for each row execute function public.audit_calendar_event();
revoke all on function public.guard_calendar_event(),public.audit_calendar_event() from public,anon,authenticated;
-- National statutory holidays. Religious/local dates and optional closures are added by each school.
insert into public.calendar_events(title,kind,start_date,end_date,source_key,source_url) values
 ('Confraternização Universal','holiday','2027-01-01','2027-01-01','br-2027-0101','https://www.planalto.gov.br/ccivil_03/leis/2002/l10607.htm'),
 ('Tiradentes','holiday','2027-04-21','2027-04-21','br-2027-0421','https://www.planalto.gov.br/ccivil_03/leis/2002/l10607.htm'),
 ('Dia Mundial do Trabalho','holiday','2027-05-01','2027-05-01','br-2027-0501','https://www.planalto.gov.br/ccivil_03/leis/2002/l10607.htm'),
 ('Independência do Brasil','holiday','2027-09-07','2027-09-07','br-2027-0907','https://www.planalto.gov.br/ccivil_03/leis/2002/l10607.htm'),
 ('Nossa Senhora Aparecida','holiday','2027-10-12','2027-10-12','br-2027-1012','https://www.planalto.gov.br/ccivil_03/leis/l6802.htm'),
 ('Finados','holiday','2027-11-02','2027-11-02','br-2027-1102','https://www.planalto.gov.br/ccivil_03/leis/2002/l10607.htm'),
 ('Proclamação da República','holiday','2027-11-15','2027-11-15','br-2027-1115','https://www.planalto.gov.br/ccivil_03/leis/2002/l10607.htm'),
 ('Dia Nacional de Zumbi e da Consciência Negra','holiday','2027-11-20','2027-11-20','br-2027-1120','https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2023/lei/l14759.htm'),
 ('Natal','holiday','2027-12-25','2027-12-25','br-2027-1225','https://www.planalto.gov.br/ccivil_03/leis/2002/l10607.htm');
notify pgrst,'reload schema';
commit;
