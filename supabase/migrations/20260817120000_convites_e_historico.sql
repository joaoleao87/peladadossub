create table if not exists public.convites_mensalista (
  token uuid primary key default gen_random_uuid(), criado_por uuid not null references public.profiles(id),
  expira_em timestamptz not null default (now()+interval '7 days'), usado_por uuid references public.profiles(id),
  usado_em timestamptz, created_at timestamptz not null default now()
);
alter table public.convites_mensalista enable row level security;
create policy convites_admin on public.convites_mensalista for select to authenticated using(public.is_admin());
grant select on public.convites_mensalista to authenticated;

create or replace function public.criar_convite_mensalista() returns uuid language plpgsql security definer set search_path='' as $$
declare v_token uuid; begin
  if not public.is_admin() then raise exception 'Acesso negado'; end if;
  insert into public.convites_mensalista(criado_por) values(auth.uid()) returning token into v_token; return v_token;
end $$;
revoke all on function public.criar_convite_mensalista() from public;
grant execute on function public.criar_convite_mensalista() to authenticated;

create or replace function public.novo_usuario() returns trigger language plpgsql security definer set search_path='' as $$
declare v_nome text; v_token uuid; v_mensalista boolean=false; begin
  v_nome=coalesce(nullif(trim(new.raw_user_meta_data->>'nome'),''),split_part(new.email,'@',1));
  if nullif(new.raw_user_meta_data->>'convite_mensalista','') is not null then
    begin v_token=(new.raw_user_meta_data->>'convite_mensalista')::uuid; exception when invalid_text_representation then raise exception 'Convite inválido'; end;
    update public.convites_mensalista set usado_por=new.id,usado_em=now() where token=v_token and usado_em is null and expira_em>now();
    if not found then raise exception 'Convite inválido, expirado ou já utilizado'; end if; v_mensalista=true;
  end if;
  insert into public.profiles(id,nome,tipo_jogador,mensalista_ativo) values(new.id,v_nome,case when v_mensalista then 'mensalista' else 'avulso' end,v_mensalista);
  insert into public.jogadores(nome,user_id,tipo) values(v_nome,new.id,case when v_mensalista then 'mensalista' else 'avulso' end); return new;
end $$;
