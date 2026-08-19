-- Prêmios pertencem a uma pelada; artilharia continua acumulada no ranking geral.
create or replace function public.resultado_premios_pelada(p_pelada_id uuid)
returns table(
  categoria text,
  jogador_id uuid,
  nome text,
  apelido text,
  votos bigint
) language sql stable security definer set search_path='' as $$
  select v.categoria, j.id, j.nome, j.apelido, count(*)::bigint
  from public.pelada_votos v
  join public.jogadores j on j.id = v.avaliado_jogador_id
  where v.pelada_id = p_pelada_id and auth.uid() is not null
  group by v.categoria, j.id, j.nome, j.apelido;
$$;
revoke all on function public.resultado_premios_pelada(uuid) from public;
grant execute on function public.resultado_premios_pelada(uuid) to authenticated;

-- Goleiro nunca recebe cobrança, independentemente de ser mensalista ou avulso.
update public.jogadores set isento_mensalidade = true where posicao = 'goleiro';

create or replace function public.garantir_isencao_goleiro()
returns trigger language plpgsql set search_path='' as $$
begin
  if new.posicao = 'goleiro' then new.isento_mensalidade = true; end if;
  return new;
end $$;
drop trigger if exists jogadores_isentar_goleiro on public.jogadores;
create trigger jogadores_isentar_goleiro
before insert or update of posicao on public.jogadores
for each row execute function public.garantir_isencao_goleiro();

update public.pagamentos p
set status = 'isento', updated_at = now()
from public.jogadores j
where p.jogador_id = j.id and j.posicao = 'goleiro'
  and p.status in ('pendente', 'atrasado');

update public.pagamentos p
set status = 'isento', updated_at = now()
where p.status in ('pendente', 'atrasado') and exists(
  select 1 from public.pelada_participantes pp
  where pp.pelada_id = p.pelada_id and pp.jogador_id = p.jogador_id
    and pp.categoria = 'goleiro'
);

create or replace function public.gerar_cobrancas_avulsas(p_pelada_id uuid,p_serie_id uuid)
returns integer language plpgsql security definer set search_path='' as $$
declare v_valor numeric(10,2); v_data date; v_count integer;
begin
  if not public.is_admin() then raise exception 'Acesso negado'; end if;
  select valor_avulso into v_valor from public.pelada_series where id=p_serie_id;
  select data into v_data from public.peladas where id=p_pelada_id;
  insert into public.pagamentos(jogador_id,user_id,pelada_id,tipo,valor,status,referencia,data_vencimento)
  select pp.jogador_id,j.user_id,p_pelada_id,'avulso',v_valor,'pendente','Pelada '||to_char(v_data,'DD/MM/YYYY'),v_data
  from public.pelada_participantes pp join public.jogadores j on j.id=pp.jogador_id
  where pp.pelada_id=p_pelada_id and pp.status in ('confirmado','presente')
    and pp.categoria <> 'goleiro' and j.posicao <> 'goleiro' and j.tipo='avulso'
  on conflict(jogador_id,pelada_id) where tipo='avulso' and jogador_id is not null and pelada_id is not null do nothing;
  get diagnostics v_count=row_count; return v_count;
end $$;

-- Solicitações de criação ou vínculo feitas pela própria conta.
create table if not exists public.solicitacoes_vinculo (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  jogador_id uuid references public.jogadores(id) on delete cascade,
  status text not null default 'pendente' check(status in ('pendente','aprovada','rejeitada')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists solicitacoes_vinculo_pendente_user
  on public.solicitacoes_vinculo(user_id) where status='pendente';
alter table public.solicitacoes_vinculo enable row level security;
create policy solicitacoes_vinculo_proprias on public.solicitacoes_vinculo
  for select to authenticated using(user_id=auth.uid());
create policy solicitacoes_vinculo_admin on public.solicitacoes_vinculo
  for select to authenticated using(public.is_admin());
grant select on public.solicitacoes_vinculo to authenticated;

create or replace function public.solicitar_vinculo(p_jogador_id uuid default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'Não autenticado'; end if;
  if exists(select 1 from public.jogadores where user_id=auth.uid() and ativo) then
    raise exception 'Sua conta já possui jogador vinculado';
  end if;
  if p_jogador_id is not null and not exists(
    select 1 from public.jogadores where id=p_jogador_id and ativo and user_id is null
  ) then raise exception 'Jogador indisponível para vínculo'; end if;
  insert into public.solicitacoes_vinculo(user_id,jogador_id)
  values(auth.uid(),p_jogador_id) returning id into v_id;
  return v_id;
end $$;

create or replace function public.avaliar_solicitacao_vinculo(p_id uuid,p_aprovar boolean)
returns void language plpgsql security definer set search_path='' as $$
declare v_pedido public.solicitacoes_vinculo; v_profile public.profiles; v_jogador public.jogadores;
begin
  if not public.is_admin() then raise exception 'Acesso negado'; end if;
  select * into v_pedido from public.solicitacoes_vinculo where id=p_id and status='pendente' for update;
  if not found then raise exception 'Solicitação não encontrada'; end if;
  if not p_aprovar then
    update public.solicitacoes_vinculo set status='rejeitada',updated_at=now() where id=p_id;
    return;
  end if;
  select * into v_profile from public.profiles where id=v_pedido.user_id and ativo for update;
  if exists(select 1 from public.jogadores where user_id=v_pedido.user_id and ativo) then
    raise exception 'A conta já possui jogador vinculado';
  end if;
  if v_pedido.jogador_id is null then
    insert into public.jogadores(nome,user_id,tipo,posicao)
    values(v_profile.nome,v_profile.id,'avulso','linha') returning * into v_jogador;
  else
    select * into v_jogador from public.jogadores
    where id=v_pedido.jogador_id and ativo and user_id is null for update;
    if not found then raise exception 'Jogador indisponível para vínculo'; end if;
    update public.jogadores set user_id=v_profile.id,updated_at=now() where id=v_jogador.id;
  end if;
  update public.profiles set tipo_jogador=v_jogador.tipo,
    mensalista_ativo=(v_jogador.tipo='mensalista'),posicao_lista=v_jogador.posicao,updated_at=now()
  where id=v_profile.id;
  update public.solicitacoes_vinculo set status='aprovada',updated_at=now() where id=p_id;
end $$;

create or replace function public.superadmin_criar_jogador_para_usuario(p_user_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_profile public.profiles; v_id uuid;
begin
  if not public.is_superadmin() then raise exception 'Acesso negado'; end if;
  select * into v_profile from public.profiles where id=p_user_id and ativo for update;
  if not found then raise exception 'Usuário não encontrado'; end if;
  if exists(select 1 from public.jogadores where user_id=p_user_id and ativo) then
    raise exception 'Usuário já possui jogador vinculado';
  end if;
  insert into public.jogadores(nome,user_id,tipo,posicao)
  values(v_profile.nome,p_user_id,'avulso','linha') returning id into v_id;
  update public.profiles set tipo_jogador='avulso',mensalista_ativo=false,
    posicao_lista='linha',updated_at=now() where id=p_user_id;
  return v_id;
end $$;

revoke all on function public.solicitar_vinculo(uuid),
  public.avaliar_solicitacao_vinculo(uuid,boolean),
  public.superadmin_criar_jogador_para_usuario(uuid) from public;
grant execute on function public.solicitar_vinculo(uuid),
  public.avaliar_solicitacao_vinculo(uuid,boolean),
  public.superadmin_criar_jogador_para_usuario(uuid) to authenticated;
