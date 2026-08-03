const params=new URLSearchParams(location.search),session=params.get('session')||'';
const $=selector=>document.querySelector(selector);
const format=value=>Number(value||0).toLocaleString('zh-TW');
const GARAGE_PAGE_SIZE=6;
const state={data:null,busy:false,garageGroup:null,garagePage:0,pvp:null,pvpBusy:false,pvpSettledRace:null};
let toastTimer,countdownTimer,pvpPollTimer;

function toast(message,error=false){const node=$('#toast');node.textContent=message;node.className=`toast show${error?' error':''}`;clearTimeout(toastTimer);toastTimer=setTimeout(()=>node.className='toast',3200);}
function node(tag,className,text){const element=document.createElement(tag);if(className)element.className=className;if(text!==undefined)element.textContent=text;return element;}
async function api(path,{method='GET',body={}}={}){
  const options={method,headers:{}};
  let url=path;
  if(method==='GET')url+=`?session=${encodeURIComponent(session)}`;
  else{options.headers['content-type']='application/json';options.body=JSON.stringify({session,...body});}
  const response=await fetch(url,options),data=await response.json().catch(()=>({}));
  if(!response.ok||!data.ok)throw new Error(data.error||'網站暫時無法取得遊戲資料');
  return data;
}
function setText(selector,value){$(selector).textContent=value;}
function renderPlayer(data){
  $('#playerAvatar').src=data.player.avatar;setText('#playerName',data.player.name);setText('#playerRank',data.player.rank);setText('#playerTitle',data.player.title);
  $('#sidebarAvatar').src=data.player.avatar;setText('#sidebarName',data.player.name);setText('#sidebarBalance',`${format(data.player.balance)} 金幣`);
  setText('#playerBalance',format(data.player.balance));setText('#playerDebt',format(data.player.debt));setText('#staminaText',`${format(data.player.stamina)} / ${format(data.player.maxStamina)}`);
  $('#staminaBar').style.width=`${Math.min(100,Math.max(0,data.player.stamina/data.player.maxStamina*100))}%`;
  const restore=$('#restoreStamina');restore.disabled=!data.player.dailyStaminaAvailable;restore.textContent=data.player.dailyStaminaAvailable?'每日免費回體力':'今日已領取';
  $('#heroBackground').src=data.appearance.backgroundImage||'';$('#heroCharacter').src=data.appearance.characterImage||'';
  setText('#buffIcon',data.dailyBuff.icon);setText('#buffName',`${data.dailyBuff.day}｜${data.dailyBuff.name}`);setText('#buffText',data.dailyBuff.text);
  setText('#assetCount',format(data.assets.count));setText('#assetValue',format(data.assets.value));setText('#achievementCount',`${data.achievements.unlocked} / ${data.achievements.total}`);
  setText('#versionLabel',`版本 ${data.version}`);$('#appearanceLink').href=data.modules.find(module=>module.id==='appearance')?.href||'#';
}
function sidebarItem({icon,name,description,href,state}){
  const item=node(state==='coming'?'button':'a',`nav-item${state==='coming'?' disabled':''}`);if(item.tagName==='A')item.href=href;
  item.append(node('span','nav-icon',icon));const copy=node('span','nav-copy');copy.append(node('strong','',name),node('small','',description));item.append(copy,node('span','nav-arrow',state==='coming'?'即將推出':'›'));
  if(item.tagName==='A')item.onclick=()=>closeDrawer();return item;
}
function renderSidebar(modules){
  const primary=$('#primaryNav'),games=$('#gameNav');primary.replaceChildren();games.replaceChildren();
  primary.append(sidebarItem({icon:'🏠',name:'遊戲大廳',description:'玩家金庫、體力與今日增益',href:'#top',state:'dashboard'}));
  for(const module of modules){
    const item=sidebarItem(module);
    if(['transport','vehicle-pvp','garage','assets','achievements'].includes(module.id))primary.append(item);
    else games.append(item);
  }
}
function renderTransport(items){
  const grid=$('#transportGrid');grid.replaceChildren();
  for(const item of items){
    const card=node('article',`transport-card${item.registered?'':' unregistered'}`),header=node('header');header.append(node('span','',item.icon));const title=node('div');title.append(node('h3','',item.name),node('small','',item.companyName||'尚未成立公司'));header.append(title);card.append(header,node('p','status',item.status));
    const details=node('dl');for(const [label,value] of [['企業等級',item.registered?`Lv.${item.level}`:'—'],['營運場站',item.station||'—'],['目前路線',item.route||'—']])details.append(node('dt','',label),node('dd','',value));card.append(details);grid.append(card);
  }
}
function renderGarage(data){
  if(!state.garageGroup||!data.groups.some(group=>group.id===state.garageGroup))state.garageGroup=data.groups[0]?.id||null;
  setText('#garageSummary',`共 ${format(data.count)} 輛／架｜${format(data.kinds)} 種收藏`);
  const tabs=$('#garageTabs');tabs.replaceChildren();
  for(const group of data.groups){const button=node('button',`garage-tab${state.garageGroup===group.id?' active':''}`,`${group.icon} ${group.name} · ${format(group.count)}`);button.type='button';button.onclick=()=>{state.garageGroup=group.id;state.garagePage=0;renderGarage(data);};tabs.append(button);}
  const grid=$('#garageGrid'),group=data.groups.find(entry=>entry.id===state.garageGroup);grid.replaceChildren();
  const pager=$('#garagePager');
  if(!group?.items.length){grid.append(node('div','empty-card',`目前尚未收藏${group?.name||'此類載具'}。`));pager.hidden=true;return;}
  const pageCount=Math.max(1,Math.ceil(group.items.length/GARAGE_PAGE_SIZE));state.garagePage=Math.min(state.garagePage,pageCount-1);
  const start=state.garagePage*GARAGE_PAGE_SIZE,visible=group.items.slice(start,start+GARAGE_PAGE_SIZE);
  for(const item of visible){
    const card=node('article','garage-card'),media=node('div','garage-media');
    if(item.image){const link=node('a','garage-media-link');link.href=item.image;link.target='_blank';link.rel='noopener';link.title=`查看 ${item.name} 完整圖片`;const image=node('img');image.src=item.image;image.alt=item.name;image.loading='lazy';image.decoding='async';image.fetchPriority='low';image.onerror=()=>{media.replaceChildren(node('span','garage-placeholder',group.icon));};link.append(image);media.append(link);}else media.append(node('span','garage-placeholder',group.icon));
    const copy=node('div','garage-copy'),heading=node('header');heading.append(node('h3','',item.name),node('span','garage-quantity',`× ${format(item.quantity)}`));copy.append(heading,node('p','garage-rarity',`${item.rarity} · ${item.category}`));if(item.bonus)copy.append(node('strong','garage-bonus',item.bonus));copy.append(node('small','garage-value',`收藏原價 ${format(item.value)} 金幣`));card.append(media,copy);grid.append(card);
  }
  pager.hidden=pageCount<=1;setText('#garagePageSummary',`顯示 ${start+1}–${start+visible.length}／${group.items.length} · 第 ${state.garagePage+1} 頁`);
  const previous=$('#garagePrevious'),next=$('#garageNext');previous.disabled=state.garagePage===0;next.disabled=state.garagePage>=pageCount-1;
  previous.onclick=()=>{if(state.garagePage>0){state.garagePage--;renderGarage(data);$('#garage').scrollIntoView({block:'start'});}};
  next.onclick=()=>{if(state.garagePage<pageCount-1){state.garagePage++;renderGarage(data);$('#garage').scrollIntoView({block:'start'});}};
}
function renderAssets(data){
  setText('#assetSummary',`共 ${format(data.count)} 件｜原價總值 ${format(data.value)} 金幣`);const grid=$('#assetGrid');grid.replaceChildren();
  if(!data.featured.length){grid.append(node('div','empty-card','目前尚未持有資產，請從 Discord 資產商城開始收藏。'));return;}
  for(const item of data.featured){const card=node('article','asset-card'),header=node('header');header.append(node('h3','',item.name),node('span','quantity',`× ${format(item.quantity)}`));card.append(header,node('p','',`${format(item.totalValue)} 金幣`),node('small','',`${item.category} · ${item.rarity}`));grid.append(card);}
}
function renderAchievements(data){
  const grid=$('#achievementGrid');grid.replaceChildren();
  for(const item of data.items){const card=node('article',`achievement-card${item.done?' done':''}`),header=node('header');header.append(node('h3','',item.name),node('span','',item.done?'✓':'🔒'));card.append(header,node('p','',item.description),node('small','',item.done?'已解鎖':item.progress||'等待揭曉'));grid.append(card);}
}
function pvpStatusText(room){if(room.status==='waiting')return '等待對手加入';if(room.status==='finished')return room.draw?'平手完成':'賽事完成';if(Date.now()<(room.startsAt||0))return '雙方已就位';return `即時賽段 ${room.stage} / ${room.totalStages}`;}
function renderPvpPlayer(room,index){
  const racer=$(`#pvpRacer${index}`),player=room.players[index];
  if(!player){racer.hidden=true;return;}racer.hidden=false;
  const image=racer.querySelector('img');image.src=player.vehicle.image||'';image.alt=player.vehicle.name;
  racer.querySelector('strong').textContent=`${player.name}${player.isSelf?'（你）':''}`;racer.querySelector('small').textContent=player.event||player.vehicle.name;
  const progress=Math.max(0,Math.min(100,player.progress||0));racer.style.left=`calc(${progress}% - ${progress*.84}px)`;
  racer.classList.toggle('boost',player.event==='氮氣爆發');racer.classList.toggle('mistake',player.event==='彎道失誤');racer.classList.toggle('winner',room.status==='finished'&&!room.draw&&room.winnerId===player.id);
}
function renderPvp(data){
  state.pvp=data;const select=$('#pvpVehicle'),selected=select.value;
  select.replaceChildren();
  if(!data.choices.length){const option=node('option','', '車庫內沒有可參賽的汽車或機車');option.value='';select.append(option);}else for(const choice of data.choices){const option=node('option','',`${choice.name}｜${choice.rarity}｜戰力 ${choice.power}`);option.value=choice.id;select.append(option);}
  if(data.choices.some(choice=>choice.id===selected))select.value=selected;
  const room=data.room,empty=$('#pvpEmpty'),live=$('#pvpLive');empty.hidden=Boolean(room);live.hidden=!room;
  $('#pvpCreate').disabled=state.pvpBusy||!data.choices.length||Boolean(room&&['waiting','running'].includes(room.status));
  $('#pvpJoin').disabled=state.pvpBusy||!data.choices.length||Boolean(room&&['waiting','running'].includes(room.status));
  if(!room){clearInterval(pvpPollTimer);pvpPollTimer=null;return;}
  setText('#pvpStatus',pvpStatusText(room));setText('#pvpTitle',`${room.title}｜每人 ${format(room.bet)} 金幣`);setText('#pvpCopyCode',room.code);
  $('#pvpArena').style.backgroundImage=room.scene?.image?`url("${room.scene.image}")`:'';
  const countdown=$('#pvpCountdown');
  if(room.status==='waiting')countdown.textContent='等待對手輸入房碼';
  else if(room.status==='running'&&Date.now()<room.startsAt)countdown.textContent=`${Math.max(1,Math.ceil((room.startsAt-Date.now())/1000))}`;
  else countdown.textContent=room.status==='finished'?(room.draw?'平手！':'🏆 勝負已定'):room.title;
  renderPvpPlayer(room,0);renderPvpPlayer(room,1);
  const result=$('#pvpResult');result.replaceChildren();
  if(room.status==='waiting')result.textContent='把房碼交給同一個 Discord 伺服器的玩家；等待期間不會扣款。';
  else if(room.status==='running')result.textContent=room.stage?room.players.map(player=>`${player.name}：${Math.round(player.distance)}m · ${player.event}`).join('　'):'雙方下注與體力已鎖定，準備起跑。';
  else if(room.draw)result.append(node('strong','',`雙方同時衝線，已各退回 ${format(room.bet)} 金幣。`));
  else {const winner=room.players.find(player=>player.id===room.winnerId),credited=room.result?.credited||0,rake=room.result?.rake||0;result.append(node('strong','',`🏆 ${winner?.name||'勝者'} 入帳 ${format(credited)} 金幣`));if(rake)result.append(document.createTextNode(`（高額賭局抽成 ${Math.round((room.result.rakeRate||0)*100)}%：${format(rake)}）`));}
  $('#pvpCancel').hidden=!room.canCancel;
  if(['waiting','running'].includes(room.status)){if(!pvpPollTimer)pvpPollTimer=setInterval(()=>loadPvp(false),700);}
  else {clearInterval(pvpPollTimer);pvpPollTimer=null;if(state.pvpSettledRace!==room.id){state.pvpSettledRace=room.id;load(false);}}
}
async function loadPvp(showToast=false){if(state.pvpBusy)return;try{const data=await api('/api/game/vehicle-pvp');renderPvp(data);if(showToast)toast('PVP 狀態已更新');}catch(error){clearInterval(pvpPollTimer);pvpPollTimer=null;if(showToast)toast(error.message,true);}}
async function pvpAction(path,body){if(state.pvpBusy)return;state.pvpBusy=true;try{const data=await api(path,{method:'POST',body});renderPvp(data);toast(data.message||'PVP 狀態已更新');}catch(error){toast(error.message,true);}finally{state.pvpBusy=false;if(state.pvp)renderPvp(state.pvp);}}
function startCountdown(expiresAt){
  clearInterval(countdownTimer);const update=()=>{const remaining=Math.max(0,expiresAt-Date.now()),minutes=Math.floor(remaining/60000),seconds=Math.floor(remaining%60000/1000),label=remaining?`安全連結 ${minutes}:${String(seconds).padStart(2,'0')}`:'安全連結已過期';setText('#sessionTime',label);setText('#sidebarSession',label);};update();countdownTimer=setInterval(update,1000);
}
function openDrawer(){document.body.classList.add('drawer-open');$('#gameSidebar').setAttribute('aria-hidden','false');$('#menuToggle').setAttribute('aria-expanded','true');}
function closeDrawer(){document.body.classList.remove('drawer-open');$('#gameSidebar').setAttribute('aria-hidden','true');$('#menuToggle').setAttribute('aria-expanded','false');}
function render(data){state.data=data;renderPlayer(data);renderSidebar(data.modules);renderTransport(data.transport);renderGarage(data.garage);renderAssets(data.assets);renderAchievements(data.achievements);startCountdown(data.expiresAt);}
async function load(showToast=false){if(state.busy)return;state.busy=true;try{const data=await api('/api/game');render(data);if(showToast)toast('遊戲資料已更新');$('#loading').classList.add('hidden');loadPvp(false);}catch(error){toast(error.message,true);$('#loading strong').textContent=error.message;$('#loading p').textContent='請回到 Discord 使用 /玩家 遊戲 取得新連結';}finally{state.busy=false;}}
$('#refreshData').onclick=()=>load(true);
$('#menuToggle').onclick=openDrawer;$('#sidebarClose').onclick=closeDrawer;$('#drawerOverlay').onclick=closeDrawer;document.addEventListener('keydown',event=>{if(event.key==='Escape')closeDrawer();});
$('#restoreStamina').onclick=async()=>{if(state.busy)return;state.busy=true;try{const data=await api('/api/game/stamina-restore',{method:'POST'});render(data);toast(data.message);}catch(error){toast(error.message,true);}finally{state.busy=false;}};
$('#pvpCreate').onclick=()=>{const bet=Number($('#pvpBet').value),assetId=$('#pvpVehicle').value;if(!Number.isSafeInteger(bet)||bet<10)return toast('下注必須是至少 10 的正整數',true);pvpAction('/api/game/vehicle-pvp/create',{assetId,bet});};
$('#pvpJoin').onclick=()=>{const code=$('#pvpCode').value.trim().toUpperCase(),assetId=$('#pvpVehicle').value;if(!/^[A-Z2-9]{6}$/.test(code))return toast('請輸入六位房碼',true);pvpAction('/api/game/vehicle-pvp/join',{code,assetId});};
$('#pvpCancel').onclick=()=>pvpAction('/api/game/vehicle-pvp/cancel',{code:state.pvp?.room?.code||''});
$('#pvpCopyCode').onclick=async()=>{const code=state.pvp?.room?.code;if(!code)return;try{await navigator.clipboard.writeText(code);toast(`房碼 ${code} 已複製`);}catch{toast(`房碼：${code}`);}};
$('#pvpCode').addEventListener('input',event=>{event.target.value=event.target.value.toUpperCase().replace(/[^A-Z2-9]/g,'').slice(0,6);});
if(!session){$('#loading strong').textContent='缺少安全連結';$('#loading p').textContent='請回到 Discord 使用 /玩家 遊戲';}else load();
