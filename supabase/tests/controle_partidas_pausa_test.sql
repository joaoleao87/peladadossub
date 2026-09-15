begin;
select plan(1);
select has_function('public','pausar_partida_controlada',array['uuid','boolean','timestamp with time zone'],'Pausa e retomada persistem o cronômetro');
select * from finish();
rollback;
