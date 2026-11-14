// "我的桃园": day / week / month / year view of completed (healthy) and given-up (withered) focus rounds.
import {FOCUS_KEY,hydrateFocus} from './shared/focus-model.js';
import {WITHERED_KEY,hydrateWithered,summarize,periodTitle,shiftAnchor,canGoNext,isCurrentPeriod,niceAxis,formatDuration,plotGrid} from './shared/grove-model.js';

const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const dialog=$('#focus-grove');
let period='day',anchor=new Date(),page=0,selectedTree=null,selectedBar=null,view=null;

const pad=n=>String(n).padStart(2,'0');
const when=ms=>{const d=new Date(ms);return `${d.getMonth()+1}月${d.getDate()}日 ${pad(d.getHours())}:${pad(d.getMinutes())}`;};
const make=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};

// Original peach-tree drawings (no external images); colours come from CSS variables on the dialog.
function treeSvg(kind,seed=0){
  if(kind==='sprout')return '<svg viewBox="0 0 180 200" aria-hidden="true"><ellipse cx="90" cy="182" rx="26" ry="6" fill="var(--grove-trunk)" opacity=".16"/><path d="M90 180 Q95 154 87 141" stroke="var(--grove-trunk)" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M90 158 Q56 159 58 134 Q86 133 90 158" fill="var(--grove-leaf)"/><path d="M92 151 Q91 120 117 125 Q123 146 92 151" fill="var(--grove-leaf-light)"/></svg>';
  const trunk='<path d="M78 182 Q85 154 82 115 L75 84 L89 89 L98 127 L109 105 L118 109 Q96 139 101 168 L110 183 L96 180 L89 184Z" fill="var(--grove-trunk)"/>';
  if(kind==='withered')return `<svg viewBox="0 0 180 200" aria-hidden="true"><ellipse cx="90" cy="182" rx="38" ry="8" fill="var(--grove-trunk)" opacity=".13"/><g fill="none" stroke="var(--grove-dry)" stroke-width="5" stroke-linecap="round"><path d="M86 120 L58 92 L44 96 M58 92 L56 70"/><path d="M97 124 L126 96 L142 101 M126 96 L131 76"/><path d="M90 104 L92 62 L80 46 M92 62 L104 50"/></g>${trunk.replace('var(--grove-trunk)','var(--grove-dry)')}<g fill="var(--grove-dry-leaf)"><path d="M48 132 q8 -6 12 2 q-8 6 -12 -2Z"/><path d="M130 148 q8 -6 12 2 q-8 6 -12 -2Z"/><path d="M110 168 q7 -5 10 2 q-7 5 -10 -2Z"/></g></svg>`;
  const pink=seed%3===0,dot=(x,y,s)=>pink?`<g transform="translate(${x} ${y}) scale(${s})" fill="var(--grove-bloom-light)"><circle cy="-4" r="4"/><circle cx="4" cy="-1" r="4"/><circle cx="2.5" cy="4" r="4"/><circle cx="-3" cy="4" r="4"/><circle cx="-4" cy="-1" r="4"/><circle r="2" fill="var(--grove-peach)"/></g>`:`<g transform="translate(${x} ${y}) scale(${s})"><path d="M0 -5 C-10 -14 -18 -4 -13 6 C-8 15 0 17 0 17 C0 17 11 12 14 4 C19 -7 8 -14 0 -5Z" fill="var(--grove-bloom)"/><path d="M0 -5 Q5 4 0 13" fill="none" stroke="var(--grove-peach)" stroke-width="1.3"/><path d="M0 -7 Q5 -19 14 -15 Q12 -5 0 -7" fill="var(--grove-leaf)"/></g>`;
  const spots=pink?[[48,84],[78,60],[116,77],[97,113],[140,99]]:[[48,90],[86,65],[127,89],[101,118],[66,119]];
  return `<svg viewBox="0 0 180 200" aria-hidden="true"><ellipse cx="90" cy="182" rx="42" ry="9" fill="var(--grove-trunk)" opacity=".13"/>${trunk}<path d="M41 121 C18 113 15 89 34 76 C23 58 41 39 63 45 C67 20 94 18 107 34 C128 25 149 42 145 60 C169 65 175 89 157 103 C163 123 136 139 119 129 C96 147 73 132 66 126 C55 133 44 130 41 121Z" fill="${pink?'var(--grove-bloom)':'var(--grove-leaf)'}"/><path d="M32 76 C27 54 46 43 67 49 C66 29 96 26 106 41 C124 29 145 45 140 66 C159 67 164 85 150 94 C132 98 124 88 114 93 C99 109 78 98 70 93 C51 105 35 94 32 76Z" fill="${pink?'var(--grove-bloom-light)':'var(--grove-leaf-light)'}"/>${spots.map(([x,y])=>dot(x,y,pink?.9:.55)).join('')}</svg>`;
}
const seedOf=id=>[...String(id)].reduce((a,c)=>(a*31+c.charCodeAt(0))>>>0,7);

// Isometric plot geometry in a 620×360 viewBox.
const W=620,H=360,CX=310,TOP=40,HALF_W=250,HALF_H=125,DEPTH=24;
const point=(n,i,j)=>[CX+(i-j)*HALF_W/n,TOP+(i+j)*HALF_H/n];
function groundSvg(n){
  let tiles='';
  for(let i=0;i<n;i++)for(let j=0;j<n;j++){const p=[point(n,i,j),point(n,i+1,j),point(n,i+1,j+1),point(n,i,j+1)];tiles+=`<polygon points="${p.map(q=>q.join(',')).join(' ')}" fill="${(i+j)%2?'var(--grove-grass-a)':'var(--grove-grass-b)'}"/>`;}
  const l=point(n,0,n),r=point(n,n,0),b=point(n,n,n);
  return `<svg viewBox="0 0 ${W} ${H}" aria-hidden="true"><ellipse cx="${CX}" cy="${b[1]+DEPTH+12}" rx="230" ry="16" fill="var(--grove-ink)" opacity=".07"/><path d="M${l[0]} ${l[1]} L${b[0]} ${b[1]} L${b[0]} ${b[1]+DEPTH} L${l[0]} ${l[1]+DEPTH}Z" fill="var(--grove-soil-a)"/><path d="M${b[0]} ${b[1]} L${r[0]} ${r[1]} L${r[0]} ${r[1]+DEPTH} L${b[0]} ${b[1]+DEPTH}Z" fill="var(--grove-soil-b)"/>${tiles}<path d="M${l[0]} ${l[1]} L${b[0]} ${b[1]} L${r[0]} ${r[1]}" stroke="var(--grove-grass-edge)" stroke-width="4" fill="none" stroke-linejoin="round"/></svg>`;
}
// Cells ordered from the middle outwards, so a few trees stand in the centre of the plot.
function cellOrder(n){const c=(n-1)/2,cells=[];for(let i=0;i<n;i++)for(let j=0;j<n;j++)cells.push([i,j]);return cells.sort((a,b)=>Math.hypot(a[0]-c,a[1]-c)-Math.hypot(b[0]-c,b[1]-c)||(a[0]+a[1])-(b[0]+b[1])||a[0]-b[0]);}

function readData(){
  let history=[],withered=[];
  try{const raw=localStorage.getItem(FOCUS_KEY);if(raw)history=hydrateFocus(JSON.parse(raw),Date.now()).history;}catch{}
  try{withered=hydrateWithered(JSON.parse(localStorage.getItem(WITHERED_KEY)||'[]'));}catch{}
  return {history,withered};
}
const scopeWord=()=>{const now=isCurrentPeriod(period,anchor,new Date());return {day:now?'今天':'这一天',week:now?'本周':'这一周',month:now?'本月':'这个月',year:now?'今年':'这一年'}[period];};

function renderDetail(tree){
  $('#grove-detail-art').innerHTML=treeSvg(tree?.kind||'sprout',seedOf(tree?.id||''));
  if(!tree){$('#grove-detail-kicker').textContent='点一棵树，看看那段时间';$('#grove-detail-title').textContent='每棵桃树都是一轮完整的专注';$('#grove-detail-meta').textContent='中途确认放弃的一轮会留下一棵枯树';return;}
  const task=[tree.projectName,tree.taskTitle].filter(Boolean).join(' / ');
  $('#grove-detail-kicker').textContent=tree.kind==='withered'?'枯树 · 这一轮中途放弃了':'桃树 · 完整的一轮专注';
  $('#grove-detail-title').textContent=task||(tree.kind==='withered'?'没有关联任务的一轮':'只专注，没有关联任务');
  $('#grove-detail-meta').textContent=tree.kind==='withered'?`${when(tree.at)} 放弃 · 已专注 ${tree.minutes} 分钟（计划 ${tree.plannedMinutes} 分钟）`:`${when(tree.at)} 完成 · ${tree.minutes} 分钟`;
}

function renderPlot(){
  const {trees}=view,grid=plotGrid(trees.length);page=Math.min(page,grid.pages-1);
  const visible=trees.slice(page*grid.perPage,(page+1)*grid.perPage),order=cellOrder(grid.n);
  $('#grove-ground').innerHTML=groundSvg(grid.n);
  const box=$('#grove-trees');box.replaceChildren();
  const width=(2*HALF_W/grid.n)*.92,height=width*200/180;
  visible.forEach((tree,k)=>{
    const [i,j]=order[k],[x,y]=point(grid.n,i+.5,j+.5),b=make('button','grove-tree'+(tree.kind==='withered'?' withered':''));
    b.type='button';b.style.left=`${x/W*100}%`;b.style.top=`${(y+HALF_H/grid.n*.28)/H*100}%`;b.style.width=`${width/W*100}%`;b.style.height=`${height/H*100}%`;b.style.zIndex=String(i+j+1);
    b.innerHTML=treeSvg(tree.kind,seedOf(tree.id));
    const task=[tree.projectName,tree.taskTitle].filter(Boolean).join(' / ')||'未关联任务';
    b.setAttribute('aria-label',tree.kind==='withered'?`枯树：${task}，${when(tree.at)} 放弃，已专注 ${tree.minutes} 分钟`:`桃树：${task}，${when(tree.at)} 完成，${tree.minutes} 分钟`);
    b.setAttribute('aria-pressed',String(selectedTree===tree.id));
    b.onclick=()=>{selectedTree=tree.id;renderDetail(tree);$$('.grove-tree').forEach(n=>n.setAttribute('aria-pressed',String(n===b)));};
    box.append(b);
  });
  const empty=$('#grove-empty');empty.hidden=trees.length>0;
  if(!trees.length){empty.textContent=`${scopeWord()}还没有种下桃树`;const sprout=make('span','grove-tree sprout');sprout.style.left='50%';sprout.style.top=`${(TOP+HALF_H+10)/H*100}%`;sprout.style.width='13%';sprout.style.height='26%';sprout.innerHTML=treeSvg('sprout');box.append(sprout);}
  $('#grove-healthy').textContent=`${view.healthy} 棵桃树`;$('#grove-withered').textContent=`${view.withered} 棵枯树`;
  $('#grove-pages').hidden=grid.pages<2;$('#grove-page-label').textContent=`第 ${page+1} / ${grid.pages} 块`;$('#grove-page-prev').disabled=page===0;$('#grove-page-next').disabled=page>=grid.pages-1;
  renderDetail(trees.find(t=>t.id===selectedTree));
}

function renderChart(){
  const {bins,frame,totalMinutes}=view,axis=niceAxis(Math.max(...bins,0)),count=bins.length;
  $('#grove-total').textContent=formatDuration(totalMinutes);
  const yaxis=$('#grove-yaxis');yaxis.replaceChildren(...axis.ticks.map(v=>{const s=make('span','',String(v));s.style.bottom=`${v/axis.max*100}%`;return s;}));
  const bars=$('#grove-bars');bars.replaceChildren();bars.style.setProperty('--bins',count);
  for(const v of axis.ticks.slice(1)){const line=make('i','grove-gridline');line.style.bottom=`${v/axis.max*100}%`;bars.append(line);}
  bins.forEach((v,i)=>{
    const hit=make('button','grove-bar');hit.type='button';hit.setAttribute('aria-label',`${frame.labels[i]}：${v} 分钟`);hit.setAttribute('aria-pressed',String(selectedBar===i));
    const bar=make('span');bar.style.height=v?`max(3px,${v/axis.max*100}%)`:'0';hit.append(bar);
    hit.onclick=()=>{selectedBar=selectedBar===i?null:i;renderChart();};
    bars.append(hit);
  });
  if(selectedBar!==null&&selectedBar<count){const tip=make('span','grove-tip',`${frame.labels[selectedBar]} · ${bins[selectedBar]} 分钟`);tip.style.left=`${(selectedBar+.5)/count*100}%`;tip.style.bottom=`calc(${bins[selectedBar]/axis.max*100}% + 8px)`;tip.classList.toggle('edge-left',selectedBar<count*.2);tip.classList.toggle('edge-right',selectedBar>count*.8);bars.append(tip);}
  const xaxis=$('#grove-xaxis');xaxis.replaceChildren();xaxis.style.setProperty('--bins',count);
  for(const t of frame.ticks){const s=make('span','',t.text);s.style.gridColumn=String(t.index+1);xaxis.append(s);}
}

function render(){
  const now=new Date(),{history,withered}=readData();view=summarize(history,withered,period,anchor);
  $$('[data-grove-period]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.grovePeriod===period)));
  $('#grove-period-title').textContent=periodTitle(period,anchor,now);
  $('#grove-next').disabled=!canGoNext(period,anchor,now);$('#grove-today').hidden=isCurrentPeriod(period,anchor,now);
  renderPlot();renderChart();
}
function go(next){anchor=next;page=0;selectedTree=null;selectedBar=null;render();}

$('#focus-grove-open').addEventListener('click',()=>{anchor=new Date();page=0;selectedTree=null;selectedBar=null;render();dialog.showModal();});
$('#focus-grove-close').addEventListener('click',()=>dialog.close());
$$('[data-grove-period]').forEach(b=>b.addEventListener('click',()=>{period=b.dataset.grovePeriod;go(new Date(anchor));}));
$('#grove-prev').addEventListener('click',()=>go(shiftAnchor(period,anchor,-1)));
$('#grove-next').addEventListener('click',()=>{if(canGoNext(period,anchor,new Date()))go(shiftAnchor(period,anchor,1));});
$('#grove-today').addEventListener('click',()=>go(new Date()));
$('#grove-page-prev').addEventListener('click',()=>{page=Math.max(0,page-1);renderPlot();});
$('#grove-page-next').addEventListener('click',()=>{page++;renderPlot();});
const refresh=()=>{if(dialog.open)render();};
document.addEventListener('peachworks:focus-saved',refresh);
window.addEventListener('storage',e=>{if([FOCUS_KEY,WITHERED_KEY,null].includes(e.key))refresh();});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')refresh();});
