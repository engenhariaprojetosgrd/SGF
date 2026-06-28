'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { OrdemManutencao, Equipamento } from '@/lib/types'

const TURNOS = ['A', 'B', 'C', 'D']

function norm(s: string | null | undefined) {
  return (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/\s+/g, '_')
}

type ColKey = 'pendente' | 'em_execucao' | 'aguardando_peca' | 'concluido'

const COLUNAS: {
  key: ColKey; match: string[]; label: string; dot: string; bg: string; action: { label: string; cls: string }
}[] = [
  { key: 'pendente',        match: ['pendente'],                   label: 'Pendente',    dot: 'var(--gray-400)', bg: '#f9fafb', action: { label: 'Iniciar', cls: 'btn-outline' } },
  { key: 'em_execucao',     match: ['em_execucao', 'em_execucao'], label: 'Em Execucao', dot: 'var(--primary)',  bg: '#eff6ff', action: { label: 'Concluir', cls: 'btn-success' } },
  { key: 'aguardando_peca', match: ['aguardando_peca', 'ag_peca'], label: 'Ag. Peca',    dot: '#7c3aed',         bg: '#f5f3ff', action: { label: 'Detalhar', cls: 'btn-outline' } },
  { key: 'concluido',       match: ['concluido', 'concluida'],     label: 'Concluida',   dot: 'var(--success)',  bg: '#f0fdf4', action: { label: 'Ver OM', cls: 'btn-ghost' } },
]

function critClass(c: string | null | undefined) {
  const n = norm(c)
  if (n.startsWith('critic')) return 'k-critico'
  if (n.startsWith('alta')) return 'k-alta'
  return ''
}

function tipoBadge(t: string | null | undefined) {
  const n = norm(t)
  const cls = n.startsWith('corretiva') ? 'badge-danger'
    : n.startsWith('preventiva') ? 'badge-warning'
    : n.startsWith('preditiva') ? 'badge-blue'
    : n.startsWith('melhoria') ? 'badge-success'
    : 'badge-gray'
  return <span className={'badge ' + cls}>{t ?? 'OM'}</span>
}

function headerBadge(om: OrdemManutencao) {
  if (norm(om.criticidade).startsWith('critic')) return <span className="badge badge-danger">CRITICO</span>
  return tipoBadge(om.tipo)
}

export default function KanbanPage() {
  const [turno, setTurno] = useState('A')
  const [oms, setOms] = useState<OrdemManutencao[]>([])
  const [equip, setEquip] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const hoje = new Date().toISOString().slice(0, 10)

  useEffect(() => {
    supabase.from('equipamentos').select('tag,modelo').then(({ data }) => {
      const map: Record<string, string> = {}
      const rows = (data ?? []) as Pick<Equipamento, 'tag' | 'modelo'>[]
      rows.forEach(e => { map[e.tag] = e.modelo })
      setEquip(map)
    })
  }, [])

  useEffect(() => {
    setLoading(true)
    supabase.from('ordens_manutencao').select('*').eq('turno', turno)
      .order('created_at', { ascending: false })
      .then(({ data }) => { setOms((data ?? []) as OrdemManutencao[]); setLoading(false) })
  }, [turno])

  const colOf = (om: OrdemManutencao): ColKey | null => {
    const n = norm(om.status)
    const col = COLUNAS.find(c => c.match.includes(n))
    return col ? col.key : null
  }
  const porCol = (key: ColKey) => oms.filter(o => colOf(o) === key)

  const total = oms.length
  const concl = porCol('concluido').length
  const emExec = porCol('em_execucao').length
  const pend = porCol('pendente').length
  const agPeca = porCol('aguardando_peca').length
  const criticos = oms.filter(o => norm(o.criticidade).startsWith('critic')).length

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div className="page-title">🗂️ Kanban do Turno</div>
          <div className="page-sub">Acompanhamento em tempo real das atividades de manutenção</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="period-selector">
            {TURNOS.map(t => (
              <button key={t} className={'period-btn ' + (turno === t ? 'active' : '')} onClick={() => setTurno(t)}>Turno {t}</button>
            ))}
          </div>
          <span className="text-xs text-muted">{hoje}</span>
          <a href="/historico" className="btn btn-outline btn-sm">📂 Histórico</a>
          <a href="/atividade/nova" className="btn btn-primary btn-sm">＋ Nova Atividade</a>
        </div>
      </div>

      <div className="fleet-summary-strip">
        <div className="fsum-card total"><div className="fsum-num">{total}</div><div className="fsum-label">Total OMs</div></div>
        <div className="fsum-card ok"><div className="fsum-num">{concl}</div><div className="fsum-label">Concluídas</div></div>
        <div className="fsum-card primary" style={{ borderTopColor: 'var(--primary)' }}><div className="fsum-num" style={{ color: 'var(--primary)' }}>{emExec}</div><div className="fsum-label">Em Execução</div></div>
        <div className="fsum-card gray"><div className="fsum-num">{pend}</div><div className="fsum-label">Pendentes</div></div>
        <div className="fsum-card amber"><div className="fsum-num">{agPeca}</div><div className="fsum-label">Ag. Peça</div></div>
        <div className="fsum-card danger"><div className="fsum-num">{criticos}</div><div className="fsum-label">Críticas</div></div>
      </div>

      {loading ? (
        <div className="empty-state"><div className="empty-state-icon">⏳</div><div className="empty-state-sub">Carregando Turno {turno}...</div></div>
      ) : (
        <div className="kanban-board">
          {COLUNAS.map(col => {
            const cards = porCol(col.key)
            return (
              <div key={col.key} className="kanban-col" style={{ background: col.bg }}>
                <div className="kanban-col-hd">
                  <span className="kanban-dot" style={{ background: col.dot }} />
                  <span className="kanban-col-title">{col.label}</span>
                  <span className="kanban-count" style={{ background: col.dot }}>{cards.length}</span>
                </div>
                {cards.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '32px 8px', color: 'var(--gray-400)', fontSize: 12 }}>Nenhuma OM</div>
                ) : (
                  cards.map(om => {
                    const modelo = om.equipamento_tag ? equip[om.equipamento_tag] : undefined
                    return (
                      <div key={om.id} className={'kanban-card ' + critClass(om.criticidade)}>
                        <div className="kanban-card-hd">
                          {headerBadge(om)}
                          <span className="text-xs text-muted">{om.numero_om ?? ('OM-' + String(om.id).slice(0, 6))}</span>
                        </div>
                        <div className="kanban-card-equip">{om.equipamento_tag ?? '—'}{modelo ? ' · ' + modelo : ''}</div>
                        {om.sintoma ? <div className="kanban-card-desc">{om.sintoma}</div> : null}
                        <div className="kanban-card-meta">
                          {om.executantes ? <span>👷 {om.executantes}</span> : null}
                          {om.hh_executado != null ? <span>⏱ {om.hh_executado}h</span> : null}
                        </div>
                        <div className="kanban-card-footer">
                          <span className="text-xs text-muted">{om.sistema ?? '—'}</span>
                          <a href="/atividade/nova" className={'btn ' + col.action.cls + ' btn-xs'}>{col.action.label}</a>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
