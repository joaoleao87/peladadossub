import { Alert,Box,Button,Chip,CircularProgress,Snackbar,Stack,Typography } from '@mui/material'
import type { ReactNode } from 'react'

export function Spinner(){return <Stack direction="row" sx={{alignItems:'center',justifyContent:'center',gap:1.5,minHeight:180}}><CircularProgress size={24}/><Typography color="text.secondary">Carregando…</Typography></Stack>}
export function Empty({title,children}:{title:string;children?:ReactNode}){return <Box className="empty" sx={{py:4,textAlign:'center'}}><Typography sx={{fontSize:28,color:'primary.main'}}>○</Typography><Typography component="strong" sx={{display:'block',fontWeight:800}}>{title}</Typography>{children&&<Typography component="small" sx={{display:'block',color:'text.secondary',mt:.5}}>{children}</Typography>}</Box>}
export function ErrorState({message,retry}:{message:string;retry?:()=>void}){return <Alert severity="error" variant="outlined" action={retry&&<Button color="inherit" size="small" onClick={retry}>Tentar novamente</Button>}><strong>Algo saiu do jogo.</strong><br/>{message}</Alert>}
export function Toast({message}:{message:string}){return <Snackbar open={Boolean(message)} anchorOrigin={{vertical:'bottom',horizontal:'center'}} message={message}/>}
export function Badge({children,tone='yellow'}:{children:ReactNode;tone?:'yellow'|'green'|'red'|'gray'}){const color=tone==='yellow'?'primary':tone==='green'?'success':tone==='red'?'error':'default';return <Chip className={`badge ${tone}`} color={color} size="small" label={children}/>}
