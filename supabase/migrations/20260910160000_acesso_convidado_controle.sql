-- Links de controle podem criar um operador temporario, sem conta cadastrada.
create or replace function public.novo_usuario()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_nome text;
  v_token uuid;
  v_mensalista boolean = false;
begin
  v_nome = coalesce(
    nullif(trim(new.raw_user_meta_data->>'nome'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'Operador convidado'
  );
  if nullif(new.raw_user_meta_data->>'convite_mensalista', '') is not null then
    begin
      v_token = (new.raw_user_meta_data->>'convite_mensalista')::uuid;
    exception when invalid_text_representation then
      raise exception 'Convite inválido';
    end;
    update public.convites_mensalista
    set usado_por = new.id, usado_em = now()
    where token = v_token and usado_em is null and expira_em > now();
    if not found then
      raise exception 'Convite inválido, expirado ou já utilizado';
    end if;
    v_mensalista = true;
  end if;
  insert into public.profiles(id, nome, tipo_jogador, mensalista_ativo)
  values(
    new.id,
    v_nome,
    (case when v_mensalista then 'mensalista' else 'avulso' end)::public.tipo_jogador,
    v_mensalista
  );
  if v_mensalista then
    insert into public.jogadores(nome, user_id, tipo)
    values(v_nome, new.id, 'mensalista');
  end if;
  return new;
end $$;

create or replace function public.notificar_admin_novo_cadastro()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if coalesce((select raw_app_meta_data->>'provider' from auth.users where id=new.id), '') = 'anonymous' then
    return new;
  end if;
  insert into public.notificacoes(user_id,titulo,mensagem,link,tipo)
  select id,'Novo cadastro',new.nome||' criou uma conta e pode precisar de vínculo.',case when role='superadmin' then '/superadmin' else '/admin' end,'cadastro'
  from public.profiles where role in('admin','superadmin') and ativo and id<>new.id;
  return new;
end $$;
