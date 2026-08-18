create or replace function public.validar_voto_pelada(
  p_pelada_id uuid,
  p_avaliado_jogador_id uuid default null
) returns void language plpgsql security definer set search_path='' as $$
declare
  v_meu_jogador_id uuid;
begin
  select id into v_meu_jogador_id
  from public.jogadores where user_id = auth.uid() and ativo;

  if not exists(
    select 1
    from public.pelada_participantes pp
    join public.peladas p on p.id = pp.pelada_id
    where pp.pelada_id = p_pelada_id
      and pp.jogador_id = v_meu_jogador_id
      and pp.status in ('confirmado', 'presente')
      and p.status <> 'cancelada'
      and p.data + p.horario <= now() at time zone 'America/Sao_Paulo'
  ) then
    raise exception 'Somente participantes podem votar depois da pelada';
  end if;
  if p_avaliado_jogador_id is not null and not exists(
    select 1 from public.pelada_participantes pp
    where pp.pelada_id = p_pelada_id
      and pp.jogador_id = p_avaliado_jogador_id
      and pp.jogador_id <> v_meu_jogador_id
      and pp.status in ('confirmado', 'presente')
  ) then
    raise exception 'Escolha outro participante desta pelada';
  end if;
end $$;

revoke all on function public.validar_voto_pelada(uuid, uuid) from public;
