begin;
alter table public.classes add column color text not null default '';
-- Persist existing assignments once. Names, teachers and occupancy do not affect identity.
with numbered as (select id,row_number() over(order by id)-1 as n from public.classes), palette as (select array['#2457A7','#08796B','#8650A5','#AD5318','#AC3165','#53751F','#4E55A5','#A0443A','#087C96','#805A92','#8B6C16','#4F6D7B','#9A436C','#397249','#735FA7','#9E5D30'] as colors)
update public.classes c set color=palette.colors[(numbered.n%16+1)::int] from numbered,palette where c.id=numbered.id;
create function public.assign_class_color() returns trigger language plpgsql security definer set search_path='' as $$
declare palette text[]:=array['#2457A7','#08796B','#8650A5','#AD5318','#AC3165','#53751F','#4E55A5','#A0443A','#087C96','#805A92','#8B6C16','#4F6D7B','#9A436C','#397249','#735FA7','#9E5D30'];begin
 if TG_OP='UPDATE' then new.color:=old.color;return new;end if;
 perform pg_advisory_xact_lock(hashtext('wisdom-class-color'));
 select p.color into new.color from unnest(palette) with ordinality p(color,position)
 left join public.classes c on c.color=p.color
 group by p.color,p.position order by count(c.id),p.position limit 1;
 return new;
end $$;
create trigger assign_class_color before insert or update on public.classes for each row execute function public.assign_class_color();
alter table public.classes add constraint classes_color_hex check(color ~ '^#[0-9A-Fa-f]{6}$');
revoke all on function public.assign_class_color() from public;
notify pgrst,'reload schema';
commit;
