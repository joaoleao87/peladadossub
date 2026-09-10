import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { redeemMatchControlLink } from "../lib/api";
import { Spinner } from "../components/Ui";

export function ControlInvite() {
  const { token="" }=useParams(),{session,loading}=useAuth(),[peladaId,setPeladaId]=useState(""),[error,setError]=useState("");
  useEffect(()=>{if(!session||!token)return;let active=true;void redeemMatchControlLink(token).then((id:string)=>active&&setPeladaId(id)).catch((value:unknown)=>active&&setError(value instanceof Error?value.message:"Não foi possível usar este link."));return()=>{active=false}},[session,token]);
  if(loading)return <Spinner/>;
  if(!session)return <section className="auth-page"><h1>Controle da partida</h1><p>Entre na sua conta para usar este link.</p><Link className="button" to={`/auth?next=${encodeURIComponent(`/controle-partida/convite/${token}`)}`}>ENTRAR</Link></section>;
  if(error)return <section className="auth-page"><h1>Link indisponível</h1><p>{error}</p></section>;
  return peladaId?<Navigate to={`/controle-partida?pelada=${peladaId}`} replace/>:<Spinner/>;
}
