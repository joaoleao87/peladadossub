import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type, x-bootstrap-secret'}
Deno.serve(async(req)=>{if(req.method==='OPTIONS')return new Response('ok',{headers:cors});try{
  const url=Deno.env.get('SUPABASE_URL')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!,service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,admin=createClient(url,service)
  const {count}=await admin.from('profiles').select('id',{count:'exact',head:true}).eq('role','superadmin')
  const bootstrap=count===0&&req.headers.get('x-bootstrap-secret')===Deno.env.get('BOOTSTRAP_SECRET')
  let callerId:string|null=null
  if(!bootstrap){const caller=createClient(url,anon,{global:{headers:{Authorization:req.headers.get('Authorization')??''}}});const {data:{user}}=await caller.auth.getUser();if(!user)throw new Error('Não autenticado');callerId=user.id;const {data:profile}=await caller.from('profiles').select('role').eq('id',user.id).single();if(profile?.role!=='superadmin')throw new Error('Acesso negado')}
  const body=await req.json(),action=String(body.action??'create')
  if(action==='delete'){
    const userId=String(body.user_id??'')
    if(!userId)throw new Error('Usuário inválido')
    if(userId===callerId)throw new Error('Você não pode excluir a própria conta')
    const {data:linked}=await admin.from('jogadores').select('id').eq('user_id',userId).maybeSingle()
    if(linked)throw new Error('Contas vinculadas devem ser suspensas, não excluídas')
    const {data:target,error:targetError}=await admin.from('profiles').select('role').eq('id',userId).single();if(targetError)throw targetError
    if(target.role!=='user')throw new Error('Somente usuários comuns sem vínculo podem ser excluídos')
    if(target.role==='superadmin'&&(count??0)<=1)throw new Error('Não é possível excluir o último superadmin')
    const {error}=await admin.auth.admin.deleteUser(userId);if(error)throw error
    return json({ok:true})
  }
  if(action==='suspend'||action==='restore'){
    const userId=String(body.user_id??''),suspended=action==='suspend'
    if(!userId)throw new Error('Usuário inválido')
    if(userId===callerId)throw new Error('Você não pode suspender a própria conta')
    const {data:linked}=await admin.from('jogadores').select('id').eq('user_id',userId).maybeSingle()
    if(!linked)throw new Error('Conta sem vínculo deve ser excluída')
    const {error:authError}=await admin.auth.admin.updateUserById(userId,{ban_duration:suspended?'876000h':'none'});if(authError)throw authError
    const {error:profileError}=await admin.from('profiles').update({ativo:!suspended}).eq('id',userId);if(profileError)throw profileError
    const {error:playerError}=await admin.from('jogadores').update({ativo:!suspended,confirmacao_bloqueada:suspended}).eq('id',linked.id);if(playerError)throw playerError
    return json({ok:true})
  }
  const password=String(body.password??'');if(password.length<8)throw new Error('A senha precisa ter pelo menos 8 caracteres')
  if(action==='reset'){const {error}=await admin.auth.admin.updateUserById(String(body.user_id),{password});if(error)throw error;return json({ok:true})}
  const email=String(body.email??'').trim().toLowerCase(),nome=String(body.nome??'').trim();if(!email||nome.length<2||!['user','admin','superadmin'].includes(body.role))throw new Error('Dados inválidos')
  const {data,error}=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{nome}});if(error)throw error
  const {error:updateError}=await admin.from('profiles').update({role:body.role,tipo_jogador:body.tipo_jogador,mensalista_ativo:body.tipo_jogador==='mensalista',posicao_lista:body.posicao_lista}).eq('id',data.user.id);if(updateError)throw updateError
  return json({id:data.user.id})
}catch(error){return json({error:error instanceof Error?error.message:'Falha ao administrar usuário'})}})
function json(value:unknown,status=200){return new Response(JSON.stringify(value),{status,headers:{...cors,'Content-Type':'application/json'}})}
