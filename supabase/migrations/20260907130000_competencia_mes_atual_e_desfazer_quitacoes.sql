-- Corrige cobranças criadas para outubro de 2026 pelo seletor que iniciava no mês seguinte.
-- O backup e a função de restauração tornam a migração reversível.
create table if not exists public.financeiro_competencia_backup (
  pagamento_id uuid primary key,
  competencia date not null,
  referencia text,
  data_vencimento date,
  updated_at timestamptz not null,
  competencia_destino date not null,
  migrated_at timestamptz not null default now()
);

revoke all on table public.financeiro_competencia_backup from public, anon, authenticated;

do $$
declare
  v_origem constant date := date '2026-10-01';
  v_destino date := date_trunc('month', current_date)::date;
begin
  if v_destino = v_origem then return; end if;

  if exists (
    select 1
      from public.pagamentos origem
      join public.pagamentos destino
        on destino.tipo = 'mensalidade'
       and destino.competencia = v_destino
       and (
         (origem.jogador_id is not null and destino.jogador_id = origem.jogador_id)
         or (origem.jogador_id is null and origem.user_id is not null and destino.user_id = origem.user_id)
       )
     where origem.tipo = 'mensalidade'
       and origem.competencia = v_origem
  ) then
    raise exception 'Migração de outubro cancelada: já existem mensalidades para a competência atual';
  end if;

  insert into public.financeiro_competencia_backup (
    pagamento_id, competencia, referencia, data_vencimento, updated_at, competencia_destino
  )
  select id, competencia, referencia, data_vencimento, updated_at, v_destino
    from public.pagamentos
   where tipo = 'mensalidade' and competencia = v_origem
  on conflict (pagamento_id) do nothing;

  update public.pagamentos
     set competencia = v_destino,
         referencia = to_char(v_destino, 'MM/YYYY'),
         data_vencimento = v_destino + (extract(day from data_vencimento)::integer - 1),
         updated_at = now()
   where tipo = 'mensalidade' and competencia = v_origem;
end $$;

create or replace function public.restaurar_competencia_outubro_2026()
returns integer language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
  if not public.is_admin() then raise exception 'Acesso negado'; end if;
  if exists (
    select 1
      from public.financeiro_competencia_backup b
      join public.pagamentos origem on origem.id = b.pagamento_id
      join public.pagamentos conflito
        on conflito.id <> origem.id
       and conflito.tipo = 'mensalidade'
       and conflito.competencia = b.competencia
       and (
         (origem.jogador_id is not null and conflito.jogador_id = origem.jogador_id)
         or (origem.jogador_id is null and origem.user_id is not null and conflito.user_id = origem.user_id)
       )
  ) then
    raise exception 'Restauração cancelada: existem cobranças conflitantes em outubro';
  end if;

  update public.pagamentos p
     set competencia = b.competencia,
         referencia = b.referencia,
         data_vencimento = b.data_vencimento,
         updated_at = b.updated_at
    from public.financeiro_competencia_backup b
   where p.id = b.pagamento_id and p.competencia = b.competencia_destino;
  get diagnostics v_count = row_count;
  return v_count;
end $$;

create or replace function public.reabrir_mensalidades_mes(p_competencia date)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
  if not public.is_admin() then raise exception 'Acesso negado'; end if;
  update public.pagamentos
     set status = case when data_vencimento < current_date then 'atrasado'::public.pagamento_status else 'pendente'::public.pagamento_status end,
         metodo_pagamento = null, data_pagamento = null, updated_at = now()
   where tipo = 'mensalidade'
     and competencia = date_trunc('month', p_competencia)::date
     and status = 'pago';
  get diagnostics v_count = row_count;
  return v_count;
end $$;

create or replace function public.atualizar_pagamento(p_pagamento_id uuid,p_status public.pagamento_status,p_metodo public.pagamento_metodo default null)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not public.is_admin() then raise exception 'Acesso negado'; end if;
  update public.pagamentos
     set status=p_status,
         metodo_pagamento=case when p_status='pago' then coalesce(p_metodo,metodo_pagamento) else null end,
         data_pagamento=case when p_status='pago' then current_date else null end,
         updated_at=now()
   where id=p_pagamento_id;
end $$;

revoke all on function public.restaurar_competencia_outubro_2026(), public.reabrir_mensalidades_mes(date) from public;
grant execute on function public.restaurar_competencia_outubro_2026(), public.reabrir_mensalidades_mes(date) to authenticated;
