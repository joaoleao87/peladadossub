create or replace function public.admin_gerenciar_participante_id(
  p_participante_id uuid,
  p_acao text
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_item public.pelada_participantes;
  v_alvo public.pelada_participantes;
  v_limite integer;
  v_count integer;
begin
  if not public.is_admin() then raise exception 'Acesso negado'; end if;
  select * into v_item from public.pelada_participantes where id = p_participante_id for update;
  if not found then raise exception 'Participante não encontrado'; end if;

  if p_acao = 'remove' then
    update public.pelada_participantes set status = 'cancelado', updated_at = now() where id = p_participante_id;
    if v_item.status in ('confirmado', 'presente') and v_item.categoria = 'linha' then
      update public.pelada_participantes set status = 'confirmado', updated_at = now()
      where id = (
        select id from public.pelada_participantes
        where pelada_id = v_item.pelada_id and status = 'espera' and categoria = 'linha'
        order by ordem_entrada for update skip locked limit 1
      );
    end if;
  elsif p_acao = 'demote' then
    update public.pelada_participantes set status = 'espera', updated_at = now() where id = p_participante_id;
  elsif p_acao = 'promote' then
    select limite_jogadores into v_limite from public.peladas where id = v_item.pelada_id;
    select count(*) into v_count from public.pelada_participantes
    where pelada_id = v_item.pelada_id and categoria = 'linha' and status in ('confirmado', 'presente');
    if v_item.categoria = 'linha' and v_count >= v_limite then raise exception 'A lista de linha está lotada'; end if;
    update public.pelada_participantes set status = 'confirmado', updated_at = now() where id = p_participante_id;
  elsif p_acao in ('up', 'down') then
    select * into v_alvo from public.pelada_participantes
    where pelada_id = v_item.pelada_id and categoria = v_item.categoria and status = v_item.status
      and case when p_acao = 'up' then ordem_entrada < v_item.ordem_entrada else ordem_entrada > v_item.ordem_entrada end
    order by case when p_acao = 'up' then -ordem_entrada else ordem_entrada end
    limit 1 for update;
    if found then
      update public.pelada_participantes set ordem_entrada = v_alvo.ordem_entrada where id = v_item.id;
      update public.pelada_participantes set ordem_entrada = v_item.ordem_entrada where id = v_alvo.id;
    end if;
  elsif p_acao = 'linha' then
    update public.pelada_participantes set categoria = 'linha', updated_at = now() where id = p_participante_id;
  elsif p_acao = 'goleiro' then
    update public.pelada_participantes set categoria = 'goleiro', updated_at = now() where id = p_participante_id;
  elsif p_acao in ('presente', 'faltou') then
    update public.pelada_participantes set status = p_acao::public.participante_status, updated_at = now() where id = p_participante_id;
  else
    raise exception 'Ação inválida';
  end if;
end $$;

revoke all on function public.admin_gerenciar_participante_id(uuid, text) from public;
grant execute on function public.admin_gerenciar_participante_id(uuid, text) to authenticated;
