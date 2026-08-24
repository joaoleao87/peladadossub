drop function if exists public.ranking_desempenho();
create function public.ranking_desempenho() returns table(
  jogador_id uuid, user_id uuid, nome text, apelido text, jogos bigint, gols bigint, assistencias bigint,
  media_nota numeric, total_avaliacoes bigint, votos_destaque bigint, votos_surpresa bigint, votos_negativo bigint
) language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'Não autenticado'; end if;
  return query
  with participacoes as (
    select pp.jogador_id, count(distinct pp.pelada_id)::bigint jogos,
      coalesce(sum(pp.gols),0)::bigint gols, coalesce(sum(pp.assistencias),0)::bigint assistencias
    from public.pelada_participantes pp join public.peladas p on p.id=pp.pelada_id
    where (pp.status in('confirmado','presente') or pp.comparecimento=true) and p.status<>'cancelada'
      and p.data+p.horario<=now() at time zone 'America/Sao_Paulo' group by pp.jogador_id
  ), avaliacoes as (
    select a.avaliado_jogador_id jogador_id,round(avg(a.nota)::numeric,1) media_nota,count(*)::bigint total_avaliacoes
    from public.pelada_avaliacoes a group by a.avaliado_jogador_id
  ), votos as (
    select v.avaliado_jogador_id jogador_id,
      count(*) filter(where v.categoria='destaque')::bigint votos_destaque,
      count(*) filter(where v.categoria='surpresa')::bigint votos_surpresa,
      count(*) filter(where v.categoria='negativo')::bigint votos_negativo
    from public.pelada_votos v group by v.avaliado_jogador_id
  )
  select j.id,j.user_id,j.nome,j.apelido,coalesce(p.jogos,0),coalesce(p.gols,0),coalesce(p.assistencias,0),
    a.media_nota,coalesce(a.total_avaliacoes,0),coalesce(v.votos_destaque,0),coalesce(v.votos_surpresa,0),coalesce(v.votos_negativo,0)
  from public.jogadores j left join participacoes p on p.jogador_id=j.id
  left join avaliacoes a on a.jogador_id=j.id left join votos v on v.jogador_id=j.id
  where coalesce(p.jogos,0)>0 or coalesce(a.total_avaliacoes,0)>0 or coalesce(v.votos_destaque,0)>0
    or coalesce(v.votos_surpresa,0)>0 or coalesce(v.votos_negativo,0)>0;
end $$;
grant execute on function public.ranking_desempenho() to authenticated;

alter table public.pelada_cards add column if not exists snapshot_membros jsonb not null default '[]'::jsonb;
alter table public.pelada_cards drop constraint if exists pelada_cards_categoria_check;
alter table public.pelada_cards add constraint pelada_cards_categoria_check
  check(categoria in('destaque','surpresa','negativo','artilheiro','time_destaque'));

create or replace function public.superadmin_gerar_card(p_pelada_id uuid,p_categoria text,p_jogador_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_nome text;v_foto text;v_time integer;v_companheiros text;v_gols integer;v_titulo text;v_vitorias integer;v_membros jsonb='[]'::jsonb;
begin
  if not public.is_superadmin() then raise exception 'Acesso negado'; end if;
  if p_categoria not in('destaque','surpresa','negativo','artilheiro','time_destaque') then raise exception 'Categoria inválida'; end if;
  select coalesce(nullif(pr.apelido,''),pr.nome,nullif(j.apelido,''),j.nome),pr.foto_url,pt.time,pp.gols,pt.vitorias
  into v_nome,v_foto,v_time,v_gols,v_vitorias from public.pelada_participantes pp
  join public.jogadores j on j.id=pp.jogador_id left join public.profiles pr on pr.id=j.user_id
  left join public.pelada_times pt on pt.pelada_id=pp.pelada_id and pt.jogador_id=pp.jogador_id
  where pp.pelada_id=p_pelada_id and pp.jogador_id=p_jogador_id and (pp.status in('confirmado','presente') or pp.comparecimento=true);
  if not found then raise exception 'O vencedor não participou desta pelada'; end if;
  if p_categoria='artilheiro' and v_gols<>(select coalesce(max(gols),0) from public.pelada_participantes where pelada_id=p_pelada_id) then
    raise exception 'Escolha um dos artilheiros desta pelada';
  end if;
  if p_categoria='time_destaque' then
    if v_time is null or coalesce(v_vitorias,0)=0 or v_vitorias<>(select coalesce(max(vitorias),0) from public.pelada_times where pelada_id=p_pelada_id) then
      raise exception 'Escolha um dos times com mais vitórias nesta pelada';
    end if;
    select jsonb_agg(jsonb_build_object('nome',coalesce(nullif(pr.apelido,''),pr.nome,nullif(j.apelido,''),j.nome),'foto_url',pr.foto_url) order by pt.ordem),
      string_agg(coalesce(nullif(pr.apelido,''),pr.nome,nullif(j.apelido,''),j.nome),' • ' order by pt.ordem)
    into v_membros,v_nome from public.pelada_times pt join public.jogadores j on j.id=pt.jogador_id
    left join public.profiles pr on pr.id=j.user_id where pt.pelada_id=p_pelada_id and pt.time=v_time;
    v_titulo='Time Destaque';v_foto=null;v_companheiros=v_vitorias||case when v_vitorias=1 then ' vitória' else ' vitórias' end;v_gols=0;
  else
    if v_time is not null then select string_agg(coalesce(nullif(pr.apelido,''),pr.nome,nullif(j.apelido,''),j.nome),' • ' order by pt.ordem)
      into v_companheiros from public.pelada_times pt join public.jogadores j on j.id=pt.jogador_id left join public.profiles pr on pr.id=j.user_id
      where pt.pelada_id=p_pelada_id and pt.time=v_time and pt.jogador_id<>p_jogador_id; end if;
    v_companheiros=coalesce('Com: '||v_companheiros,'Companheiros não informados');
    v_titulo=case p_categoria when 'destaque' then 'Destaque' when 'surpresa' then 'Surpresa' when 'artilheiro' then 'Artilheiro' else 'Quem quebrou mais' end;
  end if;
  insert into public.pelada_cards(pelada_id,categoria,jogador_id,titulo,snapshot_nome,snapshot_foto_url,snapshot_time,snapshot_gols,snapshot_membros,gerado_por)
  values(p_pelada_id,p_categoria,p_jogador_id,v_titulo,v_nome,v_foto,v_companheiros,coalesce(v_gols,0),v_membros,auth.uid())
  on conflict(pelada_id,categoria) do update set jogador_id=excluded.jogador_id,titulo=excluded.titulo,snapshot_nome=excluded.snapshot_nome,
    snapshot_foto_url=excluded.snapshot_foto_url,snapshot_time=excluded.snapshot_time,snapshot_gols=excluded.snapshot_gols,
    snapshot_membros=excluded.snapshot_membros,imagem_path=null,liberado=false,liberado_em=null,gerado_por=auth.uid(),gerado_em=now(),updated_at=now();
end $$;
revoke all on function public.superadmin_gerar_card(uuid,text,uuid) from public;
grant execute on function public.superadmin_gerar_card(uuid,text,uuid) to authenticated;
