begin;
select plan(3);
select has_function('public','entrar_na_pelada',array['uuid'],'RPC de entrada existe');
select has_function('public','sair_da_pelada',array['uuid'],'RPC de saída existe');
select has_function('public','admin_gerenciar_participante',array['uuid','uuid','text'],'RPC administrativa existe');
select * from finish();
rollback;
