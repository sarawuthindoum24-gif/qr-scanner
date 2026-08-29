/*
 * Holdings.gs  — Portfolio Holdings + Average-Down (ถัวต้นทุน) Engine
 * ----------------------------------------------------------------------
 * - เก็บพอร์ตจริง (Symbol, Portfolio, Shares, AvgCost USD, TotalCost USD)
 * - Sheet: "Holdings" (auto-create + seed ครั้งแรก)
 * - ฟีเจอร์ถัวต้นทุน: กรอกเงินบาท/ดอลลาร์ หรือจำนวนหุ้น -> คำนวณต้นทุนเฉลี่ยใหม่
 * - Human-in-the-loop: คำนวณ/แสดงผลก่อน ยืนยันค่อยบันทึกลงพอร์ต
 *
 * DISCLAIMER: ข้อมูลประกอบการตัดสินใจเท่านั้น ไม่ใช่คำแนะนำการลงทุน
 */

var HOLDINGS_SHEET_NAME_V1 = 'Holdings';
var HOLDINGS_HEADERS_V1 = ['Symbol', 'Portfolio', 'Shares', 'AvgCostUSD', 'TotalCostUSD', 'LastUpdated'];

// ต้นทุนจริง ณ วันที่ยืนยันข้อมูล (seed ครั้งแรกเท่านั้น) — ตรวจสอบแล้ว shares*avg = totalCost
var HOLDINGS_SEED_V1 = [
  // ===== พอร์ต ETF =====
  { symbol: 'VOO',  portfolio: 'ETF',     shares: 1.1623866,  avgCost: 672.4785,   totalCost: 781.68 },
  { symbol: 'QQQM', portfolio: 'ETF',     shares: 1.0014339,  avgCost: 291.6218,   totalCost: 292.04 },
  { symbol: 'SMH',  portfolio: 'ETF',     shares: 0.1688240,  avgCost: 598.4930,   totalCost: 101.04 },
  // ===== พอร์ตร้อยเด้ง (Hundred) =====
  { symbol: 'MU',   portfolio: 'Hundred', shares: 0.3037556,  avgCost: 406.2477,   totalCost: 123.40 },
  { symbol: 'AMD',  portfolio: 'Hundred', shares: 1.0295960,  avgCost: 59.3145,    totalCost: 61.07  },
  { symbol: 'NBIS', portfolio: 'Hundred', shares: 0.3088563,  avgCost: 244.8712,   totalCost: 75.63  },
  { symbol: 'AVGO', portfolio: 'Hundred', shares: 0.2024008,  avgCost: 454.8895,   totalCost: 92.07  },
  { symbol: 'ASML', portfolio: 'Hundred', shares: 0.1849393,  avgCost: 734.9978,   totalCost: 135.93 },
  // ===== พอร์ตหุ้นสหรัฐฯ (Dime) =====
  { symbol: 'VOO',  portfolio: 'Dime',    shares: 1.4121292,  avgCost: 679.9691,   totalCost: 960.20 },
  { symbol: 'SCHD', portfolio: 'Dime',    shares: 10.3938997, avgCost: 32.8116,    totalCost: 341.04 },
  { symbol: 'QQQM', portfolio: 'Dime',    shares: 1.1442601,  avgCost: 293.1351,   totalCost: 335.42 },
  { symbol: 'ASML', portfolio: 'Dime',    shares: 0.1327670,  avgCost: 1876.2940,  totalCost: 249.11 },
  { symbol: 'NBIS', portfolio: 'Dime',    shares: 0.9679995,  avgCost: 217.0249,   totalCost: 210.08 },
  { symbol: 'TSM',  portfolio: 'Dime',    shares: 0.4848516,  avgCost: 432.5241,   totalCost: 209.71 },
  { symbol: 'AVGO', portfolio: 'Dime',    shares: 0.4758168,  avgCost: 395.3412,   totalCost: 188.11 },
  { symbol: 'RKLB', portfolio: 'Dime',    shares: 2.1395077,  avgCost: 88.2633,    totalCost: 188.84 },
  { symbol: 'META', portfolio: 'Dime',    shares: 0.1500472,  avgCost: 595.0793,   totalCost: 89.29  },
  { symbol: 'LLY',  portfolio: 'Dime',    shares: 0.0560954,  avgCost: 1156.9580,  totalCost: 64.90  },
  { symbol: 'NVDA', portfolio: 'Dime',    shares: 0.2316024,  avgCost: 192.96,     totalCost: 44.69  },
  { symbol: 'GOOGL',portfolio: 'Dime',    shares: 0.0920132,  avgCost: 317.9980,   totalCost: 29.26  }
];

/* ---------- Sheet helpers ---------- */

function getHoldingsSpreadsheetV1_() {
  // ใช้ Spreadsheet เดียวกับ Watchlist ถ้ามี ไม่งั้นสร้างใหม่แล้วจำ id ไว้
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('HOLDINGS_SHEET_ID') || props.getProperty('WATCHLIST_SHEET_ID');
  if (id) {
    try { return SpreadsheetApp.openById(id); } catch (e) { /* fallthrough */ }
  }
  var ss = SpreadsheetApp.create('Stockify Holdings DB');
  props.setProperty('HOLDINGS_SHEET_ID', ss.getId());
  return ss;
}

function getHoldingsSheetV1_() {
  var ss = getHoldingsSpreadsheetV1_();
  var sh = ss.getSheetByName(HOLDINGS_SHEET_NAME_V1);
  var created = false;
  if (!sh) {
    sh = ss.insertSheet(HOLDINGS_SHEET_NAME_V1);
    created = true;
  }
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, HOLDINGS_HEADERS_V1.length).setValues([HOLDINGS_HEADERS_V1]);
    sh.setFrozenRows(1);
    created = true;
  }
  if (created && sh.getLastRow() < 2) {
    seedHoldingsV1_(sh);
  }
  return sh;
}

function seedHoldingsV1_(sh) {
  var now = new Date();
  var rows = HOLDINGS_SEED_V1.map(function (h) {
    return [h.symbol, h.portfolio, h.shares, h.avgCost, h.totalCost, now];
  });
  sh.getRange(2, 1, rows.length, HOLDINGS_HEADERS_V1.length).setValues(rows);
  return rows.length;
}

// เรียกครั้งเดียวเพื่อสร้าง+เติมพอร์ต แล้วดู URL
function setupHoldingsV1() {
  var sh = getHoldingsSheetV1_();
  var url = sh.getParent().getUrl();
  Logger.log('Holdings sheet ready: ' + url + ' (rows=' + (sh.getLastRow() - 1) + ')');
  return url;
}


/* ---------- Read holdings ---------- */

function getAllHoldingsV1_() {
  var sh = getHoldingsSheetV1_();
  var last = sh.getLastRow();
  if (last < 2) return [];
  var vals = sh.getRange(2, 1, last - 1, HOLDINGS_HEADERS_V1.length).getValues();
  return vals.map(function (r, i) {
    return {
      row: i + 2,
      symbol: String(r[0]).trim().toUpperCase(),
      portfolio: String(r[1]).trim(),
      shares: Number(r[2]) || 0,
      avgCost: Number(r[3]) || 0,
      totalCost: Number(r[4]) || 0,
      lastUpdated: r[5]
    };
  });
}

// หา holding ตาม symbol (+ portfolio ถ้าระบุ). ถ้า symbol ซ้ำหลายพอร์ตและไม่ระบุ -> คืน list
function findHoldingV1_(symbol, portfolio) {
  var sym = String(symbol || '').trim().toUpperCase();
  var all = getAllHoldingsV1_().filter(function (h) { return h.symbol === sym; });
  if (portfolio) {
    var p = String(portfolio).trim().toLowerCase();
    all = all.filter(function (h) { return h.portfolio.toLowerCase() === p; });
  }
  return all;
}

/* ---------- Average-down (ถัวต้นทุน) core ---------- */

// คำนวณต้นทุนเฉลี่ยใหม่ เมื่อซื้อเพิ่ม
// input: current {shares, avgCost}, add {addShares?, addAmountUSD?, price}
// ต้องมี price เสมอ + อย่างใดอย่างหนึ่งของ addShares / addAmountUSD
function computeAverageDownV1_(current, add) {
  var price = Number(add.price);
  if (!price || price <= 0) throw new Error('ต้องระบุราคาที่จะซื้อเพิ่ม (price > 0)');

  var addShares, addAmountUSD;
  if (add.addShares != null) {
    addShares = Number(add.addShares);
    addAmountUSD = addShares * price;
  } else if (add.addAmountUSD != null) {
    addAmountUSD = Number(add.addAmountUSD);
    addShares = addAmountUSD / price;
  } else {
    throw new Error('ต้องระบุจำนวนหุ้น (addShares) หรือจำนวนเงิน USD (addAmountUSD) ที่จะซื้อเพิ่ม');
  }
  if (addShares <= 0) throw new Error('จำนวนที่ซื้อเพิ่มต้องมากกว่า 0');

  var oldShares = Number(current.shares) || 0;
  var oldAvg = Number(current.avgCost) || 0;
  var oldTotalCost = oldShares * oldAvg;

  var newShares = oldShares + addShares;
  var newTotalCost = oldTotalCost + addAmountUSD;
  var newAvg = newTotalCost / newShares;

  return {
    oldShares: oldShares,
    oldAvgCost: oldAvg,
    oldTotalCost: oldTotalCost,
    addShares: addShares,
    addAmountUSD: addAmountUSD,
    price: price,
    newShares: newShares,
    newAvgCost: newAvg,
    newTotalCost: newTotalCost,
    avgCostDelta: newAvg - oldAvg
  };
}

function roundV1_(n, d) {
  var f = Math.pow(10, d == null ? 4 : d);
  return Math.round(Number(n) * f) / f;
}


/* ---------- FX helper (THB -> USD) ---------- */

function getUsdThbRateV1_() {
  // ลองดึงเรตสด ถ้าไม่ได้ใช้ค่า fallback
  try {
    var res = UrlFetchApp.fetch('https://query1.finance.yahoo.com/v8/finance/chart/THB=X?interval=1d&range=1d', { muteHttpExceptions: true });
    var data = JSON.parse(res.getContentText());
    var px = data && data.chart && data.chart.result && data.chart.result[0] &&
             data.chart.result[0].meta && data.chart.result[0].meta.regularMarketPrice;
    if (px && px > 0) return px;
  } catch (e) { /* ignore */ }
  var saved = PropertiesService.getScriptProperties().getProperty('USDTHB_FALLBACK');
  return saved ? Number(saved) : 33.32;
}

/* ---------- Parse Thai average-down command ---------- */
// รองรับเช่น:
//  "ถัว NVDA เพิ่ม 5000 บาท ที่ 120"
//  "เติม AAPL 10 หุ้น ที่ 180"
//  "ซื้อเพิ่ม MU 100$ ที่ 90 พอร์ต Dime"
//  "average down TSM 2000thb @ 185"
function parseAverageDownCommandV1_(text) {
  if (!text) return null;
  var t = String(text).trim();
  var low = t.toLowerCase();

  var isAvgCmd = /(ถัว|เติม|ซื้อเพิ่ม|average\s*down|avg\s*down|dca)/i.test(low);
  if (!isAvgCmd) return null;

  // symbol = คำภาษาอังกฤษตัวใหญ่ 1-5 ตัว
  var symMatch = t.match(/\b([A-Za-z]{1,5})\b(?=.*(?:ที่|@|ราคา|price))/);
  if (!symMatch) symMatch = t.match(/\b([A-Z]{1,5})\b/);
  var symbol = symMatch ? symMatch[1].toUpperCase() : null;

  // portfolio (optional)
  var port = null;
  var pm = low.match(/(?:พอร์ต|port(?:folio)?)\s*[:\-]?\s*(etf|dime|hundred|ร้อยเด้ง)/i);
  if (pm) {
    var pv = pm[1].toLowerCase();
    port = pv === 'ร้อยเด้ง' ? 'Hundred' : (pv.charAt(0).toUpperCase() + pv.slice(1));
  }

  // price: หลัง ที่ / @ / ราคา / price
  var priceMatch = t.match(/(?:ที่|@|ราคา|price)\s*[:\-]?\s*\$?([0-9][0-9,]*\.?[0-9]*)/i);
  var price = priceMatch ? Number(priceMatch[1].replace(/,/g, '')) : null;

  // amount + unit: จับตัวเลขที่มีหน่วยกำกับ (บาท/thb/$/usd/หุ้น/shares)
  var addShares = null, addAmountUSD = null, addAmountTHB = null;
  var mShares = t.match(/([0-9][0-9,]*\.?[0-9]*)\s*(?:หุ้น|shares?|shr)/i);
  var mThb    = t.match(/([0-9][0-9,]*\.?[0-9]*)\s*(?:บาท|thb|฿)/i);
  var mUsd    = t.match(/\$?\s*([0-9][0-9,]*\.?[0-9]*)\s*(?:\$|usd|ดอลลาร์|เหรียญ)/i);

  if (mShares) addShares = Number(mShares[1].replace(/,/g, ''));
  else if (mThb) addAmountTHB = Number(mThb[1].replace(/,/g, ''));
  else if (mUsd) addAmountUSD = Number(mUsd[1].replace(/,/g, ''));

  return {
    raw: t, symbol: symbol, portfolio: port, price: price,
    addShares: addShares, addAmountUSD: addAmountUSD, addAmountTHB: addAmountTHB
  };
}

/* ---------- Build message + handle command ---------- */

function handleAverageDownCommandV1_(text) {
  var p = parseAverageDownCommandV1_(text);
  if (!p) return null; // ไม่ใช่คำสั่งถัวต้นทุน

  if (!p.symbol) return 'บอกชื่อหุ้นที่จะถัวด้วยครับ เช่น "ถัว NVDA เพิ่ม 5000 บาท ที่ 120"';
  if (!p.price)  return 'บอกราคาที่จะซื้อเพิ่มด้วยครับ เช่น "...ที่ 120" หรือ "@120"';

  // แปลงบาท -> USD ถ้าจำเป็น
  var fx = null;
  if (p.addAmountTHB != null && p.addAmountUSD == null && p.addShares == null) {
    fx = getUsdThbRateV1_();
    p.addAmountUSD = p.addAmountTHB / fx;
  }
  if (p.addShares == null && p.addAmountUSD == null) {
    return 'บอกจำนวนที่จะเติมด้วยครับ เช่น "5000 บาท", "100$" หรือ "10 หุ้น"';
  }

  // หา holding
  var matches = findHoldingV1_(p.symbol, p.portfolio);
  var current, note = '';
  if (matches.length === 0) {
    // ยังไม่มีในพอร์ต -> ถือว่าเริ่มต้นที่ 0 (เป็นการซื้อครั้งแรก)
    current = { shares: 0, avgCost: 0, portfolio: p.portfolio || '-' };
    note = '\n(หมายเหตุ: ' + p.symbol + ' ยังไม่มีในพอร์ต — คิดเป็นการซื้อครั้งแรก)';
  } else if (matches.length > 1) {
    var ports = matches.map(function (h) { return h.portfolio; }).join(', ');
    return p.symbol + ' มีอยู่หลายพอร์ต (' + ports + ')\nระบุพอร์ตด้วยครับ เช่น "...พอร์ต Dime"';
  } else {
    current = matches[0];
  }

  var calc = computeAverageDownV1_(current, {
    price: p.price, addShares: p.addShares, addAmountUSD: p.addAmountUSD
  });

  var msg = '';
  msg += '📊 ถัวต้นทุน ' + p.symbol + (current.portfolio && current.portfolio !== '-' ? ' [' + current.portfolio + ']' : '') + '\n';
  msg += '──────────────\n';
  msg += 'เดิม: ' + roundV1_(calc.oldShares, 6) + ' หุ้น @ $' + roundV1_(calc.oldAvgCost, 4) + '\n';
  msg += 'ซื้อเพิ่ม: ' + roundV1_(calc.addShares, 6) + ' หุ้น @ $' + roundV1_(calc.price, 4);
  if (fx) msg += ' (≈' + roundV1_(p.addAmountTHB, 2) + ' บาท @ FX ' + roundV1_(fx, 4) + ')';
  msg += '\n';
  msg += 'เงินที่ใช้: $' + roundV1_(calc.addAmountUSD, 2) + '\n';
  msg += '──────────────\n';
  msg += '✅ ต้นทุนใหม่: $' + roundV1_(calc.newAvgCost, 4) + '/หุ้น\n';
  msg += 'รวม: ' + roundV1_(calc.newShares, 6) + ' หุ้น | ต้นทุนรวม $' + roundV1_(calc.newTotalCost, 2) + '\n';
  var dir = calc.avgCostDelta <= 0 ? '↓ ลดลง' : '↑ เพิ่มขึ้น';
  msg += 'ต้นทุนเฉลี่ย ' + dir + ' $' + roundV1_(Math.abs(calc.avgCostDelta), 4) + '/หุ้น' + note;
  msg += '\n\n(ข้อมูลประกอบการตัดสินใจ ไม่ใช่คำแนะนำการลงทุน)';
  msg += '\nพิมพ์ "บันทึกถัว ' + p.symbol + (current.portfolio && current.portfolio !== '-' ? ' ' + current.portfolio : '') + '" เพื่อบันทึกลงพอร์ต';

  return msg;
}


/* ---------- Save average-down to sheet (WRITE) ---------- */

function saveAverageDownV1_(args) {
  var addAmountUSD = args.addAmountUSD != null ? Number(args.addAmountUSD) : null;
  if (addAmountUSD == null && args.addAmountTHB != null) {
    addAmountUSD = Number(args.addAmountTHB) / getUsdThbRateV1_();
  }
  var matches = findHoldingV1_(args.symbol, args.portfolio);
  if (matches.length > 1) {
    return { ok: false, error: 'มีหลายพอร์ต ระบุพอร์ตด้วย', portfolios: matches.map(function (h) { return h.portfolio; }) };
  }

  var sh = getHoldingsSheetV1_();
  var now = new Date();
  var sym = String(args.symbol).toUpperCase();

  if (matches.length === 0) {
    // เพิ่มแถวใหม่ (ซื้อครั้งแรก)
    var addShares0 = args.addShares != null ? Number(args.addShares) : (addAmountUSD / Number(args.price));
    var totalCost0 = addShares0 * Number(args.price);
    sh.appendRow([sym, args.portfolio || '-', addShares0, Number(args.price), roundV1_(totalCost0, 2), now]);
    return { ok: true, created: true, symbol: sym, shares: addShares0, avgCost: Number(args.price), totalCost: roundV1_(totalCost0, 2) };
  }

  var cur = matches[0];
  var calc = computeAverageDownV1_(cur, {
    price: Number(args.price),
    addShares: args.addShares != null ? Number(args.addShares) : null,
    addAmountUSD: addAmountUSD
  });
  sh.getRange(cur.row, 3).setValue(roundV1_(calc.newShares, 7));      // Shares
  sh.getRange(cur.row, 4).setValue(roundV1_(calc.newAvgCost, 4));     // AvgCostUSD
  sh.getRange(cur.row, 5).setValue(roundV1_(calc.newTotalCost, 2));   // TotalCostUSD
  sh.getRange(cur.row, 6).setValue(now);                             // LastUpdated
  return {
    ok: true, updated: true, symbol: sym, portfolio: cur.portfolio,
    newShares: roundV1_(calc.newShares, 7), newAvgCost: roundV1_(calc.newAvgCost, 4), newTotalCost: roundV1_(calc.newTotalCost, 2)
  };
}

/* ---------- Handle confirm "บันทึกถัว SYMBOL [PORT] ..." ---------- */
// ผู้ใช้ต้องพิมพ์คำสั่งถัวซ้ำพร้อมคำว่า "บันทึกถัว" เพื่อยืนยัน
function handleSaveAverageDownReplyV1_(text) {
  if (!/บันทึกถัว|ยืนยันถัว|save.*avg/i.test(String(text))) return null;
  // parse เหมือนคำสั่งถัวปกติ (ต้องมีเลขราคา/จำนวนครบ)
  var p = parseAverageDownCommandV1_(text.replace(/บันทึกถัว|ยืนยันถัว/gi, 'ถัว'));
  if (!p || !p.symbol || !p.price) {
    return 'ยืนยันแบบเต็มด้วยครับ เช่น "บันทึกถัว NVDA Dime 5000 บาท ที่ 190"';
  }
  var r = saveAverageDownV1_({
    symbol: p.symbol, portfolio: p.portfolio, price: p.price,
    addShares: p.addShares, addAmountUSD: p.addAmountUSD, addAmountTHB: p.addAmountTHB
  });
  if (!r.ok) {
    if (r.portfolios) return p.symbol + ' มีหลายพอร์ต (' + r.portfolios.join(', ') + ') ระบุพอร์ตด้วยครับ';
    return '❌ บันทึกไม่สำเร็จ: ' + (r.error || 'unknown');
  }
  if (r.created) {
    var msgC = '✅ บันทึกลงพอร์ตแล้ว (สร้างใหม่)\n' + r.symbol +
      ': ' + roundV1_(r.shares, 6) + ' หุ้น @ $' + roundV1_(r.avgCost, 4) + '\n\n' +
      buildPortfolioSummaryV1_(r.portfolio) +
      '\n\n(ข้อมูลประกอบการตัดสินใจ ไม่ใช่คำแนะนำการลงทุน)';
    return msgC;
  }
  var msgU = '✅ บันทึกลงพอร์ตแล้ว\n' + r.symbol + ' พอร์ต ' + r.portfolio + '\n' +
    'ต้นทุนเฉลี่ยใหม่ $' + r.newAvgCost + ' | ' + r.newShares + ' หุ้น | รวม $' + r.newTotalCost + '\n\n' +
    buildPortfolioSummaryV1_(r.portfolio) +
    '\n\n(ข้อมูลประกอบการตัดสินใจ ไม่ใช่คำแนะนำการลงทุน)';
  return msgU;
}


// ============================================================
// Option B: Portfolio summary (appended after a save)
// Option C: Set cost directly (sync with broker) + confirm
// ============================================================

function buildPortfolioSummaryV1_(portfolio) {
  var all = getAllHoldingsV1_();
  if (portfolio) {
    var p = String(portfolio).trim().toLowerCase();
    all = all.filter(function(h){ return String(h.portfolio).toLowerCase() === p; });
  }
  if (!all.length) return 'ไม่พบข้อมูลพอร์ต' + (portfolio ? (' ' + portfolio) : '');
  // group by portfolio
  var groups = {};
  all.forEach(function(h){
    var key = h.portfolio || '-';
    if (!groups[key]) groups[key] = [];
    groups[key].push(h);
  });
  var out = [];
  Object.keys(groups).forEach(function(key){
    var rows = groups[key];
    var sumCost = 0;
    var lines = rows.map(function(h){
      sumCost += Number(h.totalCost) || 0;
      return '  ' + h.symbol +
        ': ' + roundV1_(h.shares, 6) + ' หุ้น' +
        ' @ $' + roundV1_(h.avgCost, 4) +
        ' = $' + roundV1_(h.totalCost, 2);
    });
    out.push('📊 พอร์ต ' + key + ' (' + rows.length + ' ตัว, ต้นทุนรวม $' + roundV1_(sumCost, 2) + ')');
    out.push(lines.join('\n'));
  });
  return out.join('\n');
}

// Parse: 'ตั้งต้นทุน NVDA = 185 จำนวน 1.5 หุ้น Dime'  (also supports 'set cost')
function parseSetCostCommandV1_(text) {
  if (!text) return null;
  var t = String(text).trim();
  var low = t.toLowerCase();
  var isSet = /ตั้งต้นทุน|set\s*cost/i.test(low);
  if (!isSet) return null;
  // symbol
  // symbol: first standalone ticker that is NOT a portfolio keyword
  var PORT_WORDS_V1 = { ETF:1, DIME:1, HUNDRED:1, SET:1, COST:1, SHARES:1, SHARE:1, SHR:1, CONFIRM:1, USD:1, THB:1, PORT:1, FOLIO:1 };
  var allTickers = (t.match(/\b[A-Za-z]{1,6}\b/g) || []).map(function(x){ return x.toUpperCase(); });
  var symbol = null;
  for (var _i = 0; _i < allTickers.length; _i++) {
    if (!PORT_WORDS_V1[allTickers[_i]]) { symbol = allTickers[_i]; break; }
  }
  // avg cost (after = or 'ที่')
  var costMatch = t.match(/(?:=|เท่ากับ|ที่)\s*\$?\s*([0-9][0-9,\.]*)/);
  var avgCost = costMatch ? Number(costMatch[1].replace(/,/g,'')) : null;
  // shares (จำนวน ... หุ้น | shares)
  var shMatch = t.match(/(?:จำนวน|shares?)\s*([0-9][0-9,\.]*)/i) || t.match(/([0-9][0-9,\.]*)\s*(?:หุ้น|shares?)/i);
  var shares = shMatch ? Number(shMatch[1].replace(/,/g,'')) : null;
  // portfolio
  var port = null;
  var pm = low.match(/(?:port|folio|พอร์ต)?\s*(etf|dime|hundred|ร้อยเด้ง)/i);
  if (pm) {
    var pv = pm[1].toLowerCase();
    if (pv === 'ร้อยเด้ง') pv = 'hundred';
    port = pv === 'hundred' ? 'Hundred' : (pv.charAt(0).toUpperCase() + pv.slice(1));
  }
  if (!symbol || avgCost === null || shares === null) return null;
  return { symbol: symbol, avgCost: avgCost, shares: shares, portfolio: port };
}

// Write a direct cost override to the sheet.
function setCostV1_(args) {
  var sym = String(args.symbol).toUpperCase();
  var matches = findHoldingV1_(sym, args.portfolio);
  if (matches.length === 0) {
    return { ok: false, error: 'notfound' };
  }
  if (matches.length > 1) {
    return { ok: false, error: 'ambiguous', portfolios: matches.map(function(h){ return h.portfolio; }) };
  }
  var cur = matches[0];
  var sh = getHoldingsSheetV1_();
  var now = new Date();
  var totalCost = Number(args.shares) * Number(args.avgCost);
  sh.getRange(cur.row, 3).setValue(roundV1_(Number(args.shares), 7));   // Shares
  sh.getRange(cur.row, 4).setValue(roundV1_(Number(args.avgCost), 4));  // AvgCostUSD
  sh.getRange(cur.row, 5).setValue(roundV1_(totalCost, 2));             // TotalCostUSD
  sh.getRange(cur.row, 6).setValue(now);                                // LastUpdated
  return {
    ok: true, symbol: sym, portfolio: cur.portfolio,
    shares: roundV1_(Number(args.shares), 7),
    avgCost: roundV1_(Number(args.avgCost), 4),
    totalCost: roundV1_(totalCost, 2)
  };
}

// Step 1: preview a set-cost command (no write). Returns reply text or null.
function handleSetCostCommandV1_(text) {
  var p = parseSetCostCommandV1_(text);
  if (!p) return null;
  var portLabel = p.portfolio || '(ทุกพอร์ตที่มี ' + p.symbol + ')';
  var matches = findHoldingV1_(p.symbol, p.portfolio);
  if (matches.length === 0) {
    return 'ไม่พบ ' + p.symbol + ' ในพอร์ต ' + portLabel + ' นะครับ';
  }
  if (matches.length > 1 && !p.portfolio) {
    return 'มี ' + p.symbol + ' หลายพอร์ต: ' + matches.map(function(h){return h.portfolio;}).join(', ') + '\nโปรดระบุพอร์ตด้วยครับ';
  }
  var tgt = matches[0];
  var totalCost = p.shares * p.avgCost;
  var msg = '📝 ตั้งต้นทุนใหม่ (ยืนยันก่อนบันทึก)\n';
  msg += p.symbol + ' พอร์ต ' + tgt.portfolio + '\n';
  msg += '• เดิม: ' + roundV1_(tgt.shares,6) + ' หุ้น @ $' + roundV1_(tgt.avgCost,4) + '\n';
  msg += '• ใหม่: ' + roundV1_(p.shares,6) + ' หุ้น @ $' + roundV1_(p.avgCost,4) + ' = $' + roundV1_(totalCost,2) + '\n\n';
  msg += 'พิมพ์ "ยืนยันตั้งต้นทุน ' + p.symbol + ' ' + tgt.portfolio + '" เพื่อบันทึก\n';
  msg += '\n(ข้อมูลประกอบการตัดสินใจ ไม่ใช่คำแนะนำการลงทุน)';
  return msg;
}

// Step 2: confirm 'ยืนยันตั้งต้นทุน SYMBOL PORT ...' -> write + summary. Returns reply text or null.
function handleSetCostReplyV1_(text) {
  if (!/ยืนยันตั้งต้นทุน|confirm\s*set\s*cost/i.test(String(text))) return null;
  var p = parseSetCostCommandV1_(String(text).replace(/ยืนยัน/gi, 'ตั้งต้นทุน').replace(/confirm/gi, 'set cost'));
  if (!p) return 'รูปแบบไม่ถูกต้อง ตัวอย่าง: ยืนยันตั้งต้นทุน NVDA Dime = 185 จำนวน 1.5 หุ้น';
  var r = setCostV1_({ symbol: p.symbol, portfolio: p.portfolio, avgCost: p.avgCost, shares: p.shares });
  if (!r.ok) {
    if (r.error === 'ambiguous') return 'มีหลายพอร์ต: ' + r.portfolios.join(', ') + ' โปรดระบุพอร์ต';
    return 'ไม่พบ ' + p.symbol + ' ในพอร์ต';
  }
  var reply = '✅ ตั้งต้นทุนแล้ว: ' + r.symbol + ' พอร์ต ' + r.portfolio + '\n';
  reply += r.shares + ' หุ้น @ $' + r.avgCost + ' = $' + r.totalCost + '\n\n';
  reply += buildPortfolioSummaryV1_(r.portfolio);
  reply += '\n\n(ข้อมูลประกอบการตัดสินใจ ไม่ใช่คำแนะนำการลงทุน)';
  return reply;
}




// Read-only: 'สรุปพอร์ต' or 'สรุปพอร์ต Dime' -> summary text (no write, no confirm).
function handlePortfolioSummaryCommandV1_(text) {
  if (!text) return null;
  var t = String(text).trim();
  var low = t.toLowerCase();
  var isCmd = /สรุปพอร์ต|สรุปพอร์ท|portfolio\s*summary|my\s*portfolio/i.test(low);
  if (!isCmd) return null;
  // optional portfolio filter
  var port = null;
  var pm = low.match(/(etf|dime|hundred|ร้อยเด้ง)/i);
  if (pm) {
    var pv = pm[1].toLowerCase();
    if (pv === 'ร้อยเด้ง') pv = 'hundred';
    port = (pv === 'hundred') ? 'Hundred' : (pv.charAt(0).toUpperCase() + pv.slice(1));
  }
  var summary = buildPortfolioSummaryV1_(port);
  return summary + '\n\n(ข้อมูลประกอบการตัดสินใจ ไม่ใช่คำแนะนำการลงทุน)';
}



