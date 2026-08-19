drop trigger if exists jogadores_isentar_goleiro on public.jogadores;
create trigger jogadores_isentar_goleiro
before insert or update of posicao, isento_mensalidade on public.jogadores
for each row execute function public.garantir_isencao_goleiro();
