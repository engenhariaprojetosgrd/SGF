import { supabase } from '@/lib/supabase'
import type { OrdemManutencao } from '@/lib/types'

export const revalidate = 60

const TIPO_CLS: Record<string, string> = {
  Corretiva: 'badge-crit',
  Preventiva: 'badge-ok',
  Preditiva: 'badge-purple',
  Melhoria: 'badge-warn',
}

const STATUS_CLS: Record<string, string> = {
  concluido: 'badge-ok',
  cancelado: 'badge-off',
  pendente: 'badge-warn',
  em_execucao: 'badge-purple',
  aguardando_peca: 'badge-purple',
}

const STATUS_LABEL: Record<string, string> = {
  concluido: 'Concluído',
  cancelado: 'Cancelado',
  pendente: 'Pendente',
  em_execucao: 'Em Execução',
  aguardando_peca: 'Ag. Peça',
}

export default async function HistoricoPage() {
  const { data, error } = await supabase
    .from('ordens_manutencao')
    .select('*')
    .in('status', ['concluido', 'cancelado'])
    .order('dt_conclusao', { ascending: false })
    .limit(100)

  const ordens: OrdemManutencao[] = data ?? []

  const totalHH = ordens.reduce((acc, o) => acc + (o.hh_executado ?? 0), 0)
  const totalParada = ordens.reduce((acc, o) => acc + (o.parada_horas ?? 0), 0)
  const corretivas = ordens.filter(o => o.tipo === 'Corretiva').length

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">📚 Histórico</h1>
        <p className="page-sub">Ordens de manutenção concluídas e canceladas</p>
      </div>

      <div className="kpi-strip">
        <div className="kpi-pill">
          <span className="kpi-label">Total Concluídas</span>
          <span className="kpi-value">{ordens.filter(o => o.status === 'concluido').length}</span>
        </div>
        <div className="kpi-pill">
          <span className="kpi-label">HH Total</span>
          <span className="kpi-value">{totalHH.toFixed(0)}h</span>
        </div>
        <div className="kpi-pill">
          <span className="kpi-label">H. Parada Total</span>
          <span className="kpi-value">{totalParada.toFixed(0)}h</span>
        </div>
        <div className="kpi-pill">
          <span className="kpi-label">Corretivas</span>
          <span className="kpi-value">{corretivas}</span>
        </div>
      </div>

      {error && (
        <div className="card" style={{ color: 'var(--crit)', marginBottom: '1rem' }}>
          Erro: {error.message}
        </div>
      )}

      <div className="card">
        {ordens.length === 0 ? (
          <div className="empty-state" style={{ padding: '3rem' }}>
            <div className="empty-icon">📚</div>
            <div className="empty-title">Nenhum histórico disponível</div>
            <div className="empty-sub">As OMs concluídas aparecerão aqui</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nº OM</th>
                  <th>Equipamento</th>
                  <th>Tipo</th>
                  <th>Sistema</th>
                  <th>Sintoma</th>
                  <th>HH</th>
                  <th>Parada</th>
                  <th>Conclusão</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {ordens.map(o => (
                  <tr key={o.id}>
                    <td style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '0.78rem', color: 'var(--accent)' }}>
                      {o.numero_om}
                    </td>
                    <td style={{ fontWeight: 600 }}>{o.equipamento_tag}</td>
                    <td>
                      <span className={`badge ${TIPO_CLS[o.tipo] ?? 'badge-off'}`} style={{ fontSize: '0.7rem' }}>
                        {o.tipo}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {o.sistema ?? '—'}
                    </td>
                    <td style={{ maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.83rem' }}>
                      {o.sintoma}
                    </td>
                    <td style={{ fontSize: '0.83rem' }}>{o.hh_executado ? `${o.hh_executado.toFixed(1)}h` : '—'}</td>
                    <td style={{ fontSize: '0.83rem', color: o.parada_horas ? 'var(--crit)' : 'var(--text-muted)' }}>
                      {o.parada_horas ? `${o.parada_horas.toFixed(1)}h` : '—'}
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {o.dt_conclusao ? new Date(o.dt_conclusao).toLocaleDateString('pt-BR') : '—'}
                    </td>
                    <td>
                      <span className={`badge ${STATUS_CLS[o.status] ?? 'badge-off'}`} style={{ fontSize: '0.7rem' }}>
                        {STATUS_LABEL[o.status] ?? o.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
