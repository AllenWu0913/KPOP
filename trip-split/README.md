# 旅伴分帳

給出遊、聚餐、小團體使用的網頁分帳帳本。Python 內建 HTTP server + SQLite，沒有第三方套件。介面支援電腦、iPhone 與 iPad。

## 開始使用

需要 **Python 3.10 以上**。此工作區已有 Python。

1. 雙擊 `start.bat`，保留開啟的視窗。
2. 用瀏覽器開啟 **http://127.0.0.1:8765**。
3. 建立旅程、加入成員，點「記一筆支出」。
4. 在「成員結算」看各人的應付／應收與建議轉帳；實際付款後，點「記錄已付款」。

也可以用 PowerShell：

```powershell
cd C:\allen_game\trip-split
python server.py
```

這是有 SQLite 後端的版本，**直接雙擊 `static/index.html` 不會啟動帳本**。GitHub Pages 可以放前端，但不能執行 Python 後端。

## 不同網路／4G、5G 一起記帳（新增）

已新增個別帳號、單次旅程邀請、旅程權限及五秒同步。**不用雲端資料庫**：網頁放 GitHub Pages，HTTPS 通道連回你電腦的 SQLite。

請依 **[外網設定教學 INTERNET.md](INTERNET.md)** 設定；先 `python manage.py init-admin`，準備 HTTPS 通道與 `data/internet.json`，再用 `start-internet.bat`。還需要在 `static/config.js` 填入自己的 API 網址。電腦必須保持開機；目前尚未替你開通外網服務。

## iPhone／iPad 或旅伴一起記帳

1. 關閉原本啟動視窗（Ctrl+C），改雙擊 `start-lan.bat`。
2. 電腦與手機連上同一個 Wi-Fi。
3. 在手機 Safari 開啟啟動視窗列出的「同一 Wi-Fi 的手機」網址，包含 `?key=...`。
4. 也可由電腦網頁的「分享連線」複製網址給夥伴。
5. 若 Windows 防火牆詢問，可允許 Python 在信任的**私人網路**連線。

資料集中保存在啟動程式的電腦。電腦必須持續運行；手機不在同一網路、電腦休眠或伺服器關閉時，就無法記帳。

`start.bat`／`start-lan.bat` 是原本的本機／信任 Wi-Fi 模式，未使用個別帳號。**LAN 同一把連線金鑰可讀寫所有旅程**；網址裡的旅程 ID 只用來選取旅程。不要把這兩種模式直接對外公開。外網改用上方說明的 **`start-internet.bat`** 帳號模式。

若電腦有多個網路位址（例如 VPN），選擇手機可達的 Wi-Fi 位址。房客網路或 AP 隔離可能阻止裝置互連。

## 已有功能

- 多個旅程，各自管理成員、幣別與帳目。
- 單人代墊或多人共同代墊。
- 平均分攤、依份數分攤、指定每人金額；每筆可只選部分成員。
- 餐飲、交通、住宿、門票活動、購物等分類；依分類與關鍵字篩選。
- 編輯／刪除支出、修改成員姓名，已使用的成員不可直接刪除。
- 自動整理每人已代墊、自己應分攤、已付／已收還款與淨餘額。
- 建議轉帳方向、全額或部分還款、移除誤記的還款。
- CSV 匯出（包含支出與還款，Excel 可讀取）。
- 同一筆支出被別台裝置改過時提示衝突；不直接覆蓋。無編輯視窗開啟時每 5 秒同步其他裝置的更新，也可手動重新整理。
- 儲存請求重試不會重複新增同一筆支出／還款。

## 金額與分攤規則

每個旅程只使用一個幣別，已有帳目後不可變更，**不自動換匯**。支援 TWD、USD、EUR、HKD（2 位小數）與 JPY、KRW（整數）。若台灣出遊想只用整元，直接輸入整數即可；平均分攤仍可能產生小數。

所有計算及 SQLite 欄位使用整數最小貨幣單位。例如 TWD 100.00 儲存為 10000，JPY 100 儲存為 100。

平均／份數分攤採「最大餘數法」分配尾數，相同餘數按成員建立順序決定。例如 TWD 100 三人分攤為 **33.34、33.33、33.33**，合計仍是 100.00。

```text
淨餘額 = 代墊支出 - 自己應分攤 + 已付還款 - 已收還款
正數：還應收錢；負數：還應付錢；零：已結清。
```

建議轉帳以淨餘額整理，不一定和原先每筆代墊的付款方向相同，也不保證數學上的全域最少轉帳筆數。

新增成員不會改分舊帳。修改／刪除支出會重新計算餘額，既有還款紀錄會保留；若還款記錯，可在「還款紀錄」移除。記錄還款只是登記已付款，不會真的執行銀行轉帳。

## 資料庫與備份

正式資料庫：**`data/trips.sqlite3`**，首次啟動自動建立。資料不依賴瀏覽器快取，關閉後再次啟動仍會保留。資料庫、金鑰及備份已加入 `.gitignore`。

建議定期執行：

```powershell
python backup.py
```

這會使用 SQLite 的備份功能建立一致的資料庫快照，存進 `backups/trips-日期時間.sqlite3`；伺服器運行時也可備份。備份檔可另外複製至其他磁碟。

要還原時，先以 Ctrl+C 正常關閉伺服器，把原本 `data` 資料夾改名留存；新建一個空白 `data` 資料夾，再把備份檔複製為 `data/trips.sqlite3` 後重啟。這樣也不會混用舊的 `-wal`／`-shm` 檔。如要沿用原分享金鑰，可把原資料夾的 `access.key` 一起複製回去。不要在伺服器執行時直接覆寫資料庫或只搬動主 DB，因為最新資料可能還在 SQLite 的 `-wal` 檔。

LAN 金鑰保存在 `data/access.key`。如需撤換分享網址，先關閉伺服器，把這個金鑰檔移到備份位置，再以 `start-lan.bat` 啟動以產生新金鑰。

## 其他啟動參數

```powershell
python server.py --port 8766
python server.py --lan --port 8766
python server.py --db D:\TravelData\trips.sqlite3
```

## 程式與檢查

```text
server.py          HTTP API、LAN 金鑰、CSV 匯出
auth.py            個別帳號、登入、旅程權限與邀請
manage.py          本機初始化帳號、重設密碼、接手舊旅程
store.py           分攤與結算規則、SQLite 存取
schema.sql         資料表結構
backup.py          一致性備份工具
static/            網頁 HTML、CSS、JavaScript
tests/             暫存資料庫測試與瀏覽器流程檢查
```

```powershell
python -m unittest discover -s tests -v
python tests/browser_check.py
python tests/internet_browser_check.py
```

測試使用獨立暫存資料庫，不會更動正式帳目。瀏覽器檢查需本機已安裝 Chrome 或 Edge，不會額外下載瀏覽器。
