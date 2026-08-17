create or replace function public.superadmin_gerenciar_usuario(
  p_user_id uuid,
  p_role public.app_role,
  p_jogador_id uuid default null
) returns void language plpgsql security definer set search_path='' as $$
declare
  v_role_atual public.app_role;
  v_jogador public.jogadores;
begin
  if not public.is_superadmin() then
    raise exception 'Acesso negado';
  end if;

  select role into v_role_atual
  from public.profiles
  where id = p_user_id and ativo
  for update;
  if not found then
    raise exception 'Usuário não encontrado';
  end if;

  if v_role_atual = 'superadmin' and p_role <> 'superadmin'
    and (select count(*) from public.profiles where role = 'superadmin' and ativo) <= 1 then
    raise exception 'Mantenha pelo menos um superadmin';
  end if;

  if p_jogador_id is not null then
    select * into v_jogador
    from public.jogadores
    where id = p_jogador_id and ativo
    for update;
    if not found then
      raise exception 'Jogador não encontrado';
    end if;
    if v_jogador.user_id is not null and v_jogador.user_id <> p_user_id then
      raise exception 'Este jogador já está vinculado a outra conta';
    end if;
  end if;

  update public.jogadores
  set user_id = null, updated_at = now()
  where user_id = p_user_id and id <> coalesce(p_jogador_id, '00000000-0000-0000-0000-000000000000');

  if p_jogador_id is not null then
    update public.jogadores
    set user_id = p_user_id, updated_at = now()
    where id = p_jogador_id;
    update public.profiles
    set role = p_role,
        tipo_jogador = v_jogador.tipo,
        mensalista_ativo = (v_jogador.tipo = 'mensalista'),
        posicao_lista = v_jogador.posicao,
        updated_at = now()
    where id = p_user_id;
  else
    update public.profiles
    set role = p_role, updated_at = now()
    where id = p_user_id;
  end if;
end $$;

revoke all on function public.superadmin_gerenciar_usuario(uuid, public.app_role, uuid) from public;
grant execute on function public.superadmin_gerenciar_usuario(uuid, public.app_role, uuid) to authenticated;
