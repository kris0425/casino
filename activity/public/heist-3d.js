import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

const $=selector=>document.querySelector(selector);
const W=900,H=600,TILE=50;
const walls=[
  [0,0,18,1],[0,11,18,1],[0,0,1,12],[17,0,1,12],
  [4,1,1,5],[4,7,6,1],[9,1,1,4],[10,4,4,1],[13,1,1,4],[13,7,1,3],[7,8,1,2]
];
const routePoints=[[95,520],[95,115],[95,320],[725,320],[725,145],[790,520]];
const state={running:false,ended:false,keys:new Set(),player:{x:95,y:520,r:15},guards:[],cameras:[],terminal:{x:130,y:115,done:false},vault:{x:725,y:145,open:false},exit:{x:790,y:520},loot:[],heat:12,lootValue:0,time:180,interact:null,interactProgress:0,cameraDisabledUntil:0,last:0};
let scene,camera,renderer,clock,playerMesh,terminalMesh,vaultMesh,exitMesh,routeLine,animation=0,toastTimer;
let cameraYaw=0,targetCameraYaw=0,lastMovementInput='',playerAnimationTime=0;
const guardMeshes=[],cameraMeshes=[],lootMeshes=[];
const movementForward=new THREE.Vector3(),movementRight=new THREE.Vector3(),movementDirection=new THREE.Vector3(),cameraFacing=new THREE.Vector3(),cameraLookAt=new THREE.Vector3();

const world=(x,y,height=0)=>new THREE.Vector3(x/TILE-9,height,y/TILE-6);
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const near=(target,range=38)=>distance(state.player,target)<=range;
function circleRect(x,y,r,rect){const nearestX=clamp(x,rect[0]*TILE,(rect[0]+rect[2])*TILE),nearestY=clamp(y,rect[1]*TILE,(rect[1]+rect[3])*TILE);return Math.hypot(x-nearestX,y-nearestY)<r;}
const blocked=(x,y)=>walls.some(rect=>circleRect(x,y,state.player.r,rect));
function toast(message){const node=$('#toast');node.textContent=message;node.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>node.classList.remove('show'),2600);}
function material(color,{metalness=.15,roughness=.65,emissive=0,opacity=1}={}){return new THREE.MeshStandardMaterial({color,metalness,roughness,emissive,transparent:opacity<1,opacity,depthWrite:opacity>=1});}
function mesh(geometry,mat,x=0,y=0,z=0){const item=new THREE.Mesh(geometry,mat);item.position.set(x,y,z);item.castShadow=true;item.receiveShadow=true;scene.add(item);return item;}
function groupActor(color){
  const group=new THREE.Group(),body=new THREE.Mesh(new THREE.CylinderGeometry(.18,.23,.58,10),material(color,{metalness:.35,roughness:.45})),head=new THREE.Mesh(new THREE.SphereGeometry(.15,12,8),material(0xf1c4a8));
  body.position.y=.34;head.position.y=.75;body.castShadow=head.castShadow=true;group.add(body,head);scene.add(group);return group;
}
function actorPart(parent,geometry,mat,x,y,z){const item=new THREE.Mesh(geometry,mat);item.position.set(x,y,z);item.castShadow=true;item.receiveShadow=true;parent.add(item);return item;}
function createHeistOperator(){
  const group=new THREE.Group(),rig=new THREE.Group(),coat=material(0x12131c,{metalness:.42,roughness:.36}),armor=material(0x24293a,{metalness:.65,roughness:.28}),cloth=material(0x191625,{roughness:.75}),skin=material(0xd4a58d,{roughness:.7}),visor=material(0x36e5ca,{metalness:.82,roughness:.16,emissive:0x075b53}),trim=material(0x8b4ee8,{metalness:.55,roughness:.3,emissive:0x291455});
  group.name='黑曜行動員';group.scale.setScalar(1.3);group.add(rig);scene.add(group);
  actorPart(rig,new THREE.BoxGeometry(.4,.43,.23),coat,0,.68,0);actorPart(rig,new THREE.BoxGeometry(.34,.22,.25),armor,0,.73,-.025);actorPart(rig,new THREE.BoxGeometry(.11,.08,.025),visor,0,.74,-.15);
  const belt=actorPart(rig,new THREE.BoxGeometry(.43,.09,.25),armor,0,.46,0);actorPart(belt,new THREE.BoxGeometry(.08,.055,.03),trim,0,0,-.145);
  actorPart(rig,new THREE.ConeGeometry(.27,.48,4),cloth,0,.31,.06).rotation.y=Math.PI/4;
  const head=actorPart(rig,new THREE.SphereGeometry(.16,14,10),skin,0,1.02,0);head.scale.z=.92;actorPart(rig,new THREE.SphereGeometry(.166,14,8,0,Math.PI*2,0,Math.PI*.56),cloth,0,1.055,.005);actorPart(rig,new THREE.BoxGeometry(.27,.085,.035),visor,0,1.035,-.145);
  const backpack=actorPart(rig,new THREE.BoxGeometry(.27,.34,.14),armor,0,.7,.17);actorPart(backpack,new THREE.BoxGeometry(.07,.24,.025),trim,0,0,.085);
  function limb(side){const arm=new THREE.Group();arm.position.set(side*.25,.84,0);rig.add(arm);actorPart(arm,new THREE.CapsuleGeometry(.065,.25,4,8),coat,0,-.16,0);actorPart(arm,new THREE.BoxGeometry(.11,.08,.12),armor,0,-.34,-.01);const leg=new THREE.Group();leg.position.set(side*.105,.43,0);rig.add(leg);actorPart(leg,new THREE.CapsuleGeometry(.075,.3,4,8),cloth,0,-.22,0);actorPart(leg,new THREE.BoxGeometry(.14,.09,.25),armor,0,-.44,-.055);return{arm,leg};}
  const left=limb(-1),right=limb(1);group.userData={rig,leftArm:left.arm,rightArm:right.arm,leftLeg:left.leg,rightLeg:right.leg,model:'obsidian-operator'};return group;
}
function animatePlayer(dt){
  const moving=state.running&&['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d'].some(key=>state.keys.has(key)),sprinting=moving&&state.keys.has('Shift'),pace=sprinting?12:moving?8:2.2,swing=moving?(sprinting?.72:.48):.035;
  playerAnimationTime+=dt*pace;const cycle=Math.sin(playerAnimationTime),rig=playerMesh.userData.rig;rig.position.y=moving?Math.abs(Math.cos(playerAnimationTime*2))*(sprinting?.035:.022):Math.sin(playerAnimationTime)*.012;
  playerMesh.userData.leftArm.rotation.x=cycle*swing;playerMesh.userData.rightArm.rotation.x=-cycle*swing;playerMesh.userData.leftLeg.rotation.x=-cycle*swing*.75;playerMesh.userData.rightLeg.rotation.x=cycle*swing*.75;rig.rotation.z=moving?Math.sin(playerAnimationTime)*.018:Math.sin(playerAnimationTime*.5)*.006;
  renderer.domElement.dataset.playerAnimation=sprinting?'run':moving?'walk':'idle';
}
function visionCone(color=0xf05270){
  const geometry=new THREE.ConeGeometry(1.25,2.6,28,1,true,0,Math.PI*.32),mat=new THREE.MeshBasicMaterial({color,transparent:true,opacity:.18,side:THREE.DoubleSide,depthWrite:false});
  const cone=new THREE.Mesh(geometry,mat);cone.rotation.x=Math.PI/2;cone.position.y=.045;return cone;
}
function createCasinoTable(x,z){
  const top=mesh(new THREE.CylinderGeometry(.56,.56,.08,18),material(0x2a694f,{roughness:.4}),x,.22,z);top.scale.z=.64;
  const rim=mesh(new THREE.TorusGeometry(.55,.035,8,24),material(0xd5a83f,{metalness:.8,roughness:.25}),x,.27,z);rim.rotation.x=Math.PI/2;rim.scale.z=.64;
}
function createScene(canvas){
  renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.setSize(W,H,false);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
  scene=new THREE.Scene();scene.background=new THREE.Color(0x07050c);scene.fog=new THREE.Fog(0x080610,13,27);
  camera=new THREE.PerspectiveCamera(52,W/H,.1,80);camera.position.set(-7,5.8,9);camera.lookAt(-7,0,4);
  scene.add(new THREE.HemisphereLight(0x9d84d9,0x120b18,1.45));
  const sun=new THREE.DirectionalLight(0xffd586,2.1);sun.position.set(-5,12,5);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-12;sun.shadow.camera.right=12;sun.shadow.camera.top=10;sun.shadow.camera.bottom=-10;scene.add(sun);
  [[-6,2,0xa64cff],[0,-3,0xd7a93c],[6,2,0x4bb7ff]].forEach(([x,z,color])=>{const light=new THREE.PointLight(color,20,7,2);light.position.set(x,2.2,z);scene.add(light);});
  const floor=mesh(new THREE.PlaneGeometry(18,12,18,12),material(0x17101f,{metalness:.3,roughness:.5}),0,0,0);floor.rotation.x=-Math.PI/2;
  const grid=new THREE.GridHelper(18,18,0x4c3c5a,0x2b2135);grid.position.y=.012;grid.scale.z=12/18;scene.add(grid);
  walls.forEach(([x,y,w,h])=>{const center=world((x+w/2)*TILE,(y+h/2)*TILE,.75);mesh(new THREE.BoxGeometry(w,1.5,h),material(0x352743,{metalness:.35,roughness:.38}),center.x,center.y,center.z);});
  const routeGeometry=new THREE.BufferGeometry().setFromPoints(routePoints.map(([x,y])=>world(x,y,.035)));routeLine=new THREE.Line(routeGeometry,new THREE.LineBasicMaterial({color:0xf7ca57,transparent:true,opacity:.75}));scene.add(routeLine);
  createCasinoTable(-2.5,-2.5);createCasinoTable(-.5,2.8);createCasinoTable(3.1,2.5);
  playerMesh=createHeistOperator();
  terminalMesh=mesh(new THREE.BoxGeometry(.6,.8,.32),material(0x873dcc,{metalness:.55,roughness:.25,emissive:0x2b0a47}));
  vaultMesh=mesh(new THREE.CylinderGeometry(.55,.55,.32,28),material(0xa98a42,{metalness:.82,roughness:.24,emissive:0x2b2108}));vaultMesh.rotation.x=Math.PI/2;
  exitMesh=mesh(new THREE.TorusGeometry(.5,.1,10,28),material(0x4cbaf1,{metalness:.3,roughness:.3,emissive:0x12496a}));exitMesh.rotation.x=Math.PI/2;
  reset();clock=new THREE.Clock();
}
function reset(){
  Object.assign(state,{running:false,ended:false,player:{x:95,y:520,r:15},terminal:{x:130,y:115,done:false},vault:{x:725,y:145,open:false},exit:{x:790,y:520},lootValue:0,heat:12,time:180,interact:null,interactProgress:0,cameraDisabledUntil:0,last:0});state.keys.clear();
  cameraYaw=0;targetCameraYaw=0;lastMovementInput='';playerAnimationTime=0;
  state.loot=[{x:745,y:215,taken:false,value:220},{x:690,y:230,taken:false,value:260},{x:770,y:265,taken:false,value:340},{x:635,y:170,taken:false,value:180},{x:590,y:405,taken:false,value:140},{x:735,y:465,taken:false,value:170}];
  state.guards=[{x:295,y:180,dx:1,dy:0,min:265,max:420,axis:'x',speed:72},{x:555,y:130,dx:0,dy:1,min:95,max:345,axis:'y',speed:68},{x:330,y:465,dx:1,dy:0,min:115,max:610,axis:'x',speed:88},{x:760,y:390,dx:0,dy:1,min:340,max:510,axis:'y',speed:66}];
  state.cameras=[{x:175,y:310,angle:.2},{x:480,y:110,angle:1.1},{x:610,y:300,angle:2.7}];
  while(guardMeshes.length){scene.remove(guardMeshes.pop());}while(cameraMeshes.length){scene.remove(cameraMeshes.pop());}while(lootMeshes.length){scene.remove(lootMeshes.pop());}
  state.guards.forEach(guard=>{const actor=groupActor(0xd84968),cone=visionCone();actor.add(cone);cone.position.set(0,-.02,-1.15);guardMeshes.push(actor);});
  state.cameras.forEach(item=>{const group=new THREE.Group(),cameraBody=new THREE.Mesh(new THREE.BoxGeometry(.28,.18,.38),material(0xd85b80,{emissive:0x421020})),cone=visionCone();group.add(cameraBody,cone);cone.position.set(0,-.22,-1.15);scene.add(group);cameraMeshes.push(group);});
  state.loot.forEach(item=>{const coin=mesh(new THREE.CylinderGeometry(.13,.13,.06,18),material(0xf2c64d,{metalness:.85,roughness:.18,emissive:0x473406}));coin.rotation.x=Math.PI/2;lootMeshes.push(coin);});
  syncMeshes();snapCamera();updateHud();renderer.render(scene,camera);
}
function syncMeshes(){
  playerMesh.position.copy(world(state.player.x,state.player.y,0));terminalMesh.position.copy(world(state.terminal.x,state.terminal.y,.4));vaultMesh.position.copy(world(state.vault.x,state.vault.y,.55));exitMesh.position.copy(world(state.exit.x,state.exit.y,.08));
  renderer.domElement.dataset.playerX=String(state.player.x);renderer.domElement.dataset.playerY=String(state.player.y);renderer.domElement.dataset.playerModel=playerMesh.userData.model;renderer.domElement.dataset.cameraX=String(camera.position.x);renderer.domElement.dataset.cameraZ=String(camera.position.z);renderer.domElement.dataset.cameraYaw=String(cameraYaw);
  terminalMesh.material.color.setHex(state.terminal.done?0x43bd94:0x873dcc);vaultMesh.material.color.setHex(state.vault.open?0xe0b952:0x6b5b40);exitMesh.material.emissive.setHex(state.lootValue>=500?0x136e9b:0x152231);
  state.guards.forEach((guard,index)=>{const actor=guardMeshes[index],angle=guard.axis==='x'?(guard.dx>0?-Math.PI/2:Math.PI/2):(guard.dy>0?Math.PI:0);actor.position.copy(world(guard.x,guard.y,0));actor.rotation.y=angle;});
  state.cameras.forEach((item,index)=>{const actor=cameraMeshes[index];actor.position.copy(world(item.x,item.y,.55));actor.rotation.y=-item.angle-Math.PI/2;actor.visible=Date.now()>state.cameraDisabledUntil;});
  state.loot.forEach((item,index)=>{const coin=lootMeshes[index];coin.visible=state.vault.open&&!item.taken;coin.position.copy(world(item.x,item.y,.22));coin.rotation.z=performance.now()*.002+index;});
}
function updateHud(){
  const heat=clamp(Math.round(state.heat),0,100),minutes=Math.floor(state.time/60),seconds=Math.floor(state.time%60);$('#lootValue').textContent=state.lootValue.toLocaleString('zh-TW');$('#heatValue').textContent=`${heat}%`;$('#heatBar').style.width=`${heat}%`;$('#heatBar').style.background=heat<40?'#5ee5be':heat<70?'#f7ca57':'#f05270';$('#timeValue').textContent=`${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`;
  const objective=!state.terminal.done?'駭入保全終端':!state.vault.open?'開啟金庫':state.lootValue<500?'收集至少 500 分戰利品':'前往出口撤離';$('#objectiveLabel').textContent=objective;$('#objectiveTitle').textContent=objective;$('#objectiveText').textContent=!state.terminal.done?'沿金色地面路徑前往紫色保全終端。':!state.vault.open?'穿過中央走廊，前往右上方金庫。':state.lootValue<500?'靠近發光金幣拾取戰利品；守衛已加速。':'藍色出口已開放，立刻撤離即可保住分數。';$('#runRank').textContent=state.ended?rank():state.running?'行動中':'待命';
}
function rank(){if(state.lootValue>=1300&&state.heat<45)return'S';if(state.lootValue>=900)return'A';if(state.lootValue>=500)return'B';return'C';}
function move(dt){
  let horizontal=0,vertical=0;
  if(state.keys.has('ArrowUp')||state.keys.has('w'))vertical+=1;
  if(state.keys.has('ArrowDown')||state.keys.has('s'))vertical-=1;
  if(state.keys.has('ArrowLeft')||state.keys.has('a'))horizontal-=1;
  if(state.keys.has('ArrowRight')||state.keys.has('d'))horizontal+=1;
  if(!horizontal&&!vertical){lastMovementInput='';return;}
  const movementInput=`${horizontal}:${vertical}`;
  if(movementInput!==lastMovementInput){camera.getWorldDirection(movementForward);movementForward.y=0;movementForward.normalize();movementRight.crossVectors(movementForward,camera.up).normalize();movementDirection.copy(movementForward).multiplyScalar(vertical).addScaledVector(movementRight,horizontal).normalize();targetCameraYaw=Math.atan2(movementDirection.x,movementDirection.z);lastMovementInput=movementInput;}
  const sprint=state.keys.has('Shift'),speed=(sprint?215:145)*dt,x=movementDirection.x*speed,y=movementDirection.z*speed;
  const nextX=state.player.x+x,nextY=state.player.y+y;if(!blocked(nextX,state.player.y))state.player.x=nextX;if(!blocked(state.player.x,nextY))state.player.y=nextY;
  playerMesh.rotation.y=targetCameraYaw+Math.PI;if(sprint)state.heat=clamp(state.heat+dt*1.7,0,100);
}
function updateGuards(dt){state.guards.forEach(guard=>{if(guard.axis==='x'){guard.x+=guard.dx*guard.speed*dt;if(guard.x<guard.min||guard.x>guard.max){guard.dx*=-1;guard.x=clamp(guard.x,guard.min,guard.max);}}else{guard.y+=guard.dy*guard.speed*dt;if(guard.y<guard.min||guard.y>guard.max){guard.dy*=-1;guard.y=clamp(guard.y,guard.min,guard.max);}}});}
function detect(){let danger=0;state.guards.forEach(guard=>{const d=distance(state.player,guard),direction=guard.axis==='x'?(guard.dx>0?0:Math.PI):(guard.dy>0?Math.PI/2:-Math.PI/2),playerAngle=Math.atan2(state.player.y-guard.y,state.player.x-guard.x),difference=Math.abs(Math.atan2(Math.sin(playerAngle-direction),Math.cos(playerAngle-direction)));if(d<42)danger+=1.9;if(d<125&&difference<.38)danger+=.28;});if(Date.now()>state.cameraDisabledUntil)state.cameras.forEach(item=>{const d=distance(state.player,item),playerAngle=Math.atan2(state.player.y-item.y,state.player.x-item.x),difference=Math.abs(Math.atan2(Math.sin(playerAngle-item.angle),Math.cos(playerAngle-item.angle)));if(d<145&&difference<.39)danger+=.18;});if(danger){state.heat=clamp(state.heat+danger,0,100);if(state.heat>=100)end(false,'你被保全包圍了');}}
function checkLoot(){if(!state.vault.open)return;state.loot.forEach(item=>{if(!item.taken&&near(item,28)){item.taken=true;state.lootValue+=item.value;state.heat=clamp(state.heat+5,0,100);toast(`取得 ${item.value} 分戰利品`);}});}
function setInteractTarget(){if(!state.running||state.ended)return null;if(!state.terminal.done&&near(state.terminal))return{type:'terminal',title:'保全終端',text:'按住互動駭入，攝影機將停擺 18 秒。'};if(state.terminal.done&&!state.vault.open&&near(state.vault,46))return{type:'vault',title:'黑曜金庫',text:'按住互動解鎖金庫，守衛會加速。'};if(state.vault.open&&state.lootValue>=500&&near(state.exit,44))return{type:'exit',title:'撤離出口',text:'按住互動，帶著本局戰利品撤離。'};return null;}
function showInteract(){const target=setInteractTarget(),button=$('#interactButton'),card=$('#interactCard');state.interact=target;button.disabled=!target;if(!target){card.hidden=true;return;}card.hidden=false;$('#interactTitle').textContent=target.title;$('#interactText').textContent=target.text;}
function cancelInteract(){state.interactProgress=0;$('#interactProgress').style.width='0%';}
function finishInteract(){const target=state.interact;if(!target)return;if(target.type==='terminal'){state.terminal.done=true;state.cameraDisabledUntil=Date.now()+18000;state.heat=clamp(state.heat-12,0,100);toast('攝影機已停擺 18 秒');}if(target.type==='vault'){state.vault.open=true;state.heat=clamp(state.heat+20,0,100);state.guards.forEach(guard=>guard.speed+=20);toast('金庫已開啟，快拿戰利品！');}if(target.type==='exit')end(true,'成功撤離');cancelInteract();}
function updateInteraction(dt){showInteract();if(!state.interact||!state.keys.has(' ')||!state.running){if(!state.keys.has(' '))cancelInteract();return;}state.interactProgress+=dt/(state.interact.type==='exit'?1:1.5);$('#interactProgress').style.width=`${clamp(state.interactProgress*100,0,100)}%`;if(state.interactProgress>=1)finishInteract();}
function cameraTarget(){return world(state.player.x,state.player.y,0);}
function angleDelta(from,to){return Math.atan2(Math.sin(to-from),Math.cos(to-from));}
function cameraDesired(){const target=cameraTarget();cameraFacing.set(Math.sin(cameraYaw),0,Math.cos(cameraYaw));return target.clone().addScaledVector(cameraFacing,-3.8).add(new THREE.Vector3(0,5.8,0)).clamp(new THREE.Vector3(-7.75,1,-4.75),new THREE.Vector3(7.75,8,4.75));}
function pointCamera(target){cameraFacing.set(Math.sin(cameraYaw),0,Math.cos(cameraYaw));cameraLookAt.copy(target).addScaledVector(cameraFacing,.35);camera.lookAt(cameraLookAt.x,cameraLookAt.y+.28,cameraLookAt.z);}
function snapCamera(){const target=cameraTarget();cameraYaw=targetCameraYaw;camera.position.copy(cameraDesired());pointCamera(target);}
function updateCamera(dt){const target=cameraTarget(),turnEase=1-Math.pow(.38,dt),followEase=1-Math.pow(.06,dt);cameraYaw+=angleDelta(cameraYaw,targetCameraYaw)*turnEase;camera.position.lerp(cameraDesired(),followEase);pointCamera(target);}
function end(success,message){state.running=false;state.ended=true;cancelAnimationFrame(animation);const overlay=$('#gameOverlay');overlay.hidden=false;overlay.innerHTML=`<span class="eyebrow">${success?'3D EXTRACTION COMPLETE':'RUN LOST'}</span><h1>${success?'成功撤離':'行動失敗'}</h1><p>${message}<br>本局戰利品：${state.lootValue.toLocaleString('zh-TW')} 分　警戒：${Math.round(state.heat)}%　評等：${success?rank():'—'}<br>獨立練習成績，不會改變 Discord 帳號。</p><button id="restartGame" type="button">再來一局 <span>↻</span></button>`;$('#restartGame').onclick=()=>{reset();overlay.hidden=true;start();};updateHud();}
function loop(){if(!state.running)return;const dt=Math.min(.05,clock.getDelta());state.time-=dt;if(state.time<=0){end(false,'警方封鎖了所有出口');return;}move(dt);animatePlayer(dt);updateGuards(dt);detect();checkLoot();updateInteraction(dt);updateCamera(dt);syncMeshes();updateHud();renderer.render(scene,camera);animation=requestAnimationFrame(loop);}
function start(){state.running=true;state.ended=false;clock.start();toast('3D 行動開始：沿金色路徑前進');animation=requestAnimationFrame(loop);}
function bindControls(){
  document.addEventListener('keydown',event=>{if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d','Shift',' '].includes(event.key)){event.preventDefault();state.keys.add(event.key);}});document.addEventListener('keyup',event=>state.keys.delete(event.key));
  const pressDirection=(direction,down)=>{const key={up:'ArrowUp',down:'ArrowDown',left:'ArrowLeft',right:'ArrowRight'}[direction];down?state.keys.add(key):state.keys.delete(key);};
  document.querySelectorAll('[data-direction]').forEach(button=>{const direction=button.dataset.direction;['pointerdown','touchstart'].forEach(type=>button.addEventListener(type,event=>{event.preventDefault();pressDirection(direction,true);}));['pointerup','pointercancel','pointerleave','touchend'].forEach(type=>button.addEventListener(type,event=>{event.preventDefault();pressDirection(direction,false);}));});
  ['pointerdown','touchstart'].forEach(type=>$('#sprintButton').addEventListener(type,event=>{event.preventDefault();state.keys.add('Shift');}));['pointerup','pointercancel','pointerleave','touchend'].forEach(type=>$('#sprintButton').addEventListener(type,event=>{event.preventDefault();state.keys.delete('Shift');}));['pointerdown','touchstart'].forEach(type=>$('#interactButton').addEventListener(type,event=>{event.preventDefault();state.keys.add(' ');}));['pointerup','pointercancel','pointerleave','touchend'].forEach(type=>$('#interactButton').addEventListener(type,event=>{event.preventDefault();state.keys.delete(' ');cancelInteract();}));
  $('#startGame').onclick=()=>{$('#gameOverlay').hidden=true;start();};$('#helpButton').onclick=()=>{$('#helpSheet').classList.add('open');$('#helpSheet').setAttribute('aria-hidden','false');};$('#closeHelp').onclick=()=>{$('#helpSheet').classList.remove('open');$('#helpSheet').setAttribute('aria-hidden','true');};const session=new URLSearchParams(location.search).get('session');if(session)$('#backToGame').href=`/game?session=${encodeURIComponent(session)}`;
}
export async function start3DHeist(){const canvas=$('#heistCanvas');createScene(canvas);bindControls();renderer.render(scene,camera);}
