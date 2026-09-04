alter table public.peladas
  add column if not exists sorteio_times_liberados smallint not null default 0
  check (sorteio_times_liberados in (0, 2, 5));

update public.peladas
set sorteio_times_liberados = 5
where sorteio_liberado;

drop policy if exists pelada_times_read on public.pelada_times;
create policy pelada_times_read on public.pelada_times for select to authenticated
  using (public.is_admin() or exists(
    select 1 from public.peladas p
    where p.id = pelada_id
      and p.sorteio_liberado
      and time <= p.sorteio_times_liberados
  ));

drop function if exists public.publicar_sorteio_times(uuid, boolean);
create function public.publicar_sorteio_times(
  p_pelada_id uuid,
  p_times integer
) returns void language plpgsql security definer set search_path='' as $$
declare
  v_total integer;
  v_times integer;
  v_time integer;
  v_quantidade integer;
  v_esperado integer;
  v_limite integer;
begin
  if not public.is_admin() then raise exception 'Acesso negado'; end if;
  if p_times is null or p_times not in (0, 2, 5) then raise exception 'Libere 2 times, todos os times ou oculte o sorteio'; end if;

  if p_times > 0 then
    select count(*) into v_total from public.pelada_participantes
    where pelada_id = p_pelada_id and categoria = 'linha'
      and status in ('confirmado', 'presente');
    if v_total = 0 then raise exception 'Não há jogadores confirmados'; end if;

    v_times = ceil(v_total / 4.0);
    if p_times = 2 and v_times < 2 then raise exception 'O sorteio precisa ter pelo menos dois times'; end if;
    v_limite = case when p_times = 5 then v_times else 2 end;
    for v_time in 1..v_limite loop
      v_esperado = case
        when v_time < v_times or v_total % 4 = 0 then 4
        else v_total % 4
      end;
      select count(*) into v_quantidade from public.pelada_times
      where pelada_id = p_pelada_id and time = v_time;
      if v_quantidade <> v_esperado then
        raise exception 'Complete a distribuição dos times antes de liberar';
      end if;
    end loop;
  end if;

  update public.peladas
  set sorteio_liberado = (p_times > 0),
      sorteio_times_liberados = p_times,
      updated_at = now()
  where id = p_pelada_id;
end $$;

revoke all on function public.publicar_sorteio_times(uuid, integer) from public;
grant execute on function public.publicar_sorteio_times(uuid, integer) to authenticated;
