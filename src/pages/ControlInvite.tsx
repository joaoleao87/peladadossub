import { useEffect, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { redeemMatchControlLink } from "../lib/api";
import { supabase } from "../lib/supabase";
import { Spinner } from "../components/Ui";

export function ControlInvite() {
  const { token="" }=useParams(),{session,loading}=useAuth(),[peladaId,setPeladaId]=useState(""),[error,setError]=useState(""),[guestAttempted,setGuestAttempted]=useState(false);
  useEffect(()=>{if(loading||session||guestAttempted||!token)return;setGuestAttempted(true);void supabase.auth.signInAnonymously({options:{data:{nome:"Operador convidado"}}}).then(({error:value})=>{if(value)throw value}).catch((value:unknown)=>setError(value instanceof Error?value.message:"N\u00e3o foi poss\u00edvel criar o acesso tempor\u00e1rio."))},[guestAttempted,loading,session,token]);
  useEffect(()=>{if(!session||!token)return;let active=true;void redeemMatchControlLink(token).then((id:string)=>active&&setPeladaId(id)).catch((value:unknown)=>active&&setError(value instanceof Error?value.message:"Não foi possível usar este link."));return()=>{active=false}},[session,token]);
  if(loading||(!session&&!error))return <Spinner/>;
  if(error)return <section className="auth-page"><h1>Link indisponível</h1><p>{error}</p></section>;
  return peladaId?<Navigate to={`/controle-partida?pelada=${peladaId}`} replace/>:<Spinner/>;
}
