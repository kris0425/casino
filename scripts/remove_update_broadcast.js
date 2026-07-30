import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { REST, Routes, ChannelType } from 'discord.js';

const [filePath,channelName='賭場'] = process.argv.slice(2);
if(!filePath) throw new Error('用法：node scripts/remove_update_broadcast.js updates/<更新檔案>.json [頻道名稱]');

const update=JSON.parse(readFileSync(filePath,'utf8'));
const token=process.env.DISCORD_TOKEN,guildId=process.env.GUILD_ID;
if(!token||!guildId) throw new Error('缺少 DISCORD_TOKEN 或 GUILD_ID');

const rest=new REST({version:'10'}).setToken(token);
const channels=await rest.get(Routes.guildChannels(guildId));
const textChannels=channels.filter(entry=>[ChannelType.GuildText,ChannelType.GuildAnnouncement].includes(entry.type));
const channel=textChannels.find(entry=>entry.name===channelName)
  ?? textChannels.find(entry=>entry.name.includes(channelName));
if(!channel) throw new Error(`找不到頻道：${channelName}`);

const expectedTitle=`📢 ${update.title}`;
const messages=await rest.get(Routes.channelMessages(channel.id),{query:new URLSearchParams({limit:'100'})});
const matches=messages.filter(message=>message.embeds?.some(embed=>embed.title===expectedTitle&&embed.footer?.text==='澳門最大賭場｜系統更新日誌'));

for(const message of matches) {
  await rest.delete(Routes.channelMessage(channel.id,message.id));
  console.log(`DELETED channel=#${channel.name} message=${message.id} update=${update.id}`);
}

const db=new DatabaseSync('data/casino.sqlite');
db.prepare('DELETE FROM update_broadcasts WHERE guild_id=? AND update_id=? AND channel_id=?').run(guildId,update.id,channel.id);
console.log(`公告撤回完成：刪除 ${matches.length} 則`);
