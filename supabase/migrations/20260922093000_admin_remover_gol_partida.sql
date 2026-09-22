create or replace function public.admin_excluir_evento_partida(p_event_id uuid)
returns public.pelada_eventos_partida language plpgsql security definer set search_path='' as $$
declare v_event public.pelada_eventos_partida;
begin
  if not public.is_admin() then raise exception 'Acesso negado'; end if;
  select * into v_event from public.pelada_eventos_partida where id=p_event_id for update;
  if not found then raise exception 'Registro não encontrado'; end if;
  if v_event.type<>'GOAL' or v_event.status<>'ACTIVE' then raise exception 'Somente gols ativos podem ser removidos'; end if;
  if v_event.player_id is not null then
    update public.pelada_participantes set gols=greatest(0,coalesce(gols,0)-1),updated_at=now()
    where pelada_id=v_event.pelada_id and jogador_id=v_event.player_id;
  end if;
  if v_event.assist_player_id is not null then
    update public.pelada_participantes set assistencias=greatest(0,coalesce(assistencias,0)-1),updated_at=now()
    where pelada_id=v_event.pelada_id and jogador_id=v_event.assist_player_id;
  end if;
  update public.pelada_eventos_partida set status='CANCELLED',deleted_at=now() where id=v_event.id returning * into v_event;
  update public.pelada_partidas p set
    score_home=(select count(*) from public.pelada_eventos_partida e where e.match_id=p.id and e.type='GOAL' and e.status='ACTIVE' and e.team_id=p.team_home),
    score_away=(select count(*) from public.pelada_eventos_partida e where e.match_id=p.id and e.type='GOAL' and e.status='ACTIVE' and e.team_id=p.team_away),
    updated_at=now()
  where p.id=v_event.match_id;
  update public.recording_cuts set status='CANCELLED',updated_at=now() where event_id=v_event.id and status<>'CANCELLED';
  return v_event;
end $$;

revoke all on function public.admin_excluir_evento_partida(uuid) from public;
grant execute on function public.admin_excluir_evento_partida(uuid) to authenticated;
