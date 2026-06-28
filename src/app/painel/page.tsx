'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { OrdemManutencao, RAF, Agressor, Acao, IndicadorKPI } from '@/lib/types'

function diasAte(data: string | null | undefined) {
  if (!data) return null
  const d = new Date(data); const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  return Math.round((d.getTime() - hoje.getTime()) / 86400000)
}
function fmtData(data: string | null | undefined) {
  if (!data) return '—'
  return new Date(data).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' })
}

function Calendario() {
  const hoje = new Date()
  const ano = hoje.getFullYear(), mes = hoje.getMonth()
  const diasMes = new Date(ano, mes + 1, 0).getDate()
  const primeiroDow = new Date(ano, mes, 1).getDay()
  const semanas: (number | null)[][] = []
  let semana: (number | null)[] = Array(primeiroDow).fill(null)
  for (let d = 1; d <= diasMes; d++) { semana.push(d); if (semana.length === 7) { semanas.push(semana); semana = [] } }
  if (semana.length) semanas.push([...semana, ...Array(7 - semana.length).fill(null)])
  const nomes = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']
  const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  return (
    <div style={{ fontFamily: 'inherit' }}>
      <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 13, marginBottom: 10, color: 'var(--gray-700)' }}>{meses[mes]} {ano}</div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead><tr>{nomes.map((n, i) => <th key={i} style={{ textAlign: 'center', color: 'var(--gray-400)', fontWeight: 600, paddingBottom: 6 }}>{n}</th>)}</tr></thead>
        <tbody>
          {semanas.map((sem, si) => (
            <tr key={si}>{sem.map((dia, di) => (
              <td key={di} style={{ textAlign: 'center', padding: '4px 2px' }}>
                {dia !== null && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: '50%', background: dia === hoje.getDate() ? 'var(--primary)' : 'transparent', color: dia === hoje.getDate() ? '#fff' : 'var(--gray-700)', fontWeight: dia === hoje.getDate() ? 700 : 400 }}>{dia}</span>
                )}
              </td>
            ))}</tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function PainelPage() {
  const [oms, setOms] = useState<OrdemManutencao[]>([])
  const [rafs, setRafs] = useState<RAF[]>([])
  const [agres, setAgres] = useState<Agressor[]>([])
  const [acoes, setAcoes] = useState<Acao[]>([])
  const [kpi, setKpi] = useState<IndicadorKPI | null>(null)

  useEffect(() => {
    Promise.all([
      supabase.from('ordens_manutencao').select('*'),
      supabase.from('rafs').select('*'),
      supabase.from('agressores').select('*'),
      supabase.from('acoes').select('*'),
      supabase.from('indicadores_kpi').select('*').eq('frota', 'geral').eq('tipo_periodo', 'mensal').order('data_referencia', { ascending: false }).limit(1),
    ]).then(([omRes, rafRes, agrRes, acaoRes, kpiRes]) => {
      setOms((omRes.data ?? []) as OrdemManutencao[])
      setRafs((rafRes.data ?? []) as RAF[])
      setAgres((agrRes.data ?? []) as Agressor[])
      setAcoes((acaoRes.data ?? []) as Acao[])
      setKpi((kpiRes.data?.[0] ?? null) as IndicadorKPI | null)
    })
  }, [])

  const rafsCriticos = rafs.filter(r => r.status !== 'concluido').length
  const agressoresAtiv = agres.filter(a => a.status !== 'resolvido').length
  const acAtrasadas = acoes.filter(a => { const d = diasAte(a.prazo); return d !== null && d < 0 && a.status !== 'concluida' }).length
  const ac7dias = acoes.filter(a => { const d = diasAte(a.prazo); return d !== null && d >= 0 && d <= 7 && a.status !== 'concluida' }).length

  const alertas: { tipo: string; ico: string; msg: string }[] = []
  if (acAtrasadas > 0) alertas.push({ tipo: 'danger', ico: '🔴', msg: `${acAtrasadas} ação${acAtrasadas > 1 ? 'ões' : ''} atrasada${acAtrasadas > 1 ? 's' : ''} no plano — requer atenção imediata` })
  if (rafsCriticos > 0 && rafs.some(r => r.status === 'em_analise')) alertas.push({ tipo: 'warning', ico: '⚠️', msg: `${rafsCriticos} RAF${rafsCriticos > 1 ? 's' : ''} em análise — causa raiz pendente` })
  if (kpi && kpi.df_percent !== null && kpi.df_percent < 85) alertas.push({ tipo: 'warning', ico: '📉', msg: `DF mensal em ${kpi.df_percent.toFixed(1)}% — abaixo da meta de 85%` })
  if (agressoresAtiv > 0) alertas.push({ tipo: 'info', ico: '🔵', msg: `${agressoresAtiv} agressor${agressoresAtiv > 1 ? 'es' : ''} ativo${agressoresAtiv > 1 ? 's' : ''} — monitorar para RAF` })

  const acoesEmAndamento = acoes.filter(a => a.status === 'em_andamento').slice(0, 5)
  const acoesConcluidas = acoes.filter(a => a.status === 'concluida').length
  const totalAcoes = acoes.length
  const pctGlobal = totalAcoes > 0 ? Math.round((acoesConcluidas / totalAcoes) * 100) : 0
  const acoesLista = acoes.filter(a => a.status !== 'concluida').sort((a, b) => (a.prazo ?? '').localeCompare(b.prazo ?? '')).slice(0, 6)
  const agresLista = agres.filter(a => a.status !== 'resolvido').slice(0, 5)

  return (
    <div>
      <div className="page-header">
        <div className="page-title">📊 Painel de Controle</div>
        <div className="page-sub">Visão executiva — falhas críticas, planos de ação e tendências</div>
      </div>

      {alertas.length > 0 && (
        <div className="mb20">
          {alertas.map((al, i) => (
            <div key={i} className={'alert alert-' + al.tipo}><span className="alert-ico">{al.ico}</span><div>{al.msg}</div></div>
          ))}
        </div>
      )}

      <div className="grid g4 mb20">
        <div className="sum-card danger"><div className="sum-label">Falhas Críticas RAF</div><div className="sum-value">{rafsCriticos}</div><div className="sum-sub">Em análise / aberto</div></div>
        <div className="sum-card warning"><div className="sum-label">Agressores Ativos</div><div className="sum-value">{agressoresAtiv}</div><div className="sum-sub">Requerem ação</div></div>
        <div className={'sum-card ' + (acAtrasadas > 0 ? 'danger' : 'success')}><div className="sum-label">Ações Atrasadas</div><div className="sum-value">{acAtrasadas}</div><div className="sum-sub">{acAtrasadas === 0 ? 'Tudo em dia' : 'Prazo vencido'}</div></div>
        <div className={'sum-card ' + (ac7dias > 0 ? 'warning' : 'primary')}><div className="sum-label">Vencem em 7 dias</div><div className="sum-value">{ac7dias}</div><div className="sum-sub">Atenção necessária</div></div>
      </div>

      <div className="grid g-sidebar">
        <div>
          <div className="card mb20" style={{ padding: 0 }}>
            <div className="card-hd"><span className="card-title">✅ Andamento do Plano de Ação</span><span className="badge badge-blue">{pctGlobal}% global</span></div>
            <div className="card-body">
              {acoes.length === 0 ? (
                <div className="empty-state" style={{ padding: 24 }}><div className="empty-state-icon">✅</div><div className="empty-state-sub">Nenhuma ação cadastrada</div></div>
              ) : (
                <>
                  <div className="mb16">
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}><span className="fw-600">Progresso Geral</span><span className="fw-700 text-primary">{pctGlobal}%</span></div>
                    <div className="pb-wrap"><div className={'pb ' + (pctGlobal >= 70 ? 'success' : pctGlobal >= 40 ? '' : 'warning')} style={{ width: pctGlobal + '%' }} /></div>
                    <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 11, color: 'var(--gray-400)' }}>
                      <span><strong style={{ color: 'var(--success)' }}>{acoesConcluidas}</strong> concluídas</span>
                      <span><strong>{totalAcoes - acoesConcluidas}</strong> em aberto</span>
                      <span><strong style={{ color: 'var(--danger)' }}>{acAtrasadas}</strong> atrasadas</span>
                    </div>
                  </div>
                  {acoesEmAndamento.length > 0 && (
                    <>
                      <div style={{ borderTop: '1px solid var(--gray-100)', margin: '12px 0' }} />
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-500)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.5px' }}>Em execução</div>
                      {acoesEmAndamento.map(a => (
                        <div key={a.id} className="mb16">
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: 13 }}><span className="fw-600" style={{ flex: 1, marginRight: 12 }}>{a.descricao}</span><span className="text-xs text-muted">{fmtData(a.prazo)}</span></div>
                          <div className="pb-wrap"><div className="pb" style={{ width: '40%' }} /></div>
                        </div>
                      ))}
                    </>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="card" style={{ padding: 0 }}>
            <div className="card-hd"><span className="card-title">📅 Ações por Prazo</span><a href="/acoes" className="btn btn-outline btn-sm">Ver todas →</a></div>
            <div className="card-body">
              {acoesLista.length === 0 ? (
                <div className="empty-state" style={{ padding: 24 }}><div className="empty-state-icon">✅</div><div className="empty-state-sub">Nenhuma ação pendente</div></div>
              ) : (
                acoesLista.map(a => {
                  const dias = diasAte(a.prazo); const late = dias !== null && dias < 0; const soon = dias !== null && dias >= 0 && dias <= 7
                  return (
                    <div key={a.id} className="action-row">
                      <div className={'ac-bullet ' + (late ? 'late' : soon ? 'soon' : '')}>{late ? '!' : soon ? '◎' : '○'}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="ac-desc">{a.descricao}</div>
                        <div className="ac-meta">{a.responsavel && <span>{a.responsavel}</span>}{a.raf_id && <span>RAF vinculado</span>}</div>
                      </div>
                      <div className={'ac-deadline ' + (late ? 'late' : soon ? 'soon' : 'ok')}>{late ? `Atrasado ${Math.abs(dias as number)}d` : dias === 0 ? 'Hoje' : `${dias}d`}</div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>

        <div>
          <div className="card mb20" style={{ padding: 0 }}>
            <div className="card-hd"><span className="card-title">📅 Calendário</span></div>
            <div className="card-body"><Calendario /></div>
          </div>
          <div className="card" style={{ padding: 0 }}>
            <div className="card-hd"><span className="card-title">⚡ Principais Agressores</span><a href="/falhas" className="btn btn-outline btn-sm">Ver todos →</a></div>
            {agresLista.length === 0 ? (
              <div className="empty-state" style={{ padding: 24 }}><div className="empty-state-icon">⚡</div><div className="empty-state-sub">Sem agressores registrados</div></div>
            ) : (
              <div className="tbl-wrap">
                <table>
                  <thead><tr><th>Agressor</th><th>Ocorr.</th><th>Status</th></tr></thead>
                  <tbody>
                    {agresLista.map(a => (
                      <tr key={a.id}>
                        <td style={{ maxWidth: 160 }}>
                          <div className="fw-600 text-sm">{a.equipamento_tag ?? '—'}</div>
                          <div className="text-xs text-muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.descricao}</div>
                        </td>
                        <td className="fw-700">{a.ocorrencias ?? '—'}</td>
                        <td><span className={'badge ' + (a.status === 'resolvido' ? 'badge-success' : a.status === 'em_tratamento' ? 'badge-blue' : 'badge-warning')}>{a.status === 'em_tratamento' ? 'Tratando' : a.status === 'resolvido' ? 'Resolvido' : 'Ativo'}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
