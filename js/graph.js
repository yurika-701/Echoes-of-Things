/* ============================================================
 * 物色集 · 意象网（graph.js）
 * ------------------------------------------------------------
 * 两张图，对应两层网络：
 *  1. renderChain  单意象「生成链」：固定分层布局，可视化
 *     本名 →(异名) 别称
 *     本名 →(触发) 情感 →(凝结) 复合意象
 *     情感/复合意象 →(转译) 电影
 *     依据《文心雕龙·物色》「物色之动，心亦摇焉」的生成逻辑。
 *  2. renderGlobal 全局「意象—情感枢纽网」：力导向布局，
 *     意象为节点、情感为中间枢纽、共现/引申/对写为边。
 * ECharts 由 CDN 动态加载，多镜像回退；全部失败时文字降级。
 * ============================================================ */

const GRAPH = (() => {

  "use strict";

  const ECHARTS_URLS = [
    "https://cdn.jsdelivr.net/npm/echarts@5.5.1/dist/echarts.min.js",
    "https://unpkg.com/echarts@5.5.1/dist/echarts.min.js",
    "https://cdnjs.cloudflare.com/ajax/libs/echarts/5.5.1/echarts.min.js"
  ];

  let echartsPromise = null;
  const charts = []; // 用于 resize

  function ensureECharts() {
    if (window.echarts) return Promise.resolve(window.echarts);
    if (echartsPromise) return echartsPromise;
    echartsPromise = new Promise((resolve, reject) => {
      let idx = 0;
      const tryNext = () => {
        if (idx >= ECHARTS_URLS.length) { echartsPromise = null; return reject(new Error("echarts 加载失败")); }
        const s = document.createElement("script");
        s.src = ECHARTS_URLS[idx++];
        s.onload = () => resolve(window.echarts);
        s.onerror = () => { s.remove(); tryNext(); };
        document.head.appendChild(s);
      };
      tryNext();
    });
    return echartsPromise;
  }

  window.addEventListener("resize", () => charts.forEach(c => c.resize()));

  function mount(container) {
    const chart = window.echarts.init(container);
    charts.push(chart);
    return chart;
  }

  const INK = "#2f2a24";
  /* 传统色系：霁蓝 · 官绿 · 赭石 · 赤褐 · 紫灰 · 青碧（取浅色调，保证墨字可读） */
  const C = {
    root: "#B04A3E",      /* 朱砂——本名（配浅色字） */
    alias: "#7E97B8",     /* 霁蓝——别称 */
    emotion: "#CE9459",   /* 琥珀——情感 */
    compound: "#7C9E7E",  /* 官绿——复合意象 */
    film: "#6E9BA5",      /* 青碧——电影 */
    edgeNeutral: "#ADA394",
    edgeEmotion: "#C9B49A",
    edgeCompound: "#7FA184",
    edgeFilm: "#7FA6AD",
    edgeBook: "#9D86B2",
    hubFill: "rgba(138, 131, 117, 0.16)",
    hubLine: "#8A8375",
    hubText: "#5d554a"
  };
  /* 各层同色系的深浅变化——扩大色彩范围，节点不至于一片死色 */
  const TINTS = {
    alias: ["#7E97B8", "#93AAC6", "#6B86AA", "#A3B6CD"],
    emotion: ["#CE9459", "#D9AB77", "#C0824C", "#E0BD92"],
    compound: ["#7C9E7E", "#91AF93", "#698D6B", "#A7BFA4"],
    film: ["#6E9BA5", "#85ACB4", "#59878F", "#9DBFC5"],
    book: ["#8A6FA0", "#9D86B2", "#755D8C", "#B09DC4"]
  };
  const PALETTE = {
    "天象": "#55779E",
    "草木": "#567B57",
    "地理": "#8B6C4A",
    "动物": "#B65C44",
    "禽鸟": "#8A6FA0",
    "器物": "#4E7F87",
    "建筑": "#907062"
  };

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  /* 按文字长度撑大节点，使底色完整覆盖文字 */
  function fitSize(text, base, fs) {
    const n = Array.from(String(text)).length;
    return Math.max(base, n * (fs || 13) + 26);
  }

  /* ============ 1. 单意象生成链 ============ */
  async function renderChain(container, name) {
    const d = WUSE.imagery[name];
    if (!d) return;

    let ech;
    try { ech = await ensureECharts(); }
    catch (e) { return renderChainFallback(container, d); }

    const LAYER_X = { root: 0, alias: -340, emotion: 300, compound: 700, film: 1100, books: 1500 };
    const nodes = [], links = [];

    nodes.push({
      id: "root", name: d.name, x: LAYER_X.root, y: 0, symbolSize: fitSize(d.name, 76, 26),
      category: 0, itemStyle: { color: C.root, borderColor: "#fbf8f0", borderWidth: 2 },
      label: { show: true, fontSize: 26, color: "#f7f2e6", fontWeight: "bold", fontFamily: "Ma Shan Zheng, Noto Serif SC, serif" },
      tooltip: { content: "中心意象" }
    });

    /* 词汇层：别称（异名） */
    (d.aliases || []).forEach((a, i, arr) => {
      const y = (i - (arr.length - 1) / 2) * 110;
      const id = "alias" + i;
      nodes.push({
        id, name: a.alias, x: LAYER_X.alias, y,
        symbolSize: fitSize(a.alias, 36),
        symbol: "circle", category: 1,
        itemStyle: { color: TINTS.alias[i % TINTS.alias.length], borderColor: "#fbf8f0", borderWidth: 1.5 },
        label: { fontSize: 13, color: INK, fontWeight: 600 },
        tooltip: { content: esc(a.quote) + "<br>" + esc(a.from) }
      });
      links.push({ source: "root", target: id, tag: i === 0 ? "异名" : "", lineStyle: { color: C.edgeNeutral } });
    });

    /* 情感层 */
    (d.emotions || []).forEach((e, i, arr) => {
      const y = (i - (arr.length - 1) / 2) * 150;
      const id = "emo" + i;
      nodes.push({
        id, name: e.emotion, x: LAYER_X.emotion, y,
        symbolSize: fitSize(e.emotion, 48),
        category: 2,
        itemStyle: { color: TINTS.emotion[i % TINTS.emotion.length], borderColor: "#fbf8f0", borderWidth: 1.5 },
        label: { fontSize: 13, color: INK, fontWeight: 600 },
        tooltip: { content: e.evidences.map(v => esc(v.quote) + "<br>" + esc(v.from)).join("<br><br>") }
      });
      links.push({ source: "root", target: id, tag: i === 0 ? "触发" : "", lineStyle: { color: C.emotion } });
    });

    /* 复合意象层：情感凝结（carries 命中情感即连边） */
    let labelledCondense = false;
    (d.compounds || []).forEach((c, i, arr) => {
      const y = (i - (arr.length - 1) / 2) * 130;
      const id = "cpd" + i;
      nodes.push({
        id, name: c.name, x: LAYER_X.compound, y,
        symbolSize: fitSize(c.name, 44),
        category: 3,
        itemStyle: { color: TINTS.compound[i % TINTS.compound.length], borderColor: "#fbf8f0", borderWidth: 1.5 },
        label: { fontSize: 13, color: INK, fontWeight: 600 },
        tooltip: { content: esc(c.formula) + "<br>" + esc(c.quote) + "<br>" + esc(c.from) }
      });
      /* 与情感的凝结边：找 carries 里包含的情感名 */
      let linked = false;
      (d.emotions || []).forEach((e, j) => {
        const key = e.emotion.split("（")[0];
        if (!linked && c.carries && c.carries.includes(key)) {
          links.push({
            source: "emo" + j, target: id,
            tag: !labelledCondense ? "凝结" : "",
            lineStyle: { color: C.edgeCompound }
          });
          labelledCondense = true;
          linked = true;
        }
      });
      if (!linked) {
        links.push({ source: "root", target: id, tag: "", lineStyle: { color: C.edgeNeutral } });
      }
    });

    /* 跨媒介层：电影转译 */
    let labelledTrans = false;
    (d.films || []).forEach((f, i, arr) => {
      const y = (i - (arr.length - 1) / 2) * 190;
      const id = "film" + i;
      nodes.push({
        id, name: f.title, x: LAYER_X.film, y,
        symbolSize: [fitSize(f.title, 64), 46],
        category: 4,
        symbol: "roundRect",
        itemStyle: { color: TINTS.film[i % TINTS.film.length], borderColor: "#fbf8f0", borderWidth: 1.5, borderRadius: 8 },
        label: { fontSize: 13, color: INK, fontWeight: 600 },
        tooltip: {
          content: esc(f.title) + "（" + f.year + "·" + esc(f.director) + "）<br>"
            + "情绪：" + esc(f.emotion) + "<br>手法：" + f.mode
        }
      });
      let linked = false;
      (d.compounds || []).forEach((c, j) => {
        if (!linked && f.lineage && (f.lineage.includes(c.name) || (f.scene || "").includes(c.name))) {
          links.push({
            source: "cpd" + j, target: id,
            tag: !labelledTrans ? "转译" : "",
            lineStyle: { color: C.edgeFilm }
          });
          labelledTrans = true;
          linked = true;
        }
      });
      if (!linked) {
        let emoIdx = 0;
        (d.emotions || []).forEach((e, j) => {
          const key = e.emotion.split("（")[0];
          if (f.emotion && f.emotion.includes(key)) emoIdx = j;
        });
        if ((d.emotions || []).length) {
          links.push({
            source: "emo" + emoIdx, target: id,
            tag: !labelledTrans ? "转译" : "",
            lineStyle: { color: C.edgeFilm }
          });
          labelledTrans = true;
        } else {
          links.push({ source: "root", target: id, tag: "", lineStyle: { color: C.edgeNeutral } });
        }
      }
    });

    /* 跨文本层：名著转译 */
    let labelledBook = false;
    (d.books || []).forEach((b, i, arr) => {
      const y = (i - (arr.length - 1) / 2) * 190;
      const id = "book" + i;
      nodes.push({
        id, name: b.title, x: LAYER_X.books, y,
        symbolSize: [fitSize(b.title, 64), 46],
        category: 5,
        symbol: "roundRect",
        itemStyle: { color: TINTS.book[i % TINTS.book.length], borderColor: "#fbf8f0", borderWidth: 1.5, borderRadius: 8 },
        label: { fontSize: 13, color: INK, fontWeight: 600 },
        tooltip: {
          content: esc(b.title) + "（" + esc(b.author) + "）<br>"
            + "情绪：" + esc(b.emotion) + "<br>手法：" + b.mode
        }
      });
      /* 与电影层同构的连线逻辑 */
      let linked = false;
      (d.compounds || []).forEach((c, j) => {
        if (!linked && b.lineage && (b.lineage.includes(c.name) || (b.scene || "").includes(c.name))) {
          links.push({
            source: "cpd" + j, target: id,
            tag: !labelledBook ? "化入" : "",
            lineStyle: { color: C.edgeBook }
          });
          labelledBook = true;
          linked = true;
        }
      });
      if (!linked) {
        let emoIdx = 0;
        (d.emotions || []).forEach((e, j) => {
          const key = e.emotion.split("（")[0];
          if (b.emotion && b.emotion.includes(key)) emoIdx = j;
        });
        if ((d.emotions || []).length) {
          links.push({
            source: "emo" + emoIdx, target: id,
            tag: !labelledBook ? "化入" : "",
            lineStyle: { color: C.edgeBook }
          });
          labelledBook = true;
        } else {
          links.push({ source: "root", target: id, tag: "", lineStyle: { color: C.edgeNeutral } });
        }
      }
    });

    const layerNames = ["本名", "别称（词汇）", "情感", "复合意象", "电影（跨媒介）", "名著（跨文本）"];
    const chart = mount(container);
    chart.setOption({
      backgroundColor: "transparent",
      tooltip: {
        formatter: p => (p.data && p.data.tooltip && p.data.tooltip.content) || p.name,
        backgroundColor: "#fbf8f0", borderColor: "#d9d0bb",
        textStyle: { color: INK, fontFamily: "inherit", fontSize: 13 },
        extraCssText: "max-width:340px;white-space:normal;"
      },
      legend: [{
        data: layerNames, bottom: 10, textStyle: { color: "#6b6154" },
        itemWidth: 14, itemHeight: 10
      }],
      series: [{
        type: "graph", layout: "none", roam: true, draggable: true,
        edgeSymbol: ["none", "arrow"], edgeSymbolSize: 7,
        label: { show: true, color: INK, fontSize: 13 },
        edgeLabel: {
          show: true, fontSize: 12, color: "#8a7f6d",
          formatter: p => (p.data && p.data.tag) || ""
        },
        lineStyle: { color: C.edgeNeutral, width: 1.6, curveness: 0.08, opacity: 0.85 },
        categories: layerNames.map((n, i) => ({
          name: n,
          itemStyle: { color: [C.root, C.alias, C.emotion, C.compound, C.film, "#8A6FA0"][i] }
        })),
        data: nodes,
        links
      }],
      textStyle: { fontFamily: "Noto Serif SC, Source Han Serif SC, serif" }
    });
  }

  /* 文字降级（无 ECharts 或加载失败） */
  function renderChainFallback(container, d) {
    const parts = [];
    parts.push(`<p><b style="color:#9e3d33">${esc(d.name)}</b>（本名）</p>`);
    parts.push("<p><b>异名</b>：" + (d.aliases || []).map(a => esc(a.alias)).join("、") + "</p>");
    parts.push("<p><b>情感</b>：" + (d.emotions || []).map(e => esc(e.emotion)).join("、") + "</p>");
    parts.push("<p><b>复合意象</b>：" + (d.compounds || []).map(c => esc(c.name)).join("、") + "</p>");
    parts.push("<p><b>电影转译</b>：" + ((d.films || []).length ? d.films.map(f => esc(f.title)).join("、") : "—") + "</p>");
    parts.push('<p class="muted">（图表组件加载失败，已切换为文字版生成链）</p>');
    container.innerHTML = '<div class="graph-fallback">' + parts.join("") + '</div>';
  }

  /* ============ 2. 全局意象—情感枢纽网 ============ */
  async function renderGlobal(container, opts) {
    opts = opts || {};
    const showEmotions = opts.showEmotions !== false;
    const linkTypes = opts.linkTypes || { "共现": true, "引申": false, "对写": false };

    let ech;
    try { ech = await ensureECharts(); }
    catch (e) { return renderGlobalFallback(container); }

    /* 度数统计 */
    const degree = {};
    WUSE.imageryLinks.forEach(l => {
      if (!linkTypes[l.type]) return;
      degree[l.a] = (degree[l.a] || 0) + 1;
      degree[l.b] = (degree[l.b] || 0) + 1;
    });

    const nodes = [], links = [];
    const cats = ["天象", "草木", "地理", "动物", "禽鸟", "器物", "建筑"];

    /* 全局网仅展示精选层（收录层条目无完整五层数据，上千节点亦无法布局） */
    (WUSE.curatedNames || IMAGERY_NAMES).forEach(name => {
      const d = WUSE.imagery[name];
      const deg = degree[name] || 0;
      nodes.push({
        id: "i:" + name, name,
        symbolSize: 34 + deg * 5,
        category: Math.max(cats.indexOf(d.category), 0),
        itemStyle: { borderColor: "#fbf8f0", borderWidth: 2 },
        label: { color: INK, fontWeight: 600 },
        tooltip: { content: esc(d.summary) },
        isImagery: true
      });
    });

    if (showEmotions) {
      EMOTION_HUBS.forEach((imgs, emo) => {
        if (imgs.length < 2) return; /* 只显示被两个以上意象共享的情感枢纽 */
        nodes.push({
          id: "e:" + emo, name: emo, symbolSize: 26,
          category: -1, isHub: true,
          itemStyle: { color: C.hubFill, borderColor: C.hubLine, borderWidth: 1.5 },
          label: { fontSize: 12, color: C.hubText },
          tooltip: { content: "共享此情的意象：" + imgs.map(esc).join("、") }
        });
        imgs.forEach(n => links.push({
          source: "i:" + n, target: "e:" + emo,
          lineStyle: { color: C.edgeEmotion, width: 1.2, type: "dashed", opacity: 0.7 }
        }));
      });
    }

    WUSE.imageryLinks.forEach(l => {
      if (!linkTypes[l.type]) return;
      links.push({
        source: "i:" + l.a, target: "i:" + l.b,
        value: l.s,
        label: { show: false, formatter: l.type },
        lineStyle: { width: 0.8 + l.s * 0.9, color: C.edgeNeutral, opacity: 0.8, curveness: 0.12 },
        tooltip: { content: l.type + "（强度 " + l.s + "）<br>" + esc(l.evidence) },
        isImageryLink: true
      });
    });

    const chart = mount(container);
    chart.setOption({
      backgroundColor: "transparent",
      tooltip: {
        formatter: p => {
          if (p.dataType === "edge") return (p.data.tooltip && p.data.tooltip.content) || "";
          return (p.data.tooltip && p.data.tooltip.content) || p.name;
        },
        backgroundColor: "#fbf8f0", borderColor: "#d9d0bb",
        textStyle: { color: INK, fontSize: 13 },
        extraCssText: "max-width:360px;white-space:normal;"
      },
      legend: [{
        data: cats, bottom: 10, selectedMode: "multiple",
        textStyle: { color: "#6b6154" }, itemWidth: 14, itemHeight: 10,
        icon: "circle"
      }],
      series: [{
        type: "graph", layout: "force", roam: true, draggable: true,
        categories: cats.map(c => ({ name: c, itemStyle: { color: PALETTE[c] || "#8A8375" } })),
        force: { repulsion: 380, edgeLength: [60, 150], gravity: 0.09, friction: 0.2 },
        label: { show: true, color: INK, fontSize: 15 },
        edgeSymbol: ["none", "none"],
        emphasis: { focus: "adjacency", lineStyle: { width: 3 } },
        data: nodes,
        links
      }],
      textStyle: { fontFamily: "Noto Serif SC, Source Han Serif SC, serif" }
    });

    chart.off("click");
    chart.on("click", p => {
      if (p.dataType === "node" && p.data.isImagery) {
        location.hash = "#/i/" + encodeURIComponent(p.data.name);
      }
    });
  }

  function renderGlobalFallback(container) {
    const lines = WUSE.imageryLinks.map(l =>
      `<li>${esc(l.a)} —【${l.type}】— ${esc(l.b)}　<span class="muted">${esc(l.evidence)}</span></li>`);
    container.innerHTML =
      '<div class="graph-fallback"><p class="muted">（图表组件加载失败，已切换为文字版关联表）</p>'
      + "<ul>" + lines.join("") + "</ul></div>";
  }

  return { renderChain, renderGlobal, ensureECharts };
})();
