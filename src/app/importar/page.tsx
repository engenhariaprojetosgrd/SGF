'use client'
import { useState } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabase'

type Metrica = 'df' | 'mttr' | 'mtbf'
type Ponto = { tag: string; periodo: string; data: string; valor: number }
type Parsed = Record<Metrica, Ponto[]>

const META_INFO: { key: Metrica; label: string; cor: string; desc: string }[] = [
  { key: 'df', label: 'DF (Disponibilidade)', cor: 'var(--primary)', desc: 'Valores em fração (0–1) → convertidos para %' },
  { key: 'mttr', label: 'MTTR (Tempo de Reparo)', cor: '#0d9488', desc: 'Valores em horas' },
  { key: 'mtbf', label: 'MTBF (Entre Falhas)', cor: '#7c3aed', desc: 'Valores em horas' },
]

function cell(rows: unknown[][], r: number, c: number): unknown {
  const v = rows[r]?.[c]
  return v === undefined || v === null || v === '' ? null : v
}

function parseMatrix(rows: unknown[][], metrica: Metrica): Ponto[] {
  const yearRow = 5, monthRow = 6, dayRow = 7
  let year = new Date().getFullYear()
  for (let c = 0; c < 40; c++) { const v = cell(rows, yearRow, c); if (v && Number(v) > 2000) { year = Math.round(Number(v)); break } }
  let dailyStart = -1
  for (let c = 7; c < 40; c++) { if (cell(rows, dayRow, c) != null) { dailyStart = c; break } }
  const dailyMonth = dailyStart >= 0 ? Math.round(Number(cell(rows, monthRow, dailyStart))) : null
  const pad = (n: number) => String(n).padStart(2, '0')
  const colMap: Record<number, { p: string; d: string }> = {}
  for (let c = 7; c < 40; c++) {
    const day = cell(rows, dayRow, c), mon = cell(rows, monthRow, c)
    if (day != null && dailyMonth) colMap[c] = { p: 'diario', d: `${year}-${pad(dailyMonth)}-${pad(Math.round(Number(day)))}` }
    else if (mon != null) colMap[c] = { p: 'mensal', d: `${year}-${pad(Math.round(Number(mon)))}-01` }
  }
  const out: Ponto[] = []
  for (let r = 8; r < rows.length; r++) {
    const tag = cell(rows, r, 6)
    if (!tag) continue
    const tclean = String(tag).toUpperCase().replace(/^MM/, '').trim()
    for (const cs in colMap) {
      const c = Number(cs); const v = cell(rows, r, c)
      if (v == null) continue
      const num = Number(v); if (isNaN(num)) continue
      const valor = metrica === 'df' ? Math.round(num * 1000) / 10 : Math.round(num * 100) / 100
      out.push({ tag: tclean, periodo: colMap[c].p, data: colMap[c].d, valor })
    }
  }
  return out
}

export default function ImportarPage() {
  const [parsed, setParsed] = useState<Parsed>({ df: [], mttr: [], mtbf: [] })
  const [nomes, setNomes] = useState<Record<Metrica, string>>({ df: '', mttr: '', mtbf: '' })
  const [busy, setBusy] = useState(false)
  const [log, setLog] = useState<string[]>([])
  const [erro, setErro] = useState<string | null>(null)

  function onFile(e: React.ChangeEvent<HTMLInputElement>, metrica: Metrica) {
    setErro(null)
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(new Uint8Array(ev.target!.result as ArrayBuffer), { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true }) as unknown[][]
        const pts = parseMatrix(rows, metrica)
        if (pts.length === 0) { setErro('Nenhum dado reconhecido em ' + file.name + ' (verifique o formato da planilha).'); return }
        setParsed(p => ({ ...p, [metrica]: pts }))
        setNomes(n => ({ ...n, [metrica]: file.name }))
      } catch {
        setErro('Erro ao ler ' + file.name + '. O arquivo precisa estar no formato .xls/.xlsx esperado.')
      }
    }
    reader.readAsArrayBuffer(file)
  }

  function resumo(pts: Ponto[]) {
    if (!pts.length) return null
    const eq = new Set(pts.map(p => p.tag)).size
    const datas = pts.map(p => p.data).sort()
    return { pontos: pts.length, eq, de: datas[0], ate: datas[datas.length - 1] }
  }

  async function importar() {
    setBusy(true); setErro(null); setLog([])
    const add = (m: string) => setLog(l => [...l, m])
    const all = (['df', 'mttr', 'mtbf'] as Metrica[]).flatMap(m => parsed[m].map(p => ({ ...p, metrica: m })))
    if (all.length === 0) { setErro('Anexe ao menos uma planilha.'); setBusy(false); return }

    // 1. mapa tag -> categoria
    const { data: eqs } = await supabase.from('equipamentos').select('tag,categoria')
    const tagCat: Record<string, string> = {}
    ;(eqs ?? []).forEach((e: { tag: string; categoria: string }) => { tagCat[String(e.tag)] = e.categoria })
    const semCat = [...new Set(all.map(p => p.tag))].filter(t => !tagCat[t])
    if (semCat.length) add(`⚠️ ${semCat.length} tag(s) sem correspondência no cadastro: ${semCat.join(', ')} (gravadas por equipamento, mas fora das médias por frota)`)

    // 2. grava por equipamento (df_equip) em lotes
    const rows = all.map(p => ({ equipamento_tag: p.tag, metrica: p.metrica, tipo_periodo: p.periodo, data_referencia: p.data, valor: p.valor }))
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await supabase.from('df_equip').upsert(rows.slice(i, i + 500), { onConflict: 'equipamento_tag,metrica,tipo_periodo,data_referencia' })
      if (error) { setErro('Erro ao gravar por equipamento: ' + error.message); setBusy(false); return }
    }
    add(`✅ ${rows.length} valores por equipamento gravados (df_equip).`)

    // 3. agrega por frota/categoria + geral -> indicadores_kpi
    const agg: Record<string, { df: number[]; mttr: number[]; mtbf: number[] }> = {}
    for (const p of all) {
      const cat = tagCat[p.tag]
      const frotas = cat ? ['geral', cat] : ['geral']
      for (const fr of frotas) {
        const k = fr + '|' + p.periodo + '|' + p.data
        if (!agg[k]) agg[k] = { df: [], mttr: [], mtbf: [] }
        agg[k][p.metrica].push(p.valor)
      }
    }
    const avg = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length
    const kpiRows = Object.entries(agg).map(([k, v]) => {
      const [frota, tipo_periodo, data_referencia] = k.split('|')
      const row: Record<string, unknown> = { frota, tipo_periodo, data_referencia }
      if (v.df.length) row.df_percent = Math.round(avg(v.df) * 10) / 10
      if (v.mttr.length) row.mttr_horas = Math.round(avg(v.mttr) * 100) / 100
      if (v.mtbf.length) row.mtbf_horas = Math.round(avg(v.mtbf) * 100) / 100
      return row
    })
    for (let i = 0; i < kpiRows.length; i += 500) {
      const { error } = await supabase.from('indicadores_kpi').upsert(kpiRows.slice(i, i + 500), { onConflict: 'frota,tipo_periodo,data_referencia' })
      if (error) { setErro('Erro ao gravar médias por frota: ' + error.message); setBusy(false); return }
    }
    add(`✅ ${kpiRows.length} médias por frota/geral gravadas (alimenta o Farol e Indicadores).`)
    add('🎉 Importação concluída. Abra o Farol Diário para ver os dados.')
    setBusy(false)
  }

  const temAlgo = parsed.df.length || parsed.mttr.length || parsed.mtbf.length

  return (
    <div>
      <div className="page-header">
        <div className="page-title">📥 Importar Indicadores</div>
        <div className="page-sub">Anexe as planilhas diárias de DF, MTTR e MTBF (matriz por equipamento). O sistema lê, grava por equipamento e calcula as médias por frota.</div>
      </div>

      <div className="grid g3 mb20">
        {META_INFO.map(m => {
          const r = resumo(parsed[m.key])
          return (
            <div key={m.key} className="card" style={{ borderTop: `3px solid ${m.cor}` }}>
              <div className="fw-700" style={{ marginBottom: 4 }}>{m.label}</div>
              <div className="text-xs text-muted" style={{ marginBottom: 12 }}>{m.desc}</div>
              <input type="file" accept=".xls,.xlsx" onChange={e => onFile(e, m.key)} className="form-control" style={{ padding: 6, fontSize: 12 }} />
              {r && (
                <div className="text-xs" style={{ marginTop: 10, color: 'var(--success)' }}>
                  ✓ {nomes[m.key]}<br />
                  {r.pontos} valores · {r.eq} equip. · {r.de} → {r.ate}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {erro && <div className="alert alert-danger" style={{ marginBottom: 16 }}>{erro}</div>}

      <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div className="text-sm text-muted">As planilhas são lidas no navegador; nada é enviado a terceiros. Reimportar a mesma data sobrescreve os valores anteriores.</div>
        <button className="btn btn-primary" onClick={importar} disabled={busy || !temAlgo}>
          {busy ? 'Importando...' : '⬆ Importar para o sistema'}
        </button>
      </div>

      {log.length > 0 && (
        <div className="card mb20" style={{ marginTop: 16 }}>
          <div className="card-title" style={{ marginBottom: 10 }}>Resultado</div>
          {log.map((l, i) => <div key={i} className="text-sm" style={{ marginBottom: 4 }}>{l}</div>)}
        </div>
      )}
    </div>
  )
}
