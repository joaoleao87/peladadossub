create or replace function public.superadmin_votos_pelada(p_pelada_id uuid)
returns table(
  votante_user_id uuid,
  votante_nome text,
  votante_apelido text,
  categoria text,
  avaliado_jogador_id uuid,
  avaliado_nome text,
  avaliado_apelido text,
  criado_em timestamptz,
  atualizado_em timestamptz
) language plpgsql stable security definer set search_path='' as $$
begin
  if not public.is_superadmin() then raise exception 'Acesso negado'; end if;

  return query
  select v.votante_user_id, vp.nome, vp.apelido, v.categoria,
    v.avaliado_jogador_id, ap.nome, ap.apelido, v.created_at, v.updated_at
  from public.pelada_votos v
  join public.profiles vp on vp.id = v.votante_user_id
  join public.jogadores ap on ap.id = v.avaliado_jogador_id
  where v.pelada_id = p_pelada_id
  order by v.updated_at desc, vp.nome, v.categoria;
end $$;

create or replace function public.superadmin_atualizar_voto(
  p_pelada_id uuid,
  p_votante_user_id uuid,
  p_categoria text,
  p_jogador_id uuid
) returns void language plpgsql security definer set search_path='' as $$
declare
  v_jogador_votante_id uuid;
begin
  if not public.is_superadmin() then raise exception 'Acesso negado'; end if;
  if p_categoria not in ('destaque', 'surpresa', 'negativo', 'goleiro_destaque') then
    raise exception 'Categoria inválida';
  end if;

  select id into v_jogador_votante_id
  from public.jogadores
  where user_id = p_votante_user_id
  order by ativo desc
  limit 1;

  if p_jogador_id = v_jogador_votante_id or not exists (
    select 1 from public.pelada_participantes
    where pelada_id = p_pelada_id
      and jogador_id = p_jogador_id
      and status in ('confirmado', 'presente')
      and (p_categoria <> 'goleiro_destaque' or categoria = 'goleiro')
  ) then
    raise exception 'Escolha um participante elegível desta pelada';
  end if;

  update public.pelada_votos
  set avaliado_jogador_id = p_jogador_id, updated_at = now()
  where pelada_id = p_pelada_id
    and votante_user_id = p_votante_user_id
    and categoria = p_categoria;
  if not found then raise exception 'Voto não encontrado'; end if;
end $$;

create or replace function public.superadmin_invalidar_voto(
  p_pelada_id uuid,
  p_votante_user_id uuid,
  p_categoria text
) returns void language plpgsql security definer set search_path='' as $$
begin
  if not public.is_superadmin() then raise exception 'Acesso negado'; end if;

  delete from public.pelada_votos
  where pelada_id = p_pelada_id
    and votante_user_id = p_votante_user_id
    and categoria = p_categoria;
  if not found then raise exception 'Voto não encontrado'; end if;
end $$;

revoke all on function public.superadmin_votos_pelada(uuid), public.superadmin_atualizar_voto(uuid,uuid,text,uuid), public.superadmin_invalidar_voto(uuid,uuid,text) from public;
grant execute on function public.superadmin_votos_pelada(uuid), public.superadmin_atualizar_voto(uuid,uuid,text,uuid), public.superadmin_invalidar_voto(uuid,uuid,text) to authenticated;
