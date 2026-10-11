import { isCardio, type Cardio, type Data, type Workout } from './model';
export const cardioFields = [
  {key:'durationMinutes',id:'Durasi (menit)',en:'Duration (minutes)',unit:'min',max:600},
  {key:'speedKmh',id:'Speed (km/jam)',en:'Speed (km/h)',unit:'km/h',max:50},
  {key:'inclinePercent',id:'Incline (%)',en:'Incline (%)',unit:'%',max:40},
  {key:'resistance',id:'Resistance (level)',en:'Resistance (level)',unit:'level',max:1000},
  {key:'distanceKm',id:'Jarak mesin (km)',en:'Machine distance (km)',unit:'km',max:500},
  {key:'cadenceRpm',id:'Cadence (RPM)',en:'Cadence (RPM)',unit:'RPM',max:300},
  {key:'watts',id:'Power (watt)',en:'Power (watts)',unit:'W',max:3000},
] as const;
export function fieldsFor(type: string | undefined) {
  return cardioFields.filter(f => type==='treadmill'
    ? ['durationMinutes','speedKmh','inclinePercent'].includes(f.key)
    : ['durationMinutes','resistance','distanceKm','cadenceRpm','watts'].includes(f.key));
}
export function cardioSummary(entry: Workout['exercises'][number], locale: string) {
  if(!isCardio(entry.exercise) || !entry.cardio?.done) return locale==='en-US'?'Not completed':'Tidak diselesaikan';
  const fmt=new Intl.NumberFormat(locale,{maximumFractionDigits:2});
  return fieldsFor(entry.exercise.tracking).filter(f=>entry.cardio![f.key]!=='').map(f=>`${f.key==='resistance' ? (locale==='en-US'?'Resistance ':'Resistance ') : ''}${fmt.format(Number(entry.cardio![f.key]))} ${f.unit}`).join(' · ');
}
export function cardioProgress(data: Data, templateId: string) {
  const entries=new Map<string,{name:string;tracking:string;points:{date:string;cardio:Cardio}[]}>();
  const key=(e:Workout['exercises'][number]['exercise'])=>`${e.tracking}:${e.name.trim().toLowerCase()}`;
  for(const e of data.templates.find(t=>t.id===templateId)?.exercises??[]) if(isCardio(e)) entries.set(key(e),{name:e.name,tracking:e.tracking!,points:[]});
  for(const w of [...data.sessions].filter(w=>w.finished&&w.templateId===templateId).sort((a,b)=>a.date.localeCompare(b.date))) {
    for(const e of w.exercises) if(isCardio(e.exercise)&&e.cardio?.done) {
      const record=entries.get(key(e.exercise))??{name:e.exercise.name,tracking:e.exercise.tracking!,points:[]};
      record.points.push({date:w.date,cardio:e.cardio});entries.set(key(e.exercise),record);
    }
  }
  return [...entries].map(([key,value])=>({key,...value,points:value.points.slice(-12)}));
}
