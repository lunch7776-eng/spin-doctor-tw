1. 總判定：FAIL（game/未修改）
2. 發現（已逐項反駁）：
- Critical game/index.html:1078 `RUN.stage++`：第三關獎勵450ms內雙點→越界卡死；首次點擊即鎖。
- Critical game/index.html:1172 `ov.hidden=true`：結束→再玩→返回，busy舊戰場不能操作；返回標題。
- High game/index.html:267 `inset:0;z-index:70`：教學第7步父遮罩擋牌；父層穿透、按鈕保留接收。
- High game/index.html:817 `passive==='sidekick'`：側翼＋農場傷害1→2；加成限抹黑。
- Low game/index.html:583、600 `Math.max(1,`：零聲量民調、零反感寶立答仍+1；補卡文。
- Low game/index.html:733 `-cw*.62`：375×667不出牌結束兩回合，8牌費用章裁邊；增加重疊。

3. 核對：①流程✗②規則✗③平衡？（貪婪AI不證明必勝／必敗）④資源✓36圖/64音⑤名字XSS✓⑥版面✗。
4. 模擬：每色每關200場，1→4關勝率藍90/45.5/11.5/1.5%；綠99.5/39/18.5/16%。敗局續測，非通關率。腳本qa/codex_sim.cjs；均票與常出卡見qa/codex_sim_results.json。

瀏覽器安全政策拒絕file://；教學與版面為CSS推算，文字截尾未驗證。
