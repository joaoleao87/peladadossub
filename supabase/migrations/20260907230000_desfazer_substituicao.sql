create or replace function public.horario_servidor()
returns timestamptz language sql volatile set search_path='' as $$select clock_timestamp()$$;

create or replace function public.substituir_jogador_partida(
  p_match_id uuid,
  p_jogador_sai uuid,
  p_jogador_entra uuid,
  p_client_event_id uuid,
  p_occurred_at timestamptz,
  p_match_clock_ms integer
) returns void language plpgsql security definer set search_path='' as $$
declare
  v_match public.pelada_partidas;
  v_out public.pelada_times;
  v_in public.pelada_times;
  v_control public.pelada_controles;
begin
  if exists(select 1 from public.pelada_eventos_partida where client_event_id=p_client_event_id) then return; end if;
  select * into v_match from public.pelada_partidas where id=p_match_id;
  if not public.pode_controlar_pelada(v_match.pelada_id) then raise exception 'Acesso negado'; end if;
  if v_match.status='FINISHED' then raise exception 'A partida já foi finalizada'; end if;
  if not exists(
    select 1 from public.pelada_participantes
    where pelada_id=v_match.pelada_id and jogador_id=p_jogador_entra
      and status in('confirmado','presente')
  ) then raise exception 'O jogador de entrada não participa desta pelada'; end if;

  select * into v_out from public.pelada_times
  where pelada_id=v_match.pelada_id and jogador_id=p_jogador_sai for update;
  if v_out.jogador_id is null then raise exception 'Jogador de saída não está escalado'; end if;
  select * into v_in from public.pelada_times
  where pelada_id=v_match.pelada_id and jogador_id=p_jogador_entra for update;
  select * into v_control from public.pelada_controles where pelada_id=v_match.pelada_id;

  set constraints public.pelada_times_slot_unique deferred;
  if v_in.jogador_id is null then
    delete from public.pelada_times
    where pelada_id=v_match.pelada_id and jogador_id=p_jogador_sai;
    insert into public.pelada_times(pelada_id,jogador_id,time,ordem)
    values(v_match.pelada_id,p_jogador_entra,v_out.time,v_out.ordem);
  else
    update public.pelada_times
    set time=case jogador_id when p_jogador_sai then v_in.time else v_out.time end,
        ordem=case jogador_id when p_jogador_sai then v_in.ordem else v_out.ordem end
    where pelada_id=v_match.pelada_id
      and jogador_id in(p_jogador_sai,p_jogador_entra);
  end if;

  insert into public.pelada_eventos_partida(
    client_event_id,pelada_id,match_id,admin_id,recording_session_id,type,
    created_at,corrected_created_at,match_clock_ms,recording_offset_ms,metadata
  ) values(
    p_client_event_id,v_match.pelada_id,p_match_id,auth.uid(),
    v_control.recording_session_id,'SUBSTITUTION',p_occurred_at,p_occurred_at,
    greatest(0,p_match_clock_ms),
    case when v_control.recording_started_at is null then null
      else extract(epoch from(p_occurred_at-v_control.recording_started_at))*1000 end,
    jsonb_build_object(
      'jogador_sai',p_jogador_sai,
      'jogador_entra',p_jogador_entra,
      'saida_time',v_out.time,
      'saida_ordem',v_out.ordem,
      'entrada_escalada',v_in.jogador_id is not null,
      'entrada_time',v_in.time,
      'entrada_ordem',v_in.ordem
    )
  ) on conflict(client_event_id) do nothing;
end $$;

create or replace function public.desfazer_evento_partida(p_match_id uuid)
returns public.pelada_eventos_partida language plpgsql security definer set search_path='' as $$
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

  if v_event.type='SUBSTITUTION' then
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
      delete from public.pelada_times
      where pelada_id=v_match.pelada_id and jogador_id=v_in;
      insert into public.pelada_times(pelada_id,jogador_id,time,ordem)
      values(
        v_match.pelada_id,v_out,
        (v_event.metadata->>'saida_time')::smallint,
        (v_event.metadata->>'saida_ordem')::smallint
      );
    end if;
  end if;

  update public.pelada_eventos_partida
  set status='CANCELLED',deleted_at=now()
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

revoke all on function public.substituir_jogador_partida(uuid,uuid,uuid,uuid,timestamptz,integer),
  public.desfazer_evento_partida(uuid) from public;
grant execute on function public.substituir_jogador_partida(uuid,uuid,uuid,uuid,timestamptz,integer),
  public.desfazer_evento_partida(uuid) to authenticated;
