'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { RAF, Equipamento } from '@/lib/types'

function fmtData(d: string | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' })
}
function fmtMoeda(v: number | null | undefined) {
  if (v == null) return '—'
  return 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 0 })
}
const FERRA: Record<string, string> = { '5pqs': '5 Porquês', ishikawa: 'Ishikawa', fta: 'Árvore de Falha' }

async function uploadFoto(file: File, pasta: string): Promise<string | null> {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
  const path = pasta + '/' + Date.now() + '-' + Math.random().toString(36).slice(2) + '.' + ext
  const { error } = await supabase.storage.from('anexos').upload(path, file)
  if (error) { console.error(error); return null }
  return supabase.storage.from('anexos').getPublicUrl(path).data.publicUrl
}

const EDIT0 = {
  numero_raf: '', equipamento_tag: '', data_ocorrencia: '', local_ocorrencia: '', operador: '',
  responsavel: '', descricao_falha: '', custo_estimado: '', parada_horas: '', causa_raiz: '', status: 'em_analise',
}

export default function RafListaPage() {
  const [rafs, setRafs] = useState<RAF[]>([])
  const [equip, setEquip] = useState<Equipamento[]>([])
  const [loading, setLoading] = useState(true)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(EDIT0)
  const [foto, setFoto] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const [rRes, eRes] = await Promise.all([
        supabase.from('rafs').select('*').order('created_at', { ascending: false }),
        supabase.from('equipamentos').select('id,tag,modelo').order('tag'),
      ])
      setRafs((rRes.data ?? []) as RAF[])
      setEquip((eRes.data ?? []) as Equipamento[])
      setLoading(false)
    }
    load()
  }, [])

  function abrirEditar(r: RAF) {
    setEditId(r.id)
    setForm({
      numero_raf: r.numero_raf ?? '', equipamento_tag: r.equipamento_tag ?? '',
      data_ocorrencia: r.data_ocorrencia ? r.data_ocorrencia.slice(0, 10) : '',
      local_ocorrencia: r.local_ocorrencia ?? '', operador: r.operador ?? '', responsavel: r.responsavel ?? '',
      descricao_falha: r.descricao_falha ?? '', custo_estimado: r.custo_estimado ? String(r.custo_estimado) : '',
      parada_horas: r.parada_horas ? String(r.parada_horas) : '', causa_raiz: r.causa_raiz ?? '', status: r.status ?? 'em_analise',
    })
    setFoto(null); setErro(null)
  }

  async function salvar() {
    if (!editId) return
    setErro(null); setSaving(true)
    const equipId = equip.find(e => e.tag === form.equipamento_tag)?.id ?? null
    let foto_url: string | null = null
    if (foto) {
      foto_url = await uploadFoto(foto, 'rafs')
      if (!foto_url) { setErro('Falha ao enviar a foto. Verifique se o bucket "anexos" existe.'); setSaving(false); return }
    }
    const patch: Record<string, unknown> = {
      numero_raf: form.numero_raf || null, equipamento_id: equipId, equipamento_tag: form.equipamento_tag || null,
      data_ocorrencia: form.data_ocorrencia || null, local_ocorrencia: form.local_ocorrencia || null,
      operador: form.operador || null, responsavel: form.responsavel || null, descricao_falha: form.descricao_falha || null,
      custo_estimado: form.custo_estimado ? Number(form.custo_estimado) : null,
      parada_horas: form.parada_horas ? Number(form.parada_horas) : null,
      causa_raiz: form.causa_raiz || null, status: form.status,
    }
    if (foto_url) patch.foto_url = foto_url
    const { data, error } = await supabase.from('rafs').update(patch).eq('id', editId).select().single()
    setSaving(false)
    if (error) { setErro('Erro ao salvar: ' + error.message); return }
    if (data) setRafs(prev => prev.map(x => x.id === editId ? (data as RAF) : x))
    setEditId(null)
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

      <div className="card" style={{ padding: 0 }}>
        <div className="card-hd">
          <span className="card-title">Relatórios de Análise de Falha</span>
          <span className="text-xs text-muted">{rafs.length} RAF{rafs.length !== 1 ? 's' : ''}</span>
        </div>
        {loading ? (
          <div className="empty-state" style={{ padding: 48 }}><div className="empty-state-icon">⏳</div><div className="empty-state-sub">Carregando...</div></div>
        ) : rafs.length === 0 ? (
          <div className="empty-state" style={{ padding: 48 }}>
            <div className="empty-state-icon">⚡</div>
            <div className="empty-state-title">Nenhuma RAF registrada</div>
            <div className="empty-state-sub">Registre falhas críticas para análise de causa raiz</div>
            <a href="/raf/novo" className="btn btn-primary" style={{ marginTop: 16 }}>＋ Nova RAF</a>
          </div>
        ) : (
          <div className="tbl-wrap">
            <table>
              <thead><tr><th>ID</th><th>Equipamento</th><th>Falha</th><th>Data</th><th>Ferramenta</th><th>Custo</th><th>Foto</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {rafs.map(r => (
                  <tr key={r.id}>
                    <td><span className="badge badge-raf">{r.numero_raf ?? ('RAF-' + String(r.id).slice(0, 4))}</span></td>
                    <td className="fw-700">{r.equipamento_tag ?? '—'}</td>
                    <td style={{ maxWidth: 220 }}><div className="fw-600 text-sm" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.descricao_falha ?? '—'}</div></td>
                    <td className="text-xs">{fmtData(r.data_ocorrencia)}</td>
                    <td className="text-sm">{r.ferramenta_analise ? (FERRA[r.ferramenta_analise] ?? r.ferramenta_analise) : '—'}</td>
                    <td className={r.custo_estimado && r.custo_estimado > 50000 ? 'fw-700 text-danger' : 'fw-600'}>{fmtMoeda(r.custo_estimado)}</td>
                    <td>{r.foto_url ? <a href={r.foto_url} target="_blank" rel="noreferrer" title="Ver foto">🖼️</a> : '—'}</td>
                    <td>
                      <span className={'badge ' + (r.status === 'concluido' ? 'badge-success' : r.status === 'aprovado' ? 'badge-blue' : r.status === 'cancelado' ? 'badge-gray' : 'badge-warning')}>
                        {r.status === 'em_analise' ? 'Em Análise' : r.status === 'aprovado' ? 'Aprovado' : r.status === 'concluido' ? 'Concluído' : r.status === 'cancelado' ? 'Cancelado' : (r.status ?? 'Aberto')}
                      </span>
                    </td>
                    <td><button className="btn btn-outline btn-xs" onClick={() => abrirEditar(r)}>✏️ Editar</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setEditId(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--card-bg)', borderRadius: 12, width: '100%', maxWidth: 580, maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
            <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 700, fontSize: 15 }}>✏️ Editar RAF</span>
              <button className="btn btn-ghost btn-xs" onClick={() => setEditId(null)}>✕</button>
            </div>
            <div style={{ padding: 24 }}>
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
                    <option value="em_analise">Em Análise</option>
                    <option value="aprovado">Aprovado</option>
                    <option value="concluido">Concluído</option>
                    <option value="cancelado">Cancelado</option>
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
              <div className="form-group">
                <label className="form-label">Foto (enviar substitui a atual)</label>
                <input type="file" accept="image/*" className="form-control" onChange={e => setFoto(e.target.files?.[0] ?? null)} />
                {foto && <div className="text-xs text-muted" style={{ marginTop: 4 }}>📎 {foto.name}</div>}
              </div>

              <div className="alert alert-info" style={{ marginBottom: 12 }}><span className="alert-ico">💡</span><div>A análise detalhada (5 Porquês / Ishikawa / Árvore de Falha) é criada no wizard e não é editada aqui.</div></div>
              {erro && <div className="alert alert-danger" style={{ marginBottom: 12 }}>{erro}</div>}

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className="btn btn-outline" onClick={() => setEditId(null)}>Cancelar</button>
                <button className="btn btn-primary" onClick={salvar} disabled={saving}>{saving ? 'Salvando...' : '✓ Salvar Alterações'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
