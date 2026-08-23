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
  const PALETTE = {
    "天象": "#9e3d33", "草木": "#4a6b57", "禽鸟": "#8a6d2f",
    "器物": "#54627f", "器物·饮食": "#54627f"
  };

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  /* ============ 1. 单意象生成链 ============ */
  async function renderChain(container, name) {
    const d = WUSE.imagery[name];
    if (!d) return;

    let ech;
    try { ech = await ensureECharts(); }
    catch (e) { return renderChainFallback(container, d); }

    const LAYER_X = { root: 0, alias: -340, emotion: 300, compound: 700, film: 1100 };
    const nodes = [], links = [];

    nodes.push({
      id: "root", name: d.name, x: LAYER_X.root, y: 0, symbolSize: 76,
      category: 0, itemStyle: { color: "#9e3d33" },
      label: { show: true, fontSize: 24, color: "#f7f2e6", fontWeight: "bold" },
      tooltip: { content: "中心意象" }
    });

    /* 词汇层：别称（异名） */
    (d.aliases || []).forEach((a, i, arr) => {
      const y = (i - (arr.length - 1) / 2) * 110;
      const id = "alias" + i;
      nodes.push({
        id, name: a.alias, x: LAYER_X.alias, y, symbolSize: 34, category: 1,
        tooltip: { content: esc(a.quote) + "<br>" + esc(a.from) }
      });
      links.push({ source: "root", target: id, tag: i === 0 ? "异名" : "", lineStyle: { color: "#b7ab93" } });
    });

    /* 情感层 */
    (d.emotions || []).forEach((e, i, arr) => {
      const y = (i - (arr.length - 1) / 2) * 150;
      const id = "emo" + i;
      nodes.push({
        id, name: e.emotion, x: LAYER_X.emotion, y, symbolSize: 46, category: 2,
        itemStyle: { color: "#c08a52" },
        tooltip: { content: e.evidences.map(v => esc(v.quote) + "<br>" + esc(v.from)).join("<br><br>") }
      });
      links.push({ source: "root", target: id, tag: i === 0 ? "触发" : "", lineStyle: { color: "#c08a52" } });
    });

    /* 复合意象层：情感凝结（carries 命中情感即连边） */
    let labelledCondense = false;
    (d.compounds || []).forEach((c, i, arr) => {
      const y = (i - (arr.length - 1) / 2) * 130;
      const id = "cpd" + i;
      nodes.push({
        id, name: c.name, x: LAYER_X.compound, y, symbolSize: 40, category: 3,
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
            lineStyle: { color: "#4a6b57" }
          });
          labelledCondense = true;
          linked = true;
        }
      });
      if (!linked) {
        links.push({ source: "root", target: id, tag: "", lineStyle: { color: "#b7ab93" } });
      }
    });

    /* 跨媒介层：电影转译 */
    let labelledTrans = false;
    (d.films || []).forEach((f, i, arr) => {
      const y = (i - (arr.length - 1) / 2) * 190;
      const id = "film" + i;
      nodes.push({
        id, name: f.title, x: LAYER_X.film, y, symbolSize: 42, category: 4,
        symbol: "roundRect",
        tooltip: {
          content: esc(f.title) + "（" + f.year + "·" + esc(f.director) + "）<br>"
            + "情绪：" + esc(f.emotion) + "<br>手法：" + f.mode
        }
      });
      /* 优先从复合意象连出（lineage/scene 提及其名），否则从情感连出 */
      let linked = false;
      (d.compounds || []).forEach((c, j) => {
        if (!linked && f.lineage && (f.lineage.includes(c.name) || (f.scene || "").includes(c.name))) {
          links.push({
            source: "cpd" + j, target: id,
            tag: !labelledTrans ? "转译" : "",
            lineStyle: { color: "#54627f" }
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
            lineStyle: { color: "#54627f" }
          });
          labelledTrans = true;
        } else {
          links.push({ source: "root", target: id, tag: "", lineStyle: { color: "#54627f" } });
        }
      }
    });

    const layerNames = ["本名", "别称（词汇）", "情感", "复合意象", "电影（跨媒介）"];
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
        lineStyle: { color: "#b7ab93", width: 1.6, curveness: 0.08 },
        categories: layerNames.map((n, i) => ({
          name: n,
          itemStyle: { color: ["#9e3d33", "#6b6154", "#c08a52", "#4a6b57", "#54627f"][i] }
        })),
        data: nodes,
        links
      }]
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
    const cats = ["天象", "草木", "禽鸟", "器物·饮食", "情感枢纽"];

    IMAGERY_NAMES.forEach(name => {
      const d = WUSE.imagery[name];
      const deg = degree[name] || 0;
      nodes.push({
        id: "i:" + name, name,
        symbolSize: 34 + deg * 5,
        category: cats.indexOf(d.category) >= 0 ? cats.indexOf(d.category) : 3,
        tooltip: { content: esc(d.summary) },
        isImagery: true
      });
    });

    if (showEmotions) {
      EMOTION_HUBS.forEach((imgs, emo) => {
        if (imgs.length < 2) return; /* 只显示被两个以上意象共享的情感枢纽 */
        nodes.push({
          id: "e:" + emo, name: emo, symbolSize: 26,
          category: 4, isHub: true,
          itemStyle: { color: "#c9b8a0", borderColor: "#9a8f7e", borderWidth: 1 },
          label: { fontSize: 12, color: "#6b6154" },
          tooltip: { content: "共享此情的意象：" + imgs.map(esc).join("、") }
        });
        imgs.forEach(n => links.push({
          source: "i:" + n, target: "e:" + emo,
          lineStyle: { color: "#cbbfa8", width: 1, type: "dashed" }
        }));
      });
    }

    WUSE.imageryLinks.forEach(l => {
      if (!linkTypes[l.type]) return;
      links.push({
        source: "i:" + l.a, target: "i:" + l.b,
        value: l.s,
        label: { show: false, formatter: l.type },
        lineStyle: { width: 0.8 + l.s * 0.9, color: "#a89a7f" },
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
        textStyle: { color: "#6b6154" }
      }],
      series: [{
        type: "graph", layout: "force", roam: true, draggable: true,
        categories: cats.map(c => ({ name: c, itemStyle: { color: PALETTE[c] || "#54627f" } })),
        force: { repulsion: 320, edgeLength: [60, 140], gravity: 0.08, friction: 0.2 },
        label: { show: true, color: INK, fontSize: 15 },
        edgeSymbol: ["none", "none"],
        emphasis: { focus: "adjacency", lineStyle: { width: 3 } },
        data: nodes, links
      }]
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
