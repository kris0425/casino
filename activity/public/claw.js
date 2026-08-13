const session=new URLSearchParams(location.search).get('session')||'';
const elements={
  serial:document.querySelector('#serial'),cost:document.querySelector('#cost'),timer:document.querySelector('#timer'),balance:document.querySelector('#balance'),
  claw:document.querySelector('#clawRig'),field:document.querySelector('#prizeField'),held:document.querySelector('#heldPrize'),
  left:document.querySelector('#leftButton'),right:document.querySelector('#rightButton'),drop:document.querySelector('#dropButton'),
  instructionTitle:document.querySelector('#instructionTitle'),instructionText:document.querySelector('#instructionText'),
  resultCard:document.querySelector('#resultCard'),resultIcon:document.querySelector('#resultIcon'),resultEyebrow:document.querySelector('#resultEyebrow'),resultTitle:document.querySelector('#resultTitle'),resultMessage:document.querySelector('#resultMessage'),
  error:document.querySelector('#errorToast'),sound:document.querySelector('#soundButton'),return:document.querySelector('#returnButton')
};
let game=null,clawX=50,busy=false,timerId=null,soundEnabled=true,repeatTimer=null;
const fmt=value=>new Intl.NumberFormat('zh-TW').format(Number(value)||0);
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));

function showError(message){elements.error.textContent=message;elements.error.hidden=false;setTimeout(()=>{elements.error.hidden=true},4200)}
async function api(path,options={}){
  const response=await fetch(`/api${path}`,{...options,headers:{'content-type':'application/json',...(options.headers||{})}});
  const payload=await response.json().catch(()=>({}));
  if(!response.ok||!payload.ok) throw new Error(payload.error||'機台連線失敗');
  return payload.game;
}
function beep(frequency=500,duration=.07){
  if(!soundEnabled) return;
  try{const context=new(window.AudioContext||window.webkitAudioContext)(),osc=context.createOscillator(),gain=context.createGain();osc.connect(gain);gain.connect(context.destination);osc.frequency.value=frequency;gain.gain.setValueAtTime(.04,context.currentTime);gain.gain.exponentialRampToValueAtTime(.001,context.currentTime+duration);osc.start();osc.stop(context.currentTime+duration)}catch{}
}
function updateClaw(){elements.claw.style.setProperty('--claw-x',`${clawX}%`)}
function move(direction){if(busy||!game||game.status!=='pending')return;clawX=Math.max(5,Math.min(95,clawX+direction*2.5));updateClaw();beep(360+clawX*2,.035)}
function holdMove(direction){move(direction);clearInterval(repeatTimer);repeatTimer=setInterval(()=>move(direction),75)}
function stopMove(){clearInterval(repeatTimer);repeatTimer=null}
function controlsDisabled(disabled){elements.left.disabled=disabled;elements.right.disabled=disabled;elements.drop.disabled=disabled}
function prizeNode(prize,index){
  const node=document.createElement('article');node.className=`prize ${prize.type}`;node.dataset.id=prize.prizeId;node.style.setProperty('--prize-x',`${prize.x}%`);node.style.setProperty('--tilt',`${index%2?-4:4}deg`);
  if(prize.image){const image=document.createElement('img');image.src=prize.image;image.alt=prize.name;image.onerror=()=>{image.replaceWith(fallback(prize))};node.append(image)}else node.append(fallback(prize));
  const label=document.createElement('label');label.textContent=`${prize.name}${prize.quantity>1?` ×${prize.quantity}`:''}`;node.append(label);return node;
}
function fallback(prize){const span=document.createElement('span');span.className='fallback';span.textContent=prize.emoji;return span}
function renderPrizes(){elements.field.replaceChildren(...game.prizes.map(prizeNode))}
function updateTimer(){
  const remaining=Math.max(0,game.expiresAt-Date.now()),minutes=Math.floor(remaining/60000),seconds=Math.floor(remaining%60000/1000);
  elements.timer.textContent=`${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`;
  if(!remaining&&game.status==='pending'){clearInterval(timerId);load()}
}
function render(){
  elements.serial.textContent=game.serial;elements.cost.textContent=`${fmt(game.cost)} 金幣`;elements.balance.textContent=fmt(game.balance);clawX=game.clawX||50;updateClaw();renderPrizes();
  clearInterval(timerId);updateTimer();timerId=setInterval(updateTimer,1000);
  if(game.status!=='pending') showResult(game.result);
}
async function load(){
  if(!session){showError('缺少專屬遊戲連結，請回到 Discord 重新開啟');controlsDisabled(true);return}
  try{game=await api(`/claw?session=${encodeURIComponent(session)}`);render()}catch(error){showError(error.message);controlsDisabled(true)}
}
function resultCopy(result){
  if(result?.outcome==='won') return {icon:result.prize?.emoji||'🎁',eyebrow:'PRIZE CAPTURED',title:'夾取成功！'};
  if(result?.outcome==='slipped') return {icon:'💨',eyebrow:'GRIP LOST',title:'差一點就成功'};
  if(result?.outcome==='expired') return {icon:'⌛',eyebrow:'TIME OUT',title:'操作時間結束'};
  return {icon:'🎯',eyebrow:'MISSED',title:'這次沒有對準'};
}
function showResult(result){
  controlsDisabled(true);const copy=resultCopy(result);elements.resultIcon.textContent=copy.icon;elements.resultEyebrow.textContent=copy.eyebrow;elements.resultTitle.textContent=copy.title;elements.resultMessage.textContent=result?.message||'本局已完成';elements.resultCard.hidden=false;
}
function prepareGrab(result){
  const prize=result.result?.prize,node=prize?document.querySelector(`[data-id="${prize.prizeId}"]`):null;
  if(!node) return null;
  const rigRect=elements.claw.getBoundingClientRect(),prizeRect=node.getBoundingClientRect();
  const distance=Math.max(118,Math.min(205,prizeRect.top+prizeRect.height*.42-rigRect.top-145));
  const offset=Math.max(-18,Math.min(18,prizeRect.left+prizeRect.width/2-(rigRect.left+rigRect.width/2)));
  elements.claw.style.setProperty('--drop-distance',`${distance}px`);elements.claw.style.setProperty('--grip-offset',`${offset}px`);
  return node;
}
function mountHeldPrize(prize,node){
  elements.held.replaceChildren();const visual=node?.querySelector('img,.fallback')?.cloneNode(true);
  if(visual) elements.held.append(visual);else elements.held.textContent=prize?.emoji||'🎁';
  elements.claw.classList.add('has-prize');node?.classList.add('grabbed');
}
async function animateResolution(result,targetNode){
  const outcome=result.result?.outcome;
  elements.claw.classList.add('closed','grabbing');navigator.vibrate?.(outcome==='missed'?[35]:[45,35,70]);beep(outcome==='missed'?260:520,.12);await wait(330);
  if(targetNode) mountHeldPrize(result.result.prize,targetNode);await wait(210);
  elements.instructionTitle.textContent=targetNode?'爪子抓住獎品，正在拉升…':'爪子沒有碰到獎品';elements.instructionText.textContent=targetNode?'爪力判定完成，保持住！':'這次落爪位置沒有對準';
  elements.claw.classList.remove('dropping','grabbing');elements.claw.classList.add('lifting');beep(result.result?.won?720:330,.17);await wait(1050);
  if(result.result?.won){
    elements.instructionTitle.textContent='抓穩了！正在送往取物口';elements.instructionText.textContent='獎品會直接放入你的資產庫';elements.claw.classList.add('transporting');elements.claw.style.setProperty('--claw-x','11%');await wait(1200);
    elements.claw.classList.remove('closed','lifting');elements.claw.classList.add('releasing');beep(880,.2);navigator.vibrate?.([50,35,90]);await wait(780);
  }else if(outcome==='slipped'){
    elements.instructionTitle.textContent='爪力鬆脫！獎品掉下去了';elements.instructionText.textContent='已經夾起，但在運送途中滑落';elements.claw.classList.add('slip');elements.claw.classList.remove('closed');beep(180,.28);navigator.vibrate?.([80,35,120]);await wait(900);targetNode?.classList.add('landed');
  }else{elements.claw.classList.remove('closed');await wait(280)}
  showResult(result.result);
}
async function drop(){
  if(busy||!game||game.status!=='pending')return;busy=true;controlsDisabled(true);
  elements.instructionTitle.textContent='落爪中…';elements.instructionText.textContent='瞄準完成，爪臂正在下降';beep(230,.12);navigator.vibrate?.(35);
  const request=api('/claw/drop',{method:'POST',body:JSON.stringify({session,clawX})});
  try{const result=await request,targetNode=prepareGrab(result);elements.claw.classList.add('dropping');await wait(920);game=result;await animateResolution(result,targetNode)}catch(error){elements.claw.classList.remove('dropping','closed','grabbing');showError(error.message);controlsDisabled(false);busy=false}
}
for(const [button,direction] of [[elements.left,-1],[elements.right,1]]){
  button.addEventListener('pointerdown',event=>{event.preventDefault();holdMove(direction)});button.addEventListener('pointerup',stopMove);button.addEventListener('pointercancel',stopMove);button.addEventListener('pointerleave',stopMove);
}
elements.drop.addEventListener('click',drop);elements.sound.addEventListener('click',()=>{soundEnabled=!soundEnabled;elements.sound.textContent=soundEnabled?'♪':'×';if(soundEnabled)beep(620,.08)});elements.return.addEventListener('click',()=>{location.href='https://discord.com/app'});
addEventListener('keydown',event=>{if(event.repeat)return;if(['ArrowLeft','a','A'].includes(event.key)){event.preventDefault();holdMove(-1)}if(['ArrowRight','d','D'].includes(event.key)){event.preventDefault();holdMove(1)}if(event.code==='Space'){event.preventDefault();drop()}});addEventListener('keyup',event=>{if(['ArrowLeft','ArrowRight','a','A','d','D'].includes(event.key))stopMove()});
load();
