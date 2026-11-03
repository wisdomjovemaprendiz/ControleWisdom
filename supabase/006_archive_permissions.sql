begin;
-- Archive metadata is administrative even when normal field edits are allowed
-- to staff. Server-only RPCs use service_role and validate the actor separately.
create or replace function public.guard_archive_metadata() returns trigger
language plpgsql security definer set search_path='' as $$ begin
 if (new.archived_at is distinct from old.archived_at or new.record_archive_reason is distinct from old.record_archive_reason)
 and auth.uid() is not null and public.current_role() is distinct from 'admin'
 then raise exception 'Apenas administradores podem arquivar e restaurar registros nesta área.';end if;
 return new;
end $$;
do $$ declare tbl text;begin
 foreach tbl in array array['units','profiles','offerings','classes','students','lessons','attendance','pedagogy','contacts'] loop
 execute format('drop trigger if exists guard_archive_metadata on public.%I',tbl);
 execute format('create trigger guard_archive_metadata before update on public.%I for each row execute function public.guard_archive_metadata()',tbl);
 end loop;
end $$;
commit;
