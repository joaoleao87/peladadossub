# Pelada dos Sub --- Instruções do Projeto

## 1. Visão geral

**Pelada dos Sub** é uma aplicação web responsiva para organizar e
administrar uma pelada de futsal entre amigos.

O sistema deve centralizar:

-   lista de participantes de cada pelada;
-   mensalistas e jogadores avulsos;
-   pagamentos;
-   presença e faltas;
-   administração da pelada;
-   rankings de **SUB Craques** e **SUB Ruins**;
-   premiações de cada rodada;
-   histórico dos jogadores e das peladas.

O produto deve ser pensado primeiro para **mobile**, já que a maior
parte dos jogadores utilizará o sistema pelo celular.

------------------------------------------------------------------------

## 2. Identidade do produto

A interface deve seguir a identidade visual da **Pelada dos Sub**.

### Direção visual

-   fundo predominantemente preto;
-   amarelo como cor principal de destaque;
-   branco para contraste;
-   estética esportiva e urbana;
-   referências visuais de futsal;
-   detalhes grunge usados com moderação;
-   elementos de prancheta/tática podem aparecer como apoio visual;
-   cards grandes;
-   boa hierarquia tipográfica;
-   botões fáceis de utilizar no celular.

A aplicação não deve parecer um sistema administrativo corporativo
genérico. Ela deve carregar a personalidade da Pelada dos Sub sem
prejudicar usabilidade e legibilidade.

------------------------------------------------------------------------

## 3. Stack e infraestrutura

Utilizar prioritariamente:

-   React;
-   TypeScript;
-   Supabase;
-   Supabase Auth;
-   PostgreSQL do Supabase;
-   Row Level Security (RLS);
-   GitHub conectado ao projeto.

### Regras técnicas

1.  Antes de criar qualquer tabela, verificar o schema existente no
    Supabase.
2.  Não apagar ou modificar estruturas existentes sem necessidade.
3.  Toda alteração relevante de banco deve possuir migration.
4.  Não utilizar dados mockados como solução permanente.
5.  A aplicação deve trabalhar com dados reais do Supabase.
6.  Componentes devem ser reutilizáveis.
7.  Separar corretamente regras de negócio, UI e acesso aos dados.
8.  Não confiar apenas em proteção de rotas no frontend.
9.  Permissões sensíveis devem ser garantidas também pelo Supabase/RLS.
10. Evitar arquitetura excessivamente complexa no MVP.

------------------------------------------------------------------------

## 4. Perfis e permissões

Existem inicialmente dois níveis de acesso:

### User

Jogador comum.

Pode:

-   visualizar a próxima pelada;
-   entrar na lista;
-   sair da lista;
-   consultar sua posição;
-   visualizar lista de participantes;
-   visualizar rankings;
-   visualizar seu perfil;
-   visualizar sua situação financeira;
-   consultar seu histórico.

### Admin

Organizador/diretoria.

Além das funções de usuário, pode:

-   criar e editar peladas;
-   abrir e fechar listas;
-   adicionar e remover participantes;
-   alterar situação de participantes;
-   gerenciar lista de espera;
-   controlar mensalistas;
-   registrar pagamentos;
-   marcar presença e falta;
-   gerenciar rankings;
-   definir premiações;
-   administrar jogadores.

------------------------------------------------------------------------

## 5. Autenticação

Utilizar **Supabase Auth**.

Fluxos iniciais:

-   cadastro;
-   login;
-   logout;
-   recuperação de senha.

Cada usuário autenticado deve possuir um perfil na aplicação.

### `profiles`

Campos sugeridos:

-   `id`
-   `auth_user_id`
-   `nome`
-   `apelido`
-   `telefone`
-   `foto_url`
-   `role`
-   `tipo_jogador`
-   `mensalista_ativo`
-   `validade_mensalidade`
-   `ativo`
-   `created_at`
-   `updated_at`

### Roles

-   `admin`
-   `user`

### Tipos de jogador

-   `mensalista`
-   `avulso`

------------------------------------------------------------------------

## 6. Peladas

Cada edição da pelada deve ser uma entidade própria.

Isso é importante porque pagamentos avulsos, participantes, presença,
premiações e rankings precisam poder ser associados a uma rodada
específica.

### `peladas`

Campos sugeridos:

-   `id`
-   `data`
-   `horario`
-   `local`
-   `limite_jogadores`
-   `status`
-   `lista_aberta`
-   `created_at`
-   `updated_at`

### Status

-   `aberta`
-   `lotada`
-   `acontecendo`
-   `encerrada`
-   `cancelada`

------------------------------------------------------------------------

## 7. Lista da pelada

Cada pelada possui sua própria lista.

### `pelada_participantes`

Campos sugeridos:

-   `id`
-   `pelada_id`
-   `user_id`
-   `ordem_entrada`
-   `status`
-   `created_at`

### Status do participante

-   `confirmado`
-   `espera`
-   `cancelado`
-   `presente`
-   `faltou`

### Regras

Quando houver vaga, o usuário entra como `confirmado`.

Quando o limite for atingido, novos usuários entram automaticamente como
`espera`.

Quando um participante confirmado sair, o primeiro jogador elegível da
lista de espera deve assumir a vaga.

A operação precisa ser segura contra duas pessoas ocupando a mesma
última vaga simultaneamente. Sempre que possível, implementar regras
críticas no banco/RPC/transação em vez de depender apenas do frontend.

O usuário deve conseguir visualizar claramente:

-   número de confirmados;
-   limite de jogadores;
-   vagas restantes;
-   sua posição;
-   lista principal;
-   lista de espera.

------------------------------------------------------------------------

## 8. Mensalistas

O sistema precisa diferenciar:

-   mensalistas;
-   jogadores avulsos.

O modelo deve permitir futuramente regras de prioridade, como:

> A lista abre primeiro para mensalistas e depois para jogadores
> avulsos.

Essa regra não precisa necessariamente fazer parte da primeira entrega,
mas a arquitetura não deve impedir sua implementação.

------------------------------------------------------------------------

## 9. Pagamentos

Criar um módulo financeiro simples para controlar mensalidades e
pagamentos avulsos.

### `pagamentos`

Campos sugeridos:

-   `id`
-   `user_id`
-   `pelada_id` --- opcional para mensalidades e obrigatório quando o
    pagamento estiver associado a uma rodada específica;
-   `tipo`
-   `valor`
-   `status`
-   `data_pagamento`
-   `metodo_pagamento`
-   `referencia`
-   `observacao`
-   `created_at`

### Tipos

-   `mensalidade`
-   `avulso`

### Status

-   `pendente`
-   `pago`
-   `isento`
-   `atrasado`

### Métodos

-   `pix`
-   `dinheiro`
-   `outro`

O jogador deve visualizar:

-   situação atual;
-   último pagamento;
-   próximo vencimento, quando aplicável;
-   histórico.

O administrador deve visualizar:

-   pagos;
-   pendentes;
-   atrasados;
-   mensalistas;
-   avulsos;
-   receita registrada no período.

------------------------------------------------------------------------

## 10. Dashboard do usuário

A home do jogador deve priorizar a próxima ação.

### Informações principais

**Próxima pelada**

-   data;
-   horário;
-   local;
-   status da lista;
-   vagas restantes.

**Minha participação**

Exemplos:

-   `Entrar na lista`
-   `Você está confirmado`
-   `Você é o 3º da lista de espera`

**Pagamento**

Exemplos:

-   `Mensalidade paga`
-   `Pagamento pendente`

**Ranking**

-   posição SUB Craques;
-   posição SUB Ruins.

O dashboard não deve ficar sobrecarregado com informações
administrativas.

------------------------------------------------------------------------

## 11. Painel administrativo

Criar área exclusiva em `/admin`.

### Dashboard

Exibir:

-   próxima pelada;
-   inscritos;
-   vagas restantes;
-   jogadores em espera;
-   mensalistas ativos;
-   pagamentos pendentes;
-   receita registrada no mês;
-   faltas da última rodada.

### Gestão da pelada

O administrador poderá:

-   criar;
-   editar;
-   cancelar;
-   abrir lista;
-   fechar lista;
-   adicionar jogador;
-   remover jogador;
-   alterar status;
-   reorganizar lista quando necessário;
-   mover jogador da espera;
-   marcar presença;
-   marcar falta.

------------------------------------------------------------------------

## 12. Rankings

A aplicação possui dois rankings principais.

### SUB Craques

Ranking positivo dos jogadores.

### SUB Ruins

Ranking voltado à resenha da pelada.

### Estrutura sugerida

`ranking_eventos`

-   `id`
-   `pelada_id`
-   `user_id`
-   `tipo`
-   `pontos`
-   `observacao`
-   `created_at`

Tipos iniciais:

-   `sub_bom`
-   `sub_ruim`

Preferir armazenar os eventos/pontos por rodada e calcular o ranking
acumulado, em vez de manter apenas um número total sem histórico.

------------------------------------------------------------------------

## 13. Premiações

Após cada rodada, o administrador pode registrar:

-   **Craque da Pelada**
-   **Destaque SUB Ruim**
-   **Goleiro Destaque**

### `premiacoes`

Campos:

-   `id`
-   `pelada_id`
-   `user_id`
-   `categoria`
-   `created_at`

As premiações devem aparecer automaticamente no histórico e perfil do
jogador.

------------------------------------------------------------------------

## 14. Perfil do jogador

Cada jogador deve possuir uma página.

Exibir:

-   foto;
-   nome;
-   apelido;
-   mensalista/avulso;
-   partidas;
-   presenças;
-   faltas;
-   taxa de presença;
-   ranking SUB Craques;
-   ranking SUB Ruins;
-   quantidade de premiações;
-   histórico recente.

------------------------------------------------------------------------

## 15. Histórico

Criar tela de peladas anteriores.

Cada rodada encerrada poderá mostrar:

-   data;
-   participantes;
-   presentes;
-   faltantes;
-   Craque da Pelada;
-   Destaque SUB Ruim;
-   Goleiro Destaque.

Isso deve permitir construir estatísticas sem perder o histórico das
semanas anteriores.

------------------------------------------------------------------------

## 16. Navegação

### Usuário comum

Menu mobile inferior:

1.  Início
2.  Lista
3.  Ranking
4.  Perfil

### Administrador

Adicionar acesso ao:

5.  Admin

O menu inferior deve respeitar a safe area dos dispositivos móveis.

------------------------------------------------------------------------

## 17. Segurança e RLS

RLS deve estar habilitado nas tabelas que contenham dados de usuários.

### Usuário

Pode:

-   ler informações públicas das peladas;
-   visualizar rankings;
-   editar apenas dados permitidos do próprio perfil;
-   consultar seus pagamentos;
-   gerenciar apenas sua própria inscrição quando a regra da pelada
    permitir.

### Admin

Pode gerenciar:

-   peladas;
-   participantes;
-   pagamentos;
-   rankings;
-   premiações;
-   usuários.

A autorização administrativa não deve depender apenas de esconder botões
no frontend.

------------------------------------------------------------------------

## 18. Funcionalidades futuras

A arquitetura deve permitir posteriormente:

-   sorteio automático de times;
-   balanceamento por nível/ranking;
-   votação para Craque da Pelada;
-   votação para SUB Ruim;
-   gols;
-   assistências;
-   cartões;
-   estatísticas individuais;
-   calendário;
-   notificações;
-   WhatsApp;
-   Pix;
-   confirmação automática de pagamento;
-   geração de cards para Instagram;
-   escalações;
-   histórico de times;
-   temporadas;
-   ranking por temporada.

Não implementar tudo no MVP.

------------------------------------------------------------------------

## 19. Sorteio de times --- preparação

Uma evolução importante será o sorteio automático.

A ideia futura é utilizar o nível/ranking dos jogadores confirmados para
criar equipes equilibradas.

Por isso, evitar uma estrutura em que o ranking seja apenas visual.

No futuro, poderá existir:

-   pontuação técnica;
-   posição preferencial;
-   goleiro;
-   nível;
-   histórico de resultados.

------------------------------------------------------------------------

## 20. Ordem de implementação

### Fase 1 --- Fundação

1.  analisar repositório;
2.  analisar Supabase;
3.  verificar autenticação existente;
4.  definir schema;
5.  criar migrations;
6.  configurar RLS;
7.  estruturar layout e identidade.

### Fase 2 --- Fluxo principal

1.  autenticação;
2.  perfil;
3.  dashboard;
4.  próxima pelada;
5.  lista;
6.  entrar/sair da lista;
7.  lista de espera.

### Fase 3 --- Administração

1.  painel admin;
2.  criação de peladas;
3.  gerenciamento da lista;
4.  presença;
5.  mensalistas;
6.  pagamentos.

### Fase 4 --- Resenha

1.  rankings;
2.  premiações;
3.  perfil estatístico;
4.  histórico.

### Fase 5 --- Evoluções

1.  sorteio de times;
2.  balanceamento;
3.  votação;
4.  automações;
5.  WhatsApp;
6.  Pix;
7.  geração de conteúdo.

------------------------------------------------------------------------

## 21. Escopo do MVP

O MVP deve estar completo quando for possível executar este fluxo:

`Login → Dashboard → Visualizar próxima pelada → Entrar na lista → Ver posição → Admin gerenciar lista → Marcar presença → Controlar mensalista → Registrar pagamento`

Rankings e premiações entram logo após a estabilização desse fluxo.

------------------------------------------------------------------------

## 22. Diretrizes para agentes de IA trabalhando no repositório

Antes de alterar código:

1.  ler a estrutura do projeto;
2.  identificar padrões já utilizados;
3.  verificar dependências instaladas;
4.  verificar migrations existentes;
5.  verificar schema atual do Supabase;
6.  verificar políticas RLS existentes;
7.  procurar componentes reutilizáveis.

Durante a implementação:

-   não duplicar componentes desnecessariamente;
-   não substituir arquitetura funcional apenas por preferência;
-   não inserir secrets no código;
-   não colocar `service_role` no frontend;
-   não desativar RLS para resolver problemas;
-   não criar tabelas duplicadas;
-   não utilizar `any` indiscriminadamente;
-   manter TypeScript tipado;
-   tratar loading, empty state e erros;
-   garantir responsividade;
-   testar os fluxos alterados.

Depois de implementar:

1.  revisar alterações;
2.  executar lint;
3.  executar typecheck;
4.  executar testes existentes;
5.  testar o fluxo no mobile;
6.  verificar erros no console;
7.  documentar migrations e decisões relevantes.

------------------------------------------------------------------------

## 23. Critérios gerais de qualidade

Uma funcionalidade não deve ser considerada concluída apenas porque a
tela aparece.

Ela precisa:

-   funcionar com dados reais;
-   respeitar permissões;
-   funcionar no mobile;
-   possuir estado de loading;
-   possuir estado vazio;
-   tratar erros;
-   fornecer feedback após ações;
-   manter consistência visual;
-   não quebrar funcionalidades existentes.

------------------------------------------------------------------------

## 24. Princípio do projeto

A **Pelada dos Sub** não é apenas um sistema de lista.

O produto deve unir três pilares:

**Organização**

Lista, pagamentos, presença e administração.

**Competição**

Ranking, histórico, estatísticas e sorteio equilibrado.

**Resenha**

SUB Ruins, premiações, destaques e conteúdo.

Toda nova funcionalidade deve fortalecer pelo menos um desses pilares
sem tornar a experiência desnecessariamente complicada.
