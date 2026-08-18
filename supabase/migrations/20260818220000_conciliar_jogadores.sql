create or replace function public.conciliar_jogadores(p_origem_id uuid, p_destino_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Acesso negado'; end if;
  if p_origem_id = p_destino_id then raise exception 'Escolha dois jogadores diferentes'; end if;
  if not exists(select 1 from public.jogadores where id = p_origem_id and ativo)
    or not exists(select 1 from public.jogadores where id = p_destino_id and ativo) then
    raise exception 'Jogador não encontrado';
  end if;

  update public.pagamentos set jogador_id = p_destino_id where jogador_id = p_origem_id;

  insert into public.pelada_avaliacoes(pelada_id, votante_user_id, avaliado_jogador_id, nota, updated_at)
  select pelada_id, votante_user_id, p_destino_id, nota, updated_at
  from public.pelada_avaliacoes where avaliado_jogador_id = p_origem_id
  on conflict(pelada_id, votante_user_id, avaliado_jogador_id) do nothing;
  delete from public.pelada_avaliacoes where avaliado_jogador_id = p_origem_id;

  update public.pelada_votos set avaliado_jogador_id = p_destino_id
  where avaliado_jogador_id = p_origem_id;

  delete from public.pelada_times origem using public.pelada_times destino
  where origem.jogador_id = p_origem_id and destino.jogador_id = p_destino_id
    and origem.pelada_id = destino.pelada_id;
  update public.pelada_times set jogador_id = p_destino_id where jogador_id = p_origem_id;

  update public.pelada_participantes destino
  set status = case
        when origem.status in ('presente', 'confirmado') then origem.status
        else destino.status
      end,
      categoria = origem.categoria,
      gols = coalesce(destino.gols, 0) + coalesce(origem.gols, 0),
      user_id = coalesce(destino.user_id, origem.user_id),
      updated_at = now()
  from public.pelada_participantes origem
  where origem.jogador_id = p_origem_id and destino.jogador_id = p_destino_id
    and origem.pelada_id = destino.pelada_id;
  delete from public.pelada_participantes origem using public.pelada_participantes destino
  where origem.jogador_id = p_origem_id and destino.jogador_id = p_destino_id
    and origem.pelada_id = destino.pelada_id;
  update public.pelada_participantes set jogador_id = p_destino_id
  where jogador_id = p_origem_id;

  update public.jogadores set ativo = false, user_id = null, updated_at = now()
  where id = p_origem_id;
end $$;

revoke all on function public.conciliar_jogadores(uuid, uuid) from public;
grant execute on function public.conciliar_jogadores(uuid, uuid) to authenticated;
