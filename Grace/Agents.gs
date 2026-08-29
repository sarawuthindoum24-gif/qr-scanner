/*
 * AI Portfolio Agent V8.2 RSI REGIME LOGIC
 * Agents.gs
 */

const BUDGET_BASE_USD = 20;
const BUDGET_BASE_THB = 1000;

// V8.2 central thresholds: RSI is now a regime/risk filter, not a standalone buy signal.
const RSI_OVERSOLD_V820 = 30;
const RSI_MOMENTUM_MIN_V820 = 50;
const RSI_WARM_V820 = 70;
const RSI_HOT_V820 = 75;
const RSI_EUPHORIA_V820 = 80;
const RSI_ETF_LOCK_V820 = 78;
const RSI_SPEC_WARM_V820 = 68;
const RSI_SPEC_HOT_V820 = 70;
const VOL_HIGH_V800 = 0.065;
const VOL_WARN_V800 = 0.045;
const MARKET_HEAT_HOT_V800 = 70;
const MARKET_HEAT_BLOCK_V800 = 75;
const MAX_TECH_BUY_ONE_DAY_MOVE_V800 = 6.5;

// Per-execution cache to reduce SpreadsheetApp calls during Full Scan / Buy Checklist.
let WATCHLIST_CACHE_V800 = null;

const DIME_HOLDINGS_V748 = [
  { symbol: 'VOO', cat: 'Core ETF', portfolio: 'DIME', currency: 'USD' },
  { symbol: 'QQQM', cat: 'Core ETF', portfolio: 'DIME', currency: 'USD' },
  { symbol: 'MSFT', cat: 'Big Tech', portfolio: 'DIME', currency: 'USD' },
  { symbol: 'NVDA', cat: 'Semi/AI', portfolio: 'DIME', currency: 'USD' },
  { symbol: 'MU', cat: 'Semi/AI', portfolio: 'DIME', currency: 'USD' },
  { symbol: 'AMD', cat: 'Semi/AI', portfolio: 'DIME', currency: 'USD' },
  { symbol: 'ASTS', cat: 'Speculative', portfolio: 'DIME', currency: 'USD' }
];

const THAI_HOLDINGS_V748 = [
  { symbol: 'ADVANC', yahoo: 'ADVANC.BK', cat: 'Thai Telco', portfolio: 'TH_BLS', currency: 'THB' },
  { symbol: 'BDMS', yahoo: 'BDMS.BK', cat: 'Thai Healthcare', portfolio: 'TH_BLS', currency: 'THB' },
  { symbol: 'CPALL', yahoo: 'CPALL.BK', cat: 'Thai Consumer', portfolio: 'TH_BLS', currency: 'THB' },
  { symbol: 'GULF', yahoo: 'GULF.BK', cat: 'Thai Energy/Infra', portfolio: 'TH_BLS', currency: 'THB' },
  { symbol: 'KBANK', yahoo: 'KBANK.BK', cat: 'Thai Bank', portfolio: 'TH_BLS', currency: 'THB' },
  { symbol: 'SCB', yahoo: 'SCB.BK', cat: 'Thai Bank', portfolio: 'TH_BLS', currency: 'THB' }
];

// Legacy seed only. Runtime Watchlist is read from Google Sheets tab "Watchlist".
// US Favorites from latest Dime screenshot + legacy watchlist = 26 US symbols total.
// DIME_HOLDINGS_V748 already contains 7 held names: VOO, QQQM, MSFT, NVDA, MU, AMD, ASTS.
// This watchlist stores 19 additional names: latest 13 + legacy 6.
// Legacy kept: GOOGL, TSM, CRWD, OKLO, AMZN, AAPL.
const US_WATCHLIST_V748 = [
  { symbol: 'RKLB', cat: 'Spec/Space', portfolio: 'WATCH_US', currency: 'USD' },
  { symbol: 'TSLA', cat: 'EV/Growth', portfolio: 'WATCH_US', currency: 'USD' },
  { symbol: 'AXTI', cat: 'Semi/Spec', portfolio: 'WATCH_US', currency: 'USD' },
  { symbol: 'INTC', cat: 'Semi/AI', portfolio: 'WATCH_US', currency: 'USD' },
  { symbol: 'MRVL', cat: 'Semi/AI', portfolio: 'WATCH_US', currency: 'USD' },
  { symbol: 'NBIS', cat: 'AI Infra', portfolio: 'WATCH_US', currency: 'USD' },
  { symbol: 'AVGO', cat: 'Semi/AI', portfolio: 'WATCH_US', currency: 'USD' },
  { symbol: 'ARM', cat: 'Semi/AI', portfolio: 'WATCH_US', currency: 'USD' },
  { symbol: 'SOFI', cat: 'Fintech', portfolio: 'WATCH_US', currency: 'USD' },
  { symbol: 'RGTI', cat: 'Quantum/Spec', portfolio: 'WATCH_US', currency: 'USD' },
  { symbol: 'NOW', cat: 'Software/AI', portfolio: 'WATCH_US', currency: 'USD' },
  { symbol: 'QTUM', cat: 'Quantum ETF', portfolio: 'WATCH_US', currency: 'USD' },
  { symbol: 'AEHR', cat: 'Semi Equipment', portfolio: 'WATCH_US', currency: 'USD' },
  { symbol: 'CRWV', cat: 'AI Infra', portfolio: 'WATCH_US', currency: 'USD' },
  { symbol: 'ASML', cat: 'Semi Equipment', portfolio: 'WATCH_US', currency: 'USD' },
  { symbol: 'EOSE', cat: 'Energy Storage/Spec', portfolio: 'WATCH_US', currency: 'USD' },

  // Legacy watchlist kept from previous version
  { symbol: 'GOOGL', cat: 'Big Tech', portfolio: 'WATCH_LEGACY', currency: 'USD' },
  { symbol: 'TSM', cat: 'Semi/AI', portfolio: 'WATCH_LEGACY', currency: 'USD' },
  { symbol: 'CRWD', cat: 'Cybersecurity', portfolio: 'WATCH_LEGACY', currency: 'USD' },
  { symbol: 'OKLO', cat: 'Nuclear/Spec', portfolio: 'WATCH_LEGACY', currency: 'USD' },
  { symbol: 'AMZN', cat: 'Big Tech', portfolio: 'WATCH_LEGACY', currency: 'USD' },
  { symbol: 'AAPL', cat: 'Big Tech', portfolio: 'WATCH_LEGACY', currency: 'USD' }
];

const SYMBOL_ALIASES_V748 = {
  VOO: ['VOO', 'Vanguard S&P 500', 'S&P 500 ETF'],
  QQQM: ['QQQM', 'Invesco NASDAQ 100 ETF', 'Nasdaq 100 ETF'],
  MSFT: ['MSFT', 'Microsoft'],
  NVDA: ['NVDA', 'Nvidia'],
  MU: ['MU', 'Micron'],
  AMD: ['AMD', 'Advanced Micro Devices'],
  ASTS: ['ASTS', 'AST SpaceMobile'],
  AVGO: ['AVGO', 'Broadcom'],
  AXTI: ['AXTI', 'AXT Inc'],
  INTC: ['INTC', 'Intel'],
  MRVL: ['MRVL', 'Marvell'],
  NBIS: ['NBIS', 'Nebius'],
  RKLB: ['RKLB', 'Rocket Lab'],
  TSLA: ['TSLA', 'Tesla'],
  ARM: ['ARM', 'Arm Holdings', 'Arm'],
  SOFI: ['SOFI', 'SoFi Technologies', 'SoFi'],
  RGTI: ['RGTI', 'Rigetti Computing', 'Rigetti'],
  NOW: ['NOW', 'ServiceNow'],
  QTUM: ['QTUM', 'Defiance Quantum ETF', 'Quantum ETF'],
  AEHR: ['AEHR', 'Aehr Test Systems', 'Aehr'],
  GOOGL: ['GOOGL', 'GOOG', 'Alphabet', 'Google'],
  TSM: ['TSM', 'TSMC', 'Taiwan Semiconductor'],
  CRWD: ['CRWD', 'CrowdStrike'],
  OKLO: ['OKLO', 'Oklo'],
  AMZN: ['AMZN', 'Amazon'],
  AAPL: ['AAPL', 'Apple'],
  ADVANC: ['ADVANC', 'Advanced Info Service', 'AIS', 'AVIFY'],
  BDMS: ['BDMS', 'Bangkok Dusit'],
  CPALL: ['CPALL', 'CP All'],
  GULF: ['GULF', 'Gulf Energy', 'Gulf Development'],
  KBANK: ['KBANK', 'Kasikornbank', 'KBank'],
  SCB: ['SCB', 'SCB X', 'Siam Commercial']
};

const WATCHLIST_SHEET_PROP_V760 = 'WATCHLIST_SHEET_ID';
const WATCHLIST_TAB_NAME_V760 = 'Watchlist';
const WATCHLIST_HEADERS_V760 = ['Symbol', 'Category', 'Portfolio', 'Currency'];

function setupWatchlistSheetV760() {
  const props = PropertiesService.getScriptProperties();
  let id = props.getProperty(WATCHLIST_SHEET_PROP_V760);
  let ss;
  if (id) {
    ss = SpreadsheetApp.openById(id);
  } else {
    ss = SpreadsheetApp.create('AI Portfolio Watchlist DB');
    id = ss.getId();
    props.setProperty(WATCHLIST_SHEET_PROP_V760, id);
  }

  let sh = ss.getSheetByName(WATCHLIST_TAB_NAME_V760);
  if (!sh) sh = ss.insertSheet(WATCHLIST_TAB_NAME_V760);
  sh.clearContents();
  sh.getRange(1, 1, 1, WATCHLIST_HEADERS_V760.length).setValues([WATCHLIST_HEADERS_V760]);

  const rows = US_WATCHLIST_V748.map(function(x) {
    return [x.symbol, x.cat || x.category || 'Growth', x.portfolio || 'WATCH_US', x.currency || 'USD'];
  });
  if (rows.length) sh.getRange(2, 1, rows.length, 4).setValues(rows);
  sh.setFrozenRows(1);
  sh.autoResizeColumns(1, 4);
  WATCHLIST_CACHE_V800 = null;
  return id;
}

function getWatchlistSheetV760_() {
  const id = PropertiesService.getScriptProperties().getProperty(WATCHLIST_SHEET_PROP_V760);
  if (!id) throw new Error('ยังไม่มี WATCHLIST_SHEET_ID ให้รัน setupWatchlistSheetV760() ก่อน');
  const ss = SpreadsheetApp.openById(id);
  const sh = ss.getSheetByName(WATCHLIST_TAB_NAME_V760);
  if (!sh) throw new Error('ไม่พบแท็บชื่อ Watchlist ใน Google Sheets');
  return sh;
}

function getUSWatchlistFromSheetV760_() {
  if (WATCHLIST_CACHE_V800) {
    return WATCHLIST_CACHE_V800.map(function(x) { return Object.assign({}, x); });
  }
  try {
    const sh = getWatchlistSheetV760_();
    const values = sh.getDataRange().getValues();
    if (values.length < 2) {
      WATCHLIST_CACHE_V800 = [];
      return [];
    }
    const out = [];
    const seen = {};
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      const symbol = sanitizeSymbolV760_(row[0]);
      if (!symbol || seen[symbol]) continue;
      seen[symbol] = true;
      out.push({
        symbol: symbol,
        cat: String(row[1] || 'Growth').trim() || 'Growth',
        portfolio: String(row[2] || 'WATCH_US').trim() || 'WATCH_US',
        currency: String(row[3] || 'USD').trim().toUpperCase() || 'USD'
      });
    }
    WATCHLIST_CACHE_V800 = out;
    return out.map(function(x) { return Object.assign({}, x); });
  } catch (err) {
    Logger.log('getUSWatchlistFromSheetV760_ error: ' + (err.stack || err));
    return [];
  }
}

function getAllTrackedSymbolsV748_() {
  const map = {};
  const sheetWatchlist = getUSWatchlistFromSheetV760_();
  return DIME_HOLDINGS_V748.concat(THAI_HOLDINGS_V748).concat(sheetWatchlist).filter(function(s) {
    if (!s || !s.symbol) return false;
    if (map[s.symbol]) return false;
    map[s.symbol] = true;
    return true;
  });
}

function getUSUniverseFromSheetV760_() {
  const map = {};
  return DIME_HOLDINGS_V748.concat(getUSWatchlistFromSheetV760_()).filter(function(s) {
    if (!s || !s.symbol) return false;
    if (map[s.symbol]) return false;
    map[s.symbol] = true;
    return true;
  });
}

function sanitizeSymbolV760_(symbol) {
  return String(symbol || '').trim().toUpperCase().replace(/[^A-Z0-9.\-]/g, '').replace(/\.BK$/, '');
}

function parseAddWatchlistCommandV760_(textRaw) {
  const raw = String(textRaw || '').trim();
  if (!raw) return null;
  let body = '';
  if (raw.charAt(0) === '+') {
    body = raw.slice(1).trim();
  } else if (/^add\s+/i.test(raw)) {
    body = raw.replace(/^add\s+/i, '').trim();
  } else {
    return null;
  }
  if (!body) return null;
  const parts = body.split(/\s+/);
  const symbol = sanitizeSymbolV760_(parts[0]);
  if (!symbol) return null;
  return {
    symbol: symbol,
    category: parts[1] || inferCategoryV760_(symbol),
    portfolio: parts[2] || 'WATCH_US',
    currency: parts[3] || 'USD'
  };
}

function inferCategoryV760_(symbol) {
  const semi = ['NVDA','AMD','MU','AVGO','TSM','INTC','MRVL','ARM','AEHR','AXTI'];
  const etf = ['VOO','QQQM','QTUM','SMH','JEPQ','ARKX'];
  const big = ['MSFT','GOOGL','AMZN','AAPL','NOW'];
  const spec = ['ASTS','RKLB','OKLO','NBIS','RGTI'];
  if (etf.indexOf(symbol) >= 0) return symbol === 'QTUM' ? 'Quantum ETF' : 'Core ETF';
  if (semi.indexOf(symbol) >= 0) return 'Semi/AI';
  if (big.indexOf(symbol) >= 0) return 'Big Tech';
  if (spec.indexOf(symbol) >= 0) return 'Speculative';
  if (symbol === 'TSLA') return 'EV/Growth';
  if (symbol === 'SOFI') return 'Fintech';
  if (symbol === 'CRWD') return 'Cybersecurity';
  if (symbol === 'CRWV') return 'AI Infra';
  if (symbol === 'ASML') return 'Semi Equipment';
  if (symbol === 'EOSE') return 'Energy Storage/Spec';
  return 'Growth';
}

function appendWatchlistToSheetV760_(symbol, category, portfolio, currency) {
  symbol = sanitizeSymbolV760_(symbol);
  if (!symbol) throw new Error('symbol ว่าง');
  const sh = getWatchlistSheetV760_();
  const values = sh.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    const existing = sanitizeSymbolV760_(values[i][0]);
    if (existing === symbol) {
      return { ok: true, added: false, message: 'ℹ️ ' + symbol + ' มีอยู่ใน Watchlist แล้ว' };
    }
  }
  const row = [
    symbol,
    String(category || inferCategoryV760_(symbol)).trim(),
    String(portfolio || 'WATCH_US').trim(),
    String(currency || 'USD').trim().toUpperCase()
  ];
  sh.appendRow(row);
  WATCHLIST_CACHE_V800 = null;
  return { ok: true, added: true, message: '✅ เพิ่ม ' + symbol + ' เข้าสู่ Watchlist เรียบร้อยแล้ว\n' + row.join(' | ') };
}

function buildWatchlistSheetSummaryV760_() {
  const list = getUSWatchlistFromSheetV760_();
  if (!list.length) return '⚠️ Watchlist ใน Google Sheets ว่าง หรือยังไม่ได้ตั้งค่า\nให้รัน setupWatchlistSheetV760() ก่อน';
  const lines = ['👀 Watchlist จาก Google Sheets v' + V748, 'รวม: ' + list.length + ' ตัว', ''];
  const grouped = {};
  list.forEach(function(x) {
    const key = x.portfolio || 'WATCH_US';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(x.symbol);
  });
  Object.keys(grouped).sort().forEach(function(k) {
    lines.push(k + ': ' + grouped[k].join(', '));
  });
  lines.push('', 'เพิ่มหุ้น: +TSLA หรือ add TSLA Growth WATCH_US USD');
  return lines.join('\n');
}

function getSymbolConfigV748_(symbol) {
  symbol = String(symbol || '').toUpperCase().replace('.BK', '');
  const all = getAllTrackedSymbolsV748_();
  for (let i = 0; i < all.length; i++) if (all[i].symbol === symbol) return all[i];
  return { symbol: symbol, cat: 'Custom', portfolio: 'CUSTOM', currency: 'USD' };
}

function yahooSymbolV748_(cfg) {
  if (cfg.yahoo) return cfg.yahoo;
  if (cfg.currency === 'THB' || cfg.portfolio === 'TH_BLS') return cfg.symbol + '.BK';
  return cfg.symbol;
}

function runFullScanV748() {
  const now = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm');
  const all = getAllTrackedSymbolsV748_();
  const usForNews = all.filter(function(cfg) { return cfg.currency !== 'THB'; });
  const data = fetchManyTechnicalDataV748_(all);
  const news = fetchNewsForSymbolsV748_(usForNews);
  const market = buildMarketSnapshotV748_(data);

  const scored = all.map(function(cfg) {
    const d = data[cfg.symbol];
    const decision = buildSymbolDecisionV748_(cfg, d, market, true);
    if (cfg.currency !== 'THB') {
      decision.news = news[cfg.symbol] || emptyNewsV748_();
    } else {
      decision.news = emptyNewsV748_('Thai news gate optional');
      decision.news.status = 'OPTIONAL';
      decision.news.gatePass = true;
    }
    applyBuyTierLogicV753_(decision, d, market);
    return decision;
  });

  const buyList = scored.filter(function(x) { return x.openBuy && x.plan && x.plan.total > 0; })
    .sort(function(a, b) { return b.score - a.score || b.confidence - a.confidence; })
    .slice(0, 8);
  const waitList = scored.filter(function(x) { return !x.openBuy; })
    .sort(function(a, b) { return b.score - a.score; })
    .slice(0, 12);
  const sheetWatchlist = getUSWatchlistFromSheetV760_();

  const header = [
    '📊 Full Scan v' + V748,
    'อัปเดต: ' + now + ' น.',
    '',
    '🌡️ Market Heat: ' + market.heat + '/100 ' + heatEmojiV748_(market.heat),
    'Regime: ' + market.regime,
    'SPY vs MA200: ' + fmtPctV748_(market.spyMa200Pct),
    'VIX: ' + fmtNumV748_(market.vix, 2) + ' | USD/THB: ฿' + fmtNumV748_(market.usdthb, 2),
    '',
    'เช็คทั้งหมด: ' + scored.length + ' ตัว',
    'เปิดไม้ซื้อ: ' + buyList.length + ' ตัว',
    'รอก่อน: ' + waitList.length + ' ตัว',
    '',
    '🗂️ Grouping',
    'DIME: ' + DIME_HOLDINGS_V748.map(function(x){return x.symbol;}).join(', '),
    'Streaming: ' + THAI_HOLDINGS_V748.map(function(x){return x.symbol;}).join(', '),
    'Watchlist Sheet: ' + sheetWatchlist.map(function(x){return x.symbol;}).join(', ')
  ].join('\n');

  const buyMsg = buildBuyOnlyMessageV748_(buyList, '🎯 เปิดไม้ซื้อ 3 ไม้เท่านั้น');
  const waitMsg = buildWaitSummaryV748_(waitList);
  return [header, buyMsg, waitMsg];
}


function buildStockifySymbolReportV748(symbol) {
  const requestedSymbol = String(symbol || '').trim().toUpperCase().replace(/[^A-Z0-9.\-]/g, '');
  const cfg = getSymbolConfigV748_(requestedSymbol);
  const d = fetchTechnicalDataV748_(cfg);
  const market = buildMarketSnapshotV748_({});
  const decision = buildSymbolDecisionV748_(cfg, d, market, false);
  if (d && d.ok) {
    if (cfg.currency !== 'THB') {
      const oneNews = fetchNewsForSymbolsV748_([cfg]);
      decision.news = oneNews[cfg.symbol] || emptyNewsV748_();
    } else {
      decision.news = emptyNewsV748_('Thai news gate optional');
      decision.news.status = 'OPTIONAL';
      decision.news.gatePass = true;
    }
    applyBuyTierLogicV753_(decision, d, market);
  }
  const now = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm');

  if (!d || !d.ok) {
    return '❌ ดึงข้อมูล ' + cfg.symbol + ' ไม่สำเร็จ: ' + (d && d.error ? d.error : 'unknown') + '\n' +
      'ตรวจสอบ ticker หรือเพิ่มเข้าฐานข้อมูลด้วย +'+ cfg.symbol + ' ก่อน แล้วลองใหม่';
  }

  // V8.1 LINE FORMAT FIX: keep separators short so LINE mobile does not wrap/break them.
  const sep = '────────────';
  const volEmoji = d.volatility > 0.055 ? '🔴' : d.volatility > 0.035 ? '🟡' : '🟢';
  const macdEmoji = d.macdHist >= 0 ? '🟢' : '🔴';
  const rsiEmoji = rsiEmojiV748_(d.rsi);
  const trendEmoji = trendIconV748_(decision.momentumScore);
  const emaMidText = d.ema20 >= d.ema50 ? 'ขาขึ้น 🟢' : 'ขาลง 🔴';
  const emaLongText = d.ema50 >= d.ema200 ? 'โกลเด้นครอส 🟢' : 'เดธครอส 🔴';
  const obvText = d.obvSlope >= 0 ? 'เพิ่มขึ้น 📈' : 'ลดลง ↘️';
  const bollEmoji = bollEmojiV748_(d);

  const lines = [];
  lines.push('🕘 อัปเดต: ' + now + ' น.');
  lines.push('📊 ' + cfg.symbol + (d.provider ? ' | Data: ' + d.provider : ''));
  lines.push(sep);
  lines.push('💡 โมเมนตัม: ' + decision.momentumText + ' ' + trendEmoji);
  lines.push('📈 RSI: ' + fmtNumV748_(d.rsi, 1) + ' | ' + rsiTextV748_(d.rsi) + ' ' + rsiEmoji);
  lines.push('🎯 MACD: ' + macdTextV748_(d) + ' ' + macdEmoji);
  lines.push('🌊 ผันผวน: ' + volTextV748_(d.volatility) + ' ' + volEmoji);
  lines.push(sep);
  lines.push('📏 ราคา/ค่าเฉลี่ย');
  lines.push('• ล่าสุด: ' + moneyV748_(d.last, cfg.currency));
  lines.push('• เฉลี่ย 5 วัน: ' + moneyV748_(d.sma5, cfg.currency) + ' ' + trendIconV748_(d.last >= d.sma5 ? 1 : -1));
  lines.push('• Bollinger20: ' + moneyV748_(d.bbLow, cfg.currency) + '–' + moneyV748_(d.bbHigh, cfg.currency) + ' ' + bollEmoji);
  lines.push('• EMA20/50: ' + emaMidText);
  lines.push('• EMA50/200: ' + emaLongText);
  lines.push('• OBV: ' + obvText);
  lines.push(sep);
  const sr = buildSingleSupportResistanceV774_(d);
  lines.push('📍 แนวรับ/แนวต้าน');
  lines.push('• รับ: ' + moneyV748_(sr.support, cfg.currency));
  lines.push('• ต้าน: ' + moneyV748_(sr.resistance, cfg.currency));
  lines.push(sep);
  lines.push('📝 ภาพรวม ' + cfg.symbol);
  buildReadableOverviewV761_(decision, d).forEach(function(r) { lines.push('• ' + r); });
  lines.push(sep);
  lines.push(buildSingleBuyPlanTextV761_(decision));
  lines.push('ℹ️ ไม่ใช่คำแนะนำลงทุน | ไม่รวม Pre/After Market');
  return lines.join('\n');
}

function buildReadableOverviewV761_(decision, d) {
  const out = [];
  out.push('แนวโน้ม: ' + decision.momentumText + ' ' + trendIconV748_(decision.momentumScore));
  const rsiRegime = rsiRegimeV820_(decision.cfg, d.rsi);
  if (!rsiRegime.checklistPass) out.push('แรงซื้อขาย: ' + rsiRegime.label + ' ⚠️');
  else if (d.rsi >= RSI_WARM_V820) out.push('แรงซื้อขาย: ' + rsiRegime.label + ' 🟡');
  else if (d.rsi >= RSI_MOMENTUM_MIN_V820) out.push('แรงซื้อขาย: healthy momentum 🟢');
  else out.push('แรงซื้อขาย: แรงซื้อขายสมดุล ⚪');
  out.push('โมเมนตัม (MACD): ' + (d.macdHist >= 0 ? 'สัญญาณบวก 🟢' : 'เริ่มอ่อนแรง อาจย่อตัว ↘️'));
  if (d.ema20 >= d.ema50 && d.ema50 >= d.ema200) out.push('เส้นค่าเฉลี่ย: แนวโน้มกลาง-ยาวแข็งแรง ✅');
  else if (d.ema20 >= d.ema50) out.push('เส้นค่าเฉลี่ย: ระยะกลางดี แต่ระยะยาวยังต้องยืนยัน 🟡');
  else out.push('เส้นค่าเฉลี่ย: แนวโน้มยังไม่ชัดเจน ⚪');
  if (d.volatility > 0.055) out.push('ความผันผวน: เสี่ยงแกว่งตัวรุนแรง 🔴');
  else if (d.volatility > 0.035) out.push('ความผันผวน: กลาง 🟡');
  else out.push('ความผันผวน: ต่ำ 🟢');
  out.push('OBV: ' + (d.obvSlope >= 0 ? 'มีแรงซื้อสะสม/โวลุ่มหนุน 📈' : 'แรงสะสมลดลง ต้องระวัง ↘️'));
  return out;
}

function buildSingleBuyPlanTextV761_(decision) {
  if (!decision || !decision.plan || !decision.plan.total || decision.plan.total <= 0) {
    const reasons = decision && decision.reasons ? decision.reasons.slice(0, 3).join(' / ') : 'สัญญาณยังไม่ครบ';
    return [
      '🎯 แผน 3 ไม้',
      'สถานะ: ยังไม่เปิดซื้อใหม่',
      'เหตุผล:',
      '• ' + reasons.replace(/ \/ /g, '\n• ')
    ].join('\n');
  }

  const p = decision.plan;
  const currency = decision.cfg.currency;
  const ratioText = Array.isArray(p.ratio) ? p.ratio.join(':') : String(p.ratio || '25:35:40');

  // V7.7.2 FIX:
  // Previous Stockify detail renderer expected legacy fields p.leg1/p.price1,
  // but the current buy-plan builder stores legs as p.legs[]. That caused LINE to show "- @≤-".
  // This block normalizes both shapes so every report displays real amount and limit price.
  let legs = [];
  if (Array.isArray(p.legs) && p.legs.length) {
    legs = p.legs.map(function(leg) {
      return { amount: leg.amount, price: leg.price };
    });
  } else {
    legs = [
      { amount: p.leg1, price: p.price1 },
      { amount: p.leg2, price: p.price2 },
      { amount: p.leg3, price: p.price3 }
    ];
  }

  const lines = [
    '🎯 แผน 3 ไม้',
    'รวม: ' + moneyV748_(p.total, currency) + ' | สัดส่วน ' + ratioText
  ];

  legs.slice(0, 3).forEach(function(leg, i) {
    lines.push((i + 1) + ') ' + moneyV748_(leg.amount, currency) + ' @≤' + moneyV748_(leg.price, currency));
  });

  lines.push('เหตุผล: ' + (decision.reasons || []).slice(0, 2).join(' / '));
  return lines.join('\n');
}


function buildBuyChecklistReportV752() {
  const now = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm');
  const all = getAllTrackedSymbolsV748_();
  const us = all.filter(function(cfg) { return cfg.currency !== 'THB'; });
  const data = fetchManyTechnicalDataV748_(all);
  const news = fetchNewsForSymbolsV748_(us);
  const market = buildMarketSnapshotV748_(data);

  const scored = all.map(function(cfg) {
    const d = data[cfg.symbol];
    const decision = buildSymbolDecisionV748_(cfg, d, market, true);
    if (cfg.currency !== 'THB') {
      decision.news = news[cfg.symbol] || emptyNewsV748_();
    } else {
      decision.news = emptyNewsV748_('Thai news gate optional');
      decision.news.status = 'OPTIONAL';
      decision.news.gatePass = true;
    }
    applyBuyTierLogicV753_(decision, d, market);
    decision.checklist = buildBuyLogicChecklistV752_(decision, d, market);
    return decision;
  });

  const priceOk = scored.filter(function(x) { return x.ok; }).length;
  const newsPass = scored.filter(function(x) { return (x.cfg.currency === 'THB') || (x.news && x.news.gatePass) || x.cfg.cat === 'Core ETF'; }).length;
  const fullBuy = scored.filter(function(x) { return x.buyTier === 'FULL_BUY' && x.plan && x.plan.total > 0; })
    .sort(function(a, b) { return b.score - a.score || b.confidence - a.confidence; });
  const techBuy = scored.filter(function(x) { return x.buyTier === 'TECH_BUY' && x.plan && x.plan.total > 0; })
    .sort(function(a, b) { return b.score - a.score || b.confidence - a.confidence; });
  const open = fullBuy.concat(techBuy);
  const blocked = scored.filter(function(x) { return x.buyTier !== 'FULL_BUY' && x.buyTier !== 'TECH_BUY'; })
    .sort(function(a, b) { return b.score - a.score; })
    .slice(0, 12);

  const checklist = [
    '📋 เช็คลิสต์ก่อนซื้อ v' + V748,
    'เวลา: ' + now + ' น.',
    '────────────',
    '1) Price Data: ' + (priceOk === scored.length ? '✅' : '⚠️') + ' ' + priceOk + '/' + scored.length,
    '2) Regular Market Only: ✅ ไม่รวม Pre/After Market',
    '3) Market Heat: ' + market.heat + '/100 ' + heatEmojiV748_(market.heat),
    '4) Regime: ' + market.regime,
    '5) VIX: ' + fmtNumV748_(market.vix, 2) + ' | USD/THB: ฿' + fmtNumV748_(market.usdthb, 2),
    '6) News Gate: ' + newsPass + '/' + scored.length + ' ผ่าน/ยกเว้นตามประเภทสินทรัพย์',
    '7) ETF Protection: ✅ VOO/QQQM ไม่แดงง่ายจาก ATH',
    '8) Sector/Spec Risk: ✅ จำกัดไม้หุ้นผันผวนสูง',
    '',
    'ผลคัดกรอง: BUY เต็มระบบ ' + fullBuy.length + ' ตัว | TECH BUY ไม้เล็ก ' + techBuy.length + ' ตัว',
    '*ไม่ใช่คำแนะนำการลงทุน ระบบอ่านจากราคา/โวลุ่ม/ข่าวที่ดึงได้ ณ เวลารายงาน ไม่รวม Pre/After Market และข้อมูลอาจล่าช้า'
  ].join('\n');

  const buyMsg = buildBuyChecklistOnlyMessageV752_(fullBuy, techBuy);
  const waitMsg = buildBuyBlockedSummaryV752_(blocked);
  return [checklist, buyMsg, waitMsg];
}

function buildBuyLogicChecklistV752_(decision, d, market) {
  const items = [];
  items.push({ name: 'Price OK', pass: !!(d && d.ok) });
  items.push({ name: 'เหนือ EMA20', pass: !!(d && d.ok && d.last > d.ema20) });
  items.push({ name: 'EMA20/50 ขาขึ้น', pass: !!(d && d.ok && d.ema20 > d.ema50) });
  items.push({ name: 'EMA50/200 แข็งแรง', pass: !!(d && d.ok && d.ema50 > d.ema200) });
  items.push({ name: 'MACD ไม่ลบ', pass: !!(d && d.ok && d.macdHist >= 0) });
  items.push({ name: 'RSI regime ผ่าน', pass: !!(d && d.ok && isRsiChecklistPassV820_(decision.cfg, d.rsi)) });
  items.push({ name: 'Volatility รับได้', pass: !!(d && d.ok && d.volatility <= VOL_HIGH_V800) });
  items.push({ name: 'Market Heat ไม่ร้อนจัด', pass: market.heat < MARKET_HEAT_HOT_V800 || decision.cfg.cat !== 'Speculative' });
  if (decision.cfg.cat !== 'Core ETF' && decision.cfg.currency !== 'THB') {
    items.push({ name: 'News Gate', pass: !!(decision.news && decision.news.gatePass) });
  } else {
    items.push({ name: 'News Gate', pass: true });
  }
  return items;
}

function checklistCompactV752_(items) {
  return (items || []).map(function(x) { return (x.pass ? '✅' : '⚠️') + x.name; }).join(' / ');
}

function buildBuyChecklistOnlyMessageV752_(fullBuyList, techBuyList) {
  const lines = ['🎯 ตัวที่แนะนำเข้าซื้อทั้งหมด v8.0', 'แบ่งเป็น BUY เต็มระบบ และ TECH BUY ไม้เล็ก', ''];
  fullBuyList = fullBuyList || [];
  techBuyList = techBuyList || [];

  if (!fullBuyList.length && !techBuyList.length) {
    lines.push('วันนี้ยังไม่มีตัวที่ผ่านพอให้เปิดไม้ซื้อ');
    lines.push('เหตุผลหลัก: คะแนนไม่พอ / News Gate ไม่ผ่าน / RSI ร้อน / ความผันผวนสูง / Market Heat ไม่เหมาะ');
    return lines.join('\n');
  }

  lines.push('🟢 BUY เต็มระบบ');
  if (!fullBuyList.length) {
    lines.push('ไม่มี');
  } else {
    fullBuyList.forEach(function(x, idx) {
      appendBuyTierItemV753_(lines, x, idx + 1, '🟢 BUY');
    });
  }

  lines.push('');
  lines.push('🟡 TECH BUY ไม้เล็ก');
  lines.push('ใช้เมื่อ technical ผ่าน แต่ข่าวยังไม่ผ่าน/ยังไม่ครบ ลดงบเหลือประมาณ 25–35%');
  if (!techBuyList.length) {
    lines.push('ไม่มี');
  } else {
    techBuyList.forEach(function(x, idx) {
      appendBuyTierItemV753_(lines, x, idx + 1, '🟡 TECH BUY');
    });
  }
  return lines.join('\n');
}

function appendBuyTierItemV753_(lines, x, idx, label) {
  const newsTxt = x.cfg.currency === 'THB'
    ? 'ThaiGate: optional'
    : ('Y' + ((x.news && x.news.yahoo) || 0) + '/I' + ((x.news && x.news.investing) || 0));
  lines.push(idx + '. ' + x.symbol + ' ' + label + ' | C' + Math.round(x.confidence) + '% | Score ' + x.score + ' | ' + newsTxt);
  lines.push('   เช็คลิสต์: ' + checklistCompactV752_(x.checklist));
  lines.push('   ซื้อรวม: ' + moneyV748_(x.plan.total, x.cfg.currency) + ' | 3 ไม้ ' + x.plan.ratio.join(':'));
  x.plan.legs.forEach(function(leg, i) {
    lines.push('   ไม้ ' + (i + 1) + ': ' + moneyV748_(leg.amount, x.cfg.currency) + ' @≤' + moneyV748_(leg.price, x.cfg.currency));
  });
  lines.push('   เหตุผล: ' + x.reasons.slice(0, 3).join(' / '));
  if (x.buyTier === 'TECH_BUY') lines.push('   ⚠️ ข่าวยังไม่ครบหรือยังไม่ผ่านเต็มระบบ ใช้ไม้เล็กเท่านั้น');
  lines.push('   ⚠️ ก่อนซื้อจริงเช็กราคาล่าสุดอีกครั้ง เพราะไม่รวม Pre/After Market');
  lines.push('');
}
function buildBuyBlockedSummaryV752_(list) {
  const lines = ['⏳ WATCH / ยังไม่เปิดไม้ซื้อ', 'สรุปเฉพาะอันดับใกล้ผ่านที่สุด และตัวที่ห้ามไล่ราคา'];
  (list || []).forEach(function(x) {
    const failed = (x.checklist || []).filter(function(c) { return !c.pass; }).slice(0, 3).map(function(c) { return c.name; }).join(', ');
    lines.push(x.symbol + ': รอ | ' + (failed || x.reasons.slice(0, 2).join(' / ')));
  });
  return lines.join('\n');
}

function buildNewsBuy3ReportV748() {
  const now = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm');
  const all = getUSUniverseFromSheetV760_();
  const data = fetchManyTechnicalDataV748_(all);
  const news = fetchNewsForSymbolsV748_(all);
  const market = buildMarketSnapshotV748_(data);
  const scored = all.map(function(cfg) {
    const d = data[cfg.symbol];
    const decision = buildSymbolDecisionV748_(cfg, d, market, true);
    decision.news = news[cfg.symbol] || emptyNewsV748_();
    applyBuyTierLogicV753_(decision, d, market);
    return decision;
  });

  const movers = scored.slice().sort(function(a, b) { return Math.abs(b.changePct || 0) - Math.abs(a.changePct || 0); }).slice(0, 20);
  const newsLines = ['🇺🇸 สรุปข่าวหุ้นวันนี้ v' + V748, 'เวลา: ' + now, ''];
  movers.forEach(function(x) {
    const icon = (x.changePct || 0) >= 0 ? '🟢' : '🔴';
    const headline = x.news && x.news.headline ? x.news.headline : 'ไม่มีข่าวตรง symbol ในรอบนี้';
    newsLines.push(icon + ' ' + x.symbol + ' ' + fmtPctV748_(x.changePct));
    newsLines.push(shortReasonFromHeadlineV748_(headline) + (x.news && (x.news.yahoo || x.news.finnhub) ? ' [' + (x.news.source || 'News') + ' Y' + (x.news.yahoo || 0) + '/F' + (x.news.finnhub || 0) + ']' : ''));
  });

  const buyList = scored.filter(function(x) { return (x.buyTier === 'FULL_BUY' || x.buyTier === 'TECH_BUY') && x.plan && x.plan.total > 0; })
    .sort(function(a, b) { return (a.buyTier === b.buyTier ? 0 : a.buyTier === 'FULL_BUY' ? -1 : 1) || b.score - a.score; })
    .slice(0, 8);
  return [newsLines.join('\n'), buildBuyOnlyMessageV748_(buyList, '🎯 แผนเข้าซื้อ 3 ไม้เท่านั้น')];
}

function buildHealthReportV748() {
  const all = getAllTrackedSymbolsV748_();
  const data = fetchManyTechnicalDataV748_(all.slice(0, 6));
  const ok = Object.keys(data).filter(function(k){return data[k] && data[k].ok;}).length;
  return [
    '🧪 Health v' + V748,
    'เวลา: ' + Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm'),
    'LINE: ✅ ถ้าข้อความนี้ถึง แปลว่าส่งได้',
    'Price API sample: ' + ok + '/6',
    'Tracked symbols: ' + all.length,
    'คำสั่ง: ASTS / เช็คทั้งหมด / ข่าว / health'
  ].join('\n');
}

function fetchManyTechnicalDataV748_(configs) {
  const reqs = configs.map(function(cfg) {
    const y = encodeURIComponent(yahooSymbolV748_(cfg));
    return {
      url: 'https://query1.finance.yahoo.com/v8/finance/chart/' + y + '?range=8mo&interval=1d&includePrePost=false',
      muteHttpExceptions: true,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    };
  });
  const out = {};
  try {
    const resps = UrlFetchApp.fetchAll(reqs);
    resps.forEach(function(res, idx) {
      const cfg = configs[idx];
      out[cfg.symbol] = parseYahooChartResponseV748_(cfg, res.getResponseCode(), res.getContentText());
    });
  } catch (err) {
    configs.forEach(function(cfg) { out[cfg.symbol] = { ok: false, error: err.message, cfg: cfg }; });
  }
  return out;
}

function fetchTechnicalDataV748_(cfg) {
  // V8.7 Provider Layer
  // Primary: Yahoo Chart API
  // Fallback: Twelve Data API if Script Property TWELVE_DATA_API_KEY exists
  const yahoo = fetchYahooTechnicalDataV870_(cfg);
  if (yahoo && yahoo.ok) {
    yahoo.provider = 'Yahoo';
    return yahoo;
  }

  const twelve = fetchTwelveDataTechnicalDataV870_(cfg);
  if (twelve && twelve.ok) {
    twelve.provider = 'TwelveData';
    twelve.fallbackFrom = yahoo && yahoo.error ? yahoo.error : 'Yahoo unavailable';
    return twelve;
  }

  return {
    ok: false,
    cfg: cfg,
    provider: 'none',
    error: 'All providers failed | Yahoo: ' + (yahoo && yahoo.error ? yahoo.error : 'unknown') +
      ' | TwelveData: ' + (twelve && twelve.error ? twelve.error : 'not configured')
  };
}

function fetchYahooTechnicalDataV870_(cfg) {
  const y = encodeURIComponent(yahooSymbolV748_(cfg));
  try {
    const res = UrlFetchApp.fetch('https://query1.finance.yahoo.com/v8/finance/chart/' + y + '?range=8mo&interval=1d&includePrePost=false', {
      muteHttpExceptions: true,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const parsed = parseYahooChartResponseV748_(cfg, res.getResponseCode(), res.getContentText());
    if (parsed && parsed.ok) parsed.provider = 'Yahoo';
    return parsed;
  } catch (err) {
    return { ok: false, cfg: cfg, provider: 'Yahoo', error: err.message };
  }
}

function parseYahooChartResponseV748_(cfg, code, body) {
  if (code !== 200) return { ok: false, cfg: cfg, http: code, error: 'HTTP ' + code };
  try {
    const json = JSON.parse(body);
    const result = json.chart && json.chart.result && json.chart.result[0];
    if (!result) return { ok: false, cfg: cfg, http: code, error: 'No chart result' };
    const quote = result.indicators.quote[0];
    const closeRaw = (result.indicators.adjclose && result.indicators.adjclose[0] && result.indicators.adjclose[0].adjclose) || quote.close;
    const close = closeRaw.filter(function(x) { return typeof x === 'number' && isFinite(x); });
    const volume = (quote.volume || []).filter(function(x) { return typeof x === 'number' && isFinite(x); });
    if (close.length < 60) return { ok: false, cfg: cfg, http: code, error: 'Not enough price history' };

    const last = close[close.length - 1];
    const prev = close[close.length - 2];
    const sma5 = smaV748_(close, 5);
    const sma20 = smaV748_(close, 20);
    const sma50 = smaV748_(close, 50);
    const sma200 = smaV748_(close, Math.min(200, close.length));
    const ema20 = emaSeriesV748_(close, 20).pop();
    const ema50 = emaSeriesV748_(close, 50).pop();
    const ema200 = emaSeriesV748_(close, Math.min(200, close.length)).pop();
    const rsi = rsiV748_(close, 14);
    const macd = macdV748_(close);
    const bb = bollingerV748_(close, 20, 2);
    const support = Math.min.apply(null, close.slice(-20));
    // V8.0: use prior 20 closes for resistance. Including today's close can make
    // resistance equal to current price on breakout days, which is not useful.
    const resistanceWindow = close.length > 20 ? close.slice(-20, -1) : close.slice(0, -1);
    const resistance = Math.max.apply(null, resistanceWindow.length ? resistanceWindow : [last]);
    const obv = obvSeriesV748_(close, volume);
    const obvSlope = obv.length >= 5 ? obv[obv.length - 1] - obv[obv.length - 5] : 0;
    const returns = [];
    for (let i = Math.max(1, close.length - 30); i < close.length; i++) returns.push((close[i] - close[i - 1]) / close[i - 1]);
    const volatility = stdV748_(returns);

    return {
      ok: true,
      cfg: cfg,
      http: code,
      provider: 'Yahoo',
      last: last,
      prev: prev,
      changePct: (last - prev) / prev * 100,
      close: close,
      volume: volume,
      sma5: sma5,
      sma20: sma20,
      sma50: sma50,
      sma200: sma200,
      ema20: ema20,
      ema50: ema50,
      ema200: ema200,
      rsi: rsi,
      macd: macd.macd,
      macdSignal: macd.signal,
      macdHist: macd.hist,
      bbLow: bb.low,
      bbMid: bb.mid,
      bbHigh: bb.high,
      support: support,
      resistance: resistance,
      supportLevels: null,
      obvSlope: obvSlope,
      volatility: volatility
    };
  } catch (err) {
    return { ok: false, cfg: cfg, http: code, error: err.message };
  }
}




function fetchTwelveDataTechnicalDataV870_(cfg) {
  try {
    const key = PropertiesService.getScriptProperties().getProperty('TWELVE_DATA_API_KEY');
    if (!key) return { ok: false, cfg: cfg, provider: 'TwelveData', error: 'Missing TWELVE_DATA_API_KEY' };

    // Keep Thai stocks on Yahoo/SET logic unless you later add exact Twelve Data exchange mapping.
    if ((cfg.currency || 'USD') === 'THB') {
      return { ok: false, cfg: cfg, provider: 'TwelveData', error: 'Skipped THB ticker' };
    }

    const sym = twelveDataSymbolV870_(cfg);
    const url = 'https://api.twelvedata.com/time_series'
      + '?symbol=' + encodeURIComponent(sym)
      + '&interval=1day'
      + '&outputsize=240'
      + '&format=JSON'
      + '&apikey=' + encodeURIComponent(key);

    const res = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    return parseTwelveDataResponseV870_(cfg, res.getResponseCode(), res.getContentText());
  } catch (err) {
    return { ok: false, cfg: cfg, provider: 'TwelveData', error: err.message };
  }
}

function twelveDataSymbolV870_(cfg) {
  const s = String(cfg && cfg.symbol ? cfg.symbol : '').trim().toUpperCase();
  return s.replace('.BK', '');
}

function parseTwelveDataResponseV870_(cfg, code, body) {
  if (code !== 200) return { ok: false, cfg: cfg, provider: 'TwelveData', http: code, error: 'HTTP ' + code };
  try {
    const json = JSON.parse(body || '{}');
    if (json.status === 'error' || json.code || json.message === 'Invalid API call') {
      return { ok: false, cfg: cfg, provider: 'TwelveData', http: code, error: json.message || ('API error ' + json.code) };
    }

    const values = json.values || [];
    if (!values.length) return { ok: false, cfg: cfg, provider: 'TwelveData', http: code, error: 'No values' };

    const rows = values.slice().reverse(); // newest -> oldest becomes chronological
    const close = [];
    const volume = [];
    rows.forEach(function(r) {
      const c = Number(r.close);
      const v = Number(r.volume || 0);
      if (isFinite(c) && c > 0) {
        close.push(c);
        volume.push(isFinite(v) && v >= 0 ? v : 0);
      }
    });

    if (close.length < 60) {
      return { ok: false, cfg: cfg, provider: 'TwelveData', http: code, error: 'Not enough price history' };
    }

    return buildTechnicalObjectFromCloseVolumeV870_(cfg, close, volume, code, 'TwelveData');
  } catch (err) {
    return { ok: false, cfg: cfg, provider: 'TwelveData', http: code, error: err.message };
  }
}

function buildTechnicalObjectFromCloseVolumeV870_(cfg, close, volume, http, provider) {
  const last = close[close.length - 1];
  const prev = close[close.length - 2];
  const sma5 = smaV748_(close, 5);
  const sma20 = smaV748_(close, 20);
  const sma50 = smaV748_(close, 50);
  const sma200 = smaV748_(close, Math.min(200, close.length));
  const ema20 = emaSeriesV748_(close, 20).pop();
  const ema50 = emaSeriesV748_(close, 50).pop();
  const ema200 = emaSeriesV748_(close, Math.min(200, close.length)).pop();
  const rsi = rsiV748_(close, 14);
  const macd = macdV748_(close);
  const bb = bollingerV748_(close, 20, 2);
  const support = Math.min.apply(null, close.slice(-20));
  const resistanceWindow = close.length > 20 ? close.slice(-20, -1) : close.slice(0, -1);
  const resistance = Math.max.apply(null, resistanceWindow.length ? resistanceWindow : [last]);
  const obv = obvSeriesV748_(close, volume);
  const obvSlope = obv.length >= 5 ? obv[obv.length - 1] - obv[obv.length - 5] : 0;
  const returns = [];
  for (let i = Math.max(1, close.length - 30); i < close.length; i++) returns.push((close[i] - close[i - 1]) / close[i - 1]);
  const volatility = stdV748_(returns);

  return {
    ok: true,
    cfg: cfg,
    http: http || 200,
    provider: provider || 'unknown',
    last: last,
    prev: prev,
    changePct: (last - prev) / prev * 100,
    close: close,
    volume: volume,
    sma5: sma5,
    sma20: sma20,
    sma50: sma50,
    sma200: sma200,
    ema20: ema20,
    ema50: ema50,
    ema200: ema200,
    rsi: rsi,
    macd: macd.macd,
    macdSignal: macd.signal,
    macdHist: macd.hist,
    bbLow: bb.low,
    bbMid: bb.mid,
    bbHigh: bb.high,
    support: support,
    resistance: resistance,
    supportLevels: null,
    obvSlope: obvSlope,
    volatility: volatility
  };
}


function buildSupportLevelsV773_(d) {
  const last = Number(d && d.last);
  if (!isFinite(last) || last <= 0) {
    return { near: null, mid: null, deep: null, raw: null, resistance: null, crash: null };
  }

  const raw = Number(d.support || d.bbLow || last * 0.90);
  const resistance = Number(d.resistance || d.bbHigh || last * 1.05);
  const vol = Number(d.volatility || 0);

  // Regular buy supports must stay in a usable trading range.
  // Raw 20-day lows or Bollinger lows can be extremely far away after large candles.
  const nearPct = vol > 0.055 ? 0.970 : (vol > 0.035 ? 0.980 : 0.985);
  const midPct  = vol > 0.055 ? 0.945 : (vol > 0.035 ? 0.955 : 0.965);
  const deepPct = vol > 0.055 ? 0.900 : (vol > 0.035 ? 0.920 : 0.940);

  function validBelow(x) { return typeof x === 'number' && isFinite(x) && x > 0 && x <= last; }
  function maxValid(arr, fallback) {
    const xs = arr.filter(validBelow);
    return xs.length ? Math.max.apply(null, xs) : fallback;
  }
  function clamp(x, lo, hi) {
    x = Number(x);
    if (!isFinite(x) || x <= 0) return lo;
    return Math.max(lo, Math.min(hi, x));
  }

  // Near support: practical first-entry area, close to current price / short MA.
  let near = maxValid([last * nearPct, d.sma5, d.ema20], last * nearPct);
  near = clamp(near, last * 0.94, last * 0.995);

  // Mid support: normal pullback zone, not a crash-level low.
  let mid = maxValid([last * midPct, d.ema20, d.bbMid, d.sma20], last * midPct);
  mid = clamp(mid, last * 0.88, near * 0.995);

  // Deep support: third entry zone. Avoid using extreme raw support if it is >18% below current price.
  let deepCandidate = maxValid([last * deepPct, d.ema50, d.bbLow], last * deepPct);
  const rawIsCrash = isFinite(raw) && raw > 0 && raw < last * 0.82;
  if (rawIsCrash) {
    deepCandidate = Math.max(last * deepPct, Number(d.ema50 || 0), Number(d.bbMid || 0));
  }
  let deep = clamp(deepCandidate, last * 0.82, mid * 0.995);

  return {
    near: near,
    mid: mid,
    deep: deep,
    raw: isFinite(raw) && raw > 0 ? raw : null,
    resistance: isFinite(resistance) && resistance > 0 ? resistance : last * 1.05,
    crash: rawIsCrash ? raw : null
  };
}


function buildSingleSupportResistanceV774_(d) {
  const levels = buildSupportLevelsV773_(d);
  const last = Number(d && d.last);
  if (!isFinite(last) || last <= 0) {
    return { support: null, resistance: null, rawSupport: null, adjusted: false };
  }

  const raw = Number(levels.raw || d.support || d.bbLow);
  const rawIsUsable = isFinite(raw) && raw > 0 && raw <= last * 0.995 && raw >= last * 0.94;

  // Show only one support line. If the raw support is too far away, treat it as structural/crash support
  // and replace it with the nearest practical support used for entry logic.
  const support = rawIsUsable ? raw : levels.near;

  let resistance = Number(levels.resistance || d.resistance || d.bbHigh || last * 1.05);
  if (!isFinite(resistance) || resistance <= last) {
    resistance = Math.max(Number(d.bbHigh || 0), last * 1.05);
  }

  return {
    support: support,
    resistance: resistance,
    rawSupport: isFinite(raw) && raw > 0 ? raw : null,
    adjusted: !rawIsUsable
  };
}

function buildMarketSnapshotV748_(data) {
  let spy = null, vix = 18, usdthb = 32.7;
  try { spy = fetchTechnicalDataV748_({ symbol: 'SPY', currency: 'USD', portfolio: 'MKT', cat: 'ETF' }); } catch (e) {}
  try {
    const vixD = fetchTechnicalDataV748_({ symbol: '^VIX', currency: 'USD', portfolio: 'MKT', cat: 'Index' });
    if (vixD && vixD.ok) vix = vixD.last;
  } catch (e2) {}
  try {
    const fx = fetchTechnicalDataV748_({ symbol: 'USDTHB=X', currency: 'THB', portfolio: 'MKT', cat: 'FX' });
    if (fx && fx.ok) usdthb = fx.last;
  } catch (e3) {}

  const spyMa200Pct = spy && spy.ok ? (spy.last - spy.sma200) / spy.sma200 * 100 : 0;
  let heat = 45;
  if (spyMa200Pct > 12) heat += 20;
  else if (spyMa200Pct > 8) heat += 10;
  else if (spyMa200Pct < 0) heat -= 20;
  if (vix > 25) heat += 20;
  else if (vix < 16) heat += 5;
  heat = Math.max(0, Math.min(100, Math.round(heat)));
  return {
    spyMa200Pct: spyMa200Pct,
    vix: vix,
    usdthb: usdthb,
    heat: heat,
    regime: spyMa200Pct >= 0 ? 'Bull / Uptrend' : 'Risk-off / Below MA200'
  };
}


function rsiRegimeV820_(cfg, rsi) {
  const value = Number(rsi || 0);
  const spec = isSpeculativeV753_(cfg);
  const isEtf = cfg && cfg.cat === 'Core ETF';

  if (!value) {
    return { label: 'ไม่พบค่า RSI', scoreAdj: -1, locked: true, techAllowed: false, checklistPass: false };
  }

  // Core ETF: allow light DCA while warm; lock only when very extended.
  if (isEtf) {
    if (value >= RSI_ETF_LOCK_V820) return { label: 'ETF RSI ร้อนมาก ลด/พัก DCA', scoreAdj: -2, locked: true, techAllowed: false, checklistPass: false };
    if (value >= RSI_WARM_V820) return { label: 'ETF RSI ร้อน ใช้ DCA เบา', scoreAdj: -1, locked: false, techAllowed: true, checklistPass: true };
    if (value <= 35) return { label: 'ETF ย่อ/ขายมาก เหมาะทยอยสะสมถ้า trend ไม่เสีย', scoreAdj: 1, locked: false, techAllowed: true, checklistPass: true };
    if (value >= RSI_MOMENTUM_MIN_V820) return { label: 'ETF momentum ดี', scoreAdj: 1, locked: false, techAllowed: true, checklistPass: true };
    return { label: 'ETF momentum ยังกลาง ๆ', scoreAdj: 0, locked: false, techAllowed: true, checklistPass: true };
  }

  // Speculative names: do not chase once RSI crosses 70; oversold is rebound-watch only.
  if (spec) {
    if (value >= RSI_SPEC_HOT_V820) return { label: 'Speculative RSI ร้อน ห้ามไล่ราคา', scoreAdj: -3, locked: true, techAllowed: false, checklistPass: false };
    if (value >= RSI_SPEC_WARM_V820) return { label: 'Speculative RSI เริ่มร้อน ลดงบ/รอย่อ', scoreAdj: -1, locked: false, techAllowed: true, checklistPass: true };
    if (value < RSI_OVERSOLD_V820) return { label: 'Speculative RSI ต่ำกว่า 30 รอกลับตัวก่อน', scoreAdj: -2, locked: true, techAllowed: false, checklistPass: false };
    if (value >= RSI_MOMENTUM_MIN_V820) return { label: 'RSI อยู่โซน momentum บวก', scoreAdj: 1, locked: false, techAllowed: true, checklistPass: true };
    return { label: 'RSI ยังไม่ยืนยัน momentum', scoreAdj: 0, locked: false, techAllowed: false, checklistPass: true };
  }

  // Normal US/Thai stocks.
  if (value >= RSI_EUPHORIA_V820) return { label: 'RSI euphoria ห้ามไล่ราคา', scoreAdj: -4, locked: true, techAllowed: false, checklistPass: false };
  if (value >= RSI_HOT_V820) return { label: 'RSI สูงมาก ห้ามเปิดไม้ใหม่', scoreAdj: -3, locked: true, techAllowed: false, checklistPass: false };
  if (value >= RSI_WARM_V820) return { label: 'RSI ร้อน ลดงบ/รอย่อ', scoreAdj: -1, locked: false, techAllowed: true, checklistPass: true };
  if (value < RSI_OVERSOLD_V820) return { label: 'RSI ต่ำกว่า 30 เป็น Rebound Watch ไม่รับมีด', scoreAdj: -2, locked: true, techAllowed: false, checklistPass: false };
  if (value >= RSI_MOMENTUM_MIN_V820) return { label: 'RSI 50–70 เป็น healthy momentum', scoreAdj: 1, locked: false, techAllowed: true, checklistPass: true };
  return { label: 'RSI 30–50 momentum ยังไม่พอ', scoreAdj: 0, locked: false, techAllowed: false, checklistPass: true };
}

function isRsiChecklistPassV820_(cfg, rsi) {
  return rsiRegimeV820_(cfg, rsi).checklistPass;
}

function isRsiTechnicalAllowedV820_(cfg, rsi) {
  return rsiRegimeV820_(cfg, rsi).techAllowed;
}

function buildSymbolDecisionV748_(cfg, d, market, lite) {
  const reasons = [];
  let score = 0;
  let openBuy = false;
  let locked = false;

  if (!d || !d.ok) {
    return { symbol: cfg.symbol, cfg: cfg, ok: false, openBuy: false, score: -99, reasons: ['ดึงข้อมูลราคาไม่ได้'], plan: null };
  }

  if (d.last > d.ema20) { score += 1; reasons.push('ราคาเหนือ EMA20 ระยะสั้นเป็นบวก'); }
  else { score -= 1; reasons.push('ราคาต่ำกว่า EMA20 ระยะสั้นยังอ่อน'); }
  if (d.ema20 > d.ema50) { score += 1; reasons.push('EMA20/50 เป็นขาขึ้น'); }
  else { score -= 1; reasons.push('EMA20/50 ยังไม่ยืนยัน'); }
  if (d.ema50 > d.ema200) { score += 1; reasons.push('EMA50/200 เป็นขาขึ้นระยะยาว'); }
  else { score -= 2; reasons.push('แนวโน้มยาวยังไม่แข็งแรง'); }
  if (d.macdHist > 0) { score += 1; reasons.push('MACD เป็นสัญญาณบวก'); }
  else { score -= 1; reasons.push('MACD ยังอ่อน'); }
  if (d.obvSlope > 0) { score += 1; reasons.push('OBV เพิ่มขึ้น มีแรงสะสม'); }
  else { reasons.push('OBV ยังไม่สนับสนุนชัด'); }

  const rsiRegime = rsiRegimeV820_(cfg, d.rsi);
  score += rsiRegime.scoreAdj;
  if (rsiRegime.locked) locked = true;
  reasons.push(rsiRegime.label);

  if (d.volatility > VOL_HIGH_V800) { score -= 2; reasons.push('ความผันผวนสูงมาก ต้องใช้ไม้เล็ก'); }
  else if (d.volatility > VOL_WARN_V800) { score -= 1; reasons.push('ความผันผวนสูง'); }
  else { score += 1; reasons.push('ความผันผวนรับได้'); }

  if (cfg.cat === 'Core ETF') { score += 2; reasons.push('Core ETF ใช้ DCA ได้ ไม่แดงง่ายจาก ATH'); }
  if (cfg.cat === 'Speculative') { score -= 1; reasons.push('หุ้น Speculative จำกัดขนาดไม้'); }
  if (market.heat >= MARKET_HEAT_HOT_V800 && cfg.cat === 'Speculative') { score -= 3; locked = true; reasons.push('Market Heat สูง ไม่เปิดไม้หุ้นเก็งกำไร'); }
  else if (market.heat >= MARKET_HEAT_HOT_V800) { score -= 1; reasons.push('ตลาดร้อน ลดขนาดไม้'); }

  // V8.0: base decision only scores the symbol.
  // Buy/no-buy and plan creation are centralized in applyBuyTierLogicV753_.
  openBuy = false;
  const confidence = Math.max(20, Math.min(85, 45 + score * 5 - (d.volatility > 0.05 ? 8 : 0)));
  const plan = null;

  return {
    symbol: cfg.symbol,
    cfg: cfg,
    ok: true,
    last: d.last,
    changePct: d.changePct,
    score: score,
    confidence: confidence,
    openBuy: openBuy,
    locked: locked,
    rsiRegime: rsiRegime,
    plan: plan,
    reasons: reasons,
    momentumScore: d.last >= d.sma5 ? 1 : -1,
    momentumText: d.last >= d.sma5 ? 'ระยะสั้นเป็นบวก' : 'ระยะสั้นอ่อนตัว'
  };
}


function applyBuyTierLogicV753_(decision, d, market) {
  if (!decision || !decision.ok || !d || !d.ok) return decision;

  const cfg = decision.cfg;
  const news = decision.news || emptyNewsV748_();
  const tech = technicalPassV753_(decision, d);
  const spec = isSpeculativeV753_(cfg);
  const oneDayMove = Math.abs(Number(d.changePct || 0));
  const newsPass = !!news.gatePass;
  const badNews = Number(news.score || 0) < -1;

  decision.buyTier = 'WAIT';
  decision.displayAction = 'WAIT';
  decision.openBuy = false;
  decision.plan = null;

  if (decision.locked) {
    decision.reasons.unshift(decision.rsiRegime ? decision.rsiRegime.label : 'Risk filter locked');
    return decision;
  }

  // Core ETF: use ETF protection + trend. News is not mandatory for index ETF.
  if (cfg.cat === 'Core ETF') {
    if (decision.score >= 4 && d.last > d.ema20 && d.ema20 > d.ema50 && isRsiTechnicalAllowedV820_(cfg, d.rsi)) {
      decision.buyTier = 'FULL_BUY';
      decision.displayAction = 'BUY';
      decision.openBuy = true;
      decision.plan = buildBuy3PlanV753_(cfg, d, market, decision.score, 1.0);
      decision.reasons.unshift('Core ETF ผ่าน ETF Protection ใช้ DCA ได้');
      return decision;
    }
    decision.reasons.unshift('Core ETF ยังไม่ผ่าน trend พอสำหรับเปิดไม้');
    return decision;
  }

  // Thai stocks: news gate is optional; use technical + lower budget.
  if ((cfg.currency || 'USD') === 'THB') {
    // Thai stocks intentionally use TECH_BUY sizing only: lower liquidity/foreign-flow sensitivity
    // and weaker English-news coverage make full automated BUY too aggressive.
    if (tech.strong && decision.score >= 4 && market.heat < MARKET_HEAT_BLOCK_V800) {
      decision.buyTier = 'TECH_BUY';
      decision.displayAction = 'TECH BUY';
      decision.openBuy = true;
      decision.plan = buildBuy3PlanV753_(cfg, d, market, decision.score, 0.35);
      decision.reasons.unshift('หุ้นไทยใช้ News Gate แบบ optional และ technical ผ่าน');
    }
    return decision;
  }

  // US stocks with relevant non-negative news can be full buy if technical is solid.
  if (newsPass && !badNews && tech.strong && decision.score >= 4 && market.heat < MARKET_HEAT_BLOCK_V800 && !spec) {
    decision.buyTier = 'FULL_BUY';
    decision.displayAction = 'BUY';
    decision.openBuy = true;
    decision.plan = buildBuy3PlanV753_(cfg, d, market, decision.score, 0.75);
    decision.reasons.unshift('ข่าวผ่าน + technical ผ่าน');
    return decision;
  }

  // US stocks with no direct news but technical is solid: allow small technical buy.
  // Do NOT allow chasing very speculative or very large one-day movers.
  if (!newsPass && !badNews && tech.strong && decision.score >= 4 && market.heat < MARKET_HEAT_HOT_V800 && !spec && oneDayMove <= MAX_TECH_BUY_ONE_DAY_MOVE_V800) {
    decision.buyTier = 'TECH_BUY';
    decision.displayAction = 'TECH BUY';
    decision.openBuy = true;
    decision.plan = buildBuy3PlanV753_(cfg, d, market, decision.score, 0.30);
    decision.confidence = Math.min(decision.confidence, 55);
    decision.reasons.unshift('News Gate ยังไม่ผ่าน แต่ technical แข็งพอสำหรับไม้เล็ก');
    return decision;
  }

  // Speculative stocks need stronger confirmation. If they ran too far, watch only.
  if (spec) {
    if (oneDayMove >= 8) decision.reasons.unshift('Speculative + วิ่งแรงวันนี้ ไม่ไล่ราคา');
    else if (!newsPass) decision.reasons.unshift('Speculative ต้องรอข่าวตรง symbol หรือ pullback ก่อน');
    else if (badNews) decision.reasons.unshift('ข่าวลบสำหรับหุ้น speculative');
    else decision.reasons.unshift('Speculative ยังไม่ผ่าน margin of safety');
    return decision;
  }

  if (badNews) decision.reasons.unshift('ข่าวเป็นลบ ลดความเสี่ยงก่อน');
  else if (!newsPass && tech.weakReason) decision.reasons.unshift('News Gate ไม่ผ่าน และ ' + tech.weakReason);
  else if (oneDayMove > MAX_TECH_BUY_ONE_DAY_MOVE_V800) decision.reasons.unshift('ราคาวิ่งแรงวันนี้ รอ pullback ก่อน');
  return decision;
}

function technicalPassV753_(decision, d) {
  const fails = [];
  if (!(d.last > d.ema20)) fails.push('ราคายังต่ำกว่า EMA20');
  if (!(d.ema20 > d.ema50)) fails.push('EMA20/50 ยังไม่เป็นขาขึ้น');
  if (!(d.macdHist >= 0)) fails.push('MACD ยังลบ');
  if (!isRsiTechnicalAllowedV820_(decision.cfg, d.rsi)) fails.push(rsiRegimeV820_(decision.cfg, d.rsi).label);
  if (!(d.volatility <= VOL_HIGH_V800)) fails.push('ผันผวนสูงเกิน');
  return { strong: fails.length === 0, weakReason: fails.slice(0, 2).join(', ') };
}

function isSpeculativeV753_(cfg) {
  const c = String((cfg && cfg.cat) || '').toLowerCase();
  const s = String((cfg && cfg.symbol) || '').toUpperCase();
  if (/spec|quantum|space|nuclear/.test(c)) return true;
  return ['ASTS', 'RKLB', 'RGTI', 'AXTI', 'OKLO', 'NBIS', 'AEHR'].indexOf(s) >= 0;
}

function buildBuy3PlanV753_(cfg, d, market, score, tierMult) {
  let base = cfg.currency === 'THB' ? BUDGET_BASE_THB : BUDGET_BASE_USD;
  let mult = tierMult || 1;
  if (cfg.cat === 'Core ETF') mult *= 1.2;
  if (isSpeculativeV753_(cfg)) mult *= 0.35;
  if (market.heat >= 70) mult *= 0.5;
  if (score >= 6 && mult >= 0.7) mult *= 1.1;
  const total = roundMoneyV748_(base * mult, cfg.currency);
  const ratio = market.heat >= 70 ? [10, 20, 70] : market.heat <= 35 ? [40, 30, 30] : [25, 35, 40];
  const supports = buildSupportLevelsV773_(d);
  const p1 = supports.near;
  const p2 = supports.mid;
  const p3 = supports.deep;
  return {
    total: total,
    ratio: ratio,
    legs: [
      { amount: roundMoneyV748_(total * ratio[0] / 100, cfg.currency), price: p1 },
      { amount: roundMoneyV748_(total * ratio[1] / 100, cfg.currency), price: p2 },
      { amount: roundMoneyV748_(total * ratio[2] / 100, cfg.currency), price: p3 }
    ]
  };
}

function buildBuyOnlyMessageV748_(buyList, title) {
  const lines = [title || '🎯 เปิดไม้ซื้อ 3 ไม้เท่านั้น', ''];
  if (!buyList || !buyList.length) {
    lines.push('วันนี้ยังไม่เปิดไม้ซื้อใหม่');
    lines.push('เหตุผลหลัก: คะแนนไม่พอ / RSI ร้อน / ความผันผวนสูง / Market Heat ไม่เหมาะ');
    return lines.join('\n');
  }
  buyList.forEach(function(x, idx) {
    lines.push((idx + 1) + '. ' + x.symbol + ' ' + (x.buyTier === 'TECH_BUY' ? '🟡 TECH BUY' : '🟢 BUY') + ' | C' + Math.round(x.confidence) + '% | Score ' + x.score);
    lines.push('   ซื้อรวม: ' + moneyV748_(x.plan.total, x.cfg.currency) + ' | 3 ไม้ ' + x.plan.ratio.join(':'));
    x.plan.legs.forEach(function(leg, i) {
      lines.push('   ไม้ ' + (i + 1) + ': ' + moneyV748_(leg.amount, x.cfg.currency) + ' @≤' + moneyV748_(leg.price, x.cfg.currency));
    });
    lines.push('   เหตุผล: ' + x.reasons.slice(0, 2).join(' / '));
    lines.push('');
  });
  return lines.join('\n');
}

function buildSingleBuyPlanTextV748_(decision) {
  if (!decision.openBuy || !decision.plan) {
    const reasons = decision.reasons.slice(0, 3).join(' / ');
    return '🎯 แผนเข้าซื้อ 3 ไม้\nยังไม่เปิดซื้อใหม่วันนี้\nเหตุผล: ' + reasons;
  }
  const lines = ['🎯 แผนเข้าซื้อ 3 ไม้'];
  lines.push('ซื้อรวม: ' + moneyV748_(decision.plan.total, decision.cfg.currency) + ' | 3 ไม้ ' + decision.plan.ratio.join(':'));
  decision.plan.legs.forEach(function(leg, i) {
    lines.push('ไม้ ' + (i + 1) + ': ' + moneyV748_(leg.amount, decision.cfg.currency) + ' @≤' + moneyV748_(leg.price, decision.cfg.currency));
  });
  lines.push('เหตุผล: ' + decision.reasons.slice(0, 2).join(' / '));
  return lines.join('\n');
}

function buildWaitSummaryV748_(waitList) {
  const lines = ['⏳ รอก่อน / ไม่เปิดไม้'];
  waitList.forEach(function(x) {
    lines.push(x.symbol + ': รอ | ' + x.reasons.slice(0, 2).join(' / '));
  });
  return lines.join('\n');
}

function fetchNewsForSymbolsV748_(configs) {
  // V8.8 News Provider Layer:
  // Yahoo Search remains the first fast source; Finnhub Company News is merged as a second source.
  const yahoo = fetchYahooNewsForSymbolsV880_(configs);
  const finnhub = fetchFinnhubNewsForSymbolsV880_(configs);
  const out = {};

  configs.forEach(function(cfg) {
    out[cfg.symbol] = mergeNewsSourcesV880_(cfg, yahoo[cfg.symbol] || emptyNewsV748_(), finnhub[cfg.symbol] || emptyNewsV748_('Finnhub skipped'));
  });

  return out;
}

function fetchYahooNewsForSymbolsV880_(configs) {
  const reqs = configs.map(function(cfg) {
    const q = encodeURIComponent(cfg.symbol + ' stock');
    return {
      url: 'https://query1.finance.yahoo.com/v1/finance/search?q=' + q + '&newsCount=5&quotesCount=0',
      muteHttpExceptions: true,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    };
  });
  const out = {};
  try {
    const resps = UrlFetchApp.fetchAll(reqs);
    resps.forEach(function(res, idx) {
      const cfg = configs[idx];
      out[cfg.symbol] = parseYahooSearchNewsV748_(cfg, res.getResponseCode(), res.getContentText());
    });
  } catch (err) {
    configs.forEach(function(cfg) { out[cfg.symbol] = emptyNewsV748_(err.message); });
  }
  return out;
}

function parseYahooSearchNewsV748_(cfg, code, body) {
  const aliases = SYMBOL_ALIASES_V748[cfg.symbol] || [cfg.symbol];
  if (code !== 200) return emptyNewsV748_('HTTP ' + code);
  try {
    const json = JSON.parse(body);
    const news = json.news || [];
    const relevant = news.filter(function(n) {
      const title = String(n.title || '');
      return isRelevantHeadlineV748_(title, aliases, cfg);
    }).slice(0, 5);
    const score = relevant.reduce(function(sum, n) { return sum + sentimentScoreV748_(n.title || ''); }, 0);
    return {
      yahoo: relevant.length,
      investing: 0,
      thai: 0,
      http: code,
      score: Math.max(-3, Math.min(3, score)),
      headline: relevant.length ? relevant[0].title : '',
      gatePass: relevant.length > 0,
      status: relevant.length ? 'PASS' : 'BLOCK',
      source: relevant.length ? 'Yahoo' : ''
    };
  } catch (err) {
    return emptyNewsV748_(err.message);
  }
}

function isRelevantHeadlineV748_(title, aliases, cfg) {
  const t = String(title || '').toLowerCase();
  if (cfg.cat === 'Core ETF') {
    return /s&p|nasdaq|market|stocks|etf|vanguard|invesco|fed|rate|inflation/.test(t) || aliases.some(function(a){return t.indexOf(String(a).toLowerCase()) >= 0;});
  }
  return aliases.some(function(a) { return t.indexOf(String(a).toLowerCase()) >= 0; });
}

function sentimentScoreV748_(headline) {
  const h = String(headline || '').toLowerCase();
  const bull = [
    ['reiterates buy', 2], ['outperform', 2], ['upgrade', 2], ['raises target', 2], ['optimism', 2],
    ['growth', 1], ['strong', 1], ['beats', 2], ['champion', 2], ['partnership', 1], ['record', 1], ['wins', 1],
    ['แนะซื้อ', 2], ['เป้าใหม่', 2], ['กำไร', 1], ['เติบโต', 1]
  ];
  const bear = [
    ['probe', -2], ['investigation', -2], ['lawsuit', -2], ['crash', -2], ['sinks', -2], ['tumbles', -2], ['falls', -1],
    ['downgrade', -2], ['cuts', -1], ['misses', -2], ['pressure', -1], ['selloff', -2], ['insider sold', -2],
    ['ร่วง', -2], ['ดิ่ง', -2], ['สอบสวน', -2], ['ขาดทุน', -2]
  ];
  let score = 0;
  bull.forEach(function(k) { if (h.indexOf(k[0]) >= 0) score += k[1]; });
  bear.forEach(function(k) { if (h.indexOf(k[0]) >= 0) score += k[1]; });
  return Math.max(-3, Math.min(3, score));
}

function agentNewsIntelligence(s) {
  s = s || {};
  s.news = s.news || emptyNewsV748_();
  return {
    yahoo: Number(s.news.yahoo || 0),
    finnhub: Number(s.news.finnhub || 0),
    investing: Number(s.news.investing || 0),
    thai: Number(s.news.thai || 0),
    score: Number(s.news.score || 0),
    sentiment: s.news.sentiment || 'Neutral',
    headline: s.news.headline || '',
    gatePass: !!s.news.gatePass
  };
}


function fetchFinnhubNewsForSymbolsV880_(configs) {
  const out = {};
  const key = PropertiesService.getScriptProperties().getProperty('FINNHUB_API_KEY');
  if (!key) {
    configs.forEach(function(cfg) { out[cfg.symbol] = emptyNewsV748_('Missing FINNHUB_API_KEY'); });
    return out;
  }

  const today = new Date();
  const from = new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000);
  const toStr = Utilities.formatDate(today, 'Etc/UTC', 'yyyy-MM-dd');
  const fromStr = Utilities.formatDate(from, 'Etc/UTC', 'yyyy-MM-dd');

  const eligible = configs.filter(function(cfg) {
    return (cfg.currency || 'USD') !== 'THB' && cfg.cat !== 'Core ETF';
  });

  eligible.forEach(function(cfg) { out[cfg.symbol] = emptyNewsV748_('Finnhub not fetched'); });
  configs.forEach(function(cfg) {
    if (!out[cfg.symbol]) out[cfg.symbol] = emptyNewsV748_('Finnhub skipped');
  });

  if (!eligible.length) return out;

  const reqs = eligible.map(function(cfg) {
    return {
      url: 'https://finnhub.io/api/v1/company-news?symbol=' + encodeURIComponent(cfg.symbol) +
        '&from=' + encodeURIComponent(fromStr) +
        '&to=' + encodeURIComponent(toStr) +
        '&token=' + encodeURIComponent(key),
      muteHttpExceptions: true,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    };
  });

  try {
    const resps = UrlFetchApp.fetchAll(reqs);
    resps.forEach(function(res, idx) {
      const cfg = eligible[idx];
      out[cfg.symbol] = parseFinnhubCompanyNewsV880_(cfg, res.getResponseCode(), res.getContentText());
    });
  } catch (err) {
    eligible.forEach(function(cfg) { out[cfg.symbol] = emptyNewsV748_('Finnhub fetchAll: ' + err.message); });
  }

  return out;
}

function fetchFinnhubCompanyNewsV880_(cfg) {
  const key = PropertiesService.getScriptProperties().getProperty('FINNHUB_API_KEY');
  if (!key) return emptyNewsV748_('Missing FINNHUB_API_KEY');

  const today = new Date();
  const from = new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000);
  const toStr = Utilities.formatDate(today, 'Etc/UTC', 'yyyy-MM-dd');
  const fromStr = Utilities.formatDate(from, 'Etc/UTC', 'yyyy-MM-dd');

  try {
    const url = 'https://finnhub.io/api/v1/company-news?symbol=' + encodeURIComponent(cfg.symbol) +
      '&from=' + encodeURIComponent(fromStr) +
      '&to=' + encodeURIComponent(toStr) +
      '&token=' + encodeURIComponent(key);
    const res = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    return parseFinnhubCompanyNewsV880_(cfg, res.getResponseCode(), res.getContentText());
  } catch (err) {
    return emptyNewsV748_('Finnhub: ' + err.message);
  }
}

function parseFinnhubCompanyNewsV880_(cfg, code, body) {
  if (code !== 200) return emptyNewsV748_('Finnhub HTTP ' + code);
  try {
    const aliases = SYMBOL_ALIASES_V748[cfg.symbol] || [cfg.symbol];
    const arr = JSON.parse(body || '[]');
    if (!Array.isArray(arr)) return emptyNewsV748_('Finnhub invalid response');

    const relevant = arr.filter(function(n) {
      const title = String(n.headline || n.summary || '');
      return isRelevantHeadlineV748_(title, aliases, cfg);
    }).slice(0, 5);

    const score = relevant.reduce(function(sum, n) {
      return sum + sentimentScoreV748_(String(n.headline || '') + ' ' + String(n.summary || ''));
    }, 0);

    return {
      yahoo: 0,
      finnhub: relevant.length,
      investing: 0,
      thai: 0,
      http: code,
      score: Math.max(-3, Math.min(3, score)),
      headline: relevant.length ? relevant[0].headline : '',
      gatePass: relevant.length > 0,
      status: relevant.length ? 'PASS' : 'BLOCK',
      source: relevant.length ? 'Finnhub' : '',
      error: relevant.length ? '' : 'No relevant Finnhub news'
    };
  } catch (err) {
    return emptyNewsV748_('Finnhub parse: ' + err.message);
  }
}

function mergeNewsSourcesV880_(cfg, yahoo, finnhub) {
  yahoo = yahoo || emptyNewsV748_();
  finnhub = finnhub || emptyNewsV748_();

  const yCount = Number(yahoo.yahoo || 0);
  const fCount = Number(finnhub.finnhub || 0);
  const combinedScore = Math.max(-3, Math.min(3, Number(yahoo.score || 0) + Number(finnhub.score || 0)));

  const headline = yahoo.headline || finnhub.headline || '';
  const source = yahoo.headline ? 'Yahoo' : (finnhub.headline ? 'Finnhub' : '');
  const pass = yCount > 0 || fCount > 0 || cfg.cat === 'Core ETF';

  return {
    yahoo: yCount,
    finnhub: fCount,
    investing: 0,
    thai: Number(yahoo.thai || 0) + Number(finnhub.thai || 0),
    http: yahoo.http || finnhub.http || 0,
    score: combinedScore,
    headline: headline,
    gatePass: pass,
    status: pass ? 'PASS' : 'BLOCK',
    source: source,
    error: pass ? '' : ((yahoo.error || '') + ' ' + (finnhub.error || '')).trim()
  };
}


function emptyNewsV748_(err) {
  return { yahoo: 0, finnhub: 0, investing: 0, thai: 0, score: 0, headline: '', gatePass: false, status: 'BLOCK', source: '', error: err || '' };
}

function shortReasonFromHeadlineV748_(headline) {
  if (!headline) return 'ไม่มีข่าวตรง symbol ในรอบนี้';
  const s = String(headline);
  if (/sinks|tumbles|falls|crash|probe|lawsuit|pressure|downgrade/i.test(s)) return 'อ่อนตัวจากข่าว/แรงกดดัน: ' + truncateV748_(s, 90);
  if (/buy|outperform|optimism|growth|champion|raises|partnership|strong/i.test(s)) return 'ได้แรงหนุนจากข่าวบวก: ' + truncateV748_(s, 90);
  return truncateV748_(s, 100);
}

function smaV748_(arr, n) {
  const a = arr.slice(-n);
  return a.reduce(function(x,y){return x+y;},0) / a.length;
}
function emaSeriesV748_(arr, n) {
  const k = 2 / (n + 1);
  const out = [];
  let ema = arr[0];
  arr.forEach(function(v) { ema = v * k + ema * (1 - k); out.push(ema); });
  return out;
}
function rsiV748_(arr, n) {
  let gains = 0, losses = 0;
  const start = Math.max(1, arr.length - n);
  for (let i = start; i < arr.length; i++) {
    const diff = arr[i] - arr[i - 1];
    if (diff >= 0) gains += diff; else losses -= diff;
  }
  if (losses === 0) return 100;
  const rs = gains / losses;
  return 100 - (100 / (1 + rs));
}
function macdV748_(arr) {
  const ema12 = emaSeriesV748_(arr, 12);
  const ema26 = emaSeriesV748_(arr, 26);
  const macdLine = ema12.map(function(v, i){ return v - ema26[i]; });
  const signal = emaSeriesV748_(macdLine, 9);
  return { macd: macdLine[macdLine.length - 1], signal: signal[signal.length - 1], hist: macdLine[macdLine.length - 1] - signal[signal.length - 1] };
}
function bollingerV748_(arr, n, k) {
  const a = arr.slice(-n);
  const mid = smaV748_(arr, n);
  const sd = stdV748_(a.map(function(x){ return x - mid; }));
  return { mid: mid, low: mid - k * sd, high: mid + k * sd };
}
function obvSeriesV748_(close, volume) {
  const out = [0];
  for (let i = 1; i < close.length; i++) {
    const v = volume[i] || 0;
    out.push(out[out.length - 1] + (close[i] > close[i - 1] ? v : close[i] < close[i - 1] ? -v : 0));
  }
  return out;
}
function stdV748_(arr) {
  if (!arr.length) return 0;
  const mean = arr.reduce(function(a,b){return a+b;},0) / arr.length;
  const variance = arr.reduce(function(a,b){return a + Math.pow(b - mean, 2);},0) / arr.length;
  return Math.sqrt(variance);
}

function moneyV748_(v, currency) {
  if (v === null || v === undefined || !isFinite(v)) return '-';
  const prefix = currency === 'THB' ? '฿' : '$';
  return prefix + Number(v).toFixed(currency === 'THB' ? 2 : 2);
}
function roundMoneyV748_(v, currency) {
  return Math.round(Number(v) * 100) / 100;
}
function fmtNumV748_(v, d) { return isFinite(v) ? Number(v).toFixed(d || 2) : '-'; }
function fmtPctV748_(v) { return isFinite(v) ? (v >= 0 ? '+' : '') + Number(v).toFixed(2) + '%' : '-'; }
function heatEmojiV748_(h) { return h >= 70 ? '🔴 ร้อน' : h >= 50 ? '🟡 กลาง' : '🟢 ปกติ'; }
function trendIconV748_(v) { return v >= 0 ? '📈' : '📉'; }
function rsiTextV748_(r) {
  if (r >= RSI_EUPHORIA_V820) return 'ร้อนจัด/euphoria';
  if (r >= RSI_HOT_V820) return 'ร้อนมาก';
  if (r >= RSI_WARM_V820) return 'เริ่มร้อน';
  if (r < RSI_OVERSOLD_V820) return 'ขายมากเกินไป';
  if (r >= RSI_MOMENTUM_MIN_V820) return 'momentum บวก';
  return 'ปกติ/ยังไม่แรง';
}
function rsiEmojiV748_(r) { return r >= RSI_WARM_V820 ? '🔴' : r < RSI_OVERSOLD_V820 ? '🟡' : '🟢'; }
function macdTextV748_(d) { return d.macdHist >= 0 ? 'สัญญาณบวก' : 'เริ่มอ่อนแรง'; }
function volTextV748_(v) { return v > 0.055 ? 'สูง' : v > 0.035 ? 'กลาง' : 'ต่ำ'; }
function bollEmojiV748_(d) { return d.last > d.bbHigh ? '🔴' : d.last < d.bbLow ? '🟡' : '🟢'; }
function truncateV748_(s, n) { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; }


/* ============================================================
 * V7.7 RM-STYLE PORTFOLIO REVIEW MODE
 * - Creates one-page HTML report in Google Drive
 * - Uses current fast market data already available to the bot
 * - Does not replace Stockify / Buy 3 entries mode
 * ============================================================ */

function buildPortfolioReviewRMReportV770() {
  const result = createPortfolioReviewHtmlFileV770_();
  return [
    '📄 Portfolio Review v7.7 พร้อมแล้วครับ',
    'สไตล์: RM one-page review',
    'ไฟล์: ' + result.name,
    result.url,
    '',
    'หมายเหตุ: รายงานนี้ใช้ข้อมูลพอร์ต/Watchlist จากระบบ + market data ที่ดึงได้ ณ เวลาสร้าง ไม่ใช่คำแนะนำการลงทุน'
  ].join('\n');
}

function createPortfolioReviewHtmlFileV770_() {
  const now = new Date();
  const stamp = Utilities.formatDate(now, TZ, 'yyyy-MM-dd-HHmm');
  const filename = 'portfolio-review-' + stamp + '.html';
  const html = buildPortfolioReviewHtmlV770_(now);
  const file = DriveApp.createFile(filename, html, MimeType.HTML);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return { name: filename, url: file.getUrl(), id: file.getId() };
}

function buildPortfolioReviewHtmlV770_(now) {
  const ctx = buildPortfolioReviewContextV770_(now);
  const dateLong = Utilities.formatDate(now, TZ, 'MMMM dd, yyyy');
  const asOf = Utilities.formatDate(now, TZ, 'yyyy-MM-dd HH:mm');
  const esc = escapeHtmlV770_;

  return '<!DOCTYPE html>' +
'<html lang="en">' +
'<head>' +
'<meta charset="UTF-8">' +
'<title>Portfolio Review — ' + esc(dateLong) + '</title>' +
'<style>' +
'  @page { size: letter; margin: 0.5in; }' +
'  * { box-sizing: border-box; }' +
'  body { font-family: Georgia, "Times New Roman", serif; font-size: 11px; line-height: 1.45; color: #1a1a1a; max-width: 7.5in; margin: 0 auto; padding: 0.4in 0.5in; background: #fff; }' +
'  header { border-bottom: 2px solid #1a1a1a; padding-bottom: 8px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: baseline; }' +
'  h1 { font-size: 18px; margin: 0; font-weight: 600; letter-spacing: -0.2px; }' +
'  .date { font-size: 10.5px; color: #555; font-style: italic; }' +
'  h2 { font-family: -apple-system, "Helvetica Neue", Arial, sans-serif; font-size: 11px; text-transform: uppercase; letter-spacing: 0.8px; color: #444; margin: 12px 0 5px; border-bottom: 1px solid #ddd; padding-bottom: 2px; }' +
'  section { margin-bottom: 8px; } p { margin: 4px 0; } ul, ol { margin: 4px 0; padding-left: 18px; } li { margin-bottom: 3px; }' +
'  .snapshot-wrap { display: grid; grid-template-columns: 1.6fr 1fr; gap: 16px; align-items: start; }' +
'  table { width: 100%; border-collapse: collapse; font-size: 10.5px; } th, td { text-align: left; padding: 3px 6px; border-bottom: 1px solid #eee; } th { font-weight: 600; color: #555; } td.num { text-align: right; font-variant-numeric: tabular-nums; }' +
'  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; } .pos h2 { color: #1a5d3a; border-bottom-color: #c5e4d2; } .neg h2 { color: #8a2a2a; border-bottom-color: #e8c5c5; }' +
'  footer { margin-top: 12px; padding-top: 8px; border-top: 1px solid #ccc; font-size: 9.5px; color: #666; font-style: italic; line-height: 1.4; } strong { color: #000; }' +
'</style>' +
'</head>' +
'<body>' +
'<header><h1>Portfolio Review</h1><span class="date">' + esc(dateLong) + '</span></header>' +
'<section><h2>Snapshot</h2><div class="snapshot-wrap"><p>' + esc(ctx.snapshot) + '</p>' +
'<table><thead><tr><th>Allocation Lens</th><th class="num">Count</th></tr></thead><tbody>' +
ctx.tableRows.map(function(r){ return '<tr><td>' + esc(r.label) + '</td><td class="num">' + esc(r.value) + '</td></tr>'; }).join('') +
'</tbody></table></div></section>' +
'<section><h2>Current macro lens</h2><ul>' +
ctx.macro.map(function(x){ return '<li><strong>' + esc(x.theme) + ':</strong> ' + esc(x.text) + '</li>'; }).join('') +
'</ul></section>' +
'<div class="two-col"><section class="pos"><h2>What\'s working</h2><ul>' +
ctx.working.map(function(x){ return '<li><strong>' + esc(x.title) + ':</strong> ' + esc(x.text) + '</li>'; }).join('') +
'</ul></section><section class="neg"><h2>What concerns me</h2><ul>' +
ctx.concerns.map(function(x){ return '<li><strong>' + esc(x.title) + ':</strong> ' + esc(x.text) + '</li>'; }).join('') +
'</ul></section></div>' +
'<section><h2>Discussion points</h2><ol>' +
ctx.discussion.map(function(x){ return '<li>' + esc(x) + '</li>'; }).join('') +
'</ol></section>' +
'<footer>Assumptions: actual capital weights were not supplied, so allocation comments use known holdings, watchlist groupings, and position count rather than account-level market value. This report is informational and reflects market/data conditions as of ' + esc(asOf) + ' Asia/Bangkok; it is not a personalized investment recommendation.</footer>' +
'</body></html>';
}

function buildPortfolioReviewContextV770_(now) {
  const dime = DIME_HOLDINGS_V748.slice();
  const thai = THAI_HOLDINGS_V748.slice();
  const watch = getUSWatchlistFromSheetV760_();
  const usAll = uniqueBySymbolV770_(dime.concat(watch));
  const allHoldings = dime.concat(thai);
  const sector = summarizeCategoriesV770_(usAll.concat(thai));
  const market = buildMarketSnapshotV748_({});
  const macro = buildMacroLensV770_(market);

  const semiNames = filterSymbolsByCategoryV770_(usAll, ['Semi', 'AI', 'Equipment']);
  const specNames = filterSymbolsByCategoryV770_(usAll, ['Spec', 'Space', 'Nuclear', 'Quantum']);
  const bigNames = filterSymbolsByCategoryV770_(usAll, ['Big Tech', 'Software', 'EV']);
  const coreNames = filterSymbolsByCategoryV770_(usAll, ['Core ETF', 'ETF']);

  const snapshot = 'The visible portfolio is a two-sleeve structure: DIME holds ' + dime.length + ' US positions anchored by VOO/QQQM with meaningful AI-semiconductor exposure, while Streaming/BLS holds ' + thai.length + ' Thai domestic names across telecom, healthcare, retail, infrastructure, and banks. The monitored US watchlist adds ' + watch.length + ' names, increasing the effective opportunity set toward growth, semiconductors, software, and speculative innovation. Actual position weights are not in the database, so I would treat this as a theme/concentration review rather than a capital-weighted statement. The headline tilt is clear: US growth/AI remains the engine; Thai equities provide local-currency diversification but not a full hedge against a US-tech drawdown.';

  const heatWord = market.heat >= 70 ? 'hot' : market.heat >= 50 ? 'balanced but warming' : 'constructive';
  const working = [
    { title: 'Core ETF anchor', text: 'VOO and QQQM give the US sleeve a cleaner base than owning only single-name growth; that matters while index leadership remains concentrated.' },
    { title: 'AI/semi exposure', text: 'NVDA, AMD, MU, AVGO/ARM/TSM-style watchlist exposure keeps the portfolio aligned with the dominant earnings and capex theme.' },
    { title: 'Thai sleeve', text: 'ADVANC, BDMS, CPALL, GULF, KBANK, and SCB add domestic demand and THB exposure, which reduces pure USD/Nasdaq dependency.' }
  ];
  const concerns = [
    { title: 'Crowded growth risk', text: 'The US sleeve and watchlist lean heavily toward the same AI, semi, and long-duration growth trade; that can work, but correlations rise quickly when rates or positioning turn.' },
    { title: 'Speculative beta', text: (specNames.slice(0,5).join(', ') || 'Speculative names') + ' should be treated as satellite exposure, not core capital, especially when Market Heat is ' + market.heat + '/100.' },
    { title: 'Weight visibility', text: 'Because the bot sees symbols but not live account weights, it cannot yet flag whether a single name is above 10% or a sector above 30% in actual capital terms.' }
  ];
  const discussion = [
    'Decide a target split between Core ETF, quality growth, speculative satellite, Thai equities, and cash before adding more watchlist names.',
    'Consider capping AI/Semiconductor exposure at a defined portfolio limit so new buys do not accidentally double the same macro bet.',
    'Use the Buy Checklist for execution, but use this RM review weekly to decide whether the overall risk budget still makes sense.',
    'If actual position sizes are available, add Quantity/Market Value columns to the Sheet so the next version can review real concentration rather than symbol count.'
  ];

  return {
    snapshot: snapshot,
    tableRows: [
      { label: 'DIME US holdings', value: String(dime.length) },
      { label: 'Streaming Thai holdings', value: String(thai.length) },
      { label: 'US watchlist', value: String(watch.length) },
      { label: 'Top theme', value: sector[0] ? sector[0].label : 'Growth/AI' }
    ],
    macro: macro,
    working: working,
    concerns: concerns,
    discussion: discussion
  };
}

function buildMacroLensV770_(market) {
  const heat = market && isFinite(market.heat) ? market.heat : 45;
  const spy = market && isFinite(market.spyMa200Pct) ? market.spyMa200Pct : 0;
  const vix = market && isFinite(market.vix) ? market.vix : 18;
  const fx = market && isFinite(market.usdthb) ? market.usdthb : 32.7;
  const regime = market && market.regime ? market.regime : (spy >= 0 ? 'Bull / Uptrend' : 'Risk-off');

  const equityRead = spy >= 8 ? 'US equities remain in an uptrend but are no longer cheap; additions should favor staged entries over chasing.' : spy >= 0 ? 'US equities are above trend support; risk appetite is constructive but still sensitive to rates.' : 'SPY is below its long-term trend; preservation and smaller entry sizes take priority.';
  const vixRead = vix >= 25 ? 'VIX is elevated, so position sizing should be smaller and staged.' : vix >= 18 ? 'VIX is mid-range; volatility is tradable but not benign.' : 'VIX is contained, supporting risk assets but also encouraging crowded positioning.';
  const fxRead = 'USD/THB near ' + fmtNumV748_(fx, 2) + ' means DIME purchases still carry FX timing risk for THB-based capital.';

  return [
    { theme: 'Market regime', text: regime + '; SPY vs MA200 is ' + fmtPctV748_(spy) + ', with Market Heat at ' + heat + '/100.' },
    { theme: 'Equity leadership', text: equityRead },
    { theme: 'Volatility', text: vixRead + ' Current VIX proxy: ' + fmtNumV748_(vix, 2) + '.' },
    { theme: 'FX', text: fxRead },
    { theme: 'Policy/geopolitics', text: 'The bot flags this as a data-scope limitation: it uses fast market/news feeds, so major Fed, tariff, conflict, or energy shocks should be checked before acting.' }
  ];
}

function summarizeCategoriesV770_(items) {
  const m = {};
  (items || []).forEach(function(x) {
    const c = x.cat || x.category || 'Other';
    m[c] = (m[c] || 0) + 1;
  });
  return Object.keys(m).map(function(k){ return { label: k, count: m[k] }; }).sort(function(a,b){ return b.count - a.count; });
}

function filterSymbolsByCategoryV770_(items, keywords) {
  const out = [];
  (items || []).forEach(function(x) {
    const c = String(x.cat || x.category || '').toLowerCase();
    for (let i = 0; i < keywords.length; i++) {
      if (c.indexOf(String(keywords[i]).toLowerCase()) >= 0) {
        out.push(x.symbol);
        return;
      }
    }
  });
  return out;
}

function uniqueBySymbolV770_(items) {
  const seen = {};
  const out = [];
  (items || []).forEach(function(x) {
    if (!x || !x.symbol || seen[x.symbol]) return;
    seen[x.symbol] = true;
    out.push(x);
  });
  return out;
}

function escapeHtmlV770_(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}


function buildVisualSymbolPackageV830_(symbol) {
  const requestedSymbol = String(symbol || '').trim().toUpperCase().replace(/[^A-Z0-9.\-]/g, '');
  const cfg = getSymbolConfigV748_(requestedSymbol);
  const d = fetchTechnicalDataV748_(cfg);
  const market = buildMarketSnapshotV748_({});
  const decision = buildSymbolDecisionV748_(cfg, d, market, false);
  if (!d || !d.ok) {
    return { imageUrl: null, text: '❌ ดึงข้อมูล ' + cfg.symbol + ' ไม่สำเร็จ: ' + (d && d.error ? d.error : 'unknown') };
  }
  if (cfg.currency !== 'THB') {
    const oneNews = fetchNewsForSymbolsV748_([cfg]);
    decision.news = oneNews[cfg.symbol] || emptyNewsV748_();
  } else {
    decision.news = emptyNewsV748_('Thai news gate optional');
    decision.news.status = 'OPTIONAL';
    decision.news.gatePass = true;
  }
  applyBuyTierLogicV753_(decision, d, market);
  const sr = buildSingleSupportResistanceV774_(d);
  const text = buildProVisualSummaryTextV830_(cfg, d, decision, sr);
  return {
    imageUrl: null,
    text: text,
    chartCard: null
  };
}

function lineSepV884_() {
  // Wider separator for LINE text bubbles. Kept short enough to avoid wrapping.
  return '━━━━━━━━━━━━━━━━━━';
}

function buildProVisualSummaryTextV830_(cfg, d, decision, sr) {
  const now = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm');
  const action = decision.buyTier === 'FULL_BUY' ? 'BUY' : (decision.buyTier === 'TECH_BUY' ? 'TECH BUY' : 'WAIT');
  const conviction = Math.max(20, Math.min(99, Math.round(decision.confidence || 50)));
  const plan = decision.plan || null;
  const hasPlan = !!(plan && plan.total > 0 && plan.legs && plan.legs.length);
  const entry1 = hasPlan && plan.legs[0] ? plan.legs[0].price : sr.support;
  const entry2 = hasPlan && plan.legs[1] ? plan.legs[1].price : Math.min(sr.support * 0.98, d.ema20 || sr.support);
  const tp = sr.resistance;
  const sl = Math.min(entry2 || sr.support, sr.support * 0.98);
  const currency = cfg.currency || 'USD';

  const smaStatus = d.last >= d.sma20 ? '🟢 ขาขึ้น' : '🔴 ต่ำกว่า SMA20';
  const emaStatus = d.ema20 >= d.ema50 ? '🟢 กลาง-ยาวยังดี' : '🔴 ยังไม่ยืนยัน';
  const rsiStatus = terminalRsiStatusV890_(d.rsi);
  const macdStatus = d.macdHist >= 0 ? '🟢 สัญญาณบวก' : '🔴 เริ่มอ่อนแรง';
  const volStatus = terminalVolStatusV890_(d.volatility);
  const momentumStatus = d.last >= d.sma5 ? '🟢 ระยะสั้นเป็นบวก' : '🔴 ระยะสั้นอ่อนตัว';
  const newsStatus = decision.news && decision.news.gatePass ? '🟢 ผ่าน' : '🔴 ไม่ผ่าน';
  const trendLine = terminalTrendLineV890_(d);
  const reasons = buildTerminalBottomLineV890_(cfg, d, decision, hasPlan);

  const lines = [];
  lines.push('🖥️ AINVESTOR TERMINAL PREMIUM');
  lines.push('━━━━━━━━━━━━━━━━━━');
  lines.push('📊 ' + cfg.symbol);
  if (cfg.name) lines.push(cfg.name);
  lines.push('');
  lines.push('ราคาปิด: ' + moneyV748_(d.last, currency));
  lines.push('สถานะ: ' + action + ' | Conviction ' + conviction + '/100');
  lines.push('Data: ' + (d.provider || 'Yahoo') + ' | เวลา: ' + now);
  lines.push('');
  lines.push('แนวรับ: ' + moneyV748_(sr.support, currency));
  lines.push('แนวต้าน: ' + moneyV748_(sr.resistance, currency));
  lines.push((action === 'WAIT' ? 'จุดรอเข้า: ' : 'จุดเข้าซื้อ: ') + moneyV748_(entry1, currency));
  lines.push('TP: ' + moneyV748_(tp, currency) + ' | SL: ' + moneyV748_(sl, currency));
  lines.push('');
  lines.push('━━━━━━━━━━━━━━━━━━');
  lines.push('📉 MINI TREND SNAPSHOT');
  lines.push(terminalMiniTrendV890_(d.close || []));
  lines.push(trendLine);
  lines.push('');
  lines.push('━━━━━━━━━━━━━━━━━━');
  lines.push('🧩 TECHNICAL STATUS CODES');
  lines.push('SMA        ' + smaStatus);
  lines.push('EMA        ' + emaStatus);
  lines.push('RSI        ' + rsiStatus + ' (' + fmtNumV748_(d.rsi, 1) + ')');
  lines.push('MACD       ' + macdStatus);
  lines.push('Volatility ' + volStatus);
  lines.push('Momentum   ' + momentumStatus);
  lines.push('News Gate  ' + newsStatus);
  lines.push('');
  lines.push('━━━━━━━━━━━━━━━━━━');
  lines.push('🎯 แผน 3 ไม้');
  if (hasPlan) {
    lines.push('รวม: ' + moneyV748_(plan.total, currency) + ' | ' + plan.ratio.join(':'));
    plan.legs.forEach(function(leg, i) {
      lines.push((i + 1) + ') ' + moneyV748_(leg.amount, currency) + ' @≤' + moneyV748_(leg.price, currency));
    });
  } else {
    lines.push('สถานะ: ยังไม่เปิดซื้อใหม่');
  }
  lines.push('');
  lines.push('━━━━━━━━━━━━━━━━━━');
  lines.push('🧠 BOTTOM LINE ANALYSIS');
  reasons.forEach(function(reason) {
    lines.push(reason);
  });
  lines.push('');
  lines.push('Disclaimer: ไม่ใช่คำแนะนำการลงทุน');
  return lines.join('\n');
}

function terminalRsiStatusV890_(r) {
  if (r == null || !isFinite(r)) return '⚪ ข้อมูลไม่พอ';
  if (r < 30) return '🟡 Oversold';
  if (r >= 75) return '🔴 ร้อนมาก';
  if (r >= 70) return '🟡 ค่อนข้างร้อน';
  if (r >= 50) return '🟢 Momentum บวก';
  return '🟡 ยังไม่แรง';
}

function terminalVolStatusV890_(v) {
  if (v > 0.055) return '🔴 สูง';
  if (v > 0.035) return '🟡 กลาง';
  return '🟢 ต่ำ';
}

function terminalTrendLineV890_(d) {
  const day = d.last >= d.sma5 ? 'Day 🟢' : 'Day 🔴';
  const week = d.last >= d.sma20 ? 'Week 🟢' : 'Week 🔴';
  const month = d.last >= d.sma50 ? 'Month 🟢' : 'Month 🔴';
  return 'Trend: ' + day + ' • ' + week + ' • ' + month;
}

function terminalMiniTrendV890_(close) {
  if (!close || close.length < 8) return '▁▁▁▁▁▁▁▁';
  const arr = close.slice(-15);
  const min = Math.min.apply(null, arr);
  const max = Math.max.apply(null, arr);
  const bars = ['▁','▂','▃','▄','▅','▆','▇','█'];
  if (max === min) return arr.map(function(){ return '▄'; }).join('');
  return arr.map(function(v) {
    const idx = Math.max(0, Math.min(7, Math.round((v - min) / (max - min) * 7)));
    return bars[idx];
  }).join('');
}

function buildTerminalBottomLineV890_(cfg, d, decision, hasPlan) {
  const out = [];

  if (d.last >= d.ema20) out.push('📊 ราคาอยู่เหนือ EMA20 ระยะสั้นยังพอแข็งแรง');
  else out.push('📊 ราคาอยู่ต่ำกว่า EMA20 ระยะสั้นยังไม่ยืนยัน');

  if (d.macdHist >= 0) out.push('⚡ MACD เป็นบวก มีโมเมนตัมสนับสนุน');
  else out.push('⚡ MACD ยังอ่อนแรง ยังไม่ควรไล่ราคา');

  if (d.obvSlope >= 0) out.push('💧 OBV/Volume มีแรงสะสมสนับสนุน');
  else out.push('💧 OBV/Volume แรงสะสมลดลง ต้องระวัง');

  if (decision.news && decision.news.gatePass) out.push('📰 News Gate ผ่าน ใช้ประกอบการตัดสินใจได้');
  else out.push('📰 News Gate ยังไม่ผ่าน จึงลดความมั่นใจของสัญญาณ');

  if (hasPlan) out.push('🎯 สรุป: เปิดแผนทยอยซื้อได้ตามไม้ที่ระบบกำหนด ไม่ไล่ราคา');
  else out.push('🎯 สรุป: ยังไม่เปิดซื้อใหม่ รอราคาเข้าโซนและสัญญาณยืนยัน');

  return out.slice(0, 5);
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

