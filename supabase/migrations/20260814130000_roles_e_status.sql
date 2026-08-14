-- Alterações de enum ficam isoladas: os novos valores só podem ser usados
-- com segurança após o commit desta migration.
alter type public.app_role add value if not exists 'superadmin';
alter type public.participante_status add value if not exists 'aguardando_resposta';
alter type public.participante_status add value if not exists 'recusado';

do $$ begin
  create type public.posicao_lista as enum ('linha', 'goleiro');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.lista_fase as enum ('fechada', 'mensalistas', 'geral', 'encerrada', 'cancelada');
exception when duplicate_object then null; end $$;
