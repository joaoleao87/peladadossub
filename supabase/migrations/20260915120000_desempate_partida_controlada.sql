-- Em placar empatado, o operador deve declarar qual dos dois times venceu.
drop function public.finalizar_partida_controlada(uuid,uuid,timestamptz,integer);

create function public.finalizar_partida_controlada(
  p_match_id uuid,
  p_client_event_id uuid,
  p_occurred_at timestamptz,
  p_match_clock_ms integer,
  p_winner_team smallint default null
) returns uuid language plpgsql security definer set search_path='' as $$
declare
  v_match public.pelada_partidas;
  v_control public.pelada_controles;
  v_next uuid;
  v_home smallint;
  v_away smallint;
  v_queue smallint[];
  v_seq integer;
  v_winner smallint;
begin
  select * into v_match from public.pelada_partidas where id=p_match_id for update;
  if not public.pode_controlar_pelada(v_match.pelada_id) then raise exception 'Acesso negado'; end if;
  if v_match.status='FINISHED' then
    return (select active_match_id from public.pelada_controles where pelada_id=v_match.pelada_id);
  end if;
  if v_match.status<>'RUNNING' then raise exception 'A partida não está em andamento'; end if;

  if v_match.score_home>v_match.score_away then
    v_winner=v_match.team_home;
  elsif v_match.score_away>v_match.score_home then
    v_winner=v_match.team_away;
  elsif p_winner_team in(v_match.team_home,v_match.team_away) then
    v_winner=p_winner_team;
  else
    raise exception 'Em caso de empate, escolha o vencedor';
  end if;

  if p_winner_team is not null and p_winner_team<>v_winner then
    raise exception 'O vencedor informado não corresponde ao placar';
  end if;

  update public.pelada_partidas set status='FINISHED',ended_at=p_occurred_at,updated_at=now()
  where id=p_match_id;
  insert into public.pelada_eventos_partida(
    client_event_id,pelada_id,match_id,admin_id,type,created_at,corrected_created_at,match_clock_ms
  ) values(p_client_event_id,v_match.pelada_id,p_match_id,auth.uid(),'MATCH_FINISHED',p_occurred_at,p_occurred_at,0)
  on conflict(client_event_id) do nothing;

  update public.pelada_times
  set vitorias=least(99,coalesce(vitorias,0)+1),vencedor=true
  where pelada_id=v_match.pelada_id and time=v_winner;

  select * into v_control from public.pelada_controles where pelada_id=v_match.pelada_id for update;
  v_queue=v_control.team_queue;
  v_seq=v_match.sequence_number+1;
  if coalesce(array_length(v_queue,1),0)=0 then
    v_home=v_match.team_home;v_away=v_match.team_away;
  elsif v_winner=v_match.team_home then
    v_home=v_match.team_home;v_away=v_queue[1];
    v_queue=v_queue[2:array_length(v_queue,1)]||array[v_match.team_away];
  else
    v_home=v_match.team_away;v_away=v_queue[1];
    v_queue=v_queue[2:array_length(v_queue,1)]||array[v_match.team_home];
  end if;
  insert into public.pelada_partidas(pelada_id,sequence_number,team_home,team_away)
  values(v_match.pelada_id,v_seq,v_home,v_away) returning id into v_next;
  update public.pelada_controles
  set active_match_id=v_next,team_queue=coalesce(v_queue,'{}'),status='READY',updated_at=now()
  where pelada_id=v_match.pelada_id;
  return v_next;
end $$;

revoke all on function public.finalizar_partida_controlada(uuid,uuid,timestamptz,integer,smallint) from public;
grant execute on function public.finalizar_partida_controlada(uuid,uuid,timestamptz,integer,smallint) to authenticated;
