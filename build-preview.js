#!/usr/bin/env node
/**
 * core36/tools/build-preview.js
 * プレビュー（試作）を、依存のない1ファイルにまとめる。
 *   出力: core36/preview/dist/preview.html   … ローカル確認用（完全なHTML）
 *         core36/preview/dist/artifact.html  … 認証付きの非公開ページとして公開するための断片（<title>と<style>で始まる）
 * 既存の types-data.js と キャラクター画像は【読み取るだけ】で、変更しない。
 * 画像はそのまま（再圧縮しない）data: URI で埋め込み、外部への通信を持たない。
 */
"use strict";
const fs = require("fs"), path = require("path"), vm = require("vm"), crypto = require("crypto");
const core = path.join(__dirname, ".."), site = path.join(core, "..");
const rd = f => fs.readFileSync(path.join(core, f), "utf8");

const D = require("../data.js");
const typeCtx = {}; vm.createContext(typeCtx);
vm.runInContext(fs.readFileSync(path.join(site, "types-data.js"), "utf8") + ";this.__T = KAKU_TYPES; this.__C = KAKU_TYPE_CATEGORIES;", typeCtx);
const T = typeCtx.__T, C = typeCtx.__C;

const types = {}, imgs = {};
Object.keys(D.PROFILES).forEach(id => {
  const t = T[id]; if (!t) throw new Error("types-data.js に " + id + " がありません");
  // 希少度（rarity）は公開表示から外す方針なので、持ち込まない
  types[id] = { id, nameEn: t.nameEn, nameJp: t.nameJp, catchcopy: t.catchcopy, color: t.color, category: t.category, image: t.image };
  const buf = fs.readFileSync(path.join(site, t.image));
  imgs[id] = "data:image/jpeg;base64," + buf.toString("base64");
});

const parts = [
  ["data.js", rd("data.js")], ["engine.js", rd("engine.js")],
  ["book-data.js", rd("book/book-data.js")], ["book-engine.js", rd("book/book-engine.js")],
  ["compare.js", rd("compare.js")], ["app.js", rd("preview/app.js")]
];
const css = rd("preview/preview.css");
const hash = crypto.createHash("sha256").update(parts.map(p => p[1]).join("\n") + css).digest("hex").slice(0, 8);
const BUILD = { id: "pv-" + hash, scoring_version: D.VERSION, built_at: new Date().toISOString() };

parts.forEach(([n, src]) => { if (/<\/script/i.test(src)) throw new Error(n + " に </script が含まれています"); });
const pre = "window.KAKU_PREVIEW_TYPES=" + JSON.stringify(types) + ";window.KAKU_PREVIEW_BUILD=" + JSON.stringify(BUILD) + ";";
const imgJs = "window.KAKU_PREVIEW_IMG=" + JSON.stringify(imgs) + ";";

const body = '<title>KAKU CORE36</title>\n<style>\n' + css + '\n</style>\n<div id="app" class="k-app"></div>\n' +
  "<script>" + pre + "</script>\n<script>" + imgJs + "</script>\n" +
  parts.map(([n, src]) => "<script>/* " + n + " */\n" + src + "\n</script>").join("\n") + "\n";

const full = '<!doctype html>\n<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">' +
  '<meta name="robots" content="noindex,nofollow"><style>:root{color-scheme:dark}body{margin:0}</style></head><body>\n' + body + "</body></html>\n";

const dist = path.join(core, "preview", "dist"); fs.mkdirSync(dist, { recursive: true });
fs.writeFileSync(path.join(dist, "preview.html"), full);
fs.writeFileSync(path.join(dist, "artifact.html"), body);
console.log("build", BUILD.id, "preview.html", Math.round(full.length / 1024) + "KB", "artifact.html", Math.round(body.length / 1024) + "KB");
module.exports = { BUILD };
