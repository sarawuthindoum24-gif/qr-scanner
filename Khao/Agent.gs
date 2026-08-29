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


function fixCommonTickerTypoAgentV960_(s) {
  s = String(s || '').toUpperCase().trim();
  const map = {
    'AZMN': 'AMZN',
    'AMZ': 'AMZN',
    'NVDAA': 'NVDA',
    'NVDIA': 'NVDA',
    'GOOGLE': 'GOOGL',
    'GOOG': 'GOOGL',
    'TESLA': 'TSLA',
    'META.': 'META'
  };
  return map[s] || s;
}

function getSymbolConfigV748_(symbol) {
  symbol = fixCommonTickerTypoAgentV960_(String(symbol || '').toUpperCase().replace('.BK', ''));
  const all = getAllTrackedSymbolsV748_();
  for (let i = 0; i < all.length; i++) if (all[i].symbol === symbol) return all[i];
  return { symbol: symbol, cat: 'Custom', portfolio: 'CUSTOM', currency: 'USD' };
}

function yahooSymbolV748_(cfg) {
  if (cfg.yahoo) return cfg.yahoo;
  if (cfg.symbol && cfg.symbol.indexOf('^') >= 0) return cfg.symbol;
  if (cfg.symbol && cfg.symbol.indexOf('=X') >= 0) return cfg.symbol;
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
  const cfg = decision.cfg;
  const m = market || { ok: false, buyBlocked: true, heat: 45 };

  items.push({ name: 'Price OK', pass: !!(d && d.ok) });
  items.push({ name: 'ข้อมูล ≥ 200 วัน', pass: !!(d && d.ok && d.longTrendValid) });
  items.push({ name: 'ราคา > EMA20', pass: !!(d && d.ok && d.last > d.ema20) });
  items.push({ name: 'EMA20 > EMA50', pass: !!(d && d.ok && d.ema20 > d.ema50) });
  items.push({ name: 'EMA50 > EMA200', pass: !!(d && d.ok && d.ema50 > d.ema200) });
  items.push({ name: 'MACD Histogram >= 0', pass: !!(d && d.ok && d.macdHist >= 0) });
  items.push({ name: 'RSI Allowed', pass: !!(d && d.ok && isRsiTechnicalAllowedV820_(cfg, d.rsi)) });
  items.push({ name: 'Volatility OK', pass: !!(d && d.ok && d.volatility <= VOL_HIGH_V800) });
  items.push({ name: 'Market Snapshot OK', pass: !!m.ok });
  items.push({ name: 'Market ไม่ Block BUY', pass: !m.buyBlocked });
  
  if (cfg.cat !== 'Core ETF' && cfg.currency !== 'THB') {
    items.push({ name: 'News Gate Pass', pass: !!(decision.news && decision.news.gatePass) });
  } else {
    items.push({ name: 'News Gate Pass', pass: true });
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
    : ('Yahoo: ' + (x.news && x.news.yahoo ? 'yes' : 'no') + ' / Finnhub: ' + (x.news && x.news.finnhub ? 'yes' : 'no'));
  
  const scoreLabel = 'Signal Score ' + Math.round(x.signalScore || x.confidence || 0) + ' | Score ' + x.score;
  lines.push(idx + '. ' + x.symbol + ' ' + label + ' | ' + scoreLabel + ' | ' + newsTxt);
  lines.push('   เช็คลิสต์: ' + checklistCompactV752_(x.checklist));
  
  const budgetType = x.plan && x.plan.isDefaultBudget ? ' (Default Budget)' : ' (Configured Budget)';
  lines.push('   ซื้อรวม: ' + moneyV748_(x.plan.total, x.cfg.currency) + ' | 3 ไม้ ' + x.plan.ratio.join(':') + budgetType);
  
  if (x.plan) {
    x.plan.legs.forEach(function(leg, i) {
      lines.push('   ไม้ ' + (i + 1) + ': ' + moneyV748_(leg.amount, x.cfg.currency) + ' @≤' + moneyV748_(leg.price, x.cfg.currency));
    });
    lines.push('   เป้าหมาย (Target): ' + moneyV748_(x.plan.targetLevel, x.cfg.currency) + ' | จุดตัดขาดทุน (Stop Loss): ' + moneyV748_(x.plan.stopLevel, x.cfg.currency));
    lines.push('   Reward-to-Risk Ratio: ' + fmtNumV748_(x.plan.rewardRiskRatio, 2));
  }
  
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
    return decision;
  });
  const movers = scored.slice().sort(function(a, b) { return Math.abs(b.changePct || 0) - Math.abs(a.changePct || 0); }).slice(0, 20);
  const newsLines = ['📰 Khao — สรุปข่าวหุ้นไทยและต่างประเทศ', 'เวลา: ' + now + ' น.', 'แหล่งหลัก: Investing Thailand + Yahoo Finance', ''];
  movers.forEach(function(x) {
    const icon = (x.changePct || 0) >= 0 ? '🟢' : '🔴';
    const n = x.news || emptyNewsV748_();
    const headlineItem = (n.topNegative && n.topNegative[0]) || (n.topPositive && n.topPositive[0]) || (n.items && n.items[0]);
    const headline = headlineItem && headlineItem.title ? headlineItem.title : 'ไม่มีข่าวตรง symbol ในรอบ 72 ชั่วโมง';
    const sourceText = n.sources && n.sources.length ? n.sources.join(', ') : (n.sourceStatus || 'ไม่พบแหล่งข่าว');
    newsLines.push(icon + ' ' + x.symbol + ' ' + fmtPctV748_(x.changePct));
    newsLines.push('• ' + shortReasonFromHeadlineV748_(headline));
    newsLines.push('  แหล่ง: ' + sourceText);
  });
  newsLines.push('', 'ข้อมูลข่าวประกอบการตัดสินใจ ไม่ใช่คำแนะนำการลงทุน');
  return [newsLines.join('\n')];
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
  configs = configs || [];
  const out = {};
  if (!configs.length) return out;

  // Yahoo is the primary provider. Fetch the whole watchlist in parallel so the
  // twice-daily Khao report does not spend several minutes waiting symbol by symbol.
  const requests = configs.map(function(cfg) {
    const y = encodeURIComponent(yahooSymbolV748_(cfg));
    return {
      url: 'https://query1.finance.yahoo.com/v8/finance/chart/' + y + '?range=1y&interval=1d&includePrePost=false',
      muteHttpExceptions: true,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    };
  });

  try {
    const responses = UrlFetchApp.fetchAll(requests);
    responses.forEach(function(res, idx) {
      const cfg = configs[idx];
      const yahooRes = parseYahooChartResponseV748_(cfg, res.getResponseCode(), res.getContentText());
      if (yahooRes && yahooRes.ok) {
        out[cfg.symbol] = buildTechnicalObjectV870_(cfg, yahooRes, 20, 'Yahoo', yahooRes.dataQuality || 'good');
      } else {
        out[cfg.symbol] = yahooRes || { ok: false, cfg: cfg, provider: 'Yahoo', error: 'Empty response' };
      }
    });
  } catch (err) {
    configs.forEach(function(cfg) {
      out[cfg.symbol] = { ok: false, cfg: cfg, provider: 'Yahoo', error: err.message };
    });
  }

  // Use Twelve Data only for symbols that Yahoo could not supply. Keeping the
  // fallback narrow reduces API quota usage and avoids unnecessary serial calls.
  configs.forEach(function(cfg) {
    const yahooRes = out[cfg.symbol];
    if (yahooRes && yahooRes.ok) return;
    let twelveRes = null;
    try {
      twelveRes = fetchTwelveDataTechnicalDataV870_(cfg);
      if (twelveRes && twelveRes.ok) {
        out[cfg.symbol] = buildTechnicalObjectV870_(cfg, twelveRes, 20, 'TwelveData', twelveRes.dataQuality || 'good');
        out[cfg.symbol].fallbackFrom = yahooRes && yahooRes.error ? yahooRes.error : 'Yahoo unavailable';
        return;
      }
    } catch (err2) {
      Logger.log('TwelveData fallback failed for ' + cfg.symbol + ': ' + err2.message);
      twelveRes = { ok: false, error: err2.message };
    }

    out[cfg.symbol] = {
      ok: false,
      cfg: cfg,
      provider: 'none',
      error: 'All providers failed | Yahoo: ' + (yahooRes && yahooRes.error ? yahooRes.error : 'unknown') +
        ' | TwelveData: ' + (twelveRes && twelveRes.error ? twelveRes.error : 'not configured')
    };
  });
  return out;
}

function fetchTechnicalDataV748_(cfg) {
  const yahoo = fetchYahooTechnicalDataV870_(cfg);
  if (yahoo && yahoo.ok) {
    const d = buildTechnicalObjectV870_(cfg, yahoo, 20, 'Yahoo', yahoo.dataQuality || 'good');
    if (d.ok) {
      d.close = yahoo.close;
      d.volume = yahoo.volume;
    }
    return d;
  }

  const twelve = fetchTwelveDataTechnicalDataV870_(cfg);
  if (twelve && twelve.ok) {
    const d = buildTechnicalObjectV870_(cfg, twelve, 20, 'TwelveData', twelve.dataQuality || 'good');
    if (d.ok) {
      d.close = twelve.close;
      d.volume = twelve.volume;
      d.fallbackFrom = yahoo && yahoo.error ? yahoo.error : 'Yahoo unavailable';
    }
    return d;
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
    const res = UrlFetchApp.fetch('https://query1.finance.yahoo.com/v8/finance/chart/' + y + '?range=1y&interval=1d&includePrePost=false', {
      muteHttpExceptions: true,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    return parseYahooChartResponseV748_(cfg, res.getResponseCode(), res.getContentText());
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
    const quote = result.indicators && result.indicators.quote && result.indicators.quote[0];
    if (!quote) return { ok: false, cfg: cfg, http: code, error: 'No quote data' };

    const adj = result.indicators.adjclose && result.indicators.adjclose[0] && result.indicators.adjclose[0].adjclose;
    const closeRaw = adj || quote.close || [];
    const volumeRaw = quote.volume || [];
    const timestamps = result.timestamp || [];

    if (!Array.isArray(closeRaw) || !closeRaw.length) {
      return { ok: false, cfg: cfg, http: code, error: 'No close price array' };
    }

    // Pair close & volume chronologically using Yahoo timestamps
    const combined = [];
    for (let i = 0; i < closeRaw.length; i++) {
      const ts = timestamps[i] || 0;
      const c = closeRaw[i];
      const v = volumeRaw[i];
      
      // Filter out null closes to maintain data integrity
      if (c === null || typeof c === 'undefined' || isNaN(c)) {
        continue;
      }
      
      combined.push({
        timestamp: ts,
        close: c,
        volume: v
      });
    }

    // Sort chronologically (oldest to newest)
    combined.sort(function(a, b) { return a.timestamp - b.timestamp; });

    const close = [];
    const volume = [];
    let warning = false;

    combined.forEach(function(item) {
      close.push(item.close);
      if (item.volume === null || typeof item.volume === 'undefined' || isNaN(item.volume)) {
        volume.push(0);
        warning = true;
      } else {
        volume.push(item.volume);
      }
    });

    if (close.length < 60) return { ok: false, cfg: cfg, http: code, error: 'Not enough price history' };

    return {
      ok: true,
      close: close,
      volume: volume,
      provider: 'Yahoo',
      dataQuality: warning ? 'warning' : 'good'
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
  if (code !== 200) return { ok: false, error: 'HTTP ' + code, items: [] };
  try {
    const json = JSON.parse(body || '{}');
    if (json.status === 'error' || json.code || json.message === 'Invalid API call') {
      return { ok: false, error: json.message || ('API error ' + json.code) };
    }

    const values = json.values || [];
    if (!values.length) return { ok: false, error: 'No values' };

    // Sort chronologically (oldest to newest)
    const sorted = values.map(function(item) {
      return {
        timestamp: new Date(item.datetime).getTime(),
        close: parseFloat(item.close),
        volume: parseInt(item.volume || 0, 10)
      };
    }).sort(function(a, b) {
      return a.timestamp - b.timestamp;
    });

    const close = [];
    const volume = [];
    let warning = false;

    sorted.forEach(function(item) {
      if (isNaN(item.close) || item.close <= 0) return;
      close.push(item.close);
      if (isNaN(item.volume) || item.volume < 0) {
        volume.push(0);
        warning = true;
      } else {
        volume.push(item.volume);
      }
    });

    if (!close.length) return { ok: false, error: 'No valid close values' };

    return {
      ok: true,
      close: close,
      volume: volume,
      provider: 'TwelveData',
      dataQuality: warning ? 'warning' : 'good'
    };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

function buildTechnicalObjectV870_(cfg, rawData, minLengthRequired, providerName, dataQuality) {
  let close = [];
  let volume = [];
  if (rawData) {
    if (Array.isArray(rawData)) {
      close = rawData.map(function(item) { return item.close; });
      volume = rawData.map(function(item) { return item.volume; });
    } else {
      close = rawData.close || [];
      volume = rawData.volume || [];
    }
  }
  const len = close.length;

  if (len < 20) {
    return {
      ok: false,
      error: 'Insufficient data points: ' + len + ' (required 20)',
      symbol: cfg.symbol
    };
  }

  const last = close[len - 1];
  const prev = len > 1 ? close[len - 2] : last;
  const changePct = prev > 0 ? ((last - prev) / prev) * 100 : 0;

  // Technical averages
  const ema20 = emaSeriesV748_(close, 20).pop();
  const ema50 = emaSeriesV748_(close, 50).pop();

  // EMA200 / SMA200 safety rule:
  // ONLY calculate if we have 200 or more data points
  let ema200 = null;
  let sma200 = null;
  let longTrendValid = false;

  if (len >= 200) {
    ema200 = emaSeriesV748_(close, 200).pop();
    const sum200 = close.slice(-200).reduce(function(a, b) { return a + b; }, 0);
    sma200 = sum200 / 200;
    if (ema200 !== null && !isNaN(ema200) && sma200 !== null && !isNaN(sma200)) {
      longTrendValid = true;
    }
  }

  const sma5 = len >= 5 ? (close.slice(-5).reduce(function(a, b) { return a + b; }, 0) / 5) : last;

  // MACD (12, 26, 9)
  const macdVal = macdV748_(close).hist;
  // RSI (14)
  const rsiObj = rsiV748_(close, 14);
  const rsiVal = rsiObj.value;
  const rsiStatus = rsiObj.status;
  // Volatility (30 day returns std dev)
  const returns = [];
  for (let i = Math.max(1, close.length - 30); i < close.length; i++) {
    returns.push((close[i] - close[i - 1]) / close[i - 1]);
  }
  const volatility = stdV748_(returns);
  // OBV Slope (20-period OBV trend)
  const obv = obvSeriesV748_(close, volume);
  const obvSlope = obv.length >= 5 ? obv[obv.length - 1] - obv[obv.length - 5] : 0;

  // Find support/resistance (local minima/maxima over past 60 days)
  const slice60 = close.slice(-60);
  let support = slice60.length ? Math.min.apply(null, slice60) : last;
  let resistance = slice60.length ? Math.max.apply(null, slice60) : last;

  return {
    ok: true,
    symbol: cfg.symbol,
    last: last,
    prev: prev,
    changePct: changePct,
    ema20: ema20,
    ema50: ema50,
    ema200: ema200,
    sma200: sma200,
    sma5: sma5,
    macdHist: macdVal,
    rsi: rsiVal,
    rsiStatus: rsiStatus,
    volatility: volatility,
    obvSlope: obvSlope,
    support: support,
    resistance: resistance,
    longTrendValid: longTrendValid,
    provider: providerName || 'Unknown',
    dataQuality: dataQuality || 'good'
  };
}

function buildTechnicalObjectFromCloseVolumeV870_(cfg, close, volume, http, provider) {
  const rawData = { close: close, volume: volume };
  const d = buildTechnicalObjectV870_(cfg, rawData, 20, provider || 'Yahoo', 'good');
  if (d.ok) {
    d.close = close;
    d.volume = volume;
    d.http = http || 200;
  }
  return d;
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

function getCachedMarketSnapshotV748_() {
  try {
    const cache = CacheService.getScriptCache();
    const cached = cache.get('V748_MARKET_SNAPSHOT');
    if (cached) {
      const parsed = JSON.parse(cached);
      const now = new Date().getTime();
      const created = new Date(parsed.cacheCreatedAt || parsed.fetchedAt || now).getTime();
      const ageMinutes = (now - created) / (60 * 1000);
      parsed.cacheAgeMinutes = ageMinutes;
      if (ageMinutes > 30) {
        parsed.stale = true;
        parsed.buyBlocked = true;
      } else {
        parsed.stale = false;
      }
      return parsed;
    }
  } catch (e) {
    Logger.log('Cache read error: ' + e.message);
  }
  return null;
}

function buildMarketSnapshotV748_(data) {
  const cached = getCachedMarketSnapshotV748_();
  if (cached && !cached.stale) {
    return cached;
  }

  const result = {
    ok: false,
    spyMa200Pct: null,
    vix: 18,
    vixIsFallback: false,
    vixProvider: 'Yahoo',
    usdthb: 32.7,
    usdthbIsFallback: false,
    usdthbProvider: 'Yahoo',
    spyProvider: 'Yahoo',
    thaiMarketStatus: 'DATA_UNAVAILABLE',
    thaiMarketProvider: 'None',
    thaiMarketBuyBlocked: true,
    heat: 45,
    regime: 'DATA_UNAVAILABLE',
    buyBlocked: true,
    fetchedAt: new Date().toISOString(),
    asOf: new Date().toISOString(),
    cacheCreatedAt: new Date().toISOString(),
    cacheAgeMinutes: 0,
    stale: false
  };

  // Fetch SPY history to check trend
  let spyHistory = null;
  try {
    spyHistory = fetchTechnicalDataV748_({ symbol: 'SPY', currency: 'USD' });
  } catch (e) {
    Logger.log('Error fetching SPY: ' + e.message);
  }

  if (!spyHistory || !spyHistory.ok || !spyHistory.close || spyHistory.close.length < 200) {
    Logger.log('Market Snapshot Fail-closed: SPY history not available or insufficient data.');
    result.regime = 'DATA_UNAVAILABLE';
    result.buyBlocked = true;
    try {
      CacheService.getScriptCache().put('V748_MARKET_SNAPSHOT', JSON.stringify(result), 1800);
    } catch (e) {}
    return result;
  }

  result.ok = true;
  result.spyProvider = spyHistory.provider || 'Yahoo';
  const spyTrend = buildTechnicalObjectFromCloseVolumeV870_({ symbol: 'SPY' }, spyHistory.close, spyHistory.volume);
  
  if (spyTrend && spyTrend.ok && spyTrend.sma200) {
    result.spyMa200Pct = ((spyTrend.last - spyTrend.sma200) / spyTrend.sma200) * 100;
  } else {
    result.ok = false;
    result.regime = 'DATA_UNAVAILABLE';
    result.buyBlocked = true;
    try {
      CacheService.getScriptCache().put('V748_MARKET_SNAPSHOT', JSON.stringify(result), 1800);
    } catch (e) {}
    return result;
  }

  // Fetch VIX with fallback
  let vixHistory = null;
  try {
    vixHistory = fetchTechnicalDataV748_({ symbol: '^VIX', currency: 'USD' });
  } catch (e) {
    Logger.log('VIX fetch error: ' + e.message);
  }

  if (vixHistory && vixHistory.ok && vixHistory.close && vixHistory.close.length > 0) {
    result.vix = vixHistory.close[vixHistory.close.length - 1];
    result.vixProvider = vixHistory.provider || 'Yahoo';
  } else {
    result.vix = 18; // historical median
    result.vixIsFallback = true;
    result.vixProvider = 'Fallback';
  }

  // Fetch USD/THB with fallback
  let fxHistory = null;
  try {
    fxHistory = fetchTechnicalDataV748_({ symbol: 'USDTHB=X', currency: 'THB' });
  } catch (e) {
    Logger.log('USDTHB fetch error: ' + e.message);
  }

  if (fxHistory && fxHistory.ok && fxHistory.close && fxHistory.close.length > 0) {
    result.usdthb = fxHistory.close[fxHistory.close.length - 1];
    result.usdthbProvider = fxHistory.provider || 'Yahoo';
  } else {
    result.usdthb = 32.7; // default fallback
    result.usdthbIsFallback = true;
    result.usdthbProvider = 'Fallback';
  }

  // Fetch SET index history (Thai market check)
  let setHistory = null;
  try {
    setHistory = fetchTechnicalDataV748_({ symbol: '^SET', currency: 'THB' });
  } catch (e) {
    Logger.log('Error fetching SET index: ' + e.message);
  }

  if (setHistory && setHistory.ok && setHistory.close && setHistory.close.length > 0) {
    result.thaiMarketStatus = 'OK';
    result.thaiMarketProvider = setHistory.provider || 'Yahoo';
    const setTrend = buildTechnicalObjectFromCloseVolumeV870_({ symbol: '^SET' }, setHistory.close, setHistory.volume);
    if (setTrend && setTrend.ok && setTrend.sma200) {
      result.thaiMarketBuyBlocked = (setTrend.last < setTrend.sma200);
    } else {
      result.thaiMarketBuyBlocked = false;
    }
  } else {
    result.thaiMarketStatus = 'DATA_UNAVAILABLE';
    result.thaiMarketProvider = 'None';
    result.thaiMarketBuyBlocked = true;
  }

  // Calculate Heat
  let heat = 45;
  if (result.spyMa200Pct > 5) heat += 10;
  if (result.spyMa200Pct < -5) heat -= 15;
  if (result.vix > 28) heat -= 25;
  else if (result.vix < 14) heat += 10;
  result.heat = Math.max(10, Math.min(90, heat));

  // Determine Regime & Buy Blocked
  if (result.spyMa200Pct < -3.0 && result.vix > 25.0) {
    result.regime = 'RISK_OFF';
    result.buyBlocked = true;
  } else if (result.vix > 35.0) {
    result.regime = 'PANIC';
    result.buyBlocked = true;
  } else {
    result.regime = 'NORMAL';
    result.buyBlocked = false;
  }

  try {
    CacheService.getScriptCache().put('V748_MARKET_SNAPSHOT', JSON.stringify(result), 1800);
  } catch (e) {}

  return result;
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
    return { 
      symbol: cfg.symbol, 
      cfg: cfg, 
      ok: false, 
      openBuy: false, 
      score: -99, 
      reasons: ['ดึงข้อมูลราคาไม่ได้'], 
      plan: null,
      passedRules: [],
      failedRules: ['ดึงข้อมูลราคาได้']
    };
  }

  const passedRules = [];
  const failedRules = [];

  if (d.last > d.ema20) {
    score += 1;
    reasons.push('ราคาเหนือ EMA20 ระยะสั้นเป็นบวก');
    passedRules.push('Price > EMA20');
  } else {
    score -= 1;
    reasons.push('ราคาต่ำกว่า EMA20 ระยะสั้นยังอ่อน');
    failedRules.push('Price > EMA20');
  }

  if (d.ema20 > d.ema50) {
    score += 1;
    reasons.push('EMA20/50 เป็นขาขึ้น');
    passedRules.push('EMA20 > EMA50');
  } else {
    score -= 1;
    reasons.push('EMA20/50 ยังไม่ยืนยัน');
    failedRules.push('EMA20 > EMA50');
  }

  if (d.ema50 > d.ema200) {
    score += 1;
    reasons.push('EMA50/200 เป็นขาขึ้นระยะยาว');
    passedRules.push('EMA50 > EMA200');
  } else {
    score -= 2;
    reasons.push('แนวโน้มยาวยังไม่แข็งแรง');
    failedRules.push('EMA50 > EMA200');
  }

  if (d.macdHist >= 0) {
    score += 1;
    reasons.push('MACD เป็นสัญญาณบวก');
    passedRules.push('MACD Histogram >= 0');
  } else {
    score -= 1;
    reasons.push('MACD ยังอ่อน');
    failedRules.push('MACD Histogram >= 0');
  }

  if (d.obvSlope > 0) {
    score += 1;
    reasons.push('OBV เพิ่มขึ้น มีแรงสะสม');
    passedRules.push('OBV Slope > 0');
  } else {
    reasons.push('OBV ยังไม่สนับสนุนชัด');
    failedRules.push('OBV Slope > 0');
  }

  const rsiRegime = rsiRegimeV820_(cfg, d.rsi);
  score += rsiRegime.scoreAdj;
  if (rsiRegime.locked) locked = true;
  reasons.push(rsiRegime.label);

  if (rsiRegime.techAllowed) {
    passedRules.push('RSI Allowed');
  } else {
    failedRules.push('RSI Allowed');
  }

  if (d.volatility > VOL_HIGH_V800) {
    score -= 2;
    reasons.push('ความผันผวนสูงมาก ต้องใช้ไม้เล็ก');
    failedRules.push('Volatility OK');
  } else if (d.volatility > VOL_WARN_V800) {
    score -= 1;
    reasons.push('ความผันผวนสูง');
    passedRules.push('Volatility OK');
  } else {
    score += 1;
    passedRules.push('Volatility OK');
    reasons.push('ความผันผวนรับได้');
  }

  if (cfg.cat === 'Core ETF') {
    score += 2;
    reasons.push('Core ETF ใช้ DCA ได้ ไม่แดงง่ายจาก ATH');
  }
  if (cfg.cat === 'Speculative') {
    score -= 1;
    reasons.push('หุ้น Speculative จำกัดขนาดไม้');
  }

  if (market.heat >= MARKET_HEAT_HOT_V800 && cfg.cat === 'Speculative') {
    score -= 3;
    locked = true;
    reasons.push('Market Heat สูง ไม่เปิดไม้หุ้นเก็งกำไร');
    failedRules.push('Market Heat OK');
  } else if (market.heat >= MARKET_HEAT_HOT_V800) {
    score -= 1;
    reasons.push('ตลาดร้อน ลดขนาดไม้');
    passedRules.push('Market Heat OK');
  } else {
    passedRules.push('Market Heat OK');
  }

  openBuy = false;
  const signalScore = Math.max(20, Math.min(85, 45 + score * 5 - (d.volatility > 0.05 ? 8 : 0)));
  const plan = null;

  return {
    symbol: cfg.symbol,
    cfg: cfg,
    ok: true,
    last: d.last,
    changePct: d.changePct,
    score: score,
    signalScore: signalScore,
    confidence: signalScore,
    openBuy: openBuy,
    locked: locked,
    rsiRegime: rsiRegime,
    plan: plan,
    reasons: reasons,
    passedRules: passedRules,
    failedRules: failedRules,
    momentumScore: d.last >= d.sma5 ? 1 : -1,
    momentumText: d.last >= d.sma5 ? 'ระยะสั้นเป็นบวก' : 'ระยะสั้นอ่อนตัว'
  };
}

const SPECULATIVE_MODE = 'WATCH_ONLY';

function validateBuyPlanRRR_(decision) {
  if (!decision.plan) return;
  const plan = decision.plan;
  const minRR = Number(PropertiesService.getScriptProperties().getProperty('MIN_REWARD_RISK') || 2.0);

  if (plan.riskPerShare <= 0 || plan.rewardPerShare <= 0) {
    decision.reasons.unshift('Reward-to-Risk ratio ข้อมูลผิดพลาด (risk/reward ต้องเป็นบวก)');
    decision.buyTier = 'WAIT';
    decision.displayAction = 'WAIT';
    decision.openBuy = false;
    decision.plan = null;
    return;
  }

  if (plan.rewardRiskRatio < minRR) {
    decision.reasons.unshift('Reward-to-Risk ratio ต่ำกว่าเกณฑ์ขั้นต่ำ ' + minRR + ' (คำนวณได้: ' + fmtNumV748_(plan.rewardRiskRatio, 2) + ')');
    decision.buyTier = 'WAIT';
    decision.displayAction = 'WAIT';
    decision.openBuy = false;
    decision.plan = null;
  }
}

function applyBuyTierLogicV753_(decision, d, market) {
  if (!decision || !decision.ok || !d || !d.ok) return decision;

  const cfg = decision.cfg;
  const news = decision.news || emptyNewsV748_();
  const tech = technicalPassV753_(decision, d, market);
  const spec = isSpeculativeV753_(cfg);
  const oneDayMove = Math.abs(Number(d.changePct || 0));
  const newsPass = !!news.gatePass;
  const badNews = news.sentiment === 'BEARISH' || news.sentimentScore <= -2;
  const conflictingNews = news.sentiment === 'CONFLICTING';
  const isThai = (cfg.currency === 'THB');

  decision.buyTier = 'WAIT';
  decision.displayAction = 'WAIT';
  decision.openBuy = false;
  decision.plan = null;

  if (isThai) {
    if (market.thaiMarketStatus === 'OK') {
      decision.passedRules.push('Market Snapshot OK');
      if (!market.thaiMarketBuyBlocked) {
        decision.passedRules.push('Market ไม่ Block BUY');
      } else {
        decision.failedRules.push('Market ไม่ Block BUY');
      }
    } else {
      decision.failedRules.push('Market Snapshot OK');
      decision.failedRules.push('Market ไม่ Block BUY');
    }
  } else {
    if (market.ok) {
      decision.passedRules.push('Market Snapshot OK');
    } else {
      decision.failedRules.push('Market Snapshot OK');
    }
    if (!market.buyBlocked) {
      decision.passedRules.push('Market ไม่ Block BUY');
    } else {
      decision.failedRules.push('Market ไม่ Block BUY');
    }
  }

  if (!isThai) {
    if (!market.ok || market.buyBlocked) {
      decision.reasons.unshift('ข้อมูลตลาดไม่พร้อมหรืออยู่ภาวะ Block Buy');
      return decision;
    }
  } else {
    if (market.thaiMarketStatus === 'OK' && market.thaiMarketBuyBlocked) {
      decision.reasons.unshift('ตลาดหุ้นไทยอยู่ในแนวโน้มขาลง (SET < SMA200)');
      return decision;
    }
  }

  if (decision.locked) {
    decision.reasons.unshift(decision.rsiRegime ? decision.rsiRegime.label : 'Risk filter locked');
    return decision;
  }

  // Core ETF
  if (cfg.cat === 'Core ETF') {
    if (decision.score >= 4 && tech.strong) {
      decision.buyTier = 'FULL_BUY';
      decision.displayAction = 'BUY';
      decision.openBuy = true;
      decision.plan = buildBuy3PlanV753_(cfg, d, market, decision.score, 1.0);
      decision.reasons.unshift('Core ETF ผ่าน ETF Protection ใช้ DCA ได้');
    } else {
      decision.reasons.unshift('Core ETF ยังไม่ผ่าน trend พอสำหรับเปิดไม้');
    }
    applyNewsGateOverrides_(decision, d, market);
    validateBuyPlanRRR_(decision);
    return decision;
  }

  // Speculative Stock
  if (spec) {
    const specMode = PropertiesService.getScriptProperties().getProperty('SPECULATIVE_MODE') || SPECULATIVE_MODE;
    if (specMode === 'WATCH_ONLY') {
      decision.reasons.unshift('หุ้น Speculative ห้ามเปิดซื้อภายใต้ WATCH_ONLY mode');
      return decision;
    }

    if (specMode === 'ALLOW_SMALL_BUY') {
      const specFails = [];
      if (!d.longTrendValid) specFails.push('longTrendValid false (ข้อมูลน้อยกว่า 200 sessions)');
      if (!(d.ema20 > d.ema50 && d.ema50 > d.ema200)) specFails.push('EMA trend เสีย');
      
      const rsiVal = Number(d.rsi || 0);
      if (rsiVal < 30 || rsiVal >= 70) specFails.push('RSI นอกช่วง 30-70 (' + fmtNumV748_(rsiVal, 1) + ')');
      if (badNews) specFails.push('มีข่าวลบ');
      if (oneDayMove > 5.0) specFails.push('One-day move สูงเกินเพดาน 5% (' + fmtNumV748_(oneDayMove, 2) + '%)');
      if (isThai) {
        if (market.thaiMarketStatus !== 'OK' || market.thaiMarketBuyBlocked) specFails.push('ตลาด risk-off');
      } else {
        if (!market.ok || market.buyBlocked) specFails.push('ตลาด risk-off');
      }

      if (specFails.length === 0) {
        decision.buyTier = 'TECH_BUY';
        decision.displayAction = 'TECH BUY';
        decision.openBuy = true;
        decision.plan = buildBuy3PlanV753_(cfg, d, market, decision.score, 0.15);
        decision.reasons.unshift('หุ้น Speculative ผ่านเกณฑ์ ALLOW_SMALL_BUY สำหรับไม้เล็กมาก');
      } else {
        decision.reasons.unshift('Speculative Blocked: ' + specFails.join(' / '));
      }

      applyNewsGateOverrides_(decision, d, market);
      validateBuyPlanRRR_(decision);
      return decision;
    }
  }

  // Thai Stock
  if (isThai) {
    if (market.thaiMarketStatus !== 'OK') {
      decision.reasons.unshift('Thai market context unavailable');
      if (tech.strong && decision.score >= 4) {
        decision.buyTier = 'TECHNICAL_ONLY';
        decision.displayAction = 'TECHNICAL ONLY';
        decision.openBuy = true;
        decision.plan = buildBuy3PlanV753_(cfg, d, market, decision.score, 0.20);
      }
    } else {
      if (tech.strong && decision.score >= 4) {
        decision.buyTier = 'TECH_BUY';
        decision.displayAction = 'TECH BUY';
        decision.openBuy = true;
        decision.plan = buildBuy3PlanV753_(cfg, d, market, decision.score, 0.35);
        decision.reasons.unshift('หุ้นไทยใช้ News Gate แบบ optional และ technical ผ่าน');
      }
    }
    applyNewsGateOverrides_(decision, d, market);
    validateBuyPlanRRR_(decision);
    return decision;
  }

  // US Stock
  if (newsPass && !badNews && !conflictingNews && tech.strong && decision.score >= 4) {
    decision.buyTier = 'FULL_BUY';
    decision.displayAction = 'BUY';
    decision.openBuy = true;
    decision.plan = buildBuy3PlanV753_(cfg, d, market, decision.score, 0.75);
    decision.reasons.unshift('ข่าวผ่าน + technical ผ่าน');
  }
  else if (!badNews && tech.strong && decision.score >= 4 && oneDayMove <= MAX_TECH_BUY_ONE_DAY_MOVE_V800) {
    decision.buyTier = 'TECH_BUY';
    decision.displayAction = 'TECH BUY';
    decision.openBuy = true;
    decision.plan = buildBuy3PlanV753_(cfg, d, market, decision.score, 0.30);
    if (conflictingNews) {
      decision.reasons.unshift('ข่าวขัดแย้งกัน ลดระดับเป็น TECH BUY ไม้เล็ก');
    } else if (news.newsAvailable && !news.newsFresh) {
      decision.reasons.unshift('ข่าวไม่สด ค้าขายทางเทคนิคด้วยไม้เล็ก');
    } else {
      decision.reasons.unshift('News Gate ยังไม่ผ่าน ค้าขายทางเทคนิคด้วยไม้เล็ก');
    }
  } else {
    if (badNews) decision.reasons.unshift('ข่าวเป็นลบ ลดความเสี่ยงก่อน');
    else if (oneDayMove > MAX_TECH_BUY_ONE_DAY_MOVE_V800) decision.reasons.unshift('ราคาวิ่งแรงวันนี้ รอ pullback ก่อน');
    else if (!tech.strong) decision.reasons.unshift('Technical ยังไม่แกร่งพอ: ' + tech.weakReason);
  }

  applyNewsGateOverrides_(decision, d, market);
  validateBuyPlanRRR_(decision);
  return decision;
}

function applyNewsGateOverrides_(decision, d, market) {
  const news = decision.news || emptyNewsV748_();
  const cfg = decision.cfg;

  if (news.status === 'NEGATIVE') {
    decision.buyTier = 'WAIT';
    decision.displayAction = 'WAIT';
    decision.openBuy = false;
    decision.plan = null;
    decision.reasons.unshift('News status NEGATIVE: บล็อกการเข้าซื้อ (' + news.reason + ')');
    return;
  }

  if (news.status === 'CONFLICTING') {
    if (decision.buyTier === 'FULL_BUY') {
      decision.buyTier = 'TECH_BUY';
      decision.displayAction = 'TECH BUY';
      decision.plan = buildBuy3PlanV753_(cfg, d, market, decision.score, 0.30);
      decision.reasons.unshift('News status CONFLICTING: ห้าม FULL_BUY ลดระดับเป็น TECH_BUY');
    }
    return;
  }

  if (news.status === 'NEUTRAL') {
    if (decision.buyTier === 'FULL_BUY') {
      decision.buyTier = 'TECH_BUY';
      decision.displayAction = 'TECH BUY';
      decision.plan = buildBuy3PlanV753_(cfg, d, market, decision.score, 0.30);
      decision.reasons.unshift('News status NEUTRAL: ห้าม FULL_BUY ลดระดับเป็น TECH_BUY');
    }
    return;
  }

  if (news.status === 'DATA_UNAVAILABLE' || news.status === 'STALE') {
    if (decision.buyTier === 'FULL_BUY' || decision.buyTier === 'TECH_BUY') {
      decision.buyTier = 'TECHNICAL_ONLY';
      decision.displayAction = 'TECHNICAL ONLY';
      decision.plan = buildBuy3PlanV753_(cfg, d, market, decision.score, 0.20);
      decision.reasons.unshift('News status ' + news.status + ': ห้าม FULL_BUY/TECH_BUY ลดระดับเป็น TECHNICAL_ONLY');
    }
    return;
  }
}

function technicalPassV753_(decision, d, market) {
  const fails = [];
  const isThai = (decision.cfg.currency === 'THB');

  if (!d.longTrendValid) fails.push('longTrendValid false (น้อยกว่า 200 trading sessions)');
  if (!(d.last > d.ema20)) fails.push('ราคายังต่ำกว่า EMA20');
  if (!(d.ema20 > d.ema50)) fails.push('EMA20/50 ยังไม่เป็นขาขึ้น');
  if (!(d.ema50 > d.ema200)) fails.push('EMA50/200 ยังไม่เป็นขาขึ้น');
  if (!(d.macdHist >= 0)) fails.push('MACD ยังลบ');
  if (!isRsiTechnicalAllowedV820_(decision.cfg, d.rsi)) fails.push(rsiRegimeV820_(decision.cfg, d.rsi).label);
  if (!(d.volatility <= VOL_HIGH_V800)) fails.push('ผันผวนสูงเกิน');
  
  if (!isThai) {
    if (!market.ok) fails.push('Market Snapshot ไม่พร้อม');
    if (market.buyBlocked) fails.push('Market Buy Blocked');
  } else {
    if (market.thaiMarketStatus === 'OK' && market.thaiMarketBuyBlocked) {
      fails.push('SET Buy Blocked');
    }
  }
  
  return { strong: fails.length === 0, weakReason: fails.slice(0, 2).join(', ') };
}

function isSpeculativeV753_(cfg) {
  const c = String((cfg && cfg.cat) || '').toLowerCase();
  const s = String((cfg && cfg.symbol) || '').toUpperCase();
  if (/spec|quantum|space|nuclear/.test(c)) return true;
  return ['ASTS', 'RKLB', 'RGTI', 'AXTI', 'OKLO', 'NBIS', 'AEHR'].indexOf(s) >= 0;
}

function buildBuy3PlanV753_(cfg, d, market, score, tierMult) {
  const props = PropertiesService.getScriptProperties();
  const budgetUsdProp = props.getProperty('BUDGET_USD');
  const budgetThbProp = props.getProperty('BUDGET_THB');
  
  let baseBudget = 0;
  let isDefaultBudget = false;

  if (cfg.currency === 'THB') {
    if (budgetThbProp) {
      baseBudget = Number(budgetThbProp);
    } else {
      baseBudget = BUDGET_BASE_THB;
      isDefaultBudget = true;
    }
  } else {
    if (budgetUsdProp) {
      baseBudget = Number(budgetUsdProp);
    } else {
      baseBudget = BUDGET_BASE_USD;
      isDefaultBudget = true;
    }
  }

  let mult = tierMult || 1;
  if (cfg.cat === 'Core ETF') mult *= 1.2;
  if (isSpeculativeV753_(cfg)) mult *= 0.35;
  if (market.heat >= 70) mult *= 0.5;
  if (score >= 6 && mult >= 0.7) mult *= 1.1;

  const total = roundMoneyV748_(baseBudget * mult, cfg.currency);
  const ratio = market.heat >= 70 ? [10, 20, 70] : market.heat <= 35 ? [40, 30, 30] : [25, 35, 40];
  const supports = buildSupportLevelsV773_(d);
  
  const p1 = supports.near;
  const p2 = supports.mid;
  const p3 = supports.deep;

  const stopLevel = roundMoneyV748_(p3 * 0.95, cfg.currency);
  const targetLevel = roundMoneyV748_(d.resistance || (d.last * 1.15), cfg.currency);

  const legs = [
    { amount: roundMoneyV748_(total * ratio[0] / 100, cfg.currency), price: p1 },
    { amount: roundMoneyV748_(total * ratio[1] / 100, cfg.currency), price: p2 },
    { amount: roundMoneyV748_(total * ratio[2] / 100, cfg.currency), price: p3 }
  ];

  const totalShares = (legs[0].price > 0 ? legs[0].amount / legs[0].price : 0) +
                      (legs[1].price > 0 ? legs[1].amount / legs[1].price : 0) +
                      (legs[2].price > 0 ? legs[2].amount / legs[2].price : 0);

  const weightedAverageEntry = totalShares > 0 ? total / totalShares : d.last;
  const riskPerShare = weightedAverageEntry - stopLevel;
  const rewardPerShare = targetLevel - weightedAverageEntry;
  const rewardRiskRatio = riskPerShare > 0 ? (rewardPerShare / riskPerShare) : 0;

  return {
    total: total,
    ratio: ratio,
    isDefaultBudget: isDefaultBudget,
    baseBudget: baseBudget,
    legs: legs,
    stopLevel: stopLevel,
    targetLevel: targetLevel,
    weightedAverageEntry: weightedAverageEntry,
    riskPerShare: riskPerShare,
    rewardPerShare: rewardPerShare,
    rewardRiskRatio: rewardRiskRatio
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
    lines.push((idx + 1) + '. ' + x.symbol + ' ' + (x.buyTier === 'TECH_BUY' ? '🟡 TECH BUY' : '🟢 BUY') + ' | Signal Score ' + Math.round(x.signalScore || x.confidence || 0) + ' | Rule Score ' + x.score);
    if (x.plan) {
      lines.push('   ซื้อรวม: ' + moneyV748_(x.plan.total, x.cfg.currency) + ' | 3 ไม้ ' + x.plan.ratio.join(':') + (x.plan.isDefaultBudget ? ' (Default Budget)' : ' (Configured Budget)'));
      x.plan.legs.forEach(function(leg, i) {
        lines.push('   ไม้ ' + (i + 1) + ': ' + moneyV748_(leg.amount, x.cfg.currency) + ' @≤' + moneyV748_(leg.price, x.cfg.currency));
      });
      lines.push('   เป้าหมาย (Target): ' + moneyV748_(x.plan.targetLevel, x.cfg.currency) + ' | จุดตัดขาดทุน (Stop Loss): ' + moneyV748_(x.plan.stopLevel, x.cfg.currency));
      lines.push('   Reward-to-Risk Ratio: ' + fmtNumV748_(x.plan.rewardRiskRatio, 2));
    }
    lines.push('   Passed Rules: ' + (x.passedRules || []).join(', '));
    if (x.failedRules && x.failedRules.length) {
      lines.push('   Failed Rules: ' + x.failedRules.join(', '));
    }
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
  lines.push('ซื้อรวม: ' + moneyV748_(decision.plan.total, decision.cfg.currency) + ' | 3 ไม้ ' + decision.plan.ratio.join(':') + 
             (decision.plan.isDefaultBudget ? ' (Default Budget)' : ' (Configured Budget)'));
  decision.plan.legs.forEach(function(leg, i) {
    lines.push('ไม้ ' + (i + 1) + ': ' + moneyV748_(leg.amount, decision.cfg.currency) + ' @≤' + moneyV748_(leg.price, decision.cfg.currency));
  });
  lines.push('เป้าหมาย (Target): ' + moneyV748_(decision.plan.targetLevel, decision.cfg.currency) + 
             ' | จุดตัดขาดทุน (Stop Loss): ' + moneyV748_(decision.plan.stopLevel, decision.cfg.currency));
  lines.push('Reward-to-Risk Ratio: ' + fmtNumV748_(decision.plan.rewardRiskRatio, 2));
  lines.push('Passed Rules: ' + (decision.passedRules || []).join(', '));
  if (decision.failedRules && decision.failedRules.length) {
    lines.push('Failed Rules: ' + decision.failedRules.join(', '));
  }
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

const SYMBOL_REGISTRY_V1000 = {
  'AAPL': {
    symbol: 'AAPL',
    companyName: 'Apple Inc.',
    aliases: ['Apple', 'Apple Inc', 'AAPL'],
    market: 'US'
  },
  'IREN': {
    symbol: 'IREN',
    companyName: 'IREN Limited',
    aliases: ['IREN', 'Iris Energy', 'IREN Limited'],
    market: 'US'
  },
  'QQQM': {
    symbol: 'QQQM',
    companyName: 'Invesco NASDAQ 100 ETF',
    aliases: ['Invesco NASDAQ 100 ETF', 'Nasdaq-100 ETF', 'QQQM'],
    market: 'US'
  },
  'PTT': {
    symbol: 'PTT',
    companyName: 'PTT Public Company Limited',
    aliases: ['PTT', 'ปตท', 'PTT Public Company'],
    market: 'TH'
  },
  'PTT.BK': {
    symbol: 'PTT.BK',
    companyName: 'PTT Public Company Limited',
    aliases: ['PTT', 'ปตท', 'PTT Public Company'],
    market: 'TH'
  },
  'DELTA': {
    symbol: 'DELTA',
    companyName: 'Delta Electronics (Thailand)',
    aliases: ['DELTA', 'เดลต้า', 'Delta Electronics'],
    market: 'TH'
  },
  'ADVANC': {
    symbol: 'ADVANC',
    companyName: 'Advanced Info Service',
    aliases: ['ADVANC', 'Advanced Info Service', 'AIS', 'เอไอเอส'],
    market: 'TH'
  }
};

function getSymbolContextV1000_(symbol) {
  const clean = String(symbol || '').trim().toUpperCase();
  if (clean === 'APPL') {
    return { symbol: 'APPL', companyName: 'Unknown (APPL)', aliases: ['APPL'], market: 'US', warning: 'SYMBOL_WARNING' };
  }
  const regKey = clean.replace('.BK', '');
  if (SYMBOL_REGISTRY_V1000[clean]) {
    return SYMBOL_REGISTRY_V1000[clean];
  }
  if (SYMBOL_REGISTRY_V1000[regKey]) {
    return SYMBOL_REGISTRY_V1000[regKey];
  }
  const isThai = clean.endsWith('.BK') || clean === 'PTT' || clean === 'DELTA' || clean === 'ADVANC';
  const market = isThai ? 'TH' : 'US';
  return {
    symbol: clean,
    companyName: clean,
    aliases: [clean],
    market: market
  };
}

function containsAliasV1000_(text, alias) {
  const isThai = /[\u0e00-\u0e7f]/.test(alias);
  if (isThai) {
    return text.toLowerCase().indexOf(alias.toLowerCase()) >= 0;
  }
  const escaped = alias.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  const regex = new RegExp('\\b' + escaped + '\\b', 'i');
  return regex.test(text);
}

function isNewsRelevantV1000_(title, description, symbolContext) {
  if (symbolContext.warning === 'SYMBOL_WARNING') return false;
  const text = (title + ' ' + description).toLowerCase();
  const aliases = symbolContext.aliases || [symbolContext.symbol];
  for (let i = 0; i < aliases.length; i++) {
    const alias = aliases[i];
    if (containsAliasV1000_(text, alias)) {
      return true;
    }
  }
  return false;
}

function decodeHtmlEntitiesV1000_(str) {
  if (!str) return '';
  return str.replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&nbsp;/g, ' ');
}

function normalizeUrlV1000_(urlStr) {
  if (!urlStr) return '';
  let cleanUrl = urlStr.trim();
  const qIdx = cleanUrl.indexOf('?');
  if (qIdx >= 0) {
    const base = cleanUrl.substring(0, qIdx);
    const query = cleanUrl.substring(qIdx + 1);
    const params = query.split('&');
    const filtered = params.filter(function(p) {
      return !p.startsWith('utm_') && !p.startsWith('feed_') && !p.startsWith('click_');
    });
    cleanUrl = filtered.length > 0 ? base + '?' + filtered.join('&') : base;
  }
  return cleanUrl;
}

function normalizeNewsItemV1000_(raw, symbolContext) {
  const title = decodeHtmlEntitiesV1000_(raw.title || '').replace(/\s+/g, ' ').trim();
  const description = decodeHtmlEntitiesV1000_(raw.description || '').replace(/\s+/g, ' ').trim();
  const link = normalizeUrlV1000_(raw.link || '');
  let publishedAt = raw.publishedAt;
  if (!publishedAt) {
    publishedAt = new Date().toISOString();
  } else {
    try {
      publishedAt = new Date(publishedAt).toISOString();
    } catch (e) {
      publishedAt = new Date().toISOString();
    }
  }
  return {
    title: title,
    description: description,
    link: link,
    publishedAt: publishedAt,
    fetchedAt: new Date().toISOString(),
    source: raw.source || 'Unknown',
    matchedSymbol: symbolContext.symbol,
    matchedCompanyName: symbolContext.companyName
  };
}

function getTitleWordsV1000_(title) {
  return title.toLowerCase().replace(/[^a-zA-Z0-9\u0e00-\u0e7f\s]/g, '').split(/\s+/).filter(Boolean);
}

function titleSimilarityV1000_(t1, t2) {
  const w1 = getTitleWordsV1000_(t1);
  const w2 = getTitleWordsV1000_(t2);
  const s1 = new Set(w1);
  const s2 = new Set(w2);
  if (s1.size === 0 || s2.size === 0) return 0;
  let intersection = 0;
  s1.forEach(function(w) { if (s2.has(w)) intersection++; });
  const union = s1.size + s2.size - intersection;
  return intersection / union;
}

function deduplicateNewsItemsV1000_(items) {
  const unique = [];
  items.forEach(function(item) {
    let foundIdx = -1;
    for (let i = 0; i < unique.length; i++) {
      const u = unique[i];
      if (u.link === item.link) {
        foundIdx = i;
        break;
      }
      if (titleSimilarityV1000_(u.title, item.title) > 0.70) {
        foundIdx = i;
        break;
      }
    }
    if (foundIdx >= 0) {
      const u = unique[foundIdx];
      if (!u.sources) u.sources = [u.source];
      if (u.sources.indexOf(item.source) === -1) {
        u.sources.push(item.source);
      }
    } else {
      item.sources = [item.source];
      unique.push(item);
    }
  });
  return unique;
}

const CRITICAL_NEGATIVE_KEYWORDS = [
  'bankruptcy', 'bankrupt', 'insolvent', 'insolvency', 'default',
  'fraud', 'accounting irregularity', 'accounting irregularities',
  'sec investigation', 'criminal investigation', 'delisting', 'delist'
];

const HIGH_NEGATIVE_KEYWORDS = [
  'dividend cut', 'guidance cut', 'earnings miss', 'analyst downgrade',
  'share offering', 'stock offering', 'dilution', 'executive resignation',
  'ceo resignation', 'cfo resignation', 'contract termination',
  'regulatory rejection', 'production halt', 'data breach', 'major recall',
  'revenue miss', 'profit miss'
];

const POSITIVE_KEYWORDS = [
  'earnings beat', 'revenue beat', 'guidance raised', 'analyst upgrade',
  'contract awarded', 'regulatory approval', 'fda approval', 'share buyback',
  'dividend increase', 'debt reduction', 'profitable', 'record revenue',
  'strategic partnership', 'acquisition completed', 'new major customer',
  'new customer'
];

function isNegatedV1000_(text, keyword) {
  const idx = text.toLowerCase().indexOf(keyword.toLowerCase());
  if (idx === -1) return false;
  const snippet = text.substring(Math.max(0, idx - 30), idx).toLowerCase();
  const negationWords = [
    'denies', 'deny', 'no ', 'not ', 'rejects', 'reject',
    'refutes', 'refute', 'dismisses', 'dismiss', 'rumor',
    'rumours', 'speculation', 'unfounded', 'false'
  ];
  for (let i = 0; i < negationWords.length; i++) {
    if (snippet.indexOf(negationWords[i]) >= 0) {
      return true;
    }
  }
  return false;
}

function classifyNewsItemV1000_(item, symbolContext) {
  const text = (item.title + ' ' + item.description).toLowerCase();
  const matchedRules = [];
  let score = 0;
  let severity = 'NORMAL';

  CRITICAL_NEGATIVE_KEYWORDS.forEach(function(kw) {
    if (text.indexOf(kw) >= 0) {
      if (!isNegatedV1000_(text, kw)) {
        matchedRules.push('CRITICAL_NEG: ' + kw);
        score -= 5;
        severity = 'CRITICAL_NEGATIVE';
      } else {
        matchedRules.push('NEGATED_CRITICAL_NEG: ' + kw);
      }
    }
  });

  HIGH_NEGATIVE_KEYWORDS.forEach(function(kw) {
    if (text.indexOf(kw) >= 0) {
      if (!isNegatedV1000_(text, kw)) {
        matchedRules.push('HIGH_NEG: ' + kw);
        score -= 3;
        if (severity !== 'CRITICAL_NEGATIVE') {
          severity = 'HIGH_NEGATIVE';
        }
      } else {
        matchedRules.push('NEGATED_HIGH_NEG: ' + kw);
      }
    }
  });

  POSITIVE_KEYWORDS.forEach(function(kw) {
    if (text.indexOf(kw) >= 0) {
      if (!isNegatedV1000_(text, kw)) {
        matchedRules.push('POS: ' + kw);
        score += 3;
        if (severity === 'NORMAL') {
          severity = 'POSITIVE_CATALYST';
        }
      } else {
        matchedRules.push('NEGATED_POS: ' + kw);
      }
    }
  });

  let sentiment = 'NEUTRAL';
  if (score > 0) {
    sentiment = 'POSITIVE';
  } else if (score < 0) {
    sentiment = 'NEGATIVE';
  }
  let reason = matchedRules.length > 0 ? 'Matched: ' + matchedRules.join(', ') : 'Normal market news';
  return {
    sentiment: sentiment,
    severity: severity,
    score: score,
    matchedRules: matchedRules,
    reason: reason
  };
}

function fetchRssXmlV1000_(url) {
  try {
    const res = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    const code = res.getResponseCode();
    if (code !== 200) {
      return { ok: false, error: 'HTTP ' + code };
    }
    return { ok: true, xmlText: res.getContentText() };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

function parseRssXmlV1000_(xmlText) {
  try {
    const doc = XmlService.parse(xmlText);
    const root = doc.getRootElement();
    const channel = root.getChild('channel');
    if (!channel) return { ok: false, error: 'No channel element' };
    const items = channel.getChildren('item');
    const parsed = [];
    items.forEach(function(item) {
      const title = item.getChildText('title') || '';
      const link = item.getChildText('link') || '';
      const desc = item.getChildText('description') || '';
      const pubDate = item.getChildText('pubDate') || '';
      const source = item.getChildText('source') || 'RSS';
      parsed.push({
        title: title,
        description: desc,
        link: link,
        publishedAt: pubDate,
        source: source
      });
    });
    return { ok: true, items: parsed };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

function buildNewsGate_(symbol, companyContext) {
  const symbolContext = companyContext || getSymbolContextV1000_(symbol);
  const now = new Date().toISOString();
  const result = {
    symbol: symbolContext.symbol,
    status: 'NEUTRAL',
    gatePass: false,
    ruleScore: 0,
    positiveCount: 0,
    negativeCount: 0,
    criticalNegativeCount: 0,
    latestNewsAt: '',
    newsAgeHours: null,
    fetchedAt: now,
    cacheAgeSeconds: 0,
    stale: false,
    sources: [],
    topPositive: [],
    topNegative: [],
    reason: 'NO_MATCHING_RECENT_NEWS',
    warnings: [],
    items: []
  };

  if (symbolContext.warning === 'SYMBOL_WARNING') {
    result.status = 'DATA_UNAVAILABLE';
    result.gatePass = false;
    result.reason = 'SYMBOL_WARNING: Ticker might be incorrect. Purchase blocked.';
    result.warnings.push('SYMBOL_WARNING: ' + symbolContext.symbol + ' might be incorrect');
    return result;
  }

  const cacheKey = 'NEWS_GATE_V1000_' + symbolContext.symbol;
  try {
    const cache = CacheService.getScriptCache();
    const cached = cache.get(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      const nowTime = new Date().getTime();
      const createdTime = new Date(parsed.cacheCreatedAt || parsed.fetchedAt || now).getTime();
      const ageSeconds = (nowTime - createdTime) / 1000;
      parsed.cacheAgeSeconds = ageSeconds;
      if (ageSeconds > 1800) {
        parsed.stale = true;
        parsed.gatePass = false;
        parsed.status = 'STALE';
        parsed.reason = 'Stale cache. Refresh required.';
      } else {
        parsed.stale = false;
      }
      if (!parsed.stale) {
        return parsed;
      }
      result._staleFallback = parsed;
    }
  } catch (errCache) {
    Logger.log('Cache read error: ' + errCache.message);
  }

  let items = [];
  let provider = 'Regional';
  const regional = fetchRegionalNewsV1300_(symbolContext);
  if (regional.errors.length) result.warnings = result.warnings.concat(regional.errors);
  items = regional.rawItems.map(function(item) {
    const norm = normalizeNewsItemV1000_(item, symbolContext);
    norm.source = item.source || 'Regional News';
    return norm;
  });
  provider = regional.sources.length ? regional.sources.join(' + ') : (regional.errors.length >= 2 ? 'Error' : 'Regional');

  // Thai Google News is a last-resort fallback when the two primary feeds have no matching item.
  if (items.length === 0) {
    const query = encodeURIComponent(symbolContext.companyName + ' OR ' + symbolContext.symbol);
    const googleUrl = 'https://news.google.com/rss/search?q=' + query + '+when:72h&hl=th&gl=TH&ceid=TH:th';
    const gRss = fetchRssXmlV1000_(googleUrl);
    if (gRss.ok) {
      const parsedGoogle = parseRssXmlV1000_(gRss.xmlText);
      if (parsedGoogle.ok) {
        const matchedGoogle = parsedGoogle.items.filter(function(rawItem) {
          return isNewsRelevantV1000_(rawItem.title, rawItem.description, symbolContext);
        });
        items = matchedGoogle.map(function(item) {
          const norm = normalizeNewsItemV1000_(item, symbolContext);
          norm.source = 'Google News TH';
          return norm;
        });
        if (items.length) provider = 'Google News TH';
      }
    }
  }
  if (items.length === 0 && provider === 'Error') {
    if (result._staleFallback) {
      const fallback = result._staleFallback;
      fallback.status = 'STALE';
      fallback.gatePass = false;
      fallback.reason = 'Refresh failed. Returning stale cache.';
      fallback.warnings.push('Refresh failed, stale data used');
      return fallback;
    }
    result.status = 'DATA_UNAVAILABLE';
    result.gatePass = false;
    result.reason = 'News provider unavailable and no cached data';
    result.warnings.push('News fetch failed');
    return result;
  }

  const deduped = deduplicateNewsItemsV1000_(items);
  const limited = deduped.slice(0, 20);

  const activeItems = [];
  let latestTime = 0;

  limited.forEach(function(item) {
    const pubTime = new Date(item.publishedAt).getTime();
    if (pubTime > latestTime) {
      latestTime = pubTime;
    }
    const ageHours = (new Date().getTime() - pubTime) / (3600 * 1000);
    item.ageHours = ageHours;
    if (ageHours <= 72) {
      item.label = 'RECENT';
      activeItems.push(item);
    } else {
      item.label = 'OLD';
    }
  });

  result.items = limited;
  if (latestTime > 0) {
    result.latestNewsAt = new Date(latestTime).toISOString();
    result.newsAgeHours = (new Date().getTime() - latestTime) / (3600 * 1000);
  }

  let ruleScore = 0;
  let posCount = 0;
  let negCount = 0;
  let critNegCount = 0;
  const topPos = [];
  const topNeg = [];
  const uniqueSources = {};

  activeItems.forEach(function(item) {
    const classification = classifyNewsItemV1000_(item, symbolContext);
    item.classification = classification;
    ruleScore += classification.score;
    
    if (item.sources) {
      item.sources.forEach(function(s) { uniqueSources[s] = true; });
    } else {
      uniqueSources[item.source] = true;
    }

    if (classification.severity === 'CRITICAL_NEGATIVE') {
      critNegCount++;
      negCount++;
      if (topNeg.length < 2) topNeg.push(item);
    } else if (classification.sentiment === 'NEGATIVE') {
      negCount++;
      if (topNeg.length < 2) topNeg.push(item);
    } else if (classification.sentiment === 'POSITIVE') {
      posCount++;
      if (topPos.length < 2) topPos.push(item);
    }
  });

  result.ruleScore = ruleScore;
  result.positiveCount = posCount;
  result.negativeCount = negCount;
  result.criticalNegativeCount = critNegCount;
  result.sources = Object.keys(uniqueSources);
  result.topPositive = topPos;
  result.topNegative = topNeg;
  result.sourceStatus = provider;

  if (critNegCount >= 1) {
    result.status = 'NEGATIVE';
    result.gatePass = false;
    result.reason = 'Blocked by critical negative news event: ' + (topNeg[0] ? topNeg[0].title : '');
  } else if (negCount > 0 && posCount > 0) {
    result.status = 'CONFLICTING';
    result.gatePass = false;
    result.reason = 'Conflicting positive and negative news';
  } else if (negCount > 0) {
    result.status = 'NEGATIVE';
    result.gatePass = false;
    result.reason = 'Negative news events dominant';
  } else if (posCount > 0) {
    result.status = 'POSITIVE';
    result.gatePass = true;
    result.reason = 'Positive news events dominant';
  } else {
    result.status = 'NEUTRAL';
    result.gatePass = false;
    result.reason = 'NO_MATCHING_RECENT_NEWS';
  }

  result.cacheCreatedAt = now;
  try {
    const cache = CacheService.getScriptCache();
    cache.put(cacheKey, JSON.stringify(result), 1800);
  } catch (errCachePut) {
    Logger.log('Cache write error: ' + errCachePut.message);
  }

  return result;
}

function fetchNewsForSymbolsV748_(configs) {
  const out = {};
  configs.forEach(function(cfg) {
    out[cfg.symbol] = buildNewsGate_(cfg.symbol, getSymbolContextV1000_(cfg.symbol));
  });
  return out;
}

function emptyNewsV748_(err) {
  return {
    symbol: '',
    status: 'DATA_UNAVAILABLE',
    gatePass: false,
    ruleScore: 0,
    positiveCount: 0,
    negativeCount: 0,
    criticalNegativeCount: 0,
    latestNewsAt: '',
    newsAgeHours: null,
    fetchedAt: new Date().toISOString(),
    cacheAgeSeconds: 0,
    stale: true,
    sources: [],
    topPositive: [],
    topNegative: [],
    reason: err || 'News provider unavailable',
    warnings: [err || 'News fetch failed'],
    items: []
  };
}

function shortReasonFromHeadlineV748_(headline) {
  if (!headline) return 'ไม่มีข่าว';
  return truncateV748_(headline, 90);
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
  if (gains === 0 && losses === 0) {
    return { value: 50, status: 'NEUTRAL_NO_MOVEMENT' };
  }
  if (losses === 0 && gains > 0) {
    return { value: 100, status: 'BULLISH' };
  }
  if (gains === 0 && losses > 0) {
    return { value: 0, status: 'BEARISH' };
  }
  const rs = gains / losses;
  return { value: 100 - (100 / (1 + rs)), status: 'NORMAL' };
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
  // V9.4 Sharp Text Fast:
  // - Direct text reply for single-stock query.
  // - Skip macro/news fetch for speed; use price/technical only.
  const requestedSymbol = String(symbol || '').trim().toUpperCase().replace(/[^A-Z0-9.\-]/g, '');
  const cfg = getSymbolConfigV748_(requestedSymbol);
  const d = fetchTechnicalDataV748_(cfg);

  if (!d || !d.ok) {
    return {
      imageUrl: null,
      text: '❌ ดึงข้อมูล ' + cfg.symbol + ' ไม่สำเร็จ: ' + (d && d.error ? d.error : 'unknown') + '\nตรวจสอบ ticker อีกครั้ง เช่น AMZN ไม่ใช่ AZMN',
      chartCard: null,
      flexCard: null
    };
  }

  const market = fastMarketSnapshotV930_ ? fastMarketSnapshotV930_() : {
    spyMa200Pct: 0, vix: 18, usdthb: 32.7, heat: 45, regime: 'Fast Mode'
  };

  const decision = buildSymbolDecisionV748_(cfg, d, market, true);

  decision.news = emptyNewsV748_('Fast single-stock mode: news skipped');
  decision.news.status = (cfg.cat === 'Core ETF' || cfg.currency === 'THB') ? 'OPTIONAL' : 'SKIPPED';
  decision.news.gatePass = (cfg.cat === 'Core ETF' || cfg.currency === 'THB');
  decision.news.score = 0;
  decision.fastMode = true;

  applyBuyTierLogicV753_(decision, d, market);

  const sr = buildSingleSupportResistanceV774_(d);
  const text = buildProVisualSummaryTextV830_(cfg, d, decision, sr);

  return {
    imageUrl: null,
    text: text,
    chartCard: null,
    flexCard: null
  };
}

function fastMarketSnapshotV930_() {
  const cached = getCachedMarketSnapshotV748_();
  if (cached) {
    return cached;
  }

  try {
    const fresh = buildMarketSnapshotV748_();
    if (fresh && fresh.ok) return fresh;
  } catch (err) {
    Logger.log('Fresh market snapshot error in fastMarketSnapshot: ' + err.message);
  }

  return {
    ok: false,
    spyMa200Pct: null,
    vix: 18,
    vixIsFallback: true,
    vixProvider: 'Fallback',
    usdthb: 32.7,
    usdthbIsFallback: true,
    usdthbProvider: 'Fallback',
    spyProvider: 'None',
    thaiMarketStatus: 'DATA_UNAVAILABLE',
    thaiMarketProvider: 'None',
    thaiMarketBuyBlocked: true,
    heat: 45,
    regime: 'DATA_UNAVAILABLE',
    buyBlocked: true,
    fetchedAt: new Date().toISOString(),
    asOf: new Date().toISOString(),
    cacheCreatedAt: new Date().toISOString(),
    cacheAgeMinutes: 0,
    stale: true
  };
}

function lineSepV884_() {
  // Wider separator for LINE text bubbles. Kept short enough to avoid wrapping.
  return '━━━━━━━━━━━━━━━━━━';
}

function buildProVisualSummaryTextV830_(cfg, d, decision, sr) {
  const action = decision.buyTier === 'FULL_BUY' ? 'BUY' : (decision.buyTier === 'TECH_BUY' ? 'TECH BUY' : 'WAIT');
  const conviction = Math.max(20, Math.min(99, Math.round(decision.confidence || 50)));
  const currency = cfg.currency || 'USD';

  const plan = decision.plan || null;
  const hasPlan = !!(plan && plan.total > 0 && plan.legs && plan.legs.length);

  const entry = hasPlan && plan.legs[0] ? plan.legs[0].price : sr.support;
  const tp = sr.resistance;
  const sl = hasPlan && plan.legs[1] ? Math.min(plan.legs[1].price, sr.support * 0.98) : sr.support * 0.98;

  const trendText = d.last >= d.sma5 ? 'ระยะสั้นเป็นบวก ↗️' : 'ระยะสั้นยังอ่อน ↘️';
  const rsiText = d.rsi >= 70 ? 'ค่อนข้างร้อน 🟡' : (d.rsi >= 50 ? 'Momentum บวก 🟢' : (d.rsi < 30 ? 'Oversold 🟡' : 'ยังไม่แรง 🟡'));
  const macdText = d.macdHist >= 0 ? 'สัญญาณบวก 🟢' : 'เริ่มอ่อนแรง 🔴';
  const ema20Text = d.last >= d.ema20 ? 'ราคาอยู่เหนือเส้น 🟢' : 'ราคาอยู่ต่ำกว่าเส้น 🔴';
  const volText = d.volatility > 0.055 ? 'สูง 🔴' : (d.volatility > 0.035 ? 'กลาง 🟡' : 'ต่ำ 🟢');
  const newsText = decision.fastMode ? 'โหมดเร็ว ⚪' : (decision.news && decision.news.gatePass ? 'ผ่าน 🟢' : 'ยังไม่ผ่าน 🔴');

  const lines = [];

  lines.push('⚡ TL;DR: ' + action + ' ' + cfg.symbol + ' ' + moneyV748_(d.last, currency));
  lines.push((action === 'WAIT' ? 'Watch ' : 'Entry ') + moneyV748_(entry, currency) + ' • TP ' + moneyV748_(tp, currency) + ' • SL ' + moneyV748_(sl, currency));
  lines.push('');
  lines.push('👑 Stockify Report — ' + cfg.symbol);
  lines.push('Conviction: ' + conviction + '/100 | ' + convictionLabelV830_(conviction));
  lines.push('Data: ' + (d.provider || 'Yahoo'));
  lines.push('');
  lines.push('📈 Health Check');
  lines.push('• Trend: ' + trendText);
  lines.push('• RSI ' + fmtNumV748_(d.rsi, 1) + ': ' + rsiText);
  lines.push('• MACD: ' + macdText);
  lines.push('• EMA20: ' + ema20Text);
  lines.push('• Volatility: ' + volText);
  lines.push('• News Gate: ' + newsText);
  lines.push('');
  lines.push('🗺️ Price Zone');
  lines.push('• Entry / แนวรับ: ' + moneyV748_(entry, currency));
  lines.push('• TP / แนวต้าน: ' + moneyV748_(tp, currency));
  lines.push('• SL / Stop Zone: ' + moneyV748_(sl, currency));
  lines.push('');
  lines.push('🎯 แผน 3 ไม้');

  if (hasPlan) {
    lines.push('รวม: ' + moneyV748_(plan.total, currency) + ' | สัดส่วน ' + plan.ratio.join(':'));
    plan.legs.forEach(function(leg, i) {
      lines.push((i + 1) + ') ' + moneyV748_(leg.amount, currency) + ' @≤' + moneyV748_(leg.price, currency));
    });
  } else {
    lines.push('สถานะ: ยังไม่เปิดซื้อใหม่');
    lines.push('รอราคาเข้าโซน Entry ก่อน ไม่ไล่ราคา');
  }

  lines.push('');
  lines.push('🧠 Bottom Line');
  lines.push(buildSharpBottomLineV940_(d, decision, hasPlan));
  lines.push('');
  lines.push('ℹ️ ไม่ใช่คำแนะนำลงทุน | ไม่รวม Pre/After Market');

  return lines.join('\n');
}

function buildSharpBottomLineV940_(d, decision, hasPlan) {
  const parts = [];

  if (d.last >= d.ema20) parts.push('ราคาอยู่เหนือ EMA20');
  else parts.push('ราคายังต่ำกว่า EMA20');

  if (d.macdHist >= 0) parts.push('MACD เป็นบวก');
  else parts.push('MACD ยังอ่อน');

  if (d.volatility > 0.055) parts.push('แต่ความผันผวนสูง');
  else if (d.volatility > 0.035) parts.push('ความผันผวนระดับกลาง');
  else parts.push('ความผันผวนต่ำ');

  if (hasPlan) {
    return parts.join(' + ') + ' จึงใช้แผนทยอยซื้อได้ แต่ไม่ควรไล่ราคา';
  }

  if (d.last >= d.ema20 && d.macdHist >= 0) {
    return parts.join(' + ') + ' แต่ระบบยังไม่เปิดไม้ใหม่ ควรรอราคาเข้าโซนและสัญญาณยืนยัน';
  }

  return parts.join(' + ') + ' จึงควรรอจังหวะ ไม่ไล่ซื้อทันที';
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

  if (decision.fastMode) out.push('📰 โหมดเร็ว: ข้ามข่าวสด ใช้เทคนิคเป็นหลัก');
  else if (decision.news && decision.news.gatePass) out.push('📰 News Gate ผ่าน ใช้ประกอบการตัดสินใจได้');
  else out.push('📰 News Gate ยังไม่ผ่าน จึงลดความมั่นใจของสัญญาณ');

  if (hasPlan) out.push('🎯 สรุป: เปิดแผนทยอยซื้อได้ตามไม้ที่ระบบกำหนด ไม่ไล่ราคา');
  else out.push('🎯 สรุป: ยังไม่เปิดซื้อใหม่ รอราคาเข้าโซนและสัญญาณยืนยัน');

  return out.slice(0, 5);
}


function fetchRegionalNewsV1300_(symbolContext) {
  var cfg = getSymbolConfigV748_(symbolContext.symbol);
  var yahooTicker = cfg ? yahooSymbolV748_(cfg) : symbolContext.symbol;
  var feeds = [
    { name: 'Investing Thailand', url: 'https://th.investing.com/rss/news_285.rss' },
    { name: 'Yahoo Finance', url: 'https://finance.yahoo.com/rss/headline?s=' + encodeURIComponent(yahooTicker) }
  ];
  var rawItems = [];
  var sources = [];
  var errors = [];
  feeds.forEach(function(feed) {
    var fetched = fetchRssXmlV1000_(feed.url);
    if (!fetched.ok) { errors.push(feed.name + ': ' + fetched.error); return; }
    var parsed = parseRssXmlV1000_(fetched.xmlText);
    if (!parsed.ok) { errors.push(feed.name + ': ' + parsed.error); return; }
    var matched = parsed.items.filter(function(item) {
      return isNewsRelevantV1000_(item.title, item.description, symbolContext);
    });
    if (matched.length) sources.push(feed.name);
    matched.forEach(function(item) {
      item.source = feed.name;
      rawItems.push(item);
    });
  });
  return { rawItems: rawItems, sources: sources, errors: errors, yahooTicker: yahooTicker };
}

function testRegionalNewsV1300() {
  var result = fetchRegionalNewsV1300_(getSymbolContextV1000_('CPALL'));
  Logger.log(JSON.stringify({ symbol: 'CPALL', itemCount: result.rawItems.length, sources: result.sources, errors: result.errors }));
  return { symbol: 'CPALL', itemCount: result.rawItems.length, sources: result.sources, errors: result.errors };
}
