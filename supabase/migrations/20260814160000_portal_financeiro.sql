alter table public.pelada_series add column if not exists valor_mensalista numeric(10,2) not null default 0 check(valor_mensalista>=0);
alter table public.pelada_series add column if not exists valor_avulso numeric(10,2) not null default 0 check(valor_avulso>=0);
alter table public.pelada_series add column if not exists dia_vencimento smallint not null default 10 check(dia_vencimento between 1 and 28);
alter table public.pagamentos add column if not exists competencia date;
alter table public.pagamentos add column if not exists data_vencimento date;
create unique index if not exists pagamentos_mensalidade_unique on public.pagamentos(user_id,competencia) where tipo='mensalidade';
create unique index if not exists pagamentos_avulso_unique on public.pagamentos(user_id,pelada_id) where tipo='avulso' and pelada_id is not null;

create or replace function public.gerar_mensalidades(p_serie_id uuid,p_competencia date default current_date) returns integer language plpgsql security definer set search_path='' as $$
declare v_serie public.pelada_series; v_comp date; v_due date; v_count integer;
begin
  if not public.is_admin() then raise exception 'Acesso negado'; end if;
  select * into v_serie from public.pelada_series where id=p_serie_id;
  if not found then raise exception 'Configuração não encontrada'; end if;
  v_comp=date_trunc('month',p_competencia)::date; v_due=v_comp+(v_serie.dia_vencimento-1);
  insert into public.pagamentos(user_id,tipo,valor,status,referencia,competencia,data_vencimento)
  select id,'mensalidade',v_serie.valor_mensalista,'pendente',to_char(v_comp,'MM/YYYY'),v_comp,v_due from public.profiles where mensalista_ativo and ativo
  on conflict(user_id,competencia) where tipo='mensalidade' do nothing;
  get diagnostics v_count=row_count; return v_count;
end $$;

create or replace function public.gerar_cobrancas_avulsas(p_pelada_id uuid,p_serie_id uuid) returns integer language plpgsql security definer set search_path='' as $$
declare v_valor numeric(10,2); v_data date; v_count integer;
begin
  if not public.is_admin() then raise exception 'Acesso negado'; end if;
  select valor_avulso into v_valor from public.pelada_series where id=p_serie_id;
  select data into v_data from public.peladas where id=p_pelada_id;
  insert into public.pagamentos(user_id,pelada_id,tipo,valor,status,referencia,data_vencimento)
  select pp.user_id,p_pelada_id,'avulso',v_valor,'pendente','Pelada '||to_char(v_data,'DD/MM/YYYY'),v_data
  from public.pelada_participantes pp join public.profiles p on p.id=pp.user_id
  where pp.pelada_id=p_pelada_id and pp.status in ('confirmado','presente') and p.tipo_jogador='avulso'
  on conflict(user_id,pelada_id) where tipo='avulso' and pelada_id is not null do nothing;
  get diagnostics v_count=row_count; return v_count;
end $$;

create or replace function public.atualizar_pagamento(p_pagamento_id uuid,p_status public.pagamento_status,p_metodo public.pagamento_metodo default null) returns void language plpgsql security definer set search_path='' as $$
begin
  if not public.is_admin() then raise exception 'Acesso negado'; end if;
  update public.pagamentos set status=p_status,metodo_pagamento=coalesce(p_metodo,metodo_pagamento),data_pagamento=case when p_status='pago' then current_date else data_pagamento end,updated_at=now() where id=p_pagamento_id;
end $$;

create or replace function public.atualizar_atrasados() returns integer language plpgsql security definer set search_path='' as $$
declare v_count integer;
begin
  if not public.is_admin() then raise exception 'Acesso negado'; end if;
  update public.pagamentos set status='atrasado',updated_at=now() where status='pendente' and data_vencimento<current_date;
  get diagnostics v_count=row_count; return v_count;
end $$;
revoke all on function public.gerar_mensalidades(uuid,date),public.gerar_cobrancas_avulsas(uuid,uuid),public.atualizar_pagamento(uuid,public.pagamento_status,public.pagamento_metodo),public.atualizar_atrasados() from public;
grant execute on function public.gerar_mensalidades(uuid,date),public.gerar_cobrancas_avulsas(uuid,uuid),public.atualizar_pagamento(uuid,public.pagamento_status,public.pagamento_metodo),public.atualizar_atrasados() to authenticated;
