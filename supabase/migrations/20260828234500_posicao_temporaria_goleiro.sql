create or replace function public.admin_definir_posicao_temporaria(
  p_participante_id uuid,
  p_posicao public.posicao_lista
) returns void language plpgsql security definer set search_path='' as $$
declare
  v_item public.pelada_participantes;
  v_limite integer;
  v_ocupadas integer;
  v_status public.participante_status;
begin
  if not public.is_admin() then raise exception 'Acesso negado'; end if;
  select pp.* into v_item
  from public.pelada_participantes pp
  join public.jogadores j on j.id=pp.jogador_id
  where pp.id=p_participante_id and j.posicao='goleiro'
  for update of pp;
  if not found then raise exception 'Escolha um jogador cadastrado como goleiro'; end if;
  if v_item.status not in('confirmado','presente','espera') then raise exception 'O jogador não está disponível nesta pelada'; end if;

  select limite_jogadores into v_limite from public.peladas where id=v_item.pelada_id for update;
  select count(*) into v_ocupadas from public.pelada_participantes
  where pelada_id=v_item.pelada_id and categoria=p_posicao
    and status in('confirmado','presente') and id<>v_item.id;

  v_status=case
    when p_posicao='goleiro' and v_ocupadas>=3 then 'espera'::public.participante_status
    when p_posicao='linha' and v_ocupadas>=v_limite then 'espera'::public.participante_status
    when v_item.status='presente' then 'presente'::public.participante_status
    else 'confirmado'::public.participante_status
  end;
  update public.pelada_participantes
  set categoria=p_posicao,status=v_status,updated_at=now()
  where id=p_participante_id;
end $$;

revoke all on function public.admin_definir_posicao_temporaria(uuid,public.posicao_lista) from public;
grant execute on function public.admin_definir_posicao_temporaria(uuid,public.posicao_lista) to authenticated;
