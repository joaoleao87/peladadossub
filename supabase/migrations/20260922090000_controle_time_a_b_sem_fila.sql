-- O controle usa sempre os dois primeiros times sorteados, exibidos como Time A e Time B.
create or replace function public.inicializar_controle_pelada(p_pelada_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_match_id uuid;v_teams smallint[];
begin
  if not public.pode_controlar_pelada(p_pelada_id) then raise exception 'Acesso negado'; end if;
  select array_agg(time order by time) into v_teams from (
    select distinct time from public.pelada_times where pelada_id=p_pelada_id order by time limit 2
  ) times;
  if coalesce(array_length(v_teams,1),0)<2 then raise exception 'É necessário ter pelo menos dois times sorteados'; end if;
  insert into public.pelada_controles(pelada_id,status,team_queue)
  values(p_pelada_id,'READY','{}')
  on conflict(pelada_id) do update set
    status=case when pelada_controles.active_match_id is null then 'READY' else pelada_controles.status end,
    team_queue='{}',updated_at=now();
  select active_match_id into v_match_id from public.pelada_controles where pelada_id=p_pelada_id for update;
  if v_match_id is null then
    insert into public.pelada_partidas(pelada_id,sequence_number,team_home,team_away)
    values(p_pelada_id,1,v_teams[1],v_teams[2]) returning id into v_match_id;
    update public.pelada_controles set active_match_id=v_match_id,status='READY',updated_at=now() where pelada_id=p_pelada_id;
  end if;
  return v_match_id;
end $$;

create or replace function public.iniciar_partida_controlada(p_match_id uuid,p_client_event_id uuid,p_occurred_at timestamptz)
returns public.pelada_partidas language plpgsql security definer set search_path='' as $$
declare v_match public.pelada_partidas;v_control public.pelada_controles;
begin
  select * into v_match from public.pelada_partidas where id=p_match_id for update;
  if not public.pode_controlar_pelada(v_match.pelada_id) then raise exception 'Acesso negado'; end if;
  if v_match.status<>'CREATED' then return v_match; end if;
  select * into v_control from public.pelada_controles where pelada_id=v_match.pelada_id;
  update public.pelada_partidas set status='RUNNING',started_at=p_occurred_at,updated_at=now() where id=p_match_id returning * into v_match;
  update public.pelada_controles set status='RUNNING',team_queue='{}',updated_at=now() where pelada_id=v_match.pelada_id;
  insert into public.pelada_eventos_partida(client_event_id,pelada_id,match_id,admin_id,recording_session_id,type,created_at,corrected_created_at,match_clock_ms,recording_offset_ms)
  values(p_client_event_id,v_match.pelada_id,p_match_id,auth.uid(),v_control.recording_session_id,'MATCH_STARTED',p_occurred_at,p_occurred_at,v_match.duration_ms,case when v_control.recording_started_at is null then null else extract(epoch from(p_occurred_at-v_control.recording_started_at))*1000 end)
  on conflict(client_event_id) do nothing;
  return v_match;
end $$;

create or replace function public.finalizar_partida_controlada(p_match_id uuid,p_client_event_id uuid,p_occurred_at timestamptz,p_match_clock_ms integer,p_winner_team smallint default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_match public.pelada_partidas;v_next uuid;v_winner smallint;
begin
  select * into v_match from public.pelada_partidas where id=p_match_id for update;
  if not public.pode_controlar_pelada(v_match.pelada_id) then raise exception 'Acesso negado'; end if;
  if v_match.status='FINISHED' then return (select active_match_id from public.pelada_controles where pelada_id=v_match.pelada_id); end if;
  if v_match.status<>'RUNNING' then raise exception 'A partida não está em andamento'; end if;
  if p_winner_team is not null and p_winner_team not in(v_match.team_home,v_match.team_away) then raise exception 'Time vencedor inválido'; end if;
  v_winner=case when v_match.score_home>v_match.score_away then v_match.team_home when v_match.score_away>v_match.score_home then v_match.team_away else p_winner_team end;
  if v_winner is not null then update public.pelada_times set vitorias=least(99,coalesce(vitorias,0)+1),vencedor=true where pelada_id=v_match.pelada_id and time=v_winner; end if;
  update public.pelada_partidas set status='FINISHED',ended_at=p_occurred_at,updated_at=now() where id=p_match_id;
  insert into public.pelada_eventos_partida(client_event_id,pelada_id,match_id,admin_id,type,created_at,corrected_created_at,match_clock_ms)
  values(p_client_event_id,v_match.pelada_id,p_match_id,auth.uid(),'MATCH_FINISHED',p_occurred_at,p_occurred_at,0) on conflict(client_event_id) do nothing;
  insert into public.pelada_partidas(pelada_id,sequence_number,team_home,team_away)
  values(v_match.pelada_id,v_match.sequence_number+1,v_match.team_home,v_match.team_away) returning id into v_next;
  update public.pelada_controles set active_match_id=v_next,team_queue='{}',status='READY',updated_at=now() where pelada_id=v_match.pelada_id;
  return v_next;
end $$;

-- A autoria é da pelada, não da escalação atual: goleiros e todos os participantes são elegíveis.
create or replace function public.atualizar_autoria_gol_partida(p_event_id uuid,p_jogador_id uuid,p_assist_player_id uuid default null)
returns public.pelada_eventos_partida language plpgsql security definer set search_path='' as $$
declare v_event public.pelada_eventos_partida;v_old_player uuid;v_old_assist uuid;
begin
  select * into v_event from public.pelada_eventos_partida where id=p_event_id for update;
  if v_event.id is null then raise exception 'Evento não encontrado'; end if;
  if not public.pode_controlar_pelada(v_event.pelada_id) then raise exception 'Acesso negado'; end if;
  if v_event.type<>'GOAL' or v_event.status<>'ACTIVE' then raise exception 'Somente gols ativos podem receber autoria'; end if;
  if p_jogador_id is null then raise exception 'Informe quem marcou o gol'; end if;
  if p_assist_player_id=p_jogador_id then raise exception 'Autor e assistência precisam ser jogadores diferentes'; end if;
  if not exists(select 1 from public.pelada_participantes where pelada_id=v_event.pelada_id and jogador_id=p_jogador_id and status<>'cancelado') then raise exception 'O autor precisa participar da pelada'; end if;
  if p_assist_player_id is not null and not exists(select 1 from public.pelada_participantes where pelada_id=v_event.pelada_id and jogador_id=p_assist_player_id and status<>'cancelado') then raise exception 'A assistência precisa pertencer à pelada'; end if;
  v_old_player=v_event.player_id;v_old_assist=v_event.assist_player_id;
  if v_old_player is distinct from p_jogador_id then
    if v_old_player is not null then update public.pelada_participantes set gols=greatest(0,coalesce(gols,0)-1),updated_at=now() where pelada_id=v_event.pelada_id and jogador_id=v_old_player; end if;
    update public.pelada_participantes set gols=coalesce(gols,0)+1,updated_at=now() where pelada_id=v_event.pelada_id and jogador_id=p_jogador_id;
  end if;
  if v_old_assist is distinct from p_assist_player_id then
    if v_old_assist is not null then update public.pelada_participantes set assistencias=greatest(0,coalesce(assistencias,0)-1),updated_at=now() where pelada_id=v_event.pelada_id and jogador_id=v_old_assist; end if;
    if p_assist_player_id is not null then update public.pelada_participantes set assistencias=coalesce(assistencias,0)+1,updated_at=now() where pelada_id=v_event.pelada_id and jogador_id=p_assist_player_id; end if;
  end if;
  update public.pelada_eventos_partida set player_id=p_jogador_id,assist_player_id=p_assist_player_id where id=p_event_id returning * into v_event;
  return v_event;
end $$;
