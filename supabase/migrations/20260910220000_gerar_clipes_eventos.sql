create or replace function public.criar_cortes_por_evento()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.status='ACTIVE' and new.type in('GOAL','HIGHLIGHT') then
    insert into public.recording_cuts(session_id,event_id,clip_start_ms,clip_end_ms,status)
    select s.id,new.id,
      greatest(0,extract(epoch from(new.corrected_created_at-s.started_at))*1000-10000)::bigint,
      (extract(epoch from(new.corrected_created_at-s.started_at))*1000+case when new.type='GOAL' then 8000 else 5000 end)::bigint,
      'PENDING'
    from public.recording_sessions s
    where s.pelada_id=new.pelada_id and s.status='RECORDING'
    on conflict(session_id,event_id) do update set status='PENDING',error_message=null,updated_at=now();
  end if;
  return new;
end $$;

drop trigger if exists criar_cortes_por_evento on public.pelada_eventos_partida;
create trigger criar_cortes_por_evento after insert on public.pelada_eventos_partida
for each row execute function public.criar_cortes_por_evento();

create or replace function public.cancelar_cortes_evento()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.status='CANCELLED' then
    update public.recording_cuts set status='CANCELLED',updated_at=now()
    where event_id=new.id;
  end if;
  return new;
end $$;

drop trigger if exists cancelar_cortes_evento on public.pelada_eventos_partida;
create trigger cancelar_cortes_evento after update of status on public.pelada_eventos_partida
for each row execute function public.cancelar_cortes_evento();

create policy recording_cuts_participante_read on public.recording_cuts
for select to authenticated using(exists(
  select 1 from public.recording_sessions s
  where s.id=session_id and public.pode_ver_gravacao_pelada(s.pelada_id)
));
