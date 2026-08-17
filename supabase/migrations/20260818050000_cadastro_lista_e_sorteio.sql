alter table public.jogadores
  add column if not exists nota_equilibrio smallint not null default 3
  check (nota_equilibrio between 1 and 5);
alter table public.peladas
  add column if not exists sorteio_liberado boolean not null default false;

create table if not exists public.pelada_times (
  pelada_id uuid not null references public.peladas(id) on delete cascade,
  jogador_id uuid not null references public.jogadores(id) on delete cascade,
  time smallint not null check (time between 1 and 5),
  ordem smallint not null check (ordem between 1 and 4),
  primary key (pelada_id, jogador_id),
  constraint pelada_times_slot_unique unique (pelada_id, time, ordem)
    deferrable initially immediate
);
alter table public.pelada_times enable row level security;
create policy pelada_times_read on public.pelada_times for select to authenticated
  using (public.is_admin() or exists(
    select 1 from public.peladas p
    where p.id = pelada_id and p.sorteio_liberado
  ));
create policy pelada_times_admin on public.pelada_times for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
grant select, insert, update, delete on public.pelada_times to authenticated;

-- Cadastro público cria somente a conta. Convites de mensalista continuam
-- criando e vinculando o jogador automaticamente.
create or replace function public.novo_usuario() returns trigger language plpgsql security definer set search_path='' as $$
declare
  v_nome text;
  v_token uuid;
  v_mensalista boolean = false;
begin
  v_nome = coalesce(nullif(trim(new.raw_user_meta_data->>'nome'), ''), split_part(new.email, '@', 1));
  if nullif(new.raw_user_meta_data->>'convite_mensalista', '') is not null then
    begin
      v_token = (new.raw_user_meta_data->>'convite_mensalista')::uuid;
    exception when invalid_text_representation then
      raise exception 'Convite inválido';
    end;
    update public.convites_mensalista
    set usado_por = new.id, usado_em = now()
    where token = v_token and usado_em is null and expira_em > now();
    if not found then
      raise exception 'Convite inválido, expirado ou já utilizado';
    end if;
    v_mensalista = true;
  end if;
  insert into public.profiles(id, nome, tipo_jogador, mensalista_ativo)
  values(new.id, v_nome,
    case when v_mensalista then 'mensalista' else 'avulso' end,
    v_mensalista);
  if v_mensalista then
    insert into public.jogadores(nome, user_id, tipo)
    values(v_nome, new.id, 'mensalista');
  end if;
  return new;
end $$;

create or replace function public.promover_fila(p_pelada_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare
  v_limite integer;
  v_confirmados integer;
begin
  select limite_jogadores into v_limite from public.peladas where id = p_pelada_id for update;
  update public.pelada_participantes
  set status = 'confirmado', updated_at = now()
  where pelada_id = p_pelada_id and status = 'espera' and categoria = 'goleiro';
  select count(*) into v_confirmados
  from public.pelada_participantes
  where pelada_id = p_pelada_id and categoria = 'linha' and status in ('confirmado', 'presente');
  update public.pelada_participantes
  set status = 'confirmado', updated_at = now()
  where id in (
    select id from public.pelada_participantes
    where pelada_id = p_pelada_id and categoria = 'linha' and status = 'espera'
    order by ordem_entrada
    limit greatest(v_limite - v_confirmados, 0)
  );
end $$;
revoke all on function public.promover_fila(uuid) from public;

create or replace function public.responder_pelada(p_pelada_id uuid, p_vai boolean) returns text language plpgsql security definer set search_path='' as $$
declare
  v_game public.peladas;
  v_jogador public.jogadores;
  v_count integer;
  v_status public.participante_status;
begin
  select * into v_game from public.peladas where id = p_pelada_id for update;
  select * into v_jogador from public.jogadores where user_id = auth.uid() and ativo;
  if not found then
    raise exception 'Sua conta ainda não foi vinculada a um jogador';
  end if;
  if v_game.fase_lista not in ('mensalistas', 'geral') then
    raise exception 'Lista indisponível';
  end if;
  if v_game.fase_lista = 'mensalistas' and v_jogador.tipo <> 'mensalista' then
    raise exception 'Aguarde a liberação da lista para avulsos';
  end if;
  if not p_vai then
    v_status = 'recusado';
  elsif v_jogador.posicao = 'goleiro' then
    v_status = 'confirmado';
  else
    select count(*) into v_count from public.pelada_participantes
    where pelada_id = p_pelada_id and categoria = 'linha' and status in ('confirmado', 'presente');
    v_status = case when v_count < v_game.limite_jogadores then 'confirmado' else 'espera' end;
  end if;
  insert into public.pelada_participantes(pelada_id, jogador_id, user_id, status, categoria)
  values(p_pelada_id, v_jogador.id, auth.uid(), v_status, v_jogador.posicao)
  on conflict(pelada_id, jogador_id) do update
  set status = v_status, categoria = v_jogador.posicao,
      user_id = auth.uid(), updated_at = now();
  return v_status::text;
end $$;

create or replace function public.sincronizar_fase_lista(p_pelada_id uuid) returns public.lista_fase language plpgsql security definer set search_path='' as $$
declare
  v_game public.peladas;
  v_serie public.pelada_series;
  v_start timestamp;
  v_now timestamp;
begin
  select * into v_game from public.peladas where id = p_pelada_id for update;
  if not found then raise exception 'Pelada não encontrada'; end if;
  if not v_game.lista_automatica or v_game.status in ('cancelada', 'encerrada') then
    return v_game.fase_lista;
  end if;
  select * into v_serie from public.pelada_series where id = v_game.serie_id;
  v_start = v_game.data + v_game.horario;
  v_now = now() at time zone 'America/Sao_Paulo';
  if v_game.fase_lista = 'fechada'
    and v_now >= v_start - make_interval(hours => coalesce(v_serie.antecedencia_geral_horas, 48)) then
    update public.peladas set fase_lista = 'mensalistas', lista_aberta = true, updated_at = now()
    where id = p_pelada_id;
    insert into public.pelada_participantes(pelada_id, jogador_id, user_id, status, categoria)
    select p_pelada_id, id, user_id, 'aguardando_resposta', posicao
    from public.jogadores where tipo = 'mensalista' and ativo
    on conflict(pelada_id, jogador_id) do nothing;
    return 'mensalistas';
  end if;
  return v_game.fase_lista;
end $$;

create or replace function public.definir_fase_lista(p_pelada_id uuid, p_fase public.lista_fase) returns void language plpgsql security definer set search_path='' as $$
begin
  if not public.is_admin() then raise exception 'Acesso negado'; end if;
  update public.peladas
  set fase_lista = p_fase,
      lista_aberta = (p_fase in ('mensalistas', 'geral')),
      lista_automatica = false,
      updated_at = now()
  where id = p_pelada_id;
  if p_fase in ('mensalistas', 'geral') then
    insert into public.pelada_participantes(pelada_id, jogador_id, user_id, status, categoria)
    select p_pelada_id, id, user_id, 'aguardando_resposta', posicao
    from public.jogadores where tipo = 'mensalista' and ativo
    on conflict(pelada_id, jogador_id) do nothing;
  end if;
  if p_fase = 'geral' then perform public.promover_fila(p_pelada_id); end if;
end $$;

create or replace function public.admin_adicionar_jogador(p_pelada_id uuid, p_jogador_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare
  v_game public.peladas;
  v_jogador public.jogadores;
  v_count integer;
  v_status public.participante_status;
begin
  if not public.is_admin() then raise exception 'Acesso negado'; end if;
  select * into v_game from public.peladas where id = p_pelada_id for update;
  select * into v_jogador from public.jogadores where id = p_jogador_id and ativo;
  if not found then raise exception 'Jogador não encontrado'; end if;
  select count(*) into v_count from public.pelada_participantes
  where pelada_id = p_pelada_id and categoria = 'linha' and status in ('confirmado', 'presente');
  v_status = case
    when v_jogador.tipo = 'avulso' and v_game.fase_lista <> 'geral' then 'espera'::public.participante_status
    when v_jogador.posicao = 'goleiro' or v_count < v_game.limite_jogadores then 'confirmado'::public.participante_status
    else 'espera'::public.participante_status
  end;
  insert into public.pelada_participantes(pelada_id, jogador_id, user_id, status, categoria)
  values(p_pelada_id, v_jogador.id, v_jogador.user_id, v_status, v_jogador.posicao)
  on conflict(pelada_id, jogador_id) do update
  set status = v_status, categoria = v_jogador.posicao, updated_at = now();
end $$;

create or replace function public.admin_gerenciar_participante_id(p_participante_id uuid, p_acao text) returns void language plpgsql security definer set search_path='' as $$
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
    where pelada_id = v_item.pelada_id
      and categoria = v_item.categoria
      and status = v_item.status
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
    update public.pelada_participantes set categoria = 'goleiro', status = 'confirmado', updated_at = now() where id = p_participante_id;
  elsif p_acao in ('presente', 'faltou') then
    update public.pelada_participantes set status = p_acao::public.participante_status, updated_at = now() where id = p_participante_id;
  else
    raise exception 'Ação inválida';
  end if;
end $$;

create or replace function public.admin_avaliar_jogador(p_jogador_id uuid, p_nota integer) returns void language plpgsql security definer set search_path='' as $$
begin
  if not public.is_admin() then raise exception 'Acesso negado'; end if;
  if p_nota not between 1 and 5 then raise exception 'A nota deve ser de 1 a 5'; end if;
  update public.jogadores set nota_equilibrio = p_nota, updated_at = now()
  where id = p_jogador_id and ativo;
end $$;

create or replace function public.gerar_sorteio_times(p_pelada_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare
  v_total integer;
  v_times integer;
  v_resto integer;
  v_time integer;
  v_alvos integer[] = array[]::integer[];
  v_tamanhos integer[] = array[]::integer[];
  v_pontos integer[] = array[]::integer[];
  v_jogador record;
  i integer;
begin
  if not public.is_admin() then raise exception 'Acesso negado'; end if;
  select count(*) into v_total from public.pelada_participantes
  where pelada_id = p_pelada_id and categoria = 'linha' and status in ('confirmado', 'presente');
  if v_total = 0 then raise exception 'Não há jogadores de linha confirmados'; end if;
  if v_total > 20 then raise exception 'O sorteio aceita até 20 jogadores de linha'; end if;
  v_times = ceil(v_total / 4.0);
  v_resto = v_total % 4;
  for i in 1..v_times loop
    v_alvos[i] = case when i <= floor(v_total / 4.0) then 4 else v_resto end;
    v_tamanhos[i] = 0;
    v_pontos[i] = 0;
  end loop;
  delete from public.pelada_times where pelada_id = p_pelada_id;
  for v_jogador in
    select pp.jogador_id, j.nota_equilibrio
    from public.pelada_participantes pp
    join public.jogadores j on j.id = pp.jogador_id
    where pp.pelada_id = p_pelada_id and pp.categoria = 'linha'
      and pp.status in ('confirmado', 'presente')
    order by j.nota_equilibrio desc, md5(pp.jogador_id::text || p_pelada_id::text)
  loop
    select gs into v_time from generate_series(1, v_times) gs
    where v_tamanhos[gs] < v_alvos[gs]
    order by v_pontos[gs], v_tamanhos[gs], gs limit 1;
    v_tamanhos[v_time] = v_tamanhos[v_time] + 1;
    v_pontos[v_time] = v_pontos[v_time] + v_jogador.nota_equilibrio;
    insert into public.pelada_times(pelada_id, jogador_id, time, ordem)
    values(p_pelada_id, v_jogador.jogador_id, v_time, v_tamanhos[v_time]);
  end loop;
  update public.peladas set sorteio_liberado = false, updated_at = now() where id = p_pelada_id;
end $$;

create or replace function public.trocar_jogadores_sorteio(p_pelada_id uuid, p_primeiro uuid, p_segundo uuid) returns void language plpgsql security definer set search_path='' as $$
declare
  v_a public.pelada_times;
  v_b public.pelada_times;
begin
  if not public.is_admin() then raise exception 'Acesso negado'; end if;
  select * into v_a from public.pelada_times where pelada_id = p_pelada_id and jogador_id = p_primeiro for update;
  select * into v_b from public.pelada_times where pelada_id = p_pelada_id and jogador_id = p_segundo for update;
  if v_a.jogador_id is null or v_b.jogador_id is null then raise exception 'Escolha dois jogadores do sorteio'; end if;
  set constraints public.pelada_times_slot_unique deferred;
  update public.pelada_times
  set time = case when jogador_id = p_primeiro then v_b.time else v_a.time end,
      ordem = case when jogador_id = p_primeiro then v_b.ordem else v_a.ordem end
  where pelada_id = p_pelada_id and jogador_id in (p_primeiro, p_segundo);
end $$;

create or replace function public.publicar_sorteio_times(p_pelada_id uuid, p_liberado boolean) returns void language plpgsql security definer set search_path='' as $$
begin
  if not public.is_admin() then raise exception 'Acesso negado'; end if;
  if p_liberado and not exists(select 1 from public.pelada_times where pelada_id = p_pelada_id) then
    raise exception 'Gere o sorteio antes de liberar';
  end if;
  update public.peladas set sorteio_liberado = p_liberado, updated_at = now() where id = p_pelada_id;
end $$;

revoke all on function public.admin_avaliar_jogador(uuid, integer), public.gerar_sorteio_times(uuid), public.trocar_jogadores_sorteio(uuid, uuid, uuid), public.publicar_sorteio_times(uuid, boolean) from public;
grant execute on function public.admin_avaliar_jogador(uuid, integer), public.gerar_sorteio_times(uuid), public.trocar_jogadores_sorteio(uuid, uuid, uuid), public.publicar_sorteio_times(uuid, boolean) to authenticated;
