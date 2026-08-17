create or replace function public.gerar_sorteio_times(p_pelada_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total integer;
  v_times integer;
  v_resto integer;
  v_time integer;
  v_alvos integer[] = array[]::integer[];
  v_tamanhos integer[] = array[]::integer[];
  v_pontos integer[] = array[]::integer[];
  v_jogador record;
  i integer;
begin
  if not public.is_admin() then raise exception 'Acesso negado'; end if;

  select count(*) into v_total
  from public.pelada_participantes
  where pelada_id = p_pelada_id
    and categoria = 'linha'
    and status in ('confirmado', 'presente');

  if v_total = 0 then raise exception 'Não há jogadores de linha confirmados'; end if;
  if v_total > 20 then raise exception 'O sorteio aceita até 20 jogadores de linha'; end if;

  v_times = ceil(v_total / 4.0);
  v_resto = v_total % 4;
  for i in 1..v_times loop
    v_alvos[i] = case when i <= floor(v_total / 4.0) then 4 else v_resto end;
    v_tamanhos[i] = 0;
    v_pontos[i] = 0;
  end loop;

  delete from public.pelada_times where pelada_id = p_pelada_id;

  for v_jogador in
    select pp.jogador_id, j.nota_equilibrio
    from public.pelada_participantes pp
    join public.jogadores j on j.id = pp.jogador_id
    where pp.pelada_id = p_pelada_id
      and pp.categoria = 'linha'
      and pp.status in ('confirmado', 'presente')
    order by j.nota_equilibrio desc, random()
  loop
    select gs into v_time
    from generate_series(1, v_times) gs
    where v_tamanhos[gs] < v_alvos[gs]
    order by v_pontos[gs], v_tamanhos[gs], random()
    limit 1;

    v_tamanhos[v_time] = v_tamanhos[v_time] + 1;
    v_pontos[v_time] = v_pontos[v_time] + v_jogador.nota_equilibrio;
    insert into public.pelada_times(pelada_id, jogador_id, time, ordem)
    values(p_pelada_id, v_jogador.jogador_id, v_time, v_tamanhos[v_time]);
  end loop;

  update public.peladas
  set sorteio_liberado = false, updated_at = now()
  where id = p_pelada_id;
end
$$;

revoke all on function public.gerar_sorteio_times(uuid) from public;
grant execute on function public.gerar_sorteio_times(uuid) to authenticated;
