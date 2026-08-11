const params=new URLSearchParams(location.search);
const $=selector=>document.querySelector(selector);

const stages=[
  {image:'/heist/command-lobby.png',alt:'搶劫行動指揮大廳',kicker:'MISSION CONTROL',title:'部署行動隊伍',description:'從三條進場路線中選一條；第一版僅為網頁互動展示，不會直接結算金幣。',objective:'挑選進場方案',reward:'預估戰利品 280,000',hint:'選擇進場方案',button:'確認部署',choices:[['夜宴偽裝','以貴賓身分進入大廳，警戒最低。','🎭','警戒 -15'],['屋頂空降','利用維修通道快速抵達金庫翼。','🪂','時間 -20 秒'],['地下貨梯','帶著完整裝備進場，開鎖能力提升。','🛗','破解 +10%']]},
  {image:'/heist/infiltration.png',alt:'賭場戰術潛入地圖',kicker:'STEALTH PHASE',title:'穿越保全封鎖',description:'監視器視線與守衛巡邏會持續改變。選擇小隊的下一個動作。',objective:'避開西側巡邏隊',reward:'剩餘空檔 14 秒',hint:'選擇潛入策略',button:'前往金庫',choices:[['干擾監視器','夜影駭客使監視器停擺 12 秒。','◉','低風險'],['跟隨巡邏','趁守衛轉身時通過走廊。','◌','體力 -8'],['釋放誘餌','偽裝專家吸引一組警衛離開。','✦','警戒 -10']]},
  {image:'/heist/vault-breach.png',alt:'賭場金庫破解介面',kicker:'VAULT BREACH',title:'破解金庫核心',description:'連接正確的電路節點，解除鎖定並把握警方抵達前的時間。',objective:'完成第一道電路鎖',reward:'核心進度 0%',hint:'選擇破解工具',button:'啟動撤離',choices:[['靜音解碼','較慢但不會提高保全警戒。','⌁','穩定 +20'],['強制過載','立即推進破解進度，但增加熱度。','⚡','進度 +35'],['雙人同步','開鎖手與駭客一起破解。','◇','獎勵 +12%']]},
  {image:'/heist/getaway.png',alt:'賭場搶劫逃脫追逐畫面',kicker:'GETAWAY RUN',title:'帶著戰利品撤離',description:'警車已封鎖主要道路。選擇撤離方式，將戰利品安全帶回藏身處。',objective:'突破外圍封鎖',reward:'逃脫率 72%',hint:'選擇撤離方案',button:'完成行動',choices:[['裝甲車硬闖','最穩定的直線撤離路線。','🚙','逃脫 +18%'],['摩托車穿巷','高風險高速度，避開封鎖網。','🏍','獎勵 +8%'],['直升機接應','需要付出額外成本，但幾乎無視路障。','✈','警戒歸零']]}
];

let stage=0,selected=null,toastTimer;
const heat=[{label:'低',value:'28%',color:'#59e1bd'},{label:'中',value:'45%',color:'#f6c957'},{label:'高',value:'69%',color:'#ff668a'},{label:'極高',value:'82%',color:'#ff668a'}];
function toast(message){const node=$('#toast');node.textContent=message;node.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>node.classList.remove('show'),2600);}
function preserveSessionLink(){const session=params.get('session');if(session)$('#backToGame').href=`/game?session=${encodeURIComponent(session)}`;}
function render(){
  const data=stages[stage],heatState=heat[stage];
  const image=$('#stageImage');$('#missionStage').classList.add('swap');setTimeout(()=>{image.src=data.image;image.alt=data.alt;$('#missionStage').classList.remove('swap');},120);
  $('#stageKicker').textContent=data.kicker;$('#stageTitle').textContent=data.title;$('#stageDescription').textContent=data.description;$('#stageObjective').textContent=data.objective;$('#stageReward').textContent=data.reward;$('#stageIndex').textContent=`${String(stage+1).padStart(2,'0')} / 04`;
  $('#heatLabel').textContent=heatState.label;$('#heatLabel').style.color=heatState.color;$('#heatBar').style.width=heatState.value;$('#heatBar').style.background=heatState.color;$('#heatBar').style.boxShadow=`0 0 12px ${heatState.color}`;
  document.querySelectorAll('.step').forEach((button,index)=>button.className=`step${index===stage?' active':''}${index<stage?' done':''}`);
  const panel=$('#choicePanel');panel.replaceChildren();
  data.choices.forEach(([name,description,icon,bonus],index)=>{const button=document.createElement('button');button.type='button';button.className=`choice${selected===index?' selected':''}`;button.innerHTML=`<span class="choice-icon">${icon}</span><span><strong>${name}</strong><small>${description}</small></span><em>${bonus}</em>`;button.onclick=()=>{selected=index;$('#selectionSummary').textContent=name;renderChoices();};panel.append(button);});
  $('#actionHint').textContent=data.hint;$('#primaryAction').innerHTML=`${data.button} <span>→</span>`;$('#crewReadout').textContent=stage===3?'全員等待撤離':'4 人就緒';
}
function renderChoices(){const data=stages[stage];document.querySelectorAll('.choice').forEach((button,index)=>button.classList.toggle('selected',selected===index));if(selected!==null)$('#selectionSummary').textContent=data.choices[selected][0];}
function nextStage(){
  if(selected===null){toast('請先選擇一個行動方案');return;}
  const choice=stages[stage].choices[selected][0];
  if(stage===stages.length-1){toast(`行動展示完成：已採用「${choice}」撤離。正式結算將在下一版串接。`);stage=0;selected=null;$('#selectionSummary').textContent='尚未選擇';render();return;}
  toast(`已採用「${choice}」`);stage+=1;selected=null;$('#selectionSummary').textContent='尚未選擇';render();window.scrollTo({top:0,behavior:'smooth'});
}
function setStage(index){if(index>stage){toast('請依序完成前一個行動階段');return;}stage=index;selected=null;$('#selectionSummary').textContent='尚未選擇';render();}
$('#primaryAction').onclick=nextStage;document.querySelectorAll('.step').forEach(button=>button.onclick=()=>setStage(Number(button.dataset.stage)));
$('#intelButton').onclick=()=>{$('#intelSheet').classList.add('open');$('#intelSheet').setAttribute('aria-hidden','false');$('#intelButton').setAttribute('aria-expanded','true');};
$('#closeIntel').onclick=()=>{$('#intelSheet').classList.remove('open');$('#intelSheet').setAttribute('aria-hidden','true');$('#intelButton').setAttribute('aria-expanded','false');};
preserveSessionLink();render();
