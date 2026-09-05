/* ==========================================================================
   app.js — hash routing, page rendering and interactions.
   Pages render into #main; each render() returns HTML and an optional
   afterRender() hook for wiring events and drawing the chart.
   ========================================================================== */

/* ------------------------------- Icons --------------------------------- */
/* Inline stroke SVGs keep the app dependency-free and let CSS colour them. */

const svg = (paths, extra = "") =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" ${extra}>${paths}</svg>`;

const ICONS = {
  dashboard: svg('<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>'),
  products: svg('<path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/>'),
  stock: svg('<path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/>'),
  orders: svg('<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h3"/>'),
  suppliers: svg('<path d="M3 7h11v9H3z"/><path d="M14 10h4l3 3v3h-7z"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>'),
  reports: svg('<path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>'),
  alerts: svg('<path d="M12 3l9 16H3l9-16z"/><path d="M12 10v4M12 17h.01"/>'),
  box: svg('<path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/>'),
  rupee: svg('<path d="M7 4h10M7 9h10M17 4c0 4-3.5 5-7 5l7 10"/>'),
  down: svg('<path d="M12 5v14M6 13l6 6 6-6"/>'),
  ban: svg('<circle cx="12" cy="12" r="9"/><path d="M6 6l12 12"/>'),
  clock: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  cart: svg('<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.5 12h11L21 7H6"/>'),
  refresh: svg('<path d="M21 12a9 9 0 11-3-6.7L21 8"/><path d="M21 3v5h-5"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  search: svg('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>'),
  download: svg('<path d="M12 3v12M7 11l5 5 5-5"/><path d="M4 21h16"/>'),
  file: svg('<path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z"/><path d="M14 3v5h5"/>'),
  warn: svg('<path d="M12 3l9 16H3l9-16z"/><path d="M12 10v4M12 17h.01"/>'),
  info: svg('<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>'),
  star: svg('<path d="M12 3l2.6 5.6 6 .8-4.4 4.2 1.1 6-5.3-3-5.3 3 1.1-6L3.4 9.4l6-.8L12 3z"/>'),
  arrowUp: svg('<path d="M12 19V5M6 11l6-6 6 6"/>'),
  arrowDown: svg('<path d="M12 5v14M6 13l6 6 6-6"/>'),
  dash: svg('<path d="M5 12h14"/>'),
  check: svg('<circle cx="12" cy="12" r="9"/><path d="M8.5 12.5l2.5 2.5 4.5-5"/>'),
};

const PAGES = [
  { id: "dashboard", label: "Dashboard", icon: "dashboard" },
  { id: "products", label: "Products", icon: "products" },
  { id: "stock", label: "Stock Levels", icon: "stock" },
  { id: "orders", label: "Orders", icon: "orders" },
  { id: "suppliers", label: "Suppliers", icon: "suppliers" },
  { id: "reports", label: "Reports", icon: "reports" },
  { id: "alerts", label: "Alerts", icon: "alerts" },
];

/* ------------------------------- State --------------------------------- */

const state = {
  user: null,
  page: "dashboard",
  products: [],
  orders: [],
  suppliers: [],
  movement: [],
  thresholds: {},
  store: {},
  lastSync: new Date(),
  productSearch: "",
  productCategory: "all",
  productSort: { key: "name", dir: "asc" },
  orderFilter: "All",
  orderSearch: "",
  orderSort: { key: null, dir: "asc" },
  orderLimit: 15,
  loading: true,
  trends: null,
  chartRange: 7,
  reportRows: null,
  chart: null,
};

/* ------------------------------ Helpers -------------------------------- */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const inr = (n) =>
  "₹" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 });

const num = (n) => Number(n).toLocaleString("en-IN");

const fmtDate = (iso) => {
  if (!iso || iso === "—") return "—";
  const d = new Date(iso);
  return isNaN(d) ? iso : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

const fmtTime = (d) =>
  d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", second: "2-digit" });

/** Escape anything that reaches innerHTML from data or user input. */
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/** Permission check for the signed-in role. Every gate goes through this. */
const can = (action) => !!PERMISSIONS[state.user?.role]?.[action];

/** Pages the current role may open. */
const allowedPages = () => PERMISSIONS[state.user?.role]?.pages ?? [];

const STATUS_PILL = {
  "In Stock": "pill-good",
  "Low Stock": "pill-warn",
  "Out of Stock": "pill-crit",
  Delivered: "pill-good",
  Shipped: "pill-info",
  Pending: "pill-warn",
  Cancelled: "pill-crit",
};

const pill = (text, cls) => `<span class="pill ${cls || STATUS_PILL[text] || "pill-neutral"}">${esc(text)}</span>`;

function toast(message) {
  const el = $("#toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove("show"), 2600);
}

/* --------------------------- Derived metrics ---------------------------- */

function metrics() {
  const p = state.products;
  const totalValue = p.reduce((s, x) => s + x.quantity * x.unitPrice, 0);
  const low = p.filter((x) => statusOf(x) === "Low Stock").length;
  const out = p.filter((x) => statusOf(x) === "Out of Stock").length;
  const healthy = p.filter((x) => statusOf(x) === "In Stock").length;
  const pending = state.orders.filter((o) => o.status === "Pending").length;
  const todays = state.orders.filter(
    (o) => o.type === "Sales" && o.date === "2026-09-02" && o.status !== "Cancelled"
  );
  const todaySales = todays.reduce((s, o) => s + o.value, 0);
  return {
    total: p.length,
    totalValue,
    low,
    out,
    healthy,
    pending,
    todaySales,
    // Staff see the count instead of the value — same split as DairyDesk's
    // dashboard, which gives staff todays_order_count but not the money.
    todayOrders: todays.length,
    health: p.length ? Math.round((healthy / p.length) * 100) : 0,
  };
}

/** Ring colour follows the score: green >= 80, amber 50-79, red below 50. */
function healthTone(score) {
  if (score >= 80) return { label: "Healthy", color: "#34d399", pill: "pill-good" };
  if (score >= 50) return { label: "Needs attention", color: "#fbbf24", pill: "pill-warn" };
  return { label: "Critical", color: "#f87171", pill: "pill-crit" };
}

/**
 * Trend chip. The arrow shows direction; the colour shows whether that
 * direction is good for this particular metric (more low-stock items is bad,
 * more orders is good).
 */
function trendChip(trend) {
  if (!trend || trend.delta == null) return "";
  const { delta, period, goodWhen } = trend;
  const dir = delta > 0 ? "up" : delta < 0 ? "down" : "flat";
  const icon = dir === "up" ? ICONS.arrowUp : dir === "down" ? ICONS.arrowDown : ICONS.dash;
  const tone =
    dir === "flat" ? "trend-flat" : (dir === "up") === (goodWhen === "up") ? "trend-good" : "trend-bad";
  const sign = delta > 0 ? "+" : "";
  return `<div class="trend ${tone}">${icon}${sign}${delta} <span class="period">${esc(period)}</span></div>`;
}

/* ---------------------------- Shared markup ----------------------------- */

const head = (title, sub, actions = "") => `
  <div class="page-head">
    <div>
      <h1 class="page-title">${esc(title)}</h1>
      <p class="page-sub">${esc(sub)}</p>
    </div>
    <div class="head-actions">${actions}</div>
  </div>`;

const metricCard = ({ label, value, unit, icon, tone, status, statusCls, trend }) => `
  <div class="metric">
    <div class="blob blob-${tone}"></div>
    <div class="metric-badge badge-${tone}">${ICONS[icon]}</div>
    <div class="metric-label">${esc(label)}</div>
    <div class="metric-value">${value}${unit ? `<span class="unit">${esc(unit)}</span>` : ""}</div>
    ${status ? pill(status, statusCls) : ""}
    ${trendChip(trend)}
  </div>`;

/** Skeleton stand-in for a metric card, same box so nothing shifts on load. */
const skeletonMetric = () => `
  <div class="metric">
    <span class="skel skel-badge"></span>
    <span class="skel skel-line" style="width:58%"></span>
    <span class="skel skel-value"></span>
    <span class="skel skel-pill"></span>
  </div>`;

const skeletonRow = (cols) =>
  `<tr>${Array.from({ length: cols }, () => '<td><span class="skel skel-line" style="margin:0"></span></td>').join("")}</tr>`;

const emptyRow = (cols, title, detail) => `
  <tr><td colspan="${cols}" class="empty">
    <div class="empty-mark">∅</div>
    <div class="empty-title">${esc(title)}</div>
    <div class="empty-detail">${esc(detail)}</div>
  </td></tr>`;

/* ============================== Dashboard =============================== */

/** Loading view — mirrors the real layout so nothing jumps when data lands. */
function skeletonDashboard() {
  return `
    ${head("Store Inventory Overview", "Loading live stock position…", "")}
    <div class="dash-grid">
      <div class="hero">
        <div class="hero-label">Stock Health Score</div>
        <div class="skel-ring"></div>
        <div class="skel skel-line" style="width:50%;margin:0 auto 8px;background:rgba(255,255,255,.12)"></div>
        <div class="skel skel-line" style="width:72%;margin:0 auto;background:rgba(255,255,255,.12)"></div>
      </div>
      <div class="metric-grid">${Array.from({ length: 6 }, skeletonMetric).join("")}</div>
    </div>
    <div class="summary-grid" style="margin-top:16px">
      ${Array.from({ length: 4 }, () => `<div class="card"><span class="skel skel-line" style="width:45%"></span><span class="skel skel-value"></span></div>`).join("")}
    </div>`;
}

function renderDashboard() {
  if (state.loading) return { html: skeletonDashboard() };

  const m = metrics();
  const t = state.trends || {};
  const tone = healthTone(m.health);
  const C = 2 * Math.PI * 76; // ring radius 76

  return {
    html: `
      ${head("Store Inventory Overview", "Live stock position across every category in this store.",
        `<button class="btn btn-primary" data-act="refresh">${ICONS.refresh} Refresh data</button>`)}

      <div class="dash-grid">
        <div class="hero">
          <div class="hero-label">Stock Health Score</div>
          <div class="ring">
            <svg viewBox="0 0 180 180">
              <circle class="ring-track" cx="90" cy="90" r="76"></circle>
              <circle class="ring-fill" cx="90" cy="90" r="76"
                stroke="${tone.color}"
                stroke-dasharray="${(m.health / 100) * C} ${C}"></circle>
            </svg>
            <div class="ring-center">
              <div class="ring-value">${m.health}<span style="font-size:20px">%</span></div>
              <div class="ring-unit">In stock</div>
            </div>
          </div>
          <div class="hero-status">${esc(tone.label)}</div>
          <p class="hero-desc">${m.healthy} of ${m.total} products are above their reorder point.</p>
          <span class="hero-chip">Current status: ${esc(tone.label)}</span>
        </div>

        <div class="metric-grid">
          ${metricCard({
            label: "Total Products", value: num(m.total), unit: "SKUs", icon: "box",
            tone: "blue", status: "Tracked", statusCls: "pill-info", trend: t.totalProducts,
          })}
          ${can("financials")
            ? metricCard({
                label: "Total Stock Value", value: inr(m.totalValue), icon: "rupee",
                tone: "green", status: "Good", statusCls: "pill-good",
              })
            : ""}
          ${metricCard({
            label: "Low Stock Items", value: num(m.low), icon: "down",
            // Badge tint follows the reading, not a fixed hue: amber only when
            // there is actually something low.
            tone: m.low ? "amber" : "green",
            status: m.low ? "Low" : "Good", statusCls: m.low ? "pill-warn" : "pill-good",
            trend: t.low,
          })}
          ${metricCard({
            label: "Out of Stock", value: num(m.out), icon: "ban",
            tone: m.out ? "red" : "green",
            status: m.out ? "Critical" : "Good", statusCls: m.out ? "pill-crit" : "pill-good",
          })}
          ${metricCard({
            label: "Pending Orders", value: num(m.pending), icon: "clock",
            tone: m.pending ? "amber" : "green",
            status: m.pending ? "Awaiting" : "Clear", statusCls: m.pending ? "pill-warn" : "pill-good",
            trend: t.pending,
          })}
          ${can("financials")
            ? metricCard({
                label: "Today's Sales", value: inr(m.todaySales), icon: "cart",
                tone: "blue", status: "Dispatched", statusCls: "pill-info",
              })
            : metricCard({
                label: "Today's Orders", value: num(m.todayOrders), icon: "cart",
                tone: "blue", status: "Dispatched", statusCls: "pill-info", trend: t.todayOrders,
              })}
        </div>
      </div>

      <div class="summary-grid" style="margin-top:16px">
        <div class="card"><div class="summary-label">Store</div><div class="summary-value">${esc(state.store.name || "—")}</div></div>
        <div class="card"><div class="summary-label">Last restock</div><div class="summary-value">${esc(state.store.lastRestock || "—")}</div></div>
        <div class="card"><div class="summary-label">Categories</div><div class="summary-value">${new Set(state.products.map((p) => p.category)).size}</div></div>
        <div class="card"><div class="summary-label">Last updated</div><div class="summary-value">${fmtTime(state.lastSync)}</div></div>
      </div>`,
  };
}

/* =============================== Products =============================== */

function renderProducts() {
  if (state.loading) {
    return {
      html: `
        ${head("Products", "Loading products…", "")}
        <div class="summary-grid-3" style="margin-bottom:16px">${Array.from({ length: 3 }, skeletonMetric).join("")}</div>
        <div class="card"><div class="table-wrap"><table>
          <thead><tr>${["Product Name", "SKU", "Category", "Quantity", "Unit Price", "Total Value", "Status"]
            .map((h) => `<th>${h}</th>`).join("")}</tr></thead>
          <tbody>${Array.from({ length: 8 }, () => skeletonRow(7)).join("")}</tbody>
        </table></div></div>`,
    };
  }

  const categories = [...new Set(state.products.map((p) => p.category))].sort();
  const avg = state.products.length
    ? Math.round(state.products.reduce((s, p) => s + p.quantity, 0) / state.products.length)
    : 0;

  const { key, dir } = state.productSort;
  const term = state.productSearch.trim().toLowerCase();

  const rows = state.products
    .filter((p) => state.productCategory === "all" || p.category === state.productCategory)
    .filter((p) => !term || p.name.toLowerCase().includes(term) || p.sku.toLowerCase().includes(term))
    .sort((a, b) => {
      const val = (p) =>
        key === "total" ? p.quantity * p.unitPrice : key === "status" ? statusOf(p) : p[key];
      const [x, y] = [val(a), val(b)];
      const cmp = typeof x === "number" ? x - y : String(x).localeCompare(String(y));
      return dir === "asc" ? cmp : -cmp;
    });

  const arrow = (k) => (key === k ? `<span class="arrow">${dir === "asc" ? "▲" : "▼"}</span>` : "");
  const th = (k, label, cls = "") =>
    `<th class="sortable ${cls}" data-sort="${k}">${label}${arrow(k)}</th>`;

  return {
    html: `
      ${head("Products", "Every SKU stocked in this store, with live quantity and value.",
        can("addProduct") ? `<button class="btn btn-primary" data-act="add-product">${ICONS.plus} Add Product</button>` : "")}

      <div class="summary-grid-3" style="margin-bottom:16px">
        <div class="metric"><div class="blob blob-blue"></div><div class="metric-badge badge-blue">${ICONS.box}</div>
          <div class="metric-label">Total SKUs</div><div class="metric-value">${state.products.length}</div></div>
        <div class="metric"><div class="blob blob-violet"></div><div class="metric-badge badge-violet">${ICONS.stock}</div>
          <div class="metric-label">Categories</div><div class="metric-value">${categories.length}</div></div>
        <div class="metric"><div class="blob blob-green"></div><div class="metric-badge badge-green">${ICONS.check}</div>
          <div class="metric-label">Avg. Stock Level</div><div class="metric-value">${avg}<span class="unit">units</span></div></div>
      </div>

      <div class="card">
        <div class="row" style="margin-bottom:16px">
          <div class="search">
            ${ICONS.search}
            <input class="input" id="prodSearch" type="search" placeholder="Search by product name or SKU…" value="${esc(state.productSearch)}" />
          </div>
          <select class="select" id="prodCat" style="max-width:200px">
            <option value="all">All categories</option>
            ${categories.map((c) => `<option value="${esc(c)}"${state.productCategory === c ? " selected" : ""}>${esc(c)}</option>`).join("")}
          </select>
        </div>

        <div class="table-wrap">
          <table>
            <thead><tr>
              ${th("name", "Product Name")}
              ${th("sku", "SKU")}
              ${th("category", "Category")}
              ${th("quantity", "Quantity", "right")}
              ${th("unitPrice", "Unit Price", "right")}
              ${th("total", "Total Value", "right")}
              ${th("status", "Status")}
            </tr></thead>
            <tbody>
              ${
                rows.length
                  ? rows.map((p) => `
                    <tr>
                      <td class="td-strong">${esc(p.name)}</td>
                      <td class="num">${esc(p.sku)}</td>
                      <td>${esc(p.category)}</td>
                      <td class="num right">${num(p.quantity)}</td>
                      <td class="num right">${inr(p.unitPrice)}</td>
                      <td class="num right td-strong">${inr(p.quantity * p.unitPrice)}</td>
                      <td>${pill(statusOf(p))}</td>
                    </tr>`).join("")
                  : emptyRow(7, "No products match", "Try a different search term or category.")
              }
            </tbody>
          </table>
        </div>
        <p class="note">Showing ${rows.length} of ${state.products.length} products.</p>
      </div>`,

    after() {
      const search = $("#prodSearch");
      search.addEventListener("input", (e) => {
        state.productSearch = e.target.value;
        rerenderKeepingFocus("#prodSearch");
      });
      $("#prodCat").addEventListener("change", (e) => {
        state.productCategory = e.target.value;
        render();
      });
      $$("th[data-sort]").forEach((el) =>
        el.addEventListener("click", () => {
          const k = el.dataset.sort;
          state.productSort =
            state.productSort.key === k
              ? { key: k, dir: state.productSort.dir === "asc" ? "desc" : "asc" }
              : { key: k, dir: "asc" };
          render();
        })
      );
    },
  };
}

/* ============================= Stock Levels ============================= */

function renderStock() {
  if (state.loading) {
    return {
      html: `
        ${head("Stock Levels", "Loading stock levels…", "")}
        <div class="metric-grid" style="margin-bottom:16px">${Array.from({ length: 6 }, skeletonMetric).join("")}</div>
        <div class="card">
          <span class="skel skel-line" style="width:26%;height:15px"></span>
          <div class="chart-box"><span class="skel" style="width:100%;height:100%;border-radius:10px"></span></div>
        </div>`,
    };
  }

  const cats = {};
  for (const p of state.products) {
    const c = (cats[p.category] ||= { qty: 0, reorder: 0, items: 0, out: 0 });
    c.qty += p.quantity;
    c.reorder += p.reorderPoint;
    c.items += 1;
    if (statusOf(p) === "Out of Stock") c.out += 1;
  }

  const cards = Object.entries(cats)
    .sort((a, b) => b[1].qty - a[1].qty)
    .map(([name, c]) => {
      const ratio = c.reorder ? c.qty / c.reorder : 1;
      const tone = c.qty === 0 ? "red" : ratio < 1 ? "amber" : ratio < 1.5 ? "blue" : "green";
      const label = c.qty === 0 ? "Critical" : ratio < 1 ? "Below reorder" : ratio < 1.5 ? "Near reorder" : "Healthy";
      const cls = tone === "red" ? "pill-crit" : tone === "amber" ? "pill-warn" : tone === "blue" ? "pill-info" : "pill-good";
      const color = { red: "#ef4444", amber: "#f59e0b", blue: "#2563eb", green: "#16a34a" }[tone];
      return `
        <div class="metric">
          <div class="blob blob-${tone}"></div>
          <div class="row" style="justify-content:space-between;align-items:flex-start">
            <div>
              <div class="metric-label">${esc(name)}</div>
              <div class="metric-value">${num(c.qty)}<span class="unit">units</span></div>
            </div>
            ${pill(label, cls)}
          </div>
          <div class="bar"><span style="width:${Math.min(100, ratio * 50).toFixed(1)}%;background:${color}"></span></div>
          <div class="bar-meta"><span>Reorder at ${num(c.reorder)}</span><span>${c.items} SKUs${c.out ? ` · ${c.out} out` : ""}</span></div>
        </div>`;
    })
    .join("");

  return {
    html: `
      ${head("Stock Levels", "Quantity against reorder threshold, by category.",
        `<button class="btn btn-ghost" data-act="refresh">${ICONS.refresh} Refresh</button>`)}

      <div class="metric-grid" style="margin-bottom:16px">${cards}</div>

      <div class="card">
        <div class="row" style="justify-content:space-between;align-items:flex-start">
          <div>
            <h2 class="card-title">Stock movement trend</h2>
            <p class="card-sub">Units received against units dispatched.</p>
          </div>
          <div class="seg" id="rangeSeg">
            <button data-range="7" class="${state.chartRange == 7 ? "active" : ""}">Last 7 days</button>
            <button data-range="30" class="${state.chartRange == 30 ? "active" : ""}">Last 30 days</button>
            <button data-range="all" class="${state.chartRange === "all" ? "active" : ""}">All</button>
          </div>
        </div>
        <div class="chart-box"><canvas id="moveChart"></canvas></div>
      </div>`,

    async after() {
      $$("#rangeSeg button").forEach((b) =>
        b.addEventListener("click", async () => {
          state.chartRange = b.dataset.range === "all" ? "all" : Number(b.dataset.range);
          state.movement = await api.getMovement(state.chartRange);
          render();
        })
      );
      drawChart();
    },
  };
}

function drawChart() {
  const canvas = $("#moveChart");
  if (!canvas || typeof Chart === "undefined") return;
  state.chart?.destroy();

  const rows = state.movement;
  const labels = rows.map((r) =>
    new Date(r.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
  );

  const area = (ctx, hex) => {
    const g = ctx.createLinearGradient(0, 0, 0, 300);
    g.addColorStop(0, hex + "44");
    g.addColorStop(1, hex + "00");
    return g;
  };

  state.chart = new Chart(canvas, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Stock in",
          data: rows.map((r) => r.stockIn),
          borderColor: "#16a34a",
          backgroundColor: (c) => area(c.chart.ctx, "#16a34a"),
          fill: true,
          tension: 0.35,
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 4,
        },
        {
          label: "Stock out",
          data: rows.map((r) => r.stockOut),
          borderColor: "#f59e0b",
          backgroundColor: (c) => area(c.chart.ctx, "#f59e0b"),
          fill: true,
          tension: 0.35,
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: {
          align: "end",
          labels: { usePointStyle: true, pointStyle: "circle", boxWidth: 7, font: { family: "Inter", size: 12 }, color: "#6b7280" },
        },
        tooltip: {
          backgroundColor: "#111827",
          padding: 11,
          cornerRadius: 8,
          titleFont: { family: "Inter", size: 12 },
          bodyFont: { family: "Inter", size: 12 },
          displayColors: true,
        },
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: "#9ca3af", font: { family: "Inter", size: 11 }, maxTicksLimit: 10 } },
        y: { beginAtZero: true, grid: { color: "#f1f2f6" }, border: { display: false }, ticks: { color: "#9ca3af", font: { family: "Inter", size: 11 } } },
      },
    },
  });
}

/* =============================== Orders ================================= */

const ORDER_PAGE_SIZE = 15;

function renderOrders() {
  const STATUSES = ["All", "Pending", "Shipped", "Delivered", "Cancelled"];

  if (state.loading) {
    return {
      html: `
        ${head("Orders", "Loading orders…", "")}
        <div class="card"><div class="table-wrap"><table>
          <thead><tr>${["Order ID", "Date", "Supplier / Customer", "Type", "Items", "Qty", "Value", "Status"]
            .map((h) => `<th>${h}</th>`).join("")}</tr></thead>
          <tbody>${Array.from({ length: 8 }, () => skeletonRow(8)).join("")}</tbody>
        </table></div></div>`,
    };
  }

  const counts = Object.fromEntries(
    STATUSES.map((s) => [s, s === "All" ? state.orders.length : state.orders.filter((o) => o.status === s).length])
  );

  const term = state.orderSearch.trim().toLowerCase();
  const { key, dir } = state.orderSort;

  const matched = state.orders
    .filter((o) => state.orderFilter === "All" || o.status === state.orderFilter)
    .filter((o) => !term || o.id.toLowerCase().includes(term) || o.party.toLowerCase().includes(term))
    .sort((a, b) => {
      if (!key) return 0;
      const val = (o) => (key === "date" ? o.date : o[key]);
      const [x, y] = [val(a), val(b)];
      const cmp = typeof x === "number" ? x - y : String(x).localeCompare(String(y));
      return dir === "asc" ? cmp : -cmp;
    });

  const shown = matched.slice(0, state.orderLimit);
  const remaining = matched.length - shown.length;

  const arrow = (k) => (key === k ? `<span class="sort-arrow">${dir === "asc" ? "▲" : "▼"}</span>` : "");
  const sortTh = (k, label, cls = "") =>
    `<th class="sortable ${cls} ${key === k ? "is-sorted" : ""}" data-osort="${k}">${label}${arrow(k)}</th>`;

  return {
    html: `
      ${head("Orders", "Purchase and sales orders moving through the store.",
        can("addOrder") ? `<button class="btn btn-primary" data-act="add-order">${ICONS.plus} New Order</button>` : "")}

      <div class="tabs" style="margin-bottom:16px" id="orderTabs">
        ${STATUSES.map((s) => `<button class="tab ${state.orderFilter === s ? "active" : ""}" data-status="${s}">${s}<span class="count">${counts[s]}</span></button>`).join("")}
      </div>

      <div class="card">
        <div class="row" style="margin-bottom:16px">
          <div class="search">
            ${ICONS.search}
            <input class="input" id="orderSearch" type="search"
              placeholder="Search by order ID or supplier / customer…" value="${esc(state.orderSearch)}">
          </div>
        </div>

        <div class="table-wrap table-scroll">
          <table>
            <thead class="sticky"><tr>
              <th>Order ID</th>
              ${sortTh("date", "Date")}
              <th>Supplier / Customer</th>
              <th>Type</th>
              <th class="right">Items</th>
              ${sortTh("quantity", "Qty", "right")}
              ${sortTh("value", "Value", "right")}
              <th>Status</th>
            </tr></thead>
            <tbody>
              ${
                shown.length
                  ? shown.map((o, i) => `
                    <tr class="clickable ${i % 2 ? "zebra" : ""}" data-order="${esc(o.id)}" tabindex="0">
                      <td class="td-strong num">${esc(o.id)}</td>
                      <td>${fmtDate(o.date)}</td>
                      <td>${esc(o.party)}</td>
                      <td>${pill(o.type, o.type === "Sales" ? "pill-sales" : "pill-purchase")}</td>
                      <td class="num right">${o.items}</td>
                      <td class="num right">${num(o.quantity)}</td>
                      <td class="num right td-strong">${inr(o.value)}</td>
                      <td>${pill(o.status)}</td>
                    </tr>`).join("")
                  : emptyRow(
                      8,
                      term ? "No orders match your search" : "No orders yet",
                      term ? `Nothing matches “${term}”. Try another ID or name.` : "Create an order to see it listed here."
                    )
              }
            </tbody>
          </table>
        </div>

        ${
          remaining > 0
            ? `<div class="load-more">
                 <button class="btn btn-ghost" data-act="load-more">Load more</button>
                 <span class="count">Showing ${shown.length} of ${matched.length}</span>
               </div>`
            : `<p class="note">Showing ${shown.length} of ${state.orders.length} orders.</p>`
        }
      </div>`,

    after() {
      $$("#orderTabs .tab").forEach((t) =>
        t.addEventListener("click", () => {
          state.orderFilter = t.dataset.status;
          state.orderLimit = ORDER_PAGE_SIZE; // new filter starts at page one
          render();
        })
      );

      $("#orderSearch")?.addEventListener("input", (e) => {
        state.orderSearch = e.target.value;
        state.orderLimit = ORDER_PAGE_SIZE;
        rerenderKeepingFocus("#orderSearch");
      });

      $$("th[data-osort]").forEach((el) =>
        el.addEventListener("click", () => {
          const k = el.dataset.osort;
          state.orderSort =
            state.orderSort.key === k
              ? { key: k, dir: state.orderSort.dir === "asc" ? "desc" : "asc" }
              : { key: k, dir: "asc" };
          render();
        })
      );

      // Rows open the detail modal by click or keyboard.
      $$("tr[data-order]").forEach((tr) => {
        const open = () => openOrderModal(tr.dataset.order);
        tr.addEventListener("click", open);
        tr.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            open();
          }
        });
      });
    },
  };
}

/* ============================== Suppliers =============================== */

const AVATAR_COLORS = ["#2563eb", "#16a34a", "#f59e0b", "#8b5cf6", "#0891b2", "#e11d48"];

function ratingPill(r) {
  const cls = r >= 4.5 ? "pill-good" : r >= 4 ? "pill-info" : r >= 3.5 ? "pill-warn" : "pill-crit";
  const label = r >= 4.5 ? "Excellent" : r >= 4 ? "Good" : r >= 3.5 ? "Average" : "Poor";
  return `<span class="pill ${cls}">${r.toFixed(1)} · ${label}</span>`;
}

function renderSuppliers() {
  if (state.loading) {
    return {
      html: `
        ${head("Suppliers", "Loading suppliers…", "")}
        <div class="supplier-grid">
          ${Array.from({ length: 6 }, () => `
            <div class="card">
              <div class="supplier-top">
                <span class="skel" style="width:40px;height:40px;border-radius:11px"></span>
                <div style="flex:1">
                  <span class="skel skel-line" style="width:70%"></span>
                  <span class="skel skel-line" style="width:45%;margin-bottom:0"></span>
                </div>
              </div>
              <div style="margin-top:16px">
                ${Array.from({ length: 4 }, () => '<span class="skel skel-line"></span>').join("")}
              </div>
              <span class="skel skel-pill" style="width:96px"></span>
            </div>`).join("")}
        </div>`,
    };
  }

  const cards = state.suppliers
    .map((s, i) => `
      <div class="card">
        <div class="supplier-top">
          <div class="avatar" style="background:${AVATAR_COLORS[i % AVATAR_COLORS.length]}">
            ${esc(s.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase())}
          </div>
          <div style="min-width:0">
            <div class="card-title" style="font-size:15px">${esc(s.name)}</div>
            <div class="card-sub">${esc(s.contact)}</div>
          </div>
        </div>
        <div style="margin-top:14px">
          <div class="supplier-meta"><dt>Phone</dt><dd>${esc(s.phone)}</dd></div>
          <div class="supplier-meta"><dt>Email</dt><dd style="font-weight:500">${esc(s.email)}</dd></div>
          <div class="supplier-meta"><dt>Products supplied</dt><dd>${s.productsSupplied}</dd></div>
          <div class="supplier-meta"><dt>Last order</dt><dd>${fmtDate(s.lastOrder)}</dd></div>
        </div>
        <div style="margin-top:14px">${ratingPill(s.rating)}</div>
      </div>`)
    .join("");

  return {
    html: `
      ${head("Suppliers", "Vendors supplying stock to this store.",
        can("addSupplier") ? `<button class="btn btn-primary" data-act="add-supplier">${ICONS.plus} Add Supplier</button>` : "")}
      <div class="supplier-grid">${cards}</div>`,
  };
}

/* =============================== Reports ================================ */

const REPORT_TYPES = {
  "Stock Summary": ["Product", "SKU", "Category", "Quantity", "Unit Price", "Total Value", "Status"],
  Sales: ["Order ID", "Date", "Customer", "Items", "Quantity", "Value", "Status"],
  Purchases: ["Order ID", "Date", "Supplier", "Items", "Quantity", "Value", "Status"],
  Wastage: ["Product", "SKU", "Category", "Quantity", "Reason", "Estimated Loss"],
};

/* Column indexes holding money, so the preview shows ₹ with thousands
   separators like every other page. The CSV keeps raw numbers — a spreadsheet
   needs to sum them. */
const MONEY_COLS = {
  "Stock Summary": [4, 5],
  Sales: [5],
  Purchases: [5],
  Wastage: [5],
};

function buildReport(type, from, to) {
  const within = (d) => (!from || d >= from) && (!to || d <= to);

  if (type === "Stock Summary")
    return state.products.map((p) => [p.name, p.sku, p.category, p.quantity, p.unitPrice, p.quantity * p.unitPrice, statusOf(p)]);

  if (type === "Sales" || type === "Purchases") {
    const want = type === "Sales" ? "Sales" : "Purchase";
    return state.orders
      .filter((o) => o.type === want && within(o.date))
      .map((o) => [o.id, o.date, o.party, o.items, o.quantity, o.value, o.status]);
  }

  // Wastage: expired/damaged stock is not modelled yet, so this derives a
  // plausible view from out-of-stock and low-stock items.
  return state.products
    .filter((p) => statusOf(p) !== "In Stock")
    .map((p) => {
      const lost = p.quantity === 0 ? p.reorderPoint : Math.round(p.reorderPoint - p.quantity);
      return [p.name, p.sku, p.category, Math.max(lost, 0), p.quantity === 0 ? "Stockout" : "Below reorder", Math.max(lost, 0) * p.unitPrice];
    });
}

function renderReports() {
  const type = state.reportRows?.type || "Stock Summary";
  const cols = REPORT_TYPES[type];
  const money = MONEY_COLS[type] ?? [];
  const rows = state.reportRows?.rows;

  return {
    html: `
      ${head("Reports", "Generate a view of your inventory and export it.",
        `<button class="btn btn-ghost" data-act="export-csv" ${rows ? "" : "disabled"}>${ICONS.download} Export CSV</button>
         <button class="btn btn-primary" data-act="generate">${ICONS.file} Generate Report</button>`)}

      <div class="card" style="margin-bottom:16px">
        <h2 class="card-title">Report settings</h2>
        <p class="card-sub">Pick a range and a report type, then generate.</p>
        <div class="form-grid" style="margin-top:18px;grid-template-columns:repeat(4,minmax(0,1fr))">
          <div class="field"><label class="label" for="rFrom">From date</label><input class="input" type="date" id="rFrom" value="${esc(state.reportRows?.from || "2026-08-27")}"></div>
          <div class="field"><label class="label" for="rTo">To date</label><input class="input" type="date" id="rTo" value="${esc(state.reportRows?.to || "2026-09-02")}"></div>
          <div class="field"><label class="label" for="rType">Report type</label>
            <select class="select" id="rType">
              ${Object.keys(REPORT_TYPES).map((t) => `<option${t === type ? " selected" : ""}>${t}</option>`).join("")}
            </select>
          </div>
          <div class="field"><label class="label" for="rName">File name</label><input class="input" id="rName" value="${esc(state.reportRows?.name || "inventory_report")}"></div>
        </div>
      </div>

      <div class="card">
        <div class="row" style="justify-content:space-between">
          <div><h2 class="card-title">Preview</h2><p class="card-sub">${rows ? `${rows.length} rows · ${esc(type)}` : "Nothing generated yet."}</p></div>
          ${rows ? pill("Ready", "pill-good") : pill("Awaiting input", "pill-neutral")}
        </div>
        <div class="table-wrap" style="margin-top:14px">
          <table>
            <thead><tr>${cols.map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead>
            <tbody>
              ${
                rows?.length
                  ? rows.slice(0, 40).map((r) => `<tr>${r.map((cell, i) =>
                      `<td class="${i === 0 ? "td-strong" : "num"}${money.includes(i) ? " right" : ""}">${
                        money.includes(i) ? inr(cell) : esc(cell)
                      }</td>`).join("")}</tr>`).join("")
                  : emptyRow(cols.length, "No report generated", "Choose a type and press Generate Report.")
              }
            </tbody>
          </table>
        </div>
        ${rows?.length > 40 ? `<p class="note">Previewing the first 40 of ${rows.length} rows — the CSV export contains all of them.</p>` : ""}
      </div>`,
  };
}

function csvDownload(name, cols, rows) {
  // Quote every field and double any embedded quotes, per RFC 4180.
  const cell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [cols.map(cell).join(","), ...rows.map((r) => r.map(cell).join(","))].join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name || "report"}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* ================================ Alerts ================================ */

function buildAlerts() {
  const t = state.thresholds;
  const list = [];

  for (const p of state.products) {
    if (p.quantity === 0) {
      list.push({ sev: "Critical", icon: "ban", title: `Out of stock: ${p.name}`, desc: `${p.sku} · reorder point is ${p.reorderPoint} units. Raise a purchase order.` });
    } else if (p.quantity <= t.criticalStock) {
      list.push({ sev: "Critical", icon: "warn", title: `Critically low: ${p.name}`, desc: `Only ${p.quantity} units left, below the critical level of ${t.criticalStock}.` });
    } else if (p.quantity <= p.reorderPoint) {
      list.push({ sev: "Warning", icon: "down", title: `Low stock: ${p.name}`, desc: `${p.quantity} units left against a reorder point of ${p.reorderPoint}.` });
    } else if (p.quantity >= t.overstockLimit) {
      list.push({ sev: "Info", icon: "box", title: `Overstocked: ${p.name}`, desc: `${p.quantity} units held, over the overstock limit of ${t.overstockLimit}.` });
    }
  }

  const pending = state.orders.filter((o) => o.status === "Pending");
  if (pending.length)
    list.push({ sev: "Warning", icon: "clock", title: `${pending.length} order${pending.length > 1 ? "s" : ""} pending`, desc: `Oldest is ${pending[pending.length - 1].id} from ${fmtDate(pending[pending.length - 1].date)}.` });

  list.push({ sev: "Info", icon: "check", title: "Store online", desc: `${state.store.name} is syncing inventory normally.` });

  const rank = { Critical: 0, Warning: 1, Info: 2 };
  return list.sort((a, b) => rank[a.sev] - rank[b.sev]);
}

function renderAlerts() {
  if (state.loading) {
    return {
      html: `
        ${head("Alerts & settings", "Loading alerts…", "")}
        <div class="summary-grid-3" style="margin-bottom:16px">
          ${Array.from({ length: 3 }, () => `<div class="card"><span class="skel skel-line" style="width:50%"></span><span class="skel skel-value"></span></div>`).join("")}
        </div>
        <div class="split">
          <div class="card">${Array.from({ length: 5 }, () => `
            <div class="alert-item alert-info">
              <span class="skel" style="width:32px;height:32px;border-radius:9px"></span>
              <div style="flex:1">
                <span class="skel skel-line" style="width:60%"></span>
                <span class="skel skel-line" style="width:85%;margin-bottom:0"></span>
              </div>
            </div>`).join("")}</div>
          <div class="card">
            <span class="skel skel-line" style="width:40%;height:15px"></span>
            <div class="form-grid" style="margin-top:18px">
              ${Array.from({ length: 4 }, () => `<div><span class="skel skel-line" style="width:60%"></span><span class="skel" style="height:38px"></span></div>`).join("")}
            </div>
          </div>
        </div>`,
    };
  }

  const alerts = buildAlerts();
  const active = alerts.filter((a) => a.sev !== "Info").length;
  const highest = alerts.find((a) => a.sev === "Critical") ? "Critical" : alerts.find((a) => a.sev === "Warning") ? "Warning" : "Info";
  const sevCls = { Critical: "pill-crit", Warning: "pill-warn", Info: "pill-info" };
  const boxCls = { Critical: "alert-crit", Warning: "alert-warn", Info: "alert-info" };
  const t = state.thresholds;

  const fields = [
    ["lowStock", "Low stock threshold", "units"],
    ["reorderPoint", "Reorder point", "units"],
    ["overstockLimit", "Overstock limit", "units"],
    ["criticalStock", "Critical stock level", "units"],
  ];

  return {
    html: `
      ${head("Alerts & settings",
        can("editThresholds")
          ? "Warnings raised from live stock levels, with thresholds you control."
          : "Warnings raised from live stock levels. Thresholds are set by the owner.",
        can("editThresholds") ? `<button class="btn btn-primary" data-act="save-thresholds">Save thresholds</button>` : "")}

      <div class="summary-grid-3" style="margin-bottom:16px">
        <div class="card"><div class="summary-label">Active alerts</div><div class="summary-value" style="font-size:28px">${active}</div></div>
        <div class="card"><div class="summary-label">Highest severity</div><div class="summary-value" style="font-size:28px">${highest}</div></div>
        <div class="card"><div class="summary-label">Last check</div><div class="summary-value" style="font-size:28px">${fmtTime(state.lastSync)}</div></div>
      </div>

      <div class="split">
        <div class="card">
          <h2 class="card-title">Inventory alerts</h2>
          <p class="card-sub">Raised from stock levels, reorder points and order status.</p>
          <div style="margin-top:18px">
            ${alerts.map((a) => `
              <div class="alert-item ${boxCls[a.sev]}">
                <div class="alert-icon" style="color:${a.sev === "Critical" ? "#991b1b" : a.sev === "Warning" ? "#92400e" : "#1e40af"}">${ICONS[a.icon]}</div>
                <div style="flex:1;min-width:0">
                  <div class="alert-title">${esc(a.title)}</div>
                  <div class="alert-desc">${esc(a.desc)}</div>
                </div>
                ${pill(a.sev, sevCls[a.sev])}
              </div>`).join("")}
          </div>
        </div>

        <div class="card">
          <h2 class="card-title">Threshold settings</h2>
          <p class="card-sub">Change the values that decide when an alert appears.</p>
          <div class="form-grid" style="margin-top:18px">
            ${fields.map(([k, label, unit]) => `
              <div class="field">
                <label class="label" for="th-${k}">${label} (${unit})</label>
                <input class="input" type="number" min="0" id="th-${k}" data-th="${k}" value="${t[k]}"
                  ${can("editThresholds") ? "" : "disabled"}>
              </div>`).join("")}
          </div>
          <p class="note">${
            can("editThresholds")
              ? "Thresholds are saved in this browser and applied immediately to the alert list."
              : "Read-only for staff — ask the owner to change these values."
          }</p>
        </div>
      </div>`,
  };
}

/* =============================== Login ================================== */

function renderLogin(error = "") {
  document.body.classList.add("signed-out");
  $("#loginRoot").innerHTML = `
    <div class="login-screen">
      <form class="login-card" id="loginForm">
        <div class="login-brand">
          <div class="brand-mark" aria-hidden="true"></div>
          <div>
            <div class="login-title">DairyDesk</div>
            <div class="login-sub">Store inventory tracker</div>
          </div>
        </div>
        <p class="login-lead">Sign in to continue</p>
        ${error ? `<div class="login-error" role="alert">⚠ ${esc(error)}</div>` : ""}
        <div class="field" style="margin-bottom:14px">
          <label class="label" for="loginUser">Username</label>
          <input class="input" id="loginUser" name="username" autocomplete="username" autofocus required>
        </div>
        <div class="field">
          <label class="label" for="loginPass">Password</label>
          <input class="input" id="loginPass" name="password" type="password" autocomplete="current-password" required>
        </div>
        <button class="btn btn-primary" type="submit" style="width:100%;justify-content:center;margin-top:18px">
          Sign in
        </button>
        <div class="login-hint">
          <div><strong>owner</strong> / owner123 — full access</div>
          <div><strong>staff</strong> / staff123 — no financial reports</div>
        </div>
      </form>
    </div>`;

  $("#loginForm").onsubmit = (e) => {
    e.preventDefault();
    const { username, password } = Object.fromEntries(new FormData(e.target));
    api
      .login(username.trim(), password)
      .then(async (user) => {
        state.user = user;
        $("#loginRoot").innerHTML = "";
        document.body.classList.remove("signed-out");
        if (!allowedPages().includes(state.page)) state.page = "dashboard";
        await loadAndRender();
        toast(`Signed in as ${user.name}`);
      })
      .catch((err) => renderLogin(err.message));
  };
}

function signOut() {
  api.logout();
  state.user = null;
  state.page = "dashboard";
  location.hash = "";
  $("#main").innerHTML = "";
  renderLogin();
}

/* =============================== Modals ================================= */

function openModal({ title, sub, fields, submitLabel, onSubmit }) {
  const root = $("#modalRoot");
  root.innerHTML = `
    <div class="modal-backdrop" id="backdrop">
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
        <div class="modal-head">
          <div>
            <h2 class="card-title" id="modalTitle">${esc(title)}</h2>
            <p class="card-sub">${esc(sub)}</p>
          </div>
          <button class="modal-close" id="modalClose" aria-label="Close">&times;</button>
        </div>
        <form id="modalForm">
          <div class="form-grid">
            ${fields.map((f) => `
              <div class="field ${f.full ? "full" : ""}">
                <label class="label" for="f-${f.name}">${esc(f.label)}</label>
                ${
                  f.type === "select"
                    ? `<select class="select" id="f-${f.name}" name="${f.name}" required>${f.options.map((o) => `<option>${esc(o)}</option>`).join("")}</select>`
                    : `<input class="input" id="f-${f.name}" name="${f.name}" type="${f.type || "text"}" ${f.min !== undefined ? `min="${f.min}"` : ""} ${f.step ? `step="${f.step}"` : ""} placeholder="${esc(f.placeholder || "")}" ${f.required === false ? "" : "required"}>`
                }
              </div>`).join("")}
          </div>
          <div class="modal-actions">
            <button type="button" class="btn btn-ghost" id="modalCancel">Cancel</button>
            <button type="submit" class="btn btn-primary">${esc(submitLabel)}</button>
          </div>
        </form>
      </div>
    </div>`;

  // These are DOM0 handlers, so they must not return a value: returning false
  // from onclick cancels the default action, which would silently stop the
  // submit button from ever submitting the form.
  const close = () => {
    root.innerHTML = "";
  };
  $("#modalClose").onclick = () => close();
  $("#modalCancel").onclick = () => close();
  $("#backdrop").onclick = (e) => {
    if (e.target.id === "backdrop") close();
  };
  document.addEventListener("keydown", function esckey(e) {
    if (e.key === "Escape") {
      close();
      document.removeEventListener("keydown", esckey);
    }
  });

  $("#modalForm").onsubmit = (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    // finally: a failed save must never leave the backdrop blocking the page.
    Promise.resolve(onSubmit(data))
      .catch((err) => toast(err.message || "Could not save"))
      .finally(close);
  };

  $(`#f-${fields[0].name}`)?.focus();
}

/** Read-only order detail with one editable field: the status. */
function openOrderModal(orderId) {
  const o = state.orders.find((x) => x.id === orderId);
  if (!o) return;

  const STATUSES = ["Pending", "Shipped", "Delivered", "Cancelled"];
  const root = $("#modalRoot");
  root.innerHTML = `
    <div class="modal-backdrop" id="backdrop">
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="orderTitle">
        <div class="modal-head">
          <div>
            <h2 class="card-title" id="orderTitle">Order ${esc(o.id)}</h2>
            <p class="card-sub">${esc(o.party)} · ${fmtDate(o.date)}</p>
          </div>
          <button class="modal-close" id="modalClose" aria-label="Close">&times;</button>
        </div>

        <div class="detail-items">
          <div class="label" style="margin-bottom:6px">Items in this order</div>
          <div style="font-size:20px;font-weight:800;letter-spacing:-.02em">
            ${o.items} <span style="font-size:13px;font-weight:600;color:var(--muted)">line items</span>
          </div>
          <div style="font-size:12.5px;color:var(--muted);margin-top:2px">
            ${num(o.quantity)} units in total
          </div>
        </div>

        <dl style="margin:0">
          <div class="detail-row"><dt>Type</dt><dd>${pill(o.type, o.type === "Sales" ? "pill-sales" : "pill-purchase")}</dd></div>
          <div class="detail-row"><dt>Quantity</dt><dd class="num">${num(o.quantity)} units</dd></div>
          <div class="detail-row"><dt>Order value</dt><dd class="num">${inr(o.value)}</dd></div>
          <div class="detail-row"><dt>Current status</dt><dd>${pill(o.status)}</dd></div>
        </dl>

        <div class="field" style="margin-top:18px">
          <label class="label" for="orderStatus">Change status</label>
          <select class="select" id="orderStatus">
            ${STATUSES.map((s) => `<option${s === o.status ? " selected" : ""}>${s}</option>`).join("")}
          </select>
        </div>

        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" id="modalCancel">Close</button>
          <button type="button" class="btn btn-primary" id="saveStatus">Save status</button>
        </div>
      </div>
    </div>`;

  const close = () => {
    root.innerHTML = "";
  };
  $("#modalClose").onclick = () => close();
  $("#modalCancel").onclick = () => close();
  $("#backdrop").onclick = (e) => {
    if (e.target.id === "backdrop") close();
  };
  document.addEventListener("keydown", function esckey(e) {
    if (e.key === "Escape") {
      close();
      document.removeEventListener("keydown", esckey);
    }
  });

  $("#saveStatus").onclick = async () => {
    const next = $("#orderStatus").value;
    if (next === o.status) {
      close();
      return;
    }
    try {
      await api.updateOrderStatus(o.id, next);
      state.orders = await api.getOrders();
      close();
      render();
      toast(`${o.id} marked ${next.toLowerCase()}`);
    } catch (err) {
      toast(err.message || "Could not update the order");
      close();
    }
  };
}

function addProductModal() {
  const categories = [...new Set(state.products.map((p) => p.category))].sort();
  openModal({
    title: "Add product",
    sub: "Create a new SKU in this store's catalogue.",
    submitLabel: "Add product",
    fields: [
      { name: "name", label: "Product name", full: true, placeholder: "e.g. Cheese Slices 100 g" },
      // Heritage item codes are five digits, not the old letter-prefixed SKUs.
      { name: "sku", label: "SKU", placeholder: "73006" },
      { name: "category", label: "Category", type: "select", options: categories },
      { name: "quantity", label: "Quantity", type: "number", min: 0 },
      { name: "unitPrice", label: "Unit price (₹)", type: "number", min: 0, step: "0.01" },
      { name: "reorderPoint", label: "Reorder point", type: "number", min: 0 },
    ],
    async onSubmit(d) {
      await api.addProduct({
        name: d.name,
        sku: d.sku,
        category: d.category,
        quantity: Number(d.quantity),
        unitPrice: Number(d.unitPrice),
        reorderPoint: Number(d.reorderPoint),
      });
      state.products = await api.getProducts();
      render();
      toast(`${d.name} added to inventory`);
    },
  });
}

function addOrderModal() {
  openModal({
    title: "New order",
    sub: "Record a purchase or sales order.",
    submitLabel: "Create order",
    fields: [
      { name: "party", label: "Supplier / customer", full: true, placeholder: "e.g. Sharma Provisions" },
      { name: "type", label: "Order type", type: "select", options: ["Sales", "Purchase"] },
      { name: "status", label: "Status", type: "select", options: ["Pending", "Shipped", "Delivered", "Cancelled"] },
      { name: "items", label: "Line items", type: "number", min: 1 },
      { name: "quantity", label: "Total quantity", type: "number", min: 1 },
      { name: "value", label: "Order value (₹)", type: "number", min: 0 },
      { name: "date", label: "Order date", type: "date" },
    ],
    async onSubmit(d) {
      const prefix = d.type === "Sales" ? "ORD" : "PO";
      const n = state.orders.filter((o) => o.id.startsWith(prefix)).length + 1;
      const order = {
        id: `${prefix}-${(d.type === "Sales" ? 2417 : 1182) + n}`,
        date: d.date,
        party: d.party,
        type: d.type,
        items: Number(d.items),
        quantity: Number(d.quantity),
        value: Number(d.value ?? 0),
        status: d.status,
      };
      await api.addOrder(order);
      state.orders = await api.getOrders();
      render();
      toast(`Order ${order.id} created`);
    },
  });
}

function addSupplierModal() {
  openModal({
    title: "Add supplier",
    sub: "Register a new vendor for this store.",
    submitLabel: "Add supplier",
    fields: [
      { name: "name", label: "Supplier name", full: true, placeholder: "e.g. Green Valley Foods" },
      { name: "contact", label: "Contact person", placeholder: "Full name" },
      { name: "phone", label: "Phone", placeholder: "+91 90000 00000" },
      { name: "email", label: "Email", type: "email", full: true, placeholder: "orders@supplier.in" },
      { name: "productsSupplied", label: "Products supplied", type: "number", min: 0 },
      { name: "rating", label: "Rating (0–5)", type: "number", min: 0, step: "0.1" },
    ],
    async onSubmit(d) {
      await api.addSupplier({
        name: d.name,
        contact: d.contact,
        phone: d.phone,
        email: d.email,
        productsSupplied: Number(d.productsSupplied),
        rating: Math.min(5, Number(d.rating)),
        lastOrder: "—",
      });
      state.suppliers = await api.getSuppliers();
      render();
      toast(`${d.name} added to suppliers`);
    },
  });
}

/* ============================== Rendering =============================== */

const RENDERERS = {
  dashboard: renderDashboard,
  products: renderProducts,
  stock: renderStock,
  orders: renderOrders,
  suppliers: renderSuppliers,
  reports: renderReports,
  alerts: renderAlerts,
};

function renderSidebar() {
  const visible = allowedPages();
  $("#navList").innerHTML = PAGES.filter((p) => visible.includes(p.id))
    .map(
      (p) => `<li><a class="nav-item ${state.page === p.id ? "active" : ""}" href="#/${p.id}">${ICONS[p.icon]}<span>${p.label}</span></a></li>`
    )
    .join("");

  $("#statusStore").textContent = state.store.name || "—";
  $("#statusMeta").innerHTML = `${esc(state.store.code || "")} · ${esc(state.store.city || "")}<br>Last sync ${fmtTime(state.lastSync)}`;

  const u = state.user;
  $("#userBox").innerHTML = u
    ? `<div class="user-row">
         <div class="user-name">${esc(u.username)}<span class="role-chip role-${esc(u.role)}">${esc(u.role)}</span></div>
         <button class="signout" id="signOutBtn" type="button">Log out</button>
       </div>`
    : "";
  $("#signOutBtn")?.addEventListener("click", signOut);
}

function render() {
  // Guard: a role that cannot open this page lands on the dashboard instead.
  if (!allowedPages().includes(state.page)) state.page = "dashboard";
  const page = RENDERERS[state.page] || renderDashboard;
  const out = page();
  const main = $("#main");
  main.innerHTML = out.html;
  renderSidebar();
  bindPageActions();
  out.after?.();
}

/** Re-render without losing the caret in a live-filtering input. */
function rerenderKeepingFocus(selector) {
  const prev = $(selector);
  const pos = prev?.selectionStart;
  render();
  const next = $(selector);
  if (next) {
    next.focus();
    if (pos != null) next.setSelectionRange(pos, pos);
  }
}

function bindPageActions() {
  $$("[data-act]").forEach((el) => {
    el.addEventListener("click", async () => {
      const act = el.dataset.act;

      if (act === "refresh") {
        await loadAndRender();
        toast("Inventory data refreshed");
      }

      if (act === "load-more") {
        state.orderLimit += ORDER_PAGE_SIZE;
        render();
      }
      if (act === "add-product") addProductModal();
      if (act === "add-order") addOrderModal();
      if (act === "add-supplier") addSupplierModal();

      if (act === "generate") {
        const type = $("#rType").value;
        const from = $("#rFrom").value;
        const to = $("#rTo").value;
        const name = $("#rName").value;
        state.reportRows = { type, from, to, name, rows: buildReport(type, from, to) };
        render();
        toast(`${type} report generated — ${state.reportRows.rows.length} rows`);
      }

      if (act === "export-csv") {
        const r = state.reportRows;
        if (!r) return toast("Generate a report first");
        csvDownload(r.name, REPORT_TYPES[r.type], r.rows);
        toast("CSV downloaded");
      }

      if (act === "save-thresholds") {
        const next = { ...state.thresholds };
        $$("[data-th]").forEach((i) => (next[i.dataset.th] = Number(i.value) || 0));
        state.thresholds = await api.saveThresholds(next);
        render();
        toast("Thresholds saved");
      }
    });
  });
}

/* ================================ Boot ================================== */

async function loadAll() {
  const [store, products, orders, suppliers, movement, thresholds, trends] = await Promise.all([
    api.getStore(),
    api.getProducts(),
    api.getOrders(),
    api.getSuppliers(),
    api.getMovement(state.chartRange),
    api.getThresholds(),
    api.getTrends(),
  ]);
  Object.assign(state, {
    store, products, orders, suppliers, movement, thresholds, trends,
    lastSync: new Date(),
  });
}

/** Show skeletons, fetch, then swap in the real view. */
async function loadAndRender() {
  state.loading = true;
  render();
  await loadAll();
  state.loading = false;
  render();
}

function routeFromHash() {
  const id = location.hash.replace("#/", "");
  state.page = RENDERERS[id] ? id : "dashboard";
}

function setupNavDrawer() {
  const sidebar = $("#sidebar");
  const scrim = $("#scrim");
  const toggle = $("#navToggle");
  const setOpen = (open) => {
    sidebar.classList.toggle("open", open);
    scrim.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
  };
  toggle.addEventListener("click", () => setOpen(!sidebar.classList.contains("open")));
  scrim.addEventListener("click", () => setOpen(false));
  window.addEventListener("hashchange", () => setOpen(false));
}

window.addEventListener("hashchange", () => {
  if (!state.user) return; // signed out — the login screen owns the view
  routeFromHash();
  render();
  $("#main").scrollIntoView({ block: "start" });
});

(async function init() {
  setupNavDrawer();
  routeFromHash();

  // Started before the session check so it also ticks after a fresh sign-in.
  setInterval(() => {
    const el = $("#statusMeta");
    if (el && state.user) {
      el.innerHTML = `${esc(state.store.code || "")} · ${esc(state.store.city || "")}<br>Last sync ${fmtTime(state.lastSync)}`;
    }
  }, 1000);

  state.user = api.getSession();
  if (!state.user) {
    renderLogin();
    return;
  }

  await loadAndRender();
})();
