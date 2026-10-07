/**
 * types-data.js
 * 「KAKU ～核～」KAKU TYPE 定義データ
 *
 * ここに書かれているタイプ名・コピー・モチーフ・色は【仮実装】です。
 * 設計書の「確定仕様」は次の2点のみです:
 *   1) タイプは CORE6 の「主軸 × 副軸」から機械的に決定される（type-engine.js）
 *   2) 各タイプは KAKU CARD（キャラクター画像 + TYPE SYMBOL + カラー + キャッチコピー）として
 *      結果ページ・SNSシェア・プロフィール・TEAM MAP・MATCH・PERSONAL BOOK で共通利用される
 *
 * タイプの名称・数・コピー文言・カラーは今後変更されても良いようにこの1ファイルへ集約している。
 * （コード側は id で参照するだけで、文言や色を直接埋め込まない）
 *
 * 2026-09時点の重要な注記（16タイプ→12タイプへの移行について）:
 * KAKUのタイプ体系は、MBTIの派生に見えることを避けるため、対外的には
 * 「12 KAKU TYPE（創造型／推進型／共創型の3分類）」に整理する方針になった。
 * ただし、判定ロジック（type-engine.jsのTYPE_MATRIX）自体はまだ12タイプ向けに
 * 再設計されておらず、今も内部的には以下16種類すべてが診断結果として出力され得る。
 *
 * そのため、このファイルでは以下の対応にとどめている（安全側に倒した対応）:
 *   - 新体系で残る12タイプには `category` フィールド（"creative"|"momentum"|"synergy"）を追加
 *   - 新体系で廃止予定の4タイプ（mediator / builder / adventurer / finisher）は
 *     `category: null, legacy: true` とし、データ自体は削除しない
 *     （削除すると、診断ロジックが今もこの4タイプを返し得るため、その4タイプを
 *     引いた利用者の結果ページ・PERSONAL BOOKが壊れてしまう）
 *   - TOPページやタイプ一覧ページ（app.jsのrenderTypesGallery等）は、category を
 *     持つ12タイプだけを表示するようフィルタしている
 *   - 判定ロジックを実際に12タイプ用に再設計するタイミングで、この4タイプの扱い
 *     （完全削除するか、他タイプへ統合するか）を改めて決定する必要がある
 *
 * 12タイプの3分類とカテゴリ別の説明・配色は KAKU_TYPE_CATEGORIES にまとめている。
 */

const KAKU_TYPES = {
  architect: {
    id: "architect",
    category: "creative",
    nameEn: "ARCHITECT",
    nameJp: "設計者",
    catchcopy: "まだ存在しない答えを、構造からつくる。",
    rarity: "6.7%",
    praise: "あなたは、誰も気づいていない『答えの形』が見えている人です。",
    color: "#4A5BB5",
    motif: "幾何学的な設計図・ブループリントの線",
    image: "architect.jpg",
    weapon: "複雑な物事を整理し、筋の通った設計図に落とし込む力。誰も見えていない全体像を先に描ける。",
    blindSpot: "完璧な構造を求めるあまり、動き出すタイミングを逃しやすい。",
    teamRole: "チームの土台となる仕組みや計画を設計する「設計図担当」。",
    relationStyle: "感情より論理を優先しがちで、距離を詰めるのに時間がかかるが、一度信頼すると長く続く関係を築く。",
    awaken: {
      keywords: ["構造", "静けさ", "先見"],
      sentence: "誰よりも先に、まだない形を思い描いている。",
    },
    shutdown: {
      keywords: ["拙速", "監視", "雑音"],
      sentence: "全体像が見えないまま急かされると、途端に力を失う。",
    },
    personalBookInsight: "ARCHITECTのあなたは、目の前の状況よりも「本来あるべき形」を先に描いてしまう思考のクセを持っています。これは周囲から見ると、時に一歩引いているように映るかもしれませんが、実際にはすでに何手も先まで設計図を描き終えている状態です。焦って発言せず、構造が固まってから話す方が、あなたの言葉には説得力が宿ります。",
    personalBookAction: "アイデアを話す前に、あえて紙やメモに一度「全体像」を書き出してみましょう。頭の中の設計図が言語化されることで、周囲を巻き込みやすくなります。",
  },
  pioneer: {
    id: "pioneer",
    category: "creative",
    nameEn: "PIONEER",
    nameJp: "開拓者",
    catchcopy: "誰も踏み入れていない場所に、最初の一歩を。",
    rarity: "6.7%",
    praise: "あなたは、誰かが道を作るのを待たずに、自分で最初の足跡を残せる人です。",
    color: "#3B6FCF",
    motif: "コンパスや未開の地図",
    image: "pioneer.jpg",
    weapon: "前例のない状況でも臆せず動き出せる行動力と好奇心。",
    blindSpot: "新しいことに気を取られ、今あるものを仕上げる前に次へ向かいがち。",
    teamRole: "誰もやったことのない領域を切り拓く「探索担当」。",
    relationStyle: "一緒に新しい体験をすることで距離が縮まるタイプ。ルーティンな関係には物足りなさを感じやすい。",
    awaken: {
      keywords: ["未踏", "好奇心", "一歩目"],
      sentence: "地図にない場所ほど、心が動く。",
    },
    shutdown: {
      keywords: ["反復作業", "前例主義", "足踏み"],
      sentence: "同じことの繰り返しを強いられると、少しずつ心が乾いていく。",
    },
    personalBookInsight: "PIONEERのあなたにとって、前例のなさは不安材料ではなく、むしろエネルギー源です。ただし、開拓した後の「整備」や「継続」は得意分野ではないため、道を切り拓いた後は、それを形にしてくれる仲間に思い切って託すことが、あなたの開拓者としての価値をさらに高めます。",
    personalBookAction: "新しい挑戦を始めたら、早い段階で「これを一緒に育ててくれる人」を見つけておきましょう。一人で最後まで抱え込まないことが、次の挑戦への体力を残すコツです。",
  },
  commander: {
    id: "commander",
    category: "momentum",
    nameEn: "COMMANDER",
    nameJp: "指揮官",
    catchcopy: "全体を見渡し、人を動かす。",
    rarity: "3.3%",
    praise: "あなたは、放っておいても自然と周りが頼ってくる、生まれながらのリーダーです。",
    color: "#B8231B",
    motif: "指揮杖・戦略盤の駒",
    image: "commander.jpg",
    weapon: "状況を俯瞰して的確な判断を下し、人を巻き込みながら前進させる力。",
    blindSpot: "主導権を握りすぎて、周囲の意見を聞き逃すことがある。",
    teamRole: "チーム全体の方向性を決め、動かす「指揮担当」。",
    relationStyle: "頼れる存在として頼られることが多いが、弱さを見せるのは苦手。",
    awaken: {
      keywords: ["統率", "決断", "全体像"],
      sentence: "迷いを断ち切り、進む方向を示す。",
    },
    shutdown: {
      keywords: ["指示待ち", "権限なし", "蚊帳の外"],
      sentence: "判断を任されず、ただ従うだけの立場に置かれると力を発揮できない。",
    },
    personalBookInsight: "COMMANDERのあなたは、放っておいても自然と場の中心に立ってしまうタイプです。それは頼もしさである一方、周囲が本音を言い出しにくくなる空気を生むこともあります。強さを見せることと同じくらい、時々弱さを見せることが、チームの本音を引き出す鍵になります。",
    personalBookAction: "会議やチームの場で、あえて一度「自分にも分からないことがある」と口にしてみましょう。それだけで周囲の発言のハードルが下がります。",
  },
  creator: {
    id: "creator",
    category: "creative",
    nameEn: "CREATOR",
    nameJp: "創造者",
    catchcopy: "何もないところから、形を生み出す。",
    rarity: "6.7%",
    praise: "あなたは、何もない場所に価値を生み出せる、稀有な発想力の持ち主です。",
    color: "#8458BF",
    motif: "光の粒子が集まって形になる様子",
    image: "creator.jpg",
    weapon: "既存の枠にとらわれず、自由な発想で新しいものを生み出す想像力。",
    blindSpot: "アイデアが多すぎて、一つのことをやり切るのが苦手なことがある。",
    teamRole: "新しい企画やアイデアの種をまく「発想担当」。",
    relationStyle: "感性で惹かれ合う関係を好み、刺激のないやり取りには退屈しやすい。",
    awaken: {
      keywords: ["発想", "自由", "創造"],
      sentence: "誰も見たことのないものを、思い描ける。",
    },
    shutdown: {
      keywords: ["型にはめる", "前例踏襲", "制約過多"],
      sentence: "決まった型をなぞるだけの作業に、発想がだんだん閉じていく。",
    },
    personalBookInsight: "CREATORのあなたは、アイデアが次々と湧いてくる一方で、それを最後まで形にする前に次の発想に気を取られてしまうことがあります。すべてのアイデアを自分一人で完成させようとせず、「形にする担当」の仲間と組むことで、あなたの発想はより多くの人に届くようになります。",
    personalBookAction: "浮かんだアイデアは、その場でメモやラフに残す習慣をつけましょう。完成させることより、まず「消えないようにする」ことを優先してみてください。",
  },
  strategist: {
    id: "strategist",
    category: "creative",
    nameEn: "STRATEGIST",
    nameJp: "戦略家",
    catchcopy: "何手も先を読み、勝ち筋を描く。",
    rarity: "6.7%",
    praise: "あなたは、周りが慌てる場面でも冷静に『勝ち筋』を描ける人です。",
    color: "#2B3590",
    motif: "チェス盤・多層に重なる矢印",
    image: "strategist.jpg",
    weapon: "情報を整理し、最短距離で目的を達成する筋道を組み立てる力。",
    blindSpot: "考えすぎて動き出すのが遅れたり、感情的な場面で冷たく見られることがある。",
    teamRole: "目的達成までの道筋を組み立てる「戦略担当」。",
    relationStyle: "じっくり信頼を積み重ねるタイプ。表面的な付き合いより、深い対話を好む。",
    awaken: {
      keywords: ["先読み", "論理", "一手"],
      sentence: "感情より、確実な一手を選ぶ。",
    },
    shutdown: {
      keywords: ["即断強要", "情報不足", "感情的圧力"],
      sentence: "考える時間を奪われ、勢いだけで決めさせられると本来の力が出ない。",
    },
    personalBookInsight: "STRATEGISTのあなたは、感情よりも構造で物事を捉えるため、周囲から「冷静」「読めない」と思われることがあります。しかしその裏では、誰よりも先の展開まで考え抜いています。時々、その思考のプロセスを言葉にして共有するだけで、周囲の信頼はぐっと深まります。",
    personalBookAction: "重要な判断をする前に、「なぜそう考えたか」を一言だけ周囲に説明してみましょう。結論だけでなく過程を見せることが、あなたの戦略への理解者を増やします。",
  },
  challenger: {
    id: "challenger",
    category: "momentum",
    nameEn: "CHALLENGER",
    nameJp: "挑戦者",
    catchcopy: "壁があるほど、燃える。",
    rarity: "6.7%",
    praise: "あなたは、壁を見ると燃えてくる、生まれついての突破者です。",
    color: "#E0522E",
    motif: "稲妻・上昇する矢印",
    image: "challenger.jpg",
    weapon: "困難な状況でこそ力を発揮する突破力と瞬発力。",
    blindSpot: "勢いで動きすぎて、周囲を置き去りにしてしまうことがある。",
    teamRole: "停滞した状況を動かす「突破担当」。",
    relationStyle: "情熱的にぶつかり合うことを恐れない。刺激の少ない関係には物足りなさを感じる。",
    awaken: {
      keywords: ["突破", "瞬発", "情熱"],
      sentence: "壁は、越えるためにある。",
    },
    shutdown: {
      keywords: ["安全運転", "停滞", "障害なし"],
      sentence: "乗り越える壁がない環境では、次第に熱量が冷めていく。",
    },
    personalBookInsight: "CHALLENGERのあなたは、困難な状況ほど力が湧いてくるタイプですが、その勢いに周囲がついていけないことがあります。突破すること自体はあなたの才能なので、あとは「なぜそこに向かうのか」を先に共有する一手間が、周囲を置き去りにしないための鍵になります。",
    personalBookAction: "新しい挑戦を始める前に、関係者に一言「これをやる理由」を伝えてから動き出してみましょう。それだけで周囲の協力度が大きく変わります。",
  },
  influencer: {
    id: "influencer",
    category: "momentum",
    nameEn: "INFLUENCER",
    nameJp: "伝道者",
    catchcopy: "言葉と熱量で、人を巻き込む。",
    rarity: "6.7%",
    praise: "あなたは、言葉ひとつで場の空気を変えられる、影響力のある人です。",
    color: "#DD4A60",
    motif: "波紋のように広がる音波や光",
    image: "influencer.jpg",
    weapon: "自分の想いや考えを言葉にして人の心を動かす表現力。",
    blindSpot: "場の空気や期待に合わせすぎて、本音を後回しにしがち。",
    teamRole: "チームの熱量を高め、外に向けて発信する「伝道担当」。",
    relationStyle: "人を惹きつけるが、深く一対一で向き合う時間も同じくらい大切にしたいタイプ。",
    awaken: {
      keywords: ["発信", "熱量", "共感"],
      sentence: "言葉にした瞬間、想いは力になる。",
    },
    shutdown: {
      keywords: ["沈黙", "無反応", "一方通行"],
      sentence: "伝えても誰にも届かない環境では、言葉の力がだんだん萎んでいく。",
    },
    personalBookInsight: "INFLUENCERのあなたは、言葉と熱量で周囲を動かせる稀有な力を持っています。ただしその分、場の期待に応えようとして、本音を後回しにしてしまう場面もあるはずです。発信する前に、まず自分自身に「本当にそう思っているか」を確認する習慣が、あなたの言葉をさらに強くします。",
    personalBookAction: "人前で話す前に、一人の時間で「自分は本当は何を伝えたいのか」を紙に書き出してみましょう。熱量に説得力が加わります。",
  },
  connector: {
    id: "connector",
    category: "synergy",
    nameEn: "CONNECTOR",
    nameJp: "連結者",
    catchcopy: "人と人、点と点をつなぐ。",
    rarity: "6.7%",
    praise: "あなたは、誰も気づかないところで人と人をつなぎ、物事を動かしている人です。",
    color: "#1FA37F",
    motif: "結ばれる線・ネットワークのノード",
    image: "connector.jpg",
    weapon: "異なる立場や考えの人同士を自然につなげる橋渡しの力。",
    blindSpot: "自分自身の意見や欲求を後回しにして、周囲の調整に回りがち。",
    teamRole: "メンバー同士や部署間をつなぐ「連結担当」。",
    relationStyle: "誰とでも自然に打ち解けるが、自分から深く踏み込むのは控えめ。",
    awaken: {
      keywords: ["橋渡し", "調和", "つながり"],
      sentence: "点と点を結ぶと、道になる。",
    },
    shutdown: {
      keywords: ["分断", "孤立", "対立構造"],
      sentence: "人と人をつなげない孤立した環境では、力の出しどころを失う。",
    },
    personalBookInsight: "CONNECTORのあなたは、人と人をつなぐことに長けている一方、自分自身の欲求は後回しにしがちです。周囲の調整役を担い続けるうちに、いつの間にか自分の意見が見えなくなっていることもあります。誰かをつなぐのと同じくらいのエネルギーを、自分の本音を伝えることにも使ってみてください。",
    personalBookAction: "誰かの意見を仲介する前に、一度「自分はどう思うか」を言葉にしてから動いてみましょう。あなたの意見にも、同じだけの価値があります。",
  },
  navigator: {
    id: "navigator",
    category: "synergy",
    nameEn: "NAVIGATOR",
    nameJp: "案内者",
    catchcopy: "迷う人に、進む方向を示す。",
    rarity: "3.3%",
    praise: "あなたは、迷っている人が思わず頼ってしまう、頼れる道しるべです。",
    // 星座・星のモチーフは占い/スピリチュアル感を避ける方針のため使用しない。
    // 羅針盤＋道しるべ（矢印/標識）という「実用的な方向指示」のモチーフに統一。
    motif: "羅針盤・道しるべの矢印",
    color: "#0B6B58",
    image: "navigator.jpg",
    weapon: "相手の状況を見極め、次に進むべき道を示す洞察力。",
    blindSpot: "人を導くことに集中しすぎて、自分自身の進む道を後回しにしがち。",
    teamRole: "メンバーの相談役となり、方向を示す「案内担当」。",
    relationStyle: "聞き役に回ることが多く、頼られることに安心感を覚える。",
    awaken: {
      keywords: ["洞察", "道しるべ", "安心"],
      sentence: "迷いの中に、光を見つける。",
    },
    shutdown: {
      keywords: ["相談されない", "孤独", "役割喪失"],
      sentence: "誰かの力になれない状況が続くと、自分の存在意義まで見失いやすい。",
    },
    personalBookInsight: "NAVIGATORのあなたは、迷っている人の力になることに自然と喜びを感じるタイプです。ただし、人を導くことに集中するあまり、自分自身がどこに向かいたいのかを後回しにしがちです。誰かの道を示すのと同じくらい、自分自身の進みたい方向にも意識を向けてみてください。",
    personalBookAction: "誰かの相談に乗った後は、同じだけの時間を使って「自分は今どうしたいか」を考える時間を作ってみましょう。",
  },
  guardian: {
    id: "guardian",
    category: "synergy",
    nameEn: "GUARDIAN",
    nameJp: "守護者",
    catchcopy: "大切なものを、静かに守る。",
    rarity: "6.7%",
    praise: "あなたは、何があっても大切なものを守り抜ける、揺るがない強さを持つ人です。",
    color: "#2F7D4F",
    motif: "盾・囲む円",
    image: "guardian.jpg",
    weapon: "変化の中でも変わらない安定感で、周囲を安心させる力。",
    blindSpot: "守ることを優先しすぎて、新しい変化への一歩が遅れがち。",
    teamRole: "チームの基盤や信頼関係を守る「守護担当」。",
    relationStyle: "一度築いた関係を大切に長く育むタイプ。裏切りには強い痛みを感じる。",
    awaken: {
      keywords: ["安定", "献身", "継続"],
      sentence: "変わらずにいることも、一つの強さ。",
    },
    shutdown: {
      keywords: ["急変", "裏切り", "土台崩壊"],
      sentence: "守ってきたものを急に手放すよう迫られると、深く消耗する。",
    },
    personalBookInsight: "GUARDIANのあなたは、大切なものを守るために変わらずにい続ける強さを持っています。ただしその安定志向が、時に新しい変化への一歩を遅らせてしまうこともあります。守るべきものを見極めた上で、それ以外の部分では小さな変化を試してみる余白を持つと、さらに柔軟な強さが手に入ります。",
    personalBookAction: "「絶対に変えたくないもの」と「変えてもいいもの」を、一度紙に分けて書き出してみましょう。守りながら変化できる部分が見えてきます。",
  },
  executor: {
    id: "executor",
    category: "momentum",
    nameEn: "EXECUTOR",
    nameJp: "遂行者",
    catchcopy: "決めたことを、最後までやり切る。",
    rarity: "6.7%",
    praise: "あなたは、決めたことを最後まで裏切らない、誰よりも信頼できる人です。",
    color: "#9A2B1E",
    motif: "歯車・チェックマーク",
    image: "executor.jpg",
    weapon: "計画を着実に実行し、最後まで責任を持ってやり遂げる力。",
    blindSpot: "予定外の変化への対応が苦手で、柔軟さに欠けることがある。",
    teamRole: "決まったことを確実に形にする「実行担当」。",
    relationStyle: "約束や役割を大切にする誠実なタイプ。裏で手を抜く人には厳しい目を向ける。",
    awaken: {
      keywords: ["実行", "誠実", "完遂"],
      sentence: "積み重ねた先に、確かな結果がある。",
    },
    shutdown: {
      keywords: ["計画変更", "場当たり的", "ゴール不明"],
      sentence: "何度も予定が覆される環境では、積み上げてきた実行力が空回りする。",
    },
    personalBookInsight: "EXECUTORのあなたは、決めたことを最後までやり切る誠実さが最大の武器です。一方で、予定外の変化への対応は得意ではないため、計画が崩れた時に強いストレスを感じやすい傾向があります。あらかじめ「計画通りいかないこともある」という前提を持っておくことで、変化への耐性が高まります。",
    personalBookAction: "計画を立てる際に、あえて「うまくいかなかった場合の代替案」も一つ用意しておきましょう。予定外の変化への心の準備になります。",
  },
  specialist: {
    id: "specialist",
    category: "synergy",
    nameEn: "SPECIALIST",
    nameJp: "探究者",
    catchcopy: "一つのことを、とことん掘り下げる。",
    rarity: "6.7%",
    praise: "あなたは、誰も辿り着けない深さまで物事を掘り下げられる人です。",
    color: "#6E9B2F",
    motif: "レンズ・掘り下がる螺旋",
    image: "specialist.jpg",
    weapon: "一つのテーマを深く追求し、他の追随を許さない専門性を築く力。",
    blindSpot: "興味のないことへの関心が薄く、視野が狭くなりがち。",
    teamRole: "専門的な知見でチームを支える「探究担当」。",
    relationStyle: "共通の関心事があると一気に距離が縮まるが、そうでない相手には淡白。",
    awaken: {
      keywords: ["探究", "深度", "専門"],
      sentence: "深く掘るほど、誰にも見えない景色がある。",
    },
    shutdown: {
      keywords: ["浅く広く", "中断", "専門外の雑務"],
      sentence: "深く掘り下げる前に次々と中断されると、集中力の源が失われる。",
    },
    personalBookInsight: "SPECIALISTのあなたは、一つのことを深く掘り下げる力に長けている一方、興味のない分野には関心が向きにくく、視野が狭くなりがちです。専門性を武器にしつつも、時々まったく畑違いの情報に触れてみることで、あなたの探究はさらに独自性を増します。",
    personalBookAction: "月に一度、自分の専門とは無関係なジャンルの本や記事に触れる時間を作ってみましょう。思わぬヒントが専門分野に活きることがあります。",
  },
  mediator: {
    id: "mediator",
    category: null, // 新12タイプ体系では廃止予定。診断ロジックがまだ出力し得るためデータは温存（ファイル冒頭の注記を参照）
    legacy: true,
    nameEn: "MEDIATOR",
    nameJp: "調律者",
    catchcopy: "対立の間に立ち、調和を取る。",
    rarity: "6.7%",
    praise: "あなたは、対立の中でも冷静に着地点を見つけられる、稀な調整力の持ち主です。",
    color: "#8FA37E",
    motif: "天秤・調和する波形",
    image: "mediator.jpg",
    weapon: "異なる意見の間に立ち、双方が納得できる着地点を見つける力。",
    blindSpot: "自分の意見を主張するより、場の調和を優先しすぎることがある。",
    teamRole: "意見の対立を調整し、チームの空気を整える「調律担当」。",
    relationStyle: "争いを避け、穏やかな関係を好む。本音をため込みすぎないよう注意が必要。",
    awaken: {
      keywords: ["調和", "公平", "均衡"],
      sentence: "対立の中にも、着地点はある。",
    },
    shutdown: {
      keywords: ["一方的な決定", "対立の強要", "板挟み"],
      sentence: "誰かの味方を強要される状況では、本来の調整力が発揮できない。",
    },
    personalBookInsight: "MEDIATORのあなたは、対立の間に立って着地点を見つける稀有な調整力を持っています。ただしその分、自分の意見よりも場の調和を優先しすぎて、本音をため込んでしまう傾向があります。調和を保ちながらも、時には自分の意見を先に出してみることが、より健全な関係を作ります。",
    personalBookAction: "誰かの意見をまとめる前に、一度「自分自身はどう思うか」を最初に発言してみましょう。それでも十分、場の調和は保てます。",
  },
  builder: {
    id: "builder",
    category: null, // 新12タイプ体系では廃止予定。診断ロジックがまだ出力し得るためデータは温存（ファイル冒頭の注記を参照）
    legacy: true,
    nameEn: "BUILDER",
    nameJp: "構築者",
    catchcopy: "土台から、着実に積み上げる。",
    rarity: "6.7%",
    praise: "あなたは、地味に見える積み重ねを、誰よりも着実に成果に変えられる人です。",
    color: "#C08A2E",
    motif: "積み上がるブロック・骨組み",
    image: "builder.jpg",
    weapon: "一つひとつの積み重ねを大切にし、揺るがない土台を作る力。",
    blindSpot: "積み上げるペースが独自で、周囲のスピード感とずれることがある。",
    teamRole: "長期的な仕組みや基盤を作る「構築担当」。",
    relationStyle: "時間をかけて信頼を積み上げるタイプ。急に距離を詰められるのは苦手。",
    awaken: {
      keywords: ["積み上げ", "堅実", "土台"],
      sentence: "一段ずつでも、確実に高くなる。",
    },
    shutdown: {
      keywords: ["拙速な完成", "基礎軽視", "せかされる"],
      sentence: "土台を飛ばして急かされると、積み上げてきた力が発揮できない。",
    },
    personalBookInsight: "BUILDERのあなたは、地道な積み重ねを誰よりも大切にできる、揺るがない土台づくりの力を持っています。ただしそのペースは独自のものなので、周囲のスピード感とずれてしまうことがあります。自分のペースを大切にしながらも、進捗を小まめに共有することで、周囲との足並みも揃えられます。",
    personalBookAction: "大きな成果が出る前の段階でも、途中経過を周囲に一言共有する習慣をつけてみましょう。積み上げの過程が見えることで、周囲の安心感が増します。",
  },
  adventurer: {
    id: "adventurer",
    category: null, // 新12タイプ体系では廃止予定。診断ロジックがまだ出力し得るためデータは温存（ファイル冒頭の注記を参照）
    legacy: true,
    nameEn: "ADVENTURER",
    nameJp: "冒険者",
    catchcopy: "決められた道より、自由な道を選ぶ。",
    rarity: "6.7%",
    praise: "あなたは、誰も選ばない道を、自分の感覚だけで選び取れる人です。",
    color: "#E8703A",
    motif: "分岐する道・地平線",
    image: "adventurer.jpg",
    weapon: "枠にとらわれず、自分の感覚を信じて進む行動力。",
    blindSpot: "自由を優先しすぎて、周囲との足並みが揃わないことがある。",
    teamRole: "新しい体験や視点をチームに持ち込む「冒険担当」。",
    relationStyle: "束縛を嫌い、自由にお互いを尊重できる関係を好む。",
    awaken: {
      keywords: ["自由", "感覚", "冒険"],
      sentence: "決まった道より、心が動く道を。",
    },
    shutdown: {
      keywords: ["管理過多", "予定固定", "束縛"],
      sentence: "細かく管理され、自由に動けない状況では、力が縮こまってしまう。",
    },
    personalBookInsight: "ADVENTURERのあなたは、決められた道よりも自分の感覚を信じて進む自由さを持っています。一方でその自由さが、周囲との足並みを乱してしまうこともあります。自由に動きながらも、要所要所で「今どこにいるか」を周囲に共有することで、あなたの冒険はより多くの人を巻き込めるようになります。",
    personalBookAction: "自由に動く前に、要所となるタイミングだけは周囲に一言共有するルールを決めておきましょう。自由度を保ったまま信頼も築けます。",
  },
  finisher: {
    id: "finisher",
    category: null, // 新12タイプ体系では廃止予定。診断ロジックがまだ出力し得るためデータは温存（ファイル冒頭の注記を参照）
    legacy: true,
    nameEn: "FINISHER",
    nameJp: "完遂者",
    catchcopy: "最後の一手まで、責任を持つ。",
    rarity: "6.7%",
    praise: "あなたは、最後の最後まで手を抜かない、本物の完遂力を持つ人です。",
    color: "#26456B",
    motif: "ゴールライン・完成した円",
    image: "finisher.jpg",
    weapon: "物事を最後まで丁寧に仕上げ、完成度を高める粘り強さ。",
    blindSpot: "完成にこだわりすぎて、区切りをつけるタイミングを逃しがち。",
    teamRole: "プロジェクトの仕上げと品質を担う「完遂担当」。",
    relationStyle: "最後まで責任を持って向き合うタイプ。中途半端な関係には落ち着かなさを感じる。",
    awaken: {
      keywords: ["仕上げ", "責任", "完成"],
      sentence: "最後の一手が、すべてを決める。",
    },
    shutdown: {
      keywords: ["未完のまま中断", "仕様変更", "締切なし"],
      sentence: "仕上げる前に次々と方向を変えられると、粘り強さが空回りする。",
    },
    personalBookInsight: "FINISHERのあなたは、最後の一手まで責任を持ちきる粘り強さが最大の武器です。ただし完成度へのこだわりが強いあまり、区切りをつけるタイミングを逃してしまうことがあります。「完璧」ではなく「十分」で区切る基準をあらかじめ決めておくことで、あなたの粘り強さはより多くの場面で活きるようになります。",
    personalBookAction: "作業を始める前に、「ここまでできたら区切る」というラインをあらかじめ決めておきましょう。粘り強さを保ちながら、次に進みやすくなります。",
  },
};

/**
 * KAKU_TYPE_CATEGORIES
 * 12 KAKU TYPEを束ねる3つの大分類（TOPページ・タイプ一覧ページで使用）。
 *
 * 注意：このカテゴリ分けは「CORE6の上位2項目から機械的に決まる」というものではなく、
 * あくまで12タイプを紹介する上でのブランド上の整理（世界観づくり）のための分類。
 * 実際のタイプ判定ロジック（type-engine.js）とは独立している。
 *
 * color系の値はカテゴリごとのアクセントカラー（背景・バッジ等で使用する、控えめな色味）。
 * KAKU_TYPESの各タイプが持つcolorとは別物で、個別のタイプカードの色は変更しない。
 */
const KAKU_TYPE_CATEGORY_ORDER = ["creative", "momentum", "synergy"];

const KAKU_TYPE_CATEGORIES = {
  creative: {
    id: "creative",
    nameJp: "創造型",
    nameEn: "CREATIVE",
    tagline: "まだない答えをつくる人たち。",
    description: "考え、答えをつくる力。まだ形になっていない可能性から、新しい答えを描き出す。",
    color: "#4A4E8C",
    colorSoft: "rgba(74, 78, 140, 0.10)",
    typeIds: ["architect", "strategist", "creator", "pioneer"],
  },
  momentum: {
    id: "momentum",
    nameJp: "推進型",
    nameEn: "MOMENTUM",
    tagline: "現実を前へ動かす人たち。",
    description: "動き、人を動かす力。立ち止まらず、現実を前に進める。",
    color: "#B5502F",
    colorSoft: "rgba(181, 80, 47, 0.10)",
    typeIds: ["commander", "challenger", "influencer", "executor"],
  },
  synergy: {
    id: "synergy",
    nameJp: "共創型",
    nameEn: "SYNERGY",
    tagline: "人や組織を強くする人たち。",
    description: "つながり、支える力。人と人、人と組織の間に立ち、強くする。",
    color: "#2E7D6B",
    colorSoft: "rgba(46, 125, 107, 0.10)",
    typeIds: ["connector", "navigator", "guardian", "specialist"],
  },
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = { KAKU_TYPES, KAKU_TYPE_CATEGORIES, KAKU_TYPE_CATEGORY_ORDER };
}
