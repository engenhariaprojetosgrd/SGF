import { supabaseAdmin } from '@/lib/supabase'
import type { Equipamento } from '@/lib/types'
import FrotaClient from './FrotaClient'

export const revalidate = 30

export default async function FrotaPage() {
  const { data } = await supabaseAdmin()
    .from('equipamentos')
    .select('*')
    .eq('ativo', true)
    .order('tag')

  return <FrotaClient equipamentos={(data ?? []) as Equipamento[]} />
}
