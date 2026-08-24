const fs = require("fs");
const src = fs.readFileSync("js/data-auto.js", "utf8");
const m = src.match(/const ENTRIES = (\{.*?\});\n/s);
const e = JSON.parse(m[1]);
const seeds = new Set(["猫","虎","茶","书信","萤火虫","墨","砚","毛笔","钱","伞","螃蟹","西瓜","茄子","银河","太阳","石","露"]);
const mined = Object.values(e).filter(x => !seeds.has(x.name));
console.log("总条目:", Object.keys(e).length, "| 种子:", seeds.size, "| 挖掘:", mined.length);
console.log("\n挖掘词按频次 Top 60:");
mined.sort((a,b) => b.freq - a.freq).slice(0, 60)
  .forEach(x => console.log(String(x.freq).padStart(6), x.name));
// 检查垃圾残留
const junk = ["一日","日日","今日","明日","昨日","年年","夜夜","时时","千里","万里","人间","何处","不知"];
const bad = mined.filter(x => junk.includes(x.name));
console.log("\n垃圾残留:", bad.length ? bad.map(x=>x.name).join(",") : "无");
