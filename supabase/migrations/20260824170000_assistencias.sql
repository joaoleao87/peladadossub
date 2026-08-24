alter table public.pelada_participantes
  add column if not exists assistencias smallint not null default 0
  check(assistencias between 0 and 99);

create or replace function public.admin_definir_assistencias(
  p_participante_id uuid,
  p_assistencias integer
) returns void language plpgsql security definer set search_path='' as $$
begin
  if not public.is_admin() then raise exception 'Acesso negado'; end if;
  if p_assistencias not between 0 and 99 then raise exception 'Quantidade de assistências inválida'; end if;
  update public.pelada_participantes
  set assistencias=p_assistencias,updated_at=now()
  where id=p_participante_id
    and (status in('confirmado','presente') or comparecimento=true);
  if not found then raise exception 'Marque o jogador como presente antes de registrar assistências'; end if;
end $$;
revoke all on function public.admin_definir_assistencias(uuid,integer) from public;
grant execute on function public.admin_definir_assistencias(uuid,integer) to authenticated;
