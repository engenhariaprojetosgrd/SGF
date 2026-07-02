'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { Equipamento } from '@/lib/types'

async function uploadFoto(file: File, pasta: string): Promise<string | null> {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
  const path = pasta + '/' + Date.now() + '-' + Math.random().toString(36).slice(2) + '.' + ext
  const { error } = await supabase.storage.from('anexos').upload(path, file)
  if (error) { console.error(error); return null }
  return supabase.storage.from('anexos').getPublicUrl(path).data.publicUrl
}

const PASSOS = [
  { num: 1, label: 'Identificação' }, { num: 2, label: 'Contextualização' }, { num: 3, label: 'Impacto' },
  { num: 4, label: 'Ferramenta' }, { num: 5, label: 'Causa Raiz' }, { num: 6, label: 'Plano de Ação' }, { num: 7, label: 'Relatório' },
]
const TOOLS = [
  { val: 'pq', ico: '🔗', name: '5 Porquês', desc: 'Cadeia de perguntas encadeadas até a causa raiz' },
  { val: 'ish', ico: '🐟', name: 'Ishikawa', desc: 'Diagrama espinha de peixe — 6 categorias (6 Ms)' },
  { val: 'ft', ico: '🌲', name: 'Árvore de Falha', desc: 'Estrutura top-down com portas lógicas AND/OR' },
]
const ISH_CATS = [
  { key: 'maquina', label: 'Máquina', cor: '#1a56db', ico: '⚙️' }, { key: 'metodo', label: 'Método', cor: '#d97706', ico: '📋' },
  { key: 'material', label: 'Material', cor: '#057a55', ico: '📦' }, { key: 'maodeobra', label: 'Mão de Obra', cor: '#6b7280', ico: '👷' },
  { key: 'meioamb', label: 'Meio Ambiente', cor: '#9333ea', ico: '🌍' }, { key: 'medicao', label: 'Medição', cor: '#c81e1e', ico: '📏' },
]

type FTNode = { id: string; text: string; gate: 'AND' | 'OR'; children: FTNode[] }
const newFT = (): FTNode => ({ id: Math.random().toString(36).slice(2), text: '', gate: 'AND', children: [] })
function ftUpdate(n: FTNode, id: string, fn: (x: FTNode) => FTNode): FTNode {
  if (n.id === id) return fn(n)
  return { ...n, children: n.children.map(c => ftUpdate(c, id, fn)) }
}
function ftRemove(n: FTNode, id: string): FTNode {
  return { ...n, children: n.children.filter(c => c.id !== id).map(c => ftRemove(c, id)) }
}

type Form = {
  numero_raf: string; data_ocorrencia: string; equipamento_tag: string; componente: string
  local_ocorrencia: string; operador: string; descricao_falha: string; responsavel: string
  hist_similar: string; hist_detalhe: string; condicoes_op: string; ultima_pm: string; horas_operacao: string
  parada_horas: string; custo_estimado: string; impacto_producao: string; risco_seguranca: string; impacto_ambiental: string
  ferramenta: string; por_ques: string[]; ishikawa: Record<string, string[]>; ishikawa_efeito: string
  causa_raiz: string; fatores: string; deteccao: string; conclusao: string
}
const FORM0: Form = {
  numero_raf: 'RAF-2026-', data_ocorrencia: '', equipamento_tag: '', componente: '', local_ocorrencia: '', operador: '', descricao_falha: '', responsavel: '',
  hist_similar: '', hist_detalhe: '', condicoes_op: '', ultima_pm: '', horas_operacao: '',
  parada_horas: '', custo_estimado: '', impacto_producao: 'Parada total', risco_seguranca: 'Crítico — risco de acidente', impacto_ambiental: '',
  ferramenta: 'pq', por_ques: ['', '', '', '', ''], ishikawa: {}, ishikawa_efeito: '',
  causa_raiz: '', fatores: '', deteccao: '', conclusao: '',
}

export default function RafNovoPage() {
  const [passo, setPasso] = useState(1)
  const [form, setForm] = useState<Form>(FORM0)
  const [equips, setEquips] = useState<Equipamento[]>([])
  const [acoes, setAcoes] = useState([{ desc: '', resp: '', prazo: '' }])
  const [ishInput, setIshInput] = useState<Record<string, string>>({})
  const [ft, setFt] = useState<FTNode>({ id: 'root', text: '', gate: 'AND', children: [] })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [foto, setFoto] = useState<File | null>(null)

  useEffect(() => {
    supabase.from('equipamentos').select('id,tag,modelo').order('tag').then(({ data }) => setEquips((data ?? []) as Equipamento[]))
  }, [])

  function set(field: keyof Form, val: string) { setForm(f => ({ ...f, [field]: val })) }
  function setPorQue(i: number, val: string) { setForm(f => { const a = [...f.por_ques]; a[i] = val; return { ...f, por_ques: a } }) }
  function addCause(key: string) {
    const v = (ishInput[key] ?? '').trim(); if (!v) return
    setForm(f => ({ ...f, ishikawa: { ...f.ishikawa, [key]: [...(f.ishikawa[key] ?? []), v] } }))
    setIshInput(s => ({ ...s, [key]: '' }))
  }
  function rmCause(key: string, i: number) { setForm(f => ({ ...f, ishikawa: { ...f.ishikawa, [key]: (f.ishikawa[key] ?? []).filter((_, j) => j !== i) } })) }
  const addChild = (id: string) => setFt(t => ftUpdate(t, id, n => ({ ...n, children: [...n.children, newFT()] })))
  const setFtText = (id: string, text: string) => setFt(t => ftUpdate(t, id, n => ({ ...n, text })))
  const toggleGate = (id: string) => setFt(t => ftUpdate(t, id, n => ({ ...n, gate: n.gate === 'AND' ? 'OR' : 'AND' })))
  const rmFt = (id: string) => setFt(t => ftRemove(t, id))

  function renderFT(node: FTNode, isRoot: boolean, onAddSibling: (() => void) | null) {
    const cls = isRoot ? 'top' : node.children.length ? 'interm' : 'basic'
    return (
      <div className="ft-node" key={node.id}>
        <div className={'ft-box ' + cls}>
          <input value={node.text} placeholder={isRoot ? 'Evento topo (falha)...' : 'Causa...'} onChange={e => setFtText(node.id, e.target.value)} />
          <div className="ft-actions">
            <button title="Adicionar caixa abaixo" onClick={() => addChild(node.id)}>＋↓</button>
            {onAddSibling && <button title="Adicionar caixa ao lado" onClick={onAddSibling}>＋→</button>}
            {!isRoot && <button title="Remover" onClick={() => rmFt(node.id)}>✕</button>}
          </div>
        </div>
        {node.children.length > 0 && (
          <>
            <div className="ft-line-v" />
            <div className={'gate-sym ' + (node.gate === 'AND' ? 'gate-and' : 'gate-or')} onClick={() => toggleGate(node.id)} title="Alternar AND / OR">{node.gate}</div>
            <div className="ft-line-v" />
            <div className="ft-level">{node.children.map(ch => renderFT(ch, false, () => addChild(node.id)))}</div>
          </>
        )}
      </div>
    )
  }

  async function salvar() {
    setErro(null); setSaving(true)
    const equipId = equips.find(e => e.tag === form.equipamento_tag)?.id ?? null
    const ferraDb = form.ferramenta === 'pq' ? '5pqs' : form.ferramenta === 'ish' ? 'ishikawa' : 'fta'
    let foto_url: string | null = null
    if (foto) {
      foto_url = await uploadFoto(foto, 'rafs')
      if (!foto_url) { setErro('Falha ao enviar a foto. Verifique se o bucket "anexos" existe.'); setSaving(false); return }
    }
    const { data: raf, error } = await supabase.from('rafs').insert({
      numero_raf: form.numero_raf || null, equipamento_id: equipId, equipamento_tag: form.equipamento_tag || null,
      data_ocorrencia: form.data_ocorrencia ? form.data_ocorrencia.slice(0, 10) : null,
      local_ocorrencia: form.local_ocorrencia || null, operador: form.operador || null, responsavel: form.responsavel || null,
      descricao_falha: form.descricao_falha || null,
      custo_estimado: form.custo_estimado ? Number(form.custo_estimado) : null, parada_horas: form.parada_horas ? Number(form.parada_horas) : null,
      ferramenta_analise: ferraDb,
      cinco_pqs: form.ferramenta === 'pq' ? form.por_ques.filter(Boolean) : null,
      ishikawa: form.ferramenta === 'ish' ? { efeito: form.ishikawa_efeito, causas: form.ishikawa } : null,
      fta: form.ferramenta === 'ft' ? ft : null,
      causa_raiz: form.causa_raiz || null, foto_url, status: 'em_analise', recorrente: form.hist_similar === 'sim',
    }).select().single()
    if (error) { setErro('Erro ao salvar: ' + error.message); setSaving(false); return }
    if (raf) {
      const validas = acoes.filter(a => a.desc.trim())
      if (validas.length > 0) await supabase.from('acoes').insert(validas.map(a => ({
        raf_id: raf.id, equipamento_tag: form.equipamento_tag || null, tipo: 'Corretiva Estrutural',
        descricao: a.desc, responsavel: a.resp || '—', prazo: a.prazo || null, status: 'pendente',
      })))
      setSaved(true)
    }
    setSaving(false)
  }

  const titulo: Record<number, string> = {
    1: '1. Identificação da Falha', 2: '2. Contextualização', 3: '3. Avaliação de Impacto',
    4: '4. Ferramenta de Análise', 5: '5. Causa Raiz e Fatores Contribuintes', 6: '6. Plano de Ação', 7: '7. Revisão e Relatório Final',
  }

  if (saved) return (
    <div>
      <div className="page-header"><div className="page-title">🔍 RAF</div></div>
      <div className="card" style={{ textAlign: 'center', padding: 48 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>RAF registrada com sucesso!</div>
        <div className="text-muted text-sm" style={{ marginBottom: 24 }}>A análise foi salva e as ações vinculadas ao plano.</div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button className="btn btn-primary" onClick={() => { setForm(FORM0); setAcoes([{ desc: '', resp: '', prazo: '' }]); setFt({ id: 'root', text: '', gate: 'AND', children: [] }); setFoto(null); setPasso(1); setSaved(false) }}>Nova RAF</button>
        </div>
      </div>
    </div>
  )

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div className="page-title">🔍 RAF</div>
          <div className="page-sub">Relatório de Análise de Falha — clique em qualquer etapa para navegar</div>
        </div>
        <a href="/raf" className="btn btn-outline btn-sm">← Voltar</a>
      </div>

      <div className="wizard-steps">
        {PASSOS.map(p => (
          <div key={p.num} className={'wstep ' + (passo === p.num ? 'active' : passo > p.num ? 'done' : '')} onClick={() => setPasso(p.num)} style={{ cursor: 'pointer' }}>
            <span className="wnum">{passo > p.num ? '✓' : p.num}</span>{p.label}
          </div>
        ))}
      </div>

      <div className="w-body">
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 20, color: 'var(--gray-800)' }}>{titulo[passo]}</div>

        {passo === 1 && (
          <>
            <div className="form-row form-group">
              <div><label className="form-label">Nº RAF <span className="req">*</span></label><input className="form-control" placeholder="RAF-2026-001" value={form.numero_raf} onChange={e => set('numero_raf', e.target.value)} /></div>
              <div><label className="form-label">Data / Hora da Falha <span className="req">*</span></label><input type="datetime-local" className="form-control" value={form.data_ocorrencia} onChange={e => set('data_ocorrencia', e.target.value)} /></div>
            </div>
            <div className="form-row form-group">
              <div><label className="form-label">Equipamento (Tag) <span className="req">*</span></label>
                <select className="form-control" value={form.equipamento_tag} onChange={e => set('equipamento_tag', e.target.value)}><option value="">— selecione —</option>{equips.map(e => <option key={e.id} value={e.tag}>{e.tag} — {e.modelo}</option>)}</select>
              </div>
              <div><label className="form-label">Componente / Sistema <span className="req">*</span></label><input className="form-control" placeholder="Ex: Sistema de supressão de incêndio" value={form.componente} onChange={e => set('componente', e.target.value)} /></div>
            </div>
            <div className="form-row form-group">
              <div><label className="form-label">Local / Frente de Trabalho</label><input className="form-control" placeholder="Ex: Frente Norte — Bancada 3" value={form.local_ocorrencia} onChange={e => set('local_ocorrencia', e.target.value)} /></div>
              <div><label className="form-label">Operador / Responsável na Ocorrência</label><input className="form-control" placeholder="Nome completo" value={form.operador} onChange={e => set('operador', e.target.value)} /></div>
            </div>
            <div className="form-group"><label className="form-label">Descrição Detalhada da Falha <span className="req">*</span></label><textarea className="form-control" rows={4} placeholder="Descreva o que aconteceu, como foi percebido, condições no momento..." value={form.descricao_falha} onChange={e => set('descricao_falha', e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Responsável pela Análise</label><input className="form-control" placeholder="Eng. responsável pela condução da RAF" value={form.responsavel} onChange={e => set('responsavel', e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Foto da Falha (opcional)</label><input type="file" accept="image/*" className="form-control" onChange={e => setFoto(e.target.files?.[0] ?? null)} />{foto && <div className="text-xs text-muted" style={{ marginTop: 4 }}>📎 {foto.name}</div>}</div>
          </>
        )}

        {passo === 2 && (
          <>
            <div className="form-group">
              <label className="form-label">Histórico de Falhas Similares</label>
              <div style={{ display: 'flex', gap: 16, margin: '4px 0 8px' }}>
                {[['sim', 'Sim, já ocorreu antes'], ['nao', 'Não, primeira ocorrência']].map(([v, l]) => (
                  <label key={v} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}><input type="radio" name="hist" checked={form.hist_similar === v} onChange={() => set('hist_similar', v)} /> {l}</label>
                ))}
              </div>
              {form.hist_similar === 'sim' && <textarea className="form-control" rows={2} placeholder="Datas, máquinas e natureza das ocorrências anteriores..." value={form.hist_detalhe} onChange={e => set('hist_detalhe', e.target.value)} />}
            </div>
            <div className="form-group"><label className="form-label">Condições Operacionais no Momento</label><textarea className="form-control" rows={2} placeholder="Carga, ciclo, clima, turno, tempo de operação no dia..." value={form.condicoes_op} onChange={e => set('condicoes_op', e.target.value)} /></div>
            <div className="form-row form-group">
              <div><label className="form-label">Última Manutenção Preventiva</label><input className="form-control" placeholder="Data e descrição da última PM" value={form.ultima_pm} onChange={e => set('ultima_pm', e.target.value)} /></div>
              <div><label className="form-label">Horas de Operação no Momento da Falha</label><input type="number" className="form-control" placeholder="Ex: 4250" value={form.horas_operacao} onChange={e => set('horas_operacao', e.target.value)} /></div>
            </div>
          </>
        )}

        {passo === 3 && (
          <>
            <div className="form-row form-group">
              <div><label className="form-label">Tempo de Parada (horas) <span className="req">*</span></label><input type="number" step="0.5" className="form-control" placeholder="Ex: 12" value={form.parada_horas} onChange={e => set('parada_horas', e.target.value)} /></div>
              <div><label className="form-label">Custo Total Estimado (R$) <span className="req">*</span></label><input type="number" className="form-control" placeholder="Ex: 98000" value={form.custo_estimado} onChange={e => set('custo_estimado', e.target.value)} /></div>
            </div>
            <div className="form-row form-group">
              <div><label className="form-label">Impacto na Produção</label><select className="form-control" value={form.impacto_producao} onChange={e => set('impacto_producao', e.target.value)}><option>Parada total</option><option>Produção reduzida</option><option>Sem impacto direto</option></select></div>
              <div><label className="form-label">Risco à Segurança</label><select className="form-control" value={form.risco_seguranca} onChange={e => set('risco_seguranca', e.target.value)}><option>Crítico — risco de acidente</option><option>Alto — quase-acidente</option><option>Médio — risco potencial</option><option>Baixo — sem risco imediato</option></select></div>
            </div>
            <div className="form-group"><label className="form-label">Impacto Ambiental</label><textarea className="form-control" rows={2} placeholder="Derramamento, emissões ou outro impacto ambiental..." value={form.impacto_ambiental} onChange={e => set('impacto_ambiental', e.target.value)} /></div>
            {form.custo_estimado && Number(form.custo_estimado) > 50000 && <div className="alert alert-danger"><span className="alert-ico">⚠️</span><div><strong>Alto impacto financeiro.</strong> Custo acima de R$ 50.000.</div></div>}
          </>
        )}

        {passo === 4 && (
          <>
            <div className="tool-grid">
              {TOOLS.map(t => (
                <div key={t.val} className={'tool-opt ' + (form.ferramenta === t.val ? 'selected' : '')} onClick={() => set('ferramenta', t.val)}>
                  <div className="tool-ico">{t.ico}</div><div className="tool-name">{t.name}</div><div className="tool-desc">{t.desc}</div>
                </div>
              ))}
            </div>

            {form.ferramenta === 'pq' && (
              <div className="card" style={{ padding: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>🔗 Análise — 5 Porquês</div>
                {form.por_ques.map((pq, i) => (
                  <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 12 }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: i === form.por_ques.length - 1 ? 'var(--danger)' : 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, flexShrink: 0, marginTop: 2 }}>{i + 1}</div>
                    <div style={{ flex: 1 }}>
                      <label className="form-label" style={{ marginBottom: 4 }}>Por quê {i + 1}? {i === form.por_ques.length - 1 && <span style={{ color: 'var(--danger)' }}>(causa raiz)</span>}</label>
                      <textarea className="form-control" rows={2} placeholder={'Por quê ' + (i + 1) + '...'} value={pq} onChange={e => setPorQue(i, e.target.value)} />
                    </div>
                    {form.por_ques.length > 1 && <button className="btn btn-ghost btn-xs" style={{ marginTop: 26 }} onClick={() => setForm(f => ({ ...f, por_ques: f.por_ques.filter((_, j) => j !== i) }))}>✕</button>}
                  </div>
                ))}
                <button className="add-pq" onClick={() => setForm(f => ({ ...f, por_ques: [...f.por_ques, ''] }))}>＋ Adicionar Porquê</button>
              </div>
            )}

            {form.ferramenta === 'ish' && (
              <div className="card" style={{ padding: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>🐟 Análise — Diagrama de Ishikawa</div>
                <div className="ishikawa-bones">
                  {ISH_CATS.map(c => (
                    <div className="bone" key={c.key}>
                      <div className="bone-hd"><span>{c.ico}</span><span className="bone-label" style={{ color: c.cor }}>{c.label}</span></div>
                      <div className="bone-causes">
                        {(form.ishikawa[c.key] ?? []).map((cause, i) => (
                          <div className="bone-cause" key={i}><span>{cause}</span><button onClick={() => rmCause(c.key, i)}>✕</button></div>
                        ))}
                      </div>
                      <div className="add-cause-row">
                        <input placeholder="Nova causa..." value={ishInput[c.key] ?? ''} onChange={e => setIshInput(s => ({ ...s, [c.key]: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') addCause(c.key) }} />
                        <button className="btn btn-outline btn-xs" onClick={() => addCause(c.key)}>＋</button>
                      </div>
                    </div>
                  ))}
                  <div className="ishikawa-effect">
                    <label>Efeito — Falha Analisada</label>
                    <input className="form-control" style={{ maxWidth: 400, margin: '0 auto', textAlign: 'center' }} placeholder="Descreva a falha (efeito final)" value={form.ishikawa_efeito} onChange={e => set('ishikawa_efeito', e.target.value)} />
                  </div>
                </div>
              </div>
            )}

            {form.ferramenta === 'ft' && (
              <div className="card" style={{ padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>🌲 Análise — Árvore de Falha (FTA)</div>
                </div>
                <div className="ft-wrap"><div className="ft-tree">{renderFT(ft, true, null)}</div></div>
                <div className="alert alert-info" style={{ marginTop: 12 }}><span className="alert-ico">💡</span><div>Use <b>＋↓</b> para adicionar uma caixa <b>abaixo</b> (causa filha) e <b>＋→</b> para adicionar uma caixa <b>ao lado</b> (mesma camada). Clique na porta <b>AND/OR</b> para alternar a lógica.</div></div>
              </div>
            )}
          </>
        )}

        {passo === 5 && (
          <>
            <div className="form-group"><label className="form-label">Causa Raiz Identificada <span className="req">*</span></label><textarea className="form-control" rows={3} style={{ borderColor: 'var(--danger)' }} placeholder="Descreva a causa raiz real identificada pela análise..." value={form.causa_raiz} onChange={e => set('causa_raiz', e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Fatores Contribuintes</label><textarea className="form-control" rows={2} placeholder="Outros fatores: falhas de processo, treinamento, etc." value={form.fatores} onChange={e => set('fatores', e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Esta falha poderia ter sido detectada antes?</label><textarea className="form-control" rows={2} placeholder="Quais mecanismos de detecção falharam?" value={form.deteccao} onChange={e => set('deteccao', e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Conclusão da Análise <span className="req">*</span></label><textarea className="form-control" rows={3} placeholder="Narrativa conclusiva da análise..." value={form.conclusao} onChange={e => set('conclusao', e.target.value)} /></div>
          </>
        )}

        {passo === 6 && (
          <>
            {acoes.map((a, i) => (
              <div key={i} style={{ border: '1px solid var(--gray-200)', borderRadius: 8, padding: 16, marginBottom: 12, background: 'var(--gray-50)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--gray-700)' }}>Ação {i + 1}</span>
                  {acoes.length > 1 && <button className="btn btn-ghost btn-xs" onClick={() => setAcoes(ac => ac.filter((_, j) => j !== i))}>✕ Remover</button>}
                </div>
                <div className="form-group"><label className="form-label">Descrição da Ação <span className="req">*</span></label><textarea className="form-control" rows={2} placeholder="O que será feito..." value={a.desc} onChange={e => setAcoes(ac => ac.map((x, j) => j === i ? { ...x, desc: e.target.value } : x))} /></div>
                <div className="form-row">
                  <div><label className="form-label">Responsável</label><input className="form-control" placeholder="Nome" value={a.resp} onChange={e => setAcoes(ac => ac.map((x, j) => j === i ? { ...x, resp: e.target.value } : x))} /></div>
                  <div><label className="form-label">Prazo</label><input type="date" className="form-control" value={a.prazo} onChange={e => setAcoes(ac => ac.map((x, j) => j === i ? { ...x, prazo: e.target.value } : x))} /></div>
                </div>
              </div>
            ))}
            <button className="btn btn-outline btn-sm" onClick={() => setAcoes(ac => [...ac, { desc: '', resp: '', prazo: '' }])}>＋ Adicionar Ação</button>
          </>
        )}

        {passo === 7 && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
              <div className="sum-card primary"><div className="sum-label">Equipamento</div><div style={{ fontSize: 18, fontWeight: 700 }}>{form.equipamento_tag || '—'}</div></div>
              <div className="sum-card danger"><div className="sum-label">Custo Estimado</div><div className="sum-value" style={{ fontSize: 22 }}>{form.custo_estimado ? 'R$ ' + Number(form.custo_estimado).toLocaleString('pt-BR') : '—'}</div></div>
            </div>
            {([['Nº RAF', form.numero_raf], ['Data / Hora', form.data_ocorrencia], ['Componente', form.componente], ['Local', form.local_ocorrencia], ['Operador', form.operador], ['Responsável', form.responsavel], ['Horas de Parada', form.parada_horas ? form.parada_horas + 'h' : ''], ['Ferramenta', TOOLS.find(t => t.val === form.ferramenta)?.name ?? '']] as [string, string][]).map(([l, v]) => (
              <div key={l} style={{ display: 'flex', borderBottom: '1px solid var(--gray-100)', padding: '6px 0' }}><div style={{ width: 160, fontSize: 12, fontWeight: 700, color: 'var(--gray-500)' }}>{l}</div><div className="text-sm">{v || '—'}</div></div>
            ))}
            {[['Descrição da Falha', form.descricao_falha], ['Causa Raiz', form.causa_raiz], ['Conclusão', form.conclusao]].map(([l, v]) => (
              <div key={l} style={{ borderTop: '1px solid var(--gray-200)', paddingTop: 14, marginTop: 14 }}><div className="form-label">{l}</div><div className="text-sm" style={{ color: 'var(--gray-700)', lineHeight: 1.6 }}>{v || '—'}</div></div>
            ))}
            <div style={{ borderTop: '1px solid var(--gray-200)', paddingTop: 14, marginTop: 14 }}>
              <div className="form-label" style={{ marginBottom: 8 }}>Ações do Plano ({acoes.filter(a => a.desc).length})</div>
              {acoes.filter(a => a.desc).map((a, i) => (
                <div key={i} className="action-row"><div className="ac-bullet" style={{ background: 'var(--primary-light)', borderColor: 'var(--primary)', color: 'var(--primary)' }}>{i + 1}</div><div style={{ flex: 1 }}><div className="ac-desc">{a.desc}</div><div className="ac-meta">{a.resp && <span>{a.resp}</span>}{a.prazo && <span>Prazo: {a.prazo}</span>}</div></div></div>
              ))}
            </div>
            {erro && <div className="alert alert-danger" style={{ marginTop: 16 }}>{erro}</div>}
          </>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>{passo > 1 && <button className="btn btn-outline" onClick={() => setPasso(p => p - 1)}>← Anterior</button>}</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {passo < 7 && <button className="btn btn-primary" onClick={() => setPasso(p => p + 1)}>Próximo →</button>}
          {passo === 7 && <button className="btn btn-success" onClick={salvar} disabled={saving}>{saving ? 'Salvando...' : '✓ Salvar RAF'}</button>}
        </div>
      </div>
    </div>
  )
}
