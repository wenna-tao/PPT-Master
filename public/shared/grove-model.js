// Peach grove statistics: pure, local-time helpers shared by the page and the tests.
import {remainingMs} from './focus-model.js';

export const WITHERED_KEY='peachworks_focus_withered_v1';
export const WITHERED_LIMIT=2000;
export const GIVE_UP_GRACE_MS=10000;
export const PERIODS=['day','week','month','year'];

const pad=n=>String(n).padStart(2,'0');
export const dayKey=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const startOfDay=d=>new Date(d.getFullYear(),d.getMonth(),d.getDate());

export function periodRange(period,anchor){
  const a=startOfDay(anchor);
  if(period==='day')return {start:a,end:new Date(a.getFullYear(),a.getMonth(),a.getDate()+1)};
  if(period==='week'){const start=new Date(a.getFullYear(),a.getMonth(),a.getDate()-((a.getDay()+6)%7));return {start,end:new Date(start.getFullYear(),start.getMonth(),start.getDate()+7)};}
  if(period==='month')return {start:new Date(a.getFullYear(),a.getMonth(),1),end:new Date(a.getFullYear(),a.getMonth()+1,1)};
  return {start:new Date(a.getFullYear(),0,1),end:new Date(a.getFullYear()+1,0,1)};
}
export function shiftAnchor(period,anchor,delta){
  const a=startOfDay(anchor);
  if(period==='day')return new Date(a.getFullYear(),a.getMonth(),a.getDate()+delta);
  if(period==='week')return new Date(a.getFullYear(),a.getMonth(),a.getDate()+7*delta);
  if(period==='month')return new Date(a.getFullYear(),a.getMonth()+delta,1);
  return new Date(a.getFullYear()+delta,0,1);
}
export function isCurrentPeriod(period,anchor,now){const {start,end}=periodRange(period,anchor);return now>=start&&now<end;}
export const canGoNext=(period,anchor,now)=>periodRange(period,shiftAnchor(period,anchor,1)).start<=now;

export function periodTitle(period,anchor,now){
  const {start,end}=periodRange(period,anchor),current=isCurrentPeriod(period,anchor,now);
  if(period==='day'){const yesterday=dayKey(start)===dayKey(shiftAnchor('day',now,-1));return `${start.getFullYear()}年${start.getMonth()+1}月${start.getDate()}日${current?' (今天)':yesterday?' (昨天)':''}`;}
  if(period==='week'){const last=new Date(end.getFullYear(),end.getMonth(),end.getDate()-1),year=start.getFullYear()!==now.getFullYear()?`${start.getFullYear()}年`:'';return `${year}${start.getMonth()+1}月${start.getDate()}日 – ${last.getMonth()+1}月${last.getDate()}日${current?' (本周)':''}`;}
  if(period==='month')return `${start.getFullYear()}年${start.getMonth()+1}月${current?' (本月)':''}`;
  return `${start.getFullYear()}年${current?' (今年)':''}`;
}

// One bin per hour (day), weekday (week), day of month (month) or month (year); axis ticks are bin indexes.
export function chartFrame(period,range){
  const {start}=range,y=start.getFullYear(),m=start.getMonth(),d=start.getDate(),edges=[];let labels,ticks;
  if(period==='day'){for(let h=0;h<=24;h++)edges.push(new Date(y,m,d,h));labels=Array.from({length:24},(_,h)=>`${h}:00–${h+1}:00`);ticks=[0,6,12,18];}
  else if(period==='week'){for(let i=0;i<=7;i++)edges.push(new Date(y,m,d+i));labels=edges.slice(0,7).map(e=>`周${'日一二三四五六'[e.getDay()]} ${e.getMonth()+1}/${e.getDate()}`);ticks=[0,1,2,3,4,5,6];}
  else if(period==='month'){const days=new Date(y,m+1,0).getDate();for(let i=0;i<=days;i++)edges.push(new Date(y,m,1+i));labels=Array.from({length:days},(_,i)=>`${m+1}月${i+1}日`);ticks=[0,4,9,14,19,24,days-1].filter((v,i,a)=>a.indexOf(v)===i);}
  else{for(let i=0;i<=12;i++)edges.push(new Date(y,i,1));labels=Array.from({length:12},(_,i)=>`${i+1}月`);ticks=Array.from({length:12},(_,i)=>i);}
  const tickText=period==='day'?i=>`${i}时`:period==='week'?i=>'一二三四五六日'[i]:period==='month'?i=>`${i+1}`:i=>`${i+1}`;
  return {edges,labels,ticks:ticks.map(i=>({index:i,text:tickText(i)}))};
}

// Round each bin so the bins still add up to the rounded total (largest remainder).
function roundBins(values){
  const floors=values.map(Math.floor),target=Math.round(values.reduce((a,b)=>a+b,0));let missing=target-floors.reduce((a,b)=>a+b,0);
  values.map((v,i)=>[v-floors[i],i]).sort((a,b)=>b[0]-a[0]).forEach(([,i])=>{if(missing>0){floors[i]++;missing--;}});
  return floors;
}
const validHealthy=h=>h&&Number.isFinite(h.completedAt)&&Number.isInteger(h.minutes)&&h.minutes>0;

export function summarize(history,withered,period,anchor){
  const range=periodRange(period,anchor),frame=chartFrame(period,range),s=range.start.getTime(),e=range.end.getTime(),edges=frame.edges.map(d=>d.getTime());
  const raw=Array(edges.length-1).fill(0),trees=[];
  for(const h of history){
    if(!validHealthy(h))continue;
    if(h.completedAt>=s&&h.completedAt<e)trees.push({kind:'healthy',id:h.id,at:h.completedAt,minutes:h.minutes,taskTitle:h.taskTitle||'',projectName:h.projectName||''});
    // Focus minutes are spread over the hours/days the round actually covered.
    const a=h.completedAt-h.minutes*60000,b=h.completedAt;if(b<=s||a>=e)continue;
    for(let i=0;i<raw.length;i++){const lo=Math.max(a,edges[i]),hi=Math.min(b,edges[i+1]);if(hi>lo)raw[i]+=(hi-lo)/60000;}
  }
  for(const w of withered)if(w.at>=s&&w.at<e)trees.push({kind:'withered',id:w.id,at:w.at,minutes:w.focusedMinutes,plannedMinutes:w.plannedMinutes,taskTitle:w.taskTitle,projectName:w.projectName});
  trees.sort((x,y)=>x.at-y.at);
  const bins=roundBins(raw);
  return {range,frame,bins,trees,healthy:trees.filter(t=>t.kind==='healthy').length,withered:trees.filter(t=>t.kind==='withered').length,totalMinutes:bins.reduce((a,b)=>a+b,0)};
}

export function niceAxis(max){
  const steps=[5,10,15,20,30,45,60,90,120,150,180,240,300,360,480,600,720,900,1200,1500,1800,2400,3000,3600,4800,6000];
  const step=steps.find(v=>v*5>=max)||Math.ceil(max/5/600)*600;
  return {step,max:step*5,ticks:[0,1,2,3,4,5].map(i=>i*step)};
}
export function formatDuration(minutes){const h=Math.floor(minutes/60),m=minutes%60;return h?`${h} 小时 ${m} 分钟`:`${m} 分钟`;}

// Square plot from 4×4 up to 8×8; more trees than that page through several plots.
export function plotGrid(count){const n=Math.min(8,Math.max(4,Math.ceil(Math.sqrt(count))));return {n,perPage:n*n,pages:Math.max(1,Math.ceil(count/(n*n)))};}

// Giving up a running or paused round (after a short grace period) leaves a withered tree.
export function witheredEntry(state,now){
  if(!state||!['running','paused'].includes(state.status)||typeof state.id!=='string'||!state.id)return null;
  const elapsed=state.minutes*60000-remainingMs(state,now);
  if(!(elapsed>=GIVE_UP_GRACE_MS))return null;
  return {id:state.id,at:now,plannedMinutes:state.minutes,focusedMinutes:Math.min(state.minutes,Math.floor(elapsed/60000)),taskTitle:state.task?.title||'',projectName:state.task?.projectName||''};
}
const validWithered=w=>w&&typeof w.id==='string'&&w.id&&w.id.length<=100&&Number.isFinite(w.at)&&w.at>=0&&Number.isInteger(w.plannedMinutes)&&w.plannedMinutes>=25&&w.plannedMinutes<=120&&Number.isInteger(w.focusedMinutes)&&w.focusedMinutes>=0&&w.focusedMinutes<=w.plannedMinutes&&typeof w.taskTitle==='string'&&w.taskTitle.length<=100&&typeof w.projectName==='string'&&w.projectName.length<=70;
export function hydrateWithered(raw){
  if(!Array.isArray(raw))return [];
  const ids=new Set();
  return raw.filter(w=>validWithered(w)&&!ids.has(w.id)&&ids.add(w.id)).slice(-WITHERED_LIMIT).map(w=>({id:w.id,at:w.at,plannedMinutes:w.plannedMinutes,focusedMinutes:w.focusedMinutes,taskTitle:w.taskTitle,projectName:w.projectName}));
}
export const appendWithered=(list,entry)=>!entry||list.some(w=>w.id===entry.id)?list:[...list,entry].slice(-WITHERED_LIMIT);
