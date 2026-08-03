import { readFileSync, mkdirSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import { createRequire } from 'node:module';

const root=resolve(import.meta.dirname,'..'),publicRoot=resolve(root,'activity','public');
const outputRoot=resolve(process.argv[2]||root,'character-style-check');
mkdirSync(outputRoot,{recursive:true});
const require=createRequire('C:/Users/kris/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');
const { chromium }=require('playwright');
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml'};
const characterImage='/appearance/characters/casino-host.png',backgroundImage='/appearance/backgrounds/casino-king.png';
const styleImage='/appearance/characters/transport-commander.png';
const characters=[
  {id:'casino_character',name:'黑金首席荷官',theme:'賭場之王',owned:true,baseImage:characterImage,styles:[{id:'base:casino_character',name:'經典造型',image:characterImage,base:true,active:true},{id:'summer',name:'夏日限定完整造型',image:styleImage,base:false,active:true}]},
  {id:'transport_character',name:'銀翼運輸指揮官',theme:'交通帝國',owned:true,baseImage:styleImage,styles:[{id:'base:transport_character',name:'經典造型',image:styleImage,base:true,active:true}]},
  {id:'heist_character',name:'無聲夜行者',theme:'夜行特務',owned:false,baseImage:'/appearance/characters/night-agent.png',styles:[{id:'base:heist_character',name:'經典造型',image:'/appearance/characters/night-agent.png',base:true,active:true}]}
];
const playerPayload={ok:true,player:{name:'KRIS',avatar:characterImage},characters,equipped:{characterId:'casino_character',styleId:'base:casino_character'},backgroundImage,homeUrl:'https://visual.local/game?session=home-test',expiresAt:Date.now()+15*60*1000};
const adminPayload={ok:true,admin:{name:'KRIS',avatar:characterImage},characters:characters.map(character=>({...character,styles:character.styles.filter(style=>!style.base)})),expiresAt:Date.now()+15*60*1000,limits:{maxBytes:8*1024*1024,types:['image/png','image/jpeg','image/webp']}};

function localFile(pathname) {
  const routes={'/appearance':'style.html','/appearance-admin':'appearance-admin.html'};
  const relative=routes[pathname]||pathname.replace(/^\/+/,''),file=resolve(publicRoot,relative);
  if(!file.startsWith(publicRoot)) throw new Error('invalid path');
  return file;
}

const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',timeout:10_000});
try {
  for(const sample of [
    {name:'player-mobile',url:'/appearance?session=test',payload:playerPayload,viewport:{width:390,height:844}},
    {name:'admin-desktop',url:'/appearance-admin?session=test',payload:adminPayload,viewport:{width:1440,height:1000}}
  ]) {
    const page=await browser.newPage({viewport:sample.viewport,deviceScaleFactor:1});
    page.setDefaultTimeout(5_000);
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('console',message=>{if(message.type()==='error') errors.push(message.text());});
    await page.route('https://visual.local/**',async route=>{
      const url=new URL(route.request().url());
      if(url.pathname.startsWith('/api/')) return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(sample.payload)});
      try {const file=localFile(url.pathname);return route.fulfill({status:200,contentType:mime[extname(file)]||'application/octet-stream',body:readFileSync(file)});} catch {return route.fulfill({status:404,body:'not found'});}
    });
    await page.goto(`https://visual.local${sample.url}`,{waitUntil:'domcontentloaded'});
    await page.waitForTimeout(800);
    await page.screenshot({path:resolve(outputRoot,`${sample.name}.png`),fullPage:true});
    const overflow=await page.evaluate(()=>({body:document.body.scrollWidth,viewport:document.documentElement.clientWidth,loading:!document.querySelector('#loading')?.classList.contains('hidden')}));
    console.log(`${sample.name}: ${JSON.stringify({...overflow,errors})}`);
    if(overflow.body>overflow.viewport||overflow.loading||errors.length) throw new Error(`${sample.name} visual check failed: ${JSON.stringify({...overflow,errors})}`);
    await page.close();
  }
  console.log(`Character style visual checks saved to ${outputRoot}`);
} finally {
  await Promise.race([browser.close(),new Promise(resolve=>setTimeout(resolve,2_000))]);
}
