'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function entrar(e: React.FormEvent) {
    e.preventDefault()
    setErro(null); setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha })
    setLoading(false)
    if (error) { setErro('E-mail ou senha inválidos.'); return }
    router.replace('/farol')
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: 20 }}>
      <form onSubmit={entrar} className="card" style={{ width: '100%', maxWidth: 380, padding: 28 }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 30 }}>⚙️</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--primary)' }}>SGF</div>
          <div className="text-xs text-muted">Sistema de Gestão da Frota</div>
          <div className="text-xs text-muted" style={{ marginTop: 4 }}>GRD · Mineração Rio do Norte · Engenharia</div>
        </div>
        <div className="form-group">
          <label className="form-label">E-mail</label>
          <input type="email" className="form-control" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" required />
        </div>
        <div className="form-group">
          <label className="form-label">Senha</label>
          <input type="password" className="form-control" value={senha} onChange={e => setSenha(e.target.value)} placeholder="••••••••" required />
        </div>
        {erro && <div className="alert alert-danger" style={{ marginBottom: 12 }}>{erro}</div>}
        <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}
