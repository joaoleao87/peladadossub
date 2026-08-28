-- Mantém no máximo três goleiros confirmados por pelada.
with classificados as (
  select id,row_number() over(partition by pelada_id order by ordem_entrada,id) as posicao
  from public.pelada_participantes
  where categoria='goleiro' and status in('confirmado','presente')
)
update public.pelada_participantes pp set status='espera',updated_at=now()
from classificados c where c.id=pp.id and c.posicao>3;

create or replace function public.aplicar_limite_goleiros()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_confirmados integer;
begin
  if new.categoria='goleiro' and new.status in('confirmado','presente') then
    perform 1 from public.peladas where id=new.pelada_id for update;
    select count(*) into v_confirmados from public.pelada_participantes
    where pelada_id=new.pelada_id and categoria='goleiro'
      and status in('confirmado','presente') and id<>new.id;
    if v_confirmados>=3 then new.status='espera'; end if;
  end if;
  return new;
end $$;

drop trigger if exists participantes_limite_goleiros on public.pelada_participantes;
create trigger participantes_limite_goleiros
before insert or update of status,categoria on public.pelada_participantes
for each row execute function public.aplicar_limite_goleiros();

create or replace function public.promover_goleiro_suplente()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if old.categoria='goleiro' and old.status in('confirmado','presente')
    and (new.categoria<>'goleiro' or new.status not in('confirmado','presente')) then
    update public.pelada_participantes set status='confirmado',updated_at=now()
    where id=(select id from public.pelada_participantes
      where pelada_id=old.pelada_id and categoria='goleiro' and status='espera' and id<>new.id
      order by ordem_entrada for update skip locked limit 1);
  end if;
  return new;
end $$;

drop trigger if exists participantes_promover_goleiro on public.pelada_participantes;
create trigger participantes_promover_goleiro
after update of status,categoria on public.pelada_participantes
for each row execute function public.promover_goleiro_suplente();

create or replace function public.promover_fila(p_pelada_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_limite integer;v_linha integer;v_goleiros integer;
begin
  select limite_jogadores into v_limite from public.peladas where id=p_pelada_id for update;
  select count(*) into v_goleiros from public.pelada_participantes
  where pelada_id=p_pelada_id and categoria='goleiro' and status in('confirmado','presente');
  update public.pelada_participantes set status='confirmado',updated_at=now()
  where id in(select id from public.pelada_participantes
    where pelada_id=p_pelada_id and categoria='goleiro' and status='espera'
    order by ordem_entrada limit greatest(3-v_goleiros,0));
  select count(*) into v_linha from public.pelada_participantes
  where pelada_id=p_pelada_id and categoria='linha' and status in('confirmado','presente');
  update public.pelada_participantes set status='confirmado',updated_at=now()
  where id in(select id from public.pelada_participantes
    where pelada_id=p_pelada_id and categoria='linha' and status='espera'
    order by ordem_entrada limit greatest(v_limite-v_linha,0));
end $$;

create or replace function public.responder_pelada(p_pelada_id uuid,p_vai boolean)
returns text language plpgsql security definer set search_path='' as $$
declare v_game public.peladas;v_jogador public.jogadores;v_count integer;v_status public.participante_status;
begin
  select * into v_game from public.peladas where id=p_pelada_id for update;
  select * into v_jogador from public.jogadores where user_id=auth.uid() and ativo;
  if not found then raise exception 'Sua conta ainda não foi vinculada a um jogador'; end if;
  if v_game.fase_lista not in('mensalistas','geral') then raise exception 'Lista indisponível'; end if;
  if v_game.fase_lista='mensalistas' and v_jogador.tipo<>'mensalista' then raise exception 'Aguarde a liberação da lista para avulsos'; end if;
  if not p_vai then v_status='recusado';
  else
    select count(*) into v_count from public.pelada_participantes
    where pelada_id=p_pelada_id and categoria=v_jogador.posicao
      and status in('confirmado','presente') and jogador_id<>v_jogador.id;
    v_status=case
      when v_jogador.posicao='goleiro' and v_count<3 then 'confirmado'::public.participante_status
      when v_jogador.posicao='linha' and v_count<v_game.limite_jogadores then 'confirmado'::public.participante_status
      else 'espera'::public.participante_status end;
  end if;
  insert into public.pelada_participantes(pelada_id,jogador_id,user_id,status,categoria)
  values(p_pelada_id,v_jogador.id,auth.uid(),v_status,v_jogador.posicao)
  on conflict(pelada_id,jogador_id) do update set status=v_status,categoria=v_jogador.posicao,user_id=auth.uid(),updated_at=now();
  select status into v_status from public.pelada_participantes where pelada_id=p_pelada_id and jogador_id=v_jogador.id;
  return v_status::text;
end $$;

revoke all on function public.aplicar_limite_goleiros(),public.promover_goleiro_suplente(),public.promover_fila(uuid) from public;
