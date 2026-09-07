alter table public.pelada_votos
  drop constraint if exists pelada_votos_categoria_check;
alter table public.pelada_votos
  add constraint pelada_votos_categoria_check
  check (categoria in ('destaque', 'surpresa', 'negativo', 'goleiro_destaque'));

create or replace function public.votar_destaque_pelada(
  p_pelada_id uuid,
  p_categoria text,
  p_jogador_id uuid default null
) returns void language plpgsql security definer set search_path='' as $$
begin
  if p_categoria not in ('destaque', 'surpresa', 'negativo', 'goleiro_destaque') then
    raise exception 'Categoria inválida';
  end if;

  perform public.validar_voto_pelada(p_pelada_id, p_jogador_id);

  if p_jogador_id is null then
    delete from public.pelada_votos
     where pelada_id = p_pelada_id
       and votante_user_id = auth.uid()
       and categoria = p_categoria;
    return;
  end if;

  if p_categoria = 'goleiro_destaque' and not exists (
    select 1
      from public.pelada_participantes
     where pelada_id = p_pelada_id
       and jogador_id = p_jogador_id
       and categoria = 'goleiro'
       and status in ('confirmado', 'presente')
  ) then
    raise exception 'Escolha um goleiro que participou desta pelada';
  end if;

  insert into public.pelada_votos(
    pelada_id, votante_user_id, categoria, avaliado_jogador_id
  ) values(
    p_pelada_id, auth.uid(), p_categoria, p_jogador_id
  )
  on conflict(pelada_id, votante_user_id, categoria) do update
     set avaliado_jogador_id = excluded.avaliado_jogador_id,
         updated_at = now();
end $$;

revoke all on function public.votar_destaque_pelada(uuid, text, uuid) from public;
grant execute on function public.votar_destaque_pelada(uuid, text, uuid) to authenticated;
