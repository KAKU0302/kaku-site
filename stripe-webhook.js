/**
 * /api/stripe-webhook
 *
 * StripeダッシュボードのWebhook設定で、このURL（https://あなたのサイト/api/stripe-webhook）を
 * 登録しておくと、決済が完了するたびにStripeがこの関数を呼び出す。
 *
 * ここでやっていることは1つだけ：
 *   1. 決済完了イベント（checkout.session.completed）を受け取る
 *   2. create-checkout-session.js が metadata に分割して保存しておいた
 *      「診断結果スナップショット」を組み立て直す
 *   3. Stripe Checkoutで入力してもらった購入者のメールアドレス宛に、
 *      そのスナップショットを埋め込んだ「PERSONAL BOOKを開き直せるリンク」を送る
 *
 * ブラウザの決済完了画面（?purchased=1への遷移）に頼らず、必ずここでメールを送ることで、
 * 「支払った直後にタブを閉じてしまい、メールが届かない」という事故を防いでいる。
 *
 * 注意：Stripeの署名検証のため、リクエストボディは「JSONとして解釈する前の生データ」の
 * ままハッシュを取る必要がある。そのため、下の module.exports.config で
 * Vercelの自動JSONパースを止めている。
 */

const Stripe = require("stripe");
const { Resend } = require("resend");

module.exports.config = {
  api: {
    bodyParser: false,
  },
};

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function buildEmailHtml(link) {
  return `
    <div style="font-family:'Hiragino Sans','Noto Sans JP',sans-serif; line-height:1.8; color:#1C1D21; max-width:480px; margin:0 auto;">
      <p style="font-size:12px; letter-spacing:0.08em; color:#5B5E68;">KAKU ～核～</p>
      <h1 style="font-size:18px; margin:8px 0 20px;">PERSONAL BOOKが届きました</h1>
      <p>この度はKAKU PERSONAL BOOKをご購入いただき、ありがとうございます。</p>
      <p>下のボタンから、あなた専用のPERSONAL BOOKをいつでも開くことができます。</p>
      <p style="text-align:center; margin:28px 0;">
        <a href="${link}" style="display:inline-block; background:#2C2F6B; color:#ffffff; padding:14px 28px; border-radius:999px; text-decoration:none; font-weight:700;">
          PERSONAL BOOKを見る
        </a>
      </p>
      <p style="font-size:13px; color:#5B5E68;">
        開いたページの「📄 PDFとして保存する」ボタンから、PDFとして保存することもできます。
      </p>
      <p style="font-size:13px; color:#5B5E68;">
        このリンクには、あなたの診断結果の内容が含まれています。他の方と共有しないようご注意ください。
      </p>
      <p style="font-size:11px; color:#9a9ca3; word-break:break-all; margin-top:24px;">
        ボタンが開けない場合は、こちらのURLをブラウザに貼り付けてください：<br />${link}
      </p>
    </div>
  `;
}

async function handleCompletedCheckout(session) {
  const email = session.customer_details && session.customer_details.email;
  const metadata = session.metadata || {};
  const count = parseInt(metadata.book_chunks || "0", 10);

  if (!email) {
    console.error("checkout.session.completed に購入者のメールアドレスが含まれていません", session.id);
    return;
  }
  if (!count) {
    console.error("checkout.session.completed に診断データ(metadata)が含まれていません", session.id);
    return;
  }

  let json = "";
  for (let i = 0; i < count; i++) {
    json += metadata["book_" + i] || "";
  }

  let snapshot;
  try {
    snapshot = JSON.parse(json);
  } catch (err) {
    console.error("metadataから診断データの復元に失敗しました", session.id, err);
    return;
  }

  const siteUrl = (process.env.SITE_URL || "").replace(/\/$/, "");
  if (!siteUrl) {
    console.error("SITE_URLが設定されていないため、PERSONAL BOOKのリンクを作成できません");
    return;
  }
  const link = siteUrl + "/?book=" + encodeURIComponent(JSON.stringify(snapshot));

  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) {
    console.error("RESEND_API_KEY または EMAIL_FROM が設定されていないため、メールを送信できません");
    return;
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: process.env.EMAIL_FROM,
    to: email,
    subject: "【KAKU】PERSONAL BOOKが届きました",
    html: buildEmailHtml(link),
  });

  if (error) {
    console.error("メール送信に失敗しました", session.id, error);
  }
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).end();
    return;
  }

  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    console.error("STRIPE_SECRET_KEY または STRIPE_WEBHOOK_SECRET が設定されていません");
    res.status(500).end();
    return;
  }

  const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
  let event;

  try {
    const rawBody = await getRawBody(req);
    const signature = req.headers["stripe-signature"];
    event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhookの署名検証に失敗しました:", err.message);
    res.status(400).send("Webhook Error: " + err.message);
    return;
  }

  if (event.type === "checkout.session.completed") {
    try {
      await handleCompletedCheckout(event.data.object);
    } catch (err) {
      // ここで例外を投げてもStripeが再送を繰り返すだけなので、ログに残した上で200を返す。
      console.error("checkout.session.completed の処理に失敗しました:", err);
    }
  }

  res.status(200).json({ received: true });
};
