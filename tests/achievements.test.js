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
  const titleChoiceBlock=source.match(/setName\('稱號'\)[\s\S]+?\{name:'❌ 取消目前稱號',value:'clear'\}\)\)/)?.[0]||'';
  assert.ok(titleChoiceBlock);
  assert.ok((titleChoiceBlock.match(/\{name:/g)||[]).length<=25,'Discord 稱號選項不可超過 25 個');
  const adminTitleStart=source.indexOf("setName('稱號設定')");
  const adminTitleEnd=source.indexOf("setName('搶劫公告頻道')",adminTitleStart);
  const adminTitleBlock=adminTitleStart>=0&&adminTitleEnd>adminTitleStart?source.slice(adminTitleStart,adminTitleEnd):'';
  assert.ok(adminTitleBlock,'管理員稱號設定必須使用 autocomplete，避免超過 Discord 25 個選項限制');
  assert.match(adminTitleBlock,/setAutocomplete\(true\)/);
  assert.doesNotMatch(adminTitleBlock,/addChoices\(/);
  assert.match(source,/process\.env\.COMMAND_BUILD_ONLY==='1'/);
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

test('三種交通場站可註冊公司行號並營運收益',()=>{
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
  assert.match(source,/CREATE TABLE IF NOT EXISTS transport_companies/);
  assert.match(source,/CREATE TABLE IF NOT EXISTS transport_operations/);
  assert.match(source,/setName\('交通事業'\)/);
  assert.match(source,/registerTransportCompany\(g,u,name\)/);
  assert.match(source,/changeBalanceUnlocked\(g,u,-TRANSPORT_REGISTRATION_FEE,'transport_registration'/);
  assert.match(source,/station\.transportType!==route\.type/);
  assert.match(source,/changeBalanceUnlocked\(g,u,-route\.operatingCost,'transport_operation'/);
  assert.match(source,/changeBalanceUnlocked\(g,u,operation\.gross_revenue,'transport_revenue'/);
  assert.match(source,/setInterval\(notifyCompletedTransportOperations,60000\)/);

  const db=new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE transport_companies (
    guild_id TEXT NOT NULL, user_id TEXT NOT NULL, company_name TEXT NOT NULL,
    station_id TEXT, route_id TEXT,
    PRIMARY KEY (guild_id,user_id)
  );
  CREATE TABLE transport_operations (
    guild_id TEXT NOT NULL, user_id TEXT NOT NULL, station_id TEXT NOT NULL,
    route_id TEXT NOT NULL, gross_revenue INTEGER NOT NULL, operating_cost INTEGER NOT NULL,
    started_at INTEGER NOT NULL, completes_at INTEGER NOT NULL,
    dm_notified_at INTEGER, channel_notified_at INTEGER,
    PRIMARY KEY (guild_id,user_id)
  );`);
  db.prepare('INSERT INTO transport_companies(guild_id,user_id,company_name,station_id,route_id) VALUES(?,?,?,?,?)')
    .run('guild','player','金運交通','grand_bay_high_speed_rail_terminal','rail_intercity_business');
  db.prepare('INSERT INTO transport_operations(guild_id,user_id,station_id,route_id,gross_revenue,operating_cost,started_at,completes_at) VALUES(?,?,?,?,?,?,?,?)')
    .run('guild','player','grand_bay_high_speed_rail_terminal','rail_intercity_business',270000,80000,1000,2000);
  const operation=db.prepare('SELECT * FROM transport_operations WHERE guild_id=? AND user_id=?').get('guild','player');
  assert.equal(operation.gross_revenue-operation.operating_cost,190000);
  assert.equal(operation.dm_notified_at,null);
  assert.equal(operation.channel_notified_at,null);
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

test('搶劫備援與貨運站圖片修復公告完整',()=>{
  const update=JSON.parse(readFileSync(new URL('../updates/2026-07-31-heist-fallback-freight-image.json',import.meta.url),'utf8'));
  assert.equal(update.id,'2026-07-31-heist-fallback-freight-image');
  assert.equal(update.changes.length,7);
  assert.match(update.summary,/皇冠港物流貨運站圖片/);
  assert.match(update.changes.join('\n'),/Invalid Webhook Token/);
  assert.match(update.changes.join('\n'),/不會重複派彩或處罰/);
});
