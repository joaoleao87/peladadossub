do $$
declare
  v_lucas_origem constant uuid := '9cd052fe-ecb0-441b-bbfd-2aa14f48f4d3';
  v_lucas_destino constant uuid := '22135961-e537-4cc8-ac63-9ab593ee99f5';
  v_joao_duplicado constant uuid := '68cef895-50a2-4055-b5ef-02c7f80d28d2';
begin
  if not exists(select 1 from public.jogadores where id=v_lucas_origem and nome='Lucas Léo')
    or not exists(select 1 from public.jogadores where id=v_lucas_destino and nome='Lucas L') then
    raise exception 'Cadastros de Lucas divergiram do esperado';
  end if;

  update public.pagamentos set jogador_id=v_lucas_destino where jogador_id=v_lucas_origem;
  update public.pelada_participantes set jogador_id=v_lucas_destino where jogador_id=v_lucas_origem;
  update public.pelada_times set jogador_id=v_lucas_destino where jogador_id=v_lucas_origem;
  update public.pelada_avaliacoes set avaliado_jogador_id=v_lucas_destino where avaliado_jogador_id=v_lucas_origem;
  update public.pelada_votos set avaliado_jogador_id=v_lucas_destino where avaliado_jogador_id=v_lucas_origem;
  delete from public.jogadores where id=v_lucas_origem;

  if exists(select 1 from public.jogadores where id=v_joao_duplicado and nome='João' and not ativo) then
    delete from public.jogadores where id=v_joao_duplicado;
  end if;
end $$;
