import type { ReactNode } from 'react'

export function Spinner() { return <div className="state"><span className="spinner" /> Carregando…</div> }
export function Empty({ title, children }: { title: string; children?: ReactNode }) { return <div className="empty"><span>○</span><strong>{title}</strong>{children && <small>{children}</small>}</div> }
export function ErrorState({ message, retry }: { message: string; retry?: () => void }) { return <div className="error"><strong>Algo saiu do jogo.</strong><span>{message}</span>{retry && <button className="link" onClick={retry}>Tentar novamente</button>}</div> }
export function Toast({ message }: { message: string }) { return message ? <div className="toast" role="status">{message}</div> : null }
export function Badge({ children, tone = 'yellow' }: { children: ReactNode; tone?: 'yellow' | 'green' | 'red' | 'gray' }) { return <span className={`badge ${tone}`}>{children}</span> }
