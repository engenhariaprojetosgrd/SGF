'use client'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { RAF, Equipamento, Acao } from '@/lib/types'

const COLS = ['ID', 'Equipamento', 'Frota', 'Falha', 'Custo', 'Status']
const COLW0 = [150, 130, 170, 300, 120, 120]
const FERRA: Record<string, string> = { '5pqs': '5 Porquês', ishikawa: 'Ishikawa', fta: 'Árvore de Falha' }

function fmtData(d: string | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' })
}
function fmtMoeda(v: number | null | undefined) {
  if (v == null) return '—'
  return 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 0 })
}
function statusBadge(s: string | null | undefined) {
  const cls = s === 'concluido' ? 'badge-success' : s === 'aprovado' ? 'badge-blue' : s === 'cancelado' ? 'badge-gray' : 'badge-warning'
  const lbl = s === 'em_analise' ? 'Em Análise' : s === 'aprovado' ? 'Aprovado' : s === 'concluido' ? 'Concluído' : s === 'cancelado' ? 'Cancelado' : 'Aberto'
  return <span className={'badge ' + cls}>{lbl}</span>
}
async function uploadFoto(file: File, pasta: string): Promise<string | null> {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
  const path = pasta + '/' + Date.now() + '-' + Math.random().toString(36).slice(2) + '.' + ext
  const { error } = await supabase.storage.from('anexos').upload(path, file)
  if (error) { console.error(error); return null }
  return supabase.storage.from('anexos').getPublicUrl(path).data.publicUrl
}

const F0 = { numero_raf: '', equipamento_tag: '', data_ocorrencia: '', local_ocorrencia: '', operador: '', responsavel: '', descricao_falha: '', observacao: '', custo_estimado: '', parada_horas: '', causa_raiz: '', status: 'em_analise' }

export default function RafListaPage() {
  const [rafs, setRafs] = useState<RAF[]>([])
  const [equip, setEquip] = useState<Equipamento[]>([])
  const [acoesAll, setAcoesAll] = useState<Acao[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroFrota, setFiltroFrota] = useState('todas')
  const [frotaMenu, setFrotaMenu] = useState(false)
  const [colW, setColW] = useState<number[]>(COLW0)

  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(F0)
  const [novaAcao, setNovaAcao] = useState({ desc: '', resp: '', prazo: '' })
  const [foto, setFoto] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => { carregar(); try { const s = localStorage.getItem('raf-colw'); if (s) setColW(JSON.parse(s)) } catch {} }, [])
  async function carregar() {
    const [rRes, eRes, acRes] = await Promise.all([
      supabase.from('rafs').select('*').order('created_at', { ascending: false }),
      supabase.from('equipamentos').select('id,tag,categoria,modelo').order('tag'),
      supabase.from('acoes').select('*').not('raf_id', 'is', null),
    ])
    setRafs((rRes.data ?? []) as RAF[])
    setEquip((eRes.data ?? []) as Equipamento[])
    setAcoesAll((acRes.data ?? []) as Acao[])
    setLoading(false)
  }

  function startResize(i: number, e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation()
    const startX = e.clientX, startW = colW[i]
    const move = (ev: MouseEvent) => { const w = Math.max(60, startW + (ev.clientX - startX)); setColW(prev => prev.map((x, j) => j === i ? w : x)) }
    const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); setColW(prev => { try { localStorage.setItem('raf-colw', JSON.stringify(prev)) } catch {} ; return prev }) }
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', up)
  }

  const catByTag = useMemo(() => { const m: Record<string, string> = {}; equip.forEach(e => { m[e.tag] = e.categoria }); return m }, [equip])
  const frotaOf = (r: RAF) => r.equipamento_tag ? (catByTag[r.equipamento_tag] ?? '—') : '—'
  const frotas = useMemo(() => [...new Set(rafs.map(frotaOf).filter(f => f !== '—'))].sort(), [rafs, catByTag])
  const lista = useMemo(() => filtroFrota === 'todas' ? rafs : rafs.filter(r => frotaOf(r) === filtroFrota), [rafs, filtroFrota, catByTag])
  const atual = useMemo(() => rafs.find(r => r.id === editId) ?? null, [rafs, editId])
  const acoesDoAtual = useMemo(() => acoesAll.filter(a => a.raf_id === editId), [acoesAll, editId])
  const doneCount = acoesDoAtual.filter(a => a.status === 'concluida').length
  const pct = acoesDoAtual.length ? Math.round(doneCount / acoesDoAtual.length * 100) : 0

  function abrirDetalhe(r: RAF) {
    setEditId(r.id)
    setForm({
      numero_raf: r.numero_raf ?? '', equipamento_tag: r.equipamento_tag ?? '',
      data_ocorrencia: r.data_ocorrencia ? r.data_ocorrencia.slice(0, 10) : '', local_ocorrencia: r.local_ocorrencia ?? '',
      operador: r.operador ?? '', responsavel: r.responsavel ?? '', descricao_falha: r.descricao_falha ?? '',
      observacao: r.observacao ?? '', custo_estimado: r.custo_estimado ? String(r.custo_estimado) : '',
      parada_horas: r.parada_horas ? String(r.parada_horas) : '', causa_raiz: r.causa_raiz ?? '', status: r.status ?? 'em_analise',
    })
    setNovaAcao({ desc: '', resp: '', prazo: '' }); setFoto(null); setErro(null)
  }

  async function salvarDetalhe() {
    if (!editId) return
    setErro(null); setSaving(true)
    const equipId = form.equipamento_tag ? (equip.find(e => e.tag === form.equipamento_tag)?.id ?? null) : null
    let foto_url: string | null = null
    if (foto) { foto_url = await uploadFoto(foto, 'rafs'); if (!foto_url) { setErro('Falha ao enviar a foto.'); setSaving(false); return } }
    const patch: Record<string, unknown> = {
      numero_raf: form.numero_raf || null, equipamento_id: equipId, equipamento_tag: form.equipamento_tag || null,
      data_ocorrencia: form.data_ocorrencia || null, local_ocorrencia: form.local_ocorrencia || null, operador: form.operador || null,
      responsavel: form.responsavel || null, descricao_falha: form.descricao_falha || null, observacao: form.observacao || null,
      custo_estimado: form.custo_estimado ? Number(form.custo_estimado) : null, parada_horas: form.parada_horas ? Number(form.parada_horas) : null,
      causa_raiz: form.causa_raiz || null, status: form.status,
    }
    if (foto_url) patch.foto_url = foto_url
    const { data, error } = await supabase.from('rafs').update(patch).eq('id', editId).select().single()
    setSaving(false)
    if (error) { setErro('Erro ao salvar: ' + error.message); return }
    if (data) setRafs(prev => prev.map(x => x.id === editId ? (data as RAF) : x))
    setEditId(null)
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
      raf_id: editId, equipamento_tag: atual.equipamento_tag ?? null, tipo: 'Corretiva Estrutural',
      descricao: novaAcao.desc, responsavel: novaAcao.resp || '—', prazo: novaAcao.prazo || null, status: 'pendente',
      origem: 'raf', codigo: atual.numero_raf ?? null,
    }).select().single()
    if (data) setAcoesAll(prev => [...prev, data as Acao])
    setNovaAcao({ desc: '', resp: '', prazo: '' })
  }
  async function concluirRaf() {
    if (!editId) return
    const { data } = await supabase.from('rafs').update({ status: 'concluido' }).eq('id', editId).select().single()
    if (data) { setRafs(prev => prev.map(x => x.id === editId ? (data as RAF) : x)); setForm(f => ({ ...f, status: 'concluido' })) }
  }

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="page-title">🔍 RAF</div>
          <div className="page-sub">Relatórios de Análise de Falha registrados</div>
        </div>
        <a href="/raf/novo" className="btn btn-primary">＋ Nova RAF</a>
      </div>

      {/* Filtro por frota — dropdown */}
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

      <div className="card" style={{ padding: 0 }}>
        <div className="card-hd">
          <span className="card-title">Relatórios de Análise de Falha</span>
          <span className="text-xs text-muted">{lista.length} RAF{lista.length !== 1 ? 's' : ''}</span>
        </div>
        {loading ? (
          <div className="empty-state" style={{ padding: 48 }}><div className="empty-state-icon">⏳</div><div className="empty-state-sub">Carregando...</div></div>
        ) : lista.length === 0 ? (
          <div className="empty-state" style={{ padding: 48 }}>
            <div className="empty-state-icon">⚡</div>
            <div className="empty-state-title">Nenhuma RAF registrada</div>
            <div className="empty-state-sub">Registre falhas críticas para análise de causa raiz</div>
            <a href="/raf/novo" className="btn btn-primary" style={{ marginTop: 16 }}>＋ Nova RAF</a>
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
                      <span onMouseDown={e => startResize(i, e)} title="Arraste para redimensionar" style={{ position: 'absolute', top: 0, right: 0, width: 8, height: '100%', cursor: 'col-resize' }} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lista.map(r => {
                  const acs = acoesAll.filter(x => x.raf_id === r.id)
                  const d = acs.filter(x => x.status === 'concluida').length
                  return (
                    <tr key={r.id} className="clickable" onClick={() => abrirDetalhe(r)}>
                      <td style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}><span className="badge badge-raf">{r.numero_raf ?? ('RAF-' + String(r.id).slice(0, 4))}</span></td>
                      <td className="fw-700" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.equipamento_tag ?? '—'}</td>
                      <td className="text-sm" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{frotaOf(r)}</td>
                      <td>
                        <div className="fw-600 text-sm" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.descricao_falha ?? '—'}</div>
                        {acs.length > 0 && <div className="text-xs text-muted mt4">✔ {d}/{acs.length} ações</div>}
                      </td>
                      <td className={r.custo_estimado && r.custo_estimado > 50000 ? 'fw-700 text-danger' : 'fw-600'} style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{fmtMoeda(r.custo_estimado)}</td>
                      <td>{statusBadge(r.status)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ══════════ MODAL DETALHE ══════════ */}
      {editId && atual && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 100, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 20, overflowY: 'auto' }} onClick={() => setEditId(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--card-bg)', borderRadius: 14, width: '100%', maxWidth: 640, margin: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.25)', overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', background: 'linear-gradient(135deg, var(--primary), #1e3a8a)', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 11, opacity: .8, fontWeight: 700, letterSpacing: .5 }}>{atual.numero_raf ?? 'RAF'} · {atual.equipamento_tag || '—'}</div>
                <div style={{ fontSize: 20, fontWeight: 800, marginTop: 2 }}>{atual.descricao_falha || 'Análise de Falha'}</div>
                <div style={{ fontSize: 12, opacity: .85, marginTop: 4 }}>{frotaOf(atual)}{atual.ferramenta_analise ? ' · ' + (FERRA[atual.ferramenta_analise] ?? atual.ferramenta_analise) : ''}</div>
              </div>
              <button className="btn btn-ghost btn-xs" style={{ color: '#fff' }} onClick={() => setEditId(null)}>✕</button>
            </div>

            <div style={{ padding: 24, maxHeight: 'calc(92vh - 96px)', overflowY: 'auto' }}>
              {/* 1) DESCRIÇÃO */}
              {form.descricao_falha && (
                <div style={{ marginBottom: 20 }}>
                  <div className="text-xs fw-700 text-muted" style={{ marginBottom: 6 }}>DESCRIÇÃO DA FALHA</div>
                  <div className="text-sm" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{form.descricao_falha}</div>
                </div>
              )}
              {/* 2) FOTO */}
              {atual.foto_url && (
                <div style={{ marginBottom: 20 }}>
                  <div className="text-xs fw-700 text-muted" style={{ marginBottom: 6 }}>FOTO</div>
                  <a href={atual.foto_url} target="_blank" rel="noreferrer"><img src={atual.foto_url} alt="Foto da falha" style={{ maxWidth: '100%', maxHeight: 240, borderRadius: 10, border: '1px solid var(--border)' }} /></a>
                </div>
              )}
              {/* 3) CAUSA RAIZ + OBSERVAÇÃO */}
              {form.causa_raiz && (
                <div style={{ marginBottom: 20 }}>
                  <div className="text-xs fw-700 text-muted" style={{ marginBottom: 6 }}>CAUSA RAIZ</div>
                  <div className="text-sm" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{form.causa_raiz}</div>
                </div>
              )}
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
                {acoesDoAtual.length > 0 && pct === 100 && atual.status !== 'concluido' && (
                  <button className="btn btn-success btn-sm" style={{ marginTop: 10 }} onClick={concluirRaf}>✓ Todas concluídas — marcar RAF como Concluída</button>
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
                      <div className="text-xs text-muted mt4">{ac.responsavel || '—'}{ac.prazo ? ' · prazo ' + fmtData(ac.prazo) : ''}{ok && ac.dt_conclusao ? ' · concluída ' + fmtData(ac.dt_conclusao) : ''}</div>
                    </div>
                  </div>
                )
              })}
              <div style={{ border: '1px dashed var(--border)', borderRadius: 8, padding: 12, marginTop: 8, marginBottom: 20 }}>
                <input className="form-control" placeholder="Nova ação para sanar a falha..." value={novaAcao.desc} onChange={e => setNovaAcao(n => ({ ...n, desc: e.target.value }))} />
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
                <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: 13, color: 'var(--primary)', marginBottom: 12 }}>✏️ Editar dados da RAF</summary>
                <div style={{ marginTop: 12 }}>
                  <div className="form-row form-group">
                    <div><label className="form-label">Nº RAF</label><input className="form-control" value={form.numero_raf} onChange={e => setForm(f => ({ ...f, numero_raf: e.target.value }))} /></div>
                    <div><label className="form-label">Data da Falha</label><input type="date" className="form-control" value={form.data_ocorrencia} onChange={e => setForm(f => ({ ...f, data_ocorrencia: e.target.value }))} /></div>
                  </div>
                  <div className="form-row form-group">
                    <div>
                      <label className="form-label">Equipamento</label>
                      <select className="form-control" value={form.equipamento_tag} onChange={e => setForm(f => ({ ...f, equipamento_tag: e.target.value }))}>
                        <option value="">— selecione —</option>
                        {equip.map(eq => <option key={eq.id} value={eq.tag}>{eq.tag}{eq.modelo ? ' · ' + eq.modelo : ''}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="form-label">Status</label>
                      <select className="form-control" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                        <option value="em_analise">Em Análise</option><option value="aprovado">Aprovado</option><option value="concluido">Concluído</option><option value="cancelado">Cancelado</option>
                      </select>
                    </div>
                  </div>
                  <div className="form-row form-group">
                    <div><label className="form-label">Local / Frente</label><input className="form-control" value={form.local_ocorrencia} onChange={e => setForm(f => ({ ...f, local_ocorrencia: e.target.value }))} /></div>
                    <div><label className="form-label">Operador</label><input className="form-control" value={form.operador} onChange={e => setForm(f => ({ ...f, operador: e.target.value }))} /></div>
                  </div>
                  <div className="form-group"><label className="form-label">Descrição da Falha</label><textarea className="form-control" rows={3} value={form.descricao_falha} onChange={e => setForm(f => ({ ...f, descricao_falha: e.target.value }))} /></div>
                  <div className="form-row form-group">
                    <div><label className="form-label">Custo Estimado (R$)</label><input type="number" className="form-control" value={form.custo_estimado} onChange={e => setForm(f => ({ ...f, custo_estimado: e.target.value }))} /></div>
                    <div><label className="form-label">Parada (horas)</label><input type="number" step="0.5" className="form-control" value={form.parada_horas} onChange={e => setForm(f => ({ ...f, parada_horas: e.target.value }))} /></div>
                  </div>
                  <div className="form-group"><label className="form-label">Responsável pela Análise</label><input className="form-control" value={form.responsavel} onChange={e => setForm(f => ({ ...f, responsavel: e.target.value }))} /></div>
                  <div className="form-group"><label className="form-label">Causa Raiz</label><textarea className="form-control" rows={2} value={form.causa_raiz} onChange={e => setForm(f => ({ ...f, causa_raiz: e.target.value }))} /></div>
                  <div className="form-group"><label className="form-label">Observação</label><textarea className="form-control" rows={2} value={form.observacao} onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))} /></div>
                  <div className="form-group">
                    <label className="form-label">Foto (enviar substitui a atual)</label>
                    <input type="file" accept="image/*" className="form-control" onChange={e => setFoto(e.target.files?.[0] ?? null)} />
                    {foto && <div className="text-xs text-muted" style={{ marginTop: 4 }}>📎 {foto.name}</div>}
                  </div>
                  <div className="alert alert-info"><span className="alert-ico">💡</span><div>A análise (5 Porquês / Ishikawa / Árvore de Falha) é montada no wizard e não é editada aqui.</div></div>
                </div>
              </details>

              {erro && <div className="alert alert-danger" style={{ marginBottom: 12 }}>{erro}</div>}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                <div>{statusBadge(form.status)}</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-outline" onClick={() => setEditId(null)}>Fechar</button>
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
