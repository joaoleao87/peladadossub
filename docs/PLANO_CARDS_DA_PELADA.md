# Plano futuro — Cards da pelada

Status: implementado em 24/08/2026.

## Objetivo

Criar quatro cards por pelada:

- Destaque
- Surpresa
- Quem quebrou mais
- Artilheiro

Cada card exibirá:

- título da categoria;
- foto do jogador;
- nome usado na lista;
- time em que jogou;
- gols registrados naquela pelada;
- identificação/data da pelada.

Somente o superadmin poderá gerar, substituir e liberar os cards. Os demais usuários verão apenas cards já liberados.

## Experiência do superadmin

Adicionar em uma área exclusiva do Superadmin a seção **Cards da pelada**:

1. Selecionar a pelada.
2. Exibir os vencedores calculados a partir dos votos de destaque, surpresa e quem quebrou mais.
3. Exibir aviso quando não houver votos ou houver empate. Em caso de empate, o superadmin escolhe o vencedor antes de gerar.
4. Gerar uma prévia de cada card.
5. Permitir substituir cada card por uma imagem estática JPG, PNG ou WEBP.
6. Permitir remover a imagem estática e voltar ao card gerado.
7. Liberar ou ocultar cada card individualmente.
8. Mostrar claramente os estados: rascunho, liberado e substituído por imagem.

Gerar não publica automaticamente. A liberação será uma ação separada e confirmada.

## Experiência dos demais usuários

- A opção **Visualizar card** aparecerá somente quando existir card liberado para a pelada.
- A tela poderá listar os três títulos disponíveis.
- Ao abrir, o card ocupará a visualização inteira.
- Cabeçalho, navegação inferior e demais ícones ficarão ocultos.
- Apenas um botão **X** ficará no canto superior para fechar e voltar à tela anterior.
- O botão voltar do navegador/celular e a tecla Escape também deverão fechar a visualização.
- Cards em rascunho ou ocultos nunca serão retornados pela API comum.

## Modelo de dados

Criar uma tabela `pelada_cards` com, no mínimo:

- `id`;
- `pelada_id`;
- `categoria` (`destaque`, `surpresa` ou `negativo` no valor interno atual);
- `jogador_id`;
- `titulo`;
- `snapshot_nome`;
- `snapshot_foto_url`;
- `snapshot_time`;
- `snapshot_gols`;
- `imagem_path` opcional;
- `liberado`;
- `gerado_por`;
- `gerado_em`;
- `liberado_em`;
- `updated_at`.

Usar uma restrição única por `pelada_id + categoria`.

Os campos `snapshot_*` congelam o conteúdo no momento da geração. Assim, alterações posteriores no cadastro, na foto, nos gols ou no sorteio não modificam um card histórico já publicado.

## Origem das informações

- Vencedor e votos: `resultado_premios_pelada` / `pelada_votos`.
- Foto e nome: jogador e perfil vinculados.
- Time: `pelada_times`.
- Gols: `pelada_participantes.gols` daquela pelada.
- Data e local: `peladas`.

Antes de gerar, validar que o vencedor participou da pelada. A ausência de foto ou time não deve impedir a geração; o layout usará avatar com inicial e texto “Time não informado”.

## Imagem estática substituta

- Criar uma pasta/bucket de Storage exclusiva para cards.
- Aceitar JPG, PNG e WEBP, com limite inicial de 5 MB.
- Guardar o arquivo por pelada e categoria.
- Quando `imagem_path` estiver preenchido, a visualização usa a imagem enviada em vez do card HTML.
- Substituir uma imagem remove a referência anterior; a limpeza física do arquivo antigo deve ocorrer no mesmo fluxo administrativo.
- A imagem substituta respeita a mesma regra de rascunho/liberação do card gerado.

## Segurança e permissões

- Geração, upload, substituição, remoção e liberação serão feitas por funções/RPCs que validam `is_superadmin()`.
- Admin comum não poderá acessar nem alterar a área.
- Usuários autenticados poderão consultar somente registros com `liberado = true`.
- O bucket não permitirá upload direto por usuários comuns.
- A interface não será a única proteção; as regras também serão aplicadas no banco e no Storage.

## Componentes previstos

- `MatchCardsManager`: seleção da pelada, geração, upload e liberação para superadmin.
- `MatchAwardCard`: composição visual do card gerado.
- `MatchCardsGallery`: opções “Visualizar card” para cards liberados.
- `CardViewer`: visualização em tela cheia, sem navegação, com apenas o X.
- Funções em `api.ts` para listar, gerar, substituir, liberar e ocultar.

Reutilizar a rota/tela de Ranking para apresentar cards liberados, evitando criar uma nova aba na navegação inferior. A gestão ficará dentro da tela Superadmin.

## Ordem de implementação

1. Criar migração, tabela, políticas, funções e bucket.
2. Implementar consulta e geração do snapshot.
3. Criar o card visual responsivo com dados reais.
4. Criar o gerenciador exclusivo do superadmin.
5. Adicionar upload e remoção da imagem substituta.
6. Adicionar liberação individual.
7. Criar a galeria e o visualizador em tela cheia para usuários.
8. Validar empates, ausência de foto/time, card oculto e histórico.

## Critérios de aceite

- Existem no máximo quatro cards por pelada, um por categoria.
- Apenas superadmin consegue gerar ou alterar cards.
- Gerar um card não o libera automaticamente.
- Usuários comuns enxergam somente cards liberados.
- Card gerado mostra título, foto, time, nome e gols.
- Imagem estática substitui integralmente o card gerado.
- Visualização aberta oculta todos os ícones e mantém apenas o X.
- Fechar retorna à tela e posição anteriores.
- Alterações posteriores nos dados do jogador não mudam cards já gerados.
- Desktop e mobile mantêm o card legível sem corte.

## Fora do primeiro ciclo

- Editor visual livre de textos, fontes e posições.
- Vários modelos de card.
- Download/renderização automática do card HTML como arquivo de imagem.
- Compartilhamento direto em redes sociais.
- Notificações push quando um card for liberado.

Esses itens só devem ser adicionados depois que geração, substituição, liberação e visualização estiverem validadas.
