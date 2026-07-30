const params=new URLSearchParams(location.search);
const session=params.get("session")||"";
const format=value=>Number(value||0).toLocaleString("zh-TW");
const sceneImages={
  stable:{webp:"/jenga/tower-stable.webp",png:"/jenga/tower-stable.png",label:"高塔穩定"},
  wobble:{webp:"/jenga/tower-wobble.webp",png:"/jenga/tower-wobble.png",label:"高塔正在搖晃"},
  collapsed:{webp:"/jenga/tower-collapsed.webp",png:"/jenga/tower-collapsed.png",label:"高塔已倒塌"}
};
const elements={
  serial:document.querySelector("#serial"),
  bet:document.querySelector("#bet"),
  pulls:document.querySelector("#pulls"),
  multiplier:document.querySelector("#multiplier"),
  cashPreview:document.querySelector("#cash-preview"),
  countdown:document.querySelector("#countdown"),
  towerCard:document.querySelector("#tower-card"),
  stage:document.querySelector(".stage-frame"),
  towerImage:document.querySelector("#tower-image"),
  towerSource:document.querySelector("#tower-source"),
  sceneLabel:document.querySelector("#scene-label"),
  messageIcon:document.querySelector("#message-icon"),
  messageTitle:document.querySelector("#message-title"),
  messageText:document.querySelector("#message-text"),
  progress:[...document.querySelectorAll("#progress-steps i")],
  riskBonus:document.querySelector("#risk-bonus"),
  choiceCard:document.querySelector("#choice-card"),
  blockGrid:document.querySelector("#block-grid"),
  cashButton:document.querySelector("#cash-button"),
  cashButtonCopy:document.querySelector("#cash-button-copy"),
  resultCard:document.querySelector("#result-card"),
  resultIcon:document.querySelector("#result-icon"),
  resultTitle:document.querySelector("#result-title"),
  resultMessage:document.querySelector("#result-message"),
  credited:document.querySelector("#credited"),
  balance:document.querySelector("#balance"),
  titleNotice:document.querySelector("#title-notice"),
  dogEvent:document.querySelector("#dog-event"),
  chaseButton:document.querySelector("#chase-button"),
  errorCard:document.querySelector("#error-card"),
  errorMessage:document.querySelector("#error-message")
};
let game=null;
let busy=false;
let expiryTimer=0;

async function api(path,options={}){
  const response=await fetch(path,{cache:"no-store",headers:{"content-type":"application/json"},...options});
  const data=await response.json().catch(()=>({error:"服務回應格式錯誤"}));
  if(!response.ok||!data.ok) throw new Error(data.error||"堆積木服務暫時無法使用");
  return data.game;
}
function post(path,body){
  return api(path,{method:"POST",body:JSON.stringify({session,...body})});
}
function showError(message){
  busy=false;
  elements.errorCard.hidden=false;
  elements.errorMessage.textContent=message;
  elements.choiceCard.hidden=true;
  elements.messageIcon.textContent="!";
  elements.messageTitle.textContent="遊戲連線失敗";
  elements.messageText.textContent=message;
}
function setScene(scene){
  const selected=sceneImages[scene]||sceneImages.stable;
  if(elements.towerSource.srcset!==selected.webp) elements.towerSource.srcset=selected.webp;
  if(!elements.towerImage.src.endsWith(selected.png)) elements.towerImage.src=selected.png;
  elements.sceneLabel.textContent=selected.label;
  elements.stage.classList.toggle("collapsed",scene==="collapsed");
}
function renderProgress(pulls){
  elements.progress.forEach((node,index)=>node.classList.toggle("done",index<pulls));
}
function renderBlocks(data){
  elements.blockGrid.replaceChildren();
  for(const block of data.blocks){
    const button=document.createElement("button");
    button.type="button";
    button.className="block-choice";
    button.disabled=busy;
    button.innerHTML=`
      <div class="block-top"><span class="block-position">${block.position}</span><span class="block-emoji">${block.emoji}</span></div>
      <b class="block-name">${block.name}積木</b>
      <div class="block-meta"><span class="risk">倒塌率 ${block.risk}%</span><span class="bonus">${block.bonus?`成功 +${block.bonus} 倍`:"穩健路線"}</span></div>`;
    button.addEventListener("click",()=>pullBlock(block.index,button));
    elements.blockGrid.append(button);
  }
}
function renderPending(data,notice="選擇左側、中間或右側的一塊積木。"){
  elements.choiceCard.hidden=false;
  elements.resultCard.hidden=true;
  elements.messageIcon.textContent=data.pulls?"✅":"🧱";
  elements.messageTitle.textContent=data.pulls?`已安全抽出 ${data.pulls} 塊積木`:"高塔已準備完成";
  elements.messageText.textContent=notice;
  elements.cashButton.disabled=busy||data.pulls<1;
  elements.cashButtonCopy.textContent=data.pulls?`現在領取 ${data.multiplier} 倍，預估 ${format(Math.floor(data.bet*data.multiplier))} 金幣`:"成功抽出一塊後即可領取";
  renderBlocks(data);
}
function renderResult(data){
  const result=data.result||{};
  elements.choiceCard.hidden=true;
  elements.resultCard.hidden=false;
  const collapsed=["collapsed","expired"].includes(result.outcome);
  elements.resultIcon.textContent=collapsed?"×":"✦";
  elements.resultTitle.textContent=result.outcome==="completed"?"完美完成六次！":result.outcome==="cash"?"安全收手成功":result.outcome==="expired"?"遊戲已逾時":"高塔倒塌";
  elements.resultMessage.textContent=result.message||"本場遊戲已完成結算";
  elements.credited.textContent=format(result.credited);
  elements.balance.textContent=format(result.balance??data.balance);
  elements.titleNotice.textContent=result.titleNotice||"";
  elements.messageIcon.textContent=collapsed?"💥":"🏆";
  elements.messageTitle.textContent=elements.resultTitle.textContent;
  elements.messageText.textContent=result.message||"本場遊戲已完成結算";
  elements.dogEvent.hidden=!data.dogChaseAvailable&&!result.dogChase;
  if(result.dogChase){
    elements.dogEvent.hidden=false;
    elements.dogEvent.querySelector("b").textContent=result.dogChase.message;
    elements.dogEvent.querySelector("small").textContent=result.dogChase.success?"金幣已返回你的賭場金庫。":`追趕失敗。${result.dogChase.hospitalText||""}`;
    elements.chaseButton.hidden=true;
  }
  elements.resultCard.scrollIntoView({behavior:"smooth",block:"nearest"});
}
function render(data,notice){
  game=data;
  elements.errorCard.hidden=true;
  elements.serial.textContent=data.serial;
  elements.bet.textContent=format(data.bet);
  elements.pulls.textContent=`${data.pulls} / 6`;
  elements.multiplier.textContent=data.pulls?`${data.multiplier}×`:"—";
  elements.cashPreview.textContent=data.pulls?`${format(Math.floor(data.bet*data.multiplier))} 金幣`:"先抽出一塊";
  elements.riskBonus.textContent=`風險加成 +${data.riskBonus||0} 倍`;
  renderProgress(data.pulls);
  setScene(data.scene);
  if(data.status==="pending") renderPending(data,notice);
  else renderResult(data);
  updateCountdown();
}
function setBusy(value){
  busy=value;
  document.querySelectorAll(".block-choice").forEach(button=>button.disabled=value);
  elements.cashButton.disabled=value||!game||game.pulls<1;
}
async function pullBlock(index,button){
  if(busy||!game||game.status!=="pending") return;
  setBusy(true);
  elements.stage.classList.add("pulling");
  elements.messageIcon.textContent="🫳";
  elements.messageTitle.textContent=`正在抽出${button.querySelector(".block-position").textContent}積木…`;
  elements.messageText.textContent="Oracle 正在判定高塔是否能保持平衡。";
  try{
    const data=await post("/api/jenga/pull",{blockIndex:index,pulls:game.pulls});
    await new Promise(resolve=>setTimeout(resolve,620));
    render(data,data.status==="pending"?"抽取成功！高塔更加不穩，收手或繼續由你決定。":undefined);
  }catch(error){showError(error.message);}
  finally{elements.stage.classList.remove("pulling");setBusy(false);}
}
async function cashOut(){
  if(busy||!game||game.pulls<1||game.status!=="pending") return;
  setBusy(true);
  elements.messageIcon.textContent="💰";
  elements.messageTitle.textContent="正在安全結算…";
  elements.messageText.textContent="伺服器正在計算稱號、資產、寵物與每日增益。";
  try{render(await post("/api/jenga/cash",{pulls:game.pulls}));}
  catch(error){showError(error.message);}
  finally{setBusy(false);}
}
async function chaseDog(){
  if(busy)return;
  setBusy(true);
  elements.chaseButton.disabled=true;
  elements.chaseButton.textContent="追趕中…";
  try{render(await post("/api/jenga/chase",{}));}
  catch(error){alert(error.message);elements.chaseButton.disabled=false;elements.chaseButton.textContent="再試一次";}
  finally{setBusy(false);}
}
function updateCountdown(){
  if(!game)return;
  const remaining=Math.max(0,game.expiresAt-Date.now());
  const minutes=Math.floor(remaining/60000),seconds=Math.floor(remaining%60000/1000);
  elements.countdown.textContent=`${String(minutes).padStart(2,"0")}:${String(seconds).padStart(2,"0")}`;
  if(!remaining&&game.status==="pending"&&!busy){
    clearInterval(expiryTimer);
    api(`/api/jenga?session=${encodeURIComponent(session)}`).then(render).catch(error=>showError(error.message));
  }
}
elements.cashButton.addEventListener("click",cashOut);
elements.chaseButton.addEventListener("click",chaseDog);
document.querySelector("#close-button").addEventListener("click",()=>{window.close();history.back();});
expiryTimer=setInterval(updateCountdown,1000);

if(!session) showError("缺少專屬遊戲驗證碼，請從 Discord 的 `/小遊戲` 開啟。");
else api(`/api/jenga?session=${encodeURIComponent(session)}`).then(render).catch(error=>showError(error.message));
