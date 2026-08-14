-- Pelada dos Sub: schema inicial, seguro para projeto sem estruturas prévias.
create extension if not exists pgcrypto;

-- PostgreSQL não oferece CREATE TYPE IF NOT EXISTS. Estes blocos permitem
-- retomar com segurança quando algum enum já foi criado no projeto remoto.
do $$ begin create type public.app_role as enum ('user','admin'); exception when duplicate_object then null; end $$;
do $$ begin create type public.tipo_jogador as enum ('mensalista','avulso'); exception when duplicate_object then null; end $$;
do $$ begin create type public.pelada_status as enum ('aberta','lotada','acontecendo','encerrada','cancelada'); exception when duplicate_object then null; end $$;
do $$ begin create type public.participante_status as enum ('confirmado','espera','cancelado','presente','faltou'); exception when duplicate_object then null; end $$;
do $$ begin create type public.pagamento_tipo as enum ('mensalidade','avulso'); exception when duplicate_object then null; end $$;
do $$ begin create type public.pagamento_status as enum ('pendente','pago','isento','atrasado'); exception when duplicate_object then null; end $$;
do $$ begin create type public.pagamento_metodo as enum ('pix','dinheiro','outro'); exception when duplicate_object then null; end $$;
do $$ begin create type public.ranking_tipo as enum ('sub_bom','sub_ruim'); exception when duplicate_object then null; end $$;
do $$ begin create type public.premiacao_categoria as enum ('craque_pelada','destaque_sub_ruim','goleiro_destaque'); exception when duplicate_object then null; end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null check (char_length(trim(nome)) between 2 and 100), apelido text, telefone text, foto_url text,
  role public.app_role not null default 'user', tipo_jogador public.tipo_jogador not null default 'avulso',
  mensalista_ativo boolean not null default false, validade_mensalidade date, ativo boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.peladas (
  id uuid primary key default gen_random_uuid(), data date not null, horario time not null, local text not null,
  limite_jogadores integer not null default 20 check (limite_jogadores > 0), status public.pelada_status not null default 'aberta',
  lista_aberta boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.pelada_participantes (
  id uuid primary key default gen_random_uuid(), pelada_id uuid not null references public.peladas on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade, ordem_entrada bigint generated always as identity,
  status public.participante_status not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(pelada_id,user_id)
);
create index if not exists pelada_participantes_fila on public.pelada_participantes(pelada_id,status,ordem_entrada);
create table if not exists public.pagamentos (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id), pelada_id uuid references public.peladas(id),
  tipo public.pagamento_tipo not null, valor numeric(10,2) not null check(valor >= 0), status public.pagamento_status not null default 'pendente',
  data_pagamento date, metodo_pagamento public.pagamento_metodo, referencia text, observacao text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.ranking_eventos (
  id uuid primary key default gen_random_uuid(), pelada_id uuid not null references public.peladas on delete cascade,
  user_id uuid not null references public.profiles(id), tipo public.ranking_tipo not null, pontos integer not null,
  observacao text, created_at timestamptz not null default now(), unique(pelada_id,user_id,tipo)
);
create table if not exists public.premiacoes (
  id uuid primary key default gen_random_uuid(), pelada_id uuid not null references public.peladas on delete cascade,
  user_id uuid not null references public.profiles(id), categoria public.premiacao_categoria not null, created_at timestamptz not null default now(),
  unique(pelada_id,categoria)
);

create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles where id = auth.uid() and role = 'admin' and ativo);
$$;
revoke all on function public.is_admin() from public; grant execute on function public.is_admin() to authenticated;
create or replace function public.profile_sensitive_unchanged(p_id uuid,p_role public.app_role,p_tipo public.tipo_jogador,p_mensalista boolean,p_ativo boolean) returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles where id=p_id and role=p_role and tipo_jogador=p_tipo and mensalista_ativo=p_mensalista and ativo=p_ativo);
$$;
revoke all on function public.profile_sensitive_unchanged(uuid,public.app_role,public.tipo_jogador,boolean,boolean) from public; grant execute on function public.profile_sensitive_unchanged(uuid,public.app_role,public.tipo_jogador,boolean,boolean) to authenticated;

create or replace function public.novo_usuario() returns trigger language plpgsql security definer set search_path = '' as $$
begin insert into public.profiles(id,nome) values(new.id, coalesce(nullif(trim(new.raw_user_meta_data->>'nome'),''), split_part(new.email,'@',1))); return new; end;
$$;
drop trigger if exists auth_user_profile on auth.users;
create trigger auth_user_profile after insert on auth.users for each row execute function public.novo_usuario();

create or replace function public.entrar_na_pelada(p_pelada_id uuid) returns text language plpgsql security definer set search_path = '' as $$
declare v_pelada public.peladas; v_status public.participante_status; v_count integer;
begin
  if auth.uid() is null then raise exception 'Autenticação necessária'; end if;
  select * into v_pelada from public.peladas where id=p_pelada_id for update;
  if not found or not v_pelada.lista_aberta or v_pelada.status in ('encerrada','cancelada') then raise exception 'Lista indisponível'; end if;
  select count(*) into v_count from public.pelada_participantes where pelada_id=p_pelada_id and status in ('confirmado','presente');
  v_status := case when v_count < v_pelada.limite_jogadores then 'confirmado' else 'espera' end;
  insert into public.pelada_participantes(pelada_id,user_id,status) values(p_pelada_id,auth.uid(),v_status)
  on conflict(pelada_id,user_id) do update set status=v_status, updated_at=now();
  if v_status='espera' then update public.peladas set status='lotada',updated_at=now() where id=p_pelada_id; end if;
  return v_status::text;
end; $$;

create or replace function public.sair_da_pelada(p_pelada_id uuid) returns void language plpgsql security definer set search_path = '' as $$
declare v_old public.participante_status; v_limit int;
begin
  select limite_jogadores into v_limit from public.peladas where id=p_pelada_id and lista_aberta for update;
  if not found then raise exception 'Lista indisponível'; end if;
  select status into v_old from public.pelada_participantes where pelada_id=p_pelada_id and user_id=auth.uid() for update;
  if not found then raise exception 'Inscrição não encontrada'; end if;
  update public.pelada_participantes set status='cancelado',updated_at=now() where pelada_id=p_pelada_id and user_id=auth.uid();
  if v_old in ('confirmado','presente') then update public.pelada_participantes set status='confirmado',updated_at=now() where id=(select id from public.pelada_participantes where pelada_id=p_pelada_id and status='espera' order by ordem_entrada for update skip locked limit 1); end if;
  update public.peladas set status=case when status='lotada' and (select count(*) from public.pelada_participantes where pelada_id=p_pelada_id and status in ('confirmado','presente')) < v_limit then 'aberta' else status end,updated_at=now() where id=p_pelada_id;
end; $$;
revoke all on function public.entrar_na_pelada(uuid), public.sair_da_pelada(uuid) from public;
grant execute on function public.entrar_na_pelada(uuid), public.sair_da_pelada(uuid) to authenticated;

create or replace function public.admin_gerenciar_participante(p_pelada_id uuid,p_user_id uuid,p_acao text) returns void language plpgsql security definer set search_path = '' as $$
declare v_old public.participante_status;
begin
  if not public.is_admin() then raise exception 'Acesso negado'; end if;
  perform 1 from public.peladas where id=p_pelada_id for update;
  if p_acao='add' then insert into public.pelada_participantes(pelada_id,user_id,status) values(p_pelada_id,p_user_id,'confirmado') on conflict(pelada_id,user_id) do update set status='confirmado',updated_at=now();
  elsif p_acao='remove' then
    select status into v_old from public.pelada_participantes where pelada_id=p_pelada_id and user_id=p_user_id for update;
    update public.pelada_participantes set status='cancelado',updated_at=now() where pelada_id=p_pelada_id and user_id=p_user_id;
    if v_old in ('confirmado','presente') then update public.pelada_participantes set status='confirmado',updated_at=now() where id=(select id from public.pelada_participantes where pelada_id=p_pelada_id and status='espera' order by ordem_entrada for update skip locked limit 1); end if;
  elsif p_acao='promote' then update public.pelada_participantes set status='confirmado',updated_at=now() where pelada_id=p_pelada_id and user_id=p_user_id;
  elsif p_acao in ('presente','faltou') then update public.pelada_participantes set status=p_acao::public.participante_status,updated_at=now() where pelada_id=p_pelada_id and user_id=p_user_id;
  else raise exception 'Ação inválida'; end if;
end; $$;
revoke all on function public.admin_gerenciar_participante(uuid,uuid,text) from public; grant execute on function public.admin_gerenciar_participante(uuid,uuid,text) to authenticated;

alter table public.profiles enable row level security; alter table public.peladas enable row level security; alter table public.pelada_participantes enable row level security;
alter table public.pagamentos enable row level security; alter table public.ranking_eventos enable row level security; alter table public.premiacoes enable row level security;
drop policy if exists profiles_read on public.profiles; drop policy if exists profiles_self_update on public.profiles; drop policy if exists profiles_admin on public.profiles;
drop policy if exists peladas_read on public.peladas; drop policy if exists peladas_admin on public.peladas;
drop policy if exists participantes_read on public.pelada_participantes; drop policy if exists participantes_admin on public.pelada_participantes;
drop policy if exists pagamentos_self_read on public.pagamentos; drop policy if exists pagamentos_admin on public.pagamentos;
drop policy if exists ranking_read on public.ranking_eventos; drop policy if exists ranking_admin on public.ranking_eventos;
drop policy if exists premiacoes_read on public.premiacoes; drop policy if exists premiacoes_admin on public.premiacoes;
create policy profiles_read on public.profiles for select to authenticated using (true);
create policy profiles_self_update on public.profiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid() and public.profile_sensitive_unchanged(id,role,tipo_jogador,mensalista_ativo,ativo));
create policy profiles_admin on public.profiles for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy peladas_read on public.peladas for select to authenticated using(true); create policy peladas_admin on public.peladas for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy participantes_read on public.pelada_participantes for select to authenticated using(true); create policy participantes_admin on public.pelada_participantes for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy pagamentos_self_read on public.pagamentos for select to authenticated using(user_id=auth.uid() or public.is_admin()); create policy pagamentos_admin on public.pagamentos for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy ranking_read on public.ranking_eventos for select to authenticated using(true); create policy ranking_admin on public.ranking_eventos for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy premiacoes_read on public.premiacoes for select to authenticated using(true); create policy premiacoes_admin on public.premiacoes for all to authenticated using(public.is_admin()) with check(public.is_admin());

grant usage on schema public to authenticated; grant select on public.profiles,public.peladas,public.pelada_participantes,public.ranking_eventos,public.premiacoes to authenticated;
grant select,insert,update,delete on public.profiles,public.peladas,public.pelada_participantes,public.pagamentos,public.ranking_eventos,public.premiacoes to authenticated;
grant usage,select on all sequences in schema public to authenticated;
