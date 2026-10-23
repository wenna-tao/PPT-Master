import './focus-background.js';
import './focus-display.js';
import {FOCUS_KEY,initialFocus,validMinutes,remainingMs,startFocus,pauseFocus,resetFocus,setFocusMinutes,tickFocus,hydrateFocus,formatFocus,todayFocus} from './shared/focus-model.js';

const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const baseTitle=document.title;
let focus=initialFocus(),planner={projectId:'',projectName:'',tasks:[]},wake=null,wakePending=false,audio=null,lastClock='',lastStatus='',lastStats='',storageAvailable=true;
const modal=$('#focus-screen'),resetDialog=$('#focus-reset-dialog'),zone=$('#focus-timer');
const landscapeView=matchMedia('(orientation: landscape)');
let autoLandscapeOpen=false;
function syncLandscape(){
  if(landscapeView.matches&&focus.status==='running'&&!modal.open&&!document.querySelector('dialog[open]')){modal.showModal();autoLandscapeOpen=true;}
  else if(!landscapeView.matches&&autoLandscapeOpen&&modal.open){modal.close();autoLandscapeOpen=false;}
}
landscapeView.addEventListener('change',syncLandscape);
modal.addEventListener('close',()=>{autoLandscapeOpen=false;});
document.addEventListener('peachworks:display-change',()=>{autoLandscapeOpen=false;});

function announce(text,error=false){$$('[data-focus-announcement]').forEach(n=>{n.textContent=text;n.classList.toggle('focus-error',error);});}
function save(){
  try{localStorage.setItem(FOCUS_KEY,JSON.stringify(focus));storageAvailable=true;}
  catch{storageAvailable=false;announce('当前浏览器无法保存专注记录。请保持本页打开，刷新后可能无法恢复。',true);}
}
function readSaved(){
  try{
    const raw=localStorage.getItem(FOCUS_KEY);
    if(raw){
      const parsed=JSON.parse(raw),current=hydrateFocus(parsed,Date.now());
      if(parsed.status==='running'&&current.status==='completed'){
        try{localStorage.setItem(FOCUS_KEY,JSON.stringify(current));}catch{storageAvailable=false;}
      }
      return current;
    }
  }
  catch{announce('上次专注记录无法恢复。DDL 与演示草稿不受影响，可以重新开始一轮。',true);}
  return null;
}
const restored=readSaved();if(restored){focus=restored;if(focus.status==='completed')save();}

function selectedTask(){const id=$('#focus-task').value,task=planner.tasks.find(t=>t.id===id);return task?{id:task.id,title:task.title,projectId:planner.projectId,projectName:planner.projectName}:null;}
function syncTaskOptions(){
  const select=$('#focus-task'),selected=select.value,locked=['running','paused'].includes(focus.status);
  select.replaceChildren();
  const option=(value,text)=>{const n=document.createElement('option');n.value=value;n.textContent=text;select.append(n);};
  option('','只专注，暂不关联任务');
  if(locked&&focus.task){option(focus.task.id,`${focus.task.projectName} · ${focus.task.title}`);select.value=focus.task.id;}
  else{planner.tasks.forEach(t=>option(t.id,t.title));select.value=planner.tasks.some(t=>t.id===selected)?selected:'';}
  select.disabled=locked;
}
function paint(full=false){
  const left=remainingMs(focus,Date.now()),clock=formatFocus(left),growth=focus.status==='idle'?0:Math.min(1,Math.max(0,1-left/(focus.minutes*60000)));
  if(clock!==lastClock){
    $$('[data-focus-clock]').forEach(n=>{n.textContent=clock;const sec=Math.ceil(left/1000);n.setAttribute('aria-label',`剩余 ${Math.floor(sec/60)} 分 ${sec%60} 秒`);});lastClock=clock;
  }
  zone.style.setProperty('--growth',growth);modal.style.setProperty('--growth',growth);
  $$('[data-focus-progress]').forEach(n=>n.setAttribute('aria-valuenow',Math.round(growth*100)));
  const status={idle:'准备好了，就从这一轮开始',running:'正在专注 · 桃树慢慢长大',paused:'已暂停 · 随时可以继续',completed:'这一轮完成了 · 好好休息一下'}[focus.status];
  if(lastStatus!==status){$$('[data-focus-status]').forEach(n=>n.textContent=status);lastStatus=status;}
  const label=focus.task&&focus.status!=='idle'?`${focus.task.projectName} / ${focus.task.title}`:selectedTask()?`${planner.projectName} / ${selectedTask().title}`:`为自己留出 ${focus.minutes} 分钟`;
  $$('[data-focus-task]').forEach(n=>n.textContent=label);
  $$('[data-focus-action="toggle"]').forEach(b=>b.textContent=focus.status==='running'?'暂停':focus.status==='paused'?'继续专注':focus.status==='completed'?'再来一轮':`开始 ${focus.minutes} 分钟`);
  $$('[data-focus-action="reset"]').forEach(b=>b.disabled=focus.status==='idle');
  const stats=todayFocus(focus.history,Date.now()),statsKey=JSON.stringify(stats);
  if(lastStats!==statsKey){$('#focus-today-minutes').textContent=stats.minutes;$('#focus-today-sessions').textContent=stats.sessions;lastStats=statsKey;}
  document.title=focus.status==='running'?`${clock} · 专注 | Peachworks`:focus.status==='paused'?'专注已暂停 | Peachworks':focus.status==='completed'?'专注完成 🍑 | Peachworks':baseTitle;
  if(full){
    const locked=['running','paused'].includes(focus.status);
    $('#focus-minutes').value=focus.minutes;$('#focus-range').value=focus.minutes;
    $('#focus-minutes').disabled=locked;$('#focus-range').disabled=locked;
    $$('[data-focus-minutes]').forEach(b=>{b.disabled=locked;b.setAttribute('aria-pressed',String(Number(b.dataset.focusMinutes)===focus.minutes));});
    $('#focus-sound').checked=focus.sound;$('#focus-awake').checked=focus.keepAwake;syncTaskOptions();
  }
}
function releaseWake(){if(wake){const previous=wake;wake=null;previous.release().catch(()=>{});}}
function wakeStatus(text){$('#focus-awake-status').textContent=text;}
async function syncWake(){
  const shouldKeep=focus.keepAwake&&focus.status==='running'&&document.visibilityState==='visible';
  if(!shouldKeep){releaseWake();wakeStatus(!focus.keepAwake?'已关闭屏幕常亮':focus.status==='paused'?'暂停时恢复系统息屏设置':focus.status==='completed'?'专注完成，已恢复系统息屏设置':'开始后尝试保持常亮');return;}
  if(!navigator.wakeLock?.request){wakeStatus('此浏览器不支持常亮，可在设备中调整息屏时间');return;}
  if(wake&&!wake.released){wakeStatus('屏幕常亮中');return;}
  if(wakePending)return;wakePending=true;
  try{
    const handle=await navigator.wakeLock.request('screen');
    if(!focus.keepAwake||focus.status!=='running'||document.visibilityState!=='visible'){await handle.release();return;}
    wake=handle;wakeStatus('屏幕常亮中');
    handle.addEventListener('release',()=>{if(wake===handle){wake=null;wakeStatus('常亮已由系统释放，计时仍在继续');}});
  }catch{wakeStatus('系统未允许常亮，计时仍会继续');}
  finally{wakePending=false;}
}
async function prepareChime(){
  if(!focus.sound)return;
  try{const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;if(!audio)audio=new Audio();if(audio.state==='suspended')await audio.resume();}catch{}
}
function chime(){
  if(!focus.sound||document.visibilityState!=='visible'||!audio||audio.state!=='running')return;
  try{for(const [i,hz] of [523.25,659.25].entries()){const tone=audio.createOscillator(),gain=audio.createGain(),at=audio.currentTime+i*.36;tone.type='sine';tone.frequency.value=hz;gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(.035,at+.035);gain.gain.exponentialRampToValueAtTime(.0001,at+.5);tone.connect(gain);gain.connect(audio.destination);tone.start(at);tone.stop(at+.52);}}catch{}
}
function advance(silent=false){
  const before=focus.status;focus=tickFocus(focus,Date.now());
  if(before==='running'&&focus.status==='completed'){
    // Another tab may have already committed this same completion; the model deduplicates by id.
    save();syncTaskOptions();syncWake();
    announce('这一轮完成了 🍑 伸个懒腰、喝点水，回来后按实际进度勾选任务。');
    if(!silent)chime();
  }
  paint();
}
function changeMinutes(value){
  try{focus=setFocusMinutes(focus,validMinutes(value));save();paint(true);announce('');}
  catch(e){announce(e.message,true);}
}
function toggle(){
  if(focus.status==='running'){
    const was=focus.status;focus=pauseFocus(focus,Date.now());save();paint(true);syncWake();
    if(was==='running'&&focus.status==='completed'){announce('这一轮已经完成了 🍑 休息一下。');chime();}
    else announce('已暂停，剩余时间已保存。');return;
  }
  if(['idle','completed'].includes(focus.status)){
    if(!$('#focus-minutes').reportValidity()){announce('请输入 25–120 分钟的整数。',true);return;}
    try{focus=setFocusMinutes(focus,$('#focus-minutes').value);}catch(e){announce(e.message,true);return;}
  }
  try{
    focus=startFocus(focus,Date.now(),crypto.randomUUID?.()||`focus_${Date.now()}_${Math.random().toString(36).slice(2)}`,selectedTask());
    save();paint(true);syncWake();syncLandscape();prepareChime();announce(storageAvailable?'这一轮开始了。切换应用时会继续计时，回来后会自动校准。':'本轮已开始，但浏览器无法保存记录，请保持页面打开。',!storageAvailable);
  }catch(e){announce(e.message,true);}
}
$$('[data-focus-action]').forEach(button=>button.addEventListener('click',()=>{
  const action=button.dataset.focusAction;
  if(action==='toggle')toggle();
  if(action==='reset'){
    advance();if(['running','paused'].includes(focus.status))resetDialog.showModal();
    else{focus=resetFocus(focus);save();paint(true);syncWake();announce('准备好时，再开始一轮。');}
  }
  if(action==='cancel-reset')resetDialog.close();
  if(action==='confirm-reset'){
    advance(true);focus=resetFocus(focus);save();paint(true);syncWake();resetDialog.close();announce('本轮已重置，已完成的专注记录已保留。');
  }
}));
$('#focus-minutes').addEventListener('input',e=>changeMinutes(e.target.value));
$('#focus-range').addEventListener('input',e=>changeMinutes(e.target.value));
$$('[data-focus-minutes]').forEach(b=>b.addEventListener('click',()=>changeMinutes(b.dataset.focusMinutes)));
$('#focus-task').addEventListener('change',()=>paint());
$('#focus-awake').addEventListener('change',e=>{focus.keepAwake=e.target.checked;save();syncWake();});
$('#focus-sound').addEventListener('change',e=>{focus.sound=e.target.checked;save();prepareChime();});
$('#focus-open').addEventListener('click',()=>{advance();modal.showModal();syncWake();});
$('#focus-screen-close').addEventListener('click',()=>modal.close());
document.addEventListener('peachworks:planner-state',e=>{planner=e.detail;syncTaskOptions();paint();});
document.dispatchEvent(new Event('peachworks:planner-request'));
function resumeFromStorage(){const latest=readSaved();if(latest)focus=latest;paint(true);advance(true);syncWake();}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')resumeFromStorage();else{advance(true);releaseWake();}});
window.addEventListener('pageshow',resumeFromStorage);
window.addEventListener('storage',e=>{
  if(e.key===FOCUS_KEY||e.key===null){
    if(!e.newValue&&e.key===FOCUS_KEY)focus=initialFocus();else{const latest=readSaved();if(latest)focus=latest;}
    paint(true);advance(true);syncWake();
  }
});
window.addEventListener('pagehide',releaseWake);
paint(true);syncWake();syncLandscape();
if(focus.status==='completed')announce('上一轮专注已完成 🍑 完成记录已保留，准备好后可以再来一轮。');
setInterval(()=>advance(),500);
