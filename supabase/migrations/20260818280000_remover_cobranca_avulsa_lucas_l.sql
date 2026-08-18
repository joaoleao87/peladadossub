delete from public.pagamentos p
using public.peladas jogo, public.jogadores jogador
where p.pelada_id = jogo.id
  and p.jogador_id = jogador.id
  and jogador.id = '22135961-e537-4cc8-ac63-9ab593ee99f5'
  and jogador.nome = 'Lucas L'
  and jogador.tipo = 'mensalista'
  and jogo.data = date '2026-08-14'
  and p.tipo = 'avulso'
  and p.status in ('pendente', 'atrasado');
