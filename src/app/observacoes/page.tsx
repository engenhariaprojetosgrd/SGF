'use client'
import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import type { Observacao } from '@/lib/types'

type Filtro = 'todas' | 'PCM' | 'Inspeção' | 'Engenharia' | 'Manutenção' | 'Operação' | 'Suprimentos'
const FILTROS: Filtro[] = ['todas','PCM','Inspeção','Engenharia','Manutenção','Operação','Suprimentos']

const DEST_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  'PCM':         { bg:'#fffbeb', color:'#92400e', label:'🟡 PCM' },
  'Inspeção':    { bg:'#e1effe', color:'#1a56db', label:'🔵 Inspeção' },
  'Engenharia':  { bg:'#fde8e8', color:'#9b1c1c', label:'🔴 Engenharia' },
  'Manutenção':  { bg:'#f0fdf4', color:'#065f46', label:'🟢 Manutenção' },
  'Operação':    { bg:'#d1fae5', color:'#065f46', label:'🟢 Operação' },
  'Suprimentos': { bg:'#e1effe', color:'#1e40af', label:'🔵 Suprimentos' },
}

function diasAtras(d: string | null | undefined) {
  if (!d) return null
  return Math.round((Date.now() - new Date(d).getTime()) / 86400000)
}
function fmtData(d: string | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('pt-BR', { day:'2-digit', month:'short', year:'2-digit' })
}

function borderColor(prioridade: string | null | undefined) {
  if (prioridade === 'critica' || prioridade === 'urgente') return 'var(--danger)'
  if (prioridade === 'alta')   return 'var(--warning)'
  return 'var(--primary)'
}

export default function ObservacoesPage() {
  const [obs, setObs]           = useState<Observacao[]>([])
  const [filtro, setFiltro]     = useState<Filtro>('todas')
  const [loading, setLoading]   = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [novaObs, setNovaObs]   = useState({ titulo:'', corpo:'', destinatario:'', prioridade:'media', tipo:'Observação' })
  const [saving, setSaving]     = useState(false)

  useEffect(() => {
    supabase.from('observacoes').select('*').order('created_at', { ascending: false }).then(({ data }) => {
      setObs(data ?? [])
      setLoading(false)
    })
  }, [])

  const filtradas = useMemo(() => {
    if (filtro === 'todas') return obs
    return obs.filter(o => o.destinatario === filtro)
  }, [obs, filtro])

  const total     = obs.length
  const criticas  = obs.filter(o => (o.prioridade as string) === 'critica' || (o.prioridade as string) === 'urgente').length
  const engenharia = obs.filter(o => o.destinatario === 'Engenharia').length
  const maisAntiga = obs.length ? diasAtras(obs[obs.length - 1]?.created_at) : null

  // Contagem por destinatário
  const countPor = (d: string) => obs.filter(o => o.destinatario === d).length

  async function salvarObservacao() {
    if (!novaObs.titulo.trim()) return
    setSaving(true)
    const { data } = await supabase.from('observacoes').insert({
      titulo: novaObs.titulo,
      descricao: novaObs.corpo || null,
      destinatario: novaObs.destinatario || null,
      prioridade: novaObs.prioridade,
      tipo: novaObs.tipo,
      status: 'aberta',
    }).select().single()
    if (data) setObs(prev => [data, ...prev])
    setSaving(false)
    setShowModal(false)
    setNovaObs({ titulo:'', corpo:'', destinatario:'', prioridade:'media', tipo:'Observação' })
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-title">📌 Observações e Pendências</div>
        <div className="page-sub">Comunicações entre turnos, áreas e equipes</div>
      </div>

      {/* ── Filter Bar + Nova Observação ── */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap', marginBottom:20 }}>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          {FILTROS.map(f => {
            const cnt = f === 'todas' ? total : countPor(f)
            return (
              <button key={f}
                className={`btn btn-sm ${filtro === f ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setFiltro(f)}>
                {f} {cnt > 0 && `(${cnt})`}
              </button>
            )
          })}
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>
          ＋ Nova Observação
        </button>
      </div>

      {/* ── Sum Cards ── */}
      <div className="grid g4 mb20">
        <div className="sum-card warning">
          <div className="sum-label">Total Pendências</div>
          <div className="sum-value">{total}</div>
          <div className="sum-sub">Aguardando resolução</div>
        </div>
        <div className="sum-card danger">
          <div className="sum-label">Críticas</div>
          <div className="sum-value">{criticas}</div>
          <div className="sum-sub">Risco operacional</div>
        </div>
        <div className="sum-card primary">
          <div className="sum-label">Para Engenharia</div>
          <div className="sum-value">{engenharia}</div>
          <div className="sum-sub">Análise técnica requerida</div>
        </div>
        <div className="sum-card gray">
          <div className="sum-label">Mais Antiga</div>
          <div className="sum-value">
            {maisAntiga !== null ? <>{maisAntiga}<span style={{fontSize:16,fontWeight:400}}>d</span></> : '—'}
          </div>
          <div className="sum-sub">Dias sem resolução</div>
        </div>
      </div>

      {/* ── Lista de Observações ── */}
      {loading ? (
        <div className="empty-state"><div className="empty-state-icon">⏳</div><div className="empty-state-sub">Carregando...</div></div>
      ) : filtradas.length === 0 ? (
        <div className="empty-state" style={{ padding:'48px' }}>
          <div className="empty-state-icon">📌</div>
          <div className="empty-state-title">
            {filtro === 'todas' ? 'Nenhuma observação registrada' : `Sem observações para ${filtro}`}
          </div>
          <div className="empty-state-sub">
            {filtro === 'todas' ? 'Registre comunicações e pendências entre turnos' : 'Mude o filtro para ver outras observações'}
          </div>
        </div>
      ) : (
        filtradas.map(o => {
          const dest = o.destinatario ? DEST_STYLE[o.destinatario] : null
          const dias = diasAtras(o.created_at)
          return (
            <div key={o.id} className="obs-card" style={{ borderLeft:`3px solid ${borderColor(o.prioridade)}` }}>
              <div className="obs-card-hd">
                <div className="flex ai-center gap8 mb8 flex-wrap">
                  {dest && (
                    <span className="obs-destinatario" style={{ background:dest.bg, color:dest.color }}>
                      {dest.label}
                    </span>
                  )}
                  <span className={`badge ${
                    (o.prioridade as string) === 'critica' || (o.prioridade as string) === 'urgente' ? 'badge-danger'
                    : (o.prioridade as string) === 'alta' ? 'badge-warning'
                    : 'badge-gray'}`}>
                    {(o.prioridade as string) === 'critica' ? 'Crítico'
                     : (o.prioridade as string) === 'urgente' ? 'Urgente'
                     : (o.prioridade as string) === 'alta' ? 'Alta'
                     : 'Normal'}
                  </span>
                  <span className="text-xs text-muted">
                    {`OBS-${String(o.id).slice(0,4)}`}
                    {o.created_at ? ` · ${fmtData(o.created_at)}` : ''}
                    
                  </span>
                </div>
                <div style={{ fontWeight:700, marginBottom:6 }}>{o.titulo}</div>
                {o.descricao && (
                  <div className="text-sm text-muted" style={{ lineHeight:1.6 }}>{o.descricao}</div>
                )}
              </div>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', borderTop:'1px solid var(--gray-100)', paddingTop:10 }}>
                <div className="text-xs text-muted">
                  {o.criado_por ? `Aberto por: ${o.criado_por}` : ''}
                  {dias !== null ? ` · há ${dias} dia${dias !== 1 ? 's' : ''}` : ''}
                </div>
                <div style={{ display:'flex', gap:8 }}>
                  <button className="btn btn-outline btn-sm">Ver Detalhes</button>
                  <button className="btn btn-primary btn-sm">✓ Resolver</button>
                </div>
              </div>
            </div>
          )
        })
      )}

      {/* ── Modal Nova Observação ── */}
      {showModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div style={{ background:'#fff', borderRadius:12, width:'100%', maxWidth:560, maxHeight:'90vh', overflow:'auto', boxShadow:'0 20px 60px rgba(0,0,0,.2)' }}>
            <div style={{ padding:'20px 24px', borderBottom:'1px solid var(--gray-200)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <span style={{ fontWeight:700, fontSize:15 }}>Nova Observação</span>
              <button className="btn btn-ghost btn-xs" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div style={{ padding:24 }}>
              <div className="form-group">
                <label className="form-label">Título <span className="req">*</span></label>
                <input className="form-control" placeholder="Resumo da observação..."
                  value={novaObs.titulo} onChange={e => setNovaObs(n => ({...n, titulo:e.target.value}))} />
              </div>
              <div className="form-row-3 form-group">
                <div>
                  <label className="form-label">Destinatário</label>
                  <select className="form-control" value={novaObs.destinatario} onChange={e => setNovaObs(n => ({...n, destinatario:e.target.value}))}>
                    <option value="">— selecione —</option>
                    {['PCM','Inspeção','Engenharia','Manutenção','Operação','Suprimentos'].map(d => <option key={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Tipo</label>
                  <select className="form-control" value={novaObs.tipo} onChange={e => setNovaObs(n => ({...n, tipo:e.target.value}))}>
                    <option>Observação</option>
                    <option>Pendência</option>
                    <option>Alerta</option>
                    <option>Solicitação</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Prioridade</label>
                  <select className="form-control" value={novaObs.prioridade} onChange={e => setNovaObs(n => ({...n, prioridade:e.target.value}))}>
                    <option value="baixa">Baixa</option>
                    <option value="media">Média</option>
                    <option value="alta">Alta</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Descrição</label>
                <textarea className="form-control" rows={4} placeholder="Detalhes da observação..."
                  value={novaObs.corpo} onChange={e => setNovaObs(n => ({...n, corpo:e.target.value}))} />
              </div>
              <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
                <button className="btn btn-outline" onClick={() => setShowModal(false)}>Cancelar</button>
                <button className="btn btn-primary" onClick={salvarObservacao} disabled={saving || !novaObs.titulo.trim()}>
                  {saving ? 'Salvando...' : 'Salvar Observação'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
