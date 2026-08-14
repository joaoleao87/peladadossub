export type Role = 'user' | 'admin' | 'superadmin'
export type PlayerType = 'mensalista' | 'avulso'
export type ListPosition = 'linha' | 'goleiro'
export type ListPhase = 'fechada' | 'mensalistas' | 'geral' | 'encerrada' | 'cancelada'
export type PeladaStatus = 'aberta' | 'lotada' | 'acontecendo' | 'encerrada' | 'cancelada'
export type ParticipantStatus = 'aguardando_resposta' | 'confirmado' | 'espera' | 'recusado' | 'cancelado' | 'presente' | 'faltou'
export type PaymentStatus = 'pendente' | 'pago' | 'isento' | 'atrasado'

export interface Profile { id: string; nome: string; apelido: string | null; telefone?: string | null; foto_url: string | null; role: Role; tipo_jogador: PlayerType; posicao_lista: ListPosition; mensalista_ativo: boolean; validade_mensalidade: string | null; ativo: boolean }
export interface Pelada { id: string; data: string; horario: string; local: string; limite_jogadores: number; status: PeladaStatus; lista_aberta: boolean; fase_lista: ListPhase; motivo_cancelamento?: string | null }
export interface PeladaSeries { id:string; nome:string; dia_semana:number; horario:string; local:string; limite_jogadores:number; antecedencia_mensalistas_horas:number; antecedencia_geral_horas:number; valor_mensalista:number; valor_avulso:number; dia_vencimento:number; ativa:boolean }
export interface Participant { id: string; pelada_id: string; user_id: string; ordem_entrada: number; status: ParticipantStatus; categoria: ListPosition; profile?: Profile }
export interface Payment { id: string; user_id: string; pelada_id: string | null; tipo: 'mensalidade' | 'avulso'; valor: number; status: PaymentStatus; data_pagamento: string | null; data_vencimento?:string|null; competencia?:string|null; metodo_pagamento: 'pix' | 'dinheiro' | 'outro' | null; referencia: string | null; created_at: string; profile?: Profile }
export interface RankingRow { user_id: string; tipo: 'sub_bom' | 'sub_ruim'; pontos: number; profile?: Profile }
