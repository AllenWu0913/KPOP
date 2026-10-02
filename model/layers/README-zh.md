# 獵魔偶像透明圖層

正式遊戲 [星夜獵魔衣櫥](../idol-hunter-layers.html) 使用此資料夾根目錄的透明 PNG。以 `base.png` 為共同底圖，目前有 2 種髮型、3 套衣服（學園制服與兩套 K-pop 裝）、5 雙鞋、3 種襪、4 款髮飾、2 款項鍊和 4 款手環。各類都可選擇不加；按「從底圖開始」可清空，再逐件添加。

高跟鞋 `shoes-03.png` 僅搭配透膚長襪 `socks-03.png` 或不穿襪子；換成厚底靴、平底鞋或球鞋時，會自動改回白紫／深色襪，不相容襪款會暫時停用。

## 圖層檔案與堆疊順序

所有正式素材都是 **1135 × 1386、同畫布位置、RGBA 透明背景**。由下往上疊放：

1. `hair-01-back.png` 或 `hair-02-back.png`：後髮。
2. `base.png`：人物底稿。
3. `socks-01.png` 至 `socks-03.png`：襪子；03 專為高跟鞋設計。
4. `shoes-01.png` 至 `shoes-05.png`：鞋子；03 是高跟鞋，04 是學園平底鞋，05 是球鞋。
5. `outfit-01.png` 至 `outfit-03.png`：兩套 K-pop 衣服和一套學園制服。
6. `necklace-01.png`／`necklace-02.png`、`bracelet-01.png` 至 `bracelet-04.png`：項鍊與手環。手環依衣服選用原版、`-outfit-02` 或 `-base` 對齊版本。
7. `hair-01-front.png` 或 `hair-02-front.png`：前髮。
8. `hair-accessory-01.png` 至 `hair-accessory-04.png`：髮飾疊在前髮之上；01／02 搭短髮時會改用 `-hair-02` 對齊版本。

新增款式時，保留 1135 × 1386 完整畫布，不要裁切或移動角色；並更新 `stage-layered.js` 選項和 `sw.js` 離線快取清單。

## 素材說明

圖層依新底稿製作，並非從舊的 `idol-stage-original.png` 精準拆出。`source/` 留有學生裝及新鞋款的原始生成圖；根目錄素材是對齊後供遊戲使用的版本。髮際、袖口或襪靴交界仍可能看見細小接縫。
