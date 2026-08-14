create unique index if not exists peladas_serie_data_unique on public.peladas(serie_id,data) where serie_id is not null;

create or replace function public.gerar_proxima_pelada(p_serie_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare v_serie public.pelada_series; v_data date; v_id uuid;
begin
  if not public.is_admin() then raise exception 'Acesso negado'; end if;
  select * into v_serie from public.pelada_series where id=p_serie_id and ativa;
  if not found then raise exception 'Recorrência não encontrada'; end if;
  v_data := current_date + ((v_serie.dia_semana - extract(dow from current_date)::integer + 7) % 7);
  if v_data=current_date and localtime > v_serie.horario then v_data:=v_data+7; end if;
  insert into public.peladas(serie_id,data,horario,local,limite_jogadores,status,lista_aberta,fase_lista)
  values(v_serie.id,v_data,v_serie.horario,v_serie.local,v_serie.limite_jogadores,'aberta',false,'fechada')
  on conflict(serie_id,data) where serie_id is not null do update set horario=excluded.horario,local=excluded.local,limite_jogadores=excluded.limite_jogadores,updated_at=now()
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.gerar_proxima_pelada(uuid) from public;
grant execute on function public.gerar_proxima_pelada(uuid) to authenticated;
