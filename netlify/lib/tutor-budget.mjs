import {tutorError} from '../../public/shared/tutor-model.js';
const providers=['deepseek','gemini','claude','openai'],stateKey='v2/trial-and-quota';
export function tutorDay(now){const p=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);return ['year','month','day'].map(k=>p.find(x=>x.type===k).value).join('-');}
export async function quotaStore(){const {getStore}=await import('@netlify/blobs');return getStore({name:'peachworks-tutor-usage',consistency:'strong'});}
const fresh=day=>({browsers:[],day,usage:Object.fromEntries(providers.map(p=>[p,[]]))});
function valid(state){return state&&/^\d{4}-\d{2}-\d{2}$/.test(state.day)&&Array.isArray(state.browsers)&&state.browsers.length<=8&&new Set(state.browsers).size===state.browsers.length&&state.browsers.every(id=>/^[a-f\d-]{36}$/i.test(id))&&state.usage&&providers.every(p=>Array.isArray(state.usage[p])&&state.usage[p].length<=10&&state.usage[p].every(id=>typeof id==='string'&&id.length<=80));}
export async function readTutorState(store,now){const entry=await store.getWithMetadata(stateKey,{type:'json',consistency:'strong'});const state=entry?.data??fresh(tutorDay(now));if(!valid(state))throw tutorError('用量记录暂时不可用，本次不会调用模型。',503,'QUOTA_UNAVAILABLE');return {entry,state};}
export function tutorQuota(state,{provider,limit,role='guest',now}){const day=tutorDay(now),restricted=state.browsers.length>7,effective=Math.min(limit,restricted&&['openai','claude'].includes(provider)?4:10),used=state.day===day?state.usage[provider].length:0;return {day,scope:role==='owner'?'owner':'site',limit:role==='owner'?null:effective,remaining:role==='owner'?null:Math.max(0,effective-used),unlimited:role==='owner',restricted,trialBrowsers:Math.min(state.browsers.length,8)};}
// Trial threshold + daily quotas share one CAS, preventing a race between the eighth browser and paid calls.
export async function reserveTutor(store,{provider,limit,requestId,now,visitorId,role='guest'}){
 const day=tutorDay(now);
 if(role==='owner'){
  const r=await store.setJSON(`v2/owner/${day}/${provider}/${requestId}`,{reserved:true},{onlyIfNew:true});
  if(!r.modified)throw tutorError('这次问题已经提交过，请勿重复发送。',409,'DUPLICATE_REQUEST');
  return {day,scope:'owner',limit:null,remaining:null,unlimited:true};
 }
 for(let attempt=0;attempt<24;attempt++){
  const {entry,state}=await readTutorState(store,now),next=structuredClone(state);
  if(next.day!==day){next.day=day;next.usage=fresh(day).usage;}
  if(!next.browsers.includes(visitorId)&&next.browsers.length<8)next.browsers.push(visitorId);
  const quota=tutorQuota(next,{provider,limit,now}),ids=next.usage[provider];
  if(ids.includes(requestId))throw tutorError('这次问题已经提交过，请勿重复发送。',409,'DUPLICATE_REQUEST');
  const blocked=quota.remaining===0;
  if(!blocked)ids.push(requestId);
  const result=await store.setJSON(stateKey,next,entry?{onlyIfMatch:entry.etag}:{onlyIfNew:true});
  if(result.modified){if(blocked){const e=tutorError('这个 AI 今天的访客共享次数已用完。请明天再试，或手动选择其他已启用的 AI。',429,'DAILY_LIMIT');e.quota=quota;throw e;}return {...quota,remaining:quota.remaining-1};}
 }
 throw tutorError('当前提问较多，请稍后手动重试。',429,'QUOTA_BUSY');
}
