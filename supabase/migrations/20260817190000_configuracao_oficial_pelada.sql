create extension if not exists unaccent;
alter table public.pelada_series add column if not exists antecedencia_saida_horas integer not null default 3 check(antecedencia_saida_horas>=0);

do $$
declare v_nome text; v_id uuid; v_serie uuid; v_data date;
begin
  delete from public.pagamentos; delete from public.despesas; delete from public.premiacoes; delete from public.ranking_eventos; delete from public.peladas;
  update public.jogadores set tipo='avulso' where ativo;
  update public.profiles set tipo_jogador='avulso',mensalista_ativo=false where ativo;
  foreach v_nome in array array['Lucão','Lucas M','Thiago','Guilherme','Vinicius','João','Marcony','Troinha','Macedo','Lucas L','Hugo','Ranyel','Hiuri','Fabiano','Erik','Eydson','Raul','Moisés','Anthony','Casemiro','Alê'] loop
    select id into v_id from public.jogadores where lower(public.unaccent(trim(coalesce(apelido,nome))))=lower(public.unaccent(v_nome)) or lower(public.unaccent(trim(nome)))=lower(public.unaccent(v_nome)) order by ativo desc limit 1;
    if v_id is null then insert into public.jogadores(nome,tipo,posicao,ativo) values(v_nome,'mensalista','linha',true) returning id into v_id;
    else update public.jogadores set nome=v_nome,tipo='mensalista',ativo=true,updated_at=now() where id=v_id; end if;
    update public.profiles p set tipo_jogador='mensalista',mensalista_ativo=true,updated_at=now() from public.jogadores j where j.id=v_id and p.id=j.user_id;
  end loop;
  update public.profiles p set role='admin' from public.jogadores j where p.id=j.user_id and lower(public.unaccent(j.nome)) in ('vinicius','guilherme','ale');
  update public.pelada_series set ativa=false;
  insert into public.pelada_series(nome,dia_semana,horario,local,limite_jogadores,antecedencia_mensalistas_horas,antecedencia_geral_horas,antecedencia_saida_horas,valor_mensalista,valor_avulso,dia_vencimento,chave_pix,ativa)
  values('Pelada de sexta',5,'20:30','Municipal',20,48,48,3,coalesce((select valor_mensalista from public.pelada_series order by updated_at desc limit 1),0),coalesce((select valor_avulso from public.pelada_series order by updated_at desc limit 1),0),10,coalesce((select chave_pix from public.pelada_series order by updated_at desc limit 1),'Peladadossub@gmail.com'),true) returning id into v_serie;
  v_data=current_date+((5-extract(dow from current_date)::integer+7)%7);
  insert into public.peladas(serie_id,data,horario,local,limite_jogadores,status,lista_aberta,fase_lista) values(v_serie,v_data,'20:30','Municipal',20,'aberta',false,'fechada');
  insert into public.pagamentos(jogador_id,user_id,tipo,valor,status,data_pagamento,metodo_pagamento,referencia,competencia,data_vencimento)
  select j.id,j.user_id,'mensalidade',0,case when lower(public.unaccent(j.nome)) in ('vinicius','guilherme','ale') then 'isento'::public.pagamento_status else 'pago'::public.pagamento_status end,case when lower(public.unaccent(j.nome)) in ('vinicius','guilherme','ale') then null else current_date end,case when lower(public.unaccent(j.nome)) in ('vinicius','guilherme','ale') then null else 'pix'::public.pagamento_metodo end,'Mensalidade quitada - agosto/2026','2026-08-01','2026-08-10' from public.jogadores j where j.tipo='mensalista' and j.ativo;
end $$;

update public.pagamentos p set valor=s.valor_mensalista from public.pelada_series s where s.ativa and p.referencia='Mensalidade quitada - agosto/2026';

create or replace function public.admin_adicionar_jogador(p_pelada_id uuid,p_jogador_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare v_jogador public.jogadores; v_count integer; v_status public.participante_status; begin
  if not public.is_admin() then raise exception 'Acesso negado'; end if; perform 1 from public.peladas where id=p_pelada_id for update; select * into v_jogador from public.jogadores where id=p_jogador_id and ativo;
  if not found then raise exception 'Jogador não encontrado'; end if; select count(*) into v_count from public.pelada_participantes where pelada_id=p_pelada_id and categoria='linha' and status in ('confirmado','presente');
  v_status=case when v_jogador.posicao='goleiro' or v_count<20 then 'confirmado'::public.participante_status else 'espera'::public.participante_status end;
  insert into public.pelada_participantes(pelada_id,jogador_id,user_id,status,categoria) values(p_pelada_id,v_jogador.id,v_jogador.user_id,v_status,v_jogador.posicao) on conflict(pelada_id,jogador_id) do update set status=v_status,categoria=v_jogador.posicao,updated_at=now();
end $$;
revoke all on function public.admin_adicionar_jogador(uuid,uuid) from public;
grant execute on function public.admin_adicionar_jogador(uuid,uuid) to authenticated;

create or replace function public.sincronizar_fase_lista(p_pelada_id uuid) returns public.lista_fase language plpgsql security definer set search_path='' as $$
declare v_game public.peladas; v_serie public.pelada_series; v_start timestamp; v_now timestamp; v_fase public.lista_fase; begin
  select * into v_game from public.peladas where id=p_pelada_id for update; if not found then raise exception 'Pelada não encontrada'; end if;
  if not v_game.lista_automatica or v_game.status in ('cancelada','encerrada') then return v_game.fase_lista; end if;
  select * into v_serie from public.pelada_series where id=v_game.serie_id; v_start=v_game.data+v_game.horario; v_now=now() at time zone 'America/Sao_Paulo';
  v_fase=case when v_now>=v_start-make_interval(hours=>coalesce(v_serie.antecedencia_geral_horas,48)) then 'geral'::public.lista_fase else 'fechada'::public.lista_fase end;
  update public.peladas set fase_lista=v_fase,lista_aberta=(v_fase='geral'),updated_at=now() where id=p_pelada_id and fase_lista<>v_fase;
  if v_fase='geral' then insert into public.pelada_participantes(pelada_id,jogador_id,user_id,status,categoria) select p_pelada_id,id,user_id,'aguardando_resposta',posicao from public.jogadores where tipo='mensalista' and ativo on conflict(pelada_id,jogador_id) do nothing; end if; return v_fase;
end $$;

create or replace function public.sair_da_pelada(p_pelada_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare v_game public.peladas; v_old public.participante_status; v_categoria public.posicao_lista; begin
  select * into v_game from public.peladas where id=p_pelada_id and fase_lista in ('mensalistas','geral') for update; if not found then raise exception 'Lista indisponível'; end if;
  if (now() at time zone 'America/Sao_Paulo')>v_game.data+v_game.horario-interval '3 hours' then raise exception 'O prazo para sair da lista encerrou 3 horas antes da pelada'; end if;
  select status,categoria into v_old,v_categoria from public.pelada_participantes where pelada_id=p_pelada_id and user_id=auth.uid() for update; if not found then raise exception 'Inscrição não encontrada'; end if;
  update public.pelada_participantes set status='cancelado',updated_at=now() where pelada_id=p_pelada_id and user_id=auth.uid();
  if v_old in ('confirmado','presente') and v_categoria='linha' then update public.pelada_participantes set status='confirmado',updated_at=now() where id=(select id from public.pelada_participantes where pelada_id=p_pelada_id and status='espera' order by ordem_entrada for update skip locked limit 1); end if;
end $$;

create or replace function public.admin_gerenciar_participante_id(p_participante_id uuid,p_acao text) returns void language plpgsql security definer set search_path='' as $$
declare v_pelada uuid; v_old public.participante_status; v_categoria public.posicao_lista; begin
  if not public.is_admin() then raise exception 'Acesso negado'; end if; select pelada_id,status,categoria into v_pelada,v_old,v_categoria from public.pelada_participantes where id=p_participante_id for update;
  if p_acao='remove' then update public.pelada_participantes set status='cancelado',updated_at=now() where id=p_participante_id;
  elsif p_acao='promote' then update public.pelada_participantes set status='confirmado',updated_at=now() where id=p_participante_id;
  elsif p_acao='linha' then update public.pelada_participantes set categoria='linha',updated_at=now() where id=p_participante_id;
  elsif p_acao='goleiro' then update public.pelada_participantes set categoria='goleiro',status='confirmado',updated_at=now() where id=p_participante_id;
  elsif p_acao in ('presente','faltou') then update public.pelada_participantes set status=p_acao::public.participante_status,updated_at=now() where id=p_participante_id; else raise exception 'Ação inválida'; end if;
  if p_acao='remove' and v_old in ('confirmado','presente') and v_categoria='linha' then update public.pelada_participantes set status='confirmado',updated_at=now() where id=(select id from public.pelada_participantes where pelada_id=v_pelada and status='espera' order by ordem_entrada for update skip locked limit 1); end if;
end $$;
