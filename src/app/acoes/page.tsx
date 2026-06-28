'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Acao } from '@/lib/types'

function diasAte(data: string | null | undefined) {
  if (!data) return null
  const d = new Date(data)
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  return Math.round((d.getTime() - hoje.getTime()) / 86400000)
}
function fmtData(d: string | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' })
}

type StatusCalc = 'atrasada' | 'andamento' | 'concluida'
function statusCalc(a: Acao): StatusCalc {
  if (a.status === 'concluida') return 'concluida'
  const d = diasAte(a.prazo)
  if (d !== null && d < 0) return 'atrasada'
  return 'andamento'
}

const STATUS_META: Record<StatusCalc, { label: string; badge: string }> = {
  atrasada:  { label: 'Atrasada',     badge: 'badge-danger'  },
  andamento: { label: 'Em Andamento', badge: 'badge-blue'    },
  concluida: { label: 'Concluída',    badge: 'badge-success' },
}

function origemBadge(a: Acao) {
  if (a.raf_id)      return <span className="badge badge-raf">RAF</span>
  if (a.agressor_id) return <span className="badge badge-agressor">Agressor</span>
  return <span className="text-muted text-xs">—</span>
}

export default function AcoesPage() {
  const [acoes, setAcoes]     = useState<Acao[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro]   = useState<'todas' | StatusCalc>('todas')

  useEffect(() => {
    supabase.from('acoes').select('*').order('prazo').then(({ data }) => {
      setAcoes(data ?? [])
      setLoading(false)
    })
  }, [])

  const comStatus = acoes.map(a => ({ a, st: statusCalc(a) }))
  const cont = {
    atrasada:  comStatus.filter(x => x.st === 'atrasada').length,
    andamento: comStatus.filter(x => x.st === 'andamento').length,
    concluida: comStatus.filter(x => x.st === 'concluida').length,
  }
  const ordem: Record<StatusCalc, number> = { atrasada: 0, andamento: 1, concluida: 2 }
  const lista = comStatus
    .filter(x => filtro === 'todas' || x.st === filtro)
    .sort((p, q) => ordem[p.st] - ordem[q.st])

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div className="page-title">✅ Plano de Ação</div>
          <div className="page-sub">Gerenciamento de todas as ações e compromissos da equipe</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <span className="badge badge-danger">{cont.atrasada} atrasadas</span>
          <span className="badge badge-blue">{cont.andamento} em andamento</span>
          <span className="badge badge-success">{cont.concluida} concluídas</span>
        </div>
      </div>

      {/* ── Filtro rápido (opcional, não muda a tabela única) ── */}
      <div className="period-selector" style={{ marginBottom: 16 }}>
        {([
          ['todas', `Todas (${acoes.length})`],
          ['atrasada', `Atrasadas (${cont.atrasada})`],
          ['andamento', `Em Andamento (${cont.andamento})`],
          ['concluida', `Concluídas (${cont.concluida})`],
        ] as const).map(([k, lbl]) => (
          <button
            key={k}
            className={`period-btn ${filtro === k ? 'active' : ''}`}
            onClick={() => setFiltro(k)}
          >{lbl}</button>
        ))}
      </div>

      {/* ── Tabela única ── */}
      <div className="card" style={{ padding: 0 }}>
        <div className="card-hd">
          <span className="card-title">📋 Ações do Plano</span>
          <span className="text-xs text-muted">{lista.length} ação{lista.length !== 1 ? 'ões' : ''}</span>
        </div>

        {loading ? (
          <div className="empty-state" style={{ padding: '48px' }}>
            <div className="empty-state-icon">⏳</div>
            <div className="empty-state-sub">Carregando...</div>
          </div>
        ) : lista.length === 0 ? (
          <div className="empty-state" style={{ padding: '48px' }}>
            <div className="empty-state-icon">📋</div>
            <div className="empty-state-title">Nenhuma ação</div>
            <div className="empty-state-sub">As ações aparecerão aqui conforme forem cadastradas</div>
          </div>
        ) : (
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr>
                  <th>Origem</th>
                  <th>Descrição</th>
                  <th>Responsável</th>
                  <th>Prazo</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {lista.map(({ a, st }) => {
                  const dias = diasAte(a.prazo)
                  const meta = STATUS_META[st]
                  return (
                    <tr key={a.id} className="clickable">
                      <td>{origemBadge(a)}</td>
                      <td style={{ maxWidth: 360 }}>
                        <div className="fw-600 text-sm">{a.descricao}</div>
                        {a.equipamento_tag && <div className="text-xs text-muted mt4">{a.equipamento_tag}</div>}
                      </td>
                      <td className="text-sm">{a.responsavel ?? '—'}</td>
                      <td className="text-xs">
                        {fmtData(a.prazo)}
                        {st === 'atrasada' && dias !== null && (
                          <span className="ac-deadline late" style={{ marginLeft: 6 }}>{Math.abs(dias)}d atrasado</span>
                        )}
                        {st === 'andamento' && dias !== null && dias <= 7 && (
                          <span className="ac-deadline soon" style={{ marginLeft: 6 }}>{dias === 0 ? 'Hoje' : `vence em ${dias}d`}</span>
                        )}
                      </td>
                      <td><span className={`badge ${meta.badge}`}>{meta.label}</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
