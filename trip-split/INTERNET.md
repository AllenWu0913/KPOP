# 不用雲端資料庫，讓旅伴用各自的手機網路記帳

程式已支援「GitHub Pages 網頁 + 自己電腦的 Python API + SQLite」。帳目與帳號存在 `data/trips.sqlite3`，不需要 Supabase、Firebase 或其他雲端資料庫。

**尚需你設定 HTTPS 通道與網站網址；光 push 程式不會讓家中電腦自動連上外網。** 本專案沒有替你開通通道、註冊網域、安裝背景服務或開放防火牆。

```text
每個人的 Safari／Chrome（4G、5G 或不同 Wi-Fi）
                │
                ├── GitHub Pages：顯示網頁
                │
                └── HTTPS API 網址
                         │ HTTPS 通道（例如 Cloudflare Tunnel）
                         └── 你的電腦 127.0.0.1:8765 → SQLite
```

Cloudflare 在此只用來轉送 HTTPS 請求，**不是雲端資料庫**；資料流量仍會經過該服務，並不代表完全不使用第三方雲端。若不希望經過中繼服務，需要自己管理有公開 HTTPS 的伺服器／反向代理。

## 1. 建立你的首個帳號（只做一次）

先關閉舊的 Python 啟動視窗；若已有正式帳目，先執行 `python backup.py` 備份。

```powershell
cd C:\allen_game\trip-split
python manage.py init-admin
```

依畫面輸入帳號、顯示名稱、密碼（至少 12 個字元）。密碼不顯示、不放進命令列，也不會被寫進 GitHub。第一次建立帳號時，**原有的旅程會交給你管理，帳目不會清空**。

其他人不能自由註冊；必須有你產生的旅程邀請。每個帳號都可建立自己的旅程，沒有可偷看所有人帳本的網站管理員功能。

## 2. 準備 HTTPS 通道

### 建議：固定網址，適合持續使用

依 [Cloudflare Tunnel 官方入門](https://developers.cloudflare.com/tunnel/get-started/) 建立通道。這個方式需要 Cloudflare 帳號，以及已加入 Cloudflare 的網域。

1. 在電腦依官方指引安裝 `cloudflared`。
2. 在 Cloudflare 控制台建立 Tunnel，依控制台指引在你的電腦執行連線程式。
3. 新增公開應用程式路由，例如 `split-api.你的網域`。
4. 服務類型選 **HTTP**，位址填 **`localhost:8765`**（或 `127.0.0.1:8765`）。若有設定覆寫 HTTP Host Header，必須使用該公開 API 主機名稱，不要填不在程式允許清單內的其他名稱。
5. Cloudflare 提供對外的 HTTPS；Python 仍只監聽本機 HTTP，不需設定路由器轉發 8765。

通道 token 是秘密：不要放入 `static/config.js`、GitHub、聊天訊息或分享網址。若安裝常駐服務，請按官方控制台指引在你自己的電腦完成；本專案不會自動安裝服務。

### 只想先試用：臨時網址

沒有網域可先按照 [Quick Tunnels 官方說明](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/) 使用：

```powershell
cloudflared tunnel --url http://127.0.0.1:8765
```

**先確認沒有舊版無帳號伺服器在 8765 埠運行，再開啟通道。** 此時還沒啟動下方帳號模式伺服器，顯示暫時無法連線是正常的。

通道視窗會給你一個隨機 `https://....trycloudflare.com` 網址。把這個網址用於以下設定，再啟動帳號模式。每次重啟可能換網址，要重新修改兩處設定；這是測試方式，不適合長期分享固定帳本。

## 3. 設定電腦上的後端

把 `internet.example.json` 複製成 **`data/internet.json`**。這個檔案在忽略清單中，不會上傳 GitHub。

```json
{
  "public_url": "https://split-api.你的網域",
  "allowed_origins": ["https://你的帳號.github.io"]
}
```

- `public_url`：步驟 2 的 HTTPS 通道網址，不含路徑，不加 `/api`。
- `allowed_origins`：GitHub Pages 的「網站來源」，**不要包含儲存庫／資料夾路徑**。自訂 Pages 網域就填自訂來源。可填多個，但不要用 `*`。

例如你的網頁是 `https://allen.github.io/games/trip-split/static/`，來源填 `https://allen.github.io`。

啟動：

```powershell
python server.py --internet data\internet.json
```

或雙擊 **`start-internet.bat`**。Python 視窗和通道視窗都要保持運行。請勿使用舊的 `start.bat`／`start-lan.bat` 當外網後端，因為這兩個模式不是個別帳號權限模式。

先在本機 `http://127.0.0.1:8765` 測試登入，再到 `https://你的API網址/api/config` 檢查能否看到 JSON，且 `account_auth` 為 `true`。其他旅程 API 仍必須登入，直接開啟 `/api/trips` 會得到 401，這是正常的。

## 4. 設定 GitHub 上的網頁

編輯 **`static/config.js`**：

```javascript
window.TRIP_CONFIG = {
  apiBase: 'https://split-api.你的網域'
};
```

這個公開網址不是秘密，**只填 API 網址，不要填帳號密碼、資料庫檔案或通道 token**。

將程式 push 到原本已啟用 Pages 的儲存庫。如果 Pages 發布的是儲存庫根目錄，可開：

```text
https://你的帳號.github.io/儲存庫名稱/trip-split/
```

入口會轉到 `trip-split/static/`。如果你把 `static` 內容單獨部署成另一個 Pages 網站，直接開該網站首頁即可。原有其他遊戲不需移除。

本機 Python 送出的 `config.js` 會自動使用自己的 API，不會因 GitHub 設定的 `apiBase` 而繞到外網；GitHub 上的靜態副本才使用你填入的網址。

目前保留原本 buildless 檔案，不需要 npm 建置。不會自動替你 push 或變更 GitHub Pages 設定。

## 5. 邀旅伴一起輸入

1. 在 GitHub Pages 網頁用自己的帳號登入，建立旅程。
2. 點 **分享連線 → 產生一人份邀請 → 複製分享網址**。
3. 每份邀請只能使用一次，七天後失效；每個人各產生一份。
4. 朋友在自己的手機開連結，可以建立帳號並加入；已有帳號就選「已有帳號？直接登入」。亦可登入後用「加入旅程」貼上邀請。
5. 朋友只能讀寫獲邀的旅程。新增支出後，其他人無編輯視窗開啟時，約五秒輪詢同步；手機切回前景也會更新。
6. 旅程建立者可撤銷未使用的邀請，或移除已加入帳號的權限。移除權限不會刪除歷史帳目。

帳號權限與「分攤名單」是兩回事。分攤名單可包含沒有帳號的家人、小孩；開帳號不會自動新增或改名分攤成員。共同編輯者可記帳、編輯／刪除支出與還款及管理分攤名單；只有旅程建立者能更改旅程設定、刪除旅程、邀人或移除帳號權限。請只邀請信任的人。

## 之後更新與日常使用

- **HTML／CSS／JS**：修改後 push，等待 GitHub Pages 更新。API 網址不變就不用再改設定。
- **Python／資料表程式**：除了更新原始碼，還要在電腦重新啟動 Python；只 push 不會更新正在執行的後端。
- **記帳資料**：寫入本機 SQLite，不會寫入 GitHub，也不需每筆 push。
- **持續使用**：電腦要開機、連網且不休眠，Python 和 HTTPS 通道要運行。不要把筆電帶離網路後期待其他人仍可記帳。
- **備份**：定期 `python backup.py`，將備份另外保管；備份含帳號雜湊與登入紀錄，仍應視為私人資料。
- **登入保留**：憑證存在目前分頁的 sessionStorage，伺服器端最長十四天到期；關閉分頁／瀏覽器後可能需要重新登入。帳目不會因此消失。
- **無網路時**：目前不做離線排隊。沒有成功儲存提示就不能視為已記帳；請保留表單，恢復連線後再儲存。不要在斷線時關掉分頁。
- **多人編輯同一筆**：保留版本檢查，較舊的編輯會提示衝突，不會直接覆寫新版本。

忘記密碼時，只能由你在資料所在的電腦執行：

```powershell
python manage.py reset-password
```

它會撤銷該帳號所有裝置的登入。若後來用本機模式建立新旅程，而外網模式提示有未分配權限的舊旅程，先執行 `python manage.py claim-trips`，輸入要接手旅程的帳號。

## 安全與限制

- 這是供信任旅伴使用的小型自架工具，不是已做資安稽核的公開商業服務；不要拿來提供陌生人大量註冊。外網必須透過 HTTPS，禁止直接開放 Python 埠到網際網路。
- 密碼使用隨機鹽的 scrypt 雜湊；登入 token、邀請碼在 DB 只存雜湊。伺服器有登入次數／雜湊並行限制、限定來源的 CORS、逐旅程權限及基本主機名稱檢查。
- 不使用跨網站 Cookie，避免手機第三方 Cookie 設定影響；Bearer token 也不可分享給其他人。
- CORS 只限制瀏覽器跨站請求，不等同防火牆或登入保護。請勿把密碼放入前端。
- GitHub Pages 與 API 不同來源時，只有 `allowed_origins` 列出的網頁可在瀏覽器呼叫。設定錯誤會顯示連線問題；檢查完整 HTTPS 來源、通道狀態、主機名稱與電腦休眠。
- 手機舊畫面可能仍保留之前讀到的資料；撤銷權限會阻止後續 API 存取，但不能收回對方已看過、匯出或截圖的內容。
- Python 使用內建 HTTP server，以保持零第三方套件；若要服務大量人員或長期公開營運，應改用正式應用伺服器、部署監控、備份排程及額外安全審查。

## 驗證

```powershell
python -m unittest discover -s tests -v
python tests/browser_check.py
python tests/internet_browser_check.py
```

最後一項使用兩個不同本機來源模擬 Pages／API，實際檢查 CORS、子路徑、帳號登入、邀請註冊、私人旅程隔離、輪詢同步與移除存取權。測試都使用暫存 DB，不會動到正式帳目。**本機測試通過不代表已完成真實 HTTPS 通道、GitHub Pages 或 iPhone 行動網路的端到端驗證。**
