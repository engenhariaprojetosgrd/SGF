'use client'
import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { Sidebar } from './Sidebar'

export function Shell({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const dragging = useRef(false)
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    const t = (localStorage.getItem('sgf-theme') as 'light' | 'dark') || 'light'
    setTheme(t)
    document.documentElement.dataset.theme = t
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => { setMobileOpen(false) }, [pathname])
  useEffect(() => {
    if (session === null && pathname !== '/login') router.replace('/login')
  }, [session, pathname, router])

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

  // Página de login: sem shell
  if (pathname === '/login') return <>{children}</>
  // Carregando sessão
  if (session === undefined) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>Carregando...</div>
  )
  // Sem sessão: redirecionando
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
            <span style={{ fontWeight: 800, color: 'var(--primary)', letterSpacing: '.5px' }}>SGF</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="text-xs text-muted" style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{session.user.email}</span>
            <button className="icon-btn" onClick={toggleTheme} title="Alternar tema claro / escuro">{theme === 'dark' ? '☀️' : '🌙'}</button>
            <button className="icon-btn" onClick={sair} title="Sair">⎋</button>
          </div>
        </div>
        {children}
        <footer style={{ marginTop: 40, padding: '18px 4px 8px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, color: 'var(--text-muted)', fontSize: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 800, color: 'var(--primary)', letterSpacing: '.5px' }}>GRD</span>
            <span style={{ color: 'var(--gray-300)' }}>|</span>
            <span style={{ fontWeight: 600, color: 'var(--text)' }}>Mineração Rio do Norte</span>
            <span style={{ color: 'var(--gray-300)' }}>|</span>
            <span>Seção: Engenharia</span>
          </div>
          <div>SGF — Sistema de Gestão de Falhas da Frota</div>
        </footer>
      </main>
    </div>
  )
}
