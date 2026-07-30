# 賭場 Bot 可攜版安裝說明

這份封裝可將 Discord 賭場 Bot、全部正式圖片素材、互動網站原始碼與玩家資料搬到另一台 Windows 電腦。

## 封裝內容

- `src/`、`scripts/`、`assets/`、`updates/`：Bot 程式、工具、正式素材與更新公告。
- `activity/`：車庫、麻將、刮刮樂等互動網站原始碼及已建置檔案。
- `data/casino.sqlite`：封裝當下從正式伺服器建立的一致性玩家資料快照。
- `Dockerfile`、`docker-compose.yml`：建議使用的容器部署方式。
- `.env.example`：不含密碼的設定範本。

封裝不包含 Discord Token、SSH 金鑰、`.env`、Git 紀錄、`node_modules`、開發暫存檔或快取。

## 建議方式：Docker Desktop

1. 在新電腦安裝 Docker Desktop，並啟用 WSL 2。
2. 解壓縮到固定位置，例如 `C:\casino-bot`。
3. 開啟 PowerShell，進入專案：

   ```powershell
   Set-Location C:\casino-bot
   Copy-Item .env.example .env
   notepad .env
   ```

4. 在 `.env` 填入：

   - `DISCORD_TOKEN`：Discord Bot Token。
   - `CLIENT_ID`：Discord Application ID。
   - `GUILD_ID`：測試或正式 Discord 伺服器 ID。
   - `ACTIVITY_SIGNING_SECRET` 與 `ACTIVITY_BACKEND_SECRET`：兩組不同的長隨機字串。
   - `ACTIVITY_PUBLIC_URL`：互動網站的正式網址。

5. 啟動並重建：

   ```powershell
   docker compose up -d --build
   docker compose ps
   docker logs --tail 100 discord-casino
   ```

6. 日誌出現 `已登入：澳門最大賭場` 即表示 Bot 已成功啟動。

## 玩家資料

`data/casino.sqlite` 已包含封裝當下的玩家金幣、資產、寵物、貸款、航空公司、更新推播紀錄及其他遊戲狀態。

- 要延續正式資料：保留此檔案後直接啟動。
- 要建立全新伺服器：先把 `data/casino.sqlite` 改名備份，再啟動 Bot。
- 移動後請定期備份整個 `data/` 目錄。

## 互動網站

網站原始碼位於 `activity/`。本機測試方式：

```powershell
Set-Location C:\casino-bot\activity
npm ci
npm run dev
```

原本已公開的網站部署不會因換電腦自動轉移或下線；若要以新專案重新發布，需重新設定網站託管及 `ACTIVITY_PUBLIC_URL`。

## 不使用 Docker

需要 Node.js 22、Python 3、Pillow 與可顯示中文的 Noto CJK 字型：

```powershell
Set-Location C:\casino-bot
npm ci
npm run check
npm start
```

Docker 方式已包含 Python、Pillow 與中文字型，最不容易遇到圖片渲染環境問題。

## 移機注意事項

- 不要在新舊電腦同時使用同一個 Discord Bot Token 啟動 Bot，否則兩個程序會同時回覆指令。
- 確認新電腦正常運行後，再停止舊主機：

  ```powershell
  docker compose down
  ```

- `.env`、Bot Token 與 SSH 金鑰不可上傳到 GitHub、雲端公開連結或傳給其他人。
- 若 Discord 指令仍顯示舊版，確認 `.env` 的 `CLIENT_ID`、`GUILD_ID` 正確後重新執行 `docker compose up -d --build`。
