alter table public.pelada_partidas drop constraint if exists pelada_partidas_status_check;
alter table public.pelada_partidas add constraint pelada_partidas_status_check check(status in('CREATED','RUNNING','PAUSED','FINISHED'));
alter table public.pelada_controles drop constraint if exists pelada_controles_status_check;
alter table public.pelada_controles add constraint pelada_controles_status_check check(status in('CREATED','READY','RUNNING','PAUSED','FINISHED'));

create or replace function public.pausar_partida_controlada(p_match_id uuid,p_pause boolean,p_occurred_at timestamptz)
returns public.pelada_partidas language plpgsql security definer set search_path='' as $$
declare v_match public.pelada_partidas;v_remaining integer;
begin
  select * into v_match from public.pelada_partidas where id=p_match_id for update;
  if not public.pode_controlar_pelada(v_match.pelada_id) then raise exception 'Acesso negado'; end if;
  if p_pause then
    if v_match.status<>'RUNNING' then raise exception 'A partida não está em andamento'; end if;
    v_remaining=greatest(0,v_match.duration_ms-extract(epoch from(p_occurred_at-v_match.started_at))*1000)::integer;
    update public.pelada_partidas set status='PAUSED',duration_ms=v_remaining,started_at=null,updated_at=now() where id=p_match_id returning * into v_match;
    update public.pelada_controles set status='PAUSED',updated_at=now() where pelada_id=v_match.pelada_id;
  else
    if v_match.status<>'PAUSED' then raise exception 'A partida não está pausada'; end if;
    update public.pelada_partidas set status='RUNNING',started_at=p_occurred_at,updated_at=now() where id=p_match_id returning * into v_match;
    update public.pelada_controles set status='RUNNING',updated_at=now() where pelada_id=v_match.pelada_id;
  end if;
  return v_match;
end $$;

revoke all on function public.pausar_partida_controlada(uuid,boolean,timestamptz) from public;
grant execute on function public.pausar_partida_controlada(uuid,boolean,timestamptz) to authenticated;
