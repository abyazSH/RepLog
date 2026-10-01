"use client";
import {useEffect,useRef,useState} from 'react';
import {Download,Share2,X} from 'lucide-react';
import {useLanguage} from './language';
import {shareSummary} from '@/lib/share';
import type {Workout} from '@/lib/model';

export default function ShareCard({workout,onClose,sample=false}:{workout:Workout;onClose:()=>void;sample?:boolean}){
 const {language,locale,fmt}=useLanguage();
 const en=language==='en';
 const [format,setFormat]=useState<'story'|'square'>('story');
 const [showVolume,setShowVolume]=useState(true);
 const [showExercises,setShowExercises]=useState(true);
 const [message,setMessage]=useState('');
 const [busy,setBusy]=useState(false);
 const [file,setFile]=useState<File|null>(null);
 const [preview,setPreview]=useState('');
 const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const element=dialog.current;const previous=document.activeElement as HTMLElement|null;element?.showModal();return()=>{element?.close();previous?.focus();};},[]);
 useEffect(()=>{
  let active=true;let url='';setFile(null);setMessage('');
  const summary=shareSummary(workout);
  const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=format==='story'?1920:1080;
  const ctx=canvas.getContext('2d');if(!ctx){setMessage(en?'Image preview is unavailable.':'Pratinjau gambar tidak tersedia.');return;}
  const W=canvas.width,H=canvas.height,pad=80;
  const bg=ctx.createLinearGradient(0,0,W,H);bg.addColorStop(0,'#253221');bg.addColorStop(1,'#0f1510');ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
  ctx.strokeStyle='#36452d';ctx.lineWidth=2;for(let i=0;i<6;i++){ctx.beginPath();ctx.arc(W+100,0,300+i*100,0,Math.PI*2);ctx.stroke();}
  function text(value:string,y:number,size=32,color='#eff4e9',weight=500){ctx!.font=`${weight} ${size}px Arial, sans-serif`;ctx!.fillStyle=color;ctx!.fillText(value,pad,y,W-pad*2);}
  function fit(value:string,y:number,size:number,color:string){while(size>24){ctx!.font=`800 ${size}px Arial, sans-serif`;if(ctx!.measureText(value).width<=W-pad*2)break;size-=2;}text(value,y,size,color,800);}
  const tall=format==='story';const start=tall?350:240;
  text('replog',130,54,'#c7f76b',800);
  text(sample?(en?'DEMO · SAMPLE WORKOUT':'DEMO · CONTOH LATIHAN'):(en?'WORKOUT COMPLETE':'LATIHAN SELESAI'),start-65,25,'#c7f76b',700);
  fit(summary.name,start+20,tall?98:78,'#f6f8ef');
  text(new Date(summary.date).toLocaleDateString(locale,{day:'numeric',month:'long',year:'numeric'}),start+80,30,'#b7c1ac');
  const y=start+180;
  ctx.fillStyle='#ffffff09';ctx.fillRect(pad,y,W-pad*2,160);
  text(`${summary.exerciseCount}`,y+70,55,'#c7f76b',800);text(en?'EXERCISES':'GERAKAN',y+118,23,'#b7c1ac');
  ctx.font='800 55px Arial, sans-serif';ctx.fillStyle='#c7f76b';ctx.fillText(String(summary.setCount),570,y+70);
  ctx.font='500 23px Arial, sans-serif';ctx.fillStyle='#b7c1ac';ctx.fillText(en?'COMPLETED SETS':'SET SELESAI',570,y+118);
  let cursor=y+235;
  if(showVolume){text(`${fmt(summary.volume)} kg`,cursor,48,'#f6f8ef',800);text(en?'VOLUME · WEIGHT × REPS':'VOLUME · BEBAN × REPETISI',cursor+44,23,'#b7c1ac');cursor+=130;}
  if(showExercises){for(const exercise of summary.exercises.slice(0,tall?6:2)){text(`${exercise.name} · ${exercise.setCount} ${en?'sets':'set'}`,cursor,29,'#d8e1d0');cursor+=52;}
   const extra=summary.exerciseCount-(tall?6:2);if(extra>0)text(en?`+ ${extra} more exercises`:`+ ${extra} gerakan lainnya`,cursor,25,'#a8b49a');}
  ctx.fillStyle='#c7f76b';ctx.fillRect(pad,H-180,64,6);
  text(en?'ONE SET CLOSER.':'SATU SET LEBIH DEKAT.',H-112,30,'#c7f76b',800);
  text(en?'Logged with RepLog':'Dicatat dengan RepLog',H-60,22,'#a8b49a');
  canvas.toBlob(blob=>{if(!active)return;if(!blob){setMessage(en?'Could not create the image.':'Gambar belum dapat dibuat.');return;}url=URL.createObjectURL(blob);setPreview(url);setFile(new File([blob],`replog-${format}-${new Date(workout.date).toISOString().slice(0,10)}.png`,{type:'image/png'}));},'image/png');
  return()=>{active=false;if(url)URL.revokeObjectURL(url);};
 },[workout,format,showVolume,showExercises,language]);
 function download(){if(!file)return;const url=URL.createObjectURL(file);const a=document.createElement('a');a.href=url;a.download=file.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setMessage(en?'Image downloaded. You can upload it to your story or send it to a friend.':'Gambar diunduh. Kamu bisa mengunggahnya ke Story atau mengirimkannya ke teman.');}
 async function share(){if(!file)return;setMessage('');if(!navigator.share||!navigator.canShare?.({files:[file]})){download();return;}setBusy(true);try{await navigator.share({files:[file],title:'RepLog'});setMessage(en?'Image handed to the sharing app.':'Gambar diteruskan ke aplikasi berbagi.');}catch(error){if(!(error instanceof DOMException&&error.name==='AbortError'))setMessage(en?'Could not share. Use Download PNG instead.':'Belum bisa berbagi. Gunakan Unduh PNG.');}finally{setBusy(false);}}
 return <dialog ref={dialog} className="share-dialog panel" onCancel={onClose} aria-labelledby="share-title"><div className="section-title"><h2 id="share-title">{en?'Share your workout':'Bagikan latihanmu'}</h2><button className="icon-button" type="button" aria-label={en?'Close preview':'Tutup pratinjau'} onClick={onClose}><X/></button></div><p className="muted">{en?'Preview exactly what you will share. Email, body weight, and private notes are excluded.':'Pratinjau isi yang akan kamu bagikan. Email, berat badan, dan catatan pribadi tidak disertakan.'}</p><div className="share-layout"><div className="share-preview">{preview&&<img src={preview} alt={en?'Workout card preview':'Pratinjau kartu latihan'}/>}</div><div className="share-options"><fieldset><legend>{en?'Image format':'Format gambar'}</legend><label><input type="radio" name="share-format" checked={format==='story'} onChange={()=>setFormat('story')}/>Story · 9:16</label><label><input type="radio" name="share-format" checked={format==='square'} onChange={()=>setFormat('square')}/>{en?'Square':'Persegi'} · 1:1</label></fieldset><label><input type="checkbox" checked={showVolume} onChange={e=>setShowVolume(e.target.checked)}/>{en?'Show volume':'Tampilkan volume'}</label><label><input type="checkbox" checked={showExercises} onChange={e=>setShowExercises(e.target.checked)}/>{en?'Show exercises':'Tampilkan gerakan'}</label><button type="button" className="primary" disabled={!file||busy} onClick={share}><Share2 size={18}/>{busy?(en?'Sharing…':'Membagikan…'):(en?'Share':'Bagikan')}</button><button type="button" className="secondary" disabled={!file||busy} onClick={download}><Download size={18}/>{en?'Download PNG':'Unduh PNG'}</button><small className="muted">{en?'If your browser cannot share files, the image will be downloaded instead.':'Jika browser tidak mendukung berbagi file, gambar akan diunduh.'}</small><p role="status">{message}</p></div></div></dialog>;
}
