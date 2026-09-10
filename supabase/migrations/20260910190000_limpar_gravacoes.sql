-- Recomeçar a gravação sem alterar partidas, placares ou jogadores.
update public.pelada_eventos_partida set recording_session_id=null,recording_offset_ms=null where recording_session_id is not null;
delete from public.recording_sessions;
delete from public.recording_cuts;
delete from public.recording_event_cameras;
update public.pelada_controles set recording_session_id=null,recording_started_at=null,device_camera_online=false;
delete from public.pelada_dispositivos where mode='CAMERA';
