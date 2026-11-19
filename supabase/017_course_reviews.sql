begin;
alter table public.contacts add column if not exists course_review jsonb;
alter table public.contacts add column if not exists created_at timestamptz not null default now();
alter table public.contacts add constraint contact_course_review_object check(course_review is null or (jsonb_typeof(course_review)='object' and octet_length(course_review::text)<=2000));
create or replace function public.guard_course_review() returns trigger language plpgsql security definer set search_path='' as $$
declare s public.students;r text:=public.current_role();begin
 if new.course_review is null then
   if TG_OP='UPDATE' and old.course_review is not null then raise exception 'O vínculo da análise não pode ser removido.';end if;
   return new;
 end if;
 select * into s from public.students where id=new.student_id and unit_id=new.unit_id;
 if s.id is null or not public.can_access(new.unit_id) or r not in ('admin','coordenacao','secretaria','professor') then raise exception 'Sem permissão para analisar este curso.';end if;
 if r='professor' and not public.can_teach_context(s.class_id,s.id) then raise exception 'Professor não vinculado ao aluno.';end if;
 if length(trim(new.outcome))<3 then raise exception 'Informe o motivo ou encaminhamento da análise.';end if;
 if not (new.course_review ?& array['offering_id','contracted_hours','completed_hours','deadline','deadline_state','start_date']) or jsonb_typeof(new.course_review->'completed_hours')<>'number' or (new.course_review->>'completed_hours')::numeric<0 or coalesce(new.course_review->>'deadline_state','') not in ('none','upcoming','due','overdue') then raise exception 'Dados de análise inválidos.';end if;
 if TG_OP='UPDATE' and new.course_review is distinct from old.course_review then raise exception 'Inclua uma nova análise para registrar outro momento do curso.';end if;
 if TG_OP='INSERT' then new.created_at=now();new.author_id=auth.uid();end if;
 return new;
end $$;
create trigger guard_course_review before insert or update on public.contacts for each row execute function public.guard_course_review();
drop policy contact_read on public.contacts;
create policy contact_read on public.contacts for select to authenticated using(public.can_access(unit_id) and (course_review is null or public.current_role() in ('admin','coordenacao','secretaria') or (public.current_role()='professor' and exists(select 1 from public.students s where s.id=student_id and public.can_teach_context(s.class_id,s.id)))));
notify pgrst,'reload schema';
commit;
