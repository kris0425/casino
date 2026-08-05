# GitHub Actions 自動部署 Oracle

工作流檔案：`.github/workflows/deploy-oracle.yml`。

每次推送到 `main` 時會依序執行：

1. 安裝 Node.js 22 依賴並執行  `node --check src/index.js` 與 `npm test`。
2. 讀取 Oracle 的 `.deployed_commit`，只打包該提交之後變更的部署檔案。
3. 透過 SSH 上傳增量封包，執行既有的備份、Docker 建置、回歸測試、重啟與登入確認。
4. 自動發布本次 `updates/*.json` 公告，並寫入新的部署標記。

## 必要 GitHub Secrets

在 repository 的 **Settings → Secrets and variables → Actions** 建立：

- `ORACLE_HOST`：`ubuntu@161.33.185.80`
- `ORACLE_SSH_KEY`：Oracle SSH 私鑰完整內容（只存 Secret，不要提交檔案）
- `ORACLE_KNOWN_HOSTS`：執行 `ssh-keyscan -H 161.33.185.80` 的完整輸出

`ORACLE_KNOWN_HOSTS` 用來固定主機指紋，避免工作流使用未驗證的主機金鑰。工作流不會把 Secret 輸出到 log。

## 首次推送的 GitHub 權限

若目前 GitHub 登入使用的是 OAuth 應用，首次推送包含 `.github/workflows/*.yml` 時，必須重新授權該應用的 **workflow** scope；否則 GitHub 會拒絕更新工作流檔案。完成授權後重新執行 `git push origin HEAD:main` 即可，之後一般程式更新不需再次授權。

## 手動發布

在 **Actions → Deploy Discord Casino to Oracle → Run workflow** 執行；若要指定公告，可在 `update_file` 填入例如：

`updates/2026-08-05-limited-auction-vehicles.json`

留空時會自動選擇本次提交變更的最後一個 `updates/*.json` 檔案。部署成功會顯示 `GITHUB_ACTIONS_DEPLOY_OK`，Oracle 端同時會顯示 `ORACLE_DEPLOY_OK`。
