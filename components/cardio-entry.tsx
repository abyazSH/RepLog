"use client";
import {useState} from 'react';
import {Check,Activity} from 'lucide-react';
import {useLanguage} from './language';
import {entrySchema,emptyCardio,type Workout} from '@/lib/model';
import {fieldsFor,cardioSummary} from '@/lib/cardio';

export default function CardioEntry({entry,previous,onChange}:{entry:Workout['exercises'][number];previous?:Workout['exercises'][number];onChange:(entry:Workout['exercises'][number])=>void}) {
  const {language,locale}=useLanguage();const en=language==='en';
  const [error,setError]=useState('');const c=entry.cardio??emptyCardio();
  const treadmill=entry.exercise.tracking==='treadmill';
  function complete(){
    if(c.done) return;
    const next={...entry,cardio:{...c,done:!c.done}};
    if(!entrySchema.safeParse(next).success){setError(en?'Enter a valid duration. Treadmill also needs speed and incline.':'Isi durasi yang valid. Treadmill juga memerlukan speed dan incline.');return;}
    setError('');onChange(next);
  }
  return <section className="panel exercise-card cardio-entry">
    <div className="exercise-head"><span className="exercise-number"><Activity size={20}/></span><div><h3>{entry.exercise.name}</h3><p>{treadmill?'Treadmill':en?'Stationary bike':'Sepeda gym'}{entry.exercise.targetMinutes?` · ${en?'Target':'Target'} ${entry.exercise.targetMinutes} min`:''}</p></div></div>
    <div className="previous"><Activity size={15}/><span>{en?'Previous session: ':'Sesi sebelumnya: '}{previous?cardioSummary(previous,locale):en?'No previous record':'Belum ada catatan'}</span></div>
    <div className="cardio-fields">{fieldsFor(entry.exercise.tracking).map(f=><label key={f.key}>{en?f.en:f.id}{!treadmill&&f.key!=='durationMinutes'&&<small> · {en?'optional':'opsional'}</small>}<input disabled={c.done} type="number" inputMode="decimal" step="any" min={f.key==='durationMinutes'||f.key==='speedKmh'?0.01:0} max={f.max} value={c[f.key]} placeholder={f.key==='durationMinutes'?'20':'0'} aria-label={`${entry.exercise.name} ${en?f.en:f.id}`} onChange={event=>{
      if(c.done)return;
      const value=event.target.value;if(value!==''&&!/^\d+(\.\d+)?$/.test(value))return;
      if(Number(value)>f.max)return;
      setError('');onChange({...entry,cardio:{...c,[f.key]:value,done:false}});
    }}/></label>)}</div>
    <p className="hint">{treadmill?(en?'If settings change, record the average speed and incline for this entry.':'Jika pengaturan berubah, catat rata-rata speed dan incline untuk catatan ini.'):(en?'Copy values from the bike display; leave unavailable metrics empty. Use the same machine name to compare resistance levels.':'Salin angka dari layar sepeda; kosongkan metrik yang tidak tersedia. Gunakan nama mesin yang sama untuk membandingkan level resistance.')}</p>
    {error&&<p className="error" role="alert">{error}</p>}
    <button type="button" disabled={c.done} className={c.done?'secondary':'primary'} aria-pressed={c.done} onClick={complete}><Check size={18}/>{c.done?(en?'Completed · locked':'Selesai · terkunci'):(en?'Complete cardio':'Tandai kardio selesai')}</button>
  </section>;
}
