create unique index if not exists pagamentos_mensalidade_jogador_unique on public.pagamentos(jogador_id,competencia) where tipo='mensalidade' and jogador_id is not null;
create unique index if not exists pagamentos_avulso_jogador_unique on public.pagamentos(jogador_id,pelada_id) where tipo='avulso' and jogador_id is not null and pelada_id is not null;

create or replace function public.gerar_mensalidades(p_serie_id uuid,p_competencia date default current_date) returns integer language plpgsql security definer set search_path='' as $$
declare v_serie public.pelada_series; v_comp date; v_due date; v_count integer;
begin
  if not public.is_admin() then raise exception 'Acesso negado'; end if;
  select * into v_serie from public.pelada_series where id=p_serie_id;
  v_comp=date_trunc('month',p_competencia)::date; v_due=v_comp+(v_serie.dia_vencimento-1);
  insert into public.pagamentos(jogador_id,user_id,tipo,valor,status,referencia,competencia,data_vencimento)
  select id,user_id,'mensalidade',v_serie.valor_mensalista,'pendente',to_char(v_comp,'MM/YYYY'),v_comp,v_due from public.jogadores where tipo='mensalista' and ativo
  on conflict(jogador_id,competencia) where tipo='mensalidade' and jogador_id is not null do nothing;
  get diagnostics v_count=row_count; return v_count;
end $$;

create or replace function public.gerar_cobrancas_avulsas(p_pelada_id uuid,p_serie_id uuid) returns integer language plpgsql security definer set search_path='' as $$
declare v_valor numeric(10,2); v_data date; v_count integer;
begin
  if not public.is_admin() then raise exception 'Acesso negado'; end if;
  select valor_avulso into v_valor from public.pelada_series where id=p_serie_id;
  select data into v_data from public.peladas where id=p_pelada_id;
  insert into public.pagamentos(jogador_id,user_id,pelada_id,tipo,valor,status,referencia,data_vencimento)
  select pp.jogador_id,j.user_id,p_pelada_id,'avulso',v_valor,'pendente','Pelada '||to_char(v_data,'DD/MM/YYYY'),v_data
  from public.pelada_participantes pp join public.jogadores j on j.id=pp.jogador_id
  where pp.pelada_id=p_pelada_id and pp.status in ('confirmado','presente') and j.tipo='avulso'
  on conflict(jogador_id,pelada_id) where tipo='avulso' and jogador_id is not null and pelada_id is not null do nothing;
  get diagnostics v_count=row_count; return v_count;
end $$;
