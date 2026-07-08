'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabase'
import type { OcorrenciaCorretiva, Equipamento } from '@/lib/types'

/* ── Taxonomia controlada (Sistema → Subsistemas) ── */
const TAXONOMIA: Record<string, string[]> = {
  'Hidráulico': ['Bomba', 'Cilindro', 'Mangueira/Conexão', 'Válvula/Comando', 'Óleo/Filtro', 'Reservatório'],
  'Giro': ['Motor de giro', 'Redutor de giro', 'Coroa/Pinhão', 'Mangueiras do giro'],
  'Motor Diesel': ['Arrefecimento', 'Combustível/Filtro', 'Turbo/Admissão', 'Lubrificação do motor', 'Escape'],
  'Elétrico': ['Bateria', 'Chicote/Fiação', 'Sensor', 'Painel/Alarme', 'Iluminação'],
  'Implemento': ['Caçamba/Concha', 'Lança', 'Braço', 'Pino/Bucha', 'Dentes/Bordas'],
  'Estrutura/Chassi': ['Solda/Trinca', 'Cabine', 'Proteções', 'Material rodante/Esteira'],
  'Lubrificação': ['Sistema centralizado', 'Bomba de graxa', 'Ponto de graxa'],
  'Abastecimento': ['Tanque', 'Bico/Bomba de abastecimento'],
  'Combate a Incêndio': ['AFEX', 'Extintor/Sensor'],
  'Transmissão/Motriz': ['Comando final', 'Diferencial', 'Freio'],
  'Outros': ['Não classificado'],
}
const SISTEMAS = Object.keys(TAXONOMIA)

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
function fmtDur(sec: number): string {
  if (!sec) return '—'
  const h = Math.floor(sec / 3600), m = Math.round((sec % 3600) / 60)
  return h ? `${h}h${m ? ' ' + m + 'min' : ''}` : `${m}min`
}
function fmtData(d: string | null | undefined) {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

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
  const lista = useMemo(() => ocs.filter(o =>
    (filtroFrota === 'todas' || o.frota === filtroFrota) &&
    (!soPendentes || !o.classificado) &&
    (!busca || (o.descricao ?? '').toLowerCase().includes(busca.toLowerCase()))
  ), [ocs, filtroFrota, soPendentes, busca])

  const totalClass = ocs.filter(o => o.classificado).length

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    setImportando(true); setMsg(null)
    try {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })
      const ws = wb.Sheets['OC.MANUT'] ?? wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: '' })
      const lote = file.name + ' · ' + new Date().toISOString().slice(0, 16)
      let equipTag: string | null = null, grupo: string | null = null
      const novas: Partial<OcorrenciaCorretiva>[] = []
      for (const r of rows) {
        const c0 = r[0]
        const s0 = cleanTxt(c0)
        if (s0.startsWith('Equipamento:')) { equipTag = s0.replace('Equipamento:', '').trim().replace(/^MM/i, ''); continue }
        if (typeof c0 === 'number' && c0 > 40000) {
          const dur = typeof r[7] === 'number' ? Math.round(r[7] * 86400) : durStrToSec(r[7])
          novas.push({
            data: excelDateToISO(c0), equipamento_tag: equipTag ?? undefined,
            frota: (equipTag && catByTag[equipTag]) || grupo || undefined,
            descricao: cleanTxt(r[1]), sub_estado: cleanTxt(r[2]), duracao_seg: dur, resp: cleanTxt(r[8]),
            classificado: false, import_lote: lote,
          })
        } else if (s0 && s0 === s0.toUpperCase() && s0.length > 3 && !/^DIA|^RELAT|EQUIPAMENTO|^CARGA|^INFRA/.test(s0)) {
          grupo = s0
        }
      }
      if (novas.length === 0) { setMsg('Nenhuma ocorrência reconhecida na planilha. Confira se é o relatório "OC.MANUT".'); setImportando(false); return }
      const { error } = await supabase.from('ocorrencias_corretivas').insert(novas)
      if (error) { setMsg('Erro ao gravar: ' + error.message); setImportando(false); return }
      await carregar()
      setMsg(`✓ ${novas.length} ocorrências importadas.`)
    } catch (err) {
      setMsg('Falha ao ler o arquivo: ' + (err as Error).message)
    }
    setImportando(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function setCampo(o: OcorrenciaCorretiva, campo: 'sistema' | 'subsistema', val: string) {
    const sistema = campo === 'sistema' ? val : o.sistema
    const subsistema = campo === 'sistema' ? '' : (campo === 'subsistema' ? val : o.subsistema)
    const patch: Record<string, unknown> = { sistema: sistema || null, subsistema: subsistema || null, classificado: !!(sistema && subsistema) }
    const { data } = await supabase.from('ocorrencias_corretivas').update(patch).eq('id', o.id).select().single()
    if (data) setOcs(prev => prev.map(x => x.id === o.id ? (data as OcorrenciaCorretiva) : x))
  }

  async function aplicarBulk() {
    if (!bulkSis || sel.size === 0) return
    const patch = { sistema: bulkSis, subsistema: bulkSub || null, classificado: !!(bulkSis && bulkSub) }
    await supabase.from('ocorrencias_corretivas').update(patch).in('id', [...sel])
    setOcs(prev => prev.map(x => sel.has(x.id) ? { ...x, ...patch } as OcorrenciaCorretiva : x))
    setSel(new Set()); setBulkSis(''); setBulkSub('')
  }

  async function apagarTudo() {
    if (!confirm('Apagar TODAS as ocorrências importadas? Isso não afeta OMs nem agressores.')) return
    await supabase.from('ocorrencias_corretivas').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    setOcs([]); setSel(new Set())
  }

  const toggleSel = (id: string) => setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleAll = () => setSel(s => s.size === lista.length ? new Set() : new Set(lista.map(o => o.id)))

  if (loading) return (
    <div><div className="empty-state"><div className="empty-state-icon">⏳</div><div className="empty-state-sub">Carregando...</div></div></div>
  )

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div className="page-title">📉 Perfil de Perda</div>
          <div className="page-sub">Importe as ocorrências e marque Sistema/Subsistema com a execução</div>
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
          <div className="empty-state-title">Nenhuma ocorrência importada</div>
          <div className="empty-state-sub">Clique em "Importar planilha" e carregue o relatório de ocorrências corretivas</div>
        </div></div>
      ) : (
        <>
          {/* Barra de progresso + filtros */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
            <span className="badge badge-success">{totalClass} classificadas</span>
            <span className="badge badge-warning">{ocs.length - totalClass} pendentes</span>
            <select className="form-control" style={{ maxWidth: 220 }} value={filtroFrota} onChange={e => setFiltroFrota(e.target.value)}>
              <option value="todas">Todas as frotas</option>
              {frotas.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
            <input className="form-control" style={{ maxWidth: 220 }} placeholder="Buscar na descrição..." value={busca} onChange={e => setBusca(e.target.value)} />
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
              <input type="checkbox" checked={soPendentes} onChange={e => setSoPendentes(e.target.checked)} /> só pendentes
            </label>
          </div>

          {/* Barra de marcação em lote */}
          {sel.size > 0 && (
            <div className="card" style={{ padding: 12, marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', background: 'var(--primary-light)' }}>
              <b className="text-sm">{sel.size} selecionada(s):</b>
              <select className="form-control" style={{ maxWidth: 200 }} value={bulkSis} onChange={e => { setBulkSis(e.target.value); setBulkSub('') }}>
                <option value="">Sistema...</option>
                {SISTEMAS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select className="form-control" style={{ maxWidth: 200 }} value={bulkSub} onChange={e => setBulkSub(e.target.value)} disabled={!bulkSis}>
                <option value="">Subsistema...</option>
                {(TAXONOMIA[bulkSis] ?? []).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <button className="btn btn-primary btn-sm" onClick={aplicarBulk} disabled={!bulkSis}>Aplicar aos selecionados</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setSel(new Set())}>Limpar seleção</button>
            </div>
          )}

          <div className="card" style={{ padding: 0 }}>
            <div className="tbl-wrap">
              <table>
                <thead><tr>
                  <th style={{ width: 32 }}><input type="checkbox" checked={sel.size > 0 && sel.size === lista.length} onChange={toggleAll} /></th>
                  <th>Data</th><th>Equip.</th><th>Descrição</th><th>Sub-Estado</th><th>Duração</th><th>Sistema</th><th>Subsistema</th>
                </tr></thead>
                <tbody>
                  {lista.map(o => (
                    <tr key={o.id} style={{ background: o.classificado ? 'var(--success-light)' : undefined }}>
                      <td><input type="checkbox" checked={sel.has(o.id)} onChange={() => toggleSel(o.id)} /></td>
                      <td className="text-xs">{fmtData(o.data)}</td>
                      <td className="fw-700 text-sm">{o.equipamento_tag ?? '—'}</td>
                      <td style={{ maxWidth: 320 }}><div className="text-xs" style={{ lineHeight: 1.35 }}>{o.descricao}</div></td>
                      <td className="text-xs text-muted">{o.sub_estado}</td>
                      <td className="text-xs fw-600">{fmtDur(o.duracao_seg)}</td>
                      <td>
                        <select className="form-control" style={{ minWidth: 130, fontSize: 12, padding: '4px 6px' }} value={o.sistema ?? ''} onChange={e => setCampo(o, 'sistema', e.target.value)}>
                          <option value="">—</option>
                          {SISTEMAS.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                      <td>
                        <select className="form-control" style={{ minWidth: 140, fontSize: 12, padding: '4px 6px' }} value={o.subsistema ?? ''} onChange={e => setCampo(o, 'subsistema', e.target.value)} disabled={!o.sistema}>
                          <option value="">—</option>
                          {(TAXONOMIA[o.sistema ?? ''] ?? []).map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {lista.length === 0 && <div className="text-sm text-muted" style={{ padding: 16, textAlign: 'center' }}>Nada aqui com os filtros atuais. {soPendentes && 'Todas as ocorrências desta frota já foram classificadas. 🎉'}</div>}
        </>
      )}
    </div>
  )
}
