-- Parte 1: controle esportivo, autorização por pelada, eventos e rodízio.
create table public.pelada_operadores (
  pelada_id uuid not null references public.peladas(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  autorizado_por uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  primary key (pelada_id,user_id)
);

create table public.pelada_controles (
  pelada_id uuid primary key references public.peladas(id) on delete cascade,
  status text not null default 'CREATED' check(status in('CREATED','READY','RUNNING','FINISHED')),
  active_match_id uuid,
  team_queue smallint[] not null default '{}',
  device_camera_online boolean not null default false,
  recording_session_id uuid,
  recording_started_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.pelada_partidas (
  id uuid primary key default gen_random_uuid(),
  pelada_id uuid not null references public.peladas(id) on delete cascade,
  sequence_number integer not null check(sequence_number > 0),
  team_home smallint not null check(team_home between 1 and 5),
  team_away smallint not null check(team_away between 1 and 5),
  score_home integer not null default 0 check(score_home >= 0),
  score_away integer not null default 0 check(score_away >= 0),
  duration_ms integer not null default 600000 check(duration_ms > 0),
  started_at timestamptz,
  ended_at timestamptz,
  status text not null default 'CREATED' check(status in('CREATED','RUNNING','FINISHED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(pelada_id,sequence_number),
  check(team_home <> team_away)
);
alter table public.pelada_controles add constraint pelada_controles_active_match_fk
  foreign key(active_match_id) references public.pelada_partidas(id) on delete set null;

create table public.pelada_dispositivos (
  id uuid primary key default gen_random_uuid(),
  pelada_id uuid not null references public.peladas(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  device_id text not null,
  mode text not null check(mode in('CONTROL','CAMERA')),
  status text not null default 'ONLINE' check(status in('ONLINE','OFFLINE')),
  server_time_offset_ms integer not null default 0,
  connected_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique(pelada_id,device_id)
);

create table public.pelada_eventos_partida (
  id uuid primary key default gen_random_uuid(),
  client_event_id uuid not null unique,
  pelada_id uuid not null references public.peladas(id) on delete cascade,
  match_id uuid not null references public.pelada_partidas(id) on delete cascade,
  admin_id uuid not null references public.profiles(id),
  recording_session_id uuid,
  type text not null check(type in('MATCH_STARTED','GOAL','HIGHLIGHT','SUBSTITUTION','MATCH_FINISHED')),
  team_id smallint check(team_id between 1 and 5),
  player_id uuid references public.jogadores(id),
  assist_player_id uuid references public.jogadores(id),
  created_at timestamptz not null,
  corrected_created_at timestamptz not null,
  match_clock_ms integer not null,
  recording_offset_ms bigint,
  metadata jsonb not null default '{}',
  sync_status text not null default 'SYNCED' check(sync_status in('LOCAL','PENDING','SYNCED','ERROR')),
  status text not null default 'ACTIVE' check(status in('ACTIVE','CANCELLED')),
  deleted_at timestamptz
);

create or replace function public.pode_controlar_pelada(p_pelada_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select public.is_admin() or exists(
    select 1 from public.pelada_operadores
    where pelada_id=p_pelada_id and user_id=auth.uid()
  )
$$;
revoke all on function public.pode_controlar_pelada(uuid) from public;
grant execute on function public.pode_controlar_pelada(uuid) to authenticated;

alter table public.pelada_operadores enable row level security;
alter table public.pelada_controles enable row level security;
alter table public.pelada_partidas enable row level security;
alter table public.pelada_dispositivos enable row level security;
alter table public.pelada_eventos_partida enable row level security;
create policy operadores_read on public.pelada_operadores for select to authenticated using(public.pode_controlar_pelada(pelada_id));
create policy controles_read on public.pelada_controles for select to authenticated using(public.pode_controlar_pelada(pelada_id));
create policy partidas_read on public.pelada_partidas for select to authenticated using(public.pode_controlar_pelada(pelada_id));
create policy dispositivos_read on public.pelada_dispositivos for select to authenticated using(public.pode_controlar_pelada(pelada_id));
create policy eventos_partida_read on public.pelada_eventos_partida for select to authenticated using(public.pode_controlar_pelada(pelada_id));
create policy pelada_times_operador_read on public.pelada_times for select to authenticated using(public.pode_controlar_pelada(pelada_id));
grant select on public.pelada_operadores,public.pelada_controles,public.pelada_partidas,public.pelada_dispositivos,public.pelada_eventos_partida to authenticated;

create or replace function public.admin_autorizar_operador_pelada(p_pelada_id uuid,p_user_id uuid,p_autorizar boolean)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not public.is_admin() then raise exception 'Acesso negado'; end if;
  if p_user_id=auth.uid() then raise exception 'Administradores já possuem acesso'; end if;
  if p_autorizar then
    insert into public.pelada_operadores(pelada_id,user_id,autorizado_por)
    values(p_pelada_id,p_user_id,auth.uid()) on conflict do nothing;
  else delete from public.pelada_operadores where pelada_id=p_pelada_id and user_id=p_user_id;
  end if;
end $$;

create or replace function public.horario_servidor()
returns timestamptz language sql stable set search_path='' as $$select clock_timestamp()$$;

create or replace function public.inicializar_controle_pelada(p_pelada_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_match_id uuid;v_count integer;v_teams smallint[];
begin
  if not public.pode_controlar_pelada(p_pelada_id) then raise exception 'Acesso negado'; end if;
  select count(distinct time),array_agg(distinct time order by time) into v_count,v_teams
  from public.pelada_times where pelada_id=p_pelada_id;
  if v_count<2 then raise exception 'É necessário ter pelo menos dois times sorteados'; end if;
  insert into public.pelada_controles(pelada_id,status,team_queue)
  values(p_pelada_id,'READY',coalesce(v_teams[3:array_length(v_teams,1)],'{}'))
  on conflict(pelada_id) do nothing;
  select active_match_id into v_match_id from public.pelada_controles where pelada_id=p_pelada_id for update;
  if v_match_id is null then
    insert into public.pelada_partidas(pelada_id,sequence_number,team_home,team_away)
    values(p_pelada_id,1,v_teams[1],v_teams[2]) returning id into v_match_id;
    update public.pelada_controles set active_match_id=v_match_id,status='READY',updated_at=now() where pelada_id=p_pelada_id;
  end if;
  return v_match_id;
end $$;

create or replace function public.registrar_dispositivo_pelada(p_pelada_id uuid,p_device_id text,p_mode text,p_server_offset integer default 0)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
  if not public.pode_controlar_pelada(p_pelada_id) then raise exception 'Acesso negado'; end if;
  if p_mode not in('CONTROL','CAMERA') then raise exception 'Modo inválido'; end if;
  insert into public.pelada_dispositivos(pelada_id,user_id,device_id,mode,server_time_offset_ms)
  values(p_pelada_id,auth.uid(),p_device_id,p_mode,p_server_offset)
  on conflict(pelada_id,device_id) do update set user_id=auth.uid(),mode=excluded.mode,status='ONLINE',server_time_offset_ms=excluded.server_time_offset_ms,last_seen_at=now()
  returning id into v_id;
  return v_id;
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
  update public.pelada_controles set status='RUNNING',updated_at=now() where pelada_id=v_match.pelada_id;
  insert into public.pelada_eventos_partida(client_event_id,pelada_id,match_id,admin_id,recording_session_id,type,created_at,corrected_created_at,match_clock_ms,recording_offset_ms)
  values(p_client_event_id,v_match.pelada_id,p_match_id,auth.uid(),v_control.recording_session_id,'MATCH_STARTED',p_occurred_at,p_occurred_at,v_match.duration_ms,
    case when v_control.recording_started_at is null then null else extract(epoch from(p_occurred_at-v_control.recording_started_at))*1000 end)
  on conflict(client_event_id) do nothing;
  return v_match;
end $$;

create or replace function public.registrar_evento_partida(
  p_match_id uuid,p_client_event_id uuid,p_type text,p_team_id integer,p_occurred_at timestamptz,p_match_clock_ms integer,p_metadata jsonb default '{}'
) returns public.pelada_eventos_partida language plpgsql security definer set search_path='' as $$
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
  insert into public.pelada_eventos_partida(client_event_id,pelada_id,match_id,admin_id,recording_session_id,type,team_id,created_at,corrected_created_at,match_clock_ms,recording_offset_ms,metadata)
  values(p_client_event_id,v_match.pelada_id,p_match_id,auth.uid(),v_control.recording_session_id,p_type,p_team_id,p_occurred_at,p_occurred_at,greatest(0,p_match_clock_ms),
    case when v_control.recording_started_at is null then null else extract(epoch from(p_occurred_at-v_control.recording_started_at))*1000 end,coalesce(p_metadata,'{}'))
  returning * into v_event;
  if p_type='GOAL' then
    update public.pelada_partidas set
      score_home=score_home+case when p_team_id=team_home then 1 else 0 end,
      score_away=score_away+case when p_team_id=team_away then 1 else 0 end,updated_at=now()
    where id=p_match_id;
  end if;
  return v_event;
end $$;

create or replace function public.desfazer_evento_partida(p_match_id uuid)
returns public.pelada_eventos_partida language plpgsql security definer set search_path='' as $$
declare v_match public.pelada_partidas;v_event public.pelada_eventos_partida;
begin
  select * into v_match from public.pelada_partidas where id=p_match_id for update;
  if not public.pode_controlar_pelada(v_match.pelada_id) then raise exception 'Acesso negado'; end if;
  select * into v_event from public.pelada_eventos_partida
  where match_id=p_match_id and status='ACTIVE' and type in('GOAL','HIGHLIGHT','SUBSTITUTION')
  order by corrected_created_at desc,id desc limit 1 for update;
  if v_event.id is null then raise exception 'Não há evento para desfazer'; end if;
  update public.pelada_eventos_partida set status='CANCELLED',deleted_at=now() where id=v_event.id returning * into v_event;
  update public.pelada_partidas p set
    score_home=(select count(*) from public.pelada_eventos_partida e where e.match_id=p.id and e.type='GOAL' and e.status='ACTIVE' and e.team_id=p.team_home),
    score_away=(select count(*) from public.pelada_eventos_partida e where e.match_id=p.id and e.type='GOAL' and e.status='ACTIVE' and e.team_id=p.team_away),
    updated_at=now() where p.id=p_match_id;
  return v_event;
end $$;

create or replace function public.finalizar_partida_controlada(p_match_id uuid,p_client_event_id uuid,p_occurred_at timestamptz,p_match_clock_ms integer)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_match public.pelada_partidas;v_control public.pelada_controles;v_next uuid;v_home smallint;v_away smallint;v_queue smallint[];v_seq integer;
begin
  select * into v_match from public.pelada_partidas where id=p_match_id for update;
  if not public.pode_controlar_pelada(v_match.pelada_id) then raise exception 'Acesso negado'; end if;
  if v_match.status='FINISHED' then return (select active_match_id from public.pelada_controles where pelada_id=v_match.pelada_id); end if;
  if v_match.status<>'RUNNING' then raise exception 'A partida não está em andamento'; end if;
  update public.pelada_partidas set status='FINISHED',ended_at=p_occurred_at,updated_at=now() where id=p_match_id;
  insert into public.pelada_eventos_partida(client_event_id,pelada_id,match_id,admin_id,type,created_at,corrected_created_at,match_clock_ms)
  values(p_client_event_id,v_match.pelada_id,p_match_id,auth.uid(),'MATCH_FINISHED',p_occurred_at,p_occurred_at,greatest(0,p_match_clock_ms))
  on conflict(client_event_id) do nothing;
  select * into v_control from public.pelada_controles where pelada_id=v_match.pelada_id for update;
  v_queue=v_control.team_queue;v_seq=v_match.sequence_number+1;
  if coalesce(array_length(v_queue,1),0)=0 then
    v_home=v_match.team_home;v_away=v_match.team_away;
  elsif v_match.score_home=v_match.score_away and array_length(v_queue,1)>=2 then
    v_home=v_queue[1];v_away=v_queue[2];v_queue=v_queue[3:array_length(v_queue,1)]||array[v_match.team_home,v_match.team_away];
  elsif v_match.score_home>=v_match.score_away then
    v_home=v_match.team_home;v_away=v_queue[1];v_queue=v_queue[2:array_length(v_queue,1)]||array[v_match.team_away];
  else
    v_home=v_match.team_away;v_away=v_queue[1];v_queue=v_queue[2:array_length(v_queue,1)]||array[v_match.team_home];
  end if;
  insert into public.pelada_partidas(pelada_id,sequence_number,team_home,team_away)
  values(v_match.pelada_id,v_seq,v_home,v_away) returning id into v_next;
  update public.pelada_controles set active_match_id=v_next,team_queue=coalesce(v_queue,'{}'),status='READY',updated_at=now() where pelada_id=v_match.pelada_id;
  return v_next;
end $$;

create or replace function public.substituir_jogador_partida(p_match_id uuid,p_jogador_sai uuid,p_jogador_entra uuid,p_client_event_id uuid,p_occurred_at timestamptz,p_match_clock_ms integer)
returns void language plpgsql security definer set search_path='' as $$
declare v_match public.pelada_partidas;v_out public.pelada_times;v_in public.pelada_times;
begin
  select * into v_match from public.pelada_partidas where id=p_match_id;
  if not public.pode_controlar_pelada(v_match.pelada_id) then raise exception 'Acesso negado'; end if;
  if not exists(select 1 from public.pelada_participantes where pelada_id=v_match.pelada_id and jogador_id=p_jogador_entra and status in('confirmado','presente')) then
    raise exception 'O jogador de entrada não participa desta pelada';
  end if;
  select * into v_out from public.pelada_times where pelada_id=v_match.pelada_id and jogador_id=p_jogador_sai for update;
  if v_out.jogador_id is null then raise exception 'Jogador de saída não está escalado'; end if;
  select * into v_in from public.pelada_times where pelada_id=v_match.pelada_id and jogador_id=p_jogador_entra for update;
  set constraints public.pelada_times_slot_unique deferred;
  if v_in.jogador_id is null then
    delete from public.pelada_times where pelada_id=v_match.pelada_id and jogador_id=p_jogador_sai;
    insert into public.pelada_times(pelada_id,jogador_id,time,ordem) values(v_match.pelada_id,p_jogador_entra,v_out.time,v_out.ordem);
  else
    update public.pelada_times set time=case jogador_id when p_jogador_sai then v_in.time else v_out.time end,
      ordem=case jogador_id when p_jogador_sai then v_in.ordem else v_out.ordem end
    where pelada_id=v_match.pelada_id and jogador_id in(p_jogador_sai,p_jogador_entra);
  end if;
  insert into public.pelada_eventos_partida(client_event_id,pelada_id,match_id,admin_id,type,created_at,corrected_created_at,match_clock_ms,metadata)
  values(p_client_event_id,v_match.pelada_id,p_match_id,auth.uid(),'SUBSTITUTION',p_occurred_at,p_occurred_at,p_match_clock_ms,jsonb_build_object('jogador_sai',p_jogador_sai,'jogador_entra',p_jogador_entra,'time',v_out.time));
end $$;

revoke all on function public.admin_autorizar_operador_pelada(uuid,uuid,boolean),public.horario_servidor(),public.inicializar_controle_pelada(uuid),public.registrar_dispositivo_pelada(uuid,text,text,integer),public.iniciar_partida_controlada(uuid,uuid,timestamptz),public.registrar_evento_partida(uuid,uuid,text,integer,timestamptz,integer,jsonb),public.desfazer_evento_partida(uuid),public.finalizar_partida_controlada(uuid,uuid,timestamptz,integer),public.substituir_jogador_partida(uuid,uuid,uuid,uuid,timestamptz,integer) from public;
grant execute on function public.admin_autorizar_operador_pelada(uuid,uuid,boolean),public.horario_servidor(),public.inicializar_controle_pelada(uuid),public.registrar_dispositivo_pelada(uuid,text,text,integer),public.iniciar_partida_controlada(uuid,uuid,timestamptz),public.registrar_evento_partida(uuid,uuid,text,integer,timestamptz,integer,jsonb),public.desfazer_evento_partida(uuid),public.finalizar_partida_controlada(uuid,uuid,timestamptz,integer),public.substituir_jogador_partida(uuid,uuid,uuid,uuid,timestamptz,integer) to authenticated;
alter publication supabase_realtime add table public.pelada_controles,public.pelada_partidas,public.pelada_dispositivos,public.pelada_eventos_partida;

create or replace function public.peladas_controlaveis()
returns setof public.peladas language sql stable security definer set search_path='' as $$
  select p.* from public.peladas p
  where p.status<>'cancelada' and (
    public.is_admin() or exists(
      select 1 from public.pelada_operadores o
      where o.pelada_id=p.id and o.user_id=auth.uid()
    )
  )
  order by p.data desc,p.horario desc
  limit 30
$$;
revoke all on function public.peladas_controlaveis() from public;
grant execute on function public.peladas_controlaveis() to authenticated;
