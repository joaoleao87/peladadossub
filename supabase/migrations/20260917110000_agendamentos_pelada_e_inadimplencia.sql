create extension if not exists pg_cron;

-- A próxima partida já aberta permanece intacta; as próximas recorrências passam a ser na quarta.
update public.pelada_series
set dia_semana=3,horario='20:30',nome='Pelada de quarta',updated_at=now()
where ativa;

create or replace function public.gerar_peladas_recorrentes()
returns integer language plpgsql security definer set search_path='' as $$
declare v_serie record; v_count integer:=0;
begin
  for v_serie in select id from public.pelada_series where ativa loop
    perform public.gerar_proxima_pelada_interna(v_serie.id);
    v_count:=v_count+1;
  end loop;
  return v_count;
end $$;

create or replace function public.suspender_confirmacoes_inadimplentes()
returns integer language plpgsql security definer set search_path='' as $$
declare v_count integer;
begin
  with cobrancas_em_atraso as (
    select distinct on (p.jogador_id) p.id,p.jogador_id
    from public.pagamentos p
    join public.jogadores j on j.id=p.jogador_id
    where p.tipo='mensalidade'
      and p.status in ('pendente','atrasado')
      and p.data_vencimento+5 < (now() at time zone 'America/Sao_Paulo')::date
      and j.ativo
      and not j.isento_mensalidade
    order by p.jogador_id,p.data_vencimento
  )
  update public.jogadores j set
    confirmacao_bloqueada=true,
    confirmacao_bloqueada_motivo='Mensalidade vencida há mais de 5 dias.',
    suspensao_confirmacao_pagamento_id=c.id,
    updated_at=now()
  from cobrancas_em_atraso c
  where j.id=c.jogador_id
    and (not j.confirmacao_bloqueada or j.suspensao_confirmacao_pagamento_id is not null);
  get diagnostics v_count=row_count;
  return v_count;
end $$;

revoke all on function public.gerar_peladas_recorrentes(),public.suspender_confirmacoes_inadimplentes() from public;

select cron.unschedule(jobid)
from cron.job
where jobname in ('gerar-pelada-semanal','suspender-confirmacoes-inadimplentes');

-- pg_cron usa GMT: 23:30 UTC equivale a 20:30 em São Paulo (UTC-3).
select cron.schedule('gerar-pelada-semanal','30 23 * * 3',$$select public.gerar_peladas_recorrentes()$$);
select cron.schedule('suspender-confirmacoes-inadimplentes','5 3 * * *',$$select public.suspender_confirmacoes_inadimplentes()$$);

select public.suspender_confirmacoes_inadimplentes();
