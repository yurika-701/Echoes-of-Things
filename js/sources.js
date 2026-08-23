/* ============================================================
 * 物色集 · 联网数据源（sources.js）
 * ------------------------------------------------------------
 * 全部为公开数据库原文照录，无任何生成/改写：
 *  - chinese-poetry/chinese-poetry（GitHub，MIT 协议）
 *    通过 raw.githubusercontent.com 直连（CORS 开放），
 *    网络不通时自动切换 gh 代理镜像。
 *  - 维基百科 REST API（origin=* 跨域查询）。
 * 缓存：Cache API 优先（不可用时退回内存 Map）。
 * ============================================================ */

const SOURCES = (() => {

  "use strict";

  const REPO_RAW = "https://raw.githubusercontent.com/chinese-poetry/chinese-poetry/master/";
  const REPO_BROWSE = "https://github.com/chinese-poetry/chinese-poetry/blob/master/";

  /* 镜像列表：按序尝试，成功后粘滞。 */
  const MIRRORS = [
    { id: "raw",  label: "GitHub 直连", wrap: u => u },
    { id: "ghp1", label: "ghproxy.net", wrap: u => "https://ghproxy.net/" + u },
    { id: "ghp2", label: "gh-proxy.com", wrap: u => "https://gh-proxy.com/" + u },
    { id: "ghp3", label: "ghfast.top",  wrap: u => "https://ghfast.top/" + u }
  ];
  let stickyMirror = null;

  /* ---------- 缓存 ---------- */
  let memCache = new Map();
  let cacheApi = null;
  try { cacheApi = ("caches" in window) ? caches.open("wuse-ji-v1").catch(() => null) : null; }
  catch (e) { cacheApi = null; }

  async function cacheGet(key) {
    if (cacheApi) {
      try {
        const c = await cacheApi;
        if (c) {
          const hit = await c.match(key);
          if (hit) return await hit.json();
        }
      } catch (e) { /* 降级 */ }
    }
    return memCache.has(key) ? memCache.get(key) : null;
  }

  async function cachePut(key, data) {
    memCache.set(key, data);
    if (cacheApi) {
      try {
        const c = await cacheApi;
        if (c) await c.put(key, new Response(JSON.stringify(data)));
      } catch (e) { /* 空间不足等，忽略 */ }
    }
  }

  async function clearCache() {
    memCache = new Map();
    if (cacheApi) {
      try {
        const c = await cacheApi;
        if (c) {
          const keys = await c.keys();
          await Promise.all(keys.map(k => c.delete(k)));
        }
      } catch (e) {}
    }
    return cacheSize();
  }

  async function cacheSize() {
    let n = memCache.size;
    if (cacheApi) {
      try {
        const c = await cacheApi;
        if (c) n = (await c.keys()).length;
      } catch (e) {}
    }
    return n;
  }

  /* ---------- 抓取（带镜像回退与超时） ---------- */
  function fetchTimeout(url, ms) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), ms);
    return fetch(url, { signal: ctl.signal })
      .finally(() => clearTimeout(timer));
  }

  async function fetchJSON(path) {
    const key = "cp:" + path;
    const cached = await cacheGet(key);
    if (cached) return cached;

    const order = stickyMirror
      ? [stickyMirror, ...MIRRORS.filter(m => m !== stickyMirror)]
      : MIRRORS;

    let lastErr = null;
    for (const m of order) {
      const url = m.wrap(REPO_RAW + encodeURI(path));
      try {
        const res = await fetchTimeout(url, 25000);
        if (!res.ok) { lastErr = new Error("HTTP " + res.status); continue; }
        const data = await res.json();
        stickyMirror = m;
        await cachePut(key, data);
        return data;
      } catch (e) { lastErr = e; }
    }
    throw lastErr || new Error("所有镜像均不可用");
  }

  /* ---------- 语料目录 ----------
   * kind: single 单文件 | series 序列文件（index 递增，404 为止）
   * dynasty: 检索结果的朝代标注
   */
  const CATALOG = [
    { id: "shijing",   label: "诗经",     dynasty: "先秦", kind: "single", path: "诗经/shijing.json" },
    { id: "chuci",     label: "楚辞",     dynasty: "先秦", kind: "single", path: "楚辞/chuci.json" },
    { id: "lunyu",     label: "论语",     dynasty: "先秦", kind: "single", path: "论语/lunyu.json" },
    { id: "caocao",    label: "曹操诗集", dynasty: "汉魏", kind: "single", path: "曹操诗集/caocao.json" },
    { id: "gwgz",      label: "古文观止", dynasty: "历代", kind: "single", path: "蒙学/guwenguanzhi.json" },
    { id: "tang300",   label: "唐诗三百首", dynasty: "唐",  kind: "single", path: "蒙学/tangshisanbaishou.json" },
    { id: "quantang",  label: "全唐诗",   dynasty: "唐",   kind: "series",
      file: i => `全唐诗/poet.tang.${i}.json`, maxFiles: 400 },
    { id: "songci",    label: "全宋词",   dynasty: "宋",   kind: "series",
      file: i => `宋词/ci.song.${i}.json`, maxFiles: 400 }
  ];

  function sourceBrowseUrl(src, i) {
    return REPO_BROWSE + encodeURI(src.kind === "series" ? src.file(i) : src.path);
  }

  /* ---------- 语料归一化 ---------- */
  const LINE_KEYS = ["paragraphs", "content", "paragraph", "text"];
  const TITLE_KEYS = ["title", "chapter", "rhythmic", "name"];
  const AUTHOR_KEYS = ["author"];

  function extractLines(item) {
    for (const k of LINE_KEYS) {
      const v = item[k];
      if (Array.isArray(v) && v.length && typeof v[0] === "string") return v;
      if (typeof v === "string" && v) return [v];
    }
    return [];
  }
  function extractTitle(item) {
    const parts = [];
    for (const k of TITLE_KEYS) {
      if (typeof item[k] === "string" && item[k]) { parts.push(item[k]); break; }
    }
    return parts.join("·") || "（未题）";
  }
  function extractAuthor(item) {
    for (const k of AUTHOR_KEYS) if (typeof item[k] === "string" && item[k]) return item[k];
    return "无名氏";
  }

  /* ---------- 检索 ---------- */
  function matchLine(line, keywords) {
    for (const kw of keywords) if (kw && line.includes(kw)) return kw;
    return null;
  }

  /*
   * search(keyword(s), opts):
   *  opts.sources  要检索的目录 id 数组
   *  opts.onBatch  每批结果回调（results: [{line,kw,title,author,srcId,srcLabel,dynasty,url}]）
   *  opts.onProgress({srcLabel, loaded, matched, done}) 状态回调
   *  opts.limit    结果总数上限（默认 400）
   *  opts.signal   AbortSignal
   * 返回 {results, errors: [{srcLabel, message}]}
   */
  async function search(keywords, opts) {
    const kws = (keywords || []).filter(Boolean);
    const limit = opts.limit || 400;
    const results = [];
    const errors = [];
    const aborted = () => opts.signal && opts.signal.aborted;

    let totalMatched = 0;

    async function scanArray(arr, src, urlBase) {
      let got = 0;
      for (const item of arr) {
        const lines = extractLines(item);
        for (const line of lines) {
          const kw = matchLine(line, kws);
          if (kw) {
            results.push({
              line, kw,
              title: extractTitle(item),
              author: extractAuthor(item),
              srcId: src.id, srcLabel: src.label,
              dynasty: src.dynasty,
              url: urlBase
            });
            got++;
            if (results.length >= limit) return got;
          }
        }
      }
      return got;
    }

    async function loadSingle(src) {
      opts.onProgress && opts.onProgress({ srcLabel: src.label, loaded: 1, matched: totalMatched, done: false });
      const data = await fetchJSON(src.path);
      if (aborted()) return;
      totalMatched += await scanArray(Array.isArray(data) ? data : [], src, sourceBrowseUrl(src, 0));
      opts.onBatch && opts.onBatch(results.splice(0));
    }

    async function loadSeries(src) {
      let i = 0, missStreak = 0;
      while (i < src.maxFiles && missStreak < 3 && !aborted() && totalMatched + results.length < limit) {
        /* 小并发窗口，按块推进 */
        const batch = [];
        for (let j = 0; j < 6 && i < src.maxFiles; j++, i++) batch.push(i);
        const files = await Promise.all(batch.map(async (idx) => {
          try { return { idx, data: await fetchJSON(src.file(idx)) }; }
          catch (e) { return { idx, data: null }; }
        }));
        let miss = 0;
        for (const f of files) {
          if (!f.data) { miss++; continue; }
          missStreak = 0;
          totalMatched += await scanArray(f.data, src, sourceBrowseUrl(f.idx));
        }
        if (miss) missStreak += miss;
        opts.onBatch && opts.onBatch(results.splice(0));
        opts.onProgress && opts.onProgress({ srcLabel: src.label, loaded: i, matched: totalMatched, done: false });
      }
    }

    for (const src of CATALOG) {
      if (aborted()) break;
      if (!opts.sources || !opts.sources.includes(src.id)) continue;
      try {
        if (src.kind === "single") await loadSingle(src);
        else await loadSeries(src);
      } catch (e) {
        errors.push({ srcLabel: src.label, message: e.message || String(e) });
      }
      opts.onBatch && opts.onBatch(results.splice(0));
    }
    opts.onProgress && opts.onProgress({ srcLabel: "", loaded: 0, matched: 0, done: true });
    return { results, errors };
  }

  /* ---------- 镜像测试 ---------- */
  async function testMirrors() {
    const probe = "README.md";
    const out = [];
    for (const m of MIRRORS) {
      const t0 = performance.now();
      try {
        const res = await fetchTimeout(m.wrap(REPO_RAW + probe), 12000);
        out.push({ id: m.id, label: m.label, ok: res.ok, ms: Math.round(performance.now() - t0) });
        if (res.ok && !stickyMirror) stickyMirror = m;
      } catch (e) {
        out.push({ id: m.id, label: m.label, ok: false, ms: null });
      }
    }
    return out;
  }

  /* ---------- 维基百科（可选源，不可达则静默降级） ---------- */
  async function fetchWiki(title) {
    const api = "https://zh.wikipedia.org/w/api.php?action=query&prop=extracts"
      + "&exintro&explaintext&redirects=1&format=json&origin=*&titles="
      + encodeURIComponent(title);
    const res = await fetchTimeout(api, 9000);
    if (!res.ok) throw new Error("wiki http " + res.status);
    const data = await res.json();
    const pages = data && data.query && data.query.pages;
    if (!pages) throw new Error("wiki empty");
    const page = pages[Object.keys(pages)[0]];
    if (page.missing !== undefined || !page.extract) throw new Error("wiki no page");
    return {
      title: page.title,
      extract: page.extract,
      url: "https://zh.wikipedia.org/wiki/" + encodeURIComponent(page.title)
    };
  }

  return {
    CATALOG, search, fetchWiki,
    testMirrors, clearCache, cacheSize,
    get mirror() { return stickyMirror; }
  };

})();
