import test from 'node:test';
import assert from 'node:assert/strict';
import {initialFocus,startFocus,pauseFocus,tickFocus,hydrateFocus,HISTORY_LIMIT} from '../public/shared/focus-model.js';
import {periodRange,shiftAnchor,isCurrentPeriod,canGoNext,periodTitle,chartFrame,summarize,niceAxis,formatDuration,plotGrid,witheredEntry,hydrateWithered,appendWithered,dayKey,WITHERED_LIMIT} from '../public/shared/grove-model.js';
// Local-time dates keep these tests independent of the machine's time zone.
const at=(y,m,d,h=12,min=0)=>new Date(y,m-1,d,h,min).getTime();
const done=(id,end,minutes=50,taskTitle='写报告')=>({id,minutes,completedAt:end,taskTitle,projectName:'课程汇报'});

test('periods use local days, Monday weeks, whole months and years',()=>{
  const sat=new Date(2026,10,14,9);
  assert.deepEqual(Object.values(periodRange('day',sat)).map(dayKey),['2026-11-14','2026-11-15']);
  assert.deepEqual(Object.values(periodRange('week',sat)).map(dayKey),['2026-11-09','2026-11-16']);
  assert.deepEqual(Object.values(periodRange('month',sat)).map(dayKey),['2026-11-01','2026-12-01']);
  assert.deepEqual(Object.values(periodRange('year',sat)).map(dayKey),['2026-01-01','2027-01-01']);
  assert.equal(dayKey(periodRange('week',new Date(2026,10,16)).start),'2026-11-16');
  assert.equal(dayKey(shiftAnchor('month',new Date(2026,0,31),1)),'2026-02-01');
  assert.equal(dayKey(shiftAnchor('year',sat,-1)),'2025-01-01');
});

test('navigation stops at the current period and titles mark today, this week, month and year',()=>{
  const now=new Date(2026,10,14,18);
  assert.equal(canGoNext('day',now,now),false);assert.equal(canGoNext('day',shiftAnchor('day',now,-1),now),true);
  assert.equal(canGoNext('year',new Date(2025,5,1),now),true);assert.equal(canGoNext('year',now,now),false);
  assert.equal(isCurrentPeriod('week',new Date(2026,10,10),now),true);
  assert.equal(periodTitle('day',now,now),'2026年11月14日 (今天)');
  assert.equal(periodTitle('day',new Date(2026,10,13),now),'2026年11月13日 (昨天)');
  assert.equal(periodTitle('week',now,now),'11月9日 – 11月15日 (本周)');
  assert.equal(periodTitle('week',new Date(2025,11,31),now),'2025年12月29日 – 1月4日');
  assert.equal(periodTitle('month',new Date(2026,9,3),now),'2026年10月');
  assert.equal(periodTitle('year',new Date(2025,0,1),now),'2025年');
});

test('chart frames have one bin per hour, weekday, day or month, with ticks on real bins',()=>{
  const day=chartFrame('day',periodRange('day',new Date(2026,10,14)));assert.equal(day.edges.length,25);assert.deepEqual(day.ticks.map(t=>t.text),['0时','6时','12时','18时']);
  const feb=chartFrame('month',periodRange('month',new Date(2026,1,10)));assert.equal(feb.labels.length,28);assert.equal(feb.ticks.at(-1).text,'28');
  const year=chartFrame('year',periodRange('year',new Date(2026,1,10)));assert.equal(year.labels.length,12);assert.equal(year.ticks.length,12);
  const week=chartFrame('week',periodRange('week',new Date(2026,10,14)));assert.equal(week.labels[0],'周一 11/9');assert.equal(week.ticks[6].text,'日');
});

test('minutes are spread across the hours and days a round covered, and totals stay exact',()=>{
  const history=[done('a',at(2026,11,14,10,30)),done('b',at(2026,11,15,0,20),50),done('c',at(2026,11,14,23,0),25)];
  const day=summarize(history,[],'day',new Date(2026,11-1,14));
  assert.equal(day.healthy,2);assert.equal(day.bins[9],20);assert.equal(day.bins[10],30);assert.equal(day.bins[22],25);
  assert.equal(day.bins[23],30,'the round finishing after midnight still counts its minutes before midnight');
  assert.equal(day.totalMinutes,105);assert.equal(day.bins.reduce((x,y)=>x+y,0),day.totalMinutes);
  const next=summarize(history,[],'day',new Date(2026,10,15));assert.equal(next.healthy,1);assert.equal(next.totalMinutes,20);
  const year=summarize(history,[],'year',new Date(2026,0,1));assert.equal(year.healthy,3);assert.equal(year.bins[10],125);assert.equal(year.totalMinutes,125);
});

test('withered trees are counted separately and add no focus minutes',()=>{
  const withered=[{id:'w1',at:at(2026,11,14,15),plannedMinutes:50,focusedMinutes:12,taskTitle:'复习',projectName:''}];
  const s=summarize([done('a',at(2026,11,14,11))],withered,'day',new Date(2026,10,14));
  assert.equal(s.healthy,1);assert.equal(s.withered,1);assert.equal(s.totalMinutes,50);
  assert.deepEqual(s.trees.map(t=>t.kind),['healthy','withered']);
  assert.equal(summarize([],[],'day',new Date(2026,10,14)).trees.length,0);
});

test('giving up records a withered tree only after the grace period, once, with focused minutes',()=>{
  const start=at(2026,11,14,9),running=startFocus(initialFocus(50),start,'round-1',{id:'t1',projectId:'p1',title:'读文献',projectName:'论文'});
  assert.equal(witheredEntry(running,start+9000),null,'leaving within 10 seconds is not a withered tree');
  const entry=witheredEntry(running,start+12*60000+5000);
  assert.deepEqual(entry,{id:'round-1',at:start+12*60000+5000,plannedMinutes:50,focusedMinutes:12,taskTitle:'读文献',projectName:'论文'});
  const paused=pauseFocus(running,start+20*60000);assert.equal(witheredEntry(paused,start+90*60000).focusedMinutes,20,'paused time is not counted');
  assert.equal(witheredEntry(tickFocus(running,start+51*60000),start+51*60000),null,'a finished round is never withered');
  assert.equal(witheredEntry(initialFocus(),start),null);
  const list=appendWithered([],entry);assert.equal(appendWithered(list,entry).length,1);
});

test('stored withered trees are validated, de-duplicated and capped',()=>{
  const ok={id:'w1',at:1,plannedMinutes:50,focusedMinutes:3,taskTitle:'',projectName:''};
  assert.deepEqual(hydrateWithered([ok,{...ok},{...ok,id:'w2',focusedMinutes:60},{...ok,id:'w3',plannedMinutes:10},null,'x',{...ok,id:'w4',extra:1}]).map(w=>w.id),['w1','w4']);
  assert.equal('extra' in hydrateWithered([{...ok,extra:1}])[0],false);
  assert.deepEqual(hydrateWithered('nope'),[]);
  assert.equal(hydrateWithered(Array.from({length:WITHERED_LIMIT+5},(_,i)=>({...ok,id:'w'+i}))).length,WITHERED_LIMIT);
});

test('focus history keeps up to the yearly limit',()=>{
  const history=Array.from({length:HISTORY_LIMIT},(_,i)=>({id:'h'+i,minutes:25,completedAt:i,taskTitle:'',projectName:''}));
  assert.equal(hydrateFocus({...initialFocus(),history},0).history.length,HISTORY_LIMIT);
  assert.throws(()=>hydrateFocus({...initialFocus(),history:[...history,{...history[0],id:'extra'}]},0));
});

test('axis, duration text and plot size follow the data',()=>{
  assert.deepEqual(niceAxis(0).ticks,[0,5,10,15,20,25]);assert.equal(niceAxis(580).max,600);assert.equal(niceAxis(30).step,10);
  assert.equal(formatDuration(726),'12 小时 6 分钟');assert.equal(formatDuration(45),'45 分钟');assert.equal(formatDuration(0),'0 分钟');
  assert.deepEqual(plotGrid(0),{n:4,perPage:16,pages:1});assert.deepEqual(plotGrid(24),{n:5,perPage:25,pages:1});assert.deepEqual(plotGrid(70),{n:8,perPage:64,pages:2});
});
