alter table public.notificacoes add column if not exists referencia_id uuid;
create unique index if not exists notificacoes_evento_unico_usuario on public.notificacoes(user_id,tipo,referencia_id) where referencia_id is not null;

drop function if exists public.admin_enviar_notificacao_massa(text,text,text);
create function public.admin_enviar_notificacao_massa(p_titulo text,p_mensagem text,p_link text default '/',p_publico text default 'todos')
returns integer language plpgsql security definer set search_path='' as $$
declare v_total integer;
begin
  if not public.is_admin() then raise exception 'Acesso negado'; end if;
  if char_length(trim(p_titulo))<2 or char_length(trim(p_mensagem))<2 then raise exception 'Informe título e mensagem'; end if;
  if p_publico not in('todos','mensalistas','diaristas','confirmados','inadimplentes','admins') then raise exception 'Público inválido'; end if;
  insert into public.notificacoes(user_id,titulo,mensagem,link,tipo,criada_por)
  select p.id,trim(p_titulo),trim(p_mensagem),coalesce(nullif(p_link,''),'/'),'massa',auth.uid()
  from public.profiles p where p.ativo and (
    p_publico='todos' or p_publico='mensalistas' and p.mensalista_ativo or p_publico='diaristas' and not p.mensalista_ativo
    or p_publico='admins' and p.role in('admin','superadmin')
    or p_publico='confirmados' and exists(
      select 1 from public.pelada_participantes pp
      where pp.user_id=p.id and pp.status in('confirmado','presente')
        and pp.pelada_id=(select g.id from public.peladas g where g.data>=current_date and g.status<>'cancelada' order by g.data,g.horario limit 1)
    )
    or p_publico='inadimplentes' and exists(select 1 from public.pagamentos pg left join public.jogadores j on j.id=pg.jogador_id where coalesce(pg.user_id,j.user_id)=p.id and pg.status in('pendente','atrasado'))
  );
  get diagnostics v_total=row_count; return v_total;
end $$;
revoke all on function public.admin_enviar_notificacao_massa(text,text,text,text) from public;
grant execute on function public.admin_enviar_notificacao_massa(text,text,text,text) to authenticated;

create or replace function public.notificar_eventos_pelada()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.fase_lista is distinct from old.fase_lista and new.fase_lista in('mensalistas','geral') then
    insert into public.notificacoes(user_id,titulo,mensagem,link,tipo,referencia_id)
    select p.id,'Lista liberada','A lista da próxima pelada está aberta. Confirme sua participação.','/lista','lista_'||new.fase_lista,new.id
    from public.profiles p where p.ativo and (new.fase_lista='geral' or p.mensalista_ativo)
    on conflict(user_id,tipo,referencia_id) where referencia_id is not null do nothing;
  end if;
  if new.sorteio_liberado is true and old.sorteio_liberado is distinct from true then
    insert into public.notificacoes(user_id,titulo,mensagem,link,tipo,referencia_id)
    select distinct pp.user_id,'Times liberados','Os times da pelada foram liberados. Confira sua equipe.','/lista','times_liberados',new.id
    from public.pelada_participantes pp where pp.pelada_id=new.id and pp.user_id is not null and pp.status in('confirmado','presente')
    on conflict(user_id,tipo,referencia_id) where referencia_id is not null do nothing;
  end if;
  return new;
end $$;
drop trigger if exists peladas_notificar_eventos on public.peladas;
create trigger peladas_notificar_eventos after update of fase_lista,sorteio_liberado on public.peladas for each row execute function public.notificar_eventos_pelada();

create or replace function public.notificar_pelada_lotada()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_limite integer;v_total integer;
begin
  if new.status not in('confirmado','presente') or new.categoria='goleiro' then return new; end if;
  select limite_jogadores into v_limite from public.peladas where id=new.pelada_id;
  select count(*) into v_total from public.pelada_participantes where pelada_id=new.pelada_id and categoria='linha' and status in('confirmado','presente');
  if v_total>=v_limite then
    insert into public.notificacoes(user_id,titulo,mensagem,link,tipo,referencia_id)
    select id,'Pelada sem vagas','A próxima pelada atingiu o limite de jogadores.','/lista','pelada_lotada',new.pelada_id from public.profiles where ativo
    on conflict(user_id,tipo,referencia_id) where referencia_id is not null do nothing;
  end if;
  return new;
end $$;
drop trigger if exists participantes_notificar_lotacao on public.pelada_participantes;
create trigger participantes_notificar_lotacao after insert or update of status on public.pelada_participantes for each row execute function public.notificar_pelada_lotada();
