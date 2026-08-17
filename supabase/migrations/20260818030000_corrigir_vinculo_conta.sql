create or replace function public.salvar_jogador(
  p_id uuid,
  p_nome text,
  p_tipo public.tipo_jogador,
  p_posicao public.posicao_lista,
  p_user_id uuid default null
) returns uuid language plpgsql security definer set search_path='' as $$
declare
  v_id uuid;
  v_vinculo_antigo uuid;
begin
  if not public.is_admin() then
    raise exception 'Acesso negado';
  end if;
  if char_length(trim(p_nome)) < 2 then
    raise exception 'Informe o nome';
  end if;
  if p_user_id is not null then
    select id into v_vinculo_antigo
    from public.jogadores
    where user_id = p_user_id
      and id <> coalesce(p_id, '00000000-0000-0000-0000-000000000000')
    order by ativo desc
    limit 1;
    if v_vinculo_antigo is not null then
      update public.jogadores
      set user_id = null, ativo = false, updated_at = now()
      where id = v_vinculo_antigo;
    end if;
  end if;
  if p_id is null then
    insert into public.jogadores(nome, tipo, posicao, user_id)
    values(trim(p_nome), p_tipo, p_posicao, p_user_id)
    returning id into v_id;
  else
    update public.jogadores
    set nome = trim(p_nome), tipo = p_tipo, posicao = p_posicao,
        user_id = p_user_id, updated_at = now()
    where id = p_id
    returning id into v_id;
  end if;
  if p_user_id is not null then
    update public.profiles
    set tipo_jogador = p_tipo, mensalista_ativo = (p_tipo = 'mensalista'),
        posicao_lista = p_posicao, updated_at = now()
    where id = p_user_id;
  end if;
  return v_id;
end $$;
