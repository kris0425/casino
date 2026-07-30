const $=selector=>document.querySelector(selector);
const state={playerId:localStorage.mahjongPlayerId||crypto.randomUUID(),name:localStorage.mahjongName||'',roomId:localStorage.mahjongRoomId||'',game:null,timer:null,showTing:false};
localStorage.mahjongPlayerId=state.playerId;

const api=async(path,body,method='POST')=>{
  const response=await fetch('/api/mahjong/'+path,{method,headers:method==='GET'?{}:{'content-type':'application/json'},body:method==='GET'?undefined:JSON.stringify(body)});
  const data=await response.json();
  if(!response.ok||!data.ok) throw Error(data.error||'連線失敗');
  return data.game;
};
const setName=()=>{
  state.name=($('#name').value||state.name||'玩家').trim().slice(0,20);
  $('#name').value=state.name;
  localStorage.mahjongName=state.name;
  return state.name;
};
const showError=error=>alert(error.message||error);
const seatName=seat=>['東','南','西','北'][seat]||'';
const tileInfo=tile=>{
  const number=tile?.[0],suit=tile?.slice(1);
  const numbered={萬:{kind:'wan',mark:'萬'},筒:{kind:'dot',mark:'●'},條:{kind:'bam',mark:'│'}};
  if(/^[1-9]$/.test(number)&&numbered[suit]) return {number,kind:numbered[suit].kind,mark:numbered[suit].mark,label:tile};
  const honors={東:'東',南:'南',西:'西',北:'北',中:'中',發:'發',白:'白'};
  return {number:honors[tile]||tile,kind:tile==='中'?'red':tile==='發'?'green':'honor',mark:'字',label:tile};
};
function tileElement(tile,index,isTurn,game){
  const info=tileInfo(tile),button=document.createElement('button');
  button.className='tile '+info.kind;
  button.setAttribute('aria-label',info.label);
  button.innerHTML=`<span class="tile-number">${info.number}</span><span class="tile-mark">${info.mark}</span>`;
  button.disabled=!isTurn||game.status!=='playing'||Boolean(game.winner);
  button.onclick=()=>discard(index);
  return button;
}
function renderTing(game,isTurn){
  const button=$('#ting'),list=$('#ting-list');
  button.classList.toggle('hidden',!isTurn||!game.ting?.length||Boolean(game.winner));
  if(!isTurn||!game.ting?.length){list.classList.add('hidden');return;}
  list.textContent=game.ting.map(option=>`打 ${option.discard} → 聽 ${option.waits.join('、')}`).join('　｜　');
  list.classList.toggle('hidden',!state.showTing);
}
function renderClaims(game){
  const box=$('#claim-box'),title=$('#claim-title'),actions=$('#claim-actions');
  actions.replaceChildren();
  if(!game.claim){box.classList.add('hidden');return;}
  box.classList.remove('hidden');
  title.textContent=`有人打出 ${game.claim.tile}，你可以選擇：`;
  const labels={chi:'吃',pong:'碰',hu:'胡'};
  game.claim.actions.forEach(action=>{
    const button=document.createElement('button');
    button.className=action==='hu'?'primary':'secondary';
    button.textContent=labels[action];
    button.onclick=()=>claim(action);
    actions.append(button);
  });
  const pass=document.createElement('button');
  pass.className='ghost';pass.textContent='略過';pass.onclick=()=>claim('pass');actions.append(pass);
}
function render(game){
  state.game=game;state.roomId=game.roomId;localStorage.mahjongRoomId=game.roomId;
  $('#lobby').classList.add('hidden');$('#table').classList.remove('hidden');
  $('#room-id').textContent=game.roomId;$('#wall').textContent=game.wallCount;
  $('#status').textContent=game.winner?`${game.winner.name} ${game.winner.method}，本局結束。`:game.message||'等待其他玩家…';
  const isTurn=game.turnPlayerId===state.playerId;
  $('#turn-hint').textContent=game.status==='lobby'?'等待房主開始':game.winner?'本局已結束':game.claimPending?'等待吃、碰、胡選擇':isTurn?'輪到你出牌':'等待其他玩家出牌';
  $('#start').classList.toggle('hidden',!(game.status==='lobby'&&game.ownerId===state.playerId));
  $('#tai-hint').textContent=`目前 ${game.tai?.tai||0} 台／8 台起胡`;
  $('#hu').classList.toggle('hidden',!game.selfHu||!isTurn||Boolean(game.winner));
  const root=$('#players');root.replaceChildren();
  game.players.forEach(player=>{
    const element=$('#player-template').content.firstElementChild.cloneNode(true);
    element.classList.toggle('active',player.id===game.turnPlayerId);
    element.querySelector('b').textContent=`${seatName(player.seat)}・${player.name}`;
    element.querySelector('span').textContent=player.isBot?'電腦':`${player.handCount} 張`;
    element.querySelector('.discard').textContent=player.discards.slice(-8).join(' ')||'尚未出牌';
    element.querySelector('.meld').textContent=player.melds.length?`副露：${player.melds.map(meld=>meld.join('')).join('　')}`:'';
    element.querySelector('.flowers').textContent=player.flowers.length?`花：${player.flowers.join(' ')}`:'';
    root.append(element);
  });
  const tiles=$('#tiles');tiles.replaceChildren();
  game.hand.forEach((tile,index)=>tiles.append(tileElement(tile,index,isTurn,game)));
  renderClaims(game);renderTing(game,isTurn);
  if(!state.timer) state.timer=setInterval(refresh,2000);
}
async function create(mode){try{render(await api('create',{playerId:state.playerId,name:setName(),mode}));}catch(error){showError(error);}}
async function join(){try{const roomId=$('#room-code').value.trim().toUpperCase();if(!roomId)throw Error('請輸入房號。');render(await api('join',{roomId,playerId:state.playerId,name:setName()}));}catch(error){showError(error);}}
async function discard(index){try{state.showTing=false;render(await api('action',{roomId:state.roomId,playerId:state.playerId,action:'discard',index}));}catch(error){showError(error);}}
async function claim(action){try{render(await api('action',{roomId:state.roomId,playerId:state.playerId,action:'claim',claim:action}));}catch(error){showError(error);}}
async function refresh(){
  if(!state.roomId)return;
  try{render(await api(`state?roomId=${encodeURIComponent(state.roomId)}&playerId=${encodeURIComponent(state.playerId)}`,null,'GET'));}
  catch(error){clearInterval(state.timer);state.timer=null;state.roomId='';localStorage.removeItem('mahjongRoomId');}
}
document.querySelectorAll('[data-mode]').forEach(button=>button.onclick=()=>create(button.dataset.mode));
$('#join').onclick=join;
$('#start').onclick=async()=>{try{render(await api('action',{roomId:state.roomId,playerId:state.playerId,action:'start'}));}catch(error){showError(error);}};
$('#hu').onclick=async()=>{try{render(await api('action',{roomId:state.roomId,playerId:state.playerId,action:'hu'}));}catch(error){showError(error);}};
$('#ting').onclick=()=>{state.showTing=!state.showTing;render(state.game);};
$('#copy').onclick=()=>navigator.clipboard.writeText(state.roomId);
$('#leave').onclick=()=>{clearInterval(state.timer);state.timer=null;state.roomId='';localStorage.removeItem('mahjongRoomId');$('#table').classList.add('hidden');$('#lobby').classList.remove('hidden');};
$('#change-name').onclick=()=>{$('#name').focus();window.scrollTo({top:0,behavior:'smooth'});};
$('#name').value=state.name;
if(state.roomId) refresh();
