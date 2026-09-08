-- Estatísticas oficiais do controle: gols por jogador, vitórias por time e eventos por horário.
create or replace function public.atualizar_autoria_gol_partida(
  p_event_id uuid,
  p_jogador_id uuid,
  p_assist_player_id uuid default null
) returns public.pelada_eventos_partida
language plpgsql security definer set search_path='' as $$
declare
  v_event public.pelada_eventos_partida;
  v_old_player uuid;
  v_old_assist uuid;
begin
  select * into v_event
  from public.pelada_eventos_partida
  where id=p_event_id for update;
  if v_event.id is null then raise exception 'Evento não encontrado'; end if;
  if not public.pode_controlar_pelada(v_event.pelada_id) then raise exception 'Acesso negado'; end if;
  if v_event.type<>'GOAL' or v_event.status<>'ACTIVE' then raise exception 'Somente gols ativos podem receber autoria'; end if;
  if p_jogador_id is null then raise exception 'Informe quem marcou o gol'; end if;
  if p_assist_player_id=p_jogador_id then raise exception 'Autor e assistência precisam ser jogadores diferentes'; end if;
  if not exists(
    select 1 from public.pelada_times
    where pelada_id=v_event.pelada_id and time=v_event.team_id and jogador_id=p_jogador_id
  ) then raise exception 'O autor precisa pertencer ao time do gol'; end if;
  if p_assist_player_id is not null and not exists(
    select 1 from public.pelada_times
    where pelada_id=v_event.pelada_id and time=v_event.team_id and jogador_id=p_assist_player_id
  ) then raise exception 'A assistência precisa pertencer ao time do gol'; end if;

  v_old_player=v_event.player_id;
  v_old_assist=v_event.assist_player_id;
  if v_old_player is distinct from p_jogador_id then
    if v_old_player is not null then
      update public.pelada_participantes
      set gols=greatest(0,coalesce(gols,0)-1),updated_at=now()
      where pelada_id=v_event.pelada_id and jogador_id=v_old_player;
    end if;
    update public.pelada_participantes
    set gols=coalesce(gols,0)+1,updated_at=now()
    where pelada_id=v_event.pelada_id and jogador_id=p_jogador_id;
  end if;
  if v_old_assist is distinct from p_assist_player_id then
    if v_old_assist is not null then
      update public.pelada_participantes
      set assistencias=greatest(0,coalesce(assistencias,0)-1),updated_at=now()
      where pelada_id=v_event.pelada_id and jogador_id=v_old_assist;
    end if;
    if p_assist_player_id is not null then
      update public.pelada_participantes
      set assistencias=coalesce(assistencias,0)+1,updated_at=now()
      where pelada_id=v_event.pelada_id and jogador_id=p_assist_player_id;
    end if;
  end if;

  update public.pelada_eventos_partida
  set player_id=p_jogador_id,assist_player_id=p_assist_player_id
  where id=p_event_id returning * into v_event;
  return v_event;
end $$;

create or replace function public.registrar_evento_partida(
  p_match_id uuid,
  p_client_event_id uuid,
  p_type text,
  p_team_id integer,
  p_occurred_at timestamptz,
  p_match_clock_ms integer,
  p_metadata jsonb default '{}'
) returns public.pelada_eventos_partida
language plpgsql security definer set search_path='' as $$
declare v_match public.pelada_partidas;v_control public.pelada_controles;v_event public.pelada_eventos_partida;
begin
  select * into v_event from public.pelada_eventos_partida where client_event_id=p_client_event_id;
  if found then return v_event; end if;
  select * into v_match from public.pelada_partidas where id=p_match_id for update;
  if not public.pode_controlar_pelada(v_match.pelada_id) then raise exception 'Acesso negado'; end if;
  if v_match.status<>'RUNNING' then raise exception 'A partida não está em andamento'; end if;
  if p_type not in('GOAL','HIGHLIGHT') then raise exception 'Evento inválido'; end if;
  if p_type='GOAL' and p_team_id not in(v_match.team_home,v_match.team_away) then raise exception 'Time inválido'; end if;
  select * into v_control from public.pelada_controles where pelada_id=v_match.pelada_id;
  insert into public.pelada_eventos_partida(
    client_event_id,pelada_id,match_id,admin_id,recording_session_id,type,team_id,
    created_at,corrected_created_at,match_clock_ms,recording_offset_ms,metadata
  ) values(
    p_client_event_id,v_match.pelada_id,p_match_id,auth.uid(),v_control.recording_session_id,p_type,p_team_id,
    p_occurred_at,p_occurred_at,0,
    case when v_control.recording_started_at is null then null
      else extract(epoch from(p_occurred_at-v_control.recording_started_at))*1000 end,
    coalesce(p_metadata,'{}')
  ) returning * into v_event;
  if p_type='GOAL' then
    update public.pelada_partidas set
      score_home=score_home+case when p_team_id=team_home then 1 else 0 end,
      score_away=score_away+case when p_team_id=team_away then 1 else 0 end,
      updated_at=now()
    where id=p_match_id;
  end if;
  return v_event;
end $$;

create or replace function public.desfazer_evento_partida(p_match_id uuid)
returns public.pelada_eventos_partida
language plpgsql security definer set search_path='' as $$
declare
  v_match public.pelada_partidas;
  v_event public.pelada_eventos_partida;
  v_out uuid;
  v_in uuid;
begin
  select * into v_match from public.pelada_partidas where id=p_match_id for update;
  if not public.pode_controlar_pelada(v_match.pelada_id) then raise exception 'Acesso negado'; end if;
  if v_match.status='FINISHED' then raise exception 'A partida já foi finalizada'; end if;
  select * into v_event from public.pelada_eventos_partida
  where match_id=p_match_id and status='ACTIVE'
    and type in('GOAL','HIGHLIGHT','SUBSTITUTION')
  order by corrected_created_at desc,id desc limit 1 for update;
  if v_event.id is null then raise exception 'Não há evento para desfazer'; end if;

  if v_event.type='GOAL' then
    if v_event.player_id is not null then
      update public.pelada_participantes
      set gols=greatest(0,coalesce(gols,0)-1),updated_at=now()
      where pelada_id=v_match.pelada_id and jogador_id=v_event.player_id;
    end if;
    if v_event.assist_player_id is not null then
      update public.pelada_participantes
      set assistencias=greatest(0,coalesce(assistencias,0)-1),updated_at=now()
      where pelada_id=v_match.pelada_id and jogador_id=v_event.assist_player_id;
    end if;
  elsif v_event.type='SUBSTITUTION' then
    v_out=(v_event.metadata->>'jogador_sai')::uuid;
    v_in=(v_event.metadata->>'jogador_entra')::uuid;
    set constraints public.pelada_times_slot_unique deferred;
    if coalesce((v_event.metadata->>'entrada_escalada')::boolean,false) then
      update public.pelada_times
      set time=case jogador_id
            when v_out then (v_event.metadata->>'saida_time')::smallint
            else (v_event.metadata->>'entrada_time')::smallint end,
          ordem=case jogador_id
            when v_out then (v_event.metadata->>'saida_ordem')::smallint
            else (v_event.metadata->>'entrada_ordem')::smallint end
      where pelada_id=v_match.pelada_id and jogador_id in(v_out,v_in);
    else
      delete from public.pelada_times where pelada_id=v_match.pelada_id and jogador_id=v_in;
      insert into public.pelada_times(pelada_id,jogador_id,time,ordem)
      values(v_match.pelada_id,v_out,(v_event.metadata->>'saida_time')::smallint,(v_event.metadata->>'saida_ordem')::smallint);
    end if;
  end if;

  update public.pelada_eventos_partida set status='CANCELLED',deleted_at=now()
  where id=v_event.id returning * into v_event;
  update public.pelada_partidas p set
    score_home=(select count(*) from public.pelada_eventos_partida e
      where e.match_id=p.id and e.type='GOAL' and e.status='ACTIVE' and e.team_id=p.team_home),
    score_away=(select count(*) from public.pelada_eventos_partida e
      where e.match_id=p.id and e.type='GOAL' and e.status='ACTIVE' and e.team_id=p.team_away),
    updated_at=now()
  where p.id=p_match_id;
  return v_event;
end $$;

create or replace function public.finalizar_partida_controlada(
  p_match_id uuid,
  p_client_event_id uuid,
  p_occurred_at timestamptz,
  p_match_clock_ms integer
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

  update public.pelada_partidas set status='FINISHED',ended_at=p_occurred_at,updated_at=now()
  where id=p_match_id;
  insert into public.pelada_eventos_partida(
    client_event_id,pelada_id,match_id,admin_id,type,created_at,corrected_created_at,match_clock_ms
  ) values(p_client_event_id,v_match.pelada_id,p_match_id,auth.uid(),'MATCH_FINISHED',p_occurred_at,p_occurred_at,0)
  on conflict(client_event_id) do nothing;

  if v_match.score_home>v_match.score_away then v_winner=v_match.team_home;
  elsif v_match.score_away>v_match.score_home then v_winner=v_match.team_away;
  else v_winner=null;
  end if;
  if v_winner is not null then
    update public.pelada_times
    set vitorias=least(99,coalesce(vitorias,0)+1),vencedor=true
    where pelada_id=v_match.pelada_id and time=v_winner;
  end if;

  select * into v_control from public.pelada_controles where pelada_id=v_match.pelada_id for update;
  v_queue=v_control.team_queue;
  v_seq=v_match.sequence_number+1;
  if coalesce(array_length(v_queue,1),0)=0 then
    v_home=v_match.team_home;v_away=v_match.team_away;
  elsif v_match.score_home=v_match.score_away and array_length(v_queue,1)>=2 then
    v_home=v_queue[1];v_away=v_queue[2];
    v_queue=v_queue[3:array_length(v_queue,1)]||array[v_match.team_home,v_match.team_away];
  elsif v_match.score_home>=v_match.score_away then
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

revoke all on function public.atualizar_autoria_gol_partida(uuid,uuid,uuid) from public;
grant execute on function public.atualizar_autoria_gol_partida(uuid,uuid,uuid) to authenticated;
