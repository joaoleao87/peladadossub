# Parte 2 — Gravação, timeline e cortes

## Base entregue pela Parte 1

A gravação deve usar a estrutura implantada:

- peladas: evento completo da noite;
- pelada_controles: estado do rodízio, fila e gravação ativa;
- pelada_partidas: cada jogo de 10 minutos;
- pelada_eventos_partida: início, gols, lances, substituições e encerramento;
- pelada_dispositivos: aparelhos CONTROL ou CAMERA;
- pelada_operadores: autorização específica da pelada.

Todo evento já possui corrected_created_at, match_clock_ms,
recording_session_id e recording_offset_ms. A Parte 2 preencherá os dois últimos
ao vincular uma gravação.

## 1. Sessões de gravação

Criar recording_sessions com id, pelada_id, admin_id, device_id, started_at,
ended_at, duration_ms, local_file_id, uploaded_file, server_time_offset_ms e:

- upload_status: LOCAL, PENDING, UPLOADING, UPLOADED ou ERROR;
- status: READY, RECORDING, FINISHED, PROCESSING ou COMPLETED.

Ao iniciar REC:

1. medir a diferença para o relógio do servidor;
2. criar a sessão;
3. registrar started_at;
4. vinculá-la ao pelada_controles;
5. anunciar a câmera pelo Realtime.

A gravação pode começar antes da primeira partida. O cronômetro esportivo
continua independente.

## 2. Tela Modo Câmera

Criar /controle-partida/:peladaId/camera com preview, REC, duração, estado da
gravação, espaço e bateria quando suportados, conexão, fragmentos locais,
progresso do upload e finalização. Usar a autorização da Parte 1.

## 3. Persistência local

No protótipo web:

- capturar com getUserMedia e MediaRecorder;
- produzir fragmentos de 5 segundos;
- persistir em OPFS, com fallback para IndexedDB;
- guardar sequência, duração, MIME type, tamanho e hash;
- não depender da internet;
- recuperar sessão interrompida ao reabrir.

Não manter a gravação inteira apenas na memória.

## 4. Aplicativo nativo e tela bloqueada

A base Capacitor e os controles de partida foram antecipados na Parte 1:

- projetos Android e iOS versionados;
- Android com serviço em primeiro plano, MediaSession e notificação persistente;
- iOS com Now Playing e Remote Commands;
- ponte dos comandos para a mesma fila offline da tela de controle.

A gravação da Parte 2 ainda deverá completar:

- Android: câmera nativa, arquivo local e serviço de gravação em primeiro plano;
- iOS: AVFoundation e avaliação de Locked Camera Capture;
- Live Activity/App Intents iOS, quando a experiência de gravação exigir controles adicionais.

Na PWA, Media Session permanece como fallback dos controles bloqueados, mas não
garante câmera em segundo plano. No iPhone, a tela do aparelho que grava deverá
ficar ativa no MVP, com Wake Lock e baixo brilho.

## 5. Upload retomável

- consolidar depois de finalizar;
- enviar via TUS para bucket privado;
- retomar após queda;
- validar tamanho e hash;
- apagar o arquivo local apenas após confirmação;
- aplicar RLS por pelada;
- registrar falhas sem perder o vídeo.

## 6. Timeline e cortes

- ordenar eventos por recording_offset_ms;
- abrir o vídeo no ponto do evento;
- completar jogador, assistência, categoria e observação;
- cancelar, restaurar, gerar corte e compartilhar;
- exibir substituições e partidas do rodízio;
- gol: 10 segundos antes e 8 depois;
- lance: 10 segundos antes e 5 depois;
- ignorar eventos cancelados;
- processar assincronamente com FFmpeg.

## 7. Ordem incremental

1. tabela e RPCs de sessão;
2. modo câmera web;
3. gravação fragmentada e recuperação;
4. vínculo da sessão com eventos;
5. upload retomável;
6. player e timeline;
7. worker de cortes;
8. camada nativa Android;
9. camada nativa iOS;
10. testes prolongados em aparelhos reais.

## Critérios de aceite

- internet instável não interrompe a gravação;
- gravação antecipada mantém offsets corretos;
- vídeo local sobrevive a fechamento inesperado;
- upload retoma sem duplicar;
- cada gol abre no ponto correto;
- eventos cancelados não geram cortes;
- acesso fica restrito a admins e operadores da pelada;
- controles bloqueados funcionam no aplicativo nativo.
