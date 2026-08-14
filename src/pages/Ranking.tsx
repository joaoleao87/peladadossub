import { Empty, ErrorState, Spinner } from '../components/Ui'
import { useLoad } from '../hooks/useLoad'
import { rankings } from '../lib/api'

export function Ranking() { const state = useLoad(rankings, []); if (state.loading) return <Spinner/>; if (state.error) return <ErrorState message={state.error} retry={state.reload}/>; const render = (tipo: 'sub_bom'|'sub_ruim', label: string) => { const rows = (state.data ?? []).filter(r => r.tipo === tipo).sort((a,b) => b.pontos-a.pontos); return <div className={`ranking-card ${tipo}`}><h2>{label}</h2>{rows.length ? rows.map((r,i) => <div className="rank" key={r.user_id}><b>{i+1}</b><span>{r.profile?.apelido || r.profile?.nome}</span><strong>{r.pontos} pts</strong></div>) : <Empty title="O ranking começa depois da próxima pelada."/>}</div> }; return <section><p className="eyebrow">A RESENHA TÁ VALENDO</p><h1>Ranking</h1>{render('sub_bom','SUB CRAQUES')}{render('sub_ruim','SUB RUINS')}</section> }
