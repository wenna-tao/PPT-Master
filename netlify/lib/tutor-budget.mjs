import {tutorError} from '../../public/shared/tutor-model.js';
export function tutorDay(now){const p=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);return ['year','month','day'].map(k=>p.find(x=>x.type===k).value).join('-');}
export async function quotaStore(){const {getStore}=await import('@netlify/blobs');return getStore({name:'peachworks-tutor-usage',consistency:'strong'});}
// Site-wide store survives deploys. CAS reserves BEFORE any paid request; failed calls are not refunded.
export async function reserveTutor(store,{provider,limit,requestId,now}){
 const day=tutorDay(now),key=`v1/${day}/${provider}`;
 for(let attempt=0;attempt<12;attempt++){
  const entry=await store.getWithMetadata(key,{type:'json',consistency:'strong'}),state=entry?.data??{count:0,ids:[]};
  if(!Number.isInteger(state.count)||state.count<0||!Array.isArray(state.ids)||state.ids.length!==state.count||state.count>100)throw tutorError('用量记录暂时不可用，本次不会调用模型。',503,'QUOTA_UNAVAILABLE');
  if(state.ids.includes(requestId))throw tutorError('这次问题已经提交过，请勿重复发送。',409,'DUPLICATE_REQUEST');
  if(state.count>=limit)throw tutorError('这个 AI 今天的全站次数已用完，请明天再试，或手动选择其他已启用的 AI。',429,'DAILY_LIMIT');
  const next={count:state.count+1,ids:[...state.ids,requestId]};
  const result=await store.setJSON(key,next,entry?{onlyIfMatch:entry.etag}:{onlyIfNew:true});
  if(result.modified)return {day,limit,remaining:Math.max(0,limit-next.count)};
 }
 throw tutorError('当前提问较多，请稍后手动重试。',429,'QUOTA_BUSY');
}
