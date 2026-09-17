/**
 * KAKU diagnosis engine (client-side JS port of kaku_engine.py)
 * birthdate -> year/month/day pillars (算命学の干支) -> primary star
 * (from month-stem vs day-master Ten Gods relationship) -> combined
 * with MBTI temperament group -> KAKU type key ("starIndex-group").
 *
 * Accuracy notes (MVP level):
 * - Day pillar: exact, via Julian Day Number formula.
 * - Year pillar: changes at 立春, approximated as a fixed Feb 4 cutoff.
 * - Month pillar: branch from a fixed approximate solar-term table
 *   (accurate to within ~1 day most years); stem via 五虎遁.
 * Swap in precise solar-term timestamps later for production accuracy.
 */

const STEMS = ["甲","乙","丙","丁","戊","己","庚","辛","壬","癸"];
const BRANCHES = ["子","丑","寅","卯","辰","巳","午","未","申","酉","戌","亥"];
const STEM_ELEMENT = [0,0,1,1,2,2,3,3,4,4]; // wood,fire,earth,metal,water
const STEM_YY = [0,1,0,1,0,1,0,1,0,1]; // 0=yang,1=yin

// diff(0..4) -> [sameYY star, diffYY star] index into STAR_NAMES (0..9)
const STAR_NAMES = ["貫索星","石門星","鳳閣星","調舒星","禄存星","司禄星","牽牛星","車騎星","龍高星","玉堂星"];
// index mapping matches kaku_engine.py STAR_TABLE:
// diff0: same->貫索星(0), diff->石門星(1)
// diff1: same->鳳閣星(2), diff->調舒星(3)
// diff2: diff->司禄星(5), same->禄存星(4)
// diff3: diff->牽牛星(6), same->車騎星(7)
// diff4: same->龍高星(8), diff->玉堂星(9)
const STAR_TABLE = {
  "0_1": 0, "0_0": 1,
  "1_1": 2, "1_0": 3,
  "2_0": 5, "2_1": 4,
  "3_0": 6, "3_1": 7,
  "4_1": 8, "4_0": 9,
};

const MBTI_GROUP = {};
["INTJ","INTP","ENTJ","ENTP"].forEach(t => MBTI_GROUP[t] = "NT");
["INFJ","INFP","ENFJ","ENFP"].forEach(t => MBTI_GROUP[t] = "NF");
["ISTJ","ISFJ","ESTJ","ESFJ"].forEach(t => MBTI_GROUP[t] = "SJ");
["ISTP","ISFP","ESTP","ESFP"].forEach(t => MBTI_GROUP[t] = "SP");

const SOLAR_TERMS = [
  [2,4,2],[3,6,3],[4,5,4],[5,6,5],[6,6,6],[7,7,7],
  [8,8,8],[9,8,9],[10,8,10],[11,7,11],[12,7,0],[1,6,1],
];

const WUHU = {0:2,5:2, 1:4,6:4, 2:6,7:6, 3:8,8:8, 4:0,9:0};

function julianDayNumber(y, m, d) {
  const a = Math.floor((14 - m) / 12);
  const yy = y + 4800 - a;
  const mm = m + 12 * a - 3;
  return d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4)
    - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
}

function dayPillar(y, m, d) {
  const jdn = julianDayNumber(y, m, d);
  const idx = ((jdn + 49) % 60 + 60) % 60;
  return { stem: idx % 10, branch: idx % 12 };
}

function yearPillar(y, m, d) {
  const effYear = (m > 2 || (m === 2 && d >= 4)) ? y : y - 1;
  const idx = (((effYear - 1984) % 60) + 60) % 60;
  return { stem: idx % 10, branch: idx % 12 };
}

function monthBranch(m, d) {
  // mirrors kaku_engine.py's tuple-comparison logic exactly (see notes there)
  let chosen = SOLAR_TERMS[SOLAR_TERMS.length - 1]; // default: [1,6,1] (小寒)
  for (const term of SOLAR_TERMS) {
    const [tm, td] = term;
    if (tm < m || (tm === m && td <= d)) {
      chosen = term;
    }
  }
  if (m < 2 || (m === 2 && d < 4)) {
    chosen = (m > 1 || (m === 1 && d >= 6)) ? [1, 6, 1] : [12, 7, 0];
  }
  return chosen[2];
}

function monthPillar(y, m, d, yearStemIdx) {
  const branchIdx = monthBranch(m, d);
  const order = [2,3,4,5,6,7,8,9,10,11,0,1];
  const step = order.indexOf(branchIdx);
  const firstMonthStem = WUHU[yearStemIdx];
  const stemIdx = (firstMonthStem + step) % 10;
  return { stem: stemIdx, branch: branchIdx };
}

function tenGodStarIndex(dayStemIdx, otherStemIdx) {
  const ed = STEM_ELEMENT[dayStemIdx], ex = STEM_ELEMENT[otherStemIdx];
  const diff = ((ex - ed) % 5 + 5) % 5;
  const sameYY = STEM_YY[dayStemIdx] === STEM_YY[otherStemIdx] ? 1 : 0;
  return STAR_TABLE[`${diff}_${sameYY}`];
}

/**
 * @param {number} y full year e.g. 1994
 * @param {number} m 1-12
 * @param {number} d 1-31
 * @param {string} mbti 4-letter type, e.g. "INFJ"
 * @returns {{starIndex:number, starName:string, group:string, pillars:object}}
 */
function diagnose(y, m, d, mbti) {
  const yp = yearPillar(y, m, d);
  const mp = monthPillar(y, m, d, yp.stem);
  const dp = dayPillar(y, m, d);
  const starIndex = tenGodStarIndex(dp.stem, mp.stem);
  const group = MBTI_GROUP[mbti.toUpperCase()] || "NF";
  return {
    starIndex,
    starName: STAR_NAMES[starIndex],
    group,
    pillars: {
      year: STEMS[yp.stem] + BRANCHES[yp.branch],
      month: STEMS[mp.stem] + BRANCHES[mp.branch],
      day: STEMS[dp.stem] + BRANCHES[dp.branch],
    },
  };
}

// simple 8-question quick quiz -> 4-letter type (majority vote per axis)
function quizToMbti(answers) {
  // answers: array of 8 chars, one per question, from ['E','I','S','N','T','F','J','P']
  const counts = { E:0,I:0,S:0,N:0,T:0,F:0,J:0,P:0 };
  answers.forEach(a => { if (a in counts) counts[a]++; });
  const ei = counts.E >= counts.I ? 'E' : 'I';
  const sn = counts.S >= counts.N ? 'S' : 'N';
  const tf = counts.T >= counts.F ? 'T' : 'F';
  const jp = counts.J >= counts.P ? 'J' : 'P';
  return ei + sn + tf + jp;
}

if (typeof module !== "undefined") {
  module.exports = { diagnose, quizToMbti, STAR_NAMES, MBTI_GROUP };
}
