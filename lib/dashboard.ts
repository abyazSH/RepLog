import {completedSets,exerciseKey,isCardio,volume,type Data,type Workout} from './model';

type Performance = {kg:number;reps:number};
function bestSet(entries: Workout['exercises']): Performance | null {
  const sets=entries.flatMap(e=>e.sets).filter(s=>s.done&&s.kg!==''&&s.reps!==''&&Number(s.kg)>=0&&Number(s.reps)>0);
  if(!sets.length)return null;
  return sets.map(s=>({kg:Number(s.kg),reps:Number(s.reps)})).sort((a,b)=>b.kg-a.kg||b.reps-a.reps)[0];
}
export function performanceImproved(current:Performance,previous:Performance) {
  return (current.kg>previous.kg&&current.reps>=previous.reps)||(current.kg===previous.kg&&current.reps>previous.reps);
}

export function dashboardStats(data:Data,now=new Date()) {
  const weekStart=new Date(now);weekStart.setHours(0,0,0,0);
  weekStart.setDate(weekStart.getDate()-((weekStart.getDay()+6)%7));
  const previousStart=new Date(weekStart);previousStart.setDate(previousStart.getDate()-7);
  // Match local weekday and time, including daylight saving transitions.
  const previousEnd=new Date(now);previousEnd.setDate(previousEnd.getDate()-7);
  const history=data.sessions.filter(w=>w.finished&&new Date(w.date)<=now).slice().sort((a,b)=>a.date.localeCompare(b.date));
  const week=history.filter(w=>new Date(w.date)>=weekStart);
  const previousWeek=history.filter(w=>new Date(w.date)>=previousStart&&new Date(w.date)<=previousEnd);
  const sets=week.reduce((sum,w)=>sum+completedSets(w),0);
  const previousSets=previousWeek.reduce((sum,w)=>sum+completedSets(w),0);
  const volumeKg=week.reduce((sum,w)=>sum+volume(w),0);
  const previousVolumeKg=previousWeek.reduce((sum,w)=>sum+volume(w),0);

  const observations=new Map<string,{exercise:string;time:number;performance:Performance}[]>();
  for(const w of history){
    const entries=new Map<string,Workout['exercises']>();
    for(const entry of w.exercises)if(!isCardio(entry.exercise)){
      const key=exerciseKey(entry.exercise);entries.set(key,[...(entries.get(key)??[]),entry]);
    }
    for(const [exercise,group] of entries){
      const performance=bestSet(group);if(!performance)continue;
      const key=JSON.stringify([w.templateId,exercise]);
      observations.set(key,[...(observations.get(key)??[]),{exercise,time:new Date(w.date).getTime(),performance}]);
    }
  }
  const compared=new Set<string>(),improved=new Set<string>();
  for(const records of observations.values()){
    const latest=records[records.length-1];
    if(latest.time<weekStart.getTime())continue;
    const prior=records.slice(0,-1).reverse().find(r=>r.time<latest.time);
    if(!prior)continue;
    compared.add(latest.exercise);
    if(performanceImproved(latest.performance,prior.performance))improved.add(latest.exercise);
  }
  const weeklyGoal=data.templates.length;
  return {
    weekStart,previousStart,previousEnd,week,previousWeek,weeklyGoal,
    sessions:week.length,goalPercent:weeklyGoal?Math.round(week.length/weeklyGoal*100):null,
    sets,setsDelta:previousSets?sets-previousSets:null,
    volumeKg,volumeDelta:previousSets?volumeKg-previousVolumeKg:null,
    volumePercent:previousVolumeKg>0?(volumeKg-previousVolumeKg)/previousVolumeKg*100:null,
    comparedExercises:compared.size,improvedExercises:improved.size,
  };
}
