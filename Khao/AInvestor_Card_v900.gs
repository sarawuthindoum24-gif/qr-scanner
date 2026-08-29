function buildTerminalFlexCardV900_(cfg, d, decision, sr) {
  try {
    const currency = cfg.currency || 'USD';
    const action = decision.buyTier === 'FULL_BUY' ? 'BUY' : (decision.buyTier === 'TECH_BUY' ? 'TECH BUY' : 'WAIT');
    const conviction = Math.max(20, Math.min(99, Math.round(decision.confidence || 50)));
    const plan = decision.plan || null;
    const hasPlan = !!(plan && plan.total > 0 && plan.legs && plan.legs.length);
    const entry = hasPlan && plan.legs && plan.legs[0] ? plan.legs[0].price : sr.support;
    const entryLabel = action === 'WAIT' ? 'จุดรอเข้า' : 'จุดเข้าซื้อ';

    const bottom = buildTerminalBottomLineV890_(cfg, d, decision, hasPlan).join(' ');
    const status = buildTerminalStatusMapV900_(d, decision);
    const actionColor = action === 'BUY' ? '#22C55E' : (action === 'TECH BUY' ? '#FACC15' : '#F87171');

    return {
      type: 'flex',
      altText: 'AINVESTOR ' + cfg.symbol + ' ' + action,
      contents: {
        type: 'bubble',
        size: 'mega',
        styles: {
          body: { backgroundColor: '#111116' },
          footer: { backgroundColor: '#111116' }
        },
        body: {
          type: 'box',
          layout: 'vertical',
          paddingAll: '16px',
          spacing: 'md',
          backgroundColor: '#111116',
          contents: [
            {
              type: 'text',
              text: 'AINVESTOR TERMINAL PREMIUM',
              color: '#E8B24C',
              size: 'md',
              weight: 'bold'
            },
            {
              type: 'box',
              layout: 'horizontal',
              contents: [
                {
                  type: 'box',
                  layout: 'vertical',
                  flex: 5,
                  contents: [
                    { type: 'text', text: cfg.symbol, color: '#FFFFFF', size: '4xl', weight: 'bold' },
                    { type: 'text', text: 'ราคาปิด: ' + moneyV748_(d.last, currency), color: '#D1D5DB', size: 'md', wrap: true }
                  ]
                },
                {
                  type: 'box',
                  layout: 'vertical',
                  flex: 4,
                  alignItems: 'flex-end',
                  justifyContent: 'center',
                  contents: [
                    { type: 'text', text: 'ตลาดปิดทำการ', color: '#8B8B93', size: 'sm', align: 'end' },
                    { type: 'text', text: action + '  C' + conviction + '/100', color: actionColor, size: 'sm', weight: 'bold', align: 'end' }
                  ]
                }
              ]
            },
            {
              type: 'box',
              layout: 'horizontal',
              spacing: 'md',
              paddingTop: '4px',
              paddingBottom: '4px',
              contents: [
                {
                  type: 'box',
                  layout: 'vertical',
                  flex: 1,
                  contents: [
                    { type: 'text', text: 'แนวรับ', color: '#A7F3D0', size: 'xs' },
                    { type: 'text', text: moneyV748_(sr.support, currency), color: '#31D158', size: 'xl', weight: 'bold' },
                    { type: 'text', text: entryLabel + ' ' + moneyV748_(entry, currency), color: '#94A3B8', size: 'xxs', wrap: true }
                  ]
                },
                {
                  type: 'box',
                  layout: 'vertical',
                  flex: 1,
                  alignItems: 'flex-end',
                  contents: [
                    { type: 'text', text: 'แนวต้าน', color: '#FCA5A5', size: 'xs', align: 'end' },
                    { type: 'text', text: moneyV748_(sr.resistance, currency), color: '#FF4D6D', size: 'xl', weight: 'bold', align: 'end' },
                    { type: 'text', text: 'TP / SL ใช้ตามระบบ', color: '#94A3B8', size: 'xxs', align: 'end', wrap: true }
                  ]
                }
              ]
            },
            { type: 'separator', color: '#2B2B35' },

            { type: 'text', text: 'TREND RADAR', color: '#E8B24C', size: 'md', weight: 'bold' },
            {
              type: 'box',
              layout: 'vertical',
              backgroundColor: '#17171F',
              cornerRadius: '10px',
              paddingAll: '10px',
              spacing: 'xs',
              contents: [
                buildTrendRadarRowV910_('Day', d.last >= d.sma5, d.last >= d.sma5 ? 'ระยะสั้นแข็งแรง' : 'ระยะสั้นอ่อนตัว'),
                buildTrendRadarRowV910_('Week', d.last >= d.sma20, d.last >= d.sma20 ? 'ยืนเหนือ SMA20' : 'ต่ำกว่า SMA20'),
                buildTrendRadarRowV910_('Month', d.last >= d.sma50, d.last >= d.sma50 ? 'โครงสร้างยังดี' : 'โครงสร้างยังไม่ชัด')
              ]
            },

            { type: 'separator', color: '#2B2B35' },
            { type: 'text', text: 'TECHNICAL STATUS CODES', color: '#E8B24C', size: 'md', weight: 'bold' },
            buildTerminalStatusRowV900_('SMA', status.sma),
            buildTerminalStatusRowV900_('EMA', status.ema),
            buildTerminalStatusRowV900_('RSI', status.rsi),
            buildTerminalStatusRowV900_('Volatility', status.volatility),
            buildTerminalStatusRowV900_('Momentum', status.momentum),
            buildTerminalStatusRowV900_('News Gate', status.news),

            { type: 'separator', color: '#2B2B35' },
            { type: 'text', text: 'BOTTOM LINE ANALYSIS', color: '#E8B24C', size: 'md', weight: 'bold' },
            {
              type: 'text',
              text: bottom,
              color: '#F2F2F2',
              size: 'sm',
              wrap: true
            },
            { type: 'separator', color: '#2B2B35' },
            { type: 'text', text: 'NEWS GATE DETAILS', color: '#E8B24C', size: 'md', weight: 'bold' },
            buildNewsGateDetailsBoxV1000_(decision.news)
          ]
        },
        footer: {
          type: 'box',
          layout: 'vertical',
          paddingAll: '14px',
          backgroundColor: '#111116',
          contents: [
            { type: 'text', text: 'Disclaimer: ไม่ใช่คำแนะนำการลงทุน', color: '#7E7E88', size: 'xs', wrap: true }
          ]
        }
      }
    };
  } catch (err) {
    Logger.log('buildTerminalFlexCardV900_ error: ' + (err.stack || err));
    return null;
  }
}

function buildNewsGateDetailsBoxV1000_(news) {
  if (!news) {
    return {
      type: 'text',
      text: 'ไม่มีข้อมูลข่าว',
      color: '#A8A29E',
      size: 'xs'
    };
  }

  const contents = [];
  
  contents.push({
    type: 'box',
    layout: 'horizontal',
    contents: [
      { type: 'text', text: 'Status: ' + (news.status || 'NEUTRAL'), color: '#E2E8F0', size: 'xs', weight: 'bold', flex: 1 },
      { type: 'text', text: 'Score: ' + (news.ruleScore || 0), color: (news.ruleScore > 0 ? '#4ADE80' : (news.ruleScore < 0 ? '#F87171' : '#A8A29E')), size: 'xs', weight: 'bold', align: 'end', flex: 1 }
    ]
  });

  contents.push({
    type: 'text',
    text: 'ข่าวบวก: ' + (news.positiveCount || 0) + ' | ข่าวลบ: ' + (news.negativeCount || 0),
    color: '#94A3B8',
    size: 'xs'
  });

  if (news.warnings && news.warnings.length > 0) {
    contents.push({
      type: 'text',
      text: '⚠️ ' + news.warnings[0],
      color: '#FBBF24',
      size: 'xs',
      wrap: true
    });
  }

  if (news.topPositive && news.topPositive.length > 0) {
    contents.push({ type: 'text', text: '➕ ข่าวเด่นเชิงบวก:', color: '#4ADE80', size: 'xs', weight: 'bold', paddingTop: '4px' });
    news.topPositive.slice(0, 2).forEach(function(item) {
      contents.push({
        type: 'text',
        text: '• ' + truncateV748_(item.title, 45) + ' (' + item.source + ')',
        color: '#F1F5F9',
        size: 'xxs',
        wrap: true
      });
    });
  }

  if (news.topNegative && news.topNegative.length > 0) {
    contents.push({ type: 'text', text: '⚡ ข่าวเสี่ยงเชิงลบ:', color: '#F87171', size: 'xs', weight: 'bold', paddingTop: '4px' });
    news.topNegative.slice(0, 2).forEach(function(item) {
      contents.push({
        type: 'text',
        text: '• ' + truncateV748_(item.title, 45) + ' (' + item.source + ')',
        color: '#F1F5F9',
        size: 'xxs',
        wrap: true
      });
    });
  }

  const cacheAge = news.cacheAgeSeconds ? Math.round(news.cacheAgeSeconds) : 0;
  const staleText = news.stale ? 'STALE' : 'FRESH';
  contents.push({
    type: 'text',
    text: 'แคช: ' + cacheAge + ' วิ (' + staleText + ') | อัพเดท: ' + truncateV748_(news.latestNewsAt || '-', 16),
    color: '#64748B',
    size: 'xxs',
    paddingTop: '2px'
  });

  return {
    type: 'box',
    layout: 'vertical',
    spacing: 'xs',
    contents: contents
  };
}

function buildTrendRadarRowV910_(label, ok, detail) {
  return {
    type: 'box',
    layout: 'horizontal',
    contents: [
      { type: 'text', text: label, color: '#D8D8D8', size: 'sm', flex: 2 },
      { type: 'text', text: ok ? '🟢' : '🔴', color: '#FFFFFF', size: 'sm', align: 'center', flex: 1 },
      { type: 'text', text: detail, color: ok ? '#A7F3D0' : '#FCA5A5', size: 'xs', align: 'end', flex: 5, wrap: true }
    ]
  };
}

function buildTerminalStatusMapV900_(d, decision) {
  return {
    sma: d.last >= d.sma20 ? '🟢 ⬆️' : '🔴 ⬇️',
    ema: d.ema20 >= d.ema50 ? '🟢 🚀' : '🔴 ⬇️',
    rsi: d.rsi >= 70 ? '🔴 ⚠️' : (d.rsi < 30 ? '🟡 🔥' : '🟡 ✔️'),
    volatility: d.volatility > 0.055 ? '🔴 ⚡' : (d.volatility > 0.035 ? '🟡 ~' : '🟢 ✔️'),
    momentum: d.macdHist >= 0 ? '🟢 ▶️' : '🟡 ⏸️',
    news: decision.fastMode ? '⚪ FAST' : (decision.news ? (
      decision.news.status === 'POSITIVE' ? '🟢 POSITIVE' :
      decision.news.status === 'NEGATIVE' ? '🔴 NEGATIVE' :
      decision.news.status === 'CONFLICTING' ? '🟡 CONFLICT' :
      decision.news.status === 'NEUTRAL' ? '⚪ NEUTRAL' :
      decision.news.status === 'STALE' ? '⚠️ STALE' : '❌ UNAVAIL'
    ) : '❌ UNAVAIL')
  };
}

function buildTerminalStatusRowV900_(label, status) {
  return {
    type: 'box',
    layout: 'horizontal',
    spacing: 'sm',
    paddingTop: '2px',
    paddingBottom: '2px',
    contents: [
      { type: 'text', text: label, color: '#D8D8D8', size: 'md', flex: 4 },
      { type: 'text', text: status || '⚪', color: '#FFFFFF', size: 'md', align: 'end', flex: 2 }
    ]
  };
}

function rsiHealthTextV881_(r) {
  if (r == null || !isFinite(r)) return 'ข้อมูลไม่พอ';
  if (r < 30) return 'oversold / เริ่มน่าสนใจ';
  if (r >= 70) return 'ค่อนข้างร้อน';
  return 'momentum บวก';
}

function macdHealthTextV881_(d) {
  return d.macdHist >= 0 ? 'สัญญาณบวก 🟢' : 'เริ่มอ่อนแรง 🔴';
}

function volHealthTextV881_(v) {
  if (v > 0.055) return 'สูง 🔴';
  if (v > 0.035) return 'กลาง 🟡';
  return 'ต่ำ 🟢';
}

function buildProReasonsV881_(cfg, d, decision, hasPlan) {
  const reasons = [];

  if (d.last < d.ema20) {
    reasons.push('ราคาอยู่ต่ำกว่า EMA20');
  } else {
    reasons.push('ราคาอยู่เหนือ EMA20 ระยะสั้นยังพอแข็งแรง');
  }

  if (d.macdHist >= 0) {
    reasons.push('MACD กลับเป็นบวก / โมเมนตัมเริ่มดีขึ้น');
  } else {
    reasons.push('MACD ยังไม่กลับเป็นบวก');
  }

  if (decision.news && decision.news.gatePass) {
    reasons.push('News Gate ผ่าน');
  } else {
    reasons.push('News Gate ยังไม่ผ่าน');
  }

  const midTrendUp = d.ema20 >= d.ema50 && d.ema50 >= d.ema200;
  if (midTrendUp) {
    reasons.push(hasPlan ? 'แนวโน้มกลางยังดี รองรับการทยอยสะสม' : 'แนวโน้มกลางยังดี แต่ระยะสั้นยังไม่ยืนยัน');
  } else {
    reasons.push('แนวโน้มกลางยังไม่ชัดเจน ควรรอจังหวะ');
  }

  return reasons.slice(0, 4);
}

function trendBadgeV830_(isBull, label) {
  return label + ' ' + (isBull ? '🟢' : '🔴');
}

function convictionLabelV830_(v) {
  if (v >= 85) return 'สูงมาก';
  if (v >= 70) return 'สูง';
  if (v >= 55) return 'กลาง';
  return 'ระวัง';
}

function createQuickChartUrlV830_(cfg, d, decision, sr) {
  try {
    const close = (d.close || []).slice(-60);
    if (!close.length) return null;

    const labels = close.map(function(_, i) { return String(i + 1); });
    const fullClose = d.close || close;
    const ema20 = emaSeriesV748_(fullClose, 20).slice(-60);
    const ema50 = emaSeriesV748_(fullClose, 50).slice(-60);
    const ema200 = emaSeriesV748_(fullClose, Math.min(200, fullClose.length)).slice(-60);

    const plan = decision.plan || {};
    const entry = plan.legs && plan.legs[0] ? plan.legs[0].price : sr.support;
    const tp = sr.resistance;
    const sl = plan.legs && plan.legs[1] ? Math.min(plan.legs[1].price, sr.support * 0.98) : sr.support * 0.98;
    const support = sr.support;
    const resistance = sr.resistance;

    const pad = function(v) {
      return close.map(function() { return roundNumV830_(v, 2); });
    };

    const chart = {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: cfg.symbol,
            data: close.map(function(x) { return roundNumV830_(x, 2); }),
            borderColor: '#E5E7EB',
            backgroundColor: 'rgba(255,255,255,0.03)',
            borderWidth: 3,
            pointRadius: 0,
            lineTension: 0.12,
            fill: false
          },
          {
            label: 'EMA20',
            data: ema20.map(function(x) { return roundNumV830_(x, 2); }),
            borderColor: '#60A5FA',
            backgroundColor: 'rgba(0,0,0,0)',
            borderWidth: 2,
            pointRadius: 0,
            lineTension: 0.12,
            fill: false
          },
          {
            label: 'EMA50',
            data: ema50.map(function(x) { return roundNumV830_(x, 2); }),
            borderColor: '#FB923C',
            backgroundColor: 'rgba(0,0,0,0)',
            borderWidth: 2,
            pointRadius: 0,
            lineTension: 0.12,
            fill: false
          },
          {
            label: 'EMA200',
            data: ema200.map(function(x) { return roundNumV830_(x, 2); }),
            borderColor: '#A78BFA',
            backgroundColor: 'rgba(0,0,0,0)',
            borderWidth: 2,
            pointRadius: 0,
            lineTension: 0.12,
            fill: false
          },
          {
            label: 'Entry',
            data: pad(entry),
            borderColor: '#22C55E',
            backgroundColor: 'rgba(0,0,0,0)',
            borderDash: [8, 5],
            borderWidth: 2,
            pointRadius: 0,
            fill: false
          },
          {
            label: 'Support',
            data: pad(support),
            borderColor: '#FACC15',
            backgroundColor: 'rgba(0,0,0,0)',
            borderDash: [3, 4],
            borderWidth: 2,
            pointRadius: 0,
            fill: false
          },
          {
            label: 'Resistance',
            data: pad(resistance),
            borderColor: '#F87171',
            backgroundColor: 'rgba(0,0,0,0)',
            borderDash: [3, 4],
            borderWidth: 2,
            pointRadius: 0,
            fill: false
          },
          {
            label: 'TP',
            data: pad(tp),
            borderColor: '#10B981',
            backgroundColor: 'rgba(0,0,0,0)',
            borderDash: [4, 4],
            borderWidth: 2,
            pointRadius: 0,
            fill: false
          },
          {
            label: 'SL',
            data: pad(sl),
            borderColor: '#EF4444',
            backgroundColor: 'rgba(0,0,0,0)',
            borderDash: [4, 4],
            borderWidth: 2,
            pointRadius: 0,
            fill: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        title: {
          display: true,
          text: 'Stockify Pro — ' + cfg.symbol + ' | Entry + Support / Resistance',
          fontSize: 18,
          fontColor: '#F9FAFB'
        },
        legend: {
          display: true,
          position: 'top',
          labels: {
            boxWidth: 12,
            fontSize: 10,
            fontColor: '#E5E7EB',
            usePointStyle: true
          }
        },
        layout: { padding: { left: 10, right: 16, top: 4, bottom: 6 } },
        scales: {
          xAxes: [{
            display: false,
            gridLines: { display: false, color: 'rgba(255,255,255,0.06)' },
            ticks: { fontColor: '#D1D5DB' }
          }],
          yAxes: [{
            position: 'right',
            ticks: {
              maxTicksLimit: 6,
              fontSize: 10,
              fontColor: '#D1D5DB',
              callback: function(value) { return '$' + value; }
            },
            gridLines: { color: 'rgba(255,255,255,0.08)' }
          }]
        }
      }
    };

    const payload = {
      chart: chart,
      width: 840,
      height: 250,
      backgroundColor: '#050814',
      format: 'png',
      version: '2'
    };

    const res = UrlFetchApp.fetch('https://quickchart.io/chart/create', {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    const code = res.getResponseCode();
    const body = res.getContentText();
    if (code >= 200 && code < 300) {
      const obj = JSON.parse(body);
      if (obj && obj.url) return obj.url;
    }

    Logger.log('QuickChart create failed ' + code + ': ' + body);
    return createQuickChartDirectUrlV860_(chart);
  } catch (err) {
    Logger.log('createQuickChartUrlV830_ error: ' + (err.stack || err));
    return null;
  }
}

function createQuickChartDirectUrlV860_(chart) {
  try {
    const encoded = encodeURIComponent(JSON.stringify(chart));
    if (encoded.length > 12000) return null;
    return 'https://quickchart.io/chart?version=2&width=840&height=250&format=png&backgroundColor=%23050814&c=' + encoded;
  } catch (e) {
    return null;
  }
}

function roundNumV830_(v, d) {
  v = Number(v || 0);
  d = typeof d === 'number' ? d : 2;
  const p = Math.pow(10, d);
  return Math.round(v * p) / p;
}


function buildFlexSymbolMessageV840_(cfg, d, decision, sr, imageUrl) {
  try {
    const currency = cfg.currency || 'USD';
    const plan = decision.plan || null;
    const action = decision.buyTier === 'FULL_BUY' ? 'BUY' : (decision.buyTier === 'TECH_BUY' ? 'TECH BUY' : 'WAIT');
    const actionColor = decision.buyTier === 'FULL_BUY' ? '#16A34A' : (decision.buyTier === 'TECH_BUY' ? '#CA8A04' : '#DC2626');
    const conviction = Math.max(20, Math.min(99, Math.round(decision.confidence || 50)));

    const dayBull = d.last >= d.sma5;
    const weekBull = d.last >= d.sma20;
    const monthBull = d.last >= d.sma50;

    const entry = plan && plan.legs && plan.legs[0] ? plan.legs[0].price : sr.support;
    const tp = sr.resistance;
    const sl = plan && plan.legs && plan.legs[1] ? Math.min(plan.legs[1].price, sr.support * 0.98) : sr.support * 0.98;

    const planRows = [];
    if (plan && plan.total > 0 && plan.legs && plan.legs.length) {
      planRows.push(flexKeyValueV840_('รวม', moneyV748_(plan.total, currency) + ' | ' + plan.ratio.join(':')));
      plan.legs.slice(0, 3).forEach(function(leg, i) {
        planRows.push(flexKeyValueV840_('ไม้ ' + (i + 1), moneyV748_(leg.amount, currency) + ' @≤' + moneyV748_(leg.price, currency)));
      });
    } else {
      planRows.push({
        type: 'text',
        text: 'ยังไม่เปิดซื้อใหม่',
        size: 'sm',
        color: '#DC2626',
        weight: 'bold',
        wrap: true
      });
    }

    const reason = (decision.reasons || []).slice(0, 2).join(' / ') || 'สัญญาณยังไม่ครบ';
    const img = imageUrl || 'https://dummyimage.com/1200x675/111827/ffffff.png&text=Stockify+Chart';

    return {
      type: 'flex',
      altText: 'Stockify Pro ' + cfg.symbol + ' — ' + action,
      contents: {
        type: 'bubble',
        size: 'giga',
        hero: {
          type: 'image',
          url: img,
          size: 'full',
          aspectRatio: '16:9',
          aspectMode: 'cover',
          action: { type: 'uri', uri: img }
        },
        body: {
          type: 'box',
          layout: 'vertical',
          spacing: 'md',
          contents: [
            {
              type: 'box',
              layout: 'horizontal',
              contents: [
                {
                  type: 'box',
                  layout: 'vertical',
                  flex: 4,
                  contents: [
                    { type: 'text', text: cfg.symbol, weight: 'bold', size: 'xxl', color: '#111827' },
                    { type: 'text', text: cfg.name || 'Stockify Pro Report', size: 'xs', color: '#6B7280', wrap: true }
                  ]
                },
                {
                  type: 'box',
                  layout: 'vertical',
                  flex: 3,
                  alignItems: 'flex-end',
                  contents: [
                    { type: 'text', text: action, weight: 'bold', size: 'lg', color: actionColor },
                    { type: 'text', text: 'Conviction ' + conviction + '/100', size: 'xs', color: '#6B7280' }
                  ]
                }
              ]
            },
            { type: 'separator', margin: 'sm' },
            {
              type: 'box',
              layout: 'horizontal',
              spacing: 'sm',
              contents: [
                flexChipV840_('Day', dayBull ? '🟢' : '🔴'),
                flexChipV840_('Week', weekBull ? '🟢' : '🔴'),
                flexChipV840_('Month', monthBull ? '🟢' : '🔴')
              ]
            },
            {
              type: 'box',
              layout: 'vertical',
              spacing: 'xs',
              contents: [
                flexKeyValueV840_('ราคา', moneyV748_(d.last, currency)),
                flexKeyValueV840_('Entry', moneyV748_(entry, currency)),
                flexKeyValueV840_('TP', moneyV748_(tp, currency)),
                flexKeyValueV840_('SL', moneyV748_(sl, currency))
              ]
            },
            { type: 'separator', margin: 'sm' },
            {
              type: 'box',
              layout: 'vertical',
              spacing: 'xs',
              contents: [
                { type: 'text', text: '📈 Health Check', size: 'sm', weight: 'bold', color: '#111827' },
                flexKeyValueV840_('RSI', fmtNumV748_(d.rsi, 1) + ' | ' + rsiTextV748_(d.rsi)),
                flexKeyValueV840_('MACD', macdTextV748_(d)),
                flexKeyValueV840_('EMA', d.ema20 >= d.ema50 ? '20/50 ขาขึ้น' : '20/50 ยังอ่อน'),
                flexKeyValueV840_('OBV', d.obvSlope >= 0 ? 'สะสมเพิ่ม' : 'สะสมลดลง'),
                flexKeyValueV840_('Volatility', volTextV748_(d.volatility))
              ]
            },
            { type: 'separator', margin: 'sm' },
            {
              type: 'box',
              layout: 'vertical',
              spacing: 'xs',
              contents: [
                { type: 'text', text: '🎯 แผน 3 ไม้', size: 'sm', weight: 'bold', color: '#111827' }
              ].concat(planRows)
            },
            {
              type: 'text',
              text: 'เหตุผล: ' + reason,
              size: 'xs',
              color: '#374151',
              wrap: true,
              margin: 'sm'
            }
          ]
        },
        footer: {
          type: 'box',
          layout: 'vertical',
          spacing: 'xs',
          contents: [
            { type: 'text', text: 'ℹ️ ไม่ใช่คำแนะนำลงทุน | ไม่รวม Pre/After Market', size: 'xxs', color: '#6B7280', wrap: true }
          ]
        }
      }
    };
  } catch (err) {
    Logger.log('buildFlexSymbolMessageV840_ error: ' + (err.stack || err));
    return null;
  }
}

function flexKeyValueV840_(key, value) {
  return {
    type: 'box',
    layout: 'horizontal',
    spacing: 'sm',
    contents: [
      { type: 'text', text: String(key), size: 'xs', color: '#6B7280', flex: 3 },
      { type: 'text', text: String(value), size: 'xs', color: '#111827', align: 'end', flex: 5, wrap: true }
    ]
  };
}

function flexChipV840_(label, icon) {
  return {
    type: 'box',
    layout: 'horizontal',
    paddingAll: '6px',
    cornerRadius: '12px',
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    contents: [
      { type: 'text', text: label + ' ' + icon, size: 'xs', align: 'center', color: '#111827' }
    ]
  };
}


function buildChartCardFlexMessageV850_(cfg, d, decision, sr, imageUrl) {
  try {
    if (!imageUrl) return null;

    const currency = cfg.currency || 'USD';
    const action = decision.buyTier === 'FULL_BUY' ? 'BUY' : (decision.buyTier === 'TECH_BUY' ? 'TECH BUY' : 'WAIT');
    const actionColor = decision.buyTier === 'FULL_BUY' ? '#22C55E' : (decision.buyTier === 'TECH_BUY' ? '#F59E0B' : '#F87171');
    const conviction = Math.max(20, Math.min(99, Math.round(decision.confidence || 50)));
    const plan = decision.plan || {};
    const entry = plan.legs && plan.legs[0] ? plan.legs[0].price : sr.support;
    const entryLabel = action === 'WAIT' ? 'Watch' : 'Entry';

    return {
      type: 'flex',
      altText: 'Chart ' + cfg.symbol + ' — ' + action,
      contents: {
        type: 'bubble',
        size: 'kilo',
        styles: {
          header: { backgroundColor: '#050814' },
          hero: { backgroundColor: '#050814' },
          body: { backgroundColor: '#050814' },
          footer: { backgroundColor: '#050814' }
        },
        hero: {
          type: 'image',
          url: imageUrl,
          size: 'full',
          aspectRatio: '16:3',
          aspectMode: 'cover',
          backgroundColor: '#050814',
          action: { type: 'uri', uri: imageUrl }
        },
        body: {
          type: 'box',
          layout: 'vertical',
          spacing: 'xs',
          paddingAll: '10px',
          contents: [
            {
              type: 'box',
              layout: 'horizontal',
              contents: [
                {
                  type: 'box',
                  layout: 'vertical',
                  flex: 4,
                  contents: [
                    { type: 'text', text: '📊 ' + cfg.symbol, weight: 'bold', size: 'md', color: '#F9FAFB' },
                    { type: 'text', text: 'Entry • Support • Resistance', size: 'xxs', color: '#94A3B8', wrap: true }
                  ]
                },
                {
                  type: 'box',
                  layout: 'vertical',
                  flex: 3,
                  alignItems: 'flex-end',
                  contents: [
                    { type: 'text', text: action, weight: 'bold', size: 'sm', color: actionColor },
                    { type: 'text', text: 'C' + conviction + '/100', size: 'xxs', color: '#94A3B8' }
                  ]
                }
              ]
            },
            { type: 'separator', margin: 'sm', color: '#1F2937' },
            {
              type: 'box',
              layout: 'horizontal',
              spacing: 'xs',
              margin: 'sm',
              contents: [
                flexMiniStatV850_('Price', moneyV748_(d.last, currency)),
                flexMiniStatV850_(entryLabel, moneyV748_(entry, currency))
              ]
            },
            {
              type: 'box',
              layout: 'horizontal',
              spacing: 'xs',
              contents: [
                flexMiniStatV850_('Support', moneyV748_(sr.support, currency)),
                flexMiniStatV850_('Resistance', moneyV748_(sr.resistance, currency))
              ]
            }
          ]
        },
        footer: {
          type: 'box',
          layout: 'vertical',
          spacing: 'xs',
          paddingTop: '0px',
          paddingBottom: '6px',
          contents: [
            { type: 'button', style: 'link', color: '#60A5FA', height: 'sm', action: { type: 'uri', label: 'เปิดกราฟเต็ม', uri: imageUrl } },
            { type: 'text', text: 'ข้อความวิเคราะห์อยู่ถัดไป', size: 'xxs', color: '#94A3B8', align: 'center' }
          ]
        }
      }
    };
  } catch (err) {
    Logger.log('buildChartCardFlexMessageV850_ error: ' + (err.stack || err));
    return null;
  }
}

function flexMiniStatV850_(label, value) {
  return {
    type: 'box',
    layout: 'vertical',
    flex: 1,
    paddingAll: '6px',
    cornerRadius: '8px',
    backgroundColor: '#111827',
    borderWidth: '1px',
    borderColor: '#1F2937',
    contents: [
      { type: 'text', text: String(label), size: 'xxs', color: '#94A3B8', align: 'center' },
      { type: 'text', text: String(value), size: 'xxs', color: '#F9FAFB', weight: 'bold', align: 'center', wrap: true }
    ]
  };
}

