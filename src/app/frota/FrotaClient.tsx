'use client'

import { useState, useMemo } from 'react'
import type { Equipamento } from '@/lib/types'
import Link from 'next/link'
import s from './FrotaClient.module.css'

/* ─── SVG Icons (white fill, from prototype) ─── */
const ICONS: Record<string, string> = {
  escavadeira: `<svg viewBox="0 0 64 64" fill="white" xmlns="http://www.w3.org/2000/svg"><rect x="6" y="36" width="28" height="14" rx="3" opacity=".95"/><rect x="8" y="26" width="16" height="12" rx="2" opacity=".9"/><rect x="4" y="48" width="32" height="7" rx="3.5" opacity=".65"/><line x1="28" y1="30" x2="50" y2="18" stroke="white" stroke-width="5" stroke-linecap="round" opacity=".95"/><line x1="48" y1="20" x2="58" y2="38" stroke="white" stroke-width="4" stroke-linecap="round" opacity=".9"/><polygon points="54,38 61,35 62,45 55,47" fill="white" opacity=".95"/></svg>`,
  trator: `<svg viewBox="0 0 64 64" fill="white" xmlns="http://www.w3.org/2000/svg"><rect x="4" y="24" width="6" height="26" rx="1" opacity=".9"/><rect x="4" y="36" width="56" height="14" rx="2" opacity=".85"/><rect x="4" y="48" width="56" height="8" rx="4" opacity=".65"/><rect x="22" y="18" width="26" height="20" rx="2" opacity=".95"/><rect x="28" y="14" width="18" height="6" rx="2" opacity=".7"/></svg>`,
  retro: `<svg viewBox="0 0 64 64" fill="white" xmlns="http://www.w3.org/2000/svg"><rect x="16" y="32" width="24" height="14" rx="2" opacity=".95"/><rect x="18" y="24" width="14" height="10" rx="2" opacity=".9"/><rect x="14" y="44" width="28" height="7" rx="3.5" opacity=".65"/><line x1="6" y1="44" x2="18" y2="34" stroke="white" stroke-width="4" stroke-linecap="round" opacity=".9"/><rect x="2" y="40" width="8" height="12" rx="2" opacity=".85"/><line x1="40" y1="30" x2="56" y2="22" stroke="white" stroke-width="4" stroke-linecap="round" opacity=".9"/><polygon points="52,24 60,22 60,32 52,34" fill="white" opacity=".9"/></svg>`,
  niveladora: `<svg viewBox="0 0 64 64" fill="white" xmlns="http://www.w3.org/2000/svg"><rect x="4" y="34" width="56" height="11" rx="2" opacity=".9"/><rect x="20" y="22" width="20" height="14" rx="2" opacity=".95"/><circle cx="10" cy="50" r="8" fill="none" stroke="white" stroke-width="4" opacity=".85"/><circle cx="54" cy="50" r="8" fill="none" stroke="white" stroke-width="4" opacity=".85"/><rect x="8" y="42" width="48" height="5" rx="2" opacity=".6"/></svg>`,
  carregadeira: `<svg viewBox="0 0 64 64" fill="white" xmlns="http://www.w3.org/2000/svg"><rect x="18" y="28" width="28" height="18" rx="2" opacity=".95"/><rect x="20" y="20" width="18" height="10" rx="2" opacity=".9"/><rect x="16" y="44" width="32" height="8" rx="4" opacity=".65"/><line x1="10" y1="38" x2="20" y2="30" stroke="white" stroke-width="5" stroke-linecap="round" opacity=".9"/><rect x="2" y="34" width="10" height="16" rx="2" opacity=".85"/></svg>`,
  caminhao: `<svg viewBox="0 0 64 64" fill="white" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="20" width="18" height="22" rx="2" opacity=".95"/><rect x="18" y="26" width="44" height="16" rx="2" opacity=".85"/><circle cx="12" cy="46" r="7" fill="none" stroke="white" stroke-width="4" opacity=".9"/><circle cx="46" cy="46" r="7" fill="none" stroke="white" stroke-width="4" opacity=".9"/><circle cx="58" cy="46" r="7" fill="none" stroke="white" stroke-width="4" opacity=".9"/></svg>`,
  bomba: `<svg viewBox="0 0 64 64" fill="white" xmlns="http://www.w3.org/2000/svg"><rect x="6" y="36" width="26" height="14" rx="3" opacity=".95"/><rect x="8" y="26" width="14" height="12" rx="2" opacity=".9"/><rect x="4" y="48" width="30" height="7" rx="3.5" opacity=".65"/><line x1="28" y1="32" x2="48" y2="24" stroke="white" stroke-width="5" stroke-linecap="round" opacity=".9"/><circle cx="54" cy="40" r="6" fill="none" stroke="white" stroke-width="3" opacity=".85"/></svg>`,
}

/* ─── Category config (keyword-based, matches DB plural/singular) ─── */
type CatConf = { bg: string; cor: string; tipo: keyof typeof ICONS }
function getCat(cat: string): CatConf {
  const c = cat.toLowerCase()
  if (c.includes('escavadeira') && (c.includes('longo') || c.includes('braço') || c.includes('lama')))
    return { bg: '#dcfce7', cor: '#166534', tipo: 'bomba' }
  if (c.includes('escavadeira'))
    return { bg: '#dbeafe', cor: '#1e429f', tipo: 'escavadeira' }
  if (c.includes('retro'))
    return { bg: '#d1fae5', cor: '#065f46', tipo: 'retro' }
  if (c.includes('carregadeira'))
    return { bg: '#ecfeff', cor: '#0e7490', tipo: 'carregadeira' }
  if (c.includes('motoniveladora') || c.includes('niveladora'))
    return { bg: '#ede9fe', cor: '#4c1d95', tipo: 'niveladora' }
  if (c.includes('carreta') || c.includes('caminhão') || c.includes('caminhao'))
    return { bg: '#ffe4e6', cor: '#9f1239', tipo: 'caminhao' }
  if (c.includes('penu') || c.includes('pneu'))
    return { bg: '#ecfeff', cor: '#0e7490', tipo: 'trator' }
  if (c.includes('esteira') || c.includes('trator'))
    return { bg: '#fef3c7', cor: '#92400e', tipo: 'trator' }
  return { bg: '#f3f4f6', cor: '#6b7280', tipo: 'escavadeira' }
}

/* ─── Status config ─── */
const ST: Record<string, { label: string; badgeBg: string; badgeColor: string; dot: string }> = {
  operando:          { label: 'Operando',     badgeBg: '#d1fae5', badgeColor: '#065f46', dot: '#10b981' },
  manutencao:        { label: 'Em Manutenção',badgeBg: '#fff7ed', badgeColor: '#c2410c', dot: '#f97316' },
  'aguardando-peca': { label: 'Ag. Peça',     badgeBg: '#fffbeb', badgeColor: '#92400e', dot: '#f59e0b' },
  critico:           { label: 'CRÍTICO',       badgeBg: '#fde8e8', badgeColor: '#9b1c1c', dot: '#ef4444' },
  parado:            { label: 'Parado',        badgeBg: '#f3f4f6', badgeColor: '#6b7280', dot: '#9ca3af' },
}
function st(status: string) { return ST[status] ?? ST['parado'] }

/* ─── Frota ordering ─── */
const FROTA_ORDER = ['PRO', 'AUX']
const FROTA_LABELS: Record<string, string> = { PRO: 'Produção', AUX: 'Auxiliar' }
const FROTA_COLORS: Record<string, string> = { PRO: '#1a56db', AUX: '#6b7280' }

/* ─── Filter types ─── */
type SF = 'todos' | 'operando' | 'manutencao' | 'aguardando-peca' | 'critico' | 'parado'
const FILTERS: [SF, string][] = [
  ['todos', 'Todos'],
  ['operando', '✅ Operando'],
  ['manutencao', '🔧 Manutenção'],
  ['aguardando-peca', '⏳ Ag. Peça'],
  ['critico', '🔴 Crítico'],
  ['parado', '⛔ Parado'],
]

export default function FrotaClient({ equipamentos }: { equipamentos: Equipamento[] }) {
  const [filter, setFilter] = useState<SF>('todos')

  const filtered = useMemo(() =>
    filter === 'todos' ? equipamentos : equipamentos.filter(e => e.status === filter),
    [equipamentos, filter])

  /* KPI counts */
  const cnt = {
    total:      equipamentos.length,
    operando:   equipamentos.filter(e => e.status === 'operando').length,
    manutencao: equipamentos.filter(e => e.status === 'manutencao').length,
    aguardando: equipamentos.filter(e => e.status === 'aguardando-peca').length,
    critico:    equipamentos.filter(e => e.status === 'critico').length,
    parado:     equipamentos.filter(e => e.status === 'parado').length,
  }

  /* Group filtered → frota → categoria */
  const grouped: Record<string, Record<string, Equipamento[]>> = {}
  for (const e of filtered) {
    if (!grouped[e.frota]) grouped[e.frota] = {}
    if (!grouped[e.frota][e.categoria]) grouped[e.frota][e.categoria] = []
    grouped[e.frota][e.categoria].push(e)
  }

  return (
    <div>

      {/* ── Topbar Actions ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '17px', fontWeight: 700, color: '#111827', marginBottom: '2px' }}>Frota de Equipamentos</h1>
          <p style={{ fontSize: '12px', color: '#9ca3af' }}>Visão geral dos {cnt.total} equipamentos organizados por categoria</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <Link href="/raf/novo" className={s.btnOutline}>＋ Nova RAF</Link>
          <Link href="/atividade/nova" className={s.btnPrimary}>＋ Nova Atividade</Link>
        </div>
      </div>

      {/* ── Fleet Summary ── */}
      <div className={s.fleetSummary}>
        {[
          { cls: '#1a56db', num: cnt.total,      label: 'Total'      },
          { cls: '#057a55', num: cnt.operando,   label: 'Operando'   },
          { cls: '#d97706', num: cnt.manutencao, label: 'Manutenção' },
          { cls: '#f59e0b', num: cnt.aguardando, label: 'Ag. Peça'   },
          { cls: '#c81e1e', num: cnt.critico,    label: 'Crítico'    },
          { cls: '#6b7280', num: cnt.parado,     label: 'Parado'     },
        ].map(({ cls, num, label }) => (
          <div key={label} className={s.fsumCard} style={{ borderTopColor: cls }}>
            <span className={s.fsumNum} style={{ color: cls }}>{num}</span>
            <span className={s.fsumLabel}>{label}</span>
          </div>
        ))}
      </div>

      {/* ── Filter bar ── */}
      <div className={s.filterBar}>
        <span className={s.filterLabel}>Filtrar por status:</span>
        {FILTERS.map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={filter === key ? s.btnPrimary : s.btnOutline}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Content ── */}
      {filtered.length === 0 ? (
        <div className={s.emptyState}>
          <div className={s.emptyIcon}>🚛</div>
          <div className={s.emptyTitle}>Nenhum equipamento encontrado</div>
          <div className={s.emptySubtitle}>Tente outro filtro de status</div>
        </div>
      ) : (
        FROTA_ORDER.filter(f => grouped[f]).map(frota => {
          const cats = grouped[frota]
          return (
            <div key={frota} className={s.frotaSection}>
              {/* Frota section header */}
              <div className={s.frotaSectionHd} style={{ background: `${FROTA_COLORS[frota]}14`, borderLeft: `4px solid ${FROTA_COLORS[frota]}` }}>
                <span style={{ fontWeight: 800, fontSize: '14px', color: FROTA_COLORS[frota] }}>
                  {frota} — {FROTA_LABELS[frota]}
                </span>
                <span style={{ fontSize: '12px', color: '#6b7280', marginLeft: '4px' }}>
                  ({Object.values(cats).flat().length} equipamentos)
                </span>
              </div>

              {/* Categories */}
              {Object.entries(cats).sort().map(([cat, items]) => {
                const conf = getCat(cat)
                const icon = ICONS[conf.tipo] ?? ICONS.escavadeira
                const opC   = items.filter(e => e.status === 'operando').length
                const mnC   = items.filter(e => e.status === 'manutencao').length
                const aguC  = items.filter(e => e.status === 'aguardando-peca').length
                const crC   = items.filter(e => e.status === 'critico').length
                const parC  = items.filter(e => e.status === 'parado').length

                return (
                  <div key={cat} className={s.fleetSection}>
                    {/* Category header */}
                    <div className={s.fleetSecHd}>
                      <span className={s.fleetSecDot} style={{ background: conf.cor }} />
                      <span className={s.fleetSecTitle}>{cat}</span>
                      <span className={s.fleetSecBadge}>{items.length} equip.</span>
                      <div className={s.fleetSecStats}>
                        {opC  > 0 && <span>✅ {opC} oper.</span>}
                        {mnC  > 0 && <span>🔧 {mnC} manut.</span>}
                        {aguC > 0 && <span>⏳ {aguC} ag.peça</span>}
                        {crC  > 0 && <span style={{ color: '#c81e1e', fontWeight: 700 }}>🔴 {crC} crít.</span>}
                        {parC > 0 && <span>⛔ {parC} parado</span>}
                      </div>
                    </div>

                    {/* Cards grid */}
                    <div className={s.fleetGrid}>
                      {items.map(eq => {
                        const cfg = st(eq.status)
                        const isCrit = eq.status === 'critico'
                        const isPar  = eq.status === 'parado'
                        return (
                          <div
                            key={eq.id}
                            className={`${s.equipCard} ${isCrit ? s.equipCardCritico : ''} ${isPar ? s.equipCardParado : ''}`}
                          >
                            {/* Icon area */}
                            <div className={s.equipIconArea} style={{ background: conf.bg }}>
                              <span className={s.equipStatusDot} style={{ background: cfg.dot }} />
                              <span dangerouslySetInnerHTML={{ __html: icon }} style={{ display: 'flex', width: 64, height: 64 }} />
                            </div>

                            {/* Card body */}
                            <div className={s.equipCardBody}>
                              <div className={s.equipId}>{eq.tag}</div>
                              <div className={s.equipModel}>{eq.modelo}</div>
                              <span className={s.equipStatusBadge} style={{ background: cfg.badgeBg, color: cfg.badgeColor }}>
                                {cfg.label}
                              </span>
                              {(eq.horimetro != null && eq.horimetro > 0) && (
                                <div className={s.equipMetaRow}>
                                  <div className={s.equipMetaItem}>
                                    <span className={s.equipMetaLabel}>H/M</span>
                                    <span className={s.equipMetaVal}>{eq.horimetro.toLocaleString('pt-BR')}h</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })
      )}
    </div>
  )
}
