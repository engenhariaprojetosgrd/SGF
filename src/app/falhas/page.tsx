'use client'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Agressor, Equipamento, Acao } from '@/lib/types'

const FORM0 = { frota: '', equipamento_tag: '', sistema: '', agressor: '', descricao: '', observacao: '', horas_perdidas: '', criticidade: 'Média', status: 'ativo' }
const COLS = ['ID', 'Equipamento Impactado', 'Sistema', 'Agressor', 'Criticidade', 'Status']
const COLW0 = [140, 190, 150, 290, 120, 120]

function nextCodigo(existentes: Agressor[]): string {
  const nums = existentes.map(a => { const m = (a.codigo ?? '').match(/^AGR-(\d{1,4})$/); return m ? parseInt(m[1]) : 0 })
  const n = (nums.length ? Math.max(...nums) : 0) + 1
  return 'AGR-' + String(n).padStart(2, '0')
}
function critBadge(c: string | null | undefined) {
  const cls = c === 'Crítica' ? 'badge-danger' : c === 'Alta' ? 'badge-warning' : c === 'Média' ? 'badge-blue' : 'badge-gray'
  return <span className={'badge ' + cls}>{c ?? '—'}</span>
}
function statusBadge(s: string | null | undefined) {
  const cls = s === 'resolvido' ? 'badge-success' : s === 'em_tratamento' ? 'badge-blue' : 'badge-warning'
  const lbl = s === 'em_tratamento' ? 'Tratando' : s === 'resolvido' ? 'Resolvido' : 'Ativo'
  return <span className={'badge ' + cls}>{lbl}</span>
}
async function uploadFoto(file: File, pasta: string): Promise<string | null> {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
  const path = pasta + '/' + Date.now() + '-' + Math.random().toString(36).slice(2) + '.' + ext
  const { error } = await supabase.storage.from('anexos').upload(path, file)
  if (error) { console.error(error); return null }
  return supabase.storage.from('anexos').getPublicUrl(path).data.publicUrl
}

export default function AgressoresPage() {
  const [agres, setAgres] = useState<Agressor[]>([])
  const [equip, setEquip] = useState<Equipamento[]>([])
  const [acoesAll, setAcoesAll] = useState<Acao[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroFrota, setFiltroFrota] = useState('todas')
  const [verArquivados, setVerArquivados] = useState(false)
  const [frotaMenu, setFrotaMenu] = useState(false)
  const [colW, setColW] = useState<number[]>(COLW0)

  const [modal, setModal] = useState<'create' | 'detail' | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(FORM0)
  const [acoesList, setAcoesList] = useState([{ desc: '', resp: '', prazo: '' }])
  const [novaAcao, setNovaAcao] = useState({ desc: '', resp: '', prazo: '' })
  const [foto, setFoto] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => { carregar(); try { const s = localStorage.getItem('agr-colw'); if (s) setColW(JSON.parse(s)) } catch {} }, [])
  async function carregar() {
    const [aRes, eRes, acRes] = await Promise.all([
      supabase.from('agressores').select('*').order('created_at', { ascending: false }),
      supabase.from('equipamentos').select('id,tag,categoria,modelo').order('tag'),
      supabase.from('acoes').select('*').not('agressor_id', 'is', null),
    ])
    setAgres((aRes.data ?? []) as Agressor[])
    setEquip((eRes.data ?? []) as Equipamento[])
    setAcoesAll((acRes.data ?? []) as Acao[])
    setLoading(false)
  }

  function startResize(i: number, e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation()
    const startX = e.clientX, startW = colW[i]
    const move = (ev: MouseEvent) => { const w = Math.max(60, startW + (ev.clientX - startX)); setColW(prev => prev.map((x, j) => j === i ? w : x)) }
    const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); setColW(prev => { try { localStorage.setItem('agr-colw', JSON.stringify(prev)) } catch {} ; return prev }) }
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', up)
  }

  const frotas = useMemo(() => [...new Set(agres.map(a => a.frota).filter(Boolean))].sort() as string[], [agres])
  const lista = useMemo(() => agres.filter(a =>
    (verArquivados ? !!a.arquivado : !a.arquivado) &&
    (filtroFrota === 'todas' || a.frota === filtroFrota)
  ), [agres, filtroFrota, verArquivados])
  const atual = useMemo(() => agres.find(a => a.id === editId) ?? null, [agres, editId])
  const acoesDoAtual = useMemo(() => acoesAll.filter(a => a.agressor_id === editId), [acoesAll, editId])
  const doneCount = acoesDoAtual.filter(a => a.status === 'concluida').length
  const pct = acoesDoAtual.length ? Math.round(doneCount / acoesDoAtual.length * 100) : 0

  function abrirNovo() {
    setEditId(null); setForm(FORM0); setAcoesList([{ desc: '', resp: '', prazo: '' }]); setFoto(null); setErro(null); setModal('create')
  }
  function abrirDetalhe(a: Agressor) {
    setEditId(a.id)
    setForm({
      frota: a.frota ?? '', equipamento_tag: a.equipamento_tag ?? '', sistema: a.sistema ?? '', agressor: a.agressor ?? '',
      descricao: a.descricao ?? '', observacao: a.observacao ?? '', horas_perdidas: a.horas_perdidas ? String(a.horas_perdidas) : '',
      criticidade: a.criticidade ?? 'Média', status: a.status ?? 'ativo',
    })
    setNovaAcao({ desc: '', resp: '', prazo: '' }); setFoto(null); setErro(null); setModal('detail')
  }

  async function salvarNovo() {
    setErro(null)
    if (!form.frota || !form.agressor) { setErro('Frota e agressor são obrigatórios.'); return }
    setSaving(true)
    const equipId = form.equipamento_tag ? (equip.find(e => e.tag === form.equipamento_tag)?.id ?? null) : null
    const codigo = nextCodigo(agres)
    const acoesValidas = acoesList.filter(a => a.desc.trim())
    let foto_url: string | null = null
    if (foto) { foto_url = await uploadFoto(foto, 'agressores'); if (!foto_url) { setErro('Falha ao enviar a foto. Verifique o bucket "anexos".'); setSaving(false); return } }
    const { data: novo, error } = await supabase.from('agressores').insert({
      equipamento_id: equipId, equipamento_tag: form.equipamento_tag || null, frota: form.frota,
      sistema: form.sistema || null, agressor: form.agressor, descricao: form.descricao || form.agressor,
      observacao: form.observacao || null, criticidade: form.criticidade || null, codigo, foto_url,
      horas_perdidas: form.horas_perdidas ? Number(form.horas_perdidas) : 0, ocorrencias: 0, custo_total: 0, status: form.status,
    }).select().single()
    if (error) { setErro('Erro ao salvar: ' + error.message); setSaving(false); return }
    if (novo && acoesValidas.length > 0) {
      const { data: novasAc } = await supabase.from('acoes').insert(acoesValidas.map(a => ({
        agressor_id: novo.id, equipamento_tag: form.equipamento_tag || null, tipo: 'Corretiva Estrutural',
        descricao: a.desc, responsavel: a.resp || '—', prazo: a.prazo || null, status: 'pendente', origem: 'agressor', codigo,
      }))).select()
      if (novasAc) setAcoesAll(prev => [...prev, ...(novasAc as Acao[])])
    }
    if (novo) setAgres(prev => [novo as Agressor, ...prev])
    setSaving(false); setModal(null)
  }

  async function salvarDetalhe() {
    if (!editId) return
    setErro(null); setSaving(true)
    const equipId = form.equipamento_tag ? (equip.find(e => e.tag === form.equipamento_tag)?.id ?? null) : null
    let foto_url: string | null = null
    if (foto) { foto_url = await uploadFoto(foto, 'agressores'); if (!foto_url) { setErro('Falha ao enviar a foto.'); setSaving(false); return } }
    const patch: Record<string, unknown> = {
      equipamento_id: equipId, equipamento_tag: form.equipamento_tag || null, frota: form.frota || null,
      sistema: form.sistema || null, agressor: form.agressor, descricao: form.descricao || form.agressor,
      observacao: form.observacao || null, criticidade: form.criticidade || null, status: form.status,
      horas_perdidas: form.horas_perdidas ? Number(form.horas_perdidas) : 0,
    }
    if (foto_url) patch.foto_url = foto_url
    const { data, error } = await supabase.from('agressores').update(patch).eq('id', editId).select().single()
    setSaving(false)
    if (error) { setErro('Erro ao salvar: ' + error.message); return }
    if (data) setAgres(prev => prev.map(x => x.id === editId ? (data as Agressor) : x))
    setModal(null)
  }

  async function toggleAcao(a: Acao) {
    const concl = a.status === 'concluida'
    const patch = concl ? { status: 'em_andamento', dt_conclusao: null } : { status: 'concluida', dt_conclusao: new Date().toISOString().slice(0, 10) }
    const { data } = await supabase.from('acoes').update(patch).eq('id', a.id).select().single()
    if (data) setAcoesAll(prev => prev.map(x => x.id === a.id ? (data as Acao) : x))
  }
  async function addAcaoDetalhe() {
    if (!editId || !novaAcao.desc.trim() || !atual) return
    const { data } = await supabase.from('acoes').insert({
      agressor_id: editId, equipamento_tag: atual.equipamento_tag ?? null, tipo: 'Corretiva Estrutural',
      descricao: novaAcao.desc, responsavel: novaAcao.resp || '—', prazo: novaAcao.prazo || null, status: 'pendente',
      origem: 'agressor', codigo: atual.codigo ?? null,
    }).select().single()
    if (data) setAcoesAll(prev => [...prev, data as Acao])
    setNovaAcao({ desc: '', resp: '', prazo: '' })
  }
  async function resolverAgressor() {
    if (!editId) return
    const { data } = await supabase.from('agressores').update({ status: 'resolvido' }).eq('id', editId).select().single()
    if (data) { setAgres(prev => prev.map(x => x.id === editId ? (data as Agressor) : x)); setForm(f => ({ ...f, status: 'resolvido' })) }
  }
  async function arquivar(val: boolean) {
    if (!editId) return
    const { data } = await supabase.from('agressores').update({ arquivado: val }).eq('id', editId).select().single()
    if (data) setAgres(prev => prev.map(x => x.id === editId ? (data as Agressor) : x))
    setModal(null)
  }

  const camposIdent = (
    <>
      <div className="form-row form-group">
        <div>
          <label className="form-label">Frota <span style={{ color: 'var(--danger)' }}>*</span></label>
          <select className="form-control" value={form.frota} onChange={e => setForm(f => ({ ...f, frota: e.target.value, equipamento_tag: '' }))}>
            <option value="">— selecione —</option>
            {[...new Set(equip.map(eq => eq.categoria).filter(Boolean))].sort().map(cat => <option key={cat} value={cat}>{cat}</option>)}
          </select>
        </div>
        <div>
          <label className="form-label">Equipamento impactado</label>
          <select className="form-control" value={form.equipamento_tag} onChange={e => setForm(f => ({ ...f, equipamento_tag: e.target.value }))}>
            <option value="">🚜 Toda a frota</option>
            {equip.filter(eq => !form.frota || eq.categoria === form.frota).map(eq => <option key={eq.id} value={eq.tag}>{eq.tag}{eq.modelo ? ' · ' + eq.modelo : ''}</option>)}
          </select>
        </div>
      </div>
      <div className="form-row form-group">
        <div><label className="form-label">Sistema</label><input className="form-control" placeholder="Ex: Hidráulico, Motor..." value={form.sistema} onChange={e => setForm(f => ({ ...f, sistema: e.target.value }))} /></div>
        <div><label className="form-label">Agressor <span style={{ color: 'var(--danger)' }}>*</span></label><input className="form-control" placeholder="Ex: Vazamento na bomba" value={form.agressor} onChange={e => setForm(f => ({ ...f, agressor: e.target.value }))} /></div>
      </div>
      <div className="form-row-3 form-group">
        <div><label className="form-label">Horas perdidas</label><input type="number" step="0.1" className="form-control" placeholder="Ex: 18" value={form.horas_perdidas} onChange={e => setForm(f => ({ ...f, horas_perdidas: e.target.value }))} /></div>
        <div>
          <label className="form-label">Criticidade</label>
          <select className="form-control" value={form.criticidade} onChange={e => setForm(f => ({ ...f, criticidade: e.target.value }))}>
            <option value="Baixa">Baixa</option><option value="Média">Média</option><option value="Alta">Alta</option><option value="Crítica">Crítica</option>
          </select>
        </div>
        <div>
          <label className="form-label">Status</label>
          <select className="form-control" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
            <option value="ativo">Ativo</option><option value="em_tratamento">Em Tratamento</option><option value="resolvido">Resolvido</option>
          </select>
        </div>
      </div>
    </>
  )

  if (loading) return (
    <div><div className="empty-state"><div className="empty-state-icon">⏳</div><div className="empty-state-sub">Carregando...</div></div></div>
  )

  return (
    <div>
      <div className="page-header">
        <div className="page-title">🟡 Agressores</div>
        <div className="page-sub">Agressores crônicos da frota</div>
      </div>

      {/* Filtro por frota — dropdown suspenso */}
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
        <button className="btn btn-outline btn-sm" style={{ marginLeft: 8 }} onClick={() => setVerArquivados(v => !v)}>
          {verArquivados ? '← Voltar aos ativos' : '📦 Ver arquivados'}
        </button>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="card-hd">
          <span className="card-title">{verArquivados ? 'Agressores Arquivados' : 'Agressores Crônicos da Frota'}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="text-xs text-muted">{lista.length} agressor{lista.length !== 1 ? 'es' : ''}</span>
            <button className="btn btn-primary btn-sm" onClick={abrirNovo}>＋ Adicionar Agressor</button>
          </div>
        </div>
        {lista.length === 0 ? (
          <div className="empty-state" style={{ padding: 48 }}>
            <div className="empty-state-icon">🟡</div>
            <div className="empty-state-title">Nenhum agressor registrado</div>
            <div className="empty-state-sub">Identifique falhas recorrentes da frota como agressores</div>
          </div>
        ) : (
          <div className="tbl-wrap">
            <table style={{ tableLayout: 'fixed', width: colW.reduce((a, b) => a + b, 0) }}>
              <colgroup>{colW.map((w, i) => <col key={i} style={{ width: w }} />)}</colgroup>
              <thead>
                <tr>
                  {COLS.map((c, i) => (
                    <th key={c} style={{ position: 'relative', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', userSelect: 'none' }}>
                      {c}
                      <span onMouseDown={e => startResize(i, e)} title="Arraste para redimensionar"
                        style={{ position: 'absolute', top: 0, right: 0, width: 8, height: '100%', cursor: 'col-resize' }} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lista.map(a => {
                  const acs = acoesAll.filter(x => x.agressor_id === a.id)
                  const d = acs.filter(x => x.status === 'concluida').length
                  return (
                    <tr key={a.id} className="clickable" onClick={() => abrirDetalhe(a)}>
                      <td className="text-xs fw-700" style={{ color: 'var(--primary)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.codigo ?? '—'}</td>
                      <td className="fw-700" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.equipamento_tag || 'Toda a frota'}</td>
                      <td className="text-sm" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.sistema ?? '—'}</td>
                      <td>
                        <div className="fw-600 text-sm" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.agressor ?? a.descricao}</div>
                        {acs.length > 0 && <div className="text-xs text-muted mt4">✔ {d}/{acs.length} ações</div>}
                      </td>
                      <td>{critBadge(a.criticidade)}</td>
                      <td>{statusBadge(a.status)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ══════════ MODAL CRIAR ══════════ */}
      {modal === 'create' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setModal(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--card-bg)', borderRadius: 12, width: '100%', maxWidth: 580, maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
            <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 700, fontSize: 15 }}>🟡 Novo Agressor Crônico</span>
              <button className="btn btn-ghost btn-xs" onClick={() => setModal(null)}>✕</button>
            </div>
            <div style={{ padding: 24 }}>
              {camposIdent}
              <div className="form-group">
                <label className="form-label">Descrição detalhada do agressor</label>
                <textarea className="form-control" rows={3} placeholder="Detalhe o que se repete, o padrão da falha e por que é um agressor crônico..." value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Ações para eliminar o agressor</label>
                {acoesList.map((ac, i) => (
                  <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12, marginBottom: 8, background: 'var(--gray-50)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span className="text-xs fw-700 text-muted">Ação {i + 1}</span>
                      {acoesList.length > 1 && <button className="btn btn-ghost btn-xs" onClick={() => setAcoesList(l => l.filter((_, j) => j !== i))}>✕</button>}
                    </div>
                    <textarea className="form-control" rows={2} placeholder="O que será feito..." value={ac.desc} onChange={e => setAcoesList(l => l.map((x, j) => j === i ? { ...x, desc: e.target.value } : x))} />
                    <div className="form-row" style={{ marginTop: 8 }}>
                      <div><label className="form-label">Responsável</label><input className="form-control" value={ac.resp} onChange={e => setAcoesList(l => l.map((x, j) => j === i ? { ...x, resp: e.target.value } : x))} /></div>
                      <div><label className="form-label">Prazo</label><input type="date" className="form-control" value={ac.prazo} onChange={e => setAcoesList(l => l.map((x, j) => j === i ? { ...x, prazo: e.target.value } : x))} /></div>
                    </div>
                  </div>
                ))}
                <button className="btn btn-outline btn-sm" onClick={() => setAcoesList(l => [...l, { desc: '', resp: '', prazo: '' }])}>＋ Adicionar Ação</button>
              </div>
              <div className="form-group">
                <label className="form-label">Observação</label>
                <textarea className="form-control" rows={2} placeholder="Notas gerais, contexto, decisões..." value={form.observacao} onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Foto (opcional)</label>
                <input type="file" accept="image/*" className="form-control" onChange={e => setFoto(e.target.files?.[0] ?? null)} />
                {foto && <div className="text-xs text-muted" style={{ marginTop: 4 }}>📎 {foto.name}</div>}
              </div>
              {erro && <div className="alert alert-danger" style={{ marginBottom: 12 }}>{erro}</div>}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className="btn btn-outline" onClick={() => setModal(null)}>Cancelar</button>
                <button className="btn btn-primary" onClick={salvarNovo} disabled={saving || !form.frota || !form.agressor}>{saving ? 'Salvando...' : '✓ Salvar Agressor'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════ MODAL DETALHE ══════════ */}
      {modal === 'detail' && atual && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 100, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 20, overflowY: 'auto' }} onClick={() => setModal(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--card-bg)', borderRadius: 14, width: '100%', maxWidth: 640, margin: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.25)', overflow: 'hidden' }}>
            {/* Cabeçalho azul */}
            <div style={{ padding: '20px 24px', background: 'linear-gradient(135deg, var(--primary), #1e3a8a)', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 11, opacity: .8, fontWeight: 700, letterSpacing: .5 }}>{atual.codigo ?? 'AGRESSOR'} · {atual.equipamento_tag || 'Toda a frota'}</div>
                <div style={{ fontSize: 20, fontWeight: 800, marginTop: 2 }}>{atual.agressor ?? '—'}</div>
                <div style={{ fontSize: 12, opacity: .85, marginTop: 4 }}>{atual.frota} · {atual.sistema || 'sistema não informado'}</div>
              </div>
              <button className="btn btn-ghost btn-xs" style={{ color: '#fff' }} onClick={() => setModal(null)}>✕</button>
            </div>

            <div style={{ padding: 24, maxHeight: 'calc(92vh - 96px)', overflowY: 'auto' }}>
              {/* 1) DESCRIÇÃO no topo */}
              {form.descricao && (
                <div style={{ marginBottom: 20 }}>
                  <div className="text-xs fw-700 text-muted" style={{ marginBottom: 6 }}>DESCRIÇÃO</div>
                  <div className="text-sm" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{form.descricao}</div>
                </div>
              )}

              {/* 2) FOTO */}
              {atual.foto_url && (
                <div style={{ marginBottom: 20 }}>
                  <div className="text-xs fw-700 text-muted" style={{ marginBottom: 6 }}>FOTO</div>
                  <a href={atual.foto_url} target="_blank" rel="noreferrer"><img src={atual.foto_url} alt="Foto do agressor" style={{ maxWidth: '100%', maxHeight: 240, borderRadius: 10, border: '1px solid var(--border)' }} /></a>
                </div>
              )}

              {/* 3) OBSERVAÇÃO */}
              {form.observacao && (
                <div style={{ marginBottom: 20 }}>
                  <div className="text-xs fw-700 text-muted" style={{ marginBottom: 6 }}>OBSERVAÇÃO</div>
                  <div className="text-sm" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{form.observacao}</div>
                </div>
              )}

              {/* 4) PROGRESSO + CHECKLIST */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span className="text-xs fw-700 text-muted">PROGRESSO DAS AÇÕES</span>
                  <span className="text-xs fw-700">{doneCount}/{acoesDoAtual.length} · {pct}%</span>
                </div>
                <div className="pb-wrap"><div className={'pb ' + (pct === 100 ? 'success' : pct > 0 ? 'warning' : '')} style={{ width: pct + '%' }} /></div>
                {acoesDoAtual.length > 0 && pct === 100 && atual.status !== 'resolvido' && (
                  <button className="btn btn-success btn-sm" style={{ marginTop: 10 }} onClick={resolverAgressor}>✓ Todas concluídas — marcar como Resolvido</button>
                )}
              </div>

              <div className="text-xs fw-700 text-muted" style={{ margin: '16px 0 8px' }}>CHECKLIST DE AÇÕES</div>
              {acoesDoAtual.length === 0 && <div className="text-xs text-muted" style={{ marginBottom: 8 }}>Nenhuma ação cadastrada ainda.</div>}
              {acoesDoAtual.map(ac => {
                const ok = ac.status === 'concluida'
                return (
                  <div key={ac.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 6, background: ok ? 'var(--success-light)' : 'var(--gray-50)' }}>
                    <input type="checkbox" checked={ok} onChange={() => toggleAcao(ac)} style={{ marginTop: 3, width: 18, height: 18, cursor: 'pointer', flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div className="text-sm" style={{ textDecoration: ok ? 'line-through' : 'none', opacity: ok ? .65 : 1 }}>{ac.descricao}</div>
                      <div className="text-xs text-muted mt4">{ac.responsavel || '—'}{ac.prazo ? ' · prazo ' + new Date(ac.prazo).toLocaleDateString('pt-BR') : ''}{ok && ac.dt_conclusao ? ' · concluída ' + new Date(ac.dt_conclusao).toLocaleDateString('pt-BR') : ''}</div>
                    </div>
                  </div>
                )
              })}
              <div style={{ border: '1px dashed var(--border)', borderRadius: 8, padding: 12, marginTop: 8, marginBottom: 20 }}>
                <input className="form-control" placeholder="Nova ação para eliminar o agressor..." value={novaAcao.desc} onChange={e => setNovaAcao(n => ({ ...n, desc: e.target.value }))} />
                <div className="form-row" style={{ marginTop: 8 }}>
                  <input className="form-control" placeholder="Responsável" value={novaAcao.resp} onChange={e => setNovaAcao(n => ({ ...n, resp: e.target.value }))} />
                  <input type="date" className="form-control" value={novaAcao.prazo} onChange={e => setNovaAcao(n => ({ ...n, prazo: e.target.value }))} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                  <button className="btn btn-outline btn-sm" onClick={addAcaoDetalhe} disabled={!novaAcao.desc.trim()}>＋ Adicionar ação ao checklist</button>
                </div>
              </div>

              {/* 5) Editar (recolhível) */}
              <details style={{ marginBottom: 16 }}>
                <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: 13, color: 'var(--primary)', marginBottom: 12 }}>✏️ Editar dados do agressor</summary>
                <div style={{ marginTop: 12 }}>
                  {camposIdent}
                  <div className="form-group">
                    <label className="form-label">Descrição detalhada</label>
                    <textarea className="form-control" rows={4} value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Observação</label>
                    <textarea className="form-control" rows={3} value={form.observacao} onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Foto (enviar substitui a atual)</label>
                    <input type="file" accept="image/*" className="form-control" onChange={e => setFoto(e.target.files?.[0] ?? null)} />
                    {foto && <div className="text-xs text-muted" style={{ marginTop: 4 }}>📎 {foto.name}</div>}
                  </div>
                </div>
              </details>

              {erro && <div className="alert alert-danger" style={{ marginBottom: 12 }}>{erro}</div>}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                <div>{statusBadge(form.status)} {critBadge(form.criticidade)}</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {atual.arquivado
                    ? <button className="btn btn-outline" onClick={() => arquivar(false)}>♻ Desarquivar</button>
                    : <button className="btn btn-ghost" onClick={() => arquivar(true)} title="Some da lista sem apagar">📦 Arquivar</button>}
                  <button className="btn btn-outline" onClick={() => setModal(null)}>Fechar</button>
                  <button className="btn btn-primary" onClick={salvarDetalhe} disabled={saving}>{saving ? 'Salvando...' : '✓ Salvar alterações'}</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
