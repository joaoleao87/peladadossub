create or replace function public.resumo_gols_controle_pelada(p_pelada_id uuid)
returns table(total integer, atribuidos integer)
language sql stable security definer set search_path='' as $$
  select
    count(*)::integer as total,
    count(*) filter (where player_id is not null)::integer as atribuidos
  from public.pelada_eventos_partida
  where pelada_id=p_pelada_id and type='GOAL' and status='ACTIVE'
$$;

revoke all on function public.resumo_gols_controle_pelada(uuid) from public;
grant execute on function public.resumo_gols_controle_pelada(uuid) to authenticated;
