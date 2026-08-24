alter table public.pelada_cards drop constraint if exists pelada_cards_categoria_check;
alter table public.pelada_cards add constraint pelada_cards_categoria_check
  check(categoria in('destaque','surpresa','negativo','artilheiro'));

create or replace function public.superadmin_gerar_card(
  p_pelada_id uuid,
  p_categoria text,
  p_jogador_id uuid
) returns void language plpgsql security definer set search_path='' as $$
declare v_nome text; v_foto text; v_time integer; v_companheiros text; v_gols integer; v_titulo text;
begin
  if not public.is_superadmin() then raise exception 'Acesso negado'; end if;
  if p_categoria not in('destaque','surpresa','negativo','artilheiro') then raise exception 'Categoria inválida'; end if;
  select coalesce(nullif(pr.apelido,''),pr.nome,nullif(j.apelido,''),j.nome),pr.foto_url,pt.time,pp.gols
  into v_nome,v_foto,v_time,v_gols
  from public.pelada_participantes pp
  join public.jogadores j on j.id=pp.jogador_id
  left join public.profiles pr on pr.id=j.user_id
  left join public.pelada_times pt on pt.pelada_id=pp.pelada_id and pt.jogador_id=pp.jogador_id
  where pp.pelada_id=p_pelada_id and pp.jogador_id=p_jogador_id
    and (pp.status in('confirmado','presente') or pp.comparecimento=true);
  if not found then raise exception 'O vencedor não participou desta pelada'; end if;
  if p_categoria='artilheiro' and v_gols<>(select coalesce(max(gols),0) from public.pelada_participantes where pelada_id=p_pelada_id) then
    raise exception 'Escolha um dos artilheiros desta pelada';
  end if;
  if v_time is not null then
    select string_agg(coalesce(nullif(pr.apelido,''),pr.nome,nullif(j.apelido,''),j.nome),' • ' order by pt.ordem)
    into v_companheiros from public.pelada_times pt
    join public.jogadores j on j.id=pt.jogador_id left join public.profiles pr on pr.id=j.user_id
    where pt.pelada_id=p_pelada_id and pt.time=v_time and pt.jogador_id<>p_jogador_id;
  end if;
  v_titulo=case p_categoria when 'destaque' then 'Destaque' when 'surpresa' then 'Surpresa' when 'artilheiro' then 'Artilheiro' else 'Quem quebrou mais' end;
  insert into public.pelada_cards(pelada_id,categoria,jogador_id,titulo,snapshot_nome,snapshot_foto_url,snapshot_time,snapshot_gols,gerado_por)
  values(p_pelada_id,p_categoria,p_jogador_id,v_titulo,v_nome,v_foto,coalesce('Com: '||v_companheiros,'Companheiros não informados'),coalesce(v_gols,0),auth.uid())
  on conflict(pelada_id,categoria) do update set jogador_id=excluded.jogador_id,titulo=excluded.titulo,
    snapshot_nome=excluded.snapshot_nome,snapshot_foto_url=excluded.snapshot_foto_url,snapshot_time=excluded.snapshot_time,
    snapshot_gols=excluded.snapshot_gols,imagem_path=null,liberado=false,liberado_em=null,gerado_por=auth.uid(),gerado_em=now(),updated_at=now();
end $$;
revoke all on function public.superadmin_gerar_card(uuid,text,uuid) from public;
grant execute on function public.superadmin_gerar_card(uuid,text,uuid) to authenticated;
