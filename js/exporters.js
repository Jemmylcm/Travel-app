/* 地圖連結與檔案匯出:Google Maps / Apple Maps 連結、KML(可匯入 Google 我的地圖)、JSON 備份 */
(function (global) {
  'use strict';

  const hasCoord = (it) => Number.isFinite(+it.lat) && Number.isFinite(+it.lng) && it.lat !== '' && it.lng !== '' && it.lat != null && it.lng != null;
  const pt = (it) => `${(+it.lat).toFixed(6)},${(+it.lng).toFixed(6)}`;

  const GOOGLE_MODE = { transit: 'transit', car: 'driving', walk: 'walking', bike: 'bicycling', mixed: 'transit' };
  const APPLE_FLAG = { transit: 'r', car: 'd', walk: 'w', bike: 'w', mixed: 'r' };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  /** 單一地點 */
  function googlePlaceUrl(it) {
    if (hasCoord(it)) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(pt(it))}`;
    const q = [it.title, it.address].filter(Boolean).join(' ');
    return q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` : '';
  }
  function applePlaceUrl(it) {
    if (hasCoord(it)) return `https://maps.apple.com/?ll=${pt(it)}&q=${encodeURIComponent(it.title || '地點')}`;
    const q = [it.title, it.address].filter(Boolean).join(' ');
    return q ? `https://maps.apple.com/?q=${encodeURIComponent(q)}` : '';
  }

  /** 一日路線(Google 最多 9 個中繼點,超過會被截斷並回報) */
  function googleRouteUrl(items, transport) {
    const pts = items.filter(hasCoord);
    if (pts.length < 2) return { url: '', truncated: false };
    const maxPts = 11; // 起點 + 9 中繼 + 終點
    const used = pts.slice(0, maxPts);
    const origin = used[0], dest = used[used.length - 1];
    const wps = used.slice(1, -1).map(pt).join('|');
    let url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(pt(origin))}&destination=${encodeURIComponent(pt(dest))}`;
    if (wps) url += `&waypoints=${encodeURIComponent(wps)}`;
    url += `&travelmode=${GOOGLE_MODE[transport] || 'driving'}`;
    return { url, truncated: pts.length > maxPts };
  }
  function appleRouteUrl(items, transport) {
    const pts = items.filter(hasCoord);
    if (pts.length < 2) return { url: '', truncated: false };
    const [start, ...rest] = pts;
    const daddr = rest.map(pt).join('+to:');
    return {
      url: `https://maps.apple.com/?saddr=${pt(start)}&daddr=${daddr}&dirflg=${APPLE_FLAG[transport] || 'd'}`,
      truncated: false,
    };
  }

  /** KML:每天一個資料夾 + 當日路線線條。Google「我的地圖」可直接匯入 */
  function toKml(trip, dayLabel) {
    const folders = trip.days.map((day, i) => {
      const pts = day.items.filter(hasCoord);
      if (!pts.length) return '';
      const marks = pts.map((it) => `
      <Placemark>
        <name>${esc(it.time ? it.time + ' ' : '')}${esc(it.title)}</name>
        <description>${esc([it.address, it.note].filter(Boolean).join('\n'))}</description>
        <Point><coordinates>${(+it.lng).toFixed(6)},${(+it.lat).toFixed(6)},0</coordinates></Point>
      </Placemark>`).join('');
      const line = pts.length > 1 ? `
      <Placemark>
        <name>${esc(dayLabel(i))} 路線</name>
        <LineString><tessellate>1</tessellate><coordinates>${pts.map((it) => `${(+it.lng).toFixed(6)},${(+it.lat).toFixed(6)},0`).join(' ')}</coordinates></LineString>
      </Placemark>` : '';
      return `
    <Folder>
      <name>${esc(dayLabel(i))}</name>${marks}${line}
    </Folder>`;
    }).join('');
    return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${esc(trip.name)}</name>${folders}
  </Document>
</kml>
`;
  }

  // Artifact 內只能透過 downloads 能力存檔,且只允許少數副檔名(不含 kml)
  const SAVEABLE = /\.(json|txt|md|csv|html|pdf)$/i;

  async function getDownloads() {
    try { return window.claude && window.claude.use ? await window.claude.use('downloads') : null; } catch (e) { return null; }
  }

  /** 回傳 {ok, reason}:reason 為 'format'(此環境不支援該格式)、'declined' 或 'error' */
  async function download(filename, text, mime) {
    const dl = await getDownloads();
    if (dl) {
      if (!SAVEABLE.test(filename)) return { ok: false, reason: 'format' };
      try { await dl.save({ filename, data: text }); return { ok: true }; }
      catch (e) { return { ok: false, reason: e && e.code === 'declined' ? 'declined' : 'error' }; }
    }
    const blob = new Blob([text], { type: mime || 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    return { ok: true };
  }

  global.Exporters = { hasCoord, googlePlaceUrl, applePlaceUrl, googleRouteUrl, appleRouteUrl, toKml, download };
})(window);
