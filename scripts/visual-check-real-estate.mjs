import { readFileSync, mkdirSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import { createRequire } from 'node:module';

const root=resolve(import.meta.dirname,'..'),publicRoot=resolve(root,'activity','public'),assetRoot=resolve(root,'assets');
const outputRoot=resolve(process.argv[2]||root,'real-estate-art-check');mkdirSync(outputRoot,{recursive:true});
const require=createRequire('C:/Users/kris/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');
const {chromium}=require('playwright');
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.webp':'image/webp'};
const tiles=Array.from({length:144},(_,index)=>({x:index%12,y:Math.floor(index/12),type:'grass',level:0,occupancy:0}));
const set=(x,y,type,level=1,occupancy=0)=>Object.assign(tiles[y*12+x],{type,level,occupancy});
for(let x=1;x<11;x++)set(x,6,'road',0);for(let y=2;y<11;y++)set(5,y,'road',0);
set(4,5,'residential',3,90);set(6,5,'commercial',2,45);set(4,7,'industrial',2,45);set(6,7,'power');set(7,5,'park');set(3,5,'residential',1,12);set(7,7,'commercial',1,16);
set(1,5,'residential',1,22);set(2,5,'residential',1,24);set(9,5,'commercial',1,28);set(3,7,'industrial',2,32);set(8,5,'park');
const tools=['road','residential','commercial','industrial','power','park','bulldoze'].map((id,index)=>({id,name:['道路','住宅區','商業區','工業區','發電站','城市公園','拆除'][index],icon:['🛣️','🏠','🏬','🏭','⚡','🌳','🚧'][index],cost:[25000,120000,200000,280000,2500000,450000,10000][index],description:'城市建設工具'}));
const payload={ok:true,player:{name:'KRIS',avatar:'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>',balance:8688128159},city:{size:12,tiles,stats:{population:102,jobs:95,happiness:82,powerDemand:6,powerSupply:30,level:3,developed:5,zones:6,roads:18,parks:1},tools,unclaimedTax:428600,nextTickAt:Date.now()+180000},plots:Array.from({length:6},(_,index)=>({no:index+1,name:`城市地標 ${index+1}`,price:index?5000000:0,district:'金光海灣',phase:index?'locked':'vacant',totalCollected:0})),buildings:[],homeUrl:'#'};
function localFile(pathname){if(pathname.startsWith('/assets/'))return resolve(assetRoot,pathname.slice(8));const relative=pathname==='/real-estate'?'real-estate.html':pathname.replace(/^\/+/,''),file=resolve(publicRoot,relative);if(!file.startsWith(publicRoot))throw new Error('invalid path');return file;}
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',timeout:15_000});
try{
  for(const sample of [{name:'mobile',viewport:{width:390,height:844}},{name:'desktop',viewport:{width:1280,height:900}}]){
    const page=await browser.newPage({viewport:sample.viewport,deviceScaleFactor:1});const errors=[];
    page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
    await page.route('https://visual.local/**',async route=>{const url=new URL(route.request().url());if(url.pathname==='/api/real-estate')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(payload)});try{const file=localFile(url.pathname);return route.fulfill({status:200,contentType:mime[extname(file)]||'application/octet-stream',body:readFileSync(file)});}catch{return route.fulfill({status:404,body:'not found'});}});
    await page.goto('https://visual.local/real-estate?session=mock',{waitUntil:'networkidle'});await page.waitForSelector('.tile-art');
    const report=await page.evaluate(()=>({art:document.querySelectorAll('.tile-art').length,sources:[...new Set([...document.querySelectorAll('.tile-art')].map(image=>image.getAttribute('src')))],mapBackground:getComputedStyle(document.querySelector('.metro-viewport')).backgroundImage.includes('map-background.webp'),hall:Boolean(document.querySelector('.city-hall-art')?.complete),loading:document.querySelector('#loading')?.hidden,body:document.body.scrollWidth,viewport:document.documentElement.clientWidth}));
    await page.screenshot({path:resolve(outputRoot,`${sample.name}.png`),fullPage:true});
    console.log(`${sample.name}: ${JSON.stringify({...report,errors})}`);if(report.art<12||report.sources.length<10||!report.mapBackground||!report.hall||!report.loading||report.body>report.viewport||errors.length)throw new Error(`${sample.name} visual check failed`);await page.close();
  }
  console.log(`City art visual checks saved to ${outputRoot}`);
}finally{await browser.close();}
