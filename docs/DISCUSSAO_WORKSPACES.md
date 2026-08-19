# Discussão: múltiplas peladas por workspaces

## Estado

Proposta para discussão. Ainda não implementar.

## Objetivo

Permitir que a mesma aplicação atenda várias comunidades de pelada, com dados,
configurações, administradores e identidade visual isolados. Uma pessoa poderá
participar de mais de um workspace usando a mesma conta.

Exemplos de acesso:

- primeira versão: `peladasub.site/joao`
- evolução opcional: `joao.peladasub.site`

O identificador público deve ser um `slug` legível e alterável, como `joao` ou
`sexta-municipal`. UUIDs continuam como chaves internas do banco.

## Decisão proposta

Usar **um único frontend, um único projeto Supabase e um modelo multi-tenant por
workspace**. Começar pela rota `/:workspaceSlug` e deixar o resolvedor de
workspace preparado para aceitar subdomínios depois.

Não criar um projeto/deploy/Supabase separado para cada pelada neste momento.
Essa opção aumenta manutenção, migrations, observabilidade, suporte e custo, e
impede que uma conta navegue naturalmente entre várias peladas.

O endereço não será a fronteira de segurança. O isolamento será garantido pelo
banco, com `workspace_id`, associação do usuário ao workspace e RLS.

## Por que esta direção

| Alternativa | Vantagens | Custos e riscos | Indicação |
| --- | --- | --- | --- |
| `/:slug` no mesmo app | simples de desenvolver, testar e hospedar; funciona no Vercel atual | URLs internas precisam preservar o slug | começar aqui |
| `slug.peladasub.site` no mesmo app | marca mais forte e URLs bonitas | wildcard DNS/SSL, preview/local e cookies exigem mais cuidado | adicionar após validar multi-tenancy |
| projeto separado por pelada | isolamento físico e customização total | migrations, deploys, segredos, bugs e suporte multiplicados | somente para cliente enterprise que exija isolamento físico |

## Situação atual e impacto

Hoje a aplicação assume uma única pelada:

- as rotas começam em `/`, `/lista`, `/ranking` e semelhantes;
- `profiles.role` e `is_admin()` concedem administração global;
- `pelada_series` funciona como configuração central da pelada;
- consultas como jogadores, pagamentos, despesas e ranking não recebem um
  workspace;
- várias políticas RLS permitem leitura ampla a qualquer autenticado;
- os caminhos de Storage usam apenas o usuário ou pagamento;
- logo e nome são globais no frontend.

Adicionar somente um prefixo à URL criaria aparência de separação, mas não
isolamento real. O banco e as RPCs devem ser migrados antes de liberar um
segundo workspace.

## Modelo de dados proposto

### Identidade global

`profiles` representa a pessoa e continua com chave igual a `auth.users.id`.
Deve guardar apenas dados globais da conta, como nome, telefone e avatar.

Os campos que variam por pelada saem de `profiles`: papel, tipo de jogador,
mensalista ativo e demais preferências locais.

### Workspace e associação

```text
workspaces
  id uuid PK
  slug text UNIQUE
  nome text
  status text
  timezone text
  logo_url text NULL
  created_at timestamptz

workspace_members
  workspace_id uuid FK
  user_id uuid FK profiles
  role user | admin
  status invited | active | suspended
  jogador_id uuid NULL
  UNIQUE (workspace_id, user_id)
```

O `superadmin` deve continuar global, fora da associação comum, e ser usado
somente para operação da plataforma. Administradores normais pertencem a um
workspace.

### Dados pertencentes ao workspace

Adicionar `workspace_id NOT NULL` diretamente às raízes de agregado:

- `pelada_series`
- `peladas`
- `jogadores`
- `pagamentos`
- `despesas`
- `solicitacoes_vinculo`

Tabelas filhas, como participantes, times, votos, avaliações e parcelas, podem
obter o workspace pela chave estrangeira do pai. Adicionar também nelas só
quando isso simplificar RLS ou consultas frequentes; não duplicar por padrão.

Configurações como nome, logo e timezone ficam em `workspaces`. Regras de uma
série — local, horário, limites, antecedências e preços — continuam em
`pelada_series`, agora vinculada ao workspace. Isso mantém aberta a possibilidade
de um workspace organizar mais de uma série no futuro sem criar outra camada de
configuração agora.

Todas as unicidades de negócio passam a ser compostas quando necessário, por
exemplo `UNIQUE (workspace_id, slug)` e restrições de jogador dentro do
workspace.

## Autorização e segurança

Criar helpers no banco, com `security definer` e `search_path` fixo:

- `is_workspace_member(workspace_id)`
- `is_workspace_admin(workspace_id)`
- `is_superadmin()`

Cada política RLS deve verificar a associação ao workspace da linha. Cada RPC
deve descobrir o workspace a partir da entidade recebida e validar a permissão;
não deve confiar apenas em um `workspace_id` enviado pelo frontend.

Critério de segurança: um usuário autenticado no workspace A não consegue ler,
alterar nem inferir dados do workspace B, mesmo chamando a API do Supabase
diretamente e ignorando o frontend.

Storage também deve usar caminhos com tenant, por exemplo
`{workspace_id}/{user_id}/avatar` e
`{workspace_id}/{payment_id}/{arquivo}`, com políticas equivalentes.

## Resolução de URL no frontend

Criar um `WorkspaceProvider` responsável por:

1. extrair o slug do primeiro segmento da URL;
2. buscar o workspace público pelo slug;
3. carregar a associação do usuário autenticado;
4. disponibilizar `workspace`, `membership` e permissões;
5. mostrar “workspace não encontrado” ou “sem acesso” sem carregar dados.

Rotas da primeira versão:

```text
/:workspaceSlug
/:workspaceSlug/lista
/:workspaceSlug/ranking
/:workspaceSlug/perfil
/:workspaceSlug/financeiro
/:workspaceSlug/admin
/superadmin
/auth
```

Links devem ser relativos ao workspace ou gerados por uma pequena função
`workspacePath(path)`. Após o login, o usuário volta ao workspace solicitado; se
não houver um na URL, escolhe entre seus workspaces ativos.

Para subdomínios, o provider passa a aceitar dois resolvedores:

```text
joao.peladasub.site/lista -> workspace joao, caminho /lista
peladasub.site/joao/lista -> workspace joao, caminho /lista
```

Ambos chegam ao mesmo contexto e às mesmas consultas. Depois, uma URL pode ser
declarada canônica para evitar conteúdo duplicado.

## Contrato das consultas

O frontend deve tornar o workspace explícito nas operações de raiz:

```ts
nextPelada(workspaceId)
allPlayers(workspaceId)
payments(workspaceId)
activeSeries(workspaceId)
```

Operações que já recebem uma entidade, como `participants(peladaId)`, podem
continuar assim, porque a RLS e a RPC encontram o workspace pela pelada. O banco
é sempre a última fronteira de autorização.

## Plano de entrega

### Fase 0 — decisões e inventário

- confirmar se uma conta pode participar de vários workspaces;
- confirmar se jogador e perfil são globais ou locais (proposta: perfil global,
  jogador local);
- inventariar tabelas, funções, triggers, views, policies e buckets afetados;
- definir slug reservado (`auth`, `admin`, `superadmin`, `api`, `www`).

### Fase 1 — fundação no banco, sem mudar a URL

- criar `workspaces` e `workspace_members`;
- criar o workspace inicial `pelada-dos-sub`;
- preencher associações e papéis atuais;
- adicionar e preencher `workspace_id` nas tabelas raiz;
- adicionar FKs, índices e unicidades compostas;
- migrar helpers, RPCs, triggers e RLS;
- manter uma compatibilidade temporária que seleciona o workspace inicial.

Esta fase deve ser reversível antes de tornar colunas `NOT NULL`. A migração não
deve repetir scripts históricos destrutivos ou dados fixos das migrations atuais.

### Fase 2 — contexto e rotas no frontend

- adicionar `WorkspaceProvider`;
- prefixar rotas e navegação com `/:workspaceSlug`;
- passar `workspaceId` às consultas de raiz;
- mover papel e dados de jogador para a associação local;
- adaptar autenticação, redirects, logo e nome;
- preservar `/superadmin` como rota global.

### Fase 3 — validação multi-tenant

- criar dois workspaces de teste com usuários sobrepostos;
- testar isolamento de leitura e escrita diretamente pelo cliente Supabase;
- testar admin de A tentando operar IDs de B;
- testar ranking, lista, sorteio, pagamentos, despesas, comprovantes e vínculos;
- validar índices com planos das consultas mais frequentes.

### Fase 4 — ativação

- redirecionar `/` para o workspace único do usuário ou para um seletor;
- liberar criação de workspace somente para superadmin no início;
- monitorar erros de autorização e consultas sem filtro;
- remover a compatibilidade do workspace inicial após estabilização.

### Fase 5 — subdomínios, se ainda trouxerem valor

- configurar domínio wildcard, DNS e SSL no provedor;
- resolver slug por `window.location.hostname`;
- validar OAuth redirects, e-mails, PWA/service worker e ambiente local;
- definir URL canônica e redirects entre caminho e subdomínio.

## Testes mínimos de aceite

- a mesma conta alterna entre A e B e vê dados distintos;
- admin de A é usuário comum ou não membro em B;
- IDs válidos de B não funcionam quando usados por um membro apenas de A;
- criação de pelada, sorteio, ranking e financeiro gravam no workspace correto;
- um usuário sem associação não enumera workspaces privados;
- comprovantes e avatares locais não vazam entre workspaces;
- o workspace atual sobrevive a refresh, login e logout;
- o app antigo continua operando durante o backfill da Fase 1.

## Riscos que merecem atenção

- **RLS incompleta:** é o maior risco; filtro no frontend não é segurança.
- **papel global:** manter `admin` em `profiles` daria acesso cruzado.
- **RPCs antigas:** funções `security definer` podem contornar RLS e precisam de
  validação explícita do workspace.
- **dados históricos:** migrations com nomes, datas e limpezas específicas não
  podem ser reaplicadas como seed de novos workspaces.
- **consultas sem escopo:** telas administrativas e financeiras atuais são os
  pontos mais propensos a vazamento.
- **slug alterável:** links antigos precisam de alias ou redirect se o slug mudar.

## Questões para fechar antes da implementação

1. Qualquer usuário poderá criar um workspace ou somente o superadmin?
2. Um workspace pode ter várias séries/horários ou, no produto inicial, sempre
   representa exatamente uma pelada recorrente?
3. O avatar e telefone são os mesmos em todas as peladas? A proposta assume que
   sim; apelido, posição, mensalidade e situação ficam locais.
4. Rankings são sempre isolados ou haverá um ranking global opcional no futuro?
5. O workspace será público para leitura antes do login ou apenas para membros?
6. Há necessidade contratual de banco/projeto separado para algum organizador?

## Recomendação final para a primeira versão

Entregar somente o necessário para provar o modelo: workspace criado pelo
superadmin, associação explícita, isolamento integral no Supabase e rota por
slug. Não implementar wildcard, domínio personalizado, cobrança SaaS, convites
complexos nem painel de criação self-service nesta primeira etapa.

