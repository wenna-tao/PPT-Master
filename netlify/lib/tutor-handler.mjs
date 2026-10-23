import {createHash,timingSafeEqual} from 'node:crypto';
import {validateTutor,tutorError} from '../../public/shared/tutor-model.js';
import {tutorConfigs,validateTutorImage,tutorRequest} from './tutor-providers.mjs';
import {quotaStore,reserveTutor} from './tutor-budget.mjs';
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const equal=(a,b)=>timingSafeEqual(createHash('sha256').update(a).digest(),createHash('sha256').update(b).digest());
async function readBody(req){if(!req.headers.get('content-type')?.startsWith('application/json'))throw tutorError('请发送 JSON 请求。',415);if(Number(req.headers.get('content-length')||0)>460000)throw tutorError('问题或图片过大。',413);const reader=req.body?.getReader();if(!reader)throw tutorError('问题为空。');const chunks=[];let length=0;for(;;){const {value,done}=await reader.read();if(done)break;length+=value.byteLength;if(length>460000){await reader.cancel();throw tutorError('问题或图片过大。',413);}chunks.push(value);}try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw tutorError('问题内容格式无效。');}}
export function makeTutorHandler({env=process.env,fetchImpl=fetch,storeFactory=quotaStore,now=()=>Date.now()}={}){return async function(req){
 const path=new URL(req.url).pathname,configs=tutorConfigs(env);
 if(path==='/api/tutor/status'&&req.method==='GET')return json({providers:configs.map(({id,label,enabled,vision,limit})=>({id,label,enabled,vision,limit,maxOutputTokens:800})),resetZone:'Europe/London',codeRequired:true});
 if(path!=='/api/tutor/ask')return json({error:'接口不存在。'},404);
 if(req.method!=='POST')return json({error:'仅支持 POST。'},405);
 let quota;
 try{
  if(req.headers.get('origin')!==(env.PEACHWORKS_ALLOWED_ORIGIN||new URL(req.url).origin))throw tutorError('请求来源不受支持。',403);
  if(env.TUTOR_ENABLED!=='true'||!env.TUTOR_ACCESS_CODE)throw tutorError('作业辅导还没有启用，请联系维护者配置。',503,'TUTOR_DISABLED');
  if(!equal(req.headers.get('x-peach-tutor-access')||'',env.TUTOR_ACCESS_CODE))throw tutorError('作业辅导访问码不正确。',401,'ACCESS_DENIED');
  const body=await readBody(req);if(body.consent!==true)throw tutorError('请先同意将本次问题、附图与最近两轮对话发送给所选 AI。');
  const clean=validateTutor(body),config=configs.find(c=>c.id===clean.provider);if(!config.enabled)throw tutorError('所选 AI 尚未启用，不会切换到其他服务商。',503,'PROVIDER_DISABLED');
  clean.image=validateTutorImage(clean.image);if(clean.image&&!config.vision)throw tutorError('当前模型未启用图片问答。请改用文字，或手动选择支持图片的 AI。');
  try{quota=await reserveTutor(await storeFactory(),{provider:config.id,limit:config.limit,requestId:clean.requestId,now:now()});}catch(e){if(e.code)throw e;throw tutorError('用量服务暂时不可用，本次不会调用 AI。',503,'QUOTA_UNAVAILABLE');}
  let result;try{result=await tutorRequest(config,clean,fetchImpl);}catch{throw tutorError('AI 连接超时或暂时不可用。本次已计入次数，不会自动重试。',504,'UPSTREAM_FAILED');}
  if(!result.ok)throw tutorError(result.status===429?'服务商额度或频率受限。本次已计入次数。':'AI 未返回可用回答，请精简问题或联系维护者检查模型配置。本次已计入次数。',502,'UPSTREAM_FAILED');
  return json({provider:config.id,label:config.label,answer:result.text,truncated:result.truncated,quota});
 }catch(e){return json({error:e.status?e.message:'内容格式无效，请检查后重试。',code:e.code||'INVALID_INPUT',...(quota?{quota}:{})},e.status||400);}
};}
