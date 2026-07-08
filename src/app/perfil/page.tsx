'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabase'
import type { OcorrenciaCorretiva, Equipamento } from '@/lib/types'

/* ── Listas controladas ── */
const SISTEMAS = [
  'Estrutura', 'Ar Condicionado', 'Arrefecimento', 'Combate a Incêndio', 'Giro',
  'Implemento', 'Lubrificação Centralizada', 'Eletroeletrônico', 'Hidráulico', 'Motriz',
]
const SUBSISTEMAS = [
  'Admissão de Ar', 'Ar Condicionado', 'Atuadores', 'Bateria', 'Bombas Hidráulicas', 'Cabine',
  'Caçamba', 'Combate a Incêndio', 'Componentes Elétricos', 'Coroa de Giro', 'Escada', 'Lança',
  'Lataria e Carenagem', 'Lubrificação Centralizada', 'Lubrificação Manual', 'Mangueiras Hidráulicas',
  'Redutor de Giro', 'Suportes e Mancais', 'Válvulas e Solenoides',
]

function cleanTxt(v: unknown): string {
  return String(v ?? '').replace(/_x000D_/g, ' ').replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim()
}
function excelDateToISO(n: number): string {
  const d = new Date(Math.round((n - 25569) * 86400000))
  const p = (x: number) => String(x).padStart(2, '0')
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`
}
function durStrToSec(v: unknown): number {
  const m = String(v ?? '').match(/(\d+):(\d+):(\d+)/)
  return m ? (+m[1]) * 3600 + (+m[2]) * 60 + (+m[3]) : 0
}
function omDe(desc: string): string | null {
  const m = desc.match(/OM:\s*([\d.]+)/i)
  return m ? m[1] : null
}
// Falha (corretiva "MC") x preventiva/inspeção ("MP") — vem no início da descrição
function ehPreventiva(desc: string): boolean {
  const s = desc.toUpperCase().trimStart()
  return /^MP\b/.test(s) || /INSPE[ÇC][ÃA]O/.test(s) || /PREVENTIVA/.test(s)
}
function fmtDur(sec: number): string {
  if (!sec) return '—'
  const h = Math.floor(sec / 3600), m = Math.round((sec % 3600) / 60)
  return h ? `${h}h${m ? ' ' + m + 'min' : ''}` : `${m}min`
}
function fmtData(d: string | null | undefined) {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

type Grupo = { key: string; numero_om: string | null; equip?: string; frota?: string; desc: string; data?: string; dur: number; sistema?: string; subsistema?: string; ids: string[]; classif: boolean }

export default function PerfilPerdaPage() {
  const [ocs, setOcs] = useState<OcorrenciaCorretiva[]>([])
  const [equip, setEquip] = useState<Equipamento[]>([])
  const [loading, setLoading] = useState(true)
  const [importando, setImportando] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const [filtroFrota, setFiltroFrota] = useState('todas')
  const [soPendentes, setSoPendentes] = useState(true)
  const [busca, setBusca] = useState('')
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [bulkSis, setBulkSis] = useState('')
  const [bulkSub, setBulkSub] = useState('')

  useEffect(() => { carregar() }, [])
  async function carregar() {
    const [oRes, eRes] = await Promise.all([
      supabase.from('ocorrencias_corretivas').select('*').order('data', { ascending: true }),
      supabase.from('equipamentos').select('tag,categoria'),
    ])
    setOcs((oRes.data ?? []) as OcorrenciaCorretiva[])
    setEquip((eRes.data ?? []) as Equipamento[])
    setLoading(false)
  }

  const catByTag = useMemo(() => { const m: Record<string, string> = {}; equip.forEach(e => { m[e.tag] = e.categoria }); return m }, [equip])
  const frotas = useMemo(() => [...new Set(ocs.map(o => o.frota).filter(Boolean))].sort() as string[], [ocs])

  // Consolidação por OM (total de parada da ocorrência)
  const grupos = useMemo<Grupo[]>(() => {
    const map = new Map<string, Grupo>()
    for (const o of ocs) {
      const key = o.numero_om ? 'om:' + o.numero_om : 'id:' + o.id
      let g = map.get(key)
      if (!g) { g = { key, numero_om: o.numero_om ?? null, equip: o.equipamento_tag, frota: o.frota, desc: o.descricao || '', data: o.data, dur: 0, ids: [], classif: false }; map.set(key, g) }
      g.dur += o.duracao_seg || 0
      g.ids.push(o.id)
      if ((o.descricao || '').length > g.desc.length) g.desc = o.descricao || ''
      if (o.sistema) g.sistema = o.sistema
      if (o.subsistema) g.subsistema = o.subsistema
      if (o.data && (!g.data || o.data < g.data)) g.data = o.data
    }
    return [...map.values()].map(g => ({ ...g, classif: !!(g.sistema && g.subsistema) }))
  }, [ocs])

  const lista = useMemo(() => grupos.filter(g =>
    (filtroFrota === 'todas' || g.frota === filtroFrota) &&
    (!soPendentes || !g.classif) &&
    (!busca || g.desc.toLowerCase().includes(busca.toLowerCase()) || (g.numero_om ?? '').includes(busca))
  ), [grupos, filtroFrota, soPendentes, busca])

  const totalClass = grupos.filter(g => g.classif).length

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    setImportando(true); setMsg(null)
    try {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })
      const ws = wb.Sheets['OC.MANUT'] ?? wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: '' })
      const lote = file.name + ' · ' + new Date().toISOString().slice(0, 16)

      const existentes = new Set(ocs.map(o => o.linha_hash).filter(Boolean) as string[])
      const noBatch = new Set<string>()
      let equipTag: string | null = null, grupo: string | null = null
      const novas: Partial<OcorrenciaCorretiva>[] = []
      let repetidas = 0, preventivas = 0
      for (const r of rows) {
        const c0 = r[0]
        const s0 = cleanTxt(c0)
        if (s0.startsWith('Equipamento:')) { equipTag = s0.replace('Equipamento:', '').trim().replace(/^MM/i, ''); continue }
        if (typeof c0 === 'number' && c0 > 40000) {
          const desc = cleanTxt(r[1])
          if (ehPreventiva(desc)) { preventivas++; continue }   // foco só em falhas
          const data = excelDateToISO(c0)
          const dur = typeof r[7] === 'number' ? Math.round(r[7] * 86400) : durStrToSec(r[7])
          const hIni = cleanTxt(r[5])
          const om = omDe(desc)
          const hash = [om ?? 'semOM', data, equipTag ?? '', hIni, dur].join('|')
          if (existentes.has(hash) || noBatch.has(hash)) { repetidas++; continue }
          noBatch.add(hash)
          novas.push({
            data, equipamento_tag: equipTag ?? undefined, frota: (equipTag && catByTag[equipTag]) || grupo || undefined,
            descricao: desc, duracao_seg: dur, resp: cleanTxt(r[8]),
            numero_om: om ?? undefined, linha_hash: hash, classificado: false, import_lote: lote,
          })
        } else if (s0 && s0 === s0.toUpperCase() && s0.length > 3 && !/^DIA|^RELAT|EQUIPAMENTO|^CARGA|^INFRA/.test(s0)) {
          grupo = s0
        }
      }
      const notas = [repetidas > 0 ? `${repetidas} repetidas` : '', preventivas > 0 ? `${preventivas} preventiva/inspeção` : ''].filter(Boolean).join(' · ')
      if (novas.length === 0) { setMsg(notas ? `Nada novo (${notas} ignoradas).` : 'Nenhuma ocorrência reconhecida. Confira se é o relatório "OC.MANUT".'); setImportando(false); if (fileRef.current) fileRef.current.value = ''; return }
      const { error } = await supabase.from('ocorrencias_corretivas').insert(novas)
      if (error) { setMsg('Erro ao gravar: ' + error.message); setImportando(false); return }
      await carregar()
      setMsg(`✓ ${novas.length} falhas importadas${notas ? ` · ${notas} ignoradas` : ''}.`)
    } catch (err) {
      setMsg('Falha ao ler o arquivo: ' + (err as Error).message)
    }
    setImportando(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function setCampoGrupo(g: Grupo, campo: 'sistema' | 'subsistema', val: string) {
    const sistema = campo === 'sistema' ? val : g.sistema
    const subsistema = campo === 'subsistema' ? val : g.subsistema
    const patch = { sistema: sistema || null, subsistema: subsistema || null, classificado: !!(sistema && subsistema) }
    await supabase.from('ocorrencias_corretivas').update(patch).in('id', g.ids)
    setOcs(prev => prev.map(x => g.ids.includes(x.id) ? { ...x, ...patch } as OcorrenciaCorretiva : x))
  }

  async function aplicarBulk() {
    if (!bulkSis || sel.size === 0) return
    const ids = grupos.filter(g => sel.has(g.key)).flatMap(g => g.ids)
    const patch = { sistema: bulkSis, subsistema: bulkSub || null, classificado: !!(bulkSis && bulkSub) }
    await supabase.from('ocorrencias_corretivas').update(patch).in('id', ids)
    setOcs(prev => prev.map(x => ids.includes(x.id) ? { ...x, ...patch } as OcorrenciaCorretiva : x))
    setSel(new Set()); setBulkSis(''); setBulkSub('')
  }

  async function apagarTudo() {
    if (!confirm('Apagar TODAS as ocorrências importadas? Isso não afeta OMs nem agressores.')) return
    await supabase.from('ocorrencias_corretivas').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    setOcs([]); setSel(new Set())
  }

  const toggleSel = (k: string) => setSel(s => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n })
  const toggleAll = () => setSel(s => s.size === lista.length ? new Set() : new Set(lista.map(g => g.key)))

  if (loading) return (
    <div><div className="empty-state"><div className="empty-state-icon">⏳</div><div className="empty-state-sub">Carregando...</div></div></div>
  )

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div className="page-title">📉 Perfil de Perda</div>
          <div className="page-sub">Falhas por ocorrência (OM) — tempo parado, sistema e subsistema</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {ocs.length > 0 && <button className="btn btn-ghost btn-sm" onClick={apagarTudo}>🗑 Apagar tudo</button>}
          <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={onFile} />
          <button className="btn btn-primary btn-sm" onClick={() => fileRef.current?.click()} disabled={importando}>{importando ? 'Importando...' : '📥 Importar planilha'}</button>
        </div>
      </div>

      {msg && <div className={'alert ' + (msg.startsWith('✓') ? 'alert-success' : 'alert-danger')} style={{ marginBottom: 16 }}>{msg}</div>}

      {ocs.length === 0 ? (
        <div className="card"><div className="empty-state" style={{ padding: 48 }}>
          <div className="empty-state-icon">📉</div>
          <div className="empty-state-title">Nenhuma falha importada</div>
          <div className="empty-state-sub">Clique em "Importar planilha" e carregue o relatório de ocorrências</div>
        </div></div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
            <span className="badge badge-success">{totalClass} OMs classificadas</span>
            <span className="badge badge-warning">{grupos.length - totalClass} pendentes</span>
            <select className="form-control" style={{ maxWidth: 220 }} value={filtroFrota} onChange={e => setFiltroFrota(e.target.value)}>
              <option value="todas">Todas as frotas</option>
              {frotas.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
            <input className="form-control" style={{ maxWidth: 220 }} placeholder="Buscar (descrição ou OM)..." value={busca} onChange={e => setBusca(e.target.value)} />
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
              <input type="checkbox" checked={soPendentes} onChange={e => setSoPendentes(e.target.checked)} /> só pendentes
            </label>
          </div>

          {sel.size > 0 && (
            <div className="card" style={{ padding: 12, marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', background: 'var(--primary-light)' }}>
              <b className="text-sm">{sel.size} OM(s):</b>
              <select className="form-control" style={{ maxWidth: 200 }} value={bulkSis} onChange={e => setBulkSis(e.target.value)}>
                <option value="">Sistema...</option>
                {SISTEMAS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select className="form-control" style={{ maxWidth: 210 }} value={bulkSub} onChange={e => setBulkSub(e.target.value)}>
                <option value="">Subsistema...</option>
                {SUBSISTEMAS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <button className="btn btn-primary btn-sm" onClick={aplicarBulk} disabled={!bulkSis}>Aplicar às selecionadas</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setSel(new Set())}>Limpar</button>
            </div>
          )}

          <div className="card" style={{ padding: 0 }}>
            <div className="tbl-wrap">
              <table>
                <thead><tr>
                  <th style={{ width: 32 }}><input type="checkbox" checked={sel.size > 0 && sel.size === lista.length} onChange={toggleAll} /></th>
                  <th>OM</th><th>Data</th><th>Equip.</th><th>Descrição</th><th>Tempo parado</th><th>Sistema</th><th>Subsistema</th>
                </tr></thead>
                <tbody>
                  {lista.map(g => (
                    <tr key={g.key} style={{ background: g.classif ? 'var(--success-light)' : undefined }}>
                      <td><input type="checkbox" checked={sel.has(g.key)} onChange={() => toggleSel(g.key)} /></td>
                      <td className="text-xs fw-700" style={{ color: 'var(--primary)' }}>{g.numero_om ?? '—'}</td>
                      <td className="text-xs">{fmtData(g.data)}</td>
                      <td className="fw-700 text-sm">{g.equip ?? '—'}</td>
                      <td style={{ maxWidth: 320 }}><div className="text-xs" style={{ lineHeight: 1.35 }}>{g.desc}{g.ids.length > 1 ? ` (${g.ids.length} lin.)` : ''}</div></td>
                      <td className="text-xs fw-600">{fmtDur(g.dur)}</td>
                      <td>
                        <select className="form-control" style={{ minWidth: 140, fontSize: 12, padding: '4px 6px' }} value={g.sistema ?? ''} onChange={e => setCampoGrupo(g, 'sistema', e.target.value)}>
                          <option value="">—</option>
                          {SISTEMAS.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                      <td>
                        <select className="form-control" style={{ minWidth: 150, fontSize: 12, padding: '4px 6px' }} value={g.subsistema ?? ''} onChange={e => setCampoGrupo(g, 'subsistema', e.target.value)}>
                          <option value="">—</option>
                          {SUBSISTEMAS.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {lista.length === 0 && <div className="text-sm text-muted" style={{ padding: 16, textAlign: 'center' }}>Nada aqui com os filtros atuais. {soPendentes && 'Todas as OMs desta frota já foram classificadas. 🎉'}</div>}
        </>
      )}
    </div>
  )
}
