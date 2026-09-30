# 獵魔偶像透明圖層

正式遊戲 [星夜獵魔衣櫥](../idol-hunter-layers.html) 已使用 `model/layers/` 根目錄的透明 PNG。髮型、衣服、襪子、鞋子可各自選擇兩款；髮飾、項鍊、手環可各自開關，共有 **128 種組合**。選好後按「儲存我的造型」，下次開啟會恢復選擇。

## 圖檔與順序

所有圖檔都是 **1135 × 1386、同畫布位置、RGBA 透明背景**。從下到上疊放：

1. `hair-01-back.png` 或 `hair-02-back.png`：後髮。
2. `base.png`：穿深色內搭的人物底稿。
3. `socks-01.png` 或 `socks-02.png`：襪子。
4. `shoes-01.png` 或 `shoes-02.png`：鞋子。
5. `outfit-01.png` 或 `outfit-02.png`：衣服。
6. `necklace-01.png`、`bracelet-01.png`：項鍊與手環。
7. `hair-01-front.png` 或 `hair-02-front.png`：前髮。
8. `hair-accessory-01.png`：髮飾。

新增造型時，沿用 `hair-03-back.png`、`hair-03-front.png`、`outfit-03.png` 等命名；新圖片須保留完整畫布，不要裁切、縮放或移動角色。新增的選項也需要登錄到正式頁、`stage-layered.js` 與 `sw.js`，才能被選取並支援離線使用。

## 素材限制

這批圖層是依**新底稿重新生成及修整**，不是從原本的 `idol-stage-original.png` 精準拆解。`source/` 存放未修原圖，`drafts/` 是修整中間稿；正式頁使用根目錄 PNG。圖層雖已對齊到同一畫布，髮際、袖口、裙腰或襪靴邊緣仍可能看見細小接縫。可在 [草稿試玩頁](preview.html) 檢查組合；若要完全貼合原插畫，仍須原始 PSD／Procreate 分層檔或人工修圖。

若要重做目前的素材修整，依序執行 `build-drafts.ps1`、`refine-drafts.ps1`、`colorize-options.ps1`、`fix-hairline.ps1`，再把 `drafts/` 的 PNG 複製到根目錄。這些腳本會改寫產出的素材，操作前請先備份要保留的版本。
