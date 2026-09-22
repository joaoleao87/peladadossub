begin;
select plan(4);
select has_function('public','inicializar_controle_pelada',array['uuid'],'O controle inicia com dois times fixos');
select has_function('public','iniciar_partida_controlada',array['uuid','uuid','timestamp with time zone'],'A partida fixa pode iniciar sem desempate pendente');
select has_function('public','finalizar_partida_controlada',array['uuid','uuid','timestamp with time zone','integer','smallint'],'O próximo jogo mantém os mesmos lados');
select has_function('public','atualizar_autoria_gol_partida',array['uuid','uuid','uuid'],'Gols aceitam qualquer participante da pelada');
select * from finish();
rollback;
