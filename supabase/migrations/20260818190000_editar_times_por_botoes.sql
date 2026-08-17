create or replace function public.remover_jogador_sorteio(
  p_pelada_id uuid,
  p_jogador_id uuid
) returns void language plpgsql security definer set search_path='' as $$
begin
  if not public.is_admin() then raise exception 'Acesso negado'; end if;
  perform 1 from public.peladas where id = p_pelada_id for update;
  if not found then raise exception 'Pelada não encontrada'; end if;
  delete from public.pelada_times
  where pelada_id = p_pelada_id and jogador_id = p_jogador_id;
  if not found then raise exception 'Jogador não está em nenhum time'; end if;
  update public.peladas
  set sorteio_liberado = false, updated_at = now()
  where id = p_pelada_id;
end $$;
revoke all on function public.remover_jogador_sorteio(uuid, uuid) from public;
grant execute on function public.remover_jogador_sorteio(uuid, uuid) to authenticated;

create or replace function public.adicionar_jogador_sorteio(
  p_pelada_id uuid,
  p_jogador_id uuid,
  p_time integer
) returns void language plpgsql security definer set search_path='' as $$
declare
  v_ordem integer;
begin
  if not public.is_admin() then raise exception 'Acesso negado'; end if;
  if p_time not between 1 and 5 then raise exception 'Time inválido'; end if;
  perform 1 from public.peladas where id = p_pelada_id for update;
  if not found then raise exception 'Pelada não encontrada'; end if;
  if not exists(
    select 1 from public.pelada_participantes
    where pelada_id = p_pelada_id and jogador_id = p_jogador_id
      and categoria = 'linha' and status in ('confirmado', 'presente')
  ) then
    raise exception 'Jogador não está confirmado na linha';
  end if;
  select slot into v_ordem
  from generate_series(1, 4) as slots(slot)
  where not exists(
    select 1 from public.pelada_times
    where pelada_id = p_pelada_id and time = p_time and ordem = slot
  )
  order by slot limit 1;
  if v_ordem is null then raise exception 'Este time já tem 4 jogadores'; end if;
  insert into public.pelada_times(pelada_id, jogador_id, time, ordem)
  values(p_pelada_id, p_jogador_id, p_time, v_ordem);
  update public.peladas
  set sorteio_liberado = false, updated_at = now()
  where id = p_pelada_id;
end $$;
revoke all on function public.adicionar_jogador_sorteio(uuid, uuid, integer) from public;
grant execute on function public.adicionar_jogador_sorteio(uuid, uuid, integer) to authenticated;

create or replace function public.publicar_sorteio_times(
  p_pelada_id uuid,
  p_liberado boolean
) returns void language plpgsql security definer set search_path='' as $$
declare
  v_total integer;
  v_times integer;
  v_time integer;
  v_quantidade integer;
  v_esperado integer;
begin
  if not public.is_admin() then raise exception 'Acesso negado'; end if;
  if p_liberado then
    select count(*) into v_total from public.pelada_participantes
    where pelada_id = p_pelada_id and categoria = 'linha'
      and status in ('confirmado', 'presente');
    if v_total = 0 then raise exception 'Não há jogadores confirmados'; end if;
    v_times = ceil(v_total / 4.0);
    for v_time in 1..v_times loop
      v_esperado = case
        when v_time < v_times or v_total % 4 = 0 then 4
        else v_total % 4
      end;
      select count(*) into v_quantidade from public.pelada_times
      where pelada_id = p_pelada_id and time = v_time;
      if v_quantidade <> v_esperado then
        raise exception 'Complete a distribuição dos times antes de liberar';
      end if;
    end loop;
    select count(*) into v_quantidade from public.pelada_times
    where pelada_id = p_pelada_id;
    if v_quantidade <> v_total then
      raise exception 'Todos os jogadores devem estar em um time';
    end if;
  end if;
  update public.peladas
  set sorteio_liberado = p_liberado, updated_at = now()
  where id = p_pelada_id;
end $$;
grant execute on function public.publicar_sorteio_times(uuid, boolean) to authenticated;
