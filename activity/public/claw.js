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
async function animateDrop(result){
  elements.instructionTitle.textContent='落爪中…';elements.instructionText.textContent='正在由伺服器判定夾取結果';elements.claw.classList.add('dropping');beep(220,.18);await wait(900);elements.claw.classList.add('closed');await wait(430);
  if(result.result?.prize){elements.held.textContent=result.result.prize.emoji;elements.claw.classList.add('has-prize');const node=document.querySelector(`[data-id="${result.result.prize.prizeId}"]`);if(result.result.won&&node)node.classList.add('captured')}
  elements.claw.classList.remove('dropping');beep(result.result?.won?740:260,.18);await wait(950);
  if(result.result?.won){elements.instructionTitle.textContent='運送獎品到出口…';elements.claw.style.left='11%';await wait(850);elements.claw.classList.remove('closed');await wait(350)}
  else if(result.result?.outcome==='slipped'){elements.claw.classList.add('slip');await wait(650)}
  showResult(result.result);
}
async function drop(){
  if(busy||!game||game.status!=='pending')return;busy=true;controlsDisabled(true);
  const request=api('/claw/drop',{method:'POST',body:JSON.stringify({session,clawX})});
  elements.claw.classList.add('dropping');elements.instructionTitle.textContent='落爪中…';beep(230,.12);
  try{const result=await request;elements.claw.classList.remove('dropping');game=result;await animateDrop(result)}catch(error){elements.claw.classList.remove('dropping');showError(error.message);controlsDisabled(false);busy=false}
}
for(const [button,direction] of [[elements.left,-1],[elements.right,1]]){
  button.addEventListener('pointerdown',event=>{event.preventDefault();holdMove(direction)});button.addEventListener('pointerup',stopMove);button.addEventListener('pointercancel',stopMove);button.addEventListener('pointerleave',stopMove);
}
elements.drop.addEventListener('click',drop);elements.sound.addEventListener('click',()=>{soundEnabled=!soundEnabled;elements.sound.textContent=soundEnabled?'♪':'×';if(soundEnabled)beep(620,.08)});elements.return.addEventListener('click',()=>{location.href='https://discord.com/app'});
addEventListener('keydown',event=>{if(event.repeat)return;if(['ArrowLeft','a','A'].includes(event.key)){event.preventDefault();holdMove(-1)}if(['ArrowRight','d','D'].includes(event.key)){event.preventDefault();holdMove(1)}if(event.code==='Space'){event.preventDefault();drop()}});addEventListener('keyup',event=>{if(['ArrowLeft','ArrowRight','a','A','d','D'].includes(event.key))stopMove()});
load();
