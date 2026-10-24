# 上線前第二輪試玩回饋

測試日期：2026-10-24，台北時間 13:18–13:41 為主要試玩流程。網址：https://qa.spin-doctor-tw.pages.dev/

角色：30 歲台灣上班族，看得懂政治迷因，不熟卡牌遊戲。朋友叫我來救藍營。我選藍營，第一場輸、第二場贏，完整選戰第一關也過了。

**我的結論：遊戲有梗、主要流程能玩完，但先修計分再上線。** 第二場明明寫「練習不計分」，最後卻登上第一名、幫陣營加分。這會直接打掉「拉朋友來救票」的可信度。證據：[061](061-quick2-practice-confirmed.png)、[062](062-quick2-result-bottom.png)、[100](100-leaderboard-today.png)。

## 1. 阻斷級問題

### B1｜首場／練習場資格與實際榜單結果對不上

這是本輪最該擋上線的問題。不是分數跑動畫時暫時不同，是結果穩定後仍然互相矛盾。

**重現步驟：**

1. 依 BRIEF 設定 `spin_local` 的測試裝置編號，進站完成開場。
2. 第一次快打選藍營、選「講稿機啟動」，完整走教學並打到落選結算。
3. 成績頁顯示得票 26,514、操盤加分 10,000，總分 36,514，並說「你為藍藍路黨貢獻了 36,514 票」。輸入 `QA午休救援`，按「登上今日榜」。
4. 等待上傳後，文案卻改成「練習場不算進陣營戰」「練習成績已記錄（不列入排名）」。
5. 回首頁，畫面寫「今天已出戰：36,514 票｜再玩一次是練習」。接著再玩藍營快打，這次選「賽立答B」。
6. 第二場勝選，成績頁起初明寫「練習場不算進陣營戰」「練習成績（不計分）」。稍後卻變成「已登上今日榜」「今日第 1 名（共 3 人）」，並說貢獻 102,185 票。
7. 藍營榜單總分從 **90,466 → 192,651，增加的正好是第二場 102,185**。回首頁再開排行榜，那筆第一名仍然存在；首頁個人票數卻仍寫首場 36,514。

**截圖證據：**

- 首場原本說有貢獻、可登榜：[031-score-name-focus.png](031-score-name-focus.png)
- 首場送出後被改成練習：[034-score-upload-response.png](034-score-upload-response.png)
- 再玩之前已明說是練習：[049-home-before-practice.png](049-home-before-practice.png)
- 第二場起初標不計分：[061-quick2-practice-confirmed.png](061-quick2-practice-confirmed.png)
- 第二場卻登榜、加陣營分，而且灰色按鈕還寫不計分：[062-quick2-result-bottom.png](062-quick2-result-bottom.png)
- 離開結算後仍在榜上：[100-leaderboard-today.png](100-leaderboard-today.png)
- 首頁仍顯示另一筆個人成績：[098-home-after-campaign.png](098-home-after-campaign.png)

**玩家感受：**我第一場白打，第二場說不算又算。到底朋友要玩幾場才有幫忙？

**判定範圍：**以上是同一主要試玩流程看到的確定矛盾。沒有讀遊戲原始碼或直接查後端，不能判定是裝置識別、重複上傳、資格判斷還是其他原因。榜上也有其他測試玩家；不把他們的成績當成本次操作。

### B2｜分享／複製在當前畫面缺少回饋，成功文字出現在被蓋住的背景

這是使用者眼中的「按了沒反應」，**不等於已證明分享 API 或剪貼簿完全失效**。

**重現步驟：**

1. 快打結算後按「分享戰報」或「複製文字戰報」。
2. 留在結算頁看不到成功文字、可用的預覽或下一步指示。
3. 第二場再按一次「複製文字戰報」，接著按「玩完整選戰」。這時才從半透明選陣營畫面後面，看到遊戲背景上的「文字戰報已複製，貼到 LINE 吧！」。

**截圖證據：**

- 分享戰報後：[035-share-battle-response.png](035-share-battle-response.png)
- 首次複製後：[036-copy-battle-response.png](036-copy-battle-response.png)
- 第二次複製後：[063-copy-practice-report.png](063-copy-practice-report.png)
- 成功文字藏在背景：[064-campaign-entry.png](064-campaign-entry.png)
- 「幫藍營拉人」後也未見當前畫面的成功回饋：[039-recruit-blue-response.png](039-recruit-blue-response.png)
- 抽卡與圖鑑分享同樣未見回饋：[044-share-gacha-response.png](044-share-gacha-response.png)、[048-share-collection-response.png](048-share-collection-response.png)

**玩家感受：**我不知道是已複製、要再等，還是根本沒按到。分享是最後一步，這裡不給回應，我就關掉了。

本輪沒有遇到教學卡死、無法結算或整頁無法操作。原生分享面板、實際分享圖片及剪貼簿內容未驗證成功，詳見第 4 節與測試範圍。

## 2. 看不懂的地方 Top 5

| 排名／在哪裡 | 我以為是什麼 | 實際看到什麼、為何困惑 | 截圖 |
|---|---|---|---|
| 1．教學第 2 步的金色「1」 | 找到金色 1 就點 | 左上費用與右上軍師排序都是金色圓形數字，手上同時有好幾個 1。說明有寫右上，但我還得停下來分辨。建議排序直接寫「先出」。 | [008-tutorial-step2.png](008-tutorial-step2.png) |
| 2．「對手下一步」的抓暗樁圖示 | 亮綠色放大鏡就是現在該查核 | 對手準備放暗樁、我手上有查核，所以圖示亮著；實際點了卻顯示「沒有暗樁可抓」。我沒有分清楚「他下一回合要放」和「場上已經有」。提示應把時機說清楚。 | [020-quick1-ace-attempt.png](020-quick1-ace-attempt.png)、[021-quick1-check-facts.png](021-quick1-check-facts.png) |
| 3．得票、操盤分、陣營票 | 我選舉拿多少票，就幫陣營加多少票 | 選舉得票是 26,514，加上連擊／閃避成為 36,514；接著又把這個分數叫作「貢獻的票」。排行榜叫「陣營總操盤分」，首頁又寫「第一場的票數」。我能接受有加分，但想要同一個名稱。 | [031-score-name-focus.png](031-score-name-focus.png)、[037-score-bottom.png](037-score-bottom.png)、[038-home-after-first.png](038-home-after-first.png) |
| 4．圖鑑的未收集卡 | 剛才打過的王牌應該已經有了；抽到新卡會讓快打變強 | 圖鑑的講稿機、問A答BCD仍鎖著；快打選牌頁其實有寫大家拿同樣的牌，完整選戰才有「換新抽到的卡」。我後來才拼起來：快打借用與永久收藏是兩回事。抽卡後應直接說新卡能用在哪。 | [006-ace-options.png](006-ace-options.png)、[046-collection-middle.png](046-collection-middle.png)、[047-collection-bottom.png](047-collection-bottom.png)、[065-campaign-mode.png](065-campaign-mode.png) |
| 5．教學結束後的 12 秒 | 先看懂軍師說明，再慢慢照順序出牌 | 教學時倒數停著；開始操盤後，「為什麼」展開也繼續倒數，讀文字就可能自動出牌。第 6 步又一邊說「結束回合」、一邊叫「開始操盤」，當時還剩 1/3 資源。沒卡住，但我會猶豫該先出還是先結束。 | [013-tutorial-step6-settled.png](013-tutorial-step6-settled.png)、[014-quick1-live.png](014-quick1-live.png)、[053-quick2-adviser-why.png](053-quick2-adviser-why.png) |

教學六步都有走過，兩個要求實際出牌的步驟都能推進，沒有靠「跳過教學」脫困。最大問題是資訊量和判斷時間，不是找不到下一步按鈕。

## 3. 陣營戰有沒有讓我想拉朋友？

**有一點，但還不到會主動在群組揪人的程度。** 我會想把朋友分藍綠兩邊互嘴，畫面有比例、參戰人數與兩個拉人按鈕，這個方向是有用的。[038-home-after-first.png](038-home-after-first.png)

但實測進站時，藍營是 100%、1 人，跟朋友說「藍營輸很慘快來救」對不上；這是當時戰況與角色設定不同，不是程式錯誤。只有一、兩個人的比例，也還沒有很強的拉鋸感。[004-home-first.png](004-home-first.png)、[038-home-after-first.png](038-home-after-first.png)

更缺的是具體目標。畫面說「領先 30%，來守住優勢」，我仍不知道再來一個朋友大概能改變多少、今天什麼時候結算。比例有了，但「現在拉人可以做成什麼」還不夠具體。[031-score-name-focus.png](031-score-name-focus.png)、[038-home-after-first.png](038-home-after-first.png)

而且本輪練習竟然也進了陣營分，我就不敢認真叫朋友來刷首場。這個比文案不夠熱血更傷。[061](061-quick2-practice-confirmed.png)、[062](062-quick2-result-bottom.png)

## 4. 分享功能

所有指定按鈕都實際點過，沒有真的傳給任何人。以下把「有按到」「有可見回饋」「真的複製或產圖成功」分開。

| 功能 | 本輪實測結果 | 我想不想傳／證據 |
|---|---|---|
| 分享戰報 | 已點；當前結算畫面未出現可見分享面板、預覽或成功文字。未驗證實際圖片輸出。 | **最想傳的是號外戰報。**「記者連問2題，講卍安一題都沒回答到」不懂規則也看得懂，能拿來虧朋友。這是對結算頁內容的評價，不是假裝看過輸出圖。[030](030-quick1-score.png)、[035](035-share-battle-response.png) |
| 複製文字戰報 | 兩場都按過；結算頁沒提示。後續在背景看得到「文字戰報已複製，貼到 LINE 吧！」。剪貼簿內容未完成可靠驗證。 | 如果能立刻顯示「已複製」，這是我丟 LINE 最省事的路。現在像沒按到。[036](036-copy-battle-response.png)、[063](063-copy-practice-report.png)、[064](064-campaign-entry.png) |
| 幫藍營拉人 | 已點一次，首頁未見明確成功回饋或分享預覽。 | 有逆轉目標才會傳；目前光看比例，理由還不夠具體。[039](039-recruit-blue-response.png) |
| 分享抽卡結果 | 免費包正常開出 5 張：4 張 NEW、1 張重複轉 10 碎片；已點分享，未見可見回饋。 | 抽到有梗的稀有角色，我可能傳給已經在玩的朋友；單純五張卡和稀有度，新朋友不一定知道厲害在哪。[043](043-gacha-all-results.png)、[044](044-share-gacha-response.png) |
| 分享我的圖鑑 | 已看到 16/36，滑到底按分享；未見可見回饋。 | **最不想傳。** 16/36 是我的進度，朋友沒有遊戲背景就很難接話；比號外少一個笑點。分享鈕還得滑到整份卡表最下面。[045](045-collection-open.png)、[047](047-collection-bottom.png)、[048](048-share-collection-response.png) |

真正希望改善的是：按完後就在目前這一層顯示結果，例如「已複製，去 LINE 貼上」；無法叫出分享面板時，也給可用的文字或圖片預覽。不要把成功訊息留在後面的戰場。

## 5. 快打一場實際花多久

時間取自 [actions.jsonl](actions.jsonl)，不是憑印象。時區轉成台北時間如下：

| 場次 | 點選陣營 | 首次截到完成結算 | 到結算實測 | 到稱號／分數頁 |
|---|---|---|---|---|
| 首場，含完整新手教學 | 13:19:48.063 | 13:23:49.771 | **4 分 01.7 秒** | **4 分 13.5 秒**，13:24:01.555 |
| 第二場，無教學 | 13:28:18.926 | 13:31:17.695 | **2 分 58.8 秒** | **3 分 10.4 秒**，13:31:29.334 |

若從首場「選陣營畫面出現」而非點下陣營起算，首場到結算是約 **4 分 10 秒**。[004](004-home-first.png)、[029](029-quick1-settlement.png)、[030](030-quick1-score.png)、[060](060-quick2-settlement.png)、[061](061-quick2-practice-confirmed.png)

這些是本次 QA 真實經過時間，**含逐步截圖、看圖、閱讀與工具往返**；結算可能在兩次截圖之間已出現，不能把數字當一般玩家的精密耗時基準。部分回合時間到由軍師代出。以這次結果看，三分鐘對無教學的第二場接近成立；第一次來還得看開場、教學，不能以為點連結三分鐘就全部搞定。

「只有 10 分鐘」的角色限制下，我大概到抽卡／圖鑑就該收手機了：從第一張進站圖到圖鑑分享已約 8 分 49 秒，第二場開打約在第 9 分 46 秒。為完成 BRIEF 的完整覆蓋，本輪有繼續往下測，不能說整套功能十分鐘內走完。[001](001-first-visit.png)、[048](048-share-collection-response.png)、[052](052-quick2-start.png)

## 6. 轉傳意願

**6／10 分。**

號外、諧音角色和必殺動畫有記憶點，我願意丟給平常會一起聊政治迷因的朋友。首場輸了仍有「答非所問之王」，這比只給我一個敗北畫面好玩。[025](025-quick1-influencer.png)、[030](030-quick1-score.png)

扣分是我還要解釋太多：金色數字怎麼看、抓暗樁的時機、分數為什麼又叫票；而且我按分享時沒有明確回應，練習又真的上榜。叫朋友來救陣營之前，我想先確定他那一場會不會算。[008](008-tutorial-step2.png)、[021](021-quick1-check-facts.png)、[031](031-score-name-focus.png)、[063](063-copy-practice-report.png)、[100](100-leaderboard-today.png)

## 7. 上線前只能改 3 件事

1. **先把首場資格、練習資格、上榜與陣營加分統一。** 開打前就知道這場算不算，結算、上傳結果、首頁和榜單講同一件事。驗收至少涵蓋「首場正常計分」「第二場只練習」「重複按登榜不改資格／不重複加分」。本輪證據：[031](031-score-name-focus.png)、[034](034-score-upload-response.png)、[061](061-quick2-practice-confirmed.png)、[062](062-quick2-result-bottom.png)、[100](100-leaderboard-today.png)。
2. **讓所有分享按鈕在當前畫面交代結果。** 已複製就明講，失敗就給替代方法，有圖片就能預覽。先解掉「按了沒反應」的感覺。證據：[036](036-copy-battle-response.png)、[039](039-recruit-blue-response.png)、[044](044-share-gacha-response.png)、[048](048-share-collection-response.png)、[064](064-campaign-entry.png)。
3. **把第一場教學改成一眼能照做。** 軍師排序與費用用不同標記；「下一步」對策標明現在可用或要等對手出完；新手看「為什麼」時給足閱讀時間。這三個都在處理同一件事：我應該知道這一刻要點哪張、為什麼。證據：[008](008-tutorial-step2.png)、[013](013-tutorial-step6-settled.png)、[021](021-quick1-check-facts.png)、[053](053-quick2-adviser-why.png)。

## 流程覆蓋與測試範圍

| BRIEF 項目 | 實際完成狀況 | 證據 |
|---|---|---|
| 首次開場 | 拆封、看到影片播放、接下委託 | [001](001-first-visit.png)–[004](004-home-first.png) |
| 首次快打 | 選藍營、挑王牌、六步教學實際完成、落選結算、稱號／號外／分數、按登榜 | [006](006-ace-options.png)、[007](007-tutorial-step1.png)–[014](014-quick1-live.png)、[029](029-quick1-settlement.png)–[034](034-score-upload-response.png) |
| 結算分享 | 分享戰報、複製文字均已點 | [035](035-share-battle-response.png)、[036](036-copy-battle-response.png) |
| 首頁陣營戰 | 已看比例／人數，按一次幫藍營拉人 | [038](038-home-after-first.png)、[039](039-recruit-blue-response.png) |
| 抽卡與圖鑑 | 免費開 1 包、翻完 5 張、點抽卡分享；看圖鑑、點圖鑑分享 | [040](040-gacha-open.png)–[048](048-share-collection-response.png) |
| 再玩一次 | 完整打完第二場；勝選。練習標記有出現，但後續計分異常 | [049](049-home-before-practice.png)–[062](062-quick2-result-bottom.png) |
| 完整選戰第一關 | 實際出牌後存檔離開、首頁續玩，按說明從關卡起點重開；最後第一關 106,324 對 77,443，領先 28,881，領取戰利品 | [069](069-campaign-pause.png)–[074](074-campaign-w4.png)、[093](093-campaign-stage1-settlement.png)、[094](094-campaign-stage1-loot.png) |
| 排行榜／回報 | 三個分頁均打開；回報表單打開並聚焦文字欄，**沒有送出** | [100](100-leaderboard-today.png)–[105](105-feedback-text-focus.png) |

- 以 `puppeteer.connect({browserURL:'http://127.0.0.1:9333'})` 連使用者提供的 Chrome，開新分頁；主流程為 390×844、deviceScaleFactor 2、isMobile、hasTouch。Chrome 回報版本為 156.0.8078.47，屬 Headless 環境的手機模擬，並非實體 iPhone／LINE 內建瀏覽器。
- 主流程開始前只使用 BRIEF 指定的 `evaluateOnNewDocument` 設定測試 `spin_local`；除此指定初始化外，沒有直接修改遊戲資料，也沒有呼叫遊戲內部 JS 函式、讀或修改 `game/` 檔案。以畫面決定觸控點擊與滑動，每步保存並觀看截圖。
- `NODE_PATH` 實際指向不存在的目錄；改用機器上已存在的 npm 快取 `puppeteer-core` 24.43.1，沒有安裝套件或自行 launch Chrome。
- **補驗限制：**在完成 001–105 的主流程後，為測貼上建立輔助連線；該連線的預設 viewport 改成 800×600，恢復手機 viewport 又觸發重載，令既有初始化 hook 重跑。因此 `106a-clipboard-pasted.png`、`106b-mobile-clipboard-pasted.png` **只保留為工具異常紀錄，不作為產品錯誤或剪貼簿成敗證據**。貼上內容未可靠驗證，重載後沒有再玩或登榜。表單從未送出，也沒有對外傳訊息。
- 主要連線與輔助連線均已 `browser.disconnect()`，沒有關閉既有 Chrome。所有新增腳本、截圖與紀錄均在 `qa/launch/`。
- 測試暱稱：`QA午休救援`；今日榜可見測試分數：102,185。測試裝置前綴依 BRIEF 為 `qa-codex-`，供後續清理。
- 操作與時間證據：[actions.jsonl](actions.jsonl)；主操作器：[qa-runner.cjs](qa-runner.cjs)；不作產品判定的補驗器：[paste-check.cjs](paste-check.cjs)。
