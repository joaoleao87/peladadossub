begin;
select plan(2);
select has_function('public','finalizar_partida_controlada',array['uuid','uuid','timestamp with time zone','integer','smallint'],'Finalização registra empate pendente');
select has_function('public','resolver_desempate_entrada',array['uuid','smallint'],'Desempate define quem entra na frente');
select * from finish();
rollback;
