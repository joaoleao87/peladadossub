do $$
declare v_pelada uuid; v_serie uuid; v_faltantes text; begin
  select id into v_serie from public.pelada_series where ativa order by updated_at desc limit 1;
  select id into v_pelada from public.peladas where data='2026-08-14' and status<>'cancelada' order by created_at limit 1;
  if v_pelada is null then
    insert into public.peladas(serie_id,data,horario,local,limite_jogadores,status,lista_aberta,fase_lista,lista_automatica)
    values(v_serie,'2026-08-14','20:30',coalesce((select local from public.pelada_series where id=v_serie),'Municipal'),20,'encerrada',false,'encerrada',false) returning id into v_pelada;
  else update public.peladas set horario='20:30',status='encerrada',lista_aberta=false,fase_lista='encerrada',lista_automatica=false where id=v_pelada; end if;

  create temporary table tmp_lista_14(nome text,grupo text,ordem integer) on commit drop;
  insert into tmp_lista_14 values
    ('Vinicius','linha',1),('Guilherme','linha',2),('Thiago','linha',3),('João','linha',4),('Moisés','linha',5),
    ('Lucas M','linha',6),('Lucas Léo','linha',7),('Ranyel','linha',8),('Lucão','linha',9),('Fabiano','linha',10),
    ('Troinha','linha',11),('Erik','linha',12),('Cláudio','linha',13),('Raul','linha',14),('Anthony','linha',15),
    ('terto','linha',16),('Fabinho','linha',17),('Eydson','linha',18),('Mauricio','linha',19),('Hugo','linha',20),
    ('Weslley','suplente',21),('Diego','suplente',22),('Alê','goleiro',23);

  select string_agg(t.nome,', ') into v_faltantes from tmp_lista_14 t where not exists(select 1 from public.jogadores j where j.ativo and lower(public.unaccent(trim(coalesce(j.apelido,j.nome))))=lower(public.unaccent(trim(t.nome))));
  if v_faltantes is not null then raise exception 'Jogadores não encontrados: %',v_faltantes; end if;

  delete from public.pelada_participantes where pelada_id=v_pelada;
  insert into public.pelada_participantes(pelada_id,jogador_id,user_id,status,categoria)
  select v_pelada,j.id,j.user_id,case when t.grupo='suplente' then 'espera'::public.participante_status else 'presente'::public.participante_status end,case when t.grupo='goleiro' then 'goleiro'::public.posicao_lista else 'linha'::public.posicao_lista end
  from tmp_lista_14 t join lateral(select * from public.jogadores j where j.ativo and lower(public.unaccent(trim(coalesce(j.apelido,j.nome))))=lower(public.unaccent(trim(t.nome))) order by j.updated_at desc limit 1) j on true order by t.ordem;
end $$;

create or replace function public.importar_lista_whatsapp(p_pelada_id uuid,p_itens jsonb) returns integer language plpgsql security definer set search_path='' as $$
declare v_item jsonb; v_jogador uuid; v_total int=0; v_categoria public.posicao_lista; v_status public.participante_status; begin
  if not public.is_admin() then raise exception 'Acesso negado'; end if; perform 1 from public.peladas where id=p_pelada_id for update;
  for v_item in select * from jsonb_array_elements(p_itens) loop
    if char_length(trim(v_item->>'nome'))<2 then continue; end if;
    v_categoria=case when v_item->>'grupo'='goleiro' then 'goleiro'::public.posicao_lista else 'linha'::public.posicao_lista end;
    v_status=case when v_item->>'grupo'='suplente' then 'espera'::public.participante_status else 'confirmado'::public.participante_status end;
    select id into v_jogador from public.jogadores where ativo and (lower(public.unaccent(trim(coalesce(apelido,nome))))=lower(public.unaccent(trim(v_item->>'nome'))) or lower(public.unaccent(trim(nome)))=lower(public.unaccent(trim(v_item->>'nome')))) order by updated_at desc limit 1;
    if v_jogador is null then raise exception 'Confirme o cadastro do jogador antes de importar: %',trim(v_item->>'nome'); end if;
    insert into public.pelada_participantes(pelada_id,jogador_id,user_id,status,categoria) select p_pelada_id,j.id,j.user_id,v_status,v_categoria from public.jogadores j where j.id=v_jogador on conflict(pelada_id,jogador_id) do update set status=excluded.status,categoria=excluded.categoria,updated_at=now(); v_total=v_total+1;
  end loop; return v_total;
end $$;
