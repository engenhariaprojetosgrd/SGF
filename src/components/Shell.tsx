'use client'
import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { Sidebar } from './Sidebar'

const TITLES: Record<string, string> = {
  '/farol': 'Farol Diário', '/painel': 'Painel de Controle', '/falhas': 'Agressores',
  '/raf': 'RAF', '/raf/novo': 'Nova RAF', '/acoes': 'Plano de Ação', '/perfil': 'Perfil de Perda', '/kanban': 'Kanban do Turno',
  '/atividade/nova': 'Nova Atividade', '/diario': 'Diário de Bordo', '/corretiva': 'Histórico Corretiva', '/observacoes': 'Observações',
  '/frota': 'Frota', '/indicadores': 'Indicadores', '/importar': 'Importar Dados', '/historico': 'Histórico',
}

export function Shell({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const dragging = useRef(false)
  const pathname = usePathname()
  const router = useRouter()
  const titulo = TITLES[pathname] ?? 'SGF'

  useEffect(() => {
    const t = (localStorage.getItem('sgf-theme') as 'light' | 'dark') || 'light'
    setTheme(t)
    document.documentElement.dataset.theme = t
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => { setMobileOpen(false) }, [pathname])
  useEffect(() => { if (session === null && pathname !== '/login') router.replace('/login') }, [session, pathname, router])

  function toggleTheme() {
    const t = theme === 'dark' ? 'light' : 'dark'
    setTheme(t); document.documentElement.dataset.theme = t
    try { localStorage.setItem('sgf-theme', t) } catch {}
  }
  async function sair() { await supabase.auth.signOut(); router.replace('/login') }

  function startDrag(e: React.MouseEvent) {
    e.preventDefault(); dragging.current = true; document.body.style.userSelect = 'none'
    const move = (ev: MouseEvent) => {
      if (!dragging.current) return
      const w = Math.min(360, Math.max(160, ev.clientX))
      document.documentElement.style.setProperty('--sidebar-w', w + 'px')
    }
    const up = () => {
      dragging.current = false; document.body.style.userSelect = ''
      const cur = getComputedStyle(document.documentElement).getPropertyValue('--sidebar-w').trim()
      try { localStorage.setItem('sgf-sidebar-w', String(parseInt(cur) || 220)) } catch {}
      window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up)
    }
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', up)
  }

  if (pathname === '/login') return <>{children}</>
  if (session === undefined) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>Carregando...</div>
  )
  if (session === null) return null

  return (
    <div className={'app-shell' + (mobileOpen ? ' mobile-open' : '')}>
      <Sidebar />
      <div className="sidebar-resizer" onMouseDown={startDrag} title="Arraste para redimensionar o menu" />
      <div className="mobile-backdrop" onClick={() => setMobileOpen(false)} />
      <main className="main-content">
        <div className="topbar">
          <div className="topbar-left">
            <button className="icon-btn hamburger" onClick={() => setMobileOpen(o => !o)} title="Menu">☰</button>
            <span className="topbar-title">{titulo}</span>
          </div>
          <div className="topbar-right">
            <span className="topbar-user">{session.user.email}</span>
            <button className="icon-btn" onClick={toggleTheme} title="Tema claro / escuro">{theme === 'dark' ? '☀️' : '🌙'}</button>
            <button className="icon-btn" onClick={sair} title="Sair">⎋</button>
          </div>
        </div>
        {children}
        <footer className="app-footer">
          <div className="app-footer-left">
            <span className="app-footer-grd">GRD</span>
            <span className="app-footer-sep">|</span>
            <span className="app-footer-emp">Mineração Rio do Norte</span>
            <span className="app-footer-sep">|</span>
            <span>Engenharia</span>
          </div>
          <div>SGF — Sistema de Gestão da Frota</div>
        </footer>
      </main>
    </div>
  )
}
