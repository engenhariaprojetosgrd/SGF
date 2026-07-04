'use client'
import { Fragment, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Acao, Agressor, RAF, Equipamento } from '@/lib/types'

function diasAte(data: string | null | undefined) {
  if (!data) return null
  const d = new Date(data); const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  return Math.round((d.getTime() - hoje.getTime()) / 86400000)
}
function fmtData(d: string | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' })
}
const gerarCodigo = (p: string) => p + '-' + new Date().getFullYear() + '-' + Date.now().toString().slice(-6)

const ORIGEM_META: Record<string, { label: string; cls: string }> = {
  raf:        { label: 'RAF',        cls: 'badge-raf' },
  agressor:   { label: 'Agressor',   cls: 'badge-agressor' },
  gatilho_df: { label: 'Gatilho DF', cls: 'badge-warning' },
  manual:     { label: 'Manual',     cls: 'badge-gray' },
}
type MacroStatus = 'atrasada' | 'andamento' | 'concluida'
const ST_META: Record<MacroStatus, { label: string; badge: string }> = {
  atrasada:  { label: 'Atrasada',     badge: 'badge-danger' },
  andamento: { label: 'Em Andamento', badge: 'badge-blue' },
  concluida: { label: 'Concluída',    badge: 'badge-success' },
}
type Macro = {
  key: string; origem: string; codigo: string | null; frota: string; descricao: string
  responsavel: string; prazoMax: string | null; acoes: Acao[]; status: MacroStatus
}

function microStatus(a: Acao): MacroStatus {
  if (a.status === 'concluida') return 'concluida'
  const d = diasAte(a.prazo)
  if (d !== null && d < 0) return 'atrasada'
  return 'andamento'
}

export default function AcoesPage() {
  const [acoes, setAcoes] = useState<Acao[]>([])
  const [agr, setAgr] = useState<Agressor[]>([])
  const [rafs, setRafs] = useState<RAF[]>([])
  const [equip, setEquip] = useState<Equipamento[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<'todas' | MacroStatus>('todas')
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ descricao: '', responsavel: '', prazo: '', tipo: 'Corretiva Estrutural', equipamento_tag: '' })
  const [saving, setSaving] = useState(false)
  const [origemNova, setOrigemNova] = useState<'gatilho_df' | 'manual'>('manual')

  useEffect(() => { carregar() }, [])
  async function carregar() {
    const [acRes, agRes, rRes, eRes] = await Promise.all([
      supabase.from('acoes').select('*').order('prazo'),
      supabase.from('agressores').select('*'),
      supabase.from('rafs').select('*'),
      supabase.from('equipamentos').select('id,tag,categoria'),
    ])
    setAcoes((acRes.data ?? []) as Acao[])
    setAgr((agRes.data ?? []) as Agressor[])
    setRafs((rRes.data ?? []) as RAF[])
    setEquip((eRes.data ?? []) as Equipamento[])
    setLoading(false)
  }
  useEffect(() => { if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('novo')) { setOrigemNova('gatilho_df'); setShowModal(true) } }, [])

  const catByTag = useMemo(() => { const m: Record<string, string> = {}; equip.forEach(e => { m[e.tag] = e.categoria }); return m }, [equip])
  const agrById = useMemo(() => { const m: Record<string, Agressor> = {}; agr.forEach(a => { m[a.id] = a }); return m }, [agr])
  const rafById = useMemo(() => { const m: Record<string, RAF> = {}; rafs.forEach(r => { m[r.id] = r }); return m }, [rafs])

  const macros = useMemo<Macro[]>(() => {
    const groups: Record<string, Acao[]> = {}
    for (const a of acoes) {
      const k = a.codigo ? 'c:' + a.codigo : a.raf_id ? 'r:' + a.raf_id : a.agressor_id ? 'a:' + a.agressor_id : 'i:' + a.id
      ;(groups[k] ??= []).push(a)
    }
    return Object.entries(groups).map(([key, list]) => {
      const first = list[0]
      const origem = first.origem ?? (first.raf_id ? 'raf' : first.agressor_id ? 'agressor' : 'manual')
      const ag = first.agressor_id ? agrById[first.agressor_id] : undefined
      const rf = first.raf_id ? rafById[first.raf_id] : undefined
      const descricao = ag ? (ag.agressor ?? ag.descricao) : rf ? (rf.descricao_falha ?? 'RAF') : first.descricao
      const frota = ag ? (ag.frota ?? '—') : first.equipamento_tag ? (catByTag[first.equipamento_tag] ?? first.equipamento_tag) : '—'
      const responsavel = list.map(x => x.responsavel).find(r => r && r !== '—') ?? '—'
      const prazos = list.map(x => x.prazo).filter(Boolean) as string[]
      const prazoMax = prazos.length ? prazos.sort().slice(-1)[0] : null
      const todasConcl = list.every(x => x.status === 'concluida')
      const algumaAtrasada = list.some(x => microStatus(x) === 'atrasada')
      const status: MacroStatus = todasConcl ? 'concluida' : algumaAtrasada ? 'atrasada' : 'andamento'
      return { key, origem, codigo: first.codigo ?? null, frota, descricao, responsavel, prazoMax, acoes: list, status }
    }).sort((p, q) => ({ atrasada: 0, andamento: 1, concluida: 2 }[p.status] - { atrasada: 0, andamento: 1, concluida: 2 }[q.status]))
  }, [acoes, agrById, rafById, catByTag])

  const cont = {
    atrasada: macros.filter(m => m.status === 'atrasada').length,
    andamento: macros.filter(m => m.status === 'andamento').length,
    concluida: macros.filter(m => m.status === 'concluida').length,
  }
  const lista = macros.filter(m => filtro === 'todas' || m.status === filtro)

  async function toggleAcao(a: Acao) {
    const concl = a.status === 'concluida'
    const patch = concl ? { status: 'em_andamento', dt_conclusao: null } : { status: 'concluida', dt_conclusao: new Date().toISOString().slice(0, 10) }
    const { data } = await supabase.from('acoes').update(patch).eq('id', a.id).select().single()
    if (data) setAcoes(prev => prev.map(x => x.id === a.id ? (data as Acao) : x))
  }

  async function salvarAcao() {
    if (!form.descricao.trim()) return
    setSaving(true)
    const codigo = gerarCodigo(origemNova === 'gatilho_df' ? 'DF' : 'PA')
    const { data } = await supabase.from('acoes').insert({ descricao: form.descricao, responsavel: form.responsavel || '—', prazo: form.prazo || null, tipo: form.tipo, equipamento_tag: form.equipamento_tag || null, status: 'pendente', origem: origemNova, codigo }).select().single()
    if (data) setAcoes(prev => [...prev, data as Acao])
    setSaving(false); setShowModal(false); setOrigemNova('manual')
    setForm({ descricao: '', responsavel: '', prazo: '', tipo: 'Corretiva Estrutural', equipamento_tag: '' })
  }

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div className="page-title">✅ Plano de Ação</div>
          <div className="page-sub">Planos por ocorrência — clique para ver o checklist de ações</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="badge badge-danger">{cont.atrasada} atrasadas</span>
          <span className="badge badge-blue">{cont.andamento} em andamento</span>
          <span className="badge badge-success">{cont.concluida} concluídas</span>
          <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>＋ Nova Ação</button>
        </div>
      </div>

      <div className="period-selector" style={{ marginBottom: 16 }}>
        {([['todas', `Todas (${macros.length})`], ['atrasada', `Atrasadas (${cont.atrasada})`], ['andamento', `Em Andamento (${cont.andamento})`], ['concluida', `Concluídas (${cont.concluida})`]] as const).map(([k, lbl]) => (
          <button key={k} className={`period-btn ${filtro === k ? 'active' : ''}`} onClick={() => setFiltro(k)}>{lbl}</button>
        ))}
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="card-hd">
          <span className="card-title">📋 Planos de Ação</span>
          <span className="text-xs text-muted">{lista.length} plano{lista.length !== 1 ? 's' : ''}</span>
        </div>

        {loading ? (
          <div className="empty-state" style={{ padding: 48 }}><div className="empty-state-icon">⏳</div><div className="empty-state-sub">Carregando...</div></div>
        ) : lista.length === 0 ? (
          <div className="empty-state" style={{ padding: 48 }}><div className="empty-state-icon">📋</div><div className="empty-state-title">Nenhum plano</div><div className="empty-state-sub">As ações aparecerão aqui conforme forem cadastradas</div></div>
        ) : (
          <div className="tbl-wrap">
            <table>
              <thead><tr><th style={{ width: 28 }}></th><th>Origem</th><th>Frota</th><th>Descrição</th><th>Responsável</th><th>Prazo</th><th>Progresso</th><th>Status</th></tr></thead>
              <tbody>
                {lista.map(m => {
                  const done = m.acoes.filter(a => a.status === 'concluida').length
                  const pct = m.acoes.length ? Math.round(done / m.acoes.length * 100) : 0
                  const om = ORIGEM_META[m.origem] ?? ORIGEM_META.manual
                  const sm = ST_META[m.status]
                  const aberto = !!expanded[m.key]
                  const dias = diasAte(m.prazoMax)
                  return (
                    <Fragment key={m.key}>
                      <tr className="clickable" onClick={() => setExpanded(e => ({ ...e, [m.key]: !e[m.key] }))}>
                        <td style={{ color: 'var(--text-muted)' }}>{aberto ? '▾' : '▸'}</td>
                        <td><div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}><span className={'badge ' + om.cls}>{om.label}</span>{m.codigo && <span className="text-xs text-muted">{m.codigo}</span>}</div></td>
                        <td className="text-sm">{m.frota}</td>
                        <td style={{ maxWidth: 300 }}><div className="fw-600 text-sm">{m.descricao}</div></td>
                        <td className="text-sm">{m.responsavel}</td>
                        <td className="text-xs">{fmtData(m.prazoMax)}{m.status === 'atrasada' && dias !== null && <span className="ac-deadline late" style={{ marginLeft: 6 }}>{Math.abs(dias)}d</span>}</td>
                        <td style={{ minWidth: 90 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div className="pb-wrap" style={{ flex: 1 }}><div className={'pb ' + (pct === 100 ? 'success' : pct > 0 ? 'warning' : '')} style={{ width: pct + '%' }} /></div>
                            <span className="text-xs text-muted">{done}/{m.acoes.length}</span>
                          </div>
                        </td>
                        <td><span className={`badge ${sm.badge}`}>{sm.label}</span></td>
                      </tr>
                      {aberto && (
                        <tr>
                          <td colSpan={8} style={{ background: 'var(--gray-50)', padding: '10px 16px 14px' }}>
                            <div className="text-xs fw-700 text-muted" style={{ margin: '2px 0 8px' }}>CHECKLIST DE AÇÕES</div>
                            {m.acoes.map(a => {
                              const ok = a.status === 'concluida'
                              const stt = microStatus(a)
                              return (
                                <div key={a.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 6, background: ok ? 'var(--success-light)' : 'var(--card-bg)' }}>
                                  <input type="checkbox" checked={ok} onChange={() => toggleAcao(a)} style={{ marginTop: 3, width: 17, height: 17, cursor: 'pointer', flexShrink: 0 }} />
                                  <div style={{ flex: 1 }}>
                                    <div className="text-sm" style={{ textDecoration: ok ? 'line-through' : 'none', opacity: ok ? .6 : 1 }}>{a.descricao}</div>
                                    <div className="text-xs text-muted mt4">{a.responsavel || '—'}{a.prazo ? ' · prazo ' + fmtData(a.prazo) : ''}{ok && a.dt_conclusao ? ' · concluída ' + fmtData(a.dt_conclusao) : ''}</div>
                                  </div>
                                  <span className={`badge ${ST_META[stt].badge}`} style={{ flexShrink: 0 }}>{ST_META[stt].label}</span>
                                </div>
                              )
                            })}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setShowModal(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--card-bg)', borderRadius: 12, width: '100%', maxWidth: 520, boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
            <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 700, fontSize: 15 }}>✅ Nova Ação do Plano</span>
              <button className="btn btn-ghost btn-xs" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div style={{ padding: 24 }}>
              <div className="form-group"><label className="form-label">Descrição da Ação <span style={{ color: 'var(--danger)' }}>*</span></label><textarea className="form-control" rows={2} placeholder="O que será feito..." value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} /></div>
              <div className="form-row form-group">
                <div><label className="form-label">Responsável</label><input className="form-control" placeholder="Nome" value={form.responsavel} onChange={e => setForm(f => ({ ...f, responsavel: e.target.value }))} /></div>
                <div><label className="form-label">Prazo</label><input type="date" className="form-control" value={form.prazo} onChange={e => setForm(f => ({ ...f, prazo: e.target.value }))} /></div>
              </div>
              <div className="form-row form-group">
                <div><label className="form-label">Tipo</label><select className="form-control" value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}><option>Corretiva Imediata</option><option>Corretiva Estrutural</option><option>Preventiva</option><option>Melhoria de Processo</option></select></div>
                <div><label className="form-label">Equipamento (opcional)</label><input className="form-control" placeholder="Ex: 9401" value={form.equipamento_tag} onChange={e => setForm(f => ({ ...f, equipamento_tag: e.target.value }))} /></div>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className="btn btn-outline" onClick={() => setShowModal(false)}>Cancelar</button>
                <button className="btn btn-primary" onClick={salvarAcao} disabled={saving || !form.descricao.trim()}>{saving ? 'Salvando...' : '✓ Salvar Ação'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
