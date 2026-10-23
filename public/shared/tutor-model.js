export const TUTOR_PROVIDERS=[{id:'deepseek',label:'DeepSeek',mark:'D',hint:'文字、推导与代码'},{id:'gemini',label:'Gemini',mark:'✦',hint:'拍题与图片问答'},{id:'claude',label:'Claude',mark:'✳',hint:'讲解与代码思路'},{id:'openai',label:'ChatGPT',mark:'◎',hint:'通过 OpenAI API 提供'}];
export const TUTOR_LIMITS={question:2000,historyMessages:4,historyItem:1600,historyTotal:4000,imageBytes:300000,imageSide:1280,output:800};
export function tutorError(message,status=400,code='INVALID_INPUT'){return Object.assign(new Error(message),{status,code});}
export function validateTutor(body){
 if(!body||!TUTOR_PROVIDERS.some(p=>p.id===body.provider))throw tutorError('请选择支持的 AI。');
 if(typeof body.question!=='string'||!body.question.trim()||body.question.length>TUTOR_LIMITS.question)throw tutorError('请填写 1–2000 字符的问题，图片题也请附一句提问。');
 if(typeof body.requestId!=='string'||!/^[a-zA-Z0-9_-]{16,80}$/.test(body.requestId))throw tutorError('本次请求标识无效，请重新发送。');
 const history=body.history??[];if(!Array.isArray(history)||history.length>TUTOR_LIMITS.historyMessages||history.length%2)throw tutorError('对话过长，请开始新对话。');
 let total=0;const clean=history.map((m,i)=>{if(!m||m.role!==(i%2?'assistant':'user')||typeof m.text!=='string'||!m.text.trim()||m.text.length>TUTOR_LIMITS.historyItem)throw tutorError('对话内容格式无效。');total+=m.text.length;return {role:m.role,text:m.text};});if(total>TUTOR_LIMITS.historyTotal)throw tutorError('历史对话过长，请开始新对话。');
 return {provider:body.provider,requestId:body.requestId,question:body.question.trim(),history:clean,image:body.image??null};
}
