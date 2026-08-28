-- Permite excluir uma conta de acesso sem apagar o histórico esportivo e financeiro.
alter table public.pelada_participantes drop constraint if exists pelada_participantes_user_id_fkey;
alter table public.pelada_participantes add constraint pelada_participantes_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete set null;

alter table public.pagamentos drop constraint if exists pagamentos_user_id_fkey;
alter table public.pagamentos add constraint pagamentos_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete set null;

alter table public.ranking_eventos alter column user_id drop not null;
alter table public.ranking_eventos drop constraint if exists ranking_eventos_user_id_fkey;
alter table public.ranking_eventos add constraint ranking_eventos_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete set null;

alter table public.premiacoes alter column user_id drop not null;
alter table public.premiacoes drop constraint if exists premiacoes_user_id_fkey;
alter table public.premiacoes add constraint premiacoes_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete set null;

alter table public.convites_mensalista alter column criado_por drop not null;
alter table public.convites_mensalista drop constraint if exists convites_mensalista_criado_por_fkey;
alter table public.convites_mensalista add constraint convites_mensalista_criado_por_fkey
  foreign key (criado_por) references public.profiles(id) on delete set null;
alter table public.convites_mensalista drop constraint if exists convites_mensalista_usado_por_fkey;
alter table public.convites_mensalista add constraint convites_mensalista_usado_por_fkey
  foreign key (usado_por) references public.profiles(id) on delete set null;

alter table public.pelada_cards alter column gerado_por drop not null;
alter table public.pelada_cards drop constraint if exists pelada_cards_gerado_por_fkey;
alter table public.pelada_cards add constraint pelada_cards_gerado_por_fkey
  foreign key (gerado_por) references public.profiles(id) on delete set null;
