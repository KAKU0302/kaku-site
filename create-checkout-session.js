/**
 * /api/create-checkout-session
 *
 * PERSONAL BOOKの「¥980で購入する」ボタンから呼ばれるサーバーレス関数（Vercel）。
 * サイト本体（index.html / app.js 等）は引き続き静的サイトのままで、この関数は
 * 「Stripeの決済ページを作る」という1つの役割だけを持つ。
 *
 * 受け取ったリクエストボディ：
 *   { snapshot: {...} }
 *   snapshot は app.js の buildResultSnapshot() が作る「診断結果スナップショット」で、
 *   その人の名前・生年月日・回答・診断結果（タイプ・スコア・KAKU GAP等）を含む。
 *   このサイトはデータベースを持たないため、このsnapshotをそのままStripeの
 *   Checkout Session の metadata に保存しておき、決済完了後にwebhook側
 *   （/api/stripe-webhook）で読み出して、購入者にメールで送るリンクを作る。
 *
 * Stripeのmetadataは1つの値につき500文字までという制限があるため、
 * JSON文字列を複数のキー（book_0, book_1, ...）に分割して保存している。
 */

const Stripe = require("stripe");

const METADATA_CHUNK_SIZE = 450;
const METADATA_MAX_CHUNKS = 45; // Stripeのmetadataは1オブジェクトにつき最大50キーのため、余裕を持たせている

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    console.error("STRIPE_SECRET_KEY is not set");
    res.status(500).json({ error: "決済機能がまだ設定されていません。運営にお問い合わせください。" });
    return;
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const snapshot = body.snapshot;

    if (!snapshot || !snapshot.typeId || !snapshot.core6) {
      res.status(400).json({ error: "診断データが見つかりませんでした。もう一度診断を受けてからお試しください。" });
      return;
    }

    const json = JSON.stringify(snapshot);
    const chunks = [];
    for (let i = 0; i < json.length; i += METADATA_CHUNK_SIZE) {
      chunks.push(json.slice(i, i + METADATA_CHUNK_SIZE));
    }

    if (chunks.length > METADATA_MAX_CHUNKS) {
      console.error("Snapshot too large for Stripe metadata:", json.length, "chars");
      res.status(400).json({ error: "データサイズの上限を超えています。運営にお問い合わせください。" });
      return;
    }

    const metadata = { book_chunks: String(chunks.length) };
    chunks.forEach((chunk, i) => {
      metadata["book_" + i] = chunk;
    });

    const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
    const siteUrl = (process.env.SITE_URL || "https://" + req.headers.host).replace(/\/$/, "");

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "jpy",
            unit_amount: 980,
            product_data: {
              name: "KAKU PERSONAL BOOK｜あなた専用の自分の攻略本",
            },
          },
          quantity: 1,
        },
      ],
      metadata,
      success_url: siteUrl + "/?purchased=1&session_id={CHECKOUT_SESSION_ID}",
      cancel_url: siteUrl + "/?view=personal-book",
    });

    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error("Failed to create checkout session:", err);
    res.status(500).json({ error: "決済ページの作成に失敗しました。時間をおいて再度お試しください。" });
  }
};
