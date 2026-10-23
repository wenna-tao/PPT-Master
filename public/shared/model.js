export const MAX_TEXT = 24000;
export function assertText(value, max, label, empty = false) {
  if (typeof value !== 'string' || value.length > max || (!empty && !value.trim())) throw new Error(`${label}不能为空且不能超过 ${max} 字符`);
  return value.trim();
}
export function validateRequirements(r) {
  if (!r || typeof r !== 'object') throw new Error('请先整理并核对要求');
  const result = {summary: assertText(r.summary, 1400, '任务摘要')};
  for (const key of ['deliverables','criteria','constraints','questions']) {
    if (!Array.isArray(r[key]) || r[key].length > 12) throw new Error('要求列表格式不正确（每项最多 12 条）');
    result[key] = r[key].map(s => assertText(s, 500, '要求条目'));
  }
  return result;
}
export function validateContext(c) {
  if (!c || typeof c !== 'object') throw new Error('请填写演讲信息');
  const title = assertText(c.title, 100, '演示标题'), audience = assertText(c.audience, 120, '听众');
  const date = assertText(c.date, 10, '演讲日期');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || new Date(date+'T12:00:00Z').toISOString().slice(0,10) !== date) throw new Error('演讲日期无效');
  const duration = Number(c.duration);
  if (!Number.isInteger(duration) || duration < 3 || duration > 60) throw new Error('演讲时长需为 3–60 分钟');
  if (!['zh','en'].includes(c.language)) throw new Error('请选择中文或英文');
  return {title, audience, date, duration, language:c.language, ownNotes:assertText(c.ownNotes || '',6000,'个人材料',true)};
}
export function validateSlides(slides) {
  if (!Array.isArray(slides) || slides.length < 1 || slides.length > 16) throw new Error('幻灯片需为 1–16 页');
  return slides.map(s => {
    if (!Array.isArray(s.bullets) || s.bullets.length > 5) throw new Error('每页最多 5 条要点');
    return {title:assertText(s.title,100,'页标题'), bullets:s.bullets.map(b => assertText(b,220,'要点')), notes:assertText(s.notes || '',1800,'演讲备注',true), source:assertText(s.source || '',500,'来源',true)};
  });
}
export function localRequirements(text) {
  assertText(text, MAX_TEXT, '材料');
  const lines=text.split(/\n|(?<=[。；;])\s*/).map(s=>s.trim()).filter(Boolean);
  const pick = re => lines.filter(s=>re.test(s)).slice(0,8).map(s=>s.slice(0,480));
  return {summary:'本地摘录（请对照原文核对）：'+lines.slice(0,3).join(' ').slice(0,1100),
    deliverables:pick(/提交|演示|汇报|幻灯片|报告|submit|deliver|present|slides|report/i),
    criteria:pick(/评分|评估|占比|百分|论证|批判|rubric|assess|mark|evaluat|critical|%/i),
    constraints:pick(/分钟|页|语言|引用|截止|不得|禁止|要求|minute|deadline|duration|reference|must|prohibit|language/i),
    questions:['请核对摘录是否遗漏评分细则、截止时间和提交格式。','请确认课程对 AI 辅助、署名和引用的要求。']};
}
export function localOutline(requirements, context) {
  const r=validateRequirements(requirements), c=validateContext(context), en=c.language==='en';
  const n=Math.min(12,Math.max(5,Math.round(c.duration*.7)));
  const names=en?['Opening & purpose','Assignment & success criteria','Background & question','My approach','Evidence & analysis','Findings','Discussion','Limitations','Next steps','Takeaway','Questions','Sources']:['开场与目标','任务要求与评价标准','背景与核心问题','我的方法与思路','证据与分析','发现与结果','讨论与解释','局限与反思','下一步','核心结论','交流与提问','资料来源'];
  const placeholder=en?'[Add your own evidence, findings and verifiable sources]':'［补充你自己的证据、发现与可核验来源］';
  const slides=Array.from({length:n},(_,i)=>({title:i===0?c.title:names[Math.min(i,names.length-1)],
    bullets:i===0?[`${c.audience} · ${c.date}`,`${c.duration} ${en?'minutes':'分钟'}`]:i===1?(r.deliverables.length?r.deliverables.slice(0,3).map(s=>s.slice(0,220)):[placeholder]):[placeholder],
    notes:en?'Practice in your own words; check claims against your sources.':'用自己的话练习讲解；根据原始材料核对每个结论。',source:''}));
  slides[slides.length-1].title=en?'Takeaway & sources':'结论与资料来源';
  if(c.ownNotes) slides[Math.min(3,n-1)].bullets=c.ownNotes.split('\n').filter(Boolean).slice(0,4).map(s=>s.slice(0,220));
  return validateSlides(slides);
}
export const requirementSchema = {type:'object',additionalProperties:false,properties:{summary:{type:'string'},...Object.fromEntries(['deliverables','criteria','constraints','questions'].map(k=>[k,{type:'array',items:{type:'string'}}]))},required:['summary','deliverables','criteria','constraints','questions']};
export const outlineSchema={type:'object',additionalProperties:false,properties:{slides:{type:'array',items:{type:'object',additionalProperties:false,properties:{title:{type:'string'},bullets:{type:'array',items:{type:'string'}},notes:{type:'string'},source:{type:'string'}},required:['title','bullets','notes','source']}}},required:['slides']};
