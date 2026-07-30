import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { REST, Routes, ChannelType } from 'discord.js';

const [filePath] = process.argv.slice(2);
if (!filePath) throw new Error('用法：node scripts/publish_update.js updates/<更新檔案>.json');

const update=JSON.parse(readFileSync(filePath,'utf8'));
if(!update.id||!update.title||!Array.isArray(update.changes)||!update.changes.length) {
  throw new Error('更新檔案必須包含 id、title 與 changes');
}

const token=process.env.DISCORD_TOKEN,defaultGuildId=process.env.GUILD_ID;
if(!token) throw new Error('缺少 DISCORD_TOKEN');

const db=new DatabaseSync('data/casino.sqlite');
db.exec(`CREATE TABLE IF NOT EXISTS update_broadcasts (
  guild_id TEXT NOT NULL, update_id TEXT NOT NULL, channel_id TEXT NOT NULL,
  message_id TEXT,
  sent_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (guild_id,update_id,channel_id)
)`);
try { db.exec('ALTER TABLE update_broadcasts ADD COLUMN message_id TEXT'); } catch {}

const rest=new REST({version:'10'}).setToken(token);
const guildIds=defaultGuildId
  ? [defaultGuildId]
  : (await rest.get(Routes.userGuilds())).map(guild=>guild.id);

// 更新公告只允許發布到專用公告頻道，避免一般賭場聊天頻道被系統日誌洗版。
const requestedNames=['賭場公告'];
let sent=0,skipped=0;

for(const guildId of guildIds) {
  const channels=await rest.get(Routes.guildChannels(guildId));
  const textChannels=channels.filter(channel=>[ChannelType.GuildText,ChannelType.GuildAnnouncement].includes(channel.type));
  const targets=requestedNames.map(name=>
    textChannels.find(channel=>channel.name===name)
    ?? textChannels.find(channel=>channel.name.includes(name))
  ).filter(Boolean);
  const uniqueTargets=[...new Map(targets.map(channel=>[channel.id,channel])).values()];
  if(!uniqueTargets.length) {
    console.warn(`guild=${guildId} 找不到頻道：${requestedNames.join('、')}`);
    console.warn(`可用文字頻道：${channels.filter(channel=>[ChannelType.GuildText,ChannelType.GuildAnnouncement].includes(channel.type)).map(channel=>`#${channel.name}(${channel.id})`).join('、')}`);
    continue;
  }
  for(const channel of uniqueTargets) {
    const exists=db.prepare('SELECT 1 FROM update_broadcasts WHERE guild_id=? AND update_id=? AND channel_id=?').get(guildId,update.id,channel.id);
    if(exists) {
      skipped++;
      console.log(`SKIP guild=${guildId} channel=#${channel.name} update=${update.id}`);
      continue;
    }
    const description=[
      update.summary||'本次更新已完成並正式上線。',
      '',
      '**更新內容**',
      ...update.changes.map(change=>`• ${change}`),
      update.note?`\\n**備註**\\n${update.note}`:''
    ].filter(Boolean).join('\n').slice(0,4096);
    const message=await rest.post(Routes.channelMessages(channel.id),{body:{
      embeds:[{
        color:0xD4AF37,
        title:`📢 ${update.title}`,
        description,
        fields:[
          {name:'版本',value:String(update.version||update.id),inline:true},
          {name:'上線日期',value:String(update.date||new Intl.DateTimeFormat('zh-TW',{timeZone:'Asia/Taipei',dateStyle:'medium'}).format(new Date())),inline:true}
        ],
        footer:{text:'澳門最大賭場｜系統更新日誌'},
        timestamp:new Date().toISOString()
      }]
    }});
    if(channel.type===ChannelType.GuildAnnouncement) {
      try { await rest.post(Routes.channelMessageCrosspost(channel.id,message.id)); }
      catch(error) { console.warn(`公告交叉發布失敗 channel=${channel.id}: ${error.message}`); }
    }
    db.prepare('INSERT INTO update_broadcasts(guild_id,update_id,channel_id,message_id) VALUES(?,?,?,?)').run(guildId,update.id,channel.id,message.id);
    sent++;
    console.log(`SENT guild=${guildId} channel=#${channel.name} update=${update.id}`);
  }
}

console.log(`更新推播完成：成功 ${sent}，略過 ${skipped}`);
