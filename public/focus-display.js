const modal=document.querySelector('#focus-screen'),select=document.querySelector('#focus-layout-select'),button=document.querySelector('#focus-fullscreen'),message=document.querySelector('#focus-display-message'),KEY='peachworks_focus_display_v1';
let layout='auto',ownsFullscreen=false;
try{const value=localStorage.getItem(KEY);if(['auto','landscape','portrait'].includes(value))layout=value;}catch{}
function apply(){modal.dataset.focusLayout=layout;select.value=layout;}
select.addEventListener('change',()=>{layout=select.value;apply();document.dispatchEvent(new Event('peachworks:display-change'));try{localStorage.setItem(KEY,layout);}catch{}message.textContent=layout==='auto'?'已跟随设备方向。':'已切换时钟排布；手机方向仍由系统控制。';});
button.addEventListener('click',async()=>{
 try{
  if(document.fullscreenElement&&ownsFullscreen){await document.exitFullscreen();return;}
  if(!document.documentElement.requestFullscreen||!document.fullscreenEnabled){message.textContent='此浏览器不支持全屏，当前大字时钟仍可使用。';return;}
  ownsFullscreen=true;message.textContent='正在切换全屏…';button.disabled=true;let timeout;
  try{await Promise.race([document.documentElement.requestFullscreen(),new Promise((_,reject)=>{timeout=setTimeout(()=>reject(new Error('timeout')),1800);})]);message.textContent='';}finally{clearTimeout(timeout);button.disabled=false;}
 }catch{message.textContent='浏览器未允许全屏，当前大字时钟仍可使用。';}
});
document.addEventListener('fullscreenchange',()=>{const active=!!document.fullscreenElement;button.setAttribute('aria-label',active?'退出全屏':'进入全屏');button.title=active?'退出全屏':'进入全屏';button.setAttribute('aria-pressed',String(active));if(!active)ownsFullscreen=false;else message.textContent='';});
modal.addEventListener('close',()=>{if(ownsFullscreen&&document.fullscreenElement)document.exitFullscreen().catch(()=>{});message.textContent='';});
apply();
