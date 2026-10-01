"use client";
import { createContext, useContext, useEffect, useState } from 'react';
import { translate, type Language } from '@/lib/i18n';
const Context = createContext<{language: Language; setLanguage: (v: Language) => void}>({language:'id',setLanguage:()=>{}});
export function LanguageProvider({children}:{children:React.ReactNode}) {
  const [language,setLanguageState]=useState<Language>('id');
  useEffect(()=>{try {if(localStorage.getItem('replog-language')==='en')setLanguageState('en');}catch{}},[]);
  useEffect(()=>{document.documentElement.lang=language;},[language]);
  function setLanguage(value:Language){setLanguageState(value);try{localStorage.setItem('replog-language',value);}catch{}}
  return <Context.Provider value={{language,setLanguage}}>{children}</Context.Provider>;
}
export function useLanguage(){
 const {language,setLanguage}=useContext(Context);
 const locale=language==='en'?'en-US':'id-ID';
 const t=<T,>(value:T):T=> typeof value==='string'?translate(value,language) as T:value;
 return {language,setLanguage,locale,t,fmt:(n:number)=>new Intl.NumberFormat(locale,{maximumFractionDigits:1}).format(n),dateLabel:(s:string)=>new Date(s).toLocaleDateString(locale,{day:'numeric',month:'short'}),days:language==='en'?['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']:['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu']};
}
export function LanguagePicker(){const {language,setLanguage}=useLanguage();return <div className="language-picker" role="group" aria-label={language==='id'?'Bahasa tampilan':'Display language'}><button type="button" lang="id" aria-pressed={language==='id'} onClick={()=>setLanguage('id')}>Indonesia</button><button type="button" lang="en" aria-pressed={language==='en'} onClick={()=>setLanguage('en')}>English</button></div>;}
