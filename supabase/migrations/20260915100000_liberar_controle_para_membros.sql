-- Todo membro com conta ativa pode controlar qualquer pelada não cancelada.
create or replace function public.pode_controlar_pelada(p_pelada_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(
    select 1 from public.profiles
    where id=auth.uid() and ativo
  )
$$;

create or replace function public.peladas_controlaveis()
returns setof public.peladas language sql stable security definer set search_path='' as $$
  select p.* from public.peladas p
  where p.status<>'cancelada' and public.pode_controlar_pelada(p.id)
  order by p.data desc,p.horario desc
  limit 30
$$;
