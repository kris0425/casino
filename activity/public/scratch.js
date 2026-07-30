const params=new URLSearchParams(location.search);
const session=params.get("session")||"";
const canvas=document.querySelector("#scratch-canvas");
const zone=document.querySelector("#scratch-zone");
const hint=document.querySelector("#scratch-hint");
const progressBar=document.querySelector("#progress-bar");
const progressValue=document.querySelector("#progress-value");
const statusLabel=document.querySelector("#status-label");
const assist=document.querySelector("#assist");
const resultCard=document.querySelector("#result");
const errorCard=document.querySelector("#error");
const format=value=>Number(value||0).toLocaleString("zh-TW");
let ticket=null;
let drawing=false;
let settled=false;
let lastPoint=null;
let checkFrame=0;
const REQUIRED_PERCENT=100;

function showError(message){
  errorCard.hidden=false;
  document.querySelector("#error-message").textContent=message;
  document.querySelector(".status-card").hidden=true;
  document.querySelector(".ticket-wrap").classList.add("disabled");
}

async function api(path,options={}){
  const response=await fetch(path,{cache:"no-store",headers:{"content-type":"application/json"},...options});
  const data=await response.json().catch(()=>({error:"服務回應格式錯誤"}));
  if(!response.ok||!data.ok) throw new Error(data.error||"刮刮卡服務暫時無法使用");
  return data.ticket;
}

function renderTicket(data){
  ticket=data;
  document.querySelector("#bet").textContent=`${format(data.bet)} 金幣`;
  document.querySelector("#serial").textContent=data.serial;
  document.querySelectorAll(".prize span").forEach((node,index)=>{node.textContent=data.icons[index]||"？";});
  if(data.status==="settled"){
    revealAll(false);
    showResult(data);
    return;
  }
  statusLabel.textContent="請將銀色塗層完整刮除至 100%";
  setupCanvas();
}

function setupCanvas(){
  const ratio=Math.max(1,Math.min(2,devicePixelRatio||1));
  const rect=zone.getBoundingClientRect();
  canvas.width=Math.round(rect.width*ratio);
  canvas.height=Math.round(rect.height*ratio);
  const ctx=canvas.getContext("2d",{willReadFrequently:true});
  const gradient=ctx.createLinearGradient(0,0,canvas.width,canvas.height);
  gradient.addColorStop(0,"#6f747b");gradient.addColorStop(.22,"#e1e4e6");gradient.addColorStop(.5,"#8e9499");gradient.addColorStop(.74,"#f1f2f2");gradient.addColorStop(1,"#71767b");
  ctx.fillStyle=gradient;ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.globalAlpha=.23;ctx.fillStyle="#30343a";
  for(let x=-canvas.height;x<canvas.width;x+=28*ratio){ctx.save();ctx.translate(x,0);ctx.rotate(-.35);ctx.fillRect(0,0,7*ratio,canvas.height*1.5);ctx.restore();}
  ctx.globalAlpha=1;ctx.fillStyle="#4c5157";ctx.textAlign="center";ctx.textBaseline="middle";ctx.font=`900 ${Math.round(16*ratio)}px sans-serif`;
  ctx.fillText("刮開全部遊戲區",canvas.width/2,canvas.height/2);
}

function point(event){
  const source=event.touches?.[0]||event;
  const rect=canvas.getBoundingClientRect();
  return {x:(source.clientX-rect.left)*(canvas.width/rect.width),y:(source.clientY-rect.top)*(canvas.height/rect.height)};
}
function scratch(from,to){
  const ctx=canvas.getContext("2d",{willReadFrequently:true});
  ctx.save();ctx.globalCompositeOperation="destination-out";ctx.lineCap="round";ctx.lineJoin="round";ctx.lineWidth=Math.max(30,canvas.width*.07);
  ctx.beginPath();ctx.moveTo(from.x,from.y);ctx.lineTo(to.x,to.y);ctx.stroke();ctx.restore();
  hint.hidden=true;
  if(!checkFrame) checkFrame=requestAnimationFrame(()=>{checkFrame=0;checkProgress();});
}
function start(event){if(settled)return;drawing=true;lastPoint=point(event);event.preventDefault();}
function move(event){if(!drawing||settled)return;const next=point(event);scratch(lastPoint,next);lastPoint=next;event.preventDefault();}
function end(){drawing=false;lastPoint=null;}
canvas.addEventListener("pointerdown",start);canvas.addEventListener("pointermove",move);window.addEventListener("pointerup",end);
canvas.addEventListener("touchstart",start,{passive:false});canvas.addEventListener("touchmove",move,{passive:false});window.addEventListener("touchend",end);

function scratchedPercent(){
  const ctx=canvas.getContext("2d",{willReadFrequently:true});
  const {data}=ctx.getImageData(0,0,canvas.width,canvas.height);
  let transparent=0,samples=0;
  for(let index=3;index<data.length;index+=16){samples++;if(data[index]<80)transparent++;}
  const exact=transparent/samples*100;
  return exact>=99.5?100:Math.floor(exact);
}
function setProgress(value){
  progressBar.style.width=`${value}%`;progressValue.textContent=`${value}%`;
  statusLabel.textContent=value>=REQUIRED_PERCENT?"正在向伺服器驗證獎項…":`還需刮開 ${Math.max(0,REQUIRED_PERCENT-value)}% 才能派獎`;
}
function checkProgress(){
  const value=scratchedPercent();setProgress(value);
  if(value>=REQUIRED_PERCENT&&!settled) settle();
}
function revealAll(animate=true){
  settled=true;hint.hidden=true;assist.disabled=true;setProgress(100);
  canvas.style.transition=animate?"opacity .55s ease":"none";
  canvas.style.opacity="0";
  setTimeout(()=>{canvas.hidden=true;},animate?560:0);
}
async function settle(){
  settled=true;canvas.style.pointerEvents="none";assist.disabled=true;
  try{
    const data=await api("/api/scratch/settle",{method:"POST",body:JSON.stringify({session,scratchedPercent:100})});
    revealAll();showResult(data);
  }catch(error){settled=false;canvas.style.pointerEvents="auto";assist.disabled=false;showError(error.message);}
}
assist.addEventListener("click",()=>{
  if(settled)return;
  const ctx=canvas.getContext("2d");let step=0;
  const steps=18;
  const timer=setInterval(()=>{
    const y=(step+.5)*canvas.height/steps;
    scratch({x:-canvas.width*.04,y},{x:canvas.width*1.04,y});
    if(++step>=steps){
      clearInterval(timer);
      ctx.clearRect(0,0,canvas.width,canvas.height);
      checkProgress();
    }
  },45);
});

function showResult(data){
  ticket=data;const result=data.result||{};
  resultCard.hidden=false;
  document.querySelector("#result-icon").textContent=result.won?"✦":"○";
  document.querySelector("#result-title").textContent=result.won?"恭喜中獎！":"再接再厲";
  document.querySelector("#result-message").textContent=result.message||"本張卡片已完成結算";
  document.querySelector("#credited").textContent=`${format(result.credited)} 金幣`;
  document.querySelector("#balance").textContent=`${format(result.balance)} 金幣`;
  document.querySelector("#title-notice").textContent=result.titleNotice||"";
  const dog=document.querySelector("#dog-event");
  if(data.dogChaseAvailable){dog.hidden=false;}else dog.hidden=true;
  if(result.dogChase){
    dog.hidden=false;
    dog.querySelector("b").textContent=result.dogChase.message;
    dog.querySelector("small").textContent=result.dogChase.success?"金幣已返回你的賭場金庫。":`追趕失敗。${result.dogChase.hospitalText||""}`;
    document.querySelector("#chase").hidden=true;
  }
  resultCard.scrollIntoView({behavior:"smooth",block:"nearest"});
}
document.querySelector("#chase").addEventListener("click",async event=>{
  const button=event.currentTarget;button.disabled=true;button.textContent="追趕中…";
  try{showResult(await api("/api/scratch/chase",{method:"POST",body:JSON.stringify({session})}));}
  catch(error){button.disabled=false;button.textContent="再試一次";alert(error.message);}
});
document.querySelector("#close-page").addEventListener("click",()=>{window.close();history.back();});
window.addEventListener("resize",()=>{if(ticket?.status!=="settled"&&!settled)setupCanvas();});

if(!session) showError("缺少專屬票券驗證碼，請從 Discord 的刮刮樂訊息開啟。");
else api(`/api/scratch?session=${encodeURIComponent(session)}`).then(renderTicket).catch(error=>showError(error.message));
