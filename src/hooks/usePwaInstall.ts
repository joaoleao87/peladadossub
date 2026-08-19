import {useCallback,useEffect,useState} from 'react'

export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{outcome:'accepted'|'dismissed';platform:string}>
}
declare global { interface Navigator { standalone?: boolean } }
export type InstallState='loading'|'installed'|'installable'|'ios'|'unsupported'

let deferredPrompt:BeforeInstallPromptEvent|null=null,installedByEvent=false
const subscribers=new Set<()=>void>()
const notify=()=>subscribers.forEach(update=>update())
const isInstalled=()=>typeof window!=='undefined'&&(window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true)
const getState=():InstallState=>typeof window==='undefined'?'loading':installedByEvent||isInstalled()?'installed':/iPad|iPhone|iPod/.test(navigator.userAgent)?'ios':deferredPrompt?'installable':'unsupported'
if(typeof window!=='undefined'){
  window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();deferredPrompt=event as BeforeInstallPromptEvent;notify()})
  window.addEventListener('appinstalled',()=>{deferredPrompt=null;installedByEvent=true;notify()})
}

export function usePwaInstall(){
  const [state,setState]=useState<InstallState>('loading')
  useEffect(()=>{
    const media=window.matchMedia('(display-mode: standalone)'),update=()=>setState(getState())
    subscribers.add(update);update();media.addEventListener('change',update)
    return()=>{subscribers.delete(update);media.removeEventListener('change',update)}
  },[])
  const install=useCallback(async()=>{if(!deferredPrompt)return false;const prompt=deferredPrompt;await prompt.prompt();const {outcome}=await prompt.userChoice;deferredPrompt=null;installedByEvent=outcome==='accepted';notify();return outcome==='accepted'},[])
  return {state,install}
}
