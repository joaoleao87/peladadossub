alter table public.jogadores add column if not exists confirmacao_bloqueada boolean not null default false;

create or replace function public.admin_controlar_jogador(p_jogador_id uuid,p_tipo public.tipo_jogador,p_ativo boolean,p_bloqueado boolean)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not public.is_admin() then raise exception 'Acesso negado'; end if;
  update public.jogadores set tipo=p_tipo,ativo=p_ativo,confirmacao_bloqueada=p_bloqueado,updated_at=now() where id=p_jogador_id;
  if not found then raise exception 'Jogador não encontrado'; end if;
  update public.profiles set tipo_jogador=p_tipo,mensalista_ativo=(p_tipo='mensalista'),ativo=p_ativo,updated_at=now()
  where id=(select user_id from public.jogadores where id=p_jogador_id);
end $$;
revoke all on function public.admin_controlar_jogador(uuid,public.tipo_jogador,boolean,boolean) from public;
grant execute on function public.admin_controlar_jogador(uuid,public.tipo_jogador,boolean,boolean) to authenticated;

-- A trava vale tanto para entrar quanto para responder a um convite.
create or replace function public.validar_confirmacao_liberada(p_jogador_id uuid)
returns void language plpgsql stable security definer set search_path='' as $$
begin
  if exists(select 1 from public.jogadores where id=p_jogador_id and (not ativo or confirmacao_bloqueada)) then
    raise exception 'Sua confirmação está suspensa. Fale com a administração.';
  end if;
end $$;
revoke all on function public.validar_confirmacao_liberada(uuid) from public;

create or replace function public.bloquear_confirmacao_suspensa()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if not public.is_admin() and new.status in('confirmado','presente') and new.user_id=auth.uid()
    and (tg_op='INSERT' or old.status is distinct from new.status) then
    perform public.validar_confirmacao_liberada(new.jogador_id);
  end if;
  return new;
end $$;
revoke all on function public.bloquear_confirmacao_suspensa() from public;
drop trigger if exists participantes_bloquear_confirmacao on public.pelada_participantes;
create trigger participantes_bloquear_confirmacao before insert or update of status on public.pelada_participantes
for each row execute function public.bloquear_confirmacao_suspensa();

create or replace function public.admin_definir_gols(p_participante_id uuid,p_gols integer)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not public.is_admin() then raise exception 'Acesso negado'; end if;
  if p_gols not between 0 and 99 then raise exception 'Quantidade de gols inválida'; end if;
  update public.pelada_participantes set gols=p_gols,updated_at=now()
  where id=p_participante_id and (status in ('confirmado','presente') or comparecimento=true);
  if not found then raise exception 'Somente quem esteve presente pode receber gols'; end if;
end $$;

create or replace function public.admin_substituir_faltante(p_faltante_id uuid,p_suplente_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_faltante public.pelada_participantes; v_suplente public.pelada_participantes; v_time public.pelada_times;
begin
  if not public.is_admin() then raise exception 'Acesso negado'; end if;
  select * into v_faltante from public.pelada_participantes where id=p_faltante_id for update;
  select * into v_suplente from public.pelada_participantes where id=p_suplente_id for update;
  if v_faltante.pelada_id is null or v_suplente.pelada_id is null or v_faltante.pelada_id<>v_suplente.pelada_id then raise exception 'Participantes inválidos'; end if;
  if v_suplente.status<>'espera' or v_suplente.comparecimento is not true then raise exception 'Escolha um suplente presente'; end if;
  select * into v_time from public.pelada_times where pelada_id=v_faltante.pelada_id and jogador_id=v_faltante.jogador_id;
  update public.pelada_participantes set status='faltou',comparecimento=false,updated_at=now() where id=p_faltante_id;
  update public.pelada_participantes set status='presente',comparecimento=true,updated_at=now() where id=p_suplente_id;
  delete from public.pelada_times where pelada_id=v_faltante.pelada_id and jogador_id=v_faltante.jogador_id;
  if v_time.jogador_id is not null then
    insert into public.pelada_times(pelada_id,jogador_id,time,ordem) values(v_time.pelada_id,v_suplente.jogador_id,v_time.time,v_time.ordem)
    on conflict(pelada_id,jogador_id) do update set time=excluded.time,ordem=excluded.ordem;
  end if;
end $$;
revoke all on function public.admin_substituir_faltante(uuid,uuid) from public;
grant execute on function public.admin_substituir_faltante(uuid,uuid) to authenticated;

create table if not exists public.pelada_cards(
  id uuid primary key default gen_random_uuid(), pelada_id uuid not null references public.peladas(id) on delete cascade,
  categoria text not null check(categoria in('destaque','surpresa','negativo')), jogador_id uuid not null references public.jogadores(id),
  titulo text not null, snapshot_nome text not null, snapshot_foto_url text, snapshot_time text, snapshot_gols integer not null default 0,
  imagem_path text, liberado boolean not null default false, gerado_por uuid not null references public.profiles(id),
  gerado_em timestamptz not null default now(), liberado_em timestamptz, updated_at timestamptz not null default now(),
  unique(pelada_id,categoria)
);
alter table public.pelada_cards enable row level security;
create policy pelada_cards_ler on public.pelada_cards for select to authenticated using(liberado or public.is_superadmin());
grant select on public.pelada_cards to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('pelada-cards','pelada-cards',true,5242880,array['image/jpeg','image/png','image/webp']) on conflict(id) do update set file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy pelada_cards_storage_ler on storage.objects for select to authenticated using(bucket_id='pelada-cards');
create policy pelada_cards_storage_admin on storage.objects for all to authenticated using(bucket_id='pelada-cards' and public.is_superadmin()) with check(bucket_id='pelada-cards' and public.is_superadmin());

create or replace function public.superadmin_gerar_card(p_pelada_id uuid,p_categoria text,p_jogador_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_nome text; v_foto text; v_time integer; v_gols integer; v_titulo text;
begin
  if not public.is_superadmin() then raise exception 'Acesso negado'; end if;
  if p_categoria not in('destaque','surpresa','negativo') then raise exception 'Categoria inválida'; end if;
  select coalesce(pr.apelido,pr.nome,j.apelido,j.nome),pr.foto_url,pt.time,pp.gols
  into v_nome,v_foto,v_time,v_gols from public.pelada_participantes pp join public.jogadores j on j.id=pp.jogador_id
  left join public.profiles pr on pr.id=j.user_id left join public.pelada_times pt on pt.pelada_id=pp.pelada_id and pt.jogador_id=pp.jogador_id
  where pp.pelada_id=p_pelada_id and pp.jogador_id=p_jogador_id and (pp.status in('confirmado','presente') or pp.comparecimento=true);
  if not found then raise exception 'O vencedor não participou desta pelada'; end if;
  v_titulo=case p_categoria when 'destaque' then 'Destaque' when 'surpresa' then 'Surpresa' else 'Quem quebrou mais' end;
  insert into public.pelada_cards(pelada_id,categoria,jogador_id,titulo,snapshot_nome,snapshot_foto_url,snapshot_time,snapshot_gols,gerado_por)
  values(p_pelada_id,p_categoria,p_jogador_id,v_titulo,v_nome,v_foto,case when v_time is null then 'Time não informado' else 'Time '||v_time end,coalesce(v_gols,0),auth.uid())
  on conflict(pelada_id,categoria) do update set jogador_id=excluded.jogador_id,titulo=excluded.titulo,snapshot_nome=excluded.snapshot_nome,snapshot_foto_url=excluded.snapshot_foto_url,snapshot_time=excluded.snapshot_time,snapshot_gols=excluded.snapshot_gols,imagem_path=null,liberado=false,liberado_em=null,gerado_por=auth.uid(),gerado_em=now(),updated_at=now();
end $$;
create or replace function public.superadmin_atualizar_card(p_card_id uuid,p_liberado boolean,p_imagem_path text default null)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not public.is_superadmin() then raise exception 'Acesso negado'; end if;
  update public.pelada_cards set liberado=p_liberado,liberado_em=case when p_liberado then now() else null end,imagem_path=p_imagem_path,updated_at=now() where id=p_card_id;
  if not found then raise exception 'Card não encontrado'; end if;
end $$;
revoke all on function public.superadmin_gerar_card(uuid,text,uuid),public.superadmin_atualizar_card(uuid,boolean,text) from public;
grant execute on function public.superadmin_gerar_card(uuid,text,uuid),public.superadmin_atualizar_card(uuid,boolean,text) to authenticated;
