create table if not exists public.notificacoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  titulo text not null check(char_length(trim(titulo)) between 2 and 80),
  mensagem text not null check(char_length(trim(mensagem)) between 2 and 300),
  link text not null default '/',
  tipo text not null default 'geral',
  criada_por uuid references public.profiles(id) on delete set null,
  entregue_em timestamptz,
  lida_em timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notificacoes_pendentes on public.notificacoes(user_id,created_at) where entregue_em is null;
alter table public.notificacoes enable row level security;
create policy notificacoes_proprias_ler on public.notificacoes for select to authenticated using(user_id=auth.uid());
create policy notificacoes_proprias_atualizar on public.notificacoes for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
grant select,update on public.notificacoes to authenticated;

create or replace function public.admin_enviar_notificacao_massa(p_titulo text,p_mensagem text,p_link text default '/')
returns integer language plpgsql security definer set search_path='' as $$
declare v_total integer;
begin
  if not public.is_admin() then raise exception 'Acesso negado'; end if;
  if char_length(trim(p_titulo))<2 or char_length(trim(p_mensagem))<2 then raise exception 'Informe título e mensagem'; end if;
  insert into public.notificacoes(user_id,titulo,mensagem,link,tipo,criada_por)
  select id,trim(p_titulo),trim(p_mensagem),coalesce(nullif(p_link,''),'/'),'massa',auth.uid() from public.profiles where ativo;
  get diagnostics v_total=row_count; return v_total;
end $$;

create or replace function public.admin_notificar_pagamento(p_pagamento_id uuid)
returns integer language plpgsql security definer set search_path='' as $$
declare v_pagamento public.pagamentos;v_user uuid;
begin
  if not public.is_admin() then raise exception 'Acesso negado'; end if;
  select * into v_pagamento from public.pagamentos where id=p_pagamento_id and status in('pendente','atrasado');
  if not found then raise exception 'Cobrança pendente não encontrada'; end if;
  v_user=coalesce(v_pagamento.user_id,(select user_id from public.jogadores where id=v_pagamento.jogador_id));
  if v_user is null then raise exception 'O jogador não possui conta vinculada'; end if;
  insert into public.notificacoes(user_id,titulo,mensagem,link,tipo,criada_por)
  values(v_user,'Pagamento pendente','Você possui uma cobrança de R$ '||replace(to_char(v_pagamento.valor,'FM999999990D00'),'.',',')||' pendente. Consulte o Perfil para regularizar.','/perfil','pagamento',auth.uid());
  return 1;
end $$;

create or replace function public.admin_notificar_inadimplentes()
returns integer language plpgsql security definer set search_path='' as $$
declare v_total integer;
begin
  if not public.is_admin() then raise exception 'Acesso negado'; end if;
  insert into public.notificacoes(user_id,titulo,mensagem,link,tipo,criada_por)
  select distinct coalesce(p.user_id,j.user_id),'Pagamento pendente','Você possui pagamento pendente. Consulte o Perfil para regularizar.','/perfil','pagamento',auth.uid()
  from public.pagamentos p left join public.jogadores j on j.id=p.jogador_id
  where p.status in('pendente','atrasado') and coalesce(p.user_id,j.user_id) is not null;
  get diagnostics v_total=row_count; return v_total;
end $$;

create or replace function public.notificar_admin_novo_cadastro()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into public.notificacoes(user_id,titulo,mensagem,link,tipo)
  select id,'Novo cadastro',new.nome||' criou uma conta e pode precisar de vínculo.',case when role='superadmin' then '/superadmin' else '/admin' end,'cadastro'
  from public.profiles where role in('admin','superadmin') and ativo and id<>new.id;
  return new;
end $$;
drop trigger if exists profiles_notificar_novo_cadastro on public.profiles;
create trigger profiles_notificar_novo_cadastro after insert on public.profiles for each row execute function public.notificar_admin_novo_cadastro();

revoke all on function public.admin_enviar_notificacao_massa(text,text,text),public.admin_notificar_pagamento(uuid),public.admin_notificar_inadimplentes() from public;
grant execute on function public.admin_enviar_notificacao_massa(text,text,text),public.admin_notificar_pagamento(uuid),public.admin_notificar_inadimplentes() to authenticated;
