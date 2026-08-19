import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { configured, supabase } from '../lib/supabase'
import type { Profile } from '../lib/database.types'

export type PreviewMode='mensalista'|'diarista'|'sem_vinculo'|null
interface AuthState { session: Session | null; profile: Profile | null; realProfile: Profile | null; preview:PreviewMode; setPreview:(mode:PreviewMode)=>void; loading: boolean; refreshProfile: () => Promise<void> }
const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [preview,setPreviewState]=useState<PreviewMode>(()=>(sessionStorage.getItem('profile-preview') as PreviewMode)||null)
  const [loading, setLoading] = useState(configured)
  const loadProfile = async (current: Session | null) => { if (!current) { setProfile(null); return }; const { data, error } = await supabase.from('profiles').select('*').eq('id', current.user.id).maybeSingle(); if (!error && !data) { setProfile(null); await supabase.auth.signOut(); return }; setProfile(data as Profile | null) }
  const refreshProfile = () => loadProfile(session)
  useEffect(() => { if (!configured) return; supabase.auth.getSession().then(({ data }) => { setSession(data.session); return loadProfile(data.session) }).finally(() => setLoading(false)); const { data } = supabase.auth.onAuthStateChange((_event, next) => { setSession(next); void loadProfile(next) }); return () => data.subscription.unsubscribe() }, [])
  const setPreview=(mode:PreviewMode)=>{setPreviewState(mode);if(mode)sessionStorage.setItem('profile-preview',mode);else sessionStorage.removeItem('profile-preview')}
  const viewed=profile&&preview?{...profile,role:'user' as const,tipo_jogador:preview==='mensalista'?'mensalista' as const:'avulso' as const,mensalista_ativo:preview==='mensalista'}:profile
  return <AuthContext.Provider value={{ session, profile:viewed, realProfile:profile, preview, setPreview, loading, refreshProfile }}>{children}</AuthContext.Provider>
}
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() { const value = useContext(AuthContext); if (!value) throw new Error('AuthProvider ausente'); return value }
