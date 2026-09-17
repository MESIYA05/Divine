///////////////////////////////// loader animation ////////////////////////////////
(function () {
  document.addEventListener('DOMContentLoaded', function () {
    // Count the progress percentage up to 100%
    var pctEl = document.querySelector('.loader-bar-pct');
    if (pctEl) {
      var start = null;
      var dur = 1900;
      var raf = function (t) {
        if (start === null) start = t;
        var p = Math.min(1, (t - start) / dur);
        pctEl.textContent = Math.round(p * 100) + '%';
        if (p < 1) requestAnimationFrame(raf);
      };
      requestAnimationFrame(raf);
    }
  });

  window.addEventListener('load', function () {
    setTimeout(function () {
      document.getElementById('loader').classList.add('hide');
      document.getElementById('dashboard').classList.add('show');
      document.body.classList.add('loaded');
    }, 2000);
  });
})();

// Set the current date dynamically
(function () {
  const dateEl = document.getElementById('currentDate');
  if (dateEl) {
    const now = new Date();
    const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    dateEl.textContent = `${months[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`;
  }
})();

/////////////////////////////////// CONFIG ///////////////////////////////////////
// Exact form/report/field link names as supplied — do not substitute guesses
// for any of these; if a panel comes back empty the fix is to re-check the
// actual Zoho Creator report, not to add more candidate names here.
const ZOHO_APP = "divina-foods";

const REPORTS = {
  products: "Product_Master_Report",
  productionTarget: "Production_Target_Report",
  finishedGoods: "Finished_Goods_Report",
  consumptionEntry: "Consumption_Entry_Report",
  finishedGoodsConsumptions: "Finished_Goods_Cunsumptions_Report", // NEW — subform's own report
  purchaseOrders: "Purchase_Order_Report",
  batches: "All_Batch_Details",
  mainWarehouse: "Main_Warehouse_Stock_Details_Report",
  productionWarehouse: "Production_Stock_Details_Report",
  scrapWarehouse: "Scrap_Warehouse_Stock_Details_Report"
};

// Product_Master
const PRODUCT_FIELDS = {
  id: "ID",                       // built-in Zoho record ID — what every other form's "Product_Master" lookup points to
  productId: "Product_ID",
  name: "Product_Name",
  category: "Product_Category",   // "Finished Goods" / "Raw Materials"
  batchDetails: "Batch_Details",  // embedded Batch_Details subform
  reorderPoint: "Reorder_Point",
  minLevel: "Minimum_Level",
  maxLevel: "Maximum_Level"
};

// Production_Targets (report: Production_Target_Report). Product and Target
// Quantity are NOT on this report — they live on the separate
// Finished_Goods_Report, joined below via Finished_Goods.Production_Target_ID.
const PRODUCTION_TARGET_FIELDS = {
  id: "ID",
  targetId: "Production_Target_ID",
  startDate: "Start_Date",
  endDate: "End_Date",
  status: "Status"
};

// Finished_Goods (report: Finished_Goods_Report) — one row per finished good
// on a production target, joined back to Production_Target_Report by
// Production_Target_ID (a lookup to the Production_Targets record).
const FINISHED_GOODS_FIELDS = {
  productionTargetLookup: "Production_Target_ID",  // lookup -> Production_Targets.ID
  item: "Item",                                     // lookup -> Product_Master.ID
  targetQuantity: "Target_Quantity"
};

// Consumption_Entry (report: Consumption_Entry_Report). Finished_Good is a
// subform of Finished_Goods_Cunsumptions rows; each row's own product field
// is also called Finished_Good (a lookup, resolved against Product_Master).
const CONSUMPTION_FIELDS = {
  id: "ID",
  finishedGood: "Finished_Good"   // subform field on Consumption_Entry: array of Finished_Goods_Cunsumptions rows
};
const FINISHED_GOODS_CONSUMPTIONS_FIELDS = {
  product: "Finished_Good"        // row-level field -> Product_Master (or the product name directly)
};

// Purchase_Order
const PURCHASE_ORDER_FIELDS = { status: "Status" }; // Not Received / Received / Partially Received

// Batch_Details (report: All_Batch_Details). Product_Master is a lookup to
// Product_Master.ID, which is resolved through the existing product cache.
const BATCH_FIELDS = {
  number: "Batch_Number",
  manufacturingDate: "Manufacturing_Date",
  expiryDate: "Expiry_Date",
  productLookup: "Product_Master"
};

// Shared shape for the 3 warehouse-detail forms — all three use identical
// field names (Main_Warehouse_Stock_Details / Production_Stock_Details /
// Scrap_Warehouse_Stock_Details), so one config covers all of them.
const WAREHOUSE_DETAIL_FIELDS = {
  productLookup: "Product_Master",   // lookup -> Product_Master.ID
  warehouse: "Warehouse",            // lookup -> Warehouse_Master.Warehouse_Name (resolved via its own display value)
  stockOnHand: "Stock_On_Hand",
  committedStock: "Committed_Stocks",
  availableStock: "Available_Stocks",
  scrapQuantity: "Scrap_Quantity"
};

// Every status this app actually uses. Kept as the single source of truth so
// legend/colors/counts never drift apart across the different donuts.
const PRODUCTION_STATUS_COLORS = {
  "planned": "#64748B",
  "released": "#6366F1",
  "waiting for stock": "#F59E0B",
  "in progress": "#10B981",
  "completed": "#15803D"
};
const DEFAULT_PRODUCTION_STATUSES = ["Planned", "Waiting for Stock", "Released", "In Progress", "Completed"];
const PURCHASE_ORDER_STATUS_COLORS = {
  "received": "#10B981",
  "partially received": "#F59E0B",
  "not received": "#F43F5E"
};
const FALLBACK_PALETTE = ["#10B981", "#E5A93C", "#6366F1", "#0D9488", "#F97316", "#F43F5E", "#15803D", "#64748B"];

// Resolves a status string to a color, preferring the known maps above
function colorForStatus(status, seenOrder) {
  const key = String(status || "").trim().toLowerCase();
  if (PRODUCTION_STATUS_COLORS[key]) return PRODUCTION_STATUS_COLORS[key];
  if (PURCHASE_ORDER_STATUS_COLORS[key]) return PURCHASE_ORDER_STATUS_COLORS[key];
  const idx = Math.max(0, seenOrder.indexOf(status));
  return FALLBACK_PALETTE[idx % FALLBACK_PALETTE.length];
}

function segmentsByStatus(records, statusOf) {
  const counts = new Map();
  records.forEach(r => {
    const raw = statusOf(r);
    const status = (raw === undefined || raw === null || raw === "") ? "Unspecified" : String(raw);
    counts.set(status, (counts.get(status) || 0) + 1);
  });
  const order = Array.from(counts.keys());
  return order.map(status => ({
    key: status, label: status, count: counts.get(status), color: colorForStatus(status, order)
  }));
}

function fixedProductionStatusSegments(records) {
  const counts = new Map(DEFAULT_PRODUCTION_STATUSES.map(status => [status, 0]));
  records.forEach(record => {
    const raw = displayValue(record.status);
    const status = (raw === undefined || raw === null || String(raw).trim() === "")
      ? "Unspecified" : String(raw).trim();
    const known = DEFAULT_PRODUCTION_STATUSES.find(item => item.toLowerCase() === status.toLowerCase());
    const key = known || status;
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  const order = Array.from(counts.keys());
  return order.map(status => ({
    key: status, label: status, count: counts.get(status), color: colorForStatus(status, order)
  }));
}

///////////////////////// shared/cached fetchers (perf: one call per report) /////////////////////////

window.__zohoReady = (typeof ZOHO !== 'undefined' && ZOHO.CREATOR && typeof ZOHO.CREATOR.init === 'function')
  ? ZOHO.CREATOR.init().catch(err => { console.error('ZOHO.CREATOR.init() failed:', err); })
  : Promise.resolve();

function __delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function zohoGetRecords(reportName, attempt = 1) {
  await window.__zohoReady;
  try {
    const res = await ZOHO.CREATOR.DATA.getRecords({ app_name: ZOHO_APP, report_name: reportName, field_config: "all" });
    return res.data || [];
  } catch (error) {
    if (attempt < 3) {
      await __delay(400 * attempt);
      return zohoGetRecords(reportName, attempt + 1);
    }
    console.error(`Error fetching ${reportName} after ${attempt} attempts:`, error);
    return [];
  }
}

function getProductMaster() {
  if (!window.__productMasterPromise) {
    window.__productMasterPromise = zohoGetRecords(REPORTS.products);
  }
  return window.__productMasterPromise;
}

function getProductById() {
  if (!window.__productByIdPromise) {
    window.__productByIdPromise = getProductMaster().then(products => {
      const map = new Map();
      products.forEach(p => map.set(String(p[PRODUCT_FIELDS.id]), {
        id: p[PRODUCT_FIELDS.id],
        productId: displayValue(p[PRODUCT_FIELDS.productId]),
        name: displayValue(p[PRODUCT_FIELDS.name]),
        category: p[PRODUCT_FIELDS.category],
        reorderPoint: Number(p[PRODUCT_FIELDS.reorderPoint] || 0),
        maxLevel: Number(p[PRODUCT_FIELDS.maxLevel] || 0)
      }));
      return map;
    });
  }
  return window.__productByIdPromise;
}

const __reportCache = {};
function fetchReportCached(reportName) {
  if (!__reportCache[reportName]) {
    __reportCache[reportName] = zohoGetRecords(reportName);
  }
  return __reportCache[reportName];
}

function getProductionTargets() {
  if (!window.__productionTargetsPromise) {
    window.__productionTargetsPromise = (async () => {
      const [targetRows, goodsRows, productById] = await Promise.all([
        fetchReportCached(REPORTS.productionTarget),
        fetchReportCached(REPORTS.finishedGoods),
        getProductById()
      ]);

      const goodsByTargetId = new Map();
      goodsRows.forEach(g => {
        const targetLookup = g[FINISHED_GOODS_FIELDS.productionTargetLookup];
        const targetId = (targetLookup && typeof targetLookup === "object")
          ? String(targetLookup.ID)
          : (targetLookup !== undefined && targetLookup !== null && targetLookup !== "" ? String(targetLookup) : null);
        if (!targetId) return;

        const itemLookup = g[FINISHED_GOODS_FIELDS.item];
        const productIdRaw = (itemLookup && typeof itemLookup === "object") ? itemLookup.ID : null;
        const product = (productIdRaw && productById.has(String(productIdRaw))) ? productById.get(String(productIdRaw)) : null;

        const item = {
          productId: productIdRaw,
          productName: (product && product.name) || displayValue(itemLookup) || "Unknown product",
          targetQty: Number(g[FINISHED_GOODS_FIELDS.targetQuantity] || 0)
        };
        if (!goodsByTargetId.has(targetId)) goodsByTargetId.set(targetId, []);
        goodsByTargetId.get(targetId).push(item);
      });

      return targetRows.map(r => ({
        id: r[PRODUCTION_TARGET_FIELDS.id],
        targetId: r[PRODUCTION_TARGET_FIELDS.targetId],
        startDate: parseZohoDate(r[PRODUCTION_TARGET_FIELDS.startDate]),
        endDate: parseZohoDate(r[PRODUCTION_TARGET_FIELDS.endDate]),
        status: r[PRODUCTION_TARGET_FIELDS.status],
        items: goodsByTargetId.get(String(r[PRODUCTION_TARGET_FIELDS.id])) || []
      }));
    })().catch(error => {
      console.error("Error fetching/joining Production_Target_Report + Finished_Goods_Report:", error);
      return [];
    });
  }
  return window.__productionTargetsPromise;
}

///////////////////////////////// small helpers //////////////////////////////////
function displayValue(v) {
  if (v && typeof v === "object") {
    return v.zc_display_value || v.display_value || v.ID || "";
  }
  return v;
}

function parseZohoDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  const m = String(value).match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})/);
  if (m) {
    const months = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
    const mon = months[m[2]];
    if (mon !== undefined) return new Date(Number(m[3]), mon, Number(m[1]));
  }
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

// -------------------------------------------------------------
// NEW: UPDATED BATCH HEALTH LOGIC 
// -------------------------------------------------------------
function getBatchHealthStatus(batch, productCategory, currentDate = new Date(), expirySoonDays = 2) {
  const category = String(displayValue(productCategory) || "").trim();
  
  const today = new Date(currentDate);
  if (isNaN(today.getTime())) return null;
  today.setHours(0, 0, 0, 0);

  const expiryDate = parseZohoDate(batch[BATCH_FIELDS.expiryDate]);
  if (!expiryDate) return null;
  expiryDate.setHours(0, 0, 0, 0);

  const expirySoonCutoff = new Date(today);
  expirySoonCutoff.setDate(today.getDate() + expirySoonDays);

  if (category === "Finished Goods") {
    const manufacturingDate = parseZohoDate(batch[BATCH_FIELDS.manufacturingDate]);
    if (!manufacturingDate) return null;
    manufacturingDate.setHours(0, 0, 0, 0);

    if (today > expiryDate) return "expired";
    if (expiryDate <= expirySoonCutoff) return "expirySoon";
    if (today >= manufacturingDate && today <= expiryDate) return "healthy";
    
    return null; // Date is before manufacturing date
  } 
  else if (category === "Raw Materials") {
    if (today > expiryDate) return "expired";
    if (expiryDate <= expirySoonCutoff) return "expirySoon";
    return "healthy"; 
  }
  
  return null; // Fallback for unrecognized categories
}

function formatShortDate(d) {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}`;
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  if (typeof value === 'number' && isFinite(value)) {
    animateCount(el, value);
  } else {
    el.textContent = value;
  }
}

function animateCount(el, target, duration = 750) {
  if (!el) return;
  const start = parseFloat(String(el.textContent).replace(/[^0-9.-]/g, '')) || 0;
  if (start === target || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    el.textContent = target.toLocaleString();
    return;
  }
  const startTime = performance.now();
  function tick(now) {
    const p = Math.min((now - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(start + (target - start) * eased).toLocaleString();
    if (p < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}
window.animateCount = animateCount;

////////////////////////// shared "View all" modal //////////////////////////
(function () {
  const overlay = document.getElementById('appModalOverlay');
  const titleEl = document.getElementById('appModalTitle');
  const bodyEl = document.getElementById('appModalBody');
  const closeBtn = document.getElementById('appModalClose');
  if (!overlay || !titleEl || !bodyEl) return;

  function open(title, bodyHtml) {
    titleEl.textContent = title;
    bodyEl.innerHTML = bodyHtml;
    overlay.classList.add('show');
    document.body.classList.add('modal-open');
  }
  function close() {
    overlay.classList.remove('show');
    document.body.classList.remove('modal-open');
  }

  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });

  window.openAppModal = open;
  window.closeAppModal = close;
})();

/////////////////////////////////////// bar chart /////////////////////////////////
(function () {
  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.getElementById('pcpChart');
  const tooltip = document.getElementById('pcpTooltip');
  const wrap = document.getElementById('pcpCanvasWrap');
  const statTotal = document.getElementById('pcpStatTotal');
  const growthTag = document.getElementById('pcpGrowthTag');

  const LEFT = 52, RIGHT = 620, TOP = 16, BOTTOM = 208;

  function niceMax(value) {
    if (value <= 0) return 10;
    const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
    const residual = value / magnitude;
    let step;
    if (residual > 5) step = 10;
    else if (residual > 2) step = 5;
    else if (residual > 1) step = 2;
    else step = 1;
    return step * magnitude;
  }

  function el(tag, attrs) {
    const node = document.createElementNS(svgNS, tag);
    for (const k in attrs) node.setAttribute(k, attrs[k]);
    return node;
  }

  function roundedTopPath(x, y, w, h, r) {
    if (h <= 0) return `M${x},${BOTTOM} L${x + w},${BOTTOM} Z`;
    r = Math.min(r, w / 2, h);
    return `M${x},${y + h} L${x},${y + r} Q${x},${y} ${x + r},${y} ` +
           `L${x + w - r},${y} Q${x + w},${y} ${x + w},${y + r} L${x + w},${y + h} Z`;
  }

  function renderChart(data) {
    if (!svg) return;
    svg.innerHTML = '';
    if (!data.length) return;

    const defs = el('defs');
    const grad = el('linearGradient', { id: 'pcpBarGrad', x1: '0', y1: '0', x2: '0', y2: '1' });
    const stop1 = el('stop', { offset: '0%', 'stop-color': '#10b981' });
    const stop2 = el('stop', { offset: '100%', 'stop-color': '#166534' });
    grad.appendChild(stop1);
    grad.appendChild(stop2);
    defs.appendChild(grad);
    svg.appendChild(defs);

    const maxVal = niceMax(Math.max(...data.map(d => d.value), 0));
    const ticks = 4;

    for (let i = 0; i <= ticks; i++) {
      const val = Math.round((maxVal / ticks) * i);
      const y = BOTTOM - (val / maxVal) * (BOTTOM - TOP);
      svg.appendChild(el('line', {
        x1: LEFT, x2: RIGHT, y1: y, y2: y,
        class: i === 0 ? 'pcp-baseline-line' : 'pcp-grid'
      }));
      const t = el('text', { x: LEFT - 12, y: y + 4, class: 'pcp-ylabel', 'text-anchor': 'end' });
      t.textContent = val.toLocaleString();
      svg.appendChild(t);
    }

    const axisTitle = el('text', {
      x: 16, y: (TOP + BOTTOM) / 2, class: 'pcp-axis-title',
      transform: `rotate(-90, 16, ${(TOP + BOTTOM) / 2})`, 'text-anchor': 'middle'
    });
    axisTitle.textContent = 'Production order count';
    svg.appendChild(axisTitle);

    const n = data.length;
    const slot = (RIGHT - LEFT) / n;
    const barW = Math.min(34, slot * 0.5);

    data.forEach((d, i) => {
      const x = LEFT + slot * i + (slot - barW) / 2;
      const barH = (d.value / maxVal) * (BOTTOM - TOP);
      const y = BOTTOM - barH;

      const bar = el('path', {
        d: roundedTopPath(x, y, barW, barH, 6),
        class: 'pcp-bar',
        style: `transition-delay:${i * 35}ms`
      });
      bar.addEventListener('mouseenter', e => showTooltip(e, d));
      bar.addEventListener('mousemove', moveTooltip);
      bar.addEventListener('mouseleave', hideTooltip);
      svg.appendChild(bar);

      const xl = el('text', { x: x + barW / 2, y: BOTTOM + 22, class: 'pcp-xlabel', 'text-anchor': 'middle' });
      xl.textContent = d.label;
      svg.appendChild(xl);
    });

    requestAnimationFrame(() => {
      svg.querySelectorAll('.pcp-bar').forEach(b => b.classList.add('pcp-bar-in'));
    });

    updateStats(data);
  }

  function updateStats(data) {
    const total = data.reduce((s, d) => s + d.value, 0);
    if (statTotal) window.animateCount(statTotal, total);

    if (growthTag) {
      const first = data[0].value, last = data[data.length - 1].value;
      const growth = first === 0 ? 0 : ((last - first) / first) * 100;
      const up = growth >= 0;
      growthTag.textContent = `${up ? '▲' : '▼'} ${Math.abs(growth).toFixed(1)}% growth`;
      growthTag.classList.toggle('pcp-growth-down', !up);
    }
  }

  function showTooltip(e, d) {
    if (!tooltip) return;
    tooltip.textContent = `${d.label}: ${d.value.toLocaleString()} orders`;
    tooltip.style.opacity = '1';
    moveTooltip(e);
  }
  function moveTooltip(e) {
    if (!tooltip || !wrap) return;
    const rect = wrap.getBoundingClientRect();
    tooltip.style.left = (e.clientX - rect.left + 12) + 'px';
    tooltip.style.top = (e.clientY - rect.top - 12) + 'px';
  }
  function hideTooltip() { if (tooltip) tooltip.style.opacity = '0'; }

  function groupByMonth(records) {
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const counts = new Array(12).fill(0);
    records.forEach(r => { if (r.date) counts[r.date.getMonth()]++; });
    return months.map((label, i) => ({ label, value: counts[i] }));
  }

  function groupByWeekOfCurrentMonth(records) {
    const now = new Date();
    const inMonth = records.filter(r => r.date &&
      r.date.getMonth() === now.getMonth() && r.date.getFullYear() === now.getFullYear());
    const weeks = [0, 0, 0, 0, 0];
    inMonth.forEach(r => {
      const wk = Math.min(4, Math.floor((r.date.getDate() - 1) / 7));
      weeks[wk]++;
    });
    const trimmed = weeks[4] === 0 ? weeks.slice(0, 4) : weeks;
    return trimmed.map((v, i) => ({ label: `W${i + 1}`, value: v }));
  }

  window.__productionRecords = [];

  document.querySelectorAll('#productionTargetPills .pcp-pill').forEach(p => {
    p.addEventListener('click', () => {
      document.querySelectorAll('#productionTargetPills .pcp-pill').forEach(x => x.classList.remove('active'));
      p.classList.add('active');
      renderChart(p.dataset.period === 'month'
        ? groupByWeekOfCurrentMonth(window.__productionRecords)
        : groupByMonth(window.__productionRecords));
    });
  });

  window.renderProductionChart = function (records) {
    window.__productionRecords = records;
    renderChart(groupByMonth(records));
    window.dispatchEvent(new CustomEvent('production-records-ready', { detail: records }));
  };
})();

////////////////////////// shared donut renderer (used by all donuts) //////////////////////////
(function () {
  const svgNS = "http://www.w3.org/2000/svg";

  function renderDonut({ svgId, totalId, legendId, segments, size = 180, r = 68, strokeW = 22 }) {
    const total = segments.reduce((s, seg) => s + seg.count, 0);
    const svg = document.getElementById(svgId);
    if (!svg) return;
    svg.innerHTML = '';
    const cx = size / 2, cy = size / 2;
    const circumference = 2 * Math.PI * r;
    let offsetAcc = 0;

    const defs = document.createElementNS(svgNS, 'defs');
    segments.forEach((seg, index) => {
      const gradient = document.createElementNS(svgNS, 'linearGradient');
      gradient.setAttribute('id', `${svgId}-gradient-${index}`);
      gradient.setAttribute('x1', '0%'); gradient.setAttribute('y1', '0%');
      gradient.setAttribute('x2', '100%'); gradient.setAttribute('y2', '100%');
      const start = document.createElementNS(svgNS, 'stop');
      start.setAttribute('offset', '0%'); start.setAttribute('stop-color', seg.color);
      const end = document.createElementNS(svgNS, 'stop');
      end.setAttribute('offset', '100%'); end.setAttribute('stop-color', seg.color); end.setAttribute('stop-opacity', '.62');
      gradient.append(start, end); defs.appendChild(gradient);
    });
    svg.appendChild(defs);
    const track = document.createElementNS(svgNS, 'circle');
    track.setAttribute('cx', cx); track.setAttribute('cy', cy); track.setAttribute('r', r);
    track.setAttribute('fill', 'none'); track.setAttribute('stroke', 'rgba(18, 57, 96, .10)');
    track.setAttribute('stroke-width', strokeW); svg.appendChild(track);

    segments.forEach(seg => {
      if (seg.count === 0) return;
      const gap = Math.min(8, circumference * .025);
      const dash = Math.max((seg.count / total) * circumference - gap, 0);
      const circle = document.createElementNS(svgNS, 'circle');
      circle.setAttribute('cx', cx);
      circle.setAttribute('cy', cy);
      circle.setAttribute('r', r);
      circle.setAttribute('fill', 'none');
      circle.setAttribute('stroke', `url(#${svgId}-gradient-${segments.indexOf(seg)})`);
      circle.setAttribute('stroke-width', strokeW);
      circle.setAttribute('stroke-dasharray', `${dash} ${circumference - dash}`);
      circle.setAttribute('stroke-dashoffset', String(-offsetAcc));
      circle.setAttribute('transform', `rotate(-90 ${cx} ${cy})`);
      circle.dataset.key = seg.key;
      svg.appendChild(circle);
      offsetAcc += dash + gap;
    });

    const totalEl = document.getElementById(totalId);
    if (totalEl) window.animateCount(totalEl, total);

    const legend = document.getElementById(legendId);
    if (legend) {
      legend.innerHTML = '';
      legend.className = 'po-chip-legend pcp-po-legend';
      segments.forEach(seg => {
        const pct = total ? Math.round((seg.count / total) * 100) : 0;
        const item = document.createElement('div');
        item.className = 'po-chip';
        item.dataset.key = seg.key;
        item.innerHTML =
          `<span class="po-chip-bar" style="background:linear-gradient(180deg,${seg.color},rgba(255,255,255,.45))"></span>` +
          `<div class="po-chip-body"><span class="po-chip-label">${seg.label}</span>` +
          `<span class="po-chip-pct">${pct}% of total</span></div>` +
          `<span class="po-chip-count">${seg.count}</span>`;
        item.addEventListener('mouseenter', () => {
          svg.querySelectorAll('circle').forEach(c => {
            c.classList.toggle('seg-highlight', c.dataset.key === seg.key);
            c.classList.toggle('seg-dim', c.dataset.key !== seg.key);
          });
        });
        item.addEventListener('mouseleave', () => {
          svg.querySelectorAll('circle').forEach(c => c.classList.remove('seg-highlight', 'seg-dim'));
        });
        legend.appendChild(item);
      });
    }
  }

  window.renderDonut = renderDonut;
})();

////////////////////////// products (stock + category donuts + list) //////////////////////////
(function () {
  let currentFilter = 'all';

  function computeStockSegments(products) {
    const low = products.filter(p => p.reorder > p.stock).length;
    const ok = products.length - low;
    return [
      { key: 'low', label: 'Low Stock', color: '#F43F5E', count: low },
      { key: 'ok', label: 'In Stock', color: '#10B981', count: ok }
    ];
  }

  function computeCategorySegments(products) {
    const raw = products.filter(p => p.category === 'Raw Materials').length;
    const finished = products.filter(p => p.category === 'Finished Goods').length;
    return [
      { key: 'raw', label: 'Raw Materials', color: '#0D9488', count: raw },
      { key: 'finished', label: 'Finished Goods', color: '#10B981', count: finished }
    ];
  }

  function categoryIcon(category) {
    return category === 'Raw Materials' ? '🌿' : '📦';
  }

  function renderProductList(products) {
    const list = document.getElementById('productList');
    const countBadge = document.getElementById('productsCountBadge');
    if (!list) return;
    list.innerHTML = '';

    if (!products.length) {
      list.innerHTML = `<div class="wh-empty-row" style="padding:20px 0;text-align:center;color:var(--text-muted);">No data available</div>`;
      if (countBadge) countBadge.textContent = '0 items';
      return;
    }

    const filtered = products
      .slice()
      .sort((a, b) => (a.reorder > a.stock) === (b.reorder > b.stock) ? 0 : (a.reorder > a.stock ? -1 : 1))
      .filter(p => {
        if (currentFilter === 'all') return true;
        if (currentFilter === 'low') return p.reorder > p.stock;
        return p.category === currentFilter;
      });

    filtered.forEach(p => {
      const low = p.reorder > p.stock;
      const row = document.createElement('div');
      row.className = 'product-row';
      row.innerHTML =
        `<span class="product-row-icon">${categoryIcon(p.category)}</span>` +
        `<div class="product-row-info">` +
          `<span class="product-row-name">${p.name}</span>` +
          `<span class="product-row-cat">${p.category}</span>` +
        `</div>` +
        `<div class="product-row-stock">` +
          `<span class="product-row-status ${low ? 'low' : 'ok'}">${low ? 'Low stock' : 'In stock'}</span>` +
        `</div>`;
      list.appendChild(row);
    });

    if (countBadge) countBadge.textContent = `${filtered.length} of ${products.length} items`;
  }

  document.querySelectorAll('#productFilters .pcp-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('#productFilters .pcp-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      currentFilter = pill.dataset.filter;
      renderProductList(window.__allProducts || []);
    });
  });

  function refreshFromProducts(products) {
    window.__allProducts = products;

    const stockSegments = computeStockSegments(products);
    window.renderDonut({ svgId: 'stockDonutSvg', totalId: 'stockDonutTotal', legendId: 'stockLegend', segments: stockSegments });
    const lowCount = stockSegments.find(s => s.key === 'low').count;
    setText('stockBadge', lowCount + ' low stock');
    setText('lowstock', lowCount);

    window.renderDonut({ svgId: 'catDonutSvg', totalId: 'catDonutTotal', legendId: 'catLegend', segments: computeCategorySegments(products) });
    setText('catBadge', products.length + ' products tracked');

    setText('products', products.length);
    setText('finished', products.filter(p => p.category === 'Finished Goods').length);
    setText('raw', products.filter(p => p.category === 'Raw Materials').length);

    renderProductList(products);
  }

  window.refreshFromProducts = refreshFromProducts;

  async function fetchAllProducts() {
    try {
      const [records, stockRows] = await Promise.all([
        getProductMaster(),
        fetchReportCached(REPORTS.mainWarehouse)
      ]);

      const stockByProductId = new Map();
      stockRows.forEach(row => {
        const lookup = row[WAREHOUSE_DETAIL_FIELDS.productLookup];
        const id = (lookup && typeof lookup === "object") ? String(lookup.ID) : null;
        if (!id) return;
        const onHand = Number(row[WAREHOUSE_DETAIL_FIELDS.stockOnHand] || 0);
        stockByProductId.set(id, (stockByProductId.get(id) || 0) + onHand);
      });

      return records.map(record => ({
        sku: record[PRODUCT_FIELDS.id],
        name: displayValue(record[PRODUCT_FIELDS.name]),
        category: record[PRODUCT_FIELDS.category],
        stock: stockByProductId.get(String(record[PRODUCT_FIELDS.id])) || 0,
        reorder: Number(record[PRODUCT_FIELDS.reorderPoint] || 0)
      }));
    } catch (error) {
      console.error("Error fetching products:", error);
      return [];
    }
  }

  (async function initProducts() {
    const products = await fetchAllProducts();
    refreshFromProducts(products);
  })();
})();

////////////////////////// production target report: chart + status donut + tables //////////////////////////
(function () {
  function renderStatusDonut(targetLevelRecords) {
    const segments = fixedProductionStatusSegments(targetLevelRecords);
    const totalEl = document.getElementById('totalpt');
    window.renderDonut({
      svgId: 'statusDonutSvg', totalId: 'totalpt', legendId: 'statusLegend',
      size: 200, r: 78, strokeW: 30, segments
    });

    const countOf = status => segments.find(s => s.key.toLowerCase() === status.toLowerCase())?.count || 0;
    setText('planned', countOf('Planned'));
    setText('released', countOf('Released'));
    setText('waitingforstock', countOf('Waiting for Stock'));
    setText('inpro', countOf('In Progress'));
    setText('completed', countOf('Completed'));
    setText('inprogress', countOf('In Progress'));
    setText('ctarget', countOf('Completed'));
  }

  function statusPillHtml(status) {
    const label = status || 'Unspecified';
    const color = colorForStatus(label, [label]);
    return `<span class="status-pill" style="color:${color};background:${color}1c;">${label}</span>`;
  }

  function productionTargetRowHtml(r, i) {
    return `
      <tr>
        <td class="rank">${i + 1}</td>
        <td class="name-cell"><span class="prod-icon">📦</span><span class="prod-name-text">${r.product}</span></td>
        <td>${r.date ? formatShortDate(r.date) : '—'}</td>
        <td class="amount">${r.target.toLocaleString()} units</td>
        <td>${statusPillHtml(r.status)}</td>
      </tr>`;
  }

  function renderProductionTargetTable(itemLevelRecords) {
    const tbody = document.getElementById('ptbody');
    if (!tbody) return;
    const today = new Date(); today.setHours(0, 0, 0, 0);

    const upcoming = itemLevelRecords
      .filter(r => r.date && r.date >= today)
      .sort((a, b) => a.date - b.date)
      .slice(0, 5);

    if (!upcoming.length) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:20px 0;">No data available</td></tr>`;
    } else {
      tbody.innerHTML = upcoming.map(productionTargetRowHtml).join('');
    }

    window.__productionTargetItemLevel = itemLevelRecords;
  }

  const ptViewAllBtn = document.getElementById('ptViewAllBtn');
  if (ptViewAllBtn) {
    ptViewAllBtn.addEventListener('click', () => {
      const records = (window.__productionTargetItemLevel || [])
        .slice()
        .sort((a, b) => (b.date || 0) - (a.date || 0));

      const bodyHtml = !records.length
        ? `<div class="app-modal-empty">No data available</div>`
        : `<table>
             <thead><tr><th class="col-rank">#</th><th>Product</th><th class="col-date">Production date</th><th class="col-num">Target Quantity</th><th class="col-status">Status</th></tr></thead>
             <tbody>${records.map(productionTargetRowHtml).join('')}</tbody>
           </table>`;

      window.openAppModal(`Production Target · ${records.length} record${records.length === 1 ? '' : 's'}`, bodyHtml);
    });
  }

  (async function initProduction() {
    const targets = await getProductionTargets();

    const targetLevel = targets.map(t => ({
      date: t.startDate,
      target: t.items.reduce((sum, item) => sum + item.targetQty, 0),
      status: t.status
    }));

    const itemLevel = [];
    targets.forEach(t => {
      const rows = t.items.length ? t.items : [{ productName: null, targetQty: 0 }];
      rows.forEach(item => {
        if (!item.productName) return; 
        itemLevel.push({ date: t.startDate, product: item.productName, target: item.targetQty, status: t.status });
      });
    });

    setText('production', targets.length);

    window.renderProductionChart(targetLevel);
    renderStatusDonut(targetLevel);
    renderProductionTargetTable(itemLevel);
  })();
})();

////////////////////////// top production products //////////////////////////
(function () {
  async function fetchProductCounts() {
    try {
      const [rows, productById] = await Promise.all([
        fetchReportCached(REPORTS.finishedGoodsConsumptions),
        getProductById()
      ]);

      const counts = {};
      rows.forEach(row => {
        const lookup = row[FINISHED_GOODS_CONSUMPTIONS_FIELDS.product]; 
        const id = (lookup && typeof lookup === "object") ? String(lookup.ID) : null;
        const name = (id && productById.has(id)) ? productById.get(id).name : (displayValue(lookup) || null);
        if (!name) return;
        counts[name] = (counts[name] || 0) + 1;
      });
      return counts;
    } catch (error) {
      console.error("Error fetching Finished_Goods_Cunsumptions_Report:", error);
      return {};
    }
  }

  function topProductRowHtml([name, count], i) {
    return `
      <tr>
        <td class="rank">${i + 1}</td>
        <td class="name-cell"><span class="prod-icon">📦</span><span class="prod-name-text">${name}</span></td>
        <td class="amount">${count}</td>
      </tr>`;
  }

  function renderTopProductsTable(counts) {
    const tbody = document.getElementById('topProductsBody');
    if (!tbody) return;

    const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    window.__topProductsRanked = ranked;

    if (!ranked.length) {
      tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;color:var(--text-muted);padding:20px 0;">No data available</td></tr>`;
      return;
    }

    tbody.innerHTML = ranked.slice(0, 5).map(topProductRowHtml).join('');
  }

  const tpViewAllBtn = document.getElementById('tpViewAllBtn');
  if (tpViewAllBtn) {
    tpViewAllBtn.addEventListener('click', () => {
      const ranked = window.__topProductsRanked || [];
      const bodyHtml = !ranked.length
        ? `<div class="app-modal-empty">No data available</div>`
        : `<table>
             <thead><tr><th class="col-rank">#</th><th>Product name</th><th class="col-num">Times produced</th></tr></thead>
             <tbody>${ranked.map(topProductRowHtml).join('')}</tbody>
           </table>`;
      window.openAppModal(`Top Production Products · ${ranked.length} record${ranked.length === 1 ? '' : 's'}`, bodyHtml);
    });
  }

  (async function initTopProducts() {
    const counts = await fetchProductCounts();
    renderTopProductsTable(counts);
  })();
})();

////////////////////////// purchase orders //////////////////////////
function fixedPurchaseOrderSegments(records) {
  const knownOrder = ["Not Received", "Partially Received", "Received"];
  const counts = new Map(knownOrder.map(status => [status, 0]));
  records.forEach(r => {
    const raw = r[PURCHASE_ORDER_FIELDS.status];
    const status = (raw === undefined || raw === null || raw === "") ? "Unspecified" : String(raw);
    counts.set(status, (counts.get(status) || 0) + 1);
  });
  const order = Array.from(counts.keys());
  return order.map(status => ({
    key: status, label: status, count: counts.get(status), color: colorForStatus(status, order)
  }));
}

(async function initPurchaseOrders() {
  try {
    const records = await fetchReportCached(REPORTS.purchaseOrders);

    const pendingCount = records.filter(r => r[PURCHASE_ORDER_FIELDS.status] === "Not Received").length;
    setText('pendingpo', pendingCount);

    const segments = fixedPurchaseOrderSegments(records);
    window.renderDonut({
      svgId: 'poDonutSvg', totalId: 'poDonutTotal', legendId: 'poLegend',
      size: 190, r: 74, strokeW: 24, segments
    });
  } catch (error) {
    console.error("Error fetching Purchase_Order_Report:", error);
    setText('pendingpo', 0);
    window.renderDonut({
      svgId: 'poDonutSvg', totalId: 'poDonutTotal', legendId: 'poLegend',
      size: 190, r: 74, strokeW: 24, segments: fixedPurchaseOrderSegments([])
    });
  }
})();

////////////////////////// batch health cards //////////////////////////
(async function initBatchHealth() {
  const batchHealth = { total: 0, healthy: 0, expirySoon: 0, expired: 0 };

  function lookupId(value) {
    if (Array.isArray(value)) return value.length ? lookupId(value[0]) : null;
    if (value && typeof value === "object") return value.ID || value.id || null;
    return value;
  }

  try {
    const [batches, productById] = await Promise.all([
      fetchReportCached(REPORTS.batches),
      getProductById()
    ]);

    const productByName = new Map();
    productById.forEach(product => {
      const name = String(product.name || "").trim();
      if (name && !productByName.has(name)) productByName.set(name, product);
      const productCode = String(product.productId || "").trim();
      if (productCode && !productByName.has(productCode)) productByName.set(productCode, product);
    });

    function resolveProduct(batch) {
      const value = batch[BATCH_FIELDS.productLookup];
      if (value === undefined || value === null || value === "") return null;
      const id = lookupId(value);
      if (id !== undefined && id !== null && productById.has(String(id))) return productById.get(String(id));
      const name = String(displayValue(value) || "").trim();
      return name ? (productByName.get(name) || null) : null;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let rowsMissingProductLookup = 0;

    batches.forEach(batch => {
      const batchNumber = displayValue(batch[BATCH_FIELDS.number]);
      if (batchNumber === undefined || batchNumber === null || String(batchNumber).trim() === "") return;

      batchHealth.total++;

      const product = resolveProduct(batch);
      if (!product) {
        rowsMissingProductLookup++;
        return;
      }
      const category = String(displayValue(product.category) || "").trim();
      if (category !== "Finished Goods" && category !== "Raw Materials") return;

      const status = getBatchHealthStatus(batch, category, today);
      if (status) batchHealth[status]++;
    });

    console.info("Batch Health loaded", {
      batchRows: batches.length,
      productRows: productById.size,
      rowsMissingProductLookup,
      sampleBatchKeys: batches.length ? Object.keys(batches[0]) : [],
      batchHealth
    });
  } catch (error) {
    console.error("Error fetching All_Batch_Details:", error);
  }

  setText('batchOverall', batchHealth.total);
  setText('batchHealthy', batchHealth.healthy);
  setText('batchExpirySoon', batchHealth.expirySoon);
  setText('batchExpired', batchHealth.expired);
})();

////////////////////////// stock distribution //////////////////////////
(function () {
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.getElementById('whChart');
  const tooltip = document.getElementById('whChartTooltip');
  const wrap = document.getElementById('whChartWrap');
  const legend = document.getElementById('whChartLegend');
  if (!svg) return;

  const LEFT = 190, RIGHT = 600, TOP = 26, ROW = 54, BOTTOM = 204;
  const el = (tag, attrs) => {
    const node = document.createElementNS(svgNS, tag);
    Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
    return node;
  };

  function render(items) {
    svg.innerHTML = '';
    const grandTotal = items.reduce((s, i) => s + i.value, 0);
    if (!grandTotal) {
      if (legend) legend.innerHTML = `<span class="warehouse-summary">No data available</span>`;
      return;
    }
    const max = Math.max(10, Math.ceil((Math.max(...items.map(i => i.value), 0) || 10) / 100) * 100);

    for (let tick = 0; tick <= 5; tick++) {
      const value = (max / 5) * tick;
      const x = LEFT + ((RIGHT - LEFT) * tick / 5);
      svg.appendChild(el('line', { x1: x, x2: x, y1: TOP - 10, y2: BOTTOM, class: 'warehouse-grid-line' }));
      const label = el('text', { x, y: BOTTOM + 20, class: 'warehouse-axis-label', 'text-anchor': 'middle' });
      label.textContent = Math.round(value).toLocaleString();
      svg.appendChild(label);
    }
    svg.appendChild(el('line', { x1: LEFT, x2: RIGHT, y1: BOTTOM, y2: BOTTOM, class: 'warehouse-base-line' }));

    items.forEach((item, index) => {
      const y = TOP + index * ROW;
      const width = max ? ((RIGHT - LEFT) * item.value) / max : 0;
      const pct = grandTotal ? Math.round((item.value / grandTotal) * 100) : 0;
      const name = el('text', { x: LEFT - 14, y: y + 17, class: 'warehouse-bar-label', 'text-anchor': 'end' });
      name.textContent = item.label;
      svg.appendChild(name);
      svg.appendChild(el('rect', { x: LEFT, y, width: RIGHT - LEFT, height: 24, rx: 7, class: 'warehouse-bar-track' }));
      const bar = el('rect', { x: LEFT, y, width, height: 24, rx: 7, fill: item.color, class: 'warehouse-bar' });
      bar.addEventListener('mouseenter', event => {
        if (!tooltip || !wrap) return;
        tooltip.textContent = `${item.label}: ${item.value.toLocaleString()} units (${pct}% of ${grandTotal.toLocaleString()})`;
        tooltip.style.opacity = '1';
        const bounds = wrap.getBoundingClientRect();
        tooltip.style.left = `${event.clientX - bounds.left + 12}px`;
        tooltip.style.top = `${event.clientY - bounds.top - 12}px`;
      });
      bar.addEventListener('mouseleave', () => { if (tooltip) tooltip.style.opacity = '0'; });
      svg.appendChild(bar);
      const total = el('text', { x: Math.min(LEFT + width + 10, RIGHT + 4), y: y + 17, class: 'warehouse-bar-value' });
      total.textContent = `${item.value.toLocaleString()} units · ${pct}%`;
      svg.appendChild(total);
    });

    if (legend) legend.innerHTML = `<span class="warehouse-summary">${grandTotal.toLocaleString()} units across ${items.length} warehouses</span>`;
  }

  function sumField(records, fieldName) {
    return records.reduce((sum, r) => sum + Number(r[fieldName] || 0), 0);
  }

  (async function init() {
    try {
      const [main, production, scrap] = await Promise.all([
        fetchReportCached(REPORTS.mainWarehouse),
        fetchReportCached(REPORTS.productionWarehouse),
        fetchReportCached(REPORTS.scrapWarehouse)
      ]);

      render([
        { label: 'Main Warehouse', value: sumField(main, WAREHOUSE_DETAIL_FIELDS.stockOnHand), color: '#10B981' },
        { label: 'Production Warehouse', value: sumField(production, WAREHOUSE_DETAIL_FIELDS.committedStock), color: '#0D9488' },
        { label: 'Scrap Warehouse', value: sumField(scrap, WAREHOUSE_DETAIL_FIELDS.scrapQuantity), color: '#F59E0B' }
      ]);
    } catch (error) {
      console.error('Error building Stock Distribution:', error);
      render([]);
    }
  })();
})();

////////////////////////// warehouse stock table //////////////////////////
(function () {
  const head = document.getElementById('whTableHead');
  const body = document.getElementById('whTableBody');
  const sub = document.getElementById('whTableSub');
  const tabs = document.getElementById('whTabs');
  if (!head || !body) return;

  let WAREHOUSES = {
    main: { label: 'Main Warehouse', subtitle: 'Main Warehouse stock levels', columns: ['Product', 'Warehouse Name', 'Stock on Hand', 'Committed Stock', 'Available Stock'], rows: [] },
    production: { label: 'Production Warehouse', subtitle: 'Production Warehouse committed stock', columns: ['Product', 'Warehouse Name', 'Committed Stock', 'Production Count'], rows: [] },
    scrap: { label: 'Scrap Warehouse', subtitle: 'Scrap Warehouse quantity', columns: ['Product', 'Warehouse Name', 'Product Category', 'Scrap Quantity'], rows: [] }
  };

  function resolveRow(record, productById) {
    const lookup = record[WAREHOUSE_DETAIL_FIELDS.productLookup];
    const id = (lookup && typeof lookup === 'object') ? String(lookup.ID) : null;
    const product = (id && productById.has(id)) ? productById.get(id) : null;
    return {
      name: (product && product.name) || displayValue(lookup) || 'Unknown product',
      category: product ? product.category : null,
      warehouseName: displayValue(record[WAREHOUSE_DETAIL_FIELDS.warehouse])
    };
  }

  async function buildWarehouses() {
    try {
      const [productById, main, production, scrap, targets] = await Promise.all([
        getProductById(),
        fetchReportCached(REPORTS.mainWarehouse),
        fetchReportCached(REPORTS.productionWarehouse),
        fetchReportCached(REPORTS.scrapWarehouse),
        getProductionTargets()
      ]);

      const mainRows = main.map(r => {
        const { name, warehouseName } = resolveRow(r, productById);
        const onHand = Number(r[WAREHOUSE_DETAIL_FIELDS.stockOnHand] || 0);
        const committed = Number(r[WAREHOUSE_DETAIL_FIELDS.committedStock] || 0);
        const stored = r[WAREHOUSE_DETAIL_FIELDS.availableStock];
        const available = (stored !== undefined && stored !== null && stored !== '') ? Number(stored) : (onHand - committed);
        return { name, warehouseName: warehouseName || 'Main Warehouse', onHand, committed, available };
      });
      WAREHOUSES.main.rows = mainRows.map(r => [r.name, r.warehouseName, r.onHand, r.committed, r.available]);

      const productionCommitted = {};
      production.forEach(r => {
        const { name, warehouseName } = resolveRow(r, productById);
        if (!productionCommitted[name]) productionCommitted[name] = { committed: 0, warehouseName: warehouseName || 'Production Warehouse' };
        productionCommitted[name].committed += Number(r[WAREHOUSE_DETAIL_FIELDS.committedStock] || 0);
      });

      const productionCounts = {};
      targets.filter(t => t.status === 'In Progress').forEach(t => {
        t.items.forEach(item => {
          if (!item.productName) return;
          productionCounts[item.productName] = (productionCounts[item.productName] || 0) + 1;
        });
      });

      const productionNames = new Set([...Object.keys(productionCommitted), ...Object.keys(productionCounts)]);
      WAREHOUSES.production.rows = Array.from(productionNames).map(name => [
        name,
        (productionCommitted[name] && productionCommitted[name].warehouseName) || 'Production Warehouse',
        (productionCommitted[name] && productionCommitted[name].committed) || 0,
        productionCounts[name] || 0
      ]);

      WAREHOUSES.scrap.rows = scrap.map(r => {
        const { name, category, warehouseName } = resolveRow(r, productById);
        return [name, warehouseName || 'Scrap Warehouse', category || 'Uncategorized', Number(r[WAREHOUSE_DETAIL_FIELDS.scrapQuantity] || 0)];
      });
    } catch (error) {
      console.error('Error building Warehouse Stock table:', error);
    }
  }

  function metricBadge(colName, value, row) {
    if (colName === 'Product Category') {
      const text = value || 'Uncategorized';
      const tone = text === 'Raw Materials' ? 'wh-badge-warn' : (text === 'Finished Goods' ? 'wh-badge-good' : 'wh-badge-name');
      return `<span class="wh-badge ${tone}">${text}</span>`;
    }
    const num = Number(value) || 0;
    let tone = 'good';
    if (colName === 'Available Stock') {
      tone = num < 100 ? 'bad' : (num < 200 ? 'warn' : 'good');
    } else if (colName === 'Committed Stock') {
      tone = num > 100 ? 'warn' : 'good';
    } else if (colName === 'Scrap Quantity') {
      tone = num > 6 ? 'bad' : (num > 3 ? 'warn' : 'good');
    } else if (colName === 'Stock on Hand') {
      tone = 'good';
    }
    return `<span class="wh-badge wh-badge-${tone}">${num.toLocaleString()}</span>`;
  }

  const PANEL_ROW_LIMIT = 6;
  let currentKey = 'main';

  function headRowHtml(wh) {
    return `<tr>${wh.columns.map(c => {
      const numeric = !['Product', 'Warehouse Name', 'Product Category'].includes(c);
      return `<th class="${numeric ? 'wh-number' : ''}">${c}</th>`;
    }).join('')}</tr>`;
  }

  function bodyRowsHtml(wh, rows) {
    return rows.map(row => `
      <tr>
        <td class="name-cell"><span class="prod-icon">🥫</span><span class="prod-name-text">${row[0]}</span></td>
        <td class="wh-warehouse-name"><span class="wh-badge wh-badge-name">${row[1]}</span></td>
        ${row.slice(2).map((v, i) => {
          const colName = wh.columns[i + 2];
          const cellClass = colName === 'Product Category' ? '' : 'amount wh-number';
          return `<td class="${cellClass}">${metricBadge(colName, v, row)}</td>`;
        }).join('')}
      </tr>
    `).join('');
  }

  function renderTable(key) {
    const wh = WAREHOUSES[key];
    if (!wh) return;
    currentKey = key;

    head.innerHTML = headRowHtml(wh);

    const shown = wh.rows.slice(-PANEL_ROW_LIMIT);
    if (!shown.length) {
      body.innerHTML = `<tr class="wh-empty-row"><td colspan="${wh.columns.length}">No data available</td></tr>`;
    } else {
      body.innerHTML = bodyRowsHtml(wh, shown);
    }

    if (sub) sub.textContent = wh.subtitle;
  }

  if (tabs) {
    tabs.querySelectorAll('.pcp-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        tabs.querySelectorAll('.pcp-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        renderTable(pill.dataset.warehouse);
      });
    });
  }

  const whViewAllBtn = document.getElementById('whViewAllBtn');
  if (whViewAllBtn) {
    whViewAllBtn.addEventListener('click', () => {
      const wh = WAREHOUSES[currentKey];
      if (!wh || !window.openAppModal) return;
      const count = wh.rows.length;
      const bodyHtml = !count
        ? `<div class="app-modal-empty">No data available</div>`
        : `<table>
             <thead>${headRowHtml(wh)}</thead>
             <tbody>${bodyRowsHtml(wh, wh.rows)}</tbody>
           </table>`;
      window.openAppModal(`${wh.label} · ${count} record${count === 1 ? '' : 's'}`, bodyHtml);
    });
  }

  (async function init() {
    await buildWarehouses();
    const activeTab = tabs && tabs.querySelector('.pcp-pill.active');
    renderTable(activeTab ? activeTab.dataset.warehouse : 'main');
  })();
})();

////////////////////////// production output //////////////////////////
(function () {
  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.getElementById('prodMonthChart');
  const tooltip = document.getElementById('prodMonthTooltip');
  const wrap = document.getElementById('prodMonthCanvasWrap');
  const statTotal = document.getElementById('prodMonthStatTotal');
  const periodButtons = Array.from(document.querySelectorAll('.output-period-btn'));
  const dateField = document.getElementById('prodOutputDate');
  const monthField = document.getElementById('prodOutputMonth');
  const yearField = document.getElementById('prodOutputYear');
  if (!svg) return;

  const LEFT = 66, RIGHT = 870, TOP = 20, BOTTOM = 280;

  const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  let outputRecords = [];
  const today = new Date();
  const isoDate = today.toISOString().slice(0, 10);
  if (dateField) dateField.value = isoDate;
  if (monthField) monthField.value = isoDate.slice(0, 7);
  if (yearField) {
    for (let year = today.getFullYear(); year >= today.getFullYear() - 4; year--) {
      const option = document.createElement('option');
      option.value = year; option.textContent = year;
      yearField.appendChild(option);
    }
    yearField.value = today.getFullYear();
  }

  function valueOf(record) { return Number(record.target) || 0; }
  function dataForPeriod(period) {
    const records = outputRecords.filter(r => r.date instanceof Date && !isNaN(r.date));
    if (period === 'date') {
      const selected = dateField && dateField.value ? new Date(`${dateField.value}T00:00:00`) : new Date();
      const total = records.filter(r => r.date.toDateString() === selected.toDateString()).reduce((sum, r) => sum + valueOf(r), 0);
      return [{ label: `${selected.getDate()} ${monthLabels[selected.getMonth()]}`, value: total }];
    }
    if (period === 'month') {
      const [selectedYear, selectedMonth] = (monthField && monthField.value ? monthField.value : isoDate.slice(0, 7)).split('-').map(Number);
      const weeks = [0, 0, 0, 0, 0];
      records.filter(r => r.date.getFullYear() === selectedYear && r.date.getMonth() === selectedMonth - 1)
        .forEach(r => { weeks[Math.min(4, Math.floor((r.date.getDate() - 1) / 7))] += valueOf(r); });
      return weeks.map((value, index) => ({ label: `Week ${index + 1}`, value }));
    }
    const selectedYear = Number(yearField && yearField.value) || today.getFullYear();
    const months = new Array(12).fill(0);
    records.filter(r => r.date.getFullYear() === selectedYear)
      .forEach(r => { months[r.date.getMonth()] += valueOf(r); });
    return months.map((value, index) => ({ label: monthLabels[index], value }));
  }

  function updateOutputPeriod(period = 'month') {
    if (dateField) dateField.hidden = period !== 'date';
    if (monthField) monthField.hidden = period !== 'month';
    if (yearField) yearField.hidden = period !== 'year';
    const subtitle = document.querySelector('.prod-chart-panel .pcp-sub');
    if (subtitle) subtitle.textContent = period === 'date' ? 'Quantity produced for selected date' : period === 'month' ? 'Quantity produced for selected month' : 'Quantity produced for selected year';
    renderChart(dataForPeriod(period));
  }

  function niceMax(value) {
    if (value <= 0) return 10;
    const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
    const residual = value / magnitude;
    let step;
    if (residual > 5) step = 10;
    else if (residual > 2) step = 5;
    else if (residual > 1) step = 2;
    else step = 1;
    return step * magnitude;
  }

  function el(tag, attrs) {
    const node = document.createElementNS(svgNS, tag);
    for (const k in attrs) node.setAttribute(k, attrs[k]);
    return node;
  }

  function roundedTopPath(x, y, w, h, r) {
    if (h <= 0) return `M${x},${BOTTOM} L${x + w},${BOTTOM} Z`;
    r = Math.min(r, w / 2, h);
    return `M${x},${y + h} L${x},${y + r} Q${x},${y} ${x + r},${y} ` +
           `L${x + w - r},${y} Q${x + w},${y} ${x + w},${y + r} L${x + w},${y + h} Z`;
  }

  function renderChart(data) {
    svg.innerHTML = '';
    if (!data.length) return;

    const defs = el('defs');
    const grad = el('linearGradient', { id: 'prodMonthBarGrad', x1: '0', y1: '0', x2: '0', y2: '1' });
    const stop1 = el('stop', { offset: '0%', 'stop-color': '#10b981' });
    const stop2 = el('stop', { offset: '100%', 'stop-color': '#166534' });
    grad.appendChild(stop1);
    grad.appendChild(stop2);
    defs.appendChild(grad);
    svg.appendChild(defs);

    const maxVal = niceMax(Math.max(...data.map(d => d.value), 0));
    const ticks = 4;

    for (let i = 0; i <= ticks; i++) {
      const val = Math.round((maxVal / ticks) * i);
      const y = BOTTOM - (val / maxVal) * (BOTTOM - TOP);
      svg.appendChild(el('line', {
        x1: LEFT, x2: RIGHT, y1: y, y2: y,
        class: i === 0 ? 'pcp-baseline-line' : 'pcp-grid'
      }));
      const t = el('text', { x: LEFT - 12, y: y + 4, class: 'pcp-ylabel', 'text-anchor': 'end' });
      t.textContent = val.toLocaleString();
      svg.appendChild(t);
    }

    const axisTitle = el('text', {
      x: 16, y: (TOP + BOTTOM) / 2, class: 'pcp-axis-title',
      transform: `rotate(-90, 16, ${(TOP + BOTTOM) / 2})`, 'text-anchor': 'middle'
    });
    axisTitle.textContent = 'Quantity produced';
    svg.appendChild(axisTitle);

    const n = data.length;
    const slot = (RIGHT - LEFT) / n;
    const barW = Math.min(34, slot * 0.5);

    data.forEach((d, i) => {
      const x = LEFT + slot * i + (slot - barW) / 2;
      const barH = (d.value / maxVal) * (BOTTOM - TOP);
      const y = BOTTOM - barH;

      const bar = el('path', {
        d: roundedTopPath(x, y, barW, barH, 6),
        class: 'pcp-bar',
        style: `transition-delay:${i * 35}ms`
      });
      bar.addEventListener('mouseenter', e => showTooltip(e, d));
      bar.addEventListener('mousemove', moveTooltip);
      bar.addEventListener('mouseleave', hideTooltip);
      svg.appendChild(bar);

      const xl = el('text', { x: x + barW / 2, y: BOTTOM + 22, class: 'pcp-xlabel', 'text-anchor': 'middle' });
      xl.textContent = d.label;
      svg.appendChild(xl);
    });

    requestAnimationFrame(() => {
      svg.querySelectorAll('.pcp-bar').forEach(b => b.classList.add('pcp-bar-in'));
    });

    if (statTotal) window.animateCount(statTotal, data.reduce((s, d) => s + d.value, 0));
  }

  function showTooltip(e, d) {
    if (!tooltip) return;
    tooltip.textContent = `${d.label}: ${d.value.toLocaleString()} units`;
    tooltip.style.opacity = '1';
    moveTooltip(e);
  }
  function moveTooltip(e) {
    if (!tooltip || !wrap) return;
    const rect = wrap.getBoundingClientRect();
    tooltip.style.left = (e.clientX - rect.left + 12) + 'px';
    tooltip.style.top = (e.clientY - rect.top - 12) + 'px';
  }
  function hideTooltip() { if (tooltip) tooltip.style.opacity = '0'; }

  periodButtons.forEach(button => {
    button.addEventListener('click', () => {
      periodButtons.forEach(item => item.classList.toggle('active', item === button));
      updateOutputPeriod(button.dataset.period);
    });
  });
  [dateField, monthField, yearField].filter(Boolean).forEach(field => {
    field.addEventListener('change', () => {
      const active = periodButtons.find(button => button.classList.contains('active'));
      updateOutputPeriod(active ? active.dataset.period : 'month');
    });
  });
  window.addEventListener('production-records-ready', event => {
    outputRecords = event.detail || [];
    const active = periodButtons.find(button => button.classList.contains('active'));
    updateOutputPeriod(active ? active.dataset.period : 'year');
  });
  updateOutputPeriod('year');
})();

////////////////////////// scroll-reveal //////////////////////////
(function () {
  const targets = document.querySelectorAll('.panel, .pcp-panel, .batch-card');
  if (!targets.length) return;

  if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    targets.forEach(t => t.classList.add('reveal-in'));
    return;
  }

  const groups = new Map(); 
  targets.forEach(t => {
    t.classList.add('reveal');
    const parent = t.parentElement;
    const idx = groups.get(parent) || 0;
    t.style.transitionDelay = `${Math.min(idx, 4) * 90}ms`;
    groups.set(parent, idx + 1);
  });

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('reveal-in');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });

  targets.forEach(t => observer.observe(t));
})();

(function () {
  function addSweep(box) {
    if (!box || box.querySelector('.donut-sweep')) return;
    const sweep = document.createElement('div');
    sweep.className = 'donut-sweep';
    box.appendChild(sweep);
  }
  
  function scan() {
    document.querySelectorAll('.pcp-donut-box').forEach(addSweep);
  }
  
  document.addEventListener('DOMContentLoaded', scan);
  window.addEventListener('load', scan);
  
  const observer = new MutationObserver(scan);
  observer.observe(document.body, { childList: true, subtree: true });
})();