begin;
select plan(5);
select has_table('public','solicitacoes_vinculo','Tabela de solicitações existe');
select has_function('public','resultado_premios_pelada',array['uuid'],'Ranking por pelada existe');
select has_function('public','solicitar_vinculo',array['uuid'],'Jogador pode solicitar vínculo');
select has_function('public','avaliar_solicitacao_vinculo',array['uuid','boolean'],'Admin pode avaliar vínculo');
select has_function('public','superadmin_criar_jogador_para_usuario',array['uuid'],'Superadmin pode criar jogador da conta');
select * from finish();
rollback;
