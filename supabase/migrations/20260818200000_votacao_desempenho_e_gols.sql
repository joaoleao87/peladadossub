alter table public.pelada_participantes
  add column if not exists gols smallint not null default 0;
alter table public.pelada_participantes
  drop constraint if exists pelada_participantes_gols_check;
alter table public.pelada_participantes
  add constraint pelada_participantes_gols_check check (gols between 0 and 99);

create table if not exists public.pelada_avaliacoes (
  pelada_id uuid not null references public.peladas(id) on delete cascade,
  votante_user_id uuid not null references public.profiles(id) on delete cascade,
  avaliado_jogador_id uuid not null references public.jogadores(id) on delete cascade,
  nota smallint not null check (nota between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (pelada_id, votante_user_id, avaliado_jogador_id)
);

create table if not exists public.pelada_votos (
  pelada_id uuid not null references public.peladas(id) on delete cascade,
  votante_user_id uuid not null references public.profiles(id) on delete cascade,
  categoria text not null check (categoria in ('destaque', 'surpresa', 'negativo')),
  avaliado_jogador_id uuid not null references public.jogadores(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (pelada_id, votante_user_id, categoria)
);

alter table public.pelada_avaliacoes enable row level security;
alter table public.pelada_votos enable row level security;
create policy pelada_avaliacoes_proprias on public.pelada_avaliacoes
  for select to authenticated using (votante_user_id = auth.uid());
create policy pelada_votos_proprios on public.pelada_votos
  for select to authenticated using (votante_user_id = auth.uid());
grant select on public.pelada_avaliacoes, public.pelada_votos to authenticated;

create or replace function public.validar_voto_pelada(
  p_pelada_id uuid,
  p_avaliado_jogador_id uuid default null
) returns void language plpgsql security definer set search_path='' as $$
begin
  if not exists(
    select 1
    from public.pelada_participantes pp
    join public.peladas p on p.id = pp.pelada_id
    where pp.pelada_id = p_pelada_id
      and pp.user_id = auth.uid()
      and pp.status in ('confirmado', 'presente')
      and p.status <> 'cancelada'
      and p.data + p.horario <= now() at time zone 'America/Sao_Paulo'
  ) then
    raise exception 'Somente participantes podem votar depois da pelada';
  end if;
  if p_avaliado_jogador_id is not null and not exists(
    select 1 from public.pelada_participantes pp
    where pp.pelada_id = p_pelada_id
      and pp.jogador_id = p_avaliado_jogador_id
      and pp.status in ('confirmado', 'presente')
      and (pp.user_id is null or pp.user_id <> auth.uid())
  ) then
    raise exception 'Escolha outro participante desta pelada';
  end if;
end $$;
revoke all on function public.validar_voto_pelada(uuid, uuid) from public;

create or replace function public.avaliar_desempenho_pelada(
  p_pelada_id uuid,
  p_jogador_id uuid,
  p_nota integer
) returns void language plpgsql security definer set search_path='' as $$
begin
  if p_nota not between 1 and 5 then raise exception 'A nota deve ser de 1 a 5'; end if;
  perform public.validar_voto_pelada(p_pelada_id, p_jogador_id);
  insert into public.pelada_avaliacoes(
    pelada_id, votante_user_id, avaliado_jogador_id, nota
  ) values(p_pelada_id, auth.uid(), p_jogador_id, p_nota)
  on conflict(pelada_id, votante_user_id, avaliado_jogador_id) do update
  set nota = excluded.nota, updated_at = now();
end $$;
revoke all on function public.avaliar_desempenho_pelada(uuid, uuid, integer) from public;
grant execute on function public.avaliar_desempenho_pelada(uuid, uuid, integer) to authenticated;

create or replace function public.votar_destaque_pelada(
  p_pelada_id uuid,
  p_categoria text,
  p_jogador_id uuid default null
) returns void language plpgsql security definer set search_path='' as $$
begin
  if p_categoria not in ('destaque', 'surpresa', 'negativo') then
    raise exception 'Categoria inválida';
  end if;
  perform public.validar_voto_pelada(p_pelada_id, p_jogador_id);
  if p_jogador_id is null then
    delete from public.pelada_votos
    where pelada_id = p_pelada_id and votante_user_id = auth.uid()
      and categoria = p_categoria;
    return;
  end if;
  insert into public.pelada_votos(
    pelada_id, votante_user_id, categoria, avaliado_jogador_id
  ) values(p_pelada_id, auth.uid(), p_categoria, p_jogador_id)
  on conflict(pelada_id, votante_user_id, categoria) do update
  set avaliado_jogador_id = excluded.avaliado_jogador_id, updated_at = now();
end $$;
revoke all on function public.votar_destaque_pelada(uuid, text, uuid) from public;
grant execute on function public.votar_destaque_pelada(uuid, text, uuid) to authenticated;

create or replace function public.admin_definir_gols(
  p_participante_id uuid,
  p_gols integer
) returns void language plpgsql security definer set search_path='' as $$
begin
  if not public.is_admin() then raise exception 'Acesso negado'; end if;
  if p_gols not between 0 and 99 then raise exception 'Quantidade de gols inválida'; end if;
  update public.pelada_participantes
  set gols = p_gols, updated_at = now()
  where id = p_participante_id and status in ('confirmado', 'presente');
  if not found then raise exception 'Participante não encontrado'; end if;
end $$;
revoke all on function public.admin_definir_gols(uuid, integer) from public;
grant execute on function public.admin_definir_gols(uuid, integer) to authenticated;

create or replace function public.ranking_desempenho() returns table(
  jogador_id uuid,
  user_id uuid,
  nome text,
  apelido text,
  jogos bigint,
  gols bigint,
  media_nota numeric,
  total_avaliacoes bigint,
  votos_destaque bigint,
  votos_surpresa bigint,
  votos_negativo bigint
) language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'Não autenticado'; end if;
  return query
  with participacoes as (
    select pp.jogador_id,
      count(distinct pp.pelada_id)::bigint as jogos,
      coalesce(sum(pp.gols), 0)::bigint as gols
    from public.pelada_participantes pp
    join public.peladas p on p.id = pp.pelada_id
    where pp.status in ('confirmado', 'presente')
      and p.status <> 'cancelada'
      and p.data + p.horario <= now() at time zone 'America/Sao_Paulo'
    group by pp.jogador_id
  ), avaliacoes as (
    select a.avaliado_jogador_id as jogador_id,
      round(avg(a.nota)::numeric, 1) as media_nota,
      count(*)::bigint as total_avaliacoes
    from public.pelada_avaliacoes a
    group by a.avaliado_jogador_id
  ), votos as (
    select v.avaliado_jogador_id as jogador_id,
      count(*) filter(where v.categoria = 'destaque')::bigint as votos_destaque,
      count(*) filter(where v.categoria = 'surpresa')::bigint as votos_surpresa,
      count(*) filter(where v.categoria = 'negativo')::bigint as votos_negativo
    from public.pelada_votos v
    group by v.avaliado_jogador_id
  )
  select j.id, j.user_id, j.nome, j.apelido,
    coalesce(p.jogos, 0), coalesce(p.gols, 0), a.media_nota,
    coalesce(a.total_avaliacoes, 0), coalesce(v.votos_destaque, 0),
    coalesce(v.votos_surpresa, 0), coalesce(v.votos_negativo, 0)
  from public.jogadores j
  left join participacoes p on p.jogador_id = j.id
  left join avaliacoes a on a.jogador_id = j.id
  left join votos v on v.jogador_id = j.id
  where coalesce(p.jogos, 0) > 0 or coalesce(a.total_avaliacoes, 0) > 0
    or coalesce(v.votos_destaque, 0) > 0 or coalesce(v.votos_surpresa, 0) > 0
    or coalesce(v.votos_negativo, 0) > 0;
end $$;
revoke all on function public.ranking_desempenho() from public;
grant execute on function public.ranking_desempenho() to authenticated;
