# Como testar o aplicativo nativo

## Pré-requisitos

- uma conta admin ou uma conta autorizada na pelada;
- Node.js e dependências instaladas;
- Android Studio para Android;
- macOS com Xcode para iPhone.

O controle lista as peladas não canceladas, inclusive a última já encerrada. Assim, é
possível abrir a última pelada e continuar o teste sem alterar o histórico. Se ela
ainda não possuir times, gere ou revise o sorteio antes.

## Preparar os projetos

Execute:

```bash
npm install
npm run mobile:sync
```

O comando gera a versão web e sincroniza os arquivos em `android/` e `ios/`.

## Android

Para gerar um APK debug pelo terminal:

```bash
npm run android:debug
```

O arquivo será criado em
`android/app/build/outputs/apk/debug/app-debug.apk`.

Para testar no Android Studio:

1. execute `npm run mobile:sync`;
2. execute `npx cap open android`;
3. conecte o telefone com depuração USB ou inicie um emulador;
4. pressione Run;
5. aceite a permissão de notificações;
6. entre no app e abra **Controlar partida e marcações**;
7. abra o controle da última pelada e inicie a partida;
8. bloqueie o telefone e expanda a notificação.

Comandos da notificação:

- Gol esquerdo: gol para o time exibido à esquerda;
- Lance: registra um lance importante;
- Gol direito: gol para o time exibido à direita;
- Desfazer: desfaz o último gol, lance ou substituição.

O placar e o cronômetro continuam visíveis com o telefone bloqueado. Os comandos
usam a fila offline existente quando a internet cai.

## iPhone

O build iOS precisa ser feito em um Mac:

1. execute `npm run mobile:sync`;
2. execute `npx cap open ios`;
3. selecione a equipe de assinatura no target App;
4. escolha um iPhone físico e pressione Run;
5. abra uma partida, bloqueie o telefone e teste os controles em Now Playing.

O simulador não reproduz de forma confiável todos os comportamentos da tela
bloqueada. Faça a validação final em iPhone físico.

## Cenário mínimo de aceite

1. primeira partida Time 1 × Time 2;
2. registrar um gol com o telefone bloqueado;
3. confirmar o placar no app;
4. registrar lance e desfazer;
5. desligar a internet, registrar outro gol e religar;
6. confirmar a sincronização;
7. finalizar e conferir o próximo time da fila;
8. empatar uma partida e confirmar que os dois times saem;
9. substituir um jogador e desfazer a substituição.

## Atualizações durante o desenvolvimento

Depois de alterar React/CSS, execute novamente `npm run mobile:sync`. Alterações
Java ou Swift não precisam copiar o build web, mas exigem recompilar no Android
Studio ou Xcode.
