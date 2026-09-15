create or replace function public.inicializar_controle_pelada(p_pelada_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_match_id uuid;v_count integer;v_teams smallint[];v_queue smallint[];
begin
  if not public.pode_controlar_pelada(p_pelada_id) then raise exception 'Acesso negado'; end if;
  select count(distinct time),array_agg(distinct time order by time) into v_count,v_teams
  from public.pelada_times where pelada_id=p_pelada_id;
  if v_count<2 then raise exception 'É necessário ter pelo menos dois times sorteados'; end if;
  v_queue=coalesce(v_teams[3:array_length(v_teams,1)],'{}');
  insert into public.pelada_controles(pelada_id,status,team_queue)
  values(p_pelada_id,'READY',v_queue)
  on conflict(pelada_id) do update set
    status=case when pelada_controles.active_match_id is null then 'READY' else pelada_controles.status end,
    team_queue=case when pelada_controles.active_match_id is null then excluded.team_queue else pelada_controles.team_queue end,
    updated_at=now();
  select active_match_id into v_match_id from public.pelada_controles where pelada_id=p_pelada_id for update;
  if v_match_id is null then
    insert into public.pelada_partidas(pelada_id,sequence_number,team_home,team_away)
    values(p_pelada_id,1,v_teams[1],v_teams[2]) returning id into v_match_id;
    update public.pelada_controles set active_match_id=v_match_id,status='READY',updated_at=now() where pelada_id=p_pelada_id;
  end if;
  return v_match_id;
end $$;

update public.pelada_controles c
set team_queue=coalesce((
  select array_agg(team order by team)
  from (select distinct time as team from public.pelada_times where pelada_id=c.pelada_id) teams
  where team not in (m.team_home,m.team_away)
),'{}'),updated_at=now()
from public.pelada_partidas m
where m.id=c.active_match_id and m.status='CREATED' and c.team_queue='{}'
  and (select count(distinct time) from public.pelada_times where pelada_id=c.pelada_id)>2;
