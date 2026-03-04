// js/subjects.js
export const SUBJECTS = [
  // 国語
  "国語：古典探究",
  "国語：国語探究",
  // 地理歴史
  "地理歴史：日本史探究",
  "地理歴史：世界史探究",
  // 公民
  "公民：公共",
  // 数学
  "数学：数学Ⅱ",
  "数学：数学B",
  "数学：数学C",
  // 理科
  "理科：物理基礎",
  "理科：化学",
  // 外国語
  "外国語：英語コミュニケーションⅡ",
  "外国語：論理表現Ⅱ",
  // その他
  "その他"
];

export const MANUAL_CATEGORIES = [
  "塾",
  "講習",
  "自習室",
  "家庭教師",
  "その他"
];

// 表示用： "国語：古典探究" → "古典探究（国語）"
export function prettySubject(s){
  const str = String(s ?? "");
  const i = str.indexOf("：");
  if(i >= 0){
    const a = str.slice(0,i);
    const b = str.slice(i+1);
    return `${b}（${a}）`;
  }
  return str;
}
