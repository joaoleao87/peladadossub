alter table public.peladas
  add column if not exists votacao_encerrada_em timestamptz;

create or replace function public.gerar_proxima_pelada_interna(p_serie_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  v_serie public.pelada_series;
  v_data date;
  v_id uuid;
begin
  select * into v_serie
    from public.pelada_series
   where id = p_serie_id and ativa;
  if not found then raise exception 'Recorrência não encontrada'; end if;

  select p.id into v_id
    from public.peladas p
   where p.serie_id = p_serie_id
     and p.status <> 'cancelada'
     and (p.data > current_date or (p.data = current_date and p.horario >= localtime))
   order by p.data, p.horario
   limit 1;
  if found then return v_id; end if;

  v_data := current_date + ((v_serie.dia_semana - extract(dow from current_date)::integer + 7) % 7);
  if v_data = current_date and localtime > v_serie.horario then
    v_data := v_data + 7;
  end if;

  insert into public.peladas(
    serie_id, data, horario, local, limite_jogadores, status,
    lista_aberta, fase_lista, lista_automatica
  )
  values(
    v_serie.id, v_data, v_serie.horario, v_serie.local,
    v_serie.limite_jogadores, 'aberta', false, 'fechada', true
  )
  on conflict(serie_id, data) where serie_id is not null
  do update set
    horario = excluded.horario,
    local = excluded.local,
    limite_jogadores = excluded.limite_jogadores,
    lista_automatica = true,
    updated_at = now()
  returning id into v_id;

  perform public.sincronizar_fase_lista(v_id);
  return v_id;
end $$;

revoke all on function public.gerar_proxima_pelada_interna(uuid) from public;

create or replace function public.gerar_proxima_pelada(p_serie_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
begin
  if not public.is_admin() then raise exception 'Acesso negado'; end if;
  return public.gerar_proxima_pelada_interna(p_serie_id);
end $$;

revoke all on function public.gerar_proxima_pelada(uuid) from public;
grant execute on function public.gerar_proxima_pelada(uuid) to authenticated;

create or replace function public.criar_proxima_pelada_ao_encerrar()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.status = 'encerrada'
     and old.status is distinct from new.status
     and new.serie_id is not null then
    perform public.gerar_proxima_pelada_interna(new.serie_id);
  end if;
  return new;
end $$;

drop trigger if exists peladas_criar_proxima_ao_encerrar on public.peladas;
create trigger peladas_criar_proxima_ao_encerrar
after update of status on public.peladas
for each row execute function public.criar_proxima_pelada_ao_encerrar();

create or replace function public.encerrar_pelada_ao_completar_cards()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if (
    select count(distinct c.categoria)
      from public.pelada_cards c
     where c.pelada_id = new.pelada_id
       and c.categoria in (
         'destaque', 'surpresa', 'negativo', 'artilheiro',
         'goleiro_destaque', 'time_destaque'
       )
  ) = 6 then
    update public.peladas
       set status = 'encerrada',
           fase_lista = 'encerrada',
           lista_aberta = false,
           lista_automatica = false,
           votacao_encerrada_em = coalesce(votacao_encerrada_em, now()),
           updated_at = now()
     where id = new.pelada_id
       and (status <> 'encerrada' or votacao_encerrada_em is null);
  end if;
  return new;
end $$;

drop trigger if exists cards_encerrar_pelada on public.pelada_cards;
create trigger cards_encerrar_pelada
after insert or update on public.pelada_cards
for each row execute function public.encerrar_pelada_ao_completar_cards();

create or replace function public.validar_voto_pelada(
  p_pelada_id uuid,
  p_avaliado_jogador_id uuid default null
) returns void language plpgsql security definer set search_path='' as $$
declare
  v_meu_jogador_id uuid;
begin
  select id into v_meu_jogador_id
    from public.jogadores
   where user_id = auth.uid() and ativo;

  if not exists(
    select 1
      from public.pelada_participantes pp
      join public.peladas p on p.id = pp.pelada_id
     where pp.pelada_id = p_pelada_id
       and pp.jogador_id = v_meu_jogador_id
       and pp.status in ('confirmado', 'presente')
       and p.status = 'acontecendo'
       and p.votacao_encerrada_em is null
       and p.data + p.horario <= now() at time zone 'America/Sao_Paulo'
  ) then
    raise exception 'A votação desta pelada não está aberta';
  end if;

  if p_avaliado_jogador_id is not null and not exists(
    select 1
      from public.pelada_participantes pp
     where pp.pelada_id = p_pelada_id
       and pp.jogador_id = p_avaliado_jogador_id
       and pp.jogador_id <> v_meu_jogador_id
       and pp.status in ('confirmado', 'presente')
  ) then
    raise exception 'Escolha outro participante desta pelada';
  end if;
end $$;

revoke all on function public.validar_voto_pelada(uuid, uuid) from public;

-- Fecha partidas antigas que já tenham o conjunto completo de cards.
update public.peladas p
   set status = 'encerrada',
       fase_lista = 'encerrada',
       lista_aberta = false,
       lista_automatica = false,
       votacao_encerrada_em = coalesce(p.votacao_encerrada_em, now()),
       updated_at = now()
 where p.status <> 'cancelada'
   and (
     select count(distinct c.categoria)
       from public.pelada_cards c
      where c.pelada_id = p.id
        and c.categoria in (
          'destaque', 'surpresa', 'negativo', 'artilheiro',
          'goleiro_destaque', 'time_destaque'
        )
   ) = 6;

-- Garante uma próxima ocorrência para toda série ativa já existente.
do $$
declare v_serie record;
begin
  for v_serie in select id from public.pelada_series where ativa loop
    perform public.gerar_proxima_pelada_interna(v_serie.id);
  end loop;
end $$;
