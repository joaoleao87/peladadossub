export type Role = "user" | "admin" | "superadmin";
export type PlayerType = "mensalista" | "avulso";
export type ListPosition = "linha" | "goleiro";
export type ListPhase =
  | "fechada"
  | "mensalistas"
  | "geral"
  | "encerrada"
  | "cancelada";
export type PeladaStatus =
  | "aberta"
  | "lotada"
  | "acontecendo"
  | "encerrada"
  | "cancelada";
export type ParticipantStatus =
  | "aguardando_resposta"
  | "confirmado"
  | "espera"
  | "recusado"
  | "cancelado"
  | "presente"
  | "faltou";
export type PaymentStatus = "pendente" | "pago" | "isento" | "atrasado";
export type VoteCategory = "destaque" | "surpresa" | "negativo" | "goleiro_destaque";
export type CardCategory = VoteCategory | "artilheiro" | "time_destaque" | "goleiro_destaque";

export type PlayerCardType = "normal" | "legendary";
export type PlayerCardPosition = "GOL" | "FIXO" | "ALA" | "PIVO";

export interface PlayerCardData {
  id?: string;
  player_id: string;
  display_name: string | null;
  position: PlayerCardPosition | null;
  overall: number | null;
  pace: number | null;
  shooting: number | null;
  passing: number | null;
  dribbling: number | null;
  defending: number | null;
  physical: number | null;
  card_type: PlayerCardType;
  photo_url: string | null;
  photo_scale: number;
  photo_position_x: number;
  photo_position_y: number;
  created_at?: string;
  updated_at?: string;
  resolved_photo_url?: string | null;
}

export interface PlayerWithCard extends Player {
  card: PlayerCardData | null;
}
export interface Profile {
  id: string;
  nome: string;
  apelido: string | null;
  telefone?: string | null;
  foto_url: string | null;
  role: Role;
  tipo_jogador: PlayerType;
  posicao_lista: ListPosition;
  mensalista_ativo: boolean;
  validade_mensalidade: string | null;
  ativo: boolean;
}
export interface MatchCard {
  id: string;
  pelada_id: string;
  categoria: CardCategory;
  jogador_id: string;
  titulo: string;
  snapshot_nome: string;
  snapshot_foto_url: string | null;
  snapshot_time: string | null;
  snapshot_gols: number;
  snapshot_vitorias?: number;
  snapshot_membros: { nome: string; foto_url: string | null }[];
  imagem_path: string | null;
  liberado: boolean;
}

export type ControlledMatchStatus = "CREATED" | "RUNNING" | "FINISHED";
export type MatchEventType = "MATCH_STARTED" | "GOAL" | "HIGHLIGHT" | "SUBSTITUTION" | "MATCH_FINISHED";
export interface MatchControl {
  pelada_id: string;
  status: "CREATED" | "READY" | "RUNNING" | "FINISHED";
  active_match_id: string | null;
  team_queue: number[];
  device_camera_online: boolean;
  recording_session_id: string | null;
  recording_started_at: string | null;
  updated_at: string;
}
export interface ControlledMatch {
  id: string;
  pelada_id: string;
  sequence_number: number;
  team_home: number;
  team_away: number;
  score_home: number;
  score_away: number;
  duration_ms: number;
  started_at: string | null;
  ended_at: string | null;
  status: ControlledMatchStatus;
}
export interface ControlledMatchEvent {
  match?: { sequence_number: number };
  id: string;
  client_event_id: string;
  pelada_id: string;
  match_id: string;
  admin_id: string;
  type: MatchEventType;
  team_id: number | null;
  player_id: string | null;
  assist_player_id: string | null;
  corrected_created_at: string;
  match_clock_ms: number;
  recording_offset_ms: number | null;
  metadata: Record<string, unknown>;
  sync_status: "LOCAL" | "PENDING" | "SYNCED" | "ERROR";
  status: "ACTIVE" | "CANCELLED";
}
export interface MatchOperator {
  pelada_id: string;
  user_id: string;
  autorizado_por: string;
  created_at: string;
}
export interface MatchControlSnapshot {
  control: MatchControl;
  match: ControlledMatch;
  events: ControlledMatchEvent[];
  teams: TeamMember[];
  participants: Participant[];
}
export interface Player {
  id: string;
  nome: string;
  apelido: string | null;
  telefone: string | null;
  user_id: string | null;
  tipo: PlayerType;
  posicao: ListPosition;
  ativo: boolean;
  confirmacao_bloqueada?: boolean;
  isento_mensalidade?: boolean;
  nota_equilibrio?: number;
  profile?: Profile | null;
}
export interface Pelada {
  id: string;
  data: string;
  horario: string;
  local: string;
  limite_jogadores: number;
  status: PeladaStatus;
  lista_aberta: boolean;
  fase_lista: ListPhase;
  lista_automatica: boolean;
  motivo_cancelamento?: string | null;
  sorteio_liberado?: boolean;
  sorteio_times_liberados?: number;
  pelada_iniciada?: boolean;
  votacao_encerrada_em?: string | null;
}
export interface TeamMember {
  pelada_id: string;
  jogador_id: string;
  time: number;
  ordem: number;
  vencedor?: boolean;
  vitorias?: number;
  player?: Player;
}
export interface PeladaSeries {
  id: string;
  nome: string;
  dia_semana: number;
  horario: string;
  local: string;
  limite_jogadores: number;
  antecedencia_mensalistas_horas: number;
  antecedencia_geral_horas: number;
  antecedencia_saida_horas?: number;
  valor_mensalista: number;
  valor_avulso: number;
  dia_vencimento: number;
  chave_pix: string;
  ativa: boolean;
}
export interface Participant {
  id: string;
  pelada_id: string;
  user_id: string | null;
  jogador_id: string;
  ordem_entrada: number;
  status: ParticipantStatus;
  categoria: ListPosition;
  gols?: number;
  assistencias?: number;
  comparecimento?: boolean | null;
  profile?: Profile;
  player?: Player;
}
export interface Payment {
  id: string;
  user_id: string | null;
  jogador_id?: string | null;
  pelada_id: string | null;
  tipo: "mensalidade" | "avulso";
  valor: number;
  status: PaymentStatus;
  data_pagamento: string | null;
  data_vencimento?: string | null;
  competencia?: string | null;
  metodo_pagamento: "pix" | "dinheiro" | "outro" | null;
  referencia: string | null;
  comprovante_path?: string | null;
  comprovante_enviado_em?: string | null;
  created_at: string;
  profile?: Profile;
  player?: Player;
}
export interface RankingStats {
  jogador_id: string;
  user_id: string;
  nome: string;
  apelido: string | null;
  jogos: number;
  gols: number;
  assistencias: number;
  media_nota: number | null;
  total_avaliacoes: number;
  votos_destaque: number;
  votos_surpresa: number;
  votos_negativo: number;
}
export interface MatchAwardResult {
  categoria: VoteCategory;
  jogador_id: string;
  nome: string;
  apelido: string | null;
  votos: number;
}
export interface LinkRequest {
  id: string;
  user_id: string;
  jogador_id: string | null;
  status: "pendente" | "aprovada" | "rejeitada";
  created_at: string;
  profile?: Profile;
  player?: Player | null;
}
export interface ExpenseInstallment {
  id: string;
  despesa_id: string;
  numero: number;
  valor: number;
  data_vencimento: string;
  paga: boolean;
  data_pagamento: string | null;
}
export interface Expense {
  id: string;
  descricao: string;
  valor_total: number;
  numero_parcelas: number;
  data_primeira_parcela: string;
  parcelas: ExpenseInstallment[];
  created_at: string;
}
export type RecordingStatus = "READY" | "RECORDING" | "FINISHED" | "PROCESSING" | "COMPLETED" | "ERROR";
export type RecordingUploadStatus = "LOCAL" | "PENDING" | "UPLOADING" | "UPLOADED" | "ERROR";
export interface RecordingSession { id:string; pelada_id:string; admin_id:string; device_id:string; started_at:string; ended_at:string|null; duration_ms:number; status:RecordingStatus; upload_status:RecordingUploadStatus; server_time_offset_ms:number; created_at:string; }
export interface RecordingFragment { id:string; session_id:string; sequence_number:number; started_at:string; duration_ms:number; storage_path:string; mime_type:string; byte_size:number; sha256:string|null; upload_status:"PENDING"|"UPLOADING"|"UPLOADED"|"ERROR"; }
export interface RecordingCut { id:string; session_id:string; event_id:string; clip_start_ms:number; clip_end_ms:number; status:"PENDING"|"PROCESSING"|"COMPLETED"|"ERROR"|"CANCELLED"; output_path:string|null; error_message:string|null; }
