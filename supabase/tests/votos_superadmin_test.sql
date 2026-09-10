begin;
select plan(3);
select has_function('public','superadmin_votos_pelada',array['uuid'],'Consulta de auditoria de votos existe');
select has_function('public','superadmin_atualizar_voto',array['uuid','uuid','text','uuid'],'Correção de voto existe');
select has_function('public','superadmin_invalidar_voto',array['uuid','uuid','text'],'Invalidação de voto existe');
select * from finish();
rollback;
