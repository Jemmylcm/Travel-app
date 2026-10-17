/* 規則式行程推薦:依成員、旅遊風格、交通類型、步調產生每日建議。
   不連網、不會編造店名;產生的是「活動類型」骨架,具體地點由使用者填入。 */
(function (global) {
  'use strict';

  const STYLES = {
    culture: '人文歷史',
    nature: '自然景觀',
    food: '美食探索',
    shopping: '購物逛街',
    family: '親子同樂',
    relax: '悠閒放鬆',
  };

  const TRANSPORTS = {
    transit: '大眾運輸',
    car: '自駕',
    walk: '步行為主',
    bike: '單車/機車',
    mixed: '混合',
  };

  const PACES = { relaxed: '悠閒', normal: '適中', packed: '緊湊' };

  // walk: 1 輕鬆 2 普通 3 吃力;kid: 適合帶小孩
  const ACTIVITIES = {
    culture: [
      { t: '參觀博物館或美術館', slot: 'am', walk: 1, kid: true },
      { t: '走訪古蹟與歷史街區', slot: 'am', walk: 2, kid: false },
      { t: '寺廟/教堂/神社巡禮', slot: 'pm', walk: 2, kid: true },
      { t: '在地文化體驗(工藝、導覽或表演)', slot: 'pm', walk: 1, kid: true },
      { t: '傳統市集與老街散步', slot: 'pm', walk: 2, kid: true },
      { t: '夜間文化表演或夜景', slot: 'eve', walk: 1, kid: false },
    ],
    nature: [
      { t: '健行步道或自然公園', slot: 'am', walk: 3, kid: false },
      { t: '湖泊/海岸/瀑布景點', slot: 'am', walk: 2, kid: true },
      { t: '觀景台看風景', slot: 'pm', walk: 1, kid: true },
      { t: '植物園或花園', slot: 'pm', walk: 1, kid: true },
      { t: '日落/夜景觀賞點', slot: 'eve', walk: 1, kid: true },
      { t: '溫泉或自然療癒行程', slot: 'eve', walk: 1, kid: false },
    ],
    food: [
      { t: '早市或市場早餐巡禮', slot: 'am', walk: 1, kid: true },
      { t: '在地料理課程或工廠參觀', slot: 'am', walk: 1, kid: true },
      { t: '甜點/咖啡廳小歇', slot: 'pm', walk: 1, kid: true },
      { t: '街頭小吃一條街', slot: 'pm', walk: 2, kid: true },
      { t: '特色酒吧或夜市', slot: 'eve', walk: 2, kid: false },
    ],
    shopping: [
      { t: '百貨商場/購物中心', slot: 'am', walk: 1, kid: true },
      { t: '特色商店街', slot: 'pm', walk: 2, kid: true },
      { t: '藥妝/伴手禮採買', slot: 'pm', walk: 1, kid: true },
      { t: '暢貨中心(Outlet)', slot: 'pm', walk: 2, kid: true },
      { t: '夜市或夜間商圈', slot: 'eve', walk: 2, kid: false },
    ],
    family: [
      { t: '動物園/水族館/科學館', slot: 'am', walk: 2, kid: true },
      { t: '主題樂園或遊樂場', slot: 'am', walk: 2, kid: true },
      { t: '親子農場或手作體驗', slot: 'pm', walk: 1, kid: true },
      { t: '公園野餐與放電', slot: 'pm', walk: 1, kid: true },
      { t: '兒童博物館', slot: 'pm', walk: 1, kid: true },
    ],
    relax: [
      { t: '飯店晚起,享用早午餐', slot: 'am', walk: 1, kid: true },
      { t: '咖啡廳或書店發呆', slot: 'am', walk: 1, kid: true },
      { t: '海邊/公園慢走', slot: 'pm', walk: 1, kid: true },
      { t: 'SPA/按摩/泡湯', slot: 'pm', walk: 1, kid: false },
      { t: '河岸或夜景散步', slot: 'eve', walk: 1, kid: true },
    ],
  };

  const SLOT_PLANS = {
    relaxed: [
      ['10:00', 'am'], ['12:30', 'lunch'], ['15:00', 'pm'], ['18:30', 'dinner'],
    ],
    normal: [
      ['09:00', 'am'], ['12:00', 'lunch'], ['14:00', 'pm'], ['16:30', 'pm'], ['18:30', 'dinner'],
    ],
    packed: [
      ['08:30', 'am'], ['10:30', 'am'], ['12:00', 'lunch'], ['13:30', 'pm'], ['16:00', 'pm'],
      ['18:00', 'dinner'], ['20:00', 'eve'],
    ],
  };

  function counts(trip) {
    const m = trip.members || {};
    const adults = +m.adults || 0, children = +m.children || 0, seniors = +m.seniors || 0;
    return { adults, children, seniors, total: adults + children + seniors };
  }

  function pickActivity(trip, slot, usedIdx, dayIdx) {
    const { children, seniors } = counts(trip);
    const styles = (trip.styles && trip.styles.length ? trip.styles : ['culture', 'food']);
    const candidates = [];
    styles.forEach((s) => (ACTIVITIES[s] || []).forEach((a) => candidates.push(a)));
    let pool = candidates.filter((a) => a.slot === slot || (slot === 'am' && a.slot === 'pm'));
    if (children) pool = pool.filter((a) => a.kid);
    if (seniors) pool = pool.filter((a) => a.walk <= 2);
    if (trip.transport === 'walk') pool = pool.filter((a) => a.walk <= 2);
    if (!pool.length) pool = candidates;
    if (!pool.length) return null;
    // 以天數位移輪替,避免每天都一樣;已用過的略過
    for (let i = 0; i < pool.length; i++) {
      const a = pool[(dayIdx + usedIdx.n + i) % pool.length];
      if (!usedIdx.set.has(a.t)) {
        usedIdx.set.add(a.t);
        usedIdx.n++;
        return a;
      }
    }
    usedIdx.n++;
    return pool[(dayIdx + usedIdx.n) % pool.length];
  }

  /** 產生單日建議項目(不含 id,由呼叫端補上) */
  function suggestDay(trip, dayIdx, totalDays) {
    const items = [];
    const first = dayIdx === 0, last = dayIdx === totalDays - 1 && totalDays > 1;
    const { children, seniors } = counts(trip);
    const used = { set: new Set(), n: 0 };
    let plan = SLOT_PLANS[trip.pace] || SLOT_PLANS.normal;

    if (first) {
      items.push({ time: '10:00', type: 'transport', title: '前往目的地/抵達', note: '確認班次與行李' });
      items.push({ time: '14:00', type: 'lodging', title: '飯店寄放行李或入住', note: '' });
      plan = plan.filter(([time]) => time >= '14:00');
    }
    if (last) {
      plan = plan.filter(([time]) => time <= '13:30');
    }

    plan.forEach(([time, slot]) => {
      if (slot === 'lunch') {
        items.push({ time, type: 'food', title: '午餐:在地特色餐廳', note: children ? '備兒童餐具/不辣選項' : '' });
      } else if (slot === 'dinner') {
        items.push({ time, type: 'food', title: '晚餐:餐廳(建議先訂位)', note: '' });
      } else {
        const a = pickActivity(trip, slot, used, dayIdx);
        if (a) items.push({ time, type: 'sight', title: a.t, note: '' });
      }
    });

    if (children || seniors) {
      // 午休:插在午餐後
      const idx = items.findIndex((i) => i.type === 'food' && i.time < '13:00');
      if (idx >= 0 && !first) {
        items.splice(idx + 1, 0, { time: '13:15', type: 'other', title: '休息/午睡時間', note: children ? '小孩補眠、補充水分' : '長輩休息' });
      }
    }
    if (last) {
      items.push({ time: '11:00', type: 'lodging', title: '退房', note: '' });
      items.push({ time: '15:00', type: 'transport', title: '前往機場/車站返程', note: '預留提早抵達時間' });
    }
    items.sort((a, b) => a.time.localeCompare(b.time));
    return items;
  }

  /** 每日「交通、餐飲、住宿」建議文字,供使用者按需展開 */
  function tipsFor(trip, dayIdx, totalDays) {
    const c = counts(trip);
    const first = dayIdx === 0, last = dayIdx === totalDays - 1 && totalDays > 1;
    const transport = [], food = [], lodging = [];

    switch (trip.transport) {
      case 'transit':
        transport.push('先查好票卡/多日券是否划算,並確認末班車時間。');
        transport.push('同一天的景點盡量沿同方向或同區域安排,減少轉乘。');
        break;
      case 'car':
        transport.push('預先確認各景點的停車場與費用;單日駕駛時間建議不超過約 4 小時。');
        transport.push('確認租車保險、油費/過路費,以及駕照(國際駕照)是否合規。');
        break;
      case 'walk':
        transport.push('景點集中在同一區域,單日步行量約 8,000~15,000 步為宜,穿舒適鞋款。');
        break;
      case 'bike':
        transport.push('確認天氣與路況,規劃有停放處的景點;騎乘務必戴安全帽並留意當地交通規則。');
        break;
      default:
        transport.push('混合交通:長距離用大眾運輸/自駕,市區內以步行或短程計程車銜接。');
    }
    if (c.children) transport.push('帶小孩:準備嬰兒車/背帶,安排較短的移動時段,車上備零食玩具。');
    if (c.seniors) transport.push('有長輩:減少階梯與長距離步行,必要時搭計程車,並預留休息點。');
    if (c.total >= 4 && trip.transport !== 'car') transport.push(`${c.total} 人同行:短程可分攤計程車或預約大車,可能比大眾運輸更省時。`);
    if (first) transport.push('抵達日:確認機場/車站到住宿的接駁方式與所需時間。');
    if (last) transport.push('返程日:預留提早抵達機場/車站的時間(國際線建議 2~3 小時)。');

    food.push('熱門餐廳先查營業時間與公休日,避開用餐尖峰或事先訂位。');
    if (c.total >= 5) food.push(`${c.total} 人用餐:多數餐廳需提前訂位,並確認是否有包廂/大桌。`);
    if (c.children) food.push('帶小孩:確認兒童餐具/餐椅、避開過辣或生食。');
    if (c.seniors) food.push('有長輩:考慮口味清淡、座位舒適、少排隊的餐廳。');
    if ((trip.styles || []).includes('food')) food.push('美食行程:名店先預約,並預留排隊時間,午餐與晚餐間保留消化空檔。');
    if (!first && !last) food.push('早餐可利用住宿附近的在地早餐店或市場。');

    if (last) {
      lodging.push('今天退房:確認退房時間,並可寄放行李到出發前。');
    } else {
      const rooms = Math.max(1, Math.ceil(c.total / 2));
      lodging.push(`${c.total || 1} 人同行,約需 ${rooms} 間雙人房(依實際房型調整)。`);
      if (trip.transport === 'transit') lodging.push('選擇靠近車站/地鐵站的住宿,節省移動時間。');
      if (trip.transport === 'car') lodging.push('確認住宿附近有免費或可預約的停車位。');
      if (c.children) lodging.push('帶小孩:可考慮家庭房/連通房,並確認是否提供嬰兒床。');
      if (c.seniors) lodging.push('有長輩:優先選有電梯、浴室防滑的住宿。');
      if (first) lodging.push('入住日:確認入住時間;提早抵達可先寄放行李。');
      if (dayIdx > 0 && dayIdx % 3 === 0) lodging.push('連住多晚:若景點分散,可考慮換到不同區域住宿。');
    }
    return { transport, food, lodging };
  }

  /* ---------- 以 Claude 網路搜尋推薦:提示詞與回覆解析 ---------- */
  const ITEM_TYPES = ['sight', 'food', 'transport', 'lodging', 'shop', 'other'];
  const PER_DAY = { relaxed: 4, normal: 5, packed: 7 };

  /** 產生要貼給 Claude 的提示詞(請它先上網搜尋,再輸出固定格式的 JSON) */
  function buildPrompt(trip, dayDates) {
    const c = counts(trip);
    const n = trip.days.length;
    const cur = trip.baseCurrency || 'TWD';
    const styles = (trip.styles || []).map((s) => STYLES[s]).filter(Boolean).join('、') || '不限';
    const dates = (dayDates || []).map((d, i) => `第 ${i + 1} 天 ${d}`).join(';');
    return `請先使用網路搜尋,查詢最新資料,再為我規劃旅程。只推薦真實存在、目前仍在營業的景點與餐廳,不要編造。

【旅程】
- 目的地:${trip.destination || '(請填寫目的地)'}
- 日期:${trip.startDate} ~ ${trip.endDate},共 ${n} 天(${dates})
- 成員:成人 ${c.adults} 人、孩童 ${c.children} 人、長輩 ${c.seniors} 人
- 旅遊風格:${styles}
- 交通方式:${TRANSPORTS[trip.transport] || '不限'}
- 行程步調:${PACES[trip.pace] || '適中'}(每天約 ${PER_DAY[trip.pace] || 5} 個項目)
- 預算幣別:${cur}

【規劃要求】
1. 每天包含午餐與晚餐;同一天的景點在地理上相近、動線順暢,並考慮交通方式(例如大眾運輸要注意班次與轉乘)。
2. 有孩童要安排午休與適合的地點;有長輩要少走路、少階梯。
3. 每個項目寫完整地址,並在 note 簡述推薦理由與注意事項(營業時間、公休日、是否需預約、門票)。查不到或不確定的資訊請標明「需再確認」,不要猜。
4. lat、lng 只有在你確定時才填,否則填 null。
5. cost 為預估費用(數字,單位 ${cur}),不確定填 0。
6. source 填你參考的網址(可省略)。

【輸出格式】
只輸出一個 JSON 程式碼區塊,不要其他說明文字。days 必須剛好 ${n} 個,依序對應第 1 天到第 ${n} 天:
{"days":[{"items":[{"time":"09:00","type":"sight","title":"名稱","address":"完整地址","note":"說明","cost":0,"lat":null,"lng":null,"source":"網址"}]}]}
type 只能是 sight、food、transport、lodging、shop、other 其中之一。`;
  }

  function cleanItem(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const str = (v, max) => String(v == null ? '' : v).trim().slice(0, max);
    const title = str(raw.title, 120);
    if (!title) return null;
    const m = String(raw.time || '').match(/^(\d{1,2}):(\d{2})/);
    const time = m && +m[1] < 24 && +m[2] < 60 ? `${m[1].padStart(2, '0')}:${m[2]}` : '';
    const lat = typeof raw.lat === 'number' ? raw.lat : parseFloat(raw.lat);
    const lng = typeof raw.lng === 'number' ? raw.lng : parseFloat(raw.lng);
    const okGeo = Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);
    const source = str(raw.source, 200);
    const cost = parseFloat(raw.cost);
    return {
      time, title,
      type: ITEM_TYPES.includes(raw.type) ? raw.type : 'other',
      address: str(raw.address, 200),
      note: [str(raw.note, 500), source ? `來源:${source}` : ''].filter(Boolean).join(' '),
      cost: Number.isFinite(cost) && cost > 0 ? cost : 0,
      lat: okGeo ? lat : null,
      lng: okGeo ? lng : null,
    };
  }

  /** 解析 Claude 的回覆(容許前後有說明文字或 ```json 程式碼區塊)。失敗時丟出可顯示給使用者的 Error */
  function parsePlan(text, nDays) {
    const s = String(text || '').trim();
    if (!s) throw new Error('還沒有貼上 Claude 的回覆。');
    const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const body = fence ? fence[1] : s;
    const i = body.indexOf('{'), j = body.lastIndexOf('}');
    if (i < 0 || j <= i) throw new Error('找不到 JSON 內容,請確認貼上的是完整的回覆。');
    let obj;
    try { obj = JSON.parse(body.slice(i, j + 1)); } catch (e) { throw new Error('JSON 格式有誤(可能回覆被截斷),請請 Claude 重新輸出完整內容。'); }
    if (!obj || !Array.isArray(obj.days)) throw new Error('回覆缺少 days 陣列。');
    const warnings = [];
    if (obj.days.length !== nDays) warnings.push(`注意:回覆有 ${obj.days.length} 天,旅程是 ${nDays} 天,只匯入對得上的天數。`);
    const days = obj.days.slice(0, nDays).map((d) => (Array.isArray(d && d.items) ? d.items : []).map(cleanItem).filter(Boolean));
    return { days, warnings };
  }

  global.Planner = { STYLES, TRANSPORTS, PACES, suggestDay, tipsFor, counts, buildPrompt, parsePlan };
})(window);
