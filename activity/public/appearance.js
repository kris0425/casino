const params=new URLSearchParams(location.search);
const session=params.get('session')||'';
const $=selector=>document.querySelector(selector);
const state={data:null,equipped:null,draft:null,slot:'character',busy:false};
const formatCoins=value=>`${Number(value||0).toLocaleString('zh-TW')} 金幣`;
let toastTimer;

function toast(message,error=false){
  const node=$('#toast');node.textContent=message;node.className=`toast show${error?' error':''}`;
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>node.className='toast',3200);
}
function equalLooks(a,b){return state.data.slots.every(({id})=>(a?.[id]||null)===(b?.[id]||null));}
function item(id){return state.data.catalog.find(entry=>entry.id===id);}
function owned(entry){return entry&&entry.owned;}
async function api(path,{method='GET',body}={}){
  const options={method,headers:{}};
  if(body){options.headers['content-type']='application/json';options.body=JSON.stringify({session,...body});}
  const url=method==='GET'?`${path}?session=${encodeURIComponent(session)}`:path;
  const response=await fetch(url,options);const data=await response.json().catch(()=>({}));
  if(!response.ok||!data.ok)throw new Error(data.error||'網站暫時無法處理這個動作');
  return data;
}
function syncData(data,keepDraft=false){
  state.data=data;state.equipped={...data.appearance};
  if(!keepDraft)state.draft={...data.appearance};
  $('#balance').textContent=formatCoins(data.player.balance);
  $('#playerName').textContent=data.player.name;
  $('#playerAvatar').src=data.player.avatar;
  render();
}
function render(){renderLobby();renderTabs();renderPreview();renderCatalog();renderPresets();}
function renderLobby(){
  const characters=state.data.catalog.filter(entry=>entry.slot==='character');
  const current=item(state.draft.character)||characters[0];
  const currentIndex=Math.max(0,characters.findIndex(entry=>entry.id===current?.id));
  const visible=characters.length>3?[characters[(currentIndex-1+characters.length)%characters.length],characters[currentIndex],characters[(currentIndex+1)%characters.length]]:characters;
  const background=item(state.draft.background);
  $('#lobbyBackground').src=background?.image||'';
  $('#characterLineup').innerHTML=visible.map(entry=>`<button class="character-card${current?.id===entry.id?' active':''}" data-character="${entry.id}" aria-label="${entry.name}"><img src="${entry.image}" alt="${entry.name}"><span class="character-tag">${entry.name}</span>${owned(entry)?'':'<span class="character-lock">🔒</span>'}</button>`).join('');
  document.querySelectorAll('[data-character]').forEach(card=>card.onclick=()=>selectItem(card.dataset.character));
  $('#activeCharacterName').textContent=current?.name||'未選擇人物';
  $('#activeCharacterTheme').textContent=current?.theme||'人物大廳';
}
function renderTabs(){
  $('#slotTabs').innerHTML=state.data.slots.map(slot=>`<button class="slot-tab${state.slot===slot.id?' active':''}" data-slot="${slot.id}">${slot.name}</button>`).join('');
  document.querySelectorAll('.slot-tab').forEach(button=>button.onclick=()=>{state.slot=button.dataset.slot;render();});
}
function setWearable(selector,entry){const layer=$(selector);layer.src=entry?.image||'';layer.hidden=!entry?.image;layer.dataset.style=entry?.style||'none';}
function renderPreview(){
  const chosen=Object.fromEntries(state.data.slots.map(({id})=>[id,item(state.draft[id])]));
  const bg=chosen.background;$('#previewBackground').src=bg?.image||'';$('#previewBackground').style.opacity=bg?'1':'0';
  $('#previewCharacter').src=chosen.character?.image||'';$('#previewCharacter').style.opacity=chosen.character?'1':'0';
  $('#previewStage').dataset.character=chosen.character?.style||'casino';
  $('#previewStage').dataset.outfit=chosen.outfit?.style||'none';
  setWearable('#previewOutfit',chosen.outfit);setWearable('#previewHeadwear',chosen.headwear);setWearable('#previewFace',chosen.face);setWearable('#previewHandheld',chosen.handheld);
  $('#previewCharacter').dataset.outfit=chosen.outfit?.style||'casino';
  $('#previewAura').dataset.style=chosen.aura?.style||'none';$('#previewAura').style.display=chosen.aura?'block':'none';
  const themes=Object.values(chosen).filter(Boolean).map(entry=>entry.theme);const theme=themes.length?themes.sort((a,b)=>themes.filter(x=>x===b).length-themes.filter(x=>x===a).length)[0]:'簡約模式';
  $('#lookTheme').textContent=theme;
  const changed=!equalLooks(state.draft,state.equipped);$('#draftBadge').textContent=changed?'尚未套用':'已穿戴';$('#draftBadge').classList.toggle('changed',changed);
  $('#selectionSummary').innerHTML=state.data.slots.map(({id,name})=>`<div class="summary-item"><small>${name}</small><strong>${chosen[id]?.name||'未穿戴'}</strong></div>`).join('');
}
function renderCatalog(){
  const entries=state.data.catalog.filter(entry=>entry.slot===state.slot);$('#catalogCount').textContent=`${entries.length} 件商品`;
  $('#catalog').innerHTML=entries.map(entry=>`<button class="item-card${state.draft[state.slot]===entry.id?' selected':''}" data-id="${entry.id}"><span class="item-icon${entry.image?' visual':''}">${entry.image?`<img src="${entry.image}" alt="">`:entry.icon}</span><span class="item-copy"><strong>${entry.name}</strong><span>${entry.theme} · ${state.data.slots.find(slot=>slot.id===entry.slot).name}</span><small>${owned(entry)?(entry.starter?'免費基本款':'已擁有'):formatCoins(entry.price)}</small></span>${owned(entry)?'<i class="owned-dot"></i>':''}</button>`).join('');
  document.querySelectorAll('.item-card').forEach(card=>card.onclick=()=>selectItem(card.dataset.id));
}
async function selectItem(id){
  const entry=item(id);if(!entry)return;
  if(!owned(entry)){
    if(!confirm(`確定花費 ${formatCoins(entry.price)} 購買「${entry.name}」？`))return;
    await busy(async()=>{const data=await api('/api/appearance/purchase',{method:'POST',body:{cosmeticId:id}});syncData(data,true);state.draft[entry.slot]=id;render();toast(data.message);});
    return;
  }
  state.draft[entry.slot]=id;render();
}
function renderPresets(){
  const presets=new Map(state.data.presets.map(preset=>[preset.presetNo,preset]));
  $('#presets').innerHTML=[1,2,3].map(number=>{const preset=presets.get(number);return `<div class="preset-card"><label>預設 ${number}${preset?' · 已儲存':''}</label><input maxlength="20" id="presetName${number}" value="${escapeHtml(preset?.name||`造型 ${number}`)}"><div class="preset-actions"><button data-save-preset="${number}">儲存目前試穿</button><button data-load-preset="${number}" ${preset?'':'disabled'}>載入</button></div></div>`;}).join('');
  document.querySelectorAll('[data-save-preset]').forEach(button=>button.onclick=()=>savePreset(Number(button.dataset.savePreset)));
  document.querySelectorAll('[data-load-preset]').forEach(button=>button.onclick=()=>loadPreset(Number(button.dataset.loadPreset)));
}
function escapeHtml(value){return String(value).replace(/[&<>"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[char]));}
async function savePreset(number){await busy(async()=>{const name=$(`#presetName${number}`).value;const data=await api('/api/appearance/preset',{method:'POST',body:{presetNo:number,name,appearance:state.draft}});syncData(data,true);toast(data.message);});}
function loadPreset(number){const preset=state.data.presets.find(entry=>entry.presetNo===number);if(!preset?.appearance)return toast('這組預設還沒有內容',true);state.draft={...preset.appearance};render();toast(`已載入「${preset.name}」，按「穿上這套」才會正式套用`);}
async function busy(action){if(state.busy)return;state.busy=true;document.querySelectorAll('button').forEach(button=>button.disabled=true);try{await action();}catch(error){toast(error.message,true);}finally{state.busy=false;document.querySelectorAll('button').forEach(button=>button.disabled=false);render();}}

$('#saveLook').onclick=()=>busy(async()=>{const data=await api('/api/appearance/save',{method:'POST',body:{appearance:state.draft}});syncData(data);toast(data.message);});
$('#resetLook').onclick=()=>{state.draft={...state.equipped};render();toast('已復原到目前穿戴造型');};
$('#removeSlot').onclick=()=>{if(state.slot==='character')return toast('展示人物不能卸下，請選擇另一名人物',true);state.draft[state.slot]=null;render();};
$('#publishLook').onclick=()=>busy(async()=>{if(!equalLooks(state.draft,state.equipped))throw new Error('請先按「穿上這套」再發布');const data=await api('/api/appearance/publish',{method:'POST',body:{}});toast(data.message);});
$('#openWardrobe').onclick=()=>$('#app').scrollIntoView({behavior:'smooth',block:'start'});

(async()=>{
  try{
    if(!session)throw new Error('缺少安全連結，請回 Discord 使用 /玩家 造型');
    const data=await api('/api/appearance');syncData(data);$('#app').setAttribute('aria-busy','false');
  }catch(error){toast(error.message,true);$('.loading p').textContent=error.message;return;}
  $('#loading').classList.add('hidden');
})();
