create or replace function public.calcular_overall_cartinha(
  p_position text,
  p_pace integer,
  p_shooting integer,
  p_passing integer,
  p_dribbling integer,
  p_defending integer,
  p_physical integer
) returns smallint
language sql
immutable
set search_path = ''
as $$
  select case p_position
    when 'GOL' then round(p_pace * 0.21 + p_shooting * 0.21 + p_passing * 0.10 + p_dribbling * 0.24 + p_defending * 0.08 + p_physical * 0.16)::smallint
    when 'FIXO' then round(p_pace * 0.10 + p_shooting * 0.05 + p_passing * 0.15 + p_dribbling * 0.10 + p_defending * 0.35 + p_physical * 0.25)::smallint
    when 'ALA' then round(p_pace * 0.22 + p_shooting * 0.15 + p_passing * 0.18 + p_dribbling * 0.22 + p_defending * 0.08 + p_physical * 0.15)::smallint
    when 'PIVO' then round(p_pace * 0.15 + p_shooting * 0.30 + p_passing * 0.13 + p_dribbling * 0.20 + p_defending * 0.05 + p_physical * 0.17)::smallint
    else null
  end
  where p_pace is not null
    and p_shooting is not null
    and p_passing is not null
    and p_dribbling is not null
    and p_defending is not null
    and p_physical is not null
$$;

create or replace function public.definir_overall_cartinha()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.overall := public.calcular_overall_cartinha(
    new.position, new.pace, new.shooting, new.passing,
    new.dribbling, new.defending, new.physical
  );
  return new;
end
$$;

drop trigger if exists player_cards_overall_automatico on public.player_cards;
create trigger player_cards_overall_automatico
before insert or update of position, pace, shooting, passing, dribbling, defending, physical
on public.player_cards
for each row execute function public.definir_overall_cartinha();

update public.player_cards
set overall = public.calcular_overall_cartinha(
  position, pace, shooting, passing, dribbling, defending, physical
);
