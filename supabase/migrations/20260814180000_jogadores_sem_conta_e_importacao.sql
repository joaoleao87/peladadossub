create table if not exists public.jogadores (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(trim(nome)) between 2 and 100),
  apelido text,
  telefone text,
  user_id uuid unique references public.profiles(id) on delete set null,
  tipo public.tipo_jogador not null default 'avulso',
  posicao public.posicao_lista not null default 'linha',
  ativo boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

insert into public.jogadores(nome,apelido,telefone,user_id,tipo,posicao,ativo)
select nome,apelido,telefone,id,tipo_jogador,posicao_lista,ativo from public.profiles
on conflict(user_id) do update set nome=excluded.nome,apelido=excluded.apelido,telefone=excluded.telefone,tipo=excluded.tipo,posicao=excluded.posicao,ativo=excluded.ativo;

alter table public.pelada_participantes add column if not exists jogador_id uuid references public.jogadores(id) on delete cascade;
update public.pelada_participantes pp set jogador_id=j.id from public.jogadores j where j.user_id=pp.user_id and pp.jogador_id is null;
alter table public.pelada_participantes alter column jogador_id set not null;
alter table public.pelada_participantes alter column user_id drop not null;
alter table public.pelada_participantes drop constraint if exists pelada_participantes_pelada_id_user_id_key;
create unique index if not exists pelada_participantes_pelada_jogador on public.pelada_participantes(pelada_id,jogador_id);

alter table public.pagamentos add column if not exists jogador_id uuid references public.jogadores(id);
update public.pagamentos p set jogador_id=j.id from public.jogadores j where j.user_id=p.user_id and p.jogador_id is null;
alter table public.pagamentos alter column user_id drop not null;

alter table public.jogadores enable row level security;
create policy jogadores_read on public.jogadores for select to authenticated using(true);
create policy jogadores_admin on public.jogadores for all to authenticated using(public.is_admin()) with check(public.is_admin());
grant select,insert,update,delete on public.jogadores to authenticated;

create or replace function public.novo_usuario() returns trigger language plpgsql security definer set search_path='' as $$
declare v_nome text;
begin
  v_nome=coalesce(nullif(trim(new.raw_user_meta_data->>'nome'),''),split_part(new.email,'@',1));
  insert into public.profiles(id,nome) values(new.id,v_nome);
  insert into public.jogadores(nome,user_id) values(v_nome,new.id);
  return new;
end $$;

create or replace function public.salvar_jogador(p_id uuid,p_nome text,p_tipo public.tipo_jogador,p_posicao public.posicao_lista,p_user_id uuid default null) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
  if not public.is_admin() then raise exception 'Acesso negado'; end if;
  if char_length(trim(p_nome))<2 then raise exception 'Informe o nome'; end if;
  if p_user_id is not null and exists(select 1 from public.jogadores where user_id=p_user_id and id<>coalesce(p_id,'00000000-0000-0000-0000-000000000000')) then raise exception 'Esta conta já está vinculada'; end if;
  if p_id is null then
    insert into public.jogadores(nome,tipo,posicao,user_id) values(trim(p_nome),p_tipo,p_posicao,p_user_id) returning id into v_id;
  else
    update public.jogadores set nome=trim(p_nome),tipo=p_tipo,posicao=p_posicao,user_id=p_user_id,updated_at=now() where id=p_id returning id into v_id;
  end if;
  if p_user_id is not null then update public.profiles set tipo_jogador=p_tipo,mensalista_ativo=(p_tipo='mensalista'),posicao_lista=p_posicao where id=p_user_id; end if;
  return v_id;
end $$;

create or replace function public.importar_lista_whatsapp(p_pelada_id uuid,p_itens jsonb) returns integer language plpgsql security definer set search_path='' as $$
declare v_item jsonb; v_jogador uuid; v_total int=0; v_categoria public.posicao_lista; v_status public.participante_status;
begin
  if not public.is_admin() then raise exception 'Acesso negado'; end if;
  perform 1 from public.peladas where id=p_pelada_id for update;
  for v_item in select * from jsonb_array_elements(p_itens) loop
    if char_length(trim(v_item->>'nome'))<2 then continue; end if;
    v_categoria=case when v_item->>'grupo'='goleiro' then 'goleiro'::public.posicao_lista else 'linha'::public.posicao_lista end;
    v_status=case when v_item->>'grupo'='suplente' then 'espera'::public.participante_status else 'confirmado'::public.participante_status end;
    select id into v_jogador from public.jogadores where lower(trim(coalesce(apelido,nome)))=lower(trim(v_item->>'nome')) or lower(trim(nome))=lower(trim(v_item->>'nome')) order by ativo desc limit 1;
    if v_jogador is null then insert into public.jogadores(nome,posicao) values(trim(v_item->>'nome'),v_categoria) returning id into v_jogador; end if;
    insert into public.pelada_participantes(pelada_id,jogador_id,user_id,status,categoria)
    select p_pelada_id,j.id,j.user_id,v_status,v_categoria from public.jogadores j where j.id=v_jogador
    on conflict(pelada_id,jogador_id) do update set status=excluded.status,categoria=excluded.categoria,updated_at=now();
    v_total=v_total+1;
  end loop;
  return v_total;
end $$;

create or replace function public.responder_pelada(p_pelada_id uuid,p_vai boolean) returns text language plpgsql security definer set search_path='' as $$
declare v_game public.peladas; v_jogador public.jogadores; v_count integer; v_status public.participante_status;
begin
  select * into v_game from public.peladas where id=p_pelada_id for update;
  select * into v_jogador from public.jogadores where user_id=auth.uid();
  if not found or v_game.fase_lista not in ('mensalistas','geral') then raise exception 'Lista indisponível'; end if;
  if v_game.fase_lista='mensalistas' and v_jogador.tipo<>'mensalista' then raise exception 'Lista exclusiva para mensalistas'; end if;
  if not p_vai then v_status='recusado'; elsif v_jogador.posicao='goleiro' then v_status='confirmado'; else
    select count(*) into v_count from public.pelada_participantes where pelada_id=p_pelada_id and categoria='linha' and status in ('confirmado','presente');
    v_status=case when v_count<v_game.limite_jogadores then 'confirmado' else 'espera' end;
  end if;
  insert into public.pelada_participantes(pelada_id,jogador_id,user_id,status,categoria) values(p_pelada_id,v_jogador.id,auth.uid(),v_status,v_jogador.posicao)
  on conflict(pelada_id,jogador_id) do update set status=v_status,categoria=v_jogador.posicao,user_id=auth.uid(),updated_at=now();
  return v_status::text;
end $$;

create or replace function public.sincronizar_fase_lista(p_pelada_id uuid) returns public.lista_fase language plpgsql security definer set search_path='' as $$
declare v_game public.peladas; v_start timestamp; v_now timestamp; v_fase public.lista_fase;
begin
  select * into v_game from public.peladas where id=p_pelada_id for update;
  if not found then raise exception 'Pelada não encontrada'; end if;
  if not v_game.lista_automatica or v_game.status in ('cancelada','encerrada') then return v_game.fase_lista; end if;
  v_start=v_game.data+v_game.horario; v_now=now() at time zone 'America/Sao_Paulo';
  v_fase=case when v_now>=v_start-interval '12 hours' then 'geral'::public.lista_fase when v_now>=v_start-interval '24 hours' then 'mensalistas'::public.lista_fase else 'fechada'::public.lista_fase end;
  update public.peladas set fase_lista=v_fase,lista_aberta=(v_fase in ('mensalistas','geral')),updated_at=now() where id=p_pelada_id and fase_lista<>v_fase;
  if v_fase in ('mensalistas','geral') then
    insert into public.pelada_participantes(pelada_id,jogador_id,user_id,status,categoria)
    select p_pelada_id,id,user_id,'aguardando_resposta',posicao from public.jogadores where tipo='mensalista' and ativo
    on conflict(pelada_id,jogador_id) do nothing;
  end if;
  return v_fase;
end $$;

create or replace function public.definir_fase_lista(p_pelada_id uuid,p_fase public.lista_fase) returns void language plpgsql security definer set search_path='' as $$
begin
  if not public.is_admin() then raise exception 'Acesso negado'; end if;
  update public.peladas set fase_lista=p_fase,lista_aberta=(p_fase in ('mensalistas','geral')),lista_automatica=false,updated_at=now() where id=p_pelada_id;
  if p_fase in ('mensalistas','geral') then
    insert into public.pelada_participantes(pelada_id,jogador_id,user_id,status,categoria)
    select p_pelada_id,id,user_id,'aguardando_resposta',posicao from public.jogadores where tipo='mensalista' and ativo
    on conflict(pelada_id,jogador_id) do nothing;
  end if;
end $$;

create or replace function public.admin_gerenciar_participante_id(p_participante_id uuid,p_acao text) returns void language plpgsql security definer set search_path='' as $$
declare v_pelada uuid; v_old public.participante_status; v_categoria public.posicao_lista;
begin
  if not public.is_admin() then raise exception 'Acesso negado'; end if;
  select pelada_id,status,categoria into v_pelada,v_old,v_categoria from public.pelada_participantes where id=p_participante_id for update;
  if p_acao='remove' then update public.pelada_participantes set status='cancelado',updated_at=now() where id=p_participante_id;
  elsif p_acao='promote' then update public.pelada_participantes set status='confirmado',updated_at=now() where id=p_participante_id;
  elsif p_acao in ('presente','faltou') then update public.pelada_participantes set status=p_acao::public.participante_status,updated_at=now() where id=p_participante_id;
  else raise exception 'Ação inválida'; end if;
  if p_acao='remove' and v_old in ('confirmado','presente') and v_categoria='linha' then update public.pelada_participantes set status='confirmado',updated_at=now() where id=(select id from public.pelada_participantes where pelada_id=v_pelada and status='espera' and categoria='linha' order by ordem_entrada for update skip locked limit 1); end if;
end $$;

revoke all on function public.salvar_jogador(uuid,text,public.tipo_jogador,public.posicao_lista,uuid),public.importar_lista_whatsapp(uuid,jsonb),public.admin_gerenciar_participante_id(uuid,text) from public;
grant execute on function public.salvar_jogador(uuid,text,public.tipo_jogador,public.posicao_lista,uuid),public.importar_lista_whatsapp(uuid,jsonb),public.admin_gerenciar_participante_id(uuid,text) to authenticated;
