'use client'
import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import type { IndicadorKPI } from '@/lib/types'

type Periodo  = 'diario' | 'semanal' | 'mensal'
type FrotaKey = 'geral' | 'EXC' | 'CAM' | 'TRE' | 'MOT' | 'BOT'

const META_DF = 85
const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

function fmtDf(v: number | null | undefined) { return v == null ? '—' : v.toFixed(1) + '%' }
function fmtH(v: number | null | undefined)  { return v == null ? '—' : v.toFixed(1)  }
function fmtData(d: string | null | undefined, daily = false) {
  if (!d) return '—'
  const [y, m, dd] = d.split('-')
  if (daily && dd) return `${dd}/${m}`
  return `${MESES[parseInt(m)-1]}/${y.slice(2)}`
}

function ChartSVG({ dados, daily = false }: { dados: IndicadorKPI[]; daily?: boolean }) {
  const sorted = [...dados].sort((a, b) => a.data_referencia.localeCompare(b.data_referencia))
  if (sorted.length < 2) return (
    <div className="empty-state" style={{ padding:'40px' }}>
      <div className="empty-state-icon">📊</div>
      <div className="empty-state-sub">Sem dados suficientes para o gráfico. Adicione mais períodos.</div>
    </div>
  )
  const W = 720, H = 180, PAD = 36
  const vals = sorted.map(d => d.df_percent ?? 0)
  const minV = Math.min(...vals, META_DF) - 3
  const maxV = Math.max(...vals, META_DF) + 3
  const xStep = (W - PAD * 2) / (sorted.length - 1)
  const toX = (i: number) => PAD + i * xStep
  const toY = (v: number) => PAD + (H - PAD * 2) * (1 - (v - minV) / (maxV - minV))
  const metaY = toY(META_DF)
  return (
    <svg viewBox={`0 0 ${W} ${H + 32}`} style={{ width:'100%', overflow:'visible' }}>
      <line x1={PAD} y1={metaY} x2={W-PAD} y2={metaY}
        stroke="var(--danger)" strokeWidth="1.5" strokeDasharray="6,4" opacity=".7" />
      <text x={W-PAD+4} y={metaY+4} fontSize="10" fill="var(--danger)" opacity=".8">Meta {META_DF}%</text>
      {sorted.map((_, i) => (
        <line key={i} x1={toX(i)} y1={PAD} x2={toX(i)} y2={H-PAD}
          stroke="var(--gray-100)" strokeWidth="1" />
      ))}
      <polyline
        points={sorted.map((d, i) => `${toX(i)},${toY(d.df_percent ?? 0)}`).join(' ')}
        fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {sorted.map((d, i) => {
        const ok = (d.df_percent ?? 0) >= META_DF
        return (
          <g key={i}>
            <circle cx={toX(i)} cy={toY(d.df_percent ?? 0)} r="6"
              fill={ok ? 'var(--success)' : 'var(--danger)'} stroke="#fff" strokeWidth="2" />
            <text x={toX(i)} y={toY(d.df_percent ?? 0) - 10} textAnchor="middle"
              fontSize="9" fontWeight="700" fill={ok ? 'var(--success)' : 'var(--danger)'}>
              {fmtDf(d.df_percent)}
            </text>
          </g>
        )
      })}
      {sorted.map((d, i) => (
        <text key={i} x={toX(i)} y={H + 22} textAnchor="middle" fontSize="9" fill="var(--gray-400)">
          {fmtData(d.data_referencia, daily)}
        </text>
      ))}
    </svg>
  )
}

const FROTAS: { key: FrotaKey; label: string }[] = [
  { key:'geral', label:'Frota Completa' },
  { key:'EXC',   label:'Escavadeiras' },
  { key:'CAM',   label:'Caminhões' },
  { key:'TRE',   label:'Tratores' },
  { key:'MOT',   label:'Motoniveladoras' },
  { key:'BOT',   label:'Outros' },
]

export default function IndicadoresPage() {
  const [kpis, setKpis]       = useState<IndicadorKPI[]>([])
  const [loading, setLoading] = useState(true)
  const [periodo, setPeriodo] = useState<Periodo>('mensal')
  const [frota, setFrota]     = useState<FrotaKey>('geral')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm]       = useState({ frota:'geral', tipo:'mensal', data:'', df:'', mtbf:'', mttr:'', obs:'' })
  const [saving, setSaving]   = useState(false)

  useEffect(() => {
    supabase.from('indicadores_kpi').select('*').order('data_referencia', { ascending: false }).then(({ data }) => {
      setKpis(data ?? [])
      setLoading(false)
    })
  }, [])

  const dados = useMemo(() =>
    kpis.filter(k => k.tipo_periodo === periodo && k.frota === frota)
      .sort((a, b) => a.data_referencia.localeCompare(b.data_referencia)),
    [kpis, periodo, frota]
  )

  const atual = dados[dados.length - 1] ?? null

  const abaixoMeta = dados.filter(d => (d.df_percent ?? 999) < META_DF)

  async function salvarKpi() {
    if (!form.df || !form.data) return
    setSaving(true)
    const { data: novo } = await supabase.from('indicadores_kpi').insert({
      frota: form.frota,
      tipo_periodo: form.tipo,
      data_referencia: form.data,
      df_percent: Number(form.df),
      mtbf_horas: form.mtbf ? Number(form.mtbf) : null,
      mttr_horas: form.mttr ? Number(form.mttr) : null,
      observacoes: form.obs || null,
    }).select().single()
    if (novo) setKpis(prev => [...prev, novo])
    setSaving(false)
    setShowModal(false)
    setForm({ frota:'geral', tipo:'mensal', data:'', df:'', mtbf:'', mttr:'', obs:'' })
  }

  if (loading) return (
    <div>
      <div className="page-header"><div className="page-title">📈 Indicadores</div></div>
      <div className="empty-state"><div className="empty-state-icon">⏳</div><div className="empty-state-sub">Carregando...</div></div>
    </div>
  )

  return (
    <div>
      <div className="page-header">
        <div className="page-title">📈 Indicadores de Desempenho</div>
        <div className="page-sub">KPIs de disponibilidade, confiabilidade e manutenabilidade da frota</div>
      </div>

      {/* ── Selector Card ── */}
      <div className="card mb20" style={{ padding: 0 }}>
        <div className="card-body">
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:20, flexWrap:'wrap' }}>
            <div>
              <div className="form-label" style={{ marginBottom:8 }}>Período de Análise</div>
              <div className="period-selector">
                <button className={`period-btn ${periodo === 'diario' ? 'active' : ''}`}
                  onClick={() => setPeriodo('diario')}>Diário</button>
                <button className={`period-btn ${periodo === 'semanal' ? 'active' : ''}`}
                  onClick={() => setPeriodo('semanal')}>Semanal</button>
                <button className={`period-btn ${periodo === 'mensal' ? 'active' : ''}`}
                  onClick={() => setPeriodo('mensal')}>Mensal</button>
              </div>
            </div>
            <div>
              <div className="form-label" style={{ marginBottom:8 }}>Frota / Escopo</div>
              <div className="frota-selector">
                {FROTAS.map(f => (
                  <button key={f.key}
                    className={`frota-btn ${frota === f.key ? 'active' : ''}`}
                    onClick={() => setFrota(f.key)}>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ alignSelf:'flex-end' }}>
              <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>
                ＋ Lançar Indicadores
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── KPI Metric Cards ── */}
      <div className="kpi-metric-grid">
        <div className="kpi-metric-card df">
          <div className="kpi-metric-label">Disponibilidade Física (DF%)</div>
          <div className="kpi-metric-val">
            {atual?.df_percent != null ? atual.df_percent.toFixed(1) : '—'}
            {atual?.df_percent != null && <span className="kpi-metric-unit">%</span>}
          </div>
          <div className="kpi-metric-target">
            <span className={`badge ${atual?.df_percent != null && atual.df_percent >= META_DF ? 'badge-success' : 'badge-danger'}`}>
              {atual?.df_percent != null && atual.df_percent >= META_DF ? '✓ Acima da meta' : '⚠ Abaixo de 85%'}
            </span>
          </div>
        </div>
        <div className="kpi-metric-card mtbf">
          <div className="kpi-metric-label">MTBF — Tempo Médio entre Falhas</div>
          <div className="kpi-metric-val">
            {atual?.mtbf_horas != null ? atual.mtbf_horas.toFixed(1) : '—'}
            {atual?.mtbf_horas != null && <span className="kpi-metric-unit">h</span>}
          </div>
          <div className="kpi-metric-target text-muted text-xs">
            Maior = melhor confiabilidade
          </div>
        </div>
        <div className="kpi-metric-card mttr">
          <div className="kpi-metric-label">MTTR — Tempo Médio de Reparo</div>
          <div className="kpi-metric-val">
            {atual?.mttr_horas != null ? atual.mttr_horas.toFixed(1) : '—'}
            {atual?.mttr_horas != null && <span className="kpi-metric-unit">h</span>}
          </div>
          <div className="kpi-metric-target text-muted text-xs">
            Menor = melhor manutenabilidade
          </div>
        </div>
      </div>

      {/* ── Chart Card ── */}
      <div className="card mb20" style={{ padding: 0 }}>
        <div className="card-hd">
          <span className="card-title">
            DF% — Histórico {periodo === 'mensal' ? 'Mensal' : periodo === 'semanal' ? 'Semanal' : 'Diário'}
            {' · '}{FROTAS.find(f => f.key === frota)?.label}
          </span>
          <div style={{ display:'flex', gap:12, fontSize:11, color:'var(--gray-500)', alignItems:'center' }}>
            <span style={{ display:'flex',alignItems:'center',gap:4 }}>
              <span style={{width:8,height:8,borderRadius:'50%',background:'var(--success)',display:'inline-block'}}/> Acima meta
            </span>
            <span style={{ display:'flex',alignItems:'center',gap:4 }}>
              <span style={{width:8,height:8,borderRadius:'50%',background:'var(--danger)',display:'inline-block'}}/> Abaixo
            </span>
          </div>
        </div>
        <div className="card-body"><ChartSVG dados={dados} daily={periodo === 'diario'} /></div>
      </div>

      {/* ── Abaixo da Meta ── */}
      {abaixoMeta.length > 0 && (
        <div className="card mb20" style={{ padding:0 }}>
          <div className="card-hd">
            <span className="card-title" style={{ color:'var(--danger)' }}>⚠ Períodos abaixo da meta ({META_DF}%)</span>
            <span className="badge badge-danger">{abaixoMeta.length}</span>
          </div>
          <div>
            {abaixoMeta.map(d => (
              <div key={d.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 20px', borderBottom:'1px solid var(--gray-100)' }}>
                <span className="fw-700 text-danger">{fmtDf(d.df_percent)}</span>
                <span className="badge badge-danger">-{(META_DF - (d.df_percent ?? 0)).toFixed(1)}%</span>
                <span className="text-sm text-muted">Referência: {fmtData(d.data_referencia, periodo === 'diario')}</span>
                <span className="text-xs text-muted">MTBF: {fmtH(d.mtbf_horas)}h · MTTR: {fmtH(d.mttr_horas)}h</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Histórico Table ── */}
      <div className="card" style={{ padding:0 }}>
        <div className="card-hd">
          <span className="card-title">Histórico de Indicadores</span>
          <span className="text-xs text-muted">{dados.length} registro{dados.length !== 1 ? 's' : ''}</span>
        </div>
        {dados.length === 0 ? (
          <div className="empty-state" style={{ padding:'48px' }}>
            <div className="empty-state-icon">📈</div>
            <div className="empty-state-title">Sem dados para esta combinação</div>
            <div className="empty-state-sub">Lance indicadores usando o botão "+ Lançar Indicadores"</div>
          </div>
        ) : (
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr><th>Período</th><th>DF%</th><th>vs Meta</th><th>MTBF (h)</th><th>MTTR (h)</th><th>Status</th></tr>
              </thead>
              <tbody>
                {[...dados].reverse().map(d => {
                  const ok = (d.df_percent ?? 0) >= META_DF
                  const delta = d.df_percent != null ? d.df_percent - META_DF : null
                  return (
                    <tr key={d.id}>
                      <td className="fw-600">{fmtData(d.data_referencia, periodo === 'diario')}</td>
                      <td><span className={ok ? 'fw-700 text-success' : 'fw-700 text-danger'}>{fmtDf(d.df_percent)}</span></td>
                      <td>
                        {delta != null
                          ? <span className={`badge ${ok ? 'badge-success' : 'badge-danger'}`}>{delta >= 0 ? '+' : ''}{delta.toFixed(1)}%</span>
                          : '—'}
                      </td>
                      <td>{fmtH(d.mtbf_horas)}</td>
                      <td>{fmtH(d.mttr_horas)}</td>
                      <td>
                        <span className={`badge ${ok ? 'badge-success' : 'badge-danger'}`}>
                          {ok ? '✓ Meta' : '⚠ Abaixo'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Modal Lançar Indicadores ── */}
      {showModal && (
        <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,.5)',zIndex:100,display:'flex',alignItems:'center',justifyContent:'center',padding:20 }}>
          <div style={{ background:'#fff',borderRadius:12,width:'100%',maxWidth:520,boxShadow:'0 20px 60px rgba(0,0,0,.2)' }}>
            <div style={{ padding:'20px 24px',borderBottom:'1px solid var(--gray-200)',display:'flex',alignItems:'center',justifyContent:'space-between' }}>
              <span style={{ fontWeight:700,fontSize:15 }}>Lançar Indicadores</span>
              <button className="btn btn-ghost btn-xs" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div style={{ padding:24 }}>
              <div className="form-row form-group">
                <div>
                  <label className="form-label">Frota / Escopo</label>
                  <select className="form-control" value={form.frota} onChange={e => setForm(f => ({...f, frota:e.target.value}))}>
                    {FROTAS.map(fr => <option key={fr.key} value={fr.key}>{fr.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Tipo de Período</label>
                  <select className="form-control" value={form.tipo} onChange={e => setForm(f => ({...f, tipo:e.target.value}))}>
                    <option value="diario">Diário</option>
                    <option value="semanal">Semanal</option>
                    <option value="mensal">Mensal</option>
                  </select>
                </div>
              </div>
              <div className="form-row form-group">
                <div>
                  <label className="form-label">Data de Referência <span className="req">*</span></label>
                  <input type="date" className="form-control" value={form.data} onChange={e => setForm(f => ({...f, data:e.target.value}))} />
                </div>
                <div>
                  <label className="form-label">DF% <span className="req">*</span></label>
                  <input type="number" step="0.1" min="0" max="100" className="form-control" placeholder="Ex: 85.3"
                    value={form.df} onChange={e => setForm(f => ({...f, df:e.target.value}))} />
                </div>
              </div>
              <div className="form-row form-group">
                <div>
                  <label className="form-label">MTBF (horas)</label>
                  <input type="number" step="0.1" className="form-control" placeholder="Ex: 220"
                    value={form.mtbf} onChange={e => setForm(f => ({...f, mtbf:e.target.value}))} />
                </div>
                <div>
                  <label className="form-label">MTTR (horas)</label>
                  <input type="number" step="0.1" className="form-control" placeholder="Ex: 5.2"
                    value={form.mttr} onChange={e => setForm(f => ({...f, mttr:e.target.value}))} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Observação</label>
                <textarea className="form-control" rows={2} placeholder="Eventos relevantes do período..."
                  value={form.obs} onChange={e => setForm(f => ({...f, obs:e.target.value}))} />
              </div>
              <div style={{ display:'flex',gap:8,justifyContent:'flex-end' }}>
                <button className="btn btn-outline" onClick={() => setShowModal(false)}>Cancelar</button>
                <button className="btn btn-primary" onClick={salvarKpi}
                  disabled={saving || !form.df || !form.data}>
                  {saving ? 'Salvando...' : '✓ Salvar Indicadores'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
