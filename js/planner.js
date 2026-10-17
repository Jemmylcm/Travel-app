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

  global.Planner = { STYLES, TRANSPORTS, PACES, suggestDay, tipsFor, counts };
})(window);
