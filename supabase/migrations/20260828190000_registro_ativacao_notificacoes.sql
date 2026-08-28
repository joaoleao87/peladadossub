create table if not exists public.notificacao_preferencias (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  status text not null check(status in('ativada','negada','indisponivel')),
  ativada_em timestamptz,
  respondida_em timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.notificacao_preferencias enable row level security;
create policy notificacao_preferencias_propria on public.notificacao_preferencias
  for select to authenticated using(user_id=auth.uid());
create policy notificacao_preferencias_registrar on public.notificacao_preferencias
  for insert to authenticated with check(user_id=auth.uid());
create policy notificacao_preferencias_atualizar on public.notificacao_preferencias
  for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy notificacao_preferencias_admin on public.notificacao_preferencias
  for select to authenticated using(public.is_admin());
grant select,insert,update on public.notificacao_preferencias to authenticated;
