/* ============================================================
 * 物色集 · 应用主逻辑（app.js）
 * 路由：#/ 首页 · #/i/意象 详情 · #/k/关键词 联网检索 · #/net 意象网 · #/about 关于
 * ============================================================ */

(() => {

  "use strict";

  const $ = s => document.querySelector(s);
  const view = $("#view");

  /* ---------- 工具 ---------- */
  const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const highlight = (text, kws) => {
    let out = esc(text);
    kws.filter(Boolean).forEach(kw => {
      out = out.split(esc(kw)).join('<mark>' + esc(kw) + '</mark>');
    });
    return out;
  };

  const BADGE = {
    curated: '<span class="badge badge-curated">内置精选</span>',
    auto: '<span class="badge badge-auto" title="由语料统计生成：词频、共现、原文例句均为程序计数结果">语料收录</span>',
    db: url => `<a class="badge badge-db" href="${url}" target="_blank" rel="noopener" title="查看原始数据文件">chinese-poetry</a>`,
    wiki: url => `<a class="badge badge-wiki" href="${url}" target="_blank" rel="noopener">维基百科</a>`,
    editor: '<span class="badge badge-editor">编者整理</span>'
  };

  /* ---------- 路由 ---------- */
  function navTo(hash) { location.hash = hash; }

  function parseRoute() {
    const h = decodeURIComponent(location.hash || "#/");
    if (h.startsWith("#/i/")) return { page: "detail", name: h.slice(4) };
    if (h.startsWith("#/k/")) return { page: "keyword", kw: h.slice(4) };
    if (h.startsWith("#/season/")) return { page: "season", kw: h.slice("#/season/".length) };
    if (h.startsWith("#/season")) return { page: "season" };
    if (h.startsWith("#/net")) return { page: "net" };
    if (h.startsWith("#/about")) return { page: "about" };
    return { page: "home" };
  }

  function setActiveNav(page) {
    document.querySelectorAll(".site-nav a").forEach(a => {
      a.classList.toggle("active", a.dataset.nav === page || (page === "detail" && a.dataset.nav === "home"));
    });
  }

  window.addEventListener("hashchange", () => render());

  async function render() {
    const route = parseRoute();
    setActiveNav(["net", "about", "season"].includes(route.page) ? route.page : "home");
    if (route.page === "detail" && WUSE.imagery[route.name]) return renderDetail(route.name);
    if (route.page === "keyword") return renderKeyword(route.kw);
    if (route.page === "season") return renderSeason(route.kw || "");
    if (route.page === "net") return renderNet();
    if (route.page === "about") return renderAbout();
    return renderHome();
  }

  /* ---------- 首页 ---------- */
  function renderHome() {
    const curated = WUSE.curatedNames || IMAGERY_NAMES;
    const autoNames = IMAGERY_NAMES.filter(n => WUSE.imagery[n].tier === "auto");
    const aliasCount = IMAGERY_NAMES.reduce((n, k) => n + (WUSE.imagery[k].aliases || []).length, 0);
    const compoundCount = IMAGERY_NAMES.reduce((n, k) => n + (WUSE.imagery[k].compounds || []).length, 0);
    const filmCount = IMAGERY_NAMES.reduce((n, k) => n + (WUSE.imagery[k].films || []).length, 0);
    const bookCount = IMAGERY_NAMES.reduce((n, k) => n + (WUSE.imagery[k].books || []).length, 0);

    const groups = {};
    curated.forEach(n => {
      const c = WUSE.imagery[n].category;
      (groups[c] = groups[c] || []).push(n);
    });

    view.innerHTML = `
      <section class="hero">
        <h1>物色集</h1>
        <p class="subtitle">意象百科 · 意象网</p>
        <p class="origin">
          「物色」出自<strong>《文心雕龙·物色》</strong>：「岁有其物，物有其容；情以物迁，辞以情发。」
          物色正是古代文论中专门讨论自然物象与文学情思关系的篇章；且「物色」今义为搜寻，双关本站之检索。
        </p>
        <p class="thesis">${esc(WUSE.thesis)}</p>
        <div class="layer-strip">
          <div class="layer-cell"><b>物 · 本名</b><span>意象本体</span><span class="arrow">➤</span></div>
          <div class="layer-cell"><b>名 · 别称</b><span>词汇异名</span><span class="arrow">➤</span></div>
          <div class="layer-cell"><b>情 · 承载</b><span>物触发情<span class="arrow">➤</span></span></div>
          <div class="layer-cell"><b>境 · 复合</b><span>情凝结为境<span class="arrow">➤</span></div>
          <div class="layer-cell"><b>译 · 跨媒介</b><span>电影与名著转译</span></div>
        </div>
        <form class="search-box" id="home-search">
          <input type="text" id="search-input" list="search-list" placeholder="输入一个意象，如：雨" autocomplete="off">
          <datalist id="search-list">${IMAGERY_NAMES.map(n => `<option value="${n}">`).join("")}${(WUSE.seasonWords || []).map(w => `<option value="${esc(w.word)}">`).join("")}</datalist>
          <button type="submit">物色</button>
        </form>
        <p class="search-hint">支持任意关键词检索公开诗词库（不限于收录的意象）</p>
      </section>

      <section class="quick-tags">
        <h3>精选意象</h3>
        ${Object.entries(groups).map(([cat, names]) => `
          <div class="tag-group">
            <div class="group-label">〔${esc(cat)}〕</div>
            <div class="tag-cloud">
              ${names.map(n => `<a class="tag" href="#/i/${encodeURIComponent(n)}">${n}</a>`).join("")}
            </div>
          </div>`).join("")}
        <div class="home-stats">
          <span><b>${IMAGERY_NAMES.length}</b>意象</span>
          <span><b>${aliasCount}</b>别称</span>
          <span><b>${compoundCount}</b>复合意象</span>
          <span><b>${filmCount}</b>电影转译</span>
          <span><b>${bookCount}</b>名著转译</span>
        </div>
        ${autoNames.length ? `<p class="auto-note muted">另含「语料收录」层 ${autoNames.length} 个意象——由程序对公开诗词库做词频统计自动生成（原文照录，无 AI 生成内容），在搜索框输入即可查询；首页仅展示编者精选层。</p>` : ""}
      </section>`;

    $("#home-search").addEventListener("submit", e => {
      e.preventDefault();
      const kw = $("#search-input").value.trim();
      if (!kw) return;
      resolveSearch(kw);
    });
  }

  /* 搜索解析：命中意象/别称 → 详情；时节语汇 → 时节专栏；否则 → 关键词检索页 */
  function resolveSearch(kw) {
    if (WUSE.imagery[kw]) return navTo("#/i/" + encodeURIComponent(kw));
    for (const name of IMAGERY_NAMES) {
      const hit = (WUSE.imagery[name].aliases || []).find(a => a.alias === kw);
      if (hit) return navTo("#/i/" + encodeURIComponent(name));
    }
    if ((WUSE.seasonWords || []).some(w => w.word === kw)) {
      return navTo("#/season/" + encodeURIComponent(kw));
    }
    navTo("#/k/" + encodeURIComponent(kw));
  }

  /* ---------- 详情页 ---------- */
  function renderDetail(name) {
    const d = WUSE.imagery[name];
    if (d.tier === "auto") return renderDetailAuto(d);
    const related = WUSE.imageryLinks.filter(l => l.a === name || l.b === name);

    view.innerHTML = `
      <div class="detail-head">
        <div class="watermark">${esc(name)}</div>
        <p class="breadcrumb"><a href="#/">首页</a> / 意象 / ${esc(name)}</p>
        <h1>${esc(name)}</h1>
        <p class="cat">〔${esc(d.category)}〕 ${BADGE.curated}</p>
        <p class="summary">${esc(d.summary)}</p>
      </div>

      <section class="detail-section" id="sec-alias">
        <h2>名 · 异名同实</h2>
        <p class="section-sub">「异名同实，其指一也」——《庄子》。同一个「雨」，古人为它造了许多名字。注意与下文「复合意象」不同：那是意境，这是名字。</p>
        <div class="alias-grid">
          ${(d.aliases || []).map(a => `
            <div class="card alias-card">
              <div class="alias-name">${esc(a.alias)}<span class="kind">${esc(a.kind)}</span></div>
              <p class="note">${esc(a.note)}</p>
              <blockquote>${esc(a.quote)}</blockquote>
              <p class="from">${esc(a.from)} ${BADGE.curated}</p>
            </div>`).join("")}
        </div>
      </section>

      <section class="detail-section" id="sec-emotion">
        <h2>情 · 情感承载</h2>
        <p class="section-sub">「物色之动，心亦摇焉」——外物触发情感。每种情感均有文献例证。</p>
        <div class="emotion-grid">
          ${(d.emotions || []).map(e => `
            <div class="card emotion-card">
              <div class="emotion-name">${esc(e.emotion)}</div>
              <p class="note">${esc(e.note)}</p>
              ${e.evidences.map(v => `
                <div class="evi">${esc(v.quote)}<span class="from">——${esc(v.from)}</span></div>`).join("")}
            </div>`).join("")}
        </div>
      </section>

      <section class="detail-section" id="sec-compound">
        <h2>境 · 复合意象</h2>
        <p class="section-sub">情感反过来为外物命名——意象与情境组合生成的新意境，注明构成公式与所承载之情。</p>
        <div class="compound-grid">
          ${(d.compounds || []).map(c => `
            <div class="card compound-card">
              <div class="compound-name">${esc(c.name)}</div>
              <div><span class="formula">${esc(c.formula)}</span><span class="carries">承载：${esc(c.carries)}</span></div>
              <blockquote>${esc(c.quote)}</blockquote>
              <p class="from">${esc(c.from)}</p>
              <p class="note">${esc(c.note)}</p>
            </div>`).join("")}
        </div>
      </section>

      <section class="detail-section" id="sec-era">
        <h2>历代流变</h2>
        <p class="section-sub">意象含义随时代的迁移。</p>
        <div class="timeline">
          ${(d.eras || []).map(e => `
            <div class="era-item">
              <span class="era-name">${esc(e.era)}</span>
              <div class="era-quote">「${esc(e.quote)}」</div>
              <div class="era-meta">${esc(e.from)}</div>
              ${e.note ? `<div class="era-note">${esc(e.note)}</div>` : ""}
            </div>`).join("")}
        </div>
      </section>

      ${(d.books || []).length ? `
      <section class="detail-section" id="sec-books">
        <h2>书 · 名著中的转译</h2>
        <p class="section-sub">经典文学作品对同一意象的化用——与电影互为镜像，注明情绪功能与古典溯源。</p>
        <div class="film-grid">
          ${d.books.map(b => `
            <div class="card film-card book-card">
              <div class="film-title">《${esc(b.title)}》</div>
              <div class="film-meta">${esc(b.author)} · 手法：${b.mode === "承" ? "承接传统" : b.mode === "反用" ? "反用传统" : "化用传统"} ${BADGE.editor}</div>
              <p class="scene">${esc(b.scene)}</p>
              <p class="emotion-line">情绪功能：<b>${esc(b.emotion)}</b></p>
              <div class="lineage"><b>古典溯源：</b>${esc(b.lineage)}</div>
            </div>`).join("")}
        </div>
      </section>` : ""}

      <section class="detail-section" id="sec-film">
        <h2>译 · 电影中的转译</h2>
        <p class="section-sub">不止罗列「哪些电影里下过雨」——每条注明情绪功能，及其对古典传统是承接、化用还是反用。</p>
        ${(d.films || []).length ? `
          <div class="film-grid">
            ${d.films.map(f => `
              <div class="card film-card">
                <div class="film-title">《${esc(f.title)}》<span class="muted">（${f.year}）</span></div>
                <div class="film-meta">${esc(f.director)} · 手法：${f.mode === "承" ? "承接传统" : f.mode === "反用" ? "反用传统" : f.mode === "化用" ? "化用传统" : "编者析"} ${BADGE.editor}</div>
                <p class="scene">${esc(f.scene)}</p>
                <p class="emotion-line">情绪功能：<b>${esc(f.emotion)}</b></p>
                <div class="lineage"><b>古典溯源：</b>${esc(f.lineage)}</div>
              </div>`).join("")}
          </div>` : `
          <p class="empty-note">编者整理中——本意象的电影转译条目尚未完成，欢迎补充。</p>`}
      </section>

      <section class="detail-section" id="sec-online">
        <h2>联网例证</h2>
        <p class="section-sub">实时检索公开诗词库（chinese-poetry）中含本意象（可选含别称）的原句，原文照录、来源可点。</p>
        <div class="online-panel">
          <div class="online-controls">
            ${SOURCES.CATALOG.map(s => `
              <label><input type="checkbox" value="${s.id}" ${["shijing", "chuci", "lunyu", "caocao", "tang300", "gwgz"].includes(s.id) ? "checked" : ""}>${s.label}</label>`).join("")}
            <label><input type="checkbox" id="incl-alias">含别称</label>
            <button class="run-btn" id="btn-run" type="button">检索</button>
            <button class="run-btn stop-btn hidden" id="btn-stop" type="button">停止</button>
          </div>
          <p class="online-progress" id="online-progress"></p>
          <div id="online-results"></div>
        </div>
      </section>

      <section class="detail-section" id="sec-wiki">
        <h2>百科摘要</h2>
        <p class="section-sub">来自维基百科（如当前网络不可访问则隐藏）。</p>
        <div class="wiki-block card" id="wiki-block"></div>
      </section>

      ${related.length ? `
      <section class="detail-section" id="sec-related">
        <h2>意象关联</h2>
        <p class="section-sub">本意象与其他意象的共现 / 引申 / 对写关系（见「意象网」全局视图）。</p>
        <div class="tag-cloud" style="justify-content:flex-start">
          ${related.map(l => {
            const other = l.a === name ? l.b : l.a;
            return `<a class="tag" href="#/i/${encodeURIComponent(other)}" title="${esc(l.evidence)}">${esc(other)}<span class="muted">〔${l.type}〕</span></a>`;
          }).join("")}
        </div>
      </section>` : ""}

      <section class="detail-section" id="sec-chain">
        <h2>生成链 · 此意象的知识网</h2>
        <p class="section-sub">本名 →(异名) 别称；本名 →(触发) 情感 →(凝结) 复合意象 →(转译) 电影。悬停节点可见出处，可拖拽缩放。</p>
        <div class="chart-box" id="chain-chart"></div>
      </section>`;

    wireOnlineSearch(name);
    wireWiki(d.wiki || d.name);
    GRAPH.renderChain($("#chain-chart"), name).catch(e => {
      $("#chain-chart").innerHTML = '<p class="empty-note">图表加载失败：' + esc(e.message) + '</p>';
    });
  }

  /* ---------- 详情页（语料收录层） ---------- */
  function renderDetailAuto(d) {
    const name = d.name;
    const dynText = Object.entries(d.dynasties || {}).sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${esc(k)} ${v}`).join(" · ");
    const maxHits = Math.max(1, ...(d.emotions || []).map(e => e.hits));
    const kwBreakdown = d.kwFreq ? "　｜　命中：" + Object.entries(d.kwFreq)
      .sort((a, b) => b[1] - a[1]).slice(0, 6)
      .map(([k, v]) => `${esc(k)} ${v}`).join("、") : "";
    const aliasCard = (d.aliases || []).length ? `
      <section class="detail-section" id="sec-alias">
        <h2>名 · 异名同实</h2>
        <p class="section-sub">「异名同实，其指一也」——《庄子》。本条雅称为编者整理，出处随条标注。</p>
        <div class="alias-grid">
          ${(d.aliases || []).map(a => `
            <div class="card alias-card">
              <div class="alias-name">${esc(a.alias)}<span class="kind">${esc(a.kind)}</span></div>
              ${a.note ? `<p class="note">${esc(a.note)}</p>` : ""}
              ${a.quote ? `<blockquote>${esc(a.quote)}</blockquote>` : ""}
              <p class="from">${esc(a.from)}</p>
            </div>`).join("")}
        </div>
      </section>` : "";

    view.innerHTML = `
      <div class="detail-head">
        <div class="watermark">${esc(name)}</div>
        <p class="breadcrumb"><a href="#/">首页</a> / 收录层 / ${esc(name)}</p>
        <h1>${esc(name)}</h1>
        <p class="cat">〔${esc(d.category)}〕 ${BADGE.auto}</p>
        <p class="summary">${esc(d.summary)}</p>
        <p class="muted">语料统计（含别称）：出现 <b>${d.freq}</b> 次 · ${d.authorCount} 位作者${dynText ? `　｜　朝代分布：${dynText}` : ""}${kwBreakdown}</p>
      </div>

      ${aliasCard}

      ${(d.emotions || []).length ? `
      <section class="detail-section" id="sec-emotion">
        <h2>情 · 共现统计</h2>
        <p class="section-sub">含「${esc(name)}」的诗句中，下列情感字的出现频次——程序计数结果，供检索线索而非定论。</p>
        <div class="stat-bars">
          ${d.emotions.map(e => `
            <div class="stat-bar-row">
              <span class="stat-label">${esc(e.emotion)}</span>
              <span class="stat-track"><span class="stat-fill" style="width:${Math.round(e.hits / maxHits * 100)}%"></span></span>
              <span class="stat-num">${e.hits}</span>
            </div>`).join("")}
        </div>
      </section>` : ""}

      <section class="detail-section" id="sec-examples">
        <h2>句 · 语料例证</h2>
        <p class="section-sub">公开诗词库原文照录（每句含「${esc(name)}」），来源可点。</p>
        <div class="result-group">
          ${(d.examples || []).map(ex => {
            const hitKws = ex.kw && ex.kw !== name ? [ex.kw] : [name];
            return `
            <div class="result-item">
              <div class="line">${highlight(ex.line, hitKws)}</div>
              <div class="meta">〔${esc(ex.dynasty)}〕${esc(ex.author)}《${esc(ex.title)}》· ${esc(ex.srcLabel)}${ex.kw && ex.kw !== name ? ` · 命中别称「${esc(ex.kw)}」` : ""}</div>
            </div>`; }).join("") || '<p class="muted">暂无语料命中。</p>'}
        </div>
      </section>

      ${(d.collocates || []).length ? `
      <section class="detail-section" id="sec-co">
        <h2>网 · 同句共现</h2>
        <p class="section-sub">与「${esc(name)}」同句出现最多的意象词（按共现次数排序）。</p>
        <div class="tag-cloud" style="justify-content:flex-start">
          ${d.collocates.map(c => WUSE.imagery[c.name]
            ? `<a class="tag" href="#/i/${encodeURIComponent(c.name)}">${esc(c.name)}<span class="muted">×${c.hits}</span></a>`
            : `<a class="tag" href="#/k/${encodeURIComponent(c.name)}">${esc(c.name)}<span class="muted">×${c.hits}</span></a>`).join("")}
        </div>
      </section>` : ""}`;
  }

  /* ---------- 时节语汇 ---------- */
  function renderSeason(prefillKw) {
    const GROUP_DEFS = [
      { key: "雨泽", hint: "落在正确时节的雨，各有其名", words: ["濯枝雨", "解霜雨", "桃花水", "梅雨", "杏花雨", "木樨蒸"] },
      { key: "风信", hint: "风是季节的信使", words: ["黄雀风", "花信风", "熏风", "青岚", "金风", "朔风"] },
      { key: "节令之日", hint: "被专门命名的一天", words: ["花朝", "竹醉日", "梅熟日", "牡丹时", "春尽日", "潮生日"] },
      { key: "岁时代称", hint: "月份、四季与时节的别名", words: ["太簇", "鸣蜩", "桃浪", "雁来月", "樱笋年光", "橘涂", "岁聿云暮", "小春日和", "青阳·朱明·白藏·玄英", "烟景", "酣春", "东皇", "槐序", "麦秋", "清和", "青女月", "授衣月", "葭月", "杏月·桃月·槐月·榴月·荷月·桂月·菊月"] },
      { key: "日辰时刻", hint: "一天之内的光阴刻度", words: [] } /* 兜底组 */
    ];
    const words = WUSE.seasonWords || [];
    const groupOf = w => (GROUP_DEFS.find(g => g.words.includes(w.word)) || GROUP_DEFS[4]).key;

    view.innerHTML = `
      <div class="detail-head">
        <div class="watermark">时节</div>
        <p class="breadcrumb"><a href="#/">首页</a> / 时节语汇</p>
        <h1>时节语汇</h1>
        <p class="cat">〔岁时 · 物候〕 ${BADGE.curated}</p>
        <p class="summary">古人为「什么时候」造了无数微妙的词：五六月的大雨叫濯枝雨，初夏第一阵微风叫青岚，一年将尽叫岁聿云暮。时间在他们那里不是刻度，是物候与心事的合拍。</p>
      </div>
      <div class="season-filter">
        <input type="text" id="season-input" placeholder="筛选：如 雨 / 暮 / 五月……" autocomplete="off"${prefillKw ? ` value="${esc(prefillKw)}"` : ""}>
      </div>
      <div id="season-body">
        ${GROUP_DEFS.map(g => {
          const items = words.filter(w => groupOf(w) === g.key);
          if (!items.length) return "";
          return `
          <section class="detail-section">
            <h2>${esc(g.key)} <span class="muted" style="font-size:13px;font-weight:400">· ${g.hint}（${items.length}）</span></h2>
            <div class="alias-grid">
              ${items.map(w => `
                <div class="card alias-card season-card" data-kw="${esc(w.word + " " + (w.pinyin || "") + " " + w.gloss)}">
                  <div class="alias-name">${esc(w.word)}${w.pinyin ? `<span class="kind">${esc(w.pinyin)}</span>` : ""}</div>
                  <p class="note">${esc(w.gloss)}</p>
                  ${w.quote ? `<blockquote>${esc(w.quote)}</blockquote>` : ""}
                  <p class="from">${esc(w.from)}${w.link && WUSE.imagery[w.link] ? ` · <a href="#/i/${encodeURIComponent(w.link)}">关联意象「${esc(w.link)}」→</a>` : ""}</p>
                </div>`).join("")}
            </div>
          </section>`;
        }).join("")}
      </div>
      <p class="empty-note hidden" id="season-empty">没有匹配的语汇。</p>`;

    $("#season-input").addEventListener("input", e => applySeasonFilter(e.target.value.trim()));
    if (prefillKw) applySeasonFilter(prefillKw);
  }

  function applySeasonFilter(rawKw) {
    const kw = rawKw.trim().toLowerCase();
    const input = $("#season-input");
    if (!input || !$("#season-body")) return;
    let any = false;
    document.querySelectorAll("#season-body .season-card").forEach(card => {
      const hit = !kw || card.dataset.kw.toLowerCase().includes(kw);
      card.style.display = hit ? "" : "none";
      if (hit) any = true;
    });
    document.querySelectorAll("#season-body .detail-section").forEach(sec => {
      sec.style.display = [...sec.querySelectorAll(".season-card")].some(c => c.style.display !== "none") ? "" : "none";
    });
    $("#season-empty").classList.toggle("hidden", any || !kw);
  }

  /* ---------- 联网检索（详情页与关键词页共用） ---------- */
  function wireOnlineSearch(nameOrKw, mountRoot) {
    mountRoot = mountRoot || view;
    const btnRun = mountRoot.querySelector("#btn-run");
    const btnStop = mountRoot.querySelector("#btn-stop");
    const progress = mountRoot.querySelector("#online-progress");
    const resultsBox = mountRoot.querySelector("#online-results");
    if (!btnRun) return;

    let ctl = null;

    function groupsHTML(groups, kws) {
      return Object.entries(groups).map(([srcLabel, items]) => `
        <div class="result-group">
          <h4>${esc(srcLabel)}（${items.length}）</h4>
          ${items.slice(0, 60).map(r => `
            <div class="result-item">
              <div class="line">${highlight(r.line, kws)}</div>
              <div class="meta">〔${esc(r.dynasty)}〕${esc(r.author)}《${esc(r.title)}》 ${BADGE.db(r.url)}</div>
            </div>`).join("")}
          ${items.length > 60 ? `<p class="muted">……仅显示前 60 条</p>` : ""}
        </div>`).join("");
    }

    btnRun.addEventListener("click", async () => {
      const checked = [...mountRoot.querySelectorAll(".online-controls input[type=checkbox]:checked:not(#incl-alias)")].map(i => i.value);
      if (!checked.length) { progress.textContent = "请至少选择一个数据源。"; return; }

      const inclAlias = mountRoot.querySelector("#incl-alias");
      let kws = [nameOrKw];
      if (inclAlias && inclAlias.checked && WUSE.imagery[nameOrKw]) {
        kws = kws.concat((WUSE.imagery[nameOrKw].aliases || []).map(a => a.alias));
      }

      ctl = new AbortController();
      btnRun.disabled = true;
      btnStop.classList.remove("hidden");
      resultsBox.innerHTML = "";
      progress.textContent = "正在连接数据源……";

      const groups = {};
      try {
        await SOURCES.search(kws, {
          sources: checked,
          signal: ctl.signal,
          limit: 400,
          onBatch: batch => {
            for (const r of batch) (groups[r.srcLabel] = groups[r.srcLabel] || []).push(r);
            resultsBox.innerHTML = groupsHTML(groups, kws);
          },
          onProgress: p => {
            if (p.done) return;
            progress.textContent = `正在检索 ${p.srcLabel}…… 已扫描 ${p.loaded} 卷 · 累计命中 ${p.matched} 句`;
          }
        });
        const total = Object.values(groups).reduce((n, g) => n + g.length, 0);
        progress.textContent = ctl.signal.aborted
          ? `已停止。共命中 ${total} 句。`
          : total ? `检索完成，共命中 ${total} 句。` : "检索完成，未命中——可尝试勾选全唐诗 / 全宋词（需联网等待）。";
      } catch (e) {
        progress.textContent = "检索中断：" + (e.message || e);
      } finally {
        btnRun.disabled = false;
        btnStop.classList.add("hidden");
      }
    });

    btnStop.addEventListener("click", () => { if (ctl) ctl.abort(); });
  }

  /* ---------- 维基百科 ---------- */
  function wireWiki(title) {
    const box = $("#wiki-block");
    if (!box) return;
    box.innerHTML = '<p class="muted">加载中……</p>';
    SOURCES.fetchWiki(title).then(w => {
      box.innerHTML = `
        <p class="extract">${esc(w.extract).slice(0, 600)}${w.extract.length > 600 ? "……" : ""}</p>
        <p style="margin-top:8px">${BADGE.wiki(w.url)} <a href="${w.url}" target="_blank" rel="noopener">阅读完整词条 →</a></p>`;
    }).catch(() => {
      box.innerHTML = '<p class="wiki-fail">当前网络无法访问维基百科（或无此词条），已隐藏。本站其余功能不受影响。</p>';
    });
  }

  /* ---------- 关键词检索页（未收录意象） ---------- */
  function renderKeyword(kw) {
    view.innerHTML = `
      <div class="detail-head">
        <p class="breadcrumb"><a href="#/">首页</a> / 关键词检索</p>
        <h1 style="font-size:32px">${esc(kw)}</h1>
        <p class="cat">该词未收录于内置精选库——以下为公开诗词库的实时检索结果，原文照录。</p>
      </div>
      <section class="detail-section">
        <h2>联网例证</h2>
        <div class="online-panel">
          <div class="online-controls">
            ${SOURCES.CATALOG.map(s => `
              <label><input type="checkbox" value="${s.id}" ${["shijing", "chuci", "lunyu", "caocao", "tang300", "gwgz"].includes(s.id) ? "checked" : ""}>${s.label}</label>`).join("")}
            <button class="run-btn" id="btn-run" type="button">检索</button>
            <button class="run-btn stop-btn hidden" id="btn-stop" type="button">停止</button>
          </div>
          <p class="online-progress" id="online-progress"></p>
          <div id="online-results"></div>
        </div>
      </section>`;
    wireOnlineSearch(kw);
  }

  /* ---------- 意象网 ---------- */
  function renderNet() {
    view.innerHTML = `
      <section class="detail-section">
        <h2>全局意象网</h2>
        <p class="section-sub">意象为节点（大小随连接数），情感为中间枢纽（虚线），实现「雨—〔离愁〕—柳」式的关联；点选意象节点进入详情。</p>
        <div class="net-controls">
          <label><input type="checkbox" id="net-emo" checked>显示情感枢纽</label>
          <label><input type="checkbox" id="net-t-co" checked>共现边</label>
          <label><input type="checkbox" id="net-t-de">引申边</label>
          <label><input type="checkbox" id="net-t-du">对写边</label>
        </div>
        <div class="chart-box tall" id="net-chart"></div>
        <p class="net-hint muted">拖拽可移动节点，滚轮缩放，悬停查看边的文献证据。</p>
      </section>`;

    const draw = () => {
      GRAPH.renderGlobal($("#net-chart"), {
        showEmotions: $("#net-emo").checked,
        linkTypes: {
          "共现": $("#net-t-co").checked,
          "引申": $("#net-t-de").checked,
          "对写": $("#net-t-du").checked
        }
      }).catch(e => {
        $("#net-chart").innerHTML = '<p class="empty-note">图表加载失败：' + esc(e.message) + '</p>';
      });
    };
    ["net-emo", "net-t-co", "net-t-de", "net-t-du"].forEach(id => {
      $("#" + id).addEventListener("change", draw);
    });
    draw();
  }

  /* ---------- 关于 ---------- */
  function renderAbout() {
    view.innerHTML = `
      <div class="about-page">
        <h2>物色集 · 命名</h2>
        <p>「物色」出自《文心雕龙·物色》：「岁有其物，物有其容；情以物迁，辞以情发。」
        物色是古代文论中专门讨论自然物象与文学情思关系的篇章；且「物色」今义为搜寻，双关本站之检索。</p>

        <h2>方法：生成链，而非词条罗列</h2>
        <p>《文心雕龙·物色》又云：「物色之动，心亦摇焉。」外物触发情感，情感又反过来为外物命名、
        组合出新的意境——一层层累积，才有「雨」演化出的「巴山夜雨」「江湖夜雨」。因此本站的每个意象分为四层：</p>
        <ul>
          <li><b>名</b>（词汇层）：同一事物的异名——霖、银竹是雨的「名字」；</li>
          <li><b>情</b>（情感层）：意象承载的情感——离愁、羁旅、乱世、喜雨；</li>
          <li><b>境</b>（复合意象层）：意象与情境组合生成的新意境——「巴山夜雨 = 雨+夜+山 → 思归」是意境而非名字；</li>
          <li><b>译</b>（跨媒介层）：电影对意象的转译，注明情绪功能与古典溯源（承接 / 化用 / 反用）。</li>
        </ul>

        <div class="noai"><b>内容声明</b>：本站内置词条由编者参考公开文献整理，逐条标注原始出处，引文均为真实文献原句（整理过程借助了工具辅助，非纯手工誊录）；联网例证为 chinese-poetry 公开诗词库原文照录；百科摘录来自维基百科。每条内容均有来源徽标可溯源，引文若有讹误欢迎指正。</div>

        <h2>数据来源</h2>
        <ul>
          <li>内置精选库：人工整理（本仓库 js/data.js），出处均标注原始文献；</li>
          <li><a href="https://github.com/chinese-poetry/chinese-poetry" target="_blank" rel="noopener">chinese-poetry</a>（MIT 协议）：诗经、楚辞、论语、曹操诗集、古文观止、唐诗三百首、全唐诗、全宋词，经 raw.githubusercontent.com 及镜像直连；</li>
          <li><a href="https://zh.wikipedia.org" target="_blank" rel="noopener">维基百科</a> REST API（origin=*）。</li>
        </ul>

        <h2>第二阶段（预留）</h2>
        <p>本地代理（server.js）以接入 ctext.org（中华典籍 REST API）等有跨域限制的公开库；
        「设置」中已预留代理地址输入位。</p>
      </div>`;
  }

  /* ---------- 设置弹窗 ---------- */
  function wireSettings() {
    const modal = $("#modal-settings");
    $("#btn-settings").addEventListener("click", async () => {
      modal.classList.remove("hidden");
      $("#cache-status").textContent = "已缓存 " + (await SOURCES.cacheSize()) + " 个数据文件";
    });
    modal.addEventListener("click", e => {
      if (e.target === modal || e.target.classList.contains("modal-close")) modal.classList.add("hidden");
    });
    $("#btn-mirror-test").addEventListener("click", async () => {
      const el = $("#mirror-status");
      el.textContent = "测试中……";
      const rs = await SOURCES.testMirrors();
      el.innerHTML = rs.map(r =>
        `${esc(r.label)}：${r.ok ? "可用（" + r.ms + "ms）" : "不可用"}`).join("<br>")
        + "<br>已自动选择首个可用镜像。";
    });
    $("#btn-cache-clear").addEventListener("click", async () => {
      const n = await SOURCES.clearCache();
      $("#cache-status").textContent = "已清除。当前缓存 " + n + " 个文件。";
    });
    const proxyInput = $("#input-proxy");
    proxyInput.value = localStorage.getItem("wuse-proxy") || "";
    proxyInput.addEventListener("change", () => {
      localStorage.setItem("wuse-proxy", proxyInput.value.trim());
    });
  }

  /* ---------- 启动 ---------- */
  wireSettings();
  render();

})();
