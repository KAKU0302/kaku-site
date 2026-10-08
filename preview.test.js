"use strict";
// プレビュー（試作）が、回答データを外部へ送れない作りであること、既存ファイルに触れていないことを確認する。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), path = require("path"), crypto = require("crypto");
const { execFileSync } = require("child_process");
const core = path.join(__dirname, "..");
execFileSync(process.execPath, [path.join(core, "tools", "build-preview.js")], { stdio: "pipe" });
const art = fs.readFileSync(path.join(core, "preview", "dist", "artifact.html"), "utf8");
const full = fs.readFileSync(path.join(core, "preview", "dist", "preview.html"), "utf8");
const strip = s => s.replace(/data:image\/jpeg;base64,[A-Za-z0-9+/=]+/g, "data:IMG");
const sources = ["data.js", "engine.js", "book/book-data.js", "book/book-engine.js", "compare.js", "preview/app.js"].map(f => [f, fs.readFileSync(path.join(core, f), "utf8")]);

test("通信を行うAPIを、プレビューのどのソースも使っていない", () => {
  const banned = [/\bfetch\s*\(/, /XMLHttpRequest/, /sendBeacon/, /WebSocket/, /EventSource/, /importScripts/, /new\s+Image\s*\(/, /navigator\.share/, /window\.open/, /location\s*\.\s*(href|assign|replace)\s*=/, /\bimport\s*\(/, /postMessage/, /document\.cookie/];
  sources.forEach(([f, s]) => banned.forEach(re => assert.ok(!re.test(s.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, "")), f + " に " + re)));
});

test("組み立てたページに、外部のURL・外部スクリプト・外部スタイルがない（画像は埋め込み）", () => {
  [art, full].forEach(html => {
    const s = strip(html);
    assert.ok(!/<script[^>]+\bsrc=/i.test(s), "外部scriptがある");
    assert.ok(!/<link\b/i.test(s), "linkタグがある");
    assert.ok(!/<iframe|<form\b|<embed|<object/i.test(s), "iframe/form/embed がある");
    assert.ok(!/(src|href|action)\s*=\s*["']https?:/i.test(s), "外部URLの参照がある");
    assert.ok(!/url\(\s*["']?https?:/i.test(s), "CSSの外部URL");
    assert.ok(!/@import/.test(s), "@import");
  });
  const urls = (strip(art).match(/https?:\/\/[^\s"'<>)]+/g) || []).filter(u => !/^https?:\/\/(www\.)?(w3\.org)/.test(u));
  assert.deepEqual(urls, [], "ページ内にURL文字列がある: " + urls.slice(0, 5).join(", "));
});

test("断片（Artifact用）の形式: <title>と<style>で始まり、doctype/html/head/bodyを持たない。タイトルは短い名前", () => {
  assert.match(art, /^<title>KAKU CORE36<\/title>\n<style>/);
  assert.ok(!/<!doctype|<html[\s>]|<head[\s>]|<body[\s>]/i.test(art));
  assert.ok(art.length < 16 * 1024 * 1024);
});

test("12タイプのキャラクター画像を、元のファイルのまま（再圧縮せず）埋め込んでいる。色・名前は既存のtypes-data.jsと同じ", () => {
  const site = path.join(core, ".."), D = require("../data.js"), vm = require("vm"), ctx = {}; vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(site, "types-data.js"), "utf8") + ";this.T=KAKU_TYPES;", ctx);
  Object.keys(D.PROFILES).forEach(id => {
    const t = ctx.T[id], b64 = fs.readFileSync(path.join(site, t.image)).toString("base64");
    assert.ok(art.indexOf("data:image/jpeg;base64," + b64) >= 0, id + " の画像が元のファイルと一致しない");
    assert.ok(art.indexOf('"color":"' + t.color + '"') >= 0, id + " の色");
    assert.ok(art.indexOf('"nameJp":"' + t.nameJp + '"') >= 0, id + " の名前");
  });
  assert.ok(!/rarity|"rarity"/.test(strip(art)), "希少度を持ち込んでいない");
  ["mediator", "builder", "adventurer", "finisher"].forEach(id => assert.ok(!new RegExp('"id":"' + id + '"').test(strip(art)), "旧タイプ " + id));
});

test("既存の公開ファイルは変更されていない（SHA-256を基準と照合）。core36は新規ファイルだけ", () => {
  const base = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "protected-hashes.json"), "utf8"));
  const files = base.files || base;
  const keys = Object.keys(files); assert.ok(keys.length >= 28, "基準の件数: " + keys.length);
  keys.forEach(f => {
    const h = crypto.createHash("sha256").update(fs.readFileSync(path.join(core, "..", f))).digest("hex");
    assert.equal(h, files[f], f + " が基準と一致しない（既存ファイルが変更された）");
  });
});
