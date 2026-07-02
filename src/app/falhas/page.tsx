'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Agressor, Equipamento } from '@/lib/types'

const FORM0 = { frota: '', equipamento_tag: '', sistema: '', agressor: '', descricao: '', horas_perdidas: '', criticidade: 'Média' }
const gerarCodigo = (p: string) => p + '-' + new Date().getFullYear() + '-' + Date.now().toString().slice(-6)

async function uploadFoto(file: File, pasta: string): Promise<string | null> {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
  const path = pasta + '/' + Date.now() + '-' + Math.random().toString(36).slice(2) + '.' + ext
  const { error } = await supabase.storage.from('anexos').upload(path, file)
  if (error) { console.error(error); return null }
  return supabase.storage.from('anexos').getPublicUrl(path).data.publicUrl
}

export default function AgressoresPage() {
  const router = useRouter()
  const [agres, setAgres] = useState<Agressor[]>([])
  const [equip, setEquip] = useState<Equipamento[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(FORM0)
  const [acoesList, setAcoesList] = useState([{ desc: '', resp: '', prazo: '' }])
  const [foto, setFoto] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const [aRes, eRes] = await Promise.all([
        supabase.from('agressores').select('*').order('created_at', { ascending: false }),
        supabase.from('equipamentos').select('id,tag,categoria,modelo').order('tag'),
      ])
      setAgres((aRes.data ?? []) as Agressor[])
      setEquip((eRes.data ?? []) as Equipamento[])
      setLoading(false)
    }
    load()
  }, [])

  function abrir() {
    setForm(FORM0); setAcoesList([{ desc: '', resp: '', prazo: '' }]); setFoto(null); setErro(null); setShowModal(true)
  }

  async function salvarAgressor() {
    setErro(null)
    if (!form.equipamento_tag || !form.agressor) { setErro('Equipamento e agressor são obrigatórios.'); return }
    setSaving(true)
    const equipId = equip.find(e => e.tag === form.equipamento_tag)?.id ?? null
    const codigo = gerarCodigo('AGR')
    const acoesValidas = acoesList.filter(a => a.desc.trim())
    let foto_url: string | null = null
    if (foto) {
      foto_url = await uploadFoto(foto, 'agressores')
      if (!foto_url) { setErro('Falha ao enviar a foto. Verifique se o bucket "anexos" existe.'); setSaving(false); return }
    }
    const { data: novo, error } = await supabase.from('agressores').insert({
      equipamento_id: equipId,
      equipamento_tag: form.equipamento_tag,
      frota: form.frota || null,
      sistema: form.sistema || null,
      agressor: form.agressor,
      descricao: form.descricao || form.agressor,
      criticidade: form.criticidade || null,
      acoes: acoesValidas.map(a => a.desc).join(' | ') || null,
      codigo,
      foto_url,
      horas_perdidas: form.horas_perdidas ? Number(form.horas_perdidas) : 0,
      ocorrencias: 0,
      custo_total: 0,
      status: 'ativo',
    }).select().single()

    if (error) { setErro('Erro ao salvar agressor: ' + error.message); setSaving(false); return }

    if (novo && acoesValidas.length > 0) {
      await supabase.from('acoes').insert(acoesValidas.map(a => ({
        agressor_id: novo.id,
        equipamento_tag: form.equipamento_tag,
        tipo: 'Corretiva Estrutural',
        descricao: a.desc,
        responsavel: a.resp || '—',
        prazo: a.prazo || null,
        status: 'pendente',
        origem: 'agressor',
        codigo,
      })))
    }
    setSaving(false)
    setShowModal(false)
    // vai para o Plano de Ação (as ações do agressor aparecem lá com o ID de origem)
    router.push('/acoes')
  }

  if (loading) return (
    <div>
      <div className="empty-state"><div className="empty-state-icon">⏳</div><div className="empty-state-sub">Carregando...</div></div>
    </div>
  )

  return (
    <div>
      <div className="page-header">
        <div className="page-title">🟡 Agressores</div>
        <div className="page-sub">Agressores crônicos da frota</div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="card-hd">
          <span className="card-title">Agressores Crônicos da Frota</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="text-xs text-muted">{agres.length} agressor{agres.length !== 1 ? 'es' : ''}</span>
            <button className="btn btn-primary btn-sm" onClick={abrir}>＋ Adicionar Agressor</button>
          </div>
        </div>
        {agres.length === 0 ? (
          <div className="empty-state" style={{ padding: 48 }}>
            <div className="empty-state-icon">🟡</div>
            <div className="empty-state-title">Nenhum agressor registrado</div>
            <div className="empty-state-sub">Identifique falhas recorrentes da frota como agressores</div>
          </div>
        ) : (
          <div className="tbl-wrap">
            <table>
              <thead><tr><th>ID</th><th>Equipamento</th><th>Frota</th><th>Sistema</th><th>Agressor</th><th>Criticidade</th><th>Horas</th><th>Foto</th><th>Status</th></tr></thead>
              <tbody>
                {agres.map(a => (
                  <tr key={a.id} className="clickable">
                    <td className="text-xs text-muted">{a.codigo ?? '—'}</td>
                    <td className="fw-700">{a.equipamento_tag ?? '—'}</td>
                    <td className="text-sm">{a.frota ?? '—'}</td>
                    <td className="text-sm">{a.sistema ?? '—'}</td>
                    <td style={{ maxWidth: 220 }}><div className="fw-600 text-sm">{a.agressor ?? a.descricao}</div></td>
                    <td><span className={'badge ' + (a.criticidade === 'Crítica' ? 'badge-danger' : a.criticidade === 'Alta' ? 'badge-warning' : a.criticidade === 'Média' ? 'badge-blue' : 'badge-gray')}>{a.criticidade ?? '—'}</span></td>
                    <td className="fw-600">{a.horas_perdidas ? a.horas_perdidas + 'h' : '—'}</td>
                    <td>{a.foto_url ? <a href={a.foto_url} target="_blank" rel="noreferrer" title="Ver foto">🖼️</a> : '—'}</td>
                    <td>
                      <span className={'badge ' + (a.status === 'resolvido' ? 'badge-success' : a.status === 'em_tratamento' ? 'badge-blue' : 'badge-warning')}>
                        {a.status === 'em_tratamento' ? 'Tratando' : a.status === 'resolvido' ? 'Resolvido' : 'Ativo'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setShowModal(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--card-bg)', borderRadius: 12, width: '100%', maxWidth: 560, maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
            <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 700, fontSize: 15 }}>🟡 Novo Agressor Crônico</span>
              <button className="btn btn-ghost btn-xs" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div style={{ padding: 24 }}>
              <div className="form-row form-group">
                <div>
                  <label className="form-label">Frota</label>
                  <select className="form-control" value={form.frota} onChange={e => setForm(f => ({ ...f, frota: e.target.value, equipamento_tag: '' }))}>
                    <option value="">— selecione —</option>
                    {[...new Set(equip.map(eq => eq.categoria).filter(Boolean))].sort().map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Equipamento <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <select className="form-control" value={form.equipamento_tag} onChange={e => setForm(f => ({ ...f, equipamento_tag: e.target.value }))}>
                    <option value="">— selecione —</option>
                    {equip.filter(eq => !form.frota || eq.categoria === form.frota).map(eq => <option key={eq.id} value={eq.tag}>{eq.tag}{eq.modelo ? ' · ' + eq.modelo : ''}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-row form-group">
                <div>
                  <label className="form-label">Sistema</label>
                  <input className="form-control" placeholder="Ex: Hidráulico, Motor..." value={form.sistema} onChange={e => setForm(f => ({ ...f, sistema: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label">Agressor <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <input className="form-control" placeholder="Ex: Vazamento na bomba principal" value={form.agressor} onChange={e => setForm(f => ({ ...f, agressor: e.target.value }))} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Descrição do agressor</label>
                <textarea className="form-control" rows={2} placeholder="Detalhe o que se repete e por que é um agressor crônico..." value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} />
              </div>
              <div className="form-row form-group">
                <div>
                  <label className="form-label">Horas perdidas</label>
                  <input type="number" step="0.1" className="form-control" placeholder="Ex: 18" value={form.horas_perdidas} onChange={e => setForm(f => ({ ...f, horas_perdidas: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label">Criticidade</label>
                  <select className="form-control" value={form.criticidade} onChange={e => setForm(f => ({ ...f, criticidade: e.target.value }))}>
                    <option value="Baixa">Baixa</option>
                    <option value="Média">Média</option>
                    <option value="Alta">Alta</option>
                    <option value="Crítica">Crítica</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Ações do Plano</label>
                {acoesList.map((ac, i) => (
                  <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12, marginBottom: 8, background: 'var(--gray-50)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span className="text-xs fw-700 text-muted">Ação {i + 1}</span>
                      {acoesList.length > 1 && <button className="btn btn-ghost btn-xs" onClick={() => setAcoesList(l => l.filter((_, j) => j !== i))}>✕ Remover</button>}
                    </div>
                    <textarea className="form-control" rows={2} placeholder="O que será feito para eliminar o agressor..." value={ac.desc} onChange={e => setAcoesList(l => l.map((x, j) => j === i ? { ...x, desc: e.target.value } : x))} />
                    <div className="form-row" style={{ marginTop: 8 }}>
                      <div><label className="form-label">Responsável</label><input className="form-control" placeholder="Nome" value={ac.resp} onChange={e => setAcoesList(l => l.map((x, j) => j === i ? { ...x, resp: e.target.value } : x))} /></div>
                      <div><label className="form-label">Prazo</label><input type="date" className="form-control" value={ac.prazo} onChange={e => setAcoesList(l => l.map((x, j) => j === i ? { ...x, prazo: e.target.value } : x))} /></div>
                    </div>
                  </div>
                ))}
                <button className="btn btn-outline btn-sm" onClick={() => setAcoesList(l => [...l, { desc: '', resp: '', prazo: '' }])}>＋ Adicionar Ação</button>
              </div>

              <div className="form-group">
                <label className="form-label">Foto (opcional)</label>
                <input type="file" accept="image/*" className="form-control" onChange={e => setFoto(e.target.files?.[0] ?? null)} />
                {foto && <div className="text-xs text-muted" style={{ marginTop: 4 }}>📎 {foto.name}</div>}
              </div>

              {erro && <div className="alert alert-danger" style={{ marginBottom: 12 }}>{erro}</div>}

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className="btn btn-outline" onClick={() => setShowModal(false)}>Cancelar</button>
                <button className="btn btn-primary" onClick={salvarAgressor} disabled={saving || !form.equipamento_tag || !form.agressor}>
                  {saving ? 'Salvando...' : '✓ Salvar e ir ao Plano'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
