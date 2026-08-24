#!/usr/bin/env node
/* ============================================================
 * 物色集 · 语料统计收录层构建脚本（build-data.mjs）
 * ------------------------------------------------------------
 * 纯程序统计，无 AI 生成。产出 js/data-auto.js（机器层条目）：
 *   1. 词表来源：
 *      a) 种子词表（内置雅称池 → 本尊词）
 *      b) 语料 n-gram 挖掘：全唐诗/全宋词等高频二字名词，
 *         以「意象核心字」过滤 + 功能词黑名单去噪
 *   2. 每个词统计：出现频次、作者数、朝代分布、真实原句例证、
 *      情感字共现、意象共现——全部来自语料原文计数。
 *   3. 维基百科摘要为可选增强（不可达则用统计描述兜底）。
 *
 * 用法示例：
 *   node scripts/build-data.mjs --top 400 --min-freq 12 \
 *        --tang 0:120 --songci 0:60 --wiki
 * ============================================================ */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const CACHE = path.join(__dirname, "cache");
fs.mkdirSync(CACHE, { recursive: true });

/* ---------- CLI ---------- */
const args = process.argv.slice(2);
function argVal(name, def) {
  const i = args.indexOf("--" + name);
  if (i === -1 || i + 1 >= args.length) return def;
  return args[i + 1];
}
function argFlag(name) { return args.includes("--" + name); }

const TOP_N       = parseInt(argVal("top", "300"), 10);
const MIN_FREQ    = parseInt(argVal("min-freq", "12"), 10);
const TANG_RANGE  = parseRange(argVal("tang", "0:120"));
const SONG_RANGE  = parseRange(argVal("songci", "0:60"));
const USE_WIKI    = argFlag("wiki");
const OUT_FILE    = path.resolve(ROOT, argVal("out", "js/data-auto.js"));

function parseRange(s) {
  const [a, b] = String(s).split(":").map(n => parseInt(n, 10));
  return [isNaN(a) ? 0 : a, isNaN(b) ? 0 : b];
}

/* ---------- 抓取（镜像回退 + 磁盘缓存） ---------- */
const REPO_RAW = "https://raw.githubusercontent.com/chinese-poetry/chinese-poetry/master/";
const MIRRORS = [
  u => u,
  u => "https://ghproxy.net/" + u,
  u => "https://gh-proxy.com/" + u,
  u => "https://ghfast.top/" + u
];
let sticky = 0;

function fetchTimeout(url, ms) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  return fetch(url, { signal: ctl.signal }).finally(() => clearTimeout(t));
}

async function fetchJSONCached(repoPath) {
  const key = crypto.createHash("md5").update(repoPath).digest("hex").slice(0, 20);
  const cacheFile = path.join(CACHE, key + ".json");
  if (fs.existsSync(cacheFile)) {
    try { return JSON.parse(fs.readFileSync(cacheFile, "utf8")); } catch (e) {}
  }
  const order = [sticky, ...MIRRORS.keys()].filter((v, i, a) => a.indexOf(v) === i);
  let lastErr = null;
  if (process.env.WUSE_DEBUG) console.log(`      [fetch] ${repoPath} 尝试镜像 ${order.join(",")}`);
  for (const mi of order) {
    try {
      const res = await fetchTimeout(MIRRORS[mi](REPO_RAW + encodeURI(repoPath)), 15000);
      if (!res.ok) {
        lastErr = new Error(`HTTP ${res.status} @mirror${mi}`);
        if (process.env.WUSE_DEBUG) {
          try { const t = await res.text(); console.log(`      [fetch] mirror${mi} -> ${res.status} ${res.headers.get("content-type")} body: ${JSON.stringify(t.slice(0, 150))}`); }
          catch (e) { console.log(`      [fetch] mirror${mi} -> ${res.status} (body read fail)`); }
        }
        continue;
      }
      const data = await res.json();
      sticky = mi;
      fs.writeFileSync(cacheFile, JSON.stringify(data));
      return data;
    } catch (e) { lastErr = new Error(`${e.message} @mirror${mi}`); }
  }
  throw lastErr || new Error("unreachable");
}

/* ---------- 语料目录 ---------- */
const SINGLES = [
  { label: "诗经",     dynasty: "先秦", path: "诗经/shijing.json" },
  { label: "楚辞",     dynasty: "先秦", path: "楚辞/chuci.json" },
  { label: "论语",     dynasty: "先秦", path: "论语/lunyu.json" },
  { label: "曹操诗集", dynasty: "汉魏", path: "曹操诗集/caocao.json" },
  { label: "唐诗三百首", dynasty: "唐",  path: "蒙学/tangshisanbaishou.json" },
  { label: "古文观止", dynasty: "历代", path: "蒙学/guwenguanzhi.json" }
];
async function loadCorpus() {
  const docs = [];
  for (const s of SINGLES) {
    try {
      const data = await fetchJSONCached(s.path);
      pushDocs(docs, data, s.label, s.dynasty);
    } catch (e) { console.warn("  跳过", s.label, e.message); }
  }
  let loaded = 0;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const series = async (label, pathFn, range) => {
    let consecMiss = 0;
    for (let i = range[0]; i < range[1]; i++) {
      let ok = false;
      for (let attempt = 0; attempt < 3 && !ok; attempt++) {
        try {
          const data = await fetchJSONCached(pathFn(i));
          pushDocs(docs, data, label, label === "全唐诗" ? "唐" : "宋");
          loaded++; ok = true; consecMiss = 0;
          if (loaded % 40 === 0) console.log(`      系列卷已加载 ${loaded} ……`);
          await sleep(300); /* 温和限速，避免镜像限流 */
        } catch (e) {
          if (attempt < 2) await sleep(3000 * (attempt + 1));
          else console.warn(`      ${label} 第 ${i} 卷失败：${e.message}`);
        }
      }
      if (consecMiss >= 6) { console.warn(`      ${label} 连续 ${consecMiss} 卷失败，停止。`); break; }
    }
  };
  /* 仓库已改为按作者 ID 分块：poet.tang.{0,1000,...,57000}.json 共 58 卷；
     ci.song.{0,...,21000}.json 共 22 卷。range 参数按“第几卷”计。 */
  const tangIds = Array.from({ length: 58 }, (_, k) => k * 1000);
  const songIds = Array.from({ length: 22 }, (_, k) => k * 1000);
  await series("全唐诗", i => `全唐诗/poet.tang.${tangIds[i]}.json`,
    [TANG_RANGE[0], Math.min(TANG_RANGE[1], tangIds.length)]);
  await series("全宋词", i => `宋词/ci.song.${songIds[i]}.json`,
    [SONG_RANGE[0], Math.min(SONG_RANGE[1], songIds.length)]);
  return docs;
}
const LINE_KEYS = ["paragraphs", "content", "paragraph", "text"];
const TITLE_KEYS = ["title", "chapter", "rhythmic", "name"];
function pushDocs(docs, data, srcLabel, dynasty) {
  if (!Array.isArray(data)) return;
  for (const item of data) {
    let lines = [];
    for (const k of LINE_KEYS) {
      const v = item[k];
      if (Array.isArray(v) && v.length && typeof v[0] === "string") { lines = v; break; }
      if (typeof v === "string" && v) { lines = [v]; break; }
    }
    let title = "（未题）";
    for (const k of TITLE_KEYS) if (typeof item[k] === "string" && item[k]) { title = item[k]; break; }
    docs.push({ lines, title, author: item.author || "无名氏", srcLabel, dynasty });
  }
}

/* ---------- 词表 A：种子词（雅称池 → 本尊） ---------- */
/* note 一律为可考的通行训释；出处存疑者标注（整理）。 */
const SEEDS = [
  { name: "猫",   category: "动物", aliases: [{ alias: "衔蝉", note: "宋人雅称猫为衔蝉奴" }, { alias: "狸奴", note: "猫的爱称，陆游诗习见", quote: "裹盐迎得小狸奴", from: "陆游《赠猫》" }] },
  { name: "虎",   category: "动物", aliases: [{ alias: "於菟", note: "古楚语称虎，读 wū tú", quote: "虎求百兽而食之……子以我为不信？吾为子先行", from: "《战国策·楚策》；「於菟」见《左传·宣公四年》" }] },
  { name: "茶",   category: "器物", aliases: [{ alias: "不夜侯", note: "饮之可除睡意的戏称", from: "按：晋·胡峤诗等（整理）" }, { alias: "涤烦子", note: "谓其涤烦去腻", from: "按：唐·施肩吾语（整理）" }, { alias: "茗", note: "茶之古称", quote: "谁谓荼苦，其甘如荠", from: "《诗经·邶风·谷风》（荼茶通假）" }] },
  { name: "书信", category: "器物", aliases: [{ alias: "双鲤", note: "汉乐府藏书于鱼腹之典", quote: "客从远方来，遗我双鲤鱼。呼儿烹鲤鱼，中有尺素书", from: "汉乐府《饮马长城窟行》" }, { alias: "尺素", note: "书写于一尺素绢的书信", quote: "驿寄梅花，鱼传尺素", from: "秦观《踏莎行》" }, { alias: "锦书", note: "织锦回文书信（苏蕙典）", quote: "云中谁寄锦书来", from: "李清照《一剪梅》" }, { alias: "青鸟", note: "西王母信使，借指传书", quote: "蓬山此去无多路，青鸟殷勤为探看", from: "李商隐《无题》" }, { alias: "鱼雁", note: "鱼腹藏帛、雁足系书，合称书信", quote: "鱼雁音尘少", from: "按：诗词习用语汇（整理）" }] },
  { name: "萤火虫", category: "动物", wiki: "萤火虫", aliases: [{ alias: "照夜清", note: "萤火虫雅称", from: "按：古人雅称汇编（整理）" }, { alias: "流萤", note: "飞动的萤火", quote: "银烛秋光冷画屏，轻罗小扇扑流萤", from: "杜牧《秋夕》" }] },
  { name: "墨",   category: "器物", aliases: [{ alias: "松使者", note: "唐人称墨为松使者（松烟制墨）", from: "按：《云仙杂记》载陶家瓶事（整理）" }, { alias: "玄圭", note: "以黑色玉圭喻墨锭", from: "按：古人雅称汇编（整理）" }] },
  { name: "砚",   category: "器物", aliases: [{ alias: "寒泓", note: "砚池贮水如寒泉，故称", from: "按：宋人诗文习用（整理）" }, { alias: "石虚中", note: "拟人化雅称——居石中之虚器", from: "按：古人雅称汇编（整理）" }] },
  { name: "毛笔", category: "器物", wiki: "毛笔", aliases: [{ alias: "管城子", note: "韩愈《毛颖传》以笔为传主，封管城", quote: "秦皇帝使恬赐之汤沐，而封诸管城，号曰管城子", from: "韩愈《毛颖传》" }, { alias: "中书君", note: "同出《毛颖传》，拜中书令之戏", quote: "累拜中书令，呼为中书君", from: "韩愈《毛颖传》" }] },
  { name: "钱",   category: "器物", aliases: [{ alias: "青蚨", note: "传说青蚨还钱，故代指钱", quote: "青蚨还钱", from: "按：《搜神记》所载传说（整理）" }, { alias: "上清童子", note: "唐传奇中钱之神名", quote: "上清童子元宝", from: "按：唐·牛僧孺《玄怪录》（整理）" }, { alias: "孔方兄", note: "钱有方孔，故戏称", quote: "亲爱如兄，字曰孔方", from: "西晋·鲁褒《钱神论》" }] },
  { name: "伞",   category: "器物", aliases: [{ alias: "撑花", note: "方言雅称——撑开如花", from: "按：古人俗称呼语（整理）" }] },
  { name: "螃蟹", category: "动物", wiki: "螃蟹", aliases: [{ alias: "无肠公子", note: "古人谓蟹无肠，拟人称公子", quote: "称无肠公子者，蟹也", from: "晋·葛洪《抱朴子》" }, { alias: "横行介士", note: "以横行与甲壳得名", from: "按：古人戏称（整理）" }] },
  { name: "西瓜", category: "草木", aliases: [{ alias: "青门绿玉房", note: "青门瓜旧地＋绿玉言其瓤色", from: "按：明人诗语（整理）" }] },
  { name: "茄子", category: "草木", wiki: "茄", aliases: [{ alias: "落苏", note: "吴地方言对茄子的美称", from: "按：宋人笔记载其缘由（整理）" }] },
  { name: "银河", category: "天象", wiki: "银河", aliases: [{ alias: "星汉", note: "曹操以星汉咏沧海夜空", quote: "星汉灿烂，若出其里", from: "曹操《观沧海》" }, { alias: "银汉", note: "以银喻河汉", quote: "银汉迢迢暗度", from: "秦观《鹊桥仙》" }, { alias: "绛河", note: "北方之气深绛，故称", from: "按：《汉书》天文志注引（整理）" }, { alias: "天杭", note: "杭即航——天上之航路", from: "按：古人雅称汇编（整理）" }] },
  { name: "太阳", category: "天象", wiki: "太阳", aliases: [{ alias: "皦日", note: "皦，白亮之日的古称", quote: "谓予不信，有如皦日", from: "《诗经·王风·大车》" }, { alias: "宝镜", note: "以镜喻日", from: "按：古人雅称汇编（整理）" }, { alias: "丹灵", note: "丹为日色，灵为神格", from: "按：古人雅称汇编（整理）" }, { alias: "东君", note: "日神之名，后借代太阳", quote: "暾将出兮东方，照吾槛兮扶桑", from: "《楚辞·九歌·东君》" }, { alias: "羲和", note: "神话中为日驾车者，借代日", quote: "吾令羲和弭节兮，望崦嵫而勿迫", from: "屈原《离骚》" }] },
  { name: "石",   category: "地理", wiki: "岩石", aliases: [{ alias: "山骨", note: "石为山之骨", quote: "按：唐人以「云根」「山骨」称石（整理）", from: "按：古人雅称汇编（整理）" }, { alias: "云根", note: "古人谓云触石而生，故称石为云根", from: "按：杜诗注家习说（整理）" }] },
  { name: "露",   category: "天象", aliases: [{ alias: "天酒", note: "甘露之别称——天降之酒", quote: "甘露，一名天酒", from: "按：《瑞应图》（整理）" }, { alias: "玉液", note: "以玉膏喻清露", from: "按：与酒之「玉液」同源互借（整理）" }] }
];

/* ---------- 词表 B：语料挖掘参数 ---------- */
/* 意象核心字（分类映射兼过滤）：命中其一才纳入候选 */
const CATEGORY_CHARS = {
  "天象": "日月星辰风云雨雪霜露虹雷电霞烟雾霭曦晖曛霄",
  "地理": "山河川江海湖溪泉岩崖峰岭原野田畴沙洲堤岸岛屿洞壑林滩波涛浪涧",
  "草木": "花草木柳松竹梅荷莲桃李梨杏桂枫桐萍苔兰菊竹藤蔓蕙芷菱芦荻槐榆桑梓栀榴棠棣萼蕊叶枝根",
  "动物": "鸟兽虫鱼龙凤鹤鸦鹊莺燕雁鸥鹭蝉蝶蜂蟋蟀蛛蚁鱼龙马牛羊犬豕猿鹿虎豹狐鼠蛇龟鳌鳞羽翰翎",
  "禽鸟": "鸿雁莺燕鹤鸦鹊鸥鹭鸾凤凰鹃鹧鸪鸠雀燕",
  "器物": "舟帆桥楼灯烛镜剑琴棋书画笔墨纸砚酒茶扇帘钟鼓笛箫瑟琵琶绮罗锦纱绫珠玉金钗钏环壶觞樽杓鼎炉香烛辇鞍鞯弓刀戈戟旌旗",
  "建筑": "亭台楼阁轩斋堂殿宫阙垣墙庭院阶砌栏槛窗牖"
};
const CORE_CHARS = Object.values(CATEGORY_CHARS).join("");

/* 修饰字（可作二字意象的首/尾字）：明月、寒江、残阳、落花、春风…… */
const MODIFIER_CHARS =
  "明清寒暑残孤独斜疏淡暗浓冷暖烟霞暮晓早晚春冬秋夏朝宵宿归飞鸣啼落流浮沉轻幽静闲旷深空碧翠皓素皎丹朱玄苍茫渺漫平遥遥远久新故旧满半垂拂摇曳横斜倒影";

/* 功能/数词字——任一命中即排除（杜绝「一日」「千里」类） */
const FUNC_CHARS = new Set(
  ("一二三四五六七八九十百千万亿零双半之乎者也的了是在有无不为与而于此彼何谁莫未已更最亦皆均只才将把被让向往自从对说言云曰焉哉兮").split("")
);

const isCJK = ch => /[\u4e00-\u9fff]/.test(ch);

/* 规则过滤后仍需点名的漏网词 */
const STOP_GRAMS_EXTRA = new Set(
  ("明日|来日|往日|昔日|旧日|他日|竟日|终日|连日|当日|即日|今日|隔日|次日|风流|风头|风光").split("|")
);

/* 二字组是否像「意象词」：
   1) 两字均为核心字（桥楼、琴棋），或
   2) 一修饰 + 一核心（明月、寒江、春风）
   叠字（日日）、含功能字（一日、不知）一律排除 */
function looksLikeImageryGram(a, b) {
  const C = ch => CORE_CHARS.includes(ch);
  const M = ch => MODIFIER_CHARS.includes(ch);
  if (a === b) return false;
  if (FUNC_CHARS.has(a) || FUNC_CHARS.has(b)) return false;
  return (M(a) && C(b)) || (C(a) && M(b)) || (C(a) && C(b));
}

/* 情感字共现词表（单字统计） */
const EMOTION_CHARS = "愁悲哀伤怨恨忧愤怒喜怒欢乐笑思念忆恋爱慕孤独寂寞别离散归客游梦醉醒泪涕泣惊恐惧闲静幽清冷淡倦懒羞悔盼期待".split("");

/* ---------- 主流程 ---------- */
console.log("[1/5] 加载语料 ……");
const docs = await loadCorpus();
const totalLines = docs.reduce((n, d) => n + d.lines.length, 0);
console.log(`      文档 ${docs.length} 篇 · 原句 ${totalLines} 行`);

console.log("[2/5] n-gram 频次挖掘 ……");
/* 精选层已有词（从 data.js 直接解析，保持单一来源） */
const existing = (() => {
  const src = fs.readFileSync(path.join(ROOT, "js/data.js"), "utf8");
  return new Function(src + ";return IMAGERY_NAMES;")();
})();

/** @type {Map<string,{freq:number,authors:Set<string>}>} */
const grams = new Map();
for (const d of docs) {
  for (const line of d.lines) {
    for (let i = 0; i < line.length - 1; i++) {
      const a = line[i], b = line[i + 1];
      if (!isCJK(a) || !isCJK(b)) continue;
      if (!looksLikeImageryGram(a, b)) continue;
      const g = a + b;
      if (STOP_GRAMS_EXTRA.has(g)) continue;
      let rec = grams.get(g);
      if (!rec) { rec = { freq: 0, authors: new Set() }; grams.set(g, rec); }
      rec.freq++;
      rec.authors.add(d.author);
    }
  }
}
const mined = [...grams.entries()]
  .filter(([g, r]) => r.freq >= MIN_FREQ && r.authors.size >= 3)
  .sort((x, y) => y[1].freq - x[1].freq)
  .slice(0, TOP_N)
  .map(([g]) => g);
console.log(`      候选 ${grams.size} → 达标 ${mined.length}`);

console.log("[3/5] 组装词条并统计例证 ……");
/* 待收录 = 种子词 + 挖掘词（排除精选层已有） */
const headwords = [];
for (const s of SEEDS) headwords.push(s);
for (const g of mined) {
  if (existing.includes(g) || headwords.some(h => h.name === g)) continue;
  headwords.push({ name: g, category: guessCategory(g) });
}

function guessCategory(word) {
  let best = null, bestScore = 0;
  for (const [cat, chars] of Object.entries(CATEGORY_CHARS)) {
    let score = 0;
    for (const ch of word) if (chars.includes(ch)) score++;
    /* 禽鸟并入动物展示亦可；保留独立类目 */
    if (score > bestScore) { bestScore = score; best = cat; }
  }
  return best || "器物";
}

/** 扫描语料：kws[0] 为本尊词，其余为雅称/别称——任一命中即计入 */
function scanWord(kws) {
  const stat = { freq: 0, authors: new Set(), dynasties: {}, examples: [], emo: {}, co: {}, kwFreq: {} };
  const has = para => { for (const kw of kws) if (kw && para.includes(kw)) return kw; return null; };
  for (const d of docs) {
    for (const para of d.lines) {
      const hitKw = has(para);
      if (!hitKw) continue;
      stat.freq++;
      stat.kwFreq[hitKw] = (stat.kwFreq[hitKw] || 0) + 1;
      stat.authors.add(d.author);
      stat.dynasties[d.dynasty] = (stat.dynasties[d.dynasty] || 0) + 1;
      /* 例句：取含关键词的单句，偏好不同作者、长度适中 */
      if (stat.examples.length < 40) {
        for (const sen of para.split(/[。！？；!?;]/)) {
          const senKw = has(sen);
          if (senKw && sen.length <= 42) {
            stat.examples.push({ line: sen, kw: senKw, title: d.title, author: d.author, dynasty: d.dynasty, srcLabel: d.srcLabel });
            break;
          }
        }
      }
      /* 情感字共现 */
      for (const ch of EMOTION_CHARS) {
        if (para.includes(ch)) stat.emo[ch] = (stat.emo[ch] || 0) + 1;
      }
      /* 共现意象：同段出现的其他核心字词（二字组） */
      for (let i = 0; i < para.length - 1; i++) {
        const g = para.slice(i, i + 2);
        if (kws.includes(g)) continue;
        if (isCJK(g[0]) && isCJK(g[1]) && grams.has(g)) {
          stat.co[g] = (stat.co[g] || 0) + 1;
        }
      }
    }
  }
  return stat;
}

const entries = {};
let done = 0;
for (const h of headwords) {
  const aliasList = (h.aliases || []).map(a => a.alias);
  const st = scanWord([h.name, ...aliasList]);
  if (!SEEDS.includes(h) && st.freq < MIN_FREQ) continue; // 种子词豁免

  /* 例证精选：优先不同作者、先秦/汉魏优先，句子去重 */
  const seenAuthor = new Set(), seenLine = new Set();
  const examples = [];
  for (const pass of [0, 1, 2]) {
    for (const ex of st.examples) {
      if (examples.length >= 4) break;
      if (seenLine.has(ex.line)) continue;
      if (pass < 2 && seenAuthor.has(ex.author)) continue;
      if (pass === 0 && ex.dynasty !== "先秦" && ex.dynasty !== "汉魏") continue;
      examples.push(ex);
      seenAuthor.add(ex.author);
      seenLine.add(ex.line);
    }
    if (examples.length >= 4) break;
  }

  /* 情感 top4、共现 top6 */
  const emotions = Object.entries(st.emo).sort((a, b) => b[1] - a[1]).slice(0, 4)
    .map(([ch, hits]) => ({ emotion: ch + "（共现）", hits }));
  const collocates = Object.entries(st.co).sort((a, b) => b[1] - a[1]).slice(0, 6)
    .map(([w, hits]) => ({ name: w, hits }));

  entries[h.name] = {
    name: h.name,
    tier: "auto",
    category: h.category,
    freq: st.freq,
    kwFreq: st.kwFreq,
    authorCount: st.authors.size,
    dynasties: st.dynasties,
    summary: "", // 维基或兜底，稍后填
    aliases: (h.aliases || []).map(a => ({
      alias: a.alias, kind: a.kind || "雅称",
      note: a.note || "",
      quote: a.quote || "",
      from: a.from || "按：古人雅称汇编（整理）"
    })),
    examples,
    emotions,
    collocates,
    ...(h.wiki ? { wiki: h.wiki } : {})
  };
  done++;
  if (done % 50 === 0) console.log(`      ${done}/${headwords.length}`);
}

console.log("[4/5] 维基百科摘要（可选增强）……");
if (USE_WIKI) {
  const names = Object.keys(entries);
  for (let i = 0; i < names.length; i += 10) {
    const batch = names.slice(i, i + 10);
    try {
      const api = "https://zh.wikipedia.org/w/api.php?action=query&prop=extracts&exintro&explaintext&redirects=1&format=json&origin=*&titles="
        + encodeURIComponent(batch.join("|"));
      const res = await fetchTimeout(api, 15000);
      const data = await res.json();
      const pages = data?.query?.pages || {};
      const byTitle = {};
      for (const p of Object.values(pages)) if (p.extract) byTitle[p.title] = p.extract;
      for (const n of batch) {
        const hit = byTitle[n] || (entries[n].wiki && byTitle[entries[n].wiki]);
        if (hit) entries[n].summary = hit.replace(/\s+/g, "").slice(0, 160);
      }
    } catch (e) { console.warn("  wiki 批次失败：" + e.message); break; }
  }
}
/* 兜底摘要：纯统计描述 */
for (const n of Object.keys(entries)) {
  const e = entries[n];
  if (!e.summary) {
    e.summary = `「${n}」在本站语料（《诗经》《楚辞》、唐诗三百首及全唐诗作样本、全宋词样本等）中共出现 ${e.freq} 次，`
      + `出自 ${e.authorCount} 位作者之手。本条由程序统计生成：以下原句均为语料原文照录，情感与共现为词频统计结果。`;
  }
}

console.log("[5/5] 写出 " + OUT_FILE);
const meta = {
  generatedAt: new Date().toISOString(),
  corpus: { docs: docs.length, lines: totalLines, tang: TANG_RANGE, songci: SONG_RANGE },
  count: Object.keys(entries).length
};
const js =
`/* ============================================================
 * 物色集 · 语料统计收录层（自动生成，请勿手改）
 * 生成时间：${meta.generatedAt}
 * 生成方式：纯语料统计（词频 / 共现 / 原文例句），无 AI 生成内容。
 * 重新生成：node scripts/build-data.mjs --help
 * ============================================================ */

(() => {
  const ENTRIES = ${JSON.stringify(entries)};
  const META = ${JSON.stringify(meta)};

  /* 与精选层合并：精选优先（同名不覆盖） */
  for (const [name, entry] of Object.entries(ENTRIES)) {
    if (!WUSE.imagery[name]) WUSE.imagery[name] = entry;
  }
  for (const name of Object.keys(ENTRIES)) {
    if (!IMAGERY_NAMES.includes(name)) IMAGERY_NAMES.push(name);
  }
  WUSE.autoMeta = META;
})();
`;
fs.writeFileSync(OUT_FILE, js, "utf8");
console.log(`完成：${meta.count} 条收录层条目 → ${path.relative(ROOT, OUT_FILE)}`);
