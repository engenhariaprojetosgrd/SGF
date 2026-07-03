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

const ORIGEM_META: Record<string, { label: string; cls: string }> = {
  raf:        { label: 'RAF',        cls: 'badge-raf' },
  agressor:   { label: 'Agressor',   cls: 'badge-agressor' },
  gatilho_df: { label: 'Gatilho DF', cls: 'badge-warning' },
  manual:     { label: 'Manual',     cls: 'badge-gray' },
}
function origemBadge(a: Acao) {
  const o = a.origem ?? (a.raf_id ? 'raf' : a.agressor_id ? 'agressor' : 'manual')
  const m = ORIGEM_META[o] ?? ORIGEM_META.manual
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <span className={'badge ' + m.cls}>{m.label}</span>
      {a.codigo && <span className="text-xs text-muted">{a.codigo}</span>}
    </div>
  )
}
const gerarCodigo = (p: string) => p + '-' + new Date().getFullYear() + '-' + Date.now().toString().slice(-6)

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

  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ descricao: '', responsavel: '', prazo: '', tipo: 'Corretiva Estrutural', equipamento_tag: '' })
  const [saving, setSaving] = useState(false)
  const [origemNova, setOrigemNova] = useState<'gatilho_df' | 'manual'>('manual')
  const [updId, setUpdId] = useState<string | null>(null)
  const [upd, setUpd] = useState({ status: 'em_andamento', evidencia: '', dt_conclusao: '', responsavel: '', prazo: '' })
  const [savingUpd, setSavingUpd] = useState(false)
  useEffect(() => {
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('novo')) {
      setOrigemNova('gatilho_df'); setShowModal(true)
    }
  }, [])
  async function salvarAcao() {
    if (!form.descricao.trim()) return
    setSaving(true)
    const codigo = gerarCodigo(origemNova === 'gatilho_df' ? 'DF' : 'PA')
    const { data } = await supabase.from('acoes').insert({ descricao: form.descricao, responsavel: form.responsavel || '—', prazo: form.prazo || null, tipo: form.tipo, equipamento_tag: form.equipamento_tag || null, status: 'pendente', origem: origemNova, codigo }).select().single()
    if (data) setAcoes(prev => [...prev, data])
    setSaving(false); setShowModal(false); setOrigemNova('manual')
    setForm({ descricao: '', responsavel: '', prazo: '', tipo: 'Corretiva Estrutural', equipamento_tag: '' })
  }

  async function patchAcao(id: string, patch: Record<string, unknown>) {
    const { data } = await supabase.from('acoes').update(patch).eq('id', id).select().single()
    if (data) setAcoes(prev => prev.map(x => x.id === id ? (data as Acao) : x))
  }
  const hojeISO = () => new Date().toISOString().slice(0, 10)
  async function concluir(a: Acao) { await patchAcao(a.id, { status: 'concluida', dt_conclusao: hojeISO() }) }
  async function reabrir(a: Acao) { await patchAcao(a.id, { status: 'em_andamento', dt_conclusao: null }) }
  function openUpdate(a: Acao) {
    setUpdId(a.id)
    setUpd({
      status: a.status === 'concluida' ? 'concluida' : a.status === 'cancelada' ? 'cancelada' : 'em_andamento',
      evidencia: a.evidencia ?? '', dt_conclusao: a.dt_conclusao ? a.dt_conclusao.slice(0, 10) : '',
      responsavel: a.responsavel ?? '', prazo: a.prazo ? a.prazo.slice(0, 10) : '',
    })
  }
  async function salvarUpdate() {
    if (!updId) return
    setSavingUpd(true)
    await patchAcao(updId, {
      status: upd.status, evidencia: upd.evidencia || null, responsavel: upd.responsavel || null, prazo: upd.prazo || null,
      dt_conclusao: upd.status === 'concluida' ? (upd.dt_conclusao || hojeISO()) : null,
    })
    setSavingUpd(false); setUpdId(null)
  }

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
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="badge badge-danger">{cont.atrasada} atrasadas</span>
          <span className="badge badge-blue">{cont.andamento} em andamento</span>
          <span className="badge badge-success">{cont.concluida} concluídas</span>
          <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>＋ Nova Ação</button>
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
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {lista.map(({ a, st }) => {
                  const dias = diasAte(a.prazo)
                  const meta = STATUS_META[st]
                  return (
                    <tr key={a.id} className="clickable" onClick={() => openUpdate(a)}>
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
                      <td onClick={e => e.stopPropagation()} style={{ whiteSpace: 'nowrap' }}>
                        {a.status === 'concluida'
                          ? <button className="btn btn-ghost btn-xs" onClick={() => reabrir(a)}>↩ Reabrir</button>
                          : <button className="btn btn-success btn-xs" onClick={() => concluir(a)}>✓ Concluir</button>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'var(--card-bg)', borderRadius: 12, width: '100%', maxWidth: 520, boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
            <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 700, fontSize: 15 }}>✅ Nova Ação do Plano</span>
              <button className="btn btn-ghost btn-xs" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div style={{ padding: 24 }}>
              <div className="form-group">
                <label className="form-label">Descrição da Ação <span style={{ color: 'var(--danger)' }}>*</span></label>
                <textarea className="form-control" rows={2} placeholder="O que será feito..." value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} />
              </div>
              <div className="form-row form-group">
                <div><label className="form-label">Responsável</label><input className="form-control" placeholder="Nome" value={form.responsavel} onChange={e => setForm(f => ({ ...f, responsavel: e.target.value }))} /></div>
                <div><label className="form-label">Prazo</label><input type="date" className="form-control" value={form.prazo} onChange={e => setForm(f => ({ ...f, prazo: e.target.value }))} /></div>
              </div>
              <div className="form-row form-group">
                <div><label className="form-label">Tipo</label>
                  <select className="form-control" value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
                    <option>Corretiva Imediata</option><option>Corretiva Estrutural</option><option>Preventiva</option><option>Melhoria de Processo</option>
                  </select>
                </div>
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

      {updId && (() => {
        const a = acoes.find(x => x.id === updId)
        if (!a) return null
        return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setUpdId(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--card-bg)', borderRadius: 12, width: '100%', maxWidth: 520, maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
            <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 700, fontSize: 15 }}>Atualizar Ação</span>
              <button className="btn btn-ghost btn-xs" onClick={() => setUpdId(null)}>✕</button>
            </div>
            <div style={{ padding: 24 }}>
              <div className="text-sm fw-600" style={{ marginBottom: 4 }}>{a.descricao}</div>
              {a.codigo && <div className="text-xs text-muted" style={{ marginBottom: 16 }}>{a.codigo}</div>}
              <div className="form-group">
                <label className="form-label">Status</label>
                <select className="form-control" value={upd.status} onChange={e => setUpd(u => ({ ...u, status: e.target.value }))}>
                  <option value="em_andamento">Em Andamento</option>
                  <option value="concluida">Concluída</option>
                  <option value="cancelada">Cancelada</option>
                </select>
              </div>
              {upd.status === 'concluida' && (
                <div className="form-group">
                  <label className="form-label">Data de conclusão</label>
                  <input type="date" className="form-control" value={upd.dt_conclusao} onChange={e => setUpd(u => ({ ...u, dt_conclusao: e.target.value }))} />
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Evidência / o que foi feito</label>
                <textarea className="form-control" rows={3} placeholder="Descreva a execução, peças trocadas, resultado..." value={upd.evidencia} onChange={e => setUpd(u => ({ ...u, evidencia: e.target.value }))} />
              </div>
              <div className="form-row form-group">
                <div><label className="form-label">Responsável</label><input className="form-control" value={upd.responsavel} onChange={e => setUpd(u => ({ ...u, responsavel: e.target.value }))} /></div>
                <div><label className="form-label">Prazo</label><input type="date" className="form-control" value={upd.prazo} onChange={e => setUpd(u => ({ ...u, prazo: e.target.value }))} /></div>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className="btn btn-outline" onClick={() => setUpdId(null)}>Cancelar</button>
                <button className="btn btn-primary" onClick={salvarUpdate} disabled={savingUpd}>{savingUpd ? 'Salvando...' : '✓ Salvar'}</button>
              </div>
            </div>
          </div>
        </div>
        )
      })()}
    </div>
  )
}
