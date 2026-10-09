/**
 * kaku-lab/core36-engine.js
 * CORE36の採点と12TYPEの判定（scoring_version は core36-data.js の VERSION。0.5.0〜は「あてはまり度5段階」方式）。
 *
 * 入力: 36問への回答 { C01: 1〜5, ... }（または [{id, value}] の配列）。1=全くあてはまらない 〜 5=かなりあてはまる
 * 出力: 6軸の位置と読み、12TYPEの判定（代表タイプ・補足タイプ・状態）、判定理由、品質フラグ
 *
 * 方針:
 *  - 自己理解の中心は CORE6（6軸の回答傾向）。12TYPEは「最も近い代表タイプ」として入口に使う。
 *    そのため 6軸の部分（axes）は、タイプの判定表に一切依存しない（テストで確認）。
 *  - 同じ回答なら必ず同じ結果（乱数・時刻・ハッシュを判定に使わない）。
 *  - 旧30問・16タイプのコード（core-engine.js / type-engine.js）には依存せず、変更もしない。
 *  - 設問・プロフィール・しきい値は data.js にあり、変更したら VERSION を上げる
 *    （definition_hash でテストが検出する）。
 *
 * グローバル名は KAKU_CORE36 ひとつだけ（旧コードの const 名と衝突しない）。
 */
(function (root) {
  "use strict";

  var DATA = root.KAKU_CORE36_DATA;
  if (!DATA && typeof require !== "undefined") DATA = require("./data.js");

  var EPS = 1e-9;

  function resolve(opts) {
    var d = (opts && opts.data) || {};
    return {
      version: d.VERSION || DATA.VERSION,
      axes: d.AXES || DATA.AXES,
      items: d.ITEMS || DATA.ITEMS,
      profiles: d.PROFILES || DATA.PROFILES,
      tieOrder: d.TIE_BREAK_ORDER || DATA.TIE_BREAK_ORDER,
      config: Object.assign({}, DATA.CONFIG, d.CONFIG || {})
    };
  }

  // ---------- 入力の正規化 ----------
  // 有効な回答は「整数の1〜5」だけ。重複IDは最後を採用。未知のIDは無視（ignoredに記録）。
  function normalizeResponses(responses, defs) {
    var raw = {}, ignored = [];
    var known = {};
    defs.items.forEach(function (it) { known[it.id] = true; });
    if (Array.isArray(responses)) {
      responses.forEach(function (r) {
        if (!r || typeof r.id !== "string") return;
        var v = ("value" in r) ? r.value : r.r;
        if (known[r.id]) raw[r.id] = v; else ignored.push(r.id);
      });
    } else if (responses && typeof responses === "object") {
      Object.keys(responses).forEach(function (k) {
        if (known[k]) raw[k] = responses[k]; else ignored.push(k);
      });
    }
    var valid = {}, invalid = [], missing = [];
    defs.items.forEach(function (it) {
      if (!(it.id in raw)) { missing.push(it.id); return; }
      var v = raw[it.id];
      if (typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 5) valid[it.id] = v;
      else invalid.push(it.id);
    });
    return { valid: valid, invalid: invalid, missing: missing, ignored: ignored };
  }

  // 回答 r（1=全くあてはまらない〜5=かなりあてはまる）→ a（+2=A極に近い〜−2=B極に近い）
  //  keyed "A"：A極の行動・考え方を述べた文 → あてはまるほどA極（r−3）
  //  keyed "B"：B極を述べた文（逆転項目）  → あてはまるほどB極（3−r）
  //  旧A/B比較方式（0.4.0以前）の項目 { aSide:"left"|"right" } も、履歴・互換のため従来どおり換算できる。
  function aValue(item, r) {
    if (item.keyed === "A") return r - 3;
    if (item.keyed === "B") return 3 - r;
    if (item.aSide === "left") return 3 - r;
    if (item.aSide === "right") return r - 3;
    throw new Error("item " + item.id + ": keyed (A/B) is missing");
  }

  function mean(arr) { return arr.length ? arr.reduce(function (s, x) { return s + x; }, 0) / arr.length : null; }

  // ---------- 軸の採点 ----------
  function scoreAxes(valid, defs) {
    var cfg = defs.config, out = {}, insufficient = [], leanCount = 0;
    defs.axes.forEach(function (ax) {
      var items = defs.items.filter(function (it) { return it.axis === ax.id; });
      var all = [], work = [], life = [];
      items.forEach(function (it) {
        if (!(it.id in valid)) return;
        var a = aValue(it, valid[it.id]);
        all.push(a);
        (it.scene === "work" ? work : life).push(a);
      });
      var info = { id: ax.id, validCount: all.length, itemCount: items.length };
      if (all.length < cfg.minValidPerAxis) {
        info.status = "insufficient";
        insufficient.push(ax.id);
        out[ax.id] = info;
        return;
      }
      var m = mean(all);
      var mW = work.length >= cfg.sceneMinValid ? mean(work) : null;
      var mL = life.length >= cfg.sceneMinValid ? mean(life) : null;
      info.status = "ok";
      info.mean = m;
      info.position = 50 + 25 * m;     // 0〜100（50が中立）。A極側ほど大きい。
      info.sceneMeans = { work: mW, life: mL };
      var kind;
      if (mW !== null && mL !== null && mW * mL < 0 &&
          Math.abs(mW) >= cfg.sceneMean - EPS && Math.abs(mL) >= cfg.sceneMean - EPS) kind = "scene_diff";
      else if (m >= cfg.leanMean - EPS) kind = "a";
      else if (m <= -cfg.leanMean + EPS) kind = "b";
      else kind = "balanced";
      info.reading = { kind: kind, label: readingLabel(ax, kind, mW, mL, cfg) };
      info.lean = Math.abs(m) >= cfg.leanMean - EPS;   // タイプ判定の根拠になるか（読みの種類とは独立）
      if (info.lean) leanCount++;
      out[ax.id] = info;
    });
    return { axes: out, insufficient: insufficient, leanCount: leanCount };
  }

  function poleName(ax, sign) { return sign > 0 ? ax.poleA : ax.poleB; }

  function readingLabel(ax, kind, mW, mL, cfg) {
    if (kind === "a") return ax.poleA + "寄り";
    if (kind === "b") return ax.poleB + "寄り";
    if (kind === "balanced") return "どちらにも寄らない";
    // 場面による違いは「今回の回答上の違い」として表現する（性質とは断定しない）
    return "今回の回答では、場面によって違いが見られた（仕事・学び：" + poleName(ax, mW) + "寄り、日常：" + poleName(ax, mL) + "寄り）";
  }

  // ---------- 12TYPEの判定 ----------
  // 距離 d = sqrt( Σ 重み×(位置−目標)² ÷ Σ 重み )。 目標は 50±targetOffset。
  function profileVectors(typeId, defs) {
    var p = defs.profiles[typeId], cfg = defs.config, parts = [];
    p.core.forEach(function (c) { parts.push({ axis: c[0], pole: c[1], weight: 1, role: "core" }); });
    (p.support || []).forEach(function (c) { parts.push({ axis: c[0], pole: c[1], weight: cfg.supportWeight, role: "support" }); });
    parts.forEach(function (x) { x.target = 50 + (x.pole === "A" ? 1 : -1) * cfg.targetOffset; });
    return parts;
  }

  function judgeType(axesScored, leanCount, defs) {
    var cfg = defs.config, ids = Object.keys(defs.profiles);
    var rows = ids.map(function (id) {
      var parts = profileVectors(id, defs), num = 0, den = 0, cNum = 0, cDen = 0;
      parts.forEach(function (x) {
        var diff = axesScored[x.axis].position - x.target;
        num += x.weight * diff * diff; den += x.weight;
        if (x.role === "core") { cNum += diff * diff; cDen += 1; }
      });
      var d = Math.sqrt(num / den), cd = Math.sqrt(cNum / cDen);
      return { id: id, d: d, dKey: Math.round(d * 1e6), cKey: Math.round(cd * 1e6), order: defs.tieOrder.indexOf(id) };
    });
    rows.sort(function (a, b) { return (a.dKey - b.dKey) || (a.cKey - b.cKey) || (a.order - b.order); });
    var best = rows[0];
    var tieGroup = rows.filter(function (r) { return r.dKey === best.dKey; });
    var distances = {};
    rows.forEach(function (r) { distances[r.id] = Math.round(r.d * 10000) / 10000; });

    var res = {
      primary: null, second: null, third: null, showSecond: false, status: null,
      margin: null, distance: best.d, tieGroup: tieGroup.map(function (r) { return r.id; }),
      tieResolvedBy: null, fit: null, noBasisReason: null, distances: distances,
      ranking: rows.map(function (r) { return r.id; })
    };

    if (leanCount === 0) { res.status = "no_basis"; res.noBasisReason = "no_lean_axis"; return res; }
    if (tieGroup.length >= cfg.noBasisTieCount) { res.status = "no_basis"; res.noBasisReason = "tie_" + tieGroup.length; return res; }

    res.primary = rows[0].id;
    res.second = rows[1] ? rows[1].id : null;
    res.third = rows[2] ? rows[2].id : null;
    res.margin = rows[1] ? rows[1].d - rows[0].d : Infinity;
    if (tieGroup.length > 1) {
      // 先頭と次点の「決める軸だけの距離」が違えばそれで決まり、同じなら固定順で決まる
      res.tieResolvedBy = tieGroup[0].cKey !== tieGroup[1].cKey ? "core_distance" : "fixed_order";
    }
    res.showSecond = res.margin < cfg.marginDelta - EPS;
    res.fit = (best.d >= cfg.weakFitDistance - EPS || leanCount === 1) ? "weak" : "ok";
    res.status = res.fit === "weak" ? "weak" : "ok";
    return res;
  }

  // ---------- 判定理由（どの軸が根拠か） ----------
  function explain(typeId, axesScored, defs) {
    if (!typeId) return null;
    var cfg = defs.config;
    var axisById = {}; defs.axes.forEach(function (a) { axisById[a.id] = a; });
    return profileVectors(typeId, defs).map(function (x) {
      var ax = axisById[x.axis], info = axesScored[x.axis];
      var signed = (x.pole === "A" ? 1 : -1) * info.mean;
      var match = signed >= cfg.leanMean - EPS ? "match" : (signed > -cfg.leanMean + EPS ? "neutral" : "opposite");
      return {
        axis: x.axis, axisNameJp: ax.nameJp, role: x.role,
        expectedPole: x.pole, expectedLabel: x.pole === "A" ? ax.poleA : ax.poleB,
        position: info.position, readingLabel: info.reading.label, readingKind: info.reading.kind, match: match
      };
    });
  }

  // 画面用の説明文。断定せず「回答では」「最も近い」と表現する。
  function describeReason(result, typeName) {
    var t = result && result.type;
    if (!t || !t.primary) return "";
    var name = typeName || t.primary;
    var core = (result.explanation.primary || []).filter(function (e) { return e.role === "core"; });
    var parts = core.map(function (e) { return e.axisNameJp + "は「" + e.readingLabel + "」"; });
    var feature = core.map(function (e) { return e.expectedLabel; }).join("×");
    var s = "あなたの回答では、" + parts.join("、") + "という傾向でした。";
    var offs = core.filter(function (e) { return e.match !== "match"; });
    if (t.fit === "weak") {
      s += "特定の方向に強く寄らない回答だったため、いちばん近い代表タイプとして「" + name + "」（" + feature + "）を表示しています。近さは弱めです。";
    } else if (offs.length) {
      s += "「" + name + "」の特徴（" + feature + "）とは" + offs.map(function (e) { return e.axisNameJp; }).join("・") +
           "が少しずれていますが、全体ではこのタイプにいちばん近い結果でした。";
    } else {
      s += "これは「" + name + "」の特徴（" + feature + "）にいちばん近い組み合わせです。";
    }
    return s;
  }

  // ---------- 全体 ----------
  function score(responses, opts) {
    opts = opts || {};
    var defs = resolve(opts), cfg = defs.config;
    var norm = normalizeResponses(responses, defs);
    var validIds = Object.keys(norm.valid);

    var flags = { straightLine: false, fast: false };
    if (validIds.length) {
      var freq = {};
      validIds.forEach(function (id) { freq[norm.valid[id]] = (freq[norm.valid[id]] || 0) + 1; });
      flags.straightLine = Math.max.apply(null, Object.keys(freq).map(function (k) { return freq[k]; })) >= cfg.straightLineCount;
    }
    if (typeof opts.durationSec === "number") flags.fast = opts.durationSec < cfg.minDurationSec;

    var sc = scoreAxes(norm.valid, defs);
    var result = {
      assessment_type: "core36",
      scoring_version: defs.version,
      item_version: defs.version,
      status: sc.insufficient.length ? "incomplete" : "complete",
      answers: norm.valid,
      input: { invalid: norm.invalid, missing: norm.missing, ignored: norm.ignored, insufficientAxes: sc.insufficient },
      flags: flags,
      axes: sc.axes,
      leanCount: sc.leanCount,
      type: null,
      explanation: { primary: null, second: null }
    };
    if (result.status === "incomplete") {
      result.type = { primary: null, second: null, status: "incomplete", showSecond: false, fit: null };
      return result;
    }
    result.type = judgeType(sc.axes, sc.leanCount, defs);
    if (result.type.primary) {
      result.explanation.primary = explain(result.type.primary, sc.axes, defs);
      if (result.type.showSecond || result.type.fit === "weak") result.explanation.second = explain(result.type.second, sc.axes, defs);
    }
    return result;
  }

  // 保存用の軽量スナップショット（決済metadata・復元リンクの文字数制限を意識して短くしている）
  function toSnapshot(result) {
    var axes = {};
    Object.keys(result.axes).forEach(function (id) {
      var a = result.axes[id];
      axes[id] = a.status === "ok" ? { p: Math.round(a.position * 100) / 100, r: a.reading.kind } : { p: null, r: "insufficient" };
    });
    return {
      schema: "core36-result/1",
      scoring_version: result.scoring_version,
      assessment_type: result.assessment_type,
      status: result.status,
      answers: result.answers,
      axes: axes,
      type: { primary: result.type.primary, second: result.type.second, show_second: !!result.type.showSecond, status: result.type.status },
      flags: result.flags
    };
  }

  // 定義（設問・プロフィール・設定）の指紋。バージョンを上げずに中身だけ変えるミスを、テストで検出する。
  function definitionHash(opts) {
    var defs = resolve(opts);
    var s = JSON.stringify({ items: defs.items, axes: defs.axes, profiles: defs.profiles, tie: defs.tieOrder, config: defs.config });
    var h = 0x811c9dc5;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return ("00000000" + h.toString(16)).slice(-8);
  }

  var API = {
    VERSION: DATA.VERSION,
    score: score, toSnapshot: toSnapshot, describeReason: describeReason,
    normalizeResponses: function (r, o) { return normalizeResponses(r, resolve(o)); },
    aValue: aValue, definitionHash: definitionHash, DATA: DATA
  };
  root.KAKU_CORE36 = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof globalThis !== "undefined" ? globalThis : this);
