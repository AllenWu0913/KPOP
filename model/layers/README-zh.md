# 獵魔偶像透明圖層

正式遊戲 [星夜獵魔衣櫥](../idol-hunter-layers.html) 使用此資料夾根目錄的透明 PNG。造型目前有 2 種髮型、2 套衣服、3 種鞋款、3 種襪款，以及髮飾、項鍊、手環各 2 款；每種飾品也都能選擇不佩戴。

高跟鞋 `shoes-03.png` 會自動搭配露趾、透膚長襪 `socks-03.png`。換回任一厚底靴時，遊戲會恢復換高跟鞋前使用的襪子；高跟鞋不相容的襪款會暫時停用。共有 **540 種有效組合**。

## 圖層檔案與堆疊順序

所有正式素材都是 **1135 × 1386、同畫布位置、RGBA 透明背景**。由下往上疊放：

1. `hair-01-back.png` 或 `hair-02-back.png`：後髮。
2. `base.png`：人物底稿。
3. `socks-01.png` 至 `socks-03.png`：襪子；03 專為高跟鞋設計。
4. `shoes-01.png` 至 `shoes-03.png`：鞋子；03 是高跟鞋。
5. `outfit-01.png`、`outfit-02.png`：衣服。
6. `necklace-01.png`／`necklace-02.png`、`bracelet-01.png`／`bracelet-02.png`：項鍊與手環。
7. `hair-01-front.png` 或 `hair-02-front.png`：前髮。
8. `hair-accessory-01.png` 或 `hair-accessory-02.png`：髮飾。

新增款式時，保留 1135 × 1386 完整畫布，不要裁切或移動角色；並更新 `stage-layered.js` 選項和 `sw.js` 離線快取清單。

## 素材說明

圖層依新底稿製作，並非從舊的 `idol-stage-original.png` 精準拆出。`source/` 留有原始生成圖；根目錄素材是對齊後供遊戲使用的版本。髮際、袖口或襪靴交界仍可能看見細小接縫。
