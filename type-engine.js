/**
 * type-engine.js
 * CORE6の「主軸 × 副軸」から KAKU TYPE を決定するエンジン
 *
 * 確定仕様（設計書 8章）: TYPE判定は「主軸(topAxis) × 副軸(secondAxis)」の
 * 組み合わせから機械的に決まる構造とし、タイプの名称・数・コピー内容が変わっても
 * ロジック（このファイル）を書き換える必要がないよう、判定結果は types-data.js の
 * id を返すだけにする。
 *
 * 仮実装: 現時点の TYPE_MATRIX は候補として挙がっている16タイプを使い、
 * 6×6=36通りの組み合わせすべてに1つのタイプを割り当てている（全16タイプが必ずどこかで出現する）。
 */

const TYPE_MATRIX = {
  vision: {
    vision: "creator",
    logic: "architect",
    drive: "pioneer",
    influence: "creator",
    bond: "creator",
    stability: "architect",
  },
  logic: {
    vision: "architect",
    logic: "specialist",
    drive: "strategist",
    influence: "strategist",
    bond: "mediator",
    stability: "specialist",
  },
  drive: {
    vision: "pioneer",
    logic: "strategist",
    drive: "challenger",
    influence: "challenger",
    bond: "adventurer",
    stability: "builder",
  },
  influence: {
    vision: "creator",
    logic: "strategist",
    drive: "challenger",
    influence: "influencer",
    bond: "influencer",
    stability: "commander",
  },
  bond: {
    vision: "creator",
    logic: "mediator",
    drive: "adventurer",
    influence: "influencer",
    bond: "connector",
    stability: "guardian",
  },
  stability: {
    vision: "architect",
    logic: "specialist",
    drive: "executor",
    influence: "navigator",
    bond: "guardian",
    stability: "finisher",
  },
};

/**
 * topAxis, secondAxis: CORE6の軸id（例: "vision", "logic" ...）
 * 戻り値: KAKU TYPEのid（types-data.js の key と一致）
 */
function determineType(topAxis, secondAxis) {
  const row = TYPE_MATRIX[topAxis];
  if (!row) return null;
  return row[secondAxis] || null;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { TYPE_MATRIX, determineType };
}
