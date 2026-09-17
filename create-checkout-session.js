// Vercel serverless function: creates a Stripe Checkout session for the
// ¥980 詳細核レポート (single purchase, no subscription).
//
// Required environment variables (set in the Vercel dashboard, Project
// Settings -> Environment Variables):
//   STRIPE_SECRET_KEY  - your Stripe secret key (starts with sk_...)
//   SITE_URL           - the deployed site's URL, e.g. https://kaku-uranai.com
//
// This creates the price inline (¥980, JPY, one-time) rather than requiring
// a pre-made Stripe Price ID, so it works out of the box once the secret
// key is set. Swap to a fixed `price: "price_..."` later if you want the
// amount managed from the Stripe dashboard instead of this file.

const Stripe = require("stripe");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method not allowed" });
    return;
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    res.status(500).json({ error: "STRIPE_SECRET_KEY is not configured yet" });
    return;
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const siteUrl = process.env.SITE_URL || `https://${req.headers.host}`;

  try {
    const { starIndex, group } = req.body || {};

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "jpy",
            unit_amount: 980,
            product_data: {
              name: "KAKU 詳細核レポート",
              description: "シーン別活かし方ガイド・相性レポート・満たされる条件・やってはいけないこと",
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        starIndex: String(starIndex),
        group: String(group),
      },
      success_url: `${siteUrl}/report.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/#result`,
    });

    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
