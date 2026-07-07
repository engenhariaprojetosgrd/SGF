'use client'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { OrdemManutencao, Equipamento } from '@/lib/types'

type DFEq = { equipamento_tag: string; tipo_periodo: string; data_referencia: string; valor: number }

function norm(s: string | null | undefined) {
  return (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[-_\s]/g, '')
}
function statusInfo(o: OrdemManutencao): { label: string; bg: string; color: string } {
  const n = norm(o.status)
  if (n === 'aguardandopeca') return { label: 'Ag. Peça', bg: '#fffbeb', color: '#92400e' }
  if (n === 'emexecucao') return { label: 'Em Execução', bg: '#eff6ff', color: '#1e40af' }
  if (norm(o.tipo).startsWith('corretiva')) return { label: 'Corretiva', bg: '#fff7ed', color: '#c2410c' }
  return { label: 'Pendente', bg: '#f3f4f6', color: '#4b5563' }
}
function fmtData(d: string | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}
const hojeISO = () => new Date().toISOString().slice(0, 10)

export default function DiarioBordoPage() {
  const [oms, setOms] = useState<OrdemManutencao[]>([])
  const [equip, setEquip] = useState<Equipamento[]>([])
  const [dfEq, setDfEq] = useState<DFEq[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroFrota, setFiltroFrota] = useState('todas')
  const [frotaMenu, setFrotaMenu] = useState(false)
  const [sel, setSel] = useState<OrdemManutencao | null>(null)
  const [prazo, setPrazo] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { carregar() }, [])
  async function carregar() {
    const [oRes, eRes, dRes] = await Promise.all([
      supabase.from('ordens_manutencao').select('*').not('status', 'in', '("concluido","cancelado")').order('dt_abertura', { ascending: true }),
      supabase.from('equipamentos').select('id,tag,modelo,categoria'),
      supabase.from('df_equip').select('equipamento_tag,tipo_periodo,data_referencia,valor').eq('metrica', 'df'),
    ])
    setOms((oRes.data ?? []) as OrdemManutencao[])
    setEquip((eRes.data ?? []) as Equipamento[])
    setDfEq((dRes.data ?? []) as DFEq[])
    setLoading(false)
  }

  const equipByTag = useMemo(() => { const m: Record<string, Equipamento> = {}; equip.forEach(e => { m[e.tag] = e }); return m }, [equip])
  const catOf = (o: OrdemManutencao) => o.equipamento_tag ? (equipByTag[o.equipamento_tag]?.categoria ?? '—') : '—'
  const dfDoEquip = (tag: string) => {
    const arr = dfEq.filter(d => d.equipamento_tag === tag && d.tipo_periodo === 'mensal')
      .sort((a, b) => a.data_referencia.localeCompare(b.data_referencia))
    return arr.length ? arr[arr.length - 1].valor : null
  }

  const frotas = useMemo(() => [...new Set(oms.map(catOf).filter(f => f !== '—'))].sort(), [oms, equipByTag])
  const lista = useMemo(() => filtroFrota === 'todas' ? oms : oms.filter(o => catOf(o) === filtroFrota), [oms, filtroFrota, equipByTag])

  function abrir(o: OrdemManutencao) { setSel(o); setPrazo(o.prazo_liberacao ? o.prazo_liberacao.slice(0, 10) : '') }

  async function salvarPrazo() {
    if (!sel) return
    setSaving(true)
    const { data } = await supabase.from('ordens_manutencao').update({ prazo_liberacao: prazo || null }).eq('id', sel.id).select().single()
    setSaving(false)
    if (data) { setOms(prev => prev.map(o => o.id === sel.id ? (data as OrdemManutencao) : o)); setSel(data as OrdemManutencao) }
  }

  async function liberar(o: OrdemManutencao) {
    setSaving(true)
    await supabase.from('ordens_manutencao').update({ status: 'concluido', dt_conclusao: hojeISO() }).eq('id', o.id)
    if (o.equipamento_tag) await supabase.from('equipamentos').update({ status: 'operando' }).eq('tag', o.equipamento_tag)
    setSaving(false)
    setOms(prev => prev.filter(x => x.id !== o.id))
    setSel(null)
  }

  if (loading) return (
    <div><div className="empty-state"><div className="empty-state-icon">⏳</div><div className="empty-state-sub">Carregando...</div></div></div>
  )

  return (
    <div>
      <div className="page-header">
        <div className="page-title">📔 Diário de Bordo</div>
        <div className="page-sub">Equipamentos parados no turno — DF, falha e prazo de liberação</div>
      </div>

      {/* Filtro por frota */}
      <div style={{ position: 'relative', display: 'inline-block', marginBottom: 16 }}>
        <button className="btn btn-outline btn-sm" onClick={() => setFrotaMenu(o => !o)}>
          🚜 Frota: <b style={{ marginLeft: 4 }}>{filtroFrota === 'todas' ? 'Todas' : filtroFrota}</b> <span style={{ marginLeft: 6 }}>▾</span>
        </button>
        {frotaMenu && (
          <>
            <div onClick={() => setFrotaMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 19 }} />
            <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,.14)', zIndex: 20, minWidth: 240, overflow: 'hidden', padding: 4 }}>
              {['todas', ...frotas].map(fr => (
                <div key={fr} onClick={() => { setFiltroFrota(fr); setFrotaMenu(false) }}
                  style={{ padding: '9px 12px', cursor: 'pointer', fontSize: 13, borderRadius: 6, fontWeight: filtroFrota === fr ? 700 : 400, background: filtroFrota === fr ? 'var(--primary-light)' : 'transparent', color: filtroFrota === fr ? 'var(--primary)' : 'var(--text)' }}>
                  {fr === 'todas' ? 'Todas as frotas' : fr}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {lista.length === 0 ? (
        <div className="card"><div className="empty-state" style={{ padding: 48 }}>
          <div className="empty-state-icon">✅</div>
          <div className="empty-state-title">Nenhum equipamento parado</div>
          <div className="empty-state-sub">Nada pendente no Kanban para esta frota</div>
        </div></div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
          {lista.map(o => {
            const eq = o.equipamento_tag ? equipByTag[o.equipamento_tag] : undefined
            const si = statusInfo(o)
            const df = o.equipamento_tag ? dfDoEquip(o.equipamento_tag) : null
            return (
              <div key={o.id} onClick={() => abrir(o)} className="card" style={{ padding: 0, cursor: 'pointer', overflow: 'hidden', borderTop: `4px solid ${si.color}` }}>
                <div style={{ padding: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: 17, fontWeight: 800 }}>{o.equipamento_tag ?? '—'}</div>
                      <div className="text-xs text-muted">{eq?.modelo ?? ''}</div>
                    </div>
                    <span className="badge" style={{ background: si.bg, color: si.color }}>{si.label}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--gray-100)' }}>
                    <div>
                      <div className="text-xs text-muted" style={{ fontWeight: 700 }}>DF MÊS</div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: df != null && df < 85 ? 'var(--danger)' : 'var(--success)' }}>{df != null ? df.toFixed(1) + '%' : '—'}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div className="text-xs text-muted" style={{ fontWeight: 700 }}>LIBERAÇÃO</div>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{o.prazo_liberacao ? fmtData(o.prazo_liberacao) : 'a definir'}</div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal detalhe */}
      {sel && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setSel(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--card-bg)', borderRadius: 14, width: '100%', maxWidth: 480, boxShadow: '0 20px 60px rgba(0,0,0,.25)', overflow: 'hidden' }}>
            <div style={{ padding: '18px 24px', background: 'linear-gradient(135deg, var(--primary), #1e3a8a)', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 800 }}>{sel.equipamento_tag ?? '—'}</div>
                <div style={{ fontSize: 12, opacity: .85 }}>{sel.equipamento_tag ? (equipByTag[sel.equipamento_tag]?.modelo ?? '') : ''} · {catOf(sel)}</div>
              </div>
              <button className="btn btn-ghost btn-xs" style={{ color: '#fff' }} onClick={() => setSel(null)}>✕</button>
            </div>
            <div style={{ padding: 24 }}>
              <div style={{ display: 'flex', gap: 20, marginBottom: 16 }}>
                <div>
                  <div className="text-xs fw-700 text-muted">DF DO MÊS</div>
                  {(() => { const df = sel.equipamento_tag ? dfDoEquip(sel.equipamento_tag) : null; return <div style={{ fontSize: 22, fontWeight: 800, color: df != null && df < 85 ? 'var(--danger)' : 'var(--success)' }}>{df != null ? df.toFixed(1) + '%' : '—'}</div> })()}
                </div>
                <div>
                  <div className="text-xs fw-700 text-muted">STATUS</div>
                  <div style={{ marginTop: 4 }}><span className="badge" style={{ background: statusInfo(sel).bg, color: statusInfo(sel).color }}>{statusInfo(sel).label}</span></div>
                </div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <div className="text-xs fw-700 text-muted" style={{ marginBottom: 4 }}>DESCRIÇÃO DA FALHA</div>
                <div className="text-sm" style={{ background: 'var(--gray-50)', padding: 10, borderRadius: 8, whiteSpace: 'pre-wrap' }}>{sel.sintoma || '—'}</div>
              </div>
              <div className="form-group">
                <label className="form-label">Prazo de liberação</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input type="date" className="form-control" value={prazo} onChange={e => setPrazo(e.target.value)} />
                  <button className="btn btn-outline" onClick={salvarPrazo} disabled={saving}>Salvar prazo</button>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: 16, marginTop: 8 }}>
                <span className="text-xs text-muted">Aberta em {fmtData(sel.dt_abertura)} · Turno {sel.turno}</span>
                <button className="btn btn-success" onClick={() => liberar(sel)} disabled={saving}>✓ Liberar equipamento</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
