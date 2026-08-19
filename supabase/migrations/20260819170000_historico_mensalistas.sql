-- Mantém cobranças e histórico visíveis quando uma conta é vinculada ao jogador.
create or replace function public.sincronizar_user_id_financeiro()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.pagamentos
  set user_id = new.user_id, updated_at = now()
  where jogador_id = new.id and user_id is distinct from new.user_id;
  return new;
end $$;
revoke all on function public.sincronizar_user_id_financeiro() from public;

drop trigger if exists jogadores_sincronizar_user_id_financeiro on public.jogadores;
create trigger jogadores_sincronizar_user_id_financeiro
after update of user_id on public.jogadores
for each row execute function public.sincronizar_user_id_financeiro();

-- Registra agosto/2026 no histórico de todos os mensalistas atuais.
insert into public.pagamentos(
  jogador_id, user_id, tipo, valor, status, data_pagamento,
  metodo_pagamento, referencia, competencia, data_vencimento
)
select
  j.id,
  j.user_id,
  'mensalidade',
  s.valor_mensalista,
  case when j.isento_mensalidade then 'isento'::public.pagamento_status else 'pago'::public.pagamento_status end,
  case when j.isento_mensalidade then null else date '2026-08-10' end,
  case when j.isento_mensalidade then null else 'pix'::public.pagamento_metodo end,
  'Mensalidade quitada - agosto/2026',
  date '2026-08-01',
  date '2026-08-10'
from public.jogadores j
cross join lateral (
  select valor_mensalista
  from public.pelada_series
  where ativa
  order by updated_at desc
  limit 1
) s
where j.tipo = 'mensalista' and j.ativo
on conflict(jogador_id, competencia)
where tipo = 'mensalidade' and jogador_id is not null
do update set
  user_id = excluded.user_id,
  valor = excluded.valor,
  referencia = excluded.referencia,
  updated_at = now();
