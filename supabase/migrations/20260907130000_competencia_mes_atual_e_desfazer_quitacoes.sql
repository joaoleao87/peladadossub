-- Corrige cobranças criadas para outubro de 2026 pelo seletor que iniciava no mês seguinte.
-- Todos os registros afetados são preservados integralmente para permitir restauração.
create table if not exists public.financeiro_competencia_backup (
  pagamento_id uuid primary key,
  dados jsonb not null,
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

  -- Guarda as cobranças de outubro e também as cobranças atuais que serão
  -- consolidadas, possibilitando restaurar exatamente o estado anterior.
  insert into public.financeiro_competencia_backup (pagamento_id, dados, competencia_destino)
  select p.id, to_jsonb(p), v_destino
    from public.pagamentos p
   where p.tipo = 'mensalidade'
     and (
       p.competencia = v_origem
       or (
         p.competencia = v_destino
         and exists (
           select 1 from public.pagamentos origem
            where origem.tipo = 'mensalidade'
              and origem.competencia = v_origem
              and (
                (origem.jogador_id is not null and origem.jogador_id = p.jogador_id)
                or (origem.jogador_id is null and origem.user_id is not null and origem.user_id = p.user_id)
              )
         )
       )
     )
  on conflict (pagamento_id) do nothing;

  -- Se a cobrança correta do mês atual já estiver paga, preserva na cobrança
  -- de outubro o pagamento e seus metadados antes de consolidar as duplicatas.
  update public.pagamentos origem
     set status = case when destino.status = 'pago' then destino.status else origem.status end,
         data_pagamento = case when destino.status = 'pago' then destino.data_pagamento else origem.data_pagamento end,
         metodo_pagamento = case when destino.status = 'pago' then destino.metodo_pagamento else origem.metodo_pagamento end,
         comprovante_path = coalesce(origem.comprovante_path, destino.comprovante_path),
         observacao = coalesce(origem.observacao, destino.observacao),
         updated_at = now()
    from public.pagamentos destino
   where origem.tipo = 'mensalidade' and origem.competencia = v_origem
     and destino.tipo = 'mensalidade' and destino.competencia = v_destino
     and (
       (origem.jogador_id is not null and destino.jogador_id = origem.jogador_id)
       or (origem.jogador_id is null and origem.user_id is not null and destino.user_id = origem.user_id)
     );

  -- Remove somente as duplicatas já copiadas integralmente para o backup.
  delete from public.pagamentos destino
   where destino.tipo = 'mensalidade' and destino.competencia = v_destino
     and exists (
       select 1 from public.pagamentos origem
        where origem.tipo = 'mensalidade' and origem.competencia = v_origem
          and (
            (origem.jogador_id is not null and origem.jogador_id = destino.jogador_id)
            or (origem.jogador_id is null and origem.user_id is not null and origem.user_id = destino.user_id)
          )
     );

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
  if not exists (select 1 from public.financeiro_competencia_backup) then
    return 0;
  end if;

  delete from public.pagamentos p
   using public.financeiro_competencia_backup b
   where p.id = b.pagamento_id
      or (
        p.tipo = 'mensalidade'
        and p.competencia in (b.competencia_destino, date '2026-10-01')
        and (
          (p.jogador_id is not null and p.jogador_id = (b.dados->>'jogador_id')::uuid)
          or (p.jogador_id is null and p.user_id is not null and p.user_id = (b.dados->>'user_id')::uuid)
        )
      );

  insert into public.pagamentos
  select (jsonb_populate_record(null::public.pagamentos, b.dados)).*
    from public.financeiro_competencia_backup b;

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
