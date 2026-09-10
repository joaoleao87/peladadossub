-- Diaristas podem deixar intenção antes da abertura: continuam na fila de suplentes.
create or replace function public.responder_pelada(p_pelada_id uuid,p_vai boolean)
returns text language plpgsql security definer set search_path='' as $$
declare v_game public.peladas;v_jogador public.jogadores;v_count integer;v_status public.participante_status;
begin
  select * into v_game from public.peladas where id=p_pelada_id for update;
  if not found or v_game.status in('cancelada','encerrada') then raise exception 'Lista indisponível'; end if;
  select * into v_jogador from public.jogadores where user_id=auth.uid() and ativo;
  if not found then raise exception 'Sua conta ainda não foi vinculada a um jogador'; end if;
  if not p_vai then v_status='recusado';
  elsif v_jogador.tipo='avulso' and v_game.fase_lista<>'geral' then v_status='espera';
  else
    if v_game.fase_lista not in('mensalistas','geral') then raise exception 'Lista indisponível'; end if;
    if v_game.fase_lista='mensalistas' and v_jogador.tipo<>'mensalista' then raise exception 'Aguarde a liberação da lista para diaristas'; end if;
    select count(*) into v_count from public.pelada_participantes
    where pelada_id=p_pelada_id and categoria=v_jogador.posicao
      and status in('confirmado','presente') and jogador_id<>v_jogador.id;
    v_status=case
      when v_jogador.posicao='goleiro' and v_count<3 then 'confirmado'::public.participante_status
      when v_jogador.posicao='linha' and v_count<v_game.limite_jogadores then 'confirmado'::public.participante_status
      else 'espera'::public.participante_status end;
  end if;
  insert into public.pelada_participantes(pelada_id,jogador_id,user_id,status,categoria)
  values(p_pelada_id,v_jogador.id,auth.uid(),v_status,v_jogador.posicao)
  on conflict(pelada_id,jogador_id) do update set status=excluded.status,categoria=excluded.categoria,user_id=excluded.user_id,updated_at=now();
  return v_status::text;
end $$;

-- Quem deixou intenção pode desistir antes de a lista geral abrir.
create or replace function public.sair_da_pelada(p_pelada_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare v_game public.peladas;v_old public.participante_status;v_categoria public.posicao_lista;v_jogador public.jogadores;
begin
  select * into v_game from public.peladas where id=p_pelada_id for update;
  if not found or (now() at time zone 'America/Sao_Paulo')>v_game.data+v_game.horario-interval '3 hours' then raise exception 'Lista indisponível'; end if;
  select * into v_jogador from public.jogadores where user_id=auth.uid() and ativo;
  select status,categoria into v_old,v_categoria from public.pelada_participantes where pelada_id=p_pelada_id and jogador_id=v_jogador.id for update;
  if not found then raise exception 'Inscrição não encontrada'; end if;
  if v_game.fase_lista='fechada' and not(v_jogador.tipo='avulso' and v_old='espera') then raise exception 'Lista indisponível'; end if;
  update public.pelada_participantes set status='cancelado',updated_at=now() where pelada_id=p_pelada_id and jogador_id=v_jogador.id;
  if v_old in('confirmado','presente') and v_categoria='linha' then
    update public.pelada_participantes set status='confirmado',updated_at=now() where id=(select id from public.pelada_participantes where pelada_id=p_pelada_id and status='espera' and categoria='linha' order by ordem_entrada for update skip locked limit 1);
  end if;
end $$;

create table if not exists public.pelada_links_controle (
  id uuid primary key default gen_random_uuid(),
  pelada_id uuid not null references public.peladas(id) on delete cascade,
  token_hash text not null unique,
  ativo boolean not null default true,
  criado_por uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
create unique index if not exists pelada_links_controle_ativo_unique on public.pelada_links_controle(pelada_id) where ativo;
alter table public.pelada_operadores add column if not exists link_id uuid references public.pelada_links_controle(id) on delete set null;

create or replace function public.gerar_link_controle_pelada(p_pelada_id uuid) returns text language plpgsql security definer set search_path='' as $$
declare v_token text:=encode(gen_random_bytes(24),'hex');v_links uuid[];
begin
  if not public.is_admin() then raise exception 'Acesso negado'; end if;
  select array_agg(id) into v_links from public.pelada_links_controle where pelada_id=p_pelada_id and ativo for update;
  update public.pelada_links_controle set ativo=false,revoked_at=now() where id=any(coalesce(v_links,'{}'));
  delete from public.pelada_operadores where link_id=any(coalesce(v_links,'{}'));
  insert into public.pelada_links_controle(pelada_id,token_hash,criado_por) values(p_pelada_id,encode(digest(v_token,'sha256'),'hex'),auth.uid());
  return v_token;
end $$;

create or replace function public.resgatar_link_controle_pelada(p_token text) returns uuid language plpgsql security definer set search_path='' as $$
declare v_link public.pelada_links_controle;
begin
  if auth.uid() is null then raise exception 'Autenticação necessária'; end if;
  select * into v_link from public.pelada_links_controle where ativo and token_hash=encode(digest(p_token,'sha256'),'hex') for update;
  if not found then raise exception 'Link de controle inválido ou revogado'; end if;
  if not exists(select 1 from public.profiles where id=auth.uid() and ativo) then raise exception 'Conta indisponível'; end if;
  insert into public.pelada_operadores(pelada_id,user_id,autorizado_por,link_id)
  values(v_link.pelada_id,auth.uid(),auth.uid(),v_link.id)
  on conflict(pelada_id,user_id) do update set link_id=coalesce(public.pelada_operadores.link_id,excluded.link_id);
  return v_link.pelada_id;
end $$;

revoke all on function public.responder_pelada(uuid,boolean),public.sair_da_pelada(uuid),public.gerar_link_controle_pelada(uuid),public.resgatar_link_controle_pelada(text) from public;
grant execute on function public.responder_pelada(uuid,boolean),public.sair_da_pelada(uuid),public.gerar_link_controle_pelada(uuid),public.resgatar_link_controle_pelada(text) to authenticated;
