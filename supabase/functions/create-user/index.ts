import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const url = Deno.env.get('SUPABASE_URL')!, anon = Deno.env.get('SUPABASE_ANON_KEY')!, service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const caller = createClient(url, anon, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } })
    const { data: { user } } = await caller.auth.getUser()
    if (!user) throw new Error('Não autenticado')
    const { data: profile } = await caller.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'superadmin') throw new Error('Acesso negado')

    const body = await req.json(), email = String(body.email ?? '').trim().toLowerCase(), nome = String(body.nome ?? '').trim()
    if (!email || nome.length < 2 || !['user','admin','superadmin'].includes(body.role)) throw new Error('Dados inválidos')
    const admin = createClient(url, service)
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, { data: { nome } })
    if (error) throw error
    const { error: updateError } = await admin.from('profiles').update({ role: body.role, tipo_jogador: body.tipo_jogador, mensalista_ativo: body.tipo_jogador === 'mensalista', posicao_lista: body.posicao_lista }).eq('id', data.user.id)
    if (updateError) throw updateError
    return new Response(JSON.stringify({ id: data.user.id }), { headers: { ...cors, 'Content-Type': 'application/json' } })
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Falha ao criar usuário' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
  }
})
