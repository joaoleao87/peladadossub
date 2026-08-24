create or replace function public.admin_definir_gols(
  p_participante_id uuid,
  p_gols integer
) returns void language plpgsql security definer set search_path='' as $$
begin
  if not public.is_admin() then raise exception 'Acesso negado'; end if;
  if p_gols not between 0 and 99 then raise exception 'Quantidade de gols inválida'; end if;
  update public.pelada_participantes
  set gols=p_gols,updated_at=now()
  where id=p_participante_id
    and (status in('confirmado','presente') or comparecimento=true);
  if not found then raise exception 'Marque o jogador como presente antes de registrar gols'; end if;
end $$;
revoke all on function public.admin_definir_gols(uuid,integer) from public;
grant execute on function public.admin_definir_gols(uuid,integer) to authenticated;

create or replace function public.adicionar_jogador_sorteio(
  p_pelada_id uuid,
  p_jogador_id uuid,
  p_time integer
) returns void language plpgsql security definer set search_path='' as $$
declare v_ordem integer; v_participante_id uuid;
begin
  if not public.is_admin() then raise exception 'Acesso negado'; end if;
  if p_time not between 1 and 5 then raise exception 'Time inválido'; end if;
  perform 1 from public.peladas where id=p_pelada_id for update;
  if not found then raise exception 'Pelada não encontrada'; end if;
  select id into v_participante_id
  from public.pelada_participantes
  where pelada_id=p_pelada_id and jogador_id=p_jogador_id and categoria='linha'
    and (status in('confirmado','presente') or (status='espera' and comparecimento=true))
  for update;
  if v_participante_id is null then raise exception 'Marque o suplente como presente antes de promovê-lo'; end if;
  select slot into v_ordem from generate_series(1,4) as slots(slot)
  where not exists(select 1 from public.pelada_times where pelada_id=p_pelada_id and time=p_time and ordem=slot)
  order by slot limit 1;
  if v_ordem is null then raise exception 'Este time já tem 4 jogadores'; end if;
  update public.pelada_participantes set status='presente',comparecimento=true,updated_at=now()
  where id=v_participante_id;
  insert into public.pelada_times(pelada_id,jogador_id,time,ordem)
  values(p_pelada_id,p_jogador_id,p_time,v_ordem);
  update public.peladas set sorteio_liberado=false,updated_at=now() where id=p_pelada_id;
end $$;
revoke all on function public.adicionar_jogador_sorteio(uuid,uuid,integer) from public;
grant execute on function public.adicionar_jogador_sorteio(uuid,uuid,integer) to authenticated;
