import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Shell } from '@/components/Shell'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'SGF — Sistema de Gestão de Falhas da Frota',
  description: 'Gestão centralizada de falhas, manutenção e disponibilidade da frota industrial',
}

const themeScript = `try{var t=localStorage.getItem('sgf-theme');if(t)document.documentElement.dataset.theme=t;var w=localStorage.getItem('sgf-sidebar-w');if(w)document.documentElement.style.setProperty('--sidebar-w',w+'px')}catch(e){}`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body className={inter.className}>
        <Shell>{children}</Shell>
      </body>
    </html>
  )
}
