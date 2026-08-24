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
export type VoteCategory = "destaque" | "surpresa" | "negativo";
export type CardCategory = VoteCategory | "artilheiro" | "time_destaque";

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
  snapshot_membros: { nome: string; foto_url: string | null }[];
  imagem_path: string | null;
  liberado: boolean;
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
  pelada_iniciada?: boolean;
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
