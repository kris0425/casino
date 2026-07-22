import 'dotenv/config';
import {
  Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, ChannelType,
  PermissionFlagsBits, EmbedBuilder, AttachmentBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder,
  ModalBuilder, TextInputBuilder, TextInputStyle
} from 'discord.js';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync=promisify(execFile);

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const STARTING = Number(process.env.STARTING_COINS || 1000);
const MIN_BET = Number(process.env.MIN_BET || 10);
const MAX_BET = Number(process.env.MAX_BET || 100000);
const LOAN_LIMIT = Number(process.env.LOAN_LIMIT || 100000);
const LOAN_DAILY_INTEREST_RATE = Number(process.env.LOAN_DAILY_INTEREST_RATE || 0.02);
const TEAM_HEIST_PREP_FEE = Number(process.env.TEAM_HEIST_PREP_FEE || 3000);
const SOLO_HEIST_REWARD = Number(process.env.SOLO_HEIST_REWARD || 40000);
const TEAM_HEIST_MEMBER_REWARD = Number(process.env.TEAM_HEIST_MEMBER_REWARD || 110000);
const TEAM_HEIST_TEAMMATE_BONUS = Number(process.env.TEAM_HEIST_TEAMMATE_BONUS || 5000);
const ECONOMY_SINK_LABELS={
  asset_purchase:'房地產／永久資產',
  asset_rental:'套房／限時租賃',
  shop:'食物與商城',
  medical:'醫療費用',
  heist_weapon:'搶劫槍枝',
  heist_prep:'搶劫準備費',
  pet_shop:'寵物與寵物用品',
  vehicle_mod:'載具改裝'
};
const ECONOMY_TRANSFER_KINDS=new Set(['asset_trade','market_purchase','market_sale','theft','pvp_wager','wager_return','casino_vault_heist']);
const BASE_STAMINA = 500;
const assetPath=name=>resolve(process.cwd(),'assets',name);
const petCatalog={
  golden_retriever:{name:'黃金獵犬｜阿金',emoji:'🐕',price:18000,image:'pets/golden_retriever.jpg',bonusType:'work',bonusValue:0.05,bonusText:'工作收入最高 +5%',description:'熱情可靠的工作夥伴，心情越好，工作收入加成越高。'},
  siamese_cat:{name:'暹羅貓｜小藍',emoji:'🐈',price:22000,image:'pets/siamese_cat.jpg',bonusType:'casino',bonusValue:0.03,bonusText:'賭場獲勝派彩最高 +3%',description:'神祕又機靈的幸運夥伴，會替贏牌帶來一點好運。'},
  british_shorthair:{name:'英國短毛貓｜銀寶',emoji:'🐱',price:26000,image:'pets/british_shorthair.jpg',bonusType:'discount',bonusValue:0.05,bonusText:'體力商城折扣最高 5%',description:'沉穩精打細算的陪伴夥伴，能在體力商城取得小幅折扣。'},
  black_labrador:{name:'黑色拉布拉多｜小黑',emoji:'🐕‍🦺',price:30000,image:'pets/black_labrador.jpg',bonusType:'stamina',bonusValue:10,bonusText:'每日體力上限最高 +10',description:'活力充沛的冒險夥伴，陪伴時可提高每日體力上限。'},
  siberian_husky:{name:'西伯利亞哈士奇｜暴風',emoji:'🐺',price:16000,image:'pets/siberian_husky.jpg',bonusType:'work',bonusValue:0.04,bonusText:'工作收入最高 +4%',description:'精力旺盛又喜歡搗蛋的工作同伴，會陪你完成每天的賺錢活動。'},
  tabby_cat:{name:'虎斑貓｜阿虎',emoji:'🐈',price:17000,image:'pets/tabby_cat.jpg',bonusType:'casino',bonusValue:0.02,bonusText:'賭場獲勝派彩最高 +2%',description:'觀察力敏銳的沉著夥伴，陪伴時會帶來一點牌桌好運。'},
  pomeranian:{name:'博美犬｜小猛',emoji:'🐕',price:19000,image:'pets/pomeranian.jpg',bonusType:'discount',bonusValue:0.04,bonusText:'體力商城折扣最高 4%',description:'外表可愛、精打細算的購物夥伴，與警犬猛博美不是同一隻。'},
  vanilla_catgirl:{name:'稀有貓娘｜香草',emoji:'🐾',price:24000,image:'pets/vanilla_catgirl.jpg',bonusType:'stamina',bonusValue:8,bonusText:'每日體力上限最高 +8',description:'稀有的貓娘陪伴同伴，同行時能讓冒險生活更有精神。'},
  scarlet_macaw:{name:'金剛鸚鵡｜烈焰',emoji:'🦜',price:28000,image:'pets/scarlet_macaw.png',bonusType:'casino',bonusValue:0.03,bonusText:'賭場獲勝派彩最高 +3%',description:'華麗聰明的金剛鸚鵡，同行時會用響亮的叫聲替主人帶來牌桌好運。'},
  cockatiel:{name:'玄鳳鸚鵡｜啾啾',emoji:'🦜',price:15000,image:'pets/cockatiel.jpg',bonusType:'casino',bonusValue:0.02,bonusText:'賭場獲勝派彩最高 +2%',description:'活潑愛說話的玄鳳鸚鵡，陪伴時會在牌桌旁替主人加油。'},
  orange_tabby:{name:'橘貓｜橘寶',emoji:'🐈',price:14000,image:'pets/orange_tabby.jpg',bonusType:'stamina',bonusValue:6,bonusText:'每日體力上限最高 +6',description:'貪吃又親人的橘貓，安心的陪伴能讓主人每天多保留一些體力。'}
};
const petItemCatalog={
  canned_food:{name:'鮮肉罐頭',emoji:'🥫',price:250,mood:25,description:'恢復陪伴寵物 25 點心情。'},
  bird_feed:{name:'鳥飼料',emoji:'🌾',price:300,mood:25,description:'營養均衡的鳥類飼料，恢復陪伴寵物 25 點心情。'},
  squeaky_ball:{name:'響聲球',emoji:'🎾',price:450,mood:20,description:'陪寵物玩耍，恢復 20 點心情。'},
  grooming_kit:{name:'洗護組',emoji:'🧴',price:650,mood:30,description:'替寵物整理毛髮，恢復 30 點心情。'},
  luxury_bed:{name:'豪華睡床券',emoji:'🛏️',price:1200,mood:50,description:'讓寵物好好休息，恢復 50 點心情。'}
};
const dealerImages={
  verify:assetPath('dealer_verify.webp'),
  shoes:assetPath('dealer_shoes.webp'),
  judge:assetPath('dealer_judge.jpg')
};
const hospitalCheckGif=assetPath('mizi_check.gif');
const duelModeImage=assetPath('duel_mode.png');
const jailRiotImage={path:assetPath('jail/prison_riot.jpg'),name:'prison_riot.jpg'};
const jailRiotImageUrl=`attachment://${jailRiotImage.name}`;
function jailRiotPayload(embed) {
  embed.setImage(jailRiotImageUrl);
  return {embeds:[embed],files:[new AttachmentBuilder(jailRiotImage.path,{name:jailRiotImage.name})]};
}
const jailRescueImages={
  force:{path:assetPath('jail/rescue_force.jpg'),name:'jail_rescue_force.jpg'},
  seduce:{path:assetPath('jail/rescue_seduce.jpg'),name:'jail_rescue_seduce.jpg'}
};
const jailRescueImageUrl=method=>`attachment://${jailRescueImages[method].name}`;
function jailRescuePayload(embed,method) {
  const image=jailRescueImages[method];
  embed.setImage(jailRescueImageUrl(method));
  return {embeds:[embed],files:[new AttachmentBuilder(image.path,{name:image.name})]};
}
const heistSceneImages={
  planning:{path:assetPath('heist/planning_room.jpg'),name:'heist_planning.jpg'},
  approach:{path:assetPath('heist/bank_approach.jpg'),name:'heist_approach.jpg'},
  assault:{path:assetPath('heist/bank_assault.jpg'),name:'heist_assault.jpg'},
  sewer:{path:assetPath('heist/sewer_escape.jpg'),name:'heist_sewer.jpg'},
  helicopter:{path:assetPath('heist/helicopter_escape.jpg'),name:'heist_helicopter.jpg'},
  success:{path:assetPath('heist/escape_success.jpg'),name:'heist_escape_success.jpg'},
  arrested:{path:assetPath('heist/arrested.jpg'),name:'heist_arrested.jpg'},
  chase:{path:assetPath('heist/police_chase_latest.jpg'),name:'heist_police_chase.jpg'},
  surrounded:{path:assetPath('heist/police_surrounded_latest.jpg'),name:'heist_surrounded.jpg'},
  vault_diamonds:{path:assetPath('heist/vault_diamonds.jpg'),name:'heist_vault_diamonds.jpg'},
  vault_cash:{path:assetPath('heist/vault_cash.jpg'),name:'heist_vault_cash.jpg'},
  vault_gold:{path:assetPath('heist/vault_gold.jpg'),name:'heist_vault_gold.jpg'},
  vault_hao_xinyi_deed:{path:assetPath('heist/vault_hao_xinyi_deed.png'),name:'heist_vault_hao_xinyi_deed.png'},
  police_dog_1:{path:assetPath('heist/police_dog_1.jpg'),name:'heist_police_dog_1.jpg'},
  police_dog_2:{path:assetPath('heist/police_dog_2.jpg'),name:'heist_police_dog_2.jpg'},
  deception_uniform:{path:assetPath('heist/deception_uniform.jpg'),name:'heist_deception_uniform.jpg'}
};
const heistSceneUrl=scene=>`attachment://${heistSceneImages[scene].name}`;
const randomPoliceDogScene=()=>Math.random()<0.5?'police_dog_1':'police_dog_2';
function heistScenePayload(embed,scene) {
  const image=heistSceneImages[scene];
  embed.setImage(heistSceneUrl(scene));
  return {
    embeds:[embed],
    attachments:[],
    files:[new AttachmentBuilder(image.path,{name:image.name})]
  };
}
async function publishLatestHeistResult(interaction,payload) {
  await interaction.editReply({
    embeds:[new EmbedBuilder().setColor(0x607D8B).setTitle('🏁 搶劫任務已完成').setDescription('完整的最新結果已發布在頻道最下方，玩家不需要再往上翻找。')],
    components:[],attachments:[],files:[]
  });
  const {attachments,...followUpPayload}=payload;
  return interaction.followUp({...followUpPayload,allowedMentions:{parse:[]}});
}
function dealerReaction(playerWon) {
  if(playerWon) return {quote:'💢 莊家：「我要驗牌！」',path:dealerImages.verify,name:'dealer_verify.webp'};
  const reactions=[
    {quote:'😏 莊家：「給我擦皮鞋。」',path:dealerImages.shoes,name:'dealer_shoes.webp'},
    {quote:'😎 莊家：「裁判和球員都是我的，你拿什麼跟我鬥？」',path:dealerImages.judge,name:'dealer_judge.jpg'}
  ];
  return reactions[Math.floor(Math.random()*reactions.length)];
}
function settleGamePayout(g,u,bet,payout,game) {
  let titleMultiplier=1,titleInitialMultiplier=1,titleActive=false,titleSkillTriggered=false,titleId='';
  if(payout>bet) {
    titleId=luckyReturnsTitleId(g,u);
    titleActive=Boolean(titleId);
    titleInitialMultiplier=returnsCasinoMultiplier(g,u);
    titleMultiplier=titleInitialMultiplier;
    if(titleActive&&Math.random()<0.03) {
      titleSkillTriggered=true;
      titleMultiplier=returnsCasinoMultiplier(g,u);
    }
    const regularMultiplier=game==='麻將'?1:weeklyCasinoMultiplier()*assetCasinoBonus(g,u)*(1+petBonus(g,u,'casino'));
    payout=Math.floor(payout*regularMultiplier*titleMultiplier);
  }
  if(!payout) return {credited:0,dog:false,titleMultiplier,titleInitialMultiplier,titleActive,titleSkillTriggered,titleId};
  const dog=payout>bet && Math.random()<0.10;
  const amount=dog?bet:payout;
  // The wager was removed before the game started. Record the returned stake
  // separately from profit so economy reports do not count it as newly minted
  // income.
  const principal=Math.min(Math.max(0,bet),amount);
  const profit=Math.max(0,amount-principal);
  let credited=0;
  if(principal>0) {
    const before=balance(g,u);
    credited+=changeBalance(g,u,principal,'wager_return',u,`${game}：返還下注本金`)-before;
  }
  if(profit>0) {
    const before=balance(g,u);
    credited+=changeBalance(g,u,profit,'payout',u,dog?`${game}：博美犬叼走本局獲利`:game)-before;
  }
  return {credited,dog,stolen:dog?payout-bet:0,principal,profitCredited:Math.max(0,credited-principal),titleMultiplier,titleInitialMultiplier,titleActive,titleSkillTriggered,titleId};
}
const dogChases=new Map();
const scratchTickets=new Map();
const duelChallenges=new Map();
const activeDuels=new Map();
const teamInvites=new Map();
const activeHeists=new Map();
const burglaryLobbies=new Map();
const dragonGateGames=new Map();
const jailRiots=new Map();
const mahjongRooms=new Map();
const assetTradeOffers=new Map();
const assetPurchaseOffers=new Map();
const assetShopSessions=new Map();
const raceSessions=new Map();
const pvpRaceSessions=new Map();
const vehicleModSessions=new Map();
function dogChaseRow(userId,stolen) {
  const token=Math.random().toString(36).slice(2,10);
  dogChases.set(token,{userId,stolen,used:false});
  setTimeout(()=>dogChases.delete(token),10*60*1000);
  return new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`dog_chase:${token}`).setLabel('追上博美犬拿回金幣').setEmoji('🐕').setStyle(ButtonStyle.Danger));
}
function scratchRow(token,ticket,finished=false) {
  return new ActionRowBuilder().addComponents([0,1,2].map(index=>new ButtonBuilder()
    .setCustomId(`scratch:${token}:${index}`)
    .setLabel(ticket.revealed.has(index)?ticket.icons[index]:'❔')
    .setStyle(finished?(ticket.payout?ButtonStyle.Success:ButtonStyle.Secondary):(ticket.revealed.has(index)?ButtonStyle.Primary:ButtonStyle.Secondary))
    .setDisabled(finished||ticket.revealed.has(index))));
}
function duelTurnRow(token,disabled=false) {
  return new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`duel_fire:${token}`).setLabel(disabled?'決鬥結束':'扣下扳機').setEmoji('🎯').setStyle(disabled?ButtonStyle.Secondary:ButtonStyle.Danger).setDisabled(disabled));
}
function heistPrepRow(token,disabled=false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`heist_status:${token}`).setLabel('查看準備狀態').setEmoji('📋').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`heist_prep:${token}`).setLabel(disabled?'全隊準備完成':'完成事前準備').setEmoji('🧰').setStyle(disabled?ButtonStyle.Secondary:ButtonStyle.Primary).setDisabled(disabled)
  );
}
if (!TOKEN || !CLIENT_ID) throw new Error('請在 .env 設定 DISCORD_TOKEN 與 CLIENT_ID');

mkdirSync('data', { recursive: true });
const db = new DatabaseSync('data/casino.sqlite');
db.exec(`
  PRAGMA journal_mode=WAL;
  CREATE TABLE IF NOT EXISTS wallets (
    guild_id TEXT NOT NULL, user_id TEXT NOT NULL, balance INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (guild_id, user_id)
  );
  CREATE TABLE IF NOT EXISTS ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT NOT NULL, user_id TEXT NOT NULL,
    delta INTEGER NOT NULL, balance_after INTEGER NOT NULL, kind TEXT NOT NULL,
    actor_id TEXT, reason TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS jail (
    guild_id TEXT NOT NULL, user_id TEXT NOT NULL, release_at INTEGER NOT NULL,
    reason TEXT NOT NULL, PRIMARY KEY (guild_id, user_id)
  );
  CREATE TABLE IF NOT EXISTS bank_accounts (
    guild_id TEXT NOT NULL, user_id TEXT NOT NULL, debt INTEGER NOT NULL DEFAULT 0,
    interest_day TEXT,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (guild_id, user_id)
  );
  CREATE TABLE IF NOT EXISTS player_stats (
    guild_id TEXT NOT NULL, user_id TEXT NOT NULL, stamina INTEGER NOT NULL DEFAULT 200,
    stamina_day TEXT NOT NULL, PRIMARY KEY (guild_id, user_id)
  );
  CREATE TABLE IF NOT EXISTS inventory (
    guild_id TEXT NOT NULL, user_id TEXT NOT NULL, item_id TEXT NOT NULL, quantity INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (guild_id, user_id, item_id)
  );
  CREATE TABLE IF NOT EXISTS daily_income (
    guild_id TEXT NOT NULL, user_id TEXT NOT NULL, income_day TEXT NOT NULL, amount INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (guild_id, user_id)
  );
  CREATE TABLE IF NOT EXISTS event_effects (
    guild_id TEXT NOT NULL, user_id TEXT NOT NULL, shop_sale_until INTEGER NOT NULL DEFAULT 0,
    half_stamina_until INTEGER NOT NULL DEFAULT 0, double_work_until INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (guild_id, user_id)
  );
  CREATE TABLE IF NOT EXISTS hospital_lock (
    guild_id TEXT NOT NULL, user_id TEXT NOT NULL, release_at INTEGER NOT NULL,
    reason TEXT NOT NULL, PRIMARY KEY (guild_id, user_id)
  );
  CREATE TABLE IF NOT EXISTS daily_work (
    guild_id TEXT NOT NULL, user_id TEXT NOT NULL, work_day TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (guild_id, user_id)
  );
  CREATE TABLE IF NOT EXISTS jail_training (
    guild_id TEXT NOT NULL, user_id TEXT NOT NULL, used INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (guild_id, user_id)
  );
  CREATE TABLE IF NOT EXISTS jail_escape (
    guild_id TEXT NOT NULL, user_id TEXT NOT NULL, used INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (guild_id, user_id)
  );
  CREATE TABLE IF NOT EXISTS stamina_bonus (
    guild_id TEXT NOT NULL, user_id TEXT NOT NULL, bonus_day TEXT NOT NULL, bonus INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (guild_id, user_id)
  );
  CREATE TABLE IF NOT EXISTS teams (
    id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT NOT NULL, leader_id TEXT NOT NULL,
    name TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS team_members (
    guild_id TEXT NOT NULL, user_id TEXT NOT NULL, team_id INTEGER NOT NULL,
    PRIMARY KEY (guild_id, user_id)
  );
  CREATE TABLE IF NOT EXISTS announcement_channels (
    guild_id TEXT PRIMARY KEY, channel_id TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS heist_announcement_channels (
    guild_id TEXT PRIMARY KEY, channel_id TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS scheduled_announcements (
    guild_id TEXT NOT NULL, kind TEXT NOT NULL, slot TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (guild_id, kind, slot)
  );
  CREATE TABLE IF NOT EXISTS solo_heist_settings (
    guild_id TEXT PRIMARY KEY, base_chance INTEGER NOT NULL DEFAULT 20
  );
  CREATE TABLE IF NOT EXISTS player_profiles (
    guild_id TEXT NOT NULL, user_id TEXT NOT NULL, title TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (guild_id, user_id)
  );
  CREATE TABLE IF NOT EXISTS player_achievements (
    guild_id TEXT NOT NULL, user_id TEXT NOT NULL, achievement_id TEXT NOT NULL,
    unlocked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (guild_id, user_id, achievement_id)
  );
  CREATE TABLE IF NOT EXISTS player_assets (
    guild_id TEXT NOT NULL, user_id TEXT NOT NULL, asset_id TEXT NOT NULL, quantity INTEGER NOT NULL DEFAULT 0,
    acquired_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (guild_id, user_id, asset_id)
  );
  CREATE TABLE IF NOT EXISTS asset_rentals (
    guild_id TEXT NOT NULL, user_id TEXT NOT NULL, asset_id TEXT NOT NULL, expires_at INTEGER NOT NULL,
    buff_id TEXT,
    rented_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (guild_id, user_id, asset_id)
  );
  CREATE TABLE IF NOT EXISTS asset_bonuses (
    guild_id TEXT NOT NULL, user_id TEXT NOT NULL, asset_id TEXT NOT NULL, buff_id TEXT NOT NULL,
    assigned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (guild_id, user_id, asset_id)
  );
  CREATE TABLE IF NOT EXISTS vehicle_mods (
    guild_id TEXT NOT NULL, user_id TEXT NOT NULL, asset_id TEXT NOT NULL,
    paint_id TEXT NOT NULL DEFAULT 'factory', wheels_id TEXT NOT NULL DEFAULT 'stock',
    spoiler_id TEXT NOT NULL DEFAULT 'stock', widebody_id TEXT NOT NULL DEFAULT 'stock',
    engine_id TEXT NOT NULL DEFAULT 'stock', suspension_id TEXT NOT NULL DEFAULT 'stock',
    total_spent INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (guild_id, user_id, asset_id)
  );
  CREATE TABLE IF NOT EXISTS asset_market_listings (
    id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT NOT NULL, seller_id TEXT NOT NULL,
    asset_id TEXT NOT NULL, quantity INTEGER NOT NULL, price INTEGER NOT NULL, buff_id TEXT,
    status TEXT NOT NULL DEFAULT 'active', buyer_id TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, completed_at TEXT
  );
  CREATE TABLE IF NOT EXISTS lucky_wheel_daily (
    guild_id TEXT NOT NULL, user_id TEXT NOT NULL, spin_day TEXT NOT NULL,
    spins INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (guild_id, user_id)
  );
  CREATE TABLE IF NOT EXISTS player_pets (
    guild_id TEXT NOT NULL, user_id TEXT NOT NULL, pet_id TEXT NOT NULL,
    nickname TEXT, happiness INTEGER NOT NULL DEFAULT 70, mood_day TEXT NOT NULL,
    acquired_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (guild_id, user_id, pet_id)
  );
  CREATE TABLE IF NOT EXISTS pet_profiles (
    guild_id TEXT NOT NULL, user_id TEXT NOT NULL, active_pet_id TEXT,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (guild_id, user_id)
  );
  CREATE TABLE IF NOT EXISTS pet_inventory (
    guild_id TEXT NOT NULL, user_id TEXT NOT NULL, item_id TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (guild_id, user_id, item_id)
  );
  CREATE TABLE IF NOT EXISTS casino_vault (
    guild_id TEXT PRIMARY KEY,
    balance INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS casino_vault_ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    delta INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    kind TEXT NOT NULL,
    user_id TEXT,
    reason TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TRIGGER IF NOT EXISTS ledger_collect_casino_vault
  AFTER INSERT ON ledger
  WHEN NEW.delta < 0 AND NEW.kind NOT IN (
    'asset_trade','market_purchase','market_sale','theft','pvp_wager','wager_return',
    'admin_adjust','bank_deposit','bank_withdraw','loan_repayment','casino_vault_heist'
  )
  BEGIN
    INSERT INTO casino_vault(guild_id,balance) VALUES(NEW.guild_id,ABS(NEW.delta))
      ON CONFLICT(guild_id) DO UPDATE SET balance=balance+ABS(NEW.delta),updated_at=CURRENT_TIMESTAMP;
    INSERT INTO casino_vault_ledger(guild_id,delta,balance_after,kind,user_id,reason)
      SELECT NEW.guild_id,ABS(NEW.delta),balance,'player_spending',NEW.user_id,NEW.reason
      FROM casino_vault WHERE guild_id=NEW.guild_id;
  END;
`);

if(!db.prepare('PRAGMA table_info(teams)').all().some(column=>column.name==='name')) {
  db.exec('ALTER TABLE teams ADD COLUMN name TEXT');
}
if(!db.prepare('PRAGMA table_info(asset_rentals)').all().some(column=>column.name==='buff_id')) {
  db.exec('ALTER TABLE asset_rentals ADD COLUMN buff_id TEXT');
}
if(!db.prepare('PRAGMA table_info(bank_accounts)').all().some(column=>column.name==='interest_day')) {
  db.exec('ALTER TABLE bank_accounts ADD COLUMN interest_day TEXT');
}
if(!db.prepare('PRAGMA table_info(player_pets)').all().some(column=>column.name==='nickname')) {
  db.exec('ALTER TABLE player_pets ADD COLUMN nickname TEXT');
}

function ensureWallet(guildId, userId) {
  db.prepare('INSERT OR IGNORE INTO wallets(guild_id,user_id,balance) VALUES(?,?,?)').run(guildId, userId, STARTING);
  return db.prepare('SELECT balance FROM wallets WHERE guild_id=? AND user_id=?').get(guildId, userId).balance;
}
function balance(g, u) { return ensureWallet(g, u); }
function changeBalance(g, u, delta, kind, actor = null, reason = '') {
  db.exec('BEGIN IMMEDIATE');
  try {
    const current = ensureWallet(g, u);
    const next = current + delta;
    if (next < 0) throw new Error('金幣不足');
    db.prepare('UPDATE wallets SET balance=?,updated_at=CURRENT_TIMESTAMP WHERE guild_id=? AND user_id=?').run(next, g, u);
    db.prepare('INSERT INTO ledger(guild_id,user_id,delta,balance_after,kind,actor_id,reason) VALUES(?,?,?,?,?,?,?)')
      .run(g, u, delta, next, kind, actor, reason);
    db.exec('COMMIT');
    return next;
  } catch (e) { db.exec('ROLLBACK'); throw e; }
}
function casinoVaultBalance(g) {
  db.prepare('INSERT OR IGNORE INTO casino_vault(guild_id,balance) VALUES(?,0)').run(g);
  return db.prepare('SELECT balance FROM casino_vault WHERE guild_id=?').get(g).balance;
}
function changeCasinoVault(g,delta,kind,userId=null,reason='') {
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare('INSERT OR IGNORE INTO casino_vault(guild_id,balance) VALUES(?,0)').run(g);
    const current=db.prepare('SELECT balance FROM casino_vault WHERE guild_id=?').get(g).balance;
    const next=current+delta;
    if(next<0) throw new Error('賭場寶庫餘額不足');
    db.prepare('UPDATE casino_vault SET balance=?,updated_at=CURRENT_TIMESTAMP WHERE guild_id=?').run(next,g);
    db.prepare('INSERT INTO casino_vault_ledger(guild_id,delta,balance_after,kind,user_id,reason) VALUES(?,?,?,?,?,?)').run(g,delta,next,kind,userId,reason);
    db.exec('COMMIT');
    return next;
  } catch(error) { db.exec('ROLLBACK'); throw error; }
}
function economyFlow(g,sinceModifier) {
  const rows=db.prepare("SELECT kind,delta FROM ledger WHERE guild_id=? AND created_at>=datetime('now',?)").all(g,sinceModifier);
  let minted=0,burned=0;
  const sinks=Object.fromEntries(Object.keys(ECONOMY_SINK_LABELS).map(kind=>[kind,0]));
  for(const row of rows) {
    if(ECONOMY_TRANSFER_KINDS.has(row.kind)) continue;
    if(row.delta>0) minted+=row.delta;
    if(row.delta<0) burned+=Math.abs(row.delta);
    if(row.delta<0&&Object.hasOwn(sinks,row.kind)) sinks[row.kind]+=Math.abs(row.delta);
  }
  return {minted,burned,net:minted-burned,sinks};
}
const dayNumber=day=>Math.floor(Date.parse(`${day}T00:00:00Z`)/86400000);
function accrueLoanInterestUnlocked(g,u) {
  const today=taipeiDay();
  db.prepare('INSERT OR IGNORE INTO wallets(guild_id,user_id,balance) VALUES(?,?,?)').run(g,u,STARTING);
  db.prepare('INSERT OR IGNORE INTO bank_accounts(guild_id,user_id,debt,interest_day) VALUES(?,?,0,?)').run(g,u,today);
  const account=db.prepare('SELECT debt,interest_day FROM bank_accounts WHERE guild_id=? AND user_id=?').get(g,u);
  if(!account.interest_day) {
    db.prepare('UPDATE bank_accounts SET interest_day=?,updated_at=CURRENT_TIMESTAMP WHERE guild_id=? AND user_id=?').run(today,g,u);
    return {debt:account.debt,interest:0,days:0};
  }
  const days=Math.max(0,dayNumber(today)-dayNumber(account.interest_day));
  if(days===0) return {debt:account.debt,interest:0,days:0};
  if(account.debt<=0) {
    db.prepare('UPDATE bank_accounts SET interest_day=?,updated_at=CURRENT_TIMESTAMP WHERE guild_id=? AND user_id=?').run(today,g,u);
    return {debt:0,interest:0,days};
  }
  const nextDebt=Math.ceil(account.debt*Math.pow(1+LOAN_DAILY_INTEREST_RATE,days));
  const interest=nextDebt-account.debt;
  db.prepare('UPDATE bank_accounts SET debt=?,interest_day=?,updated_at=CURRENT_TIMESTAMP WHERE guild_id=? AND user_id=?').run(nextDebt,today,g,u);
  const wallet=db.prepare('SELECT balance FROM wallets WHERE guild_id=? AND user_id=?').get(g,u).balance;
  db.prepare('INSERT INTO ledger(guild_id,user_id,delta,balance_after,kind,actor_id,reason) VALUES(?,?,?,?,?,?,?)')
    .run(g,u,0,wallet,'loan_interest',u,`銀行借款利息（每日 ${(LOAN_DAILY_INTEREST_RATE*100).toFixed(2).replace(/\.00$/,'')}%，累計 ${days} 天）｜負債增加 ${fmt(interest)}`);
  return {debt:nextDebt,interest,days};
}
function debt(g,u) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result=accrueLoanInterestUnlocked(g,u);
    db.exec('COMMIT');
    return result.debt;
  } catch(e) { db.exec('ROLLBACK'); throw e; }
}
function bankTransfer(g,u,amount,type) {
  db.exec('BEGIN IMMEDIATE');
  try {
    accrueLoanInterestUnlocked(g,u);
    const wallet=db.prepare('SELECT balance FROM wallets WHERE guild_id=? AND user_id=?').get(g,u).balance;
    const currentDebt=db.prepare('SELECT debt FROM bank_accounts WHERE guild_id=? AND user_id=?').get(g,u).debt;
    let nextBalance, nextDebt, delta;
    if(type==='borrow') {
      if(currentDebt+amount>LOAN_LIMIT) throw new Error(`借款後會超過額度 ${fmt(LOAN_LIMIT)}`);
      nextBalance=wallet+amount; nextDebt=currentDebt+amount; delta=amount;
    } else {
      if(amount>currentDebt) throw new Error(`還款不能超過目前負債 ${fmt(currentDebt)}`);
      if(amount>wallet) throw new Error('金庫餘額不足以還款');
      nextBalance=wallet-amount; nextDebt=currentDebt-amount; delta=-amount;
    }
    db.prepare('UPDATE wallets SET balance=?,updated_at=CURRENT_TIMESTAMP WHERE guild_id=? AND user_id=?').run(nextBalance,g,u);
    db.prepare('UPDATE bank_accounts SET debt=?,interest_day=?,updated_at=CURRENT_TIMESTAMP WHERE guild_id=? AND user_id=?').run(nextDebt,taipeiDay(),g,u);
    db.prepare('INSERT INTO ledger(guild_id,user_id,delta,balance_after,kind,actor_id,reason) VALUES(?,?,?,?,?,?,?)').run(g,u,delta,nextBalance,type==='borrow'?'loan':'repayment',u,type==='borrow'?'銀行借款':'銀行還款');
    db.exec('COMMIT');
    return {balance:nextBalance,debt:nextDebt};
  } catch(e) { db.exec('ROLLBACK'); throw e; }
}
const shopItems={
  water:{name:'💧 礦泉水',price:100,stamina:10},
  tea:{name:'🧋 珍珠奶茶',price:300,stamina:25},
  coffee:{name:'☕ 提神咖啡',price:500,stamina:40},
  bread:{name:'🍞 麵包',price:200,stamina:20},
  bento:{name:'🍱 豪華便當',price:600,stamina:50},
  feast:{name:'🍖 滿漢全席',price:1200,stamina:100},
  cesar:{name:'🥫 西莎',price:150,stamina:15},
  premium_dental_bone:{name:'🦴 高級潔牙骨',price:700,stamina:60},
  fried_tangyuan:{name:'🍡 炸湯圓',price:280,stamina:25},
  traditional_rice_ball:{name:'🍙 傳統飯糰',price:220,stamina:20},
  scallion_pancake:{name:'🫓 蔥抓餅',price:260,stamina:25},
  popcorn_chicken:{name:'🍗 鹹酥雞',price:450,stamina:40},
  chicken_cutlet:{name:'🍖 雞排',price:550,stamina:50},
  buddha_vpn:{name:'🍲 佛跳牆｜God Use VPN',price:8888,stamina:0,fullRestore:true},
  sesame_oil_chicken:{name:'🍗 麻油雞',price:1800,stamina:150},
  zongzi_this_year:{name:'🐉 今年的粽子',price:1100,stamina:100,image:'food/zongzi_meme.jpg'},
  zongzi_last_year:{name:'📦 去年的粽子',price:500,stamina:50,image:'food/zongzi_meme.jpg'},
  zongzi_two_years_ago:{name:'🕸️ 前年的粽子',price:100,stamina:15,image:'food/zongzi_meme.jpg'},
  hao_photo:{name:'📸 Hao 的女僕拍立得',price:2888,stamina:0,maxBonus:20,flavor:'原來你也喜歡這種東西嗎?'}
};
const shopItemEffectLabel=item=>item.fullRestore?'回滿全部體力':item.maxBonus?`當日上限 +${item.maxBonus}`:`+${item.stamina} 體力`;
function shopItemMediaPayload(embed,itemId,item) {
  if(!item.image) return {embeds:[embed]};
  const imageName=`shop_${itemId}${extname(item.image)||'.jpg'}`;
  embed.setImage(`attachment://${imageName}`);
  return {embeds:[embed],files:[new AttachmentBuilder(assetPath(item.image),{name:imageName})]};
}
const assetCatalog={
  studio:{name:'🛏️ 普通小套房',category:'房地產',price:15000,description:'設備齊全、價格親民的入門小套房，適合剛開始累積資產的玩家。',image:'properties/basic_studio.jpg',rarity:'一般'},
  daily_rental_suite:{name:'🔑 24 小時日租套房',category:'房地產',price:1200,description:'舒適、投資人與電競玩家三款套房租金 1,200 金幣；另有 800 金幣的窮鬼日租房可選。使用期限皆為 24 小時，到期後自動失效。',images:['properties/daily_rental_suite.jpg','properties/investor_rental_suite.jpg','properties/gaming_rental_suite.jpg','properties/poor_daily_rental_suite.jpg'],rarity:'限時租用',buff:'stamina',temporaryHours:24,rentalGroup:'daily_suite'},
  poor_daily_rental_suite:{name:'🪙 窮鬼日租房',category:'房地產',price:800,description:'乾淨基本、經濟實惠的簡單住宿；使用期限 24 小時，租用增益為標準日租套房的一半。',image:'properties/poor_daily_rental_suite.jpg',rarity:'平價限時租用',buff:'stamina',buffMultiplier:0.5,temporaryHours:24,rentalGroup:'daily_suite',forSale:false},
  haunted_daily_suite:{name:'👻 猛鬼套房',category:'房地產',price:0,description:'完全免費入住 24 小時，但房內的東西會隨機賦予一項極強增益或嚴重減益；效果會固定到退房，無法重抽。',image:'properties/haunted_suite.jpg',rarity:'詛咒限時租用',temporaryHours:24,rentalGroup:'daily_suite',randomRentalBuffs:['haunted_fortune','haunted_energy','haunted_work','haunted_jackpot','haunted_exhaustion','haunted_poverty','haunted_curse'],forSale:false},
  apartment:{name:'🏢 市中心公寓',category:'房地產',price:50000,description:'適合新手投資人的第一間房。',image:'properties/downtown_apartment.jpg'},
  villa:{name:'🏡 海景別墅',category:'房地產',price:250000,description:'能眺望賭場燈火的豪華別墅。',image:'properties/ocean_view_villa.jpg'},
  casino_suite:{name:'🏨 賭場豪華頂樓公寓',category:'房地產',price:600000,description:'坐擁賭城夜景、豪華臥室、景觀浴室與私人客廳的頂樓尊榮住所。',images:['properties/casino_penthouse_bathroom.jpg','properties/casino_penthouse_bedroom.jpg','properties/casino_penthouse_livingroom.jpg']},
  luxury_palace:{name:'👑 豪華宮殿',category:'房地產',price:8888888,description:'金碧輝煌的頂級私人宮殿，擁有宏偉外觀、奢華寢宮、宴會廳、衣帽間與宮廷庭園，是身分與財富的終極象徵。',image:'properties/luxury_palace.jpg',rarity:'神話'},
  yacht:{name:'🛥️ 私人遊艇',category:'郵輪',price:350000,description:'小型私人海上娛樂空間。'},
  cruise:{name:'🛳️ 豪華郵輪｜Ocean Majesty',category:'郵輪',price:1200000,description:'燈火璀璨的海上宮殿，設有泳池、宴會廳、劇院與直升機坪，整晚派對能為賭場之夜帶來好運。',image:'ships/luxury_cruise.jpg',rarity:'傳說',buff:'casino'},
  going_merry:{name:'☠️ 梅莉號 Going Merry',category:'郵輪',price:3500000,description:'承載冒險、友情與無數回憶的傳奇海賊船；羊首船艏會在最危急的時刻帶領船員突破封鎖。',image:'ships/going_merry.jpg',rarity:'限定',buff:'getaway',buffMultiplier:3},
  luxury_submarine:{name:'🌊 豪華潛水艇｜SeaBreeze',category:'郵輪',price:4800000,description:'配備全景觀景艙、私人套房、深海餐廳與尖端聲納系統的水下行宮，提供遠離喧囂的頂級休息環境。',image:'ships/luxury_submarine.jpg',rarity:'神話',buff:'stamina',buffMultiplier:2.5},
  ghost_pirate_ship:{name:'🏴‍☠️ 海盜幽靈船',category:'郵輪',price:2500000,description:'自迷霧中現身的詛咒海盜船，幽綠鬼火照亮破舊船帆；購買後會隨機獲得一項永久資產增益。',image:'ships/ghost_pirate_ship.jpg',rarity:'傳說'},
  pom_stroller:{name:'🐕 猛博美豪華推車',category:'收藏品',price:48000,description:'替猛博美準備的全天候豪華推車，柔軟座艙與遮雨棚能讓主人獲得更充分的休息。',image:'vehicles/pom_stroller.jpg',rarity:'稀有',buff:'stamina'},
  sedan:{name:'🚗 豪華轎車',category:'汽車',price:30000,description:'低調舒適的 Lexus LS500 豪華座駕。',image:'vehicles/luxury_sedan.png'},
  suzuki_every:{name:'📦 Suzuki Every 工作廂型車',category:'汽車',price:72000,description:'車身小巧、載貨空間充足的實用廂型車，能提高合法工作的每日收入。',image:'vehicles/suzuki_every.jpg',rarity:'稀有',buff:'work'},
  rocket_bunny_rx7:{name:'🔥 Mazda RX-7 FD 轉子戰魂',category:'汽車',price:420000,description:'經典轉子跑車，可自由搭配原廠、RE Amemiya、Rocket Bunny 與 VeilSide Fortune 外觀套件，特別擅長高速撤離。',image:'vehicles/rocket_bunny_rx7.jpg',rarity:'傳說',buff:'getaway'},
  nissan_gtr_r35_nismo:{name:'🏁 Nissan GT-R R35 Nismo 黑武士',category:'汽車',price:980000,description:'Nismo 強化動力、四輪驅動與賽道空力套件集於一身，是甩開追兵的頂級公路戰神。',image:'vehicles/nissan_gtr_r35_nismo.jpg',rarity:'神話',buff:'getaway'},
  toyota_hilux_gr:{name:'🛻 Toyota Hilux GR 越野工作王',category:'汽車',price:260000,description:'堅固可靠的四輪驅動貨卡，無論載運工具或長途工作都能提升每日工作收益。',image:'vehicles/toyota_hilux_gr.jpg',rarity:'史詩',buff:'work'},
  honda_nsx_red:{name:'🔴 Honda NSX 赤紅傳奇',category:'汽車',price:780000,description:'中置引擎與精準操控交織出的日系超跑傳奇，華麗登場能為賭場之夜帶來額外好運。',image:'vehicles/honda_nsx_red.jpg',rarity:'傳說',buff:'casino'},
  toyota_vios_2003:{name:'🩶 Toyota Vios 2003 經典代步',category:'汽車',price:45000,description:'保養簡單、油耗經濟的可靠房車，日常代步能降低資產商城的消費負擔。',image:'vehicles/toyota_vios_2003.jpg',rarity:'稀有',buff:'discount'},
  luxury_bentley:{name:'🪽 豪華房車｜Bentley Flying Spur',category:'汽車',price:680000,description:'英倫手工豪華房車，兼具舒適座艙與強勁動力，為車主拓展高端生意人脈。',image:'vehicles/luxury_bentley_flying_spur.jpg',rarity:'傳說',buff:'work'},
  luxury_rolls_royce:{name:'👑 豪華房車｜Rolls-Royce Phantom',category:'汽車',price:1500000,description:'極致寧靜與尊榮的旗艦房車，奢華後座能讓車主獲得更充分的休息。',image:'vehicles/luxury_rolls_royce_phantom.jpg',rarity:'神話',buff:'stamina'},
  luxury_century:{name:'🦅 豪華房車｜Toyota Century',category:'汽車',price:820000,description:'低調莊重的日系御用旗艦，專屬禮遇可降低資產商城的消費負擔。',image:'vehicles/luxury_toyota_century.jpg',rarity:'傳說',buff:'discount'},
  luxury_maybach:{name:'💎 豪華房車｜Mercedes-Maybach S-Class',category:'汽車',price:1100000,description:'總裁級移動行宮，精緻內裝與專屬服務能為賭場之夜帶來額外好運。',image:'vehicles/luxury_maybach_s_class.jpg',rarity:'神話',buff:'casino'},
  luxury_bmw_m7:{name:'🏁 豪華房車｜BMW M7',category:'汽車',price:560000,description:'豪華房車與高性能操控的結合，危急時刻也能迅速甩開追兵。',image:'vehicles/luxury_bmw_m7.jpg',rarity:'史詩',buff:'getaway'},
  blind_corolla:{name:'🎴 隱藏 Corolla AE86',category:'汽車',price:250000,description:'汽車盲盒中的隱藏傳奇車款，極低機率才能收藏。',image:'blindbox/corolla_ae86.jpg',rarity:'隱藏',buff:'getaway',forSale:false,blindBox:true},
  blind_totoro_catbus:{name:'🌳 龍貓公車',category:'汽車',price:600000,description:'只在雨夜與森林深處現身的傳說隱藏車輛，能穿越尋常道路無法抵達的撤離路線。',image:'blindbox/totoro_catbus.jpg',rarity:'傳說隱藏',buff:'getaway',forSale:false,blindBox:true},
  blind_240z:{name:'🏁 Fairlady 240Z 暮色傳奇',category:'汽車',price:140000,description:'經典長車頭雙門跑車，兼具收藏價值與敏捷的撤離能力。',image:'blindbox/fairlady_240z.jpg',rarity:'史詩',buff:'getaway',forSale:false,blindBox:true},
  blind_mazda3:{name:'🌃 夜影 Mazda 3',category:'汽車',price:35000,description:'適合每日通勤與夜間工作的靈活掀背車。',image:'blindbox/mazda3.jpg',rarity:'一般',buff:'work',forSale:false,blindBox:true},
  blind_yaris:{name:'🌙 月光 Yaris',category:'汽車',price:25000,description:'輕巧省油的城市小車，讓日常採購更加划算。',image:'blindbox/yaris.jpg',rarity:'一般',buff:'discount',forSale:false,blindBox:true},
  blind_galant:{name:'🌸 Galant VR-4 傳奇',category:'汽車',price:80000,description:'四輪驅動渦輪性能房車，特別擅長高速撤離。',image:'blindbox/galant_vr4.jpg',rarity:'稀有',buff:'getaway',forSale:false,blindBox:true},
  blind_accord:{name:'🌌 深夜 Accord',category:'汽車',price:45000,description:'舒適耐用的經典房車，提供更好的每日休息品質。',image:'blindbox/accord.jpg',rarity:'稀有',buff:'stamina',forSale:false,blindBox:true},
  blind_silvia_s13:{name:'🌑 Silvia S13 夜行者',category:'汽車',price:60000,description:'靈巧的後驅街車，適合在狹窄街道迅速撤離。',image:'blindbox/silvia_s13.jpg',rarity:'稀有',buff:'getaway',forSale:false,blindBox:true},
  blind_rx7_fd:{name:'🤍 RX-7 FD 白色彗星',category:'汽車',price:110000,description:'流線車身與轉子動力兼具，能為賭場之夜帶來額外好運。',image:'blindbox/rx7_fd.jpg',rarity:'史詩',buff:'casino',forSale:false,blindBox:true},
  blind_rx7_fc:{name:'💡 RX-7 FC 白色傳奇',category:'汽車',price:85000,description:'經典跳燈轉子跑車，收藏與高速逃脫能力兼備。',image:'blindbox/rx7_fc.jpg',rarity:'稀有',buff:'getaway',forSale:false,blindBox:true},
  blind_mirage:{name:'🩶 Mitsubishi Mirage 城市號',category:'汽車',price:18000,description:'樸實可靠的日常代步車，適合往返各種合法工作。',image:'blindbox/mirage.jpg',rarity:'一般',buff:'work',forSale:false,blindBox:true},
  blind_corolla_city:{name:'🔧 Toyota Corolla 實用派',category:'汽車',price:22000,description:'保養容易又節省開銷的實用房車，帶來商城會員優惠。',image:'blindbox/corolla_city.jpg',rarity:'一般',buff:'discount',forSale:false,blindBox:true},
  blind_s2000:{name:'🌸 Honda S2000 月夜敞篷',category:'汽車',price:95000,description:'高轉速敞篷跑車，夜間巡航後能獲得更充足的休息。',image:'blindbox/s2000.jpg',rarity:'史詩',buff:'stamina',forSale:false,blindBox:true},
  ford_focus:{name:'🔵 Ford Focus 都會藍星',category:'汽車',price:45000,description:'靈活實用的福特掀背車，適合穿梭城市完成各種合法工作。',image:'blindbox/ford/ford_focus.jpg',rarity:'一般',buff:'work',forSale:false,blindBox:true,blindBoxPack:'ford'},
  ford_explorer:{name:'🏙️ Ford Explorer 城市探險家',category:'汽車',price:80000,description:'寬敞舒適的家庭休旅，長途移動後仍能保有充足精神。',image:'blindbox/ford/ford_explorer.jpg',rarity:'稀有',buff:'stamina',forSale:false,blindBox:true,blindBoxPack:'ford'},
  ford_f150_raptor:{name:'🛻 Ford F-150 Raptor 猛禽',category:'汽車',price:130000,description:'能征服惡劣地形的高性能皮卡，載貨與工作效率同樣強悍。',image:'blindbox/ford/ford_f150_raptor.jpg',rarity:'稀有',buff:'work',forSale:false,blindBox:true,blindBoxPack:'ford'},
  ford_focus_rs:{name:'💙 Ford Focus RS 藍色閃電',category:'汽車',price:160000,description:'四輪驅動性能鋼砲，狹窄街道也能迅速甩開追兵。',image:'blindbox/ford/ford_focus_rs.jpg',rarity:'史詩',buff:'getaway',forSale:false,blindBox:true,blindBoxPack:'ford'},
  ford_mustang_gt:{name:'🐎 Ford Mustang GT 黑影野馬',category:'汽車',price:220000,description:'美式 V8 肌肉跑車，充滿氣勢的登場能替賭場之夜帶來好運。',image:'blindbox/ford/ford_mustang_gt.jpg',rarity:'史詩',buff:'casino',forSale:false,blindBox:true,blindBoxPack:'ford'},
  ford_shelby_gt500:{name:'🐍 Ford Shelby GT500 藍蛇',category:'汽車',price:420000,description:'機械增壓 V8 與 Shelby 賽道血統結合的強悍公路猛獸。',image:'blindbox/ford/ford_shelby_gt500.jpg',rarity:'傳說',buff:'getaway',forSale:false,blindBox:true,blindBoxPack:'ford'},
  ford_gt_2017:{name:'🏁 Ford GT 新世代藍焰',category:'汽車',price:800000,description:'低風阻車身與賽車科技打造的新世代超跑，是福特車包的頂級收藏。',image:'blindbox/ford/ford_gt_2017.jpg',rarity:'神話',buff:'getaway',forSale:false,blindBox:true,blindBoxPack:'ford'},
  ford_gt_heritage:{name:'6️⃣ Ford GT 經典傳承版',category:'汽車',price:650000,description:'向利曼傳奇致敬的經典塗裝超跑，收藏價值與牌桌幸運兼具。',image:'blindbox/ford/ford_gt_heritage.jpg',rarity:'傳說',buff:'casino',forSale:false,blindBox:true,blindBoxPack:'ford'},
  supercar:{name:'🪽 奧斯頓火神 Vulcan',category:'汽車',price:1900000,description:'賽道級限量猛獸，以強大下壓力和爆發加速統治夜間道路。',image:'supercars/aston_vulcan.jpg',rarity:'限定',buff:'getaway'},
  m3_gtr:{name:'🏁 M3 GTR 夜行戰神',category:'汽車',price:420000,description:'經典街道競速機器，兼具耐用性與甩開追兵的強悍速度。',image:'supercars/m3_gtr.jpg',rarity:'傳說',buff:'getaway'},
  purple_street_scooter:{name:'🛵 紫電街頭勁戰',category:'機車',price:35000,description:'台灣街頭風格的紫色改裝速克達。',image:'motorcycles/purple_street_scooter.png',rarity:'稀有'},
  orange_dirtbike:{name:'🏍️ 橘焰越野獵手',category:'機車',price:45000,description:'適合泥地與荒野路線的輕量越野車。',image:'motorcycles/orange_dirtbike.png',rarity:'稀有'},
  blue_naked:{name:'🏍️ 藍鋼街車',category:'機車',price:55000,description:'經典四缸街車，均衡而耐看。',image:'motorcycles/blue_naked.png',rarity:'稀有'},
  bosozoku:{name:'🏍️ 夜露死苦暴走號',category:'機車',price:60000,description:'高背座椅與暴走族塗裝，辨識度極高。',image:'motorcycles/bosozoku.png',rarity:'史詩'},
  wasteland_raider:{name:'🏍️ 荒野掠奪者',category:'機車',price:70000,description:'裝甲、探照燈與廢土風格的生存戰駒。',image:'motorcycles/wasteland_raider.png',rarity:'史詩'},
  electric_scooter:{name:'🛵 蒼藍電能速克達',category:'機車',price:75000,description:'安靜迅速的未來電動速克達。',image:'motorcycles/electric_scooter.png',rarity:'史詩'},
  red_touring:{name:'🏍️ 赤峰巡航者',category:'機車',price:95000,description:'兼顧山路操控與長途旅行的運動旅行車。',image:'motorcycles/red_touring.png',rarity:'史詩'},
  purple_chopper:{name:'🏍️ 紫焰美式嬉皮',category:'機車',price:110000,description:'長前叉與紫焰塗裝的訂製美式機車。',image:'motorcycles/purple_chopper.png',rarity:'傳說'},
  red_falcon:{name:'🏍️ 赤焰獵鷹',category:'機車',price:120000,description:'鮮紅全整流罩仿賽，為速度而生。',image:'motorcycles/red_falcon.png',rarity:'傳說'},
  silver_cruiser:{name:'🏍️ 銀翼公路之王',category:'機車',price:130000,description:'鍍鉻與大排量氣勢兼具的公路巡航車。',image:'motorcycles/silver_cruiser.png',rarity:'傳說'},
  platinum_tourer:{name:'🏍️ 白金陸上郵輪',category:'機車',price:180000,description:'配備大型風鏡、行李箱與豪華後座的旗艦旅行車。',image:'motorcycles/platinum_tourer.png',rarity:'神話'},
  neon_nuclear:{name:'🏍️ 霓虹核能戰駒',category:'機車',price:300000,description:'以發光核心驅動的賽博龐克未來機車。',image:'motorcycles/neon_nuclear.png',rarity:'神話'},
  shadow_hoverbike:{name:'🚀 幽影噴射飛車',category:'機車',price:750000,description:'具備噴射推進與短距離懸浮能力的終極座駕。',image:'motorcycles/shadow_hoverbike.png',rarity:'限定'},
  dakar_911:{name:'🏜️ 沙漠征服者 911',category:'汽車',price:280000,description:'越野化超級跑車，能在沙地與崎嶇道路保持高速撤離。',image:'supercars/dakar_911.jpg',rarity:'傳說',buff:'getaway'},
  neon_918:{name:'🌃 霓虹幻影 918',category:'汽車',price:520000,description:'混合動力霓虹超跑，出入賭場時總能帶來額外好運。',image:'supercars/neon_918.jpg',rarity:'傳說',buff:'casino'},
  midnight_m8:{name:'🌌 午夜藍焰 M8',category:'汽車',price:260000,description:'低調豪華的高速 GT，拓展人脈並提升合法工作的收益。',image:'supercars/midnight_m8.jpg',rarity:'史詩',buff:'work'},
  silver_r34:{name:'🩶 白銀戰神 R34',category:'汽車',price:320000,description:'經典街道戰神，改裝後的加速性能特別適合甩開追兵。',image:'supercars/silver_r34.jpg',rarity:'傳說',buff:'getaway'},
  azure_hypercar:{name:'🌊 蔚藍海岸皇者',category:'汽車',price:900000,description:'海岸限定頂級超跑，車主可享有豪華商城的尊榮待遇。',image:'supercars/azure_hypercar.jpg',rarity:'神話',buff:'discount'},
  crimson_bull:{name:'🔥 赤焰狂牛',category:'汽車',price:1100000,description:'暴烈而迅捷的紅色超跑，是銀行警報響起後最可靠的逃生利器。',image:'supercars/crimson_bull.jpg',rarity:'神話',buff:'getaway'},
  alpine_legend:{name:'🏔️ 雪峰經典傳奇',category:'汽車',price:750000,description:'收藏級復古超跑，長途巡航座艙讓車主每天保持充沛體力。',image:'supercars/alpine_legend.jpg',rarity:'傳說',buff:'stamina'},
  night_reaper:{name:'🖤 暗夜收割者',category:'汽車',price:1600000,description:'黑橙塗裝的極速猛獸，所到之處總伴隨高額賭場派彩。',image:'supercars/night_reaper.jpg',rarity:'神話',buff:'casino'},
  orbital_silver:{name:'🛰️ 星環銀翼',category:'汽車',price:2800000,description:'能在軌道競速場奔馳的未來超跑，提供頂級休息與維生系統。',image:'supercars/orbital_silver.jpg',rarity:'限定',buff:'stamina'},
  orbital_silver_omega:{name:'🌠 星環銀翼 Ω',category:'汽車',price:3800000,description:'星環銀翼的終極限量強化版，專為最高額牌局與收藏家打造。',image:'supercars/orbital_silver.jpg',rarity:'限定',buff:'casino'},
  mystery_huayra:{name:'🎁 經典神秘風神',category:'汽車',price:5500000,description:'幸運輪盤曾經推出的珍稀收藏級超跑，永久增益為商城車輛的 2 倍。',image:'supercars/mystery_huayra.jpg',rarity:'輪盤典藏',buff:'getaway',forSale:false,wheelPrize:true},
  helicopter:{name:'🚁 A1 都會私人直升機',category:'飛行器',price:1200000,description:'適合城市屋頂起降的高級私人直升機，能快速撤離銀行封鎖區。',image:'aircraft/private_helicopter.jpg',rarity:'傳說',buff:'getaway'},
  jet:{name:'🚁 黑鷹戰術直升機',category:'飛行器',price:3600000,description:'具備重型運輸與惡劣天候能力的軍規直升機，是最高階的空中撤離資產。',image:'aircraft/military_helicopter.jpg',rarity:'限定',buff:'getaway'}
};
const rentalSuiteVariants={
  standard:{name:'舒適日租套房',description:'採光明亮、生活機能齊全的簡約套房。',image:'properties/daily_rental_suite.jpg',assetId:'daily_rental_suite'},
  investor:{name:'投資人療癒套房',description:'配有看盤專區，適合整理財務與重新出發。',image:'properties/investor_rental_suite.jpg',assetId:'daily_rental_suite'},
  gaming:{name:'電競玩家專屬套房',description:'高速網路、三螢幕設備與沉浸式 RGB 電競空間。',image:'properties/gaming_rental_suite.jpg',assetId:'daily_rental_suite'},
  budget:{name:'窮鬼日租房｜800 金幣',description:'乾淨基本、經濟實惠；租用增益為標準房型的一半。',image:'properties/poor_daily_rental_suite.jpg',assetId:'poor_daily_rental_suite'},
  haunted:{name:'猛鬼套房｜免費',description:'免費入住；隨機獲得一項大量增益或減益，效果固定 24 小時且無法重抽。',image:'properties/haunted_suite.jpg',assetId:'haunted_daily_suite'}
};
const blindBoxRegularIds=['blind_mazda3','blind_yaris','blind_galant','blind_accord','blind_silvia_s13','blind_rx7_fd','blind_rx7_fc','blind_mirage','blind_corolla_city','blind_s2000','blind_240z'];
const blindBoxHiddenRates={blind_totoro_catbus:0.5,blind_corolla:1.5};
const blindBoxHiddenIds=Object.keys(blindBoxHiddenRates);
const blindBoxAllIds=[...blindBoxRegularIds,...blindBoxHiddenIds];
const fordBlindBoxRates={ford_focus:20,ford_explorer:15,ford_f150_raptor:15,ford_focus_rs:14,ford_mustang_gt:13,ford_shelby_gt500:10,ford_gt_2017:7,ford_gt_heritage:6};
const fordBlindBoxIds=Object.keys(fordBlindBoxRates);
const blindBoxPacks={
  standard:{name:'綜合車包',price:10000,stamina:3,ids:blindBoxAllIds,preview:null},
  ford:{name:'福特車包',price:10000,stamina:3,ids:fordBlindBoxIds,preview:'blindbox/ford/ford_pack_preview.jpg'}
};
const blindBoxChanceLabel=(assetId,packId='standard')=>packId==='ford'?`每盒 ${fordBlindBoxRates[assetId]||0}%`:blindBoxHiddenRates[assetId]!==undefined?`每盒 ${blindBoxHiddenRates[assetId]}%`:'普通獎池隨機抽取';
function drawBlindBoxAssetId(packId='standard') {
  if(packId==='ford') {
    const roll=Math.random()*100;
    let cumulative=0;
    for(const assetId of fordBlindBoxIds) {
      cumulative+=fordBlindBoxRates[assetId];
      if(roll<cumulative) return assetId;
    }
    return fordBlindBoxIds.at(-1);
  }
  const roll=Math.random()*100;
  if(roll<blindBoxHiddenRates.blind_totoro_catbus) return 'blind_totoro_catbus';
  if(roll<blindBoxHiddenRates.blind_totoro_catbus+blindBoxHiddenRates.blind_corolla) return 'blind_corolla';
  return blindBoxRegularIds[Math.floor(Math.random()*blindBoxRegularIds.length)];
}
const weeklyMysteryNames=[
  '紅牛 F1 斯帕戰駒','Mercedes-AMG GT 夜行版','Mercedes-AMG ONE 星艦','Aston Martin DB10 特務座駕',
  'Porsche 911 Dakar 沙漠征服者','Toyota Wish 都會巡航','BMW F40 M 夜戰版','Audi RS3 霓虹猛獸',
  ...Array.from({length:23},(_,index)=>`神秘車庫典藏 #${String(index+9).padStart(2,'0')}`),
  ...Array.from({length:10},(_,index)=>`像素超跑典藏 #${String(10-index).padStart(2,'0')}`)
];
const weeklyMysteryIds=weeklyMysteryNames.map((name,index)=>{
  const number=String(index+1).padStart(2,'0'),id=`weekly_mystery_${number}`;
  assetCatalog[id]={
    name:`🎁 ${name}`,category:'汽車',price:3000000+index*50000,
    description:'幸運輪盤每週日輪替的隱藏車輛，只能透過最大獎取得，永久增益為商城車輛的 2 倍。',
    image:`wheel_pool/wheel_${number}.png`,rarity:'每週隱藏',
    buff:['getaway','casino','stamina','work','discount'][index%5],forSale:false,wheelPrize:true
  };
  return id;
});
const assetCategories=['房地產','郵輪','汽車','機車','飛行器','收藏品'];
const assetShopCategories={
  property:{label:'房地產',emoji:'🏠',catalog:['房地產']},
  car:{label:'汽車',emoji:'🚗',catalog:['汽車','收藏品']},
  aircraft:{label:'飛行器',emoji:'🚁',catalog:['飛行器']},
  motorcycle:{label:'機車',emoji:'🏍️',catalog:['機車']},
  boat:{label:'船隻',emoji:'🛥️',catalog:['郵輪']}
};
const ASSET_SHOP_PAGE_SIZE=25;
function assetShopEntries(categoryKey) {
  const category=assetShopCategories[categoryKey];
  if(!category) return [];
  return Object.entries(assetCatalog).filter(([,asset])=>category.catalog.includes(asset.category)&&asset.forSale!==false);
}
function assetShopCategoryLabel(categoryKey) {
  return assetShopCategories[categoryKey]?.label||'資產';
}
function assetShopCategoryRow(token,selectedCategory=null) {
  const menu=new StringSelectMenuBuilder().setCustomId(`asset_shop_category:${token}`).setPlaceholder('先選擇資產分類').addOptions(
    Object.entries(assetShopCategories).map(([value,category])=>({
      label:category.label,
      value,
      emoji:category.emoji,
      description:`查看可購買的${category.label}`,
      default:value===selectedCategory
    }))
  );
  return new ActionRowBuilder().addComponents(menu);
}
function assetShopPageInfo(categoryKey,page=0) {
  const entries=assetShopEntries(categoryKey),pageCount=Math.max(1,Math.ceil(entries.length/ASSET_SHOP_PAGE_SIZE));
  return {entries,pageCount,page:Math.min(Math.max(0,page),pageCount-1)};
}
function assetShopProductRow(token,categoryKey,page=0,selectedAssetId=null) {
  const info=assetShopPageInfo(categoryKey,page),start=info.page*ASSET_SHOP_PAGE_SIZE;
  const options=info.entries.slice(start,start+ASSET_SHOP_PAGE_SIZE).map(([assetId,asset])=>({
    label:asset.name.slice(0,100),
    value:assetId,
    description:`${asset.rarity||'一般'}｜${fmt(asset.price)} 金幣`.slice(0,100),
    default:assetId===selectedAssetId
  }));
  const menu=new StringSelectMenuBuilder()
    .setCustomId(`asset_shop_product:${token}:${info.page}`)
    .setPlaceholder(`選擇${assetShopCategoryLabel(categoryKey)}商品（第 ${info.page+1}/${info.pageCount} 頁）`)
    .addOptions(options);
  return new ActionRowBuilder().addComponents(menu);
}
function assetShopNavigationRow(token,categoryKey,page=0) {
  const info=assetShopPageInfo(categoryKey,page);
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`asset_shop_page:${token}:${categoryKey}:${info.page-1}`).setLabel('上一頁').setEmoji('⬅️').setStyle(ButtonStyle.Secondary).setDisabled(info.page<=0),
    new ButtonBuilder().setCustomId(`asset_shop_page_info:${token}`).setLabel(`${info.page+1} / ${info.pageCount}`).setStyle(ButtonStyle.Secondary).setDisabled(true),
    new ButtonBuilder().setCustomId(`asset_shop_page:${token}:${categoryKey}:${info.page+1}`).setLabel('下一頁').setEmoji('➡️').setStyle(ButtonStyle.Secondary).setDisabled(info.page>=info.pageCount-1)
  );
}
function assetShopComponents(token,categoryKey=null,page=0,selectedAssetId=null,purchaseToken=null) {
  const rows=[assetShopCategoryRow(token,categoryKey)];
  if(categoryKey) {
    rows.push(assetShopProductRow(token,categoryKey,page,selectedAssetId));
    if(assetShopPageInfo(categoryKey,page).pageCount>1) rows.push(assetShopNavigationRow(token,categoryKey,page));
  }
  if(purchaseToken) rows.push(new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`asset_purchase_confirm:${purchaseToken}`).setLabel('確認購買').setEmoji('✅').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`asset_purchase_cancel:${purchaseToken}`).setLabel('取消').setEmoji('❌').setStyle(ButtonStyle.Danger)
  ));
  return rows;
}
function assetShopOverviewEmbed(categoryKey=null,page=0) {
  if(!categoryKey) return new EmbedBuilder().setColor(0xD4AF37).setTitle('🏛️ 購買資產').setDescription('請先從下拉選單選擇分類，再選擇商品。\n\n商品被選取後，名稱、售價、增益與圖片會立即顯示；確認前不會扣除金幣。\n\n分類：**房地產／汽車／飛行器／機車／船隻**');
  const info=assetShopPageInfo(categoryKey,page),start=info.page*ASSET_SHOP_PAGE_SIZE;
  const list=info.entries.slice(start,start+ASSET_SHOP_PAGE_SIZE).map(([,asset])=>`• ${asset.name}｜**${fmt(asset.price)}**`).join('\n');
  return new EmbedBuilder().setColor(0x1565C0).setTitle(`${assetShopCategories[categoryKey].emoji} ${assetShopCategoryLabel(categoryKey)}`).setDescription(`${list||'此分類目前沒有可購買商品。'}\n\n請使用第二個下拉選單選擇商品。`);
}
function assetMediaPayload(embed,assetId,asset) {
  const paths=asset.images?.length?asset.images:asset.image?[asset.image]:[];
  if(!paths.length) return {embeds:[embed]};
  const names=paths.map((path,index)=>`${assetId}_${index+1}${extname(path)||'.jpg'}`);
  const files=paths.map((path,index)=>new AttachmentBuilder(assetPath(path),{name:names[index]}));
  embed.setImage(`attachment://${names[0]}`);
  const color=embed.data.color||0x1565C0;
  const embeds=[embed,...names.slice(1).map((name,index)=>new EmbedBuilder().setColor(color).setTitle(`${asset.name}｜空間照片 ${index+2}`).setImage(`attachment://${name}`))];
  return {embeds,files};
}
function rentalSuiteSelectRow(token,selected=null) {
  const menu=new StringSelectMenuBuilder().setCustomId(`rental_suite_select:${token}`).setPlaceholder('選擇想入住的日租套房').addOptions(
    Object.entries(rentalSuiteVariants).map(([value,variant])=>({label:variant.name,description:variant.description.slice(0,100),value,default:value===selected}))
  );
  return new ActionRowBuilder().addComponents(menu);
}
function carBlindBoxCatalogRow(packId='standard',selected=null) {
  const pack=blindBoxPacks[packId]||blindBoxPacks.standard;
  const menu=new StringSelectMenuBuilder().setCustomId(`car_blindbox_catalog:${packId}`).setPlaceholder('選擇車款查看圖片與增益').addOptions(
    pack.ids.map(assetId=>{
      const asset=assetCatalog[assetId];
      return {label:asset.name.replace(/^[^A-Za-z0-9\u3400-\u9FFF]+/u,'').slice(0,100),description:`${asset.rarity}｜${blindBoxChanceLabel(assetId,packId)}｜${assetBuffs[asset.buff].name}`.slice(0,100),value:assetId,default:assetId===selected};
    })
  );
  return new ActionRowBuilder().addComponents(menu);
}
const assetBuffs={
  getaway:{name:'💨 極速逃脫',description:'搶銀行成功率 +2%（資產效果合計最高 +20%）',heist:2},
  stamina:{name:'⚡ 豪華休息區',description:'每日體力上限 +10（資產效果合計最高 +100）',stamina:10},
  work:{name:'💼 生意門路',description:'工作收入 +10%（資產效果合計最高 +75%）',work:0.10},
  casino:{name:'🍀 幸運收藏',description:'賭場獲勝派彩 +5%（資產效果合計最高 +60%）',casino:0.05},
  discount:{name:'🏷️ 尊榮會員',description:'商城額外折扣 5%（資產效果合計最高 30%）',discount:0.05},
  haunted_fortune:{name:'👻 鬼王護駕',description:'搶銀行成功率 +15%。',heist:15},
  haunted_energy:{name:'🩸 陰氣灌體',description:'每日體力上限 +100。',stamina:100},
  haunted_work:{name:'🕯️ 鬼差代班',description:'工作收入 +60%。',work:0.60},
  haunted_jackpot:{name:'🎰 賭鬼附身',description:'賭場獲勝派彩 +50%。',casino:0.50},
  haunted_exhaustion:{name:'💀 鬼壓床',description:'每日體力上限 -150（最低仍保留 20）。',stamina:-150},
  haunted_poverty:{name:'🕳️ 窮神入住',description:'工作收入 -60%。',work:-0.60},
  haunted_curse:{name:'🧿 厲鬼詛咒',description:'賭場獲勝派彩 -50%。',casino:-0.50}
};
const standardAssetBuffIds=['getaway','stamina','work','casino','discount'];
const vehicleModCatalog={
  engine:{label:'引擎',emoji:'⚙️',column:'engine_id',options:{
    stock:{name:'原廠引擎',price:0,race:0,heist:0,speed:0,acceleration:0},
    stage1:{name:'Stage 1 電腦調校',price:80000,race:0.35,heist:1,speed:1,acceleration:1},
    stage2:{name:'Stage 2 渦輪強化',price:220000,race:0.8,heist:2,speed:1,acceleration:2},
    stage3:{name:'Stage 3 賽道引擎',price:500000,race:1.4,heist:3,speed:2,acceleration:2}
  }},
  wheels:{label:'輪框',emoji:'🛞',column:'wheels_id',options:{
    stock:{name:'原廠輪框',price:0,race:0,handling:0},
    te37:{name:'Volk TE37 鍛造輪框',price:60000,race:0.12,handling:1},
    bbs_lm:{name:'BBS LM 多片式輪框',price:85000,race:0.16,handling:1},
    forged:{name:'競技輕量鍛造輪框',price:120000,race:0.24,acceleration:1,handling:1}
  }},
  spoiler:{label:'尾翼',emoji:'🪽',column:'spoiler_id',options:{
    stock:{name:'原廠尾翼',price:0,race:0}
  }},
  paint:{label:'烤漆',emoji:'🎨',column:'paint_id',options:{
    factory:{name:'原廠車色',price:0},white:{name:'珍珠白',price:15000},black:{name:'曜石黑',price:15000},
    yellow:{name:'競速黃',price:18000},red:{name:'烈焰紅',price:18000},blue:{name:'電光藍',price:18000},
    purple:{name:'午夜紫',price:25000},green:{name:'翡翠綠',price:25000}
  }},
  widebody:{label:'寬體',emoji:'🏁',column:'widebody_id',options:{
    stock:{name:'原廠車身',price:0,race:0},
    liberty_walk:{name:'Liberty Walk 寬體',price:180000,race:0.28,handling:1},
    rocket_bunny:{name:'Rocket Bunny 寬體',price:220000,race:0.36,acceleration:1,handling:1},
    competition:{name:'賽事級空力寬體',price:350000,race:0.55,speed:1,handling:2}
  }},
  suspension:{label:'懸吊',emoji:'🔩',column:'suspension_id',options:{
    stock:{name:'原廠懸吊',price:0,race:0},
    street:{name:'街道短彈簧',price:50000,race:0.15,handling:1},
    sport:{name:'運動型避震器',price:140000,race:0.4,handling:1},
    race:{name:'賽事全可調懸吊',price:300000,race:0.8,handling:2}
  }}
};
const modifiableVehicleCategories=new Set(['汽車','機車']);
const defaultVehicleMods={paint_id:'factory',wheels_id:'stock',spoiler_id:'stock',widebody_id:'stock',engine_id:'stock',suspension_id:'stock',total_spent:0};
function vehicleMods(g,u,assetId) {
  return db.prepare('SELECT * FROM vehicle_mods WHERE guild_id=? AND user_id=? AND asset_id=?').get(g,u,assetId)||{...defaultVehicleMods,guild_id:g,user_id:u,asset_id:assetId};
}
function vehicleModOption(category,optionId) {
  return vehicleModCatalog[category]?.options[optionId]||null;
}
const vehicleModNameOverrides={
  rocket_bunny_rx7:{
    wheels:{bbs_lm:'Work Meister S1 三片式輪框'},
    widebody:{
      liberty_walk:'RE Amemiya 街道賽道套件',
      rocket_bunny:'Rocket Bunny 寬體',
      competition:'VeilSide Fortune 寬體'
    }
  }
};
function vehicleModOptionName(assetId,category,optionId) {
  return vehicleModNameOverrides[assetId]?.[category]?.[optionId]||vehicleModOption(category,optionId)?.name||optionId;
}
function vehicleHasVisualMods(assetId) {
  return existsSync(resolve(process.cwd(),'assets','mod_layers',assetId,'presets'));
}
function ownedVisualModVehicles(g,u) {
  return assetsOf(g,u).filter(row=>{
    const asset=assetCatalog[row.asset_id];
    return asset&&modifiableVehicleCategories.has(asset.category)&&vehicleHasVisualMods(row.asset_id);
  });
}
const vehicleExteriorModCategories=new Set(['paint','wheels','spoiler','widebody']);
function vehicleVisualConfigSupported(assetId,selections) {
  const root=resolve(process.cwd(),'assets','mod_layers',assetId);
  const paint=selections.paint||'factory',widebody=selections.widebody||'stock',wheels=selections.wheels||'stock',spoiler=selections.spoiler||'stock';
  const exact=resolve(root,'presets',`${paint}_${widebody}_${wheels}_${spoiler}.png`);
  if(existsSync(exact)) return true;
  const kitBase=resolve(root,'presets',`${paint}_${widebody}_stock_stock.png`);
  const stockBase=resolve(root,'presets',`${paint}_stock_stock_stock.png`);
  const paintAvailable=paint==='factory'||existsSync(resolve(root,'paint',`${paint}.png`))||existsSync(resolve(root,'body_mask.png'));
  const wheelAvailable=wheels==='stock'||existsSync(resolve(root,'wheels',`${widebody}_${wheels}.png`))||existsSync(resolve(root,'wheels',`${wheels}.png`));
  const spoilerAvailable=spoiler==='stock'||existsSync(resolve(root,'spoiler',`${spoiler}.png`));
  if(existsSync(kitBase)) return wheelAvailable&&spoilerAvailable;
  const widebodyAvailable=widebody==='stock'||existsSync(resolve(root,'widebody',`${widebody}.png`));
  return (existsSync(stockBase)||paintAvailable)&&widebodyAvailable&&wheelAvailable&&spoilerAvailable;
}
function vehicleModSelections(g,u,assetId,pending=null) {
  const row=vehicleMods(g,u,assetId),result={};
  for(const [category,definition] of Object.entries(vehicleModCatalog)) {
    const selected=row[definition.column];
    result[category]=definition.options[selected]?selected:Object.keys(definition.options)[0];
  }
  if(pending?.category&&vehicleModCatalog[pending.category]?.options[pending.optionId]) result[pending.category]=pending.optionId;
  return result;
}
function vehicleModPerformance(g,u,assetId,pending=null) {
  const selections=vehicleModSelections(g,u,assetId,pending),total={race:0,heist:0,speed:0,acceleration:0,handling:0};
  for(const [category,optionId] of Object.entries(selections)) {
    const option=vehicleModOption(category,optionId)||{};
    for(const key of Object.keys(total)) total[key]+=option[key]||0;
  }
  return total;
}
function vehicleModRatings(g,u,assetId,pending=null) {
  const asset=assetCatalog[assetId]||{},mods=vehicleModPerformance(g,u,assetId,pending);
  const priceBase=Math.max(1,Math.min(4,Math.round(Math.log10(Math.max(10000,asset.price||10000))-3.6)));
  const rarityBase={稀有:1,史詩:1,傳說:2,神話:2,限定:2,傳說隱藏:2}[asset.rarity]||0;
  const base=Math.max(1,Math.min(5,priceBase+rarityBase));
  return {
    speed:Math.max(1,Math.min(5,base+Math.min(2,mods.speed))),
    acceleration:Math.max(1,Math.min(5,Math.max(1,base-1)+Math.min(2,mods.acceleration))),
    handling:Math.max(1,Math.min(5,Math.max(1,base-1)+Math.min(2,mods.handling)))
  };
}
function purchaseVehicleMod(g,u,assetId,category,optionId) {
  const asset=assetCatalog[assetId],definition=vehicleModCatalog[category],option=vehicleModOption(category,optionId);
  if(!asset||!modifiableVehicleCategories.has(asset.category)) throw new Error('只有車庫中的汽車或機車可以改裝');
  const owned=db.prepare('SELECT quantity FROM player_assets WHERE guild_id=? AND user_id=? AND asset_id=?').get(g,u,assetId)?.quantity||0;
  if(!owned) throw new Error('你目前沒有這輛車');
  if(!definition||!option) throw new Error('找不到這項改裝零件');
  const current=vehicleMods(g,u,assetId),currentId=current[definition.column],currentOption=vehicleModOption(category,currentId)||{price:0};
  if(currentId===optionId) throw new Error('這項改裝目前已經裝備中');
  if(vehicleExteriorModCategories.has(category)) {
    const prospective=vehicleModSelections(g,u,assetId);
    prospective[category]=optionId;
    if(!vehicleVisualConfigSupported(assetId,prospective)) throw new Error('這個外觀組合尚未完成圖片素材，本次不會扣款');
  }
  const progressive=category==='engine'||category==='suspension';
  const price=progressive?Math.max(0,option.price-currentOption.price):option.price;
  db.exec('BEGIN IMMEDIATE');
  try {
    const wallet=ensureWallet(g,u);
    if(wallet<price) throw new Error(`金幣不足，需要 ${fmt(price)}`);
    const next=wallet-price,selections=vehicleModSelections(g,u,assetId);
    selections[category]=optionId;
    db.prepare(`INSERT INTO vehicle_mods(guild_id,user_id,asset_id,paint_id,wheels_id,spoiler_id,widebody_id,engine_id,suspension_id,total_spent)
      VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(guild_id,user_id,asset_id) DO UPDATE SET
      paint_id=excluded.paint_id,wheels_id=excluded.wheels_id,spoiler_id=excluded.spoiler_id,widebody_id=excluded.widebody_id,
      engine_id=excluded.engine_id,suspension_id=excluded.suspension_id,total_spent=vehicle_mods.total_spent+excluded.total_spent,updated_at=CURRENT_TIMESTAMP`)
      .run(g,u,assetId,selections.paint,selections.wheels,selections.spoiler,selections.widebody,selections.engine,selections.suspension,price);
    db.prepare('UPDATE wallets SET balance=?,updated_at=CURRENT_TIMESTAMP WHERE guild_id=? AND user_id=?').run(next,g,u);
    db.prepare('INSERT INTO ledger(guild_id,user_id,delta,balance_after,kind,actor_id,reason) VALUES(?,?,?,?,?,?,?)')
      .run(g,u,-price,next,'vehicle_mod',u,`改裝 ${asset.name}｜${definition.label}：${vehicleModOptionName(assetId,category,optionId)}`);
    db.exec('COMMIT');
    return {asset,category,option,price,balance:next};
  } catch(error) { db.exec('ROLLBACK'); throw error; }
}
const vehicleAssetCategories=new Set(['汽車','機車','飛行器','郵輪']);
const vehicleRarityBuffMultipliers={史詩:1.1,傳說:1.2,傳說隱藏:1.2};
const assetBuffPower=assetId=>{
  const asset=assetCatalog[assetId];
  if(!asset) return 1;
  const basePower=asset.buffMultiplier??(asset.wheelPrize?2:1);
  if(!vehicleAssetCategories.has(asset.category)) return basePower;
  return basePower*(vehicleRarityBuffMultipliers[asset.rarity]||1);
};
function assetBuffLabel(assetId,buffId) {
  const buff=assetBuffs[buffId];
  const power=assetBuffPower(assetId);
  const multiplier=Number.isInteger(power)?String(power):power.toFixed(1).replace(/\.0$/,'');
  const powerLabel=assetCatalog[assetId]?.wheelPrize&&power===2?'｜🎡 輪盤強化 ×2':power===1.2?'｜傳說強化 ×1.2':power===1.1?'｜史詩強化 ×1.1':power<1?'｜平價房型 ×0.5':power!==1?`｜強力增益 ×${multiplier}`:'';
  return `${buff.name}${powerLabel}`;
}
function assetBuffDescription(assetId,buffId) {
  const power=assetBuffPower(assetId);
  if(power===1) return assetBuffs[buffId].description;
  const descriptions={
    getaway:`搶銀行成功率 +${2*power}%（資產效果合計最高 +20%）`,
    stamina:`每日體力上限 +${10*power}（資產效果合計最高 +100）`,
    work:`工作收入 +${10*power}%（資產效果合計最高 +75%）`,
    casino:`賭場獲勝派彩 +${5*power}%（資產效果合計最高 +60%）`,
    discount:`商城額外折扣 ${5*power}%（資產效果合計最高 30%）`
  };
  return descriptions[buffId];
}
function ensureAssetBuff(g,u,assetId) {
  const owned=db.prepare('SELECT quantity FROM player_assets WHERE guild_id=? AND user_id=? AND asset_id=?').get(g,u,assetId)?.quantity||0;
  if(!owned) return null;
  let row=db.prepare('SELECT buff_id FROM asset_bonuses WHERE guild_id=? AND user_id=? AND asset_id=?').get(g,u,assetId);
  if(!row) {
    const buffId=assetCatalog[assetId]?.buff||standardAssetBuffIds[Math.floor(Math.random()*standardAssetBuffIds.length)];
    db.prepare('INSERT OR IGNORE INTO asset_bonuses(guild_id,user_id,asset_id,buff_id) VALUES(?,?,?,?)').run(g,u,assetId,buffId);
    row={buff_id:buffId};
  }
  return row.buff_id;
}
function assetBonusRows(g,u) {
  const permanent=assetsOf(g,u).map(row=>({...row,buff_id:ensureAssetBuff(g,u,row.asset_id),temporary:false}));
  const rentals=activeRentalAssets(g,u).map(row=>({...row,buff_id:row.buff_id||assetCatalog[row.asset_id]?.buff||'stamina'}));
  return [...permanent,...rentals];
}
function assetBuffCount(g,u,buffId) {
  return assetBonusRows(g,u).filter(row=>row.buff_id===buffId).reduce((total,row)=>total+assetBuffPower(row.asset_id),0);
}
const assetEffectTotal=(g,u,key)=>assetBonusRows(g,u).reduce((total,row)=>total+(assetBuffs[row.buff_id]?.[key]||0)*assetBuffPower(row.asset_id),0);
const assetHeistBonus=(g,u)=>Math.max(-20,Math.min(20,assetEffectTotal(g,u,'heist')));
const assetStaminaBonus=(g,u)=>Math.max(-180,Math.min(100,assetEffectTotal(g,u,'stamina')));
const assetWorkBonus=(g,u)=>Math.max(0.25,Math.min(1.75,1+assetEffectTotal(g,u,'work')));
const assetCasinoBonus=(g,u)=>Math.max(0.25,Math.min(1.60,1+assetEffectTotal(g,u,'casino')));
const assetShopDiscount=(g,u)=>Math.max(-0.30,Math.min(0.30,assetEffectTotal(g,u,'discount')));
function assetsOf(g,u) {
  return db.prepare('SELECT asset_id,quantity FROM player_assets WHERE guild_id=? AND user_id=? AND quantity>0 ORDER BY asset_id').all(g,u);
}
const heistVehicleCategories=new Set(['汽車','機車','飛行器','郵輪']);
function ownedHeistVehicles(g,u) {
  return assetsOf(g,u)
    .filter(row=>heistVehicleCategories.has(assetCatalog[row.asset_id]?.category))
    .sort((a,b)=>(assetCatalog[b.asset_id]?.price||0)-(assetCatalog[a.asset_id]?.price||0));
}
function selectedHeistVehicle(heist) {
  if(!heist.vehicleId) return null;
  const owned=ownedHeistVehicles(heist.guildId,heist.leaderId).find(row=>row.asset_id===heist.vehicleId);
  if(!owned) {
    heist.vehicleId=null;
    return null;
  }
  return assetCatalog[owned.asset_id]||null;
}
function selectedHeistVehicleName(heist) {
  return selectedHeistVehicle(heist)?.name||'預設接應車';
}
function selectedHeistVehicleBonus(heist) {
  const asset=selectedHeistVehicle(heist);
  if(!asset) return 0;
  const buffId=ensureAssetBuff(heist.guildId,heist.leaderId,heist.vehicleId);
  const modBonus=vehicleModPerformance(heist.guildId,heist.leaderId,heist.vehicleId).heist;
  return Math.max(0,Math.min(20,(assetBuffs[buffId]?.heist||0)*assetBuffPower(heist.vehicleId)+modBonus));
}
function activeRentalAssets(g,u) {
  const now=Date.now();
  db.prepare('DELETE FROM asset_rentals WHERE expires_at<=?').run(now);
  return db.prepare('SELECT asset_id,1 AS quantity,expires_at,buff_id FROM asset_rentals WHERE guild_id=? AND user_id=? AND expires_at>? ORDER BY expires_at').all(g,u,now).map(row=>({...row,temporary:true}));
}
function buyAsset(g,u,assetId,quantity) {
  const asset=assetCatalog[assetId],total=asset.price*quantity;
  ensureWallet(g,u);
  db.exec('BEGIN IMMEDIATE');
  try {
    const current=db.prepare('SELECT balance FROM wallets WHERE guild_id=? AND user_id=?').get(g,u).balance;
    if(current<total) throw new Error(`金幣不足，需要 ${fmt(total)}`);
    const next=current-total;
    db.prepare('UPDATE wallets SET balance=?,updated_at=CURRENT_TIMESTAMP WHERE guild_id=? AND user_id=?').run(next,g,u);
    if(asset.temporaryHours) {
      if(quantity!==1) throw new Error('限時房產每次只能租用 1 間');
      const now=Date.now(),activeRental=db.prepare('SELECT expires_at FROM asset_rentals WHERE guild_id=? AND user_id=? AND asset_id=? AND expires_at>?').get(g,u,assetId,now);
      if(asset.randomRentalBuffs&&activeRental) throw new Error('猛鬼套房的效果仍在持續，必須等本次 24 小時租期結束後才能再次入住');
      if(asset.rentalGroup) {
        for(const [otherId,otherAsset] of Object.entries(assetCatalog)) {
          if(otherId!==assetId&&otherAsset.rentalGroup===asset.rentalGroup) db.prepare('DELETE FROM asset_rentals WHERE guild_id=? AND user_id=? AND asset_id=?').run(g,u,otherId);
        }
      }
      const currentExpiry=db.prepare('SELECT expires_at FROM asset_rentals WHERE guild_id=? AND user_id=? AND asset_id=?').get(g,u,assetId)?.expires_at||0;
      const expiresAt=Math.max(now,currentExpiry)+asset.temporaryHours*60*60*1000;
      const buffId=asset.randomRentalBuffs?.[Math.floor(Math.random()*asset.randomRentalBuffs.length)]||asset.buff||'stamina';
      db.prepare('INSERT INTO asset_rentals(guild_id,user_id,asset_id,expires_at,buff_id) VALUES(?,?,?,?,?) ON CONFLICT(guild_id,user_id,asset_id) DO UPDATE SET expires_at=excluded.expires_at,buff_id=excluded.buff_id,rented_at=CURRENT_TIMESTAMP').run(g,u,assetId,expiresAt,buffId);
      db.prepare('INSERT INTO ledger(guild_id,user_id,delta,balance_after,kind,actor_id,reason) VALUES(?,?,?,?,?,?,?)').run(g,u,-total,next,'asset_rental',u,`租用 ${asset.name} 24 小時｜金幣直接銷毀`);
      db.exec('COMMIT'); return {next,total,buffId,temporary:true,expiresAt};
    }
    db.prepare('INSERT INTO player_assets(guild_id,user_id,asset_id,quantity) VALUES(?,?,?,?) ON CONFLICT(guild_id,user_id,asset_id) DO UPDATE SET quantity=quantity+excluded.quantity').run(g,u,assetId,quantity);
    db.prepare('INSERT INTO ledger(guild_id,user_id,delta,balance_after,kind,actor_id,reason) VALUES(?,?,?,?,?,?,?)').run(g,u,-total,next,'asset_purchase',u,`購買 ${asset.name} x${quantity}｜金幣直接銷毀`);
    let buffId=db.prepare('SELECT buff_id FROM asset_bonuses WHERE guild_id=? AND user_id=? AND asset_id=?').get(g,u,assetId)?.buff_id;
    if(!buffId) {
      buffId=asset.buff||standardAssetBuffIds[Math.floor(Math.random()*standardAssetBuffIds.length)];
      db.prepare('INSERT INTO asset_bonuses(guild_id,user_id,asset_id,buff_id) VALUES(?,?,?,?)').run(g,u,assetId,buffId);
    }
    db.exec('COMMIT'); return {next,total,buffId};
  } catch(e) { db.exec('ROLLBACK'); throw e; }
}
function grantAssetPrize(g,u,assetId,quantity=1,reason='活動獎勵') {
  const asset=assetCatalog[assetId];
  if(!asset) throw new Error('獎勵資產不存在');
  ensureWallet(g,u);
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare('INSERT INTO player_assets(guild_id,user_id,asset_id,quantity) VALUES(?,?,?,?) ON CONFLICT(guild_id,user_id,asset_id) DO UPDATE SET quantity=quantity+excluded.quantity').run(g,u,assetId,quantity);
    const ids=Object.keys(assetBuffs),buffId=asset.buff||ids[Math.floor(Math.random()*ids.length)];
    db.prepare('INSERT OR IGNORE INTO asset_bonuses(guild_id,user_id,asset_id,buff_id) VALUES(?,?,?,?)').run(g,u,assetId,buffId);
    db.prepare('INSERT INTO ledger(guild_id,user_id,delta,balance_after,kind,actor_id,reason) VALUES(?,?,?,?,?,?,?)').run(g,u,0,balance(g,u),'asset_prize',u,`${reason}：${asset.name} x${quantity}`);
    db.exec('COMMIT');
    return {asset,buffId};
  } catch(e) { db.exec('ROLLBACK'); throw e; }
}
function adminAdjustAsset(g,targetId,assetId,quantity,action,actorId,reason) {
  const asset=assetCatalog[assetId];
  if(!asset) throw new Error('找不到指定的資產');
  ensureWallet(g,targetId);
  db.exec('BEGIN IMMEDIATE');
  try {
    const owned=db.prepare('SELECT quantity FROM player_assets WHERE guild_id=? AND user_id=? AND asset_id=?').get(g,targetId,assetId)?.quantity||0;
    let remaining,buffId=null;
    if(action==='grant') {
      remaining=owned+quantity;
      db.prepare('INSERT INTO player_assets(guild_id,user_id,asset_id,quantity) VALUES(?,?,?,?) ON CONFLICT(guild_id,user_id,asset_id) DO UPDATE SET quantity=quantity+excluded.quantity').run(g,targetId,assetId,quantity);
      buffId=db.prepare('SELECT buff_id FROM asset_bonuses WHERE guild_id=? AND user_id=? AND asset_id=?').get(g,targetId,assetId)?.buff_id;
      if(!buffId) {
        const ids=Object.keys(assetBuffs);
        buffId=asset.buff||ids[Math.floor(Math.random()*ids.length)];
        db.prepare('INSERT INTO asset_bonuses(guild_id,user_id,asset_id,buff_id) VALUES(?,?,?,?)').run(g,targetId,assetId,buffId);
      }
    } else {
      if(owned<quantity) throw new Error(`玩家持有數量不足，目前只有 ${owned}`);
      remaining=owned-quantity;
      if(remaining>0) db.prepare('UPDATE player_assets SET quantity=? WHERE guild_id=? AND user_id=? AND asset_id=?').run(remaining,g,targetId,assetId);
      else {
        db.prepare('DELETE FROM player_assets WHERE guild_id=? AND user_id=? AND asset_id=?').run(g,targetId,assetId);
        db.prepare('DELETE FROM asset_bonuses WHERE guild_id=? AND user_id=? AND asset_id=?').run(g,targetId,assetId);
      }
    }
    const current=db.prepare('SELECT balance FROM wallets WHERE guild_id=? AND user_id=?').get(g,targetId).balance;
    db.prepare('INSERT INTO ledger(guild_id,user_id,delta,balance_after,kind,actor_id,reason) VALUES(?,?,?,?,?,?,?)')
      .run(g,targetId,0,current,action==='grant'?'admin_asset_grant':'admin_asset_remove',actorId,`${reason}｜${asset.name} x${quantity}`);
    db.exec('COMMIT');
    return {asset,remaining,buffId};
  } catch(e) { db.exec('ROLLBACK'); throw e; }
}
function completeAssetTrade(g,sellerId,buyerId,assetId,quantity,price) {
  ensureWallet(g,sellerId); ensureWallet(g,buyerId);
  db.exec('BEGIN IMMEDIATE');
  try {
    const owned=db.prepare('SELECT quantity FROM player_assets WHERE guild_id=? AND user_id=? AND asset_id=?').get(g,sellerId,assetId)?.quantity||0;
    if(owned<quantity) throw new Error('賣方持有的資產數量不足，交易已取消');
    const buyerBalance=db.prepare('SELECT balance FROM wallets WHERE guild_id=? AND user_id=?').get(g,buyerId).balance;
    if(buyerBalance<price) throw new Error('買方金幣不足，交易無法完成');
    const sellerBalance=db.prepare('SELECT balance FROM wallets WHERE guild_id=? AND user_id=?').get(g,sellerId).balance;
    db.prepare('UPDATE wallets SET balance=balance-?,updated_at=CURRENT_TIMESTAMP WHERE guild_id=? AND user_id=?').run(price,g,buyerId);
    db.prepare('UPDATE wallets SET balance=balance+?,updated_at=CURRENT_TIMESTAMP WHERE guild_id=? AND user_id=?').run(price,g,sellerId);
    db.prepare('UPDATE player_assets SET quantity=quantity-? WHERE guild_id=? AND user_id=? AND asset_id=?').run(quantity,g,sellerId,assetId);
    db.prepare('INSERT INTO player_assets(guild_id,user_id,asset_id,quantity) VALUES(?,?,?,?) ON CONFLICT(guild_id,user_id,asset_id) DO UPDATE SET quantity=quantity+excluded.quantity').run(g,buyerId,assetId,quantity);
    db.prepare('INSERT INTO ledger(guild_id,user_id,delta,balance_after,kind,actor_id,reason) VALUES(?,?,?,?,?,?,?)').run(g,buyerId,-price,buyerBalance-price,'asset_trade',sellerId,`向玩家購買 ${assetCatalog[assetId].name} x${quantity}`);
    db.prepare('INSERT INTO ledger(guild_id,user_id,delta,balance_after,kind,actor_id,reason) VALUES(?,?,?,?,?,?,?)').run(g,sellerId,price,sellerBalance+price,'asset_trade',buyerId,`出售 ${assetCatalog[assetId].name} x${quantity}`);
    const sellerRemaining=owned-quantity;
    if(sellerRemaining<=0) db.prepare('DELETE FROM asset_bonuses WHERE guild_id=? AND user_id=? AND asset_id=?').run(g,sellerId,assetId);
    const buyerBuff=db.prepare('SELECT buff_id FROM asset_bonuses WHERE guild_id=? AND user_id=? AND asset_id=?').get(g,buyerId,assetId)?.buff_id;
    if(!buyerBuff) {
      const ids=Object.keys(assetBuffs),buffId=assetCatalog[assetId]?.buff||ids[Math.floor(Math.random()*ids.length)];
      db.prepare('INSERT INTO asset_bonuses(guild_id,user_id,asset_id,buff_id) VALUES(?,?,?,?)').run(g,buyerId,assetId,buffId);
    }
    db.exec('COMMIT');
  } catch(e) { db.exec('ROLLBACK'); throw e; }
}
function createMarketListing(g,sellerId,assetId,quantity,price) {
  const asset=assetCatalog[assetId];
  if(!asset) throw new Error('找不到這項資產');
  const buffId=ensureAssetBuff(g,sellerId,assetId);
  db.exec('BEGIN IMMEDIATE');
  try {
    const owned=db.prepare('SELECT quantity FROM player_assets WHERE guild_id=? AND user_id=? AND asset_id=?').get(g,sellerId,assetId)?.quantity||0;
    if(owned<quantity) throw new Error(`持有數量不足，目前只有 ${owned}`);
    const remaining=owned-quantity;
    db.prepare('UPDATE player_assets SET quantity=? WHERE guild_id=? AND user_id=? AND asset_id=?').run(remaining,g,sellerId,assetId);
    if(remaining<=0) db.prepare('DELETE FROM asset_bonuses WHERE guild_id=? AND user_id=? AND asset_id=?').run(g,sellerId,assetId);
    const result=db.prepare('INSERT INTO asset_market_listings(guild_id,seller_id,asset_id,quantity,price,buff_id) VALUES(?,?,?,?,?,?)').run(g,sellerId,assetId,quantity,price,buffId);
    db.exec('COMMIT');
    return Number(result.lastInsertRowid);
  } catch(e) { db.exec('ROLLBACK'); throw e; }
}
function cancelMarketListing(g,sellerId,listingId) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const listing=db.prepare("SELECT * FROM asset_market_listings WHERE id=? AND guild_id=? AND status='active'").get(listingId,g);
    if(!listing) throw new Error('這筆二手商品已下架或售出');
    if(listing.seller_id!==sellerId) throw new Error('只有賣家可以取消這筆商品');
    db.prepare("UPDATE asset_market_listings SET status='cancelled',completed_at=CURRENT_TIMESTAMP WHERE id=?").run(listingId);
    db.prepare('INSERT INTO player_assets(guild_id,user_id,asset_id,quantity) VALUES(?,?,?,?) ON CONFLICT(guild_id,user_id,asset_id) DO UPDATE SET quantity=quantity+excluded.quantity').run(g,sellerId,listing.asset_id,listing.quantity);
    db.prepare('INSERT OR IGNORE INTO asset_bonuses(guild_id,user_id,asset_id,buff_id) VALUES(?,?,?,?)').run(g,sellerId,listing.asset_id,listing.buff_id||assetCatalog[listing.asset_id]?.buff||'getaway');
    db.exec('COMMIT');
    return listing;
  } catch(e) { db.exec('ROLLBACK'); throw e; }
}
function buyMarketListing(g,buyerId,listingId) {
  ensureWallet(g,buyerId);
  db.exec('BEGIN IMMEDIATE');
  try {
    const listing=db.prepare("SELECT * FROM asset_market_listings WHERE id=? AND guild_id=? AND status='active'").get(listingId,g);
    if(!listing) throw new Error('這筆二手商品已下架或售出');
    if(listing.seller_id===buyerId) throw new Error('不能購買自己刊登的商品');
    ensureWallet(g,listing.seller_id);
    const buyerBalance=db.prepare('SELECT balance FROM wallets WHERE guild_id=? AND user_id=?').get(g,buyerId).balance;
    const sellerBalance=db.prepare('SELECT balance FROM wallets WHERE guild_id=? AND user_id=?').get(g,listing.seller_id).balance;
    if(buyerBalance<listing.price) throw new Error(`金幣不足，需要 ${fmt(listing.price)}`);
    db.prepare('UPDATE wallets SET balance=balance-?,updated_at=CURRENT_TIMESTAMP WHERE guild_id=? AND user_id=?').run(listing.price,g,buyerId);
    db.prepare('UPDATE wallets SET balance=balance+?,updated_at=CURRENT_TIMESTAMP WHERE guild_id=? AND user_id=?').run(listing.price,g,listing.seller_id);
    db.prepare('INSERT INTO player_assets(guild_id,user_id,asset_id,quantity) VALUES(?,?,?,?) ON CONFLICT(guild_id,user_id,asset_id) DO UPDATE SET quantity=quantity+excluded.quantity').run(g,buyerId,listing.asset_id,listing.quantity);
    db.prepare('INSERT OR IGNORE INTO asset_bonuses(guild_id,user_id,asset_id,buff_id) VALUES(?,?,?,?)').run(g,buyerId,listing.asset_id,listing.buff_id||assetCatalog[listing.asset_id]?.buff||'getaway');
    db.prepare("UPDATE asset_market_listings SET status='sold',buyer_id=?,completed_at=CURRENT_TIMESTAMP WHERE id=?").run(buyerId,listingId);
    db.prepare('INSERT INTO ledger(guild_id,user_id,delta,balance_after,kind,actor_id,reason) VALUES(?,?,?,?,?,?,?)').run(g,buyerId,-listing.price,buyerBalance-listing.price,'market_purchase',listing.seller_id,`二手市場購買 ${assetCatalog[listing.asset_id].name} x${listing.quantity}`);
    db.prepare('INSERT INTO ledger(guild_id,user_id,delta,balance_after,kind,actor_id,reason) VALUES(?,?,?,?,?,?,?)').run(g,listing.seller_id,listing.price,sellerBalance+listing.price,'market_sale',buyerId,`二手市場售出 ${assetCatalog[listing.asset_id].name} x${listing.quantity}`);
    db.exec('COMMIT');
    return {...listing,buyerBalanceAfter:buyerBalance-listing.price};
  } catch(e) { db.exec('ROLLBACK'); throw e; }
}
const taipeiDay=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const calendarDayDiff=(from,to)=>Math.max(0,Math.floor((Date.parse(`${to}T00:00:00Z`)-Date.parse(`${from}T00:00:00Z`))/86400000));
function refreshPetMood(g,u,petId) {
  const row=db.prepare('SELECT happiness,mood_day FROM player_pets WHERE guild_id=? AND user_id=? AND pet_id=?').get(g,u,petId);
  if(!row) return null;
  const today=taipeiDay(),days=calendarDayDiff(row.mood_day,today);
  if(!days) return row;
  const happiness=Math.max(0,row.happiness-days*10);
  db.prepare('UPDATE player_pets SET happiness=?,mood_day=? WHERE guild_id=? AND user_id=? AND pet_id=?').run(happiness,today,g,u,petId);
  return {happiness,mood_day:today};
}
function ownedPets(g,u) {
  return db.prepare('SELECT pet_id,nickname,happiness,mood_day,acquired_at FROM player_pets WHERE guild_id=? AND user_id=? ORDER BY acquired_at').all(g,u)
    .map(row=>({petId:row.pet_id,nickname:row.nickname,acquiredAt:row.acquired_at,...refreshPetMood(g,u,row.pet_id)}));
}
function activePet(g,u) {
  const activeId=db.prepare('SELECT active_pet_id FROM pet_profiles WHERE guild_id=? AND user_id=?').get(g,u)?.active_pet_id;
  if(!activeId||!petCatalog[activeId]) return null;
  const mood=refreshPetMood(g,u,activeId);
  const nickname=db.prepare('SELECT nickname FROM player_pets WHERE guild_id=? AND user_id=? AND pet_id=?').get(g,u,activeId)?.nickname||null;
  return mood?{petId:activeId,pet:petCatalog[activeId],nickname,happiness:mood.happiness}:null;
}
const petDisplayName=(petId,nickname=null)=>{
  const breed=petCatalog[petId].name.split('｜')[0];
  return nickname?`${breed}｜${nickname}`:petCatalog[petId].name;
};
function petBonus(g,u,type) {
  const active=activePet(g,u);
  if(!active||active.pet.bonusType!==type||active.happiness<20) return 0;
  return active.pet.bonusValue*(active.happiness/100);
}
function petMoodBar(value) {
  const bars=Math.max(0,Math.min(10,Math.round(value/10)));
  return `${'🟩'.repeat(bars)}${'⬛'.repeat(10-bars)} **${value}/100**`;
}
function petMediaPayload(embed,petId) {
  const pet=petCatalog[petId],path=assetPath(pet.image),name=`pet_${petId}${extname(path)}`;
  embed.setImage(`attachment://${name}`);
  return {embeds:[embed],files:[new AttachmentBuilder(path,{name})]};
}
function buyPetShopProduct(g,u,kind,id,quantity=1) {
  const product=kind==='pet'?petCatalog[id]:petItemCatalog[id];
  if(!product) throw new Error('找不到這項寵物店商品');
  quantity=kind==='pet'?1:Number(quantity);
  if(!Number.isInteger(quantity)||quantity<1||quantity>99) throw new Error('購買數量必須是 1～99 的整數');
  const total=product.price*quantity;
  db.exec('BEGIN IMMEDIATE');
  try {
    const current=ensureWallet(g,u);
    if(kind==='pet'&&db.prepare('SELECT 1 FROM player_pets WHERE guild_id=? AND user_id=? AND pet_id=?').get(g,u,id)) throw new Error('你已經擁有這隻寵物');
    if(current<total) throw new Error(`金幣不足，需要 ${fmt(total)}`);
    const next=current-total;
    db.prepare('UPDATE wallets SET balance=?,updated_at=CURRENT_TIMESTAMP WHERE guild_id=? AND user_id=?').run(next,g,u);
    if(kind==='pet') {
      db.prepare('INSERT INTO player_pets(guild_id,user_id,pet_id,happiness,mood_day) VALUES(?,?,?,?,?)').run(g,u,id,70,taipeiDay());
      db.prepare('INSERT INTO pet_profiles(guild_id,user_id,active_pet_id) VALUES(?,?,?) ON CONFLICT(guild_id,user_id) DO UPDATE SET active_pet_id=COALESCE(pet_profiles.active_pet_id,excluded.active_pet_id),updated_at=CURRENT_TIMESTAMP').run(g,u,id);
    } else {
      db.prepare('INSERT INTO pet_inventory(guild_id,user_id,item_id,quantity) VALUES(?,?,?,?) ON CONFLICT(guild_id,user_id,item_id) DO UPDATE SET quantity=quantity+excluded.quantity').run(g,u,id,quantity);
    }
    db.prepare('INSERT INTO ledger(guild_id,user_id,delta,balance_after,kind,actor_id,reason) VALUES(?,?,?,?,?,?,?)').run(g,u,-total,next,'pet_shop',u,`購買 ${product.name} ×${quantity}｜金幣直接銷毀`);
    db.exec('COMMIT');
    return {balance:next,product,quantity,total};
  } catch(e) { db.exec('ROLLBACK'); throw e; }
}
function usePetItem(g,u,itemId) {
  const item=petItemCatalog[itemId],active=activePet(g,u);
  if(!item) throw new Error('找不到這項寵物用品');
  if(!active) throw new Error('請先購買寵物並設定陪伴夥伴');
  const quantity=db.prepare('SELECT quantity FROM pet_inventory WHERE guild_id=? AND user_id=? AND item_id=?').get(g,u,itemId)?.quantity||0;
  if(quantity<1) throw new Error(`你沒有 ${item.name}，請先到寵物店購買`);
  const happiness=Math.min(100,active.happiness+item.mood);
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare('UPDATE pet_inventory SET quantity=quantity-1 WHERE guild_id=? AND user_id=? AND item_id=?').run(g,u,itemId);
    db.prepare('UPDATE player_pets SET happiness=?,mood_day=? WHERE guild_id=? AND user_id=? AND pet_id=?').run(happiness,taipeiDay(),g,u,active.petId);
    db.exec('COMMIT');
  } catch(e) { db.exec('ROLLBACK'); throw e; }
  return {...active,happiness,item};
}
function claimFreeWheelSpin(g,u) {
  const today=taipeiDay();
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare('INSERT OR IGNORE INTO lucky_wheel_daily(guild_id,user_id,spin_day,spins) VALUES(?,?,?,0)').run(g,u,today);
    let row=db.prepare('SELECT spin_day,spins FROM lucky_wheel_daily WHERE guild_id=? AND user_id=?').get(g,u);
    if(row.spin_day!==today) {
      db.prepare('UPDATE lucky_wheel_daily SET spin_day=?,spins=0 WHERE guild_id=? AND user_id=?').run(today,g,u);
      row={spin_day:today,spins:0};
    }
    if(row.spins>=3) throw new Error('今日 3 次免費幸運輪盤已用完，請於明日 00:00 後再來');
    const used=row.spins+1;
    db.prepare('UPDATE lucky_wheel_daily SET spins=? WHERE guild_id=? AND user_id=?').run(used,g,u);
    db.exec('COMMIT');
    return {used,remaining:3-used};
  } catch(e) { db.exec('ROLLBACK'); throw e; }
}
function weeklyMysteryInfo() {
  const localDate=new Date(`${taipeiDay()}T00:00:00Z`);
  localDate.setUTCDate(localDate.getUTCDate()-localDate.getUTCDay());
  const sunday=localDate.toISOString().slice(0,10);
  const epoch=new Date('2026-01-04T00:00:00Z');
  const week=Math.floor((localDate-epoch)/(7*24*60*60*1000));
  const index=((week%weeklyMysteryIds.length)+weeklyMysteryIds.length)%weeklyMysteryIds.length;
  const assetId=weeklyMysteryIds[index];
  return {sunday,index,assetId,asset:assetCatalog[assetId]};
}
const dailyBuffs=[
  {day:'週日',icon:'🎁',name:'雙倍每日獎勵',text:'每日獎勵增加為 1,000 金幣'},
  {day:'週一',icon:'🏦',name:'搶劫專家',text:'所有搶銀行成功率 +10%'},
  {day:'週二',icon:'💼',name:'工作狂熱',text:'合法工作收入 ×2'},
  {day:'週三',icon:'⚡',name:'精力充沛',text:'所有體力消耗減半'},
  {day:'週四',icon:'🎰',name:'幸運賭客',text:'賭場獲勝派彩 +20%'},
  {day:'週五',icon:'🛒',name:'商城日',text:'商城商品全面八折'},
  {day:'週六',icon:'🀄',name:'麻將之神',text:'麻將獲勝獎金 +50%'}
];
const profileTitles={
  legendary_prisoner:'🔒 傳奇囚犯',
  police:'👮 警察',
  elite_police:'🛡️ 菁英警察',
  riot_captain:'🚨 鎮暴隊長',
  canine_night:'🐕 犬類(可夜)',
  big_gg:'🍆 大GG',
  cute_bird:'🐣 萌禽',
  cute_dog:'🐶 萌犬',
  fierce_dog:'🐕 猛犬',
  fierce_bird:'🦅 猛禽',
  cat_returns:'🐈 貓的報恩',
  dog_returns:'🐕 犬的報恩'
};
const returnTitleSkillNames={cat_returns:'借看一下',dog_returns:'再聞一下'};
function equippedTitleId(g,u) {
  return db.prepare('SELECT title FROM player_profiles WHERE guild_id=? AND user_id=?').get(g,u)?.title||'';
}
function luckyReturnsTitleId(g,u) {
  const id=equippedTitleId(g,u);
  return id==='cat_returns'||id==='dog_returns'?id:'';
}
function returnsCasinoMultiplier(g,u) {
  if(!luckyReturnsTitleId(g,u)) return 1;
  const roll=Math.random();
  if(roll<0.20) return 0.1;
  if(roll<0.45) return 0.5;
  if(roll<0.75) return 1;
  if(roll<0.95) return 2;
  return 10;
}
function titleLuckNotice(settlement) {
  if(!settlement.titleActive) return '';
  const title=profileTitles[settlement.titleId],skill=returnTitleSkillNames[settlement.titleId];
  if(settlement.titleSkillTriggered) return `\n\n${title.split(' ')[0]} **特殊技能「${skill}」發動！**\n第一次抽到 ×${settlement.titleInitialMultiplier}，重抽後本局派彩 **×${settlement.titleMultiplier}**`;
  return `\n\n**${title}：本局派彩 ×${settlement.titleMultiplier}**`;
}
function playerTitle(g,u) {
  const id=equippedTitleId(g,u),name=profileTitles[id]||'尚未設定特殊稱號';
  return returnTitleSkillNames[id]?`${name}\n每次賭場獲勝隨機獲得 ×0.1～×10 派彩；3% 發動「${returnTitleSkillNames[id]}」重抽一次`:name;
}
const achievementDefinitions=[
  {id:'first_bet',name:'🐣 初試啼聲',description:'完成第 1 次下注',metric:'bets',target:1,titleReward:'cute_bird'},
  {id:'busy_pup',name:'🐶 勤勞萌犬',description:'完成 5 次有收入的工作',metric:'jobs',target:5,titleReward:'cute_dog'},
  {id:'winning_hound',name:'🐕 勝負獵犬',description:'累積 20 次獲勝紀錄',metric:'wins',target:20,titleReward:'fierce_dog'},
  {id:'asset_raptor',name:'🦅 資產猛禽',description:'持有資產原價總值達 500,000',metric:'assetValue',target:500000,titleReward:'fierce_bird'},
  {id:'veteran_gambler',name:'🎲 久經賭場',description:'累積完成 50 次下注',metric:'bets',target:50},
  {id:'vault_master',name:'💰 金庫達人',description:'金庫餘額達到 100,000',metric:'coins',target:100000},
  {id:'collector',name:'🏎️ 收藏家',description:'持有 10 件資產',metric:'assetCount',target:10},
  {id:'casino_legend',name:'👑 百勝傳奇',description:'累積 100 次獲勝紀錄',metric:'wins',target:100}
];
function achievementStats(g,u) {
  const ledger=db.prepare("SELECT COUNT(*) actions, SUM(CASE WHEN kind IN ('bet','duel_bet') THEN 1 ELSE 0 END) bets, SUM(CASE WHEN kind='payout' AND delta>0 THEN 1 ELSE 0 END) wins, SUM(CASE WHEN kind='job' AND delta>0 THEN 1 ELSE 0 END) jobs FROM ledger WHERE guild_id=? AND user_id=?").get(g,u);
  const owned=assetsOf(g,u);
  return {
    actions:ledger.actions||0,bets:ledger.bets||0,wins:ledger.wins||0,jobs:ledger.jobs||0,
    coins:balance(g,u),assetCount:owned.reduce((sum,row)=>sum+row.quantity,0),
    assetValue:owned.reduce((sum,row)=>sum+(assetCatalog[row.asset_id]?.price||0)*row.quantity,0)
  };
}
function syncAchievements(g,u) {
  const stats=achievementStats(g,u),newlyUnlocked=[];
  const existing=new Set(db.prepare('SELECT achievement_id FROM player_achievements WHERE guild_id=? AND user_id=?').all(g,u).map(row=>row.achievement_id));
  for(const achievement of achievementDefinitions) {
    if(existing.has(achievement.id)||(stats[achievement.metric]||0)<achievement.target) continue;
    db.prepare('INSERT OR IGNORE INTO player_achievements(guild_id,user_id,achievement_id) VALUES(?,?,?)').run(g,u,achievement.id);
    existing.add(achievement.id); newlyUnlocked.push(achievement);
  }
  return {stats,unlocked:existing,newlyUnlocked};
}
function achievementTitleUnlocked(g,u,titleId) {
  if(titleId==='cat_returns'||titleId==='dog_returns') return true;
  const achievement=achievementDefinitions.find(item=>item.titleReward===titleId);
  if(!achievement) return false;
  syncAchievements(g,u);
  return !!db.prepare('SELECT 1 ok FROM player_achievements WHERE guild_id=? AND user_id=? AND achievement_id=?').get(g,u,achievement.id);
}
function achievementLines(g,u) {
  const {stats,unlocked}=syncAchievements(g,u);
  return achievementDefinitions.map(item=>{
    const current=Math.min(stats[item.metric]||0,item.target),done=unlocked.has(item.id);
    const reward=item.titleReward?`｜稱號：${profileTitles[item.titleReward]}`:'';
    return `${done?'✅':'🔒'} **${item.name}**${reward}\n${item.description}（${fmt(current)}/${fmt(item.target)}）`;
  });
}
function taipeiWeekday() {
  const label=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Taipei',weekday:'short'}).format(new Date());
  return {Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6}[label];
}
function todayBuff() { return dailyBuffs[taipeiWeekday()]; }
const weeklyHeistBonus=()=>taipeiWeekday()===1?10:0;
function soloHeistBaseChance(guildId) {
  return db.prepare('SELECT base_chance FROM solo_heist_settings WHERE guild_id=?').get(guildId)?.base_chance??20;
}
const weeklyWorkMultiplier=()=>taipeiWeekday()===2?2:1;
const weeklyCasinoMultiplier=()=>taipeiWeekday()===4?1.2:1;
const weeklyMahjongMultiplier=()=>taipeiWeekday()===6?1.5:1;
const heistBanks={
  mizi:{name:'🏦 迷子信用合作社',baseChance:10,reward:20000},
  hao:{name:'🏛️ Hao 商業銀行',baseChance:8,reward:35000},
  royal:{name:'👑 澳門皇家銀行',baseChance:7,reward:50000},
  spade:{name:'♠️ 黑桃中央銀行',baseChance:6,reward:80000},
  gold:{name:'🪙 黃金國際銀行',baseChance:5,reward:120000},
  harbor_union:{name:'⚓ 港灣聯合銀行',baseChance:9,reward:30000},
  metro:{name:'🏙️ 都會中央銀行',baseChance:7,reward:65000},
  crown:{name:'💠 皇冠國際銀行',baseChance:4,reward:150000},
  casino_vault:{name:'🎰 賭場中央寶庫（週日限定）',baseChance:4,reward:0,sundayOnly:true}
};
function heistBasePool(g,bankId) {
  const bank=heistBanks[bankId];
  return bank?.sundayOnly?Math.floor(casinoVaultBalance(g)*0.8):(bank?.reward||0);
}
function teamHeistRewardPerMember(memberCount) {
  return TEAM_HEIST_MEMBER_REWARD+Math.max(0,memberCount-1)*TEAM_HEIST_TEAMMATE_BONUS;
}
function teamHeistTotalPayout(lootPool,memberCount) {
  return Math.max(0,Math.floor(lootPool))+teamHeistRewardPerMember(memberCount)*memberCount;
}
const heistMaps={
  downtown:{name:'🌆 市中心金融區',chance:-2,rewardMultiplier:1.15,scene:'高樓與封鎖道路密集，警車能迅速抵達，但金庫現金更加充足。'},
  harbor:{name:'⚓ 港口貨運區',chance:4,rewardMultiplier:0.90,scene:'貨櫃與倉庫形成天然掩護，撤離容易，但可搬走的金幣較少。'},
  mountain:{name:'🏔️ 山區地下金庫',chance:-4,rewardMultiplier:1.30,scene:'偏遠山路拖慢警方增援，同時也讓劫匪撤離路線更加危險。'},
  suburb:{name:'🏘️ 郊區小鎮分行',chance:7,rewardMultiplier:0.80,scene:'警力薄弱、巷道單純，幾乎沒有重型封鎖；但小型分行能搬走的戰利品有限。'},
  metro_vault:{name:'🚇 地下捷運金庫',chance:1,rewardMultiplier:1.10,scene:'隊伍可沿維修隧道滲透並混入末班列車撤離，路線穩定但地下監控密集。'},
  offshore_island:{name:'🌉 離岸金融島',chance:-7,rewardMultiplier:1.50,scene:'跨海大橋是唯一陸路出口，警方極易封鎖退路；島上國際金庫則存放著驚人的財富。'}
};
const heistVaultContents={
  diamonds:{name:'💎 鑽石金庫',description:'金庫內堆滿高價鑽石與珠寶箱，搬運困難但黑市價值極高。',rewardMultiplier:1.35,scene:'vault_diamonds'},
  cash:{name:'💵 現鈔金庫',description:'大量現鈔已完成打包，撤離速度最快，收益也最穩定。',rewardMultiplier:1.00,scene:'vault_cash'},
  gold:{name:'🪙 黃金金庫',description:'保險櫃內存放大量金條，重量會拖慢撤離，但總價值可觀。',rewardMultiplier:1.20,scene:'vault_gold'},
  hao_xinyi_deed:{name:'📜 HAO 信義區地契',description:'情報人員在賭場中央寶庫深處發現 HAO 位於信義區的稀有地契。只有成功撤離並完成結算，才能將地契變現為 8,888,888 金幣，由本次搶匪均分。',rewardMultiplier:1.00,fixedReward:8888888,casinoVaultOnly:true,scene:'vault_hao_xinyi_deed'}
};
const HAO_XINYI_DEED_CHANCE=0.02;
const randomHeistVaultId=bankId=>{
  if(bankId==='casino_vault'&&Math.random()<HAO_XINYI_DEED_CHANCE) return 'hao_xinyi_deed';
  const ids=Object.keys(heistVaultContents).filter(id=>!heistVaultContents[id].casinoVaultOnly);
  return ids[Math.floor(Math.random()*ids.length)];
};
const heistVaultRewardLabel=vault=>vault.fixedReward?`固定結算 ${vault.fixedReward.toLocaleString()} 金幣`:`收益 ×${vault.rewardMultiplier}`;
const heistWeapons={
  pistol:{name:'🔫 制式手槍',robber:1,police:1,price:500,description:'火力 +1｜行動費 500'},
  smg:{name:'⚡ 衝鋒槍',robber:3,police:2,price:1500,description:'劫匪 +3／警方 +2｜1,500'},
  shotgun:{name:'💥 霰彈槍',robber:2,police:3,price:1800,description:'劫匪 +2／警方 +3｜1,800'},
  rifle:{name:'🎯 突擊步槍',robber:4,police:4,price:3000,description:'雙方火力 +4｜3,000'},
  sniper:{name:'🔭 狙擊步槍',robber:2,police:5,price:3500,description:'劫匪 +2／警方 +5｜3,500'}
};
function chargeTeamHeistPreparation(g,members) {
  members.forEach(memberId=>ensureWallet(g,memberId));
  db.exec('BEGIN IMMEDIATE');
  try {
    for(const memberId of members) {
      const current=db.prepare('SELECT balance FROM wallets WHERE guild_id=? AND user_id=?').get(g,memberId).balance;
      if(current<TEAM_HEIST_PREP_FEE) throw new Error(`<@${memberId}> 金幣不足，團隊搶劫入場準備費每人需要 ${fmt(TEAM_HEIST_PREP_FEE)}`);
    }
    for(const memberId of members) {
      const current=db.prepare('SELECT balance FROM wallets WHERE guild_id=? AND user_id=?').get(g,memberId).balance,next=current-TEAM_HEIST_PREP_FEE;
      db.prepare('UPDATE wallets SET balance=?,updated_at=CURRENT_TIMESTAMP WHERE guild_id=? AND user_id=?').run(next,g,memberId);
      db.prepare('INSERT INTO ledger(guild_id,user_id,delta,balance_after,kind,actor_id,reason) VALUES(?,?,?,?,?,?,?)').run(g,memberId,-TEAM_HEIST_PREP_FEE,next,'heist_prep',memberId,'團隊搶劫入場準備費｜金幣直接銷毀且不退還');
    }
    db.exec('COMMIT');
    return TEAM_HEIST_PREP_FEE*members.length;
  } catch(error) { db.exec('ROLLBACK'); throw error; }
}
function chargeHeistWeapons(g,heist) {
  const charges=[];
  for(const memberId of heist.members) {
    const weaponId=heist.weapons.get(memberId),weapon=heistWeapons[weaponId];
    if(weapon) charges.push({userId:memberId,weaponId,weapon});
  }
  for(const policeId of heist.police) {
    const weaponId=heist.policeWeapons.get(policeId),weapon=heistWeapons[weaponId];
    if(weapon) charges.push({userId:policeId,weaponId,weapon});
  }
  charges.forEach(charge=>ensureWallet(g,charge.userId));
  db.exec('BEGIN IMMEDIATE');
  try {
    const totals=new Map();
    for(const charge of charges) totals.set(charge.userId,(totals.get(charge.userId)||0)+charge.weapon.price);
    for(const [userId,total] of totals) {
      const current=db.prepare('SELECT balance FROM wallets WHERE guild_id=? AND user_id=?').get(g,userId).balance;
      if(current<total) throw new Error(`<@${userId}> 金幣不足，槍枝行動費需要 ${fmt(total)}`);
    }
    for(const charge of charges) {
      const current=db.prepare('SELECT balance FROM wallets WHERE guild_id=? AND user_id=?').get(g,charge.userId).balance,next=current-charge.weapon.price;
      db.prepare('UPDATE wallets SET balance=?,updated_at=CURRENT_TIMESTAMP WHERE guild_id=? AND user_id=?').run(next,g,charge.userId);
      db.prepare('INSERT INTO ledger(guild_id,user_id,delta,balance_after,kind,actor_id,reason) VALUES(?,?,?,?,?,?,?)').run(g,charge.userId,-charge.weapon.price,next,'heist_weapon',charge.userId,`${charge.weapon.name} 行動費｜金幣直接銷毀且不退還`);
    }
    db.exec('COMMIT');
    return charges.reduce((sum,charge)=>sum+charge.weapon.price,0);
  } catch(error) { db.exec('ROLLBACK'); throw error; }
}
function heistVehicleRow(token,heist) {
  const vehicles=ownedHeistVehicles(heist.guildId,heist.leaderId).slice(0,24);
  const options=[{
    label:'預設接應車',description:'不使用私人載具，沒有額外載具加成',value:'default',default:!heist.vehicleId
  },...vehicles.map(row=>{
    const asset=assetCatalog[row.asset_id],buffId=ensureAssetBuff(heist.guildId,heist.leaderId,row.asset_id);
    const bonus=Math.max(0,(assetBuffs[buffId]?.heist||0)*assetBuffPower(row.asset_id));
    return {
      label:asset.name.slice(0,100),
      description:`${asset.category}｜${assetBuffs[buffId]?.name||'無登記增益'}｜搶劫 +${bonus}%`.slice(0,100),
      value:row.asset_id,
      default:heist.vehicleId===row.asset_id
    };
  })];
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder().setCustomId(`heist_vehicle:${token}`).setPlaceholder('隊長可選擇自己的逃跑載具').addOptions(...options)
  );
}
function heistLobbyRows(token,heist) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`heist_informant:${token}:no`).setLabel('拒絕成為線人').setEmoji('🤐').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`heist_informant:${token}:yes`).setLabel('秘密協助警方').setEmoji('🕵️').setStyle(ButtonStyle.Danger)
    ),
    new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(`heist_weapon:${token}`).setPlaceholder('選擇本次攜帶槍枝').addOptions(
      ...Object.entries(heistWeapons).map(([value,weapon])=>({label:weapon.name,description:weapon.description,value}))
    )),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`heist_police_join:${token}`).setLabel('加入警方阻止搶劫').setEmoji('🚓').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`heist_police_action:${token}:confront`).setLabel('正面對抗劫匪').setEmoji('🛡️').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`heist_police_action:${token}:reinforce`).setLabel('呼叫增援').setEmoji('📢').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`heist_scout:${token}`).setLabel('偵查金庫內容').setEmoji('🔎').setStyle(ButtonStyle.Secondary)
    ),
    heistVehicleRow(token,heist),
    heistPrepRow(token)
  ];
}
function heistReadiness(heist) {
  return {
    missingFaction:heist.members.filter(id=>!heist.informantChoices.has(id)),
    missingReady:heist.members.filter(id=>!heist.ready.has(id)),
    missingWeapons:heist.members.filter(id=>!heist.weapons.has(id)),
    missingPoliceWeapons:[...heist.police].filter(id=>!heist.policeWeapons.has(id)),
    missingPoliceActions:[...heist.police].filter(id=>!heist.policeActions.has(id))
  };
}
function heistMentionList(ids) {
  return ids.length?ids.map(id=>`<@${id}>`).join('、'):'無';
}
function heistCaptainStatus(heist) {
  const status=heistReadiness(heist);
  const remaining=Math.max(0,Math.ceil((heist.factionDeadline-Date.now())/1000));
  return `📋 **搶劫隊伍準備狀態**\n`+
    `• 逃跑載具：${selectedHeistVehicleName(heist)}（成功率 +${selectedHeistVehicleBonus(heist)}%）\n`+
    `• 尚未選擇陣營：${heistMentionList(status.missingFaction)}\n`+
    `• 尚未完成準備：${heistMentionList(status.missingReady)}\n`+
    `• 劫匪尚未選槍：${heistMentionList(status.missingWeapons)}\n`+
    `• 警方尚未選槍：${heistMentionList(status.missingPoliceWeapons)}\n`+
    `• 警方尚未選擇行動：${heistMentionList(status.missingPoliceActions)}\n\n`+
    `${heist.factionLocked?'🔒 陣營選擇已截止；逾時未選者已自動成為搶匪。':`⏳ 陣營選擇剩餘約 ${remaining} 秒。`}\n`+
    `線人身分仍會保密，隊長只能看到誰尚未完成選擇。`;
}
function burglaryLobbyRow(token,disabled=false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`burglary_join:${token}`).setLabel('加入闖空門').setEmoji('🥷').setStyle(ButtonStyle.Primary).setDisabled(disabled),
    new ButtonBuilder().setCustomId(`burglary_start:${token}`).setLabel('開始行動').setEmoji('🏚️').setStyle(ButtonStyle.Success).setDisabled(disabled),
    new ButtonBuilder().setCustomId(`burglary_cancel:${token}`).setLabel('取消行動').setEmoji('✖️').setStyle(ButtonStyle.Secondary).setDisabled(disabled)
  );
}
function burglaryLobbyEmbed(lobby) {
  const chance=Math.min(75,45+(lobby.members.size-1)*10);
  const target=lobby.targetId?`<@${lobby.targetId}> 的住處`:'隨機無人住宅';
  return new EmbedBuilder().setColor(0x455A64).setTitle('🏚️ 多人闖空門｜集合中').setDescription(
    `隊長：<@${lobby.leaderId}>\n目標：**${target}**\n成員：${[...lobby.members].map(id=>`<@${id}>`).join('、')}\n人數：**${lobby.members.size}/4**\n目前成功率：**${chance}%**\n\n每名成員開始時消耗 **10 體力**；成功後平均分贓，失敗則全員關進迷子的小黑屋 2 分鐘。`
  );
}
function heistCombatModifiers(heist) {
  const robberValues=[...heist.weapons.values()].map(id=>heistWeapons[id]?.robber||0);
  const policeValues=[...heist.policeWeapons.values()].map(id=>heistWeapons[id]?.police||0);
  const robberFirepower=robberValues.length?Math.round(robberValues.reduce((a,b)=>a+b,0)/robberValues.length):0;
  const confrontingPolice=[...heist.policeActions.values()].filter(action=>action==='confront').length;
  const reinforcingPolice=[...heist.policeActions.values()].filter(action=>action==='reinforce').length;
  const confrontationPressure=confrontingPolice*2;
  const reinforcementPressure=reinforcingPolice*3;
  const policePressure=heist.police.size*2+(policeValues.length?Math.round(policeValues.reduce((a,b)=>a+b,0)/policeValues.length):0)+heist.informants.size*4+confrontationPressure+reinforcementPressure;
  return {robberFirepower,policePressure,confrontingPolice,reinforcingPolice,confrontationPressure,reinforcementPressure};
}
function hotBankFor(daysFromToday=0) {
  const date=new Date(Date.now()+daysFromToday*86400000);
  const key=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
  const ids=Object.entries(heistBanks).filter(([,bank])=>!bank.sundayOnly).map(([id])=>id), hash=[...key].reduce((sum,ch)=>sum+ch.charCodeAt(0),0);
  return {id:ids[hash%ids.length],date:key};
}
function getTeam(g,u) {
  const member=db.prepare('SELECT team_id FROM team_members WHERE guild_id=? AND user_id=?').get(g,u);
  if(!member) return null;
  const team=db.prepare('SELECT * FROM teams WHERE id=? AND guild_id=?').get(member.team_id,g);
  if(!team) return null;
  return {...team,members:db.prepare('SELECT user_id FROM team_members WHERE guild_id=? AND team_id=?').all(g,team.id).map(row=>row.user_id)};
}
function normalizeTeamName(value) {
  const name=value?.trim().replace(/\s+/g,' ').replace(/@/g,'＠');
  return name||null;
}
function teamDisplayName(team) { return team.name||`未命名隊伍 #${team.id}`; }
function staminaMax(g,u) {
  const row=db.prepare('SELECT bonus_day,bonus FROM stamina_bonus WHERE guild_id=? AND user_id=?').get(g,u);
  return Math.max(20,BASE_STAMINA+(row?.bonus_day===taipeiDay()?row.bonus:0)+assetStaminaBonus(g,u)+Math.round(petBonus(g,u,'stamina')));
}
function effects(g,u) {
  db.prepare('INSERT OR IGNORE INTO event_effects(guild_id,user_id) VALUES(?,?)').run(g,u);
  return db.prepare('SELECT * FROM event_effects WHERE guild_id=? AND user_id=?').get(g,u);
}
const effectActive=(g,u,key)=>effects(g,u)[key]>Date.now();
const workMultiplier=(g,u)=>(effectActive(g,u,'double_work_until')?2:1)*weeklyWorkMultiplier()*assetWorkBonus(g,u)*(1+petBonus(g,u,'work'));
function stamina(g,u) {
  const today=taipeiDay();
  db.prepare('INSERT OR IGNORE INTO player_stats(guild_id,user_id,stamina,stamina_day) VALUES(?,?,?,?)').run(g,u,BASE_STAMINA,today);
  const row=db.prepare('SELECT stamina,stamina_day FROM player_stats WHERE guild_id=? AND user_id=?').get(g,u);
  if(row.stamina_day!==today) {
    const max=staminaMax(g,u);
    db.prepare('UPDATE player_stats SET stamina=?,stamina_day=? WHERE guild_id=? AND user_id=?').run(max,today,g,u);
    return max;
  }
  return row.stamina;
}
function staminaCost(g,u,cost) {
  return (effectActive(g,u,'half_stamina_until')||taipeiWeekday()===3)?Math.ceil(cost/2):cost;
}
function consumeStamina(g,u,cost) {
  cost=staminaCost(g,u,cost);
  const current=stamina(g,u);
  if(current<cost) throw new Error(`體力不足，需要 ${cost} 點；目前 ${current}/${staminaMax(g,u)}。請到商城購買食物或飲料恢復`);
  db.prepare('UPDATE player_stats SET stamina=stamina-? WHERE guild_id=? AND user_id=?').run(cost,g,u);
  return current-cost;
}
function buyItem(g,u,itemId,quantity) {
  const item=shopItems[itemId], eventDiscount=(effectActive(g,u,'shop_sale_until')||taipeiWeekday()===5)?0.8:1, discount=Math.max(0.5,eventDiscount-assetShopDiscount(g,u)-petBonus(g,u,'discount')), total=Math.ceil(item.price*quantity*discount);
  db.exec('BEGIN IMMEDIATE');
  try {
    const current=ensureWallet(g,u);
    if(current<total) throw new Error('金幣不足');
    const next=current-total;
    db.prepare('UPDATE wallets SET balance=?,updated_at=CURRENT_TIMESTAMP WHERE guild_id=? AND user_id=?').run(next,g,u);
    db.prepare('INSERT INTO inventory(guild_id,user_id,item_id,quantity) VALUES(?,?,?,?) ON CONFLICT(guild_id,user_id,item_id) DO UPDATE SET quantity=quantity+excluded.quantity').run(g,u,itemId,quantity);
    db.prepare('INSERT INTO ledger(guild_id,user_id,delta,balance_after,kind,actor_id,reason) VALUES(?,?,?,?,?,?,?)').run(g,u,-total,next,'shop',u,`購買 ${item.name} x${quantity}｜金幣直接銷毀`);
    db.exec('COMMIT'); return next;
  } catch(e) { db.exec('ROLLBACK'); throw e; }
}
async function triggerRandomEvent(i,g,u) {
  if(Math.random()>=0.15) return;
  const event=Math.floor(Math.random()*6);
  let title,description,color=0xF5B942;
  if(event===0) {
    const before=balance(g,u), found=Math.floor(Math.random()*901)+100, after=changeBalance(g,u,found,'random_event',u,'隨機事件：撿到錢包');
    title='👛 隨機事件：撿到錢包'; description=`你撿到一個錢包，實際獲得 **${fmt(after-before)}**！`;
  } else if(event===1) {
    const fee=Math.min(500,balance(g,u)); changeBalance(g,u,-fee,'event_fee',u,'隨機事件：迷子收保護費');
    title='😎 隨機事件：迷子收保護費'; description=`迷子突然出現並收走 **${fmt(fee)}**。`; color=0xD94A4A;
  } else if(event===2) {
    db.prepare('UPDATE event_effects SET shop_sale_until=? WHERE guild_id=? AND user_id=?').run(Date.now()+600000,g,u);
    title='🏷️ 隨機事件：商城特價'; description='接下來 **10 分鐘商城全面八折**！'; color=0x35C46A;
  } else if(event===3) {
    db.prepare('UPDATE event_effects SET half_stamina_until=? WHERE guild_id=? AND user_id=?').run(Date.now()+600000,g,u);
    title='⚡ 隨機事件：精力充沛'; description='接下來 **10 分鐘體力消耗減半**！'; color=0x35C46A;
  } else if(event===4) {
    const owed=debt(g,u), payment=Math.min(1000,owed,balance(g,u));
    if(payment>0) bankTransfer(g,u,payment,'repay');
    title='🏛️ 隨機事件：銀行催收'; description=payment?`銀行強制收走 **${fmt(payment)}** 償還負債。`:'催收人員查看帳戶後無款可收。'; color=0xD94A4A;
  } else {
    db.prepare('UPDATE event_effects SET double_work_until=? WHERE guild_id=? AND user_id=?').run(Date.now()+600000,g,u);
    title='💼 隨機事件：工作旺季'; description='接下來 **10 分鐘工作收入加倍**！'; color=0x35C46A;
  }
  await i.followUp({embeds:[new EmbedBuilder().setColor(color).setTitle(title).setDescription(description)]}).catch(()=>{});
}
function scheduleRandomEvent(i,g,u) { setTimeout(()=>triggerRandomEvent(i,g,u),5000); }
function applyHospitalRandomEvent(g,u) {
  if(Math.random()>=0.35) return {text:'',image:null};
  const roll=Math.floor(Math.random()*6);
  if(roll===0) {
    const fee=Math.min(1000,balance(g,u)); if(fee) changeBalance(g,u,-fee,'medical',u,'特殊傳染病疫苗費｜金幣直接銷毀');
    return {text:`\n\n🦠 **住院隨機事件：特殊傳染病！**\n院方要求施打疫苗，支付 **${fmt(fee)}**${fee<1000?'（金庫已被扣至零）':''}。`,image:null};
  }
  if(roll===1) {
    const releaseAt=Date.now()+5*60*1000;
    db.prepare('INSERT INTO hospital_lock(guild_id,user_id,release_at,reason) VALUES(?,?,?,?) ON CONFLICT(guild_id,user_id) DO UPDATE SET release_at=excluded.release_at,reason=excluded.reason').run(g,u,releaseAt,'殭屍病毒封院');
    return {text:'\n\n🧟 **住院隨機事件：殭屍病毒爆發！**\n醫院遭到封鎖，你被困住 **5 分鐘**，期間不能遊戲或工作。',image:null};
  }
  if(roll===2) {
    const fee=Math.min(800,balance(g,u)); if(fee) changeBalance(g,u,-fee,'medical',u,'被安排入住豪華病房｜金幣直接銷毀');
    return {text:`\n\n🛏️ **住院隨機事件：被安排豪華病房！**\n院方加收病房費 **${fmt(fee)}**。`,image:null};
  }
  if(roll===3) {
    const current=stamina(g,u), lost=Math.min(20,current); if(lost) db.prepare('UPDATE player_stats SET stamina=stamina-? WHERE guild_id=? AND user_id=?').run(lost,g,u);
    const before=balance(g,u), after=changeBalance(g,u,200,'random_event',u,'被迷子全身檢查');
    return {text:`\n\n🩻 **住院隨機事件：被迷子全身檢查！**\n體力減少 **${lost}** 點，獲得 **${fmt(after-before)}**。`,image:{path:hospitalCheckGif,name:'mizi_check.gif'}};
  }
  if(roll===4) {
    const before=balance(g,u), after=changeBalance(g,u,500,'random_event',u,'住院保險理賠');
    return {text:`\n\n📄 **住院隨機事件：保險理賠通過！**\n保險公司支付 **${fmt(after-before)}**。`,image:null};
  }
  const max=staminaMax(g,u), before=stamina(g,u), restored=Math.min(20,max-before); if(restored) db.prepare('UPDATE player_stats SET stamina=stamina+? WHERE guild_id=? AND user_id=?').run(restored,g,u);
  return {text:`\n\n💉 **住院隨機事件：護士特別照顧！**\n恢復 **${restored}** 點體力，目前 ${before+restored}/${max}。`,image:null};
}
function useItem(g,u,itemId,quantity) {
  const item=shopItems[itemId], current=stamina(g,u);
  const owned=db.prepare('SELECT quantity FROM inventory WHERE guild_id=? AND user_id=? AND item_id=?').get(g,u,itemId)?.quantity||0;
  if(owned<quantity) throw new Error(`背包數量不足，目前只有 ${owned} 個`);
  if(item.maxBonus) {
    if(quantity!==1) throw new Error('女僕拍立得每次只能使用 1 張');
    const today=taipeiDay(), existing=staminaMax(g,u)-BASE_STAMINA;
    if(existing>=item.maxBonus) throw new Error('今天已經啟用過女僕拍立得效果');
    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare('UPDATE inventory SET quantity=quantity-1 WHERE guild_id=? AND user_id=? AND item_id=?').run(g,u,itemId);
      db.prepare('INSERT INTO stamina_bonus(guild_id,user_id,bonus_day,bonus) VALUES(?,?,?,?) ON CONFLICT(guild_id,user_id) DO UPDATE SET bonus_day=excluded.bonus_day,bonus=excluded.bonus').run(g,u,today,item.maxBonus);
      db.exec('COMMIT'); return {restored:0,stamina:current,max:BASE_STAMINA+item.maxBonus,special:item.flavor};
    } catch(e) { db.exec('ROLLBACK'); throw e; }
  }
  const max=staminaMax(g,u);
  if(current>=max) throw new Error('目前體力已滿，不需要使用');
  if(item.fullRestore&&quantity!==1) throw new Error(`${item.name} 每次只能使用 1 份`);
  const restored=item.fullRestore?max-current:Math.min(max-current,item.stamina*quantity);
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare('UPDATE inventory SET quantity=quantity-? WHERE guild_id=? AND user_id=? AND item_id=?').run(quantity,g,u,itemId);
    db.prepare('UPDATE player_stats SET stamina=stamina+? WHERE guild_id=? AND user_id=?').run(restored,g,u);
    db.exec('COMMIT'); return {restored,stamina:current+restored,max};
  } catch(e) { db.exec('ROLLBACK'); throw e; }
}
function validBet(g, u, bet) {
  if (!Number.isInteger(bet) || bet < MIN_BET || bet > MAX_BET) throw new Error(`下注需為 ${MIN_BET.toLocaleString()}～${MAX_BET.toLocaleString()} 金幣`);
  if (balance(g, u) < bet) throw new Error('金幣不足');
}
function jailRemaining(g, u) {
  const row=db.prepare('SELECT release_at FROM jail WHERE guild_id=? AND user_id=?').get(g,u);
  if(!row) return 0;
  const remaining=row.release_at-Date.now();
  if(remaining<=0) {
    db.prepare('DELETE FROM jail WHERE guild_id=? AND user_id=?').run(g,u);
    return 0;
  }
  return remaining;
}
function hospitalRemaining(g,u) {
  const row=db.prepare('SELECT release_at FROM hospital_lock WHERE guild_id=? AND user_id=?').get(g,u);
  if(!row) return 0;
  const remaining=row.release_at-Date.now();
  if(remaining<=0) {
    db.prepare('DELETE FROM hospital_lock WHERE guild_id=? AND user_id=?').run(g,u);
    return 0;
  }
  return remaining;
}
function legalWorkCount(g,u,increment=false) {
  const today=taipeiDay();
  db.prepare('INSERT OR IGNORE INTO daily_work(guild_id,user_id,work_day,count) VALUES(?,?,?,0)').run(g,u,today);
  const row=db.prepare('SELECT work_day,count FROM daily_work WHERE guild_id=? AND user_id=?').get(g,u);
  if(row.work_day!==today) db.prepare('UPDATE daily_work SET work_day=?,count=0 WHERE guild_id=? AND user_id=?').run(today,g,u);
  if(increment) db.prepare('UPDATE daily_work SET count=count+1 WHERE guild_id=? AND user_id=?').run(g,u);
  return (row.work_day===today?row.count:0)+(increment?1:0);
}
function jailText(ms) {
  const total=Math.ceil(ms/1000), minutes=Math.floor(total/60), seconds=total%60;
  return `${minutes} 分 ${seconds} 秒`;
}
function releaseFromJail(g,u) {
  db.prepare('DELETE FROM jail WHERE guild_id=? AND user_id=?').run(g,u);
  db.prepare('DELETE FROM jail_training WHERE guild_id=? AND user_id=?').run(g,u);
  db.prepare('DELETE FROM jail_escape WHERE guild_id=? AND user_id=?').run(g,u);
}
const fmt = n => `🪙 ${n.toLocaleString()}`;
function vehicleModLabels(g,u,assetId,pending=null) {
  const selections=vehicleModSelections(g,u,assetId,pending),labels={};
  for(const [category,optionId] of Object.entries(selections)) labels[category]=vehicleModOptionName(assetId,category,optionId);
  return labels;
}
function vehicleModCost(g,u,assetId,category,optionId) {
  const definition=vehicleModCatalog[category],option=vehicleModOption(category,optionId);
  if(!definition||!option) return 0;
  const current=vehicleMods(g,u,assetId),currentOption=vehicleModOption(category,current[definition.column])||{price:0};
  return category==='engine'||category==='suspension'?Math.max(0,option.price-currentOption.price):option.price;
}
function vehicleModEmbed(g,u,assetId,notice='',pending=null) {
  const asset=assetCatalog[assetId],mods=vehicleMods(g,u,assetId),labels=vehicleModLabels(g,u,assetId,pending),stats=vehicleModRatings(g,u,assetId,pending),performance=vehicleModPerformance(g,u,assetId,pending),previewing=!!pending;
  const stars=value=>`${'★'.repeat(value)}${'☆'.repeat(5-value)}`;
  return new EmbedBuilder().setColor(previewing?0xF5B942:0x7C4DFF).setTitle(`🔧 改裝工坊｜${asset.name}${previewing?'｜預覽中':''}`).setDescription(`${notice?`${notice}\n\n`:''}**${previewing?'預覽外觀（尚未保存）':'目前外觀'}**\n🎨 烤漆：${labels.paint}\n🛞 輪框：${labels.wheels}\n🪽 尾翼：${labels.spoiler}\n🏁 寬體：${labels.widebody}\n\n**${previewing?'預覽性能':'性能改裝'}**\n⚙️ 引擎：${labels.engine}\n🔩 懸吊：${labels.suspension}\n\n**綜合性能**\n速度：${stars(stats.speed)}\n加速：${stars(stats.acceleration)}\n操控：${stars(stats.handling)}\n競速能力：**+${performance.race.toFixed(2)}**｜搶劫逃脫：**+${performance.heist}%**\n累積改裝費：**${fmt(mods.total_spent||0)}**｜金庫：**${fmt(balance(g,u))}**\n\n選擇零件後會先合成預覽圖片並顯示價格；只有按下「確認安裝」才會扣款與保存。升級引擎與懸吊只收取等級價差。`);
}
function vehicleModCategoryRow(token,selected=null) {
  return new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(`vehicle_mod_category:${token}`).setPlaceholder('選擇改裝分類').addOptions(
    Object.entries(vehicleModCatalog).filter(([,definition])=>Object.keys(definition.options).length>1).map(([value,definition])=>({label:definition.label,emoji:definition.emoji,value,default:value===selected}))
  ));
}
function vehicleModVehicleRow(token,g,u,selected=null) {
  const options=ownedVisualModVehicles(g,u).slice(0,25).map(row=>{
    const asset=assetCatalog[row.asset_id];
    return {
      label:asset.name.replace(/^[^A-Za-z0-9\u3400-\u9FFF]+/u,'').slice(0,100),
      description:`${asset.rarity||'一般'}｜已完成圖片改裝素材`.slice(0,100),
      value:row.asset_id,
      default:row.asset_id===selected
    };
  });
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder().setCustomId(`vehicle_mod_vehicle:${token}`).setPlaceholder('選擇要改裝的車輛').addOptions(options)
  );
}
function vehicleModOptionRow(token,g,u,assetId,category,pending=null) {
  const definition=vehicleModCatalog[category],current=pending?.category===category?pending.optionId:vehicleMods(g,u,assetId)[definition.column];
  const selections=vehicleModSelections(g,u,assetId,pending);
  return new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(`vehicle_mod_option:${token}:${category}`).setPlaceholder(`選擇${definition.label}`).addOptions(
    Object.entries(definition.options).filter(([value])=>{
      if(!vehicleExteriorModCategories.has(category)||value===current) return true;
      return vehicleVisualConfigSupported(assetId,{...selections,[category]:value});
    }).map(([value,option])=>{
      const cost=vehicleModCost(g,u,assetId,category,value),effect=[];
      const visualAvailable=!vehicleExteriorModCategories.has(category)||vehicleVisualConfigSupported(assetId,{...selections,[category]:value});
      if(option.race) effect.push(`競速 +${option.race}`);
      if(option.heist) effect.push(`逃脫 +${option.heist}%`);
      return {label:`${vehicleModOptionName(assetId,category,value)}${visualAvailable?'':'（素材待補）'}`.slice(0,100),description:`${cost?fmt(cost):'免費'}${effect.length?`｜${effect.join('、')}`:''}`.slice(0,100),value,default:value===current};
    })
  ));
}
function vehicleModComponents(token,session) {
  const rows=[vehicleModCategoryRow(token,session.category)];
  if(session.category) rows.push(vehicleModOptionRow(token,session.guildId,session.userId,session.assetId,session.category,session.pending));
  if(session.pending) rows.push(new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`vehicle_mod_confirm:${token}`).setLabel('確認預覽並安裝').setEmoji('✅').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`vehicle_mod_cancel:${token}`).setLabel('取消預覽').setEmoji('❌').setStyle(ButtonStyle.Danger)
  ));
  rows.push(new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`vehicle_mod_done:${token}`).setLabel('完成改裝').setEmoji('🏁').setStyle(ButtonStyle.Primary).setDisabled(!!session.pending)));
  return rows;
}
function vehicleModOpenButton(userId,assetId) {
  return new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`vehicle_mod_open:${userId}:${assetId}`).setLabel('改裝這輛車').setEmoji('🔧').setStyle(ButtonStyle.Primary));
}
async function renderVehicleModImage(g,u,assetId,pending=null) {
  const asset=assetCatalog[assetId],image=asset?.image||asset?.images?.[0];
  if(!image) throw new Error('這輛車尚未配置底圖');
  const base=assetPath(image);
  if(!existsSync(base)) throw new Error('找不到這輛車的底圖檔案');
  const selections=vehicleModSelections(g,u,assetId,pending),labels=vehicleModLabels(g,u,assetId,pending),stats=vehicleModRatings(g,u,assetId,pending);
  const config={asset_name:asset.name,labels,stats,...selections};
  const output=resolve(process.cwd(),'data','renders',`${randomUUID()}.png`);
  mkdirSync(resolve(process.cwd(),'data','renders'),{recursive:true});
  await execFileAsync('python3',[resolve(process.cwd(),'scripts','render_car.py'),'--base',base,'--layers',resolve(process.cwd(),'assets','mod_layers',assetId),'--output',output,'--config',JSON.stringify(config)],{timeout:15000,maxBuffer:1024*1024});
  return output;
}
async function vehicleModPayload(g,u,assetId,notice='',pending=null) {
  const embed=vehicleModEmbed(g,u,assetId,notice,pending);
  try {
    const path=await renderVehicleModImage(g,u,assetId,pending),name=`modified_${assetId}.png`;
    embed.setImage(`attachment://${name}`);
    return {embeds:[embed],files:[new AttachmentBuilder(path,{name})]};
  } catch(error) {
    console.error('Vehicle mod render failed:',error);
    embed.setFooter({text:`圖片合成暫時失敗：${error.message}`});
    return {embeds:[embed]};
  }
}
async function vehicleGaragePayload(embed,g,u,assetId,asset) {
  try {
    const path=await renderVehicleModImage(g,u,assetId),name=`garage_${assetId}.png`;
    embed.setImage(`attachment://${name}`);
    return {embeds:[embed],files:[new AttachmentBuilder(path,{name})]};
  } catch(error) {
    console.error('Garage vehicle render failed:',error);
    embed.setFooter({text:`改裝車圖片暫時合成失敗，已顯示原始車圖：${error.message}`});
    return assetMediaPayload(embed,assetId,asset);
  }
}
const suitIcon = ['♣️','♦️','♥️','♠️'];
const rankName = ['3','4','5','6','7','8','9','10','J','Q','K','A','2'];
const drawCard = () => { const n = Math.floor(Math.random()*52); return { rank: Math.floor(n/4), suit:n%4, value:Math.floor(n/4)*4+n%4 }; };
const cardText = c => `${suitIcon[c.suit]}${rankName[c.rank]}`;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const raceVehicleCategories=new Set(['汽車','機車']);
const raceRarityBonus={普通:0,稀有:0.8,史詩:1.8,傳說:3.2,傳說隱藏:4.2};
const raceScenes=[
  {id:'street',name:'街頭賽',emoji:'🌃',color:0x7C4DFF,image:'racing/street_race.jpg',fileName:'race_street.jpg',description:'霓虹街道、高速直線與密集車流交錯，爆發加速更容易拉開差距。'},
  {id:'mountain',name:'山道賽',emoji:'⛰️',color:0x2E7D32,image:'racing/mountain_race.jpg',fileName:'race_mountain.jpg',description:'濕滑山路與連續髮夾彎考驗穩定性，任何失誤都可能被對手反超。'},
  {id:'drift',name:'甩尾競速',emoji:'💨',color:0xE91E63,image:'racing/drift_race.jpg',fileName:'race_drift.jpg',description:'以高速甩尾累積速度與聲勢，漂亮的連續動作有機會帶來巨大推進。'}
];
function raceChoices(g,u,type) {
  if(type==='vehicle') return assetsOf(g,u).filter(row=>raceVehicleCategories.has(assetCatalog[row.asset_id]?.category)).map(row=>({id:row.asset_id,name:assetCatalog[row.asset_id]?.name||row.asset_id,quantity:row.quantity}));
  return ownedPets(g,u).map(row=>({id:row.petId,name:petDisplayName(row.petId,row.nickname),happiness:row.happiness??100}));
}
function raceChoiceInfo(g,u,type,id) {
  if(type==='vehicle') {
    const asset=assetCatalog[id];
    if(!asset||!raceVehicleCategories.has(asset.category)) return null;
    return assetsOf(g,u).some(row=>row.asset_id===id&&row.quantity>0)?{id,name:asset.name,asset}:null;
  }
  const pet=ownedPets(g,u).find(row=>row.petId===id);
  return pet?{id,name:petDisplayName(pet.petId,pet.nickname),pet}:null;
}
function raceSelectionEmbed(session) {
  const selected=session.selectedId?raceChoiceInfo(session.guildId,session.userId,session.type,session.selectedId):null;
  let detail='請先從下拉選單挑選參賽者，再按下開始。';
  if(selected&&session.type==='vehicle') detail=`已選擇：**${selected.name}**\n稀有度：**${selected.asset.rarity||'普通'}**｜資產增益強度：**${assetBuffPower(selected.id).toFixed(2)}x**`;
  if(selected&&session.type==='pet') detail=`已選擇：**${selected.name}**\n目前幸福度：**${selected.pet.happiness}/100**｜幸福度會影響臨場表現`;
  return new EmbedBuilder().setColor(session.type==='vehicle'?0xE74C3C:0xF39CBB).setTitle(session.type==='vehicle'?'🏁 地下街頭競速':'🐾 寵物障礙競賽').setDescription(`${detail}\n\n下注：**${fmt(session.bet)}**\n獎勵：冠軍 ${session.type==='vehicle'?'2.5':'3'} 倍、亞軍 ${session.type==='vehicle'?'1.2':'1.25'} 倍\n體力消耗：**${session.type==='vehicle'?10:8}**`);
}
function raceRows(token,session,disabled=false) {
  const choices=raceChoices(session.guildId,session.userId,session.type).slice(0,25);
  const menu=new StringSelectMenuBuilder().setCustomId(`race_select:${token}`).setPlaceholder(session.type==='vehicle'?'選擇你的汽車或機車':'選擇你的寵物').setDisabled(disabled).addOptions(choices.map(choice=>({label:choice.name.slice(0,100),description:session.type==='vehicle'?`持有 ${choice.quantity} 輛`:`幸福度 ${choice.happiness}/100`,value:choice.id,default:choice.id===session.selectedId})));
  return [new ActionRowBuilder().addComponents(menu),new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`race_start:${token}`).setLabel('開始競賽').setEmoji(session.type==='vehicle'?'🏁':'🐾').setStyle(ButtonStyle.Success).setDisabled(disabled||!session.selectedId))];
}
function raceSelectionPayload(token,session) {
  const embed=raceSelectionEmbed(session),payload={embeds:[embed],components:raceRows(token,session),attachments:[],files:[]};
  if(session.type!=='vehicle'||!session.selectedId) return payload;
  const selected=raceChoiceInfo(session.guildId,session.userId,session.type,session.selectedId);
  if(!selected?.asset?.image) return payload;
  const extension=extname(selected.asset.image)||'.jpg',fileName=`selected_race_vehicle${extension}`;
  embed.setImage(`attachment://${fileName}`);
  payload.files=[new AttachmentBuilder(assetPath(selected.asset.image),{name:fileName})];
  return payload;
}
function vehicleRacePower(g,u,assetId) {
  const asset=assetCatalog[assetId]||{},priceBonus=Math.max(0,Math.min(2.2,Math.log10(Math.max(1000,asset.price||1000))-3));
  return 1.5+(raceRarityBonus[asset.rarity]||0)+priceBonus+Math.min(2.2,Math.max(0,assetBuffPower(assetId)-1)*1.4)+vehicleModPerformance(g,u,assetId).race;
}
function petRacePower(pet) {
  const product=petCatalog[pet.petId]||{};
  return 1.5+(pet.happiness??100)/28+Math.min(1.8,(product.price||1000)/9000);
}
function raceTrackText(entrants) {
  const ordered=[...entrants].sort((a,b)=>b.distance-a.distance),width=16;
  return ordered.map((entry,index)=>{const filled=Math.max(1,Math.min(width,Math.round(entry.distance/105*width)));return `**${index+1}.** ${entry.icon} ${entry.name}\n${'▰'.repeat(filled)}${'▱'.repeat(width-filled)} ${Math.round(entry.distance)}m`;}).join('\n');
}
function competitionResultMessage(type,place) {
  const winMessages=type==='vehicle'?
    [
      '引擎聲逐漸安靜，全場只剩下你的名字。你不是越過終點線，而是把終點線變成了自己的簽名。',
      '後照鏡裡已經看不見對手——今晚這條賽道，只記得你的尾燈。',
      '速度會被刷新，但這場勝利不會。你用最漂亮的方式證明，冠軍早有歸屬。'
    ]:
    [
      '牠帶著你的信任衝過終點。這面冠軍不是運氣，而是你們之間最漂亮的默契。',
      '小小的腳步跑出了全場最大的歡呼——今天的冠軍，值得最多的摸摸與零食。',
      '牠回頭確認你還在，接著把所有對手留在身後。這場勝利屬於你們兩個。'
    ];
  const secondMessages=type==='vehicle'?
    ['只差半個車身！亞軍不是終點，而是下一場冠軍的起跑線。','輪胎還熱、戰意未熄。你已經讓冠軍開始擔心下一次碰面。']:
    ['差一點就摸到冠軍，但牠已經跑得非常漂亮——記得回家多給一份零食。','亞軍也值得掌聲；牠跑回你身邊的那一刻，名次已經不是最重要的事。'];
  const loseMessages=type==='vehicle'?
    ['你的油門踩得很有感情，可惜速度完全沒有。','別人是在競速，你比較像開著方向燈找停車位。','終點線等你等到都快下班了。','車沒有問題，問題可能坐在方向盤後面。']:
    ['牠跑得很努力，至於你……零食是不是買錯牌子了？','其他寵物在比賽，你家的比較像來交朋友。','名次很誠實：光靠可愛真的不一定能奪冠。','牠已經盡力了，回去先檢討一下飼主吧。'];
  const pool=place===1?winMessages:place===2?secondMessages:loseMessages;
  return pool[Math.floor(Math.random()*pool.length)];
}
function activeRaceForUser(g,u) {
  if([...raceSessions.values()].some(s=>s.guildId===g&&s.userId===u&&s.expiresAt>Date.now())) return true;
  return [...pvpRaceSessions.values()].some(s=>s.guildId===g&&[s.challengerId,s.opponentId].includes(u)&&s.status!=='done'&&s.expiresAt>Date.now());
}
function otherActiveRaceForUser(g,u,excludedToken) {
  if([...raceSessions.values()].some(s=>s.guildId===g&&s.userId===u&&s.expiresAt>Date.now())) return true;
  return [...pvpRaceSessions.entries()].some(([token,s])=>token!==excludedToken&&s.guildId===g&&[s.challengerId,s.opponentId].includes(u)&&s.status!=='done'&&s.expiresAt>Date.now());
}
function pvpRaceChallengeRow(token,disabled=false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`pvp_race_accept:${token}`).setLabel('接受挑戰').setEmoji('✅').setStyle(ButtonStyle.Success).setDisabled(disabled),
    new ButtonBuilder().setCustomId(`pvp_race_reject:${token}`).setLabel('拒絕挑戰').setEmoji('✖️').setStyle(ButtonStyle.Danger).setDisabled(disabled)
  );
}
function pvpRaceEmbed(session) {
  const getName=id=>session.names[id]||'玩家';
  const choiceName=id=>session.selections[id]?(raceChoiceInfo(session.guildId,id,session.type,session.selections[id])?.name||'已失效'):'尚未選擇';
  return new EmbedBuilder().setColor(session.type==='vehicle'?0xE74C3C:0xF39CBB)
    .setTitle(session.type==='vehicle'?'🏁 競速 PVP 挑戰':'🐾 寵物競速 PVP 挑戰')
    .setDescription(`**${getName(session.challengerId)}** vs **${getName(session.opponentId)}**\n\n${getName(session.challengerId)}：**${choiceName(session.challengerId)}**\n${getName(session.opponentId)}：**${choiceName(session.opponentId)}**\n\n每人下注：**${fmt(session.bet)}**\n冠軍取得獎池：**${fmt(session.bet*2)}**\n每人消耗：**${session.type==='vehicle'?10:8} 體力**`)
    .setFooter({text:'雙方各自選擇參賽者；挑戰者在兩人完成後開始比賽'});
}
function pvpRaceRows(token,session,disabled=false) {
  const rows=[];
  for(const userId of [session.challengerId,session.opponentId]) {
    const choices=raceChoices(session.guildId,userId,session.type).slice(0,25);
    const menu=new StringSelectMenuBuilder().setCustomId(`pvp_race_select:${token}:${userId}`).setPlaceholder(`${session.names[userId]}：選擇${session.type==='vehicle'?'車輛':'寵物'}`).setDisabled(disabled);
    menu.addOptions(choices.map(c=>({label:c.name.slice(0,100),description:session.type==='vehicle'?`持有 ${c.quantity} 輛`:`幸福度 ${c.happiness}/100`,value:c.id,default:c.id===session.selections[userId]})));
    rows.push(new ActionRowBuilder().addComponents(menu));
  }
  rows.push(new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`pvp_race_start:${token}`).setLabel('開始 PVP').setEmoji('🏁').setStyle(ButtonStyle.Success).setDisabled(disabled||!session.selections[session.challengerId]||!session.selections[session.opponentId])));
  return rows;
}
function pvpRacePayload(token,session,focusUserId=null) {
  const embed=pvpRaceEmbed(session),payload={embeds:[embed],components:pvpRaceRows(token,session),attachments:[],files:[]};
  const userId=focusUserId||session.opponentId||session.challengerId,id=session.selections[userId];
  if(!id) return payload;
  const info=raceChoiceInfo(session.guildId,userId,session.type,id),image=info?(session.type==='vehicle'?info.asset?.image:petCatalog[id]?.image):null;
  if(!image) return payload;
  const fileName=`pvp_selected${extname(image)||'.jpg'}`;
  embed.setImage(`attachment://${fileName}`);
  payload.files=[new AttachmentBuilder(assetPath(image),{name:fileName})];
  return payload;
}
async function runPvpCompetition(i,token,session) {
  const ids=[session.challengerId,session.opponentId],cost=session.type==='vehicle'?10:8;
  const infos=ids.map(id=>raceChoiceInfo(session.guildId,id,session.type,session.selections[id]));
  if(infos.some(x=>!x)) throw new Error('其中一位玩家的參賽資產已不存在。');
  for(const id of ids){validBet(session.guildId,id,session.bet);if(stamina(session.guildId,id)<staminaCost(session.guildId,id,cost)) throw new Error(`${session.names[id]} 的體力不足。`);}
  for(const id of ids){consumeStamina(session.guildId,id,cost);changeBalance(session.guildId,id,-session.bet,'pvp_wager',ids.find(x=>x!==id),session.type==='vehicle'?'競速 PVP':'寵物競速 PVP');}
  session.charged=true;
  if(session.type==='pet') for(const id of ids) db.prepare('UPDATE player_pets SET happiness=MAX(0,happiness-8) WHERE guild_id=? AND user_id=? AND pet_id=?').run(session.guildId,id,session.selections[id]);
  const scene=session.type==='vehicle'?raceScenes[Math.floor(Math.random()*raceScenes.length)]:null;
  if(scene){await i.editReply({embeds:[new EmbedBuilder().setColor(scene.color).setTitle(`${scene.emoji} PVP 賽事：${scene.name}`).setDescription(`${scene.description}\n\n雙方已就位，賽事即將開始……`).setImage(`attachment://${scene.fileName}`)],components:[],attachments:[],files:[new AttachmentBuilder(assetPath(scene.image),{name:scene.fileName})]});await sleep(1800);}
  const entrants=ids.map((id,index)=>({id,name:`${session.names[id]}｜${infos[index].name}`,icon:session.type==='vehicle'?'🏎️':'🐾',power:session.type==='vehicle'?vehicleRacePower(session.guildId,id,session.selections[id]):petRacePower(infos[index].pet),distance:0}));
  for(let frame=1;frame<=6;frame++){
    entrants.forEach(entry=>{const burst=Math.random()<(scene?.id==='street'?0.17:scene?.id==='drift'?0.14:0.1)?(scene?.id==='drift'?9:7):0;const mistake=scene?.id==='mountain'&&Math.random()<0.08?-5:0;entry.distance+=Math.max(4,10+Math.random()*8+entry.power+burst+mistake);});
    await i.editReply({embeds:[new EmbedBuilder().setColor(scene?.color||0xF39CBB).setTitle(`${scene?`${scene.emoji} ${scene.name}｜`:''}${frame===6?'衝線！':frame===1?'起跑！':`第 ${frame} 賽段`}`).setDescription(raceTrackText(entrants))],components:[],attachments:[],files:[]});
    await sleep(650);
  }
  const ranking=[...entrants].sort((a,b)=>b.distance-a.distance),draw=Math.abs(ranking[0].distance-ranking[1].distance)<1;
  let result;
  if(draw){for(const id of ids) changeBalance(session.guildId,id,session.bet,'pvp_wager',id,'PVP 平手退款');result='雙方幾乎同時衝線，下注已全數退回。';}
  else {changeBalance(session.guildId,ranking[0].id,session.bet*2,'pvp_wager',ranking[1].id,'PVP 勝者獎池');result=`🏆 **${session.names[ranking[0].id]}** 奪得勝利並拿走 **${fmt(session.bet*2)}** 獎池！`;}
  session.settled=true;session.status='done';pvpRaceSessions.delete(token);
  return i.editReply({embeds:[new EmbedBuilder().setColor(draw?0xC0C0C0:0xFFD700).setTitle(session.type==='vehicle'?'🏁 競速 PVP 完成':'🐾 寵物競速 PVP 完成').setDescription(`${ranking.map((e,n)=>`${n+1}. ${e.icon} **${e.name}**`).join('\n')}\n\n${result}\n\n${ids.map(id=>`${session.names[id]}：**${fmt(balance(session.guildId,id))}**`).join('\n')}`)],components:[],attachments:[],files:[]});
}
async function runCompetition(i,token,session) {
  const g=session.guildId,u=session.userId,selected=raceChoiceInfo(g,u,session.type,session.selectedId);
  if(!selected) throw new Error('參賽資產已不存在，請重新建立比賽。');
  validBet(g,u,session.bet);
  consumeStamina(g,u,session.type==='vehicle'?10:8);
  changeBalance(g,u,-session.bet,'bet',u,session.type==='vehicle'?'競速':'寵物競賽');
  if(session.type==='pet') db.prepare('UPDATE player_pets SET happiness=MAX(0,happiness-8) WHERE guild_id=? AND user_id=? AND pet_id=?').run(g,u,session.selectedId);
  scheduleRandomEvent(i,g,u);
  const scene=session.type==='vehicle'?raceScenes[Math.floor(Math.random()*raceScenes.length)]:null;
  if(scene) {
    const sceneEmbed=new EmbedBuilder().setColor(scene.color).setTitle(`${scene.emoji} 本場賽事：${scene.name}`).setDescription(`參賽車輛：**${selected.name}**\n\n${scene.description}\n\n引擎已就緒，賽事即將開始……`).setImage(`attachment://${scene.fileName}`).setFooter({text:'賽事類型每場隨機抽選'});
    await i.editReply({embeds:[sceneEmbed],components:[],attachments:[],files:[new AttachmentBuilder(assetPath(scene.image),{name:scene.fileName})]});
    await sleep(1800);
  }
  const playerPower=session.type==='vehicle'?vehicleRacePower(g,u,session.selectedId):petRacePower(selected.pet);
  const npcNames=session.type==='vehicle'?['午夜幽靈','灣岸獵手','赤焰車神']:['閃電毛球','暴走肉球','夜行萌獸'];
  const entrants=[{id:'player',name:selected.name,icon:session.type==='vehicle'?'🏎️':'🐾',power:playerPower,distance:0},...npcNames.map((name,index)=>({id:`npc${index}`,name,icon:session.type==='vehicle'?['🚗','🏎️','🚙'][index]:['🐕','🐈','🦜'][index],power:2.5+Math.random()*4,distance:0}))];
  for(let frame=1;frame<=6;frame++) {
    entrants.forEach(entry=>{
      const burstChance=scene?.id==='street'?0.17:scene?.id==='drift'?0.14:0.10;
      const burst=Math.random()<burstChance?(scene?.id==='drift'?9:7):0;
      const mountainMistake=scene?.id==='mountain'&&Math.random()<0.08?-5:0;
      entry.distance+=Math.max(4,10+Math.random()*8+entry.power+burst+mountainMistake);
    });
    const phase=frame===1?'起跑！':frame===6?'衝線！':`第 ${frame} 賽段`;
    await i.editReply({embeds:[new EmbedBuilder().setColor(scene?.color||(session.type==='vehicle'?0xE74C3C:0xF39CBB)).setTitle(`${scene?`${scene.emoji} ${scene.name}｜`:session.type==='vehicle'?'🏁 ':'🐾 '}${phase}`).setDescription(raceTrackText(entrants)).setFooter({text:'稀有度與幸福度提供優勢，但爆發與失誤仍可能逆轉排名'})],components:[],attachments:[],files:[]});
    await sleep(650);
  }
  const ranking=[...entrants].sort((a,b)=>b.distance-a.distance),place=ranking.findIndex(entry=>entry.id==='player')+1;
  const multiplier=place===1?(session.type==='vehicle'?2.5:3):place===2?(session.type==='vehicle'?1.2:1.25):0;
  const payout=Math.floor(session.bet*multiplier),settlement=settleGamePayout(g,u,session.bet,payout,session.type==='vehicle'?'競速':'寵物競賽');
  const profit=settlement.credited-session.bet,components=settlement.dog?dogChaseRow(u,settlement.stolen):undefined;
  const resultLines=ranking.map((entry,index)=>`${index+1}. ${entry.icon} **${entry.name}**`).join('\n');
  const resultMessage=competitionResultMessage(session.type,place);
  raceSessions.delete(token);
  return i.editReply({embeds:[new EmbedBuilder().setColor(place===1?0xFFD700:place===2?0xC0C0C0:0x6C757D).setTitle(`${place===1?'🏆':place===2?'🥈':'🏁'} ${scene?scene.name:session.type==='vehicle'?'競速':'寵物競賽'}完成`).setDescription(`${resultLines}\n\n${scene?`賽事類型：**${scene.emoji} ${scene.name}**\n`:''}你的名次：**第 ${place} 名**\n本局結算：**${profit>=0?'+':''}${fmt(profit)}**${titleLuckNotice(settlement)}\n目前金幣：**${fmt(balance(g,u))}**\n\n**${resultMessage}**`)],components:components?[components]:[],attachments:[],files:[]});
}
const POLICE_DOG_TEXT = '🐕‍🦺 乎有龐然大物拔山倒樹而來——警犬「猛博美」從暗處飛撲而出！';
function rollEscapeEvent(context='heist') {
  const roll=Math.random();
  if(roll<0.18) return {id:'police_dog',title:'🐕‍🦺 警犬突襲',text:POLICE_DOG_TEXT,modifier:0,forceFail:true,scene:randomPoliceDogScene()};
  if(roll<0.38) return {id:'roadblock',title:'🚧 臨時封鎖',text:'前方突然架起臨時路障，撤離速度大幅下降。',modifier:-5,forceFail:false};
  if(roll<0.58) return {id:'shortcut',title:'🗺️ 神祕捷徑',text:'你發現一條情報中沒有標示的捷徑，成功拉開追兵距離。',modifier:5,forceFail:false};
  if(roll<0.74) return {id:'decoy',title:'🎭 誘餌奏效',text:context==='jail'?'巡邏人員被遠處的聲響引開，你獲得短暫空檔。':'預先安排的誘餌車成功引開一部分警力。',modifier:4,forceFail:false};
  if(roll<0.88) return {id:'wrong_turn',title:'↩️ 走錯方向',text:'慌亂中轉錯路口，只能繞路尋找出口。',modifier:-4,forceFail:false};
  return {id:'clear',title:'🌙 路線暢通',text:'撤離路線暫時沒有異狀，追兵仍在後方緊追。',modifier:0,forceFail:false};
}
const mahjongTiles=['🀇','🀈','🀉','🀊','🀋','🀌','🀍','🀎','🀏','🀙','🀚','🀛','🀜','🀝','🀞','🀟','🀠','🀡','🀐','🀑','🀒','🀓','🀔','🀕','🀖','🀗','🀘','🀀','🀁','🀂','🀃','🀄','🀅','🀆'];
function drawMahjongHand() {
  const wall=mahjongTiles.flatMap(tile=>[tile,tile,tile,tile]);
  for(let x=wall.length-1;x>0;x--){const y=Math.floor(Math.random()*(x+1));[wall[x],wall[y]]=[wall[y],wall[x]];}
  return wall.slice(0,14);
}
function mahjongScore(hand) {
  const counts=new Map(); hand.forEach(t=>counts.set(t,(counts.get(t)||0)+1));
  const pairs=[...counts.values()].filter(n=>n>=2).length,triples=[...counts.values()].filter(n=>n>=3).length,quads=[...counts.values()].filter(n=>n===4).length;
  const honors=hand.filter(t=>['🀀','🀁','🀂','🀃','🀄','🀅','🀆'].includes(t)).length;
  return triples*18+quads*12+pairs*5+honors+Math.floor(Math.random()*18);
}
function mahjongRoomRow(token,disabled=false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`mahjong_join:${token}`).setLabel('加入牌桌').setEmoji('🪑').setStyle(ButtonStyle.Primary).setDisabled(disabled),
    new ButtonBuilder().setCustomId(`mahjong_start:${token}`).setLabel('開始對局').setEmoji('🀄').setStyle(ButtonStyle.Success).setDisabled(disabled)
  );
}
function riotRow(token,disabled=false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`riot_join:${token}`).setLabel('加入暴動').setEmoji('✊').setStyle(ButtonStyle.Danger).setDisabled(disabled),
    new ButtonBuilder().setCustomId(`riot_start:${token}`).setLabel('發動暴動').setEmoji('🚨').setStyle(ButtonStyle.Primary).setDisabled(disabled)
  );
}
const gameHelpDetails={
  overview:{label:'玩法總覽',emoji:'🎰',hint:'查看所有主要系統',title:'🎰 澳門最大賭場｜玩法總覽',body:`先使用 \`/每日\`、\`/賺錢\` 累積金幣，再選擇喜歡的遊戲下注。\n\n🃏 桌上遊戲｜比大小、射龍門、大老二、麻將\n🎰 機台遊戲｜角子機、大樂透、賓果、刮刮樂、賽馬\n🎡 免費活動｜幸運輪盤每天免費 3 次\n🚓 團隊玩法｜最多 8 名劫匪對抗 8 名警察\n🏎️ 資產收藏｜房產與載具可提供永久增益\n\n一般賭場遊戲每局消耗 **10 體力**，下注範圍 **${fmt(MIN_BET)}～${fmt(MAX_BET)}**；所有收益皆無每日金幣上限。`},
  highlow:{label:'比大小',emoji:'🃏',hint:'與莊家各抽一張牌',title:'🃏 比大小',body:'你與莊家各抽一張牌，點數與花色較大者獲勝。勝利獲得下注額 **2 倍**，平手退回下注，落敗則失去下注。'},
  dragon:{label:'射龍門',emoji:'🚪',hint:'判斷第三張牌是否落在門牌中間',title:'🚪 射龍門',body:'先開出兩張門牌，再選擇射牌或不射。第三張牌嚴格落在兩張門牌之間即獲得 **2 倍**；撞柱或射偏會失去下注，不射則退回下注。'},
  horse:{label:'賽馬',emoji:'🏇',hint:'選擇一匹馬觀看即時競賽',title:'🏇 賽馬',body:'從 1～4 號馬選擇一匹下注，畫面會即時更新到衝線。猜中冠軍獲得下注額 **4 倍**。'},
  race:{label:'競速',emoji:'🏁',hint:'駕駛自己的汽車或機車競賽',title:'🏁 地下街頭競速',body:'使用 `/競速` 輸入下注後，從下拉選單挑選自己擁有的汽車或機車參賽。車輛價格、稀有度與資產增益會影響速度，但賽道爆發仍可能逆轉名次。冠軍獲得 **2.5 倍**，亞軍獲得 **1.2 倍**派彩，每場消耗 **10 體力**。'},
  petRace:{label:'寵物競賽',emoji:'🐾',hint:'派出自己的寵物參加障礙賽',title:'🐾 寵物障礙競賽',body:'使用 `/寵物競賽` 輸入下注後，從下拉選單派出自己領養的寵物。幸福度與寵物價值會影響表現，每次參賽幸福度 -8。冠軍獲得 **3 倍**，亞軍獲得 **1.25 倍**派彩，每場消耗 **8 體力**。'},
  racePvp:{label:'競速 PVP',emoji:'⚔️',hint:'指定玩家進行車輛競速對決',title:'⚔️ 競速 PVP',body:'使用 `/競速pvp` 指定對手與下注。對手接受後，雙方從下拉選單挑選自己的車輛，由挑戰者開始賽事。雙方各押同額，勝者取得完整獎池；每人消耗 **10 體力**。'},
  petRacePvp:{label:'寵物競速 PVP',emoji:'🐾',hint:'指定玩家進行寵物障礙對決',title:'🐾 寵物競速 PVP',body:'使用 `/寵物競速pvp` 指定對手與下注。對手接受後，雙方各派一隻寵物參賽。勝者取得雙方獎池；每人消耗 **8 體力**，參賽寵物幸福度 -8。'},
  big2:{label:'大老二',emoji:'🂡',hint:'挑戰五張牌型強度',title:'🂡 大老二挑戰',body:'系統發出 13 張牌並選出最高五張牌型。牌型通過本局強度門檻即可獲得下注額 **2 倍**。'},
  slots:{label:'角子機',emoji:'🎰',hint:'三軸圖案配對派彩',title:'🎰 角子機',body:'三個 7️⃣ 可獲得 **20 倍**，其他三個相同圖案 **10 倍**，兩個相同圖案 **2 倍**；沒有配對則失去下注。'},
  lottery:{label:'大樂透',emoji:'🎱',hint:'從 1～49 選擇幸運號碼',title:'🎱 大樂透',body:'選擇 1～49 的一個幸運號碼，完全命中系統開出的號碼即可獲得下注額 **40 倍**。'},
  bingo:{label:'賓果',emoji:'🔢',hint:'自選九宮格號碼連線',title:'🔢 賓果',body:'自選 9 個不重複的 1～25 數字組成九宮格。橫、直或斜線完成連線即可獲得下注額 **4 倍**。'},
  scratch:{label:'刮刮樂',emoji:'🪙',hint:'親手刮開三個圖案',title:'🪙 刮刮樂',body:'依序按下三格親手刮開圖案。三個相同獲得 **10 倍**，兩個相同獲得 **2 倍**。'},
  wheel:{label:'幸運輪盤',emoji:'🎡',hint:'每天三次免費抽獎',title:'🎡 幸運輪盤',body:'每天可免費轉動 **3 次**，台北時間 00:00 重置。可抽中金幣，最大獎為每週日更新的隱藏車輛。'},
  mahjong:{label:'麻將',emoji:'🀄',hint:'單人或多人牌桌',title:'🀄 麻將',body:'可單人挑戰三名電腦，或開設 2～4 人多人牌桌。單人獲勝基本派彩 **4 倍**，多人勝者取得全桌獎池；週六獎金 ×1.5。'},
  duel:{label:'PvP 輪盤決鬥',emoji:'⚔️',hint:'指定玩家進行虛構槍械決鬥',title:'⚔️ PvP 輪盤決鬥',body:'指定另一名玩家並下注，選擇左輪或霰彈槍模式。對方接受後輪流行動，勝者取得雙方獎池。'},
  heist:{label:'團隊搶銀行',emoji:'🚓',hint:'8v8 警匪團隊玩法',title:'🚓 8v8 團隊搶銀行',body:`先用 \`/隊伍 建立\` 與 \`/隊伍 邀請\` 組隊，再由隊長使用 \`/團隊搶銀行\`。劫匪與警方各最多 8 人；警員加入並選槍後，可選擇「正面對抗劫匪」或「呼叫增援」。準備期間隊長可從自己的車庫選擇汽車、機車、飛行器或船隻作為逃跑載具；載具登記的搶劫增益會套用到成功率，未選擇則使用預設接應車。建立行動時每名劫匪支付 **${fmt(TEAM_HEIST_PREP_FEE)}** 準備費，槍枝另計；所有費用直接銷毀，無論成敗均不退還。地圖、槍枝、線人、方案與逃跑路線都會影響結果。`},
  money:{label:'賺錢與體力',emoji:'💼',hint:'工作、每日獎勵與體力規則',title:'💼 賺錢與體力',body:`使用 \`/每日\` 領取獎勵，或用 \`/賺錢\` 選擇合法工作與冒險行動。大多數行動會消耗體力，食物與飲料可恢復；所有合法工作、冒險、搶劫與賭場收益皆無每日金幣上限。`},
  assets:{label:'資產系統',emoji:'🏎️',hint:'房產、載具、車庫與交易',title:'🏎️ 資產收藏',body:'使用 `/資產商城` 查看房產與載具，購買前可先看圖片。資產會附帶永久增益，也能在 `/車庫`、`/停機坪`、`/碼頭` 展示，或透過二手市場交易。'},
  pets:{label:'寵物系統',emoji:'🐾',hint:'領養、陪伴、照顧與特殊增益',title:'🐾 寵物陪伴系統',body:'使用 `/寵物店` 預覽並領養寵物，或購買罐頭、玩具與洗護用品。再用 `/我的寵物` 設定同行夥伴與使用用品。寵物每天心情 -10，心情低於 20 時特殊功能暫停；好好照顧即可持續獲得小幅工作、賭場、商城或體力加成。'}
};
const commandHelpCategories={
  casino:{label:'🎰 賭場與賺錢',description:'所有下注遊戲、免費輪盤與工作',commands:['賺錢','比大小','射龍門','賽馬','競速','寵物競賽','競速pvp','寵物競速pvp','大老二','角子機','幸運輪盤','大樂透','賓果','刮刮樂','麻將','決鬥']},
  account:{label:'👤 玩家與經濟',description:'個人資料、金庫、銀行、體力與每日獎勵',commands:['金庫','個人資料','成就','稱號','每日增益','銀行','體力','每日']},
  shop:{label:'🛒 商城與背包',description:'購買、查看及使用補給品',commands:['商城','背包','購買','使用']},
  pets:{label:'🐾 寵物與陪伴',description:'領養寵物、購買用品並設定同行同伴',commands:['寵物店','我的寵物']},
  assets:{label:'🏎️ 資產與交易',description:'房產、載具、改裝、盲盒、展示與二手市場',commands:['資產商城','購買資產','汽車盲盒','汽車盲盒內容','我的資產','車庫','改裝','停機坪','碼頭','資產交易','變賣資產','二手市場']},
  heist:{label:'🚓 團隊與小黑屋',description:'隊伍搶劫、情報、救援、逃獄與暴動',commands:['隊伍','團隊搶銀行','銀行情報','賄絡迷子','減刑','逃獄','小黑屋暴動','救援同伴']},
  admin:{label:'🛡️ 管理員與系統',description:'玩法入口及限管理員使用的維護指令',commands:['玩法','搶劫公告頻道','單人搶劫機率','稱號設定','資產調整','金幣調整','帳務紀錄','經濟監控']}
};
const detailedHelpCommandKeys={比大小:'highlow',射龍門:'dragon',賽馬:'horse',競速:'race',寵物競賽:'petRace',競速pvp:'racePvp',寵物競速pvp:'petRacePvp',大老二:'big2',角子機:'slots',幸運輪盤:'wheel',大樂透:'lottery',賓果:'bingo',刮刮樂:'scratch',麻將:'mahjong',決鬥:'duel',團隊搶銀行:'heist',賺錢:'money',資產商城:'assets',寵物店:'pets',我的寵物:'pets'};
function commandHelpCategoryRow(selected='casino') {
  return new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('game_help_category').setPlaceholder('第一步：選擇指令分類').addOptions(
    Object.entries(commandHelpCategories).map(([value,category])=>({label:category.label,description:category.description,value,default:value===selected}))
  ));
}
function commandHelpCommandRow(categoryKey='casino',selected=null) {
  const category=commandHelpCategories[categoryKey]||commandHelpCategories.casino;
  const options=category.commands.map(name=>{
    const command=commands.find(entry=>entry.name===name);
    return {label:`/${name}`,description:(command?.description||'查看這項指令的使用方法').slice(0,100),value:name,default:name===selected};
  });
  return new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(`game_help_command:${categoryKey}`).setPlaceholder('第二步：選擇想了解的指令').addOptions(options));
}
function commandHelpComponents(categoryKey='casino',selected=null) {
  return [commandHelpCategoryRow(categoryKey),commandHelpCommandRow(categoryKey,selected)];
}
function commandOptionUsage(option) {
  const marker=option.required?`<${option.name}>`:`[${option.name}]`;
  return marker;
}
function commandUsages(command) {
  const options=command.options||[],subcommands=options.filter(option=>option.type===1),groups=options.filter(option=>option.type===2);
  const usages=[];
  for(const subcommand of subcommands) usages.push(`/${command.name} ${subcommand.name}${subcommand.options?.length?` ${subcommand.options.map(commandOptionUsage).join(' ')}`:''}`);
  for(const group of groups) for(const subcommand of group.options||[]) usages.push(`/${command.name} ${group.name} ${subcommand.name}${subcommand.options?.length?` ${subcommand.options.map(commandOptionUsage).join(' ')}`:''}`);
  if(!usages.length) usages.push(`/${command.name}${options.length?` ${options.map(commandOptionUsage).join(' ')}`:''}`);
  return usages;
}
function commandHelpOverviewEmbed(categoryKey='casino') {
  const category=commandHelpCategories[categoryKey]||commandHelpCategories.casino;
  const list=category.commands.map(name=>{
    const command=commands.find(entry=>entry.name===name);
    return `**/${name}**｜${command?.description||'查看指令說明'}`;
  }).join('\n');
  return new EmbedBuilder().setColor(0x5865F2).setTitle(`${category.label}｜完整指令導覽`).setDescription(`${category.description}\n\n${list}\n\n先選擇分類，再從第二個下拉選單選擇指令。\n\`<參數>\` 代表必填，\`[參數]\` 代表選填。`);
}
function commandHelpCommandEmbed(commandName) {
  const command=commands.find(entry=>entry.name===commandName);
  if(!command) return commandHelpOverviewEmbed('casino');
  const detailedKey=detailedHelpCommandKeys[commandName],details=detailedKey?gameHelpDetails[detailedKey]:null;
  const usages=commandUsages(command).map(usage=>`\`${usage}\``).join('\n');
  const optionNotes=(command.options||[]).filter(option=>option.type!==1&&option.type!==2).map(option=>`• **${option.name}**｜${option.required?'必填':'選填'}｜${option.description}`).join('\n');
  return new EmbedBuilder().setColor(command.default_member_permissions?0xD94A4A:0x5865F2).setTitle(`📖 /${command.name}`).setDescription(`${command.description}${command.default_member_permissions?'\n\n🛡️ **這是管理員限定指令。**':''}\n\n**使用格式**\n${usages}${optionNotes?`\n\n**參數說明**\n${optionNotes}`:''}${details?`\n\n**詳細玩法**\n${details.body}`:''}\n\n請從下方選單繼續查看其他指令。`);
}
function profileRank(coins) {
  if(coins>=500000) return '👑 賭場傳奇';
  if(coins>=100000) return '💎 金庫大亨';
  if(coins>=50000) return '🏆 豪賭客';
  if(coins>=10000) return '🎲 熟練玩家';
  return '🌱 賭場新秀';
}
const playingCard = c => {
  const rank = rankName[c.rank].padEnd(2, ' '), suit = suitIcon[c.suit];
  return `┌─────────┐\n│ ${rank}      │\n│         │\n│    ${suit}   │\n│         │\n│      ${rank} │\n└─────────┘`;
};
const hiddenCard = () => '┌─────────┐\n│ ░ ░ ░ ░ │\n│ ░ 🂠  ░ │\n│ ░ ░ ░ ░ │\n│ ░  🂠 ░ │\n│ ░ ░ ░ ░ │\n└─────────┘';
function raceTrack(positions, finish = 20) {
  return positions.map((pos, n) => {
    const cells = Array(finish + 1).fill('─');
    cells[Math.min(pos, finish)] = '🐎';
    return `**${n + 1}** ${cells.join('')}🏁`;
  }).join('\n');
}

const integerChoiceOptions=(max,label='數量')=>Array.from({length:max},(_,index)=>({name:`${label} ${index+1}`,value:index+1}));

function petShopSelectRow(userId,selected=null) {
  const options=[
    ...Object.entries(petCatalog).map(([id,pet])=>({label:pet.name,description:`${fmt(pet.price)}｜${pet.bonusText}`,emoji:pet.emoji,value:`pet:${id}`,default:selected===`pet:${id}`})),
    ...Object.entries(petItemCatalog).map(([id,item])=>({label:item.name,description:`${fmt(item.price)}｜心情 +${item.mood}`,emoji:item.emoji,value:`item:${id}`,default:selected===`item:${id}`}))
  ];
  return new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(`pet_shop_select:${userId}`).setPlaceholder('選擇寵物或用品，立即預覽').addOptions(options));
}
function petShopOverviewEmbed() {
  const pets=Object.values(petCatalog).map(p=>`${p.emoji} **${p.name}**｜${fmt(p.price)}\n${p.bonusText}`).join('\n\n');
  const items=Object.values(petItemCatalog).map(item=>`${item.emoji} **${item.name}**｜${fmt(item.price)}｜心情 +${item.mood}`).join('\n');
  return new EmbedBuilder().setColor(0xE8A2C8).setTitle('🐾 迷子寵物店').setDescription(`領養一位陪伴同伴，並在 **/我的寵物** 設定同行。\n\n${pets}\n\n**寵物用品**\n${items}\n\n寵物每天心情 -10；心情低於 20 時增益暫停。所有消費直接銷毀金幣。`);
}
function petProfileEmbed(g,u) {
  const pets=ownedPets(g,u),active=activePet(g,u);
  if(!pets.length) return new EmbedBuilder().setColor(0x9AA0A6).setTitle('🐾 我的寵物').setDescription('你還沒有寵物。使用 **/寵物店** 領養第一位陪伴同伴吧！');
  const inventory=Object.entries(petItemCatalog).map(([id,item])=>`${item.emoji} ${item.name} × ${db.prepare('SELECT quantity FROM pet_inventory WHERE guild_id=? AND user_id=? AND item_id=?').get(g,u,id)?.quantity||0}`).join('\n');
  const lines=pets.map(row=>{const p=petCatalog[row.petId],marker=active?.petId===row.petId?'**同行中**':'收藏'; return `【${marker}】**${petDisplayName(row.petId,row.nickname)}**｜心情 ${row.happiness}/100 ${petMoodBar(row.happiness)}\n${p.bonusText}${row.happiness<20?'（目前暫停）':''}`;}).join('\n\n');
  return new EmbedBuilder().setColor(0xE8A2C8).setTitle('🐾 我的寵物夥伴').setDescription(`${lines}\n\n**用品背包**\n${inventory}`);
}
function petProfilePayload(g,u) {
  const embed=petProfileEmbed(g,u),active=activePet(g,u);
  if(!active) return {embeds:[embed]};
  const path=assetPath(active.pet.image),name=`companion_${active.petId}${extname(path)}`;
  embed.setThumbnail(`attachment://${name}`).setFooter({text:`目前同行：${petDisplayName(active.petId,active.nickname)}`});
  return {embeds:[embed],files:[new AttachmentBuilder(path,{name})]};
}
function petProfileComponents(g,u) {
  const pets=ownedPets(g,u),rows=[];
  if(pets.length) rows.push(new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(`pet_companion:${u}`).setPlaceholder('選擇同行寵物').addOptions(pets.map(row=>({label:petDisplayName(row.petId,row.nickname),value:row.petId})))));
  const items=Object.entries(petItemCatalog).filter(([id])=>(db.prepare('SELECT quantity FROM pet_inventory WHERE guild_id=? AND user_id=? AND item_id=?').get(g,u,id)?.quantity||0)>0);
  if(items.length&&activePet(g,u)) rows.push(new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(`pet_care:${u}`).setPlaceholder('使用用品照顧同行寵物').addOptions(items.map(([id,item])=>({label:item.name,description:`心情 +${item.mood}`,value:id,emoji:item.emoji})))));
  if(activePet(g,u)) rows.push(new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`pet_rename:${u}`).setLabel('替同行寵物命名').setStyle(ButtonStyle.Primary)));
  return rows;
}

const commands = [
  new SlashCommandBuilder().setName('金庫').setDescription('查看自己或其他玩家的金幣').addUserOption(o=>o.setName('玩家').setDescription('預設為自己')),
  new SlashCommandBuilder().setName('個人資料').setDescription('查看類似 Tatsu 的玩家資料卡').addUserOption(o=>o.setName('玩家').setDescription('預設為自己')),
  new SlashCommandBuilder().setName('成就').setDescription('查看自己或其他玩家的成就進度').addUserOption(o=>o.setName('玩家').setDescription('預設為自己')),
  new SlashCommandBuilder().setName('稱號').setDescription('裝備由成就解鎖的個人稱號').addStringOption(o=>o.setName('選擇').setDescription('選擇已解鎖的稱號').setRequired(true).addChoices(
    {name:'🐣 萌禽',value:'cute_bird'},{name:'🐶 萌犬',value:'cute_dog'},{name:'🐕 猛犬',value:'fierce_dog'},{name:'🦅 猛禽',value:'fierce_bird'},{name:'🐈 貓的報恩｜派彩全靠運氣',value:'cat_returns'},{name:'🐕 犬的報恩｜派彩全靠運氣',value:'dog_returns'},{name:'❌ 取消目前稱號',value:'clear'})),
  new SlashCommandBuilder().setName('每日增益').setDescription('查看週一到週日的輪替增益'),
  new SlashCommandBuilder().setName('銀行').setDescription('查詢、借款或償還虛擬金幣')
    .addSubcommand(s=>s.setName('查詢').setDescription('查看金庫、負債與可借額度'))
    .addSubcommand(s=>s.setName('借款').setDescription('向銀行借入虛擬金幣').addIntegerOption(o=>o.setName('金額').setDescription('從建議下拉選擇或輸入借款金額').setRequired(true).setMinValue(1).setMaxValue(LOAN_LIMIT).setAutocomplete(true)))
    .addSubcommand(s=>s.setName('還款').setDescription('償還銀行負債').addIntegerOption(o=>o.setName('金額').setDescription('從建議下拉選擇或輸入還款金額').setRequired(true).setMinValue(1).setMaxValue(LOAN_LIMIT).setAutocomplete(true))),
  new SlashCommandBuilder().setName('體力').setDescription('查看今日剩餘體力'),
  new SlashCommandBuilder().setName('商城').setDescription('查看可購買的食物與飲料'),
  new SlashCommandBuilder().setName('背包').setDescription('查看持有的食物與飲料'),
  new SlashCommandBuilder().setName('寵物店').setDescription('領養陪伴寵物或購買寵物用品'),
  new SlashCommandBuilder().setName('我的寵物').setDescription('查看、切換與照顧自己的寵物夥伴'),
  new SlashCommandBuilder().setName('資產商城').setDescription('查看房地產與載具商品')
    .addStringOption(o=>o.setName('分類').setDescription('篩選資產種類').addChoices(...assetCategories.map(category=>({name:category,value:category}))))
    .addStringOption(o=>o.setName('商品').setDescription('輸入名稱搜尋商品圖片與完整資料').setAutocomplete(true)),
  new SlashCommandBuilder().setName('購買資產').setDescription('使用分類與商品下拉選單購買資產'),
  new SlashCommandBuilder().setName('汽車盲盒').setDescription('選擇綜合車包或福特車包，每盒 10,000 金幣')
    .addStringOption(o=>o.setName('車包').setDescription('選擇要開啟的汽車盲盒').addChoices({name:'綜合車包｜含隱藏車',value:'standard'},{name:'福特車包｜限定 8 台 Ford',value:'ford'}))
    .addIntegerOption(o=>o.setName('數量').setDescription('下拉選擇購買數量，未填寫時預設為 1').setMinValue(1).setMaxValue(10).addChoices(...integerChoiceOptions(10))),
  new SlashCommandBuilder().setName('汽車盲盒內容').setDescription('查看指定車包內的所有車款、圖片、機率與增益')
    .addStringOption(o=>o.setName('車包').setDescription('選擇要查看的車包').addChoices({name:'綜合車包',value:'standard'},{name:'福特車包｜8 台 Ford',value:'ford'})),
  new SlashCommandBuilder().setName('我的資產').setDescription('查看玩家擁有的房地產與載具').addUserOption(o=>o.setName('玩家').setDescription('預設為自己')),
  new SlashCommandBuilder().setName('車庫').setDescription('查看自己的汽車、機車與資產增益')
    .addStringOption(o=>o.setName('展示').setDescription('輸入名稱搜尋車輛').setAutocomplete(true)),
  new SlashCommandBuilder().setName('改裝').setDescription('開啟車庫改裝選單並即時合成預覽')
    .addStringOption(o=>o.setName('車輛').setDescription('可選；未指定時自動開啟已完成素材的車輛').setAutocomplete(true)),
  new SlashCommandBuilder().setName('停機坪').setDescription('查看自己的飛行器與資產增益')
    .addStringOption(o=>o.setName('展示').setDescription('輸入名稱搜尋飛行器').setAutocomplete(true)),
  new SlashCommandBuilder().setName('碼頭').setDescription('查看自己的遊艇、郵輪與資產增益')
    .addStringOption(o=>o.setName('展示').setDescription('輸入名稱搜尋船隻').setAutocomplete(true)),
  new SlashCommandBuilder().setName('資產交易').setDescription('向另一位玩家出售資產')
    .addUserOption(o=>o.setName('買家').setDescription('收到交易邀請的玩家').setRequired(true))
    .addStringOption(o=>o.setName('資產').setDescription('輸入名稱搜尋要出售的資產').setRequired(true).setAutocomplete(true))
    .addIntegerOption(o=>o.setName('數量').setDescription('下拉選擇出售數量').setRequired(true).setMinValue(1).setMaxValue(10).addChoices(...integerChoiceOptions(10)))
    .addIntegerOption(o=>o.setName('價格').setDescription('從建議下拉選擇或輸入整筆交易價格').setRequired(true).setMinValue(1).setMaxValue(100000000).setAutocomplete(true)),
  new SlashCommandBuilder().setName('變賣資產').setDescription('將自己的資產刊登到二手市場')
    .addStringOption(o=>o.setName('資產').setDescription('輸入名稱搜尋要變賣的資產').setRequired(true).setAutocomplete(true))
    .addIntegerOption(o=>o.setName('售價').setDescription('從建議下拉選擇或輸入整筆商品售價').setRequired(true).setMinValue(1).setMaxValue(100000000).setAutocomplete(true))
    .addIntegerOption(o=>o.setName('數量').setDescription('下拉選擇刊登數量，未填寫時預設為 1').setMinValue(1).setMaxValue(10).addChoices(...integerChoiceOptions(10))),
  new SlashCommandBuilder().setName('二手市場').setDescription('查看其他玩家刊登的二手資產')
    .addIntegerOption(o=>o.setName('編號').setDescription('從下拉選擇市場商品').setMinValue(1).setAutocomplete(true)),
  new SlashCommandBuilder().setName('玩法').setDescription('快速查看賭場玩法與常用指令'),
  new SlashCommandBuilder().setName('賭場寶庫').setDescription('查看玩家消費累積的賭場中央寶庫'),
  new SlashCommandBuilder().setName('隊伍').setDescription('建立與管理搶銀行隊伍')
    .addSubcommand(s=>s.setName('建立').setDescription('建立一支新隊伍').addStringOption(o=>o.setName('名稱').setDescription('選填，自訂隊伍名稱').setMinLength(1).setMaxLength(30)))
    .addSubcommand(s=>s.setName('邀請').setDescription('邀請玩家加入隊伍').addUserOption(o=>o.setName('玩家').setDescription('受邀玩家').setRequired(true)))
    .addSubcommand(s=>s.setName('查看').setDescription('查看目前隊伍'))
    .addSubcommand(s=>s.setName('離開').setDescription('離開目前隊伍'))
    .addSubcommand(s=>s.setName('解散').setDescription('隊長解散隊伍')),
  new SlashCommandBuilder().setName('團隊搶銀行').setDescription('隊伍完成準備與逃跑計畫後搶劫銀行')
    .addStringOption(o=>o.setName('銀行').setDescription('選擇目標銀行').setRequired(true).addChoices(
      ...Object.entries(heistBanks).map(([value,bank])=>({name:bank.sundayOnly?`${bank.name}｜成功取得寶庫 80%`:`${bank.name}｜基礎 ${bank.baseChance}%｜獎池 ${bank.reward}`,value}))))
    .addStringOption(o=>o.setName('地圖').setDescription('選擇本次搶劫地圖').setRequired(true).addChoices(
      ...Object.entries(heistMaps).map(([value,map])=>({name:`${map.name}｜成功率 ${map.chance>=0?'+':''}${map.chance}%｜收益 ×${map.rewardMultiplier}`,value})))),
  new SlashCommandBuilder().setName('銀行情報').setDescription('查看今日與明日大量入金銀行'),
  new SlashCommandBuilder().setName('購買').setDescription('從商城購買恢復體力的物品')
    .addStringOption(o=>o.setName('商品').setDescription('選擇商品').setRequired(true).addChoices(
      ...Object.entries(shopItems).map(([value,item])=>({name:`${item.name}｜${item.price} 金幣｜${shopItemEffectLabel(item)}`,value}))))
    .addIntegerOption(o=>o.setName('數量').setDescription('下拉選擇購買數量，未填寫時預設為 1').setMinValue(1).setMaxValue(20).addChoices(...integerChoiceOptions(20))),
  new SlashCommandBuilder().setName('使用').setDescription('使用背包中的食物或飲料')
    .addStringOption(o=>o.setName('商品').setDescription('選擇商品').setRequired(true).addChoices(
      ...Object.entries(shopItems).map(([value,item])=>({name:`${item.name}｜${shopItemEffectLabel(item)}`,value}))))
    .addIntegerOption(o=>o.setName('數量').setDescription('下拉選擇使用數量').setRequired(true).setMinValue(1).setMaxValue(20).addChoices(...integerChoiceOptions(20))),
  new SlashCommandBuilder().setName('每日').setDescription('領取每日獎勵（週日雙倍）'),
  new SlashCommandBuilder().setName('賄絡迷子').setDescription('花費 500 金幣嘗試提早離開小黑屋（45% 被拒絕）'),
  new SlashCommandBuilder().setName('減刑').setDescription('選擇迷子的調教方案以縮短或解除刑期')
    .addStringOption(o=>o.setName('方式').setDescription('選擇減刑方式').setRequired(true).addChoices(
      {name:'⏳ 出賣肉體｜20 體力，剩餘刑期減半',value:'half'},
      {name:'🔓 迷子的肉體調教｜消耗目前所有體力，立即出獄',value:'full'})),
  new SlashCommandBuilder().setName('逃獄').setDescription('每次入獄可嘗試一次逃離迷子小黑屋'),
  new SlashCommandBuilder().setName('小黑屋暴動').setDescription('召集獄友發動暴動，成功後全員獲釋'),
  new SlashCommandBuilder().setName('救援同伴').setDescription('嘗試救出被關在迷子小黑屋的隊友')
    .addUserOption(o=>o.setName('玩家').setDescription('要救援的隊伍同伴').setRequired(true))
    .addStringOption(o=>o.setName('方法').setDescription('選擇救援方式').setRequired(true).addChoices(
      {name:'🥊 正面硬剛（35%）',value:'force'},{name:'💋 色誘迷子（50%）',value:'seduce'},{name:'📸 女僕照交換（必定成功）',value:'photo'})),
  new SlashCommandBuilder().setName('賺錢').setDescription('選擇工作或其他賺錢方式').addStringOption(o=>o.setName('工作').setDescription('選擇賺錢方式').setRequired(true)
    .addChoices(
      {name:'🍽️ 餐廳洗盤子（+100）',value:'dishes'},
      {name:'🛁 幫 Hao 搓背（+500）',value:'hao'},
      {name:'🗑️ 幫迷子倒垃圾（+500）',value:'trash'},
      {name:'🧱 幫 K 老搬磚（+800）',value:'move_bricks'},
      {name:'🧹 幫迷子打掃小黑屋（+600）',value:'clean_jail'},
      {name:'🚕 開計程車（+750）',value:'taxi'},
      {name:'🛵 送外送（+650）',value:'delivery'},
      {name:'📸 幫 Hao 拍女僕寫真（+1,200）',value:'maid_photos'},
      {name:'📦 運輸神秘粉末（非法工作）',value:'mystery_powder'},
      {name:'🏚️ 闖空門（可指定玩家）',value:'burglary'},
      {name:'🏗️ 偷鋼筋去賣（30% 成功；失敗罰款 2,000）',value:'rebar'},
      {name:'⚡ 剪電線去賣（30% 成功；失敗罰款 2,000）',value:'wire'},
      {name:'🏦 搶銀行（5% 成功，失敗關 8 分鐘）',value:'robbery'}))
    .addUserOption(o=>o.setName('目標').setDescription('闖空門時可指定玩家；未指定則直接尋找無人住宅').setRequired(false)),
  new SlashCommandBuilder().setName('比大小').setDescription('與莊家各抽一張牌').addIntegerOption(o=>o.setName('下注').setDescription('自行輸入下注金額').setRequired(true).setMinValue(MIN_BET).setMaxValue(MAX_BET)),
  new SlashCommandBuilder().setName('射龍門').setDescription('兩張門牌之間即獲勝').addIntegerOption(o=>o.setName('下注').setDescription('自行輸入下注金額').setRequired(true).setMinValue(MIN_BET).setMaxValue(MAX_BET)),
  new SlashCommandBuilder().setName('賽馬').setDescription('從四匹馬選一匹下注').addIntegerOption(o=>o.setName('下注').setDescription('自行輸入下注金額').setRequired(true).setMinValue(MIN_BET).setMaxValue(MAX_BET)).addIntegerOption(o=>o.setName('馬匹').setDescription('下拉選擇 1～4 號馬').setRequired(true).setMinValue(1).setMaxValue(4).addChoices(...integerChoiceOptions(4,'馬匹'))),
  new SlashCommandBuilder().setName('競速').setDescription('使用自己的汽車或機車參加動態競速').addIntegerOption(o=>o.setName('下注').setDescription('自行輸入下注金額').setRequired(true).setMinValue(MIN_BET).setMaxValue(MAX_BET)),
  new SlashCommandBuilder().setName('寵物競賽').setDescription('派出自己的寵物參加動態障礙賽').addIntegerOption(o=>o.setName('下注').setDescription('自行輸入下注金額').setRequired(true).setMinValue(MIN_BET).setMaxValue(MAX_BET)),
  new SlashCommandBuilder().setName('競速pvp').setDescription('指定玩家，以自己的車輛進行零和競速對決').addUserOption(o=>o.setName('對手').setDescription('指定挑戰對手').setRequired(true)).addIntegerOption(o=>o.setName('下注').setDescription('雙方各自支付的下注金額').setRequired(true).setMinValue(MIN_BET).setMaxValue(MAX_BET)),
  new SlashCommandBuilder().setName('寵物競速pvp').setDescription('指定玩家，派出寵物進行零和障礙賽對決').addUserOption(o=>o.setName('對手').setDescription('指定挑戰對手').setRequired(true)).addIntegerOption(o=>o.setName('下注').setDescription('雙方各自支付的下注金額').setRequired(true).setMinValue(MIN_BET).setMaxValue(MAX_BET)),
  new SlashCommandBuilder().setName('大老二').setDescription('單人挑戰：從 13 張牌選出最大的五張牌型').addIntegerOption(o=>o.setName('下注').setDescription('自行輸入下注金額').setRequired(true).setMinValue(MIN_BET).setMaxValue(MAX_BET)),
  new SlashCommandBuilder().setName('角子機').setDescription('轉動三軸角子機').addIntegerOption(o=>o.setName('下注').setDescription('自行輸入下注金額').setRequired(true).setMinValue(MIN_BET).setMaxValue(MAX_BET)),
  new SlashCommandBuilder().setName('幸運輪盤').setDescription('每日 3 次免費抽現金或本週隱藏車輛'),
  new SlashCommandBuilder().setName('大樂透').setDescription('選一個幸運號碼並對獎').addIntegerOption(o=>o.setName('下注').setDescription('自行輸入下注金額').setRequired(true).setMinValue(MIN_BET).setMaxValue(MAX_BET)).addIntegerOption(o=>o.setName('幸運號碼').setDescription('從可搜尋下拉選擇 1～49').setRequired(true).setMinValue(1).setMaxValue(49).setAutocomplete(true)),
  new SlashCommandBuilder().setName('賓果').setDescription('自選九宮格號碼並進行開獎').addIntegerOption(o=>o.setName('下注').setDescription('自行輸入下注金額').setRequired(true).setMinValue(MIN_BET).setMaxValue(MAX_BET)).addStringOption(o=>o.setName('號碼').setDescription('輸入 9 個數字，以空格、英文逗號或中文逗號分隔').setRequired(true).setMinLength(17).setMaxLength(40)),
  new SlashCommandBuilder().setName('刮刮樂').setDescription('刮開三個圖案試手氣').addIntegerOption(o=>o.setName('下注').setDescription('自行輸入下注金額').setRequired(true).setMinValue(MIN_BET).setMaxValue(MAX_BET)),
  new SlashCommandBuilder().setName('麻將').setDescription('遊玩單人或 2～4 人簡化麻將')
    .addStringOption(o=>o.setName('模式').setDescription('選擇模式').setRequired(true).addChoices({name:'🤖 單人對戰三名電腦',value:'solo'},{name:'👥 多人牌桌',value:'multi'}))
    .addIntegerOption(o=>o.setName('下注').setDescription('自行輸入每位玩家的下注金額').setRequired(true).setMinValue(MIN_BET).setMaxValue(MAX_BET)),
  new SlashCommandBuilder().setName('決鬥').setDescription('向另一位玩家發起卡通 PvP 輪盤決鬥')
    .addUserOption(o=>o.setName('對手').setDescription('指定決鬥對手').setRequired(true))
    .addIntegerOption(o=>o.setName('下注').setDescription('自行輸入雙方各自支付的金額').setRequired(true).setMinValue(MIN_BET).setMaxValue(MAX_BET)),
  new SlashCommandBuilder().setName('稱號設定').setDescription('管理員設定玩家資料卡稱號').setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption(o=>o.setName('玩家').setDescription('目標玩家').setRequired(true))
    .addStringOption(o=>o.setName('稱號').setDescription('指定特殊稱號').setRequired(true).addChoices(
      ...Object.entries(profileTitles).map(([value,name])=>({name,value})),{name:'❌ 清除特殊稱號',value:'clear'})),
  new SlashCommandBuilder().setName('搶劫公告頻道').setDescription('管理員設定搶劫成功與週日寶庫情報頻道').setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption(o=>o.setName('頻道').setDescription('單人或團隊搶劫成功時發布公告的頻道').setRequired(true).addChannelTypes(ChannelType.GuildText,ChannelType.GuildAnnouncement)),
  new SlashCommandBuilder().setName('單人搶劫機率').setDescription('管理員設定單人搶銀行的基礎成功率').setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addIntegerOption(o=>o.setName('機率').setDescription('設定 1～100 的基礎成功百分比').setRequired(true).setMinValue(1).setMaxValue(100)),
  new SlashCommandBuilder().setName('資產調整').setDescription('管理員給予或刪除玩家資產').setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption(o=>o.setName('玩家').setDescription('目標玩家').setRequired(true))
    .addStringOption(o=>o.setName('操作').setDescription('給予或刪除資產').setRequired(true).addChoices(
      {name:'➕ 給予資產',value:'grant'},{name:'➖ 刪除資產',value:'remove'}))
    .addStringOption(o=>o.setName('資產').setDescription('輸入名稱搜尋資產').setRequired(true).setAutocomplete(true))
    .addIntegerOption(o=>o.setName('數量').setDescription('從建議下拉選擇或輸入調整數量').setRequired(true).setMinValue(1).setMaxValue(100).setAutocomplete(true))
    .addStringOption(o=>o.setName('原因').setDescription('管理紀錄原因').setRequired(true).setMaxLength(200)),
  new SlashCommandBuilder().setName('金幣調整').setDescription('管理員增加或扣除玩家金幣').setDefaultMemberPermissions(PermissionFlagsBits.Administrator).addUserOption(o=>o.setName('玩家').setDescription('目標玩家').setRequired(true)).addIntegerOption(o=>o.setName('數量').setDescription('從建議下拉選擇或輸入正負數量').setRequired(true).setAutocomplete(true)).addStringOption(o=>o.setName('原因').setDescription('帳務紀錄原因').setRequired(true)),
  new SlashCommandBuilder().setName('帳務紀錄').setDescription('管理員查看玩家最近帳務').setDefaultMemberPermissions(PermissionFlagsBits.Administrator).addUserOption(o=>o.setName('玩家').setDescription('目標玩家').setRequired(true)),
  new SlashCommandBuilder().setName('經濟監控').setDescription('管理員查看金幣供給、銷毀、負債與集中度').setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
].map(c=>c.toJSON());

const rest = new REST({version:'10'}).setToken(TOKEN);
await rest.put(GUILD_ID ? Routes.applicationGuildCommands(CLIENT_ID,GUILD_ID) : Routes.applicationCommands(CLIENT_ID), {body:commands});
const client = new Client({intents:[GatewayIntentBits.Guilds]});
async function announceHeistSuccess(guildId,embed) {
  const setting=db.prepare('SELECT channel_id FROM heist_announcement_channels WHERE guild_id=?').get(guildId);
  if(!setting) return false;
  try {
    const channel=await client.channels.fetch(setting.channel_id);
    if(!channel?.isTextBased() || typeof channel.send!=='function') throw new Error('設定的頻道不是可發送訊息的文字頻道');
    const message=await channel.send({embeds:[embed.setTimestamp().setFooter({text:'搶劫成功自動公告'})]});
    if(channel.type===ChannelType.GuildAnnouncement) {
      try { await message.crosspost(); }
      catch(e) { console.error(`搶劫公告發布失敗 guild=${guildId}: ${e.message}`); }
    }
    return true;
  } catch(e) {
    console.error(`搶劫成功公告傳送失敗 guild=${guildId} channel=${setting.channel_id}: ${e.message}`);
    return false;
  }
}
client.on('error',error=>console.error('Discord client error:',error));
process.on('unhandledRejection',error=>console.error('Unhandled promise rejection:',error));
const daily = new Map();

client.on('interactionCreate', async i => {
  if(i.isAutocomplete()) {
    const focused=i.options.getFocused(true),query=String(focused.value||'').trim().toLowerCase();
    if(i.commandName==='二手市場'&&focused.name==='編號') {
      if(!i.guildId) return i.respond([]);
      const listings=db.prepare("SELECT id,asset_id,quantity,price FROM asset_market_listings WHERE guild_id=? AND status='active' ORDER BY id DESC LIMIT 25").all(i.guildId);
      return i.respond(listings
        .filter(row=>!query||String(row.id).includes(query)||(assetCatalog[row.asset_id]?.name||'').toLowerCase().includes(query))
        .slice(0,25)
        .map(row=>({name:`#${row.id}｜${assetCatalog[row.asset_id]?.name||row.asset_id} ×${row.quantity}｜${Number(row.price).toLocaleString('zh-TW')}`.slice(0,100),value:Number(row.id)})));
    }
    const numericFields=['金額','價格','售價','數量','幸運號碼'];
    if(numericFields.includes(focused.name)) {
      let values=[];
      if(focused.name==='幸運號碼') values=Array.from({length:49},(_,index)=>index+1);
      else if(focused.name==='金額') values=[1000,5000,10000,25000,50000,100000,250000,500000].filter(value=>value<=LOAN_LIMIT);
      else if(['價格','售價'].includes(focused.name)) values=[1000,5000,10000,25000,50000,100000,250000,500000,1000000,5000000,10000000];
      else if(i.commandName==='金幣調整') values=[-100000,-50000,-10000,-5000,-1000,1000,5000,10000,50000,100000];
      else values=[1,2,5,10,20,50,100];
      return i.respond([...new Set(values)]
        .filter(value=>!query||String(value).includes(query))
        .slice(0,25)
        .map(value=>({name:`${value<0?'扣除':'選擇'} ${Math.abs(value).toLocaleString('zh-TW')}`,value})));
    }
    if(!['資產商城','購買資產','資產交易','變賣資產','車庫','改裝','停機坪','碼頭','資產調整'].includes(i.commandName)) return i.respond([]);
    let entries=Object.entries(assetCatalog);
    if(i.commandName==='資產商城') {
      const category=i.options.getString('分類');
      if(category) entries=entries.filter(([,asset])=>asset.category===category);
    }
    if(['資產商城','購買資產'].includes(i.commandName)) entries=entries.filter(([,asset])=>asset.forSale!==false);
    if(['資產交易','變賣資產'].includes(i.commandName)&&i.guildId) {
      const owned=new Set(assetsOf(i.guildId,i.user.id).map(row=>row.asset_id));
      entries=entries.filter(([assetId])=>owned.has(assetId));
    }
    if(i.commandName==='資產調整'&&i.guildId&&i.options.getString('操作')==='remove') {
      const target=i.options.getUser('玩家');
      if(target) {
        const owned=new Set(assetsOf(i.guildId,target.id).map(row=>row.asset_id));
        entries=entries.filter(([assetId])=>owned.has(assetId));
      }
    }
    if(['車庫','改裝','停機坪','碼頭'].includes(i.commandName)&&i.guildId) {
      const categories=['車庫','改裝'].includes(i.commandName)?['汽車','機車']:i.commandName==='停機坪'?['飛行器']:['郵輪'];
      const owned=new Set(assetsOf(i.guildId,i.user.id).map(row=>row.asset_id));
      entries=entries.filter(([assetId,asset])=>owned.has(assetId)&&categories.includes(asset.category));
      if(i.commandName==='改裝') entries=entries.filter(([assetId])=>vehicleHasVisualMods(assetId));
    }
    const choices=entries.filter(([assetId,asset])=>!query||assetId.includes(query)||asset.name.toLowerCase().includes(query))
      .slice(0,25).map(([value,asset])=>({name:`${asset.name}｜${fmt(asset.price)} 金幣`,value}));
    return i.respond(choices);
  }
  if(i.isStringSelectMenu() && i.customId==='game_help_category') {
    const categoryKey=i.values[0] in commandHelpCategories?i.values[0]:'casino';
    return i.update({embeds:[commandHelpOverviewEmbed(categoryKey)],components:commandHelpComponents(categoryKey),attachments:[]});
  }
  if(i.isStringSelectMenu() && i.customId.startsWith('game_help_command:')) {
    const categoryKey=i.customId.split(':')[1] in commandHelpCategories?i.customId.split(':')[1]:'casino';
    const commandName=i.values[0];
    return i.update({embeds:[commandHelpCommandEmbed(commandName)],components:commandHelpComponents(categoryKey,commandName),attachments:[]});
  }
  // Keep previously posted /玩法 messages working after the menu upgrade.
  if(i.isStringSelectMenu() && i.customId==='game_help_select') {
    return i.update({embeds:[commandHelpOverviewEmbed('casino')],components:commandHelpComponents('casino'),attachments:[]});
  }
  if(i.isButton()&&i.customId.startsWith('vehicle_mod_open:')&&i.guildId) {
    const [,ownerId,assetId]=i.customId.split(':');
    if(i.user.id!==ownerId) return i.reply({content:'⚠️ 只有車主可以改裝這輛車。',ephemeral:true});
    const asset=assetCatalog[assetId],owned=db.prepare('SELECT quantity FROM player_assets WHERE guild_id=? AND user_id=? AND asset_id=?').get(i.guildId,ownerId,assetId)?.quantity||0;
    if(!owned||!asset||!modifiableVehicleCategories.has(asset.category)) return i.reply({content:'⚠️ 這輛車已不在你的車庫，或不支援改裝。',ephemeral:true});
    const token=Math.random().toString(36).slice(2,10),session={guildId:i.guildId,userId:ownerId,assetId,category:null,pending:null};
    vehicleModSessions.set(token,session); setTimeout(()=>vehicleModSessions.delete(token),10*60*1000);
    await i.deferUpdate();
    return i.editReply({...await vehicleModPayload(i.guildId,ownerId,assetId),components:vehicleModComponents(token,session),attachments:[]});
  }
  if(i.isStringSelectMenu()&&i.customId.startsWith('vehicle_mod_vehicle:')&&i.guildId) {
    const token=i.customId.split(':')[1],session=vehicleModSessions.get(token);
    if(!session||session.guildId!==i.guildId) return i.reply({content:'⚠️ 這次改裝工作階段已失效，請重新使用 `/改裝`。',ephemeral:true});
    if(i.user.id!==session.userId) return i.reply({content:'⚠️ 只有開啟改裝的車主可以操作。',ephemeral:true});
    const assetId=i.values[0],asset=assetCatalog[assetId];
    const owned=assetsOf(i.guildId,session.userId).some(row=>row.asset_id===assetId);
    if(!owned||!asset||!modifiableVehicleCategories.has(asset.category)||!vehicleHasVisualMods(assetId)) return i.reply({content:'⚠️ 這輛車不在你的車庫，或尚未完成圖片改裝素材。',ephemeral:true});
    session.assetId=assetId;
    session.category=null;
    session.pending=null;
    await i.deferUpdate();
    return i.editReply({...await vehicleModPayload(i.guildId,session.userId,assetId),components:vehicleModComponents(token,session),attachments:[]});
  }
  if(i.isStringSelectMenu()&&i.customId.startsWith('vehicle_mod_category:')&&i.guildId) {
    const token=i.customId.split(':')[1],session=vehicleModSessions.get(token);
    if(!session||session.guildId!==i.guildId) return i.reply({content:'⚠️ 這次改裝工作階段已失效，請重新使用 `/改裝`。',ephemeral:true});
    if(i.user.id!==session.userId) return i.reply({content:'⚠️ 只有開啟改裝的車主可以操作。',ephemeral:true});
    const category=i.values[0];
    if(!vehicleModCatalog[category]) return i.reply({content:'⚠️ 找不到這個改裝分類。',ephemeral:true});
    session.category=category;
    session.pending=null;
    await i.deferUpdate();
    return i.editReply({...await vehicleModPayload(i.guildId,session.userId,session.assetId),components:vehicleModComponents(token,session),attachments:[]});
  }
  if(i.isStringSelectMenu()&&i.customId.startsWith('vehicle_mod_option:')&&i.guildId) {
    const [,token,category]=i.customId.split(':'),session=vehicleModSessions.get(token);
    if(!session||session.guildId!==i.guildId) return i.reply({content:'⚠️ 這次改裝工作階段已失效，請重新使用 `/改裝`。',ephemeral:true});
    if(i.user.id!==session.userId) return i.reply({content:'⚠️ 只有開啟改裝的車主可以操作。',ephemeral:true});
    if(category!==session.category) return i.reply({content:'⚠️ 改裝分類已變更，請重新選擇零件。',ephemeral:true});
    const optionId=i.values[0],definition=vehicleModCatalog[category],option=vehicleModOption(category,optionId);
    if(!definition||!option) return i.reply({content:'⚠️ 找不到這個改裝零件。',ephemeral:true});
    const currentId=vehicleMods(i.guildId,session.userId,session.assetId)[definition.column];
    if(currentId===optionId) return i.reply({content:'⚠️ 這項改裝目前已經裝備中。',ephemeral:true});
    const previewSelections=vehicleModSelections(i.guildId,session.userId,session.assetId,{category,optionId});
    if(vehicleExteriorModCategories.has(category)&&!vehicleVisualConfigSupported(session.assetId,previewSelections)) return i.reply({content:'⚠️ 這個外觀組合尚未完成圖片素材，無法產生預覽。',ephemeral:true});
    const price=vehicleModCost(i.guildId,session.userId,session.assetId,category,optionId);
    session.pending={category,optionId,price};
    await i.deferUpdate();
    const notice=`👁️ 預覽：**${vehicleModOptionName(session.assetId,category,optionId)}**｜確認價格 **${fmt(price)}**。\n目前尚未扣款、尚未保存；滿意後請按「確認預覽並安裝」。`;
    return i.editReply({...await vehicleModPayload(i.guildId,session.userId,session.assetId,notice,session.pending),components:vehicleModComponents(token,session),attachments:[]});
  }
  if(i.isButton()&&i.customId.startsWith('vehicle_mod_confirm:')&&i.guildId) {
    const token=i.customId.split(':')[1],session=vehicleModSessions.get(token);
    if(!session||session.guildId!==i.guildId) return i.reply({content:'⚠️ 這次改裝工作階段已失效，請重新使用 `/改裝`。',ephemeral:true});
    if(i.user.id!==session.userId) return i.reply({content:'⚠️ 只有開啟改裝的車主可以操作。',ephemeral:true});
    if(!session.pending) return i.reply({content:'⚠️ 目前沒有待確認的改裝。',ephemeral:true});
    const {category,optionId}=session.pending;
    let result;
    try { result=purchaseVehicleMod(i.guildId,session.userId,session.assetId,category,optionId); }
    catch(error) { return i.reply({content:`⚠️ ${error.message}`,ephemeral:true}); }
    session.pending=null;
    await i.deferUpdate();
    const notice=`✅ 已安裝 **${vehicleModOptionName(session.assetId,category,optionId)}**，支付 **${fmt(result.price)}**。`;
    return i.editReply({...await vehicleModPayload(i.guildId,session.userId,session.assetId,notice),components:vehicleModComponents(token,session),attachments:[]});
  }
  if(i.isButton()&&i.customId.startsWith('vehicle_mod_cancel:')&&i.guildId) {
    const token=i.customId.split(':')[1],session=vehicleModSessions.get(token);
    if(!session||session.guildId!==i.guildId) return i.reply({content:'⚠️ 這次改裝工作階段已失效，請重新使用 `/改裝`。',ephemeral:true});
    if(i.user.id!==session.userId) return i.reply({content:'⚠️ 只有開啟改裝的車主可以操作。',ephemeral:true});
    if(!session.pending) return i.reply({content:'⚠️ 目前沒有待取消的改裝。',ephemeral:true});
    const option=vehicleModOption(session.pending.category,session.pending.optionId);
    session.pending=null;
    await i.deferUpdate();
    const notice=`↩️ 已取消 **${option?.name||'這項改裝'}**，沒有扣除金幣。`;
    return i.editReply({...await vehicleModPayload(i.guildId,session.userId,session.assetId,notice),components:vehicleModComponents(token,session),attachments:[]});
  }
  if(i.isButton()&&i.customId.startsWith('vehicle_mod_done:')&&i.guildId) {
    const token=i.customId.split(':')[1],session=vehicleModSessions.get(token);
    if(!session||session.guildId!==i.guildId) return i.reply({content:'⚠️ 這次改裝工作階段已失效。',ephemeral:true});
    if(i.user.id!==session.userId) return i.reply({content:'⚠️ 只有車主可以完成改裝。',ephemeral:true});
    if(session.pending) return i.reply({content:'⚠️ 請先確認或取消待安裝零件。',ephemeral:true});
    vehicleModSessions.delete(token);
    return i.update({components:[]});
  }
  if(i.isStringSelectMenu() && i.customId.startsWith('car_blindbox_catalog:')) {
    const packId=i.customId.split(':')[1]||'standard',pack=blindBoxPacks[packId],assetId=i.values[0],asset=assetCatalog[assetId];
    if(!pack||!pack.ids.includes(assetId)||!asset?.blindBox) return i.reply({content:'⚠️ 找不到這輛盲盒車款。',ephemeral:true});
    const hidden=packId==='standard'&&blindBoxHiddenIds.includes(assetId),chance=blindBoxChanceLabel(assetId,packId);
    const embed=new EmbedBuilder().setColor(hidden?0xFFD700:0x5865F2).setTitle(asset.name).setDescription(`稀有度：**${asset.rarity}**\n取得機率：**${chance}**\n參考價值：**${fmt(asset.price)}**\n資產增益：**${assetBuffLabel(assetId,asset.buff)}**\n${assetBuffDescription(assetId,asset.buff)}\n\n${asset.description}`);
    return i.update({...assetMediaPayload(embed,assetId,asset),components:[carBlindBoxCatalogRow(packId,assetId)],attachments:[]});
  }
  if(i.isStringSelectMenu() && i.customId.startsWith('asset_shop_category:') && i.guildId) {
    const token=i.customId.split(':')[1],session=assetShopSessions.get(token),categoryKey=i.values[0];
    if(!session||session.guildId!==i.guildId) return i.reply({content:'⚠️ 這次資產商城瀏覽已失效，請重新使用 `/購買資產`。',ephemeral:true});
    if(session.userId!==i.user.id) return i.reply({content:'⚠️ 只有開啟商城的玩家可以操作這組選單。',ephemeral:true});
    if(!assetShopCategories[categoryKey]) return i.reply({content:'⚠️ 找不到這個資產分類。',ephemeral:true});
    session.categoryKey=categoryKey;
    session.page=0;
    session.assetId=null;
    return i.update({embeds:[assetShopOverviewEmbed(categoryKey,0)],components:assetShopComponents(token,categoryKey,0),attachments:[]});
  }
  if(i.isButton() && i.customId.startsWith('asset_shop_page:') && i.guildId) {
    const [,token,categoryKey,pageText]=i.customId.split(':'),session=assetShopSessions.get(token);
    if(!session||session.guildId!==i.guildId) return i.reply({content:'⚠️ 這次資產商城瀏覽已失效，請重新使用 `/購買資產`。',ephemeral:true});
    if(session.userId!==i.user.id) return i.reply({content:'⚠️ 只有開啟商城的玩家可以操作這組按鈕。',ephemeral:true});
    if(!assetShopCategories[categoryKey]) return i.reply({content:'⚠️ 找不到這個資產分類。',ephemeral:true});
    const info=assetShopPageInfo(categoryKey,Number(pageText));
    session.categoryKey=categoryKey;
    session.page=info.page;
    session.assetId=null;
    return i.update({embeds:[assetShopOverviewEmbed(categoryKey,info.page)],components:assetShopComponents(token,categoryKey,info.page),attachments:[]});
  }
  if(i.isStringSelectMenu() && i.customId.startsWith('asset_shop_product:') && i.guildId) {
    const [,token,pageText]=i.customId.split(':'),session=assetShopSessions.get(token),assetId=i.values[0],asset=assetCatalog[assetId];
    if(!session||session.guildId!==i.guildId) return i.reply({content:'⚠️ 這次資產商城瀏覽已失效，請重新使用 `/購買資產`。',ephemeral:true});
    if(session.userId!==i.user.id) return i.reply({content:'⚠️ 只有開啟商城的玩家可以選擇商品。',ephemeral:true});
    const categoryKey=session.categoryKey,page=assetShopPageInfo(session.categoryKey,Number(pageText)).page;
    if(!asset||asset.forSale===false||!assetShopEntries(categoryKey).some(([id])=>id===assetId)) return i.reply({content:'⚠️ 這項資產目前無法在此分類購買。',ephemeral:true});
    session.page=page;
    session.assetId=assetId;
    const purchaseToken=Math.random().toString(36).slice(2,10);
    if(assetId==='daily_rental_suite') {
      assetPurchaseOffers.set(purchaseToken,{guildId:i.guildId,userId:i.user.id,rootAssetId:assetId,assetId,quantity:1,variantId:null,processing:false});
      setTimeout(()=>assetPurchaseOffers.delete(purchaseToken),5*60*1000);
      const options=Object.values(rentalSuiteVariants).map(variant=>`• **${variant.name}**｜${variant.description}`).join('\n');
      const embed=new EmbedBuilder().setColor(0x5865F2).setTitle('🔑 選擇 24 小時日租套房').setDescription(`${options}\n\n請使用房型下拉選單選擇；房型圖片會立即顯示，確認後才會扣款。`);
      return i.update({...assetMediaPayload(embed,assetId,asset),components:[assetShopCategoryRow(token,categoryKey),rentalSuiteSelectRow(purchaseToken)],attachments:[]});
    }
    assetPurchaseOffers.set(purchaseToken,{guildId:i.guildId,userId:i.user.id,assetId,quantity:1,processing:false});
    setTimeout(()=>assetPurchaseOffers.delete(purchaseToken),5*60*1000);
    const owned=db.prepare('SELECT quantity FROM player_assets WHERE guild_id=? AND user_id=? AND asset_id=?').get(i.guildId,i.user.id,assetId)?.quantity||0;
    const buffId=owned?ensureAssetBuff(i.guildId,i.user.id,assetId):asset.buff||null;
    const buffPreview=buffId?`**${assetBuffLabel(assetId,buffId)}**\n${assetBuffDescription(assetId,buffId)}`:'購買完成後隨機抽取一項永久增益。';
    const hasImage=Boolean(asset.image||asset.images?.length);
    const embed=new EmbedBuilder().setColor(0xF5B942).setTitle(`🔑 ${asset.name}`).setDescription(`分類：**${assetShopCategoryLabel(categoryKey)}**\n稀有度：**${asset.rarity||'一般'}**\n單價：**${fmt(asset.price)}**\n數量：**1**\n總價：**${fmt(asset.price)}**\n目前金庫：**${fmt(balance(i.guildId,i.user.id))}**\n\n${asset.description}\n\n🎲 資產增益\n${buffPreview}\n\n${hasImage?'圖片已即時顯示於下方。':'🖼️ 此資產尚未配置圖片素材。'}確認後才會扣款；本次確認於 **5 分鐘**後失效。`);
    return i.update({...assetMediaPayload(embed,assetId,asset),components:assetShopComponents(token,categoryKey,page,assetId,purchaseToken),attachments:[]});
  }
  if(i.isStringSelectMenu() && i.customId.startsWith('rental_suite_select:') && i.guildId) {
    const token=i.customId.split(':')[1],offer=assetPurchaseOffers.get(token);
    if(!offer||offer.guildId!==i.guildId||offer.rootAssetId!=='daily_rental_suite') return i.reply({content:'⚠️ 這次日租套房選擇已失效，請重新使用 `/購買資產`。',ephemeral:true});
    if(i.user.id!==offer.userId) return i.reply({content:'⚠️ 只有發起租用的玩家可以選擇房型。',ephemeral:true});
    const variantId=i.values[0],variant=rentalSuiteVariants[variantId];
    if(!variant) return i.reply({content:'⚠️ 找不到這個日租套房房型。',ephemeral:true});
    const asset=assetCatalog[variant.assetId];
    offer.assetId=variant.assetId;
    offer.variantId=variantId;
    const buffId=asset.buff,total=asset.price;
    const buffPreview=asset.randomRentalBuffs
      ? `**🎲 入住後隨機決定（租用期間）**\n可能獲得大量增益，也可能遭受嚴重減益；抽出的效果會固定 **${asset.temporaryHours} 小時**，期間無法免費重抽。`
      : `**${assetBuffLabel(variant.assetId,buffId)}（租用期間）**\n${assetBuffDescription(variant.assetId,buffId)}\n\n⏳ 租期：**${asset.temporaryHours} 小時**，到期自動失效。`;
    const row=new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`asset_purchase_confirm:${token}`).setLabel('確認租用').setEmoji('✅').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`asset_purchase_cancel:${token}`).setLabel('取消').setEmoji('❌').setStyle(ButtonStyle.Danger)
    );
    const embed=new EmbedBuilder().setColor(0xF5B942).setTitle(`🔑 ${variant.name}｜租用確認`).setDescription(`${variant.description}\n\n分類：**${asset.category}**\n稀有度：**${asset.rarity}**\n租金：**${fmt(asset.price)}**\n總價：**${fmt(total)}**\n目前金庫：**${fmt(balance(i.guildId,i.user.id))}**\n\n🎲 資產增益\n${buffPreview}\n\n請先查看下方房型圖片，再決定是否租用。確認後才會扣款；本次確認於 **5 分鐘**後失效。`);
    const previewAsset={...asset,name:variant.name,images:undefined,image:variant.image};
    return i.update({...assetMediaPayload(embed,`${variant.assetId}_${variantId}`,previewAsset),components:[row],attachments:[]});
  }
  if(i.isButton() && i.customId.startsWith('asset_purchase_') && i.guildId) {
    const [action,token]=i.customId.split(':'),offer=assetPurchaseOffers.get(token);
    if(!offer||offer.guildId!==i.guildId) return i.reply({content:'⚠️ 這次資產購買確認已失效，請重新使用 `/購買資產`。',ephemeral:true});
    if(i.user.id!==offer.userId) return i.reply({content:'⚠️ 只有發起購買的玩家可以操作這組按鈕。',ephemeral:true});
    const asset=assetCatalog[offer.assetId],variant=offer.variantId?rentalSuiteVariants[offer.variantId]:null;
    const displayName=variant?`${asset.name}｜${variant.name}`:asset.name;
    if(action==='asset_purchase_cancel') {
      assetPurchaseOffers.delete(token);
      return i.update({embeds:[new EmbedBuilder().setColor(0x607D8B).setTitle('❌ 已取消資產購買').setDescription(`${displayName} × **${offer.quantity}**\n沒有扣除任何金幣，也沒有新增資產。`)],components:[],attachments:[]});
    }
    if(offer.processing) return i.reply({content:'⏳ 這筆購買正在處理中。',ephemeral:true});
    offer.processing=true;
    try {
      const result=buyAsset(i.guildId,i.user.id,offer.assetId,offer.quantity),buff=assetBuffs[result.buffId];
      assetPurchaseOffers.delete(token);
      const ownership=result.temporary
        ? `🎲 本次入住效果：**${assetBuffLabel(offer.assetId,result.buffId)}**\n${assetBuffDescription(offer.assetId,result.buffId)}\n\n⏳ 使用期限：<t:${Math.floor(result.expiresAt/1000)}:F>（<t:${Math.floor(result.expiresAt/1000)}:R>）\n此為 **24 小時租用**，到期後自動失效，不會成為永久房產。`
        : `🎲 永久增益：**${assetBuffLabel(offer.assetId,result.buffId)}**\n${assetBuffDescription(offer.assetId,result.buffId)}\n\n資產已登記在你的名下。`;
      const embed=new EmbedBuilder().setColor(0x35C46A).setTitle(result.temporary?'🔑 房產租用完成':'🔑 資產購買完成').setDescription(`${displayName} × **${offer.quantity}**\n分類：${asset.category}\n稀有度：${asset.rarity||'一般'}\n支付：**${fmt(result.total)}**\n金庫：${fmt(result.next)}\n\n${ownership}\n\n⏳ 此訊息將在 **1 分鐘後**自動刪除。`);
      await i.update({embeds:[embed],components:[],attachments:[],files:[]});
      setTimeout(()=>i.message.delete().catch(()=>{}),60*1000);
      return;
    } catch(error) {
      offer.processing=false;
      return i.reply({content:`⚠️ 購買失敗：${error.message}`,ephemeral:true});
    }
  }
  if(i.isButton() && i.customId.startsWith('asset_trade_') && i.guildId) {
    const [action,token]=i.customId.split(':'),offer=assetTradeOffers.get(token);
    if(!offer||offer.guildId!==i.guildId) return i.reply({content:'⚠️ 這筆資產交易已經失效。',ephemeral:true});
    if(action==='asset_trade_decline') {
      if(i.user.id!==offer.buyerId&&i.user.id!==offer.sellerId) return i.reply({content:'⚠️ 你不是這筆交易的參與者。',ephemeral:true});
      assetTradeOffers.delete(token);
      await i.deferUpdate();
      return i.message.delete().catch(()=>{});
    }
    if(i.user.id!==offer.buyerId) return i.reply({content:'⚠️ 只有指定買家能接受交易。',ephemeral:true});
    try {
      completeAssetTrade(i.guildId,offer.sellerId,offer.buyerId,offer.assetId,offer.quantity,offer.price);
      assetTradeOffers.delete(token);
      return i.update({embeds:[new EmbedBuilder().setColor(0x35C46A).setTitle('🤝 資產交易完成').setDescription(`買家：<@${offer.buyerId}>\n賣家：<@${offer.sellerId}>\n資產：**${assetCatalog[offer.assetId].name} × ${offer.quantity}**\n成交價格：**${fmt(offer.price)}**\n\n金幣與資產已同步轉移。`)],components:[]});
    } catch(e) {
      assetTradeOffers.delete(token);
      return i.update({embeds:[new EmbedBuilder().setColor(0xD94A4A).setTitle('⚠️ 資產交易失敗').setDescription(e.message)],components:[]});
    }
  }
  if(i.isButton() && i.customId.startsWith('asset_market:') && i.guildId) {
    const [, ,action,idText]=i.customId.split(':'),listingId=Number(idText);
    if(action==='cancel') {
      try {
        cancelMarketListing(i.guildId,i.user.id,listingId);
        await i.deferUpdate();
        return i.message.delete().catch(()=>{});
      } catch(e) { return i.reply({content:`⚠️ ${e.message}`,ephemeral:true}); }
    }
    if(action==='buy') {
      try {
        const listing=buyMarketListing(i.guildId,i.user.id,listingId),asset=assetCatalog[listing.asset_id];
        await i.update({embeds:[new EmbedBuilder().setColor(0x35C46A).setTitle('🛍️ 二手資產購買完成').setDescription(`買家：${i.user}\n賣家：<@${listing.seller_id}>\n資產：**${asset.name} × ${listing.quantity}**\n支付：**${fmt(listing.price)}**\n剩餘金幣：**${fmt(listing.buyerBalanceAfter)}**\n\n商品已從二手市場下架並登記到你的資產。\n⏳ 此訊息將在 **1 分鐘後**自動刪除。`)],components:[],attachments:[],files:[]});
        setTimeout(()=>i.message.delete().catch(()=>{}),60*1000);
        return;
      } catch(e) { return i.reply({content:`⚠️ 購買失敗：${e.message}`,ephemeral:true}); }
    }
  }
  if(i.isButton() && i.customId.startsWith('dragon_gate:') && i.guildId) {
    const [,token,action]=i.customId.split(':'),game=dragonGateGames.get(token);
    if(!game) return i.reply({content:'⚠️ 這局射龍門已失效。',ephemeral:true});
    if(i.user.id!==game.userId) return i.reply({content:'⚠️ 只有下注玩家能做決定。',ephemeral:true});
    dragonGateGames.delete(token);
    if(action==='pass') {
      changeBalance(i.guildId,i.user.id,game.bet,'refund',i.user.id,'射龍門放棄射牌，退回下注');
      return i.update({embeds:[new EmbedBuilder().setColor(0xF5B942).setTitle('🚪 射龍門｜選擇不射').setDescription(`門牌：**${cardText(game.a)}｜${cardText(game.b)}**\n你判斷風險太高，本局退回 ${fmt(game.bet)}。\n金庫：${fmt(balance(i.guildId,i.user.id))}`)],components:[]});
    }
    const shot=drawCard(),inside=shot.rank>game.a.rank&&shot.rank<game.b.rank,post=shot.rank===game.a.rank||shot.rank===game.b.rank;
    const payout=inside?game.bet*2:0,settlement=settleGamePayout(i.guildId,i.user.id,game.bet,payout,'射龍門');
    const awarded=inside;
    const text=inside?'🎯 射中龍門！':post?'💥 撞柱！下注全失。':'❌ 沒有射中。';
    return i.update({embeds:[new EmbedBuilder().setColor(awarded?0x35C46A:0xD94A4A).setTitle('🚪 射龍門｜開出射牌').setDescription(`門牌：**${cardText(game.a)}｜${cardText(game.b)}**\n射牌：**${cardText(shot)}**\n\n${text}\n結算：${awarded?`獲得 ${fmt(settlement.credited)}`:`損失 ${fmt(game.bet)}`}${titleLuckNotice(settlement)}\n金庫：${fmt(balance(i.guildId,i.user.id))}`)],components:[]});
  }
  if(i.isButton() && i.customId.startsWith('riot_') && i.guildId) {
    const [action,token]=i.customId.split(':'),riot=jailRiots.get(token);
    if(!riot) return i.reply({content:'⚠️ 這場暴動已經結束。',ephemeral:true});
    if(action==='riot_join') {
      if(!jailRemaining(i.guildId,i.user.id)) return i.reply({content:'⚠️ 只有正在小黑屋服刑的玩家能加入。',ephemeral:true});
      riot.members.add(i.user.id);
      return i.reply({content:`✊ 你已加入暴動，目前共 ${riot.members.size} 人。`,ephemeral:true});
    }
    if(i.user.id!==riot.ownerId) return i.reply({content:'⚠️ 只有發起人能下令暴動。',ephemeral:true});
    const members=[...riot.members].filter(id=>jailRemaining(i.guildId,id));
    const chance=Math.min(75,20+(members.length-1)*15);
    jailRiots.delete(token);
    if(Math.random()*100<chance) {
      members.forEach(id=>releaseFromJail(i.guildId,id));
      return i.update({embeds:[new EmbedBuilder().setColor(0x35C46A).setTitle('🔥 小黑屋暴動成功！').setDescription(`眾人合力撞開鐵門、突破迷子的封鎖！\n\n成功率：${chance}%\n獲釋玩家：\n${members.map(id=>`• <@${id}>`).join('\n')}`).setImage(jailRiotImageUrl)],components:[riotRow(token,true)]});
    }
    for(const id of members) db.prepare('UPDATE jail SET release_at=release_at+120000 WHERE guild_id=? AND user_id=?').run(i.guildId,id);
    return i.update({embeds:[new EmbedBuilder().setColor(0xD94A4A).setTitle('🚨 小黑屋暴動失敗！').setDescription(`迷子帶著猛博美鎮壓現場，參與者刑期全部增加 **2 分鐘**。\n\n成功率：${chance}%\n參與人數：${members.length}`).setImage(jailRiotImageUrl)],components:[riotRow(token,true)]});
  }
  if(i.isButton() && i.customId.startsWith('mahjong_') && i.guildId) {
    const [action,token]=i.customId.split(':'),room=mahjongRooms.get(token);
    if(!room) return i.reply({content:'⚠️ 這張麻將桌已經關閉。',ephemeral:true});
    if(action==='mahjong_join') {
      if(room.players.includes(i.user.id)) return i.reply({content:'⚠️ 你已經在牌桌上。',ephemeral:true});
      if(room.players.length>=4) return i.reply({content:'⚠️ 牌桌已滿。',ephemeral:true});
      if(jailRemaining(i.guildId,i.user.id)||hospitalRemaining(i.guildId,i.user.id)) return i.reply({content:'⚠️ 你目前無法加入牌桌。',ephemeral:true});
      if(balance(i.guildId,i.user.id)<room.bet||stamina(i.guildId,i.user.id)<staminaCost(i.guildId,i.user.id,10)) return i.reply({content:'⚠️ 金幣或體力不足。',ephemeral:true});
      room.players.push(i.user.id);
      return i.reply({content:`🪑 你已入座（${room.players.length}/4）。`,ephemeral:true});
    }
    if(i.user.id!==room.ownerId) return i.reply({content:'⚠️ 只有開桌玩家能開始對局。',ephemeral:true});
    if(room.players.length<2) return i.reply({content:'⚠️ 至少需要 2 位玩家才能開始。',ephemeral:true});
    for(const id of room.players) {
      if(balance(i.guildId,id)<room.bet||stamina(i.guildId,id)<staminaCost(i.guildId,id,10)||jailRemaining(i.guildId,id)) return i.reply({content:`⚠️ <@${id}> 的狀態、金幣或體力不符合開局條件。`,ephemeral:true});
    }
    mahjongRooms.delete(token);
    room.players.forEach(id=>{consumeStamina(i.guildId,id,10);changeBalance(i.guildId,id,-room.bet,'bet',id,'多人麻將下注');});
    const results=room.players.map(id=>{const hand=drawMahjongHand();return {id,hand,score:mahjongScore(hand)};}).sort((a,b)=>b.score-a.score);
    const winner=results[0],pot=Math.floor(room.bet*room.players.length*weeklyMahjongMultiplier()),before=balance(i.guildId,winner.id),after=changeBalance(i.guildId,winner.id,pot,'payout',winner.id,'多人麻將獲勝');
    return i.update({embeds:[new EmbedBuilder().setColor(0x35C46A).setTitle('🀄 多人麻將｜開獎').setDescription(`${results.map((r,n)=>`${n===0?'👑':'　'} <@${r.id}>｜牌力 **${r.score}**\n${r.hand.join('')}`).join('\n\n')}\n\n獲勝者：<@${winner.id}>\n獎池入帳：**${fmt(after-before)}**${taipeiWeekday()===6?'（週六 ×1.5）':''}`)],components:[mahjongRoomRow(token,true)]});
  }
  if(i.isButton() && (i.customId.startsWith('team_join:')||i.customId.startsWith('team_decline:')) && i.guildId) {
    const [action,token]=i.customId.split(':'), invite=teamInvites.get(token);
    if(!invite) return i.reply({content:'⚠️ 這個隊伍邀請已失效。',ephemeral:true});
    if(i.user.id!==invite.userId) return i.reply({content:'⚠️ 只有受邀玩家可以回應。',ephemeral:true});
    teamInvites.delete(token);
    if(action==='team_decline') return i.update({content:`${i.user} 拒絕了隊伍邀請。`,embeds:[],components:[]});
    if(getTeam(i.guildId,i.user.id)) return i.update({content:'⚠️ 你已經在其他隊伍中。',embeds:[],components:[]});
    const team=db.prepare('SELECT * FROM teams WHERE id=? AND guild_id=?').get(invite.teamId,i.guildId);
    if(!team) return i.update({content:'⚠️ 隊伍已不存在。',embeds:[],components:[]});
    const count=db.prepare('SELECT COUNT(*) AS count FROM team_members WHERE guild_id=? AND team_id=?').get(i.guildId,team.id).count;
    if(count>=8) return i.update({content:'⚠️ 隊伍已滿（最多 8 人）。',embeds:[],components:[]});
    db.prepare('INSERT INTO team_members(guild_id,user_id,team_id) VALUES(?,?,?)').run(i.guildId,i.user.id,team.id);
    return i.update({content:`✅ ${i.user} 已加入 **${teamDisplayName(team)}**。`,embeds:[],components:[],allowedMentions:{parse:[]}});
  }
  if(i.isStringSelectMenu() && i.customId.startsWith('heist_vehicle:') && i.guildId) {
    const token=i.customId.split(':')[1],heist=activeHeists.get(token),assetId=i.values[0];
    if(!heist||heist.lobbyClosed) return i.reply({content:'⚠️ 這次搶劫的載具準備階段已結束。',ephemeral:true});
    if(i.user.id!==heist.leaderId) return i.reply({content:'⚠️ 只有隊長可以決定本次逃跑載具。',ephemeral:true});
    if(assetId==='default') heist.vehicleId=null;
    else {
      const owned=ownedHeistVehicles(i.guildId,i.user.id).some(row=>row.asset_id===assetId);
      if(!owned) return i.reply({content:'⚠️ 你目前沒有這項載具，或它已經不在車庫中。',ephemeral:true});
      heist.vehicleId=assetId;
    }
    const name=selectedHeistVehicleName(heist),bonus=selectedHeistVehicleBonus(heist);
    return i.reply({content:`✅ 本次逃跑載具已設定為 **${name}**，實際搶劫成功率加成 **+${bonus}%**。${heist.vehicleId?'載具必須保留到任務執行時；若先行出售，將自動改用預設接應車。':'本次不套用私人載具增益。'}`,ephemeral:true});
  }
  if(i.isStringSelectMenu() && i.customId.startsWith('heist_weapon:') && i.guildId) {
    const token=i.customId.split(':')[1],heist=activeHeists.get(token),weapon=i.values[0];
    if(!heist||heist.lobbyClosed) return i.reply({content:'⚠️ 這次搶劫的裝備階段已結束。',ephemeral:true});
    if(!heistWeapons[weapon]) return i.reply({content:'⚠️ 找不到這項槍枝。',ephemeral:true});
    if(heist.members.includes(i.user.id)) heist.weapons.set(i.user.id,weapon);
    else if(heist.police.has(i.user.id)) heist.policeWeapons.set(i.user.id,weapon);
    else return i.reply({content:'⚠️ 你尚未加入本次劫匪或警方陣營。',ephemeral:true});
    const side=heist.members.includes(i.user.id)?'劫匪':'警方';
    return i.reply({content:`✅ 你以 **${side}**身分選擇 ${heistWeapons[weapon].name}。行動開始時將收取 **${fmt(heistWeapons[weapon].price)}** 槍枝費並直接銷毀；準備結束前可重新選擇。`,ephemeral:true});
  }
  if(i.isButton() && i.customId.startsWith('heist_informant:') && i.guildId) {
    const [,token,choice]=i.customId.split(':'),heist=activeHeists.get(token);
    if(!heist||heist.lobbyClosed) return i.reply({content:'⚠️ 警方招募線人的階段已結束。',ephemeral:true});
    if(!heist.members.includes(i.user.id)) return i.reply({content:'⚠️ 只有本次劫匪隊伍成員會收到警方詢問。',ephemeral:true});
    if(Date.now()>=heist.factionDeadline&&!heist.factionLocked) {
      heist.members.filter(id=>!heist.informantChoices.has(id)).forEach(id=>heist.informantChoices.set(id,false));
      heist.factionLocked=true;
    }
    if(heist.factionLocked) return i.reply({content:'⏰ 一分鐘選擇期限已結束，陣營已鎖定，無法再變更。',ephemeral:true});
    const accepted=choice==='yes';
    heist.informantChoices.set(i.user.id,accepted);
    if(accepted) heist.informants.add(i.user.id); else heist.informants.delete(i.user.id);
    return i.reply({content:accepted?'🕵️ 你已秘密答應成為警方線人。你的身分不會在行動前公開，若警方成功阻止搶劫可獲秘密獎金。':'🤐 你拒絕了警方招募，決定忠於劫匪隊伍。',ephemeral:true});
  }
  if(i.isButton() && i.customId.startsWith('heist_scout:') && i.guildId) {
    const token=i.customId.split(':')[1],heist=activeHeists.get(token);
    if(!heist||heist.lobbyClosed) return i.reply({content:'⚠️ 這次金庫偵查階段已結束。',ephemeral:true});
    if(!heist.members.includes(i.user.id)) return i.reply({content:'⚠️ 只有本次劫匪隊伍可以偵查金庫。',ephemeral:true});
    const alreadyScouted=heist.vaultScouted,vault=heistVaultContents[heist.vaultId],bank=heistBanks[heist.bankId],map=heistMaps[heist.mapId];
    heist.vaultScouted=true;
    const hot=!bank.sundayOnly&&hotBankFor(0).id===heist.bankId;
    const estimatedLoot=vault.fixedReward|| (bank.sundayOnly
      ? heistBasePool(i.guildId,heist.bankId)
      : Math.floor(bank.reward*map.rewardMultiplier*vault.rewardMultiplier*(hot?2:1)));
    const estimate=vault.fixedReward||teamHeistTotalPayout(estimatedLoot,heist.members.length);
    const embed=new EmbedBuilder().setColor(0xD4AF37).setTitle('🔎 金庫偵查報告').setDescription(`情報人員已確認本次任務的金庫內容。這項內容在任務建立時就已固定，不會因重複偵查而改變。\n\n**${vault.name}**\n${vault.description}`).addFields(
      {name:vault.fixedReward?'🏆 地契結算金額':'💰 金庫收益倍率',value:vault.fixedReward?fmt(vault.fixedReward):`×${vault.rewardMultiplier}`,inline:true},
      {name:'📦 預估總獎池',value:fmt(estimate),inline:true},
      {name:'🗺️ 目標',value:`${bank.name}\n${map.name}`,inline:false}
    );
    return i.reply({...heistScenePayload(embed,vault.scene),ephemeral:alreadyScouted});
  }
  if(i.isButton() && i.customId.startsWith('heist_status:') && i.guildId) {
    const token=i.customId.split(':')[1],heist=activeHeists.get(token);
    if(!heist) return i.reply({content:'⚠️ 這次搶劫計畫已失效。',ephemeral:true});
    if(i.user.id!==heist.leaderId) return i.reply({content:'⚠️ 只有隊長可以查看全隊準備狀態。',ephemeral:true});
    return i.reply({content:heistCaptainStatus(heist),ephemeral:true,allowedMentions:{parse:[]}});
  }
  if(i.isButton() && i.customId.startsWith('heist_police_join:') && i.guildId) {
    const token=i.customId.split(':')[1],heist=activeHeists.get(token);
    if(!heist||heist.lobbyClosed) return i.reply({content:'⚠️ 本次警方招募已結束。',ephemeral:true});
    if(heist.members.includes(i.user.id)) return i.reply({content:'⚠️ 劫匪隊伍成員只能選擇是否成為秘密線人，不能公開加入警方。',ephemeral:true});
    if(heist.police.has(i.user.id)) return i.reply({content:'⚠️ 你已加入本次警方陣營，請使用槍枝選單挑選裝備。',ephemeral:true});
    if(heist.police.size>=8) return i.reply({content:'⚠️ 警方陣營已滿（最多 8 人）。',ephemeral:true});
    if(jailRemaining(i.guildId,i.user.id)||hospitalRemaining(i.guildId,i.user.id)) return i.reply({content:'⚠️ 你目前無法參與警方行動。',ephemeral:true});
    if(stamina(i.guildId,i.user.id)<staminaCost(i.guildId,i.user.id,10)) return i.reply({content:'⚠️ 加入警方需要至少 10 點體力。',ephemeral:true});
    heist.police.add(i.user.id);
    return i.reply({content:'🚓 你已加入警方陣營！請在上方選擇槍枝，再選擇「正面對抗劫匪」或「呼叫增援」確認參戰。你的行動會提高警方阻止搶劫的機率。',ephemeral:true});
  }
  if(i.isButton() && i.customId.startsWith('heist_police_action:') && i.guildId) {
    const [,token,action]=i.customId.split(':'),heist=activeHeists.get(token);
    if(!heist||heist.lobbyClosed) return i.reply({content:'⚠️ 本次警方行動選擇已結束。',ephemeral:true});
    if(!heist.police.has(i.user.id)) return i.reply({content:'⚠️ 請先點擊「加入警方阻止搶劫」，才能選擇警方行動。',ephemeral:true});
    if(!['confront','reinforce'].includes(action)) return i.reply({content:'⚠️ 找不到這個警方行動。',ephemeral:true});
    heist.policeActions.set(i.user.id,action);
    return i.reply({content:action==='confront'?'🛡️ 你決定在搶劫發生時正面對抗劫匪！本次行動提供 2% 警方壓制力，若成功阻止搶劫可平分警方獎金。':'📢 你已呼叫增援！增援警力會在交鋒時包圍歹徒，本次行動提供 3% 警方壓制力，若成功阻止搶劫可平分警方獎金。',ephemeral:true});
  }
  if(i.isButton() && i.customId.startsWith('heist_prep:') && i.guildId) {
    const token=i.customId.split(':')[1], heist=activeHeists.get(token);
    if(!heist) return i.reply({content:'⚠️ 這次搶劫計畫已失效。',ephemeral:true});
    if(!heist.members.includes(i.user.id)) return i.reply({content:'⚠️ 你不是這支隊伍的成員。',ephemeral:true});
    heist.ready.add(i.user.id);
    if(heist.ready.size<heist.members.length) return i.reply({content:`🧰 你已完成事前準備（${heist.ready.size}/${heist.members.length}）。`,ephemeral:true});
    const {missingFaction:missingChoices,missingWeapons,missingPoliceWeapons,missingPoliceActions}=heistReadiness(heist);
    if(missingChoices.length||missingWeapons.length||missingPoliceWeapons.length||missingPoliceActions.length) {
      return i.reply({content:`⚠️ 尚不能結束準備：\n• 未回覆線人邀請：${missingChoices.length} 人\n• 劫匪未選槍枝：${missingWeapons.length} 人\n• 警方未選槍枝：${missingPoliceWeapons.length} 人\n• 警方未選擇行動：${missingPoliceActions.length} 人\n\n完成後任一劫匪再按一次「完成事前準備」。`,ephemeral:true});
    }
    heist.lobbyClosed=true;
    const schemeRow=new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`heist_scheme:${token}:deception`).setLabel('瞞天過海').setEmoji('🎭').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`heist_scheme:${token}:force`).setLabel('勇猛強闖').setEmoji('💥').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`heist_scheme:${token}:clever`).setLabel('機智智取').setEmoji('🧠').setStyle(ButtonStyle.Success)
    );
    return i.update({embeds:[new EmbedBuilder().setColor(0xF5B942).setTitle('✅ 警匪雙方準備完成').setDescription(`目標：**${heistBanks[heist.bankId].name}**\n地圖：**${heistMaps[heist.mapId].name}**\n金庫情報：**${heist.vaultScouted?heistVaultContents[heist.vaultId].name:'尚未偵查'}**\n劫匪：**${heist.members.length}/8**｜警方：**${heist.police.size}/8**\n\n隊長 <@${heist.leaderId}> 請選擇搶劫方案：\n🎭 **瞞天過海**：成功率 +5%，收益 ×0.9\n💥 **勇猛強闖**：成功率 -3%，收益 ×1.4\n🧠 **機智智取**：成功率 +2%，收益 ×1.1`).setImage(heistSceneUrl('planning'))],components:[heistPrepRow(token,true),schemeRow]});
  }
  if(i.isButton() && i.customId.startsWith('heist_scheme:') && i.guildId) {
    const [,token,scheme]=i.customId.split(':'), heist=activeHeists.get(token);
    if(!heist) return i.reply({content:'⚠️ 這次搶劫計畫已失效。',ephemeral:true});
    if(i.user.id!==heist.leaderId) return i.reply({content:'⚠️ 只有隊長能選擇搶劫方案。',ephemeral:true});
    heist.scheme=scheme;
    const schemeNames={deception:'🎭 瞞天過海',force:'💥 勇猛強闖',clever:'🧠 機智智取'};
    const planRow=new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`heist_plan:${token}:car`).setLabel('接應車輛').setEmoji('🚗').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`heist_plan:${token}:sewer`).setLabel('下水道撤離').setEmoji('🕳️').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`heist_plan:${token}:helicopter`).setLabel('直升機撤離').setEmoji('🚁').setStyle(ButtonStyle.Danger)
    );
    return i.update({embeds:[new EmbedBuilder().setColor(0x607D8B).setTitle('📋 搶劫方案已確定').setDescription(`方案：**${schemeNames[scheme]}**\n\n接下來請選擇逃跑計畫：\n🚗 接應車輛：穩定，無加成\n🕳️ 下水道：成功率 +3%\n🚁 直升機：成功率 +5%`).setImage(heistSceneUrl('planning'))],components:[planRow]});
  }
  if(i.isButton() && i.customId.startsWith('heist_plan:') && i.guildId) {
    const [,token,plan]=i.customId.split(':'), heist=activeHeists.get(token);
    if(!heist) return i.reply({content:'⚠️ 這次搶劫計畫已失效。',ephemeral:true});
    if(i.user.id!==heist.leaderId) return i.reply({content:'⚠️ 只有隊長能決定逃跑路線。',ephemeral:true});
    if(!heist.scheme) return i.reply({content:'⚠️ 請先選擇搶劫方案。',ephemeral:true});
    heist.plan=plan;
    const planNames={car:'🚗 接應車輛',sewer:'🕳️ 下水道撤離',helicopter:'🚁 直升機撤離'}, planBonus={car:0,sewer:3,helicopter:5};
    const schemeNames={deception:'🎭 瞞天過海',force:'💥 勇猛強闖',clever:'🧠 機智智取'},schemeBonus={deception:5,force:-3,clever:2};
    const vehicleBonus=selectedHeistVehicleBonus(heist),vehicleName=selectedHeistVehicleName(heist);
    const combat=heistCombatModifiers(heist),map=heistMaps[heist.mapId];
    const chance=Math.min(45+weeklyHeistBonus()+vehicleBonus+combat.robberFirepower,Math.max(1,heistBanks[heist.bankId].baseChance+(heist.members.length-1)*8+planBonus[plan]+schemeBonus[heist.scheme]+weeklyHeistBonus()+vehicleBonus+map.chance+combat.robberFirepower-combat.policePressure));
    const responseRow=new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`heist_police:${token}:counter`).setLabel('反擊警察').setEmoji('🔫').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`heist_police:${token}:evade`).setLabel('專心逃跑').setEmoji('🏃').setStyle(ButtonStyle.Success)
    );
    return i.update({embeds:[new EmbedBuilder().setColor(0xE53935).setTitle('🚓 遭遇警方時如何應對？').setDescription(`目標：**${heistBanks[heist.bankId].name}**\n地圖：**${map.name}**（${map.chance>=0?'+':''}${map.chance}%）\n搶劫方案：**${schemeNames[heist.scheme]}**\n逃跑路線：**${planNames[plan]}**\n逃跑載具：**${vehicleName}**\n載具增益：**+${vehicleBonus}%**\n劫匪槍枝火力：**+${combat.robberFirepower}%**\n警方正面對抗：**${combat.confrontingPolice} 人**（額外壓制 -${combat.confrontationPressure}%）\n警方呼叫增援：**${combat.reinforcingPolice} 人**（增援壓制 -${combat.reinforcementPressure}%）\n警方與線人總壓力：**-${combat.policePressure}%**\n目前成功率：**${chance}%**\n\n🔫 **反擊警察**：成功率 +8%，但有 20% 機率引來特勤增援\n🏃 **專心逃跑**：沒有額外風險`).setImage(heistSceneUrl('planning'))],components:[responseRow]});
  }
  if(i.isButton() && i.customId.startsWith('heist_police:') && i.guildId) {
    const [,token,strategy]=i.customId.split(':'),heist=activeHeists.get(token);
    if(!heist) return i.reply({content:'⚠️ 這次搶劫計畫已失效。',ephemeral:true});
    if(i.user.id!==heist.leaderId) return i.reply({content:'⚠️ 只有隊長能決定如何應對警察。',ephemeral:true});
    heist.policeStrategy=strategy;
    const row=new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`heist_execute:${token}`).setLabel('執行搶劫').setEmoji('💰').setStyle(ButtonStyle.Danger));
    return i.update({embeds:[new EmbedBuilder().setColor(strategy==='counter'?0xD94A4A:0x35C46A).setTitle('✅ 最終行動計畫完成').setDescription(`警方應對：**${strategy==='counter'?'🔫 反擊警察':'🏃 專心逃跑'}**\n逃跑載具：**${selectedHeistVehicleName(heist)}**（成功率 +${selectedHeistVehicleBonus(heist)}%）\n\n隊長可以開始行動。`).setImage(heistSceneUrl('planning'))],components:[row]});
  }
  if(i.isButton() && i.customId.startsWith('heist_execute:') && i.guildId) {
    const token=i.customId.split(':')[1], heist=activeHeists.get(token);
    if(!heist) return i.reply({content:'⚠️ 這次搶劫計畫已失效。',ephemeral:true});
    if(i.user.id!==heist.leaderId) return i.reply({content:'⚠️ 只有隊長能執行搶劫。',ephemeral:true});
    if(!heist.scheme||!heist.plan||!heist.policeStrategy) return i.reply({content:'⚠️ 搶劫方案、逃跑計畫或警方應對尚未完成。',ephemeral:true});
    for(const memberId of heist.members) {
      if(jailRemaining(i.guildId,memberId)||hospitalRemaining(i.guildId,memberId)) return i.reply({content:`⚠️ <@${memberId}> 目前無法行動，計畫取消。`,ephemeral:true});
      if(stamina(i.guildId,memberId)<staminaCost(i.guildId,memberId,20)) return i.reply({content:`⚠️ <@${memberId}> 體力不足 ${staminaCost(i.guildId,memberId,20)}，計畫取消。`,ephemeral:true});
    }
    for(const policeId of heist.police) {
      if(jailRemaining(i.guildId,policeId)||hospitalRemaining(i.guildId,policeId)) return i.reply({content:`⚠️ 警方成員 <@${policeId}> 目前無法行動，請重新發起計畫。`,ephemeral:true});
      if(stamina(i.guildId,policeId)<staminaCost(i.guildId,policeId,10)) return i.reply({content:`⚠️ 警方成員 <@${policeId}> 體力不足，請重新發起計畫。`,ephemeral:true});
    }
    if(!heist.weaponFeesCharged) {
      heist.weaponFeeTotal=chargeHeistWeapons(i.guildId,heist);
      heist.weaponFeesCharged=true;
    }
    heist.members.forEach(memberId=>consumeStamina(i.guildId,memberId,20));
    heist.police.forEach(policeId=>consumeStamina(i.guildId,policeId,10));
    const planBonus={car:0,sewer:3,helicopter:5}[heist.plan],schemeBonus={deception:5,force:-3,clever:2}[heist.scheme];
    const schemeMultiplier={deception:0.9,force:1.4,clever:1.1}[heist.scheme];
    const counterBonus=heist.policeStrategy==='counter'?8:0;
    const policeReinforcements=heist.policeStrategy==='counter'&&Math.random()<0.20;
    const vehicleBonus=selectedHeistVehicleBonus(heist),vehicleName=selectedHeistVehicleName(heist);
    const combat=heistCombatModifiers(heist),map=heistMaps[heist.mapId],vault=heistVaultContents[heist.vaultId];
    const chance=Math.min(45+weeklyHeistBonus()+counterBonus+vehicleBonus+combat.robberFirepower,Math.max(1,heistBanks[heist.bankId].baseChance+(heist.members.length-1)*8+planBonus+schemeBonus+counterBonus+weeklyHeistBonus()+vehicleBonus+map.chance+combat.robberFirepower-combat.policePressure));
    const schemeScenes={
      deception:['🎭 全隊換上運鈔人員制服，偽造的通行文件順利通過第一道門。','📦 假運鈔箱被送進金庫區，警衛暫時沒有察覺異狀。'],
      force:['💥 隊伍正面突破銀行大門，警報聲瞬間響徹整棟建築！','🛡️ 隊員壓制保全、強行切開金庫，時間正在快速流逝。'],
      clever:['🧠 隊員入侵監控系統，攝影機畫面被替換成預先錄製的影像。','🔐 偽造授權碼通過驗證，金庫大門正在安靜地開啟。']
    };
    const escapeScene={car:`🚗 金幣裝上 **${vehicleName}**，全隊衝向預定道路。`,sewer:`🕳️ 全隊鑽入下水道，**${vehicleName}** 已在出口等待接應。`,helicopter:`🚁 全隊撤向屋頂，**${vehicleName}** 負責最後一段接應。`}[heist.plan];
    const approachEmbed=new EmbedBuilder().setColor(0xE53935).setTitle('🏦 搶銀行行動開始').setDescription(`**地圖｜${map.name}**\n${map.scene}\n\n**第一幕｜滲透銀行**\n${schemeScenes[heist.scheme][0]}\n\n行動進度：▰▱▱▱`);
    const approachScene=heist.scheme==='deception'?'deception_uniform':'approach';
    await i.update({...heistScenePayload(approachEmbed,approachScene),components:[]});
    await sleep(2200);
    const assaultEmbed=new EmbedBuilder().setColor(0xF5B942).setTitle('🔓 金庫突破中…').setDescription(`**第二幕｜取得戰利品**\n${schemeScenes[heist.scheme][1]}\n\n**${vault.name}**\n${vault.description}\n${heistVaultRewardLabel(vault)}\n\n行動進度：▰▰▱▱`);
    await i.editReply(heistScenePayload(assaultEmbed,vault.scene));
    await sleep(2200);
    let escapeImage=heist.plan==='sewer'?'sewer':heist.plan==='helicopter'?'helicopter':'chase';
    const escapeEmbed=new EmbedBuilder().setColor(0x5865F2).setTitle('🚨 警方開始追捕！').setDescription(`**第三幕｜警匪交鋒**\n警方投入 **${heist.police.size}/8** 人，其中 **${combat.confrontingPolice} 人**選擇正面對抗、**${combat.reinforcingPolice} 人**呼叫增援。\n警員架起防線持槍壓制，增援警車從各路口包圍歹徒，雙方槍枝與裝備開始影響戰局。\n\n**逃跑計畫**\n${escapeScene}\n載具增益：**+${vehicleBonus}%**\n\n行動進度：▰▰▰▱\n成功判定中……`);
    await i.editReply(heistScenePayload(escapeEmbed,escapeImage));
    await sleep(2400);
    const escapeEvent=rollEscapeEvent('heist');
    const finalChance=Math.min(45+weeklyHeistBonus()+counterBonus+vehicleBonus+combat.robberFirepower,Math.max(1,chance+escapeEvent.modifier));
    const escapeEventScene=escapeEvent.scene||escapeImage;
    await i.editReply(heistScenePayload(new EmbedBuilder().setColor(escapeEvent.forceFail?0xD94A4A:0xF5B942).setTitle(escapeEvent.title).setDescription(`${escapeEvent.text}\n\n事件影響：${escapeEvent.forceFail?'**遭警犬撲倒，逃脫直接失敗**':`${escapeEvent.modifier>=0?'+':''}${escapeEvent.modifier}%`}\n最終逃脫率：**${finalChance}%**\n\n行動進度：▰▰▰▰`),escapeEventScene));
    await sleep(2400);
    activeHeists.delete(token);
    if(policeReinforcements||escapeEvent.forceFail||Math.random()*100>=finalChance) {
      escapeImage=escapeEvent.scene||(escapeEvent.forceFail?'arrested':'surrounded');
      const releaseAt=Date.now()+8*60*1000;
      for(const memberId of heist.members) {
        db.prepare('INSERT INTO jail(guild_id,user_id,release_at,reason) VALUES(?,?,?,?) ON CONFLICT(guild_id,user_id) DO UPDATE SET release_at=excluded.release_at,reason=excluded.reason').run(i.guildId,memberId,releaseAt,'團隊搶銀行失敗');
        db.prepare('DELETE FROM jail_training WHERE guild_id=? AND user_id=?').run(i.guildId,memberId);
        db.prepare('DELETE FROM jail_escape WHERE guild_id=? AND user_id=?').run(i.guildId,memberId);
      }
      const failedBank=heistBanks[heist.bankId];
      const hot=!failedBank.sundayOnly&&hotBankFor(0).id===heist.bankId;
      const policePool=failedBank.sundayOnly
        ? Math.floor(heistBasePool(i.guildId,heist.bankId)*0.25)
        : Math.floor(failedBank.reward*(hot?2:1)*vault.rewardMultiplier*0.25);
      const policeShare=heist.police.size?Math.max(1000,Math.floor(policePool/heist.police.size)):0;
      const policePayouts=[...heist.police].map(policeId=>{const before=balance(i.guildId,policeId),after=changeBalance(i.guildId,policeId,policeShare,'job',policeId,'阻止團隊搶銀行');return `<@${policeId}>：${fmt(after-before)}`;});
      for(const informantId of heist.informants) changeBalance(i.guildId,informantId,5000,'job',informantId,'警方線人秘密獎金');
      const payload={...heistScenePayload(new EmbedBuilder().setColor(0xD94A4A).setTitle('🚔 警方成功阻止搶劫！').setDescription(`${policeReinforcements?'🚨 反擊驚動特勤隊，大批警力從四面包圍！':escapeEvent.forceFail?`${POLICE_DOG_TEXT}\n猛博美死死咬住隊員的褲管並將人撲倒，整隊當場被逮捕。`:'警方掌握線報並封鎖所有出口，隊伍在最後關頭遭到包圍。'}\n全隊被關進迷子的小黑屋 **8 分鐘**。\n\n金庫：${vault.name}（${heistVaultRewardLabel(vault)}）\n地圖：${map.name}\n逃跑載具：${vehicleName}（+${vehicleBonus}%）\n警方人數：${heist.police.size}/8\n線人情報：${heist.informants.size?'已發揮作用並秘密發放獎金':'本次沒有線人'}\n警方應對：${heist.policeStrategy==='counter'?'反擊警察':'專心逃跑'}\n逃脫事件：${escapeEvent.title}\n最終成功率：${finalChance}%\n劫匪體力消耗：20｜警察體力消耗：10\n準備費銷毀：${fmt(heist.prepFeeTotal)}｜槍枝費銷毀：${fmt(heist.weaponFeeTotal)}（均不退還）${policePayouts.length?`\n\n**警方實際入帳**\n${policePayouts.join('\n')}`:''}`),escapeImage),components:[]};
      return publishLatestHeistResult(i,payload);
    }
    escapeImage='success';
    const successBank=heistBanks[heist.bankId];
    const hot=!successBank.sundayOnly&&hotBankFor(0).id===heist.bankId;
    const deedReward=successBank.sundayOnly?(vault.fixedReward||0):0;
    const lootTotal=deedReward|| (successBank.sundayOnly
      ? Math.floor(casinoVaultBalance(i.guildId)*0.8)
      : Math.floor(successBank.reward*(hot?2:1)*schemeMultiplier*map.rewardMultiplier*vault.rewardMultiplier));
    const total=deedReward||teamHeistTotalPayout(lootTotal,heist.members.length);
    if(successBank.sundayOnly&&!deedReward) {
      if(lootTotal<=0) throw new Error('賭場中央寶庫已經被搬空');
      changeCasinoVault(i.guildId,-lootTotal,'heist_payout',heist.leaderId,'週日賭場寶庫搶劫成功');
    }
    const baseShare=Math.floor(total/heist.members.length),remainder=total%heist.members.length;
    const payouts=heist.members.map((memberId,index)=>{
      const amount=baseShare+(index<remainder?1:0),before=balance(i.guildId,memberId);
      const after=changeBalance(i.guildId,memberId,amount,deedReward?'hao_xinyi_deed':successBank.sundayOnly?'casino_vault_heist':'job',memberId,deedReward?'HAO 信義區地契變現均分':successBank.sundayOnly?'賭場中央寶庫搶劫收益':'團隊搶銀行收益');
      return `<@${memberId}>：${fmt(after-before)}`;
    });
    const announced=await announceHeistSuccess(i.guildId,new EmbedBuilder().setColor(0x35C46A).setTitle('🚨 團隊搶劫成功公告').setDescription(`**${heist.teamName}**（${heist.members.length} 人）成功突破警方封鎖，從 **${heistBanks[heist.bankId].name}** 帶走金幣！`).addFields(
      {name:'🗺️ 行動地圖',value:map.name,inline:true},
      {name:'🔐 金庫內容',value:`${vault.name}（${heistVaultRewardLabel(vault)}）`,inline:true},
      {name:'💰 搶劫總收益',value:fmt(total),inline:true},
      {name:deedReward?'📜 地契結算方式':'🤝 每人團隊獎勵',value:deedReward?`${fmt(deedReward)} 由 ${heist.members.length} 人均分`:fmt(teamHeistRewardPerMember(heist.members.length)),inline:true},
      {name:'🎯 最終成功率',value:`${finalChance}%`,inline:true},
      {name:'🚘 逃跑載具',value:`${vehicleName}（+${vehicleBonus}%）`,inline:true},
      {name:'👥 搶匪名單',value:heist.members.map(memberId=>`<@${memberId}>`).join('、').slice(0,1024)},
      {name:'💨 逃脫事件',value:`${escapeEvent.title}\n${escapeEvent.text}`.slice(0,1024)}
    ));
    const payload={...heistScenePayload(new EmbedBuilder().setColor(0x35C46A).setTitle(deedReward?'📜 HAO 信義區地契得手！':'💰 團隊搶銀行成功！').setDescription(`隊伍成功突破警方封鎖，載滿戰利品返回藏身處！\n\n逃脫事件：**${escapeEvent.title}**\n${escapeEvent.text}\n\n目標：**${heistBanks[heist.bankId].name}**${hot?'\n🔥 今日大量入金獎池加倍！':''}\n金庫：**${vault.name}**｜${heistVaultRewardLabel(vault)}\n地圖：**${map.name}**${deedReward?'（地契固定結算，不套用地圖倍率）':`｜收益 ×${map.rewardMultiplier}`}\n逃跑載具：**${vehicleName}**｜成功率 +${vehicleBonus}%\n${deedReward?'方案倍率：不套用於地契固定結算':`方案收益倍率：×${schemeMultiplier}`}\n警方人數：${heist.police.size}/8\n${deedReward?'地契變現總額':'銀行戰利品'}：**${fmt(lootTotal)}**\n${deedReward?`均分人數：**${heist.members.length} 人**`:`每人團隊獎勵：**${fmt(teamHeistRewardPerMember(heist.members.length))}**`}\n總收益：**${fmt(total)}**\n最終成功率：${finalChance}%\n準備費銷毀：${fmt(heist.prepFeeTotal)}｜槍枝費銷毀：${fmt(heist.weaponFeeTotal)}（均不退還）\n\n**成員實際入帳**\n${payouts.join('\n')}${announced?'':'\n\n⚠️ 搶劫公告未送達，請管理員重新設定公告頻道並檢查權限。'}`),escapeImage),components:[]};
    return publishLatestHeistResult(i,payload);
  }
  if(i.isButton() && i.customId.startsWith('jail_training:') && i.guildId) {
    const ownerId=i.customId.split(':')[1];
    if(i.user.id!==ownerId) return i.reply({content:'⚠️ 只有正在服刑的玩家可以做這個決定。',ephemeral:true});
    const remaining=jailRemaining(i.guildId,ownerId);
    if(!remaining) return i.reply({content:'⚠️ 你已經不在小黑屋。',ephemeral:true});
    const used=db.prepare('SELECT used FROM jail_training WHERE guild_id=? AND user_id=?').get(i.guildId,ownerId)?.used||0;
    if(used) return i.reply({content:'⚠️ 這次服刑已經使用過調教減刑。',ephemeral:true});
    if(stamina(i.guildId,ownerId)<20) return i.reply({content:'⚠️ 需要 20 點體力。',ephemeral:true});
    consumeStamina(i.guildId,ownerId,20);
    const newRemaining=Math.ceil(remaining/2), releaseAt=Date.now()+newRemaining;
    db.prepare('UPDATE jail SET release_at=? WHERE guild_id=? AND user_id=?').run(releaseAt,i.guildId,ownerId);
    db.prepare('INSERT INTO jail_training(guild_id,user_id,used) VALUES(?,?,1) ON CONFLICT(guild_id,user_id) DO UPDATE SET used=1').run(i.guildId,ownerId);
    const disabled=new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(i.customId).setLabel('已接受迷子調教').setStyle(ButtonStyle.Secondary).setDisabled(true));
    return i.update({embeds:[new EmbedBuilder().setColor(0x9C27B0).setTitle('⏳ 減刑成功').setDescription(`你消耗 **20 體力**接受了迷子的調教。\n剩餘刑期減半為 **${jailText(newRemaining)}**。`)],components:[disabled]});
  }
  if(i.isButton() && i.customId.startsWith('jail_full_training:') && i.guildId) {
    const ownerId=i.customId.split(':')[1];
    if(i.user.id!==ownerId) return i.reply({content:'⚠️ 只有正在服刑的玩家可以做這個決定。',ephemeral:true});
    const remaining=jailRemaining(i.guildId,ownerId);
    if(!remaining) return i.reply({content:'⚠️ 你已經不在小黑屋。',ephemeral:true});
    const currentStamina=stamina(i.guildId,ownerId);
    if(currentStamina<=0) return i.reply({content:'⚠️ 你目前沒有任何體力可供迷子調教，至少需要 1 點體力。',ephemeral:true});
    db.prepare('UPDATE player_stats SET stamina=0 WHERE guild_id=? AND user_id=?').run(i.guildId,ownerId);
    releaseFromJail(i.guildId,ownerId);
    const disabled=new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(i.customId).setLabel('已完成迷子的肉體調教').setStyle(ButtonStyle.Secondary).setDisabled(true));
    return i.update({embeds:[new EmbedBuilder().setColor(0x35C46A).setTitle('🔓 肉體調教完成｜立即出獄').setDescription(`你接受了迷子的完整肉體調教，消耗目前全部 **${currentStamina} 點體力**。\n\n迷子滿意地打開牢門，你的剩餘刑期已全部抵銷。\n目前體力：**0/${staminaMax(i.guildId,ownerId)}**`)],components:[disabled]});
  }
  if(i.isButton() && i.customId.startsWith('duel_weapon:') && i.guildId) {
    const [,token,weapon]=i.customId.split(':'), challenge=duelChallenges.get(token);
    if(!challenge) return i.reply({content:'⚠️ 這個武器選擇已經失效。',ephemeral:true});
    if(i.user.id!==challenge.challengerId) return i.reply({content:'⚠️ 只有發起決鬥的玩家可以選擇武器。',ephemeral:true});
    challenge.weapon=weapon;
    const row=new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`duel_accept:${token}`).setLabel('接受決鬥').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`duel_decline:${token}`).setLabel('拒絕').setStyle(ButtonStyle.Secondary)
    );
    return i.update({content:`<@${challenge.opponentId}>`,embeds:[new EmbedBuilder().setColor(0xE53935).setTitle('⚔️ 收到 PvP 決鬥邀請').setDescription(`<@${challenge.challengerId}> 選擇了 **${weapon==='shotgun'?'霰彈槍':'左輪手槍'}輪盤決鬥**！\n雙方下注：${fmt(challenge.bet)}\n體力消耗：10\n\n請決定是否接受。\n*純屬虛構卡通遊戲，請勿模仿。*`)],components:[row],attachments:[]});
  }
  if(i.isButton() && (i.customId.startsWith('duel_accept:')||i.customId.startsWith('duel_decline:')) && i.guildId) {
    const [action,token]=i.customId.split(':'), challenge=duelChallenges.get(token);
    if(!challenge) return i.reply({content:'⚠️ 這個決鬥邀請已經失效。',ephemeral:true});
    if(i.user.id!==challenge.opponentId) return i.reply({content:'⚠️ 只有被指定的對手可以回應。',ephemeral:true});
    duelChallenges.delete(token);
    if(action==='duel_decline') return i.update({embeds:[new EmbedBuilder().setColor(0x777777).setTitle('🏳️ 決鬥已拒絕').setDescription(`<@${challenge.opponentId}> 拒絕了 <@${challenge.challengerId}> 的決鬥。`)],components:[]});
    for(const playerId of [challenge.challengerId,challenge.opponentId]) {
      if(jailRemaining(i.guildId,playerId)) return i.update({content:`⚠️ <@${playerId}> 正在迷子的小黑屋，無法決鬥。`,embeds:[],components:[]});
      if(hospitalRemaining(i.guildId,playerId)) return i.update({content:`⚠️ <@${playerId}> 正被困在醫院，無法決鬥。`,embeds:[],components:[]});
      if(balance(i.guildId,playerId)<challenge.bet) return i.update({content:`⚠️ <@${playerId}> 的金幣不足，決鬥取消。`,embeds:[],components:[]});
      if(stamina(i.guildId,playerId)<10) return i.update({content:`⚠️ <@${playerId}> 的體力不足，決鬥取消。`,embeds:[],components:[]});
    }
    changeBalance(i.guildId,challenge.challengerId,-challenge.bet,'duel_bet',challenge.challengerId,'PvP 決鬥下注');
    changeBalance(i.guildId,challenge.opponentId,-challenge.bet,'duel_bet',challenge.opponentId,'PvP 決鬥下注');
    consumeStamina(i.guildId,challenge.challengerId,10); consumeStamina(i.guildId,challenge.opponentId,10);
    const chambers=Array(6).fill(false), liveCount=challenge.weapon==='shotgun'?2:1;
    for(let n=0;n<liveCount;n++) chambers[n]=true;
    for(let x=chambers.length-1;x>0;x--){const y=Math.floor(Math.random()*(x+1));[chambers[x],chambers[y]]=[chambers[y],chambers[x]];}
    const duel={...challenge,chambers,shot:0,turnId:Math.random()<0.5?challenge.challengerId:challenge.opponentId};
    activeDuels.set(token,duel);
    return i.update({embeds:[new EmbedBuilder().setColor(0xE53935).setTitle('🎯 PvP 輪盤決鬥開始').setDescription(`模式：**${duel.weapon==='shotgun'?'霰彈槍｜2 發危險彈':'左輪手槍｜1 發危險彈'}**\n獎池：**${fmt(duel.bet*2)}**\n\n輪到 <@${duel.turnId}>。\n*純屬虛構卡通遊戲，請勿模仿。*`)],components:[duelTurnRow(token)]});
  }
  if(i.isButton() && i.customId.startsWith('duel_fire:') && i.guildId) {
    const token=i.customId.split(':')[1], duel=activeDuels.get(token);
    if(!duel) return i.reply({content:'⚠️ 這場決鬥已經結束。',ephemeral:true});
    if(i.user.id!==duel.turnId) return i.reply({content:'⚠️ 還沒輪到你。',ephemeral:true});
    const dangerous=duel.chambers[duel.shot++];
    const otherId=duel.turnId===duel.challengerId?duel.opponentId:duel.challengerId;
    if(dangerous) {
      activeDuels.delete(token);
      const before=balance(i.guildId,otherId), after=changeBalance(i.guildId,otherId,duel.bet*2,'payout',otherId,'PvP 決鬥獲勝'), actual=after-before;
      return i.update({embeds:[new EmbedBuilder().setColor(0x35C46A).setTitle('💥 決鬥結束！').setDescription(`<@${duel.turnId}> 抽中危險彈，卡通角色倒下了！\n🏆 <@${otherId}> 獲勝，實際獲得 **${fmt(actual)}**。\n\n*純屬虛構遊戲效果。*`)],components:[duelTurnRow(token,true)]});
    }
    duel.turnId=otherId;
    return i.update({embeds:[new EmbedBuilder().setColor(0xF5B942).setTitle('💨 安全！').setDescription(`<@${i.user.id}> 抽到安全彈。\n剩餘格數：**${duel.chambers.length-duel.shot}**\n\n輪到 <@${duel.turnId}>。`)],components:[duelTurnRow(token)]});
  }
  if(i.isButton() && i.customId.startsWith('scratch:') && i.guildId) {
    const [,token,indexText]=i.customId.split(':'), ticket=scratchTickets.get(token), index=Number(indexText);
    if(!ticket) return i.reply({content:'⚠️ 這張刮刮樂已經失效。',ephemeral:true});
    if(i.user.id!==ticket.userId) return i.reply({content:'⚠️ 只有購買這張刮刮樂的玩家可以刮開。',ephemeral:true});
    if(ticket.revealed.has(index)) return i.reply({content:'這一格已經刮開了。',ephemeral:true});
    ticket.revealed.add(index);
    if(ticket.revealed.size<3) {
      return i.update({embeds:[new EmbedBuilder().setColor(0xF5B942).setTitle('🪙 刮刮樂｜手動刮獎').setDescription(`已刮開 **${ticket.revealed.size}/3** 格，繼續選擇下一格！`)],components:[scratchRow(token,ticket)]});
    }
    scratchTickets.delete(token);
    const settlement=settleGamePayout(i.guildId,i.user.id,ticket.bet,ticket.payout,'刮刮樂');
    const won=ticket.payout>ticket.bet, reaction=dealerReaction(won);
    const result=ticket.payout?`🎉 中獎！獲得 ${fmt(settlement.credited)}`:`沒有中獎，損失 ${fmt(ticket.bet)}`;
    const dogEvent=settlement.dog?'\n\n🐕 **博美犬叼著你贏來的金幣跑了！本局收益歸 0。**':'';
    const embed=new EmbedBuilder().setColor(won?0x35C46A:0xD94A4A).setTitle('🪙 刮刮樂｜開獎結果').setDescription(`三格全部刮開：**${ticket.icons.join('　')}**\n${result}${titleLuckNotice(settlement)}\n\n**${reaction.quote}**${dogEvent}\n金庫：${fmt(balance(i.guildId,i.user.id))}`).setImage(`attachment://${reaction.name}`);
    const rows=[scratchRow(token,ticket,true),...(settlement.dog?[dogChaseRow(i.user.id,settlement.stolen)]:[])];
    return i.update({embeds:[embed],components:rows,files:[new AttachmentBuilder(reaction.path,{name:reaction.name})]});
  }
  if(i.isButton() && i.customId.startsWith('bingo:')) {
    return i.reply({content:'這是賓果開獎顯示格：綠色代表已開出，灰色代表未開出。',ephemeral:true});
  }
  if(i.isButton() && i.customId.startsWith('dog_chase:') && i.guildId) {
    const token=i.customId.split(':')[1], chase=dogChases.get(token);
    if(!chase || chase.used) return i.reply({content:'⚠️ 這次追趕機會已經失效。',ephemeral:true});
    if(i.user.id!==chase.userId) return i.reply({content:'⚠️ 只有這一局的玩家可以追博美犬。',ephemeral:true});
    chase.used=true;
    const disabled=new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(i.customId).setLabel('已追趕博美犬').setEmoji('🐕').setStyle(ButtonStyle.Secondary).setDisabled(true));
    await i.update({components:[disabled]});
    const g=i.guildId,u=i.user.id;
    if(Math.random()<0.50) {
      const before=balance(g,u), after=changeBalance(g,u,chase.stolen,'payout',u,'追上博美犬拿回金幣');
      return i.followUp({embeds:[new EmbedBuilder().setColor(0x35C46A).setTitle('🏃 追趕成功！').setDescription(`你成功追上博美犬，拿回 **${fmt(after-before)}**！\n金庫：${fmt(after)}`)]});
    }
    const medicalFee=Math.min(200,balance(g,u));
    if(medicalFee) changeBalance(g,u,-medicalFee,'medical',u,'追博美犬被咬傷醫療費｜金幣直接銷毀');
    const hospitalEvent=applyHospitalRandomEvent(g,u);
    const embed=new EmbedBuilder().setColor(0xD94A4A).setTitle('🏥 追趕失敗！').setDescription(`博美犬回頭咬了你一口，你被送進醫院。\n支付醫療費：**${fmt(medicalFee)}**${hospitalEvent.text}\n\n金庫：${fmt(balance(g,u))}`);
    if(hospitalEvent.image) {
      embed.setImage(`attachment://${hospitalEvent.image.name}`);
      return i.followUp({embeds:[embed],files:[new AttachmentBuilder(hospitalEvent.image.path,{name:hospitalEvent.image.name})]});
    }
    return i.followUp({embeds:[embed]});
  }
  if(i.isStringSelectMenu()&&i.customId.startsWith('pet_shop_select:')&&i.guildId) {
    const ownerId=i.customId.split(':')[1];
    if(i.user.id!==ownerId) return i.reply({content:'⚠️ 只有開啟寵物店的玩家可以操作。',ephemeral:true});
    const [kind,id]=i.values[0].split(':'),product=kind==='pet'?petCatalog[id]:petItemCatalog[id];
    if(!product) return i.reply({content:'⚠️ 找不到這項商品。',ephemeral:true});
    const embed=new EmbedBuilder().setColor(0xE8A2C8).setTitle(`${product.emoji} ${product.name}`).setDescription(kind==='pet'
      ? `領養價格：**${fmt(product.price)}**\n特殊功能：**${product.bonusText}**\n\n${product.description}\n\n心情達 20 以上且設為同行夥伴時，特殊功能才會啟用。`
      : `用品價格：**${fmt(product.price)}**\n使用效果：**心情 +${product.mood}**\n\n${product.description}`);
    const buyRow=new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`pet_shop_buy:${ownerId}:${kind}:${id}`).setLabel(kind==='pet'?'確認領養':'選擇購買數量').setEmoji(kind==='pet'?'🐾':'🛒').setStyle(ButtonStyle.Success));
    if(kind==='pet') return i.update({...petMediaPayload(embed,id),components:[petShopSelectRow(ownerId,i.values[0]),buyRow],attachments:[]});
    return i.update({embeds:[embed],components:[petShopSelectRow(ownerId,i.values[0]),buyRow],attachments:[]});
  }
  if(i.isButton()&&i.customId.startsWith('pet_shop_buy:')&&i.guildId) {
    const [,ownerId,kind,id]=i.customId.split(':');
    if(i.user.id!==ownerId) return i.reply({content:'⚠️ 只有開啟寵物店的玩家可以購買。',ephemeral:true});
    if(kind==='item') {
      const product=petItemCatalog[id];
      if(!product) return i.reply({content:'⚠️ 找不到這項商品。',ephemeral:true});
      const quantityInput=new TextInputBuilder().setCustomId('quantity').setLabel(`購買數量（單價 ${fmt(product.price)}）`).setPlaceholder('請輸入 1～99').setStyle(TextInputStyle.Short).setMinLength(1).setMaxLength(2).setRequired(true);
      return i.showModal(new ModalBuilder().setCustomId(`pet_shop_quantity:${ownerId}:${id}`).setTitle(`購買 ${product.name}`).addComponents(new ActionRowBuilder().addComponents(quantityInput)));
    }
    try {
      const result=buyPetShopProduct(i.guildId,i.user.id,kind,id),product=result.product;
      const text=`你已領養 **${product.emoji} ${product.name}**！使用 **/我的寵物** 查看與照顧。`;
      return i.update({embeds:[new EmbedBuilder().setColor(0x35C46A).setTitle('✅ 寵物店交易完成').setDescription(`${text}\n\n金庫：**${fmt(result.balance)}**`)],components:[petShopSelectRow(ownerId)],attachments:[]});
    } catch(error) { return i.reply({content:`⚠️ ${error.message}`,ephemeral:true}); }
  }
  if(i.isModalSubmit()&&i.customId.startsWith('pet_shop_quantity:')&&i.guildId) {
    const [,ownerId,id]=i.customId.split(':');
    if(i.user.id!==ownerId) return i.reply({content:'⚠️ 只有開啟寵物店的玩家可以購買。',ephemeral:true});
    const quantity=Number(i.fields.getTextInputValue('quantity').trim());
    try {
      const result=buyPetShopProduct(i.guildId,i.user.id,'item',id,quantity),product=result.product;
      return i.update({embeds:[new EmbedBuilder().setColor(0x35C46A).setTitle('✅ 寵物店交易完成').setDescription(`你已購買 **${product.emoji} ${product.name} ×${result.quantity}**。\n總價：**${fmt(result.total)}**\n\n金庫：**${fmt(result.balance)}**`)],components:[petShopSelectRow(ownerId)],attachments:[]});
    } catch(error) { return i.reply({content:`⚠️ ${error.message}`,ephemeral:true}); }
  }
  if(i.isStringSelectMenu()&&i.customId.startsWith('pet_companion:')&&i.guildId) {
    const ownerId=i.customId.split(':')[1],petId=i.values[0];
    if(i.user.id!==ownerId) return i.reply({content:'⚠️ 只有寵物主人可以切換同行夥伴。',ephemeral:true});
    if(!db.prepare('SELECT 1 FROM player_pets WHERE guild_id=? AND user_id=? AND pet_id=?').get(i.guildId,ownerId,petId)) return i.reply({content:'⚠️ 你沒有這隻寵物。',ephemeral:true});
    db.prepare('INSERT INTO pet_profiles(guild_id,user_id,active_pet_id) VALUES(?,?,?) ON CONFLICT(guild_id,user_id) DO UPDATE SET active_pet_id=excluded.active_pet_id,updated_at=CURRENT_TIMESTAMP').run(i.guildId,ownerId,petId);
    return i.update({...petProfilePayload(i.guildId,ownerId),components:petProfileComponents(i.guildId,ownerId),attachments:[]});
  }
  if(i.isStringSelectMenu()&&i.customId.startsWith('pet_care:')&&i.guildId) {
    const ownerId=i.customId.split(':')[1];
    if(i.user.id!==ownerId) return i.reply({content:'⚠️ 只有寵物主人可以使用用品。',ephemeral:true});
    try { usePetItem(i.guildId,ownerId,i.values[0]); return i.update({...petProfilePayload(i.guildId,ownerId),components:petProfileComponents(i.guildId,ownerId),attachments:[]}); }
    catch(error) { return i.reply({content:`⚠️ ${error.message}`,ephemeral:true}); }
  }
  if(i.isButton()&&i.customId.startsWith('pet_rename:')&&i.guildId) {
    const ownerId=i.customId.split(':')[1],active=activePet(i.guildId,ownerId);
    if(i.user.id!==ownerId) return i.reply({content:'⚠️ 只有寵物主人可以命名。',ephemeral:true});
    if(!active) return i.reply({content:'⚠️ 請先選擇同行寵物。',ephemeral:true});
    const input=new TextInputBuilder().setCustomId('nickname').setLabel('寵物的新名字').setPlaceholder('請輸入 1–16 個字').setStyle(TextInputStyle.Short).setMinLength(1).setMaxLength(16).setRequired(true);
    if(active.nickname) input.setValue(active.nickname);
    return i.showModal(new ModalBuilder().setCustomId(`pet_rename_modal:${ownerId}:${active.petId}`).setTitle('替寵物命名').addComponents(new ActionRowBuilder().addComponents(input)));
  }
  if(i.isModalSubmit()&&i.customId.startsWith('pet_rename_modal:')&&i.guildId) {
    const [,ownerId,petId]=i.customId.split(':');
    if(i.user.id!==ownerId) return i.reply({content:'⚠️ 只有寵物主人可以命名。',ephemeral:true});
    const raw=i.fields.getTextInputValue('nickname').trim(),nickname=raw.replace(/@/g,'＠');
    if(!nickname||nickname.length>16) return i.reply({content:'⚠️ 名字必須為 1–16 個字。',ephemeral:true});
    const owned=db.prepare('SELECT 1 FROM player_pets WHERE guild_id=? AND user_id=? AND pet_id=?').get(i.guildId,ownerId,petId);
    if(!owned) return i.reply({content:'⚠️ 你沒有這隻寵物。',ephemeral:true});
    db.prepare('UPDATE player_pets SET nickname=? WHERE guild_id=? AND user_id=? AND pet_id=?').run(nickname,i.guildId,ownerId,petId);
    return i.update({...petProfilePayload(i.guildId,ownerId),components:petProfileComponents(i.guildId,ownerId),attachments:[]});
  }
  if(i.isButton()&&(i.customId.startsWith('pvp_race_accept:')||i.customId.startsWith('pvp_race_reject:'))&&i.guildId) {
    const token=i.customId.split(':')[1],session=pvpRaceSessions.get(token);
    if(!session||session.expiresAt<Date.now()||session.status!=='pending') return i.reply({content:'這項 PVP 挑戰已失效。',ephemeral:true});
    if(i.user.id!==session.opponentId) return i.reply({content:'只有被挑戰的玩家可以回應。',ephemeral:true});
    if(i.customId.startsWith('pvp_race_reject:')) {
      session.status='done';pvpRaceSessions.delete(token);
      return i.update({embeds:[new EmbedBuilder().setColor(0x6C757D).setTitle('PVP 挑戰已拒絕').setDescription(`**${session.names[session.opponentId]}** 拒絕了這場對決。`)],components:[pvpRaceChallengeRow(token,true)]});
    }
    for(const id of [session.challengerId,session.opponentId]) {
      if(otherActiveRaceForUser(session.guildId,id,token)) return i.reply({content:`${session.names[id]} 已在其他競賽中。`,ephemeral:true});
      if(!raceChoices(session.guildId,id,session.type).length) return i.reply({content:`${session.names[id]} 沒有可參賽的${session.type==='vehicle'?'車輛':'寵物'}。`,ephemeral:true});
      try{validBet(session.guildId,id,session.bet);}catch(error){return i.reply({content:`${session.names[id]}：${error.message}`,ephemeral:true});}
      if(jailRemaining(session.guildId,id)||hospitalRemaining(session.guildId,id)) return i.reply({content:`${session.names[id]} 目前無法參加遊戲。`,ephemeral:true});
    }
    session.status='selecting';session.expiresAt=Date.now()+2*60*1000;
    return i.update(pvpRacePayload(token,session,i.user.id));
  }
  if(i.isStringSelectMenu()&&i.customId.startsWith('pvp_race_select:')&&i.guildId) {
    const [,token,ownerId]=i.customId.split(':'),session=pvpRaceSessions.get(token);
    if(!session||session.status!=='selecting'||session.expiresAt<Date.now()) return i.reply({content:'這場 PVP 選擇已失效。',ephemeral:true});
    if(i.user.id!==ownerId) return i.reply({content:'這不是你的參賽者選單。',ephemeral:true});
    if(![session.challengerId,session.opponentId].includes(ownerId)) return i.reply({content:'你不在這場 PVP 中。',ephemeral:true});
    if(!raceChoiceInfo(session.guildId,ownerId,session.type,i.values[0])) return i.reply({content:'這個參賽資產已不存在。',ephemeral:true});
    session.selections[ownerId]=i.values[0];
    return i.update(pvpRacePayload(token,session,ownerId));
  }
  if(i.isButton()&&i.customId.startsWith('pvp_race_start:')&&i.guildId) {
    const token=i.customId.split(':')[1],session=pvpRaceSessions.get(token);
    if(!session||session.status!=='selecting'||session.expiresAt<Date.now()) return i.reply({content:'這場 PVP 已失效。',ephemeral:true});
    if(i.user.id!==session.challengerId) return i.reply({content:'只有挑戰者可以開始比賽。',ephemeral:true});
    if(!session.selections[session.challengerId]||!session.selections[session.opponentId]) return i.reply({content:'雙方都選好參賽者後才能開始。',ephemeral:true});
    session.status='running';session.expiresAt=Date.now()+5*60*1000;
    await i.deferUpdate();
    try{return await runPvpCompetition(i,token,session);}catch(error){
      if(session.charged&&!session.settled){for(const id of [session.challengerId,session.opponentId]) changeBalance(session.guildId,id,session.bet,'pvp_wager',id,'PVP 異常退款');session.settled=true;}
      session.status='done';pvpRaceSessions.delete(token);
      return i.editReply({content:`⚠️ ${error.message}${session.charged?'（下注已退回）':''}`,embeds:[],components:[],attachments:[]});
    }
  }
  if(i.isStringSelectMenu()&&i.customId.startsWith('race_select:')&&i.guildId) {
    const token=i.customId.split(':')[1],session=raceSessions.get(token);
    if(!session||session.expiresAt<Date.now()) return i.reply({content:'這場競賽選擇已失效，請重新輸入指令。',ephemeral:true});
    if(i.user.id!==session.userId) return i.reply({content:'這不是你的競賽選單。',ephemeral:true});
    const selected=raceChoiceInfo(session.guildId,session.userId,session.type,i.values[0]);
    if(!selected) return i.reply({content:'這個參賽資產已不存在。',ephemeral:true});
    session.selectedId=i.values[0];
    return i.update(raceSelectionPayload(token,session));
  }
  if(i.isButton()&&i.customId.startsWith('race_start:')&&i.guildId) {
    const token=i.customId.split(':')[1],session=raceSessions.get(token);
    if(!session||session.expiresAt<Date.now()) return i.reply({content:'這場競賽已失效，請重新輸入指令。',ephemeral:true});
    if(i.user.id!==session.userId) return i.reply({content:'只有建立競賽的玩家可以開始。',ephemeral:true});
    if(session.running) return i.reply({content:'競賽已經開始。',ephemeral:true});
    if(!session.selectedId) return i.reply({content:'請先從下拉選單選擇參賽者。',ephemeral:true});
    session.running=true;
    await i.deferUpdate();
    try {
      return await runCompetition(i,token,session);
    } catch(error) {
      raceSessions.delete(token);
      return i.editReply({content:`⚠️ ${error.message}`,embeds:[],components:[],attachments:[]});
    }
  }
  if(i.isButton()&&i.customId.startsWith('burglary_join:')&&i.guildId) {
    const token=i.customId.split(':')[1],lobby=burglaryLobbies.get(token);
    if(!lobby||lobby.guildId!==i.guildId) return i.reply({content:'這個闖空門隊伍已失效。',ephemeral:true});
    if(lobby.targetId===i.user.id) return i.reply({content:'你不能加入準備闖入自己住處的隊伍。',ephemeral:true});
    if(lobby.members.has(i.user.id)) return i.reply({content:'你已經在隊伍裡。',ephemeral:true});
    if(lobby.members.size>=4) return i.reply({content:'闖空門隊伍最多 4 人。',ephemeral:true});
    if(jailRemaining(i.guildId,i.user.id)||hospitalRemaining(i.guildId,i.user.id)) return i.reply({content:'你目前無法行動。',ephemeral:true});
    lobby.members.add(i.user.id);
    return i.update({embeds:[burglaryLobbyEmbed(lobby)],components:[burglaryLobbyRow(token)]});
  }
  if(i.isButton()&&i.customId.startsWith('burglary_cancel:')&&i.guildId) {
    const token=i.customId.split(':')[1],lobby=burglaryLobbies.get(token);
    if(!lobby||lobby.guildId!==i.guildId) return i.reply({content:'這個闖空門隊伍已失效。',ephemeral:true});
    if(i.user.id!==lobby.leaderId) return i.reply({content:'只有隊長可以取消行動。',ephemeral:true});
    burglaryLobbies.delete(token);
    return i.update({embeds:[burglaryLobbyEmbed(lobby).setColor(0x777777).setTitle('✖️ 闖空門行動已取消')],components:[burglaryLobbyRow(token,true)]});
  }
  if(i.isButton()&&i.customId.startsWith('burglary_start:')&&i.guildId) {
    const token=i.customId.split(':')[1],lobby=burglaryLobbies.get(token);
    if(!lobby||lobby.guildId!==i.guildId) return i.reply({content:'這個闖空門隊伍已失效。',ephemeral:true});
    if(i.user.id!==lobby.leaderId) return i.reply({content:'只有隊長可以開始行動。',ephemeral:true});
    const members=[...lobby.members];
    for(const id of members) {
      if(jailRemaining(i.guildId,id)||hospitalRemaining(i.guildId,id)) return i.reply({content:`<@${id}> 目前無法行動。`,ephemeral:true});
      const cost=staminaCost(i.guildId,id,10);
      if(stamina(i.guildId,id)<cost) return i.reply({content:`<@${id}> 體力不足，需要 ${cost} 點。`,ephemeral:true});
    }
    burglaryLobbies.delete(token);
    for(const id of members) consumeStamina(i.guildId,id,10);
    await i.update({embeds:[new EmbedBuilder().setColor(0x455A64).setTitle('🏚️ 多人闖空門行動中…').setDescription(`${members.map(id=>`<@${id}>`).join('、')} 悄悄潛入目標，正在搜索值錢物品……`)],components:[burglaryLobbyRow(token,true)]});
    await sleep(1600);
    const success=Math.random()<Math.min(0.75,0.45+(members.length-1)*0.10);
    if(success) {
      let total=0;
      if(lobby.targetId) {
        const targetCoins=balance(i.guildId,lobby.targetId);
        if(targetCoins>0) {
          total=Math.min(5000,3000*members.length,targetCoins,Math.max(100,Math.floor(targetCoins*(0.10+Math.random()*0.16+0.05*(members.length-1)))));
          changeBalance(i.guildId,lobby.targetId,-total,'theft',lobby.leaderId,`遭 ${members.length} 人闖空門`);
        }
      } else total=Math.min(5000,(Math.floor(Math.random()*1801)+1200)*members.length);
      const base=Math.floor(total/members.length),remainder=total%members.length;
      const payouts=members.map((id,index)=>{
        const amount=base+(index<remainder?1:0),before=balance(i.guildId,id);
        const after=changeBalance(i.guildId,id,amount,lobby.targetId?'theft':'job',lobby.leaderId,'多人闖空門分贓');
        return `<@${id}>：**${fmt(after-before)}**`;
      });
      const targetText=lobby.targetId?`<@${lobby.targetId}> 的住處`:'無人住宅';
      const description=total?`隊伍成功洗劫 ${targetText}，總收益 **${fmt(total)}**。\n\n${payouts.join('\n')}`:`${targetText} 裡沒有任何可帶走的金幣。`;
      return i.editReply({embeds:[new EmbedBuilder().setColor(0x35C46A).setTitle(total?'💰 多人闖空門成功！':'🕸️ 撲了個空！').setDescription(description)],components:[]});
    }
    const releaseAt=Date.now()+2*60*1000;
    for(const id of members) {
      db.prepare('INSERT INTO jail(guild_id,user_id,release_at,reason) VALUES(?,?,?,?) ON CONFLICT(guild_id,user_id) DO UPDATE SET release_at=excluded.release_at,reason=excluded.reason').run(i.guildId,id,releaseAt,'多人闖空門被逮捕');
      db.prepare('DELETE FROM jail_training WHERE guild_id=? AND user_id=?').run(i.guildId,id);
      db.prepare('DELETE FROM jail_escape WHERE guild_id=? AND user_id=?').run(i.guildId,id);
    }
    return i.editReply({embeds:[new EmbedBuilder().setColor(0xD94A4A).setTitle('🚨 多人闖空門失敗！').setDescription(`警報大響，全隊 ${members.map(id=>`<@${id}>`).join('、')} 都被逮捕，關進迷子的小黑屋 **2 分鐘**。`)],components:[]});
  }
  if (!i.isChatInputCommand() || !i.guildId) return;
  const g=i.guildId, u=i.user.id;
  try {
    if (i.commandName==='金庫') {
      const target=i.options.getUser('玩家') || i.user;
      return i.reply({embeds:[new EmbedBuilder().setColor(0xF5B942).setTitle('🏦 玩家金庫').setDescription(`${target} 目前擁有 **${fmt(balance(g,target.id))}**`)]});
    }
    if(i.commandName==='成就') {
      const target=i.options.getUser('玩家')||i.user,state=syncAchievements(g,target.id),lines=achievementLines(g,target.id);
      const unlocked=state.unlocked.size,total=achievementDefinitions.length;
      const recent=state.newlyUnlocked.length?`\n\n🎉 本次新解鎖：${state.newlyUnlocked.map(item=>`**${item.name}**`).join('、')}`:'';
      return i.reply({embeds:[new EmbedBuilder().setColor(0xFFD54F).setAuthor({name:`${target.username} 的成就收藏`,iconURL:target.displayAvatarURL()}).setTitle(`🏆 成就進度 ${unlocked}/${total}`).setDescription(`${lines.join('\n\n')}${recent}`).setFooter({text:'符合條件的成就會在查看時自動補發'})]});
    }
    if(i.commandName==='稱號') {
      const selected=i.options.getString('選擇',true);
      if(selected==='clear') {
        db.prepare('DELETE FROM player_profiles WHERE guild_id=? AND user_id=?').run(g,u);
        return i.reply({content:'✅ 已取消目前裝備的個人稱號。',ephemeral:true});
      }
      if(!achievementTitleUnlocked(g,u,selected)) throw new Error(`你尚未解鎖稱號 ${profileTitles[selected]||selected}，請使用 /成就 查看條件`);
      db.prepare('INSERT INTO player_profiles(guild_id,user_id,title) VALUES(?,?,?) ON CONFLICT(guild_id,user_id) DO UPDATE SET title=excluded.title,updated_at=CURRENT_TIMESTAMP').run(g,u,selected);
      return i.reply({content:`✅ 已裝備個人稱號 **${profileTitles[selected]}**。`,ephemeral:true});
    }
    if(i.commandName==='個人資料') {
      const target=i.options.getUser('玩家')||i.user,coins=balance(g,target.id),energy=stamina(g,target.id),maxEnergy=staminaMax(g,target.id);
      const ledger=db.prepare("SELECT COUNT(*) actions, SUM(CASE WHEN kind='payout' AND delta>0 THEN 1 ELSE 0 END) wins, SUM(CASE WHEN kind IN ('bet','duel_bet') THEN 1 ELSE 0 END) bets FROM ledger WHERE guild_id=? AND user_id=?").get(g,target.id);
      const earned=db.prepare("SELECT COALESCE(SUM(CASE WHEN delta>0 THEN delta ELSE 0 END),0) total FROM ledger WHERE guild_id=? AND user_id=?").get(g,target.id).total;
      const items=db.prepare('SELECT COALESCE(SUM(quantity),0) total FROM inventory WHERE guild_id=? AND user_id=?').get(g,target.id).total;
      const ownedAssets=assetsOf(g,target.id),assetCount=ownedAssets.reduce((sum,row)=>sum+row.quantity,0),assetValue=ownedAssets.reduce((sum,row)=>sum+(assetCatalog[row.asset_id]?.price||0)*row.quantity,0);
      const team=getTeam(g,target.id),jailed=jailRemaining(g,target.id),hospitalized=hospitalRemaining(g,target.id),achievementState=syncAchievements(g,target.id);
      const status=jailed?`🔒 小黑屋（${jailText(jailed)}）`:hospitalized?`🏥 住院（${jailText(hospitalized)}）`:'🟢 自由行動';
      const bars=Math.max(0,Math.min(10,Math.round(energy/maxEnergy*10)));
      return i.reply({embeds:[new EmbedBuilder().setColor(0x5865F2).setAuthor({name:`${target.username} 的個人資料卡`,iconURL:target.displayAvatarURL()}).setThumbnail(target.displayAvatarURL({size:256})).setTitle(profileRank(coins)).setDescription(`⚡ ${'🟦'.repeat(bars)}${'⬛'.repeat(10-bars)} **${energy}/${maxEnergy}**`).addFields(
        {name:'💰 經濟',value:`金庫：${fmt(coins)}\n負債：${fmt(debt(g,target.id))}\n累積獲得：${fmt(earned)}`,inline:true},
        {name:'🎮 紀錄',value:`獲勝紀錄：${ledger.wins||0}\n下注次數：${ledger.bets||0}\n帳務活動：${ledger.actions||0}`,inline:true},
        {name:'🏷️ 特殊稱號',value:playerTitle(g,target.id),inline:true},
        {name:'🏆 成就收藏',value:`已解鎖：${achievementState.unlocked.size}/${achievementDefinitions.length}\n使用 /成就 查看完整進度`,inline:true},
        {name:'🏠 豪華資產',value:`持有數量：${assetCount}\n原價總值：${fmt(assetValue)}`,inline:true},
        {name:'🎒 社交與狀態',value:`背包物品：${items}\n隊伍：${team?`${teamDisplayName(team)}（${team.members.length} 人）`:'尚未加入'}\n狀態：${status}`,inline:false},
        {name:`${todayBuff().icon} 今日增益｜${todayBuff().name}`,value:todayBuff().text,inline:false}
      ).setFooter({text:`玩家 ID：${target.id}｜資料即時更新`})]});
    }
    if(i.commandName==='每日增益') {
      const today=taipeiWeekday();
      const list=dailyBuffs.map((buff,index)=>`${index===today?'➡️':'　'} **${buff.day}｜${buff.icon} ${buff.name}**\n　${buff.text}`).join('\n');
      return i.reply({embeds:[new EmbedBuilder().setColor(0xF5B942).setTitle('📅 每週增益輪替表').setDescription(`${list}\n\n每日於台北時間 **00:00** 自動切換。`)]});
    }
    if (i.commandName==='銀行') {
      const action=i.options.getSubcommand();
      if(action==='查詢') {
        const currentDebt=debt(g,u), available=Math.max(0,LOAN_LIMIT-currentDebt),interestPercent=(LOAN_DAILY_INTEREST_RATE*100).toFixed(2).replace(/\.00$/,'');
        return i.reply({embeds:[new EmbedBuilder().setColor(0x1565C0).setTitle('🏛️ 虛擬金幣銀行').setDescription(`金庫餘額：**${fmt(balance(g,u))}**\n目前負債：**${fmt(currentDebt)}**\n可借額度：**${fmt(available)}**\n每日利率：**${interestPercent}% 複利**\n\n利息於台北時間跨日時累計；無負債時不計息。`)]});
      }
      const amount=i.options.getInteger('金額',true);
      const result=bankTransfer(g,u,amount,action==='借款'?'borrow':'repay');
      const interestPercent=(LOAN_DAILY_INTEREST_RATE*100).toFixed(2).replace(/\.00$/,'');
      return i.reply({embeds:[new EmbedBuilder().setColor(action==='借款'?0x35C46A:0xF5B942).setTitle(action==='借款'?'💵 借款成功':'✅ 還款成功').setDescription(`${action==='借款'?'已存入金庫':'已償還'}：**${fmt(amount)}**\n金庫餘額：${fmt(result.balance)}\n剩餘負債：${fmt(result.debt)}\n每日利率：**${interestPercent}% 複利**`)]});
    }
    if (i.commandName==='體力') {
      const current=stamina(g,u), max=staminaMax(g,u), bars=Math.round(current/max*10);
      return i.reply({embeds:[new EmbedBuilder().setColor(current>=max/2?0x35C46A:0xD94A4A).setTitle('⚡ 玩家體力').setDescription(`**${current}/${max}**\n${'🟩'.repeat(bars)}${'⬛'.repeat(10-bars)}\n\n每天台北時間 00:00 重置；拍立得加成僅限當日。`)]});
    }
    if (i.commandName==='商城') {
      const list=Object.values(shopItems).map(item=>`${item.name}｜**${fmt(item.price)}**｜${item.fullRestore?'回滿全部體力':item.maxBonus?`當日體力上限 **+${item.maxBonus}**`:`恢復 **${item.stamina}** 體力`}`).join('\n');
      return i.reply({embeds:[new EmbedBuilder().setColor(0x9C27B0).setTitle('🛒 體力商城').setDescription(`${list}\n\n使用 \`/購買\` 選購，商品會放入背包。`)]});
    }
    if (i.commandName==='背包') {
      const rows=db.prepare('SELECT item_id,quantity FROM inventory WHERE guild_id=? AND user_id=? AND quantity>0').all(g,u);
      const list=rows.length?rows.map(row=>`${shopItems[row.item_id]?.name||row.item_id} × **${row.quantity}**`).join('\n'):'背包目前是空的。';
      return i.reply({embeds:[new EmbedBuilder().setColor(0x795548).setTitle('🎒 我的背包').setDescription(`${list}\n\n目前體力：**${stamina(g,u)}/${staminaMax(g,u)}**`)]});
    }
    if(i.commandName==='寵物店') return i.reply({embeds:[petShopOverviewEmbed()],components:[petShopSelectRow(u)]});
    if(i.commandName==='我的寵物') return i.reply({...petProfilePayload(g,u),components:petProfileComponents(g,u)});
    if(i.commandName==='資產商城') {
      const category=i.options.getString('分類'),assetId=i.options.getString('商品');
      if(assetId) {
        const asset=assetCatalog[assetId];
        if(!asset) throw new Error('找不到這項資產，請從搜尋建議中選擇');
        if(asset.forSale===false) throw new Error('這是幸運輪盤限定資產，無法直接從商城查看或購買');
        const embed=new EmbedBuilder().setColor(asset.rarity==='限定'?0xFF2D95:asset.rarity==='神話'?0x9C27B0:asset.rarity==='傳說'?0xF5B942:0x1565C0).setTitle(asset.name).setDescription(`分類：**${asset.category}**\n稀有度：**${asset.rarity||'一般'}**\n${asset.temporaryHours?'租金':'價格'}：**${fmt(asset.price)}**${asset.temporaryHours?`\n使用期限：**${asset.temporaryHours} 小時**`:''}\n\n${asset.description}\n\n使用 \`/購買資產 資產:${asset.name}\` 完成${asset.temporaryHours?'租用':'購買'}。`);
        return i.reply(assetMediaPayload(embed,assetId,asset));
      }
      const groups=assetCategories.filter(c=>!category||c===category).map(c=>{
        const items=Object.values(assetCatalog).filter(asset=>asset.category===c&&asset.forSale!==false).map(asset=>`${asset.name}｜**${fmt(asset.price)}**${asset.rarity?`｜${asset.rarity}`:''}\n└ ${asset.description}`).join('\n');
        return `**${c}**\n${items}`;
      }).join('\n\n');
      return i.reply({embeds:[new EmbedBuilder().setColor(0xD4AF37).setTitle('🏛️ 豪華資產商城').setDescription(`${groups}\n\n🎁 **汽車盲盒｜每盒 10,000 金幣**\n使用 \`/汽車盲盒\` 選擇「綜合車包」或含 8 台限定車款的「福特車包」。綜合車包另有 **2%** 隱藏車總機率：龍貓公車 **0.5%**、Corolla AE86 **1.5%**。\n\n使用 \`/資產商城 商品:\` 查看大圖，再用 \`/購買資產\` 購買；永久持有的資產可透過 \`/資產交易\` 出售。`)]});
    }
    if(i.commandName==='汽車盲盒內容') {
      const packId=i.options.getString('車包')||'standard',pack=blindBoxPacks[packId]||blindBoxPacks.standard;
      if(packId==='ford') {
        const list=pack.ids.map(assetId=>{const asset=assetCatalog[assetId];return `• ${asset.name}｜**${asset.rarity}**｜**${blindBoxChanceLabel(assetId,packId)}**｜${assetBuffs[asset.buff].name}`;}).join('\n');
        const imageName='ford_pack_preview.jpg',attachment=new AttachmentBuilder(assetPath(pack.preview),{name:imageName});
        const embed=new EmbedBuilder().setColor(0x1565C0).setTitle('🔵 福特車包｜8 台限定車款').setDescription(`每盒售價：**${fmt(pack.price)}**｜消耗：**${pack.stamina} 體力**\n\n${list}\n\n八台車的機率合計為 **100%**。請使用下方選單查看個別圖片、說明與增益。`).setImage(`attachment://${imageName}`);
        return i.reply({embeds:[embed],components:[carBlindBoxCatalogRow(packId)],files:[attachment]});
      }
      const regular=blindBoxRegularIds.map(assetId=>{const asset=assetCatalog[assetId];return `• ${asset.name}｜**${asset.rarity}**｜${assetBuffs[asset.buff].name}`;}).join('\n');
      const hidden=blindBoxHiddenIds.map(assetId=>{const asset=assetCatalog[assetId];return `• ${asset.name}｜**${asset.rarity}**｜${blindBoxChanceLabel(assetId)}｜${assetBuffs[asset.buff].name}`;}).join('\n');
      const embed=new EmbedBuilder().setColor(0x7E57C2).setTitle('🎁 汽車盲盒內容一覽').setDescription(`每盒售價：**10,000 金幣**｜消耗：**3 體力**\n\n**一般獎池｜隨機抽取**\n${regular}\n\n**隱藏大獎｜總計每盒 2%**\n${hidden}\n\n請使用下方選單查看每輛車的圖片、說明與增益。`);
      return i.reply({embeds:[embed],components:[carBlindBoxCatalogRow('standard')]});
    }
    if(i.commandName==='購買資產') {
      const token=Math.random().toString(36).slice(2,10);
      assetShopSessions.set(token,{guildId:g,userId:u,categoryKey:null,page:0,assetId:null});
      setTimeout(()=>assetShopSessions.delete(token),10*60*1000);
      return i.reply({embeds:[assetShopOverviewEmbed()],components:assetShopComponents(token)});
    }
    if(i.commandName==='我的資產') {
      const target=i.options.getUser('玩家')||i.user,rows=assetBonusRows(g,target.id);
      const totalValue=rows.filter(row=>!row.temporary).reduce((sum,row)=>sum+(assetCatalog[row.asset_id]?.price||0)*row.quantity,0);
      const list=rows.length?assetCategories.map(category=>{
        const owned=rows.filter(row=>assetCatalog[row.asset_id]?.category===category);
        return owned.length?`**${category}**\n${owned.map(row=>`${assetCatalog[row.asset_id].name} × **${row.quantity}**｜${assetBuffLabel(row.asset_id,row.buff_id)}${row.temporary?`｜⏳ <t:${Math.floor(row.expires_at/1000)}:R>`:''}`).join('\n')}`:null;
      }).filter(Boolean).join('\n\n'):'目前沒有任何房地產或載具。';
      return i.reply({embeds:[new EmbedBuilder().setColor(0x1565C0).setAuthor({name:`${target.username} 的資產`,iconURL:target.displayAvatarURL()}).setDescription(`${list}\n\n資產原價總值：**${fmt(totalValue)}**`)]});
    }
    if(i.commandName==='改裝') {
      let assetId=i.options.getString('車輛');
      const supported=ownedVisualModVehicles(g,u);
      if(!assetId&&supported.length===1) assetId=supported[0].asset_id;
      if(!assetId) {
        if(!supported.length) throw new Error('你的車庫目前沒有已完成圖片改裝素材的車輛');
        const token=Math.random().toString(36).slice(2,10),session={guildId:g,userId:u,assetId:null,category:null,pending:null};
        vehicleModSessions.set(token,session); setTimeout(()=>vehicleModSessions.delete(token),10*60*1000);
        const embed=new EmbedBuilder().setColor(0x7C4DFF).setTitle('🔧 車庫改裝工坊').setDescription('請從下方選單選擇車輛。選定後會立即顯示車輛圖片、烤漆、輪框、寬體、引擎與懸吊選項。');
        return i.reply({embeds:[embed],components:[vehicleModVehicleRow(token,g,u)]});
      }
      const asset=assetCatalog[assetId];
      if(!asset||!modifiableVehicleCategories.has(asset.category)||!vehicleHasVisualMods(assetId)) throw new Error('這輛車尚未完成圖片改裝素材');
      const owned=db.prepare('SELECT quantity FROM player_assets WHERE guild_id=? AND user_id=? AND asset_id=?').get(g,u,assetId)?.quantity||0;
      if(!owned) throw new Error('你目前沒有這輛車');
      const token=Math.random().toString(36).slice(2,10),session={guildId:g,userId:u,assetId,category:null,pending:null};
      vehicleModSessions.set(token,session); setTimeout(()=>vehicleModSessions.delete(token),10*60*1000);
      await i.deferReply();
      return i.editReply({...await vehicleModPayload(g,u,assetId),components:vehicleModComponents(token,session)});
    }
    if(['車庫','停機坪','碼頭'].includes(i.commandName)) {
      const isHangar=i.commandName==='停機坪',isMarina=i.commandName==='碼頭',selected=i.options.getString('展示');
      const categories=isHangar?['飛行器']:isMarina?['郵輪']:['汽車','機車'];
      const rows=assetBonusRows(g,u).filter(row=>categories.includes(assetCatalog[row.asset_id]?.category));
      if(selected) {
        const row=rows.find(entry=>entry.asset_id===selected);
        if(!row) throw new Error(`你尚未擁有這項${isHangar?'飛行器':isMarina?'船隻':'車輛'}`);
        const asset=assetCatalog[selected];
        const color=isHangar?0x00ACC1:isMarina?0x0277BD:0x3949AB;
        const place=isHangar?'🛬 停機坪展示':isMarina?'⚓ 碼頭展示':'🏎️ 車庫展示';
        const canModify=!isHangar&&!isMarina&&modifiableVehicleCategories.has(asset.category);
        const labels=canModify?vehicleModLabels(g,u,selected):null;
        const modText=labels?`\n\n🔧 **目前改裝**\n烤漆：${labels.paint}｜輪框：${labels.wheels}\n尾翼：${labels.spoiler}｜寬體：${labels.widebody}\n引擎：${labels.engine}｜懸吊：${labels.suspension}`:'';
        const embed=new EmbedBuilder().setColor(color).setTitle(`${place}｜${asset.name}`).setDescription(`持有數量：**${row.quantity}**\n稀有度：**${asset.rarity||'一般'}**\n資產價值：**${fmt(asset.price*row.quantity)}**\n\n${asset.description}\n\n🎲 永久增益：**${assetBuffLabel(selected,row.buff_id)}**\n${assetBuffDescription(selected,row.buff_id)}${modText}`);
        if(canModify) {
          await i.deferReply();
          const payload=await vehicleGaragePayload(embed,g,u,selected,asset);
          payload.components=[vehicleModOpenButton(u,selected)];
          return i.editReply(payload);
        }
        return i.reply(assetMediaPayload(embed,selected,asset));
      }
      const title=isHangar?'🛬 我的停機坪':isMarina?'⚓ 我的碼頭':'🏎️ 我的車庫';
      const empty=isHangar?'停機坪目前空空的，請到 `/資產商城 分類:飛行器` 選購。':isMarina?'碼頭目前沒有船隻，請到 `/資產商城 分類:郵輪` 選購。':'車庫目前空空的，請到 `/資產商城` 選購汽車或機車。';
      const totalValue=rows.reduce((sum,row)=>sum+assetCatalog[row.asset_id].price*row.quantity,0);
      const list=rows.length?rows.map(row=>{const asset=assetCatalog[row.asset_id];return `${asset.name} × **${row.quantity}**\n└ ${assetBuffLabel(row.asset_id,row.buff_id)}｜${assetBuffDescription(row.asset_id,row.buff_id)}`;}).join('\n\n'):empty;
      const bonuses=isHangar?`搶劫加成：**+${assetHeistBonus(g,u)}%**｜體力上限：**${staminaMax(g,u)}**`:isMarina?`商城折扣：**${Math.round(assetShopDiscount(g,u)*100)}%**｜賭場派彩：**×${assetCasinoBonus(g,u).toFixed(2)}**`:`搶劫加成：**+${assetHeistBonus(g,u)}%**｜工作倍率：**×${assetWorkBonus(g,u).toFixed(2)}**`;
      const color=isHangar?0x00ACC1:isMarina?0x0277BD:0x3949AB;
      return i.reply({embeds:[new EmbedBuilder().setColor(color).setTitle(title).setDescription(`${list}\n\n資產總值：**${fmt(totalValue)}**\n${bonuses}\n\n使用 \`/${i.commandName} 展示:\` 可查看單項完整資料${isHangar||isMarina?'。':'與圖片。'}`)]});
    }
    if(i.commandName==='資產交易') {
      const buyer=i.options.getUser('買家',true),assetId=i.options.getString('資產',true),quantity=i.options.getInteger('數量',true),price=i.options.getInteger('價格',true);
      if(!assetCatalog[assetId]) throw new Error('找不到這項資產，請從搜尋建議中選擇');
      if(buyer.id===u||buyer.bot) throw new Error('請指定另一位真人玩家作為買家');
      const owned=db.prepare('SELECT quantity FROM player_assets WHERE guild_id=? AND user_id=? AND asset_id=?').get(g,u,assetId)?.quantity||0;
      if(owned<quantity) throw new Error(`你持有的 ${assetCatalog[assetId].name} 數量不足，目前只有 ${owned}`);
      const token=Math.random().toString(36).slice(2,10),offer={guildId:g,sellerId:u,buyerId:buyer.id,assetId,quantity,price};
      assetTradeOffers.set(token,offer); setTimeout(()=>assetTradeOffers.delete(token),5*60*1000);
      const row=new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`asset_trade_accept:${token}`).setLabel('接受並付款').setEmoji('✅').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`asset_trade_decline:${token}`).setLabel('拒絕交易').setEmoji('❌').setStyle(ButtonStyle.Danger)
      );
      return i.reply({content:`${buyer}`,embeds:[new EmbedBuilder().setColor(0xF5B942).setTitle('🤝 玩家資產交易邀請').setDescription(`賣家：${i.user}\n買家：${buyer}\n資產：**${assetCatalog[assetId].name} × ${quantity}**\n交易價格：**${fmt(price)}**\n\n買家接受時系統才會再次確認餘額與持有數量，並同步完成轉移。邀請 **5 分鐘**後失效。`)],components:[row]});
    }
    if(i.commandName==='變賣資產') {
      const assetId=i.options.getString('資產',true),quantity=i.options.getInteger('數量')??1,price=i.options.getInteger('售價',true),asset=assetCatalog[assetId];
      if(!asset) throw new Error('找不到這項資產，請從搜尋建議中選擇');
      const listingId=createMarketListing(g,u,assetId,quantity,price);
      return i.reply({embeds:[new EmbedBuilder().setColor(0xF5B942).setTitle('🏷️ 二手商品刊登完成').setDescription(`商品編號：**#${listingId}**\n賣家：${i.user}\n資產：**${asset.name} × ${quantity}**\n售價：**${fmt(price)}**\n\n刊登中的資產已由市場保管，不會被重複出售。使用 \`/二手市場 編號:${listingId}\` 可查看圖片、購買或取消刊登。`)]});
    }
    if(i.commandName==='二手市場') {
      const listingId=i.options.getInteger('編號');
      if(listingId) {
        const listing=db.prepare("SELECT * FROM asset_market_listings WHERE id=? AND guild_id=? AND status='active'").get(listingId,g);
        if(!listing) throw new Error('找不到這筆商品，可能已售出或下架');
        const asset=assetCatalog[listing.asset_id],buff=assetBuffs[listing.buff_id]||null;
        if(!asset) throw new Error('這項資產已不存在');
        const buttons=[new ButtonBuilder().setCustomId(`asset_market:listing:buy:${listing.id}`).setLabel('確認購買').setEmoji('🛍️').setStyle(ButtonStyle.Success)];
        if(listing.seller_id===u) buttons.push(new ButtonBuilder().setCustomId(`asset_market:listing:cancel:${listing.id}`).setLabel('取消刊登').setEmoji('🗑️').setStyle(ButtonStyle.Danger));
        const embed=new EmbedBuilder().setColor(0xF5B942).setTitle(`🏷️ 二手商品 #${listing.id}｜${asset.name}`).setDescription(`賣家：<@${listing.seller_id}>\n分類：**${asset.category}**\n稀有度：**${asset.rarity||'一般'}**\n數量：**${listing.quantity}**\n售價：**${fmt(listing.price)}**\n商城原價參考：**${fmt(asset.price*listing.quantity)}**\n${buff?`\n🎲 資產增益：**${buff.name}**\n${buff.description}`:''}\n\n請先查看資產圖片，再決定是否購買。`);
        const payload=assetMediaPayload(embed,listing.asset_id,asset);
        return i.reply({...payload,components:[new ActionRowBuilder().addComponents(buttons)]});
      }
      const listings=db.prepare("SELECT * FROM asset_market_listings WHERE guild_id=? AND status='active' ORDER BY id DESC LIMIT 20").all(g);
      const list=listings.length?listings.map(row=>{const asset=assetCatalog[row.asset_id];return `**#${row.id}**｜${asset?.name||row.asset_id} × ${row.quantity}\n賣家：<@${row.seller_id}>｜售價：**${fmt(row.price)}**`;}).join('\n\n'):'目前沒有玩家刊登二手商品。';
      return i.reply({embeds:[new EmbedBuilder().setColor(0x795548).setTitle('🛍️ 玩家二手市場').setDescription(`${list}\n\n使用 \`/二手市場 編號:\` 查看商品圖片與完整資料。\n使用 \`/變賣資產\` 刊登自己的資產。`)]});
    }
    if (i.commandName==='玩法') {
      return i.reply({embeds:[commandHelpOverviewEmbed('casino')],components:commandHelpComponents('casino')});
    }
    if (i.commandName==='隊伍') {
      const action=i.options.getSubcommand(),team=getTeam(g,u);
      if(action==='建立') {
        if(team) throw new Error('你已經在一支隊伍中');
        const teamName=normalizeTeamName(i.options.getString('名稱'));
        const result=db.prepare('INSERT INTO teams(guild_id,leader_id,name) VALUES(?,?,?)').run(g,u,teamName);
        db.prepare('INSERT INTO team_members(guild_id,user_id,team_id) VALUES(?,?,?)').run(g,u,Number(result.lastInsertRowid));
        return i.reply(`✅ ${i.user} 已建立 **${teamName||`未命名隊伍 #${Number(result.lastInsertRowid)}`}**。使用 \`/隊伍 邀請\` 招募最多 7 位隊友。`);
      }
      if(!team) throw new Error('你目前沒有隊伍，請先使用 /隊伍 建立');
      if(action==='查看') return i.reply({embeds:[new EmbedBuilder().setColor(0x5865F2).setTitle(`👥 ${teamDisplayName(team)}`).setDescription(`隊長：<@${team.leader_id}>\n成員（${team.members.length}/8）：\n${team.members.map(id=>`• <@${id}>`).join('\n')}`)]});
      if(action==='邀請') {
        if(team.leader_id!==u) throw new Error('只有隊長可以邀請成員');
        if(team.members.length>=8) throw new Error('隊伍已滿（最多 8 人）');
        const target=i.options.getUser('玩家',true);
        if(target.bot||target.id===u) throw new Error('不能邀請自己或機器人');
        if(getTeam(g,target.id)) throw new Error('該玩家已經在其他隊伍中');
        const token=Math.random().toString(36).slice(2,10);
        teamInvites.set(token,{teamId:team.id,userId:target.id}); setTimeout(()=>teamInvites.delete(token),5*60*1000);
        const row=new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`team_join:${token}`).setLabel('加入隊伍').setStyle(ButtonStyle.Success),new ButtonBuilder().setCustomId(`team_decline:${token}`).setLabel('拒絕').setStyle(ButtonStyle.Secondary));
        return i.reply({content:`${target}`,embeds:[new EmbedBuilder().setColor(0x5865F2).setTitle('👥 搶銀行隊伍邀請').setDescription(`${i.user} 邀請你加入 **${teamDisplayName(team)}**。邀請 5 分鐘後失效。`)],components:[row]});
      }
      if(action==='解散') {
        if(team.leader_id!==u) throw new Error('只有隊長可以解散隊伍');
        db.prepare('DELETE FROM team_members WHERE guild_id=? AND team_id=?').run(g,team.id); db.prepare('DELETE FROM teams WHERE guild_id=? AND id=?').run(g,team.id);
        return i.reply('✅ 隊伍已解散。');
      }
      if(team.leader_id===u) throw new Error('隊長不能直接離開，請先解散隊伍');
      db.prepare('DELETE FROM team_members WHERE guild_id=? AND user_id=?').run(g,u);
      return i.reply('✅ 你已離開隊伍。');
    }
    if (i.commandName==='賭場寶庫') {
      const current=casinoVaultBalance(g),loot=Math.floor(current*0.8),open=taipeiWeekday()===0;
      return i.reply({embeds:[new EmbedBuilder().setColor(0xD4AF37).setTitle('🎰 賭場中央寶庫').setDescription(`玩家在系統內購買商品、醫療、槍枝、房產與其他系統消費的金幣都會累積於此。\n\n目前寶庫：**${fmt(current)}**\n週日可搶金額（80%）：**${fmt(loot)}**\n開放狀態：**${open?'🟢 今日開放':'🔒 每週日開放'}**`)]});
    }
    if (i.commandName==='銀行情報') {
      db.prepare('INSERT INTO announcement_channels(guild_id,channel_id) VALUES(?,?) ON CONFLICT(guild_id) DO UPDATE SET channel_id=excluded.channel_id').run(g,i.channelId);
      const today=hotBankFor(0),tomorrow=hotBankFor(1);
      return i.reply({embeds:[new EmbedBuilder().setColor(0xD4AF37).setTitle('📰 銀行大量入金情報').setDescription(`今日：**${heistBanks[today.id].name}**（成功獎池 ×2）\n明日：**${heistBanks[tomorrow.id].name}**（成功獎池 ×2）\n\n每天台北時間 12:00 更新明日情報，並公告到此頻道。`)]});
    }
    if (i.commandName==='團隊搶銀行') {
      const team=getTeam(g,u); if(!team) throw new Error('請先建立或加入隊伍');
      if(team.leader_id!==u) throw new Error('只有隊長可以發起團隊搶銀行');
      if(team.members.length<2) throw new Error('團隊搶銀行至少需要 2 人');
      if([...activeHeists.values()].some(h=>h.guildId===g&&h.teamId===team.id)) throw new Error('隊伍已有進行中的搶劫計畫');
      const bankId=i.options.getString('銀行',true),bank=heistBanks[bankId],mapId=i.options.getString('地圖',true),map=heistMaps[mapId];
      if(bank.sundayOnly&&taipeiWeekday()!==0) throw new Error('賭場中央寶庫僅於每週日（台北時間）開放搶劫');
      const projectedPool=heistBasePool(g,bankId);
      if(bank.sundayOnly&&projectedPool<=0) throw new Error('賭場寶庫目前沒有可搶的金幣');
      for(const memberId of team.members) {
        if(jailRemaining(g,memberId)||hospitalRemaining(g,memberId)) throw new Error(`<@${memberId}> 目前無法行動`);
        if(stamina(g,memberId)<staminaCost(g,memberId,20)) throw new Error(`<@${memberId}> 體力不足 ${staminaCost(g,memberId,20)}`);
      }
      const prepFeeTotal=chargeTeamHeistPreparation(g,team.members);
      db.prepare('INSERT INTO announcement_channels(guild_id,channel_id) VALUES(?,?) ON CONFLICT(guild_id) DO UPDATE SET channel_id=excluded.channel_id').run(g,i.channelId);
      const token=Math.random().toString(36).slice(2,10),heist={guildId:g,channelId:i.channelId,teamId:team.id,teamName:teamDisplayName(team),leaderId:u,bankId,mapId,vaultId:randomHeistVaultId(bankId),vaultScouted:false,members:team.members,ready:new Set(),informantChoices:new Map(),informants:new Set(),weapons:new Map(),police:new Set(),policeWeapons:new Map(),policeActions:new Map(),factionDeadline:Date.now()+60_000,factionLocked:false,lobbyClosed:false,vehicleId:null,scheme:null,plan:null,policeStrategy:null,prepFeePerMember:TEAM_HEIST_PREP_FEE,prepFeeTotal,weaponFeesCharged:false,weaponFeeTotal:0};
      activeHeists.set(token,heist); setTimeout(()=>activeHeists.delete(token),15*60*1000);
      setTimeout(async()=>{
        const current=activeHeists.get(token);
        if(!current||current.lobbyClosed||current.factionLocked) return;
        const defaulted=current.members.filter(id=>!current.informantChoices.has(id));
        defaulted.forEach(id=>current.informantChoices.set(id,false));
        current.factionLocked=true;
        if(!defaulted.length) return;
        try {
          const channel=await client.channels.fetch(current.channelId);
          if(channel?.isTextBased()) await channel.send({content:`⏰ **線人選擇時間已結束**\n以下成員超過一分鐘未選擇，已自動歸入搶匪陣營：${heistMentionList(defaulted)}\n\n完成槍枝與準備後，請再次點擊「完成事前準備」。`,allowedMentions:{parse:[]}});
        } catch(error) { console.error('發送搶劫陣營逾時通知失敗：',error); }
      },60_000);
      const vehicleBonus=selectedHeistVehicleBonus(heist);
      const initialChance=Math.min(45+weeklyHeistBonus()+vehicleBonus,Math.max(1,bank.baseChance+(team.members.length-1)*8+weeklyHeistBonus()+vehicleBonus+map.chance));
      const projectedLoot=bank.sundayOnly?projectedPool:Math.floor(bank.reward*map.rewardMultiplier*(hotBankFor(0).id===bankId?2:1));
      const projectedTotal=teamHeistTotalPayout(projectedLoot,team.members.length);
      const poolText=bank.sundayOnly
        ? `${fmt(projectedTotal)}（含寶庫 80% 與團隊獎勵；成功時依當下餘額結算）`
        : `${fmt(projectedTotal)}（已含團隊獎勵，金庫內容倍率尚待偵查）`;
      const embed=new EmbedBuilder().setColor(0x607D8B).setTitle('🧰 8v8 警匪搶劫｜事前準備').setDescription(`目標：**${bank.name}**\n地圖：**${map.name}**\n${map.scene}\n預估基礎獎池：${poolText}\n金庫情報：**尚未偵查**\n劫匪人數：${team.members.length}/8\n警方人數：等待玩家加入（上限 8）\n逃跑載具：**${selectedHeistVehicleName(heist)}**\n載具增益：**+${vehicleBonus}%**\n地圖成功率：**${map.chance>=0?'+':''}${map.chance}%**\n目前成功率：**${initialChance}%**\n\n💸 入場準備費：每名劫匪 **${fmt(TEAM_HEIST_PREP_FEE)}**，合計 **${fmt(prepFeeTotal)}** 已直接銷毀。\n槍枝費於行動開始時另計；所有費用無論成功、失敗或取消都不退還。\n\n**劫匪必須完成三件事**\n1. 在一分鐘內回覆是否接受警方的秘密線人邀請；逾時會自動成為搶匪\n2. 從選單選擇攜帶槍枝\n3. 點擊「完成事前準備」\n\n🚘 隊長可用載具選單從自己的車庫指定逃跑載具；未選擇時使用預設接應車。\n🔎 可在行動開始前點擊「偵查金庫內容」，查看本次固定的戰利品與收益倍率。\n\n**警方玩法**\n1. 點擊「加入警方阻止搶劫」\n2. 從選單選擇攜帶槍枝\n3. 選擇「正面對抗劫匪」（+2% 壓制）或「呼叫增援」（+3% 壓制）確認參戰\n\n隊長可點擊「查看準備狀態」，確認雙方誰尚未完成選擇，但不會看見線人身分。\n劫匪消耗 20 體力，警方消耗 10 體力。`);
      embed.setDescription(embed.data.description.replace('預估基礎獎池：','預估總獎池：'));
      embed.addFields(
        {name:'🤝 每人團隊獎勵',value:fmt(teamHeistRewardPerMember(team.members.length)),inline:true},
        {name:'👥 隊伍',value:teamDisplayName(team),inline:false}
      );
      return i.reply({...heistScenePayload(embed,'planning'),components:heistLobbyRows(token,heist)});
    }
    if (i.commandName==='決鬥') {
      const opponent=i.options.getUser('對手',true), bet=i.options.getInteger('下注',true);
      if(opponent.id===u) throw new Error('不能向自己發起決鬥');
      if(opponent.bot) throw new Error('不能向機器人發起決鬥');
      validBet(g,u,bet);
      if(jailRemaining(g,u)) throw new Error('你正在迷子的小黑屋，無法發起決鬥');
      if(hospitalRemaining(g,u)) throw new Error('你正被困在醫院，無法發起決鬥');
      if(stamina(g,u)<10) throw new Error('發起決鬥至少需要 10 點體力');
      const token=Math.random().toString(36).slice(2,10);
      duelChallenges.set(token,{challengerId:u,opponentId:opponent.id,bet,weapon:null});
      setTimeout(()=>duelChallenges.delete(token),5*60*1000);
      const row=new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`duel_weapon:${token}:revolver`).setLabel('左輪手槍').setEmoji('🔫').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`duel_weapon:${token}:shotgun`).setLabel('霰彈槍').setEmoji('💥').setStyle(ButtonStyle.Danger)
      );
      const attachment=new AttachmentBuilder(duelModeImage,{name:'duel_mode.png'});
      return i.reply({embeds:[new EmbedBuilder().setColor(0xD4AF37).setTitle('⚔️ 選擇決鬥武器').setDescription(`${i.user}，請使用圖片下方按鈕選擇本場模式。\n對手：${opponent}\n雙方下注：${fmt(bet)}\n\n選擇完成後才會通知對手。`).setImage('attachment://duel_mode.png')],files:[attachment],components:[row]});
    }
    if(i.commandName==='麻將') {
      if(jailRemaining(g,u)||hospitalRemaining(g,u)) throw new Error('你目前無法進行麻將');
      const mode=i.options.getString('模式',true),bet=i.options.getInteger('下注',true); validBet(g,u,bet);
      if(stamina(g,u)<staminaCost(g,u,10)) throw new Error(`麻將需要 ${staminaCost(g,u,10)} 點體力`);
      if(mode==='multi') {
        const token=Math.random().toString(36).slice(2,10),room={ownerId:u,players:[u],bet};
        mahjongRooms.set(token,room); setTimeout(()=>mahjongRooms.delete(token),10*60*1000);
        return i.reply({embeds:[new EmbedBuilder().setColor(0x2E7D32).setTitle('🀄 多人麻將牌桌').setDescription(`${i.user} 已經開桌！\n每位下注：**${fmt(bet)}**\n人數：**1/4**\n\n其他玩家點擊「加入牌桌」，2～4 人即可由開桌玩家開始。`)],components:[mahjongRoomRow(token)]});
      }
      consumeStamina(g,u,10); changeBalance(g,u,-bet,'bet',u,'單人麻將下注');
      const player={name:'你',hand:drawMahjongHand()},bots=[1,2,3].map(n=>({name:`電腦 ${n}`,hand:drawMahjongHand()}));
      const results=[player,...bots].map(entry=>({...entry,score:mahjongScore(entry.hand)})).sort((a,b)=>b.score-a.score);
      const won=results[0].name==='你',payout=won?Math.floor(bet*4*weeklyMahjongMultiplier()):0;
      const settlement=settleGamePayout(g,u,bet,payout,'麻將');
      const awarded=won;
      return i.reply({embeds:[new EmbedBuilder().setColor(awarded?0x35C46A:0xD94A4A).setTitle('🀄 單人麻將｜牌局結果').setDescription(`${results.map((r,n)=>`${n===0?'👑':'　'} **${r.name}｜牌力 ${r.score}**\n${r.hand.join('')}`).join('\n\n')}\n\n${awarded?`🎉 你獲勝，入帳 **${fmt(settlement.credited)}**${taipeiWeekday()===6?'（週六 ×1.5）':''}`:`本局由 **${results[0].name}** 胡牌，你損失 ${fmt(bet)}。`}${titleLuckNotice(settlement)}\n金庫：${fmt(balance(g,u))}`)]});
    }
    if (i.commandName==='購買') {
      const itemId=i.options.getString('商品',true), quantity=i.options.getInteger('數量')??1, item=shopItems[itemId];
      const eventDiscount=(effectActive(g,u,'shop_sale_until')||taipeiWeekday()===5)?0.8:1;
      const paid=Math.ceil(item.price*quantity*Math.max(0.5,eventDiscount-assetShopDiscount(g,u)));
      const next=buyItem(g,u,itemId,quantity);
      const embed=new EmbedBuilder().setColor(0x35C46A).setTitle('🛍️ 購買成功').setDescription(`${item.name} × **${quantity}**\n支付：${fmt(paid)}${paid<item.price*quantity?'（特價）':''}\n金庫：${fmt(next)}\n\n商品已放入背包，使用 \`/使用\` 即可恢復體力。`);
      return i.reply(shopItemMediaPayload(embed,itemId,item));
    }
    if (i.commandName==='使用') {
      const itemId=i.options.getString('商品',true), quantity=i.options.getInteger('數量',true), item=shopItems[itemId];
      const result=useItem(g,u,itemId,quantity);
      const description=result.special?`**「${result.special}」**\n\n當日體力上限提升至 **${result.max}**。\n目前體力：**${result.stamina}/${result.max}**`:`恢復 **${result.restored}** 點體力\n目前體力：**${result.stamina}/${result.max}**`;
      const embed=new EmbedBuilder().setColor(0x35C46A).setTitle(`${item.name} 使用成功`).setDescription(description);
      return i.reply(shopItemMediaPayload(embed,itemId,item));
    }
    if (i.commandName==='每日') {
      const key=`${g}:${u}`, now=Date.now(), last=daily.get(key)||0, wait=86400000-(now-last);
      if(wait>0) throw new Error(`距離下次領取還有 ${Math.ceil(wait/3600000)} 小時`);
      const reward=taipeiWeekday()===0?1000:500,before=balance(g,u);
      daily.set(key,now); const next=changeBalance(g,u,reward,'daily',u,'每日獎勵');
      return i.reply(`🎁 已領取 ${fmt(next-before)}${reward===1000?'（週日雙倍）':''}，目前餘額 ${fmt(next)}`);
    }
    if(i.commandName==='搶劫公告頻道') {
      if(!i.memberPermissions.has(PermissionFlagsBits.Administrator)) throw new Error('只有管理員可以設定搶劫公告頻道');
      const channel=i.options.getChannel('頻道',true);
      if(!channel.isTextBased() || typeof channel.send!=='function') throw new Error('請選擇可發送訊息的文字或公告頻道');
      const botMember=i.guild.members.me,permissions=botMember?channel.permissionsFor(botMember):null;
      const requiredPermissions=[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.EmbedLinks];
      if(!permissions?.has(requiredPermissions)) throw new Error('機器人在該頻道缺少「查看頻道、傳送訊息或嵌入連結」權限，請先調整頻道權限');
      try {
        await channel.send({embeds:[new EmbedBuilder().setColor(0x5865F2).setTitle('✅ 搶劫公告頻道設定成功').setDescription('這是一則權限測試訊息。之後單人與團隊搶劫成功，以及每週日 12:00～22:00 每兩小時的賭場寶庫情報，都會在此發布公告。').setTimestamp()]});
      } catch(e) {
        throw new Error(`無法在該頻道發送測試公告：${e.message}`);
      }
      db.prepare('INSERT INTO heist_announcement_channels(guild_id,channel_id) VALUES(?,?) ON CONFLICT(guild_id) DO UPDATE SET channel_id=excluded.channel_id').run(g,channel.id);
      return i.reply({content:`✅ 搶劫公告已設定在 ${channel}。\n單人與團隊搶劫成功，以及週日賭場寶庫即時情報，都會自動發布公告。`,ephemeral:true});
    }
    if(i.commandName==='單人搶劫機率') {
      if(!i.memberPermissions.has(PermissionFlagsBits.Administrator)) throw new Error('只有管理員可以設定單人搶劫機率');
      const chance=i.options.getInteger('機率',true);
      db.prepare('INSERT INTO solo_heist_settings(guild_id,base_chance) VALUES(?,?) ON CONFLICT(guild_id) DO UPDATE SET base_chance=excluded.base_chance').run(g,chance);
      return i.reply({content:`✅ 單人搶銀行的基礎成功率已設定為 **${chance}%**。\n每週、載具及逃脫事件增減仍會套用，最終機率限制為 1%～100%。`,ephemeral:true});
    }
    if(i.commandName==='稱號設定') {
      if(!i.memberPermissions.has(PermissionFlagsBits.Administrator)) throw new Error('只有管理員可以設定稱號');
      const target=i.options.getUser('玩家',true),title=i.options.getString('稱號',true);
      if(title==='clear') {
        db.prepare('DELETE FROM player_profiles WHERE guild_id=? AND user_id=?').run(g,target.id);
        return i.reply(`✅ 已清除 ${target} 的特殊稱號。`);
      }
      if(!profileTitles[title]) throw new Error('未知的特殊稱號');
      db.prepare('INSERT INTO player_profiles(guild_id,user_id,title) VALUES(?,?,?) ON CONFLICT(guild_id,user_id) DO UPDATE SET title=excluded.title,updated_at=CURRENT_TIMESTAMP').run(g,target.id,title);
      return i.reply(`✅ 已將 ${target} 的特殊稱號設定為 **${profileTitles[title]}**。`);
    }
    if(i.commandName==='資產調整') {
      if(!i.memberPermissions.has(PermissionFlagsBits.Administrator)) throw new Error('只有管理員可以使用');
      const target=i.options.getUser('玩家',true),action=i.options.getString('操作',true),assetId=i.options.getString('資產',true);
      const quantity=i.options.getInteger('數量',true),reason=i.options.getString('原因',true);
      if(!['grant','remove'].includes(action)) throw new Error('未知的資產調整操作');
      const result=adminAdjustAsset(g,target.id,assetId,quantity,action,u,reason),buff=result.buffId?assetBuffs[result.buffId]:null;
      const embed=new EmbedBuilder().setColor(action==='grant'?0x35C46A:0xD94A4A)
        .setTitle(action==='grant'?'✅ 管理員已給予資產':'🗑️ 管理員已刪除資產')
        .setDescription(`玩家：${target}\n資產：**${result.asset.name}**\n調整數量：**${quantity}**\n調整後持有：**${result.remaining}**\n${buff?`資產增益：**${assetBuffLabel(assetId,result.buffId)}**\n${assetBuffDescription(assetId,result.buffId)}\n`:''}原因：${reason}\n\n操作已寫入帳務紀錄。`);
      return i.reply({embeds:[embed],ephemeral:true});
    }
    if (i.commandName==='金幣調整') {
      if(!i.memberPermissions.has(PermissionFlagsBits.Administrator)) throw new Error('只有管理員可以使用');
      const target=i.options.getUser('玩家',true), amount=i.options.getInteger('數量',true), reason=i.options.getString('原因',true);
      if(amount===0) throw new Error('調整數量不能為 0');
      const next=changeBalance(g,target.id,amount,'admin_adjust',u,reason);
      return i.reply(`✅ 已為 ${target} ${amount>0?'增加':'扣除'} ${fmt(Math.abs(amount))}；餘額 ${fmt(next)}\n原因：${reason}`);
    }
    if (i.commandName==='帳務紀錄') {
      if(!i.memberPermissions.has(PermissionFlagsBits.Administrator)) throw new Error('只有管理員可以使用');
      const target=i.options.getUser('玩家',true);
      const rows=db.prepare('SELECT * FROM ledger WHERE guild_id=? AND user_id=? ORDER BY id DESC LIMIT 10').all(g,target.id);
      const body=rows.length?rows.map(r=>`#${r.id} ${r.delta>=0?'+':''}${r.delta} → ${r.balance_after}｜${r.kind}｜${r.reason||'-'}｜${r.created_at}`).join('\n'):'尚無紀錄';
      return i.reply({content:`📒 ${target} 最近帳務\n\`\`\`\n${body}\n\`\`\``,ephemeral:true});
    }
    if(i.commandName==='經濟監控') {
      if(!i.memberPermissions.has(PermissionFlagsBits.Administrator)) throw new Error('只有管理員可以使用');
      const debtors=db.prepare('SELECT user_id FROM bank_accounts WHERE guild_id=?').all(g);
      for(const row of debtors) debt(g,row.user_id);
      const wallets=db.prepare('SELECT balance FROM wallets WHERE guild_id=? ORDER BY balance DESC').all(g).map(row=>row.balance);
      const supply=wallets.reduce((sum,value)=>sum+value,0),players=wallets.length,average=players?Math.floor(supply/players):0;
      const debtStats=db.prepare('SELECT COALESCE(SUM(debt),0) total, SUM(CASE WHEN debt>0 THEN 1 ELSE 0 END) borrowers FROM bank_accounts WHERE guild_id=?').get(g);
      const dayFlow=economyFlow(g,'-1 day'),weekFlow=economyFlow(g,'-7 days');
      const topCount=players?Math.max(1,Math.ceil(players*0.10)):0,topSupply=wallets.slice(0,topCount).reduce((sum,value)=>sum+value,0),topShare=supply>0?topSupply/supply*100:0;
      const sinkText=Object.entries(ECONOMY_SINK_LABELS).map(([kind,label])=>`${label}：**${fmt(weekFlow.sinks[kind])}**`).join('\n');
      const signed=value=>`${value>=0?'+':''}${fmt(value)}`;
      const embed=new EmbedBuilder().setColor(0x00897B).setTitle('📊 伺服器經濟監控')
        .addFields(
          {name:'💰 流通金幣',value:`總量：**${fmt(supply)}**\n玩家：${players} 人\n人均：${fmt(average)}`,inline:true},
          {name:'🏦 銀行負債',value:`本金與利息：**${fmt(debtStats.total||0)}**\n借款人：${debtStats.borrowers||0} 人\n日複利：${(LOAN_DAILY_INTEREST_RATE*100).toFixed(2).replace(/\.00$/,'')}%`,inline:true},
          {name:'🎯 財富集中度',value:`前 10%（${topCount} 人）持有\n**${fmt(topSupply)}／${topShare.toFixed(1)}%**`,inline:true},
          {name:'🕐 最近 24 小時',value:`產生：**${fmt(dayFlow.minted)}**\n銷毀：**${fmt(dayFlow.burned)}**\n淨變化：**${signed(dayFlow.net)}**`,inline:true},
          {name:'📅 最近 7 天',value:`產生：**${fmt(weekFlow.minted)}**\n銷毀：**${fmt(weekFlow.burned)}**\n淨變化：**${signed(weekFlow.net)}**`,inline:true},
          {name:'🔥 7 天指定銷毀',value:sinkText,inline:false}
        )
        .setFooter({text:'玩家交易、二手市場與偷竊屬於轉移，不列入產生或銷毀；房產、套房、食物、醫療、槍枝與準備費均永久離開流通。'});
      return i.reply({embeds:[embed],ephemeral:true});
    }
    if (i.commandName==='逃獄') {
      const remaining=jailRemaining(g,u);
      if(!remaining) throw new Error('你目前不在迷子的小黑屋');
      const used=db.prepare('SELECT used FROM jail_escape WHERE guild_id=? AND user_id=?').get(g,u)?.used||0;
      if(used) throw new Error('這次服刑已經嘗試過逃獄，不能再次嘗試');
      db.prepare('INSERT INTO jail_escape(guild_id,user_id,used) VALUES(?,?,1) ON CONFLICT(guild_id,user_id) DO UPDATE SET used=1').run(g,u);
      await i.reply({embeds:[new EmbedBuilder().setColor(0x607D8B).setTitle('🗝️ 逃獄行動開始').setDescription('你趁迷子不注意，偷偷撬開小黑屋的門鎖……')]});
      await sleep(1800);
      const escapeEvent=rollEscapeEvent('jail');
      const escapeChance=Math.min(0.45,Math.max(0.05,0.25+escapeEvent.modifier/100));
      const jailEventEmbed=new EmbedBuilder().setColor(escapeEvent.forceFail?0xD94A4A:0xF5B942).setTitle(escapeEvent.title).setDescription(`${escapeEvent.text}\n\n${escapeEvent.forceFail?'猛博美把你撲倒在小黑屋門口，逃獄直接失敗！':`本次逃獄機率：**${Math.round(escapeChance*100)}%**`}`);
      await i.editReply(escapeEvent.scene?heistScenePayload(jailEventEmbed,escapeEvent.scene):{embeds:[jailEventEmbed]});
      await sleep(1800);
      if(!escapeEvent.forceFail&&Math.random()<escapeChance) {
        releaseFromJail(g,u);
        return i.editReply({embeds:[new EmbedBuilder().setColor(0x35C46A).setTitle('🏃 逃獄成功！').setDescription('你成功避開迷子的巡邏，刑期全部抵銷，恢復自由！')]});
      }
      const newRelease=Date.now()+remaining+60000;
      db.prepare('UPDATE jail SET release_at=? WHERE guild_id=? AND user_id=?').run(newRelease,g,u);
      const jailFailureEmbed=new EmbedBuilder().setColor(0xD94A4A).setTitle('🚨 逃獄失敗！').setDescription(`${escapeEvent.forceFail?`${POLICE_DOG_TEXT}\n猛博美將你撲倒後大聲吠叫，迷子立刻趕到現場。`:'迷子在門口抓到你。'}\n剩餘刑期增加 **1 分鐘**。\n目前剩餘：${jailText(remaining+60000)}`);
      return i.editReply(escapeEvent.scene?heistScenePayload(jailFailureEmbed,escapeEvent.scene):{embeds:[jailFailureEmbed]});
    }
    if(i.commandName==='小黑屋暴動') {
      if(!jailRemaining(g,u)) throw new Error('只有正在迷子小黑屋服刑的玩家能發動暴動');
      const token=Math.random().toString(36).slice(2,10),riot={ownerId:u,members:new Set([u])};
      jailRiots.set(token,riot); setTimeout(()=>jailRiots.delete(token),5*60*1000);
      const embed=new EmbedBuilder().setColor(0xD94A4A).setTitle('✊ 小黑屋暴動集結').setDescription(`${i.user} 正在召集獄友！\n\n初始成功率：**20%**\n每增加一名獄友：**+15%**\n最高成功率：**75%**\n失敗後所有參與者刑期 **+2 分鐘**。\n\n獄友先點擊「加入暴動」，發起人再按「發動暴動」。`);
      return i.reply({...jailRiotPayload(embed),components:[riotRow(token)]});
    }
    if (i.commandName==='救援同伴') {
      const target=i.options.getUser('玩家',true),method=i.options.getString('方法',true);
      if(target.id===u||target.bot) throw new Error('請選擇另一位玩家');
      const rescuerTeam=getTeam(g,u),targetTeam=getTeam(g,target.id);
      if(!rescuerTeam||!targetTeam||rescuerTeam.id!==targetTeam.id) throw new Error('只能救援同一支隊伍的同伴');
      const targetRemaining=jailRemaining(g,target.id);
      if(!targetRemaining) throw new Error('該玩家目前不在迷子的小黑屋');
      if(jailRemaining(g,u)||hospitalRemaining(g,u)) throw new Error('你目前無法進行救援');
      if(method==='photo') {
        const owned=db.prepare('SELECT quantity FROM inventory WHERE guild_id=? AND user_id=? AND item_id=?').get(g,u,'hao_photo')?.quantity||0;
        if(owned<1) throw new Error('背包中沒有 Hao 的女僕拍立得，請先到商城購買');
        db.prepare('UPDATE inventory SET quantity=quantity-1 WHERE guild_id=? AND user_id=? AND item_id=?').run(g,u,'hao_photo');
        await i.reply({embeds:[new EmbedBuilder().setColor(0x9C27B0).setTitle('📸 女僕照交換人質').setDescription('你把 Hao 的女僕拍立得遞給迷子……\n迷子盯著照片沉默了幾秒。')]});
        await sleep(1400); releaseFromJail(g,target.id);
        return i.editReply({embeds:[new EmbedBuilder().setColor(0x35C46A).setTitle('🔓 交換成功！').setDescription(`迷子收下女僕照，放走了 ${target}。`)]});
      }
      if(stamina(g,u)<20) throw new Error('救援需要 20 點體力');
      consumeStamina(g,u,20);
      const chance=method==='force'?0.35:0.50;
      const actionText=method==='force'?'你踹開小黑屋大門，準備與迷子正面硬剛！':'你換上精心準備的造型，試圖用色誘轉移迷子的注意力……';
      const rescueImage=jailRescueImageUrl(method);
      const rescueEmbed=new EmbedBuilder().setColor(method==='force'?0xE53935:0xE91E63).setTitle(method==='force'?'🥊 正面救援':'💋 色誘救援').setDescription(actionText);
      await i.reply(jailRescuePayload(rescueEmbed,method));
      await sleep(1500);
      if(Math.random()<chance) {
        releaseFromJail(g,target.id);
        return i.editReply({embeds:[new EmbedBuilder().setColor(0x35C46A).setTitle('🎉 救援成功！').setDescription(`你成功突破迷子的防線，救出了 ${target}！`).setImage(rescueImage)]});
      }
      if(method==='force') {
        const releaseAt=Date.now()+2*60*1000;
        db.prepare('INSERT INTO jail(guild_id,user_id,release_at,reason) VALUES(?,?,?,?) ON CONFLICT(guild_id,user_id) DO UPDATE SET release_at=excluded.release_at,reason=excluded.reason').run(g,u,releaseAt,'正面救援失敗');
        db.prepare('DELETE FROM jail_training WHERE guild_id=? AND user_id=?').run(g,u); db.prepare('DELETE FROM jail_escape WHERE guild_id=? AND user_id=?').run(g,u);
        return i.editReply({embeds:[new EmbedBuilder().setColor(0xD94A4A).setTitle('💥 救援失敗！').setDescription(`你被迷子反制，也被關進小黑屋 **2 分鐘**；${target} 仍未獲救。`).setImage(rescueImage)]});
      }
      return i.editReply({embeds:[new EmbedBuilder().setColor(0xD94A4A).setTitle('🙅 色誘失敗！').setDescription(`迷子完全不為所動，${target} 仍然被關著。你已消耗 20 體力。`).setImage(rescueImage)]});
    }
    if (i.commandName==='減刑') {
      const remaining=jailRemaining(g,u);
      if(!remaining) throw new Error('你目前不在迷子的小黑屋');
      const method=i.options.getString('方式',true);
      if(method==='full') {
        const currentStamina=stamina(g,u);
        if(currentStamina<=0) throw new Error('你目前沒有任何體力可供迷子調教，至少需要 1 點體力');
        const row=new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`jail_full_training:${u}`).setLabel(`接受調教，消耗全部 ${currentStamina} 體力`).setStyle(ButtonStyle.Danger));
        return i.reply({embeds:[new EmbedBuilder().setColor(0x9C27B0).setTitle('🔓 迷子的肉體調教').setDescription(`迷子提出一項更徹底的減刑方案：\n\n消耗：**目前所有 ${currentStamina} 點體力**\n效果：**立即解除全部刑期並出獄**\n目前刑期：${jailText(remaining)}\n\n確認後體力將直接歸零。`)],components:[row]});
      }
      const used=db.prepare('SELECT used FROM jail_training WHERE guild_id=? AND user_id=?').get(g,u)?.used||0;
      if(used) throw new Error('這次服刑已經使用過調教減刑');
      const row=new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`jail_training:${u}`).setLabel('願意，花 20 體力換取減刑').setStyle(ButtonStyle.Danger));
      return i.reply({embeds:[new EmbedBuilder().setColor(0x9C27B0).setTitle('迷子的減刑提議').setDescription(`**你是否願意出賣肉體換取減刑?**\n\n消耗：20 體力\n效果：剩餘刑期減半\n目前刑期：${jailText(remaining)}`)],components:[row]});
    }
    if (i.commandName==='賄絡迷子') {
      const hospitalized=hospitalRemaining(g,u);
      if(hospitalized) throw new Error(`殭屍病毒封鎖了醫院，你還有 ${jailText(hospitalized)} 才能行動`);
      const remaining=jailRemaining(g,u);
      if(!remaining) throw new Error('你目前不在迷子的小黑屋，不需要賄絡');
      if(balance(g,u)<500) throw new Error(`賄絡需要 ${fmt(500)}，你的金幣不足`);
      const staminaAfter=consumeStamina(g,u,5);
      scheduleRandomEvent(i,g,u);
      const next=changeBalance(g,u,-500,'bribe',u,'賄絡迷子');
      const refused=Math.random()<0.45;
      await i.reply({embeds:[new EmbedBuilder().setColor(0xF5B942).setTitle('💰 嘗試賄絡迷子…').setDescription(`你悄悄遞出一袋 **500 金幣**。\n迷子正在考慮……\n體力：${staminaAfter}/${staminaMax(g,u)}`)]});
      await sleep(1600);
      if(refused) {
        return i.editReply({embeds:[new EmbedBuilder().setColor(0xD94A4A).setTitle('🙅 迷子拒絕賄絡！').setDescription(`迷子沒收了 **${fmt(500)}**，但沒有放你出去。\n剩餘服刑：${jailText(jailRemaining(g,u))}\n金庫：${fmt(next)}`)]});
      }
      releaseFromJail(g,u);
      return i.editReply({embeds:[new EmbedBuilder().setColor(0x35C46A).setTitle('🔓 賄絡成功！').setDescription(`迷子收下金幣並偷偷打開小黑屋，你已經恢復自由！\n金庫：${fmt(next)}`)]});
    }
    if (i.commandName==='賺錢') {
      const jailed=jailRemaining(g,u);
      if(jailed) throw new Error(`你被關在迷子的小黑屋，還有 ${jailText(jailed)} 才能行動`);
      const hospitalized=hospitalRemaining(g,u);
      if(hospitalized) throw new Error(`你正在醫院休養，還有 ${jailText(hospitalized)} 才能行動`);
      const job=i.options.getString('工作',true);
      if(!['dishes','hao','trash','move_bricks','clean_jail','taxi','delivery','maid_photos','mystery_powder','burglary','rebar','wire','robbery'].includes(job)) throw new Error('未知的工作');
      if((job==='rebar'||job==='wire') && balance(g,u)<2000) throw new Error(`${job==='wire'?'剪電線':'偷鋼筋'}失敗可能被罰 ${fmt(2000)}，請先準備足夠金幣`);
      if(job==='burglary') {
        const target=i.options.getUser('目標');
        if(target?.bot) throw new Error('不能指定機器人作為闖空門目標');
        if(target?.id===u) throw new Error('不能闖進自己的家');
        const token=randomUUID().slice(0,8);
        const lobby={guildId:g,leaderId:u,targetId:target?.id||null,members:new Set([u]),createdAt:Date.now()};
        burglaryLobbies.set(token,lobby);
        setTimeout(()=>{if(burglaryLobbies.get(token)===lobby) burglaryLobbies.delete(token);},5*60*1000);
        return i.reply({embeds:[burglaryLobbyEmbed(lobby)],components:[burglaryLobbyRow(token)]});
      }
      const legalJob=['dishes','hao','trash','move_bricks','clean_jail','taxi','delivery','maid_photos'].includes(job);
      if(legalJob && legalWorkCount(g,u)>=5) throw new Error('今天的合法打工次數已達 5 次，請明天再來');
      const staminaAfter=consumeStamina(g,u,10);
      scheduleRandomEvent(i,g,u);
      if(job==='robbery') {
        const policeStrategy='evade';
        const escapeEvent=rollEscapeEvent('heist');
        const counterBonus=policeStrategy==='counter'?8:0;
        const policeReinforcements=policeStrategy==='counter'&&Math.random()<0.20;
        const vehicleBonus=assetHeistBonus(g,u);
        const soloEscapeChance=Math.min(100,Math.max(1,soloHeistBaseChance(g)+weeklyHeistBonus()+counterBonus+vehicleBonus+escapeEvent.modifier));
        const escaped=!policeReinforcements&&!escapeEvent.forceFail&&Math.random()*100<soloEscapeChance;
        let next=balance(g,u);
        let robberyEarned=0;
        if(escaped) {
          const before=next;
          next=changeBalance(g,u,SOLO_HEIST_REWARD,'job',u,'搶銀行成功');
          robberyEarned=next-before;
        } else {
          const releaseAt=Date.now()+8*60*1000;
          db.prepare('INSERT INTO jail(guild_id,user_id,release_at,reason) VALUES(?,?,?,?) ON CONFLICT(guild_id,user_id) DO UPDATE SET release_at=excluded.release_at,reason=excluded.reason').run(g,u,releaseAt,'搶銀行失敗');
          db.prepare('DELETE FROM jail_training WHERE guild_id=? AND user_id=?').run(g,u);
          db.prepare('DELETE FROM jail_escape WHERE guild_id=? AND user_id=?').run(g,u);
          changeBalance(g,u,0,'jail',u,'搶銀行失敗，關進小黑屋 8 分鐘');
        }
        await i.reply(heistScenePayload(new EmbedBuilder().setColor(0xE53935).setTitle('🚨 銀行警報響起！').setDescription(`你抓起鈔票衝出銀行……\n🚓 警車正在後方追趕！\n警方應對：**${policeStrategy==='counter'?'🔫 反擊警察':'🏃 專心逃跑'}**\n體力：${staminaAfter}/${staminaMax(g,u)}`),'chase'));
        const chaseFrames=[
          {color:0x1565C0,title:'🔵 警車逼近！',text:'🚓　　💨　　🏃💰'},
          {color:0xE53935,title:'🔴 前方出現封鎖線！',text:'🚧　🏃💰　　🚓'},
          {color:0x1565C0,title:'🔵 追捕持續中！',text:'🚓💨　　　🏃💰'},
          {color:0xE53935,title:'🔴 最後一個路口！',text:'🚓　🚨　🏃💰　❓'}
        ];
        for(const frame of chaseFrames) {
          await sleep(1200);
          await i.editReply({embeds:[new EmbedBuilder().setColor(frame.color).setTitle(frame.title).setDescription(`${frame.text}\n\n**逃脫判定中……**`)]});
        }
        await sleep(1400);
        const soloEventEmbed=new EmbedBuilder().setColor((escapeEvent.forceFail||policeReinforcements)?0xD94A4A:0xF5B942).setTitle(policeReinforcements?'🚨 特勤增援抵達':escapeEvent.title).setDescription(`${policeReinforcements?'你對警方展開反擊，槍聲引來大批特勤增援，所有退路遭到封鎖！':escapeEvent.text}\n\n${escapeEvent.forceFail?'**猛博美撲倒玩家，逃脫直接失敗！**':policeReinforcements?'**反擊失敗，逃脫直接失敗！**':`本次逃脫率：**${soloEscapeChance}%**`}`);
        await i.editReply(escapeEvent.scene?heistScenePayload(soloEventEmbed,escapeEvent.scene):{embeds:[soloEventEmbed]});
        await sleep(1800);
        if(escaped) {
          const announced=await announceHeistSuccess(g,new EmbedBuilder().setColor(0x35C46A).setTitle('🚨 搶劫成功公告').setDescription(`<@${u}> 成功甩開追兵，完成單人銀行搶劫！`).addFields(
            {name:'💰 實際收益',value:fmt(robberyEarned),inline:true},
            {name:'🎯 逃脫成功率',value:`${soloEscapeChance}%`,inline:true},
            {name:'💨 逃脫事件',value:`${escapeEvent.title}\n${escapeEvent.text}`.slice(0,1024)}
          ));
          const payload=heistScenePayload(new EmbedBuilder().setColor(0x35C46A).setTitle('🏦 搶銀行成功！').setDescription(`你成功甩開追兵，實際帶回 **${fmt(robberyEarned)}**！\n\n逃脫事件：**${escapeEvent.title}**\n${escapeEvent.text}\n金庫：${fmt(next)}${announced?'':'\n\n⚠️ 搶劫公告未送達，請管理員重新設定公告頻道並檢查權限。'}`),'success');
          return publishLatestHeistResult(i,payload);
        }
        const failureScene=escapeEvent.scene||(escapeEvent.forceFail?'arrested':'surrounded');
        const payload=heistScenePayload(new EmbedBuilder().setColor(0x1F1F1F).setTitle('🚔 搶銀行失敗！').setDescription(`${escapeEvent.forceFail?`${POLICE_DOG_TEXT}\n猛博美將你撲倒在地，警員立刻上前逮捕。`:'你沒有逃過追捕。'}\n你被關進 **迷子的小黑屋 8 分鐘**。\n期間不能進行任何遊戲或再次賺錢。`),failureScene);
        return publishLatestHeistResult(i,payload);
      }
      if(job==='rebar' || job==='wire') {
        const isWire=job==='wire';
        const item=isWire?'電線':'鋼筋';
        const reward=isWire?5000:4000;
        const sold=Math.random()<0.30;
        await i.reply({embeds:[new EmbedBuilder().setColor(0x607D8B).setTitle(`${isWire?'⚡ 剪電線':'🏗️ 偷鋼筋'}行動中…`).setDescription(isWire?'你趁四下無人剪下電線，正準備離開現場……':'你趁四下無人扛起鋼筋，正準備離開工地……')]});
        await sleep(1500);
        if(sold) {
          const before=balance(g,u), next=changeBalance(g,u,reward,'job',u,`成功把${item}賣出`), actual=next-before;
          return i.editReply({embeds:[new EmbedBuilder().setColor(0x35C46A).setTitle(`💰 ${item}成功賣出！`).setDescription(`你順利把${item}賣掉，獲得 **${fmt(actual)}**！\n金庫：${fmt(next)}`)]});
        }
        const medicalReason=isWire?'剪電線失敗，高壓電休克違法罰款':'偷鋼筋失敗，斷腿違法罰款';
        changeBalance(g,u,-2000,'fine',u,medicalReason);
        const releaseAt=Date.now()+2*60*1000;
        db.prepare('INSERT INTO jail(guild_id,user_id,release_at,reason) VALUES(?,?,?,?) ON CONFLICT(guild_id,user_id) DO UPDATE SET release_at=excluded.release_at,reason=excluded.reason').run(g,u,releaseAt,`${isWire?'剪電線':'偷鋼筋'}被抓`);
        db.prepare('DELETE FROM jail_training WHERE guild_id=? AND user_id=?').run(g,u);
        db.prepare('DELETE FROM jail_escape WHERE guild_id=? AND user_id=?').run(g,u);
        const failureText=isWire?'你被高壓電電到休克，只能住院接受治療。':'你被發現後被打到斷腿，只能進醫院休養。';
        const hospitalEvent=applyHospitalRandomEvent(g,u);
        const hospitalEmbed=new EmbedBuilder().setColor(0xD94A4A).setTitle(`🏥 ${isWire?'剪電線':'偷鋼筋'}失敗！`).setDescription(`${failureText}\n支付違法罰款：**${fmt(2000)}**\n另外關進迷子的小黑屋 **2 分鐘**。${hospitalEvent.text}\n\n金庫：${fmt(balance(g,u))}`);
        if(hospitalEvent.image) {
          hospitalEmbed.setImage(`attachment://${hospitalEvent.image.name}`);
          return i.editReply({embeds:[hospitalEmbed],files:[new AttachmentBuilder(hospitalEvent.image.path,{name:hospitalEvent.image.name})]});
        }
        return i.editReply({embeds:[hospitalEmbed]});
      }
      if(job==='mystery_powder') {
        await i.reply({embeds:[new EmbedBuilder().setColor(0x795548).setTitle('📦 運輸神秘粉末').setDescription(`你接過一箱沒有標籤的神秘粉末，沿著小路前往交貨地點……\n體力：${staminaAfter}/${staminaMax(g,u)}`)]});
        await sleep(1600);
        if(Math.random()<0.60) {
          const reward=3500,before=balance(g,u),next=changeBalance(g,u,reward,'job',u,'運輸神秘粉末成功'),actual=next-before;
          return i.editReply({embeds:[new EmbedBuilder().setColor(0x35C46A).setTitle('📦 神秘貨物送達！').setDescription(`你成功避開巡邏並完成交貨，獲得 **${fmt(actual)}**。\n金庫：${fmt(next)}`)]});
        }
        const fine=Math.min(1500,balance(g,u));
        if(fine) changeBalance(g,u,-fine,'fine',u,'運輸神秘粉末被查獲');
        const releaseAt=Date.now()+2*60*1000;
        db.prepare('INSERT INTO jail(guild_id,user_id,release_at,reason) VALUES(?,?,?,?) ON CONFLICT(guild_id,user_id) DO UPDATE SET release_at=excluded.release_at,reason=excluded.reason').run(g,u,releaseAt,'運輸神秘粉末被查獲');
        db.prepare('DELETE FROM jail_training WHERE guild_id=? AND user_id=?').run(g,u);
        db.prepare('DELETE FROM jail_escape WHERE guild_id=? AND user_id=?').run(g,u);
        return i.editReply({embeds:[new EmbedBuilder().setColor(0xD94A4A).setTitle('🚔 神秘貨物被查獲！').setDescription(`巡邏警員攔下你的車並找到整箱粉末。\n罰款：**${fmt(fine)}**\n關進迷子的小黑屋：**2 分鐘**\n金庫：${fmt(balance(g,u))}`)]});
      }
      if(job==='burglary') {
        const target=i.options.getUser('目標');
        if(target?.bot) throw new Error('不能指定機器人作為闖空門目標');
        if(target?.id===u) throw new Error('不能闖進自己的家');
        const targetText=target?`<@${target.id}> 的住處`:'一間無人住宅';
        await i.reply({embeds:[new EmbedBuilder().setColor(0x455A64).setTitle('🏚️ 闖空門行動中…').setDescription(`你確認四下無人，悄悄摸進 **${targetText}**……\n體力：${staminaAfter}/${staminaMax(g,u)}`)]});
        await sleep(1600);
        if(Math.random()<0.45) {
          if(target) {
            const targetCoins=balance(g,target.id);
            if(targetCoins<=0) return i.editReply({embeds:[new EmbedBuilder().setColor(0xF5B942).setTitle('🕸️ 撲了個空！').setDescription(`<@${target.id}> 的金庫空空如也，你只好兩手空空離開。`)]});
            const stolen=Math.min(3000,targetCoins,Math.max(100,Math.floor(targetCoins*(0.10+Math.random()*0.16))));
            changeBalance(g,target.id,-stolen,'theft',u,`遭 <@${u}> 闖空門`);
            const next=changeBalance(g,u,stolen,'theft',u,`闖入 <@${target.id}> 住處`);
            return i.editReply({embeds:[new EmbedBuilder().setColor(0x35C46A).setTitle('💰 闖空門成功！').setDescription(`你從 <@${target.id}> 的金庫拿走 **${fmt(stolen)}** 並順利離開。\n你的金庫：${fmt(next)}`)]});
          }
          const reward=Math.floor(Math.random()*1801)+1200,before=balance(g,u),next=changeBalance(g,u,reward,'job',u,'闖空門成功'),actual=next-before;
          return i.editReply({embeds:[new EmbedBuilder().setColor(0x35C46A).setTitle('💰 闖空門成功！').setDescription(`你在無人住宅找到值錢物品，變賣後獲得 **${fmt(actual)}**。\n金庫：${fmt(next)}`)]});
        }
        const releaseAt=Date.now()+2*60*1000;
        db.prepare('INSERT INTO jail(guild_id,user_id,release_at,reason) VALUES(?,?,?,?) ON CONFLICT(guild_id,user_id) DO UPDATE SET release_at=excluded.release_at,reason=excluded.reason').run(g,u,releaseAt,'闖空門被逮捕');
        db.prepare('DELETE FROM jail_training WHERE guild_id=? AND user_id=?').run(g,u);
        db.prepare('DELETE FROM jail_escape WHERE guild_id=? AND user_id=?').run(g,u);
        return i.editReply({embeds:[new EmbedBuilder().setColor(0xD94A4A).setTitle('🚨 闖空門失敗！').setDescription(`你觸發警報，被趕來的警員當場逮捕。\n關進迷子的小黑屋：**2 分鐘**`)]});
      }
      if(job==='taxi' && Math.random()<0.15) {
        legalWorkCount(g,u,true);
        const releaseAt=Date.now()+2*60*1000;
        db.prepare('INSERT INTO hospital_lock(guild_id,user_id,release_at,reason) VALUES(?,?,?,?) ON CONFLICT(guild_id,user_id) DO UPDATE SET release_at=excluded.release_at,reason=excluded.reason').run(g,u,releaseAt,'開計程車遭三寶撞傷');
        const hospitalEvent=applyHospitalRandomEvent(g,u);
        const actualRemaining=hospitalRemaining(g,u);
        const accidentEmbed=new EmbedBuilder().setColor(0xD94A4A).setTitle('🚕💥 計程車特殊事件：遇到三寶！').setDescription(`你正常行駛時突然被三寶撞上，只能送醫治療。\n本次沒有獲得工資，需休養 **${jailText(actualRemaining)}**。${hospitalEvent.text}`);
        if(hospitalEvent.image) {
          accidentEmbed.setImage(`attachment://${hospitalEvent.image.name}`);
          return i.reply({embeds:[accidentEmbed],files:[new AttachmentBuilder(hospitalEvent.image.path,{name:hospitalEvent.image.name})]});
        }
        return i.reply({embeds:[accidentEmbed]});
      }
      const jobs={
        dishes:{amount:100,title:'🍽️ 餐廳洗盤子',message:'你把堆積如山的盤子洗乾淨了！'},
        hao:{amount:500,title:'🛁 幫 Hao 搓背',message:'Hao 對你的搓背技術非常滿意！'},
        trash:{amount:500,title:'🗑️ 幫迷子倒垃圾',message:'你幫迷子清空了所有垃圾！'},
        move_bricks:{amount:800,title:'🧱 幫 K 老搬磚',message:'你頂著烈日把整車磚塊搬到工地，K 老滿意地付了工錢！'},
        clean_jail:{amount:600,title:'🧹 幫迷子打掃小黑屋',message:'你把迷子的小黑屋刷得乾乾淨淨，連鐵欄杆都亮到反光！'},
        taxi:{amount:750,title:'🚕 開計程車',message:'你安全載完一整輪客人，還收到了一筆不錯的小費！'},
        delivery:{amount:650,title:'🛵 送外送',message:'你趕在餐點冷掉前送達，顧客給了五星好評！'},
        maid_photos:{amount:1200,title:'📸 幫 Hao 拍女僕寫真',message:'你替 Hao 完成一組女僕寫真，成品意外地大受好評！'}
      };
      const selected=jobs[job];
      if(!selected) throw new Error('未知的工作');
      const earned=selected.amount*workMultiplier(g,u);
      legalWorkCount(g,u,true);
      const before=balance(g,u), next=changeBalance(g,u,earned,'job',u,selected.title), actual=next-before;
      return i.reply({embeds:[new EmbedBuilder().setColor(0x35C46A).setTitle(selected.title).setDescription(`${selected.message}\n獲得 **${fmt(actual)}**\n金庫：${fmt(next)}`)]});
    }
    const jailed=jailRemaining(g,u);
    if(jailed) throw new Error(`你被關在迷子的小黑屋，還有 ${jailText(jailed)} 才能進行遊戲`);
    const hospitalized=hospitalRemaining(g,u);
    if(hospitalized) throw new Error(`你正在醫院休養，還有 ${jailText(hospitalized)} 才能進行遊戲`);
    if(i.commandName==='競速pvp'||i.commandName==='寵物競速pvp') {
      const type=i.commandName==='競速pvp'?'vehicle':'pet';
      const opponent=i.options.getUser('對手',true),bet=i.options.getInteger('下注',true);
      if(opponent.id===u) throw new Error('不能向自己發起 PVP 挑戰。');
      if(opponent.bot) throw new Error('機器人不能參加 PVP 競速。');
      if(activeRaceForUser(g,u)) throw new Error('你已經有一場進行中或等待回應的競賽。');
      if(activeRaceForUser(g,opponent.id)) throw new Error('對手已經有一場進行中或等待回應的競賽。');
      if(!raceChoices(g,u,type).length) throw new Error(type==='vehicle'?'你目前沒有可參賽的汽車或機車。':'你目前沒有可參賽的寵物。');
      if(!raceChoices(g,opponent.id,type).length) throw new Error(type==='vehicle'?'對手目前沒有可參賽的汽車或機車。':'對手目前沒有可參賽的寵物。');
      validBet(g,u,bet);
      const needed=staminaCost(g,u,type==='vehicle'?10:8);
      if(stamina(g,u)<needed) throw new Error(`${i.commandName}需要 ${needed} 點體力`);
      const token=Math.random().toString(36).slice(2,10),expiresAt=Date.now()+60*1000;
      const session={
        guildId:g,type,bet,challengerId:u,opponentId:opponent.id,
        names:{[u]:i.user.globalName||i.user.username,[opponent.id]:opponent.globalName||opponent.username},
        selections:{[u]:null,[opponent.id]:null},status:'pending',charged:false,settled:false,expiresAt
      };
      pvpRaceSessions.set(token,session);
      setTimeout(()=>{const current=pvpRaceSessions.get(token);if(current&&current.status==='pending'&&current.expiresAt<=Date.now()) pvpRaceSessions.delete(token);},61*1000);
      return i.reply({
        content:`<@${opponent.id}>，你收到一場${type==='vehicle'?'競速':'寵物競速'} PVP 挑戰！`,
        embeds:[pvpRaceEmbed(session)],components:[pvpRaceChallengeRow(token)],
        allowedMentions:{users:[opponent.id]}
      });
    }
    if(i.commandName==='競速'||i.commandName==='寵物競賽') {
      const type=i.commandName==='競速'?'vehicle':'pet';
      if(activeRaceForUser(g,u)) throw new Error('你已經有一場進行中或等待回應的競賽。');
      const choices=raceChoices(g,u,type);
      if(!choices.length) throw new Error(type==='vehicle'?'你目前沒有可參賽的汽車或機車，請先到資產商城購買。':'你目前沒有可參賽的寵物，請先到寵物店領養。');
      const bet=i.options.getInteger('下注',true);
      validBet(g,u,bet);
      const needed=staminaCost(g,u,type==='vehicle'?10:8);
      if(stamina(g,u)<needed) throw new Error(`${i.commandName}需要 ${needed} 點體力`);
      const token=Math.random().toString(36).slice(2,10);
      const session={guildId:g,userId:u,type,bet,selectedId:null,running:false,expiresAt:Date.now()+2*60*1000};
      raceSessions.set(token,session);
      setTimeout(()=>{const current=raceSessions.get(token);if(current&&!current.running) raceSessions.delete(token);},2*60*1000+1000);
      return i.reply(raceSelectionPayload(token,session));
    }
    if(i.commandName==='汽車盲盒') {
      const packId=i.options.getString('車包')||'standard',pack=blindBoxPacks[packId];
      if(!pack) throw new Error('找不到這個汽車盲盒車包');
      const quantity=i.options.getInteger('數量')??1,unitPrice=pack.price,total=unitPrice*quantity;
      validBet(g,u,total);
      consumeStamina(g,u,pack.stamina*quantity);
      scheduleRandomEvent(i,g,u);
      changeBalance(g,u,-total,'asset_purchase',u,`購買${pack.name} x${quantity}`);
      const openingEmbed=new EmbedBuilder().setColor(packId==='ford'?0x1565C0:0x7E57C2).setTitle(`🎁 ${pack.name}開箱中…`).setDescription(`購買數量：**${quantity}**\n支付：**${fmt(total)}**\n\n📦 📦 📦\n正在拆開包裝……`);
      const openingPayload={embeds:[openingEmbed]};
      if(pack.preview) {
        const previewName=`${packId}_pack_preview${extname(pack.preview)||'.jpg'}`;
        openingPayload.files=[new AttachmentBuilder(assetPath(pack.preview),{name:previewName})];
        openingEmbed.setImage(`attachment://${previewName}`);
      }
      await i.reply(openingPayload);
      await sleep(900);
      await i.editReply({embeds:[new EmbedBuilder().setColor(0xF5B942).setTitle('✨ 車庫鑰匙正在掉落…').setDescription(`🔑　❔　🔑　❔　🔑\n\n${packId==='ford'?'福特限定車款抽選中……':'隱藏車輛判定中……'}`) ]});
      await sleep(1100);
      const pulls=[];
      for(let n=0;n<quantity;n++) {
        const assetId=drawBlindBoxAssetId(packId);
        const prize=grantAssetPrize(g,u,assetId,1,pack.name);
        pulls.push({assetId,...prize});
      }
      const counts=new Map();
      pulls.forEach(pull=>counts.set(pull.assetId,(counts.get(pull.assetId)||0)+1));
      const hidden=packId==='standard'?pulls.find(pull=>blindBoxHiddenIds.includes(pull.assetId)):null,showcase=hidden||pulls[0],asset=assetCatalog[showcase.assetId];
      const results=[...counts.entries()].map(([assetId,count])=>{const item=assetCatalog[assetId],buffId=ensureAssetBuff(g,u,assetId);return `${item.name} × **${count}**\n└ ${assetBuffs[buffId].name}`;}).join('\n\n');
      const imageName=`${showcase.assetId}${extname(asset.image)||'.jpg'}`,attachment=new AttachmentBuilder(assetPath(asset.image),{name:imageName});
      const packFooter=packId==='ford'?`本次車包：**福特車包**｜展示車款機率：**${blindBoxChanceLabel(showcase.assetId,packId)}**`:'隱藏車總機率：**2%／每盒**（龍貓公車 0.5%、AE86 1.5%）';
      const embed=new EmbedBuilder().setColor(hidden?0xFFD700:packId==='ford'?0x1565C0:0x35C46A).setTitle(hidden?'🎴 隱藏車輛出現！':`🚘 ${pack.name}開箱結果`).setDescription(`${hidden?`🎊 **${asset.name} 以 ${blindBoxChanceLabel(showcase.assetId)} 的機率現身！**\n\n`:''}${results}\n\n所有車輛已停入 \`/車庫\`。\n金庫：**${fmt(balance(g,u))}**\n${packFooter}`).setImage(`attachment://${imageName}`);
      return i.editReply({embeds:[embed],files:[attachment],attachments:[]});
    }
    if(i.commandName==='幸運輪盤') {
      const spin=claimFreeWheelSpin(g,u),weekly=weeklyMysteryInfo(),mysteryId=weekly.assetId,mystery=weekly.asset;
      const extension=mystery.image.split('.').pop(),imageName=`weekly-mystery.${extension}`;
      const attachment=new AttachmentBuilder(assetPath(mystery.image),{name:imageName});
      const mysteryImage=`attachment://${imageName}`;
      const wheelFrames=[
        '🔴｜🟡｜🟢｜🔵｜🟣｜🎁',
        '🎁｜🔴｜🟡｜🟢｜🔵｜🟣',
        '🟣｜🎁｜🔴｜🟡｜🟢｜🔵',
        '🔵｜🟣｜🎁｜🔴｜🟡｜🟢'
      ];
      await i.reply({embeds:[new EmbedBuilder().setColor(0x9C27B0).setTitle('🎡 免費幸運輪盤轉動中…').setDescription(`本次：**免費**｜不消耗體力\n今日剩餘：**${spin.remaining}／3 次**\n本週最大獎：**🎁 隱藏車輛**\n\n${wheelFrames[0]}\n　　　　　▲`).setImage(mysteryImage)],files:[attachment]});
      for(let frame=1;frame<wheelFrames.length;frame++) {
        await sleep(700);
        await i.editReply({embeds:[new EmbedBuilder().setColor(frame%2?0xF5B942:0x9C27B0).setTitle('🎡 免費幸運輪盤轉動中…').setDescription(`${wheelFrames[frame]}\n　　　　　▲\n\n${'▰'.repeat(frame)}${'▱'.repeat(wheelFrames.length-1-frame)}`).setImage(mysteryImage)]});
      }
      await sleep(900);
      const roll=Math.random()*100;
      let reward=0,jackpot=false,resultText;
      if(roll<0.5) {
        jackpot=true;
        const prize=grantAssetPrize(g,u,mysteryId,1,'幸運輪盤最大獎');
        resultText=`🎊 **最大獎！本週隱藏車輛正式揭曉！**\n\n${mystery.name} 已直接停入你的 \`/車庫\`。\n固定增益：**${assetBuffLabel(mysteryId,prize.buffId)}**\n${assetBuffDescription(mysteryId,prize.buffId)}`;
      } else if(roll<1.5) reward=50000;
      else if(roll<6) reward=20000;
      else if(roll<16) reward=10000;
      else if(roll<36) reward=5000;
      else if(roll<60) reward=2000;
      if(!jackpot) {
        if(reward) {
          const before=balance(g,u),after=changeBalance(g,u,reward,'payout',u,'幸運輪盤獎金'),credited=after-before;
          resultText=`🎉 輪盤停在金幣獎格！\n獲得：**${fmt(credited)}**`;
        } else resultText='💨 輪盤停在空獎格，這次沒有獲得獎品。';
      }
      const embed=new EmbedBuilder().setColor(jackpot?0xFFD700:reward?0x35C46A:0x607D8B).setTitle(jackpot?'🏆 幸運輪盤｜傳說大獎':'🎡 幸運輪盤｜開獎結果').setDescription(`${resultText}\n\n今日剩餘：**${spin.remaining}／3 次**\n金庫：**${fmt(balance(g,u))}**\n隱藏車機率：**0.5%**\n車池於每週日 00:00 更新`).setImage(mysteryImage);
      return i.editReply({embeds:[embed]});
    }
    let bingoSelection=null;
    if(i.commandName==='賓果') {
      bingoSelection=i.options.getString('號碼',true).split(/[,，\s]+/).filter(Boolean).map(Number);
      if(bingoSelection.length!==9 || bingoSelection.some(n=>!Number.isInteger(n)||n<1||n>25) || new Set(bingoSelection).size!==9) {
        throw new Error('賓果必須輸入 9 個不重複的 1～25 數字，可用空格、英文逗號或中文逗號分隔，例如：1 3 5 7 9 11 13 15 17');
      }
    }
    const bet=i.options.getInteger('下注',true); validBet(g,u,bet);
    consumeStamina(g,u,10);
    scheduleRandomEvent(i,g,u);
    changeBalance(g,u,-bet,'bet',u,i.commandName);
    if(i.commandName==='射龍門') {
      let a=drawCard(),b=drawCard(); while(b.rank===a.rank)b=drawCard(); if(a.rank>b.rank)[a,b]=[b,a];
      const token=Math.random().toString(36).slice(2,10);
      dragonGateGames.set(token,{userId:u,bet,a,b}); setTimeout(()=>dragonGateGames.delete(token),5*60*1000);
      const gap=b.rank-a.rank-1,risk=gap<=2?'非常危險':gap<=5?'普通':'相當有利';
      const row=new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`dragon_gate:${token}:shoot`).setLabel('射牌').setEmoji('🎯').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(`dragon_gate:${token}:pass`).setLabel('不射，退回下注').setEmoji('✋').setStyle(ButtonStyle.Secondary)
      );
      return i.reply({embeds:[new EmbedBuilder().setColor(0xF5B942).setTitle('🚪 射龍門｜是否射牌？').setDescription(`左門：**${cardText(a)}**\n右門：**${cardText(b)}**\n中間共有 **${Math.max(0,gap)}** 個點數，局勢：**${risk}**\n\n🎯 射牌：抽出第三張牌進行勝負判定\n✋ 不射：放棄本局並退回下注`)],components:[row]});
    }
    if(i.commandName==='刮刮樂') {
      const icons=['💰','💎','⭐','🍀','🔔'];
      const scratched=Array.from({length:3},()=>icons[Math.floor(Math.random()*icons.length)]);
      const counts=new Map(); scratched.forEach(symbol=>counts.set(symbol,(counts.get(symbol)||0)+1));
      const best=Math.max(...counts.values()), payout=best===3?bet*10:best===2?bet*2:0;
      const token=Math.random().toString(36).slice(2,10);
      const ticket={userId:u,bet,icons:scratched,payout,revealed:new Set()};
      scratchTickets.set(token,ticket);
      setTimeout(()=>scratchTickets.delete(token),10*60*1000);
      return i.reply({embeds:[new EmbedBuilder().setColor(0xF5B942).setTitle('🪙 刮刮樂｜手動刮獎').setDescription('點擊下方三個格子，親手逐一刮開圖案！\n三格全部刮開後才會派彩。')],components:[scratchRow(token,ticket)]});
    }
    if(i.commandName==='比大小') {
      const p=drawCard(), d=drawCard();
      let payout=0, result='莊家獲勝。', color=0xD94A4A;
      if(p.value>d.value){payout=bet*2;result='🎉 你贏了！';color=0x35C46A;}
      else if(p.value===d.value){payout=bet;result='🤝 平手，退回下注。';color=0xF5B942;}
      const settlement=settleGamePayout(g,u,bet,payout,i.commandName);
      await i.reply({embeds:[new EmbedBuilder().setColor(0x5865F2).setTitle('🃏 比大小｜準備開牌').setDescription(`**玩家**　　　　　　　　 **莊家**\n\`\`\`\n${hiddenCard()}\n\n${hiddenCard()}\n\`\`\``)]});
      await sleep(1400);
      const reaction=p.value===d.value?null:dealerReaction(p.value>d.value);
      const dogEvent=settlement.dog?'\n\n🐕 **贏錢隨機事件：博美犬叼著你贏來的金幣跑了！本局收益歸 0。**':'';
      const embed=new EmbedBuilder().setColor(color).setTitle('🃏 比大小｜開牌結果').setDescription(`**你的牌：${cardText(p)}**\n\`\`\`\n${playingCard(p)}\n\`\`\`\n**莊家牌：${cardText(d)}**\n\`\`\`\n${playingCard(d)}\n\`\`\`\n${result}${reaction?`\n\n**${reaction.quote}**`:''}${dogEvent}${titleLuckNotice(settlement)}\n\n結算：${payout?`獲得 ${fmt(settlement.credited)}`:`損失 ${fmt(bet)}`}\n金庫：${fmt(balance(g,u))}`);
      if(reaction) {
        const attachment=new AttachmentBuilder(reaction.path,{name:reaction.name});
        embed.setImage(`attachment://${reaction.name}`);
        return i.editReply({embeds:[embed],files:[attachment],components:settlement.dog?[dogChaseRow(u,settlement.stolen)]:[]});
      }
      return i.editReply({embeds:[embed]});
    }
    if(i.commandName==='賽馬') {
      const pick=i.options.getInteger('馬匹',true), finish=20, positions=[0,0,0,0];
      const frames=[];
      while(Math.max(...positions)<finish) {
        positions.forEach((_,n)=>positions[n]+=Math.floor(Math.random()*4)+1);
        frames.push([...positions]);
      }
      const winner=positions.indexOf(Math.max(...positions))+1;
      const payout=pick===winner?bet*4:0;
      const settlement=settleGamePayout(g,u,bet,payout,i.commandName);
      await i.reply({embeds:[new EmbedBuilder().setColor(0x5865F2).setTitle('🏇 賽馬開始').setDescription(`你支持 **${pick} 號馬**｜下注 ${fmt(bet)}\n\n${raceTrack([0,0,0,0],finish)}`)]});
      for(const frame of frames.slice(0,12)) {
        await sleep(900);
        await i.editReply({embeds:[new EmbedBuilder().setColor(0x5865F2).setTitle('🏇 賽馬進行中…').setDescription(`你支持 **${pick} 號馬**｜下注 ${fmt(bet)}\n\n${raceTrack(frame,finish)}`)]});
      }
      const result=pick===winner?`🎉 **${winner} 號馬獲勝，你猜中了！**`:`🏁 **${winner} 號馬獲勝**，你選的是 ${pick} 號馬。`;
      const awarded=Boolean(payout),reaction=dealerReaction(awarded);
      const dogEvent=settlement.dog?'\n\n🐕 **博美犬叼著你贏來的金幣跑了！本局收益歸 0。**':'';
      const embed=new EmbedBuilder().setColor(awarded?0x35C46A:0xD94A4A).setTitle('🏆 賽馬結果').setDescription(`${raceTrack(positions,finish)}\n\n${result}${dogEvent}${titleLuckNotice(settlement)}\n\n**${reaction.quote}**\n結算：${awarded?`獲得 ${fmt(settlement.credited)}`:`損失 ${fmt(bet)}`}\n金庫：${fmt(balance(g,u))}`).setImage(`attachment://${reaction.name}`);
      return i.editReply({embeds:[embed],files:[new AttachmentBuilder(reaction.path,{name:reaction.name})],components:settlement.dog?[dogChaseRow(u,settlement.stolen)]:[]});
    }
    let payout=0, text='', animatedGame=false, gameComponents=[];
    if(i.commandName==='角子機') {
      const symbols=['🍒','🍋','🔔','⭐','💎','7️⃣'];
      animatedGame=true;
      await i.reply({embeds:[new EmbedBuilder().setColor(0x9C27B0).setTitle('🎰 角子機轉動中…').setDescription('╔══════════╗\n║ ❔ │ ❔ │ ❔ ║\n╚══════════╝')]});
      for(let frame=0;frame<4;frame++) {
        await sleep(550);
        const rolling=Array.from({length:3},()=>symbols[Math.floor(Math.random()*symbols.length)]);
        await i.editReply({embeds:[new EmbedBuilder().setColor(frame%2?0xF5B942:0x9C27B0).setTitle('🎰 角子機轉動中…').setDescription(`╔══════════╗\n║ ${rolling.join(' │ ')} ║\n╚══════════╝\n${'▰'.repeat(frame+1)}${'▱'.repeat(3-frame)}`)]});
      }
      const reels=Array.from({length:3},()=>symbols[Math.floor(Math.random()*symbols.length)]);
      const counts=new Map(); reels.forEach(s=>counts.set(s,(counts.get(s)||0)+1));
      const best=Math.max(...counts.values());
      if(best===3) { payout=bet*(reels[0]==='7️⃣'?20:10); text='🎰 三個相同圖案！大獎！'; }
      else if(best===2) { payout=bet*2; text='🎰 兩個相同圖案，你贏了！'; }
      else text='🎰 圖案沒有連線。';
      text=`╔══════════╗\n║ ${reels.join(' │ ')} ║\n╚══════════╝\n${text}`;
    } else if(i.commandName==='大樂透') {
      const chosen=i.options.getInteger('幸運號碼',true), winning=Math.floor(Math.random()*49)+1;
      if(chosen===winning) { payout=bet*40; text='🎊 幸運號碼完全命中！'; } else text='本期沒有中獎。';
      text=`你的號碼：**${String(chosen).padStart(2,'0')}**\n開獎號碼：**${String(winning).padStart(2,'0')}**\n${text}`;
    } else if(i.commandName==='賓果') {
      const card=bingoSelection;
      const drawPool=Array.from({length:25},(_,n)=>n+1);
      for(let x=drawPool.length-1;x>0;x--){const y=Math.floor(Math.random()*(x+1));[drawPool[x],drawPool[y]]=[drawPool[y],drawPool[x]];}
      const drawn=new Set(drawPool.slice(0,12));
      const marked=card.map(n=>drawn.has(n));
      const lines=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
      const bingo=lines.some(line=>line.every(index=>marked[index]));
      if(bingo){payout=bet*4;text='🎉 連成一線，BINGO！';} else text='沒有連成一線。';
      gameComponents=[0,1,2].map(row=>new ActionRowBuilder().addComponents(
        card.slice(row*3,row*3+3).map((number,column)=>{
          const index=row*3+column;
          return new ButtonBuilder().setCustomId(`bingo:${index}:${number}`).setLabel(String(number).padStart(2,'0')).setStyle(marked[index]?ButtonStyle.Success:ButtonStyle.Secondary);
        })
      ));
      text=`🔢 **你的賓果九宮格**\n綠色代表本期開出的號碼。\n\n${text}`;
    } else if(i.commandName==='射龍門') {
      let a=drawCard(),b=drawCard(); while(b.rank===a.rank)b=drawCard(); if(a.rank>b.rank)[a,b]=[b,a];
      const shot=drawCard(), inside=shot.rank>a.rank&&shot.rank<b.rank, post=shot.rank===a.rank||shot.rank===b.rank;
      if(inside){payout=bet*2;text='射中龍門！';} else if(post){text='撞柱！下注全失。';} else text='沒有射中。';
      text=`門牌：**${cardText(a)}｜${cardText(b)}**\n射牌：**${cardText(shot)}**\n${text}`;
    } else if(i.commandName==='大老二') {
      const deck=Array.from({length:52},(_,n)=>({rank:Math.floor(n/4),suit:n%4,value:Math.floor(n/4)*4+n%4}));
      for(let x=deck.length-1;x>0;x--){const y=Math.floor(Math.random()*(x+1));[deck[x],deck[y]]=[deck[y],deck[x]];}
      const hand=deck.slice(0,13).sort((a,b)=>a.value-b.value), top=hand.slice(-5);
      const threshold=40; const win=top.reduce((s,c)=>s+c.value,0)>=threshold*5;
      if(win){payout=bet*2;text='五張最高牌通過本局門檻，你獲勝！';} else text='本局未通過門檻。';
      text=`手牌：${hand.map(cardText).join(' ')}\n最高五張：**${top.map(cardText).join(' ')}**\n${text}`;
    }
    const settlement=settleGamePayout(g,u,bet,payout,i.commandName);
    const now=balance(g,u);
    const isTie=payout===bet,isProfit=payout>bet,reaction=isTie?null:dealerReaction(isProfit);
    const dogEvent=settlement.dog?'\n\n🐕 **贏錢隨機事件：博美犬叼著你贏來的金幣跑了！本局收益歸 0。**':'';
    const embed=new EmbedBuilder().setColor(isProfit?0x35C46A:isTie?0xF5B942:0xD94A4A).setTitle(`🎲 ${i.commandName}`).setDescription(`${text}${reaction?`\n\n**${reaction.quote}**`:''}${dogEvent}${titleLuckNotice(settlement)}\n\n結算：${payout?`獲得 ${fmt(settlement.credited)}`:`損失 ${fmt(bet)}`}\n金庫：${fmt(now)}`);
    if(reaction) {
      embed.setImage(`attachment://${reaction.name}`);
      const payload={embeds:[embed],files:[new AttachmentBuilder(reaction.path,{name:reaction.name})],components:[...gameComponents,...(settlement.dog?[dogChaseRow(u,settlement.stolen)]:[])]};
      return animatedGame?i.editReply(payload):i.reply(payload);
    }
    const finalPayload={embeds:[embed],components:gameComponents};
    return animatedGame?i.editReply(finalPayload):i.reply(finalPayload);
  } catch(e) { const msg=`⚠️ ${e.message}`; if(i.replied||i.deferred) await i.followUp({content:msg,ephemeral:true}); else await i.reply({content:msg,ephemeral:true}); }
});
let lastBankAnnouncement='';
const sundayVaultAnnouncementHours=new Set([12,14,16,18,20,22]);
function taipeiClockParts() {
  return Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Taipei',hourCycle:'h23',year:'numeric',month:'2-digit',day:'2-digit',weekday:'short',hour:'2-digit',minute:'2-digit'}).formatToParts(new Date()).map(part=>[part.type,part.value]));
}
async function announceTomorrowBank() {
  const parts=taipeiClockParts();
  const day=`${parts.year}-${parts.month}-${parts.day}`;
  if(parts.hour!=='12'||Number(parts.minute)>=5||lastBankAnnouncement===day) return;
  lastBankAnnouncement=day;
  const tomorrow=hotBankFor(1),rows=db.prepare('SELECT guild_id,channel_id FROM announcement_channels').all();
  for(const row of rows) {
    try {
      const channel=await client.channels.fetch(row.channel_id);
      if(channel?.isTextBased()) await channel.send({embeds:[new EmbedBuilder().setColor(0xD4AF37).setTitle('📰 明日大量入金情報更新').setDescription(`情報指出，明日將有大量金幣存入：\n\n**${heistBanks[tomorrow.id].name}**\n\n明日成功搶劫該銀行，團隊總獎池 **×2**。`)]});
    } catch(e) { console.error(`銀行情報公告失敗 guild=${row.guild_id}: ${e.message}`); }
  }
}
async function announceSundayCasinoVault() {
  const parts=taipeiClockParts(),hour=Number(parts.hour),minute=Number(parts.minute);
  if(parts.weekday!=='Sun'||!sundayVaultAnnouncementHours.has(hour)||minute>=5) return;
  const slot=`${parts.year}-${parts.month}-${parts.day}T${String(hour).padStart(2,'0')}:00`;
  const rows=db.prepare(`SELECT guild_id,channel_id FROM heist_announcement_channels
    UNION ALL
    SELECT info.guild_id,info.channel_id FROM announcement_channels info
    WHERE NOT EXISTS (SELECT 1 FROM heist_announcement_channels heist WHERE heist.guild_id=info.guild_id)`).all();
  for(const row of rows) {
    const claimed=db.prepare('INSERT OR IGNORE INTO scheduled_announcements(guild_id,kind,slot) VALUES(?,?,?)').run(row.guild_id,'sunday_casino_vault',slot);
    if(!claimed.changes) continue;
    try {
      const channel=await client.channels.fetch(row.channel_id);
      if(!channel?.isTextBased()||typeof channel.send!=='function') throw new Error('設定的頻道不是可發送訊息的文字頻道');
      const current=casinoVaultBalance(row.guild_id),loot=Math.floor(current*0.8);
      const message=await channel.send({embeds:[new EmbedBuilder().setColor(0xFFD700).setTitle('🚨 週日賭場中央寶庫｜即時情報').setDescription(`目前賭場中央寶庫總額：**${fmt(current)}**\n目前可供搶劫金額（80%）：**${fmt(loot)}**\n\n🎰 賭場中央寶庫今日開放團隊搶劫。寶庫金額會隨玩家消費與成功搶劫即時變動。`).setFooter({text:`台北時間 ${String(hour).padStart(2,'0')}:00 定時情報`}).setTimestamp()]});
      if(channel.type===ChannelType.GuildAnnouncement) {
        try { await message.crosspost(); }
        catch(error) { console.error(`週日賭場寶庫公告發布失敗 guild=${row.guild_id}: ${error.message}`); }
      }
    } catch(error) {
      db.prepare('DELETE FROM scheduled_announcements WHERE guild_id=? AND kind=? AND slot=?').run(row.guild_id,'sunday_casino_vault',slot);
      console.error(`週日賭場寶庫公告傳送失敗 guild=${row.guild_id} channel=${row.channel_id}: ${error.message}`);
    }
  }
}
client.once('clientReady',()=>{
  console.log(`已登入：${client.user.tag}`);
  setInterval(announceTomorrowBank,60000);
  setInterval(announceSundayCasinoVault,60000);
  announceTomorrowBank();
  announceSundayCasinoVault();
});
client.login(TOKEN);
