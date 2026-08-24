alter table public.pelada_times
  add column if not exists vitorias smallint not null default 0
  check(vitorias between 0 and 99);

update public.pelada_times set vitorias=1 where vencedor and vitorias=0;

create or replace function public.herdar_vitorias_time()
returns trigger language plpgsql set search_path='' as $$
declare v_vitorias integer;
begin
  select max(vitorias) into v_vitorias from public.pelada_times
  where pelada_id=new.pelada_id and time=new.time;
  if v_vitorias is not null then
    new.vitorias=v_vitorias;
    new.vencedor=(v_vitorias>0);
  end if;
  return new;
end $$;
drop trigger if exists pelada_times_herdar_vitorias on public.pelada_times;
create trigger pelada_times_herdar_vitorias before insert on public.pelada_times
for each row execute function public.herdar_vitorias_time();

create or replace function public.admin_definir_vitorias_time(
  p_pelada_id uuid,
  p_time integer,
  p_vitorias integer
) returns void language plpgsql security definer set search_path='' as $$
begin
  if not public.is_admin() then raise exception 'Acesso negado'; end if;
  if p_vitorias not between 0 and 99 then raise exception 'Quantidade de vitórias inválida'; end if;
  update public.pelada_times set vitorias=p_vitorias,vencedor=(p_vitorias>0)
  where pelada_id=p_pelada_id and time=p_time;
  if not found then raise exception 'Time não encontrado'; end if;
end $$;
revoke all on function public.admin_definir_vitorias_time(uuid,integer,integer) from public;
grant execute on function public.admin_definir_vitorias_time(uuid,integer,integer) to authenticated;
