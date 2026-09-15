-- O empate é resolvido somente quando um dos times voltar a entrar, sem somar vitória.
create table public.pelada_desempates_partida (
  match_id uuid primary key references public.pelada_partidas(id) on delete cascade,
  pelada_id uuid not null references public.peladas(id) on delete cascade,
  team_home smallint not null check(team_home between 1 and 5),
  team_away smallint not null check(team_away between 1 and 5),
  selected_team smallint check(selected_team between 1 and 5),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  check(team_home<>team_away),
  check(selected_team is null or selected_team in(team_home,team_away))
);
alter table public.pelada_desempates_partida enable row level security;

create or replace function public.finalizar_partida_controlada(
  p_match_id uuid,
  p_client_event_id uuid,
  p_occurred_at timestamptz,
  p_match_clock_ms integer,
  p_winner_team smallint default null
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_match public.pelada_partidas;v_control public.pelada_controles;v_next uuid;v_home smallint;v_away smallint;v_queue smallint[];v_seq integer;v_winner smallint;
begin
  select * into v_match from public.pelada_partidas where id=p_match_id for update;
  if not public.pode_controlar_pelada(v_match.pelada_id) then raise exception 'Acesso negado'; end if;
  if v_match.status='FINISHED' then return (select active_match_id from public.pelada_controles where pelada_id=v_match.pelada_id); end if;
  if v_match.status<>'RUNNING' then raise exception 'A partida não está em andamento'; end if;
  if v_match.score_home=v_match.score_away then
    if p_winner_team is not null then raise exception 'O desempate é resolvido antes de o time entrar novamente'; end if;
    insert into public.pelada_desempates_partida(match_id,pelada_id,team_home,team_away)
    values(v_match.id,v_match.pelada_id,v_match.team_home,v_match.team_away) on conflict(match_id) do nothing;
  else
    v_winner=case when v_match.score_home>v_match.score_away then v_match.team_home else v_match.team_away end;
    if p_winner_team is not null and p_winner_team<>v_winner then raise exception 'O vencedor informado não corresponde ao placar'; end if;
    update public.pelada_times set vitorias=least(99,coalesce(vitorias,0)+1),vencedor=true where pelada_id=v_match.pelada_id and time=v_winner;
  end if;
  update public.pelada_partidas set status='FINISHED',ended_at=p_occurred_at,updated_at=now() where id=p_match_id;
  insert into public.pelada_eventos_partida(client_event_id,pelada_id,match_id,admin_id,type,created_at,corrected_created_at,match_clock_ms)
  values(p_client_event_id,v_match.pelada_id,p_match_id,auth.uid(),'MATCH_FINISHED',p_occurred_at,p_occurred_at,0) on conflict(client_event_id) do nothing;
  select * into v_control from public.pelada_controles where pelada_id=v_match.pelada_id for update;
  v_queue=v_control.team_queue;v_seq=v_match.sequence_number+1;
  if coalesce(array_length(v_queue,1),0)=0 then
    v_home=v_match.team_home;v_away=v_match.team_away;
  elsif v_match.score_home=v_match.score_away and array_length(v_queue,1)>=2 then
    v_home=v_queue[1];v_away=v_queue[2];v_queue=v_queue[3:array_length(v_queue,1)]||array[v_match.team_home,v_match.team_away];
  elsif v_match.score_home>v_match.score_away then
    v_home=v_match.team_home;v_away=v_queue[1];v_queue=v_queue[2:array_length(v_queue,1)]||array[v_match.team_away];
  else
    v_home=v_match.team_away;v_away=v_queue[1];v_queue=v_queue[2:array_length(v_queue,1)]||array[v_match.team_home];
  end if;
  insert into public.pelada_partidas(pelada_id,sequence_number,team_home,team_away) values(v_match.pelada_id,v_seq,v_home,v_away) returning id into v_next;
  update public.pelada_controles set active_match_id=v_next,team_queue=coalesce(v_queue,'{}'),status='READY',updated_at=now() where pelada_id=v_match.pelada_id;
  return v_next;
end $$;

create or replace function public.desempates_pendentes_entrada(p_match_id uuid)
returns table(match_id uuid,team_home smallint,team_away smallint) language plpgsql security definer set search_path='' as $$
declare v_match public.pelada_partidas;
begin
  select * into v_match from public.pelada_partidas where id=p_match_id;
  if not public.pode_controlar_pelada(v_match.pelada_id) then raise exception 'Acesso negado'; end if;
  return query select d.match_id,d.team_home,d.team_away from public.pelada_desempates_partida d
  where d.pelada_id=v_match.pelada_id and d.selected_team is null and v_match.status='CREATED'
    and (v_match.team_home in(d.team_home,d.team_away) or v_match.team_away in(d.team_home,d.team_away));
end $$;

create or replace function public.resolver_desempate_entrada(p_match_id uuid,p_team_id smallint)
returns public.pelada_partidas language plpgsql security definer set search_path='' as $$
declare v_match public.pelada_partidas;v_tie public.pelada_desempates_partida;v_control public.pelada_controles;v_other smallint;v_queue smallint[];
begin
  select * into v_match from public.pelada_partidas where id=p_match_id for update;
  if not public.pode_controlar_pelada(v_match.pelada_id) then raise exception 'Acesso negado'; end if;
  if v_match.status<>'CREATED' then raise exception 'O desempate precisa ser resolvido antes de iniciar a partida'; end if;
  select * into v_tie from public.pelada_desempates_partida where pelada_id=v_match.pelada_id and selected_team is null
    and (v_match.team_home in(pelada_desempates_partida.team_home,pelada_desempates_partida.team_away) or v_match.team_away in(pelada_desempates_partida.team_home,pelada_desempates_partida.team_away)) order by created_at limit 1 for update;
  if not found then raise exception 'Não há desempate pendente para esta partida'; end if;
  if p_team_id not in(v_tie.team_home,v_tie.team_away) then raise exception 'Time inválido para este desempate'; end if;
  v_other=case when p_team_id=v_tie.team_home then v_tie.team_away else v_tie.team_home end;
  if p_team_id not in(v_match.team_home,v_match.team_away) then
    select * into v_control from public.pelada_controles where pelada_id=v_match.pelada_id for update;
    v_queue=array(select team from unnest(v_control.team_queue) as team where team not in(p_team_id,v_other));
    update public.pelada_partidas set team_home=case when team_home=v_other then p_team_id else team_home end,team_away=case when team_away=v_other then p_team_id else team_away end,updated_at=now() where id=p_match_id returning * into v_match;
    update public.pelada_controles set team_queue=array[v_other]||coalesce(v_queue,'{}'),updated_at=now() where pelada_id=v_match.pelada_id;
  end if;
  update public.pelada_desempates_partida set selected_team=p_team_id,resolved_at=now() where match_id=v_tie.match_id;
  return v_match;
end $$;

create or replace function public.iniciar_partida_controlada(p_match_id uuid,p_client_event_id uuid,p_occurred_at timestamptz)
returns public.pelada_partidas language plpgsql security definer set search_path='' as $$
declare v_match public.pelada_partidas;v_control public.pelada_controles;
begin
  select * into v_match from public.pelada_partidas where id=p_match_id for update;
  if not public.pode_controlar_pelada(v_match.pelada_id) then raise exception 'Acesso negado'; end if;
  if v_match.status<>'CREATED' then return v_match; end if;
  if exists(select 1 from public.pelada_desempates_partida d where d.pelada_id=v_match.pelada_id and d.selected_team is null and (v_match.team_home in(d.team_home,d.team_away) or v_match.team_away in(d.team_home,d.team_away))) then raise exception 'Resolva o desempate antes de o time entrar'; end if;
  select * into v_control from public.pelada_controles where pelada_id=v_match.pelada_id;
  update public.pelada_partidas set status='RUNNING',started_at=p_occurred_at,updated_at=now() where id=p_match_id returning * into v_match;
  update public.pelada_controles set status='RUNNING',updated_at=now() where pelada_id=v_match.pelada_id;
  insert into public.pelada_eventos_partida(client_event_id,pelada_id,match_id,admin_id,recording_session_id,type,created_at,corrected_created_at,match_clock_ms,recording_offset_ms) values(p_client_event_id,v_match.pelada_id,p_match_id,auth.uid(),v_control.recording_session_id,'MATCH_STARTED',p_occurred_at,p_occurred_at,v_match.duration_ms,case when v_control.recording_started_at is null then null else extract(epoch from(p_occurred_at-v_control.recording_started_at))*1000 end) on conflict(client_event_id) do nothing;
  return v_match;
end $$;

revoke all on function public.desempates_pendentes_entrada(uuid),public.resolver_desempate_entrada(uuid,smallint) from public;
grant execute on function public.desempates_pendentes_entrada(uuid),public.resolver_desempate_entrada(uuid,smallint) to authenticated;
