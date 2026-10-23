// Only these two fixed upstreams are allowed. No OpenAI SDK or endpoint is used.
export function providerConfig(env) {
  const provider=env.AI_PROVIDER;
  if(provider==='gemini')return {provider,label:'Gemini',key:env.GEMINI_API_KEY,model:env.GEMINI_MODEL};
  if(provider==='deepseek')return {provider,label:'DeepSeek',key:env.DEEPSEEK_API_KEY,model:env.DEEPSEEK_MODEL};
  return {provider:'none',label:'未启用',key:'',model:''};
}
export async function providerRequest(config,{instructions,input,schema,maxTokens},fetchImpl) {
  const common={method:'POST',signal:AbortSignal.timeout(40000)};
  const example=schema.properties.slides?{slides:[{title:'Slide title',bullets:['Your evidence or explicit placeholder'],notes:'Speaking prompts',source:''}]}:{summary:'Summary of stated requirements',deliverables:[],criteria:[],constraints:[],questions:[]};
  const prompt=instructions+'\nReturn JSON only, using this schema: '+JSON.stringify(schema)+'\nExample JSON shape (not assignment facts): '+JSON.stringify(example);
  if(!/^[a-z\d._-]{1,100}$/i.test(config.model))throw new Error('MODEL_CONFIG');
  let response;
  if(config.provider==='gemini'){
    response=await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent`,{...common,headers:{'x-goog-api-key':config.key,'Content-Type':'application/json'},body:JSON.stringify({systemInstruction:{parts:[{text:prompt}]},contents:[{role:'user',parts:[{text:JSON.stringify(input)}]}],generationConfig:{responseMimeType:'application/json',responseJsonSchema:schema,maxOutputTokens:maxTokens}})});
  }else if(config.provider==='deepseek'){
    response=await fetchImpl('https://api.deepseek.com/chat/completions',{...common,headers:{Authorization:`Bearer ${config.key}`,'Content-Type':'application/json'},body:JSON.stringify({model:config.model,messages:[{role:'system',content:prompt},{role:'user',content:JSON.stringify(input)}],response_format:{type:'json_object'},thinking:{type:'disabled'},max_tokens:maxTokens,stream:false})});
  }else throw new Error('PROVIDER_CONFIG');
  if(!response.ok)return {ok:false,status:response.status};
  let data;try{data=await response.json();}catch{return {ok:false,status:502};}
  if(config.provider==='gemini'){
    const candidate=data.candidates?.[0];
    if(candidate?.finishReason!=='STOP')return {ok:false,status:422};
    return {ok:true,text:(candidate.content?.parts||[]).filter(p=>!p.thought).map(p=>p.text||'').join('')};
  }
  const choice=data.choices?.[0];
  if(choice?.finish_reason!=='stop')return {ok:false,status:422};
  return {ok:true,text:choice.message?.content||''};
}
