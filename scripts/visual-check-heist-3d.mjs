import { readFileSync, mkdirSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import { createRequire } from 'node:module';

const root=resolve(import.meta.dirname,'..'),publicRoot=resolve(root,'activity','public');
const outputRoot=resolve(process.argv[2]||root,'heist-3d-check');
mkdirSync(outputRoot,{recursive:true});
const require=createRequire('C:/Users/kris/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');
const {chromium}=require('playwright');
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml'};
function localFile(pathname){const relative=pathname==='/heist'?'heist.html':pathname.replace(/^\/+/,''),file=resolve(publicRoot,relative);if(!file.startsWith(publicRoot))throw new Error('invalid path');return file;}
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',args:['--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist'],timeout:15_000});
try{
  for(const sample of [{name:'mobile',viewport:{width:390,height:844}},{name:'desktop',viewport:{width:1280,height:900}}]){
    const page=await browser.newPage({viewport:sample.viewport,deviceScaleFactor:1});
    page.setDefaultTimeout(15_000);const errors=[];
    page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
    await page.route('https://visual.local/**',async route=>{const url=new URL(route.request().url());try{const file=localFile(url.pathname);return route.fulfill({status:200,contentType:mime[extname(file)]||'application/octet-stream',body:readFileSync(file)});}catch{return route.fulfill({status:404,body:'not found'});}});
    await page.goto('https://visual.local/heist',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>document.querySelector('#renderMode')?.textContent==='3D 模式',{timeout:15_000});
    await page.click('#startGame');await page.waitForTimeout(120);
    const position=()=>page.evaluate(()=>{const canvas=document.querySelector('#heistCanvas');return{x:Number(canvas?.dataset.playerX),y:Number(canvas?.dataset.playerY),cameraX:Number(canvas?.dataset.cameraX),cameraZ:Number(canvas?.dataset.cameraZ),cameraYaw:Number(canvas?.dataset.cameraYaw)};});
    const before=await position();await page.keyboard.down('ArrowUp');await page.waitForTimeout(120);await page.keyboard.up('ArrowUp');const afterUp=await position();
    await page.keyboard.down('ArrowRight');await page.waitForTimeout(180);await page.keyboard.up('ArrowRight');const afterRight=await position();await page.waitForTimeout(1000);
    const report=await page.evaluate(()=>({mode:document.querySelector('#renderMode')?.textContent,webgl:Boolean(document.querySelector('#heistCanvas')?.getContext('webgl2')),overlayHidden:document.querySelector('#gameOverlay')?.hidden,body:document.body.scrollWidth,viewport:document.documentElement.clientWidth}));
    const cameraMoved=Math.abs(afterRight.cameraX-before.cameraX)>.01||Math.abs(afterRight.cameraZ-before.cameraZ)>.01,cameraTurnGentle=Math.abs(afterRight.cameraYaw)>.01&&Math.abs(afterRight.cameraYaw)<.45;
    report.controls={before,afterUp,afterRight,screenUp:afterUp.y>before.y,screenRight:afterRight.x<afterUp.x,cameraMoved,cameraTurnGentle};
    await page.screenshot({path:resolve(outputRoot,`${sample.name}.png`),fullPage:true});
    console.log(`${sample.name}: ${JSON.stringify({...report,errors})}`);
    if(report.mode!=='3D 模式'||!report.webgl||!report.overlayHidden||report.body>report.viewport||!report.controls.screenUp||!report.controls.screenRight||!report.controls.cameraMoved||!report.controls.cameraTurnGentle||errors.length)throw new Error(`${sample.name} visual check failed`);
    await page.close();
  }
  console.log(`3D heist visual checks saved to ${outputRoot}`);
}finally{await browser.close();}
