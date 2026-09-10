create or replace function public.gerar_link_controle_pelada(p_pelada_id uuid) returns text language plpgsql security definer set search_path='' as $$
declare v_token text:=pg_catalog.encode(extensions.gen_random_bytes(24),'hex');v_links uuid[];
begin
  if not public.is_admin() then raise exception 'Acesso negado'; end if;
  select array_agg(id) into v_links from (
    select id from public.pelada_links_controle where pelada_id=p_pelada_id and ativo for update
  ) locked_links;
  update public.pelada_links_controle set ativo=false,revoked_at=now() where id=any(coalesce(v_links,'{}'));
  delete from public.pelada_operadores where link_id=any(coalesce(v_links,'{}'));
  insert into public.pelada_links_controle(pelada_id,token_hash,criado_por) values(p_pelada_id,pg_catalog.encode(extensions.digest(v_token,'sha256'),'hex'),auth.uid());
  return v_token;
end $$;

revoke all on function public.gerar_link_controle_pelada(uuid) from public;
grant execute on function public.gerar_link_controle_pelada(uuid) to authenticated;
