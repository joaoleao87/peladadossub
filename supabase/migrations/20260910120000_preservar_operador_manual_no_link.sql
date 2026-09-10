create or replace function public.resgatar_link_controle_pelada(p_token text) returns uuid language plpgsql security definer set search_path='' as $$
declare v_link public.pelada_links_controle;
begin
  if auth.uid() is null then raise exception 'Autenticação necessária'; end if;
  select * into v_link from public.pelada_links_controle where ativo and token_hash=encode(digest(p_token,'sha256'),'hex') for update;
  if not found then raise exception 'Link de controle inválido ou revogado'; end if;
  if not exists(select 1 from public.profiles where id=auth.uid() and ativo) then raise exception 'Conta indisponível'; end if;
  insert into public.pelada_operadores(pelada_id,user_id,autorizado_por,link_id)
  values(v_link.pelada_id,auth.uid(),auth.uid(),v_link.id)
  on conflict(pelada_id,user_id) do nothing;
  return v_link.pelada_id;
end $$;

revoke all on function public.resgatar_link_controle_pelada(text) from public;
grant execute on function public.resgatar_link_controle_pelada(text) to authenticated;
