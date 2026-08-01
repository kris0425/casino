import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const source=readFileSync(new URL('../src/index.js',import.meta.url),'utf8');

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
  assert.match(source,/玩家:\{金庫:'金庫',資料:'個人資料',成就:'成就',稱號:'稱號'\}/);
  assert.match(source,/日常:\{領取:'每日',增益:'每日增益',體力:'體力',回體力:'每日回體力'\}/);
  assert.match(source,/補給:\{商城:'商城',背包:'背包',購買:'購買',使用:'使用'\}/);
  assert.match(source,/寵物:\{商店:'寵物店',我的:'我的寵物'\}/);
  for(const game of ['比大小','射龍門','賽馬','競速','寵物競賽','競速pvp','寵物競速pvp','骰盅吹牛','大老二','角子機','幸運輪盤','大樂透','賓果','刮刮樂','麻將','決鬥']) {
    assert.match(source,new RegExp(`command:'${game}'`),`/${game} 移除後未保留在小遊戲選單`);
  }
  assert.match(source,/miniGameProxyInteraction\(i,game\.command/);
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
    grand_world_odyssey:2550000
  };
  for(const [routeId,revenue] of Object.entries(expectedRevenue)) {
    assert.match(airlineBlock,new RegExp(`${routeId}:\\{[^\\n]+baseRevenue:${revenue}(?:,|\\})`),`${routeId} 基礎營收不正確`);
  }
  assert.equal((airlineBlock.match(/baseRevenue:/g)||[]).length,9,'航空航線數量或營收設定異常');
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
  assert.match(source,/route\.baseRevenue\*airport\.airlineMultiplier\*airlinerRevenueMultiplier\(company\.aircraft_id\)\*enterpriseRevenueMultiplier\(company\)\*demandMultiplier/);
  assert.match(source,/route\.baseRevenue\*station\.transportMultiplier\*trainMultiplier\*enterpriseRevenueMultiplier\(company\)\*demandMultiplier/);
  assert.match(source,/enterprise_upgrade:\$\{u\}:airline/);
  assert.match(source,/setCustomId\(`enterprise_upgrade:\$\{u\}:\$\{businessType\}`\)/);
  assert.match(source,/INSERT INTO airline_flights\([^\n]+gross_revenue/,'航空收益必須在起飛時保存');
  assert.match(source,/INSERT INTO transport_business_operations\([^\n]+gross_revenue/,'陸路收益必須在出發時保存');
});

test('限時資產拍賣使用安全託管、退款、延時與自動結標',()=>{
  assert.match(source,/CREATE TABLE IF NOT EXISTS asset_auctions/);
  assert.match(source,/CREATE UNIQUE INDEX IF NOT EXISTS idx_asset_auctions_active_guild[\s\S]+?WHERE status='active'/);
  assert.match(source,/CREATE TABLE IF NOT EXISTS asset_auction_bids/);
  assert.match(source,/const ASSET_AUCTION_DURATION_MS=12\*60\*60\*1000/);
  assert.match(source,/const ASSET_AUCTION_EXTENSION_MS=5\*60\*1000/);
  assert.match(source,/const ASSET_AUCTION_MIN_INCREMENT_RATE=0\.05/);
  assert.match(source,/const ASSET_AUCTION_MIN_START_PRICE=5000000/);
  assert.match(source,/const assetAuctionPool=\[[\s\S]+?'toyota_supra_mk4'[\s\S]+?'ford_mustang_1964_hidden'[\s\S]+?'ford_gt_heritage'[\s\S]+?'ford_shelby_gt500'/);

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
  assert.match(source,/changeBalanceUnlocked\(g,u,-route\.operatingCost,'transport_operation'/);
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
  assert.match(source,/route\.baseRevenue\*station\.transportMultiplier\*trainMultiplier\*demandMultiplier/);
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
