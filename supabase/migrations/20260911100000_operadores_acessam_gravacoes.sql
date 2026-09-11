-- Quem controla uma pelada também pode consultar os vídeos dela.
create or replace function public.pode_ver_gravacao_pelada(p_pelada_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select public.pode_controlar_pelada(p_pelada_id) or exists(
    select 1
    from public.pelada_participantes pp
    left join public.jogadores j on j.id=pp.jogador_id
    where pp.pelada_id=p_pelada_id
      and (pp.status in('confirmado','presente') or pp.comparecimento=true)
      and (pp.user_id=auth.uid() or j.user_id=auth.uid())
  )
$$;

grant execute on function public.pode_ver_gravacao_pelada(uuid) to authenticated;
