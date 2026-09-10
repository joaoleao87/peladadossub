-- Participantes da pelada podem assistir, baixar e compartilhar suas gravacoes.
create or replace function public.pode_ver_gravacao_pelada(p_pelada_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select public.is_admin() or exists(
    select 1
    from public.pelada_participantes pp
    left join public.jogadores j on j.id=pp.jogador_id
    where pp.pelada_id=p_pelada_id
      and (pp.status in('confirmado','presente') or pp.comparecimento=true)
      and (pp.user_id=auth.uid() or j.user_id=auth.uid())
  )
$$;

grant execute on function public.pode_ver_gravacao_pelada(uuid) to authenticated;

create policy recording_sessions_participante_read on public.recording_sessions
for select to authenticated using(public.pode_ver_gravacao_pelada(pelada_id));

create policy recording_fragments_participante_read on public.recording_fragments
for select to authenticated using(exists(
  select 1 from public.recording_sessions s
  where s.id=session_id and public.pode_ver_gravacao_pelada(s.pelada_id)
));

create policy pelada_gravacoes_participante_read on storage.objects
for select to authenticated using(
  bucket_id='pelada-gravacoes' and exists(
    select 1
    from public.recording_fragments f
    join public.recording_sessions s on s.id=f.session_id
    where f.storage_path=name and public.pode_ver_gravacao_pelada(s.pelada_id)
  )
);
