import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { summarizeWebAssets } from '../src/game-data/web-game.js';

const source=readFileSync(new URL('../src/index.js',import.meta.url),'utf8');
const cosmeticsSource=readFileSync(new URL('../src/game-data/cosmetics.js',import.meta.url),'utf8');
const webGameDataSource=readFileSync(new URL('../src/game-data/web-game.js',import.meta.url),'utf8');

test('玩家轉帳移除自訂上限但保留安全規則',()=>{
  assert.doesNotMatch(source,/PLAYER_TRANSFER_MAX/);
  assert.match(source,/Number\.isSafeInteger\(amount\)\|\|amount<1/);
  assert.match(source,/Number\.isSafeInteger\(totalCharged\)/);
  assert.match(source,/PLAYER_TRANSFER_FEE_RATE = 0\.02/);
  assert.match(source,/PLAYER_TRANSFER_MIZI_CHANCE = 0\.05/);
  assert.match(source,/PLAYER_TRANSFER_EXTRA_ZERO_CHANCE = 0\.05/);
  assert.match(source,/casinoVaultBalance\(g\)>=extraFromVault/);
  assert.match(source,/setName\('金額'\).*setMinValue\(1\)\.setAutocomplete\(true\)/s);
});

test('13 個新成就與稱號完整註冊',()=>{
  const achievementIds=[
    'transfer_tycoon','mizi_nemesis','too_many_zeroes','gravity_defier','casino_decathlon',
    'justice_served','airline_mogul','best_partner','rise_again','perfect_crime',
    'pomeranian_target','hao_camera','jail_housekeeper'
  ];
  const titleIds=[
    'transfer_mogul','mizi_hunter','extra_zero_god','tower_top','casino_all_rounder',
    'macau_sheriff','sky_overlord','pet_godfather','comeback_king','shadow_thief',
    'pomeranian_toy','hao_photographer','jail_keeper'
  ];
  for(const id of achievementIds) assert.match(source,new RegExp(`id:'${id}'`),`缺少成就 ${id}`);
  for(const id of titleIds) {
    assert.match(source,new RegExp(`${id}:'`),`缺少稱號 ${id}`);
    assert.match(source,new RegExp(`value:'${id}'`),`稱號 ${id} 未加入斜線指令`);
  }
  const titleChoiceBlock=source.match(/const playerTitleChoices=\[[\s\S]+?\n\];/)?.[0]||'';
  assert.ok(titleChoiceBlock);
  assert.ok((titleChoiceBlock.match(/\{name:/g)||[]).length<=25,'Discord 稱號選項不可超過 25 個');
  assert.match(source,/setName\('玩家'\)[\s\S]+setName\('稱號'\)[\s\S]+addChoices\(\.\.\.playerTitleChoices\)/);
  const adminTitleStart=source.indexOf("setName('稱號設定')");
  const adminTitleEnd=source.indexOf("setName('搶劫公告頻道')",adminTitleStart);
  const adminTitleBlock=adminTitleStart>=0&&adminTitleEnd>adminTitleStart?source.slice(adminTitleStart,adminTitleEnd):'';
  assert.ok(adminTitleBlock,'管理員稱號設定必須使用 autocomplete，避免超過 Discord 25 個選項限制');
  assert.match(adminTitleBlock,/setAutocomplete\(true\)/);
  assert.doesNotMatch(adminTitleBlock,/addChoices\(/);
  assert.match(source,/process\.env\.COMMAND_BUILD_ONLY==='1'/);
});

test('玩家常用功能整合為主指令並移除重複舊指令',()=>{
  const start=source.indexOf('const commands = ['),end=source.indexOf('].map(c=>c.toJSON());',start);
  const commandBlock=start>=0&&end>start?source.slice(start,end):'';
  assert.ok(commandBlock,'缺少 Discord 指令定義');
  for(const hub of ['玩家','日常','補給','寵物','小遊戲','交通事業']) {
    assert.match(commandBlock,new RegExp(`new SlashCommandBuilder\\(\\)\\.setName\\('${hub}'\\)`),`缺少整合入口 /${hub}`);
  }
  const removed=[
    '金庫','個人資料','成就','稱號','每日增益','體力','每日回體力','每日',
    '商城','背包','購買','使用','寵物店','我的寵物','機場',
    '比大小','射龍門','賽馬','競速','寵物競賽','競速pvp','寵物競速pvp','骰盅吹牛',
    '大老二','角子機','幸運輪盤','大樂透','賓果','刮刮樂','麻將','決鬥'
  ];
  for(const name of removed) {
    assert.doesNotMatch(commandBlock,new RegExp(`new SlashCommandBuilder\\(\\)\\.setName\\('${name}'\\)`),`舊指令 /${name} 仍在註冊`);
  }
  assert.match(source,/玩家:\{金庫:'金庫',資料:'個人資料',成就:'成就',造型:'個人造型',遊戲:'網頁遊戲',稱號:'稱號'\}/);
  assert.match(source,/日常:\{領取:'每日',增益:'每日增益',體力:'體力',回體力:'每日回體力'\}/);
  assert.match(source,/補給:\{商城:'商城',背包:'背包',購買:'購買',使用:'使用'\}/);
  assert.match(source,/寵物:\{商店:'寵物店',我的:'我的寵物'\}/);
  for(const game of ['打靶','比大小','射龍門','賽馬','競速','寵物競賽','競速pvp','寵物競速pvp','骰盅吹牛','大老二','角子機','幸運輪盤','大樂透','賓果','刮刮樂','麻將','決鬥']) {
    assert.match(source,new RegExp(`command:'${game}'`),`/${game} 移除後未保留在小遊戲選單`);
  }
  assert.match(source,/miniGameProxyInteraction\(i,game\.command/);
});

test('角色造型系統使用完整圖片並提供管理員上傳後台',()=>{
  const html=readFileSync(new URL('../activity/public/style.html',import.meta.url),'utf8');
  const css=readFileSync(new URL('../activity/public/style.css',import.meta.url),'utf8');
  const js=readFileSync(new URL('../activity/public/style.js',import.meta.url),'utf8');
  const adminHtml=readFileSync(new URL('../activity/public/appearance-admin.html',import.meta.url),'utf8');
  const adminJs=readFileSync(new URL('../activity/public/appearance-admin.js',import.meta.url),'utf8');
  assert.match(source,/from '\.\/game-data\/cosmetics\.js'/);
  assert.match(source,/CREATE TABLE IF NOT EXISTS character_styles/);
  assert.match(source,/CREATE TABLE IF NOT EXISTS player_character_styles/);
  assert.match(source,/const CHARACTER_STYLE_SYSTEM_ENABLED/);
  assert.match(source,/const CHARACTER_STYLE_ROOT=resolve\(process\.cwd\(\),'data','appearance-styles'\)/);
  assert.match(source,/function uploadCharacterStyle/);
  assert.match(source,/function decodeCharacterStyleImage/);
  assert.match(source,/8\*1024\*1024/);
  assert.match(source,/image\/png.*image\/jpeg.*image\/webp/s);
  assert.match(source,/appearanceActivityToken\(guildId,userId,channelId\)/);
  assert.match(source,/kind:'appearance_admin'.*exp:Date\.now\(\)\+15\*60\*1000/s);
  assert.match(source,/member\.permissions\.has\(PermissionFlagsBits\.Administrator\)/);
  assert.match(source,/setName\('造型後台'\).*setDefaultMemberPermissions\(PermissionFlagsBits\.Administrator\)/s);
  assert.match(source,/\/activity\/appearance\/select/);
  assert.match(source,/\/activity\/appearance-admin\/upload/);
  assert.match(source,/\/activity\/appearance-admin\/active/);
  assert.match(source,/舊版分層換裝系統已取消/);
  for(const id of ['backButton','homeButton','characterTabs','styleGrid','characterImage','equip']) assert.match(html,new RegExp(`id="${id}"`));
  for(const id of ['characterSelect','styleName','styleFile','uploadButton','styleGrid']) assert.match(adminHtml,new RegExp(`id="${id}"`));
  assert.doesNotMatch(html,/previewOutfit|previewHeadwear|removeSlot|preset/);
  assert.match(css,/\.style-card/);
  assert.match(js,/\/api\/appearance\/select/);
  assert.match(source,/homeUrl:gameActivityUrl\(g,u,session\.channelId\)/);
  assert.match(js,/history\.length>1\)history\.back\(\)/);
  assert.match(js,/location\.assign\(state\.data\.homeUrl\)/);
  assert.match(adminJs,/\/api\/appearance-admin\/upload/);
  assert.match(adminJs,/\/api\/appearance-admin\/active/);
});

test('靶場打靶可先選擇自有槍枝並以精準度影響安全獎勵',()=>{
  assert.match(source,/\{id:'target_shooting',command:'打靶',label:'靶場打靶'/);
  assert.match(source,/CREATE TABLE IF NOT EXISTS target_shooting_records/);
  assert.match(source,/const TARGET_SHOOTING_STAMINA_COST=8/);
  assert.match(source,/const TARGET_SHOOTING_COOLDOWN_MS=10\*60\*1000/);
  const choices=source.match(/function targetShootingWeaponEntries\(g,u\) \{[\s\S]+?\n\}/)?.[0]||'';
  assert.match(choices,/assetQuantity\(g,u,weapon\.assetId\)<1/);
  assert.match(choices,/range_pistol/,'沒有自有槍枝時仍可借用靶場手槍');
  const resultBlock=source.match(/function targetShootingResult\(accuracy,random=Math\.random,rewardMultiplier=1\) \{[\s\S]+?\n\}/)?.[0]||'';
  const resolveResult=new Function(`${resultBlock}; return targetShootingResult;`)();
  assert.deepEqual(resolveResult(50,()=>0,1.25),{hit:true,ring:'紅心靶',score:10,reward:2000});
  assert.deepEqual(resolveResult(50,()=>0.99),{hit:false,ring:'脫靶',score:0,reward:0});
  assert.match(source,/target_shooting_weapon:/);
  assert.match(source,/target_shooting_start:/);
  assert.match(source,/target_shooting_aim:/);
  assert.match(source,/function targetShootingTargets\(random=Math\.random\)/);
  assert.match(source,/session\.round<3/);
  assert.match(source,/targetRound!==session\.round/,'舊回合按鈕不能重複射擊');
  assert.match(source,/weapon\.owned&&assetQuantity\(i\.guildId,i\.user\.id,weapon\.weaponId\)<1/);
  assert.match(source,/consumeStamina\(i\.guildId,i\.user\.id,cost\)/);
  assert.match(source,/changeBalance\(i\.guildId,i\.user\.id,session\.totalReward,'payout'/);
  assert.match(source,/靶場訓練不消耗彈藥/);
  const update=JSON.parse(readFileSync(new URL('../updates/2026-08-05-target-shooting.json',import.meta.url),'utf8'));
  assert.match(update.summary,/打靶/);
  assert.ok(update.changes.some(change=>change.includes('自有槍枝')));
});

test('人物大廳六名全身角色使用透明 PNG 並加入商城',()=>{
  const characters=['casino-host.png','transport-commander.png','night-agent.png','pomeranian-captain.png','garage-director.png','rail-president.png'];
  for(const file of characters) {
    const url=new URL(`../activity/public/appearance/characters/${file}`,import.meta.url),data=readFileSync(url);
    assert.ok(existsSync(url),`缺少全身角色 ${file}`);
    assert.ok(data.length>500_000,`${file} 不是完整角色素材`);
    assert.equal(data[25],6,`${file} 必須是具有 alpha 通道的 RGBA PNG`);
  }
  for(const id of ['casino_character','transport_character','heist_character','pomeranian_character','garage_character','rail_character']) assert.match(cosmeticsSource,new RegExp(`id:'${id}',slot:'character'`));
  assert.match(source,/setThumbnail\(`\$\{ACTIVITY_PUBLIC_URL\}\/appearance\/characters\/\$\{character\.image\}`\)/);
});

test('四套造型以 16 張透明穿戴素材取代 Emoji 疊圖',()=>{
  for(const theme of ['casino','transport','heist','pomeranian']) for(const slot of ['outfit','headwear','face','handheld']) {
    const file=theme==='heist'&&slot==='headwear'?'headwear-open':theme==='heist'&&slot==='face'?'face-open':slot;
    const url=new URL(`../activity/public/appearance/wearables/${theme}/${file}.png`,import.meta.url),data=readFileSync(url);
    assert.ok(existsSync(url),`缺少正式穿戴素材 ${theme}/${file}.png`);
    assert.ok(data.length>20_000,`${theme}/${file}.png 不是有效素材`);
    assert.equal(data[25],6,`${theme}/${file}.png 必須是 RGBA PNG`);
    assert.match(cosmeticsSource,new RegExp(`slot:'${slot}'[^\\n]+image:'${theme}/${file}\\.png'`));
  }
  assert.match(cosmeticsSource,/export const COSMETIC_SLOTS=\['character','background','outfit','headwear','face','handheld','aura'\]/);
});

test('四張個人造型主題背景已加入網站素材',()=>{
  for(const file of ['casino-king.png','transport-mogul.png','night-heist.png','pomeranian-air.png']) {
    const url=new URL(`../activity/public/appearance/backgrounds/${file}`,import.meta.url);
    assert.ok(existsSync(url),`缺少造型背景 ${file}`);
    assert.ok(readFileSync(url).length>100_000,`${file} 不是有效的完整圖片素材`);
  }
  assert.match(source,/\/appearance':'style\.html'/);
  assert.match(source,/\/appearance\/backgrounds\/\$\{background\.image\}/);
});

test('網站版個人造型更新公告完整',()=>{
  const update=JSON.parse(readFileSync(new URL('../updates/2026-08-02-appearance-web-v1.json',import.meta.url),'utf8'));
  const text=[update.title,update.summary,...update.changes].join('\n');
  assert.equal(update.version,'2026.08.02.4');
  assert.deepEqual(update.channelNames,['賭場公告']);
  for(const required of ['/玩家 造型','24 件','3 組','發布','不會提供能力加成']) assert.match(text,new RegExp(required.replace('/','\\/')));
});

test('人物展示大廳更新公告完整',()=>{
  const update=JSON.parse(readFileSync(new URL('../updates/2026-08-02-appearance-lobby-v2.json',import.meta.url),'utf8'));
  const text=[update.title,update.summary,...update.changes].join('\n');
  assert.equal(update.version,'2026.08.02.5');
  assert.deepEqual(update.channelNames,['賭場公告']);
  for(const required of ['人物展示大廳','4 名','全身角色','28 件','原有衣櫃']) assert.match(text,new RegExp(required));
});

test('網頁遊戲第一版拆分資料模組並提供安全玩家大廳',()=>{
  const html=readFileSync(new URL('../activity/public/game.html',import.meta.url),'utf8');
  const css=readFileSync(new URL('../activity/public/game.css',import.meta.url),'utf8');
  const js=readFileSync(new URL('../activity/public/game.js',import.meta.url),'utf8');
  assert.match(source,/from '\.\/game-data\/web-game\.js'/);
  assert.match(webGameDataSource,/WEB_GAME_VERSION='2026\.08\.03\.3'/);
  for(const id of ['appearance','transport','garage','vehicle-pvp','assets','achievements','mahjong','casino']) assert.match(webGameDataSource,new RegExp(`id:'${id}'`));
  assert.match(source,/kind:'game'.*exp:Date\.now\(\)\+30\*60\*1000/);
  assert.match(source,/function parseGameActivityToken\(token\)/);
  assert.match(source,/session\.kind!=='game'/);
  assert.match(source,/\/game':'game\.html'/);
  assert.match(source,/url\.pathname==='\/activity\/game'/);
  assert.match(source,/url\.pathname==='\/activity\/game\/stamina-restore'/);
  assert.match(source,/setName\('遊戲'\)\.setDescription\('開啟網頁遊戲大廳與個人經營總覽'\)/);
  assert.match(source,/routedCommand==='網頁遊戲'/);
  for(const id of ['menuToggle','gameSidebar','primaryNav','gameNav','playerBalance','restoreStamina','transportGrid','garageTabs','garageGrid','assetGrid','achievementGrid']) assert.match(html,new RegExp(`id="${id}"`));
  assert.doesNotMatch(html,/id="moduleGrid"/);
  assert.match(css,/\.game-sidebar/);
  assert.match(css,/\.drawer-open \.game-sidebar/);
  assert.match(css,/\.hero-character/);
  assert.match(css,/@media\(max-width:620px\)/);
  assert.match(js,/api\('\/api\/game'\)/);
  assert.match(js,/api\('\/api\/game\/stamina-restore',\{method:'POST'\}\)/);
  assert.match(js,/function renderSidebar\(modules\)/);
  assert.match(js,/function renderGarage\(data\)/);
  assert.match(js,/function openDrawer\(\)/);
  assert.match(js,/function closeDrawer\(\)/);
  assert.match(source,/function webGameGaragePayload\(g,u\)/);
  assert.match(source,/url\.pathname\.startsWith\('\/assets\/'\)/);
});

test('網站載具 PVP 使用持久化房間與伺服器權威結算',()=>{
  const html=readFileSync(new URL('../activity/public/game.html',import.meta.url),'utf8');
  const css=readFileSync(new URL('../activity/public/game.css',import.meta.url),'utf8');
  const js=readFileSync(new URL('../activity/public/game.js',import.meta.url),'utf8');
  assert.match(source,/CREATE TABLE IF NOT EXISTS web_vehicle_pvp_races/);
  assert.match(source,/function webVehiclePvpGenerate\(g,players\)/);
  assert.match(source,/function settleWebVehiclePvpRace\(raceId/);
  assert.match(source,/Number\.isSafeInteger\(bet\)/);
  assert.match(source,/creditPvpPrize\(race\.guild_id,race\.winner_id/);
  for(const route of ['vehicle-pvp','vehicle-pvp/create','vehicle-pvp/join','vehicle-pvp/cancel']) assert.match(source,new RegExp(`/activity/game/${route}`));
  for(const id of ['vehicle-pvp','pvpVehicle','pvpBet','pvpCode','pvpCreate','pvpJoin','pvpArena','pvpRacer0','pvpRacer1']) assert.match(html,new RegExp(`id="${id}"`));
  assert.match(css,/\.pvp-racer\.boost/);
  assert.match(css,/transition:left \.78s/);
  assert.match(js,/setInterval\(\(\)=>loadPvp\(false\),700\)/);
  assert.match(js,/pvpAction\('\/api\/game\/vehicle-pvp\/join'/);
});

test('網站載具 PVP 更新公告完整',()=>{
  const update=JSON.parse(readFileSync(new URL('../updates/2026-08-03-web-vehicle-pvp.json',import.meta.url),'utf8'));
  const text=[update.title,update.summary,...update.changes].join('\n');
  assert.equal(update.version,'2026.08.03.1');
  assert.deepEqual(update.channelNames,['賭場公告']);
  for(const required of ['載具 PVP','房碼','六段','10 點體力','Oracle','1%～3%']) assert.match(text,new RegExp(required));
});

test('角色造型系統取代換裝並保留角色資料表',()=>{
  const html=readFileSync(new URL('../activity/public/game.html',import.meta.url),'utf8');
  const js=readFileSync(new URL('../activity/public/game.js',import.meta.url),'utf8');
  assert.match(source,/const CHARACTER_STYLE_SYSTEM_ENABLED = String\(process\.env\.CHARACTER_STYLE_SYSTEM_ENABLED \|\| 'true'\)/);
  assert.match(source,/function parseAppearanceActivityToken\(token\) \{\s+if\(!CHARACTER_STYLE_SYSTEM_ENABLED\) throw new Error/);
  assert.match(source,/module\.id==='appearance'&&!CHARACTER_STYLE_SYSTEM_ENABLED/);
  assert.match(js,/造型系統維護中/);
  assert.match(html,/game\.js\?v=20260803\.3/);
  assert.match(source,/CREATE TABLE IF NOT EXISTS player_cosmetics/);
  assert.match(source,/CREATE TABLE IF NOT EXISTS player_appearance/);
  assert.match(source,/CREATE TABLE IF NOT EXISTS appearance_presets/);
});

test('一次性清除舊服裝購買穿戴與預設但保留角色',()=>{
  assert.match(source,/CREATE TABLE IF NOT EXISTS system_migrations/);
  assert.match(source,/LEGACY_COSMETIC_PURGE_MIGRATION='2026-08-03-purge-legacy-cosmetic-purchases'/);
  assert.match(source,/cosmeticCatalog\.filter\(item=>item\.slot!=='character'\)/);
  assert.match(source,/DELETE FROM player_cosmetics WHERE cosmetic_id IN/);
  assert.match(source,/DELETE FROM player_appearance WHERE slot<>'character'/);
  assert.match(source,/DELETE FROM appearance_presets/);
  assert.match(source,/charactersPreserved:true/);
  assert.match(source,/LEGACY_COSMETIC_PURGE_OK/);
});

test('換裝系統維護公告說明資料保留',()=>{
  const update=JSON.parse(readFileSync(new URL('../updates/2026-08-03-appearance-maintenance.json',import.meta.url),'utf8'));
  const text=[update.title,update.summary,...update.changes].join('\n');
  assert.equal(update.version,'2026.08.03.2');
  assert.deepEqual(update.channelNames,['賭場公告']);
  for(const required of ['暫時關閉','/玩家 造型','購買','目前穿搭','快速預設','全部保留']) assert.match(text,new RegExp(required.replace('/','\\/')));
});

test('角色造型與管理後台更新公告完整',()=>{
  const update=JSON.parse(readFileSync(new URL('../updates/2026-08-03-character-style-admin.json',import.meta.url),'utf8'));
  const text=[update.title,update.summary,...update.changes].join('\n');
  assert.equal(update.version,'2026.08.03.3');
  assert.deepEqual(update.channelNames,['賭場公告']);
  for(const required of ['/玩家 造型','/造型後台','6 名','8 MB','Oracle','全部保留']) assert.match(text,new RegExp(required.replace('/','\\/')));
});

test('舊服裝資料清除公告完整',()=>{
  const update=JSON.parse(readFileSync(new URL('../updates/2026-08-03-legacy-cosmetic-purge.json',import.meta.url),'utf8'));
  const text=[update.title,update.summary,...update.changes].join('\n');
  assert.equal(update.version,'2026.08.03.4');
  assert.deepEqual(update.channelNames,['賭場公告']);
  for(const required of ['舊服裝購買','穿戴','快速預設','角色本體','完整造型']) assert.match(text,new RegExp(required));
});

test('角色造型頁返回與首頁導覽公告完整',()=>{
  const update=JSON.parse(readFileSync(new URL('../updates/2026-08-03-character-style-navigation.json',import.meta.url),'utf8'));
  const text=[update.title,update.summary,...update.changes].join('\n');
  assert.equal(update.version,'2026.08.03.5');
  assert.deepEqual(update.channelNames,['賭場公告']);
  for(const required of ['返回上一頁','遊戲首頁','安全連結','手機']) assert.match(text,new RegExp(required));
});

test('網頁遊戲第一版更新公告完整',()=>{
  const update=JSON.parse(readFileSync(new URL('../updates/2026-08-02-web-game-v1.json',import.meta.url),'utf8'));
  const text=[update.title,update.summary,...update.changes].join('\n');
  assert.equal(update.version,'2026.08.02.7');
  assert.deepEqual(update.channelNames,['賭場公告']);
  for(const required of ['/玩家 遊戲','金庫','資產','交通事業','成就','每日免費體力','Oracle']) assert.match(text,new RegExp(required.replace('/','\\/')));
});

test('網頁遊戲左側導覽與大廳修正公告完整',()=>{
  const update=JSON.parse(readFileSync(new URL('../updates/2026-08-02-web-game-left-drawer.json',import.meta.url),'utf8'));
  const text=[update.title,update.summary,...update.changes].join('\n');
  assert.equal(update.version,'2026.08.02.8');
  assert.deepEqual(update.channelNames,['賭場公告']);
  for(const required of ['左側','大廳','交通事業','資產','成就','小遊戲','人物']) assert.match(text,new RegExp(required));
});

test('人物穿戴與全載具車庫更新公告完整',()=>{
  const update=JSON.parse(readFileSync(new URL('../updates/2026-08-02-characters-wearables-garage.json',import.meta.url),'utf8'));
  const text=[update.title,update.summary,...update.changes].join('\n');
  assert.equal(update.version,'2026.08.02.9');
  assert.deepEqual(update.channelNames,['賭場公告']);
  for(const required of ['2 名','6 名','16 件','Emoji','飛行器','汽車','摩托車','列車','卡車']) assert.match(text,new RegExp(required));
});

test('車庫分頁避免手機同時解碼全部大型圖片',()=>{
  const html=readFileSync(new URL('../activity/public/game.html',import.meta.url),'utf8');
  const css=readFileSync(new URL('../activity/public/game.css',import.meta.url),'utf8');
  const js=readFileSync(new URL('../activity/public/game.js',import.meta.url),'utf8');
  assert.match(html,/game\.css\?v=20260803\.3/);
  assert.match(html,/id="garagePager"/);
  assert.match(html,/點擊圖片可查看完整原圖/);
  assert.match(js,/const GARAGE_PAGE_SIZE=6/);
  assert.match(js,/group\.items\.slice\(start,start\+GARAGE_PAGE_SIZE\)/);
  assert.match(js,/link\.target='_blank'/);
  assert.match(css,/content-visibility:auto/);
  assert.match(css,/object-fit:contain/);
});

test('既有人物換裝保留五官並使用不遮臉的夜行頭飾',()=>{
  const html=readFileSync(new URL('../activity/public/appearance.html',import.meta.url),'utf8');
  const js=readFileSync(new URL('../activity/public/appearance.js',import.meta.url),'utf8');
  assert.match(html,/appearance\.css\?v=20260802\.8/);
  assert.match(html,/既有人物分層換裝/);
  assert.match(js,/previewCharacter/);
  assert.match(js,/previewStage'\)\.dataset\.outfit/);
  assert.match(cosmeticsSource,/name:'紫影戰術耳機'.*image:'heist\/headwear-open\.png'/);
  assert.match(cosmeticsSource,/name:'紫影戰術鏡'.*image:'heist\/face-open\.png'/);
  const file=readFileSync(new URL('../activity/public/appearance/wearables/heist/headwear-open.png',import.meta.url));
  assert.equal(file.subarray(1,4).toString(),'PNG');
  assert.equal(file[25],6,'夜行頭飾必須是具有 alpha 通道的 RGBA PNG');
});

test('車庫圖片與人物分層修正公告完整',()=>{
  const update=JSON.parse(readFileSync(new URL('../updates/2026-08-02-garage-image-appearance-layering.json',import.meta.url),'utf8'));
  const text=[update.title,update.summary,...update.changes].join('\n');
  assert.equal(update.version,'2026.08.02.10');
  assert.deepEqual(update.channelNames,['賭場公告']);
  for(const required of ['車庫','手機','完整原圖','既有人物','不遮臉','戰術鏡']) assert.match(text,new RegExp(required));
});

test('網頁遊戲資產摘要由獨立資料模組正確計算',()=>{
  const summary=summarizeWebAssets(
    [{asset_id:'airport',quantity:2},{asset_id:'train',quantity:3}],
    {airport:{name:'國際機場',category:'房地產',rarity:'傳說',price:1_000_000},train:{name:'高速列車',category:'列車',rarity:'史詩',price:200_000}},
    1
  );
  assert.equal(summary.count,5);
  assert.equal(summary.value,2_600_000);
  assert.equal(summary.featured.length,1);
  assert.equal(summary.featured[0].id,'airport');
});

test('成就累加資料表可安全累計與取最大值',()=>{
  const db=new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE achievement_progress (
    guild_id TEXT NOT NULL, user_id TEXT NOT NULL, metric TEXT NOT NULL,
    value INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (guild_id,user_id,metric)
  )`);
  const increment=db.prepare(`INSERT INTO achievement_progress(guild_id,user_id,metric,value)
    VALUES(?,?,?,?)
    ON CONFLICT(guild_id,user_id,metric) DO UPDATE SET
      value=value+excluded.value,updated_at=CURRENT_TIMESTAMP`);
  const mark=db.prepare(`INSERT INTO achievement_progress(guild_id,user_id,metric,value)
    VALUES(?,?,?,?)
    ON CONFLICT(guild_id,user_id,metric) DO UPDATE SET
      value=MAX(value,excluded.value),updated_at=CURRENT_TIMESTAMP`);
  increment.run('guild','player','happyPetRaceWins',1);
  increment.run('guild','player','happyPetRaceWins',2);
  mark.run('guild','player','comebackReached',1);
  mark.run('guild','player','comebackReached',0);
  assert.equal(db.prepare("SELECT value FROM achievement_progress WHERE metric='happyPetRaceWins'").get().value,3);
  assert.equal(db.prepare("SELECT value FROM achievement_progress WHERE metric='comebackReached'").get().value,1);
});

test('完成歐印時排入賭場公告自動播報',()=>{
  assert.match(source,/recordCasinoAllIn\(g,u,game,bet\)/);
  assert.match(source,/allIn\?recordCasinoAllIn\(g,u,game,bet\):null/);
  assert.match(source,/CREATE TABLE IF NOT EXISTS casino_all_in_events/);
  assert.match(source,/CASINO_ANNOUNCEMENT_CHANNEL_KEYWORD='賭場公告'/);
  assert.match(source,/CASINO_ANNOUNCEMENT_CHANNEL_ID=String\(process\.env\.CASINO_ANNOUNCEMENT_CHANNEL_ID\|\|''\)\.trim\(\)/);
  assert.match(source,/client\.channels\.fetch\(CASINO_ANNOUNCEMENT_CHANNEL_ID\)/);
  assert.doesNotMatch(source,/FREE_LOBBY_CHANNEL_KEYWORD|自由大廳自動播報/);
  assert.match(source,/setInterval\(\(\)=>notifyPendingCasinoAllIns\(\)\.catch/);
  assert.match(source,/allowedMentions:\{parse:\[\]\}/);

  const db=new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE casino_all_in_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL, user_id TEXT NOT NULL, game TEXT NOT NULL,
    bet INTEGER NOT NULL, all_in_count INTEGER NOT NULL,
    channel_id TEXT, message_id TEXT, broadcasted_at INTEGER,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  const inserted=db.prepare(`INSERT INTO casino_all_in_events(guild_id,user_id,game,bet,all_in_count)
    VALUES(?,?,?,?,?)`).run('guild','player','比大小',50000,3);
  const pending=db.prepare('SELECT * FROM casino_all_in_events WHERE id=? AND broadcasted_at IS NULL').get(Number(inserted.lastInsertRowid));
  assert.equal(pending.bet,50000);
  assert.equal(pending.game,'比大小');
  assert.equal(pending.all_in_count,3);
});

test('歐印勇者每日只能發動一次並於台北時間換日重置',()=>{
  assert.match(source,/hero_trigger_day TEXT/);
  assert.match(source,/ALTER TABLE casino_all_in_stats ADD COLUMN hero_trigger_day TEXT/);
  assert.match(source,/allIn&&equippedTitleId\(g,u\)==='all_in_hero'&&claimAllInHeroDaily\(g,u\)/);
  assert.match(source,/每日第一次歐印獲勝時派彩 ×3（台北時間 00:00 重置）/);

  const block=source.match(/function claimAllInHeroDaily\(g,u\) \{[\s\S]+?\n\}/)?.[0]||'';
  assert.ok(block,'缺少歐印勇者每日觸發限制函式');
  const db=new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE casino_all_in_stats (
    guild_id TEXT NOT NULL, user_id TEXT NOT NULL,
    all_in_count INTEGER NOT NULL DEFAULT 0,
    hero_trigger_day TEXT,
    PRIMARY KEY (guild_id,user_id)
  )`);
  let today='2026-07-31';
  const claim=new Function('db','taipeiDay',`${block}; return claimAllInHeroDaily;`)(db,()=>today);
  assert.equal(claim('guild','player'),true,'當日第一次應成功發動');
  assert.equal(claim('guild','player'),false,'同一玩家同一天不得再次發動');
  assert.equal(claim('guild','other-player'),true,'其他玩家仍可各自發動');
  today='2026-08-01';
  assert.equal(claim('guild','player'),true,'台北時間換日後應可再次發動');
});

test('幫 K 佬洗車提供 12000 工資並有 10% 豪車刮傷賠償事件',()=>{
  assert.match(source,/const K_CAR_WASH_BASE_REWARD = 12_000/);
  assert.match(source,/const K_CAR_WASH_SCRATCH_CHANCE = 0\.10/);
  assert.match(source,/const K_CAR_WASH_SCRATCH_COMPENSATION = 20_000/);
  assert.match(source,/幫 K 佬洗車（\+12,000｜10% 刮傷賠 20,000）/);
  assert.match(source,/legalJob=\[[^\]]+'k_car_wash'\]\.includes\(job\)/);
  assert.match(source,/k_car_wash:\{amount:K_CAR_WASH_BASE_REWARD/);
  assert.match(source,/job==='k_car_wash'&&Math\.random\(\)<K_CAR_WASH_SCRATCH_CHANCE/);
  assert.match(source,/好消息：刮到一輛豪車。/);
  assert.match(source,/壞消息：刮到一輛豪車。/);
  assert.match(source,/Math\.min\(K_CAR_WASH_SCRATCH_COMPENSATION,next\)/);
});

test('闖空門成功率與指定玩家收益皆下修為 15% 至 30%',()=>{
  const chanceBlock=source.match(/function burglarySuccessRate\(memberCount=1\) \{[\s\S]+?\n\}/)?.[0]||'';
  assert.ok(chanceBlock,'缺少闖空門成功率函式');
  const successRate=new Function(
    'BURGLARY_BASE_SUCCESS_RATE','BURGLARY_MEMBER_SUCCESS_BONUS','BURGLARY_MAX_SUCCESS_RATE',
    `${chanceBlock}; return burglarySuccessRate;`
  )(0.15,0.05,0.30);
  assert.equal(successRate(1),0.15);
  assert.equal(successRate(2),0.20);
  assert.equal(successRate(3),0.25);
  assert.equal(successRate(4),0.30);
  assert.equal(successRate(99),0.30);
  assert.match(source,/Math\.random\(\)<burglarySuccessRate\(1\)/);
  assert.match(source,/Math\.random\(\)<burglarySuccessRate\(members\.length\)/);

  const block=source.match(/function randomBurglaryTheft\(targetCoins,random=Math\.random\) \{[\s\S]+?\n\}/)?.[0]||'';
  assert.ok(block,'缺少闖空門隨機金額函式');
  const steal=new Function(`${block}; return randomBurglaryTheft;`)();
  assert.equal(steal(100_000,()=>0),15_000);
  assert.equal(steal(100_000,()=>0.5),22_500);
  assert.equal(steal(100_000,()=>0.999999),30_000);
  assert.equal(steal(1,()=>0.5),0,'不可從只有 1 金幣的玩家偷走超過 30%');
  assert.equal(steal(4,()=>0.5),1);
  for(let index=0;index<100;index++) {
    const amount=steal(987_654,()=>index/100);
    assert.ok(amount>=148_148&&amount<=296_296,`偷竊金額超出 15%～30%：${amount}`);
  }
  assert.ok((source.match(/randomBurglaryTheft\(targetCoins\)/g)||[]).length>=2,'單人與多人指定目標都必須使用新規則');
  assert.doesNotMatch(source,/Math\.min\(3000,targetCoins/);
  assert.doesNotMatch(source,/Math\.min\(5000,3000\*members\.length,targetCoins/);
});

test('萌犬豪華客機已加入商城、航空營運及圖片資產',()=>{
  const assetBlock=source.match(/puppy_luxury_airliner:\{[^\n]+/)?.[0]||'';
  assert.match(assetBlock,/name:'🐶 萌犬豪華客機'/);
  assert.match(assetBlock,/category:'飛行器'/);
  assert.match(assetBlock,/price:7880000/);
  assert.match(assetBlock,/rarity:'限定'/);
  assert.match(assetBlock,/buff:'stamina',buffMultiplier:2\.8/);
  assert.match(assetBlock,/image:'aircraft\/passenger\/puppy_luxury_airliner\.png'/);
  const airliners=source.match(/const passengerAirlinerIds=new Set\(\[[\s\S]+?\n\]\);/)?.[0]||'';
  assert.match(airliners,/'puppy_luxury_airliner'/);
  const image=readFileSync(new URL('../assets/aircraft/passenger/puppy_luxury_airliner.png',import.meta.url));
  assert.equal(image.subarray(1,4).toString(),'PNG');
  const width=image.readUInt32BE(16),height=image.readUInt32BE(20);
  assert.ok(width>=1500&&height>=800&&width>height,`萌犬豪華客機圖片規格錯誤：${width}x${height}`);
});

test('兩架 777-300ER 特殊塗裝客機已加入資產市場及航空營運',()=>{
  const definitions={
    boeing_777_300er_lucky_wings:{
      name:'🐦‍⬛ Boeing 777-300ER 星光八哥號',price:8880000,buff:'casino',buffMultiplier:'3',
      image:'aircraft/passenger/boeing_777_300er_lucky_wings_special.png'
    },
    boeing_777_300er_myna_starlight:{
      name:'🐦 Boeing 777-300ER 星羽文鳥號',price:9280000,buff:'work',buffMultiplier:'3\\.1',
      image:'aircraft/passenger/boeing_777_300er_myna_starlight_special.png'
    }
  };
  const airliners=source.match(/const passengerAirlinerIds=new Set\(\[[\s\S]+?\n\]\);/)?.[0]||'';
  for(const [assetId,expected] of Object.entries(definitions)) {
    const assetBlock=source.match(new RegExp(`${assetId}:\\{[^\\n]+`))?.[0]||'';
    assert.match(assetBlock,new RegExp(`name:'${expected.name}'`));
    assert.match(assetBlock,/category:'飛行器'/);
    assert.match(assetBlock,new RegExp(`price:${expected.price}`));
    assert.match(assetBlock,/rarity:'限定'/);
    assert.match(assetBlock,new RegExp(`buff:'${expected.buff}',buffMultiplier:${expected.buffMultiplier}`));
    assert.match(assetBlock,/forSale:true/);
    assert.match(assetBlock,new RegExp(`image:'${expected.image.replaceAll('/','\\/')}'`));
    assert.match(airliners,new RegExp(`'${assetId}'`));
    const image=readFileSync(new URL(`../assets/${expected.image}`,import.meta.url));
    assert.equal(image.subarray(1,4).toString(),'PNG');
    const width=image.readUInt32BE(16),height=image.readUInt32BE(20);
    assert.ok(width>=1500&&height>=800&&width>height,`${expected.name} 圖片規格錯誤：${width}x${height}`);
  }
  assert.match(source,/boeing_777_300er_lucky_wings:\{[^\n]+八哥彩繪/);
  assert.match(source,/boeing_777_300er_myna_starlight:\{[^\n]+白色頰羽[^\n]+文鳥主題/);
});

test('十架彩繪旗艦客機已上架並可投入航空公司營運',()=>{
  const definitions={
    livery_neon_lotus_a350:{price:10800000,image:'neon-lotus-a350.png'},
    livery_koi_ocean_787:{price:12800000,image:'koi-ocean-787.png'},
    livery_crimson_racing_777:{price:14800000,image:'crimson-racing-777.png'},
    livery_jade_dragon_a330:{price:16800000,image:'jade-dragon-a330.png'},
    livery_aurora_polar_787:{price:18800000,image:'aurora-polar-787.png'},
    livery_sakura_express_777:{price:20800000,image:'sakura-express-777.png'},
    livery_tropical_parrot_a350:{price:22800000,image:'tropical-parrot-a350.png'},
    livery_obsidian_casino_747:{price:24800000,image:'obsidian-casino-747.png'},
    livery_galaxy_whale_a380:{price:26800000,image:'galaxy-whale-a380.png'},
    livery_rainbow_leopard_737:{price:28800000,image:'rainbow-leopard-737.png'}
  };
  const airliners=source.match(/const passengerAirlinerIds=new Set\(\[[\s\S]+?\n\]\);/)?.[0]||'';
  for(const [assetId,expected] of Object.entries(definitions)) {
    const assetBlock=source.match(new RegExp(`${assetId}:\\{[^\\n]+`))?.[0]||'';
    assert.match(assetBlock,/category:'飛行器'/);
    assert.match(assetBlock,new RegExp(`price:${expected.price}`));
    assert.match(assetBlock,/rarity:'限定'/);
    assert.match(assetBlock,/image:'aircraft\/passenger\/livery_collection\//);
    assert.match(airliners,new RegExp(`'${assetId}'`));
    const image=readFileSync(new URL(`../assets/aircraft/passenger/livery_collection/${expected.image}`,import.meta.url));
    assert.equal(image.subarray(1,4).toString(),'PNG');
    const width=image.readUInt32BE(16),height=image.readUInt32BE(20);
    assert.ok(width>=1500&&height>=800&&width>height,`${assetId} 圖片規格錯誤：${width}x${height}`);
  }
  const update=JSON.parse(readFileSync(new URL('../updates/2026-08-09-livery-airliners.json',import.meta.url),'utf8'));
  assert.equal(update.id,'2026-08-09-livery-airliners');
  assert.match(update.changes.join('\n'),/10 架彩繪客機/);
  assert.match(update.changes.join('\n'),/10,800,000～28,800,000/);
});

test('航空航線基礎營收下修 25% 且不影響其他交通事業',()=>{
  const airlineBlock=source.match(/const airlineRoutes=\{[\s\S]+?\n\};/)?.[0]||'';
  const expectedRevenue={
    regional:63750,
    east_asia:172500,
    intercontinental:450000,
    first_class_world:1125000,
    neon_bay_shuttle:90000,
    alpine_lake_express:142500,
    aegean_resort_hop:270000,
    polar_night_longhaul:1575000,
    pacific_crown_longhaul:1850000,
    grand_world_odyssey:2550000
  };
  for(const [routeId,revenue] of Object.entries(expectedRevenue)) {
    assert.match(airlineBlock,new RegExp(`${routeId}:\\{[^\\n]+baseRevenue:${revenue}(?:,|\\})`),`${routeId} 基礎營收不正確`);
  }
  assert.equal((airlineBlock.match(/baseRevenue:/g)||[]).length,10,'航空航線數量或營收設定異常');
  assert.match(source,/INSERT INTO airline_flights\([^\n]+gross_revenue[^\n]+\)[\s\S]+?\.run\([^\n]+grossRevenue/,'起飛時必須保存當次營收，避免調整已起飛航班');

  const groundBlock=source.match(/const transportRoutes=\{[\s\S]+?\n\};/)?.[0]||'';
  assert.match(groundBlock,/rail_metro_commuter:\{[^\n]+baseRevenue:72000/);
  assert.match(groundBlock,/coach_city_shuttle:\{[^\n]+baseRevenue:45000/);
  assert.match(groundBlock,/freight_city_distribution:\{[^\n]+baseRevenue:120000/);
});

test('四種交通企業可升至 10 級並只影響新營運收益',()=>{
  const costsSource=source.match(/const ENTERPRISE_UPGRADE_COSTS=(\{[^\n]+\});/)?.[1];
  assert.ok(costsSource,'缺少企業升級費用表');
  const costs=new Function(`return ${costsSource}`)();
  assert.equal(Object.values(costs).reduce((sum,value)=>sum+value,0),478_500_000);
  assert.equal(costs[2],1_000_000);
  assert.equal(costs[10],200_000_000);
  assert.match(source,/const ENTERPRISE_MAX_LEVEL=10/);
  assert.match(source,/const ENTERPRISE_REVENUE_BONUS_PER_LEVEL=0\.04/);
  assert.match(source,/CREATE TABLE IF NOT EXISTS airline_companies[\s\S]+?company_level INTEGER NOT NULL DEFAULT 1/);
  assert.match(source,/CREATE TABLE IF NOT EXISTS transport_business_companies[\s\S]+?company_level INTEGER NOT NULL DEFAULT 1/);
  assert.match(source,/ALTER TABLE airline_companies ADD COLUMN company_level INTEGER NOT NULL DEFAULT 1/);
  assert.match(source,/ALTER TABLE transport_business_companies ADD COLUMN company_level INTEGER NOT NULL DEFAULT 1/);
  const upgradeBlock=source.match(/function upgradeEnterprise\([\s\S]+?\n\}/)?.[0]||'';
  assert.match(upgradeBlock,/BEGIN IMMEDIATE/);
  assert.match(upgradeBlock,/'enterprise_upgrade'/);
  assert.match(upgradeBlock,/COMMIT/);
  assert.match(source,/route\.baseRevenue\*airport\.airlineMultiplier\*airlinerRevenueMultiplier\(company\.aircraft_id\)\*enterpriseRevenueMultiplier\(company\)\*dailyMultiplier\*demandMultiplier/);
  assert.match(source,/route\.baseRevenue\*station\.transportMultiplier\*trainMultiplier\*truckMultiplier\*coachMultiplier\*shipMultiplier\*enterpriseRevenueMultiplier\(company\)\*dailyMultiplier\*demandMultiplier/);
  assert.match(source,/enterprise_upgrade:\$\{u\}:airline/);
  assert.match(source,/setCustomId\(`enterprise_upgrade:\$\{u\}:\$\{businessType\}`\)/);
  assert.match(source,/INSERT INTO airline_flights\([^\n]+gross_revenue/,'航空收益必須在起飛時保存');
  assert.match(source,/INSERT INTO transport_business_operations\([^\n]+gross_revenue/,'陸路收益必須在出發時保存');
});

test('交通維修保險牌照、每日遞減及高額賭局抽成完整',()=>{
  assert.match(source,/const TRANSPORT_LICENSE_TERM_MS=7\*24\*60\*60\*1000/);
  assert.match(source,/const TRANSPORT_DAILY_FULL_REVENUE_RUNS=3/);
  assert.match(source,/const TRANSPORT_DAILY_REVENUE_STEP=0\.05/);
  assert.match(source,/const TRANSPORT_DAILY_MIN_REVENUE_MULTIPLIER=0\.50/);
  assert.match(source,/CREATE TABLE IF NOT EXISTS transport_daily_operations/);
  assert.match(source,/CREATE TABLE IF NOT EXISTS airline_companies[\s\S]+?upkeep_day TEXT[\s\S]+?license_expires_at INTEGER/);
  assert.match(source,/CREATE TABLE IF NOT EXISTS transport_business_companies[\s\S]+?upkeep_day TEXT[\s\S]+?license_expires_at INTEGER/);
  assert.match(source,/ALTER TABLE airline_companies ADD COLUMN upkeep_day TEXT/);
  assert.match(source,/ALTER TABLE airline_companies ADD COLUMN license_expires_at INTEGER/);
  assert.match(source,/ALTER TABLE transport_business_companies ADD COLUMN upkeep_day TEXT/);
  assert.match(source,/ALTER TABLE transport_business_companies ADD COLUMN license_expires_at INTEGER/);

  const diminishingBlock=source.match(/function transportDailyRevenueMultiplier\(completedToday\) \{[\s\S]+?\n\}/)?.[0]||'';
  const diminishing=new Function('TRANSPORT_DAILY_FULL_REVENUE_RUNS','TRANSPORT_DAILY_REVENUE_STEP','TRANSPORT_DAILY_MIN_REVENUE_MULTIPLIER',`${diminishingBlock};return transportDailyRevenueMultiplier;`)(3,0.05,0.50);
  assert.equal(diminishing(0),1);
  assert.equal(diminishing(2),1);
  assert.equal(diminishing(3),0.95);
  assert.equal(diminishing(12),0.50);

  const airlineStart=source.match(/function startAirlineFlight\([\s\S]+?\n\}/)?.[0]||'';
  const groundStart=source.match(/function startTransportBusinessOperation\([\s\S]+?\n\}/)?.[0]||'';
  for(const block of [airlineStart,groundStart]) {
    assert.match(block,/settleTransportUpkeepUnlocked/);
    assert.match(block,/recordTransportDailyOperationUnlocked/);
    assert.match(block,/const operatingCost=Math\.floor\(route\.operatingCost\*\(event\?\.operatingCostMultiplier\|\|1\)\)/);
    assert.match(block,/requiredFunds=operatingCost\+upkeepQuote\.totalDue/);
  }
  const trigger=source.match(/CREATE TRIGGER ledger_collect_casino_vault[\s\S]+?END;/)?.[0]||'';
  assert.match(trigger,/'transport_maintenance','transport_insurance','transport_license'/,'交通維持費應永久回收，不流入賭場寶庫');

  assert.match(source,/\{minimum:100_000_000,rate:0\.03\}[\s\S]+\{minimum:10_000_000,rate:0\.02\}[\s\S]+\{minimum:1_000_000,rate:0\.01\}/);
  const rateBlock=source.match(/function highStakeRakeRate\(bet\) \{[\s\S]+?\n\}/)?.[0]||'';
  const rate=new Function('HIGH_STAKE_RAKE_TIERS',`${rateBlock};return highStakeRakeRate;`)([
    {minimum:100_000_000,rate:0.03},{minimum:10_000_000,rate:0.02},{minimum:1_000_000,rate:0.01}
  ]);
  assert.equal(rate(999_999),0);
  assert.equal(rate(1_000_000),0.01);
  assert.equal(rate(10_000_000),0.02);
  assert.equal(rate(100_000_000),0.03);
  const payoutBlock=source.match(/function settleGamePayout\([\s\S]+?\n\}/)?.[0]||'';
  assert.match(payoutBlock,/grossProfit-rake\.amount/,'一般賭局只應從獲利扣抽成');
  assert.match(payoutBlock,/collectHighStakeRake/);
  assert.match(source,/creditPvpPrize\(session\.guildId,ranking\[0\]\.id/);
  assert.match(source,/creditPvpPrize\(session\.guildId,winnerId,session\.bet/);
  assert.match(source,/creditPvpPrize\(i\.guildId,otherId,duel\.bet/);

  const update=JSON.parse(readFileSync(new URL('../updates/2026-08-01-transport-upkeep-diminishing-rake.json',import.meta.url),'utf8'));
  assert.equal(update.version,'2026.08.01.10');
  assert.match(update.summary,/維修、保險與牌照續期/);
  assert.match(update.summary,/1%～3%/);
  assert.ok(update.changes.some(change=>change.includes('前 3 趟')&&change.includes('最低 50%')));
  assert.ok(update.changes.some(change=>change.includes('1,000,000')&&change.includes('100,000,000')));
  assert.deepEqual(update.channelNames,['賭場公告']);
});

test('限時資產拍賣使用安全託管、退款、延時與自動結標',()=>{
  assert.match(source,/CREATE TABLE IF NOT EXISTS asset_auctions/);
  assert.match(source,/CREATE UNIQUE INDEX IF NOT EXISTS idx_asset_auctions_active_guild[\s\S]+?WHERE status='active'/);
  assert.match(source,/CREATE TABLE IF NOT EXISTS asset_auction_bids/);
  assert.match(source,/const ASSET_AUCTION_DURATION_MS=12\*60\*60\*1000/);
  assert.match(source,/const ASSET_AUCTION_EXTENSION_MS=5\*60\*1000/);
  assert.match(source,/const ASSET_AUCTION_MIN_INCREMENT_RATE=0\.05/);
  assert.match(source,/const ASSET_AUCTION_MIN_START_PRICE=5000000/);
  assert.match(source,/const assetAuctionPool=\[\.\.\.auctionLimitedVehicleIds\]/);

  const startPriceBlock=source.match(/function assetAuctionStartPrice\(asset\) \{[\s\S]+?\n\}/)?.[0]||'';
  const minimumBidBlock=source.match(/function minimumAssetAuctionBid\(auction\) \{[\s\S]+?\n\}/)?.[0]||'';
  const auctionMath=new Function(`const ASSET_AUCTION_MIN_START_PRICE=5000000,ASSET_AUCTION_MIN_INCREMENT=100000,ASSET_AUCTION_MIN_INCREMENT_RATE=0.05;${startPriceBlock};${minimumBidBlock};return {assetAuctionStartPrice,minimumAssetAuctionBid};`)();
  assert.equal(auctionMath.assetAuctionStartPrice({price:900_000}),5_000_000);
  assert.equal(auctionMath.assetAuctionStartPrice({price:5_500_000}),11_000_000);
  assert.equal(auctionMath.minimumAssetAuctionBid({start_price:5_000_000,current_bid:0}),5_000_000);
  assert.equal(auctionMath.minimumAssetAuctionBid({start_price:5_000_000,current_bid:10_000_000}),10_500_000);

  const bidBlock=source.match(/function placeAssetAuctionBid\([\s\S]+?\n\}/)?.[0]||'';
  assert.match(bidBlock,/Number\.isSafeInteger\(amount\).*amount<1/);
  assert.match(bidBlock,/BEGIN IMMEDIATE/);
  assert.match(bidBlock,/'auction_bid_refund'/);
  assert.match(bidBlock,/'auction_bid_escrow'/);
  assert.match(bidBlock,/auction\.ends_at-now<=ASSET_AUCTION_EXTENSION_MS/);
  assert.match(bidBlock,/COMMIT/);
  const trigger=source.match(/CREATE TRIGGER ledger_collect_casino_vault[\s\S]+?END;/)?.[0]||'';
  assert.match(trigger,/'enterprise_upgrade','auction_bid_escrow'/,'升級費與拍賣託管不可流入賭場寶庫');
  assert.match(source,/ECONOMY_TRANSFER_KINDS=new Set\([^\n]+auction_bid_escrow[^\n]+auction_bid_refund/,'可退款託管不可誤算成產生或銷毀');
  assert.match(source,/SUM\(final_price\)[^\n]+asset_auctions[^\n]+status='completed'/,'經濟監控需按成交價計算真正回收');
  assert.match(source,/setInterval\(\(\)=>processAssetAuctions\(\)\.catch/);
  assert.match(source,/label:'限時資產拍賣',value:'auction'/);
  assert.match(source,/asset_auction_bid_modal:/);
  assert.doesNotMatch(source,/setName\('資產拍賣'\)/,'拍賣應整合既有資產入口，不新增斜線指令');
});

test('限時資產拍賣全系統同時只保留一場並安全整併重複場次',()=>{
  const migration=source.match(/function migrateToSingleActiveAssetAuction\(now=Date\.now\(\)\) \{[\s\S]+?\n\}/)?.[0]||'';
  const scheduler=source.match(/async function processAssetAuctions\(\) \{[\s\S]+?\n\}/)?.[0]||'';
  assert.match(migration,/DROP INDEX IF EXISTS idx_asset_auctions_active_guild/);
  assert.match(migration,/idx_asset_auctions_single_active/);
  assert.match(migration,/'auction_singleton_refund'/);
  assert.match(migration,/superseded_at/);
  assert.match(source,/function activeAssetAuction\(\) \{/);
  assert.match(source,/全系統同時只有一場系統拍賣/);
  assert.match(scheduler,/removeSupersededAssetAuctionAnnouncements/);
  assert.doesNotMatch(scheduler,/for\(const guildId of guildIds\) ensureActiveAssetAuction/);
});

test('限時資產拍賣公告可由所有玩家直接公開出價',()=>{
  const bidBlock=source.match(/function placeAssetAuctionBid\([\s\S]+?\n\}/)?.[0]||'';
  assert.match(source,/current_bidder_guild_id TEXT/);
  assert.match(source,/ALTER TABLE asset_auctions ADD COLUMN current_bidder_guild_id/);
  assert.match(bidBlock,/WHERE id=\? AND status='active'/);
  assert.match(bidBlock,/current_bidder_guild_id=\?/);
  assert.match(source,/asset_auction_public_bid:/);
  assert.match(source,/function assetAuctionAnnouncementComponents\(auction\)/);
  assert.match(source,/function refreshActiveAssetAuctionAnnouncementControls\(\)/);
  assert.match(source,/publishAssetAuctionAnnouncement\(result\.auction,'🔨/);
});

test('限時拍賣輪替池包含 20 款限量競標載具',()=>{
  const definitionBlock=source.match(/const auctionLimitedVehicleDefinitions=\[[\s\S]+?\n\];/)?.[0]||'';
  assert.equal((definitionBlock.match(/\{id:'/g)||[]).length,20);
  const imagePaths=[...definitionBlock.matchAll(/image:'([^']+)'/g)].map(match=>match[1]);
  assert.equal(imagePaths.length,20);
  for(const imagePath of imagePaths) assert.equal(existsSync(new URL(`../assets/${imagePath}`,import.meta.url)),true,`缺少競標載具圖片：${imagePath}`);
  assert.match(source,/const auctionLimitedVehicleIds=auctionLimitedVehicleDefinitions\.map\(vehicle=>vehicle\.id\)/);
  assert.match(source,/const auctionLimitedTruckIds=auctionLimitedVehicleDefinitions\.filter\(vehicle=>vehicle\.category==='卡車'\)/);
  assert.match(source,/auctionOnly:true/);
  assert.match(source,/asset\.auctionOnly\?'\\n🏁 \*\*限量競標載具\*\*/);
  const update=JSON.parse(readFileSync(new URL('../updates/2026-08-05-limited-auction-vehicles.json',import.meta.url),'utf8'));
  assert.equal(update.id,'2026-08-05-limited-auction-vehicles');
  assert.match(update.summary,/20 款限量/);
  assert.match(update.changes.join('\n'),/汽車.*卡車.*機車/s);
});

test('舊版限時拍賣會下架、退回託管且不影響既有收藏',()=>{
  const retirement=source.match(/function retireLegacyAssetAuctions\(now=Date\.now\(\)\) \{[\s\S]+?\n\}/)?.[0]||'';
  assert.match(retirement,/status='active'/);
  assert.match(retirement,/!auctionLimitedVehicleIds\.includes\(auction\.asset_id\)/,'僅保留 20 款新限量載具');
  assert.match(retirement,/'auction_legacy_refund'/);
  assert.match(retirement,/status='expired',settled_at=\?,closed_announced_at=\?/,'下架場次不應再發流標公告');
  assert.match(retirement,/changeBalanceUnlocked\(auction\.guild_id,auction\.current_bidder_id,auction\.current_bid/,'既有出價必須完整退回');
  assert.match(source,/ECONOMY_TRANSFER_KINDS=new Set\([^\n]+auction_legacy_refund/);
  const scheduler=source.match(/async function processAssetAuctions\(\) \{[\s\S]+?\n\}/)?.[0]||'';
  assert.match(scheduler,/retireLegacyAssetAuctions\(now\)/,'排程啟動時先清除舊版進行中拍賣');
  const update=JSON.parse(readFileSync(new URL('../updates/2026-08-05-auction-legacy-cleanup.json',import.meta.url),'utf8'));
  assert.match(update.summary,/只保留 20 款/);
  assert.ok(update.changes.some(change=>change.includes('完整退回')));
});

test('GitHub Actions 可用 Secrets 自動增量部署 Oracle',()=>{
  const workflowUrl=new URL('../.github/workflows/deploy-oracle.yml',import.meta.url);
  const deployScript=readFileSync(new URL('../scripts/deploy_oracle_github.sh',import.meta.url),'utf8');
  if(existsSync(workflowUrl)){
    const workflow=readFileSync(workflowUrl,'utf8');
    assert.match(workflow,/branches: \[main\]/);
    assert.match(workflow,/npm test/);
    for(const secret of ['ORACLE_HOST','ORACLE_SSH_KEY','ORACLE_KNOWN_HOSTS']) assert.match(workflow,new RegExp(`secrets\\.${secret}`));
    assert.match(workflow,/scripts\/deploy_oracle_github\.sh/);
  }
  assert.match(deployScript,/ORACLE_SSH_KEY/);
  assert.match(deployScript,/StrictHostKeyChecking=yes/);
  assert.match(deployScript,/git diff --name-only/);
  assert.match(deployScript,/deploy_oracle_remote\.sh/);
  assert.doesNotMatch(deployScript,/BEGIN (?:RSA|OPENSSH) PRIVATE KEY/);
});

test('賭場強化保全與限時拍賣每六小時提醒',()=>{
  assert.match(source,/const CASINO_VAULT_LOOT_RATE=0\.50/);
  assert.match(source,/const CASINO_VAULT_MAX_SUCCESS_RATE=25/);
  assert.match(source,/const CASINO_SECURITY_BASE_HP=24/);
  assert.match(source,/const CASINO_SECURITY_HP_PER_MEMBER=5/);
  assert.match(source,/const CASINO_SECURITY_ESCAPE_PENALTY=10/);
  assert.match(source,/casino_vault:\{name:'🎰 賭場中央寶庫（週日限定）',baseChance:2/);
  assert.match(source,/casinoSecurityMaxHp=heist=>CASINO_SECURITY_BASE_HP\+heist\.members\.length\*CASINO_SECURITY_HP_PER_MEMBER/);
  assert.match(source,/successRateCap=heist\.casinoSecurityRequired\?CASINO_VAULT_MAX_SUCCESS_RATE:normalSuccessCap/);
  assert.match(source,/combat\.policePressure-casinoSecurityPenalty/);
  assert.match(source,/casinoVaultBalance\(i\.guildId\)\*CASINO_VAULT_LOOT_RATE/);
  assert.doesNotMatch(source,/casinoVaultBalance\([^\n]+\*0\.8/);

  assert.match(source,/last_reminder_at INTEGER/);
  assert.match(source,/announcement_message_id TEXT/);
  assert.match(source,/publishAssetAuctionAnnouncement/);
  assert.match(source,/notifyAssetAuctionOutbid/);
  assert.match(source,/ALTER TABLE asset_auctions ADD COLUMN last_reminder_at INTEGER/);
  assert.match(source,/const ASSET_AUCTION_REMINDER_MS=6\*60\*60\*1000/);
  const scheduler=source.match(/async function processAssetAuctions\(\) \{[\s\S]+?\n\}/)?.[0]||'';
  assert.match(scheduler,/COALESCE\(last_reminder_at,announced_at\)<=\?/);
  assert.match(scheduler,/now-ASSET_AUCTION_REMINDER_MS/);
  assert.match(scheduler,/每 6 小時即時提醒/);
  assert.match(scheduler,/UPDATE asset_auctions SET last_reminder_at=\?/);

  const update=JSON.parse(readFileSync(new URL('../updates/2026-08-01-casino-security-auction-reminders.json',import.meta.url),'utf8'));
  assert.equal(update.version,'2026.08.01.11');
  assert.match(update.summary,/重裝保全/);
  assert.match(update.summary,/每 6 小時/);
  assert.ok(update.changes.some(change=>change.includes('4%')&&change.includes('2%')));
  assert.ok(update.changes.some(change=>change.includes('50%')&&change.includes('80%')));
  assert.deepEqual(update.channelNames,['賭場公告']);
});

test('企業升級與限時拍賣公告完整',()=>{
  const update=JSON.parse(readFileSync(new URL('../updates/2026-08-01-enterprise-upgrades-asset-auctions.json',import.meta.url),'utf8'));
  assert.equal(update.version,'2026.08.01.9');
  assert.match(update.summary,/企業升級/);
  assert.match(update.summary,/限時資產拍賣/);
  assert.ok(update.changes.some(change=>change.includes('478,500,000')));
  assert.ok(update.changes.some(change=>change.includes('託管')&&change.includes('退款')));
  assert.ok(update.changes.some(change=>change.includes('最後 5 分鐘')&&change.includes('延長')));
  assert.deepEqual(update.channelNames,['賭場公告']);
});

test('限時資產拍賣可指定跨伺服器公告頻道',()=>{
  const scheduler=source.match(/async function processAssetAuctions\(\) \{[\s\S]+?\n\}/)?.[0]||'';
  assert.match(source,/async function casinoAuctionAnnouncementChannel\(guildId\)/);
  assert.match(source,/跨服拍賣公告頻道設定無效/);
  assert.match(scheduler,/casinoAuctionAnnouncementChannel\(auction\.guild_id\)/);
  assert.doesNotMatch(scheduler,/casinoAnnouncementChannel\(auction\.guild_id\)/);
});

test('團隊搶劫提高合作逃脫率並小幅下調警方壓制',()=>{
  assert.match(source,/const TEAM_HEIST_MEMBER_CHANCE_BONUS = Number\(process\.env\.TEAM_HEIST_MEMBER_CHANCE_BONUS \|\| 6\)/);
  assert.match(source,/const TEAM_HEIST_SUCCESS_RATE_CAP = Number\(process\.env\.TEAM_HEIST_SUCCESS_RATE_CAP \|\| 48\)/);
  assert.match(source,/if\(bank\?\.sundayOnly\|\|bank\?\.museumTarget\|\|\(bank\?\.reward\|\|0\)>=100000\) return 15/);
  assert.match(source,/if\(\(bank\?\.reward\|\|0\)>=50000\) return 11/);
  assert.match(source,/return 7;/);
  assert.match(source,/const TEAM_HEIST_POLICE_WEAPON_PRESSURE_CAP = Number\(process\.env\.TEAM_HEIST_POLICE_WEAPON_PRESSURE_CAP \|\| 22\)/);
  assert.match(source,/const TEAM_HEIST_POLICE_CONFRONT_PRESSURE = Number\(process\.env\.TEAM_HEIST_POLICE_CONFRONT_PRESSURE \|\| 3\)/);
  assert.match(source,/const TEAM_HEIST_POLICE_REINFORCE_PRESSURE = Number\(process\.env\.TEAM_HEIST_POLICE_REINFORCE_PRESSURE \|\| 4\)/);
  assert.match(source,/members\.length-1\)\*TEAM_HEIST_MEMBER_CHANCE_BONUS/);
  assert.match(source,/TEAM_HEIST_SUCCESS_RATE_CAP\+weeklyHeistBonus/);
  assert.match(source,/CASINO_VAULT_MAX_SUCCESS_RATE:normalSuccessCap/);
});

test('搶劫最終結果在互動 Webhook 失效時改用頻道備援',async()=>{
  const block=source.match(/async function publishLatestHeistResult\(interaction,payload\) \{[\s\S]+?\n\}/)?.[0]||'';
  assert.ok(block,'缺少搶劫最終結果發布函式');
  assert.match(block,/new Set\(\[50027,10015,10062\]\)/);
  assert.match(block,/client\.channels\.fetch\(interaction\.channelId\)/);
  assert.match(block,/return channel\.send\(\{/);
  assert.match(block,/搶劫已完成，以下為本次最終結果/);
  assert.doesNotMatch(block,/changeBalance|INSERT INTO jail|UPDATE wallets/);
  assert.match(source,/if\(escaped\) \{[\s\S]+changeBalance\(g,u,SOLO_HEIST_REWARD,'job'/);
  assert.match(source,/return publishLatestHeistResult\(i,payload\)/);

  class FakeEmbedBuilder {
    setColor(){return this;}
    setTitle(){return this;}
    setDescription(){return this;}
  }
  const sent=[];
  const channel={isTextBased:()=>true,send:async payload=>{sent.push(payload);return payload;}};
  const client={channels:{fetch:async()=>channel}};
  const publish=new Function('EmbedBuilder','client',`${block}; return publishLatestHeistResult;`)(FakeEmbedBuilder,client);
  let followUps=0;
  const interaction={
    user:{id:'player'},channel,channelId:'channel',
    editReply:async()=>{throw Object.assign(new Error('Invalid Webhook Token'),{code:50027});},
    followUp:async()=>{followUps++;throw new Error('不應使用失效的 webhook');}
  };
  const payload={embeds:[{title:'最終結果'}],attachments:[],files:[{name:'result.jpg'}]};
  await publish(interaction,payload);
  assert.equal(followUps,0);
  assert.equal(sent.length,1);
  assert.equal(sent[0].content,'<@player> 搶劫已完成，以下為本次最終結果。');
  assert.deepEqual(sent[0].files,payload.files);
});

test('機場整合交通事業並支援最多五個同時航班機位',()=>{
  assert.match(source,/flight_slots INTEGER NOT NULL DEFAULT 1/);
  assert.match(source,/const AIRLINE_MAX_FLIGHT_SLOTS=5/);
  assert.match(source,/const AIRLINE_SLOT_COSTS=\{2:1000000,3:2500000,4:5000000,5:10000000\}/);
  assert.match(source,/changeBalanceUnlocked\(g,u,-cost,'airline_slot'/);
  assert.match(source,/INSERT INTO airline_flights\(guild_id,user_id,flight_slot,/);
  assert.match(source,/airlineAircraftAvailability\(g,u,company\.aircraft_id,flights\)\.available<1/);
  assert.match(source,/setCustomId\(`airline_claim_select:\$\{u\}`\)/);
  assert.match(source,/setCustomId\(`airline_buy_slot:\$\{u\}`\)/);
  assert.match(source,/function transportHubEmbed\(g,u,notice=''\)/);
  assert.match(source,/setCustomId\(`transport_hub_airline:\$\{u\}`\)/);
  assert.match(source,/i\.commandName==='交通事業'[\s\S]+transportHubEmbed\(g,u\)/);

  const db=new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE airline_flights (
    guild_id TEXT NOT NULL, user_id TEXT NOT NULL, airport_id TEXT NOT NULL,
    aircraft_id TEXT NOT NULL, route_id TEXT NOT NULL, gross_revenue INTEGER NOT NULL,
    operating_cost INTEGER NOT NULL, started_at INTEGER NOT NULL, completes_at INTEGER NOT NULL,
    dm_notified_at INTEGER, channel_notified_at INTEGER,
    PRIMARY KEY (guild_id,user_id)
  );
  INSERT INTO airline_flights(
    guild_id,user_id,airport_id,aircraft_id,route_id,gross_revenue,
    operating_cost,started_at,completes_at,dm_notified_at,channel_notified_at
  ) VALUES('guild','player','airport','aircraft','route',500000,200000,1000,2000,NULL,NULL);
  ALTER TABLE airline_flights RENAME TO airline_flights_legacy;
  CREATE TABLE airline_flights (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL, user_id TEXT NOT NULL, flight_slot INTEGER NOT NULL,
    airport_id TEXT NOT NULL, aircraft_id TEXT NOT NULL, route_id TEXT NOT NULL,
    gross_revenue INTEGER NOT NULL, operating_cost INTEGER NOT NULL,
    started_at INTEGER NOT NULL, completes_at INTEGER NOT NULL,
    dm_notified_at INTEGER, channel_notified_at INTEGER,
    UNIQUE (guild_id,user_id,flight_slot)
  );
  INSERT INTO airline_flights(
    guild_id,user_id,flight_slot,airport_id,aircraft_id,route_id,
    gross_revenue,operating_cost,started_at,completes_at,dm_notified_at,channel_notified_at
  )
  SELECT guild_id,user_id,1,airport_id,aircraft_id,route_id,
    gross_revenue,operating_cost,started_at,completes_at,dm_notified_at,channel_notified_at
  FROM airline_flights_legacy;
  DROP TABLE airline_flights_legacy;`);
  const migrated=db.prepare('SELECT * FROM airline_flights WHERE guild_id=? AND user_id=?').get('guild','player');
  assert.equal(migrated.flight_slot,1);
  assert.equal(migrated.gross_revenue,500000);
  assert.ok(migrated.id>0);
});

test('三種交通場站分開註冊公司並可同時營運',()=>{
  const stationAssets=[
    ['grand_bay_high_speed_rail_terminal','properties/stations/grand_bay_high_speed_rail_terminal.png','rail'],
    ['lotus_metropolitan_coach_terminal','properties/stations/lotus_metropolitan_coach_terminal.png','coach'],
    ['harbor_crown_freight_terminal','properties/stations/harbor_crown_freight_terminal.png','freight']
  ];
  for(const [id,image,type] of stationAssets) {
    assert.match(source,new RegExp(`${id}:\\{[^\\n]+transportType:'${type}'`),`缺少交通場站 ${id}`);
    assert.ok(existsSync(new URL(`../assets/${image}`,import.meta.url)),`缺少交通場站圖片 ${image}`);
  }
  assert.match(source,/const TRANSPORT_REGISTRATION_FEE=300000/);
  assert.match(source,/CREATE TABLE IF NOT EXISTS transport_business_companies/);
  assert.match(source,/CREATE TABLE IF NOT EXISTS transport_business_operations/);
  assert.match(source,/PRIMARY KEY \(guild_id,user_id,business_type\)/);
  assert.match(source,/setName\('交通事業'\)/);
  assert.match(source,/registerTransportBusinessCompany\(g,u,businessType,name\)/);
  assert.match(source,/changeBalanceUnlocked\(g,u,-TRANSPORT_REGISTRATION_FEE,'transport_registration'/);
  assert.match(source,/transport_register_modal:\$\{ownerId\}:\$\{businessType\}/);
  assert.match(source,/transport_business:\$\{u\}:\$\{businessType\}/);
  assert.match(source,/changeBalanceUnlocked\(g,u,-operatingCost,'transport_operation'/);
  assert.match(source,/changeBalanceUnlocked\(g,u,operation\.gross_revenue,'transport_revenue'/);
  assert.match(source,/setInterval\(notifyCompletedTransportOperations,60000\)/);

  const db=new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE transport_business_companies (
    guild_id TEXT NOT NULL, user_id TEXT NOT NULL, business_type TEXT NOT NULL,
    company_name TEXT NOT NULL, station_id TEXT, route_id TEXT,
    PRIMARY KEY (guild_id,user_id,business_type)
  );
  CREATE TABLE transport_business_operations (
    guild_id TEXT NOT NULL, user_id TEXT NOT NULL, business_type TEXT NOT NULL, station_id TEXT NOT NULL,
    route_id TEXT NOT NULL, gross_revenue INTEGER NOT NULL, operating_cost INTEGER NOT NULL,
    started_at INTEGER NOT NULL, completes_at INTEGER NOT NULL,
    dm_notified_at INTEGER, channel_notified_at INTEGER,
    PRIMARY KEY (guild_id,user_id,business_type)
  );`);
  db.prepare('INSERT INTO transport_business_companies(guild_id,user_id,business_type,company_name,station_id,route_id) VALUES(?,?,?,?,?,?)')
    .run('guild','player','rail','金運鐵路','grand_bay_high_speed_rail_terminal','rail_intercity_business');
  db.prepare('INSERT INTO transport_business_companies(guild_id,user_id,business_type,company_name,station_id,route_id) VALUES(?,?,?,?,?,?)')
    .run('guild','player','coach','金運客運','lotus_metropolitan_coach_terminal','coach_intercity_line');
  const insertOperation=db.prepare('INSERT INTO transport_business_operations(guild_id,user_id,business_type,station_id,route_id,gross_revenue,operating_cost,started_at,completes_at) VALUES(?,?,?,?,?,?,?,?,?)');
  insertOperation.run('guild','player','rail','grand_bay_high_speed_rail_terminal','rail_intercity_business',270000,80000,1000,2000);
  insertOperation.run('guild','player','coach','lotus_metropolitan_coach_terminal','coach_intercity_line',130000,40000,1100,2100);
  const operations=db.prepare('SELECT * FROM transport_business_operations WHERE guild_id=? AND user_id=? ORDER BY business_type').all('guild','player');
  assert.equal(operations.length,2);
  assert.deepEqual(operations.map(row=>row.business_type),['coach','rail']);
  assert.equal(operations.find(row=>row.business_type==='rail').gross_revenue-80000,190000);
});

test('公告檔案包含成就與轉帳規則',()=>{
  const update=JSON.parse(readFileSync(new URL('../updates/2026-07-30-transfer-achievements.json',import.meta.url),'utf8'));
  assert.equal(update.id,'2026-07-30-transfer-achievements');
  assert.equal(update.changes.length,7);
  assert.match(update.summary,/10 個一般成就、3 個隱藏成就/);
  assert.match(update.changes.join('\n'),/2% 手續費/);
});

test('交通事業更新公告包含三種場站與註冊費',()=>{
  const update=JSON.parse(readFileSync(new URL('../updates/2026-07-30-transport-stations.json',import.meta.url),'utf8'));
  assert.equal(update.id,'2026-07-30-transport-stations');
  assert.equal(update.changes.length,7);
  assert.match(update.summary,/火車站、客運站與貨運站/);
  assert.match(update.changes.join('\n'),/300,000 金幣手續費/);
  assert.match(update.note,/賭場中央寶庫/);
});

test('交通事業整合與多機位更新公告完整',()=>{
  const update=JSON.parse(readFileSync(new URL('../updates/2026-07-31-transport-hub-airline-slots.json',import.meta.url),'utf8'));
  assert.equal(update.id,'2026-07-31-transport-hub-airline-slots');
  assert.equal(update.changes.length,7);
  assert.match(update.summary,/交通事業/);
  assert.match(update.changes.join('\n'),/5 個機位/);
  assert.match(update.changes.join('\n'),/賭場公告/);
});

test('列車盲盒整合交通事業並套用鐵路營收加成',()=>{
  const trainIds=[
    'train_city_glow_commuter','train_bay_breeze_commuter','train_greenfield_diesel','train_harbor_regional_express',
    'train_crimson_mist_mountain','train_blue_tide_double_decker','train_golden_bay_business','train_sakura_snow_sightseeing',
    'train_obsidian_night_sleeper','train_skyreach_maglev','train_imperial_crown_high_speed','train_orbital_aurora_superconducting'
  ];
  assert.equal(trainIds.length,12);
  for(const assetId of trainIds) {
    assert.match(source,new RegExp(`${assetId}:\\{name:`),`缺少列車資產 ${assetId}`);
    const imageName=assetId.replace(/^train_/,'').replace('harbor_regional_express','harbor_regional_express');
    const assetBlock=source.match(new RegExp(`${assetId}:\\{[^\\n]+`))?.[0]||'';
    const image=assetBlock.match(/image:'([^']+)'/)?.[1];
    assert.ok(image,`${assetId} 缺少圖片路徑`);
    const file=readFileSync(new URL(`../assets/${image}`,import.meta.url));
    assert.equal(file.subarray(1,4).toString(),'PNG',`${imageName} 不是有效 PNG`);
  }
  const ratesBlock=source.match(/const trainBlindBoxRates=\{[\s\S]+?\n\};/)?.[0]||'';
  const rates=[...ratesBlock.matchAll(/train_[a-z_]+:(\d+(?:\.\d+)?)/g)].map(match=>Number(match[1]));
  assert.equal(rates.length,12);
  assert.equal(rates.reduce((sum,value)=>sum+value,0),100);
  assert.match(source,/const TRAIN_BLIND_BOX_SINGLE_PRICE=50000/);
  assert.doesNotMatch(source,/TRAIN_BLIND_BOX_TEN_PRICE/);
  assert.match(source,/setCustomId\(`transport_hub_train_box:\$\{u\}`\)/);
  assert.match(source,/每天限購一盒，不提供十抽/);
  assert.match(source,/CREATE TABLE IF NOT EXISTS train_blind_box_daily/);
  assert.match(source,/purchase_day===trainBlindBoxDay\(\)/);
  assert.match(source,/bestOwnedTrain\(g,u\)/);
  assert.match(source,/route\.baseRevenue\*station\.transportMultiplier\*trainMultiplier\*truckMultiplier\*coachMultiplier\*shipMultiplier\*enterpriseRevenueMultiplier\(company\)\*dailyMultiplier\*demandMultiplier/);
  const commandStart=source.indexOf('const commands = ['),commandEnd=source.indexOf('].map(c=>c.toJSON());',commandStart);
  assert.doesNotMatch(source.slice(commandStart,commandEnd),/setName\('列車盲盒'\)/,'列車盲盒應整合在 /交通事業，不新增獨立指令');
});

test('火車站配給基礎列車並支援最多 20 格車庫',()=>{
  const starterBlock=source.match(/train_starter_service_commuter:\{[^\n]+/)?.[0]||'';
  assert.match(starterBlock,/systemGranted:true/);
  assert.match(starterBlock,/nonTransferable:true/);
  assert.match(starterBlock,/image:'trains\/starter_service_commuter\.png'/);
  const image=readFileSync(new URL('../assets/trains/starter_service_commuter.png',import.meta.url));
  assert.equal(image.subarray(1,4).toString(),'PNG');
  assert.ok(image.readUInt32BE(16)>image.readUInt32BE(20),'基礎列車圖片必須為橫向');
  assert.match(source,/const TRAIN_GARAGE_BASE_CAPACITY=1/);
  assert.match(source,/const TRAIN_GARAGE_MAX_CAPACITY=20/);
  assert.match(source,/CREATE TABLE IF NOT EXISTS train_garages/);
  assert.match(source,/火車站必須至少持有一輛列車才能發車/);
  assert.match(source,/系統配給.*不占車庫/s);
  assert.match(source,/train_garage_upgrade:\$\{ownerId\}/);
  const grantBlock=source.match(/function ensureStarterTrain\(g,u\) \{[\s\S]+?\n\}/)?.[0]||'';
  assert.ok(grantBlock,'缺少基礎列車配給函式');
  assert.doesNotMatch(grantBlock,/db\.transaction\(/,'Node DatabaseSync 不支援 db.transaction()');
  assert.match(grantBlock,/db\.exec\('BEGIN IMMEDIATE'\)/);
  assert.match(grantBlock,/db\.exec\('COMMIT'\)/);
  assert.match(grantBlock,/db\.exec\('ROLLBACK'\)/);

  const db=new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE ledger (
    guild_id TEXT, user_id TEXT, delta INTEGER, balance_after INTEGER,
    kind TEXT, actor_id TEXT, reason TEXT
  )`);
  let quantity=0,buffCount=0;
  const grantStarterTrain=new Function(
    'db','ownsRailStation','assetQuantity','ensureWallet','addAssetQuantity','ensureAssetBuff','balance',
    'TRAIN_STARTER_ASSET_ID','assetCatalog',`${grantBlock}; return ensureStarterTrain;`
  )(
    db,()=>true,()=>quantity,()=>{},(_g,_u,_id,amount)=>{quantity+=amount;},()=>{buffCount+=1;},()=>123456,
    'train_starter_service_commuter',{train_starter_service_commuter:{name:'銀灣基礎通勤列車'}}
  );
  assert.equal(grantStarterTrain('guild','player'),true,'首次應成功配給');
  assert.equal(grantStarterTrain('guild','player'),false,'再次呼叫不得重複配給');
  assert.equal(quantity,1);
  assert.equal(buffCount,1);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM ledger').get().count,1);
});

test('交通事業五種隨機事件會套用收益、成本或時間，員工罷工需玩家支付協調費',()=>{
  assert.match(source,/const transportRandomEvents=\[/);
  for(const eventId of ['tailwind','vip_contract','smart_dispatch','safety_inspection','staff_strike']) {
    assert.match(source,new RegExp(`id:'${eventId}'`),`缺少交通隨機事件 ${eventId}`);
  }
  assert.match(source,/CREATE TABLE IF NOT EXISTS transport_incidents/);
  assert.match(source,/function prepareTransportRandomEvent\(/);
  assert.match(source,/function resolveTransportStrike\(/);
  assert.match(source,/transport_strike_resolution/);
  assert.match(source,/transport_strike_pay:\$\{u\}:\$\{businessType\}/);
  assert.match(source,/if\(eventDecision\.requiresStrikeResolution\) return \{requiresStrikeResolution:true/);
  assert.match(source,/event\?\.revenueMultiplier\|\|1/);
  assert.match(source,/event\?\.durationMultiplier\|\|1/);
  assert.match(source,/event\?\.operatingCostMultiplier\|\|1/);
  assert.ok(existsSync(new URL('../updates/2026-08-06-transport-random-events.json',import.meta.url)),'缺少交通隨機事件公告');
});

test('陸路交通事業可選擇事業載具並保存到營運紀錄',()=>{
  assert.match(source,/vehicle_id TEXT/);
  assert.match(source,/ALTER TABLE transport_business_companies ADD COLUMN vehicle_id TEXT/);
  assert.match(source,/ALTER TABLE transport_business_operations ADD COLUMN vehicle_id TEXT/);
  assert.match(source,/function transportBusinessVehicleOptions\(g,u,businessType\)/);
  assert.match(source,/function selectedTransportBusinessVehicle\(g,u,businessType,company\)/);
  assert.match(source,/TRANSPORT_COACH_DEFAULT_VEHICLE_ID='coach_basic_fleet'/);
  assert.match(source,/TRANSPORT_FREIGHT_DEFAULT_VEHICLE_ID='freight_basic_fleet'/);
  assert.match(source,/setCustomId\(`transport_vehicle:\$\{u\}:\$\{businessType\}`\)/);
  assert.match(source,/const columns=\{transport_station:'station_id',transport_vehicle:'vehicle_id',transport_route:'route_id'\}/);
  const vehicleSelectionBlock=source.match(/function updateTransportBusinessSelection\([\s\S]+?\n\}/)?.[0]||'';
  assert.match(vehicleSelectionBlock,/if\(column==='vehicle_id'\)/);
  assert.match(vehicleSelectionBlock,/transportBusinessVehicleOptions\(g,u,businessType\)/);
  assert.match(vehicleSelectionBlock,/UPDATE transport_business_companies SET vehicle_id=\?/);
  assert.match(source,/INSERT INTO transport_business_operations\(guild_id,user_id,business_type,station_id,route_id,vehicle_id,train_id,truck_id/);
  assert.match(source,/assetCatalog\[operation\.vehicle_id\]/);
  assert.match(source,/事業載具：/);
  const update=JSON.parse(readFileSync(new URL('../updates/2026-08-04-transport-vehicle-selection.json',import.meta.url),'utf8'));
  assert.equal(update.id,'2026-08-04-transport-vehicle-selection');
  assert.match(update.summary,/事業載具/);
  assert.match(update.changes.join('\n'),/列車.*卡車.*客運/s);
});

test('海上船運整合交通事業，既有船舶可配置並保留舊資料庫相容性',()=>{
  for(const routeId of ['shipping_harbor_island_cruise','shipping_strait_ferry','shipping_ocean_luxury_voyage','shipping_deep_sea_expedition']) {
    assert.match(source,new RegExp(`${routeId}:`),`缺少船運航線 ${routeId}`);
  }
  const portBlock=source.match(/ocean_crown_maritime_port:\{[^\n]+/)?.[0]||'';
  assert.match(portBlock,/transportType:'shipping'/);
  assert.match(portBlock,/transportMultiplier:1\.18/);
  assert.match(source,/shipping:\{name:'海上船運',emoji:'⚓'/);
  assert.match(source,/const shippingVesselIds=\['yacht','cruise','going_merry','luxury_submarine','ghost_pirate_ship',\.\.\.shippingShopAssetIds,\.\.\.shippingBlindBoxIds\]/);
  assert.match(source,/TRANSPORT_SHIPPING_DEFAULT_VEHICLE_ID='shipping_basic_fleet'/);
  assert.match(source,/function migrateTransportBusinessTypesForShipping\(/);
  assert.match(source,/business_type IN \('rail','coach','freight','shipping'\)/);
  assert.match(source,/business_type IN \('airline','rail','coach','freight','shipping'\)/);
  for(const assetId of ['yacht','cruise','going_merry','luxury_submarine','ghost_pirate_ship']) {
    const assetBlock=source.match(new RegExp(`${assetId}:\\{[^\\n]+`))?.[0]||'';
    assert.match(assetBlock,/shipRevenueBonus:0\.\d+/);
  }
  assert.match(source,/businessType==='shipping'/);
  assert.match(source,/shipMultiplier=shipAsset\?1\+shipAsset\.shipRevenueBonus:1/);
  assert.match(source,/operation\.business_type==='shipping'\?'⚓ 執行船舶'/);
  const update=JSON.parse(readFileSync(new URL('../updates/2026-08-10-maritime-shipping.json',import.meta.url),'utf8'));
  assert.equal(update.id,'2026-08-10-maritime-shipping');
  assert.match(update.summary,/船運/);
  assert.match(update.changes.join('\n'),/海皇冠國際港/);
});

test('船運碼頭與船位可購買並限制新船舶停泊容量',()=>{
  for(const assetId of ['coral_bay_marina','ocean_crown_maritime_port','blacktide_deepwater_terminal']) {
    const assetBlock=source.match(new RegExp(`${assetId}:\\{[^\\n]+`))?.[0]||'';
    assert.match(assetBlock,/category:'碼頭'/,`${assetId} 未分類為碼頭`);
    assert.match(assetBlock,/transportType:'shipping'/,`${assetId} 未整合船運`);
    assert.match(assetBlock,/shippingBerths:\d+/,`${assetId} 缺少基礎船位`);
  }
  const berthBlock=source.match(/shipping_berth_expansion:\{[^\n]+/)?.[0]||'';
  assert.match(berthBlock,/category:'碼頭'/);
  assert.match(berthBlock,/shippingBerthExpansion:1/);
  assert.match(berthBlock,/maxOwned:16/);
  assert.match(source,/dock:\{label:'船運碼頭・船位',emoji:'⚓',catalog:\['碼頭'\]\}/);
  assert.match(source,/const SHIPPING_BERTH_EXPANSION_ID='shipping_berth_expansion'/);
  assert.match(source,/function shippingBerthCapacity\(g,u\)/);
  assert.match(source,/function shippingBerthStatus\(g,u\)/);
  assert.match(source,/船位不足（目前船舶/);
  assert.match(source,/請先到 \/資產商城 分類:碼頭 購買碼頭/);
  assert.match(source,/碼頭船位：/);
  const update=JSON.parse(readFileSync(new URL('../updates/2026-08-10-maritime-docks-berths.json',import.meta.url),'utf8'));
  assert.equal(update.id,'2026-08-10-maritime-docks-berths');
  assert.match(update.changes.join('\n'),/船位/);
});

test('三座船運碼頭都有獨立的商城橫向圖片',()=>{
  for(const assetId of ['coral_bay_marina','ocean_crown_maritime_port','blacktide_deepwater_terminal']) {
    const assetBlock=source.match(new RegExp(`${assetId}:\\{[^\\n]+`))?.[0]||'';
    const image=`properties/docks/${assetId}.png`;
    assert.match(assetBlock,new RegExp(`image:'${image}'`),`${assetId} 未使用專屬圖片`);
    const file=readFileSync(new URL(`../assets/${image}`,import.meta.url));
    assert.equal(file.subarray(1,4).toString(),'PNG',`${assetId} 圖片不是 PNG`);
  }
  const update=JSON.parse(readFileSync(new URL('../updates/2026-08-10-maritime-dock-art.json',import.meta.url),'utf8'));
  assert.equal(update.id,'2026-08-10-maritime-dock-art');
  assert.match(update.changes.join('\n'),/獨立圖片/);
});

test('船運新增五艘直購船與十艘每日盲盒限定船',()=>{
  const shopIds=['ship_azure_catamaran','ship_coral_ferry','ship_jade_expedition','ship_golden_riverbarge','ship_obsidian_icebreaker'];
  const blindIds=['ship_box_seaglass_skiff','ship_box_sunset_hydrofoil','ship_box_moonlit_junk','ship_box_amber_diver','ship_box_neon_tide_runner','ship_box_royal_paddle','ship_box_coral_glass_yacht','ship_box_aurora_trawler','ship_box_crimson_phoenix_cruise','ship_box_starlight_leviathan'];
  for(const assetId of [...shopIds,...blindIds]) {
    const assetBlock=source.match(new RegExp(`${assetId}:\\{[^\\n]+`))?.[0]||'';
    assert.match(assetBlock,/category:'郵輪'/,`${assetId} 未加入船舶商城分類`);
    assert.match(assetBlock,/shipRevenueBonus:0\.\d+/,`${assetId} 缺少船運收益加成`);
    const image=assetBlock.match(/image:'([^']+)'/)?.[1];
    assert.ok(image&&existsSync(new URL(`../assets/${image}`,import.meta.url)),`${assetId} 缺少圖片`);
  }
  assert.match(source,/const SHIPPING_BLIND_BOX_SINGLE_PRICE=350000/);
  assert.match(source,/const shippingBlindBoxIds=Object\.keys\(shippingBlindBoxRates\)/);
  assert.match(source,/function openShippingBlindBox\(g,u\)/);
  assert.match(source,/今天已購買過船運盲盒/);
  assert.match(source,/船位不足（目前船舶/);
  assert.match(source,/transport_hub_shipping_box/);
  assert.match(source,/已收集：\*\*\$\{ownedKinds\}\/10 種\*\*/);
  const update=JSON.parse(readFileSync(new URL('../updates/2026-08-10-shipping-fleet-blind-box.json',import.meta.url),'utf8'));
  assert.equal(update.id,'2026-08-10-shipping-fleet-blind-box');
  assert.match(update.changes.join('\n'),/10 艘/);
});

test('長途交通網與客運盲盒提供二十輛巴士、圖片及客運營收加成',()=>{
  for(const routeId of ['pacific_crown_longhaul','rail_continental_sleeper','coach_grand_tour_longhaul','freight_transcontinental_corridor']) {
    assert.match(source,new RegExp(`${routeId}:`),`缺少長途路線 ${routeId}`);
  }
  assert.match(source,/const coachShopBusDefinitions=\[/);
  assert.match(source,/const coachBlindBoxDefinitions=\[/);
  assert.match(source,/const coachShopBusIds=coachShopBusDefinitions\.map/);
  assert.match(source,/const coachBlindBoxIds=Object\.keys\(coachBlindBoxRates\)/);
  assert.match(source,/COACH_BLIND_BOX_SINGLE_PRICE=150000/);
  assert.match(source,/CREATE TABLE IF NOT EXISTS coach_blind_box_daily/);
  assert.match(source,/function openCoachBlindBox\(g,u\)/);
  assert.match(source,/coachRevenueBonus/);
  assert.match(source,/transport_hub_coach_box/);
  assert.match(source,/category:'客運巴士'/);
  for(const image of ['shop_midnight_navy','shop_amber_desert','box_sunrise_city','box_starlight_sleeper']) {
    assert.ok(existsSync(new URL(`../assets/buses/${image}.png`,import.meta.url)),`缺少客運巴士圖片 ${image}`);
  }
  const update=JSON.parse(readFileSync(new URL('../updates/2026-08-10-longhaul-coach-fleet.json',import.meta.url),'utf8'));
  assert.equal(update.id,'2026-08-10-longhaul-coach-fleet');
  assert.match(update.summary,/長途/);
  assert.match(update.changes.join('\n'),/商城.*10 輛.*盲盒.*10 輛/s);
});

test('搶劫備援與貨運站圖片修復公告完整',()=>{
  const update=JSON.parse(readFileSync(new URL('../updates/2026-07-31-heist-fallback-freight-image.json',import.meta.url),'utf8'));
  assert.equal(update.id,'2026-07-31-heist-fallback-freight-image');
  assert.equal(update.changes.length,7);
  assert.match(update.summary,/皇冠港物流貨運站圖片/);
  assert.match(update.changes.join('\n'),/Invalid Webhook Token/);
  assert.match(update.changes.join('\n'),/不會重複派彩或處罰/);
});

test('歐印勇者每日一次更新公告完整',()=>{
  const update=JSON.parse(readFileSync(new URL('../updates/2026-07-31-all-in-hero-daily-limit.json',import.meta.url),'utf8'));
  assert.equal(update.id,'2026-07-31-all-in-hero-daily-limit');
  assert.equal(update.version,'2026.07.31.3');
  assert.match(update.summary,/每天最多發動一次/);
  assert.match(update.changes.join('\n'),/台北時間 00:00/);
  assert.match(update.changes.join('\n'),/普通歐印次數.*歐印警報/s);
});

test('K 佬洗車與闖空門金額更新公告完整',()=>{
  const update=JSON.parse(readFileSync(new URL('../updates/2026-07-31-k-car-wash-burglary-loot.json',import.meta.url),'utf8'));
  assert.equal(update.id,'2026-07-31-k-car-wash-burglary-loot');
  assert.equal(update.version,'2026.07.31.4');
  assert.match(update.summary,/幫 K 佬洗車/);
  assert.match(update.changes.join('\n'),/12,000.*20,000/s);
  assert.match(update.changes.join('\n'),/最多 50%/);
});

test('指令整合玩法公告列出所有新版入口',()=>{
  const update=JSON.parse(readFileSync(new URL('../updates/2026-07-31-command-hubs-gameplay-guide.json',import.meta.url),'utf8'));
  assert.equal(update.id,'2026-07-31-command-hubs-gameplay-guide');
  assert.equal(update.version,'2026.07.31.5');
  assert.match(update.summary,/68 個精簡為 41 個/);
  for(const command of ['/小遊戲','/玩家','/日常','/補給','/寵物','/交通事業','/玩法']) {
    assert.match(update.changes.join('\n'),new RegExp(command.replace('/','\\/')),`玩法公告缺少 ${command}`);
  }
  assert.match(update.note,/不是遊戲或功能/);
});

test('列車盲盒更新公告包含售價、十抽與營收規則',()=>{
  const update=JSON.parse(readFileSync(new URL('../updates/2026-07-31-train-blind-box.json',import.meta.url),'utf8'));
  assert.equal(update.id,'2026-07-31-train-blind-box');
  assert.equal(update.version,'2026.07.31.6');
  assert.match(update.summary,/12 輛列車/);
  assert.match(update.changes.join('\n'),/50,000.*480,000/s);
  assert.match(update.changes.join('\n'),/傳說/);
  assert.match(update.changes.join('\n'),/最高.*營收加成/s);
});

test('列車營運、每日盲盒與公司分流公告完整',()=>{
  const update=JSON.parse(readFileSync(new URL('../updates/2026-08-01-train-operations-garage.json',import.meta.url),'utf8'));
  assert.equal(update.id,'2026-08-01-train-operations-garage');
  assert.equal(update.version,'2026.08.01.2');
  assert.equal(update.changes.length,7);
  assert.match(update.summary,/基礎列車/);
  assert.match(update.changes.join('\n'),/20 格/);
  assert.match(update.changes.join('\n'),/每日限購 1 盒/);
  assert.match(update.changes.join('\n'),/同時進行鐵路與客運/);
  assert.match(update.changes.join('\n'),/自動遷移/);
});

test('萌犬豪華客機與闖空門平衡公告完整',()=>{
  const update=JSON.parse(readFileSync(new URL('../updates/2026-08-01-puppy-airliner-burglary-balance.json',import.meta.url),'utf8'));
  assert.equal(update.id,'2026-08-01-puppy-airliner-burglary-balance');
  assert.equal(update.version,'2026.08.01.3');
  assert.equal(update.changes.length,7);
  assert.match(update.summary,/萌犬豪華客機/);
  assert.match(update.changes.join('\n'),/15%～30%/);
  assert.match(update.changes.join('\n'),/賭場公告/);
});

test('交通事業基礎列車交易錯誤修正公告完整',()=>{
  const update=JSON.parse(readFileSync(new URL('../updates/2026-08-01-starter-train-transaction-fix.json',import.meta.url),'utf8'));
  assert.equal(update.id,'2026-08-01-starter-train-transaction-fix');
  assert.equal(update.version,'2026.08.01.4');
  assert.match(update.summary,/db\.transaction is not a function/);
  assert.match(update.changes.join('\n'),/BEGIN IMMEDIATE.*COMMIT.*ROLLBACK/s);
  assert.match(update.changes.join('\n'),/既有.*不會重複/s);
});

test('交通事業面板公開顯示並於閒置三分鐘後刪除',async()=>{
  assert.match(source,/const TRANSPORT_PANEL_IDLE_MS=3\*60\*1000/);
  assert.match(source,/const transportPanelDeletionTimers=new Map\(\)/);
  const scheduleBlock=source.match(/function scheduleTransportPanelDeletion\(message\) \{[\s\S]+?\n\}/)?.[0]||'';
  assert.ok(scheduleBlock,'缺少交通事業閒置刪除排程');
  assert.match(scheduleBlock,/clearTimeout\(previous\)/,'每次操作必須取消舊計時器');
  assert.match(scheduleBlock,/message\.delete\(\)/,'閒置後必須刪除公開訊息');
  assert.match(scheduleBlock,/transportPanelDeletionTimers\.set\(message\.id,timer\)/);
  const timers=new Map(),scheduled=[],cleared=[];
  const schedule=new Function(
    'transportPanelDeletionTimers','setTimeout','clearTimeout','TRANSPORT_PANEL_IDLE_MS','console',
    `${scheduleBlock}; return scheduleTransportPanelDeletion;`
  )(
    timers,
    (callback,delay)=>{const timer={callback,delay,unref(){}};scheduled.push(timer);return timer;},
    timer=>cleared.push(timer),
    180000,
    {error() {}}
  );
  let deletions=0;
  const message={id:'transport-message',delete:async()=>{deletions+=1;}};
  assert.equal(schedule(message),true);
  assert.equal(schedule(message),true);
  assert.equal(scheduled.length,2);
  assert.equal(cleared.length,1,'重新操作必須取消第一個計時器');
  assert.equal(scheduled[1].delay,180000);
  await scheduled[0].callback();
  assert.equal(deletions,0,'被取消的舊計時器不得刪除面板');
  await scheduled[1].callback();
  assert.equal(deletions,1,'最新計時器到期時必須刪除面板');
  assert.match(source,/function touchTransportPanelInteraction\(i\)/);
  assert.match(source,/i\.user\?\.id!==ownerId/,'其他玩家操作不得延長面板存活時間');
  assert.match(source,/async function handleInteraction\(i\) \{\r?\n  touchTransportPanelInteraction\(i\);/);
  const commandBlock=source.match(/if\(i\.commandName==='交通事業'\) \{[\s\S]+?\n    \}/)?.[0]||'';
  assert.match(commandBlock,/return replyTransportPanel\(i,/,'交通事業必須使用公開面板回覆');
  assert.doesNotMatch(commandBlock,/ephemeral:true/,'交通事業面板不可設為只有本人可見');
  assert.match(source,/公開面板｜只有事業擁有者可操作｜最後一次操作 3 分鐘後自動刪除/);
});

test('交通事業公開面板更新公告完整',()=>{
  const update=JSON.parse(readFileSync(new URL('../updates/2026-08-01-transport-public-idle-delete.json',import.meta.url),'utf8'));
  assert.equal(update.id,'2026-08-01-transport-public-idle-delete');
  assert.equal(update.version,'2026.08.01.5');
  assert.match(update.summary,/所有人/);
  assert.match(update.changes.join('\n'),/3 分鐘/);
  assert.match(update.changes.join('\n'),/重新計時/);
  assert.match(update.changes.join('\n'),/事業擁有者/);
});

test('交通事業指揮中心提供即時調度與任務預演',()=>{
  assert.match(source,/function transportNetworkMeter\(value,total=5\)/);
  assert.match(source,/function transportNetworkSnapshot\(g,u\)/);
  assert.match(source,/MACAU TRANSIT COMMAND \/\/ LIVE NETWORK/);
  assert.match(source,/LAND & MARITIME OPERATIONS \/\/ DISPATCH BOARD/);
  assert.match(source,/即時調度/);
  assert.match(source,/收益待收/);
  assert.match(source,/下一趟任務預演/);
  assert.match(source,/LIVE DISPATCH/);
  const update=JSON.parse(readFileSync(new URL('../updates/2026-08-09-transport-command-center.json',import.meta.url),'utf8'));
  assert.equal(update.id,'2026-08-09-transport-command-center');
  assert.match(update.changes.join('\n'),/即時調度/);
});

test('Oracle 一鍵部署腳本具備增量、備份、測試與安全清理',()=>{
  const local=readFileSync(new URL('../scripts/deploy_oracle.ps1',import.meta.url),'utf8');
  const remote=readFileSync(new URL('../scripts/deploy_oracle_remote.sh',import.meta.url),'utf8');
  const backup=readFileSync(new URL('../scripts/backup_sqlite.mjs',import.meta.url),'utf8');
  assert.match(local,/git diff --name-status --find-renames/);
  assert.match(local,/\.deployed_commit/);
  assert.match(local,/tar\.exe -cf \$BundlePath .* -T \$CopyListPath/);
  assert.match(local,/deployment files have uncommitted changes/);
  assert.match(local,/git ls-files --others --exclude-standard/);
  assert.match(local,/git cat-file -e "\$\{HeadCommit\}:\$relative"/);
  assert.match(local,/node\.exe --check src\/index\.js/);
  assert.match(local,/npm\.cmd test/);
  assert.match(local,/git push origin HEAD:main/);
  assert.match(local,/sed -i 's\/\\r\$\/\/'.*deploy_oracle_remote\.sh/);
  assert.match(local,/Copy-Item -LiteralPath \$SshKey -Destination \$TempKey/);
  assert.match(local,/Remove-Item -LiteralPath \$ResolvedTemp -Recurse -Force/);
  assert.doesNotMatch(local,/BEGIN (?:OPENSSH|RSA|EC) PRIVATE KEY/);

  assert.match(remote,/VACUUM INTO|backup_sqlite\.mjs/);
  assert.match(remote,/discord-casino-backup:pre-\$SHORT_COMMIT/);
  assert.match(remote,/DOCKER_BUILDKIT=1 docker compose build/);
  assert.match(remote,/docker run --rm .* npm test/s);
  assert.match(remote,/COMMAND_BUILD_ONLY=1/);
  assert.match(remote,/docker compose up -d --no-deps/);
  assert.match(remote,/sync_activity_public_url/);
  assert.match(remote,/ACTIVITY_PUBLIC_URL_SYNC_OK/);
  assert.match(remote,/trycloudflare\\.com/);
  assert.match(remote,/grep -Fq '已登入：'/);
  assert.match(remote,/running_image.*expected_image/s);
  assert.match(remote,/publish_update\.js/);
  assert.match(remote,/refusing non-deploy deletion/);
  assert.match(remote,/ORACLE_DEPLOY_OK/);

  assert.match(backup,/new DatabaseSync\(source\)/);
  assert.match(backup,/PRAGMA integrity_check/);
  assert.match(backup,/BACKUP_OK/);
});

test('5 款商城列車附有橫向圖片、價格、營收加成與車庫限制',()=>{
  const trainIds=[
    'train_silverwing_metropolitan_express','train_coral_coast_panorama','train_emerald_titan_freight',
    'train_royal_blue_diamond_sleeper','train_crimson_phoenix_high_speed'
  ];
  const expected={
    train_silverwing_metropolitan_express:{image:'silverwing_metropolitan_express.png',price:180000,bonus:'0.05'},
    train_coral_coast_panorama:{image:'coral_coast_panorama.png',price:420000,bonus:'0.09'},
    train_emerald_titan_freight:{image:'emerald_titan_freight.png',price:850000,bonus:'0.14'},
    train_royal_blue_diamond_sleeper:{image:'royal_blue_diamond_sleeper.png',price:1800000,bonus:'0.22'},
    train_crimson_phoenix_high_speed:{image:'crimson_phoenix_high_speed.png',price:3600000,bonus:'0.32'}
  };
  assert.equal(trainIds.length,5);
  for(const assetId of trainIds) {
    const assetBlock=source.match(new RegExp(`${assetId}:\\{[^\\n]+`))?.[0]||'';
    assert.match(assetBlock,/category:'列車'/,`${assetId} 不是列車資產`);
    assert.match(assetBlock,new RegExp(`price:${expected[assetId].price}(?:,|})`),`${assetId} 售價錯誤`);
    assert.match(assetBlock,new RegExp(`trainRevenueBonus:${expected[assetId].bonus}(?:,|})`),`${assetId} 營收加成錯誤`);
    assert.doesNotMatch(assetBlock,/forSale:false/,`${assetId} 不應被商城隱藏`);
    const imagePath=`trains/${expected[assetId].image}`;
    assert.match(assetBlock,new RegExp(`image:'${imagePath.replaceAll('/','\\/')}'`));
    const image=readFileSync(new URL(`../assets/${imagePath}`,import.meta.url));
    assert.equal(image.subarray(1,4).toString(),'PNG',`${imagePath} 不是有效 PNG`);
    assert.equal(image.readUInt32BE(16),1536,`${imagePath} 寬度錯誤`);
    assert.equal(image.readUInt32BE(20),1024,`${imagePath} 高度錯誤`);
  }
  assert.match(source,/train:\{label:'列車',emoji:'🚆',catalog:\['列車'\]\}/);
  assert.match(source,/const trainShopAssetIds=\[[\s\S]+?train_crimson_phoenix_high_speed[\s\S]+?\];/);
  assert.match(source,/const trainAssetIds=\[TRAIN_STARTER_ASSET_ID,\.\.\.trainBlindBoxIds,\.\.\.trainShopAssetIds\]/);
  assert.match(source,/function ownedGarageTrainCount\(g,u\)/);
  assert.match(source,/if\(used\+quantity>garage\.capacity\) throw new Error\(`列車車庫空間不足/);
  assert.match(source,/buffId==='transport'.*trainRevenueBonus/s);

  const update=JSON.parse(readFileSync(new URL('../updates/2026-08-01-train-shop-five-models.json',import.meta.url),'utf8'));
  assert.equal(update.id,'2026-08-01-train-shop-five-models');
  assert.equal(update.version,'2026.08.01.7');
  assert.match(update.summary,/5 款/);
  assert.match(update.changes.join('\n'),/180,000.*3,600,000/s);
  assert.match(update.changes.join('\n'),/5%.*32%/s);
  assert.match(update.changes.join('\n'),/車庫/);
});

test('13 款機車資產已全面換用新版圖片',()=>{
  const motorcycleIds=[
    'purple_street_scooter','orange_dirtbike','blue_naked','bosozoku','wasteland_raider',
    'electric_scooter','red_touring','purple_chopper','red_falcon','silver_cruiser',
    'platinum_tourer','neon_nuclear','shadow_hoverbike'
  ];
  assert.equal(motorcycleIds.length,13);
  for(const assetId of motorcycleIds) {
    const assetBlock=source.match(new RegExp(`${assetId}:\\{[^\\n]+`))?.[0]||'';
    assert.match(assetBlock,/category:'機車'/,`${assetId} 不是機車資產`);
    const image=assetBlock.match(/image:'([^']+)'/)?.[1];
    assert.equal(image,`motorcycles/${assetId}.png`,`${assetId} 圖片路徑不正確`);
    const file=readFileSync(new URL(`../assets/${image}`,import.meta.url));
    assert.equal(file.subarray(1,4).toString(),'PNG',`${image} 不是有效 PNG`);
    const width=file.readUInt32BE(16),height=file.readUInt32BE(20);
    assert.ok(width>=1500&&height>=900&&width>height,`${image} 解析度或方向不符合新版規格：${width}x${height}`);
  }
});

test('機車資產美術重製公告完整',()=>{
  const update=JSON.parse(readFileSync(new URL('../updates/2026-08-01-motorcycle-art-redesign.json',import.meta.url),'utf8'));
  assert.equal(update.id,'2026-08-01-motorcycle-art-redesign');
  assert.equal(update.version,'2026.08.01.1');
  assert.match(update.summary,/13 款機車/);
  assert.match(update.changes.join('\n'),/永久移除/);
  assert.match(update.changes.join('\n'),/價格、稀有度.*持有資料/s);
});

test('20 款卡車加入物流貨運並套用最高收益加成',()=>{
  const truckIds=[
    'truck_copper_canyon_hauler','truck_azure_tide_refrigerated','truck_emerald_city_delivery','truck_royal_crown_logistics',
    'truck_crimson_mountain_climber','truck_sapphire_coastal_freighter','truck_golden_sun_bulkmaster','truck_midnight_stealth_carrier',
    'truck_jade_river_tanker','truck_silver_frost_express','truck_neon_lotus_cityrunner','truck_ironwood_heavy_lifter',
    'truck_coral_reef_logistics','truck_violet_comet_courier','truck_emberforge_armored','truck_aurora_polar_freighter',
    'truck_harbor_blue_containerliner','truck_sunset_peach_foodliner','truck_obsidian_titan_transporter','truck_starlight_silver_longhaul'
  ];
  assert.equal(truckIds.length,20);
  for(const assetId of truckIds) {
    const assetBlock=source.match(new RegExp(`${assetId}:\\{[^\\n]+`))?.[0]||'';
    assert.match(assetBlock,/category:'卡車'/,`${assetId} 不是卡車資產`);
    assert.match(assetBlock,/buff:'freight'/,`${assetId} 未綁定物流車隊增益`);
    assert.match(assetBlock,/truckRevenueBonus:0\.\d+/,`${assetId} 缺少貨運營收加成`);
    const image=assetBlock.match(/image:'([^']+)'/)?.[1];
    assert.equal(image,`trucks/${assetId.replace(/^truck_/,'')}.png`,`${assetId} 圖片路徑不正確`);
    const file=readFileSync(new URL(`../assets/${image}`,import.meta.url));
    assert.equal(file.subarray(1,4).toString(),'PNG',`${image} 不是有效 PNG`);
    assert.equal(file.readUInt32BE(16),1536,`${image} 寬度錯誤`);
    assert.equal(file.readUInt32BE(20),1024,`${image} 高度錯誤`);
  }
  assert.match(source,/const assetCategories=\[[^\]]*'卡車'/);
  assert.match(source,/truck:\{label:'卡車',emoji:'🚛',catalog:\['卡車'\]\}/);
  assert.match(source,/const freightTruckIds=\[[\s\S]+?truck_starlight_silver_longhaul[\s\S]+?\];/);
  assert.match(source,/function bestOwnedFreightTruck\(g,u\)/);
  assert.match(source,/businessType==='freight'\?bestOwnedFreightTruck\(g,u\)/);
  assert.match(source,/truckMultiplier=truckAsset\?1\+truckAsset\.truckRevenueBonus:1/);
  assert.match(source,/route\.baseRevenue\*station\.transportMultiplier\*trainMultiplier\*truckMultiplier/);
  assert.match(source,/truck_id TEXT/);
  assert.match(source,/ALTER TABLE transport_business_operations ADD COLUMN truck_id TEXT/);
  assert.match(source,/truck_id,gross_revenue/);
  assert.match(source,/operation\.business_type==='freight'\s*\?\s*assetCatalog\[operation\.truck_id\]/);

  const update=JSON.parse(readFileSync(new URL('../updates/2026-08-02-freight-trucks.json',import.meta.url),'utf8'));
  assert.equal(update.id,'2026-08-02-freight-trucks');
  assert.match(update.summary,/20 輛卡車/);
  assert.match(update.changes.join('\n'),/物流貨運/);
  assert.match(update.changes.join('\n'),/最高.*加成/s);
});

test('BAGE 黑金猛禽卡車加入資產商城與物流貨運',()=>{
  const assetBlock=source.match(/truck_bage_blackgold_rival:\{[^\n]+/)?.[0]||'';
  assert.match(assetBlock,/name:'🐦‍⬛ BAGE 黑金猛禽卡車'/);
  assert.match(assetBlock,/category:'卡車'/);
  assert.match(assetBlock,/price:56000000/);
  assert.match(assetBlock,/rarity:'限定'/);
  assert.match(assetBlock,/buff:'freight'/);
  assert.match(assetBlock,/truckRevenueBonus:0\.70/);
  assert.match(assetBlock,/forSale:true/);
  assert.match(assetBlock,/image:'trucks\/bage_blackgold_rival\.png'/);
  const freight=source.match(/const freightTruckIds=\[[\s\S]+?\n\];/)?.[0]||'';
  assert.match(freight,/'truck_bage_blackgold_rival'/);
  const image=readFileSync(new URL('../assets/trucks/bage_blackgold_rival.png',import.meta.url));
  assert.equal(image.subarray(1,4).toString(),'PNG');
  const width=image.readUInt32BE(16),height=image.readUInt32BE(20);
  assert.ok(width>=1200&&height>=900&&width>height,`BAGE 卡車圖片規格錯誤：${width}x${height}`);
});

test('Oracle 部署將大型素材改用掛載並支援跳過 Docker 重建',()=>{
  const dockerignore=readFileSync(new URL('../.dockerignore',import.meta.url),'utf8');
  const dockerfile=readFileSync(new URL('../Dockerfile',import.meta.url),'utf8');
  const compose=readFileSync(new URL('../docker-compose.yml',import.meta.url),'utf8');
  const remote=readFileSync(new URL('../scripts/deploy_oracle_remote.sh',import.meta.url),'utf8');
  assert.doesNotMatch(dockerignore,/!assets\//,'assets 不應重新加入 Docker build context');
  assert.doesNotMatch(dockerfile,/COPY assets \.\/assets/,'Dockerfile 不應打包整個 assets');
  assert.match(compose,/\.\/assets:\/app\/assets:ro/);
  assert.match(compose,/\.\/src:\/app\/src:ro/);
  assert.match(compose,/\.\/updates:\/app\/updates:ro/);
  assert.match(remote,/IMAGE_BUILD_REQUIRED/);
  assert.match(remote,/IMAGE_BUILD_SKIPPED/);
  assert.match(remote,/assets\/\*\|activity\/public\/\*\|scripts\/\*\|updates\/\*\|tests\/\*/);
  assert.match(remote,/--force-recreate/);
});

test('鐵路、客運與貨運各新增三條可運行路線',()=>{
  const routeSource=source.match(/const transportRoutes=(\{[\s\S]+?\n\});/)?.[1];
  assert.ok(routeSource,'缺少陸路交通路線表');
  const routes=new Function(`return ${routeSource}`)();
  const expected={
    rail_harbor_coastal_liner:['rail',155000,52000,20*60*1000,12],
    rail_alpine_scenic_express:['rail',410000,145000,45*60*1000,24],
    rail_aurora_interregional:['rail',900000,330000,90*60*1000,38],
    coach_airport_connector:['coach',70000,22000,12*60*1000,8],
    coach_mountain_scenic_loop:['coach',220000,70000,35*60*1000,18],
    coach_night_vip_sleeper:['coach',560000,190000,75*60*1000,30],
    freight_cold_chain_network:['freight',210000,68000,25*60*1000,14],
    freight_rail_intermodal:['freight',780000,280000,75*60*1000,32],
    freight_ocean_bridge_contract:['freight',1900000,760000,3*60*60*1000,50]
  };
  for(const [routeId,[type,baseRevenue,operatingCost,durationMs,stamina]] of Object.entries(expected)) {
    const route=routes[routeId];
    assert.ok(route,`${routeId} 未加入路線表`);
    assert.equal(route.type,type,`${routeId} 類型不正確`);
    assert.equal(route.durationMs,durationMs,`${routeId} 時間不正確`);
    assert.equal(route.baseRevenue,baseRevenue,`${routeId} 基礎營收不正確`);
    assert.equal(route.operatingCost,operatingCost,`${routeId} 營運成本不正確`);
    assert.equal(route.stamina,stamina,`${routeId} 體力不正確`);
  }
  assert.equal(Object.values(routes).filter(route=>route.type==='rail').length,7,'鐵路路線數量不正確');
  assert.equal(Object.values(routes).filter(route=>route.type==='coach').length,7,'客運路線數量不正確');
  assert.equal(Object.values(routes).filter(route=>route.type==='freight').length,7,'貨運路線數量不正確');
  assert.match(source,/Object\.entries\(transportRoutes\)\.filter\(\(\[,route\]\)=>route\.type===businessType\)/,'路線選單應自動包含新增路線');
});

test('移除未接線的舊版造型、交通與下注輔助碼',()=>{
  const obsoleteHelpers=[
    'validateAppearance','savePlayerAppearance','purchaseCosmetic','appearancePresets','saveAppearancePreset','appearanceNames',
    'ownedBlindBoxTrainCount','transportCompany','transportOperation','registerTransportCompany',
    'transportDashboardEmbed','transportDashboardComponents','updateTransportSelection','startTransportOperation',
    'claimTransportRevenue','assetBuffCount','addWagerOptions'
  ];
  for(const helper of obsoleteHelpers) {
    assert.doesNotMatch(source,new RegExp(`function ${helper}\\(`),`舊版未使用函式仍存在：${helper}`);
  }
  assert.doesNotMatch(source,/const fordBlindBoxPublicIds=/,'未使用的福特盲盒清單仍存在');
  for(const activeHelper of ['playerAppearance','transportHubEmbed','registerTransportBusinessCompany','startTransportBusinessOperation']) {
    assert.match(source,new RegExp(`function ${activeHelper}\\(`),`現行功能不應被誤刪：${activeHelper}`);
  }
});

test('房地產事業提供建築外觀、維護、牌照、升級與市場事件',()=>{
  const properties=[
    ['jade_bay_serviced_residences','properties/real-estate/jade-bay-residences.png'],
    ['obsidian_finance_center','properties/real-estate/obsidian-finance-center.png'],
    ['crown_harbor_grand_hotel','properties/real-estate/crown-harbor-grand-hotel.png']
  ];
  for(const [assetId,imagePath] of properties) {
    const block=source.match(new RegExp(`${assetId}:\\{[^\\n]+`))?.[0]||'';
    assert.match(block,/category:'房地產'/);
    assert.match(block,/propertyBusiness:\{/);
    assert.match(block,new RegExp(`image:'${imagePath.replace(/[/.]/g,'\\$&')}'`));
    const image=readFileSync(new URL(`../assets/${imagePath}`,import.meta.url));
    assert.equal(image.subarray(1,4).toString(),'PNG',`${assetId} 缺少 PNG 外觀素材`);
    assert.ok(image.readUInt32BE(16)>image.readUInt32BE(20),`${assetId} 建築外觀必須為橫向`);
  }
  for(const table of ['property_businesses','property_operations']) assert.match(source,new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
  for(const helper of ['registerPropertyBusiness','startPropertyOperation','claimPropertyRevenue','upgradePropertyBusiness','propertyBusinessPayload']) {
    assert.match(source,new RegExp(`function ${helper}\\(`),`缺少房地產功能：${helper}`);
  }
  assert.match(source,/propertyRevenueEvents=/);
  assert.match(source,/setName\('房地產'\)/);
  const propertyInteraction=source.match(/if\(i\.isButton\(\)&&i\.customId\.startsWith\('property_'\)[\s\S]+?\n  \}/)?.[0]||'';
  assert.match(propertyInteraction,/await i\.deferUpdate\(\)/,'房地產按鈕應先確認互動，避免升級時逾時');
  assert.match(propertyInteraction,/i\.editReply\(propertyBusinessPayload/,'房地產按鈕確認後應更新原面板');
  assert.match(source,/if\(!operation\) actions\.push\(new ButtonBuilder\(\)\.setCustomId\(`property_refresh:\$\{u\}:\$\{selected\.asset_id\}`\)/,'招商中不可重複建立重新整理按鈕');
  assert.match(source,/setCustomId\(`property_upgrade:\$\{u\}:\$\{selected\.asset_id\}`\)[\s\S]{0,180}setDisabled\(propertyUpgradeCost\(asset,business\)===null\)/,'招商進行中仍應可升級建築');
  assert.match(source,/if\(i\.commandName==='房地產'\) \{\s+await i\.deferReply\(\);\s+return i\.editReply\(propertyBusinessPayload\(g,u\)\);/,'房地產指令應先確認互動');
  const update=JSON.parse(readFileSync(new URL('../updates/2026-08-06-real-estate-business.json',import.meta.url),'utf8'));
  assert.equal(update.id,'2026-08-06-real-estate-business');
  assert.match(update.changes.join('\n'),/維護與保險/);
  assert.match(update.changes.join('\n'),/Lv\.10/);
});

test('世界首領提供共享血量、體力挑戰、貢獻排行與寶庫比例獎勵',()=>{
  assert.match(source,/CREATE TABLE IF NOT EXISTS world_bosses/);
  assert.match(source,/CREATE TABLE IF NOT EXISTS world_boss_contributions/);
  assert.match(source,/const WORLD_BOSS_MAX_HP=9_000_000/);
  assert.match(source,/const WORLD_BOSS_STAMINA_COST=25/);
  assert.match(source,/WORLD_BOSS_WEEKDAY_WINDOWS/);
  assert.match(source,/WORLD_BOSS_WEEKEND_WINDOWS/);
  for(const helper of ['worldBossForGuild','worldBossAttack','worldBossEmbed','worldBossComponents']) {
    assert.match(source,new RegExp(`function ${helper}\\(`),`缺少世界首領功能：${helper}`);
  }
  assert.match(source,/async function handleWorldBossInteraction/);
  assert.match(source,/return handleWorldBossInteraction\(i\)/);
  assert.match(source,/setName\('世界首領'\)/);
  assert.match(source,/world_boss_attack/);
  assert.match(source,/changeCasinoVaultUnlocked\(g,-payoutPool,'world_boss_reward'/);
  assert.match(source,/changeBalanceUnlocked\(g,row\.user_id,reward,'world_boss_reward'/);
  const update=JSON.parse(readFileSync(new URL('../updates/2026-08-06-world-boss.json',import.meta.url),'utf8'));
  assert.equal(update.id,'2026-08-06-world-boss');
  assert.match(update.changes.join('\n'),/最後一擊/);
  assert.match(update.changes.join('\n'),/平日 12:00–14:00/);
});
