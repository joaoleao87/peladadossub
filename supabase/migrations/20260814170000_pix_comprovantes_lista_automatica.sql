alter table public.pelada_series add column if not exists chave_pix text not null default 'Peladadossub@gmail.com';
alter table public.peladas add column if not exists lista_automatica boolean not null default true;
alter table public.pagamentos add column if not exists comprovante_path text;
alter table public.pagamentos add column if not exists comprovante_enviado_em timestamptz;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('comprovantes','comprovantes',false,5242880,array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists comprovantes_user_insert on storage.objects;
drop policy if exists comprovantes_user_read on storage.objects;
drop policy if exists comprovantes_admin_read on storage.objects;
create policy comprovantes_user_insert on storage.objects for insert to authenticated with check(bucket_id='comprovantes' and (storage.foldername(name))[1]=auth.uid()::text);
create policy comprovantes_user_read on storage.objects for select to authenticated using(bucket_id='comprovantes' and (storage.foldername(name))[1]=auth.uid()::text);
create policy comprovantes_admin_read on storage.objects for select to authenticated using(bucket_id='comprovantes' and public.is_admin());

create or replace function public.sincronizar_fase_lista(p_pelada_id uuid) returns public.lista_fase language plpgsql security definer set search_path='' as $$
declare v_game public.peladas; v_start timestamp; v_now timestamp; v_fase public.lista_fase;
begin
  select * into v_game from public.peladas where id=p_pelada_id for update;
  if not found then raise exception 'Pelada não encontrada'; end if;
  if not v_game.lista_automatica or v_game.status in ('cancelada','encerrada') then return v_game.fase_lista; end if;
  v_start=v_game.data+v_game.horario; v_now=now() at time zone 'America/Sao_Paulo';
  v_fase=case when v_now>=v_start-interval '12 hours' then 'geral'::public.lista_fase when v_now>=v_start-interval '24 hours' then 'mensalistas'::public.lista_fase else 'fechada'::public.lista_fase end;
  if v_fase<>v_game.fase_lista then update public.peladas set fase_lista=v_fase,lista_aberta=(v_fase in ('mensalistas','geral')),updated_at=now() where id=p_pelada_id; end if;
  if v_fase in ('mensalistas','geral') then
    insert into public.pelada_participantes(pelada_id,user_id,status,categoria)
    select p_pelada_id,id,'aguardando_resposta',posicao_lista from public.profiles where mensalista_ativo and ativo
    on conflict(pelada_id,user_id) do nothing;
  end if;
  return v_fase;
end $$;

create or replace function public.definir_fase_lista(p_pelada_id uuid,p_fase public.lista_fase) returns void language plpgsql security definer set search_path='' as $$
begin
  if not public.is_admin() then raise exception 'Acesso negado'; end if;
  update public.peladas set fase_lista=p_fase,lista_aberta=(p_fase in ('mensalistas','geral')),lista_automatica=false,updated_at=now() where id=p_pelada_id;
  if p_fase in ('mensalistas','geral') then insert into public.pelada_participantes(pelada_id,user_id,status,categoria) select p_pelada_id,id,'aguardando_resposta',posicao_lista from public.profiles where mensalista_ativo and ativo on conflict(pelada_id,user_id) do nothing; end if;
end $$;
create or replace function public.reativar_lista_automatica(p_pelada_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin if not public.is_admin() then raise exception 'Acesso negado'; end if; update public.peladas set lista_automatica=true where id=p_pelada_id; perform public.sincronizar_fase_lista(p_pelada_id); end $$;

create or replace function public.enviar_comprovante(p_pagamento_id uuid,p_path text) returns void language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or split_part(p_path,'/',1)<>auth.uid()::text then raise exception 'Acesso negado'; end if;
  update public.pagamentos set comprovante_path=p_path,comprovante_enviado_em=now(),updated_at=now() where id=p_pagamento_id and user_id=auth.uid() and status in ('pendente','atrasado');
  if not found then raise exception 'Cobrança indisponível'; end if;
end $$;
revoke all on function public.sincronizar_fase_lista(uuid),public.reativar_lista_automatica(uuid),public.enviar_comprovante(uuid,text) from public;
grant execute on function public.sincronizar_fase_lista(uuid),public.enviar_comprovante(uuid,text) to authenticated;
grant execute on function public.reativar_lista_automatica(uuid) to authenticated;
