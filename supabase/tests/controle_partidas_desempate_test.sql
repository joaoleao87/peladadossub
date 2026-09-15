begin;
select plan(1);
select has_function('public','finalizar_partida_controlada',array['uuid','uuid','timestamp with time zone','integer','smallint'],'Finalização aceita vencedor para desempate');
select * from finish();
rollback;
