console.info("%cDIVINE SCRIPT BUILD MARKER: 2026-09-19-v8-sequential-ios", "background:#111;color:#0f0;font-weight:bold;padding:4px");

///////////////////////////////// CURRENT DATE DISPLAY ////////////////////////////////
(function () {
  const dateEl = document.getElementById('currentDate');
  if (dateEl) {
    const now = new Date();
    const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    dateEl.textContent = `${months[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`;
  }
})();

///////////////////////////////// LOADER CONTROLLER ////////////////////////////////
const loaderController = (function () {
  const LOADER_FALLBACK_TIMEOUT = 12000; // Force reveal after 12s in case of severe network latency
  const pctEl = document.querySelector('.loader-bar-pct');
  const bar = document.querySelector('.loader-bar');
  const fill = document.querySelector('.loader-bar-fill');
  const dot = document.querySelector('.loader-bar-dot');
  const phase = document.querySelector('.loader-phase');
  const detail = document.querySelector('.loader-phase-sub');
  const status = document.querySelector('.loader-status-text span:last-child');
  const steps = Array.from(document.querySelectorAll('.lstep[data-process-step]'));
  const loaderEl = document.getElementById('loader');
  const dashboardEl = document.getElementById('dashboard');

  const processStages = [
    { title: 'Sourcing Materials', sub: 'Validating ingredients and inventory levels…', status: 'Verifying raw materials & products…' },
    { title: 'Inventory & Storage', sub: 'Synchronizing warehouse availability & stock…', status: 'Refreshing warehouse records…' },
    { title: 'Making Product', sub: 'Compiling production targets and schedules…', status: 'Synchronizing live production records…' },
    { title: 'Orders & Supply', sub: 'Tracking consumptions and purchase orders…', status: 'Validating orders & consumptions…' },
    { title: 'Quality & Batches', sub: 'Inspecting batch quality and expiry health…', status: 'Finalizing your production dashboard…' }
  ];

  let currentPercent = 5;
  let isFinished = false;

  function updateUI(percent, stageIndex) {
    if (isFinished) return;
    currentPercent = Math.max(currentPercent, Math.min(percent, 100));
    const stage = processStages[Math.min(stageIndex, processStages.length - 1)];

    if (pctEl) pctEl.textContent = `${Math.round(currentPercent)}%`;
    if (bar) bar.setAttribute('aria-valuenow', String(Math.round(currentPercent)));
    if (fill) fill.style.width = `${currentPercent}%`;
    if (dot) dot.style.left = `${currentPercent}%`;
    if (phase && stage) phase.textContent = stage.title;
    if (detail && stage) detail.textContent = stage.sub;
    if (status && stage) status.textContent = stage.status;

    steps.forEach((step, idx) => {
      step.classList.toggle('is-done', idx < stageIndex);
      step.classList.toggle('is-active', idx === stageIndex);
    });
  }

  function finish() {
    if (isFinished) return;
    isFinished = true;
    updateUI(100, 4);
    steps.forEach(step => {
      step.classList.add('is-done');
      step.classList.remove('is-active');
    });

    setTimeout(() => {
      if (loaderEl) loaderEl.classList.add('hide');
      if (dashboardEl) dashboardEl.classList.add('show');
      document.body.classList.add('loaded');
    }, 450);
  }

  // Safety fallback: ensure dashboard is always revealed even if network stalls
  setTimeout(() => {
    if (!isFinished) {
      console.warn("Loader safety timeout triggered: revealing dashboard");
      finish();
    }
  }, LOADER_FALLBACK_TIMEOUT);

  return {
    setProgress: updateUI,
    finish: finish
  };
})();

///////////////////////////////// CONFIG ////////////////////////////////
const ZOHO_APP = "divina-foods";

const REPORTS = {
  products: "Product_Master_Report",
  productionTarget: "Production_Target_Report",
  finishedGoods: "Finished_Goods_Report",
  consumptionEntry: "Consumption_Entry_Report",
  finishedGoodsConsumptions: "Finished_Goods_Cunsumptions_Report",
  purchaseOrders: "Purchase_Order_Report",
  pendingPurchaseOrders: "Pending_Purchase_Orders",
  batches: "All_Batch_Details",
  mainWarehouse: "Main_Warehouse_Stock_Details_Report",
  productionWarehouse: "Production_Stock_Details_Report",
  scrapWarehouse: "Scrap_Warehouse_Stock_Details_Report"
};

const PRODUCT_FIELDS = {
  id: "ID",
  productId: "Product_ID",
  name: "Product_Name",
  category: "Product_Category",
  batchDetails: "Batch_Details",
  reorderPoint: "Reorder_Point",
  minLevel: "Minimum_Level",
  maxLevel: "Maximum_Level"
};

const PRODUCTION_TARGET_FIELDS = {
  id: "ID",
  targetId: "Production_Target_ID",
  startDate: "Start_Date",
  endDate: "End_Date",
  status: "Status"
};

const FINISHED_GOODS_FIELDS = {
  productionTargetLookup: "Production_Target_ID",
  item: "Item",
  targetQuantity: "Target_Quantity"
};

const FINISHED_GOODS_CONSUMPTIONS_FIELDS = {
  product: "Finished_Good"
};

const PURCHASE_ORDER_FIELDS = {
  status: "Status"
};

const BATCH_FIELDS = {
  number: "Batch_Number",
  manufacturingDate: "Manufacturing_Date",
  expiryDate: "Expiry_Date",
  productLookup: "Product_Master"
};

const WAREHOUSE_DETAIL_FIELDS = {
  productLookup: "Product_Master",
  warehouse: "Warehouse",
  stockOnHand: "Stock_On_Hand",
  committedStock: "Committed_Stocks",
  availableStock: "Available_Stocks",
  scrapQuantity: "Scrap_Quantity"
};

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

///////////////////////////////// SAFARI & CROSS-BROWSER UTILS ////////////////////////////////
function __delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function displayValue(v) {
  if (v && typeof v === "object") {
    return v.zc_display_value || v.display_value || v.ID || "";
  }
  return v !== undefined && v !== null ? v : "";
}

/**
 * Robust date parser compatible with iOS WebKit (Safari), Android, and desktop.
 * Safari fails on strings like "15-Sep-2026" or "15-09-2026" with new Date().
 * This explicitly extracts components and constructs local Date objects.
 */
function parseZohoDate(value) {
  if (!value) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  const str = String(value).trim();
  if (!str) return null;

  // Format 1: DD-MMM-YYYY (e.g. 15-Sep-2026 or 15-September-2026)
  const m1 = str.match(/^(\d{1,2})-([A-Za-z]{3,9})-(\d{4})/);
  if (m1) {
    const monthMap = {
      jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
      jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
    };
    const monKey = m1[2].slice(0, 3).toLowerCase();
    const mon = monthMap[monKey];
    if (mon !== undefined) {
      return new Date(Number(m1[3]), mon, Number(m1[1]));
    }
  }

  // Format 2: YYYY-MM-DD (e.g. 2026-09-15)
  const m2 = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m2) {
    return new Date(Number(m2[1]), Number(m2[2]) - 1, Number(m2[3]));
  }

  // Format 3: DD-MM-YYYY or DD/MM/YYYY (e.g. 15-09-2026 or 15/09/2026)
  const m3 = str.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
  if (m3) {
    return new Date(Number(m3[3]), Number(m3[2]) - 1, Number(m3[1]));
  }

  // Fallback: replace hyphen with slash for Safari ISO-ish tolerance
  const normalized = str.replace(/-/g, '/');
  const d = new Date(normalized);
  if (!isNaN(d.getTime())) return d;

  const dOrig = new Date(str);
  return isNaN(dOrig.getTime()) ? null : dOrig;
}

function formatShortDate(d) {
  if (!d || !(d instanceof Date) || isNaN(d.getTime())) return '—';
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

function colorForStatus(status, seenOrder) {
  const key = String(status || "").trim().toLowerCase();
  if (PRODUCTION_STATUS_COLORS[key]) return PRODUCTION_STATUS_COLORS[key];
  if (PURCHASE_ORDER_STATUS_COLORS[key]) return PURCHASE_ORDER_STATUS_COLORS[key];
  const idx = Math.max(0, seenOrder.indexOf(status));
  return FALLBACK_PALETTE[idx % FALLBACK_PALETTE.length];
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

///////////////////////////////// MODAL OVERLAY ////////////////////////////////
(function initModal() {
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

  if (closeBtn) closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });

  window.openAppModal = open;
  window.closeAppModal = close;
})();

///////////////////////////////// SHARED DONUT RENDERER ////////////////////////////////
function renderDonut({ svgId, totalId, legendId, segments, size = 180, r = 68, strokeW = 22 }) {
  const total = segments.reduce((s, seg) => s + seg.count, 0);
  const svg = document.getElementById(svgId);
  if (!svg) return;
  const svgNS = "http://www.w3.org/2000/svg";
  svg.innerHTML = '';
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  svg.removeAttribute('width');
  svg.removeAttribute('height');
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

      const highlight = () => {
        svg.querySelectorAll('circle').forEach(c => {
          c.classList.toggle('seg-highlight', c.dataset.key === seg.key);
          c.classList.toggle('seg-dim', c.dataset.key !== seg.key);
        });
      };
      const unhighlight = () => {
        svg.querySelectorAll('circle').forEach(c => c.classList.remove('seg-highlight', 'seg-dim'));
      };

      item.addEventListener('mouseenter', highlight);
      item.addEventListener('mouseleave', unhighlight);
      item.addEventListener('click', () => {
        const isActive = item.classList.toggle('active-chip');
        legend.querySelectorAll('.po-chip').forEach(other => {
          if (other !== item) other.classList.remove('active-chip');
        });
        if (isActive) highlight();
        else unhighlight();
      });
      legend.appendChild(item);
    });
  }
}
window.renderDonut = renderDonut;

///////////////////////////////// PRODUCTION TARGET BAR CHART ////////////////////////////////
const productionTargetChart = (function () {
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
      const t = el('text', { x: LEFT - 8, y: y + 4, class: 'pcp-ylabel', 'text-anchor': 'end' });
      t.textContent = val.toLocaleString();
      svg.appendChild(t);
    }

    const n = data.length;
    const slot = (RIGHT - LEFT) / n;
    const barW = Math.min(36, slot * 0.55);

    data.forEach((d, i) => {
      const x = LEFT + slot * i + (slot - barW) / 2;
      const barH = (d.value / maxVal) * (BOTTOM - TOP);
      const y = BOTTOM - barH;

      const bar = el('path', {
        d: roundedTopPath(x, y, barW, barH, 6),
        class: 'pcp-bar',
        style: `transition-delay:${i * 40}ms`
      });

      const handleBarTouch = e => {
        if (!tooltip || !wrap) return;
        tooltip.textContent = `${d.label}: ${d.value.toLocaleString()} units`;
        tooltip.style.opacity = '1';
        const rect = wrap.getBoundingClientRect();
        const clientX = e.clientX !== undefined ? e.clientX : (e.touches && e.touches[0] ? e.touches[0].clientX : rect.left);
        const clientY = e.clientY !== undefined ? e.clientY : (e.touches && e.touches[0] ? e.touches[0].clientY : rect.top);
        tooltip.style.left = (clientX - rect.left + 12) + 'px';
        tooltip.style.top = (clientY - rect.top - 12) + 'px';
      };

      bar.addEventListener('mouseenter', handleBarTouch);
      bar.addEventListener('mousemove', handleBarTouch);
      bar.addEventListener('touchstart', handleBarTouch, { passive: true });
      bar.addEventListener('mouseleave', () => { if (tooltip) tooltip.style.opacity = '0'; });
      bar.addEventListener('touchend', () => { if (tooltip) tooltip.style.opacity = '0'; }, { passive: true });
      svg.appendChild(bar);

      const xl = el('text', { x: x + barW / 2, y: BOTTOM + 18, class: 'pcp-xlabel', 'text-anchor': 'middle' });
      xl.textContent = d.label;
      svg.appendChild(xl);
    });

    requestAnimationFrame(() => {
      svg.querySelectorAll('.pcp-bar').forEach(b => b.classList.add('pcp-bar-in'));
    });

    const sum = data.reduce((s, d) => s + d.value, 0);
    if (statTotal) window.animateCount(statTotal, sum);
    if (growthTag) {
      if (data.length >= 2) {
        const first = data[0].value, last = data[data.length - 1].value;
        const pct = first > 0 ? Math.round(((last - first) / first) * 100) : 0;
        growthTag.textContent = (pct >= 0 ? '+' : '') + pct + '% vs start';
      } else {
        growthTag.textContent = 'Live target';
      }
    }
  }

  function groupByMonth(records) {
    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const sums = new Array(12).fill(0);
    records.forEach(r => {
      if (r.date && r.date instanceof Date && !isNaN(r.date.getTime())) {
        sums[r.date.getMonth()] += Number(r.target) || 0;
      }
    });
    return monthNames.map((m, i) => ({ label: m, value: sums[i] }));
  }

  function groupByWeekOfCurrentMonth(records) {
    const now = new Date();
    const curYear = now.getFullYear(), curMonth = now.getMonth();
    const inMonth = records.filter(r => r.date && r.date.getFullYear() === curYear && r.date.getMonth() === curMonth);
    const weeks = [0, 0, 0, 0, 0];
    inMonth.forEach(r => {
      const wk = Math.min(4, Math.floor((r.date.getDate() - 1) / 7));
      weeks[wk] += Number(r.target) || 0;
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

  function render(records) {
    window.__productionRecords = records || [];
    renderChart(groupByMonth(window.__productionRecords));
    window.dispatchEvent(new CustomEvent('production-records-ready', { detail: window.__productionRecords }));
  }

  window.renderProductionChart = render;
  return { render };
})();

///////////////////////////////// PRODUCTS LIST & FILTER ////////////////////////////////
const productsPanel = (function () {
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

  function refresh(products) {
    window.__allProducts = products || [];

    const stockSegments = computeStockSegments(window.__allProducts);
    window.renderDonut({ svgId: 'stockDonutSvg', totalId: 'stockDonutTotal', legendId: 'stockLegend', segments: stockSegments });
    const lowCount = stockSegments.find(s => s.key === 'low')?.count || 0;
    setText('stockBadge', lowCount + ' low stock');
    setText('lowstock', lowCount);

    window.renderDonut({ svgId: 'catDonutSvg', totalId: 'catDonutTotal', legendId: 'catLegend', segments: computeCategorySegments(window.__allProducts) });
    setText('catBadge', window.__allProducts.length + ' products tracked');

    setText('products', window.__allProducts.length);
    setText('finished', window.__allProducts.filter(p => p.category === 'Finished Goods').length);
    setText('raw', window.__allProducts.filter(p => p.category === 'Raw Materials').length);

    renderProductList(window.__allProducts);
  }

  window.refreshFromProducts = refresh;
  return { refresh };
})();

///////////////////////////////// PRODUCTION TARGET UI ////////////////////////////////
const productionTargetUI = (function () {
  function renderStatusDonut(targetLevelRecords) {
    const segments = fixedProductionStatusSegments(targetLevelRecords);
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
        <td class="amount">${(r.target || 0).toLocaleString()} units</td>
        <td>${statusPillHtml(r.status)}</td>
      </tr>`;
  }

  function renderProductionTargetTable(itemLevelRecords) {
    const tbody = document.getElementById('ptbody');
    if (!tbody) return;
    const today = new Date(); today.setHours(0, 0, 0, 0);

    const upcoming = (itemLevelRecords || [])
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

  function render(targets) {
    const targetLevel = (targets || []).map(t => ({
      date: t.startDate,
      target: t.items.reduce((sum, item) => sum + item.targetQty, 0),
      status: t.status
    }));

    const itemLevel = [];
    (targets || []).forEach(t => {
      const rows = t.items.length ? t.items : [{ productName: null, targetQty: 0 }];
      rows.forEach(item => {
        if (!item.productName) return;
        itemLevel.push({ date: t.startDate, product: item.productName, target: item.targetQty, status: t.status });
      });
    });

    setText('production', (targets || []).length);
    window.renderProductionChart(targetLevel);
    renderStatusDonut(targetLevel);
    renderProductionTargetTable(itemLevel);
  }

  return { render };
})();

///////////////////////////////// TOP PRODUCTS ////////////////////////////////
const topProductsUI = (function () {
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

    const ranked = Object.entries(counts || {}).sort((a, b) => b[1] - a[1]);
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

  return { render: renderTopProductsTable };
})();

///////////////////////////////// STOCK DISTRIBUTION CHART ////////////////////////////////
const stockDistributionChart = (function () {
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.getElementById('whChart');
  const tooltip = document.getElementById('whChartTooltip');
  const wrap = document.getElementById('whChartWrap');
  const legend = document.getElementById('whChartLegend');

  const LEFT = 190, RIGHT = 600, TOP = 26, ROW = 54, BOTTOM = 204;
  const el = (tag, attrs) => {
    const node = document.createElementNS(svgNS, tag);
    Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
    return node;
  };

  function render(items) {
    if (!svg) return;
    svg.innerHTML = '';
    const validItems = items || [];
    const grandTotal = validItems.reduce((s, i) => s + i.value, 0);
    if (!grandTotal) {
      if (legend) legend.innerHTML = `<span class="warehouse-summary">No data available</span>`;
      return;
    }
    const max = Math.max(10, Math.ceil((Math.max(...validItems.map(i => i.value), 0) || 10) / 100) * 100);

    for (let tick = 0; tick <= 5; tick++) {
      const value = (max / 5) * tick;
      const x = LEFT + ((RIGHT - LEFT) * tick / 5);
      svg.appendChild(el('line', { x1: x, x2: x, y1: TOP - 10, y2: BOTTOM, class: 'warehouse-grid-line' }));
      const label = el('text', { x, y: BOTTOM + 20, class: 'warehouse-axis-label', 'text-anchor': 'middle' });
      label.textContent = Math.round(value).toLocaleString();
      svg.appendChild(label);
    }
    svg.appendChild(el('line', { x1: LEFT, x2: RIGHT, y1: BOTTOM, y2: BOTTOM, class: 'warehouse-base-line' }));

    validItems.forEach((item, index) => {
      const y = TOP + index * ROW;
      const width = max ? ((RIGHT - LEFT) * item.value) / max : 0;
      const pct = grandTotal ? Math.round((item.value / grandTotal) * 100) : 0;
      const name = el('text', { x: LEFT - 14, y: y + 17, class: 'warehouse-bar-label', 'text-anchor': 'end' });
      name.textContent = item.label;
      svg.appendChild(name);
      svg.appendChild(el('rect', { x: LEFT, y, width: RIGHT - LEFT, height: 24, rx: 7, class: 'warehouse-bar-track' }));
      const bar = el('rect', { x: LEFT, y, width, height: 24, rx: 7, fill: item.color, class: 'warehouse-bar' });

      const handleWhTooltip = event => {
        if (!tooltip || !wrap) return;
        tooltip.textContent = `${item.label}: ${item.value.toLocaleString()} units (${pct}% of ${grandTotal.toLocaleString()})`;
        tooltip.style.opacity = '1';
        const bounds = wrap.getBoundingClientRect();
        const clientX = event.clientX !== undefined ? event.clientX : (event.touches && event.touches[0] ? event.touches[0].clientX : bounds.left);
        const clientY = event.clientY !== undefined ? event.clientY : (event.touches && event.touches[0] ? event.touches[0].clientY : bounds.top);
        tooltip.style.left = `${clientX - bounds.left + 12}px`;
        tooltip.style.top = `${clientY - bounds.top - 12}px`;
      };
      bar.addEventListener('mouseenter', handleWhTooltip);
      bar.addEventListener('touchstart', handleWhTooltip, { passive: true });
      bar.addEventListener('mouseleave', () => { if (tooltip) tooltip.style.opacity = '0'; });
      bar.addEventListener('touchend', () => { if (tooltip) tooltip.style.opacity = '0'; }, { passive: true });
      svg.appendChild(bar);

      const total = el('text', { x: Math.min(LEFT + width + 10, RIGHT + 4), y: y + 17, class: 'warehouse-bar-value' });
      total.textContent = `${item.value.toLocaleString()} units · ${pct}%`;
      svg.appendChild(total);
    });

    if (legend) legend.innerHTML = `<span class="warehouse-summary">${grandTotal.toLocaleString()} units across ${validItems.length} warehouses</span>`;
  }

  return { render };
})();

///////////////////////////////// WAREHOUSE STOCK TABLE ////////////////////////////////
const warehouseStockTable = (function () {
  const head = document.getElementById('whTableHead');
  const body = document.getElementById('whTableBody');
  const sub = document.getElementById('whTableSub');
  const tabs = document.getElementById('whTabs');

  let WAREHOUSES = {
    main: { label: 'Main Warehouse', subtitle: 'Main Warehouse stock levels', columns: ['Product', 'Warehouse Name', 'Stock on Hand', 'Committed Stock', 'Available Stock'], rows: [] },
    production: { label: 'Production Warehouse', subtitle: 'Production Warehouse<br>Committed stock', columns: ['Product', 'Warehouse Name', 'Committed Stock', 'Production Count'], rows: [] },
    scrap: { label: 'Scrap Warehouse', subtitle: 'Scrap Warehouse quantity', columns: ['Product', 'Warehouse Name', 'Product Category', 'Scrap Quantity'], rows: [] }
  };

  function resolveRow(record, productById) {
    const lookup = record[WAREHOUSE_DETAIL_FIELDS.productLookup];
    const id = (lookup && typeof lookup === 'object') ? String(lookup.ID) : (lookup !== undefined && lookup !== null && lookup !== "" ? String(lookup) : null);
    const product = (id && productById.has(id)) ? productById.get(id) : null;
    return {
      name: (product && product.name) || displayValue(lookup) || 'Unknown product',
      category: product ? product.category : null,
      warehouseName: displayValue(record[WAREHOUSE_DETAIL_FIELDS.warehouse])
    };
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
    if (!wh || !head || !body) return;
    currentKey = key;

    head.innerHTML = headRowHtml(wh);
    const shown = wh.rows.slice(-PANEL_ROW_LIMIT);
    if (!shown.length) {
      body.innerHTML = `<tr class="wh-empty-row"><td colspan="${wh.columns.length}">No data available</td></tr>`;
    } else {
      body.innerHTML = bodyRowsHtml(wh, shown);
    }

    if (sub) sub.innerHTML = wh.subtitle;
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

  function updateData({ productById, mainRows, productionRows, scrapRows, targets }) {
    const pById = productById || new Map();
    const mainList = mainRows || [];
    const prodList = productionRows || [];
    const scrapList = scrapRows || [];
    const targetList = targets || [];

    const builtMain = mainList.map(r => {
      const { name, warehouseName } = resolveRow(r, pById);
      const onHand = Number(r[WAREHOUSE_DETAIL_FIELDS.stockOnHand] || 0);
      const committed = Number(r[WAREHOUSE_DETAIL_FIELDS.committedStock] || 0);
      const stored = r[WAREHOUSE_DETAIL_FIELDS.availableStock];
      const available = (stored !== undefined && stored !== null && stored !== '') ? Number(stored) : (onHand - committed);
      return { name, warehouseName: warehouseName || 'Main Warehouse', onHand, committed, available };
    });
    WAREHOUSES.main.rows = builtMain.map(r => [r.name, r.warehouseName, r.onHand, r.committed, r.available]);

    const productionCommitted = {};
    prodList.forEach(r => {
      const { name, warehouseName } = resolveRow(r, pById);
      if (!productionCommitted[name]) productionCommitted[name] = { committed: 0, warehouseName: warehouseName || 'Production Warehouse' };
      productionCommitted[name].committed += Number(r[WAREHOUSE_DETAIL_FIELDS.committedStock] || 0);
    });

    const productionCounts = {};
    targetList.filter(t => t.status === 'In Progress').forEach(t => {
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

    WAREHOUSES.scrap.rows = scrapList.map(r => {
      const { name, category, warehouseName } = resolveRow(r, pById);
      return [name, warehouseName || 'Scrap Warehouse', category || 'Uncategorized', Number(r[WAREHOUSE_DETAIL_FIELDS.scrapQuantity] || 0)];
    });

    const activeTab = tabs && tabs.querySelector('.pcp-pill.active');
    renderTable(activeTab ? activeTab.dataset.warehouse : 'main');
  }

  return { updateData };
})();

///////////////////////////////// PRODUCTION OUTPUT COMPONENT ////////////////////////////////
(function initProductionOutput() {
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
  const pad = n => String(n).padStart(2, '0');
  const isoDate = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

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
    const records = outputRecords.filter(r => r.date instanceof Date && !isNaN(r.date.getTime()));
    if (period === 'date') {
      const val = dateField && dateField.value;
      const selected = val ? parseZohoDate(val) || new Date() : new Date();
      const total = records
        .filter(r => r.date.toDateString() === selected.toDateString())
        .reduce((sum, r) => sum + valueOf(r), 0);
      return [{ label: `${selected.getDate()} ${monthLabels[selected.getMonth()]}`, value: total }];
    }
    if (period === 'month') {
      const monthVal = (monthField && monthField.value ? monthField.value : isoDate.slice(0, 7));
      const parts = monthVal.split('-').map(Number);
      const selectedYear = parts[0] || today.getFullYear();
      const selectedMonth = parts[1] || (today.getMonth() + 1);

      const weeks = [0, 0, 0, 0, 0];
      records
        .filter(r => r.date.getFullYear() === selectedYear && r.date.getMonth() === selectedMonth - 1)
        .forEach(r => {
          weeks[Math.min(4, Math.floor((r.date.getDate() - 1) / 7))] += valueOf(r);
        });
      return weeks.map((value, index) => ({ label: `Week ${index + 1}`, value }));
    }
    const selectedYear = Number(yearField && yearField.value) || today.getFullYear();
    const months = new Array(12).fill(0);
    records
      .filter(r => r.date.getFullYear() === selectedYear)
      .forEach(r => { months[r.date.getMonth()] += valueOf(r); });
    return months.map((value, index) => ({ label: monthLabels[index], value }));
  }

  function updateOutputPeriod(period = 'month') {
    if (dateField) dateField.hidden = period !== 'date';
    if (monthField) monthField.hidden = period !== 'month';
    if (yearField) yearField.hidden = period !== 'year';
    const subtitle = document.querySelector('.prod-chart-panel .pcp-sub');
    if (subtitle) {
      subtitle.textContent = period === 'date'
        ? 'Quantity produced for selected date'
        : period === 'month'
          ? 'Quantity produced for selected month'
          : 'Quantity produced for selected year';
    }
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
      bar.addEventListener('touchstart', e => showTooltip(e.touches ? e.touches[0] : e, d), { passive: true });
      bar.addEventListener('touchend', hideTooltip, { passive: true });
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
    const clientX = e.clientX !== undefined ? e.clientX : (e.touches && e.touches[0] ? e.touches[0].clientX : undefined);
    const clientY = e.clientY !== undefined ? e.clientY : (e.touches && e.touches[0] ? e.touches[0].clientY : undefined);
    if (clientX === undefined) return;
    const rect = wrap.getBoundingClientRect();
    tooltip.style.left = (clientX - rect.left + 12) + 'px';
    tooltip.style.top = (clientY - rect.top - 12) + 'px';
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

///////////////////////////////// ROBUST SEQUENTIAL ZOHO API ENGINE ////////////////////////////////
let isZohoSdkInitialized = false;

async function ensureZohoSdk() {
  if (isZohoSdkInitialized) return true;
  if (typeof ZOHO === 'undefined' || !ZOHO.CREATOR) {
    console.warn("ZOHO.CREATOR SDK not found on window. Operating in preview/fallback mode.");
    return false;
  }
  try {
    if (typeof ZOHO.CREATOR.init === 'function') {
      await Promise.race([
        ZOHO.CREATOR.init(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Zoho SDK init timeout')), 4000))
      ]);
    }
    isZohoSdkInitialized = true;
    console.info("ZOHO.CREATOR SDK initialized successfully.");
    return true;
  } catch (err) {
    console.warn("ZOHO.CREATOR.init() warning or timeout:", err);
    isZohoSdkInitialized = true; // Proceed anyway
    return true;
  }
}

/**
 * Executes a single API call safely with retry logic.
 * Enforces strictly sequential processing: returns parsed data or empty array on failure.
 */
async function fetchSingleReport(reportName, maxAttempts = 3) {
  await ensureZohoSdk();

  if (typeof ZOHO === 'undefined' || !ZOHO.CREATOR || !ZOHO.CREATOR.DATA || typeof ZOHO.CREATOR.DATA.getRecords !== 'function') {
    console.warn(`[Zoho API] DATA.getRecords unavailable for ${reportName}`);
    return [];
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.info(`[Zoho API] Fetching: ${reportName} (attempt ${attempt}/${maxAttempts})`);
      const res = await ZOHO.CREATOR.DATA.getRecords({
        app_name: ZOHO_APP,
        report_name: reportName,
        field_config: "all"
      });

      // Handle diverse response shapes across Zoho mobile WKWebView & Desktop
      if (res) {
        if (Array.isArray(res.data)) return res.data;
        if (Array.isArray(res)) return res;
        if (res.code === 3000 && res.data) return Array.isArray(res.data) ? res.data : [res.data];
        if (res.code === 3100 || (res.data && res.data.length === 0)) return [];
        if (res.data && typeof res.data === 'object') return [res.data];
      }
      return [];
    } catch (err) {
      console.warn(`[Zoho API] Failed to fetch ${reportName} (attempt ${attempt}):`, err);
      if (attempt < maxAttempts) {
        // Backoff delay before retry
        await __delay(350 * attempt);
      } else {
        console.error(`[Zoho API] Exhausted retries for ${reportName}:`, err);
        return [];
      }
    }
  }
  return [];
}

///////////////////////////////// MASTER SEQUENTIAL LOADER ////////////////////////////////
/**
 * STRICTLY SEQUENTIAL EXECUTION FLOW:
 * API 1 (Products)
 *   ↓ wait & process
 * API 2 (Main Warehouse)
 *   ↓ wait & process (renders Products & Stock/Category Donuts)
 * API 3 (Production Warehouse)
 *   ↓ wait & store
 * API 4 (Scrap Warehouse)
 *   ↓ wait & process (renders Stock Distribution Chart)
 * API 5 (Production Targets)
 *   ↓ wait & store
 * API 6 (Finished Goods)
 *   ↓ wait & process (joins with Targets -> renders Target Chart, Status Donut, Target Table, Prod Output, & Warehouse Table)
 * API 7 (Finished Goods Consumptions)
 *   ↓ wait & process (renders Top Products Table)
 * API 8 (Purchase Orders)
 *   ↓ wait & process (renders PO Donut & pending KPI)
 * API 9 (Batch Details)
 *   ↓ wait & process (renders Batch Health Cards)
 *   ↓
 * Finish: Smoothly reveal dashboard!
 */
async function loadDashboardSequentially() {
  console.info("Starting strictly sequential dashboard data loader for iPhone & Web...");

  let productMasterRows = [];
  let productById = new Map();
  let productByName = new Map();
  let mainWarehouseRows = [];
  let productionWarehouseRows = [];
  let scrapWarehouseRows = [];
  let targetHeaderRows = [];
  let finishedGoodsRows = [];
  let resolvedProductionTargets = [];
  let consumptionRows = [];
  let purchaseOrderRows = [];
  let batchRows = [];

  // ==================== STEP 1: PRODUCTS ====================
  try {
    loaderController.setProgress(10, 0);
    productMasterRows = await fetchSingleReport(REPORTS.products);
    console.info(`Step 1/9 Complete: Loaded ${productMasterRows.length} products`);

    productMasterRows.forEach(p => {
      const id = String(p[PRODUCT_FIELDS.id]);
      const name = displayValue(p[PRODUCT_FIELDS.name]);
      const code = displayValue(p[PRODUCT_FIELDS.productId]);
      const item = {
        id: p[PRODUCT_FIELDS.id],
        productId: code,
        name: name,
        category: p[PRODUCT_FIELDS.category],
        reorderPoint: Number(p[PRODUCT_FIELDS.reorderPoint] || 0),
        maxLevel: Number(p[PRODUCT_FIELDS.maxLevel] || 0),
        batchDetails: p[PRODUCT_FIELDS.batchDetails]
      };
      productById.set(id, item);
      if (name) productByName.set(name.trim().toLowerCase(), item);
      if (code) productByName.set(code.trim().toLowerCase(), item);
    });
  } catch (err) {
    console.error("Step 1 (Products) error:", err);
  }
  await __delay(60); // WebKit message buffer flush

  // ==================== STEP 2: MAIN WAREHOUSE ====================
  try {
    loaderController.setProgress(22, 0);
    mainWarehouseRows = await fetchSingleReport(REPORTS.mainWarehouse);
    console.info(`Step 2/9 Complete: Loaded ${mainWarehouseRows.length} main warehouse rows`);

    const stockByProductId = new Map();
    mainWarehouseRows.forEach(row => {
      const lookup = row[WAREHOUSE_DETAIL_FIELDS.productLookup];
      const id = (lookup && typeof lookup === "object") ? String(lookup.ID) : (lookup !== undefined && lookup !== null && lookup !== "" ? String(lookup) : null);
      if (!id) return;
      const onHand = Number(row[WAREHOUSE_DETAIL_FIELDS.stockOnHand] || 0);
      stockByProductId.set(id, (stockByProductId.get(id) || 0) + onHand);
    });

    const productsForPanel = productMasterRows.map(record => ({
      sku: record[PRODUCT_FIELDS.id],
      name: displayValue(record[PRODUCT_FIELDS.name]),
      category: record[PRODUCT_FIELDS.category],
      stock: stockByProductId.get(String(record[PRODUCT_FIELDS.id])) || 0,
      reorder: Number(record[PRODUCT_FIELDS.reorderPoint] || 0)
    }));

    productsPanel.refresh(productsForPanel);
  } catch (err) {
    console.error("Step 2 (Main Warehouse) error:", err);
    productsPanel.refresh([]);
  }
  await __delay(60);

  // ==================== STEP 3: PRODUCTION WAREHOUSE ====================
  try {
    loaderController.setProgress(34, 1);
    productionWarehouseRows = await fetchSingleReport(REPORTS.productionWarehouse);
    console.info(`Step 3/9 Complete: Loaded ${productionWarehouseRows.length} production warehouse rows`);
  } catch (err) {
    console.error("Step 3 (Production Warehouse) error:", err);
  }
  await __delay(60);

  // ==================== STEP 4: SCRAP WAREHOUSE & STOCK DISTRIBUTION ====================
  try {
    loaderController.setProgress(46, 1);
    scrapWarehouseRows = await fetchSingleReport(REPORTS.scrapWarehouse);
    console.info(`Step 4/9 Complete: Loaded ${scrapWarehouseRows.length} scrap warehouse rows`);

    const sumField = (records, fieldName) => records.reduce((sum, r) => sum + Number(r[fieldName] || 0), 0);
    stockDistributionChart.render([
      { label: 'Main Warehouse', value: sumField(mainWarehouseRows, WAREHOUSE_DETAIL_FIELDS.stockOnHand), color: '#10B981' },
      { label: 'Production Warehouse', value: sumField(productionWarehouseRows, WAREHOUSE_DETAIL_FIELDS.committedStock), color: '#0D9488' },
      { label: 'Scrap Warehouse', value: sumField(scrapWarehouseRows, WAREHOUSE_DETAIL_FIELDS.scrapQuantity), color: '#F59E0B' }
    ]);
  } catch (err) {
    console.error("Step 4 (Scrap Warehouse & Distribution) error:", err);
    stockDistributionChart.render([]);
  }
  await __delay(60);

  // ==================== STEP 5: PRODUCTION TARGETS ====================
  try {
    loaderController.setProgress(56, 2);
    targetHeaderRows = await fetchSingleReport(REPORTS.productionTarget);
    console.info(`Step 5/9 Complete: Loaded ${targetHeaderRows.length} target headers`);
  } catch (err) {
    console.error("Step 5 (Production Targets) error:", err);
  }
  await __delay(60);

  // ==================== STEP 6: FINISHED GOODS & TARGET JOIN ====================
  try {
    loaderController.setProgress(68, 2);
    finishedGoodsRows = await fetchSingleReport(REPORTS.finishedGoods);
    console.info(`Step 6/9 Complete: Loaded ${finishedGoodsRows.length} finished goods rows`);

    const goodsByTargetId = new Map();
    finishedGoodsRows.forEach(g => {
      const targetLookup = g[FINISHED_GOODS_FIELDS.productionTargetLookup];
      const targetId = (targetLookup && typeof targetLookup === "object")
        ? String(targetLookup.ID)
        : (targetLookup !== undefined && targetLookup !== null && targetLookup !== "" ? String(targetLookup) : null);
      if (!targetId) return;

      const itemLookup = g[FINISHED_GOODS_FIELDS.item];
      const productIdRaw = (itemLookup && typeof itemLookup === "object") ? itemLookup.ID : (itemLookup !== undefined && itemLookup !== null && itemLookup !== "" ? String(itemLookup) : null);
      const product = (productIdRaw && productById.has(String(productIdRaw))) ? productById.get(String(productIdRaw)) : null;

      const item = {
        productId: productIdRaw,
        productName: (product && product.name) || displayValue(itemLookup) || "Unknown product",
        targetQty: Number(g[FINISHED_GOODS_FIELDS.targetQuantity] || 0)
      };
      if (!goodsByTargetId.has(targetId)) goodsByTargetId.set(targetId, []);
      goodsByTargetId.get(targetId).push(item);
    });

    resolvedProductionTargets = targetHeaderRows.map(r => ({
      id: r[PRODUCTION_TARGET_FIELDS.id],
      targetId: r[PRODUCTION_TARGET_FIELDS.targetId],
      startDate: parseZohoDate(r[PRODUCTION_TARGET_FIELDS.startDate]),
      endDate: parseZohoDate(r[PRODUCTION_TARGET_FIELDS.endDate]),
      status: r[PRODUCTION_TARGET_FIELDS.status],
      items: goodsByTargetId.get(String(r[PRODUCTION_TARGET_FIELDS.id])) || []
    }));

    // Render Production Target Panel (Chart, Status Donut, Upcoming Table)
    productionTargetUI.render(resolvedProductionTargets);

    // Render Warehouse Stock Table with all collected warehouse records + targets
    warehouseStockTable.updateData({
      productById,
      mainRows: mainWarehouseRows,
      productionRows: productionWarehouseRows,
      scrapRows: scrapWarehouseRows,
      targets: resolvedProductionTargets
    });
  } catch (err) {
    console.error("Step 6 (Finished Goods & Target Join) error:", err);
    productionTargetUI.render([]);
    warehouseStockTable.updateData({ productById, mainRows: [], productionRows: [], scrapRows: [], targets: [] });
  }
  await __delay(60);

  // ==================== STEP 7: FINISHED GOODS CONSUMPTIONS ====================
  try {
    loaderController.setProgress(78, 3);
    consumptionRows = await fetchSingleReport(REPORTS.finishedGoodsConsumptions);
    console.info(`Step 7/9 Complete: Loaded ${consumptionRows.length} consumption records`);

    const counts = {};
    consumptionRows.forEach(row => {
      const lookup = row[FINISHED_GOODS_CONSUMPTIONS_FIELDS.product];
      const id = (lookup && typeof lookup === "object") ? String(lookup.ID) : (lookup !== undefined && lookup !== null && lookup !== "" ? String(lookup) : null);
      const product = (id && productById.has(id)) ? productById.get(id) : null;
      const name = (product && product.name) || (displayValue(lookup) || null);
      if (!name) return;
      counts[name] = (counts[name] || 0) + 1;
    });

    topProductsUI.render(counts);
  } catch (err) {
    console.error("Step 7 (Finished Goods Consumptions) error:", err);
    topProductsUI.render({});
  }
  await __delay(60);

  // ==================== STEP 8: PURCHASE ORDERS ====================
  try {
    loaderController.setProgress(88, 3);
    purchaseOrderRows = await fetchSingleReport(REPORTS.purchaseOrders);
    console.info(`Step 8/9 Complete: Loaded ${purchaseOrderRows.length} purchase orders`);

    const pendingCount = purchaseOrderRows.filter(r => String(r[PURCHASE_ORDER_FIELDS.status]).trim().toLowerCase() === "not received").length;
    setText('pendingpo', pendingCount);

    const poSegments = fixedPurchaseOrderSegments(purchaseOrderRows);
    window.renderDonut({
      svgId: 'poDonutSvg', totalId: 'poDonutTotal', legendId: 'poLegend',
      size: 190, r: 74, strokeW: 24, segments: poSegments
    });
  } catch (err) {
    console.error("Step 8 (Purchase Orders) error:", err);
    setText('pendingpo', 0);
    window.renderDonut({
      svgId: 'poDonutSvg', totalId: 'poDonutTotal', legendId: 'poLegend',
      size: 190, r: 74, strokeW: 24, segments: fixedPurchaseOrderSegments([])
    });
  }
  await __delay(60);

  // ==================== STEP 9: ALL BATCH DETAILS ====================
  try {
    loaderController.setProgress(96, 4);
    batchRows = await fetchSingleReport(REPORTS.batches);
    console.info(`Step 9/9 Complete: Loaded ${batchRows.length} batch detail rows`);

    const counts = {
      finishedGoodsHealthy: 0, rawMaterialsHealthy: 0,
      finishedGoodsExpirySoon: 0, rawMaterialsExpirySoon: 0,
      finishedGoodsExpired: 0, rawMaterialsExpired: 0
    };
    let totalBatches = batchRows.length;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    function classifyBatch(batch, category) {
      if (category !== "Finished Goods" && category !== "Raw Materials") return;
      const expiryDate = parseZohoDate(batch[BATCH_FIELDS.expiryDate]);
      if (!expiryDate) return;
      expiryDate.setHours(0, 0, 0, 0);

      const soonCutoff = new Date(expiryDate);
      soonCutoff.setDate(soonCutoff.getDate() - 2);
      const healthyCutoff = new Date(expiryDate);
      healthyCutoff.setDate(healthyCutoff.getDate() - 5);

      if (category === "Finished Goods") {
        const manufacturingDate = parseZohoDate(batch[BATCH_FIELDS.manufacturingDate]);
        if (!manufacturingDate) return;
        manufacturingDate.setHours(0, 0, 0, 0);
        if (manufacturingDate > today) return;

        if (today >= expiryDate) {
          counts.finishedGoodsExpired++;
        } else if (today >= soonCutoff && today < expiryDate) {
          counts.finishedGoodsExpirySoon++;
        } else if (today < healthyCutoff) {
          counts.finishedGoodsHealthy++;
        }
      } else {
        if (today >= expiryDate) {
          counts.rawMaterialsExpired++;
        } else if (today >= soonCutoff && today < expiryDate) {
          counts.rawMaterialsExpirySoon++;
        } else if (today < healthyCutoff) {
          counts.rawMaterialsHealthy++;
        }
      }
    }

    function lookupId(value) {
      if (Array.isArray(value)) return value.length ? lookupId(value[0]) : null;
      if (value && typeof value === "object") return value.ID || value.id || null;
      return value !== undefined && value !== null && value !== "" ? String(value) : null;
    }

    function resolveBatchProduct(batch) {
      const value = batch[BATCH_FIELDS.productLookup];
      if (value === undefined || value === null || value === "") return null;
      const id = lookupId(value);
      if (id && productById.has(String(id))) return productById.get(String(id));
      const name = String(displayValue(value) || "").trim().toLowerCase();
      return name ? (productByName.get(name) || null) : null;
    }

    let rowsMissingProductLookup = 0;
    batchRows.forEach(batch => {
      const product = resolveBatchProduct(batch);
      if (!product) {
        rowsMissingProductLookup++;
        return;
      }
      const category = String(displayValue(product.category) || "").trim();
      classifyBatch(batch, category);
    });

    // Fallback if batch report omitted lookup: use Product_Master embedded Batch_Details already in memory!
    if (batchRows.length > 0 && rowsMissingProductLookup === batchRows.length) {
      Object.keys(counts).forEach(k => counts[k] = 0);
      productMasterRows.forEach(product => {
        const category = String(displayValue(product[PRODUCT_FIELDS.category]) || "").trim();
        if (category !== "Finished Goods" && category !== "Raw Materials") return;
        const rows = product[PRODUCT_FIELDS.batchDetails];
        const rowsList = Array.isArray(rows) ? rows : (rows ? [rows] : []);
        rowsList.forEach(b => classifyBatch(b, category));
      });
    }

    const healthyBatches = counts.finishedGoodsHealthy + counts.rawMaterialsHealthy;
    const expirySoon = counts.finishedGoodsExpirySoon + counts.rawMaterialsExpirySoon;
    const expired = counts.finishedGoodsExpired + counts.rawMaterialsExpired;

    setText('batchOverall', totalBatches);
    setText('batchHealthy', healthyBatches);
    setText('batchExpirySoon', expirySoon);
    setText('batchExpired', expired);
  } catch (err) {
    console.error("Step 9 (Batch Details) error:", err);
    setText('batchOverall', 0);
    setText('batchHealthy', 0);
    setText('batchExpirySoon', 0);
    setText('batchExpired', 0);
  }

  // ==================== ALL STEPS COMPLETE ====================
  console.info("All 9 sequential API steps executed successfully! Finalizing dashboard display.");
  loaderController.finish();
}

// Kick off strictly sequential loading after DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadDashboardSequentially);
} else {
  loadDashboardSequentially();
}

///////////////////////////////// CARD NAVIGATION ////////////////////////////////
(function initCardNavigation() {
  function setupPendingPoCard() {
    const card = document.getElementById('pendingPoCard') || document.getElementById('pendingpo')?.closest('.stat-card');
    if (!card) return;

    function navigateToPendingPOs() {
      if (typeof ZOHO !== 'undefined' && ZOHO.CREATOR && ZOHO.CREATOR.UTIL && typeof ZOHO.CREATOR.UTIL.navigateParentURL === 'function') {
        ZOHO.CREATOR.UTIL.navigateParentURL({
          "action": "open",
          "url": "#Report:Pending_Purchase_Orders",
          "window": "same"
        });
      } else {
        console.warn("ZOHO.CREATOR.UTIL.navigateParentURL not available, navigating via fallback.");
        try {
          window.top.location.hash = "#Report:Pending_Purchase_Orders";
        } catch (e) {
          window.location.hash = "#Report:Pending_Purchase_Orders";
        }
      }
    }

    card.addEventListener('click', navigateToPendingPOs);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        navigateToPendingPOs();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupPendingPoCard);
  } else {
    setupPendingPoCard();
  }
})();

///////////////////////////////// SCROLL-REVEAL & VISUAL EFFECTS ////////////////////////////////
(function initScrollReveal() {
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
    t.style.transitionDelay = `${Math.min(idx, 4) * 70}ms`;
    groups.set(parent, idx + 1);
  });

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('reveal-in');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.05, rootMargin: '50px 0px 0px 0px' });

  targets.forEach(t => observer.observe(t));

  // Fallback: reveal all targets after dashboard is shown
  setTimeout(() => {
    targets.forEach(t => t.classList.add('reveal-in'));
  }, 2600);
})();

(function initDonutSweep() {
  function addSweep(box) {
    if (!box || box.querySelector('.donut-sweep')) return;
    const sweep = document.createElement('div');
    sweep.className = 'donut-sweep';
    box.appendChild(sweep);
  }

  function scan() {
    document.querySelectorAll('.pcp-donut-box').forEach(addSweep);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scan);
  } else {
    scan();
  }
  window.addEventListener('load', scan);
})();
