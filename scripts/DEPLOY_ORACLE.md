# Oracle 一鍵增量部署

在正式 E 槽專案根目錄執行：

```powershell
.\scripts\deploy_oracle.ps1
```

若本次有玩家公告：

```powershell
.\scripts\deploy_oracle.ps1 -UpdateFile updates/2026-08-01-example.json
```

腳本會依 Oracle 的 `.deployed_commit` 與目前 Git `HEAD` 計算差異，只打包新增或修改的部署檔，並安全處理 Git 中已刪除的檔案。完整流程包含：

1. 本機 JavaScript 語法與回歸測試。
2. 推送目前提交至 GitHub `main`。
3. 建立受限權限的臨時 SSH 金鑰副本。
4. 增量封裝及傳送變更檔案。
5. SQLite `VACUUM INTO` 一致性備份與完整性檢查。
6. 建立舊 Docker 映像回滾標籤。
7. BuildKit 建置、隔離容器測試及指令定義驗證。
8. 切換正式容器並確認 Discord 登入與映像一致。
9. 選擇性發布公告、寫入部署版本並清理暫存。
10. 同步更新檔案到 E 槽可攜版。

效能最佳化：

- `assets/`、網頁素材、更新檔與腳本改由 Oracle 專案唯讀掛載，Docker 映像不再攜帶整包圖片。
- 只有圖片、公告、前端素材或測試檔變更時會跳過 Docker 重建；`src/`、依賴、Dockerfile 或 Compose 變更仍會完整建置。
- 即使跳過建置，仍會執行隔離測試、指令建置檢查、容器重建與登入確認。

安全規則：

- 金鑰內容不會顯示、寫入 Git 或保存在 C 槽。
- 即將部署的檔案若有未提交修改，腳本會停止。
- 新映像測試失敗時不會切換正式容器。
- Oracle 失敗暫存會保留供診斷；成功後自動清理。
- 資料庫備份與回滾映像不會自動刪除。
