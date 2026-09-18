-- A presença confirmada é a origem única da cobrança de diarista.
create or replace function public.gerar_cobranca_diarista_por_presenca()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_valor numeric(10,2); v_data date;
begin
  if new.comparecimento is not true or old.comparecimento is true then return new; end if;

  select serie.valor_avulso, pelada.data into v_valor, v_data
    from public.jogadores jogador
    join public.peladas pelada on pelada.id = new.pelada_id
    join public.pelada_series serie on serie.ativa
   where jogador.id = new.jogador_id
     and jogador.tipo = 'avulso'
     and jogador.posicao <> 'goleiro'
     and new.categoria <> 'goleiro'
   limit 1;

  if v_valor is null then return new; end if;

  insert into public.pagamentos(jogador_id,user_id,pelada_id,tipo,valor,status,referencia,data_vencimento)
  select new.jogador_id,jogador.user_id,new.pelada_id,'avulso',v_valor,'pendente',
    'Diarista '||to_char(v_data,'DD/MM/YYYY'),v_data
    from public.jogadores jogador where jogador.id = new.jogador_id
  on conflict(jogador_id,pelada_id) where tipo='avulso' and jogador_id is not null and pelada_id is not null do nothing;
  return new;
end $$;

drop trigger if exists participantes_gerar_cobranca_diarista on public.pelada_participantes;
create trigger participantes_gerar_cobranca_diarista
after update of comparecimento on public.pelada_participantes
for each row execute function public.gerar_cobranca_diarista_por_presenca();

create or replace function public.remover_cobranca(p_pagamento_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not public.is_admin() then raise exception 'Acesso negado'; end if;
  delete from public.pagamentos
   where id = p_pagamento_id and status in ('pendente','atrasado');
  if not found then raise exception 'Somente cobranças em aberto podem ser removidas'; end if;
end $$;

revoke all on function public.remover_cobranca(uuid) from public;
grant execute on function public.remover_cobranca(uuid) to authenticated;
