"use client";
import {useEffect,useState} from 'react';
import {browserClient} from '@/lib/supabase/client';
import {canOpenDashboard} from '@/lib/guest-access';
import {useLanguage} from './language';
export default function GuestOnly({children}:{children:React.ReactNode}) {
 const enabled=!!(process.env.NEXT_PUBLIC_SUPABASE_URL&&process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
 const [state,setState]=useState<'checking'|'guest'|'error'>('checking');
 const [retry,setRetry]=useState(0);
 const {language}=useLanguage();
 useEffect(()=>{
  if(!enabled)return;
  let active=true,version=0;
  const client=browserClient();
  async function check(){
   const current=++version;setState('checking');
   try {
    const allowed=await canOpenDashboard(client);
    if(!active||current!==version)return;
    if(allowed){window.location.replace('/dashboard');return;}
    setState('guest');
   }catch{if(active&&current===version)setState('error');}
  }
  void check();
  let scheduled:ReturnType<typeof setTimeout>|undefined;
  const {data:{subscription}}=client.auth.onAuthStateChange(event=>{
   if(event==='SIGNED_IN'||event==='SIGNED_OUT'||event==='TOKEN_REFRESHED'){
    if(scheduled)clearTimeout(scheduled);
    scheduled=setTimeout(()=>{if(active)void check();},0);
   }
  });
  const onPageShow=(event:PageTransitionEvent)=>{if(event.persisted)void check();};
  window.addEventListener('pageshow',onPageShow);
  return()=>{active=false;version++;if(scheduled)clearTimeout(scheduled);subscription.unsubscribe();window.removeEventListener('pageshow',onPageShow);};
 },[enabled,retry]);
 if(!enabled||state==='guest')return <>{children}</>;
 const en=language==='en';
 return <main className="loading" aria-busy={state==='checking'}><div><div className="brand">rep<span>log</span></div><p role="status">{state==='error'?(en?'Unable to check your session. Please try again.':'Sesi belum dapat diperiksa. Silakan coba lagi.'):(en?'Checking your login session…':'Memeriksa sesi login…')}</p>{state==='error'&&<button type="button" className="secondary" onClick={()=>setRetry(value=>value+1)}>{en?'Try again':'Coba lagi'}</button>}</div></main>;
}
