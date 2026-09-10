alter table public.recording_sessions
  add column if not exists full_storage_path text,
  add column if not exists full_r2_key text,
  add column if not exists full_mime_type text,
  add column if not exists full_byte_size bigint;

alter table public.recording_cuts
  add column if not exists r2_key text,
  add column if not exists mime_type text,
  add column if not exists byte_size bigint;
