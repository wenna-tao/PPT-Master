import test from 'node:test';
import assert from 'node:assert/strict';
import {initialFocus,validMinutes,remainingMs,startFocus,pauseFocus,resetFocus,setFocusMinutes,tickFocus,hydrateFocus,formatFocus,todayFocus} from '../public/shared/focus-model.js';
const now=Date.UTC(2026,9,23,12),task={id:'task-1',projectId:'p-1',title:'练习演讲',projectName:'课程汇报'};
test('duration boundaries are enforced and default is 50 minutes',()=>{
  assert.equal(initialFocus().minutes,50);assert.equal(validMinutes(25),25);assert.equal(validMinutes(120),120);
  for(const n of [24,121,25.5,NaN,Infinity,''])assert.throws(()=>validMinutes(n));
  assert.equal(formatFocus(120*60000),'120:00');assert.equal(formatFocus(0),'00:00');assert.equal(formatFocus(1001),'00:02');
});
test('timer derives remaining time from deadline after background throttling or reload',()=>{
  const started=startFocus(initialFocus(),now,'session-1',task);
  assert.equal(remainingMs(started,now+11*60000),39*60000);
  const restored=hydrateFocus(JSON.parse(JSON.stringify(started)),now+49*60000+1000);
  assert.equal(formatFocus(restored.remainingMs),'00:59');assert.deepEqual(restored.task,task);
  assert.equal(remainingMs(restored,now-60000),50*60000);
});
test('pause freezes time and resume keeps the same round and task',()=>{
  const started=startFocus(initialFocus(),now,'session-2',task),paused=pauseFocus(started,now+10*60000);
  assert.equal(paused.status,'paused');assert.equal(remainingMs(paused,now+100*60000),40*60000);
  const restored=hydrateFocus(JSON.parse(JSON.stringify(paused)),now+100*60000);
  const resumed=startFocus(restored,now+100*60000,'must-not-replace',null);
  assert.equal(resumed.id,'session-2');assert.deepEqual(resumed.task,task);assert.equal(resumed.endsAt,now+140*60000);
  assert.throws(()=>setFocusMinutes(resumed,25));
});
test('completion is recorded once and retains the actual deadline when returning late',()=>{
  const started=startFocus(initialFocus(25),now,'session-3'),done=tickFocus(started,now+3*3600000);
  assert.equal(done.status,'completed');assert.equal(done.history.length,1);assert.equal(done.history[0].completedAt,now+25*60000);
  assert.equal(tickFocus(done,now+4*3600000).history.length,1);
  const duplicate={...started,history:done.history};assert.equal(tickFocus(duplicate,now+30*60000).history.length,1);
  assert.equal(pauseFocus(started,now+25*60000).status,'completed');
});
test('reset keeps history and preferences, a new session gets a fresh deadline',()=>{
  const done=tickFocus(startFocus({...initialFocus(25),sound:true},now,'session-4'),now+25*60000);
  const reset=resetFocus(done);assert.equal(reset.status,'idle');assert.equal(reset.sound,true);assert.equal(reset.history.length,1);
  const changed=setFocusMinutes(reset,120);assert.equal(changed.remainingMs,120*60000);
  assert.equal(startFocus(changed,now,'session-5').endsAt,now+120*60000);
  assert.deepEqual(todayFocus(done.history,now),{sessions:1,minutes:25});
});
test('restoration validates stored data and removes duplicate or malformed history',()=>{
  const started=startFocus(initialFocus(),now,'session-6');assert.throws(()=>hydrateFocus({...started,minutes:999},now));
  assert.throws(()=>hydrateFocus({...started,endsAt:'tomorrow'},now));
  const done=tickFocus(started,now+50*60000),entry=done.history[0];
  assert.equal(hydrateFocus({...done,history:[entry,entry,{id:'bad'}]},now).history.length,1);
  const expired=hydrateFocus(started,now+60*60000);assert.equal(expired.status,'completed');assert.equal(expired.history.length,1);
});
