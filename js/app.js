(function () {
  'use strict';

  /* ---------- 常數 ---------- */
  const STORAGE_KEY = 'travel-planner-v1';
  const WEEK = ['日', '一', '二', '三', '四', '五', '六'];
  const TYPES = {
    sight: ['📍', '景點'], food: ['🍽️', '餐飲'], transport: ['🚆', '交通'],
    lodging: ['🛏️', '住宿'], shop: ['🛍️', '購物'], other: ['📝', '其他'],
  };
  const SECTIONS = [['transport', '🚆', '交通'], ['food', '🍽️', '餐飲'], ['lodging', '🛏️', '住宿']];
  const CATS = { transport: '交通', lodging: '住宿', food: '餐飲', ticket: '門票', shopping: '購物', other: '其他' };
  const CURRENCIES = ['TWD', 'JPY', 'USD', 'KRW', 'EUR', 'THB', 'HKD', 'CNY', 'GBP', 'SGD', 'MYR', 'VND'];
  const DAY_COLORS = ['#e4572e', '#2e86ab', '#3bb273', '#a05195', '#f3a712', '#17bebb', '#d1495b', '#6c757d', '#7768ae', '#8c5e3c'];

  /* ---------- 工具 ---------- */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = (n) => String(n).padStart(2, '0');
  const parseD = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const fmtISO = (dt) => `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
  const addDays = (s, n) => { const d = parseD(s); d.setDate(d.getDate() + n); return fmtISO(d); };
  const diffDays = (a, b) => Math.round((parseD(b) - parseD(a)) / 864e5);
  const money = (n) => (Math.round((+n || 0) * 100) / 100).toLocaleString('zh-TW', { maximumFractionDigits: 2 });
  const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };

  /* ---------- 資料 ---------- */
  function newTrip(over) {
    const start = fmtISO(new Date());
    return Object.assign({
      id: uid(), name: '我的旅程', destination: '',
      startDate: start, endDate: addDays(start, 2),
      members: { adults: 2, children: 0, seniors: 0 },
      styles: ['culture', 'food'], transport: 'transit', pace: 'normal',
      baseCurrency: 'TWD', rates: {}, budget: { total: 0, cats: {} },
      days: [], expenses: [],
    }, over || {});
  }

  function normalizeTrip(t) {
    const base = newTrip();
    const trip = Object.assign(base, t);
    trip.id = t && t.id ? t.id : uid();
    trip.members = Object.assign({ adults: 0, children: 0, seniors: 0 }, t && t.members);
    trip.budget = Object.assign({ total: 0, cats: {} }, t && t.budget);
    trip.budget.cats = trip.budget.cats || {};
    trip.rates = trip.rates || {};
    trip.styles = Array.isArray(trip.styles) ? trip.styles : [];
    trip.expenses = Array.isArray(trip.expenses) ? trip.expenses : [];
    trip.days = Array.isArray(trip.days) ? trip.days : [];
    syncDays(trip);
    trip.days = trip.days.map((d) => ({
      items: (d.items || []).map((it) => Object.assign({ id: uid(), time: '', type: 'sight', title: '', address: '', cost: 0, note: '', lat: null, lng: null }, it)),
      notes: Object.assign({ transport: '', food: '', lodging: '' }, d.notes),
      show: Object.assign({ transport: false, food: false, lodging: false }, d.show),
    }));
    return trip;
  }

  function syncDays(trip) {
    if (!trip.startDate) trip.startDate = fmtISO(new Date());
    if (!trip.endDate || trip.endDate < trip.startDate) trip.endDate = trip.startDate;
    const n = Math.min(60, diffDays(trip.startDate, trip.endDate) + 1);
    while (trip.days.length < n) trip.days.push({ items: [], notes: {}, show: {} });
    trip.days.length = n;
    trip.days.forEach((d) => { d.items = d.items || []; d.notes = d.notes || {}; d.show = d.show || {}; });
  }

  let data = load();
  const ui = { tab: 'itinerary', mapDay: 'all', editingExpense: null, exportOpts: { budget: true, allTips: false } };

  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (raw && Array.isArray(raw.trips) && raw.trips.length) {
        raw.trips = raw.trips.map(normalizeTrip);
        if (!raw.trips.some((t) => t.id === raw.currentId)) raw.currentId = raw.trips[0].id;
        return raw;
      }
    } catch (e) { /* 無資料或毀損,建立新的 */ }
    const t = normalizeTrip(newTrip());
    return { trips: [t], currentId: t.id };
  }

  let saveWarned = false;
  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
    catch (e) {
      if (!saveWarned) { saveWarned = true; alert('無法儲存到瀏覽器(可能是無痕模式或空間已滿)。請使用「匯出 JSON」備份。'); }
    }
  }

  const trip = () => data.trips.find((t) => t.id === data.currentId);
  const dayDate = (t, i) => { const d = parseD(addDays(t.startDate, i)); return `${d.getMonth() + 1}/${d.getDate()} (${WEEK[d.getDay()]})`; };
  const dayLabel = (t) => (i) => `Day ${i + 1} · ${dayDate(t, i)}`;
  const dayColor = (i) => DAY_COLORS[i % DAY_COLORS.length];

  function findItem(t, id) {
    for (let d = 0; d < t.days.length; d++) {
      const i = t.days[d].items.findIndex((it) => it.id === id);
      if (i >= 0) return { d, i, item: t.days[d].items[i] };
    }
    return null;
  }

  /* ---------- 預算計算 ---------- */
  function toBase(t, amount, cur) {
    if (!cur || cur === t.baseCurrency) return { v: amount, ok: true };
    const r = +t.rates[cur];
    return r > 0 ? { v: amount * r, ok: true } : { v: 0, ok: false };
  }
  function budgetStats(t) {
    const byCat = {}; let spent = 0; const missing = new Set();
    Object.keys(CATS).forEach((k) => (byCat[k] = 0));
    t.expenses.forEach((e) => {
      const c = toBase(t, +e.amount || 0, e.currency);
      if (!c.ok) missing.add(e.currency);
      spent += c.v; byCat[e.category] = (byCat[e.category] || 0) + c.v;
    });
    const planned = t.days.reduce((s, d) => s + d.items.reduce((a, it) => a + (+it.cost || 0), 0), 0);
    return { spent, byCat, planned, missing: [...missing] };
  }

  /* ---------- 畫面:共用 ---------- */
  function renderHeader() {
    const t = trip();
    $('#tripSelect').innerHTML = data.trips.map((x) => `<option value="${x.id}" ${x.id === t.id ? 'selected' : ''}>${esc(x.name || '未命名')}</option>`).join('');
    document.querySelectorAll('.tabs button').forEach((b) => b.setAttribute('aria-selected', b.dataset.tab === ui.tab));
  }

  function focusKey(el) {
    if (!el || !el.dataset || !el.dataset.change) return null;
    const d = el.dataset;
    return `[data-change="${d.change}"]` + ['k', 'cur', 'cat', 'day', 'sec'].filter((k) => d[k] != null).map((k) => `[data-${k}="${d[k]}"]`).join('');
  }

  function render() {
    const keep = focusKey(document.activeElement);
    renderHeader();
    const views = { itinerary: renderItinerary, map: renderMapView, budget: renderBudget, setup: renderSetup };
    document.querySelectorAll('.view').forEach((v) => { v.hidden = v.id !== 'view-' + ui.tab; });
    views[ui.tab](trip(), $('#view-' + ui.tab));
    if (ui.tab === 'map') drawMap();
    if (keep) { const n = $('#view-' + ui.tab + ' ' + keep); if (n) n.focus(); }
  }

  /* ---------- 畫面:行程 ---------- */
  function renderItinerary(t, el) {
    const people = Planner.counts(t);
    const head = `
      <div class="summary">
        <div><strong>${esc(t.name)}</strong>${t.destination ? ' · ' + esc(t.destination) : ''}</div>
        <div class="muted">${t.startDate} → ${t.endDate}(${t.days.length} 天)· ${people.total} 人 · ${Planner.TRANSPORTS[t.transport]} · ${Planner.PACES[t.pace]}</div>
        <div class="row">
          <button data-action="gen-all">✨ 依設定產生推薦行程</button>
          <button data-action="expand-all">全部展開建議</button>
          <button data-action="collapse-all">全部收合</button>
        </div>
      </div>`;
    el.innerHTML = head + t.days.map((day, i) => renderDay(t, day, i)).join('');
  }

  function renderDay(t, day, i) {
    const tips = Planner.tipsFor(t, i, t.days.length);
    const g = Exporters.googleRouteUrl(day.items, t.transport);
    const a = Exporters.appleRouteUrl(day.items, t.transport);
    const chips = SECTIONS.map(([k, icon, label]) =>
      `<button class="chip" data-action="toggle-sec" data-day="${i}" data-sec="${k}" aria-pressed="${!!day.show[k]}">${icon} ${label}</button>`).join('');
    const panels = SECTIONS.filter(([k]) => day.show[k]).map(([k, icon, label]) => `
      <div class="panel">
        <h4>${icon} ${label}建議</h4>
        <ul>${tips[k].map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
        <textarea rows="2" placeholder="我的${label}筆記(班次、訂位、住宿資訊…)" data-change="day-note" data-day="${i}" data-sec="${k}">${esc(day.notes[k] || '')}</textarea>
      </div>`).join('');
    const routes = (g.url || a.url) ? `
      <span class="routes">路線:
        ${g.url ? `<a href="${esc(g.url)}" target="_blank" rel="noopener">Google 地圖</a>` : ''}
        ${a.url ? `<a href="${esc(a.url)}" target="_blank" rel="noopener">Apple 地圖</a>` : ''}
        ${g.truncated ? '<small class="warn">(景點過多,Google 路線僅含前 11 個定位點)</small>' : ''}
      </span>` : '<span class="muted small">為景點加上座標後可產生路線連結</span>';
    return `
      <section class="day" style="--c:${dayColor(i)}">
        <header>
          <h3>Day ${i + 1} <span class="muted">${dayDate(t, i)}</span></h3>
          <div class="chips">${chips}</div>
        </header>
        ${panels}
        <ul class="items" data-day="${i}">
          ${day.items.map((it, n) => renderItem(it, i, n, day.items.length)).join('') || '<li class="empty">尚無項目,按下方「新增」或用「產生推薦行程」。</li>'}
        </ul>
        <footer>
          <button data-action="add-item" data-day="${i}">＋ 新增項目</button>
          <button data-action="sort-day" data-day="${i}">依時間排序</button>
          ${routes}
        </footer>
      </section>`;
  }

  function renderItem(it, d, n, len) {
    const [icon, label] = TYPES[it.type] || TYPES.other;
    const gp = Exporters.googlePlaceUrl(it), ap = Exporters.applePlaceUrl(it);
    return `
      <li class="item" draggable="true" data-id="${it.id}">
        <span class="grip" title="拖曳排序">⋮⋮</span>
        <span class="time">${esc(it.time) || '--:--'}</span>
        <div class="main">
          <div class="title">${icon} ${esc(it.title) || '(未命名)'}${it.suggested ? ' <span class="tag">建議</span>' : ''}</div>
          <div class="meta">
            ${it.address ? `<span>${esc(it.address)}</span>` : ''}
            ${it.cost ? `<span>預估 ${money(it.cost)}</span>` : ''}
            ${it.note ? `<span>${esc(it.note)}</span>` : ''}
            ${gp ? `<a href="${esc(gp)}" target="_blank" rel="noopener">G</a>` : ''}
            ${ap ? `<a href="${esc(ap)}" target="_blank" rel="noopener">A</a>` : ''}
          </div>
        </div>
        <div class="ctl">
          <button data-action="up" data-id="${it.id}" aria-label="上移" ${n === 0 && d === 0 ? 'disabled' : ''}>↑</button>
          <button data-action="down" data-id="${it.id}" aria-label="下移" ${n === len - 1 ? 'disabled' : ''}>↓</button>
          <button data-action="edit-item" data-id="${it.id}" aria-label="編輯">✎</button>
          <button data-action="del-item" data-id="${it.id}" aria-label="刪除">🗑</button>
        </div>
      </li>`;
  }

  /* ---------- 項目對話框 ---------- */
  let editing = null; // {day, id|null}
  function openItemDialog(day, id) {
    const t = trip();
    const found = id ? findItem(t, id) : null;
    const it = found ? found.item : { time: '', type: 'sight', title: '', address: '', cost: '', note: '', lat: null, lng: null };
    editing = { day: found ? found.d : day, id: id || null };
    const f = $('#itemForm').elements;
    f.time.value = it.time || ''; f.type.value = it.type; f.title.value = it.title || '';
    f.address.value = it.address || ''; f.cost.value = it.cost || ''; f.note.value = it.note || '';
    f.lat.value = it.lat == null ? '' : it.lat; f.lng.value = it.lng == null ? '' : it.lng;
    $('#itemDialogTitle').textContent = `${id ? '編輯' : '新增'}項目 · Day ${editing.day + 1}`;
    $('#searchResults').innerHTML = '';
    $('#itemDialog').showModal();
  }

  async function searchPlace() {
    const f = $('#itemForm').elements;
    const q = (f.title.value || f.address.value).trim();
    const box = $('#searchResults');
    if (!q) { box.textContent = '請先輸入名稱或地址'; return; }
    box.textContent = '搜尋中…';
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&accept-language=zh-TW&q=${encodeURIComponent(q + (trip().destination ? ' ' + trip().destination : ''))}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(res.status);
      const list = await res.json();
      if (!list.length) { box.textContent = '找不到結果,可換個關鍵字,或手動輸入座標。'; return; }
      box.innerHTML = list.map((r, k) => `<button type="button" class="result" data-action="pick-result" data-k="${k}">${esc(r.display_name)}</button>`).join('');
      box._results = list;
    } catch (e) {
      box.textContent = '搜尋失敗(需要網路)。可手動輸入座標,或從 Google 地圖複製座標。';
    }
  }

  function saveItemForm() {
    const t = trip(), f = $('#itemForm').elements;
    const lat = f.lat.value.trim() === '' ? null : parseFloat(f.lat.value);
    const lng = f.lng.value.trim() === '' ? null : parseFloat(f.lng.value);
    const patch = {
      time: f.time.value, type: f.type.value, title: f.title.value.trim(), address: f.address.value.trim(),
      cost: num(f.cost.value), note: f.note.value.trim(),
      lat: Number.isFinite(lat) && lat >= -90 && lat <= 90 ? lat : null,
      lng: Number.isFinite(lng) && lng >= -180 && lng <= 180 ? lng : null,
      suggested: false,
    };
    if (patch.lat == null || patch.lng == null) { patch.lat = null; patch.lng = null; }
    if (editing.id) Object.assign(findItem(t, editing.id).item, patch);
    else t.days[editing.day].items.push(Object.assign({ id: uid() }, patch));
    save(); render();
  }

  /* ---------- 行程操作 ---------- */
  function moveItem(id, toDay, toBeforeId) {
    const t = trip(), from = findItem(t, id);
    if (!from) return;
    const [item] = t.days[from.d].items.splice(from.i, 1);
    const list = t.days[toDay].items;
    let idx = toBeforeId ? list.findIndex((x) => x.id === toBeforeId) : list.length;
    if (idx < 0) idx = list.length;
    list.splice(idx, 0, item);
    save(); render();
  }

  function stepItem(id, dir) {
    const t = trip(), f = findItem(t, id);
    if (!f) return;
    const list = t.days[f.d].items, j = f.i + dir;
    if (j >= 0 && j < list.length) { [list[f.i], list[j]] = [list[j], list[f.i]]; }
    else if (j < 0 && f.d > 0) { list.splice(f.i, 1); t.days[f.d - 1].items.push(f.item); }
    else if (j >= list.length && f.d < t.days.length - 1) { list.splice(f.i, 1); t.days[f.d + 1].items.unshift(f.item); }
    save(); render();
  }

  function generateAll() {
    const t = trip();
    const hasItems = t.days.some((d) => d.items.length);
    if (hasItems && !confirm('這會覆蓋所有天的現有項目,確定要重新產生嗎?\n(不想覆蓋可到「旅程設定」按「只補齊空白的天」)')) return;
    applyPlan(t, false);
  }
  function applyPlan(t, onlyEmpty) {
    t.days.forEach((day, i) => {
      if (onlyEmpty && day.items.length) return;
      day.items = Planner.suggestDay(t, i, t.days.length).map((s) => Object.assign({ id: uid(), address: '', cost: 0, lat: null, lng: null, suggested: true }, s));
    });
    save(); ui.tab = 'itinerary'; render();
  }

  /* ---------- 畫面:地圖 ---------- */
  let map = null, layer = null;
  function renderMapView(t, el) {
    el.innerHTML = `
      <div class="row">
        <label>顯示 <select data-change="map-day">
          <option value="all">全部天數</option>
          ${t.days.map((_, i) => `<option value="${i}" ${String(ui.mapDay) === String(i) ? 'selected' : ''}>Day ${i + 1} · ${dayDate(t, i)}</option>`).join('')}
        </select></label>
        <span class="muted small">點地圖空白處可直接新增地點;沒有座標的項目不會顯示。</span>
      </div>
      <div id="map" role="application" aria-label="旅程地圖"></div>
      <div id="mapLegend" class="legend"></div>`;
    map = null; // 容器重建,需重新初始化
  }

  function drawMap() {
    const el = $('#map'); const t = trip();
    if (!window.L) { el.innerHTML = '<p class="warn pad">地圖函式庫未載入。</p>'; return; }
    map = L.map(el).setView([25.04, 121.56], 5);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap contributors' }).addTo(map);
    layer = L.layerGroup().addTo(map);
    const bounds = [];
    const days = ui.mapDay === 'all' ? t.days.map((_, i) => i) : [+ui.mapDay];
    const legend = [];
    days.forEach((i) => {
      const pts = t.days[i].items.filter(Exporters.hasCoord);
      if (!pts.length) return;
      legend.push(`<span><i style="background:${dayColor(i)}"></i>Day ${i + 1}(${pts.length})</span>`);
      const latlngs = pts.map((p) => [+p.lat, +p.lng]);
      if (latlngs.length > 1) L.polyline(latlngs, { color: dayColor(i), weight: 3, opacity: 0.7, dashArray: '6 6' }).addTo(layer);
      pts.forEach((p, n) => {
        const icon = L.divIcon({ className: 'pin', html: `<span style="background:${dayColor(i)}">${n + 1}</span>`, iconSize: [26, 26], iconAnchor: [13, 13] });
        const gp = Exporters.googlePlaceUrl(p), ap = Exporters.applePlaceUrl(p);
        L.marker([+p.lat, +p.lng], { icon }).addTo(layer).bindPopup(
          `<strong>${esc(p.title)}</strong><br>${esc(p.time)} ${esc(p.address)}<br><a href="${esc(gp)}" target="_blank" rel="noopener">Google</a> · <a href="${esc(ap)}" target="_blank" rel="noopener">Apple</a>`);
        bounds.push([+p.lat, +p.lng]);
      });
    });
    $('#mapLegend').innerHTML = legend.join('') || '<span class="muted">尚無含座標的項目。</span>';
    if (bounds.length) map.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 });
    map.on('click', (e) => {
      const opts = t.days.map((_, i) => `<option value="${i}" ${ui.mapDay !== 'all' && +ui.mapDay === i ? 'selected' : ''}>Day ${i + 1}</option>`).join('');
      L.popup().setLatLng(e.latlng).setContent(`
        <div class="addpop">
          <input id="popTitle" placeholder="地點名稱" />
          <select id="popDay">${opts}</select>
          <button type="button" data-action="pop-add" data-lat="${e.latlng.lat.toFixed(6)}" data-lng="${e.latlng.lng.toFixed(6)}">加入行程</button>
        </div>`).openOn(map);
    });
    setTimeout(() => map && map.invalidateSize(), 0);
  }

  /* ---------- 畫面:預算 ---------- */
  function renderBudget(t, el) {
    const s = budgetStats(t);
    const total = +t.budget.total || 0;
    const pct = total > 0 ? Math.min(100, (s.spent / total) * 100) : 0;
    const people = Planner.counts(t).total || 1;
    const used = [...new Set(t.expenses.map((e) => e.currency).concat(Object.keys(t.rates)))].filter((c) => c && c !== t.baseCurrency);
    const ed = ui.editingExpense ? t.expenses.find((e) => e.id === ui.editingExpense) : null;
    const curOpts = (sel) => CURRENCIES.concat(CURRENCIES.includes(t.baseCurrency) ? [] : [t.baseCurrency]).map((c) => `<option ${c === sel ? 'selected' : ''}>${c}</option>`).join('');
    const catOpts = (sel) => Object.entries(CATS).map(([k, v]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${v}</option>`).join('');
    el.innerHTML = `
      <div class="cards">
        <div class="card"><div class="muted">總預算(${esc(t.baseCurrency)})</div>
          <input type="number" min="0" step="any" value="${total || ''}" placeholder="0" data-change="budget-total" /></div>
        <div class="card"><div class="muted">已花費</div><div class="big">${money(s.spent)}</div></div>
        <div class="card"><div class="muted">剩餘</div><div class="big ${total && total - s.spent < 0 ? 'warn' : ''}">${total ? money(total - s.spent) : '—'}</div></div>
        <div class="card"><div class="muted">行程預估合計</div><div class="big">${money(s.planned)}</div></div>
        <div class="card"><div class="muted">每人平均花費(${people} 人)</div><div class="big">${money(s.spent / people)}</div></div>
      </div>
      ${total ? `<div class="bar" role="progressbar" aria-valuenow="${Math.round(pct)}" aria-valuemin="0" aria-valuemax="100"><div style="width:${pct}%" class="${s.spent > total ? 'over' : ''}"></div></div>` : ''}
      ${s.missing.length ? `<p class="warn">⚠ 尚未設定匯率:${s.missing.map(esc).join('、')}(這些花費暫不計入總額)</p>` : ''}

      <h3>匯率</h3>
      <p class="muted small">輸入「1 單位外幣 = 多少 ${esc(t.baseCurrency)}」。匯率由你自行輸入,不會自動連網更新。</p>
      <div class="row">${used.map((c) => `<label>${esc(c)} <input class="rate" type="number" min="0" step="any" value="${t.rates[c] || ''}" data-change="rate" data-cur="${esc(c)}" /></label>`).join('') || '<span class="muted">目前沒有外幣花費。</span>'}
        <label>新增幣別 <input class="rate" list="curlist" placeholder="如 JPY" data-change="add-rate" /></label>
      </div>

      <h3>${ed ? '編輯花費' : '新增花費'}</h3>
      <form id="expForm" class="row grid">
        <input type="date" name="date" value="${esc(ed ? ed.date : fmtISO(new Date()))}" aria-label="日期" />
        <select name="category" aria-label="類別">${catOpts(ed ? ed.category : 'food')}</select>
        <input name="title" placeholder="項目(如 拉麵午餐)" value="${esc(ed ? ed.title : '')}" required />
        <input name="amount" type="number" min="0" step="any" placeholder="金額" value="${ed ? ed.amount : ''}" required />
        <select name="currency" aria-label="幣別">${curOpts(ed ? ed.currency : t.baseCurrency)}</select>
        <button type="submit">${ed ? '更新' : '加入'}</button>
        ${ed ? '<button type="button" data-action="cancel-exp">取消</button>' : ''}
      </form>

      <h3>各類別</h3>
      <table class="tbl">
        <thead><tr><th>類別</th><th>分類預算(選填)</th><th>已花費</th></tr></thead>
        <tbody>${Object.entries(CATS).map(([k, v]) => {
          const b = +t.budget.cats[k] || 0, sp = s.byCat[k] || 0;
          return `<tr><td>${v}</td><td><input type="number" min="0" step="any" value="${b || ''}" data-change="cat-budget" data-cat="${k}" /></td><td class="${b && sp > b ? 'warn' : ''}">${money(sp)}</td></tr>`;
        }).join('')}</tbody>
      </table>

      <h3>花費明細</h3>
      <table class="tbl">
        <thead><tr><th>日期</th><th>類別</th><th>項目</th><th>金額</th><th></th></tr></thead>
        <tbody>${[...t.expenses].sort((a, b) => (a.date || '').localeCompare(b.date || '')).map((e) => `
          <tr><td>${esc(e.date)}</td><td>${CATS[e.category] || ''}</td><td>${esc(e.title)}</td>
          <td>${money(e.amount)} ${esc(e.currency)}${e.currency !== t.baseCurrency ? `<br><small class="muted">≈ ${money(toBase(t, +e.amount, e.currency).v)} ${esc(t.baseCurrency)}</small>` : ''}</td>
          <td class="nowrap"><button data-action="edit-exp" data-id="${e.id}" aria-label="編輯">✎</button> <button data-action="del-exp" data-id="${e.id}" aria-label="刪除">🗑</button></td></tr>`).join('') || '<tr><td colspan="5" class="muted">尚無花費紀錄。</td></tr>'}</tbody>
      </table>
      <datalist id="curlist">${CURRENCIES.map((c) => `<option value="${c}">`).join('')}</datalist>`;
  }

  /* ---------- 畫面:設定 ---------- */
  function renderSetup(t, el) {
    const m = t.members;
    el.innerHTML = `
      <form id="setupForm" class="setup" onsubmit="return false">
        <h3>旅程資料</h3>
        <label>旅程名稱 <input data-change="setup" data-k="name" value="${esc(t.name)}" /></label>
        <label>目的地 <input data-change="setup" data-k="destination" value="${esc(t.destination)}" placeholder="如 京都、台南" /></label>
        <div class="row">
          <label>出發日 <input type="date" data-change="setup" data-k="startDate" value="${t.startDate}" /></label>
          <label>回程日 <input type="date" data-change="setup" data-k="endDate" value="${t.endDate}" min="${t.startDate}" /></label>
          <label>主要幣別 <input data-change="setup" data-k="baseCurrency" list="curlist2" value="${esc(t.baseCurrency)}" size="6" /></label>
          <datalist id="curlist2">${CURRENCIES.map((c) => `<option value="${c}">`).join('')}</datalist>
        </div>

        <h3>推薦條件</h3>
        <div class="row">
          <label>成人 <input type="number" min="0" max="50" data-change="member" data-k="adults" value="${m.adults}" /></label>
          <label>孩童 <input type="number" min="0" max="50" data-change="member" data-k="children" value="${m.children}" /></label>
          <label>長輩 <input type="number" min="0" max="50" data-change="member" data-k="seniors" value="${m.seniors}" /></label>
        </div>
        <fieldset><legend>旅遊風格(可複選)</legend>
          ${Object.entries(Planner.STYLES).map(([k, v]) => `<label class="inline"><input type="checkbox" data-change="style" data-k="${k}" ${t.styles.includes(k) ? 'checked' : ''} /> ${v}</label>`).join('')}
        </fieldset>
        <div class="row">
          <label>交通類型 <select data-change="setup" data-k="transport">${Object.entries(Planner.TRANSPORTS).map(([k, v]) => `<option value="${k}" ${t.transport === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
          <label>行程步調 <select data-change="setup" data-k="pace">${Object.entries(Planner.PACES).map(([k, v]) => `<option value="${k}" ${t.pace === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
        </div>
        <div class="row">
          <button type="button" data-action="gen-all">✨ 產生推薦行程(覆蓋全部)</button>
          <button type="button" data-action="gen-empty">只補齊空白的天</button>
        </div>
        <p class="muted small">推薦是依規則產生的「活動類型」骨架(如「午餐」「博物館」),不含具體店名;請點開項目填入實際地點並搜尋座標。</p>

        <h3>危險區</h3>
        <button type="button" class="danger" data-action="del-trip">刪除這趟旅程</button>
      </form>`;
  }

  /* ---------- 列印 / PDF ---------- */
  function buildPrint() {
    const t = trip(), o = ui.exportOpts, p = Planner.counts(t), s = budgetStats(t);
    const days = t.days.map((day, i) => {
      const tips = Planner.tipsFor(t, i, t.days.length);
      const secs = SECTIONS.filter(([k]) => o.allTips || day.show[k] || day.notes[k]).map(([k, icon, label]) => {
        const showTips = o.allTips || day.show[k];
        return `<div class="psec"><strong>${icon} ${label}</strong>${showTips ? `<ul>${tips[k].map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}${day.notes[k] ? `<p>${esc(day.notes[k])}</p>` : ''}</div>`;
      }).join('');
      const g = Exporters.googleRouteUrl(day.items, t.transport);
      return `
        <section class="pday">
          <h2>Day ${i + 1} · ${dayDate(t, i)}</h2>
          <table><thead><tr><th>時間</th><th>項目</th><th>地址/備註</th><th>預估</th></tr></thead><tbody>
          ${day.items.map((it) => `<tr><td>${esc(it.time)}</td><td>${(TYPES[it.type] || TYPES.other)[0]} ${esc(it.title)}</td><td>${esc(it.address)}${it.address && it.note ? '<br>' : ''}${esc(it.note)}</td><td>${it.cost ? money(it.cost) : ''}</td></tr>`).join('') || '<tr><td colspan="4">(尚無項目)</td></tr>'}
          </tbody></table>
          ${g.url ? `<p class="small">當日路線:${esc(g.url)}</p>` : ''}
          ${secs}
        </section>`;
    }).join('');
    const budget = o.budget ? `
      <section class="pday">
        <h2>預算摘要(${esc(t.baseCurrency)})</h2>
        <table><tbody>
          <tr><td>總預算</td><td>${t.budget.total ? money(t.budget.total) : '—'}</td></tr>
          <tr><td>行程預估合計</td><td>${money(s.planned)}</td></tr>
          <tr><td>已花費</td><td>${money(s.spent)}</td></tr>
          ${Object.entries(CATS).filter(([k]) => s.byCat[k]).map(([k, v]) => `<tr><td>　${v}</td><td>${money(s.byCat[k])}</td></tr>`).join('')}
        </tbody></table>
      </section>` : '';
    $('#printArea').innerHTML = `
      <h1>${esc(t.name)}</h1>
      <p>${t.destination ? esc(t.destination) + ' · ' : ''}${t.startDate} → ${t.endDate}(${t.days.length} 天)· 成人 ${p.adults} 孩童 ${p.children} 長輩 ${p.seniors} · ${Planner.TRANSPORTS[t.transport]}</p>
      ${days}${budget}`;
  }
  window.addEventListener('beforeprint', buildPrint);

  /* ---------- 事件 ---------- */
  document.addEventListener('click', async (ev) => {
    const b = ev.target.closest('[data-action]');
    if (!b) return;
    const t = trip(), a = b.dataset.action, d = +b.dataset.day, id = b.dataset.id;
    switch (a) {
      case 'new-trip': {
        const nt = normalizeTrip(newTrip({ name: '新旅程' }));
        data.trips.push(nt); data.currentId = nt.id; ui.tab = 'setup'; save(); render(); break;
      }
      case 'open-export': $('#exportDialog').showModal(); break;
      case 'do-print': $('#exportDialog').close(); window.print(); break;
      case 'do-kml': Exporters.download(`${t.name || 'trip'}.kml`, Exporters.toKml(t, dayLabel(t)), 'application/vnd.google-earth.kml+xml'); break;
      case 'do-json': Exporters.download(`${t.name || 'trip'}.json`, JSON.stringify(t, null, 2), 'application/json'); break;
      case 'do-json-all': Exporters.download('travel-planner-backup.json', JSON.stringify(data, null, 2), 'application/json'); break;
      case 'close-dialog': b.closest('dialog').close(); break;
      case 'toggle-sec': { const day = t.days[d]; day.show[b.dataset.sec] = !day.show[b.dataset.sec]; save(); render(); break; }
      case 'expand-all': t.days.forEach((day) => SECTIONS.forEach(([k]) => (day.show[k] = true))); save(); render(); break;
      case 'collapse-all': t.days.forEach((day) => SECTIONS.forEach(([k]) => (day.show[k] = false))); save(); render(); break;
      case 'add-item': openItemDialog(d, null); break;
      case 'edit-item': openItemDialog(0, id); break;
      case 'del-item': { const f = findItem(t, id); if (f && confirm(`刪除「${f.item.title || '此項目'}」?`)) { t.days[f.d].items.splice(f.i, 1); save(); render(); } break; }
      case 'up': stepItem(id, -1); break;
      case 'down': stepItem(id, 1); break;
      case 'sort-day': t.days[d].items.sort((x, y) => (x.time || '99:99').localeCompare(y.time || '99:99')); save(); render(); break;
      case 'gen-all': generateAll(); break;
      case 'gen-empty': applyPlan(t, true); break;
      case 'search-place': searchPlace(); break;
      case 'pick-result': {
        const r = $('#searchResults')._results[+b.dataset.k], f = $('#itemForm').elements;
        f.lat.value = (+r.lat).toFixed(6); f.lng.value = (+r.lon).toFixed(6);
        if (!f.address.value) f.address.value = r.display_name;
        if (!f.title.value) f.title.value = r.name || r.display_name.split(',')[0];
        $('#searchResults').innerHTML = `<span class="muted">已套用座標 ${f.lat.value}, ${f.lng.value}</span>`;
        break;
      }
      case 'pop-add': {
        const title = ($('#popTitle').value || '').trim() || '新地點', day = +$('#popDay').value;
        t.days[day].items.push({ id: uid(), time: '', type: 'sight', title, address: '', cost: 0, note: '', lat: +b.dataset.lat, lng: +b.dataset.lng });
        save(); render(); break;
      }
      case 'edit-exp': ui.editingExpense = id; render(); break;
      case 'cancel-exp': ui.editingExpense = null; render(); break;
      case 'del-exp': if (confirm('刪除這筆花費?')) { t.expenses = t.expenses.filter((e) => e.id !== id); save(); render(); } break;
      case 'del-trip':
        if (confirm(`確定刪除「${t.name}」?此動作無法復原(建議先匯出 JSON)。`)) {
          data.trips = data.trips.filter((x) => x.id !== t.id);
          if (!data.trips.length) data.trips.push(normalizeTrip(newTrip()));
          data.currentId = data.trips[0].id; ui.tab = 'itinerary'; save(); render();
        }
        break;
      default:
    }
  });

  document.querySelectorAll('.tabs button').forEach((b) => b.addEventListener('click', () => { ui.tab = b.dataset.tab; render(); }));
  $('#tripSelect').addEventListener('change', (e) => { data.currentId = e.target.value; save(); render(); });

  document.addEventListener('change', (ev) => {
    const el = ev.target, kind = el.dataset.change, t = trip();
    if (!kind) return;
    switch (kind) {
      case 'day-note': t.days[+el.dataset.day].notes[el.dataset.sec] = el.value; save(); return;
      case 'map-day': ui.mapDay = el.value; render(); return;
      case 'budget-total': t.budget.total = num(el.value); save(); render(); return;
      case 'cat-budget': t.budget.cats[el.dataset.cat] = num(el.value); save(); return;
      case 'rate': t.rates[el.dataset.cur] = num(el.value); save(); render(); return;
      case 'add-rate': {
        const c = el.value.trim().toUpperCase();
        if (c && c !== t.baseCurrency) { if (!(c in t.rates)) t.rates[c] = 0; save(); render(); }
        return;
      }
      case 'member': t.members[el.dataset.k] = Math.max(0, Math.floor(num(el.value))); save(); return;
      case 'style': {
        const k = el.dataset.k;
        t.styles = el.checked ? [...new Set([...t.styles, k])] : t.styles.filter((x) => x !== k);
        save(); return;
      }
      case 'setup': {
        const k = el.dataset.k;
        let v = el.value;
        if (k === 'baseCurrency') v = v.trim().toUpperCase() || 'TWD';
        t[k] = v;
        if (k === 'startDate' || k === 'endDate') {
          if (!t.startDate) t.startDate = fmtISO(new Date());
          if (k === 'startDate' && t.endDate < t.startDate) t.endDate = t.startDate;
          if (k === 'endDate' && t.endDate < t.startDate) t.endDate = t.startDate;
          if (diffDays(t.startDate, t.endDate) + 1 > 60) { t.endDate = addDays(t.startDate, 59); alert('最多支援 60 天'); }
          const lost = t.days.slice(diffDays(t.startDate, t.endDate) + 1).some((d) => d.items.length);
          if (lost && !confirm('縮短天數會刪除後面幾天已有的項目,確定嗎?')) { t.endDate = addDays(t.startDate, t.days.length - 1); }
          syncDays(t);
        }
        save(); if (k === 'startDate' || k === 'endDate') render(); else renderHeader(); return;
      }
      default:
    }
  });

  document.addEventListener('submit', (ev) => {
    const f = ev.target;
    if (f.id === 'expForm') {
      ev.preventDefault();
      const t = trip(), v = Object.fromEntries(new FormData(f));
      const rec = { date: v.date, category: v.category, title: v.title.trim(), amount: num(v.amount), currency: v.currency };
      if (ui.editingExpense) Object.assign(t.expenses.find((e) => e.id === ui.editingExpense), rec);
      else t.expenses.push(Object.assign({ id: uid() }, rec));
      ui.editingExpense = null; save(); render();
    }
  });

  $('#itemForm').addEventListener('submit', (ev) => {
    ev.preventDefault();
    saveItemForm();
    $('#itemDialog').close();
  });
  $('#itemForm').addEventListener('keydown', (ev) => { if (ev.key === 'Enter' && ev.target.name === 'title') { ev.preventDefault(); searchPlace(); } });

  $('#optBudget').addEventListener('change', (e) => { ui.exportOpts.budget = e.target.checked; });
  $('#optTips').addEventListener('change', (e) => { ui.exportOpts.allTips = e.target.checked; });

  $('#importFile').addEventListener('change', async (ev) => {
    const file = ev.target.files[0];
    ev.target.value = '';
    if (!file) return;
    try {
      const raw = JSON.parse(await file.text());
      const list = Array.isArray(raw.trips) ? raw.trips : (raw && Array.isArray(raw.days) ? [raw] : null);
      if (!list) throw new Error('格式不符');
      const added = list.map((x) => normalizeTrip(Object.assign({}, x, { id: uid() })));
      data.trips.push(...added); data.currentId = added[0].id;
      save(); $('#exportDialog').close(); render();
      alert(`已匯入 ${added.length} 趟旅程。`);
    } catch (e) {
      alert('匯入失敗:檔案不是有效的旅程 JSON。');
    }
  });

  /* 拖曳排序 */
  let dragId = null;
  document.addEventListener('dragstart', (ev) => {
    const li = ev.target.closest && ev.target.closest('li.item');
    if (!li) return;
    dragId = li.dataset.id;
    ev.dataTransfer.effectAllowed = 'move';
    ev.dataTransfer.setData('text/plain', dragId);
    li.classList.add('dragging');
  });
  document.addEventListener('dragend', () => { dragId = null; document.querySelectorAll('.dragging,.over').forEach((n) => n.classList.remove('dragging', 'over')); });
  document.addEventListener('dragover', (ev) => {
    if (!dragId) return;
    const list = ev.target.closest && ev.target.closest('ul.items');
    if (!list) return;
    ev.preventDefault();
    document.querySelectorAll('.over').forEach((n) => n.classList.remove('over'));
    (ev.target.closest('li.item') || list).classList.add('over');
  });
  document.addEventListener('drop', (ev) => {
    if (!dragId) return;
    const list = ev.target.closest && ev.target.closest('ul.items');
    if (!list) return;
    ev.preventDefault();
    const target = ev.target.closest('li.item');
    const id = dragId;
    dragId = null;
    if (target && target.dataset.id === id) { render(); return; }
    moveItem(id, +list.dataset.day, target ? target.dataset.id : null);
  });

  render();
})();
