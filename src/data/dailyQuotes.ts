/**
 * Ultra Advisor - 每日金句資料庫
 *
 * 用於「每日限時動態」功能
 * 每天根據日期 hash 選擇一句金句
 *
 * 金句風格：30-50 字財商思維，適合分享到社群
 */

export interface DailyQuote {
  text: string;
}

// 財商思維金句（共 200 句）
export const dailyQuotes: DailyQuote[] = [
  // ========== 現金流思維 (1-25) ==========
  { text: "窮人買負債以為是資產，富人買資產創造現金流。差別不在收入多少，而在錢流向哪裡。" },
  { text: "薪水是用時間換錢，被動收入是用錢賺錢。真正的財務自由，是讓錢為你工作。" },
  { text: "月薪 10 萬但月光，不如月薪 5 萬但每月存下 2 萬。財富是留下來的，不是賺來的。" },
  { text: "大多數人一輩子在追求更高的薪水，卻從不思考如何讓錢自己長大。這就是窮忙的原因。" },
  { text: "財務自由不是賺很多錢，而是被動收入大於生活支出。達到這個門檻，你就自由了。" },
  { text: "先支付自己，再支付帳單。這個簡單的順序改變，是富人和窮人最大的差別。" },
  { text: "你的收入有天花板，但你的資產沒有。停止追求更高薪水，開始累積能增值的資產。" },
  { text: "一份工作只能給你一份收入，但一個系統可以給你無限收入。建立系統，而不是找工作。" },
  { text: "現金流是企業的血液，也是個人財務的命脈。沒有現金流，再多資產也是紙上富貴。" },
  { text: "真正的財富不是你賺多少，而是你留下多少。存錢的能力，決定你財富的高度。" },
  { text: "主動收入讓你活著，被動收入讓你活得自由。兩者都要有，但比例要對。" },
  { text: "收入-儲蓄=支出，而不是收入-支出=儲蓄。這個公式的順序，決定了你的財務命運。" },
  { text: "錢會流向會管理它的人。學習理財，就是學習讓錢聽你的話。" },
  { text: "不要為了省小錢而花大時間，也不要為了賺大錢而冒大險。時間和風險都有成本。" },
  { text: "每一塊錢都是你的員工，讓它們去為你工作。閒置的錢，是沒有生產力的員工。" },
  { text: "窮人存錢是為了花掉，富人存錢是為了投資。存錢的目的不同，結果天差地遠。" },
  { text: "你不理財，財不理你。但過度理財，時間成本也很高。找到平衡點最重要。" },
  { text: "財務健康的指標不是收入，是淨資產。收入高但負債高，其實很脆弱。" },
  { text: "緊急預備金不是投資，是保險。留 3-6 個月生活費，讓你有底氣說不。" },
  { text: "月光族不是賺太少，是花太多。控制支出比增加收入更容易，也更有效。" },
  { text: "富人買入會增值的東西，窮人買入會貶值的東西。你的購物清單透露了你的未來。" },
  { text: "財務自由的人不是不工作，是可以選擇要不要工作。選擇權，才是真正的自由。" },
  { text: "存錢是為了有選擇，不是為了當守財奴。該花的要花，不該花的要狠心省。" },
  { text: "現金流量表比資產負債表重要。有資產但沒現金流，關鍵時刻會很狼狽。" },
  { text: "被動收入的起步很慢，但一旦建立，會像雪球一樣越滾越大。耐心是關鍵。" },

  // ========== 複利思維 (26-50) ==========
  { text: "複利的威力不在報酬率，而在時間。早開始 10 年，勝過晚開始卻投入 2 倍本金。" },
  { text: "每月投入 5000 元，年化 7%，30 年後是 600 萬。複利不是魔法，是紀律加時間。" },
  { text: "愛因斯坦說複利是世界第八大奇蹟。理解的人賺取它，不理解的人支付它。你是哪一種？" },
  { text: "25 歲開始每月存 5000，比 35 歲開始每月存 10000 還多。時間是複利最強的催化劑。" },
  { text: "複利有兩種：讓你的錢翻倍，或讓你的債務翻倍。信用卡循環利息就是負向複利。" },
  { text: "股神巴菲特 99% 的財富是 50 歲後才累積的。複利的爆發力，需要時間醞釀。" },
  { text: "每天進步 1%，一年後你會強 37 倍。複利不只適用於金錢，也適用於能力和人脈。" },
  { text: "通膨也是複利，每年 3% 的通膨，24 年後你的錢只剩一半購買力。不投資就是慢性虧損。" },
  { text: "複利的敵人是中斷。停止投資一年，可能要多投資三年才能追回來。" },
  { text: "72 法則：用 72 除以年報酬率，就是資產翻倍的年數。7% 報酬率，約 10 年翻倍。" },
  { text: "複利的魔力在於「利滾利」。第一年賺的利息，第二年也會產生利息。" },
  { text: "年輕人最大的資產是時間，最大的敵人是拖延。早開始一年，退休時多好幾百萬。" },
  { text: "複利需要耐心。前 10 年看不出差別，20 年後差距明顯，30 年後天差地遠。" },
  { text: "不要小看每天省下的 100 元。一年是 36500，投資 30 年後可能變成 300 萬。" },
  { text: "負債的複利比投資的複利可怕。信用卡 15% 的利率，5 年就讓債務翻倍。" },
  { text: "複利是窮人翻身的工具，也是富人保富的秘密。關鍵是要讓它為你工作。" },
  { text: "投資報酬率差 2%，30 年後財富差一倍。不要小看看似微小的差異。" },
  { text: "複利讓時間成為你的朋友。但如果你負債，時間就是你的敵人。" },
  { text: "最好的投資時機是十年前，其次是現在。不要讓完美主義阻止你開始。" },
  { text: "複利需要三個條件：本金、報酬率、時間。三者缺一不可，但時間最重要。" },
  { text: "定期定額的精髓不是擇時，是利用時間的力量。持續投入，讓複利發威。" },
  { text: "複利的前期很無聊，後期很驚人。大多數人在無聊期就放棄了。" },
  { text: "巴菲特說：人生就像滾雪球，重要的是找到很濕的雪和很長的坡。" },
  { text: "複利的奇蹟不是一夜暴富，是二十年後的財務自由。急不得，也等得起。" },
  { text: "年輕時的一萬元，比中年時的十萬元更有價值。因為它有更多時間複利。" },

  // ========== 風險思維 (51-75) ==========
  { text: "投資最大的風險不是虧錢，是你不知道自己在做什麼。無知才是真正的風險。" },
  { text: "分散投資不是買很多標的，是買不相關的標的。全部買科技股不叫分散，叫集中。" },
  { text: "意外和明天，你不知道哪個先來。保險不是消費，是給家人的一份承諾。" },
  { text: "股市短期是投票機，長期是秤重機。恐慌時賣出，你就把投票權交給了情緒。" },
  { text: "別人恐懼時貪婪，別人貪婪時恐懼。聽起來簡單，但 99% 的人做不到。" },
  { text: "投資第一條規則：不要虧錢。第二條規則：記住第一條。本金沒了，複利也沒用。" },
  { text: "風險管理的第一步是承認風險存在。自以為穩賺不賠的人，往往賠得最慘。" },
  { text: "高報酬必然伴隨高風險。如果有人告訴你低風險高報酬，他不是在騙你，就是他自己也被騙了。" },
  { text: "風險不是波動，是本金永久損失的可能性。好公司股價下跌是機會，不是風險。" },
  { text: "集中投資可以讓你致富，也可以讓你破產。分散投資讓你慢慢富，但不會一夕窮。" },
  { text: "投資前先問：最壞的情況我能承受嗎？如果不能，就不要投。" },
  { text: "槓桿是雙面刃。賺的時候翻倍，賠的時候也翻倍。新手不要碰。" },
  { text: "風險和報酬是連體嬰。想要高報酬又零風險，不如去買樂透。" },
  { text: "投資最大的風險是你以為沒有風險。過度自信是虧損的開始。" },
  { text: "市場會獎勵承擔風險的人，但懲罰不懂管理風險的人。學會管理，而不是逃避。" },
  { text: "永遠不要把所有雞蛋放在同一個籃子裡。但也不要分散到連自己都搞不清楚。" },
  { text: "止損不是認輸，是保護本金的智慧。活著才有機會，輸光就什麼都沒了。" },
  { text: "波動是投資的成本，不是風險。真正的風險是買錯東西或買錯價格。" },
  { text: "風險評估要看最壞情況，不是最可能情況。黑天鵝事件不常發生，但發生就是災難。" },
  { text: "投資組合要能讓你晚上睡得著。如果睡不著，表示風險太高了。" },
  { text: "對抗風險最好的方法是知識，不是逃避。學越多，風險越低。" },
  { text: "短期風險可以用時間化解，長期風險只能用策略規避。知道你面對的是哪種風險。" },
  { text: "保險是轉移風險的工具。花小錢買大保障，是最划算的風險管理。" },
  { text: "投資不是賭博。賭博靠運氣，投資靠知識和紀律。" },
  { text: "風險承受度會隨年齡改變。年輕時可以積極，年長時要保守。資產配置要跟著調整。" },

  // ========== 稅務思維 (76-100) ==========
  { text: "合法節稅是你的權利，不是逃稅。不懂稅法的人，多繳的稅可能比投資虧的還多。" },
  { text: "遺產稅最高 20%，贈與稅每年有 244 萬免稅額。及早規劃，可以省下一棟房子。" },
  { text: "買保險不是為了理賠，是為了稅務效率和資產保全。這是富人都知道的秘密。" },
  { text: "年收入 100 萬和 500 萬，稅率差了 2 倍以上。收入越高，稅務規劃越重要。" },
  { text: "股票賺錢要繳稅，但有些方式可以延後或減少。不是逃稅，是運用規則。" },
  { text: "退休金領取方式不同，稅負也不同。多想一步，多領幾十萬。這就是財商的價值。" },
  { text: "很多人一輩子努力賺錢，卻在傳承時被政府分走一大塊。提早規劃，才是完整的理財。" },
  { text: "稅是賺錢最大的成本之一。認真學稅法的人，會發現原來錢可以少繳這麼多。" },
  { text: "節稅規劃要趁早，不是等到報稅前才想。很多方法需要提前一整年佈局。" },
  { text: "富人不是不繳稅，是用合法方式少繳稅。這叫稅務規劃，不叫逃漏稅。" },
  { text: "保險給付免所得稅、免遺產稅。善用這個特性，可以省下大筆稅金。" },
  { text: "夫妻所得分開或合併申報，結果可能差很多。多算一下，選對有利的方式。" },
  { text: "捐贈可以節稅，但要捐對地方。不是所有捐贈都能列舉扣除。" },
  { text: "海外所得每年有 670 萬免稅額。超過的部分，記得誠實申報。" },
  { text: "房地合一稅自住優惠 400 萬免稅。符合條件的人，一定要善用這個福利。" },
  { text: "贈與稅每年每人 244 萬免稅額，夫妻加起來 488 萬。長期規劃，可以大量節稅。" },
  { text: "退休金一次領還是月領，稅務效果大不同。選錯方式，可能多繳幾十萬稅。" },
  { text: "投資海外基金和台股，稅務處理不同。了解差異，選擇對你最有利的方式。" },
  { text: "列舉扣除額超過標準扣除額才划算。每年檢視一下，不要讓權益睡著。" },
  { text: "遺產規劃不只是分財產，更是稅務規劃。提早做，子孫受益大。" },
  { text: "薪資所得稅率最高 40%，但資本利得稅率可能更低。這就是富人的秘密。" },
  { text: "稅法每年都在變。去年的節稅方式，今年可能不適用。要持續更新知識。" },
  { text: "借款利息在某些情況下可以扣稅。善用這個規則，可以降低實質利率。" },
  { text: "健保補充保費是隱形的稅。股利超過門檻就要繳，記得把這個成本算進去。" },
  { text: "節稅和逃稅只有一線之隔。合法節稅要做，違法逃稅碰不得。" },

  // ========== 消費思維 (101-125) ==========
  { text: "買東西前問自己：這是需要還是想要？一個簡單的問題，可以省下一半的開銷。" },
  { text: "信用卡分期 12 期，年利率其實是 14.8%，不是 0%。免利率只是話術。" },
  { text: "如果你買不起兩個，你就買不起一個。用現金能買得起的東西，才是你真正買得起的。" },
  { text: "拿鐵因子：每天一杯 150 元的咖啡，30 年是 164 萬。小錢不小，習慣會吃掉你的財富。" },
  { text: "富人買資產，窮人買負債，中產階級買以為是資產的負債。你買的車是哪一種？" },
  { text: "最好的投資往往不是買什麼，而是不買什麼。克制慾望也是一種財商。" },
  { text: "奢侈品讓你看起來有錢，資產讓你真的有錢。選擇展示財富，還是累積財富？" },
  { text: "延遲享樂不是不享樂，是先讓資產替你享樂。等到被動收入超過支出，想買什麼都行。" },
  { text: "消費前等 24 小時再決定。衝動購物是財富的殺手，冷靜一下往往就不想買了。" },
  { text: "便宜沒好貨，但貴也不一定好。買東西看性價比，不是看價格或品牌。" },
  { text: "月收入的 50% 用於必需、30% 用於想要、20% 用於儲蓄。這是最簡單的預算法則。" },
  { text: "買入前問自己：五年後這東西還在嗎？還有用嗎？如果不是，三思而後行。" },
  { text: "價格和價值是兩回事。折扣品不一定划算，全價品不一定貴。" },
  { text: "購物滿足感很短暫，存款帶來的安全感更持久。選擇短期快樂還是長期安心？" },
  { text: "維護成本往往比購買成本高。買車、買房之前，先算算養得起嗎。" },
  { text: "訂閱制是新型態的吸金術。每個月 199 看起來不多，十幾個訂閱加起來很驚人。" },
  { text: "二手市場是寶藏。很多東西用過一次就跟新的一樣，但價格只要一半。" },
  { text: "消費是為了生活，不是生活是為了消費。搞清楚主從關係很重要。" },
  { text: "真正的省錢是不買，不是買便宜。打折時買不需要的東西，不是省錢是浪費。" },
  { text: "品質比數量重要。買一件好的穿十年，比買十件差的穿一年划算。" },
  { text: "消費要符合你的價值觀。把錢花在對你真正重要的事上，其他的都可以省。" },
  { text: "外食一頓 200 元，自己煮只要 50 元。一個月差 4500 元，一年超過 5 萬。" },
  { text: "信用卡紅利和回饋很誘人，但如果因此多買，反而虧大了。" },
  { text: "消費升級要配合收入升級。收入不變卻消費升級，就是在吃老本。" },
  { text: "最貴的東西往往是免費的。免費試用、免費贈品，背後都有成本。" },

  // ========== 投資思維 (126-150) ==========
  { text: "投資最好的時機是十年前，其次是現在。與其等待完美時機，不如現在就開始。" },
  { text: "定期定額不是最佳策略，但是最能堅持的策略。能堅持的策略，就是最好的策略。" },
  { text: "追高殺低是人性，但違反人性才能賺錢。投資賺的不是聰明錢，是紀律錢。" },
  { text: "如果你不願意持有一支股票十年，就不要考慮持有十分鐘。頻繁交易只會貢獻手續費。" },
  { text: "預測市場的人很多，預測對的人很少。與其猜測，不如長期持有好資產。" },
  { text: "投資不是比誰賺得多，是比誰活得久。留在市場裡，時間會獎勵你。" },
  { text: "價格是你付出的，價值是你得到的。便宜的東西可能很貴，貴的東西可能很便宜。" },
  { text: "分散投資是承認自己不知道哪個會漲。這不是弱點，是智慧。" },
  { text: "投資要看長期，不要被短期波動嚇到。股市長期向上，但短期什麼都可能發生。" },
  { text: "買進時多花的功夫，會在賣出時省下很多煩惱。研究越深入，持有越安心。" },
  { text: "投資最重要的是本金安全，其次才是報酬率。守得住才賺得到。" },
  { text: "不懂的東西不要投。這不是保守，是保護自己。" },
  { text: "市場先生有時候很瘋狂。利用他的瘋狂，而不是被他影響。" },
  { text: "好公司不等於好股票，好股票要看買的價格。再好的公司，買太貴也會虧。" },
  { text: "投資最難的不是選股，是抱住。很多人買對了股票，但沒有抱到賺錢。" },
  { text: "現金也是一種資產配置。適當的現金部位，讓你有機會在低點加碼。" },
  { text: "投資是科學也是藝術。學習分析是科學，控制情緒是藝術。" },
  { text: "長期投資不是買了不管，是買了繼續追蹤。公司基本面變了，策略也要跟著變。" },
  { text: "市場永遠是對的。如果你虧錢了，是你錯了，不是市場錯了。" },
  { text: "投資的目的是讓錢為你工作，不是讓你為錢工作。方向搞清楚很重要。" },
  { text: "單押一檔是賭博，分散配置是投資。你是在投資，還是在賭博？" },
  { text: "ETF 是最適合一般人的投資工具。低成本、分散風險、長期績效佳。" },
  { text: "投資不需要聰明，需要紀律。最簡單的策略，持續執行，就能打敗大多數人。" },
  { text: "市場下跌時是最好的學習機會。因為這時候你會認真看待風險。" },
  { text: "投資是馬拉松，不是百米賽跑。跑太快的人，往往跑不完全程。" },

  // ========== 退休思維 (151-175) ==========
  { text: "勞保 + 勞退只能替代 40% 的薪水。如果退休想維持生活品質，剩下的 60% 要自己準備。" },
  { text: "退休規劃最大的敵人不是報酬率，是通膨。現在的 1000 萬，30 年後只剩一半購買力。" },
  { text: "60 歲退休活到 90 歲，要準備 30 年的生活費。長壽不是福氣，是風險。要準備好。" },
  { text: "退休金準備越早開始，每月壓力越小。30 歲開始和 40 歲開始，每月金額差一倍。" },
  { text: "退休不是終點，是人生另一個階段。你想要什麼樣的退休生活，現在就要開始規劃。" },
  { text: "靠政府不如靠自己。勞保可能破產，但你自己存的錢不會背叛你。" },
  { text: "很多人退休後最後悔的事，是沒有早點開始存錢。時間是站在年輕人這邊的。" },
  { text: "退休金不是存多少的問題，是能花多久的問題。計算清楚，才能安心退休。" },
  { text: "退休後的醫療支出往往被低估。健康險和醫療險，年輕時就要買好。" },
  { text: "4% 法則：退休金乘以 4%，就是每年可以花的錢。想年花 80 萬，要準備 2000 萬。" },
  { text: "退休規劃要考慮通膨。今天的 100 萬，20 年後可能只相當於今天的 60 萬。" },
  { text: "提早退休很美好，但要確保錢夠用。不然提早退休會變成提早焦慮。" },
  { text: "退休後收入減少，但時間變多。如何有意義地度過，比存多少錢更重要。" },
  { text: "房子可以是退休資產。以房養老或換小屋，都是可行的選項。" },
  { text: "退休金的配置要更保守。年輕時可以承受波動，退休後承受不起。" },
  { text: "健康是退休最大的資產。沒有健康，再多退休金也享受不到。" },
  { text: "退休前的最後 10 年是關鍵期。這段時間的理財決策，影響退休品質。" },
  { text: "退休後還要工作不是失敗。重點是有選擇的自由，而不是被迫工作。" },
  { text: "夫妻退休規劃要一起做。兩個人的退休金需求，不是一個人的兩倍。" },
  { text: "退休金要定期檢視，不是設定了就不管。市場變化、法規變化，策略也要跟著調整。" },
  { text: "年金險可以對沖長壽風險。活越久領越多，不怕錢花光。" },
  { text: "退休後的開銷不一定比工作時少。旅遊、興趣、孝親，都需要錢。" },
  { text: "勞退自提 6% 有稅務優惠。等於政府補貼你存退休金，不用白不用。" },
  { text: "退休是人生的第三階段。第一階段學習，第二階段工作，第三階段享受。要好好規劃。" },
  { text: "最好的退休計畫是不需要完全依賴退休金的計畫。有其他收入來源更安心。" },

  // ========== 心態思維 (176-200) ==========
  { text: "財務自由的第一步不是賺更多錢，是改變對錢的看法。心態對了，錢就來了。" },
  { text: "窮人說「我買不起」，富人問「我怎麼買得起」。一個放棄思考，一個開始思考。" },
  { text: "學校教你成為好員工，但沒教你成為老闆或投資人。財商要靠自己學。" },
  { text: "大多數人終其一生在解決錢的問題，卻從不花時間學習錢的知識。這就是問題所在。" },
  { text: "有錢人和你想的不一樣。他們買資產，你買負債；他們投資自己，你投資娛樂。" },
  { text: "財商高的人不一定收入高，但一定存得下錢。因為他們知道錢該流向哪裡。" },
  { text: "抱怨薪水太低的時間，拿來學習投資理財，幾年後結果會完全不同。" },
  { text: "很多人工作幾十年還是月光，不是賺太少，是財商太低。這是可以改變的。" },
  { text: "金錢是中性的，它放大你原本的樣子。好人有錢做更多好事，壞人有錢做更多壞事。" },
  { text: "理財不是數學問題，是心理問題。知道和做到之間，隔著人性。" },
  { text: "投資自己是報酬率最高的投資。技能提升，收入就會提升。" },
  { text: "對金錢的焦慮，往往來自對金錢的無知。學得越多，越不焦慮。" },
  { text: "不要讓金錢定義你，要讓你定義金錢的用途。錢是工具，不是目的。" },
  { text: "比較是快樂的小偷。專注於自己的財務目標，不要被別人的消費帶著走。" },
  { text: "財富自由不是不工作，是可以做自己想做的工作。這是本質的差別。" },
  { text: "成功的投資人都很無聊。因為他們只做最簡單、最有效的事。" },
  { text: "恐懼和貪婪是投資最大的敵人。學會控制情緒，就贏了一半。" },
  { text: "理財是一輩子的事。不是賺到第一桶金就結束，而是才剛開始。" },
  { text: "錢解決不了所有問題，但沒錢會製造很多問題。先把基本功打好。" },
  { text: "財商教育應該從小開始。你怎麼教孩子看待金錢，會影響他一輩子。" },
  { text: "耐心是投資最重要的品質。大多數人都太急了，所以大多數人都賠錢。" },
  { text: "投資是一場和自己的賽跑，不是和別人比較。專注於自己的目標就好。" },
  { text: "錯過機會不可怕，可怕的是亂抓機會。寧願錯過，也不要做錯。" },
  { text: "財務成功沒有捷徑。慢慢來，比較快。" },
  { text: "開始永遠不嫌晚，但越早開始越好。今天是你剩餘人生中最年輕的一天。" },
];

// 底圖配置（使用 Unsplash 風景照，共 200 張）
export const storyBackgrounds = [
  // ========== 山脈系列 (1-25) ==========
  { id: 1, imageUrl: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80", fallbackGradient: "from-slate-900 via-slate-800 to-zinc-900" },
  { id: 2, imageUrl: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&q=80", fallbackGradient: "from-slate-900 via-slate-800 to-zinc-900" },
  { id: 3, imageUrl: "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800&q=80", fallbackGradient: "from-slate-950 via-gray-900 to-slate-900" },
  { id: 4, imageUrl: "https://images.unsplash.com/photo-1454496522488-7a8e488e8606?w=800&q=80", fallbackGradient: "from-slate-900 via-slate-800 to-zinc-900" },
  { id: 5, imageUrl: "https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?w=800&q=80", fallbackGradient: "from-slate-800 via-gray-800 to-slate-900" },
  { id: 6, imageUrl: "https://images.unsplash.com/photo-1483728642387-6c3bdd6c93e5?w=800&q=80", fallbackGradient: "from-slate-900 via-zinc-800 to-slate-800" },
  { id: 7, imageUrl: "https://images.unsplash.com/photo-1491002052546-bf38f186af56?w=800&q=80", fallbackGradient: "from-gray-900 via-slate-800 to-gray-800" },
  { id: 8, imageUrl: "https://images.unsplash.com/photo-1494500764479-0c8f2919a3d8?w=800&q=80", fallbackGradient: "from-slate-900 via-slate-800 to-zinc-900" },
  { id: 9, imageUrl: "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=800&q=80", fallbackGradient: "from-slate-800 via-gray-800 to-slate-900" },
  { id: 10, imageUrl: "https://images.unsplash.com/photo-1418065460487-3e41a6c84dc5?w=800&q=80", fallbackGradient: "from-gray-900 via-slate-800 to-gray-800" },
  { id: 11, imageUrl: "https://images.unsplash.com/photo-1434394354979-a235cd36269d?w=800&q=80", fallbackGradient: "from-slate-900 via-zinc-800 to-slate-800" },
  { id: 12, imageUrl: "https://images.unsplash.com/photo-1458668383970-8ddd3927deed?w=800&q=80", fallbackGradient: "from-slate-900 via-slate-800 to-zinc-900" },
  { id: 13, imageUrl: "https://images.unsplash.com/photo-1445363692815-ebcd599f7621?w=800&q=80", fallbackGradient: "from-slate-800 via-gray-800 to-slate-900" },
  { id: 14, imageUrl: "https://images.unsplash.com/photo-1464278533981-50106e6176b1?w=800&q=80", fallbackGradient: "from-gray-900 via-slate-800 to-gray-800" },
  { id: 15, imageUrl: "https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=800&q=80", fallbackGradient: "from-slate-900 via-slate-800 to-zinc-900" },
  { id: 16, imageUrl: "https://images.unsplash.com/photo-1464278533981-50106e6176b1?w=800&q=80", fallbackGradient: "from-slate-800 via-gray-800 to-slate-900" },
  { id: 17, imageUrl: "https://images.unsplash.com/photo-1477346611705-65d1883cee1e?w=800&q=80", fallbackGradient: "from-slate-900 via-slate-800 to-zinc-900" },
  { id: 18, imageUrl: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&q=80", fallbackGradient: "from-gray-900 via-slate-800 to-gray-800" },
  { id: 19, imageUrl: "https://images.unsplash.com/photo-1449825598015-eb92e5d2c0f7?w=800&q=80", fallbackGradient: "from-slate-900 via-zinc-800 to-slate-800" },
  { id: 20, imageUrl: "https://images.unsplash.com/photo-1484910292437-025e5d13ce87?w=800&q=80", fallbackGradient: "from-slate-800 via-gray-800 to-slate-900" },
  { id: 21, imageUrl: "https://images.unsplash.com/photo-1508193638397-1c4234db14d8?w=800&q=80", fallbackGradient: "from-slate-900 via-slate-800 to-zinc-900" },
  { id: 22, imageUrl: "https://images.unsplash.com/photo-1483728642387-6c3bdd6c93e5?w=800&q=80", fallbackGradient: "from-gray-900 via-slate-800 to-gray-800" },
  { id: 23, imageUrl: "https://images.unsplash.com/photo-1464278533981-50106e6176b1?w=800&q=80", fallbackGradient: "from-slate-900 via-zinc-800 to-slate-800" },
  { id: 24, imageUrl: "https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=800&q=80", fallbackGradient: "from-slate-800 via-gray-800 to-slate-900" },
  { id: 25, imageUrl: "https://images.unsplash.com/photo-1536431311719-398b6704d4cc?w=800&q=80", fallbackGradient: "from-slate-900 via-slate-800 to-zinc-900" },

  // ========== 海洋系列 (26-50) ==========
  { id: 26, imageUrl: "https://images.unsplash.com/photo-1505142468610-359e7d316be0?w=800&q=80", fallbackGradient: "from-slate-800 via-gray-800 to-slate-900" },
  { id: 27, imageUrl: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80", fallbackGradient: "from-slate-800 via-gray-800 to-slate-900" },
  { id: 28, imageUrl: "https://images.unsplash.com/photo-1476673160081-cf065607f449?w=800&q=80", fallbackGradient: "from-slate-900 via-slate-800 to-zinc-900" },
  { id: 29, imageUrl: "https://images.unsplash.com/photo-1484291470158-b8f8d608850d?w=800&q=80", fallbackGradient: "from-slate-800 via-gray-800 to-slate-900" },
  { id: 30, imageUrl: "https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=800&q=80", fallbackGradient: "from-slate-900 via-zinc-800 to-slate-800" },
  { id: 31, imageUrl: "https://images.unsplash.com/photo-1439405326854-014607f694d7?w=800&q=80", fallbackGradient: "from-slate-800 via-gray-800 to-slate-900" },
  { id: 32, imageUrl: "https://images.unsplash.com/photo-1468581264429-2548ef9eb732?w=800&q=80", fallbackGradient: "from-slate-900 via-slate-800 to-zinc-900" },
  { id: 33, imageUrl: "https://images.unsplash.com/photo-1471922694854-ff1b63b20054?w=800&q=80", fallbackGradient: "from-slate-800 via-gray-800 to-slate-900" },
  { id: 34, imageUrl: "https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=800&q=80", fallbackGradient: "from-slate-900 via-zinc-800 to-slate-800" },
  { id: 35, imageUrl: "https://images.unsplash.com/photo-1515238152791-8216bfdf89a7?w=800&q=80", fallbackGradient: "from-slate-800 via-gray-800 to-slate-900" },
  { id: 36, imageUrl: "https://images.unsplash.com/photo-1489914099268-1dad649f76bf?w=800&q=80", fallbackGradient: "from-slate-900 via-slate-800 to-zinc-900" },
  { id: 37, imageUrl: "https://images.unsplash.com/photo-1499002238440-d264edd596ec?w=800&q=80", fallbackGradient: "from-slate-800 via-gray-800 to-slate-900" },
  { id: 38, imageUrl: "https://images.unsplash.com/photo-1510414842594-a61c69b5ae57?w=800&q=80", fallbackGradient: "from-slate-900 via-zinc-800 to-slate-800" },
  { id: 39, imageUrl: "https://images.unsplash.com/photo-1520942702018-0862200e6873?w=800&q=80", fallbackGradient: "from-slate-800 via-gray-800 to-slate-900" },
  { id: 40, imageUrl: "https://images.unsplash.com/photo-1494791368093-85217fbbf8de?w=800&q=80", fallbackGradient: "from-slate-900 via-slate-800 to-zinc-900" },
  { id: 41, imageUrl: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80", fallbackGradient: "from-slate-800 via-gray-800 to-slate-900" },
  { id: 42, imageUrl: "https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=800&q=80", fallbackGradient: "from-slate-900 via-zinc-800 to-slate-800" },
  { id: 43, imageUrl: "https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=800&q=80", fallbackGradient: "from-slate-800 via-gray-800 to-slate-900" },
  { id: 44, imageUrl: "https://images.unsplash.com/photo-1454391304352-2bf4678b1a7a?w=800&q=80", fallbackGradient: "from-slate-900 via-slate-800 to-zinc-900" },
  { id: 45, imageUrl: "https://images.unsplash.com/photo-1468581264429-2548ef9eb732?w=800&q=80", fallbackGradient: "from-slate-800 via-gray-800 to-slate-900" },
  { id: 46, imageUrl: "https://images.unsplash.com/photo-1471922694854-ff1b63b20054?w=800&q=80", fallbackGradient: "from-slate-900 via-zinc-800 to-slate-800" },
  { id: 47, imageUrl: "https://images.unsplash.com/photo-1500375592092-40eb2168fd21?w=800&q=80", fallbackGradient: "from-slate-800 via-gray-800 to-slate-900" },
  { id: 48, imageUrl: "https://images.unsplash.com/photo-1504701954957-2010ec3bcec1?w=800&q=80", fallbackGradient: "from-slate-900 via-slate-800 to-zinc-900" },
  { id: 49, imageUrl: "https://images.unsplash.com/photo-1517483000871-1dbf64a6e1c6?w=800&q=80", fallbackGradient: "from-slate-800 via-gray-800 to-slate-900" },
  { id: 50, imageUrl: "https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=800&q=80", fallbackGradient: "from-slate-900 via-zinc-800 to-slate-800" },

  // ========== 森林系列 (51-75) ==========
  { id: 51, imageUrl: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&q=80", fallbackGradient: "from-gray-900 via-slate-800 to-gray-800" },
  { id: 52, imageUrl: "https://images.unsplash.com/photo-1448375240586-882707db888b?w=800&q=80", fallbackGradient: "from-gray-900 via-slate-800 to-gray-800" },
  { id: 53, imageUrl: "https://images.unsplash.com/photo-1502082553048-f009c37129b9?w=800&q=80", fallbackGradient: "from-slate-900 via-slate-800 to-zinc-900" },
  { id: 54, imageUrl: "https://images.unsplash.com/photo-1425913397330-cf8af2ff40a1?w=800&q=80", fallbackGradient: "from-gray-900 via-slate-800 to-gray-800" },
  { id: 55, imageUrl: "https://images.unsplash.com/photo-1476362174823-3a23f4aa6d76?w=800&q=80", fallbackGradient: "from-slate-900 via-zinc-800 to-slate-800" },
  { id: 56, imageUrl: "https://images.unsplash.com/photo-1473448912268-2022ce9509d8?w=800&q=80", fallbackGradient: "from-gray-900 via-slate-800 to-gray-800" },
  { id: 57, imageUrl: "https://images.unsplash.com/photo-1440581572325-0bea30075d9d?w=800&q=80", fallbackGradient: "from-slate-900 via-slate-800 to-zinc-900" },
  { id: 58, imageUrl: "https://images.unsplash.com/photo-1518173946687-a4c036bc8ce3?w=800&q=80", fallbackGradient: "from-gray-900 via-slate-800 to-gray-800" },
  { id: 59, imageUrl: "https://images.unsplash.com/photo-1542273917363-3b1817f69a2d?w=800&q=80", fallbackGradient: "from-slate-900 via-zinc-800 to-slate-800" },
  { id: 60, imageUrl: "https://images.unsplash.com/photo-1503435824048-a799a3a84bf7?w=800&q=80", fallbackGradient: "from-gray-900 via-slate-800 to-gray-800" },
  { id: 61, imageUrl: "https://images.unsplash.com/photo-1476231682828-37e571bc172f?w=800&q=80", fallbackGradient: "from-slate-900 via-slate-800 to-zinc-900" },
  { id: 62, imageUrl: "https://images.unsplash.com/photo-1431794062232-2a99a5431c6c?w=800&q=80", fallbackGradient: "from-gray-900 via-slate-800 to-gray-800" },
  { id: 63, imageUrl: "https://images.unsplash.com/photo-1507041957456-9c397ce39c97?w=800&q=80", fallbackGradient: "from-slate-900 via-zinc-800 to-slate-800" },
  { id: 64, imageUrl: "https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?w=800&q=80", fallbackGradient: "from-gray-900 via-slate-800 to-gray-800" },
  { id: 65, imageUrl: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800&q=80", fallbackGradient: "from-slate-900 via-slate-800 to-zinc-900" },
  { id: 66, imageUrl: "https://images.unsplash.com/photo-1448375240586-882707db888b?w=800&q=80", fallbackGradient: "from-gray-900 via-slate-800 to-gray-800" },
  { id: 67, imageUrl: "https://images.unsplash.com/photo-1476362174823-3a23f4aa6d76?w=800&q=80", fallbackGradient: "from-slate-900 via-zinc-800 to-slate-800" },
  { id: 68, imageUrl: "https://images.unsplash.com/photo-1502082553048-f009c37129b9?w=800&q=80", fallbackGradient: "from-gray-900 via-slate-800 to-gray-800" },
  { id: 69, imageUrl: "https://images.unsplash.com/photo-1518173946687-a4c036bc8ce3?w=800&q=80", fallbackGradient: "from-slate-900 via-slate-800 to-zinc-900" },
  { id: 70, imageUrl: "https://images.unsplash.com/photo-1473448912268-2022ce9509d8?w=800&q=80", fallbackGradient: "from-gray-900 via-slate-800 to-gray-800" },
  { id: 71, imageUrl: "https://images.unsplash.com/photo-1440581572325-0bea30075d9d?w=800&q=80", fallbackGradient: "from-slate-900 via-zinc-800 to-slate-800" },
  { id: 72, imageUrl: "https://images.unsplash.com/photo-1425913397330-cf8af2ff40a1?w=800&q=80", fallbackGradient: "from-gray-900 via-slate-800 to-gray-800" },
  { id: 73, imageUrl: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&q=80", fallbackGradient: "from-slate-900 via-slate-800 to-zinc-900" },
  { id: 74, imageUrl: "https://images.unsplash.com/photo-1542273917363-3b1817f69a2d?w=800&q=80", fallbackGradient: "from-gray-900 via-slate-800 to-gray-800" },
  { id: 75, imageUrl: "https://images.unsplash.com/photo-1476231682828-37e571bc172f?w=800&q=80", fallbackGradient: "from-slate-900 via-zinc-800 to-slate-800" },

  // ========== 沙漠 & 日落系列 (76-100) ==========
  { id: 76, imageUrl: "https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=800&q=80", fallbackGradient: "from-zinc-900 via-stone-800 to-zinc-800" },
  { id: 77, imageUrl: "https://images.unsplash.com/photo-1473580044384-7ba9967e16a0?w=800&q=80", fallbackGradient: "from-zinc-900 via-stone-800 to-zinc-800" },
  { id: 78, imageUrl: "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800&q=80", fallbackGradient: "from-slate-900 via-slate-800 to-zinc-900" },
  { id: 79, imageUrl: "https://images.unsplash.com/photo-1495107334309-fcf20504a5ab?w=800&q=80", fallbackGradient: "from-zinc-900 via-stone-800 to-zinc-800" },
  { id: 80, imageUrl: "https://images.unsplash.com/photo-1507400492013-162706c8c05e?w=800&q=80", fallbackGradient: "from-slate-900 via-slate-800 to-zinc-900" },
  { id: 81, imageUrl: "https://images.unsplash.com/photo-1504701954957-2010ec3bcec1?w=800&q=80", fallbackGradient: "from-zinc-900 via-stone-800 to-zinc-800" },
  { id: 82, imageUrl: "https://images.unsplash.com/photo-1499346030926-9a72daac6c63?w=800&q=80", fallbackGradient: "from-slate-900 via-slate-800 to-zinc-900" },
  { id: 83, imageUrl: "https://images.unsplash.com/photo-1495616811223-4d98c6e9c869?w=800&q=80", fallbackGradient: "from-zinc-900 via-stone-800 to-zinc-800" },
  { id: 84, imageUrl: "https://images.unsplash.com/photo-1506259091721-347e791bab0f?w=800&q=80", fallbackGradient: "from-slate-900 via-slate-800 to-zinc-900" },
  { id: 85, imageUrl: "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=800&q=80", fallbackGradient: "from-zinc-900 via-stone-800 to-zinc-800" },
  { id: 86, imageUrl: "https://images.unsplash.com/photo-1472120435266-53107fd0c44a?w=800&q=80", fallbackGradient: "from-slate-900 via-slate-800 to-zinc-900" },
  { id: 87, imageUrl: "https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=800&q=80", fallbackGradient: "from-zinc-900 via-stone-800 to-zinc-800" },
  { id: 88, imageUrl: "https://images.unsplash.com/photo-1495107334309-fcf20504a5ab?w=800&q=80", fallbackGradient: "from-slate-900 via-slate-800 to-zinc-900" },
  { id: 89, imageUrl: "https://images.unsplash.com/photo-1473580044384-7ba9967e16a0?w=800&q=80", fallbackGradient: "from-zinc-900 via-stone-800 to-zinc-800" },
  { id: 90, imageUrl: "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800&q=80", fallbackGradient: "from-slate-900 via-slate-800 to-zinc-900" },
  { id: 91, imageUrl: "https://images.unsplash.com/photo-1507400492013-162706c8c05e?w=800&q=80", fallbackGradient: "from-zinc-900 via-stone-800 to-zinc-800" },
  { id: 92, imageUrl: "https://images.unsplash.com/photo-1499346030926-9a72daac6c63?w=800&q=80", fallbackGradient: "from-slate-900 via-slate-800 to-zinc-900" },
  { id: 93, imageUrl: "https://images.unsplash.com/photo-1504701954957-2010ec3bcec1?w=800&q=80", fallbackGradient: "from-zinc-900 via-stone-800 to-zinc-800" },
  { id: 94, imageUrl: "https://images.unsplash.com/photo-1495616811223-4d98c6e9c869?w=800&q=80", fallbackGradient: "from-slate-900 via-slate-800 to-zinc-900" },
  { id: 95, imageUrl: "https://images.unsplash.com/photo-1506259091721-347e791bab0f?w=800&q=80", fallbackGradient: "from-zinc-900 via-stone-800 to-zinc-800" },
  { id: 96, imageUrl: "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=800&q=80", fallbackGradient: "from-slate-900 via-slate-800 to-zinc-900" },
  { id: 97, imageUrl: "https://images.unsplash.com/photo-1472120435266-53107fd0c44a?w=800&q=80", fallbackGradient: "from-zinc-900 via-stone-800 to-zinc-800" },
  { id: 98, imageUrl: "https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=800&q=80", fallbackGradient: "from-slate-900 via-slate-800 to-zinc-900" },
  { id: 99, imageUrl: "https://images.unsplash.com/photo-1495107334309-fcf20504a5ab?w=800&q=80", fallbackGradient: "from-zinc-900 via-stone-800 to-zinc-800" },
  { id: 100, imageUrl: "https://images.unsplash.com/photo-1473580044384-7ba9967e16a0?w=800&q=80", fallbackGradient: "from-slate-900 via-slate-800 to-zinc-900" },

  // ========== 湖泊 & 河流系列 (101-125) ==========
  { id: 101, imageUrl: "https://images.unsplash.com/photo-1439066615861-d1af74d74000?w=800&q=80", fallbackGradient: "from-slate-900 via-zinc-800 to-slate-800" },
  { id: 102, imageUrl: "https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=800&q=80", fallbackGradient: "from-slate-900 via-zinc-800 to-slate-800" },
  { id: 103, imageUrl: "https://images.unsplash.com/photo-1482192505345-5655af888cc4?w=800&q=80", fallbackGradient: "from-slate-800 via-gray-800 to-slate-900" },
  { id: 104, imageUrl: "https://images.unsplash.com/photo-1433838552652-f9a46b332c40?w=800&q=80", fallbackGradient: "from-slate-900 via-zinc-800 to-slate-800" },
  { id: 105, imageUrl: "https://images.unsplash.com/photo-1437622368342-7a3d73a34c8f?w=800&q=80", fallbackGradient: "from-slate-800 via-gray-800 to-slate-900" },
  { id: 106, imageUrl: "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=800&q=80", fallbackGradient: "from-slate-900 via-zinc-800 to-slate-800" },
  { id: 107, imageUrl: "https://images.unsplash.com/photo-1414609245224-afa02bfb3fda?w=800&q=80", fallbackGradient: "from-slate-800 via-gray-800 to-slate-900" },
  { id: 108, imageUrl: "https://images.unsplash.com/photo-1505765050516-f72dcac9c60e?w=800&q=80", fallbackGradient: "from-slate-900 via-zinc-800 to-slate-800" },
  { id: 109, imageUrl: "https://images.unsplash.com/photo-1418065460487-3e41a6c84dc5?w=800&q=80", fallbackGradient: "from-slate-800 via-gray-800 to-slate-900" },
  { id: 110, imageUrl: "https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=800&q=80", fallbackGradient: "from-slate-900 via-zinc-800 to-slate-800" },
  { id: 111, imageUrl: "https://images.unsplash.com/photo-1439066615861-d1af74d74000?w=800&q=80", fallbackGradient: "from-slate-800 via-gray-800 to-slate-900" },
  { id: 112, imageUrl: "https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=800&q=80", fallbackGradient: "from-slate-900 via-zinc-800 to-slate-800" },
  { id: 113, imageUrl: "https://images.unsplash.com/photo-1482192505345-5655af888cc4?w=800&q=80", fallbackGradient: "from-slate-800 via-gray-800 to-slate-900" },
  { id: 114, imageUrl: "https://images.unsplash.com/photo-1433838552652-f9a46b332c40?w=800&q=80", fallbackGradient: "from-slate-900 via-zinc-800 to-slate-800" },
  { id: 115, imageUrl: "https://images.unsplash.com/photo-1437622368342-7a3d73a34c8f?w=800&q=80", fallbackGradient: "from-slate-800 via-gray-800 to-slate-900" },
  { id: 116, imageUrl: "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=800&q=80", fallbackGradient: "from-slate-900 via-zinc-800 to-slate-800" },
  { id: 117, imageUrl: "https://images.unsplash.com/photo-1414609245224-afa02bfb3fda?w=800&q=80", fallbackGradient: "from-slate-800 via-gray-800 to-slate-900" },
  { id: 118, imageUrl: "https://images.unsplash.com/photo-1505765050516-f72dcac9c60e?w=800&q=80", fallbackGradient: "from-slate-900 via-zinc-800 to-slate-800" },
  { id: 119, imageUrl: "https://images.unsplash.com/photo-1418065460487-3e41a6c84dc5?w=800&q=80", fallbackGradient: "from-slate-800 via-gray-800 to-slate-900" },
  { id: 120, imageUrl: "https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=800&q=80", fallbackGradient: "from-slate-900 via-zinc-800 to-slate-800" },
  { id: 121, imageUrl: "https://images.unsplash.com/photo-1439066615861-d1af74d74000?w=800&q=80", fallbackGradient: "from-slate-800 via-gray-800 to-slate-900" },
  { id: 122, imageUrl: "https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=800&q=80", fallbackGradient: "from-slate-900 via-zinc-800 to-slate-800" },
  { id: 123, imageUrl: "https://images.unsplash.com/photo-1482192505345-5655af888cc4?w=800&q=80", fallbackGradient: "from-slate-800 via-gray-800 to-slate-900" },
  { id: 124, imageUrl: "https://images.unsplash.com/photo-1433838552652-f9a46b332c40?w=800&q=80", fallbackGradient: "from-slate-900 via-zinc-800 to-slate-800" },
  { id: 125, imageUrl: "https://images.unsplash.com/photo-1437622368342-7a3d73a34c8f?w=800&q=80", fallbackGradient: "from-slate-800 via-gray-800 to-slate-900" },

  // ========== 雲 & 天空系列 (126-150) ==========
  { id: 126, imageUrl: "https://images.unsplash.com/photo-1534088568595-a066f410bcda?w=800&q=80", fallbackGradient: "from-gray-800 via-slate-900 to-gray-900" },
  { id: 127, imageUrl: "https://images.unsplash.com/photo-1517483000871-1dbf64a6e1c6?w=800&q=80", fallbackGradient: "from-gray-800 via-slate-900 to-gray-900" },
  { id: 128, imageUrl: "https://images.unsplash.com/photo-1500740516770-92bd004b996e?w=800&q=80", fallbackGradient: "from-slate-900 via-slate-800 to-zinc-900" },
  { id: 129, imageUrl: "https://images.unsplash.com/photo-1463947628408-f8581a2f4aca?w=800&q=80", fallbackGradient: "from-gray-800 via-slate-900 to-gray-900" },
  { id: 130, imageUrl: "https://images.unsplash.com/photo-1505533321630-975218a5f66f?w=800&q=80", fallbackGradient: "from-slate-900 via-slate-800 to-zinc-900" },
  { id: 131, imageUrl: "https://images.unsplash.com/photo-1504253163759-c23fccaebb55?w=800&q=80", fallbackGradient: "from-gray-800 via-slate-900 to-gray-900" },
  { id: 132, imageUrl: "https://images.unsplash.com/photo-1517495306984-f84210f9daa8?w=800&q=80", fallbackGradient: "from-slate-900 via-slate-800 to-zinc-900" },
  { id: 133, imageUrl: "https://images.unsplash.com/photo-1498496294664-d9372eb521f3?w=800&q=80", fallbackGradient: "from-gray-800 via-slate-900 to-gray-900" },
  { id: 134, imageUrl: "https://images.unsplash.com/photo-1436891620584-47fd0e565afb?w=800&q=80", fallbackGradient: "from-slate-900 via-slate-800 to-zinc-900" },
  { id: 135, imageUrl: "https://images.unsplash.com/photo-1499956827185-0d63ee78a910?w=800&q=80", fallbackGradient: "from-gray-800 via-slate-900 to-gray-900" },
  { id: 136, imageUrl: "https://images.unsplash.com/photo-1534088568595-a066f410bcda?w=800&q=80", fallbackGradient: "from-slate-900 via-slate-800 to-zinc-900" },
  { id: 137, imageUrl: "https://images.unsplash.com/photo-1517483000871-1dbf64a6e1c6?w=800&q=80", fallbackGradient: "from-gray-800 via-slate-900 to-gray-900" },
  { id: 138, imageUrl: "https://images.unsplash.com/photo-1500740516770-92bd004b996e?w=800&q=80", fallbackGradient: "from-slate-900 via-slate-800 to-zinc-900" },
  { id: 139, imageUrl: "https://images.unsplash.com/photo-1463947628408-f8581a2f4aca?w=800&q=80", fallbackGradient: "from-gray-800 via-slate-900 to-gray-900" },
  { id: 140, imageUrl: "https://images.unsplash.com/photo-1505533321630-975218a5f66f?w=800&q=80", fallbackGradient: "from-slate-900 via-slate-800 to-zinc-900" },
  { id: 141, imageUrl: "https://images.unsplash.com/photo-1504253163759-c23fccaebb55?w=800&q=80", fallbackGradient: "from-gray-800 via-slate-900 to-gray-900" },
  { id: 142, imageUrl: "https://images.unsplash.com/photo-1517495306984-f84210f9daa8?w=800&q=80", fallbackGradient: "from-slate-900 via-slate-800 to-zinc-900" },
  { id: 143, imageUrl: "https://images.unsplash.com/photo-1498496294664-d9372eb521f3?w=800&q=80", fallbackGradient: "from-gray-800 via-slate-900 to-gray-900" },
  { id: 144, imageUrl: "https://images.unsplash.com/photo-1436891620584-47fd0e565afb?w=800&q=80", fallbackGradient: "from-slate-900 via-slate-800 to-zinc-900" },
  { id: 145, imageUrl: "https://images.unsplash.com/photo-1499956827185-0d63ee78a910?w=800&q=80", fallbackGradient: "from-gray-800 via-slate-900 to-gray-900" },
  { id: 146, imageUrl: "https://images.unsplash.com/photo-1534088568595-a066f410bcda?w=800&q=80", fallbackGradient: "from-slate-900 via-slate-800 to-zinc-900" },
  { id: 147, imageUrl: "https://images.unsplash.com/photo-1517483000871-1dbf64a6e1c6?w=800&q=80", fallbackGradient: "from-gray-800 via-slate-900 to-gray-900" },
  { id: 148, imageUrl: "https://images.unsplash.com/photo-1500740516770-92bd004b996e?w=800&q=80", fallbackGradient: "from-slate-900 via-slate-800 to-zinc-900" },
  { id: 149, imageUrl: "https://images.unsplash.com/photo-1463947628408-f8581a2f4aca?w=800&q=80", fallbackGradient: "from-gray-800 via-slate-900 to-gray-900" },
  { id: 150, imageUrl: "https://images.unsplash.com/photo-1505533321630-975218a5f66f?w=800&q=80", fallbackGradient: "from-slate-900 via-slate-800 to-zinc-900" },

  // ========== 星空 & 夜景系列 (151-175) ==========
  { id: 151, imageUrl: "https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=800&q=80", fallbackGradient: "from-slate-950 via-gray-900 to-slate-900" },
  { id: 152, imageUrl: "https://images.unsplash.com/photo-1507400492013-162706c8c05e?w=800&q=80", fallbackGradient: "from-slate-950 via-gray-900 to-slate-900" },
  { id: 153, imageUrl: "https://images.unsplash.com/photo-1475274047050-1d0c0975c63e?w=800&q=80", fallbackGradient: "from-slate-950 via-slate-900 to-gray-900" },
  { id: 154, imageUrl: "https://images.unsplash.com/photo-1444703686981-a3abbc4d4fe3?w=800&q=80", fallbackGradient: "from-slate-950 via-gray-900 to-slate-900" },
  { id: 155, imageUrl: "https://images.unsplash.com/photo-1507400492013-162706c8c05e?w=800&q=80", fallbackGradient: "from-slate-950 via-slate-900 to-gray-900" },
  { id: 156, imageUrl: "https://images.unsplash.com/photo-1502899576159-f224dc2349fa?w=800&q=80", fallbackGradient: "from-slate-950 via-gray-900 to-slate-900" },
  { id: 157, imageUrl: "https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=800&q=80", fallbackGradient: "from-slate-950 via-slate-900 to-gray-900" },
  { id: 158, imageUrl: "https://images.unsplash.com/photo-1489549132488-d00b7eee80f1?w=800&q=80", fallbackGradient: "from-slate-950 via-gray-900 to-slate-900" },
  { id: 159, imageUrl: "https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?w=800&q=80", fallbackGradient: "from-slate-950 via-slate-900 to-gray-900" },
  { id: 160, imageUrl: "https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=800&q=80", fallbackGradient: "from-slate-950 via-gray-900 to-slate-900" },
  { id: 161, imageUrl: "https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=800&q=80", fallbackGradient: "from-slate-950 via-slate-900 to-gray-900" },
  { id: 162, imageUrl: "https://images.unsplash.com/photo-1468276311594-df7cb65d8df6?w=800&q=80", fallbackGradient: "from-slate-950 via-gray-900 to-slate-900" },
  { id: 163, imageUrl: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&q=80", fallbackGradient: "from-slate-950 via-slate-900 to-gray-900" },
  { id: 164, imageUrl: "https://images.unsplash.com/photo-1465101162946-4377e57745c3?w=800&q=80", fallbackGradient: "from-slate-950 via-gray-900 to-slate-900" },
  { id: 165, imageUrl: "https://images.unsplash.com/photo-1509773896068-7fd415d91e2e?w=800&q=80", fallbackGradient: "from-slate-950 via-slate-900 to-gray-900" },
  { id: 166, imageUrl: "https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=800&q=80", fallbackGradient: "from-slate-950 via-gray-900 to-slate-900" },
  { id: 167, imageUrl: "https://images.unsplash.com/photo-1475274047050-1d0c0975c63e?w=800&q=80", fallbackGradient: "from-slate-950 via-slate-900 to-gray-900" },
  { id: 168, imageUrl: "https://images.unsplash.com/photo-1444703686981-a3abbc4d4fe3?w=800&q=80", fallbackGradient: "from-slate-950 via-gray-900 to-slate-900" },
  { id: 169, imageUrl: "https://images.unsplash.com/photo-1502899576159-f224dc2349fa?w=800&q=80", fallbackGradient: "from-slate-950 via-slate-900 to-gray-900" },
  { id: 170, imageUrl: "https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=800&q=80", fallbackGradient: "from-slate-950 via-gray-900 to-slate-900" },
  { id: 171, imageUrl: "https://images.unsplash.com/photo-1489549132488-d00b7eee80f1?w=800&q=80", fallbackGradient: "from-slate-950 via-slate-900 to-gray-900" },
  { id: 172, imageUrl: "https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?w=800&q=80", fallbackGradient: "from-slate-950 via-gray-900 to-slate-900" },
  { id: 173, imageUrl: "https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=800&q=80", fallbackGradient: "from-slate-950 via-slate-900 to-gray-900" },
  { id: 174, imageUrl: "https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=800&q=80", fallbackGradient: "from-slate-950 via-gray-900 to-slate-900" },
  { id: 175, imageUrl: "https://images.unsplash.com/photo-1468276311594-df7cb65d8df6?w=800&q=80", fallbackGradient: "from-slate-950 via-slate-900 to-gray-900" },

  // ========== 城市 & 建築系列 (176-200) ==========
  { id: 176, imageUrl: "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=800&q=80", fallbackGradient: "from-gray-900 via-slate-800 to-gray-800" },
  { id: 177, imageUrl: "https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=800&q=80", fallbackGradient: "from-slate-900 via-slate-800 to-zinc-900" },
  { id: 178, imageUrl: "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=800&q=80", fallbackGradient: "from-gray-900 via-slate-800 to-gray-800" },
  { id: 179, imageUrl: "https://images.unsplash.com/photo-1514565131-fce0801e5785?w=800&q=80", fallbackGradient: "from-slate-900 via-zinc-800 to-slate-800" },
  { id: 180, imageUrl: "https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=800&q=80", fallbackGradient: "from-gray-900 via-slate-800 to-gray-800" },
  { id: 181, imageUrl: "https://images.unsplash.com/photo-1444723121867-7a241cacace9?w=800&q=80", fallbackGradient: "from-slate-900 via-slate-800 to-zinc-900" },
  { id: 182, imageUrl: "https://images.unsplash.com/photo-1486299267070-83823f5448dd?w=800&q=80", fallbackGradient: "from-gray-900 via-slate-800 to-gray-800" },
  { id: 183, imageUrl: "https://images.unsplash.com/photo-1470219556762-1771e7f9427d?w=800&q=80", fallbackGradient: "from-slate-900 via-zinc-800 to-slate-800" },
  { id: 184, imageUrl: "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=800&q=80", fallbackGradient: "from-gray-900 via-slate-800 to-gray-800" },
  { id: 185, imageUrl: "https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=800&q=80", fallbackGradient: "from-slate-900 via-slate-800 to-zinc-900" },
  { id: 186, imageUrl: "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=800&q=80", fallbackGradient: "from-gray-900 via-slate-800 to-gray-800" },
  { id: 187, imageUrl: "https://images.unsplash.com/photo-1514565131-fce0801e5785?w=800&q=80", fallbackGradient: "from-slate-900 via-zinc-800 to-slate-800" },
  { id: 188, imageUrl: "https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=800&q=80", fallbackGradient: "from-gray-900 via-slate-800 to-gray-800" },
  { id: 189, imageUrl: "https://images.unsplash.com/photo-1444723121867-7a241cacace9?w=800&q=80", fallbackGradient: "from-slate-900 via-slate-800 to-zinc-900" },
  { id: 190, imageUrl: "https://images.unsplash.com/photo-1486299267070-83823f5448dd?w=800&q=80", fallbackGradient: "from-gray-900 via-slate-800 to-gray-800" },
  { id: 191, imageUrl: "https://images.unsplash.com/photo-1470219556762-1771e7f9427d?w=800&q=80", fallbackGradient: "from-slate-900 via-zinc-800 to-slate-800" },
  { id: 192, imageUrl: "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=800&q=80", fallbackGradient: "from-gray-900 via-slate-800 to-gray-800" },
  { id: 193, imageUrl: "https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=800&q=80", fallbackGradient: "from-slate-900 via-slate-800 to-zinc-900" },
  { id: 194, imageUrl: "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=800&q=80", fallbackGradient: "from-gray-900 via-slate-800 to-gray-800" },
  { id: 195, imageUrl: "https://images.unsplash.com/photo-1514565131-fce0801e5785?w=800&q=80", fallbackGradient: "from-slate-900 via-zinc-800 to-slate-800" },
  { id: 196, imageUrl: "https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=800&q=80", fallbackGradient: "from-gray-900 via-slate-800 to-gray-800" },
  { id: 197, imageUrl: "https://images.unsplash.com/photo-1444723121867-7a241cacace9?w=800&q=80", fallbackGradient: "from-slate-900 via-slate-800 to-zinc-900" },
  { id: 198, imageUrl: "https://images.unsplash.com/photo-1486299267070-83823f5448dd?w=800&q=80", fallbackGradient: "from-gray-900 via-slate-800 to-gray-800" },
  { id: 199, imageUrl: "https://images.unsplash.com/photo-1470219556762-1771e7f9427d?w=800&q=80", fallbackGradient: "from-slate-900 via-zinc-800 to-slate-800" },
  { id: 200, imageUrl: "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=800&q=80", fallbackGradient: "from-gray-900 via-slate-800 to-gray-800" },
];

/**
 * 根據日期取得當天的金句
 * 使用日期 hash 確保全平台同步
 */
export const getTodayQuote = (date: Date = new Date()): DailyQuote => {
  const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
  const hash = dateStr.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const index = hash % dailyQuotes.length;
  return dailyQuotes[index];
};

/**
 * 根據日期取得當天的底圖
 */
export const getTodayBackground = (date: Date = new Date()) => {
  const dateStr = date.toISOString().split('T')[0];
  const hash = dateStr.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const index = hash % storyBackgrounds.length;
  return storyBackgrounds[index];
};

/**
 * 格式化日期為中文格式
 */
export const formatDateChinese = (date: Date = new Date()): string => {
  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
};

/**
 * 隨機取得一句金句
 */
export const getRandomQuote = (): DailyQuote => {
  const index = Math.floor(Math.random() * dailyQuotes.length);
  return dailyQuotes[index];
};

/**
 * 隨機取得一張底圖
 */
export const getRandomBackground = () => {
  const index = Math.floor(Math.random() * storyBackgrounds.length);
  return storyBackgrounds[index];
};

// ==========================================
// IG 風格專用金句（有標題 + 分段內容）
// ==========================================
export interface IGStyleQuote {
  title: string;    // 大標題（吸引注意）
  lines: string[];  // 分段內容（3-5 點）
}

export const igStyleQuotes: IGStyleQuote[] = [
  {
    title: "有錢人不告訴你的秘密",
    lines: [
      "他們買資產，不買負債",
      "他們讓錢為自己工作",
      "他們投資自己的腦袋",
      "他們延遲享樂，先苦後甜",
    ]
  },
  {
    title: "月薪3萬也能存到錢",
    lines: [
      "先存再花，不是花剩才存",
      "記帳找出隱形支出",
      "拿鐵因子每月省3000+",
      "定期定額養成投資習慣",
    ]
  },
  {
    title: "退休前你該知道的事",
    lines: [
      "勞保+勞退只夠40%替代率",
      "通膨每年吃掉3%購買力",
      "60歲退休要準備30年生活費",
      "越早開始，壓力越小",
    ]
  },
  {
    title: "投資新手常犯的錯",
    lines: [
      "追高殺低，買在最高點",
      "聽明牌，不做功課",
      "短線進出，手續費吃掉獲利",
      "沒有停損，小虧變大虧",
    ]
  },
  {
    title: "財務自由的定義",
    lines: [
      "不是賺很多錢",
      "而是被動收入 > 生活支出",
      "有選擇工作的自由",
      "時間真正屬於自己",
    ]
  },
  {
    title: "複利的威力",
    lines: [
      "每月5000，年化7%",
      "10年後：86萬",
      "20年後：260萬",
      "30年後：600萬",
    ]
  },
  {
    title: "信用卡的陷阱",
    lines: [
      "分期0利率？年利率其實14.8%",
      "最低應繳？剩餘金額照算利息",
      "循環利息？複利讓債務翻倍",
      "用現金買得起，才是真買得起",
    ]
  },
  {
    title: "節稅不是逃稅",
    lines: [
      "贈與稅每年244萬免稅額",
      "保險給付免所得稅",
      "自住房地合一400萬免稅",
      "提早規劃，合法少繳很多",
    ]
  },
  {
    title: "ETF 適合你嗎？",
    lines: [
      "低成本，管理費只要0.2%",
      "分散風險，一次買進多檔股票",
      "不用選股，追蹤指數即可",
      "長期持有，打敗大多數基金",
    ]
  },
  {
    title: "保險的正確觀念",
    lines: [
      "保障優先，儲蓄其次",
      "先保大風險，再保小風險",
      "保費不超過收入10%",
      "定期險CP值最高",
    ]
  },
  {
    title: "買房前要想清楚",
    lines: [
      "頭期款至少要準備3成",
      "月付金不超過收入1/3",
      "維護成本每年約房價1-2%",
      "買房不是終點，是另一個起點",
    ]
  },
  {
    title: "存錢的正確順序",
    lines: [
      "1. 緊急預備金（3-6個月）",
      "2. 保險（轉移風險）",
      "3. 投資（讓錢長大）",
      "4. 消費（享受人生）",
    ]
  },
  {
    title: "窮人 vs 富人思維",
    lines: [
      "窮人：我買不起",
      "富人：我怎麼買得起？",
      "窮人：錢是用來花的",
      "富人：錢是用來生錢的",
    ]
  },
  {
    title: "時間比金錢重要",
    lines: [
      "25歲開始投資",
      "比35歲開始投入2倍本金還多",
      "時間是複利最強催化劑",
      "今天開始，永遠不嫌晚",
    ]
  },
  {
    title: "理財的本質",
    lines: [
      "不是省吃儉用",
      "不是投機暴富",
      "而是有計畫地",
      "讓錢為你工作",
    ]
  },
];

/**
 * 根據日期取得當天的 IG 風格金句
 */
export const getTodayIGQuote = (date: Date = new Date()): IGStyleQuote => {
  const dateStr = date.toISOString().split('T')[0];
  const hash = dateStr.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const index = hash % igStyleQuotes.length;
  return igStyleQuotes[index];
};

/**
 * 隨機取得一個 IG 風格金句
 */
export const getRandomIGQuote = (): IGStyleQuote => {
  const index = Math.floor(Math.random() * igStyleQuotes.length);
  return igStyleQuotes[index];
};
