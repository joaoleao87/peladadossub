create or replace function public.excluir_jogador(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
  if not public.is_admin() then raise exception 'Acesso negado'; end if;
  update public.jogadores set ativo=false,updated_at=now() where id=p_id and ativo;
  if not found then raise exception 'Jogador não encontrado'; end if;
end $$;
revoke all on function public.excluir_jogador(uuid) from public;
grant execute on function public.excluir_jogador(uuid) to authenticated;
