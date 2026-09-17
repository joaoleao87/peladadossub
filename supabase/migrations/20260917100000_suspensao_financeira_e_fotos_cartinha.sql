alter table public.jogadores
  add column if not exists confirmacao_bloqueada_motivo text,
  add column if not exists suspensao_confirmacao_pagamento_id uuid references public.pagamentos(id) on delete set null;

create or replace function public.validar_confirmacao_liberada(p_jogador_id uuid)
returns void language plpgsql stable security definer set search_path='' as $$
declare v_motivo text;
begin
  select confirmacao_bloqueada_motivo into v_motivo
  from public.jogadores
  where id=p_jogador_id and ativo and confirmacao_bloqueada;
  if found then
    raise exception '%', 'Sua confirmação está suspensa' || case when nullif(trim(v_motivo),'') is null then '.' else ': ' || trim(v_motivo) end;
  end if;
  if exists(select 1 from public.jogadores where id=p_jogador_id and not ativo) then
    raise exception 'Sua conta está indisponível. Fale com a administração.';
  end if;
end $$;

create or replace function public.admin_suspender_confirmacao_pagamento(
  p_pagamento_id uuid,
  p_suspender boolean,
  p_motivo text default null
) returns void language plpgsql security definer set search_path='' as $$
declare v_pagamento public.pagamentos; v_motivo text:=nullif(trim(p_motivo),'');
begin
  if not public.is_admin() then raise exception 'Acesso negado'; end if;
  select * into v_pagamento from public.pagamentos where id=p_pagamento_id for update;
  if not found or v_pagamento.jogador_id is null then raise exception 'Cobrança sem jogador vinculado'; end if;
  if v_pagamento.status not in('pendente','atrasado') then raise exception 'A confirmação só pode ser suspensa para cobrança em aberto'; end if;
  if p_suspender and (v_motivo is null or char_length(v_motivo) not between 3 and 300) then
    raise exception 'Informe um motivo entre 3 e 300 caracteres';
  end if;
  update public.jogadores set
    confirmacao_bloqueada=p_suspender,
    confirmacao_bloqueada_motivo=case when p_suspender then v_motivo else null end,
    suspensao_confirmacao_pagamento_id=case when p_suspender then p_pagamento_id else null end,
    updated_at=now()
  where id=v_pagamento.jogador_id;
  if not found then raise exception 'Jogador não encontrado'; end if;
end $$;

create or replace function public.reativar_confirmacao_quando_pagamento_quitado()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.status='pago' and old.status is distinct from new.status then
    update public.jogadores set
      confirmacao_bloqueada=false,
      confirmacao_bloqueada_motivo=null,
      suspensao_confirmacao_pagamento_id=null,
      updated_at=now()
    where suspensao_confirmacao_pagamento_id=new.id;
  end if;
  return new;
end $$;
drop trigger if exists pagamentos_reativar_confirmacao_quitada on public.pagamentos;
create trigger pagamentos_reativar_confirmacao_quitada
after update of status on public.pagamentos
for each row execute function public.reativar_confirmacao_quando_pagamento_quitado();

create or replace function public.admin_salvar_foto_cartinha(
  p_player_id uuid,
  p_photo_url text,
  p_photo_scale numeric,
  p_photo_position_x numeric,
  p_photo_position_y numeric
) returns public.player_cards language plpgsql security definer set search_path='' as $$
declare v_card public.player_cards; v_path text:=nullif(trim(p_photo_url),'');
begin
  if not public.is_admin() then raise exception 'Acesso negado'; end if;
  if not exists(select 1 from public.jogadores where id=p_player_id) then raise exception 'Jogador não encontrado'; end if;
  if v_path is null or v_path not like p_player_id::text || '/%' then raise exception 'Foto inválida'; end if;
  if p_photo_scale not between .5 and 3 or p_photo_position_x not between -100 and 100 or p_photo_position_y not between -100 and 100 then
    raise exception 'Enquadramento inválido';
  end if;
  insert into public.player_cards(player_id,photo_url,photo_scale,photo_position_x,photo_position_y)
  values(p_player_id,v_path,p_photo_scale,p_photo_position_x,p_photo_position_y)
  on conflict(player_id) do update set
    photo_url=excluded.photo_url,
    photo_scale=excluded.photo_scale,
    photo_position_x=excluded.photo_position_x,
    photo_position_y=excluded.photo_position_y,
    updated_at=now()
  returning * into v_card;
  return v_card;
end $$;

revoke all on function public.admin_suspender_confirmacao_pagamento(uuid,boolean,text), public.admin_salvar_foto_cartinha(uuid,text,numeric,numeric,numeric) from public;
grant execute on function public.admin_suspender_confirmacao_pagamento(uuid,boolean,text), public.admin_salvar_foto_cartinha(uuid,text,numeric,numeric,numeric) to authenticated;
