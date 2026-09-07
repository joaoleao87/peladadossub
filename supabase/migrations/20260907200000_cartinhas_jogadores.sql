create table if not exists public.player_cards (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null unique references public.jogadores(id) on delete cascade,
  display_name text,
  position text check (position in ('GOL', 'FIXO', 'ALA', 'PIVO')),
  overall smallint check (overall between 1 and 99),
  pace smallint check (pace between 1 and 99),
  shooting smallint check (shooting between 1 and 99),
  passing smallint check (passing between 1 and 99),
  dribbling smallint check (dribbling between 1 and 99),
  defending smallint check (defending between 1 and 99),
  physical smallint check (physical between 1 and 99),
  card_type text not null default 'normal' check (card_type in ('normal', 'legendary')),
  photo_url text,
  photo_scale numeric(4,2) not null default 1 check (photo_scale between 0.5 and 3),
  photo_position_x numeric(6,2) not null default 0 check (photo_position_x between -100 and 100),
  photo_position_y numeric(6,2) not null default 0 check (photo_position_y between -100 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.player_cards enable row level security;
drop policy if exists player_cards_read on public.player_cards;
create policy player_cards_read on public.player_cards
for select to authenticated using (
  public.is_admin() or exists (
    select 1 from public.jogadores j
     where j.id = player_id and j.user_id = auth.uid()
  )
);
drop policy if exists player_cards_own_photo_update on public.player_cards;
create policy player_cards_own_photo_update on public.player_cards
for update to authenticated
using (exists (
  select 1 from public.jogadores j
   where j.id = player_id and j.user_id = auth.uid()
))
with check (exists (
  select 1 from public.jogadores j
   where j.id = player_id and j.user_id = auth.uid()
));

revoke all on table public.player_cards from anon, authenticated;
grant select on table public.player_cards to authenticated;
grant update(photo_url, photo_scale, photo_position_x, photo_position_y, updated_at)
  on table public.player_cards to authenticated;

create or replace function public.salvar_foto_cartinha(
  p_photo_url text,
  p_photo_scale numeric,
  p_photo_position_x numeric,
  p_photo_position_y numeric
) returns public.player_cards language plpgsql security definer set search_path='' as $$
declare
  v_player_id uuid;
  v_card public.player_cards;
begin
  select id into v_player_id from public.jogadores
   where user_id = auth.uid() and ativo;
  if not found then raise exception 'Jogador não encontrado'; end if;
  if p_photo_scale not between 0.5 and 3
     or p_photo_position_x not between -100 and 100
     or p_photo_position_y not between -100 and 100 then
    raise exception 'Enquadramento inválido';
  end if;

  insert into public.player_cards(
    player_id, photo_url, photo_scale, photo_position_x, photo_position_y
  ) values(
    v_player_id, nullif(trim(p_photo_url), ''), p_photo_scale,
    p_photo_position_x, p_photo_position_y
  )
  on conflict(player_id) do update set
    photo_url = excluded.photo_url,
    photo_scale = excluded.photo_scale,
    photo_position_x = excluded.photo_position_x,
    photo_position_y = excluded.photo_position_y,
    updated_at = now()
  returning * into v_card;
  return v_card;
end $$;

create or replace function public.admin_salvar_cartinha(
  p_player_id uuid,
  p_display_name text,
  p_position text,
  p_overall integer,
  p_pace integer,
  p_shooting integer,
  p_passing integer,
  p_dribbling integer,
  p_defending integer,
  p_physical integer,
  p_card_type text
) returns public.player_cards language plpgsql security definer set search_path='' as $$
declare
  v_card public.player_cards;
  v_value integer;
begin
  if not public.is_admin() then raise exception 'Acesso negado'; end if;
  if not exists(select 1 from public.jogadores where id = p_player_id) then
    raise exception 'Jogador não encontrado';
  end if;
  if p_card_type not in ('normal', 'legendary') then
    raise exception 'Tipo de carta inválido';
  end if;
  if p_position is not null and p_position not in ('GOL', 'FIXO', 'ALA', 'PIVO') then
    raise exception 'Posição inválida';
  end if;
  if p_display_name is not null and char_length(trim(p_display_name)) not between 2 and 24 then
    raise exception 'O nome exibido deve ter entre 2 e 24 caracteres';
  end if;
  foreach v_value in array array[p_overall,p_pace,p_shooting,p_passing,p_dribbling,p_defending,p_physical] loop
    if v_value is not null and v_value not between 1 and 99 then
      raise exception 'Overall e atributos devem estar entre 1 e 99';
    end if;
  end loop;

  insert into public.player_cards(
    player_id, display_name, position, overall, pace, shooting, passing,
    dribbling, defending, physical, card_type
  ) values(
    p_player_id, nullif(trim(p_display_name), ''), p_position, p_overall,
    p_pace, p_shooting, p_passing, p_dribbling, p_defending, p_physical,
    p_card_type
  )
  on conflict(player_id) do update set
    display_name = excluded.display_name,
    position = excluded.position,
    overall = excluded.overall,
    pace = excluded.pace,
    shooting = excluded.shooting,
    passing = excluded.passing,
    dribbling = excluded.dribbling,
    defending = excluded.defending,
    physical = excluded.physical,
    card_type = excluded.card_type,
    updated_at = now()
  returning * into v_card;
  return v_card;
end $$;

revoke all on function public.salvar_foto_cartinha(text,numeric,numeric,numeric),
  public.admin_salvar_cartinha(uuid,text,text,integer,integer,integer,integer,integer,integer,integer,text)
  from public;
grant execute on function public.salvar_foto_cartinha(text,numeric,numeric,numeric),
  public.admin_salvar_cartinha(uuid,text,text,integer,integer,integer,integer,integer,integer,integer,text)
  to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values(
  'player-card-photos','player-card-photos',false,5242880,
  array['image/jpeg','image/png','image/webp']
)
on conflict(id) do update set
  public=false,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists player_card_photos_read on storage.objects;
create policy player_card_photos_read on storage.objects for select to authenticated
using (
  bucket_id='player-card-photos' and (
    public.is_admin() or exists(
      select 1 from public.jogadores j
       where j.user_id=auth.uid() and j.id::text=(storage.foldername(name))[1]
    )
  )
);
drop policy if exists player_card_photos_insert on storage.objects;
create policy player_card_photos_insert on storage.objects for insert to authenticated
with check (
  bucket_id='player-card-photos' and (
    public.is_admin() or exists(
      select 1 from public.jogadores j
       where j.user_id=auth.uid() and j.id::text=(storage.foldername(name))[1]
    )
  )
);
drop policy if exists player_card_photos_update on storage.objects;
create policy player_card_photos_update on storage.objects for update to authenticated
using (
  bucket_id='player-card-photos' and (
    public.is_admin() or exists(
      select 1 from public.jogadores j
       where j.user_id=auth.uid() and j.id::text=(storage.foldername(name))[1]
    )
  )
)
with check (
  bucket_id='player-card-photos' and (
    public.is_admin() or exists(
      select 1 from public.jogadores j
       where j.user_id=auth.uid() and j.id::text=(storage.foldername(name))[1]
    )
  )
);
