create table if not exists public.titulos_eleitorais(
  id uuid primary key default gen_random_uuid(),
  nome_completo text not null check(char_length(nome_completo) between 5 and 100),
  titulo_eleitor char(12) not null unique check(titulo_eleitor ~ '^[0-9]{12}$'),
  created_at timestamptz not null default now()
);

alter table public.titulos_eleitorais enable row level security;
create policy titulos_eleitorais_admin_read on public.titulos_eleitorais for select to authenticated using(public.is_admin());

create or replace function public.enviar_titulo_eleitor(p_nome_completo text,p_titulo_eleitor text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_nome text:=trim(regexp_replace(coalesce(p_nome_completo,''),'\s+',' ','g'));v_titulo text:=regexp_replace(coalesce(p_titulo_eleitor,''),'\D','','g');v_dv1 integer;v_dv2 integer;v_id uuid;
begin
  if char_length(v_nome) not between 5 and 100 or array_length(regexp_split_to_array(v_nome,'\s+'),1)<2 then raise exception 'Informe o nome completo'; end if;
  if v_titulo !~ '^[0-9]{12}$' or v_titulo ~ '^(.)\1{11}$' then raise exception 'Informe um título de eleitor válido'; end if;
  select sum(substring(v_titulo from indice for 1)::integer*(indice+1))%11 into v_dv1 from generate_series(1,8) indice;
  v_dv1:=case when v_dv1=10 then 0 else v_dv1 end;
  v_dv2:=(substring(v_titulo from 9 for 1)::integer*7+substring(v_titulo from 10 for 1)::integer*8+v_dv1*9)%11;
  v_dv2:=case when v_dv2=10 then 0 when v_dv2=0 and substring(v_titulo from 9 for 2) in('01','02') then 1 else v_dv2 end;
  if substring(v_titulo from 11 for 1)::integer<>v_dv1 or substring(v_titulo from 12 for 1)::integer<>v_dv2 then raise exception 'Informe um título de eleitor válido'; end if;
  insert into public.titulos_eleitorais(nome_completo,titulo_eleitor) values(v_nome,v_titulo) returning id into v_id;
  return v_id;
exception when unique_violation then raise exception 'Este título de eleitor já foi enviado';
end $$;

revoke all on public.titulos_eleitorais from anon,authenticated;
revoke all on function public.enviar_titulo_eleitor(text,text) from public;
grant execute on function public.enviar_titulo_eleitor(text,text) to anon,authenticated;
