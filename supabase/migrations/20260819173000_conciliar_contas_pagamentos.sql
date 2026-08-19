-- Vincula contas ainda soltas ao único jogador ativo com o mesmo nome.
update public.jogadores j
set user_id = p.id, updated_at = now()
from public.profiles p
where j.ativo
  and j.user_id is null
  and p.ativo
  and not exists(
    select 1 from public.jogadores vinculado
    where vinculado.user_id = p.id and vinculado.ativo
  )
  and lower(public.unaccent(trim(j.nome))) = lower(public.unaccent(trim(p.nome)))
  and (
    select count(*)
    from public.jogadores candidato
    where candidato.ativo
      and candidato.user_id is null
      and lower(public.unaccent(trim(candidato.nome))) = lower(public.unaccent(trim(p.nome)))
  ) = 1;

-- Garante o histórico mesmo se a migration anterior já tiver sido executada.
update public.pagamentos pagamento
set user_id = jogador.user_id, updated_at = now()
from public.jogadores jogador
where pagamento.jogador_id = jogador.id
  and jogador.user_id is not null
  and pagamento.user_id is distinct from jogador.user_id;
