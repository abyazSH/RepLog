import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyData,newWorkout} from '../lib/model';
import {shareSummary} from '../lib/share';
import {translate} from '../lib/i18n';
test('share card counts completed valid sets and excludes private notes and unfinished entries',()=>{
 const w=newWorkout(emptyData().templates[1]);w.notes='private note';w.finished=true;
 w.exercises[0].sets=[{kg:'20',reps:'10',done:true},{kg:'100',reps:'10',done:false},{kg:'0',reps:'8',done:true}];
 w.exercises[1].sets=[{kg:'',reps:'12',done:true}];
 const result=shareSummary(w);assert.equal(result.setCount,2);assert.equal(result.exerciseCount,1);assert.equal(result.volume,200);assert.ok(!JSON.stringify(result).includes('private note'));assert.ok(!('notes' in result));
});
test('language messages preserve spacing, dynamic names and unknown user content',()=>{
 assert.equal(translate(' Jeda ','en'),' Pause ');
 assert.equal(translate('Acuan Push terakhir · September 30, 2026','en'),'Previous Push reference · September 30, 2026');
 assert.equal(translate('Siap untuk set berikutnya, Sam?','en'),'Ready for your next set, Sam?');
 assert.equal(translate('Catatan saya sendiri','en'),'Catatan saya sendiri');
 assert.equal(translate('Jeda','id'),'Jeda');
 assert.equal(translate('YOUR PACE. YOUR PROGRESS.','id'),'RITMEMU. PERKEMBANGANMU.');
});
