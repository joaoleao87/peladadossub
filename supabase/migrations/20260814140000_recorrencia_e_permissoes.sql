alter table public.profiles add column if not exists posicao_lista public.posicao_lista not null default 'linha';
alter table public.pelada_participantes add column if not exists categoria public.posicao_lista not null default 'linha';
alter table public.peladas add column if not exists fase_lista public.lista_fase not null default 'fechada';
alter table public.peladas add column if not exists motivo_cancelamento text;

create table if not exists public.pelada_series (
  id uuid primary key default gen_random_uuid(),
  nome text not null default 'Pelada semanal',
  dia_semana smallint not null check (dia_semana between 0 and 6),
  horario time not null,
  local text not null,
  limite_jogadores integer not null default 20 check (limite_jogadores > 0),
  antecedencia_mensalistas_horas integer not null default 24 check (antecedencia_mensalistas_horas >= 0),
  antecedencia_geral_horas integer not null default 12 check (antecedencia_geral_horas >= 0),
  ativa boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.peladas add column if not exists serie_id uuid references public.pelada_series(id);
alter table public.pelada_series enable row level security;

create or replace function public.is_superadmin() returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.profiles where id=auth.uid() and role::text='superadmin' and ativo);
$$;
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.profiles where id=auth.uid() and role::text in ('admin','superadmin') and ativo);
$$;
revoke all on function public.is_superadmin() from public;
grant execute on function public.is_superadmin(), public.is_admin() to authenticated;

-- Admin altera somente a classificação esportiva/financeira; roles ficam com o superadmin.
create or replace function public.admin_definir_jogador(p_user_id uuid,p_tipo public.tipo_jogador,p_posicao public.posicao_lista) returns void language plpgsql security definer set search_path='' as $$
begin
  if not public.is_admin() then raise exception 'Acesso negado'; end if;
  update public.profiles set tipo_jogador=p_tipo, mensalista_ativo=(p_tipo='mensalista'), posicao_lista=p_posicao, updated_at=now() where id=p_user_id;
end $$;
revoke all on function public.admin_definir_jogador(uuid,public.tipo_jogador,public.posicao_lista) from public;
grant execute on function public.admin_definir_jogador(uuid,public.tipo_jogador,public.posicao_lista) to authenticated;

-- Abre a janela antecipada e vincula mensalistas como convidados, sem ocupar vaga.
create or replace function public.abrir_lista_mensalistas(p_pelada_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
  if not public.is_admin() then raise exception 'Acesso negado'; end if;
  perform 1 from public.peladas where id=p_pelada_id for update;
  update public.peladas set fase_lista='mensalistas',lista_aberta=true,updated_at=now() where id=p_pelada_id;
  insert into public.pelada_participantes(pelada_id,user_id,status,categoria)
  select p_pelada_id,id,'aguardando_resposta',posicao_lista from public.profiles where mensalista_ativo and ativo
  on conflict(pelada_id,user_id) do nothing;
end $$;

create or replace function public.definir_fase_lista(p_pelada_id uuid,p_fase public.lista_fase) returns void language plpgsql security definer set search_path='' as $$
begin
  if not public.is_admin() then raise exception 'Acesso negado'; end if;
  update public.peladas set fase_lista=p_fase,lista_aberta=(p_fase in ('mensalistas','geral')),updated_at=now() where id=p_pelada_id;
end $$;

-- Resposta e entrada usam a trava da pelada; goleiros nunca consomem as 20 vagas.
create or replace function public.responder_pelada(p_pelada_id uuid,p_vai boolean) returns text language plpgsql security definer set search_path='' as $$
declare v_game public.peladas; v_profile public.profiles; v_count integer; v_status public.participante_status;
begin
  if auth.uid() is null then raise exception 'Autenticação necessária'; end if;
  select * into v_game from public.peladas where id=p_pelada_id for update;
  select * into v_profile from public.profiles where id=auth.uid();
  if not found or v_game.fase_lista not in ('mensalistas','geral') then raise exception 'Lista indisponível'; end if;
  if v_game.fase_lista='mensalistas' and not v_profile.mensalista_ativo then raise exception 'Lista exclusiva para mensalistas'; end if;
  if not p_vai then v_status='recusado';
  elsif v_profile.posicao_lista='goleiro' then v_status='confirmado';
  else
    select count(*) into v_count from public.pelada_participantes where pelada_id=p_pelada_id and categoria='linha' and status in ('confirmado','presente');
    v_status=case when v_count < v_game.limite_jogadores then 'confirmado' else 'espera' end;
  end if;
  insert into public.pelada_participantes(pelada_id,user_id,status,categoria) values(p_pelada_id,auth.uid(),v_status,v_profile.posicao_lista)
  on conflict(pelada_id,user_id) do update set status=v_status,categoria=v_profile.posicao_lista,updated_at=now();
  return v_status::text;
end $$;

create or replace function public.entrar_na_pelada(p_pelada_id uuid) returns text language sql security definer set search_path='' as $$ select public.responder_pelada(p_pelada_id,true) $$;
revoke all on function public.abrir_lista_mensalistas(uuid),public.definir_fase_lista(uuid,public.lista_fase),public.responder_pelada(uuid,boolean) from public;
grant execute on function public.abrir_lista_mensalistas(uuid),public.definir_fase_lista(uuid,public.lista_fase),public.responder_pelada(uuid,boolean) to authenticated;

drop policy if exists profiles_admin on public.profiles;
drop policy if exists profiles_superadmin on public.profiles;
create policy profiles_superadmin on public.profiles for all to authenticated using(public.is_superadmin()) with check(public.is_superadmin());
drop policy if exists series_read on public.pelada_series;
drop policy if exists series_admin on public.pelada_series;
create policy series_read on public.pelada_series for select to authenticated using(true);
create policy series_admin on public.pelada_series for all to authenticated using(public.is_admin()) with check(public.is_admin());
grant select,insert,update,delete on public.pelada_series to authenticated;
