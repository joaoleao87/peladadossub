create table if not exists public.despesas (
  id uuid primary key default gen_random_uuid(), descricao text not null check(char_length(trim(descricao)) between 2 and 150),
  valor_total numeric(10,2) not null check(valor_total>0), numero_parcelas integer not null check(numero_parcelas between 1 and 120),
  data_primeira_parcela date not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.despesa_parcelas (
  id uuid primary key default gen_random_uuid(), despesa_id uuid not null references public.despesas(id) on delete cascade,
  numero integer not null, valor numeric(10,2) not null check(valor>0), data_vencimento date not null,
  paga boolean not null default false, data_pagamento date, created_at timestamptz not null default now(), unique(despesa_id,numero)
);
alter table public.despesas enable row level security;
alter table public.despesa_parcelas enable row level security;
drop policy if exists despesas_admin on public.despesas;
drop policy if exists despesa_parcelas_admin on public.despesa_parcelas;
create policy despesas_admin on public.despesas for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy despesa_parcelas_admin on public.despesa_parcelas for all to authenticated using(public.is_admin()) with check(public.is_admin());
grant select,insert,update,delete on public.despesas,public.despesa_parcelas to authenticated;

create or replace function public.criar_despesa(p_descricao text,p_data date,p_parcelas integer,p_valor numeric,p_valor_tipo text) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_total numeric(10,2); v_base numeric(10,2); v_valor numeric(10,2); i integer; begin
  if not public.is_admin() then raise exception 'Acesso negado'; end if;
  if char_length(trim(p_descricao))<2 or p_data is null or p_parcelas not between 1 and 120 or p_valor<=0 then raise exception 'Dados da despesa inválidos'; end if;
  if p_valor_tipo not in ('total','parcela') then raise exception 'Tipo de valor inválido'; end if;
  v_total=case when p_valor_tipo='parcela' then round(p_valor*p_parcelas,2) else round(p_valor,2) end;
  v_base=round(v_total/p_parcelas,2);
  insert into public.despesas(descricao,valor_total,numero_parcelas,data_primeira_parcela) values(trim(p_descricao),v_total,p_parcelas,p_data) returning id into v_id;
  for i in 1..p_parcelas loop
    v_valor=case when i=p_parcelas then v_total-v_base*(p_parcelas-1) else v_base end;
    insert into public.despesa_parcelas(despesa_id,numero,valor,data_vencimento) values(v_id,i,v_valor,(p_data+(i-1)*interval '1 month')::date);
  end loop; return v_id;
end $$;
create or replace function public.atualizar_parcela_despesa(p_id uuid,p_paga boolean) returns void language plpgsql security definer set search_path='' as $$
begin if not public.is_admin() then raise exception 'Acesso negado'; end if; update public.despesa_parcelas set paga=p_paga,data_pagamento=case when p_paga then current_date else null end where id=p_id; if not found then raise exception 'Parcela não encontrada'; end if; end $$;
create or replace function public.excluir_despesa(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin if not public.is_admin() then raise exception 'Acesso negado'; end if; delete from public.despesas where id=p_id; if not found then raise exception 'Despesa não encontrada'; end if; end $$;
revoke all on function public.criar_despesa(text,date,integer,numeric,text),public.atualizar_parcela_despesa(uuid,boolean),public.excluir_despesa(uuid) from public;
grant execute on function public.criar_despesa(text,date,integer,numeric,text),public.atualizar_parcela_despesa(uuid,boolean),public.excluir_despesa(uuid) to authenticated;
