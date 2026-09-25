-- A pelada é na sexta e a lista abre 48 horas antes, na quarta à noite.
select cron.unschedule(jobid) from cron.job where jobname='gerar-pelada-semanal';
select cron.schedule('gerar-pelada-semanal','30 23 * * 3',$$select public.gerar_peladas_recorrentes()$$);
