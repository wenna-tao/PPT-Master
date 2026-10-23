export const FOCUS_KEY='peachworks_focus_v1';
export function validMinutes(value){const n=Number(value);if(!Number.isInteger(n)||n<25||n>120)throw new Error('专注时长须为 25–120 分钟的整数。');return n;}
function cleanTask(task){
  if(task===null||task===undefined)return null;
  const result={};
  for(const [key,max] of Object.entries({id:100,projectId:100,title:100,projectName:70})){
    if(typeof task[key]!=='string'||!task[key].trim()||task[key].length>max)throw new Error('任务信息无效。');result[key]=task[key];
  }
  return result;
}
export function initialFocus(minutes=50){return {version:1,status:'idle',minutes:validMinutes(minutes),remainingMs:Number(minutes)*60000,endsAt:null,id:null,task:null,history:[],sound:false,keepAwake:true};}
export function remainingMs(state,now){return state.status==='running'?Math.min(state.minutes*60000,Math.max(0,state.endsAt-now)):state.remainingMs;}
export function tickFocus(state,now){
  if(state.status!=='running')return state;
  const left=remainingMs(state,now);
  if(left>0)return {...state,remainingMs:left};
  const entry={id:state.id,minutes:state.minutes,completedAt:state.endsAt,taskTitle:state.task?.title||'',projectName:state.task?.projectName||''};
  const history=state.history.some(h=>h.id===entry.id)?state.history:[...state.history,entry].slice(-240);
  return {...state,status:'completed',remainingMs:0,endsAt:null,history};
}
export function startFocus(state,now,id,task=null){
  if(state.status==='running')return tickFocus(state,now);
  if(state.status==='paused')return {...state,status:'running',endsAt:now+state.remainingMs};
  if(typeof id!=='string'||!id||id.length>100)throw new Error('专注轮次无效。');
  return {...state,status:'running',remainingMs:state.minutes*60000,endsAt:now+state.minutes*60000,id,task:cleanTask(task)};
}
export function pauseFocus(state,now){const current=tickFocus(state,now);return current.status==='running'?{...current,status:'paused',remainingMs:remainingMs(current,now),endsAt:null}:current;}
export function resetFocus(state){return {...state,status:'idle',remainingMs:state.minutes*60000,endsAt:null,id:null,task:null};}
export function setFocusMinutes(state,minutes){if(['running','paused'].includes(state.status))throw new Error('本轮结束或重置后可修改时长。');return {...resetFocus(state),minutes:validMinutes(minutes),remainingMs:validMinutes(minutes)*60000};}
export function hydrateFocus(raw,now){
  if(!raw||raw.version!==1||!['idle','running','paused','completed'].includes(raw.status))throw new Error('专注记录格式无效。');
  const state=initialFocus(raw.minutes);state.status=raw.status;state.sound=raw.sound===true;state.keepAwake=raw.keepAwake!==false;
  if(typeof raw.remainingMs!=='number'||!Number.isFinite(raw.remainingMs)||raw.remainingMs<0||raw.remainingMs>state.minutes*60000)throw new Error('专注记录时间无效。');
  state.remainingMs=raw.remainingMs;state.task=cleanTask(raw.task);
  if(state.status!=='idle'){
    if(typeof raw.id!=='string'||!raw.id||raw.id.length>100)throw new Error('专注轮次信息无效。');state.id=raw.id;
  }
  if(state.status==='running'){
    if(typeof raw.endsAt!=='number'||!Number.isFinite(raw.endsAt)||raw.endsAt<0)throw new Error('专注结束时间无效。');state.endsAt=raw.endsAt;
  }
  if(!Array.isArray(raw.history)||raw.history.length>240)throw new Error('专注历史格式无效。');
  const ids=new Set();
  state.history=raw.history.filter(h=>{
    if(!h||typeof h.id!=='string'||!h.id||h.id.length>100||ids.has(h.id)||typeof h.completedAt!=='number'||!Number.isFinite(h.completedAt)||h.completedAt<0||!Number.isInteger(h.minutes)||h.minutes<25||h.minutes>120||typeof h.taskTitle!=='string'||h.taskTitle.length>100||typeof h.projectName!=='string'||h.projectName.length>70)return false;
    ids.add(h.id);return true;
  }).map(h=>({id:h.id,minutes:h.minutes,completedAt:h.completedAt,taskTitle:h.taskTitle,projectName:h.projectName}));
  if(state.status==='idle')return resetFocus(state);
  if(state.status==='completed')state.remainingMs=0;
  return tickFocus(state,now);
}
export function formatFocus(ms){const seconds=Math.ceil(Math.max(0,ms)/1000);return `${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;}
export function todayFocus(history,now){
  const day=t=>{const d=new Date(t);return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;};
  const done=history.filter(h=>day(h.completedAt)===day(now));return {sessions:done.length,minutes:done.reduce((sum,h)=>sum+h.minutes,0)};
}
