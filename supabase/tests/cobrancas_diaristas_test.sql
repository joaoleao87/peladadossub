begin;
select plan(2);
select has_function('public','gerar_cobranca_diarista_por_presenca',array[]::text[],'Cobrança automática por presença existe');
select has_function('public','remover_cobranca',array['uuid'],'Remoção de cobrança existe');
select * from finish();
rollback;
