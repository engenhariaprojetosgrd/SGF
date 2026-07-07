'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const nav = [
  {
    section: 'Gerência',
    items: [
      { id: 'farol', href: '/farol', label: 'Farol Diário', icon: '🚦' },
      { id: 'painel', href: '/painel', label: 'Painel de Controle', icon: '📊' },
    ],
  },
  {
    section: 'Engenharia',
    items: [
      { id: 'falhas', href: '/falhas', label: 'Agressores', icon: '🟡' },
      { id: 'raf', href: '/raf', label: 'RAF', icon: '🔍' },
      { id: 'acoes', href: '/acoes', label: 'Plano de Ação', icon: '✅' },
    ],
  },
  {
    section: 'Execução',
    items: [
      { id: 'kanban', href: '/kanban', label: 'Kanban do Turno', icon: '🗂️' },
      { id: 'atividade', href: '/atividade/nova', label: 'Nova Atividade', icon: '➕' },
      { id: 'diario', href: '/diario', label: 'Diário de Bordo', icon: '📔' },
      { id: 'corretiva', href: '/corretiva', label: 'Histórico Corretiva', icon: '📋' },
      { id: 'observacoes', href: '/observacoes', label: 'Observações', icon: '📌' },
    ],
  },
  {
    section: 'Dados',
    items: [
      { id: 'frota', href: '/frota', label: 'Frota', icon: '🚧' },
      { id: 'indicadores', href: '/indicadores', label: 'Indicadores', icon: '📈' },
      { id: 'importar', href: '/importar', label: 'Importar Dados', icon: '📥' },
      { id: 'historico', href: '/historico', label: 'Histórico', icon: '🕐' },
    ],
  },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">⚙️</div>
        <div>
          <div className="sidebar-logo-title">SGF</div>
          <div className="sidebar-logo-sub">Gestão da Frota</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {nav.map((group) => (
          <div key={group.section} className="nav-group">
            <div className="nav-section-label">{group.section}</div>
            {group.items.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={`nav-item ${isActive ? 'active' : ''}`}
                >
                  <span className="nav-icon">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        <div className="text-xs text-muted">SGF v1.0 · 2026</div>
      </div>
    </aside>
  )
}
