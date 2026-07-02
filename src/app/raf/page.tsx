'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { RAF } from '@/lib/types'

function fmtData(d: string | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' })
}
function fmtMoeda(v: number | null | undefined) {
  if (v == null) return '—'
  return 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 0 })
}
const FERRA: Record<string, string> = { '5pqs': '5 Porquês', ishikawa: 'Ishikawa', fta: 'Árvore de Falha' }

export default function RafListaPage() {
  const [rafs, setRafs] = useState<RAF[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('rafs').select('*').order('created_at', { ascending: false }).then(({ data }) => {
      setRafs((data ?? []) as RAF[])
      setLoading(false)
    })
  }, [])

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="page-title">🔍 RAF</div>
          <div className="page-sub">Relatórios de Análise de Falha registrados</div>
        </div>
        <a href="/raf/novo" className="btn btn-primary">＋ Nova RAF</a>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="card-hd">
          <span className="card-title">Relatórios de Análise de Falha</span>
          <span className="text-xs text-muted">{rafs.length} RAF{rafs.length !== 1 ? 's' : ''}</span>
        </div>
        {loading ? (
          <div className="empty-state" style={{ padding: 48 }}><div className="empty-state-icon">⏳</div><div className="empty-state-sub">Carregando...</div></div>
        ) : rafs.length === 0 ? (
          <div className="empty-state" style={{ padding: 48 }}>
            <div className="empty-state-icon">⚡</div>
            <div className="empty-state-title">Nenhuma RAF registrada</div>
            <div className="empty-state-sub">Registre falhas críticas para análise de causa raiz</div>
            <a href="/raf/novo" className="btn btn-primary" style={{ marginTop: 16 }}>＋ Nova RAF</a>
          </div>
        ) : (
          <div className="tbl-wrap">
            <table>
              <thead><tr><th>ID</th><th>Equipamento</th><th>Falha</th><th>Data</th><th>Ferramenta</th><th>Custo</th><th>Foto</th><th>Status</th></tr></thead>
              <tbody>
                {rafs.map(r => (
                  <tr key={r.id} className="clickable">
                    <td><span className="badge badge-raf">{r.numero_raf ?? ('RAF-' + String(r.id).slice(0, 4))}</span></td>
                    <td className="fw-700">{r.equipamento_tag ?? '—'}</td>
                    <td style={{ maxWidth: 240 }}><div className="fw-600 text-sm" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.descricao_falha ?? '—'}</div></td>
                    <td className="text-xs">{fmtData(r.data_ocorrencia)}</td>
                    <td className="text-sm">{r.ferramenta_analise ? (FERRA[r.ferramenta_analise] ?? r.ferramenta_analise) : '—'}</td>
                    <td className={r.custo_estimado && r.custo_estimado > 50000 ? 'fw-700 text-danger' : 'fw-600'}>{fmtMoeda(r.custo_estimado)}</td>
                    <td>{r.foto_url ? <a href={r.foto_url} target="_blank" rel="noreferrer" title="Ver foto">🖼️</a> : '—'}</td>
                    <td>
                      <span className={'badge ' + (r.status === 'concluido' ? 'badge-success' : r.status === 'aprovado' ? 'badge-blue' : r.status === 'cancelado' ? 'badge-gray' : 'badge-warning')}>
                        {r.status === 'em_analise' ? 'Em Análise' : r.status === 'aprovado' ? 'Aprovado' : r.status === 'concluido' ? 'Concluído' : r.status === 'cancelado' ? 'Cancelado' : (r.status ?? 'Aberto')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
