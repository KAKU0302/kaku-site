/**
 * match-engine.js
 * KAKU MATCH（2人のKAKUを重ね合わせる）機能の【プレビュー用】簡易ロジック
 *
 * 確定仕様: KAKU MATCHの実際の決済・本番ロジックは設計書12章により将来拡張扱いであり、
 * このMVPには含まれない（デザイン書 12章）。
 * 仮実装: ここでは「購入前に雰囲気だけ確認できるサンプル」として、
 * 2つのKAKU TYPEのWEAPON・BLIND SPOT・RELATION STYLEを組み合わせ、
 * ルールベースで簡易な相性コメントを生成する。実際の有料版では、
 * 2人それぞれのQUESTION・BIRTH・STATEを使ったより精緻な解析に置き換える想定。
 */

/**
 * typeA, typeB: types-data.js の KAKU_TYPES オブジェクトの値（1件ずつ）
 * 戻り値: { headline, message }
 */
function generateMatchInsight(typeA, typeB) {
  if (typeA.id === typeB.id) {
    return {
      headline: `${typeA.nameJp} 同士｜似た者同士の関係`,
      message:
        `同じKAKUタイプ同士の組み合わせです。価値観や物事の捉え方が近いため、お互いを理解しやすい関係になりやすいでしょう。` +
        `一方で、「${typeA.blindSpot}」という盲点も共有しやすいので、どちらかが気づいた時に、もう一方にもそっと伝え合える関係を意識すると、より良い相乗効果が生まれます。`,
    };
  }

  const headline = `${typeA.nameJp} × ${typeB.nameJp}｜補い合う関係`;
  const message =
    `${typeA.nameJp}の「${typeA.weapon}」という強みは、${typeB.nameJp}が抱えやすい「${typeB.blindSpot}」を補える可能性があります。` +
    `逆に${typeB.nameJp}の「${typeB.weapon}」という強みは、${typeA.nameJp}にとって新しい視点をもたらしてくれるかもしれません。` +
    `関わり方としては、${typeA.nameJp}は${typeA.relationStyle}　${typeB.nameJp}は${typeB.relationStyle}　という傾向があるので、` +
    `お互いのペースの違いを前提に関わることが、良い関係を長く続けるヒントになります。`;

  return { headline, message };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { generateMatchInsight };
}
