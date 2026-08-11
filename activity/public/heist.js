const params=new URLSearchParams(location.search);
const $=selector=>document.querySelector(selector);
const stages=[
  {image:'/heist/command-lobby.png',alt:'搶劫行動指揮大廳',kicker:'MISSION CONTROL',title:'部署行動隊伍',description:'挑選一條進場路線。這個獨立網頁版不會扣除金幣、體力或改寫 Discord 搶劫結果。',objective:'選擇進場方案',reward:'目標分數 1,000',hint:'選擇進場方案',button:'開始潛入',choices:[['夜宴偽裝','以貴賓身分進入大廳，首段容錯較高。','🎭','容錯 +1'],['屋頂空降','利用維修通道快速抵達金庫翼。','🪂','分數 +80'],['地下貨梯','帶著完整裝備進場，破解提示較長。','🛗','提示 +1']]},
  {image:'/heist/infiltration.png',alt:'賭場戰術潛入地圖',kicker:'STEALTH PHASE',title:'穿越保全封鎖',description:'在黃色游標進入綠色空檔時按下「穿越」。連續成功三次才可抵達金庫。',objective:'抓準巡邏空檔',reward:'成功 3 次',hint:'先選擇潛入策略',button:'開始潛入挑戰',choices:[['干擾監視器','安全區域稍微加寬。','◉','安全區 +6%'],['跟隨巡邏','成功時可獲得額外分數。','◌','分數 +120'],['釋放誘餌','失誤增加的警戒降低。','✦','警戒 -6']]},
  {image:'/heist/vault-breach.png',alt:'賭場金庫破解介面',kicker:'VAULT BREACH',title:'破解金庫核心',description:'記住依序閃爍的節點並正確點擊。順序會隨回合逐步加長。',objective:'完成四段電路序列',reward:'核心進度 4 / 4',hint:'先選擇破解工具',button:'開始金庫破解',choices:[['靜音解碼','錯誤時的警戒上升較少。','⌁','警戒 -8'],['強制過載','每完成一段可獲額外分數。','⚡','分數 +150'],['雙人同步','第一次序列少一格。','◇','序列 -1']]},
  {image:'/heist/getaway.png',alt:'賭場搶劫逃脫追逐畫面',kicker:'GETAWAY RUN',title:'帶著戰利品撤離',description:'用左右控制鈕避開封鎖車，撐到計時結束就能完成行動。',objective:'存活 8 秒',reward:'逃脫加成 +300',hint:'先選擇撤離方案',button:'開始撤離追逐',choices:[['裝甲車硬闖','碰撞容錯多一次。','🚙','護甲 +1'],['摩托車穿巷','速度更快，完成額外得分。','🏍','分數 +180'],['直升機接應','障礙出現間隔稍長。','✈','障礙 -1']]}
];

const state={stage:0,selected:null,active:false,completed:[false,false,false,false],heat:24,score:0,plan:0,result:false};
let toastTimer,miniTimer,escapeTimer;
function toast(message){const node=$('#toast');node.textContent=message;node.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>node.classList.remove('show'),2600);}
function stopMini(){clearInterval(miniTimer);clearInterval(escapeTimer);miniTimer=null;escapeTimer=null;}
function heatState(){if(state.heat<40)return{label:'低',color:'#59e1bd'};if(state.heat<65)return{label:'中',color:'#f6c957'};if(state.heat<83)return{label:'高',color:'#ff8a66'};return{label:'極高',color:'#ff668a'};}
function updateHeat(delta){state.heat=Math.max(8,Math.min(100,state.heat+delta));}
function preserveSessionLink(){const session=params.get('session');if(session)$('#backToGame').href=`/game?session=${encodeURIComponent(session)}`;}
function choiceBonus(){return state.selected===null?0:state.selected===1?110:60;}
function render(){
  stopMini();const data=stages[state.stage],currentHeat=heatState();
  const image=$('#stageImage');$('#missionStage').classList.add('swap');setTimeout(()=>{image.src=data.image;image.alt=data.alt;$('#missionStage').classList.remove('swap');},120);
  $('#stageKicker').textContent=state.result?'MISSION COMPLETE':data.kicker;$('#stageTitle').textContent=state.result?'行動展示完成':data.title;$('#stageDescription').textContent=state.result?'你已完成獨立網頁版的完整搶劫流程。分數與警戒只存於這次瀏覽器遊戲，不會寫入正式帳號。':data.description;$('#stageObjective').textContent=state.result?'任務評等已產生':data.objective;$('#stageReward').textContent=state.result?`最終分數 ${state.score.toLocaleString('zh-TW')}`:data.reward;$('#stageIndex').textContent=state.result?'COMPLETE':`${String(state.stage+1).padStart(2,'0')} / 04`;
  $('#heatLabel').textContent=currentHeat.label;$('#heatLabel').style.color=currentHeat.color;$('#heatBar').style.width=`${state.heat}%`;$('#heatBar').style.background=currentHeat.color;$('#heatBar').style.boxShadow=`0 0 12px ${currentHeat.color}`;
  document.querySelectorAll('.step').forEach((button,index)=>button.className=`step${index===state.stage?' active':''}${state.completed[index]?' done':''}`);
  const panel=$('#choicePanel');panel.hidden=state.active||state.result;panel.replaceChildren();
  if(!state.active&&!state.result)data.choices.forEach(([name,description,icon,bonus],index)=>{const button=document.createElement('button');button.type='button';button.className=`choice${state.selected===index?' selected':''}`;button.innerHTML=`<span class="choice-icon">${icon}</span><span><strong>${name}</strong><small>${description}</small></span><em>${bonus}</em>`;button.onclick=()=>{state.selected=index;$('#selectionSummary').textContent=name;renderChoices();};panel.append(button);});
  $('#gamePanel').hidden=true;$('#actionHint').textContent=state.result?'可立即重新挑戰':state.completed[state.stage]?'本階段已完成':data.hint;$('#selectionSummary').textContent=state.result?`分數 ${state.score.toLocaleString('zh-TW')} · 警戒 ${state.heat}%`:state.selected===null?'尚未選擇':data.choices[state.selected][0];
  $('#primaryAction').innerHTML=state.result?'重新開始 <span>↻</span>':state.completed[state.stage]?(state.stage===3?'查看行動結算 <span>→</span>':'前往下一階段 <span>→</span>'):`${data.button} <span>→</span>`;
  $('#crewReadout').textContent=`4 人就緒 · 警戒 ${state.heat}%`;
}
function renderChoices(){document.querySelectorAll('.choice').forEach((button,index)=>button.classList.toggle('selected',state.selected===index));if(state.selected!==null)$('#selectionSummary').textContent=stages[state.stage].choices[state.selected][0];}
function showMini({kicker,title,instruction,progress,status}){$('#gamePanel').hidden=false;$('#choicePanel').hidden=true;$('#miniKicker').textContent=kicker;$('#miniTitle').textContent=title;$('#miniInstruction').textContent=instruction;$('#miniProgress').textContent=progress;$('#miniStatus').textContent=status;}
function setMiniStatus(text){$('#miniStatus').textContent=text;}
function completeChallenge(message,points){stopMini();state.active=false;state.completed[state.stage]=true;state.score+=points+choiceBonus();toast(`${message} +${points+choiceBonus()} 分`);render();}
function failChallenge(message){stopMini();updateHeat(12);setMiniStatus(`${message} 警戒上升，請重試。`);$('#miniControls').innerHTML='<button class="primary" id="retryMini" type="button">重新挑戰</button>';$('#retryMini').onclick=()=>startChallenge();}
function startInfiltration(){
  let cursor=0,direction=1,hits=0,safeStart=54,safeWidth=state.selected===0?30:24;
  showMini({kicker:'TIMING RUN',title:'守衛空檔',instruction:'游標落在綠色區域時，按下穿越。連續成功 3 次。',progress:'0 / 3',status:'等待第一個空檔…'});
  $('#miniBoard').innerHTML='<div class="timing-track"><i class="timing-safe"></i><b class="timing-cursor"></b></div><div class="timing-meta"><span>巡邏開始</span><span>安全空檔</span><span>封鎖區</span></div>';
  const safe=$('.timing-safe'),cursorNode=$('.timing-cursor');safe.style.left=`${safeStart}%`;safe.style.width=`${safeWidth}%`;
  $('#miniControls').innerHTML='<button class="primary" id="timingAction" type="button">現在穿越</button>';
  const tick=()=>{cursor+=direction*3;if(cursor>=100||cursor<=0)direction*=-1;cursor=Math.max(0,Math.min(100,cursor));cursorNode.style.left=`${cursor}%`;};miniTimer=setInterval(tick,38);
  $('#timingAction').onclick=()=>{if(cursor>=safeStart&&cursor<=safeStart+safeWidth){hits+=1;state.score+=45;safeStart=18+Math.floor(Math.random()*58);safe.style.left=`${safeStart}%`;$('#miniProgress').textContent=`${hits} / 3`;setMiniStatus(`完美穿越！剩下 ${3-hits} 次。`);if(hits===3)completeChallenge('已安全抵達金庫',260);}else{updateHeat(state.selected===2?5:10);setMiniStatus('被巡邏燈掃到，警戒提高。');}};
}
function startVault(){
  const length=state.selected===2?3:4,sequence=Array.from({length},()=>Math.floor(Math.random()*9));let input=[];
  showMini({kicker:'MEMORY HACK',title:'金庫電路序列',instruction:'先記住閃爍節點，再用相同順序連線。每答錯一次會重播序列。',progress:`0 / ${length}`,status:'正在顯示序列…'});
  $('#miniBoard').innerHTML='<div class="hack-grid"></div>';const grid=$('.hack-grid');
  for(let index=0;index<9;index++){const node=document.createElement('button');node.type='button';node.className='hack-node';node.textContent='◇';node.disabled=true;node.onclick=()=>pressNode(index);grid.append(node);}
  $('#miniControls').innerHTML='<button id="replaySequence" type="button">重播序列</button>';
  const nodes=[...document.querySelectorAll('.hack-node')];
  function playSequence(){input=[];nodes.forEach(node=>node.disabled=true);setMiniStatus('記住閃爍節點…');let offset=180;sequence.forEach(index=>{setTimeout(()=>nodes[index].classList.add('lit'),offset);setTimeout(()=>nodes[index].classList.remove('lit'),offset+300);offset+=480;});setTimeout(()=>{nodes.forEach(node=>node.disabled=false);setMiniStatus('換你輸入序列。');},offset+80);}
  function pressNode(index){if(index!==sequence[input.length]){updateHeat(state.selected===0?5:10);setMiniStatus('序列錯誤，警戒提高，正在重播。');setTimeout(playSequence,650);return;}input.push(index);nodes[index].classList.add('lit');$('#miniProgress').textContent=`${input.length} / ${length}`;if(input.length===length)completeChallenge('金庫核心已解除鎖定',330);}
  $('#replaySequence').onclick=playSequence;playSequence();
}
function startEscape(){
  let lane=1,ticks=0,armor=state.selected===0?1:0,obstacles=[];
  showMini({kicker:'GETAWAY DODGE',title:'封鎖線追逐',instruction:'用左右按鈕切換車道，避開紅色封鎖車並撐到倒數結束。',progress:'8.0 秒',status:'準備衝出後巷…'});
  $('#miniBoard').innerHTML='<div class="escape-track"><div class="escape-hud"><span id="escapeTime">8.0 秒</span><span id="escapeArmor">護甲 0</span></div><div class="escape-lane"></div><div class="escape-lane"></div><div class="escape-lane"></div></div>';
  const lanes=[...document.querySelectorAll('.escape-lane')],time=$('#escapeTime'),armorLabel=$('#escapeArmor');const player=document.createElement('div');player.className='escape-player';player.textContent='◆';lanes[lane].append(player);armorLabel.textContent=`護甲 ${armor}`;
  $('#miniControls').innerHTML='<button id="moveLeft" type="button">← 左切</button><button id="moveRight" type="button">右切 →</button>';
  function move(delta){lane=Math.max(0,Math.min(2,lane+delta));lanes[lane].append(player);}
  $('#moveLeft').onclick=()=>move(-1);$('#moveRight').onclick=()=>move(1);
  escapeTimer=setInterval(()=>{ticks+=1;let crashed=false;const seconds=Math.max(0,8-ticks*.35);time.textContent=`${seconds.toFixed(1)} 秒`;
    if(ticks%2===0||(state.selected!==2&&ticks%3===0)){const obstacle={lane:Math.floor(Math.random()*3),y:-20,node:document.createElement('div')};obstacle.node.className='escape-obstacle';obstacle.node.textContent='✹';obstacle.node.style.setProperty('--y',`${obstacle.y}%`);lanes[obstacle.lane].append(obstacle.node);obstacles.push(obstacle);}
    obstacles.forEach(obstacle=>{obstacle.y+=18;obstacle.node.style.setProperty('--y',`${obstacle.y}%`);if(obstacle.lane===lane&&obstacle.y>62&&obstacle.y<92){if(armor>0){armor-=1;armorLabel.textContent=`護甲 ${armor}`;obstacle.y=110;obstacle.node.style.setProperty('--y','110%');setMiniStatus('裝甲擋下撞擊！');}else{crashed=true;}}});if(crashed){failChallenge('撤離車被封鎖車攔下');return;}obstacles=obstacles.filter(obstacle=>{if(obstacle.y>110){obstacle.node.remove();return false;}return true;});if(ticks>=23)completeChallenge('成功突破外圍封鎖',390);
  },350);
}
function startChallenge(){state.active=true;state.selected===null&&(state.selected=0);if(state.stage===1)startInfiltration();else if(state.stage===2)startVault();else if(state.stage===3)startEscape();}
function finishRun(){stopMini();state.result=true;state.active=false;showMini({kicker:'RESULT',title:'獨立搶劫演練完成',instruction:`最終分數 ${state.score.toLocaleString('zh-TW')}，保全警戒 ${state.heat}%。這是獨立網頁成績，不會變更 Discord 帳號。`,progress:'SAFE',status:'想挑戰更高分，可以立即重新開始。'});$('#miniBoard').innerHTML='<div class="hack-grid"><div class="hack-node lit">★</div><div class="hack-node lit">★</div><div class="hack-node lit">★</div></div>';$('#miniControls').innerHTML='<button class="primary" id="restartRun" type="button">重新開始</button>';$('#restartRun').onclick=restartRun;renderResult();}
function renderResult(){const currentHeat=heatState();$('#heatLabel').textContent=currentHeat.label;$('#heatLabel').style.color=currentHeat.color;$('#heatBar').style.width=`${state.heat}%`;$('#heatBar').style.background=currentHeat.color;$('#stageKicker').textContent='MISSION COMPLETE';$('#stageTitle').textContent='行動展示完成';$('#stageDescription').textContent='每次挑戰都有不同的巡邏空檔、金庫序列與封鎖車位置。';$('#stageObjective').textContent='獨立練習不影響正式帳號';$('#stageReward').textContent=`最終分數 ${state.score.toLocaleString('zh-TW')}`;$('#stageIndex').textContent='COMPLETE';$('#choicePanel').hidden=true;$('#actionHint').textContent='可立即重新挑戰';$('#selectionSummary').textContent=`分數 ${state.score.toLocaleString('zh-TW')} · 警戒 ${state.heat}%`;$('#primaryAction').innerHTML='重新開始 <span>↻</span>';}
function restartRun(){stopMini();Object.assign(state,{stage:0,selected:null,active:false,completed:[false,false,false,false],heat:24,score:0,plan:0,result:false});render();window.scrollTo({top:0,behavior:'smooth'});}
function primaryAction(){if(state.result)return restartRun();if(state.active){toast('請先完成目前的行動挑戰');return;}if(state.selected===null){toast('請先選擇一個行動方案');return;}if(state.stage===0){state.completed[0]=true;state.score+=150+choiceBonus();state.stage=1;state.selected=null;toast('行動已部署，現在進入賭場。');render();return;}if(state.completed[state.stage]){if(state.stage===3)return finishRun();state.stage+=1;state.selected=null;render();return;}startChallenge();}
function setStage(index){if(index>state.stage||state.active||state.result){toast(state.active?'請先完成目前的行動挑戰':'請依序完成前一個行動階段');return;}state.stage=index;state.selected=null;render();}
$('#primaryAction').onclick=primaryAction;document.querySelectorAll('.step').forEach(button=>button.onclick=()=>setStage(Number(button.dataset.stage)));$('#intelButton').onclick=()=>{$('#intelSheet').classList.add('open');$('#intelSheet').setAttribute('aria-hidden','false');$('#intelButton').setAttribute('aria-expanded','true');};$('#closeIntel').onclick=()=>{$('#intelSheet').classList.remove('open');$('#intelSheet').setAttribute('aria-hidden','true');$('#intelButton').setAttribute('aria-expanded','false');};preserveSessionLink();render();
