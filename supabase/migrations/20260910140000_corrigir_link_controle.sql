create or replace function public.gerar_link_controle_pelada(p_pelada_id uuid) returns text language plpgsql security definer set search_path='' as $$
declare v_token text:=pg_catalog.encode(extensions.gen_random_bytes(24),'hex');v_links uuid[];
begin
  if not public.is_admin() then raise exception 'Acesso negado'; end if;
  select array_agg(id) into v_links from public.pelada_links_controle where pelada_id=p_pelada_id and ativo for update;
  update public.pelada_links_controle set ativo=false,revoked_at=now() where id=any(coalesce(v_links,'{}'));
  delete from public.pelada_operadores where link_id=any(coalesce(v_links,'{}'));
  insert into public.pelada_links_controle(pelada_id,token_hash,criado_por) values(p_pelada_id,pg_catalog.encode(extensions.digest(v_token,'sha256'),'hex'),auth.uid());
  return v_token;
end $$;

create or replace function public.resgatar_link_controle_pelada(p_token text) returns uuid language plpgsql security definer set search_path='' as $$
declare v_link public.pelada_links_controle;
begin
  if auth.uid() is null then raise exception 'Autenticação necessária'; end if;
  select * into v_link from public.pelada_links_controle where ativo and token_hash=pg_catalog.encode(extensions.digest(p_token,'sha256'),'hex') for update;
  if not found then raise exception 'Link de controle inválido ou revogado'; end if;
  if not exists(select 1 from public.profiles where id=auth.uid() and ativo) then raise exception 'Conta indisponível'; end if;
  insert into public.pelada_operadores(pelada_id,user_id,autorizado_por,link_id)
  values(v_link.pelada_id,auth.uid(),auth.uid(),v_link.id)
  on conflict(pelada_id,user_id) do nothing;
  return v_link.pelada_id;
end $$;

revoke all on function public.gerar_link_controle_pelada(uuid),public.resgatar_link_controle_pelada(text) from public;
grant execute on function public.gerar_link_controle_pelada(uuid),public.resgatar_link_controle_pelada(text) to authenticated;
