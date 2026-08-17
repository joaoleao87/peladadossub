alter table public.jogadores add column if not exists isento_mensalidade boolean not null default false;
update public.jogadores set isento_mensalidade=true where lower(public.unaccent(nome)) in ('vinicius','guilherme','ale');

create or replace function public.gerar_mensalidades(p_serie_id uuid,p_competencia date default current_date) returns integer language plpgsql security definer set search_path='' as $$
declare v_serie public.pelada_series; v_comp date; v_due date; v_count integer; begin
  if not public.is_admin() then raise exception 'Acesso negado'; end if; select * into v_serie from public.pelada_series where id=p_serie_id;
  v_comp=date_trunc('month',p_competencia)::date; v_due=v_comp+(v_serie.dia_vencimento-1);
  insert into public.pagamentos(jogador_id,user_id,tipo,valor,status,referencia,competencia,data_vencimento)
  select id,user_id,'mensalidade',v_serie.valor_mensalista,'pendente',to_char(v_comp,'MM/YYYY'),v_comp,v_due from public.jogadores where tipo='mensalista' and ativo and not isento_mensalidade
  on conflict(jogador_id,competencia) where tipo='mensalidade' and jogador_id is not null do nothing;
  get diagnostics v_count=row_count; return v_count;
end $$;

create or replace function public.quitar_mensalidades_mes(p_competencia date) returns integer language plpgsql security definer set search_path='' as $$
declare v_count integer; begin
  if not public.is_admin() then raise exception 'Acesso negado'; end if;
  update public.pagamentos set status='pago',metodo_pagamento='pix',data_pagamento=current_date,updated_at=now() where tipo='mensalidade' and competencia=date_trunc('month',p_competencia)::date and status in ('pendente','atrasado');
  get diagnostics v_count=row_count; return v_count;
end $$;

create or replace function public.definir_isencao_mensalista(p_jogador_id uuid,p_isento boolean) returns void language plpgsql security definer set search_path='' as $$
begin if not public.is_admin() then raise exception 'Acesso negado'; end if; update public.jogadores set isento_mensalidade=p_isento,updated_at=now() where id=p_jogador_id; if not found then raise exception 'Jogador não encontrado'; end if; end $$;
revoke all on function public.quitar_mensalidades_mes(date),public.definir_isencao_mensalista(uuid,boolean) from public;
grant execute on function public.quitar_mensalidades_mes(date),public.definir_isencao_mensalista(uuid,boolean) to authenticated;
