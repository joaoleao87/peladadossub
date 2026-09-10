alter table public.recording_fragments
  add column if not exists r2_key text,
  add column if not exists r2_uploaded_at timestamptz,
  add column if not exists r2_error text;
