'use client'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { IndicadorKPI, Equipamento } from '@/lib/types'

const META = 85
const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const hojeStr = () => new Date().toISOString().slice(0, 10)

function fmtDf(v: number | null | undefined) { return v == null ? '—' : v.toFixed(1) + '%' }
function fmtH(v: number | null | undefined) { return v == null ? '—' : v.toFixed(1) + 'h' }
function fmtMesAno(d: string) { const p = d.split('-'); return MESES[+p[1] - 1] + '/' + p[0].slice(2) }
function fmtDiaMes(d: string) { const p = d.split('-'); return p[2] + '/' + p[1] }
function isoWeek(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  const t = new Date(d.valueOf())
  const dayNr = (d.getDay() + 6) % 7
  t.setDate(t.getDate() - dayNr + 3)
  const firstThu = t.valueOf()
  t.setMonth(0, 1)
  if (t.getDay() !== 4) t.setMonth(0, 1 + ((4 - t.getDay()) + 7) % 7)
  return 1 + Math.ceil((firstThu - t.valueOf()) / 604800000)
}
function dfColor(v: number | null | undefined) {
  if (v == null) return 'var(--gray-400)'
  if (v >= META) return 'var(--success)'
  if (v >= META - 5) return 'var(--warning)'
  return 'var(--danger)'
}
function normStatus(s: string | null | undefined) {
  return (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[-_\s]/g, '')
}
const STATUS_MAP: Record<string, { label: string; dot: string }> = {
  operando: { label: 'Operando', dot: 'var(--success)' },
  manutencao: { label: 'Em Manutenção', dot: 'var(--warning)' },
  aguardandopeca: { label: 'Ag. Peça', dot: '#7c3aed' },
  critico: { label: 'Crítico', dot: 'var(--danger)' },
  parado: { label: 'Parado', dot: 'var(--gray-400)' },
}
const statusInfo = (s: string | null | undefined) => STATUS_MAP[normStatus(s)] ?? { label: s ?? '—', dot: 'var(--gray-400)' }

function LineChart({ pts, color, height = 130 }: { pts: { lab: string; v: number }[]; color: string; daily?: boolean; height?: number }) {
  if (pts.length < 2) return (
    <div className="empty-state" style={{ padding: 20 }}>
      <div className="empty-state-icon">📈</div>
      <div className="empty-state-sub">Sem dados suficientes</div>
    </div>
  )
  const W = 680, H = height, PAD = 30
  const vals = pts.map(p => p.v)
  const minV = Math.min(...vals, META) - 3
  const maxV = Math.max(...vals, META) + 3
  const xStep = (W - PAD * 2) / (pts.length - 1)
  const toX = (i: number) => PAD + i * xStep
  const toY = (v: number) => PAD + (H - PAD * 2) * (1 - (v - minV) / (maxV - minV))
  const metaY = toY(META)
  return (
    <svg viewBox={'0 0 ' + W + ' ' + (H + 26)} style={{ width: '100%', overflow: 'visible' }}>
      <line x1={PAD} y1={metaY} x2={W - PAD} y2={metaY} stroke="var(--danger)" strokeWidth="1.5" strokeDasharray="6,4" opacity=".6" />
      <text x={W - PAD + 4} y={metaY + 4} fontSize="9" fill="var(--danger)" opacity=".8">Meta {META}%</text>
      <polyline points={pts.map((p, i) => toX(i) + ',' + toY(p.v)).join(' ')} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((p, i) => {
        const ok = p.v >= META
        return (
          <g key={i}>
            <circle cx={toX(i)} cy={toY(p.v)} r="4.5" fill={ok ? 'var(--success)' : 'var(--danger)'} stroke="#fff" strokeWidth="2" />
            <text x={toX(i)} y={toY(p.v) - 9} textAnchor="middle" fontSize="9" fontWeight="700" fill={ok ? 'var(--success)' : 'var(--danger)'}>{p.v.toFixed(1)}</text>
            <text x={toX(i)} y={H + 16} textAnchor="middle" fontSize="9" fill="var(--gray-400)">{p.lab}</text>
          </g>
        )
      })}
    </svg>
  )
}

function MiniLine({ pts, color, unit, height = 110 }: { pts: { lab: string; v: number }[]; color: string; unit: string; height?: number }) {
  if (pts.length < 2) return <div className="empty-state" style={{ padding: 16 }}><div className="empty-state-sub">Sem dados</div></div>
  const W = 680, H = height, PAD = 26
  const vals = pts.map(p => p.v)
  const minV = Math.min(...vals) * 0.95
  const maxV = Math.max(...vals) * 1.05 || 1
  const xStep = (W - PAD * 2) / (pts.length - 1)
  const toX = (i: number) => PAD + i * xStep
  const toY = (v: number) => PAD + (H - PAD * 2) * (1 - (v - minV) / (maxV - minV || 1))
  return (
    <svg viewBox={'0 0 ' + W + ' ' + (H + 22)} style={{ width: '100%', overflow: 'visible' }}>
      <polyline points={pts.map((p, i) => toX(i) + ',' + toY(p.v)).join(' ')} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={toX(i)} cy={toY(p.v)} r="4" fill={color} stroke="#fff" strokeWidth="2" />
          <text x={toX(i)} y={toY(p.v) - 8} textAnchor="middle" fontSize="9" fontWeight="700" fill={color}>{p.v.toFixed(1)}{unit}</text>
          <text x={toX(i)} y={H + 14} textAnchor="middle" fontSize="9" fill="var(--gray-400)">{p.lab}</text>
        </g>
      ))}
    </svg>
  )
}

export default function FarolPage() {
  const [kpis, setKpis] = useState<IndicadorKPI[]>([])
  const [equip, setEquip] = useState<Equipamento[]>([])
  const [loading, setLoading] = useState(true)
  const [frotaSel, setFrotaSel] = useState<string>('todas')
  const [openTop, setOpenTop] = useState(true)
  const [expSemana, setExpSemana] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      supabase.from('indicadores_kpi').select('*').order('data_referencia', { ascending: true }),
      supabase.from('equipamentos').select('*').order('categoria').order('tag'),
    ]).then(([k, e]) => {
      setKpis((k.data ?? []) as IndicadorKPI[])
      setEquip((e.data ?? []) as Equipamento[])
      setLoading(false)
    })
  }, [])

  const categorias = useMemo(() => [...new Set(equip.map(e => e.categoria).filter(Boolean))].sort(), [equip])

  const latest = (frota: string, tipo: IndicadorKPI['tipo_periodo'], excludeToday = false) => {
    const arr = kpis.filter(k => k.frota === frota && k.tipo_periodo === tipo && (!excludeToday || k.data_referencia !== hojeStr()))
    return arr.length ? arr[arr.length - 1] : null
  }
  const diarioHoje = (frota: string) => kpis.find(k => k.frota === frota && k.tipo_periodo === 'diario' && k.data_referencia === hojeStr()) ?? null

  const gDiaAnt = latest('geral', 'diario', true)
  const gRitmo = diarioHoje('geral')
  const gSemana = latest('geral', 'semanal')
  const gMes = latest('geral', 'mensal')

  const topCards = [
    { label: 'DF — Dia Anterior', val: fmtDf(gDiaAnt?.df_percent), color: 'var(--primary)', sub: gDiaAnt ? fmtDiaMes(gDiaAnt.data_referencia) : 'Sem dados', dfv: gDiaAnt?.df_percent },
    { label: 'Ritmo Hoje (até 7h)', val: fmtDf(gRitmo?.df_percent), color: 'var(--warning)', sub: gRitmo ? 'Parcial do dia' : 'Sem lançamento', dfv: gRitmo?.df_percent },
    { label: 'Acum. Semana', val: fmtDf(gSemana?.df_percent), color: 'var(--success)', sub: gSemana ? 'S' + isoWeek(gSemana.data_referencia) : 'Sem dados', dfv: gSemana?.df_percent },
    { label: 'Acum. Mês', val: fmtDf(gMes?.df_percent), color: 'var(--danger)', sub: gMes ? fmtMesAno(gMes.data_referencia) : 'Sem dados', dfv: gMes?.df_percent },
    { label: 'MTBF — Mensal', val: fmtH(gMes?.mtbf_horas), color: '#7c3aed', sub: 'Tempo médio entre falhas', dfv: null as number | null | undefined },
    { label: 'MTTR — Mensal', val: fmtH(gMes?.mttr_horas), color: '#0d9488', sub: 'Tempo médio de reparo', dfv: null as number | null | undefined },
  ]

  const linhasFrota = categorias.map(cat => ({
    cat,
    qtd: equip.filter(e => e.categoria === cat).length,
    mes: latest(cat, 'mensal')?.df_percent ?? null,
    s1: latest(cat, 'semanal')?.df_percent ?? null,
    d1: latest(cat, 'diario', true)?.df_percent ?? null,
    ritmo: diarioHoje(cat)?.df_percent ?? null,
  }))

  const frotaGrafico = frotaSel === 'todas' ? 'geral' : frotaSel
  const labelFrota = frotaSel === 'todas' ? 'Geral' : frotaSel
  const mesAtual = hojeStr().slice(0, 7)
  const mesCorrente = kpis.filter(k => k.frota === frotaGrafico && k.tipo_periodo === 'diario' && k.data_referencia.startsWith(mesAtual)).map(k => ({ lab: fmtDiaMes(k.data_referencia), v: k.df_percent }))

  const mensalFrota = kpis.filter(k => k.frota === frotaGrafico && k.tipo_periodo === 'mensal')
  const serieDF = mensalFrota.map(k => ({ lab: fmtMesAno(k.data_referencia), v: k.df_percent }))
  const serieMTBF = mensalFrota.filter(k => k.mtbf_horas != null).map(k => ({ lab: fmtMesAno(k.data_referencia), v: k.mtbf_horas as number }))
  const serieMTTR = mensalFrota.filter(k => k.mttr_horas != null).map(k => ({ lab: fmtMesAno(k.data_referencia), v: k.mttr_horas as number }))

  const abaixoSemana = categorias.map(cat => ({ cat, kpi: latest(cat, 'semanal') })).filter(x => x.kpi?.df_percent != null && x.kpi.df_percent < META)

  const equipFiltrado = frotaSel === 'todas' ? equip : equip.filter(e => e.categoria === frotaSel)
  const dfDoMes = (cat: string) => latest(cat, 'mensal')?.df_percent ?? null

  if (loading) return (
    <div>
      <div className="page-header"><div className="page-title">🚦 Farol Diário</div></div>
      <div className="empty-state"><div className="empty-state-icon">⏳</div><div className="empty-state-sub">Carregando...</div></div>
    </div>
  )

  return (
    <div>
      <div className="page-header">
        <div className="page-title">🚦 Farol Diário</div>
        <div className="page-sub">Disponibilidade física e performance da frota — meta {META}%</div>
      </div>

      <div className="farol-strip">
        {topCards.map((c, i) => (
          <div key={i} className="farol-pill" style={{ borderTopColor: c.color }}>
            <div className="farol-pill-label">{c.label}</div>
            <div className="farol-pill-val" style={{ color: c.dfv != null ? dfColor(c.dfv) : 'var(--gray-800)' }}>{c.val}</div>
            <div className="farol-pill-sub">{c.sub}</div>
          </div>
        ))}
      </div>

      <div className="card mb20" style={{ padding: 14 }}>
        <div className="form-label" style={{ marginBottom: 8 }}>Frota / Categoria</div>
        <div className="frota-selector">
          <button className={'frota-btn ' + (frotaSel === 'todas' ? 'active' : '')} onClick={() => setFrotaSel('todas')}>Todas as Frotas</button>
          {categorias.map(cat => (
            <button key={cat} className={'frota-btn ' + (frotaSel === cat ? 'active' : '')} onClick={() => setFrotaSel(cat)}>{cat}</button>
          ))}
        </div>
      </div>

      {/* Linha 1: tabela por frota (esq) + 3 gráficos mensais (dir) */}
      <div className="grid g2 mb20" style={{ alignItems: 'stretch' }}>
        <div className="card" style={{ padding: 0 }}>
          <div className="card-hd">
            <span className="card-title">📊 Indicadores por Frota</span>
            <button className="btn btn-ghost btn-xs" title={openTop ? 'Recolher' : 'Expandir'} onClick={() => setOpenTop(o => !o)}>{openTop ? '▲' : '▼'}</button>
          </div>
          {openTop ? (linhasFrota.length === 0 ? (
            <div className="empty-state" style={{ padding: 32 }}><div className="empty-state-icon">📊</div><div className="empty-state-sub">Nenhuma categoria cadastrada</div></div>
          ) : (
            <div className="tbl-wrap">
              <table>
                <thead><tr><th>Frota</th><th>DF Mês</th><th>S-1</th><th>D-1</th><th>Ritmo 7h</th></tr></thead>
                <tbody>
                  {linhasFrota.map(l => (
                    <tr key={l.cat}>
                      <td className="fw-700">{l.cat}<div className="text-xs text-muted">{l.qtd} equip.</div></td>
                      <td><span className="fw-700" style={{ color: dfColor(l.mes) }}>{fmtDf(l.mes)}</span></td>
                      <td className="text-sm" style={{ color: dfColor(l.s1) }}>{fmtDf(l.s1)}</td>
                      <td className="text-sm" style={{ color: dfColor(l.d1) }}>{fmtDf(l.d1)}</td>
                      <td className="text-sm" style={{ color: dfColor(l.ritmo) }}>{fmtDf(l.ritmo)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )) : null}
        </div>

        <div className="card" style={{ padding: 0, display: 'flex', flexDirection: 'column' }}>
          <div className="card-hd">
            <span className="card-title">📈 DF / MTBF / MTTR — Histórico Mensal · {labelFrota}</span>
            <button className="btn btn-ghost btn-xs" title={openTop ? 'Recolher' : 'Expandir'} onClick={() => setOpenTop(o => !o)}>{openTop ? '▲' : '▼'}</button>
          </div>
          {openTop ? (
            <div className="card-body" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-around', gap: 8 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary)', marginBottom: 2 }}>DF (%)</div>
                <LineChart pts={serieDF} color="var(--primary)" height={120} />
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#7c3aed', marginBottom: 2 }}>MTBF (h)</div>
                <MiniLine pts={serieMTBF} color="#7c3aed" unit="h" height={100} />
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#0d9488', marginBottom: 2 }}>MTTR (h)</div>
                <MiniLine pts={serieMTTR} color="#0d9488" unit="h" height={100} />
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Linha 2: DF diária mês corrente */}
      <div className="card mb20" style={{ padding: 0 }}>
        <div className="card-hd">
          <span className="card-title">📅 DF Diária — Mês Corrente · {labelFrota}</span>
          <button className="btn btn-ghost btn-xs" title={openTop ? 'Recolher' : 'Expandir'} onClick={() => setOpenTop(o => !o)}>{openTop ? '▲' : '▼'}</button>
        </div>
        {openTop ? <div className="card-body"><LineChart pts={mesCorrente} color="var(--primary)" daily height={150} /></div> : null}
      </div>

      {/* Status da Frota */}
      <div className="card mb20" style={{ padding: 0 }}>
        <div className="card-hd">
          <span className="card-title">🚧 Status da Frota — {equipFiltrado.length} equipamentos {frotaSel !== 'todas' ? '· ' + frotaSel : ''}</span>
        </div>
        <div className="card-body">
          {equipFiltrado.length === 0 ? (
            <div className="empty-state"><div className="empty-state-icon">🚧</div><div className="empty-state-sub">Nenhum equipamento</div></div>
          ) : (
            <div className="fleet-grid">
              {equipFiltrado.map(e => {
                const si = statusInfo(e.status)
                const df = dfDoMes(e.categoria)
                const pct = df != null ? Math.max(0, Math.min(100, df)) : 0
                const cls = df == null ? '' : df >= META ? 'success' : df >= META - 5 ? 'warning' : 'danger'
                return (
                  <div key={e.id} className="equip-card">
                    <div className="equip-icon-area" style={{ background: 'var(--gray-100)', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', height: 56 }}>
                      <svg viewBox="0 0 44 44" width="40" height="40" fill="none">
                        <rect x="4" y="18" width="36" height="16" rx="4" fill="var(--gray-400)" />
                        <rect x="8" y="14" width="20" height="10" rx="3" fill="var(--gray-500)" />
                        <circle cx="12" cy="35" r="5" fill="var(--gray-600)" /><circle cx="32" cy="35" r="5" fill="var(--gray-600)" />
                      </svg>
                      <div style={{ position: 'absolute', top: 6, right: 6, width: 9, height: 9, borderRadius: '50%', background: si.dot, border: '2px solid #fff' }} />
                    </div>
                    <div className="equip-card-body">
                      <div className="equip-id">{e.tag}</div>
                      <div className="equip-model">{e.modelo}</div>
                      <span className="equip-status-badge" style={{ color: si.dot }}>{si.label}</span>
                      <div style={{ marginTop: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--gray-500)', marginBottom: 3 }}>
                          <span>DF Mês</span><span className="fw-700" style={{ color: dfColor(df) }}>{fmtDf(df)}</span>
                        </div>
                        <div className="pb-wrap"><div className={'pb ' + cls} style={{ width: pct + '%' }} /></div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Frotas abaixo da meta semanal */}
      <div className="card" style={{ padding: 0 }}>
        <div className="card-hd">
          <span className="card-title" style={{ color: abaixoSemana.length ? 'var(--danger)' : undefined }}>⚠️ Frotas abaixo da meta na semana — gatilho de Plano de Ação</span>
          <span className={'badge ' + (abaixoSemana.length ? 'badge-danger' : 'badge-success')}>{abaixoSemana.length}</span>
        </div>
        {abaixoSemana.length === 0 ? (
          <div className="empty-state" style={{ padding: 32 }}><div className="empty-state-icon">✅</div><div className="empty-state-sub">Nenhuma frota fechou a semana abaixo da meta</div></div>
        ) : (
          <div className="tbl-wrap">
            <table>
              <thead><tr><th>Frota</th><th>Semana</th><th>DF Semana</th><th>Déficit</th><th>Referência</th><th>Resumo</th></tr></thead>
              <tbody>
                {abaixoSemana.map(({ cat, kpi }) => {
                  const aberto = expSemana === cat
                  const temResumo = !!(kpi!.ap_motivo || kpi!.ap_plano || kpi!.ap_responsavel || kpi!.ap_prazo)
                  return (
                    <>
                      <tr key={cat} className="clickable" onClick={() => setExpSemana(aberto ? null : cat)}>
                        <td className="fw-700">{cat}</td>
                        <td><span className="badge badge-gray">Semana {isoWeek(kpi!.data_referencia)}</span></td>
                        <td><span className="fw-700 text-danger">{fmtDf(kpi!.df_percent)}</span></td>
                        <td><span className="badge badge-danger">-{(META - kpi!.df_percent).toFixed(1)}%</span></td>
                        <td className="text-xs text-muted">{fmtDiaMes(kpi!.data_referencia)}</td>
                        <td><button className="btn btn-ghost btn-xs">{aberto ? '▲' : '▼'}</button></td>
                      </tr>
                      {aberto && (
                        <tr key={cat + '-d'}>
                          <td colSpan={6} style={{ background: 'var(--gray-50)' }}>
                            {temResumo ? (
                              <div style={{ padding: '8px 4px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                                <div><span className="fw-700 text-sm">Causa / Motivo da baixa DF:</span><div className="text-sm" style={{ color: 'var(--gray-700)' }}>{kpi!.ap_motivo ?? '—'}</div></div>
                                <div><span className="fw-700 text-sm">Intervenção / Plano:</span><div className="text-sm" style={{ color: 'var(--gray-700)' }}>{kpi!.ap_plano ?? '—'}</div></div>
                                <div style={{ display: 'flex', gap: 24, fontSize: 12, color: 'var(--gray-600)' }}>
                                  <span><b>Responsável:</b> {kpi!.ap_responsavel ?? '—'}</span>
                                  <span><b>Prazo:</b> {kpi!.ap_prazo ?? '—'}</span>
                                </div>
                                <a href="/acoes" className="btn btn-outline btn-xs" style={{ alignSelf: 'flex-start' }}>Abrir Plano de Ação →</a>
                              </div>
                            ) : (
                              <div className="text-sm text-muted" style={{ padding: '8px 4px' }}>
                                Nenhum resumo registrado para esta frota. Preencha motivo, intervenção e responsável ao lançar o indicador semanal abaixo da meta.
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
