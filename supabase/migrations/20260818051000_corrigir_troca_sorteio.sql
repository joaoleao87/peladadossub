create or replace function public.trocar_jogadores_sorteio(
  p_pelada_id uuid,
  p_primeiro uuid,
  p_segundo uuid
) returns void language plpgsql security definer set search_path='' as $$
declare
  v_a public.pelada_times;
  v_b public.pelada_times;
begin
  if not public.is_admin() then raise exception 'Acesso negado'; end if;
  select * into v_a from public.pelada_times
  where pelada_id = p_pelada_id and jogador_id = p_primeiro for update;
  select * into v_b from public.pelada_times
  where pelada_id = p_pelada_id and jogador_id = p_segundo for update;
  if v_a.jogador_id is null or v_b.jogador_id is null then
    raise exception 'Escolha dois jogadores do sorteio';
  end if;
  set constraints public.pelada_times_slot_unique deferred;
  update public.pelada_times
  set time = case when jogador_id = p_primeiro then v_b.time else v_a.time end,
      ordem = case when jogador_id = p_primeiro then v_b.ordem else v_a.ordem end
  where pelada_id = p_pelada_id and jogador_id in (p_primeiro, p_segundo);
end $$;
