'use client'
import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import type { OrdemManutencao } from '@/lib/types'

function norm(s: string | null | undefined) {
  return (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/\s+/g, '_')
}
function diaKey(o: OrdemManutencao) { return (o.dt_conclusao ?? o.created_at ?? '').slice(0, 10) }
function fmtDia(d: string) { if (!d) return '—'; const p = d.split('-'); return `${p[2]}/${p[1]}/${p[0]}` }
function fmtHora(d: string | null | undefined) { return d ? new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '' }

function statusBadge(s: string | null | undefined) {
  const n = norm(s)
  if (n.startsWith('conclui')) return <span className="badge badge-success">Concluído</span>
  if (n.startsWith('em_exec')) return <span className="badge badge-blue">Em Execução</span>
  if (n.startsWith('aguardando') || n.startsWith('ag_peca')) return <span className="badge badge-purple">Ag. Peça</span>
  if (n.startsWith('cancel')) return <span className="badge badge-gray">Cancelado</span>
  return <span className="badge badge-gray">Pendente</span>
}
function statusDot(s: string | null | undefined) {
  const n = norm(s)
  if (n.startsWith('conclui')) return 'var(--success)'
  if (n.startsWith('em_exec')) return 'var(--warning)'
  if (n.startsWith('aguardando') || n.startsWith('ag_peca')) return '#7c3aed'
  return 'var(--gray-400)'
}
function tipoBadge(t: string | null | undefined) {
  const n = norm(t)
  const cls = n.startsWith('preventiva') ? 'badge-success' : n.startsWith('preditiva') ? 'badge-blue' : n.startsWith('melhoria') ? 'badge-primary' : 'badge-warning'
  return <span className={'badge ' + cls}>{t ?? 'Corretiva'}</span>
}

export default function CorretivaPage() {
  const [oms, setOms] = useState<OrdemManutencao[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [tipo, setTipo] = useState('')
  const [periodo, setPeriodo] = useState('todos')
  const [sev, setSev] = useState('')
  const [openDays, setOpenDays] = useState<Record<string, boolean>>({})
  const [openOms, setOpenOms] = useState<Record<string, boolean>>({})

  useEffect(() => {
    supabase.from('ordens_manutencao').select('*').order('created_at', { ascending: false }).then(({ data }) => {
      setOms((data ?? []) as OrdemManutencao[]); setLoading(false)
    })
  }, [])

  const filtradas = useMemo(() => {
    let lista = [...oms]
    if (busca) {
      const q = busca.toLowerCase()
      lista = lista.filter(o => o.equipamento_tag?.toLowerCase().includes(q) || o.sintoma?.toLowerCase().includes(q) || o.executantes?.toLowerCase().includes(q) || o.sistema?.toLowerCase().includes(q) || o.numero_om?.toLowerCase().includes(q))
    }
    if (tipo) lista = lista.filter(o => norm(o.tipo).startsWith(tipo))
    if (sev) lista = lista.filter(o => norm(o.criticidade).startsWith(sev))
    if (periodo !== 'todos') {
      const dias = periodo === '7d' ? 7 : periodo === '30d' ? 30 : 90
      const lim = new Date(); lim.setDate(lim.getDate() - dias)
      lista = lista.filter(o => o.created_at && new Date(o.created_at) >= lim)
    }
    return lista
  }, [oms, busca, tipo, periodo, sev])

  const total = filtradas.length
  const concluidas = filtradas.filter(o => norm(o.status).startsWith('conclui')).length
  const mttr = (() => {
    const c = filtradas.filter(o => o.hh_executado && o.hh_executado > 0)
    return c.length ? c.reduce((s, o) => s + (o.hh_executado ?? 0), 0) / c.length : null
  })()
  const criticas = filtradas.filter(o => norm(o.criticidade).startsWith('critic')).length

  const grupos = useMemo(() => {
    const map: Record<string, OrdemManutencao[]> = {}
    filtradas.forEach(o => { const k = diaKey(o); (map[k] = map[k] ?? []).push(o) })
    return Object.keys(map).sort((a, b) => b.localeCompare(a)).map(dia => ({ dia, oms: map[dia] }))
  }, [filtradas])

  const dayOpen = (dia: string, idx: number) => openDays[dia] ?? (idx === 0)

  function exportCSV() {
    const head = ['OM', 'Data', 'Turno', 'Equipamento', 'Tipo', 'Sistema', 'Sintoma', 'Causa', 'Intervencao', 'Executantes', 'HH', 'Status']
    const linhas = filtradas.map(o => [o.numero_om ?? o.id, diaKey(o), o.turno, o.equipamento_tag, o.tipo, o.sistema, o.sintoma, o.causa, o.intervencao, o.executantes, o.hh_executado, o.status]
      .map(v => '"' + String(v ?? '').replace(/"/g, '""') + '"').join(';'))
    const csv = [head.join(';'), ...linhas].join('\n')
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a'); a.href = url; a.download = 'historico_corretiva.csv'; a.click(); URL.revokeObjectURL(url)
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-title">📋 Histórico Corretiva</div>
        <div className="page-sub">Histórico completo de ordens de manutenção — agrupado por dia</div>
      </div>

      <div className="card mb20" style={{ padding: 0 }}>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 12, alignItems: 'end' }}>
            <div className="form-group" style={{ marginBottom: 0 }}><label className="form-label">Buscar</label><input className="form-control" placeholder="Tag, OM, sintoma, sistema, executante..." value={busca} onChange={e => setBusca(e.target.value)} /></div>
            <div className="form-group" style={{ marginBottom: 0 }}><label className="form-label">Período</label>
              <select className="form-control" value={periodo} onChange={e => setPeriodo(e.target.value)}><option value="todos">Todo histórico</option><option value="7d">Últimos 7 dias</option><option value="30d">Últimos 30 dias</option><option value="90d">Últimos 90 dias</option></select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}><label className="form-label">Tipo</label>
              <select className="form-control" value={tipo} onChange={e => setTipo(e.target.value)}><option value="">Todos os tipos</option><option value="corretiva">Corretiva</option><option value="preventiva">Preventiva</option><option value="preditiva">Preditiva</option><option value="melhoria">Melhoria</option></select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}><label className="form-label">Severidade</label>
              <select className="form-control" value={sev} onChange={e => setSev(e.target.value)}><option value="">Toda severidade</option><option value="critic">Crítica</option><option value="alta">Alta</option><option value="media">Média</option><option value="baixa">Baixa</option></select>
            </div>
          </div>
        </div>
      </div>

      <div className="grid g4 mb20">
        <div className="sum-card primary"><div className="sum-label">OMs Encontradas</div><div className="sum-value">{total}</div><div className="sum-sub">com filtros aplicados</div></div>
        <div className="sum-card success"><div className="sum-label">Concluídas</div><div className="sum-value">{concluidas}</div><div className="sum-sub">{total ? Math.round(concluidas / total * 100) : 0}% do total</div></div>
        <div className="sum-card warning"><div className="sum-label">MTTR Médio</div><div className="sum-value">{mttr ? mttr.toFixed(1) : '—'}{mttr ? <span style={{ fontSize: 16, fontWeight: 400 }}>h</span> : ''}</div><div className="sum-sub">Tempo médio de reparo</div></div>
        <div className={'sum-card ' + (criticas > 0 ? 'danger' : 'gray')}><div className="sum-label">Severidade Crítica</div><div className="sum-value">{criticas}</div><div className="sum-sub">ordens críticas</div></div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="card-hd">
          <span className="card-title">Ocorrências por Dia</span>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <button className="btn btn-ghost btn-xs" onClick={() => setOpenDays(Object.fromEntries(grupos.map(g => [g.dia, true])))}>Expandir todos</button>
            <button className="btn btn-ghost btn-xs" onClick={() => setOpenDays(Object.fromEntries(grupos.map(g => [g.dia, false])))}>Recolher todos</button>
            <button className="btn btn-outline btn-sm" onClick={exportCSV} disabled={!total}>⬇ CSV ({total})</button>
          </div>
        </div>

        {loading ? (
          <div className="empty-state" style={{ padding: 48 }}><div className="empty-state-icon">⏳</div><div className="empty-state-sub">Carregando...</div></div>
        ) : grupos.length === 0 ? (
          <div className="empty-state" style={{ padding: 48 }}><div className="empty-state-icon">📋</div><div className="empty-state-title">Nenhuma OM encontrada</div><div className="empty-state-sub">{busca || tipo || sev ? 'Tente ajustar os filtros' : 'Nenhuma ordem registrada ainda'}</div></div>
        ) : (
          <div style={{ padding: 12 }}>
            {grupos.map((g, idx) => {
              const aberto = dayOpen(g.dia, idx)
              return (
                <div key={g.dia} style={{ border: '1px solid var(--gray-200)', borderRadius: 8, marginBottom: 10, overflow: 'hidden' }}>
                  <div onClick={() => setOpenDays(d => ({ ...d, [g.dia]: !aberto }))} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--gray-50)', cursor: 'pointer' }}>
                    <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>{aberto ? '▾' : '▸'}</span>
                    <span style={{ fontSize: 14 }}>📅</span>
                    <span className="fw-700">{fmtDia(g.dia)}</span>
                    <span className="text-xs text-muted">({g.oms.length} OM{g.oms.length !== 1 ? 's' : ''})</span>
                  </div>
                  {aberto && (
                    <div>
                      {g.oms.map(om => {
                        const omAberto = openOms[om.id]
                        return (
                          <div key={om.id} style={{ borderTop: '1px solid var(--gray-100)' }}>
                            <div onClick={() => setOpenOms(s => ({ ...s, [om.id]: !omAberto }))} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', cursor: 'pointer' }}>
                              <span style={{ width: 8, height: 8, borderRadius: '50%', background: statusDot(om.status), flexShrink: 0 }} />
                              <span className="fw-700">{om.numero_om ?? ('OM-' + String(om.id).slice(0, 6))}</span>
                              {statusBadge(om.status)}
                              {om.turno && <span className="text-xs text-muted">Turno {om.turno}</span>}
                              <span style={{ flex: 1 }} className="text-sm" >{[om.sistema, om.subsistema].filter(Boolean).join(' / ')}{om.sintoma ? ' · ' + om.sintoma : ''}</span>
                              <span className="text-xs text-muted">{fmtHora(om.dt_conclusao ?? om.created_at)}</span>
                              <span style={{ fontSize: 12, color: 'var(--gray-400)' }}>{omAberto ? '▲' : '▼'}</span>
                            </div>
                            {omAberto && (
                              <div style={{ padding: '4px 16px 16px 34px', background: 'var(--gray-50)', fontSize: 13, color: 'var(--gray-700)', lineHeight: 1.6 }}>
                                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 8 }}>
                                  {tipoBadge(om.tipo)}
                                  {om.criticidade && <span className="text-xs text-muted">Criticidade: {om.criticidade}</span>}
                                  {om.equipamento_tag && <span className="text-xs text-muted">Equip: {om.equipamento_tag}</span>}
                                  {om.hh_executado != null && <span className="text-xs text-muted">HH: {om.hh_executado}h</span>}
                                </div>
                                {om.causa && <div style={{ marginBottom: 4 }}><b style={{ color: 'var(--gray-600)' }}>Causa presumida:</b> {om.causa}</div>}
                                {om.intervencao && <div style={{ marginBottom: 4 }}><b style={{ color: 'var(--gray-600)' }}>Intervenção:</b> {om.intervencao}</div>}
                                {om.observacoes && <div style={{ marginBottom: 4 }}><b style={{ color: 'var(--gray-600)' }}>Descrição:</b> {om.observacoes}</div>}
                                {om.executantes && <div style={{ marginTop: 6, color: 'var(--success)' }}><b>Executantes:</b> {om.executantes}</div>}
                                {!om.causa && !om.intervencao && !om.observacoes && <div className="text-muted">Sem detalhes adicionais registrados.</div>}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
