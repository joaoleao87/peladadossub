alter table public.peladas add column if not exists pelada_iniciada boolean not null default false;
alter table public.pelada_participantes add column if not exists comparecimento boolean;

create or replace function public.iniciar_pelada(p_pelada_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Acesso negado'; end if;
  update public.peladas set pelada_iniciada=true,status='acontecendo',fase_lista='encerrada',lista_aberta=false,lista_automatica=false,updated_at=now()
  where id=p_pelada_id and status not in ('encerrada','cancelada');
  if not found then raise exception 'Pelada indisponível'; end if;
end $$;

create or replace function public.admin_gerenciar_participante_id(p_participante_id uuid,p_acao text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_item public.pelada_participantes; v_alvo public.pelada_participantes; v_limite integer; v_count integer; v_time public.pelada_times;
begin
  if not public.is_admin() then raise exception 'Acesso negado'; end if;
  select * into v_item from public.pelada_participantes where id=p_participante_id for update;
  if not found then raise exception 'Participante não encontrado'; end if;
  if p_acao in ('presente','faltou') then
    if not exists(select 1 from public.peladas where id=v_item.pelada_id and pelada_iniciada) then raise exception 'Marque que a pelada iniciou antes de registrar presença ou falta'; end if;
    if p_acao='presente' then
      update public.pelada_participantes set comparecimento=true,status=case when status='espera' then status else 'presente'::public.participante_status end,updated_at=now() where id=p_participante_id;
    else
      select * into v_time from public.pelada_times where pelada_id=v_item.pelada_id and jogador_id=v_item.jogador_id for update;
      update public.pelada_participantes set status='faltou',comparecimento=false,updated_at=now() where id=p_participante_id;
      delete from public.pelada_times where pelada_id=v_item.pelada_id and jogador_id=v_item.jogador_id;
      if v_item.status in ('confirmado','presente') and v_item.categoria='linha' then
        select * into v_alvo from public.pelada_participantes where pelada_id=v_item.pelada_id and status='espera' and categoria='linha' and comparecimento=true order by ordem_entrada for update skip locked limit 1;
        if found then
          update public.pelada_participantes set status='presente',updated_at=now() where id=v_alvo.id;
          if v_time.jogador_id is not null then insert into public.pelada_times(pelada_id,jogador_id,time,ordem) values(v_item.pelada_id,v_alvo.jogador_id,v_time.time,v_time.ordem) on conflict(pelada_id,jogador_id) do update set time=excluded.time,ordem=excluded.ordem; end if;
        end if;
      end if;
    end if;
  elsif p_acao='remove' then update public.pelada_participantes set status='cancelado',updated_at=now() where id=p_participante_id;
  elsif p_acao='demote' then update public.pelada_participantes set status='espera',updated_at=now() where id=p_participante_id;
  elsif p_acao='promote' then
    select limite_jogadores into v_limite from public.peladas where id=v_item.pelada_id;
    select count(*) into v_count from public.pelada_participantes where pelada_id=v_item.pelada_id and categoria='linha' and status in ('confirmado','presente');
    if v_item.categoria='linha' and v_count>=v_limite then raise exception 'A lista de linha está lotada'; end if;
    update public.pelada_participantes set status='confirmado',updated_at=now() where id=p_participante_id;
  elsif p_acao in ('up','down') then
    select * into v_alvo from public.pelada_participantes where pelada_id=v_item.pelada_id and categoria=v_item.categoria and status=v_item.status and case when p_acao='up' then ordem_entrada<v_item.ordem_entrada else ordem_entrada>v_item.ordem_entrada end order by case when p_acao='up' then -ordem_entrada else ordem_entrada end limit 1 for update;
    if found then update public.pelada_participantes set ordem_entrada=v_alvo.ordem_entrada where id=v_item.id; update public.pelada_participantes set ordem_entrada=v_item.ordem_entrada where id=v_alvo.id; end if;
  elsif p_acao='linha' then update public.pelada_participantes set categoria='linha',updated_at=now() where id=p_participante_id;
  elsif p_acao='goleiro' then update public.pelada_participantes set categoria='goleiro',status='confirmado',updated_at=now() where id=p_participante_id;
  else raise exception 'Ação inválida'; end if;
end $$;

revoke all on function public.iniciar_pelada(uuid),public.admin_gerenciar_participante_id(uuid,text) from public;
grant execute on function public.iniciar_pelada(uuid),public.admin_gerenciar_participante_id(uuid,text) to authenticated;

delete from public.pagamentos where pelada_id in(select id from public.peladas where data=date '2026-08-14');
delete from public.peladas where data=date '2026-08-14';
