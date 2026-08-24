create or replace function public.incluir_admins_na_pelada(p_pelada_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  insert into public.jogadores(nome,apelido,telefone,user_id,tipo,posicao,ativo)
  select p.nome,p.apelido,p.telefone,p.id,p.tipo_jogador,p.posicao_lista,true
  from public.profiles p
  where p.role in('admin','superadmin') and p.ativo
    and not exists(select 1 from public.jogadores j where j.user_id=p.id)
  on conflict(user_id) do nothing;

  insert into public.pelada_participantes(
    pelada_id,user_id,jogador_id,status,categoria,comparecimento
  )
  select p_pelada_id,p.id,j.id,'confirmado',j.posicao,true
  from public.profiles p
  join public.jogadores j on j.user_id=p.id
  where p.role in('admin','superadmin') and p.ativo and j.ativo
  on conflict(pelada_id,jogador_id) do update
  set user_id=excluded.user_id,status='confirmado',comparecimento=true,
      categoria=excluded.categoria,updated_at=now();
end $$;
revoke all on function public.incluir_admins_na_pelada(uuid) from public;

create or replace function public.incluir_admins_ao_salvar_pelada()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  perform public.incluir_admins_na_pelada(new.id);
  return new;
end $$;
revoke all on function public.incluir_admins_ao_salvar_pelada() from public;

drop trigger if exists peladas_incluir_admins on public.peladas;
create trigger peladas_incluir_admins
after insert or update of data,horario,local on public.peladas
for each row execute function public.incluir_admins_ao_salvar_pelada();

-- Recall: aplica a regra imediatamente à pelada mais recente já cadastrada.
do $$
declare v_pelada_id uuid;
begin
  select id into v_pelada_id
  from public.peladas
  where status<>'cancelada'
  order by data desc,horario desc
  limit 1;
  if v_pelada_id is not null then
    perform public.incluir_admins_na_pelada(v_pelada_id);
  end if;
end $$;
