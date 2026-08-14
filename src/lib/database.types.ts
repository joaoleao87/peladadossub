export type Role = 'user' | 'admin'
export type PlayerType = 'mensalista' | 'avulso'
export type PeladaStatus = 'aberta' | 'lotada' | 'acontecendo' | 'encerrada' | 'cancelada'
export type ParticipantStatus = 'confirmado' | 'espera' | 'cancelado' | 'presente' | 'faltou'
export type PaymentStatus = 'pendente' | 'pago' | 'isento' | 'atrasado'

export interface Profile { id: string; nome: string; apelido: string | null; foto_url: string | null; role: Role; tipo_jogador: PlayerType; mensalista_ativo: boolean; validade_mensalidade: string | null; ativo: boolean }
export interface Pelada { id: string; data: string; horario: string; local: string; limite_jogadores: number; status: PeladaStatus; lista_aberta: boolean }
export interface Participant { id: string; pelada_id: string; user_id: string; ordem_entrada: number; status: ParticipantStatus; profile?: Profile }
export interface Payment { id: string; user_id: string; pelada_id: string | null; tipo: 'mensalidade' | 'avulso'; valor: number; status: PaymentStatus; data_pagamento: string | null; metodo_pagamento: 'pix' | 'dinheiro' | 'outro' | null; referencia: string | null; created_at: string; profile?: Profile }
export interface RankingRow { user_id: string; tipo: 'sub_bom' | 'sub_ruim'; pontos: number; profile?: Profile }
