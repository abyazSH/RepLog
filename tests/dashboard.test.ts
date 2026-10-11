import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyData,newWorkout,type Data,type Workout} from '../lib/model';
import {dashboardStats,performanceImproved} from '../lib/dashboard';

const now=new Date(2026,9,7,12); // Wednesday, noon in the user's local timezone.
const at=(day:number,hour=10)=>new Date(2026,9,day,hour).toISOString();
function session(day:number,kg=30,reps=10,count=1,hour=10):Workout {
  const w=newWorkout(emptyData().templates[0]);w.finished=true;w.date=at(day,hour);
  w.exercises=[w.exercises[0]];
  w.exercises[0].sets=Array.from({length:count},()=>({kg:String(kg),reps:String(reps),done:true}));
  return w;
}
function data(...sessions:Workout[]):Data {return {...emptyData(),sessions};}

test('weekly cards compare equivalent local periods, ignoring future, unfinished and later last-week sessions',()=>{
  const current=session(5,40,10,3);current.exercises[0].sets.push({kg:'999',reps:'100',done:false});
  const previous=session(28,30,10,2);previous.date=new Date(2026,8,28,10).toISOString();
  const late=session(30,100,10,5,13);late.date=new Date(2026,8,30,13).toISOString();
  const draft=session(6);draft.finished=false;
  const state=data(current,previous,late,session(7,100,10,5,13),session(8),draft);
  const before=JSON.stringify(state);const stats=dashboardStats(state,now);
  assert.equal(stats.sessions,1);assert.equal(stats.weeklyGoal,5);assert.equal(stats.goalPercent,20);
  assert.equal(stats.previousWeek.length,1);assert.equal(stats.sets,3);assert.equal(stats.setsDelta,1);
  assert.equal(stats.volumeKg,1200);assert.equal(stats.volumeDelta,600);assert.equal(stats.volumePercent,100);
  assert.equal(stats.previousEnd.getDay(),now.getDay());assert.equal(stats.previousEnd.getHours(),12);
  assert.equal(JSON.stringify(state),before);
});
test('first-time, missing comparable data, empty goals and zero-volume baselines never fabricate percentages',()=>{
  const initial=dashboardStats(emptyData(),now);
  assert.equal(initial.setsDelta,null);assert.equal(initial.volumePercent,null);assert.equal(initial.comparedExercises,0);
  const state=data(session(5,30));state.templates=[];
  assert.equal(dashboardStats(state,now).goalPercent,null);
  assert.equal(dashboardStats(state,now).setsDelta,null);
  const zero=session(28,0);zero.date=new Date(2026,8,28,10).toISOString();
  state.sessions.push(zero);
  const stats=dashboardStats(state,now);
  assert.equal(stats.volumePercent,null);assert.equal(stats.volumeDelta,300);assert.equal(stats.setsDelta,0);
});
test('performance requires more weight without losing reps, or more reps at equal weight',()=>{
  assert.equal(performanceImproved({kg:35,reps:10},{kg:30,reps:10}),true);
  assert.equal(performanceImproved({kg:30,reps:12},{kg:30,reps:10}),true);
  assert.equal(performanceImproved({kg:35,reps:8},{kg:30,reps:10}),false);
  assert.equal(performanceImproved({kg:25,reps:20},{kg:30,reps:10}),false);
  assert.equal(performanceImproved({kg:30,reps:10},{kg:30,reps:10}),false);
});
test('extra sets alone do not count; the latest weekly result is used instead of an earlier peak',()=>{
  const old=session(28);old.date=new Date(2026,8,28,10).toISOString();
  const extra=session(5,30,10,3);
  assert.equal(dashboardStats(data(old,extra),now).improvedExercises,0);
  const peak=session(5,35);const latest=session(6,30);
  assert.equal(dashboardStats(data(old,peak,latest),now).improvedExercises,0);
  latest.exercises[0].sets[0]={kg:'35',reps:'12',done:true};
  assert.equal(dashboardStats(data(old,peak,latest),now).improvedExercises,1);
});
test('exercise comparison keeps programs and variants separate, requires prior completed data, and counts each exercise once',()=>{
  const old=session(28);old.date=new Date(2026,8,28,10).toISOString();
  const improvement=session(5,35);const newVariant=session(6,80);
  newVariant.exercises[0].exercise.name='Different machine';
  const other=session(6,80);other.templateId='new-program';
  const stats=dashboardStats(data(old,improvement,newVariant,other),now);
  assert.equal(stats.comparedExercises,1);assert.equal(stats.improvedExercises,1);
  const secondOld=structuredClone(old);secondOld.id='another';secondOld.templateId='new-program';
  assert.equal(dashboardStats(data(old,secondOld,improvement,other),now).improvedExercises,1);
});
test('cardio sessions count toward consistency but not strength sets, volume or exercise improvement',()=>{
  const cardio=session(5);cardio.exercises[0].exercise.tracking='bike';cardio.exercises[0].sets=[];
  cardio.exercises[0].cardio={durationMinutes:'30',speedKmh:'',inclinePercent:'0',resistance:'8',distanceKm:'10',cadenceRpm:'80',watts:'100',done:true};
  const stats=dashboardStats(data(cardio),now);
  assert.equal(stats.sessions,1);assert.equal(stats.sets,0);assert.equal(stats.volumeKg,0);assert.equal(stats.comparedExercises,0);
});
test('Monday starts a new local week even at midnight',()=>{
  const state=data(session(4,30,10,1,23),session(5,30,10,1,0));
  const stats=dashboardStats(state,new Date(2026,9,5,0));
  assert.equal(stats.sessions,1);assert.equal(stats.weekStart.getDay(),1);assert.equal(stats.weekStart.getHours(),0);
});
