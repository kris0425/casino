const params=new URLSearchParams(location.search),session=params.get('session')||'';
const $=selector=>document.querySelector(selector);
const format=value=>Number(value||0).toLocaleString('zh-TW');
const state={data:null,busy:false,garageGroup:null};
let toastTimer,countdownTimer;

function toast(message,error=false){const node=$('#toast');node.textContent=message;node.className=`toast show${error?' error':''}`;clearTimeout(toastTimer);toastTimer=setTimeout(()=>node.className='toast',3200);}
function node(tag,className,text){const element=document.createElement(tag);if(className)element.className=className;if(text!==undefined)element.textContent=text;return element;}
async function api(path,{method='GET'}={}){
  const options={method,headers:{}};
  let url=path;
  if(method==='GET')url+=`?session=${encodeURIComponent(session)}`;
  else{options.headers['content-type']='application/json';options.body=JSON.stringify({session});}
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
    if(['transport','garage','assets','achievements'].includes(module.id))primary.append(item);
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
  for(const group of data.groups){const button=node('button',`garage-tab${state.garageGroup===group.id?' active':''}`,`${group.icon} ${group.name} · ${format(group.count)}`);button.type='button';button.onclick=()=>{state.garageGroup=group.id;renderGarage(data);};tabs.append(button);}
  const grid=$('#garageGrid'),group=data.groups.find(entry=>entry.id===state.garageGroup);grid.replaceChildren();
  if(!group?.items.length){grid.append(node('div','empty-card',`目前尚未收藏${group?.name||'此類載具'}。`));return;}
  for(const item of group.items){
    const card=node('article','garage-card'),media=node('div','garage-media');
    if(item.image){const image=node('img');image.src=item.image;image.alt=item.name;image.loading='lazy';image.onerror=()=>{media.replaceChildren(node('span','garage-placeholder',group.icon));};media.append(image);}else media.append(node('span','garage-placeholder',group.icon));
    const copy=node('div','garage-copy'),heading=node('header');heading.append(node('h3','',item.name),node('span','garage-quantity',`× ${format(item.quantity)}`));copy.append(heading,node('p','garage-rarity',`${item.rarity} · ${item.category}`));if(item.bonus)copy.append(node('strong','garage-bonus',item.bonus));copy.append(node('small','garage-value',`收藏原價 ${format(item.value)} 金幣`));card.append(media,copy);grid.append(card);
  }
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
function startCountdown(expiresAt){
  clearInterval(countdownTimer);const update=()=>{const remaining=Math.max(0,expiresAt-Date.now()),minutes=Math.floor(remaining/60000),seconds=Math.floor(remaining%60000/1000),label=remaining?`安全連結 ${minutes}:${String(seconds).padStart(2,'0')}`:'安全連結已過期';setText('#sessionTime',label);setText('#sidebarSession',label);};update();countdownTimer=setInterval(update,1000);
}
function openDrawer(){document.body.classList.add('drawer-open');$('#gameSidebar').setAttribute('aria-hidden','false');$('#menuToggle').setAttribute('aria-expanded','true');}
function closeDrawer(){document.body.classList.remove('drawer-open');$('#gameSidebar').setAttribute('aria-hidden','true');$('#menuToggle').setAttribute('aria-expanded','false');}
function render(data){state.data=data;renderPlayer(data);renderSidebar(data.modules);renderTransport(data.transport);renderGarage(data.garage);renderAssets(data.assets);renderAchievements(data.achievements);startCountdown(data.expiresAt);}
async function load(showToast=false){if(state.busy)return;state.busy=true;try{const data=await api('/api/game');render(data);if(showToast)toast('遊戲資料已更新');$('#loading').classList.add('hidden');}catch(error){toast(error.message,true);$('#loading strong').textContent=error.message;$('#loading p').textContent='請回到 Discord 使用 /玩家 遊戲 取得新連結';}finally{state.busy=false;}}
$('#refreshData').onclick=()=>load(true);
$('#menuToggle').onclick=openDrawer;$('#sidebarClose').onclick=closeDrawer;$('#drawerOverlay').onclick=closeDrawer;document.addEventListener('keydown',event=>{if(event.key==='Escape')closeDrawer();});
$('#restoreStamina').onclick=async()=>{if(state.busy)return;state.busy=true;try{const data=await api('/api/game/stamina-restore',{method:'POST'});render(data);toast(data.message);}catch(error){toast(error.message,true);}finally{state.busy=false;}};
if(!session){$('#loading strong').textContent='缺少安全連結';$('#loading p').textContent='請回到 Discord 使用 /玩家 遊戲';}else load();
