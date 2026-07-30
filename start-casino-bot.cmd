@echo off
cd /d "E:\DC BOT\casino-bot-portable"
"C:\Program Files\nodejs\node.exe" src\index.js >> logs\bot.stdout.log 2>> logs\bot.stderr.log
