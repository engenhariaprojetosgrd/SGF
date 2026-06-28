'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { RAF, Agressor, Equipamento } from '@/lib/types'

function fmtData(d: string | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' })
}
function fmtMoeda(v: number | null | undefined) {
  if (v == null) return '—'
  return 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 0 })
}

const FORM0 = { equipamento_tag: '', sistema: '', descricao: '', ocorrencias: '', custo_total: '', horas_perdidas: '', plano_desc: '', plano_resp: '', plano_prazo: '' }

export default function FalhasPage() {
  const [tab, setTab] = useState<'rafs' | 'agres'>('rafs')
  const [rafs, setRafs] = useState<RAF[]>([])
  const [agres, setAgres] = useState<Agressor[]>([])
  const [equip, setEquip] = useState<Equipamento[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(FORM0)
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const [rRes, aRes, eRes] = await Promise.all([
        supabase.from('rafs').select('*').order('created_at', { ascending: false }),
        supabase.from('agressores').select('*').order('ocorrencias', { ascending: false }),
        supabase.from('equipamentos').select('id,tag,categoria').order('tag'),
      ])
      setRafs((rRes.data ?? []) as RAF[])
      setAgres((aRes.data ?? []) as Agressor[])
      setEquip((eRes.data ?? []) as Equipamento[])
      setLoading(false)
    }
    load()
  }, [])

  const rafsCriticos = rafs.filter(r => r.status !== 'concluido' && r.status !== 'cancelado').length
  const agresAtivos = agres.filter(a => a.status === 'ativo').length

  async function salvarAgressor() {
    setErro(null)
    if (!form.equipamento_tag || !form.descricao) { setErro('Equipamento e descrição são obrigatórios.'); return }
    setSaving(true)
    const equipId = equip.find(e => e.tag === form.equipamento_tag)?.id ?? null
    const { data: novo, error } = await supabase.from('agressores').insert({
      equipamento_id: equipId,
      equipamento_tag: form.equipamento_tag,
      sistema: form.sistema || null,
      descricao: form.descricao,
      ocorrencias: form.ocorrencias ? Number(form.ocorrencias) : 0,
      horas_perdidas: form.horas_perdidas ? Number(form.horas_perdidas) : 0,
      custo_total: form.custo_total ? Number(form.custo_total) : 0,
      status: 'ativo',
    }).select().single()

    if (error) { setErro('Erro ao salvar agressor: ' + error.message); setSaving(false); return }

    if (novo && form.plano_desc) {
      await supabase.from('acoes').insert({
        agressor_id: novo.id,
        equipamento_tag: form.equipamento_tag,
        tipo: 'Corretiva Estrutural',
        descricao: form.plano_desc,
        responsavel: form.plano_resp || '—',
        prazo: form.plano_prazo || null,
        status: 'pendente',
      })
    }
    if (novo) setAgres(prev => [novo as Agressor, ...prev])
    setSaving(false)
    setShowModal(false)
    setForm(FORM0)
    setTab('agres')
  }

  if (loading) return (
    <div>
      <div className="page-header"><div className="page-title">⚡ RAF e Agressores</div></div>
      <div className="empty-state"><div className="empty-state-icon">⏳</div><div className="empty-state-sub">Carregando...</div></div>
    </div>
  )

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="page-title">⚡ RAF e Agressores</div>
          <div className="page-sub">Relatórios de análise de falhas e agressores crônicos da frota</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-outline" onClick={() => { setForm(FORM0); setErro(null); setShowModal(true) }}>＋ Adicionar Agressor</button>
          <a href="/raf/novo" className="btn btn-primary">＋ Nova Análise RAF</a>
        </div>
      </div>

      <div className="itabs">
        <div className={'itab ' + (tab === 'rafs' ? 'active' : '')} onClick={() => setTab('rafs')}>
          🔴 Falhas Críticas RAF
          {rafsCriticos > 0 && <span className="badge badge-danger" style={{ marginLeft: 8 }}>{rafsCriticos}</span>}
        </div>
        <div className={'itab ' + (tab === 'agres' ? 'active' : '')} onClick={() => setTab('agres')}>
          🟡 Agressores
          {agresAtivos > 0 && <span className="badge badge-warning" style={{ marginLeft: 8 }}>{agresAtivos}</span>}
        </div>
      </div>

      {tab === 'rafs' && (
        <div className="card" style={{ padding: 0 }}>
          <div className="card-hd">
            <span className="card-title">Relatórios de Análise de Falha</span>
            <span className="text-xs text-muted">{rafs.length} RAF{rafs.length !== 1 ? 's' : ''}</span>
          </div>
          {rafs.length === 0 ? (
            <div className="empty-state" style={{ padding: 48 }}>
              <div className="empty-state-icon">⚡</div>
              <div className="empty-state-title">Nenhuma RAF registrada</div>
              <div className="empty-state-sub">Registre falhas críticas para análise de causa raiz</div>
              <a href="/raf/novo" className="btn btn-primary" style={{ marginTop: 16 }}>＋ Nova RAF</a>
            </div>
          ) : (
            <div className="tbl-wrap">
              <table>
                <thead><tr><th>ID</th><th>Equipamento</th><th>Falha</th><th>Data</th><th>Custo</th><th>Status</th><th>Ações</th></tr></thead>
                <tbody>
                  {rafs.map(r => (
                    <tr key={r.id} className="clickable">
                      <td><span className="badge badge-raf">{r.numero_raf ?? ('RAF-' + String(r.id).slice(0, 4))}</span></td>
                      <td className="fw-700">{r.equipamento_tag ?? '—'}</td>
                      <td style={{ maxWidth: 220 }}>
                        <div className="fw-600 text-sm" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.descricao_falha ?? '—'}</div>
                      </td>
                      <td className="text-xs">{fmtData(r.data_ocorrencia)}</td>
                      <td className={r.custo_estimado && r.custo_estimado > 50000 ? 'fw-700 text-danger' : 'fw-600'}>{fmtMoeda(r.custo_estimado)}</td>
                      <td>
                        <span className={'badge ' + (r.status === 'concluido' ? 'badge-success' : r.status === 'aprovado' ? 'badge-blue' : r.status === 'cancelado' ? 'badge-gray' : 'badge-warning')}>
                          {r.status === 'em_analise' ? 'Em Análise' : r.status === 'aprovado' ? 'Aprovado' : r.status === 'concluido' ? 'Concluído' : r.status === 'cancelado' ? 'Cancelado' : (r.status ?? 'Aberto')}
                        </span>
                      </td>
                      <td><a href="/raf/novo" className="btn btn-outline btn-xs">Ver →</a></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'agres' && (
        <div className="card" style={{ padding: 0 }}>
          <div className="card-hd">
            <span className="card-title">Agressores Crônicos da Frota</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="text-xs text-muted">{agres.length} agressor{agres.length !== 1 ? 'es' : ''}</span>
              <button className="btn btn-primary btn-sm" onClick={() => { setForm(FORM0); setErro(null); setShowModal(true) }}>＋ Adicionar</button>
            </div>
          </div>
          {agres.length === 0 ? (
            <div className="empty-state" style={{ padding: 48 }}>
              <div className="empty-state-icon">🟡</div>
              <div className="empty-state-title">Nenhum agressor registrado</div>
              <div className="empty-state-sub">Identifique falhas recorrentes da frota como agressores</div>
              <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => { setForm(FORM0); setErro(null); setShowModal(true) }}>＋ Adicionar Agressor</button>
            </div>
          ) : (
            <div className="tbl-wrap">
              <table>
                <thead><tr><th>Equipamento</th><th>Sistema</th><th>Descrição</th><th>Ocorr.</th><th>Custo Total</th><th>Status</th></tr></thead>
                <tbody>
                  {agres.map(a => (
                    <tr key={a.id} className="clickable">
                      <td className="fw-700">{a.equipamento_tag ?? '—'}</td>
                      <td className="text-sm">{a.sistema ?? '—'}</td>
                      <td style={{ maxWidth: 260 }}><div className="fw-600 text-sm">{a.descricao}</div></td>
                      <td><span className="badge badge-warning">{a.ocorrencias ?? 0}x</span></td>
                      <td className={a.custo_total && a.custo_total > 100000 ? 'fw-700 text-danger' : 'fw-600'}>{fmtMoeda(a.custo_total)}</td>
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
      )}

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 560, maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
            <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--gray-200)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 700, fontSize: 15 }}>🟡 Novo Agressor Crônico</span>
              <button className="btn btn-ghost btn-xs" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div style={{ padding: 24 }}>
              <div className="form-row form-group">
                <div>
                  <label className="form-label">Equipamento <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <select className="form-control" value={form.equipamento_tag} onChange={e => setForm(f => ({ ...f, equipamento_tag: e.target.value }))}>
                    <option value="">— selecione —</option>
                    {equip.map(eq => <option key={eq.id} value={eq.tag}>{eq.tag}{eq.categoria ? ' · ' + eq.categoria : ''}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Sistema</label>
                  <input className="form-control" placeholder="Ex: Hidráulico, Motor..." value={form.sistema} onChange={e => setForm(f => ({ ...f, sistema: e.target.value }))} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Descrição da falha recorrente <span style={{ color: 'var(--danger)' }}>*</span></label>
                <textarea className="form-control" rows={2} placeholder="O que se repete e por quê é um agressor crônico..." value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} />
              </div>
              <div className="form-row-3 form-group">
                <div>
                  <label className="form-label">Ocorrências</label>
                  <input type="number" className="form-control" placeholder="Ex: 5" value={form.ocorrencias} onChange={e => setForm(f => ({ ...f, ocorrencias: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label">Horas perdidas</label>
                  <input type="number" step="0.1" className="form-control" placeholder="Ex: 18" value={form.horas_perdidas} onChange={e => setForm(f => ({ ...f, horas_perdidas: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label">Custo total (R$)</label>
                  <input type="number" className="form-control" placeholder="Ex: 45000" value={form.custo_total} onChange={e => setForm(f => ({ ...f, custo_total: e.target.value }))} />
                </div>
              </div>

              <div style={{ borderTop: '1px dashed var(--gray-300)', margin: '8px 0 14px', paddingTop: 12 }}>
                <div className="fw-700 text-sm" style={{ marginBottom: 8 }}>✅ Plano de Ação (opcional — cria a ação no plano)</div>
                <div className="form-group">
                  <label className="form-label">Ação a executar</label>
                  <textarea className="form-control" rows={2} placeholder="O que será feito para eliminar o agressor..." value={form.plano_desc} onChange={e => setForm(f => ({ ...f, plano_desc: e.target.value }))} />
                </div>
                <div className="form-row form-group">
                  <div>
                    <label className="form-label">Responsável</label>
                    <input className="form-control" placeholder="Nome" value={form.plano_resp} onChange={e => setForm(f => ({ ...f, plano_resp: e.target.value }))} />
                  </div>
                  <div>
                    <label className="form-label">Prazo</label>
                    <input type="date" className="form-control" value={form.plano_prazo} onChange={e => setForm(f => ({ ...f, plano_prazo: e.target.value }))} />
                  </div>
                </div>
              </div>

              {erro && <div className="alert alert-danger" style={{ marginBottom: 12 }}>{erro}</div>}

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className="btn btn-outline" onClick={() => setShowModal(false)}>Cancelar</button>
                <button className="btn btn-primary" onClick={salvarAgressor} disabled={saving || !form.equipamento_tag || !form.descricao}>
                  {saving ? 'Salvando...' : '✓ Salvar Agressor'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
