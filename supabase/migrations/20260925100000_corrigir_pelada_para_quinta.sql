-- A pelada acontece às quintas; corrige a próxima ocorrência aberta que foi criada para quarta.
update public.pelada_series
set dia_semana=4,horario='20:30',nome='Pelada de quinta',updated_at=now()
where ativa;

update public.peladas p
set data=p.data+1,updated_at=now()
from public.pelada_series s
where s.id=p.serie_id
  and s.ativa
  and p.status='aberta'
  and extract(dow from p.data)=3
  and p.data >= (now() at time zone 'America/Sao_Paulo')::date-1
  and not exists (select 1 from public.peladas next_p where next_p.serie_id=p.serie_id and next_p.data=p.data+1 and next_p.status<>'cancelada');

select cron.unschedule(jobid) from cron.job where jobname='gerar-pelada-semanal';
select cron.schedule('gerar-pelada-semanal','30 23 * * 4',$$select public.gerar_peladas_recorrentes()$$);