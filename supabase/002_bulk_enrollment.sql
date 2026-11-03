-- Aplicar uma vez em projetos que já executaram 001_schema.sql.
-- Permite matrícula inicial somente com nome e turma, sem inventar telefone.
-- RLS, auditoria, autoria e limite de vagas permanecem ativos.
begin;
alter table public.students drop constraint if exists students_guardian_phone_check;
alter table public.students add constraint students_guardian_phone_check
check (guardian_phone = '' or length(regexp_replace(guardian_phone,'[^0-9]','','g')) >= 10);
commit;
