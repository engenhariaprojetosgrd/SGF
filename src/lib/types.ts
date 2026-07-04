// ─── Equipamento ─────────────────────────────────────────────
export type StatusEquipamento =
  | 'operando'
  | 'manutencao'
  | 'aguardando-peca'
  | 'critico'
  | 'parado'

export interface Equipamento {
  id: string
  tag: string
  modelo: string
  categoria: string
  frota: string
  fabricante?: string
  horimetro: number
  status: StatusEquipamento
  ativo: boolean
  created_at: string
  updated_at: string
}

// ─── Ordem de Manutenção ─────────────────────────────────────
export type StatusOM =
  | 'pendente'
  | 'em_execucao'
  | 'aguardando_peca'
  | 'concluido'
  | 'cancelado'

export interface OrdemManutencao {
  id: string
  numero_om: string
  equipamento_id: string
  equipamento_tag: string
  turno: 'A' | 'B' | 'C' | 'D'
  tipo: 'Corretiva' | 'Preventiva' | 'Preditiva' | 'Melhoria'
  criticidade: 'Crítica' | 'Alta' | 'Média' | 'Baixa'
  sistema?: string
  subsistema?: string
  sintoma: string
  causa?: string
  intervencao?: string
  status: StatusOM
  executantes?: string
  hh_executado?: number
  dt_abertura: string
  dt_inicio?: string
  dt_conclusao?: string
  parada_horas?: number
  observacoes?: string
  criado_por?: string
  created_at: string
  updated_at: string
}

// ─── RAF ─────────────────────────────────────────────────────
export interface RAF {
  id: string
  numero_raf: string
  om_id?: string
  equipamento_id: string
  equipamento_tag: string
  data_ocorrencia: string
  local_ocorrencia?: string
  operador?: string
  responsavel: string
  descricao_falha: string
  custo_estimado?: number
  parada_horas?: number
  ferramenta_analise?: '5pqs' | 'ishikawa' | 'fta'
  cinco_pqs?: unknown
  ishikawa?: unknown
  fta?: unknown
  causa_raiz?: string
  observacao?: string
  foto_url?: string
  status: 'em_analise' | 'concluido' | 'aprovado' | 'cancelado'
  recorrente: boolean
  frequencia_recorrencia?: string
  created_at: string
  updated_at: string
}

// ─── Agressor ────────────────────────────────────────────────
export interface Agressor {
  id: string
  equipamento_id: string
  equipamento_tag: string
  frota?: string
  sistema: string
  subsistema?: string
  agressor?: string
  descricao: string
  criticidade?: 'Baixa' | 'Média' | 'Alta' | 'Crítica'
  acoes?: string
  observacao?: string
  codigo?: string
  foto_url?: string
  ocorrencias: number
  horas_perdidas: number
  custo_total: number
  status: 'ativo' | 'em_tratamento' | 'resolvido'
  primeira_ocorrencia?: string
  ultima_ocorrencia?: string
  created_at: string
  updated_at: string
}

// ─── Ação ────────────────────────────────────────────────────
export interface Acao {
  id: string
  raf_id?: string
  agressor_id?: string
  equipamento_tag?: string
  origem?: 'raf' | 'agressor' | 'gatilho_df' | 'manual'
  codigo?: string
  tipo: 'Corretiva Imediata' | 'Corretiva Estrutural' | 'Preventiva' | 'Melhoria de Processo'
  descricao: string
  responsavel: string
  prazo: string
  criterio_aceitacao?: string
  status: 'pendente' | 'em_andamento' | 'concluida' | 'atrasada' | 'cancelada'
  dt_conclusao?: string
  evidencia?: string
  observacoes?: string
  created_at: string
  updated_at: string
}

// ─── KPI ─────────────────────────────────────────────────────
export interface IndicadorKPI {
  id: string
  frota: string
  tipo_periodo: 'diario' | 'semanal' | 'mensal'
  data_referencia: string
  df_percent: number
  mtbf_horas?: number
  mttr_horas?: number
  horas_disponiveis?: number
  horas_manutencao?: number
  num_falhas?: number
  observacoes?: string
  ap_motivo?: string
  ap_plano?: string
  ap_responsavel?: string
  ap_prazo?: string
  criado_por?: string
  created_at: string
}

// ─── Observação ──────────────────────────────────────────────
export interface Observacao {
  id: string
  equipamento_tag?: string
  destinatario: 'PCM' | 'Inspeção' | 'Engenharia' | 'Manutenção' | 'Operação' | 'Suprimentos'
  tipo: 'Pendência' | 'Observação' | 'Alerta' | 'Solicitação'
  prioridade: 'alta' | 'media' | 'baixa'
  titulo: string
  descricao: string
  status: 'aberta' | 'em_andamento' | 'resolvida' | 'cancelada'
  criado_por?: string
  data_limite?: string
  resolucao?: string
  dt_resolucao?: string
  created_at: string
  updated_at: string
}

// ─── Turno ───────────────────────────────────────────────────
export interface Turno {
  id: string
  turno: 'A' | 'B' | 'C' | 'D'
  data_turno: string
  supervisor?: string
  observacoes_gerais?: string
  pendencias_passadas?: string
  created_at: string
}

// ─── Helpers ─────────────────────────────────────────────────
export const STATUS_LABELS: Record<StatusEquipamento, string> = {
  operando: 'Operando',
  manutencao: 'Em Manutenção',
  'aguardando-peca': 'Ag. Peça',
  critico: 'CRÍTICO',
  parado: 'Parado',
}

export const STATUS_COLORS: Record<StatusEquipamento, string> = {
  operando: '#057a55',
  manutencao: '#d97706',
  'aguardando-peca': '#9333ea',
  critico: '#c81e1e',
  parado: '#6b7280',
}

export const DF_META = 85
