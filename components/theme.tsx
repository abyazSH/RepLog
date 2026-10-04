"use client";
import {createContext,useContext,useEffect,useState} from 'react';
import {Sun,Moon,Monitor} from 'lucide-react';
import {useLanguage} from './language';
import {themePreference,resolveTheme,type ThemePreference} from '@/lib/theme';
const ThemeContext=createContext<{preference:ThemePreference;setTheme:(theme:ThemePreference)=>void}>({preference:'system',setTheme:()=>{}});
export function ThemeProvider({children}:{children:React.ReactNode}){
 const [preference,setPreference]=useState<ThemePreference>('system');
 const [ready,setReady]=useState(false);
 useEffect(()=>{try{setPreference(themePreference(localStorage.getItem('replog-theme')));}catch{}setReady(true);},[]);
 useEffect(()=>{
  if(!ready)return;
  const media=window.matchMedia('(prefers-color-scheme: dark)');
  const apply=()=>{document.documentElement.dataset.theme=resolveTheme(preference,media.matches);};
  apply();media.addEventListener('change',apply);
  return()=>media.removeEventListener('change',apply);
 },[preference,ready]);
 function setTheme(next:ThemePreference){setPreference(next);document.documentElement.dataset.theme=resolveTheme(next,window.matchMedia('(prefers-color-scheme: dark)').matches);try{localStorage.setItem('replog-theme',next);}catch{}}
 return <ThemeContext.Provider value={{preference,setTheme}}>{children}</ThemeContext.Provider>;
}
export function ThemePicker(){
 const {preference,setTheme}=useContext(ThemeContext);const {language}=useLanguage();const en=language==='en';
 return <section className="panel profile-preferences" aria-labelledby="theme-heading"><div><span className="eyebrow">{en?'APPEARANCE':'TAMPILAN'}</span><h2 id="theme-heading">{en?'Color theme':'Tema warna'}</h2><p className="muted">{en?'Follows your device by default. Your choice is saved on this device.':'Secara default mengikuti perangkat. Pilihanmu tersimpan di perangkat ini.'}</p></div><div className="language-picker theme-picker" role="group" aria-labelledby="theme-heading"><button type="button" aria-pressed={preference==='system'} onClick={()=>setTheme('system')}><Monitor size={18}/>{en?'System':'Ikuti perangkat'}</button><button type="button" aria-pressed={preference==='light'} onClick={()=>setTheme('light')}><Sun size={18}/>{en?'Light':'Terang'}</button><button type="button" aria-pressed={preference==='dark'} onClick={()=>setTheme('dark')}><Moon size={18}/>{en?'Dark':'Gelap'}</button></div></section>;
}
