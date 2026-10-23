import {accessReady,tutorRole} from './tutor-access.mjs';
import {validateTutor,tutorError} from '../../public/shared/tutor-model.js';
import {tutorConfigs,validateTutorImage,tutorRequest} from './tutor-providers.mjs';
import {quotaStore,reserveTutor,readTutorState,tutorQuota} from './tutor-budget.mjs';
const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});
async function readBody(req){if(!req.headers.get('content-type')?.startsWith('application/json'))throw tutorError('请发送 JSON 请求。',415);if(Number(req.headers.get('content-length')||0)>460000)throw tutorError('问题或图片过大。',413);const reader=req.body?.getReader();if(!reader)throw tutorError('问题为空。');const chunks=[];let length=0;for(;;){const {value,done}=await reader.read();if(done)break;length+=value.byteLength;if(length>460000){await reader.cancel();throw tutorError('问题或图片过大。',413);}chunks.push(value);}try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw tutorError('问题内容格式无效。');}}
export function makeTutorHandler({env=process.env,fetchImpl=fetch,storeFactory=quotaStore,now=()=>Date.now()}={}){return async function(req){
 const path=new URL(req.url).pathname,configs=tutorConfigs(env);
 if(path==='/api/tutor/status'&&req.method==='GET')return json({providers:configs.map(({id,label,enabled,vision,limit,ownerOnly})=>({id,label,enabled,vision,limit,ownerOnly:ownerOnly===true,maxOutputTokens:800})),resetZone:'Europe/London',codeRequired:true});
 if(!['/api/tutor/ask','/api/tutor/access'].includes(path))return json({error:'接口不存在。'},404);
 if(req.method!=='POST')return json({error:'仅支持 POST。'},405);
 let quota,responseHeaders={};
 try{
  if(req.headers.get('origin')!==(env.PEACHWORKS_ALLOWED_ORIGIN||new URL(req.url).origin))throw tutorError('请求来源不受支持。',403);
  if(env.TUTOR_ENABLED!=='true'||!accessReady(env))throw tutorError('作业辅导还没有启用，请联系维护者配置。',503,'TUTOR_DISABLED');
  const role=tutorRole(req.headers.get('x-peach-tutor-access')||'',env);
  if(!role)throw tutorError('作业辅导访问码不正确。',401,'ACCESS_DENIED');
  if(path==='/api/tutor/access'){
   let state;try{({state}=await readTutorState(await storeFactory(),now()));}catch{throw tutorError('用量服务暂时不可用，请稍后验证。',503,'QUOTA_UNAVAILABLE');}
   return json({role,quotas:Object.fromEntries(configs.map(c=>[c.id,tutorQuota(state,{provider:c.id,limit:c.limit,role,now:now()})]))},200,responseHeaders);
  }
  const body=await readBody(req);if(body.consent!==true)throw tutorError('请先同意将本次问题、附图与最近两轮对话发送给所选 AI。');
  const clean=validateTutor(body),config=configs.find(c=>c.id===clean.provider);if(config.ownerOnly&&role!=='owner')throw tutorError('Gemini 仅限管理者使用，请先验证自己的管理码。',403,'OWNER_ONLY');if(!config.enabled)throw tutorError('所选 AI 尚未启用，不会切换到其他服务商。',503,'PROVIDER_DISABLED');
  clean.image=validateTutorImage(clean.image);if(clean.image&&!config.vision)throw tutorError('当前模型未启用图片问答。请改用文字，或手动选择支持图片的 AI。');
  try{quota=await reserveTutor(await storeFactory(),{provider:config.id,limit:config.limit,requestId:clean.requestId,now:now(),role});}catch(e){if(e.code)throw e;throw tutorError('用量服务暂时不可用，本次不会调用 AI。',503,'QUOTA_UNAVAILABLE');}
  const charged=role==='owner'?'':'本次已计入次数。';
  let result;try{result=await tutorRequest(config,clean,fetchImpl);}catch{throw tutorError('AI 连接超时或暂时不可用。'+charged+'不会自动重试。',504,'UPSTREAM_FAILED');}
  if(!result.ok){
   // Return only a fixed explanation and numeric status; never expose provider response bodies.
   const messages={401:['PROVIDER_AUTH','API 密钥无效或已失效，请维护者在 Netlify 更新所选 AI 的密钥。'],402:['PROVIDER_BALANCE','所选 AI 的 API 账户余额不足或尚未开通计费，请在服务商官方平台检查余额与账单。'],403:['PROVIDER_ACCESS','服务商拒绝访问，请维护者检查 API 权限和支持地区。'],400:['PROVIDER_CONFIG','服务商不接受当前请求，请维护者检查模型名称、图片能力与接口参数。'],404:['PROVIDER_CONFIG','服务商未找到当前模型或接口，请维护者检查模型配置。'],422:['PROVIDER_CONFIG','服务商不接受当前参数，请维护者检查模型和图片能力。'],429:['PROVIDER_RATE_LIMIT','服务商额度或频率受限，请稍后手动重试。']};
   const [code,message]=result.invalidResponse?['PROVIDER_RESPONSE','服务商未返回可显示的回答，可能受到输出上限、内容限制或响应格式影响。']:messages[result.status]||['UPSTREAM_FAILED','AI 服务暂时未能完成请求，请稍后手动重试。'];
   const error=tutorError(message+charged+'不会自动重试。',502,code);if(!result.invalidResponse)error.providerStatus=result.status;throw error;
  }
  return json({provider:config.id,label:config.label,answer:result.text,truncated:result.truncated,quota},200,responseHeaders);
 }catch(e){return json({error:e.status?e.message:'内容格式无效，请检查后重试。',code:e.code||'INVALID_INPUT',...(Number.isInteger(e.providerStatus)?{providerStatus:e.providerStatus}:{}),...((quota||e.quota)?{quota:quota||e.quota}:{})},e.status||400,responseHeaders);}
};}
