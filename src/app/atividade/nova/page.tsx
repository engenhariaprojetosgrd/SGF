'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { Equipamento } from '@/lib/types'

type Status = 'pendente' | 'em_execucao' | 'ag_peca' | 'concluida'

type Form = {
  equipamento_tag: string
  om_num: string
  turno: string
  tipo_manutencao: string
  criticidade: string
  sistema: string
  subsistema: string
  sintoma: string
  causa: string
  intervencao: string
  executante: string
  hh: string
  status: Status
  observacoes: string
}

const INIT: Form = {
  equipamento_tag:'', om_num:'', turno:'A',
  tipo_manutencao:'corretiva', criticidade:'media',
  sistema:'', subsistema:'', sintoma:'', causa:'', intervencao:'',
  executante:'', hh:'', status:'pendente', observacoes:'',
}

const CAP = (s: string) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s
const CRIT_MAP: Record<string, string> = { critico: 'Crítica', alta: 'Alta', media: 'Média', baixa: 'Baixa' }
const STAT_MAP: Record<string, string> = { pendente: 'pendente', em_execucao: 'em_execucao', ag_peca: 'aguardando_peca', concluida: 'concluido' }

export default function NovaAtividadePage() {
  const [form, setForm]         = useState<Form>(INIT)
  const [equips, setEquips]     = useState<Equipamento[]>([])
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)
  const [rascunho, setRascunho] = useState(false)

  useEffect(() => {
    supabase.from('equipamentos').select('id,tag,modelo').order('tag').then(({ data }) => setEquips((data ?? []) as Equipamento[]))
  }, [])

  useEffect(() => {
    setForm(f => ({ ...f, om_num: 'OM-' + new Date().getFullYear() + '-' + Date.now().toString().slice(-6) }))
  }, [])

  function set(field: keyof Form, val: string) { setForm(f => ({ ...f, [field]: val })) }

  async function salvar(isRascunho = false) {
    setSaving(true)
    setRascunho(isRascunho)
    await supabase.from('ordens_manutencao').insert({
      numero_om:        form.om_num,
      equipamento_id:   equips.find(e => e.tag === form.equipamento_tag)?.id ?? null,
      equipamento_tag:  form.equipamento_tag || null,
      turno:            form.turno,
      tipo:             CAP(form.tipo_manutencao),
      criticidade:      CRIT_MAP[form.criticidade] ?? form.criticidade,
      sistema:          form.sistema || null,
      subsistema:       form.subsistema || null,
      sintoma:          form.sintoma || null,
      causa:            form.causa || null,
      intervencao:      form.intervencao || null,
      executantes:      form.executante || null,
      hh_executado:     form.hh ? Number(form.hh) : null,
      status:           STAT_MAP[isRascunho ? 'pendente' : form.status] ?? (isRascunho ? 'pendente' : form.status),
      observacoes:      form.observacoes || null,
    })
    setSaving(false)
    setSaved(true)
  }

  if (saved) return (
    <div>
      <div className="page-header"><div className="page-title">➕ Nova Atividade</div></div>
      <div className="card" style={{ textAlign:'center', padding: 48 }}>
        <div style={{ fontSize:48, marginBottom:16 }}>{rascunho ? '📝' : '✅'}</div>
        <div style={{ fontSize:18, fontWeight:700, marginBottom:8 }}>
          {rascunho ? 'Rascunho salvo!' : 'Atividade lançada!'}
        </div>
        <div className="text-muted text-sm" style={{ marginBottom:24 }}>
          {rascunho ? 'A atividade foi salva como rascunho no Kanban.' : 'A atividade foi lançada no turno ' + form.turno + '.'}
        </div>
        <div style={{ display:'flex', gap:12, justifyContent:'center' }}>
          <button className="btn btn-outline" onClick={() => { setForm(INIT); setSaved(false) }}>Nova Atividade</button>
          <a href="/kanban" className="btn btn-primary">← Voltar ao Kanban</a>
        </div>
      </div>
    </div>
  )

  return (
    <div>
      <div className="page-header" style={{ display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:12 }}>
        <div>
          <div className="page-title">➕ Nova Atividade</div>
          <div className="page-sub">Registro de atividade de manutenção no turno</div>
        </div>
        <a href="/kanban" className="btn btn-outline btn-sm">← Voltar ao Kanban</a>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="card-hd"><span className="card-title">Dados da Atividade</span></div>
        <div className="card-body">
          {/* Linha 1: Tag, Nº OM readonly, Turno */}
          <div className="form-row-3 form-group">
            <div>
              <label className="form-label">Equipamento (Tag) <span className="req">*</span></label>
              <select className="form-control" value={form.equipamento_tag} onChange={e => set('equipamento_tag', e.target.value)}>
                <option value="">— selecione —</option>
                {equips.map(e => <option key={e.id} value={e.tag}>{e.tag} — {e.modelo}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Nº OM</label>
              <input className="form-control" placeholder="Gerado automaticamente" value={form.om_num} readOnly
                style={{ background:'var(--gray-50)', color:'var(--gray-500)' }} />
            </div>
            <div>
              <label className="form-label">Turno <span className="req">*</span></label>
              <div style={{ display:'flex', gap:8, marginTop:4 }}>
                {['A','B','C'].map(t => (
                  <label key={t} style={{ display:'flex',alignItems:'center',gap:6,cursor:'pointer',fontSize:13,padding:'8px 14px',border:`2px solid ${form.turno===t?'var(--primary)':'var(--gray-200)'}`,borderRadius:6,background:form.turno===t?'var(--primary-light)':'#fff' }}>
                    <input type="radio" name="turno" value={t} checked={form.turno===t} onChange={() => set('turno',t)} style={{ display:'none' }} />
                    Turno {t}
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Linha 2: Tipo + Criticidade */}
          <div className="form-row form-group">
            <div>
              <label className="form-label">Tipo de Manutenção <span className="req">*</span></label>
              <select className="form-control" value={form.tipo_manutencao} onChange={e => set('tipo_manutencao', e.target.value)}>
                <option value="corretiva">Corretiva</option>
                <option value="preventiva">Preventiva</option>
                <option value="preditiva">Preditiva</option>
                <option value="melhoria">Melhoria</option>
              </select>
            </div>
            <div>
              <label className="form-label">Criticidade <span className="req">*</span></label>
              <select className="form-control" value={form.criticidade} onChange={e => set('criticidade', e.target.value)}>
                <option value="critico">🔴 Crítico</option>
                <option value="alta">🟡 Alta</option>
                <option value="media">🔵 Média</option>
                <option value="baixa">⚪ Baixa</option>
              </select>
            </div>
          </div>

          {/* Linha 3: Sistema + Subsistema */}
          <div className="form-row form-group">
            <div>
              <label className="form-label">Sistema</label>
              <input className="form-control" placeholder="Ex: Motor, Hidráulico, Elétrico..."
                value={form.sistema} onChange={e => set('sistema', e.target.value)} />
            </div>
            <div>
              <label className="form-label">Subsistema</label>
              <input className="form-control" placeholder="Ex: Bomba, Circuito, Sensor..."
                value={form.subsistema} onChange={e => set('subsistema', e.target.value)} />
            </div>
          </div>

          {/* Linha 4: Sintoma + Causa */}
          <div className="form-row form-group">
            <div>
              <label className="form-label">Sintoma Observado <span className="req">*</span></label>
              <input className="form-control" placeholder="O que o operador/técnico observou..."
                value={form.sintoma} onChange={e => set('sintoma', e.target.value)} />
            </div>
            <div>
              <label className="form-label">Causa Identificada</label>
              <input className="form-control" placeholder="Causa aparente ou provável..."
                value={form.causa} onChange={e => set('causa', e.target.value)} />
            </div>
          </div>

          {/* Intervenção */}
          <div className="form-group">
            <label className="form-label">Intervenção Realizada</label>
            <textarea className="form-control" rows={4}
              placeholder="Descreva o serviço executado, peças substituídas, ajustes realizados..."
              value={form.intervencao} onChange={e => set('intervencao', e.target.value)} />
          </div>

          {/* Linha 5: Executantes + H/H + Status */}
          <div className="form-row-3 form-group">
            <div>
              <label className="form-label">Executante(s)</label>
              <input className="form-control" placeholder="Nome(s) do(s) técnico(s)"
                value={form.executante} onChange={e => set('executante', e.target.value)} />
            </div>
            <div>
              <label className="form-label">H/H Gasto (horas)</label>
              <input type="number" step="0.5" className="form-control" placeholder="Ex: 2.5"
                value={form.hh} onChange={e => set('hh', e.target.value)} />
            </div>
            <div>
              <label className="form-label">Status</label>
              <select className="form-control" value={form.status} onChange={e => set('status', e.target.value as Status)}>
                <option value="pendente">Pendente</option>
                <option value="em_execucao">Em Execução</option>
                <option value="ag_peca">Aguardando Peça</option>
                <option value="concluida">Concluída</option>
              </select>
            </div>
          </div>

          {/* Observações */}
          <div className="form-group">
            <label className="form-label">Observações</label>
            <textarea className="form-control" rows={2} placeholder="Informações adicionais..."
              value={form.observacoes} onChange={e => set('observacoes', e.target.value)} />
          </div>
        </div>

        {/* Rodapé com botões */}
        <div style={{ padding:'16px 20px', borderTop:'1px solid var(--gray-100)', display:'flex', gap:12, justifyContent:'flex-end' }}>
          <a href="/kanban" className="btn btn-outline">← Voltar ao Kanban</a>
          <button className="btn btn-outline" onClick={() => salvar(true)} disabled={saving}>
            📝 Salvar Rascunho
          </button>
          <button className="btn btn-primary" onClick={() => salvar(false)} disabled={saving || !form.equipamento_tag || !form.sintoma}>
            {saving ? 'Salvando...' : '✓ Lançar Atividade'}
          </button>
        </div>
      </div>
    </div>
  )
}
