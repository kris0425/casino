const paints = [
  {id:'factory',name:'原廠車色',price:0,color:'#c5c9cf'},
  {id:'white',name:'珍珠白',price:15000,color:'#f3f5f7'},
  {id:'black',name:'曜石黑',price:15000,color:'#17191d'},
  {id:'yellow',name:'競速黃',price:18000,color:'#ffd400'},
  {id:'red',name:'烈焰紅',price:18000,color:'#e1212d'},
  {id:'blue',name:'電光藍',price:18000,color:'#1768f2'},
  {id:'purple',name:'午夜紫',price:25000,color:'#8229d9'},
  {id:'green',name:'翡翠綠',price:25000,color:'#13a95d'}
];
const kits = [
  {id:'stock',name:'原廠車身',price:0,note:'經典原廠線條'},
  {id:'liberty_walk',name:'Liberty Walk',price:180000,note:'街道寬體・操控 +1'},
  {id:'rocket_bunny',name:'Rocket Bunny',price:220000,note:'鉚釘寬體・加速 +1'},
  {id:'competition',name:'賽事級空力',price:350000,note:'最高下壓力・操控 +2'}
];
const wheels = [
  {id:'stock',name:'原廠輪框',price:0,note:'標準配置'},
  {id:'te37',name:'Volk TE37',price:60000,note:'鍛造輕量・操控 +1'},
  {id:'bbs_lm',name:'BBS LM',price:85000,note:'多片式・操控 +1'},
  {id:'forged',name:'競技輕量鍛造',price:120000,note:'加速 +1・操控 +1'}
];
const r34Availability = {
  factory:{stock:['stock','bbs_lm','forged'],liberty_walk:['te37','bbs_lm','forged'],rocket_bunny:['forged'],competition:['bbs_lm','forged']},
  white:{stock:['stock','te37','bbs_lm','forged'],liberty_walk:['te37','bbs_lm','forged'],rocket_bunny:['forged'],competition:['te37','bbs_lm','forged']},
  black:{stock:['stock','te37','bbs_lm','forged'],liberty_walk:['te37','bbs_lm','forged'],rocket_bunny:['forged'],competition:['te37','bbs_lm','forged']},
  yellow:{stock:['stock','bbs_lm','forged'],liberty_walk:['te37','bbs_lm','forged'],rocket_bunny:['forged'],competition:['stock','te37','bbs_lm','forged']},
  red:{stock:['stock','bbs_lm','forged'],liberty_walk:['te37','bbs_lm','forged'],rocket_bunny:['forged'],competition:['te37','bbs_lm','forged']},
  blue:{stock:['stock','bbs_lm','forged'],liberty_walk:['te37','bbs_lm','forged'],rocket_bunny:['forged'],competition:['te37','bbs_lm','forged']},
  purple:{stock:['stock','bbs_lm','forged'],liberty_walk:['te37','bbs_lm','forged'],rocket_bunny:['forged'],competition:['bbs_lm','forged']},
  green:{stock:['stock','te37','bbs_lm','forged'],liberty_walk:['te37','bbs_lm','forged'],rocket_bunny:['forged'],competition:['bbs_lm','forged']}
};
const rx7Availability = Object.fromEntries(paints.map(({id}) => [id, {rocket_bunny:['bbs_lm'],competition:['te37','forged']}]))
const profiles = {
  silver_r34:{folder:'r34',title:'白銀戰神 R34',model:'Nissan Skyline GT-R',default:{paint:'white',widebody:'stock',wheels:'stock'},availability:r34Availability},
  rocket_bunny_rx7:{folder:'rx7',title:'Mazda RX-7 FD 轉子戰魂',model:'Mazda RX-7 FD',default:{paint:'yellow',widebody:'competition',wheels:'te37'},availability:rx7Availability}
};

const params = new URLSearchParams(location.search);
const session = params.get('session');
const requestedAsset = params.get('asset') === 'rocket_bunny_rx7' ? 'rocket_bunny_rx7' : 'silver_r34';
const $ = (selector) => document.querySelector(selector);
const byId = (list,id) => list.find((item) => item.id === id);
const money = (value) => Number(value || 0).toLocaleString('zh-TW');
let connected = false;
let assetId = requestedAsset;
let profile = profiles[assetId];
let availability = profile.availability;
let current = {...profile.default};
let state = {paint:current.paint,kit:current.widebody,wheel:current.wheels,panel:'paint'};

function setProfile(id, reset=true) {
  assetId = profiles[id] ? id : 'silver_r34';
  profile = profiles[assetId];
  availability = profile.availability;
  $('#vehicle-title').textContent = profile.title;
  $('#vehicle-model').textContent = profile.model;
  if (reset) {
    current = {...profile.default};
    state = {paint:current.paint,kit:current.widebody,wheel:current.wheels,panel:state.panel};
  }
}
function displayName(list,id) {
  if (assetId === 'rocket_bunny_rx7' && list === kits) return {liberty_walk:'RE Amemiya',rocket_bunny:'Rocket Bunny',competition:'VeilSide Fortune'}[id] || byId(list,id).name;
  if (assetId === 'rocket_bunny_rx7' && list === wheels && id === 'bbs_lm') return 'Work Meister S1';
  return byId(list,id).name;
}
function selectionPrice() {
  return (state.paint===current.paint?0:byId(paints,state.paint).price)+(state.kit===current.widebody?0:byId(kits,state.kit).price)+(state.wheel===current.wheels?0:byId(wheels,state.wheel).price);
}
function rating(label,value) {
  return `<div class="rating-row"><span>${label}</span><div class="rating-track" aria-label="${label} ${value} / 5">${[1,2,3,4,5].map((step)=>`<i class="${step<=value?'filled':''}"></i>`).join('')}</div></div>`;
}
function updatePreview() {
  const image = `./cars/${profile.folder}/${state.paint}_${state.kit}_${state.wheel}_stock.jpg`;
  $('#car-image').src = image;
  $('#car-image').alt = `${displayName(paints,state.paint)} ${displayName(kits,state.kit)} ${displayName(wheels,state.wheel)} ${profile.title}`;
  $('#car-caption').textContent = `${displayName(paints,state.paint)} ・ ${displayName(kits,state.kit)} ・ ${displayName(wheels,state.wheel)}`;
  const speed=state.kit==='competition'?5:4, acceleration=state.wheel==='forged'||state.kit==='rocket_bunny'?5:4, handling=state.kit!=='stock'||state.wheel!=='stock'?5:4;
  $('#ratings').innerHTML = rating('速度',speed)+rating('加速',acceleration)+rating('操控',handling);
  $('#score').textContent = state.kit==='competition'?'S':state.kit==='stock'?'A':'A+';
  $('#heist-bonus').textContent = `+${state.kit==='competition'?5:state.kit==='rocket_bunny'?4:state.kit==='liberty_walk'?3:2}%`;
  $('#total').textContent = money(selectionPrice());
}
function choosePaint(id) {
  const nextKit=availability[id]?.[state.kit]?state.kit:Object.keys(availability[id]||{})[0], allowed=availability[id]?.[nextKit]||[];
  state.paint=id; state.kit=nextKit; if(!allowed.includes(state.wheel)) state.wheel=allowed[0]||'stock'; render();
}
function chooseKit(id) {
  const allowed=availability[state.paint]?.[id]; if(!allowed)return; state.kit=id; if(!allowed.includes(state.wheel))state.wheel=allowed[0]; render();
}
function renderOptions() {
  if(state.panel==='paint') $('#options').innerHTML=`<div class="paint-grid">${paints.map((item)=>`<button class="paint-option ${state.paint===item.id?'selected':''}" data-paint="${item.id}"><i style="background:${item.color}"></i><span><b>${item.name}</b><small>${item.price?money(item.price)+' 金幣':'免費'}</small></span><em>✓</em></button>`).join('')}</div>`;
  if(state.panel==='kit') $('#options').innerHTML=`<div class="choice-list">${kits.map((item)=>{const enabled=!!availability[state.paint]?.[item.id];return `<button ${enabled?'':'disabled'} class="${state.kit===item.id?'selected':''}" data-kit="${item.id}"><span><b>${displayName(kits,item.id)}</b><small>${enabled?item.note:'這個車色尚無對應素材'}</small></span><strong>${item.price?money(item.price):'免費'}</strong></button>`}).join('')}</div>`;
  if(state.panel==='wheel') $('#options').innerHTML=`<div class="choice-list">${wheels.map((item)=>{const enabled=availability[state.paint]?.[state.kit]?.includes(item.id);return `<button ${enabled?'':'disabled'} class="${state.wheel===item.id?'selected':''}" data-wheel="${item.id}"><span><b>${displayName(wheels,item.id)}</b><small>${enabled?item.note:'此車身尚無對應素材'}</small></span><strong>${item.price?money(item.price):'免費'}</strong></button>`}).join('')}</div>`;
  document.querySelectorAll('[data-paint]').forEach((button)=>button.onclick=()=>choosePaint(button.dataset.paint));
  document.querySelectorAll('[data-kit]').forEach((button)=>button.onclick=()=>chooseKit(button.dataset.kit));
  document.querySelectorAll('[data-wheel]').forEach((button)=>button.onclick=()=>{state.wheel=button.dataset.wheel;render()});
}
function render() {
  document.querySelectorAll('.tabs button').forEach((button)=>button.classList.toggle('active',button.dataset.panel===state.panel));
  renderOptions(); updatePreview(); $('#confirm span').textContent='確認改裝';
}
function setStatus(text,live=false) {$('#connection-status').innerHTML=`<i></i> ${text}`;$('#connection-status').classList.toggle('connected',live)}
function showError(message) {$('#checkout-note').textContent=message;$('#checkout-note').classList.add('error')}
async function connectDiscord() {
  if(!session){setStatus('展示模式');return}
  setStatus('連結 Discord 中');
  try {
    const response=await fetch(`/api/garage?session=${encodeURIComponent(session)}`,{cache:'no-store'}), data=await response.json();
    if(!response.ok||!data.ok)throw new Error(data.error||'無法載入 Discord 車庫');
    connected=true; setProfile(data.vehicle.assetId);
    current={paint:data.vehicle.current.paint,widebody:data.vehicle.current.widebody,wheels:data.vehicle.current.wheels};
    if(!availability[current.paint]?.[current.widebody]?.includes(current.wheels))current={...profile.default};
    state={paint:current.paint,kit:current.widebody,wheel:current.wheels,panel:'paint'};
    $('#wallet-balance').textContent=money(data.player.balance); $('#checkout-note').textContent='已連結 Discord 車庫；確認後才會扣款並保存。'; setStatus('DISCORD 已連結',true); render();
  } catch(error) {showError(error.message);setStatus('連結失敗')}
}
document.querySelectorAll('.tabs button').forEach((button)=>button.onclick=()=>{state.panel=button.dataset.panel;render()});
$('#confirm').onclick=()=>{$('#modal-config').textContent=[displayName(paints,state.paint),displayName(kits,state.kit),displayName(wheels,state.wheel)].join(' ・ ');$('#modal-price').textContent=`${money(selectionPrice())} 金幣`;$('#modal').hidden=false};
$('#close').onclick=()=>$('#modal').hidden=true;
$('#modal').onmousedown=(event)=>{if(event.target.id==='modal')$('#modal').hidden=true};
$('#apply').onclick=async()=>{
  if(!connected){$('#modal').hidden=true;showError('請從 Discord 的改裝按鈕開啟，才能正式保存。');return}
  const button=$('#apply');button.disabled=true;button.querySelector('span').textContent='安裝中…';
  try {
    const response=await fetch('/api/garage/confirm',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({session,assetId,selections:{paint:state.paint,widebody:state.kit,wheels:state.wheel}})}),data=await response.json();
    if(!response.ok||!data.ok)throw new Error(data.error||'改裝失敗');
    current={paint:data.current.paint,widebody:data.current.widebody,wheels:data.current.wheels};$('#wallet-balance').textContent=money(data.balance);$('#modal').hidden=true;$('#checkout-note').textContent=`✅ 改裝完成，已支付 ${money(data.price)} 金幣。`;$('#checkout-note').classList.remove('error');render();
  } catch(error){showError(error.message)} finally {button.disabled=false;button.querySelector('span').textContent='確認安裝'}
};
$('#car-image').onerror=()=>{showError('這個組合的預覽圖尚未完成，請選擇其他搭配。');$('#confirm').disabled=true};
$('#car-image').onload=()=>{$('#confirm').disabled=false};
setProfile(requestedAsset,false);render();connectDiscord();
