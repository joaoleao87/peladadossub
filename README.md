# Pelada dos Sub

MVP mobile-first em React, TypeScript e Supabase.

## Executar

1. Crie um projeto Supabase ou vincule este diretório ao projeto existente.
2. Revise e aplique `supabase/migrations/20260814120000_initial_mvp.sql` (`supabase db push` com a CLI vinculada).
3. Copie `.env.example` para `.env.local` e informe `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
4. Execute `npm install` e `npm run dev`.

A chave `service_role` nunca deve ser colocada no frontend.

## Primeiro administrador

Depois de cadastrar o organizador, promova-o uma única vez pelo SQL Editor do Supabase, usando uma sessão administrativa:

```sql
update public.profiles set role = 'admin' where id = '<uuid-do-usuario>';
```

As demais operações administrativas são protegidas por RLS e pela função `is_admin()` no banco.

## Verificação

```sh
npm run lint
npm run test
npm run build
```

Os testes SQL em `supabase/tests` podem ser executados com `supabase test db` em um ambiente local da CLI.
