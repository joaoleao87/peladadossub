create or replace function public.superadmin_registrar_video_completo(p_session_id uuid,p_path text,p_mime_type text,p_byte_size bigint)
returns public.recording_sessions language plpgsql security definer set search_path='' as $$
declare v_session public.recording_sessions;
begin
  select * into v_session from public.recording_sessions where id=p_session_id for update;
  if not public.is_superadmin() or v_session.admin_id<>auth.uid() then raise exception 'Acesso negado'; end if;
  update public.recording_sessions set full_storage_path=p_path,full_mime_type=p_mime_type,full_byte_size=p_byte_size,updated_at=now() where id=p_session_id returning * into v_session;
  return v_session;
end $$;
revoke all on function public.superadmin_registrar_video_completo(uuid,text,text,bigint) from public;
grant execute on function public.superadmin_registrar_video_completo(uuid,text,text,bigint) to authenticated;
