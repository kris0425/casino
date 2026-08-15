const params=new URLSearchParams(location.search),session=params.get('session')||'';
const $=selector=>document.querySelector(selector),format=value=>Number(value||0).toLocaleString('zh-TW');
const state={data:null,selected:null,busy:false};let toastTimer,tickTimer;
function node(tag,className,text){const el=document.createElement(tag);if(className)el.className=className;if(text!==undefined)el.textContent=text;return el;}
function toast(message,error=false){const el=$('#toast');el.textContent=message;el.className=`toast show${error?' error':''}`;clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.className='toast',3200);}
async function api(path,{method='GET',body={}}={}){const options={method,headers:{}};let url=path;if(method==='GET')url+=`?session=${encodeURIComponent(session)}`;else{options.headers['content-type']='application/json';options.body=JSON.stringify({session,...body});}const response=await fetch(url,options),data=await response.json().catch(()=>({}));if(!response.ok||!data.ok)throw new Error(data.error||'城市暫時無法連線');return data;}
function duration(ms){if(ms<=0)return '已完成';const seconds=Math.ceil(ms/1000),hours=Math.floor(seconds/3600),minutes=Math.floor(seconds%3600/60),rest=seconds%60;return hours?`${hours} 小時 ${minutes} 分`:minutes?`${minutes} 分 ${rest} 秒`:`${rest} 秒`;}
function phaseText(plot){
  if(plot.phase==='locked')return `購地 ${format(plot.price)}`;
  if(plot.phase==='vacant')return '可興建';
  if(plot.phase==='building')return `施工 ${duration(Number(plot.constructionCompletesAt||0)-Date.now())}`;
  if(plot.phase==='ready')return '可開始營運';
  if(plot.phase==='operating')return plot.operation?`營運 ${duration(Number(plot.operation.completesAt||0)-Date.now())}`:'等待重新整理';
  if(plot.phase==='collect')return plot.operation?`可領 ${format(plot.operation.revenue)}`:'等待重新整理';
  return plot.phase||'等待資料';
}
function buildingVisual(plot){if(plot.phase==='locked')return node('div','lock-mark','🔒');if(!plot.building)return node('div','vacant-mark','＋');if(plot.phase==='building')return node('div','construction','🏗️');const wrap=node('div',`building ${plot.building.id}`);wrap.style.setProperty('--tower-color',plot.building.color);wrap.append(node('i','side'),node('i','front'),node('i','roof'));return wrap;}
function render(){const data=state.data;$('#avatar').src=data.player.avatar;$('#playerName').textContent=data.player.name;$('#balance').textContent=format(data.player.balance);$('#unlocked').textContent=data.summary.unlocked;$('#built').textContent=data.summary.built;$('#collected').textContent=format(data.summary.totalCollected);$('#homeLink').href=data.homeUrl||`/game?session=${encodeURIComponent(session)}`;
  const city=$('#city');city.replaceChildren();for(const plot of data.plots){const card=node('button',`plot ${plot.phase}`);card.type='button';card.dataset.plotNo=plot.no;card.append(node('span','plot-number',`LOT 0${plot.no}`),buildingVisual(plot));const copy=node('div','plot-copy');copy.append(node('strong','',plot.building?.name||plot.name),node('small','',plot.building?`${plot.district}｜Lv.${plot.building.level}｜狀況 ${plot.building.condition}`:plot.district),node('span','plot-status',phaseText(plot)));card.append(copy);card.onclick=()=>openPlot(plot.no);city.append(card);}
  const catalog=$('#catalog');catalog.replaceChildren();for(const item of data.buildings){const card=node('article');card.append(node('span','icon',item.icon),node('h3','',item.name),node('p','',`${item.kind}｜營運 ${duration(item.operationMs)}｜基礎收入 ${format(item.baseRevenue)}`),node('strong','',`建造費 ${format(item.cost)}`));catalog.append(card);}
}
function detailItem(label,value){const box=node('div');box.append(node('small','',label),node('strong','',value));return box;}
function actionButton(label,action,className=''){const button=node('button',className,label);button.type='button';button.disabled=state.busy;button.onclick=()=>perform(action);return button;}
function openPlot(plotNo){state.selected=plotNo;const plot=state.data.plots.find(item=>item.no===plotNo);if(!plot)return;$('#sheetDistrict').textContent=`LOT 0${plot.no} · ${plot.district}`;$('#sheetTitle').textContent=plot.building?.name||plot.name;const body=$('#sheetBody');body.replaceChildren();
  if(plot.phase==='locked'){body.append(node('p','event',`購買土地後即可永久使用這個地塊。土地價格 ${format(plot.price)} 金幣。`));const actions=node('div','actions');actions.append(actionButton(`購買土地｜${format(plot.price)}`,{type:'unlock'},'gold'));body.append(actions);}
  else if(plot.phase==='vacant'){body.append(node('p','event','選擇一棟事業建築。施工費立即支付，完工後即可開始營運。'));const options=node('div','build-options');for(const item of state.data.buildings){const button=node('button','build-option');button.type='button';button.disabled=state.busy;button.append(node('span','',item.icon));const copy=node('div');copy.append(node('strong','',item.name),node('small','',`${item.kind}｜施工 ${duration(item.buildMs)}｜營運 ${duration(item.operationMs)}`));button.append(copy,node('b','',format(item.cost)));button.onclick=()=>perform({type:'build',buildingId:item.id});options.append(button);}body.append(options);}
  else {const building=plot.building,details=node('div','detail');details.append(detailItem('事業類型',building.kind),detailItem('建築等級',`Lv.${building.level} / 10`),detailItem('建築狀況',`${building.condition} / 100`),detailItem('累積收入',`${format(plot.totalCollected)} 金幣`));body.append(details);
    if(plot.phase==='building')body.append(node('p','event',`🏗️ 施工團隊進場中，預計 ${duration(plot.constructionCompletesAt-Date.now())} 後完工。`));
    if(plot.operation?.event)body.append(node('p','event',`${plot.operation.event.icon} ${plot.operation.event.name}｜${plot.operation.event.text}\n本期預計營收 ${format(plot.operation.revenue)}，總成本 ${format(plot.operation.cost)}。`));
    const actions=node('div','actions');if(plot.phase==='ready')actions.append(actionButton(`開始${building.kind}`,{type:'operate'},'primary'));if(plot.phase==='collect')actions.append(actionButton(`領取 ${format(plot.operation.revenue)}`,{type:'claim'},'gold'));if(plot.phase==='operating')actions.append(actionButton('營運進行中',{type:'none'}));if(plot.phase==='building')actions.append(actionButton('施工進行中',{type:'none'}));
    if(['ready','collect'].includes(plot.phase))actions.append(actionButton(building.upgradeCost===null?'已達最高等級':`升級｜${format(building.upgradeCost)}`,{type:'upgrade'}));if(plot.phase==='ready'&&building.repairCost)actions.append(actionButton(`全面維修｜${format(building.repairCost)}`,{type:'repair'}));body.append(actions);}
  $('#backdrop').hidden=false;$('#sheet').hidden=false;
}
function closeSheet(){state.selected=null;$('#backdrop').hidden=true;$('#sheet').hidden=true;}
async function perform(action){if(state.busy||action.type==='none')return;state.busy=true;openPlot(state.selected);try{const data=await api(`/api/real-estate/${action.type}`,{method:'POST',body:{plotNo:state.selected,buildingId:action.buildingId}});state.data=data;render();toast(data.message);openPlot(state.selected);}catch(error){toast(error.message,true);}finally{state.busy=false;if(state.selected)openPlot(state.selected);}}
async function load(show=true){if(show)$('#loading').hidden=false;try{state.data=await api('/api/real-estate');render();}catch(error){toast(error.message,true);}finally{$('#loading').hidden=true;}}
$('#refresh').onclick=()=>load(false);$('#sheetClose').onclick=closeSheet;$('#backdrop').onclick=closeSheet;document.addEventListener('keydown',event=>{if(event.key==='Escape')closeSheet();});
tickTimer=setInterval(()=>{if(!state.data)return;render();if(state.selected)openPlot(state.selected);const due=state.data.plots.some(plot=>(plot.phase==='building'&&Date.now()>=plot.constructionCompletesAt)||(plot.phase==='operating'&&Date.now()>=plot.operation?.completesAt));if(due)load(false);},1000);
load();
