import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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

test('完成歐印時排入自由大廳自動播報',()=>{
  assert.match(source,/recordCasinoAllIn\(g,u,game,bet\)/);
  assert.match(source,/allIn\?recordCasinoAllIn\(g,u,game,bet\):null/);
  assert.match(source,/CREATE TABLE IF NOT EXISTS casino_all_in_events/);
  assert.match(source,/FREE_LOBBY_CHANNEL_KEYWORD='自由大廳'/);
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

test('公告檔案包含成就與轉帳規則',()=>{
  const update=JSON.parse(readFileSync(new URL('../updates/2026-07-30-transfer-achievements.json',import.meta.url),'utf8'));
  assert.equal(update.id,'2026-07-30-transfer-achievements');
  assert.equal(update.changes.length,7);
  assert.match(update.summary,/10 個一般成就、3 個隱藏成就/);
  assert.match(update.changes.join('\n'),/2% 手續費/);
});
