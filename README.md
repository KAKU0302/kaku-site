# KAKU －核－ サイト（MVP実装）

生年月日×MBTIの「核タイプ診断」サイトです。無料診断（LP・フォーム・結果画面）と、
¥980の詳細核レポートを購入するStripe Checkoutの導線までを実装しています。

## 中身

- `index.html` / `style.css` / `app.js` — LP・診断フォーム・結果表示（フロントエンドのみ、サーバー不要）
- `kaku-engine.js` — 生年月日から算命学の年月日柱→十大主星を計算し、MBTIの気質グループと掛け合わせるロジック
- `content.js` — 40タイプの名前・無料の解説文・（星ごとの）有料コンテンツのデータ
- `api/create-checkout-session.js` — ¥980の決済セッションを作るVercelのサーバーレス関数（Stripe連携）

## 今の実装範囲（正直な現状）

- 無料診断：40タイプ全部、実際に動きます。
- 有料の「詳細核レポート」：購入ボタン（Stripe Checkout）は実装済みですが、購入後に見せる
  詳しいレポート画面（`report.html`）はまだ未実装です。中身のコンテンツ（`content.js`の`paid`部分）は
  算命学の星（10種）ごとに書いてあり、40タイプすべてに対応する内容は入っていますが、
  MBTI気質グループごとの細かい書き分けはまだしていません（今後の改善ポイントです）。
- PERSONAL MANUAL（上位プラン）の購入導線・画面は未実装です。

## デプロイ手順（Vercel）

1. https://vercel.com で無料アカウントを作る（GitHubアカウントでのログインが簡単です）。
2. このフォルダをGitHubの新しいリポジトリにアップロードする（GitHub Desktopなどでも可）。
3. Vercelの画面で「Add New... > Project」から、そのGitHubリポジトリを選ぶ。
   設定はほぼ自動検出されるので、そのまま「Deploy」でOKです。
4. デプロイが終わったら、Vercelの「Project Settings > Environment Variables」で、
   `.env.example` に書いてある2つの値（`STRIPE_SECRET_KEY` と `SITE_URL`）を登録する。
   - `STRIPE_SECRET_KEY` はStripeの管理画面（https://dashboard.stripe.com/apikeys ）から取得します。
   - `SITE_URL` は、実際に公開するドメイン（取得したドメインをVercelに接続した後のURL）です。
5. 環境変数を追加したら、Vercelの画面から「Redeploy」を押して反映させる。
6. 取得したドメインを、Vercelの「Project Settings > Domains」で接続する。

分からない手順が出てきたら、そのまま質問してください。

## 精度についての注意

`kaku_engine.js` の月柱（月の干支）の計算は、簡易的な節気の固定日付テーブルを使っています。
実際の節気は年によって1〜2日前後することがあるので、境界日に生まれた人はまれに結果がズレる
可能性があります。利用者数が増えてきたら、正確な天文計算に置き換えることをおすすめします。
