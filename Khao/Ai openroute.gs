/*
 * Stockify Buy Alert Engine V10.2 Confirm Flow + OpenRouter
 * Alerts.gs
 * - Google Sheet BuyAlerts DB
 * - LINE personal push alert when price reaches buy-entry legs
 * - Repeating alert until user confirms purchased leg
 * - Provider stack: Yahoo intraday -> Twelve Data quote -> Finnhub quote -> existing technical fallback
 * - Optional OpenRouter decision layer via OPENROUTER_API_KEY
 *
 * Required Script Properties:
 * LINE_TOKEN, LINE_USER_ID
 * Optional Script Properties:
 * TWELVE_DATA_API_KEY, FINNHUB_API_KEY, OPENROUTER_API_KEY, OPENROUTER_MODEL
 */

const BUY_ALERT_VERSION_V1000 = '10.2-buy-alert-openrouter-confirm-flow';
const BUY_ALERT_PENDING_PROP_V1010 = 'BUY_ALERT_PENDING_CONFIRM_V1010';
const BUY_ALERT_TAB_NAME_V1000 = 'BuyAlerts';
const BUY_ALERT_SHEET_PROP_V1000 = 'BUY_ALERT_SHEET_ID';
const BUY_ALERT_DEFAULT_REPEAT_MIN_V1000 = 30;

const BUY_ALERT_HEADERS_V1000 = [
  'Active', 'Symbol', 'Name', 'Market', 'Currency',
  'Entry1', 'Entry2', 'Entry3',
  'Amount1', 'Amount2', 'Amount3',
  'RepeatMinutes',
  'LastAlert1', 'LastAlert2', 'LastAlert3',
  'Fired1', 'Fired2', 'Fired3',
  'Skipped1', 'Skipped2', 'Skipped3',
  'Bought1', 'Bought2', 'Bought3',
  'LastPrice', 'LastChecked', 'Provider',
  'AI_Decision', 'AI_Score', 'AI_Note',
  'Status', 'CreatedAt', 'UpdatedAt'
];

function setupBuyAlertSheetV1000() {
  const ss = getOrCreateBuyAlertSpreadsheetV1000_();
  let sh = ss.getSheetByName(BUY_ALERT_TAB_NAME_V1000);
  if (!sh) sh = ss.insertSheet(BUY_ALERT_TAB_NAME_V1000);

  const lastRow = sh.getLastRow();
  if (lastRow === 0) {
    sh.getRange(1, 1, 1, BUY_ALERT_HEADERS_V1000.length).setValues([BUY_ALERT_HEADERS_V1000]);
  } else {
    const firstRow = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), BUY_ALERT_HEADERS_V1000.length)).getValues()[0];
    const hasSymbol = firstRow.indexOf('Symbol') >= 0;
    if (!hasSymbol) {
      sh.clearContents();
      sh.getRange(1, 1, 1, BUY_ALERT_HEADERS_V1000.length).setValues([BUY_ALERT_HEADERS_V1000]);
    } else {
      ensureBuyAlertHeadersV1000_(sh);
    }
  }

  sh.setFrozenRows(1);
  sh.autoResizeColumns(1, BUY_ALERT_HEADERS_V1000.length);
  PropertiesService.getScriptProperties().setProperty(BUY_ALERT_SHEET_PROP_V1000, ss.getId());
  return '✅ setup BuyAlerts สำเร็จ\nSheet ID: ' + ss.getId() + '\nTab: ' + BUY_ALERT_TAB_NAME_V1000;
}

function getOrCreateBuyAlertSpreadsheetV1000_() {
  const props = PropertiesService.getScriptProperties();
  const existingBuyId = props.getProperty(BUY_ALERT_SHEET_PROP_V1000);
  if (existingBuyId) {
    try { return SpreadsheetApp.openById(existingBuyId); } catch (e) {}
  }

  // Prefer the existing Watchlist DB so all bot data stays in one file.
  const watchlistId = props.getProperty('WATCHLIST_SHEET_ID');
  if (watchlistId) {
    try {
      props.setProperty(BUY_ALERT_SHEET_PROP_V1000, watchlistId);
      return SpreadsheetApp.openById(watchlistId);
    } catch (e) {}
  }

  const ss = SpreadsheetApp.create('Stockify Buy Alerts DB');
  props.setProperty(BUY_ALERT_SHEET_PROP_V1000, ss.getId());
  return ss;
}

function getBuyAlertSheetV1000_() {
  const ss = getOrCreateBuyAlertSpreadsheetV1000_();
  let sh = ss.getSheetByName(BUY_ALERT_TAB_NAME_V1000);
  if (!sh) {
    sh = ss.insertSheet(BUY_ALERT_TAB_NAME_V1000);
    sh.getRange(1, 1, 1, BUY_ALERT_HEADERS_V1000.length).setValues([BUY_ALERT_HEADERS_V1000]);
    sh.setFrozenRows(1);
  }
  ensureBuyAlertHeadersV1000_(sh);
  return sh;
}

function ensureBuyAlertHeadersV1000_(sh) {
  const currentLastCol = Math.max(sh.getLastColumn(), BUY_ALERT_HEADERS_V1000.length);
  const header = sh.getRange(1, 1, 1, currentLastCol).getValues()[0];
  const existing = {};
  header.forEach(function(h, idx) {
    const key = String(h || '').trim();
    if (key) existing[key] = idx + 1;
  });

  let col = currentLastCol;
  BUY_ALERT_HEADERS_V1000.forEach(function(h) {
    if (!existing[h]) {
      col += 1;
      sh.getRange(1, col).setValue(h);
      existing[h] = col;
    }
  });
}

function headerMapBuyAlertV1000_(sh) {
  const header = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const map = {};
  header.forEach(function(h, idx) {
    const key = String(h || '').trim();
    if (key) map[key] = idx + 1;
  });
  return map;
}

function handleBuyAlertCommandV1000_(textRaw, replyToken) {
  const raw = String(textRaw || '').trim();
  const lower = raw.toLowerCase();
  if (!raw) return false;

  // V10.1: handle short replies after bot asks, e.g. ซื้อแล้ว / ยืนยัน / ยังไม่ซื้อ
  if (handlePendingBuyAlertReplyV1010_(raw, replyToken)) return true;

  if (/^(setupalert|setupalerts|setup buyalerts)$/i.test(raw)) {
    replyLine(replyToken, setupBuyAlertSheetV1000());
    return true;
  }

  if (/^(alert|alerts|buyalert|buyalerts|แจ้งเตือน|รายการแจ้งเตือน)$/i.test(raw)) {
    replyLine(replyToken, buildBuyAlertSummaryV1000_());
    return true;
  }

  if (/^(checkalert|checkalerts|เช็คalert|เช็กalert|ตรวจalert|ตรวจแจ้งเตือน)$/i.test(raw)) {
    replyLine(replyToken, '⏳ รับคำสั่งแล้ว: กำลังตรวจ Buy Alerts ทันที');
    enqueueTaskV748_({ type: 'CHECK_BUY_ALERTS', manual: true, createdAt: new Date().toISOString() });
    return true;
  }

  const setParsed = parseSetAlertCommandV1000_(raw);
  if (setParsed) {
    try {
      const msg = appendOrUpdateBuyAlertV1000_(setParsed);
      replyLine(replyToken, msg);
    } catch (err) {
      replyLine(replyToken, '❌ setalert ไม่สำเร็จ: ' + err.message + '\nตัวอย่าง: setalert ASTS 110 105 98 500 700 800 r=30');
    }
    return true;
  }

  const pauseMatch = raw.match(/^(?:pausealert|หยุดalert|ปิดalert)\s+([A-Za-z0-9.\-]{1,16})$/i);
  if (pauseMatch) {
    replyLine(replyToken, setBuyAlertActiveV1000_(pauseMatch[1], false));
    return true;
  }

  const resumeMatch = raw.match(/^(?:resumealert|เปิดalert)\s+([A-Za-z0-9.\-]{1,16})$/i);
  if (resumeMatch) {
    replyLine(replyToken, setBuyAlertActiveV1000_(resumeMatch[1], true));
    return true;
  }

  const delMatch = raw.match(/^(?:delalert|deletealert|ลบalert)\s+([A-Za-z0-9.\-]{1,16})$/i);
  if (delMatch) {
    replyLine(replyToken, deleteBuyAlertV1000_(delMatch[1]));
    return true;
  }

  const resetMatch = raw.match(/^(?:resetalert|รีเซ็ตalert)\s+([A-Za-z0-9.\-]{1,16})$/i);
  if (resetMatch) {
    replyLine(replyToken, resetBuyAlertFiredV1000_(resetMatch[1]));
    return true;
  }

  const boughtParsed = parseBuyDoneCommandV1000_(raw) || parseNaturalBuyDoneCommandV1010_(raw);
  if (boughtParsed) {
    replyLine(replyToken, createBuyDoneConfirmPromptV1010_(boughtParsed.symbol, boughtParsed.legs, 'MANUAL_TEXT'));
    return true;
  }

  const skipParsed = parseNaturalSkipLegCommandV1010_(raw);
  if (skipParsed) {
    replyLine(replyToken, createSkipLegConfirmPromptV1010_(skipParsed.symbol, skipParsed.legs, 'MANUAL_TEXT'));
    return true;
  }

  const aiMatch = raw.match(/^(?:ai|decision|วิเคราะห์ai|ตัดสินใจ)\s+([A-Za-z0-9.\-]{1,16})$/i);
  if (aiMatch) {
    const symbol = sanitizeAlertSymbolV1000_(aiMatch[1]);
    replyLine(replyToken, '⏳ รับคำสั่งแล้ว: ให้ AI วิเคราะห์ ' + symbol + ' จากราคา/เทคนิค/ข่าว/API');
    enqueueTaskV748_({ type: 'AI_SYMBOL', symbol: symbol, createdAt: new Date().toISOString() });
    return true;
  }

  const autoMatch = raw.match(/^(?:autoalert|planalert|สร้างalert|วางalert)\s+([A-Za-z0-9.\-]{1,16})$/i);
  if (autoMatch) {
    const symbol2 = sanitizeAlertSymbolV1000_(autoMatch[1]);
    replyLine(replyToken, '⏳ รับคำสั่งแล้ว: สร้าง Buy Alert อัตโนมัติจากแผน 3 ไม้ของ ' + symbol2);
    enqueueTaskV748_({ type: 'AUTO_ALERT', symbol: symbol2, createdAt: new Date().toISOString() });
    return true;
  }

  return false;
}

function parseSetAlertCommandV1000_(raw) {
  const txt = String(raw || '').trim();
  const m = txt.match(/^(?:setalert|ตั้งalert|เพิ่มalert)\s+(.+)$/i);
  if (!m) return null;

  const parts = m[1].split(/\s+/).filter(Boolean);
  if (parts.length < 2) throw new Error('ต้องระบุ symbol และราคาอย่างน้อย 1 ไม้');

  const symbol = sanitizeAlertSymbolV1000_(parts.shift());
  let repeatMinutes = BUY_ALERT_DEFAULT_REPEAT_MIN_V1000;
  const nums = [];

  parts.forEach(function(p) {
    const r = String(p).match(/^r(?:epeat)?=(\d+)$/i);
    if (r) {
      repeatMinutes = Math.max(5, Number(r[1]));
      return;
    }
    const n = Number(String(p).replace(/,/g, ''));
    if (isFinite(n)) nums.push(n);
  });

  if (!symbol) throw new Error('symbol ไม่ถูกต้อง');
  if (nums.length < 1) throw new Error('ต้องใส่ราคา Entry อย่างน้อย 1 ค่า');

  const entries = nums.slice(0, 3).filter(function(x) { return isFinite(x) && x > 0; });
  if (!entries.length) throw new Error('ราคา Entry ต้องมากกว่า 0');
  for (let i = 1; i < entries.length; i++) {
    if (entries[i] > entries[i - 1]) {
      throw new Error('ราคาไม้ซื้อควรเรียงจากสูงไปต่ำ เช่น 110 105 98');
    }
  }

  const amounts = nums.slice(3, 6).map(function(x) { return isFinite(x) && x > 0 ? x : 0; });
  const cfg = getAlertSymbolConfigV1000_(symbol);
  return {
    symbol: cfg.symbol,
    market: cfg.currency === 'THB' ? 'TH' : 'US',
    currency: cfg.currency || 'USD',
    entries: entries,
    amounts: amounts,
    repeatMinutes: repeatMinutes,
    note: 'Manual setalert'
  };
}

function parseBuyDoneCommandV1000_(raw) {
  const m = String(raw || '').trim().match(/^(?:buydone|donebuy|ซื้อแล้ว|ซื้อแล้วครับ)\s+([A-Za-z0-9.\-]{1,16})(?:\s+(.+))?$/i);
  if (!m) return null;
  const symbol = sanitizeAlertSymbolV1000_(m[1]);
  const legsRaw = String(m[2] || '').trim();
  let legs = [];
  if (!legsRaw || /^(all|ทั้งหมด)$/i.test(legsRaw)) {
    legs = [1, 2, 3];
  } else {
    legs = legsRaw.split(/[\s,]+/).map(function(x) { return Number(x); }).filter(function(x) { return [1, 2, 3].indexOf(x) >= 0; });
  }
  if (!legs.length) legs = [1, 2, 3];
  return { symbol: symbol, legs: legs };
}


/**
 * V10.1 Natural language bought parser.
 * รองรับ:
 * - ซื้อ ASTS ไม้ 1 แล้ว
 * - ASTS ไม้ 1 ซื้อแล้ว
 * - ซื้อแล้ว ASTS 1
 * - buydone ASTS 1 2
 */
function parseNaturalBuyDoneCommandV1010_(raw) {
  const txt = String(raw || '').trim();
  if (!txt) return null;

  let m = txt.match(/^(?:ซื้อ|เข้าซื้อ)\s+([A-Za-z0-9.\-]{1,16})\s*(?:ไม้|leg)?\s*([123])\s*(?:แล้ว|เรียบร้อย)?$/i);
  if (m) return { symbol: sanitizeAlertSymbolV1000_(m[1]), legs: [Number(m[2])] };

  m = txt.match(/^([A-Za-z0-9.\-]{1,16})\s*(?:ไม้|leg)?\s*([123])\s*(?:ซื้อแล้ว|เข้าซื้อแล้ว|done)$/i);
  if (m) return { symbol: sanitizeAlertSymbolV1000_(m[1]), legs: [Number(m[2])] };

  m = txt.match(/^(?:ซื้อแล้ว|เข้าซื้อแล้ว|done)\s+([A-Za-z0-9.\-]{1,16})(?:\s+(?:ไม้|leg)?\s*([123](?:[\s,]+[123])*|all|ทั้งหมด))?$/i);
  if (m) {
    const symbol = sanitizeAlertSymbolV1000_(m[1]);
    const legText = String(m[2] || '').trim();
    return { symbol: symbol, legs: parseLegsTextV1010_(legText) };
  }
  return null;
}

function parseNaturalSkipLegCommandV1010_(raw) {
  const txt = String(raw || '').trim();
  if (!txt) return null;
  let m = txt.match(/^(?:ข้ามไม้|skip)\s+([A-Za-z0-9.\-]{1,16})\s*(?:ไม้|leg)?\s*([123])$/i);
  if (m) return { symbol: sanitizeAlertSymbolV1000_(m[1]), legs: [Number(m[2])] };
  m = txt.match(/^(?:ข้าม|skip)\s+([A-Za-z0-9.\-]{1,16})\s*(?:ไม้|leg)?\s*([123])$/i);
  if (m) return { symbol: sanitizeAlertSymbolV1000_(m[1]), legs: [Number(m[2])] };
  return null;
}

function parseLegsTextV1010_(legText) {
  const s = String(legText || '').trim();
  if (!s || /^(all|ทั้งหมด)$/i.test(s)) return [1, 2, 3];
  const legs = s.split(/[\s,]+/)
    .map(function(x) { return Number(String(x).replace(/[^0-9]/g, '')); })
    .filter(function(x, idx, arr) { return [1,2,3].indexOf(x) >= 0 && arr.indexOf(x) === idx; });
  return legs.length ? legs : [1, 2, 3];
}

function handlePendingBuyAlertReplyV1010_(raw, replyToken) {
  const txt = String(raw || '').trim();
  const lower = txt.toLowerCase();
  const pending = getPendingBuyAlertActionV1010_();
  if (!pending || !pending.symbol || !pending.legs || !pending.legs.length) return false;

  if (isPendingExpiredV1010_(pending)) {
    clearPendingBuyAlertActionV1010_();
    return false;
  }

  const isConfirm = /^(ยืนยัน|confirm|ok|โอเค|ตกลง)$/i.test(txt);
  const isCancel = /^(ยกเลิก|cancel|no|ไม่ใช่|ไม่ยืนยัน)$/i.test(txt);
  const isBought = /^(ซื้อแล้ว|ซื้อแล้วครับ|เข้าซื้อแล้ว|done|bought)$/i.test(txt);
  const isNotBought = /^(ยังไม่ซื้อ|ยังไม่ได้ซื้อ|not yet|no buy|รอก่อน)$/i.test(lower);
  const isSkip = /^(ข้ามไม้|ข้าม|skip)$/i.test(txt);

  if (isCancel) {
    clearPendingBuyAlertActionV1010_();
    replyLine(replyToken, 'ยกเลิกแล้วครับ ยังไม่อัปเดตสถานะซื้อใน Sheet');
    return true;
  }

  if (isNotBought) {
    pending.stage = 'AWAIT_BUY_STATUS';
    pending.updatedAt = new Date().toISOString();
    setPendingBuyAlertActionV1010_(pending);
    replyLine(replyToken, 'รับทราบครับ: ' + pending.symbol + ' ไม้ ' + pending.legs.join(', ') + ' ยังไม่ซื้อ\nระบบจะยังเตือนซ้ำตามรอบ RepeatMinutes ถ้าราคายังอยู่ในโซน');
    return true;
  }

  if (isSkip) {
    replyLine(replyToken, createSkipLegConfirmPromptV1010_(pending.symbol, pending.legs, 'PENDING_REPLY'));
    return true;
  }

  if (isBought) {
    replyLine(replyToken, createBuyDoneConfirmPromptV1010_(pending.symbol, pending.legs, 'PENDING_REPLY'));
    return true;
  }

  if (isConfirm) {
    if (pending.action === 'MARK_BOUGHT') {
      const result = markBuyDoneV1000_(pending.symbol, pending.legs);
      clearPendingBuyAlertActionV1010_();
      replyLine(replyToken, result + '\n\n✅ อัปเดตหลังยืนยันเรียบร้อย');
      return true;
    }
    if (pending.action === 'MARK_SKIPPED') {
      const result2 = markBuySkippedV1010_(pending.symbol, pending.legs);
      clearPendingBuyAlertActionV1010_();
      replyLine(replyToken, result2 + '\n\n✅ อัปเดตหลังยืนยันเรียบร้อย');
      return true;
    }

    // ถ้ายังเป็นคำถามจาก alert ล่าสุด ให้ตีความว่า confirm = ซื้อแล้ว เพื่อให้ใช้ง่าย
    if (pending.stage === 'AWAIT_BUY_STATUS') {
      replyLine(replyToken, createBuyDoneConfirmPromptV1010_(pending.symbol, pending.legs, 'PENDING_CONFIRM_SHORT'));
      return true;
    }
  }

  return false;
}

function createBuyDoneConfirmPromptV1010_(symbol, legs, source) {
  symbol = sanitizeAlertSymbolV1000_(symbol);
  legs = normalizeLegsV1010_(legs);
  setPendingBuyAlertActionV1010_({
    action: 'MARK_BOUGHT',
    stage: 'AWAIT_CONFIRM',
    symbol: symbol,
    legs: legs,
    source: source || 'MANUAL',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString()
  });
  return [
    'ยืนยันบันทึกว่า ' + symbol + ' ไม้ ' + legs.join(', ') + ' ซื้อแล้ว ใช่ไหมครับ?',
    '',
    'ตอบ: ยืนยัน',
    'หรือ: ยกเลิก',
    '',
    'หมายเหตุ: ถ้าตอบยืนยัน ระบบจะอัปเดต Bought ใน Sheet และหยุดเตือนซ้ำเฉพาะไม้นั้น'
  ].join('\n');
}

function createSkipLegConfirmPromptV1010_(symbol, legs, source) {
  symbol = sanitizeAlertSymbolV1000_(symbol);
  legs = normalizeLegsV1010_(legs);
  setPendingBuyAlertActionV1010_({
    action: 'MARK_SKIPPED',
    stage: 'AWAIT_CONFIRM',
    symbol: symbol,
    legs: legs,
    source: source || 'MANUAL',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString()
  });
  return [
    'ยืนยันข้าม ' + symbol + ' ไม้ ' + legs.join(', ') + ' ใช่ไหมครับ?',
    '',
    'ตอบ: ยืนยัน',
    'หรือ: ยกเลิก',
    '',
    'หมายเหตุ: ถ้าข้าม ระบบจะไม่เตือนซ้ำไม้นั้นอีก จนกว่าจะ resetalert'
  ].join('\n');
}

function setPendingAlertFromHitV1010_(symbol, legs) {
  symbol = sanitizeAlertSymbolV1000_(symbol);
  legs = normalizeLegsV1010_(legs);
  if (!symbol || !legs.length) return;
  setPendingBuyAlertActionV1010_({
    action: 'ASK_BUY_STATUS',
    stage: 'AWAIT_BUY_STATUS',
    symbol: symbol,
    legs: legs,
    source: 'ALERT_HIT',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString()
  });
}

function normalizeLegsV1010_(legs) {
  const raw = Array.isArray(legs) ? legs : [legs];
  const out = [];
  raw.forEach(function(x) {
    const leg = typeof x === 'object' && x !== null ? Number(x.leg) : Number(x);
    if ([1,2,3].indexOf(leg) >= 0 && out.indexOf(leg) < 0) out.push(leg);
  });
  return out.length ? out : [1, 2, 3];
}

function setPendingBuyAlertActionV1010_(obj) {
  PropertiesService.getScriptProperties().setProperty(BUY_ALERT_PENDING_PROP_V1010, JSON.stringify(obj || {}));
}

function getPendingBuyAlertActionV1010_() {
  try {
    return JSON.parse(PropertiesService.getScriptProperties().getProperty(BUY_ALERT_PENDING_PROP_V1010) || '{}');
  } catch (e) {
    return {};
  }
}

function clearPendingBuyAlertActionV1010_() {
  PropertiesService.getScriptProperties().deleteProperty(BUY_ALERT_PENDING_PROP_V1010);
}

function isPendingExpiredV1010_(pending) {
  if (!pending || !pending.expiresAt) return false;
  const d = new Date(pending.expiresAt);
  return !isNaN(d.getTime()) && Date.now() > d.getTime();
}

function appendOrUpdateBuyAlertV1000_(p) {
  const sh = getBuyAlertSheetV1000_();
  const map = headerMapBuyAlertV1000_(sh);
  const rowIndex = findBuyAlertRowV1000_(sh, p.symbol, map);
  const now = nowTextV1000_();

  const rowObj = {};
  rowObj.Active = true;
  rowObj.Symbol = p.symbol;
  rowObj.Name = p.name || '';
  rowObj.Market = p.market || (p.currency === 'THB' ? 'TH' : 'US');
  rowObj.Currency = p.currency || 'USD';
  rowObj.Entry1 = p.entries[0] || '';
  rowObj.Entry2 = p.entries[1] || '';
  rowObj.Entry3 = p.entries[2] || '';
  rowObj.Amount1 = p.amounts[0] || '';
  rowObj.Amount2 = p.amounts[1] || '';
  rowObj.Amount3 = p.amounts[2] || '';
  rowObj.RepeatMinutes = p.repeatMinutes || BUY_ALERT_DEFAULT_REPEAT_MIN_V1000;
  rowObj.LastAlert1 = '';
  rowObj.LastAlert2 = '';
  rowObj.LastAlert3 = '';
  rowObj.Fired1 = false;
  rowObj.Fired2 = false;
  rowObj.Fired3 = false;
  rowObj.Skipped1 = false;
  rowObj.Skipped2 = false;
  rowObj.Skipped3 = false;
  rowObj.Bought1 = false;
  rowObj.Bought2 = false;
  rowObj.Bought3 = false;
  rowObj.LastPrice = '';
  rowObj.LastChecked = '';
  rowObj.Provider = '';
  rowObj.AI_Decision = p.aiDecision || '';
  rowObj.AI_Score = p.aiScore || '';
  rowObj.AI_Note = p.aiNote || p.note || '';
  rowObj.Status = 'ACTIVE';
  rowObj.UpdatedAt = now;

  let targetRow = rowIndex;
  if (!targetRow) {
    targetRow = sh.getLastRow() + 1;
    rowObj.CreatedAt = now;
  } else {
    rowObj.CreatedAt = getCellByHeaderV1000_(sh, targetRow, map, 'CreatedAt') || now;
  }

  writeBuyAlertRowObjV1000_(sh, targetRow, map, rowObj);

  const currency = p.currency || 'USD';
  const lines = [
    rowIndex ? '✅ อัปเดต Buy Alert แล้ว' : '✅ เพิ่ม Buy Alert แล้ว',
    'Symbol: ' + p.symbol,
    'ไม้ 1: ' + moneyV748_(p.entries[0], currency),
    p.entries[1] ? 'ไม้ 2: ' + moneyV748_(p.entries[1], currency) : '',
    p.entries[2] ? 'ไม้ 3: ' + moneyV748_(p.entries[2], currency) : '',
    'เตือนซ้ำทุก: ' + rowObj.RepeatMinutes + ' นาที จนกว่าจะยืนยันว่าซื้อแล้ว',
    'ตรวจทันที: checkalert'
  ].filter(Boolean);
  return lines.join('\n');
}

function writeBuyAlertRowObjV1000_(sh, row, map, obj) {
  Object.keys(obj).forEach(function(k) {
    if (map[k]) sh.getRange(row, map[k]).setValue(obj[k]);
  });
}

function getCellByHeaderV1000_(sh, row, map, header) {
  if (!map[header]) return '';
  return sh.getRange(row, map[header]).getValue();
}

function findBuyAlertRowV1000_(sh, symbol, map) {
  symbol = sanitizeAlertSymbolV1000_(symbol);
  if (!symbol || sh.getLastRow() < 2) return 0;
  const col = map.Symbol || 2;
  const values = sh.getRange(2, col, sh.getLastRow() - 1, 1).getValues();
  for (let i = 0; i < values.length; i++) {
    if (sanitizeAlertSymbolV1000_(values[i][0]) === symbol) return i + 2;
  }
  return 0;
}

function buildBuyAlertSummaryV1000_() {
  const sh = getBuyAlertSheetV1000_();
  const map = headerMapBuyAlertV1000_(sh);
  if (sh.getLastRow() < 2) {
    return [
      '🔔 Buy Alerts ว่างอยู่',
      '',
      'เพิ่มด้วยตัวอย่าง:',
      'setalert ASTS 110 105 98 500 700 800 r=30',
      'autoalert ASTS'
    ].join('\n');
  }

  const values = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
  const lines = ['🔔 Buy Alerts v' + BUY_ALERT_VERSION_V1000, ''];
  values.forEach(function(row) {
    const a = rowToBuyAlertObjV1000_(row, map);
    if (!a.Symbol) return;
    const cur = a.Currency || 'USD';
    const active = truthyV1000_(a.Active) ? '🟢 ON' : '⚪ OFF';
    lines.push(active + ' ' + a.Symbol + ' | ล่าสุด ' + (a.LastPrice ? moneyV748_(Number(a.LastPrice), cur) : '-'));
    [1,2,3].forEach(function(i) {
      const e = Number(a['Entry' + i]);
      if (!isFinite(e) || e <= 0) return;
      const status = truthyV1000_(a['Bought' + i]) ? '✅ ซื้อแล้ว' : (truthyV1000_(a['Fired' + i]) ? '🔁 เตือนแล้ว' : '⏳ รอ');
      const amt = Number(a['Amount' + i]);
      lines.push('  ไม้ ' + i + ': ≤' + moneyV748_(e, cur) + (amt > 0 ? ' | เงิน ' + moneyV748_(amt, cur) : '') + ' | ' + status);
    });
    if (a.AI_Decision) lines.push('  AI: ' + a.AI_Decision + (a.AI_Score ? ' ' + a.AI_Score + '/100' : ''));
    lines.push('');
  });
  lines.push('อัปเดตซื้อแล้ว: พิมพ์ เช่น ซื้อ ASTS ไม้ 1 แล้ว → บอทจะถามยืนยันก่อนอัปเดต');
  return lines.join('\n');
}

function rowToBuyAlertObjV1000_(row, map) {
  const obj = {};
  Object.keys(map).forEach(function(k) {
    obj[k] = row[map[k] - 1];
  });
  return obj;
}

function checkBuyAlertsTriggerV1000() {
  checkBuyAlertsNowV1000(false);
}

function checkBuyAlertsNowV1000(manual) {
  manual = manual !== false;
  const sh = getBuyAlertSheetV1000_();
  const map = headerMapBuyAlertV1000_(sh);
  if (sh.getLastRow() < 2) return ['🔔 ยังไม่มี Buy Alert ให้ตรวจ'];

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return ['⚠️ ระบบกำลังตรวจ alert รอบก่อนหน้าอยู่'];

  try {
    const range = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn());
    const values = range.getValues();
    const pushedMessages = [];
    const summary = [];
    let checked = 0;
    let hitCount = 0;

    for (let r = 0; r < values.length; r++) {
      const rowIndex = r + 2;
      const alert = rowToBuyAlertObjV1000_(values[r], map);
      if (!alert.Symbol || !truthyV1000_(alert.Active)) continue;

      const cfg = getAlertSymbolConfigV1000_(alert.Symbol);
      const price = fetchAlertLivePriceV1000_(cfg);
      checked += 1;

      const now = nowTextV1000_();
      setIfHeaderV1000_(sh, rowIndex, map, 'LastChecked', now);
      if (price && price.ok) {
        setIfHeaderV1000_(sh, rowIndex, map, 'LastPrice', price.last);
        setIfHeaderV1000_(sh, rowIndex, map, 'Provider', price.provider || 'unknown');
      } else {
        setIfHeaderV1000_(sh, rowIndex, map, 'Status', 'PRICE_ERROR');
        summary.push('❌ ' + alert.Symbol + ': ดึงราคาไม่ได้ ' + (price && price.error ? price.error : 'unknown'));
        continue;
      }

      const hitLegs = getHitAlertLegsV1000_(alert, price.last);
      const dueLegs = getDueAlertLegsV1000_(alert, hitLegs, now);
      if (!dueLegs.length) {
        summary.push('✅ ' + alert.Symbol + ': ' + moneyV748_(price.last, cfg.currency || alert.Currency) + ' ยังไม่ถึงรอบเตือน');
        continue;
      }

      hitCount += dueLegs.length;
      const ai = buildAlertAiDecisionV1000_(cfg, price, alert, dueLegs);
      setIfHeaderV1000_(sh, rowIndex, map, 'AI_Decision', ai.decision || 'LOCAL');
      setIfHeaderV1000_(sh, rowIndex, map, 'AI_Score', ai.score || '');
      setIfHeaderV1000_(sh, rowIndex, map, 'AI_Note', ai.note || '');
      setIfHeaderV1000_(sh, rowIndex, map, 'Status', 'HIT');

      markAlertTriggeredV1000_(sh, rowIndex, map, dueLegs, now);
      setPendingAlertFromHitV1010_(cfg.symbol, dueLegs.map(function(x) { return x.leg; }));
      const message = buildBuyAlertHitMessageV1000_(cfg, price, alert, dueLegs, ai);
      pushedMessages.push(message);
      summary.push('🚨 ' + alert.Symbol + ': hit ' + dueLegs.map(function(x) { return 'ไม้ ' + x.leg; }).join(', '));
    }

    pushedMessages.forEach(function(msg) { sendLine(msg); });
    if (manual) {
      const head = '🔎 ตรวจ Buy Alerts แล้ว\nเช็ก: ' + checked + ' รายการ | Alert: ' + hitCount + ' ไม้';
      return [head + '\n\n' + (summary.slice(0, 20).join('\n') || 'ไม่มีรายการ active')];
    }
    return pushedMessages;
  } catch (err) {
    Logger.log('checkBuyAlertsNowV1000 error: ' + (err.stack || err));
    return ['❌ ตรวจ Buy Alerts ล้มเหลว: ' + err.message];
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

function getHitAlertLegsV1000_(alert, lastPrice) {
  const out = [];
  const cur = alert.Currency || 'USD';
  [1,2,3].forEach(function(i) {
    const entry = Number(alert['Entry' + i]);
    if (!isFinite(entry) || entry <= 0) return;
    const bought = truthyV1000_(alert['Bought' + i]);
    const skipped = truthyV1000_(alert['Skipped' + i]);
    if (bought || skipped) return;
    if (Number(lastPrice) <= entry) {
      out.push({
        leg: i,
        entry: entry,
        amount: Number(alert['Amount' + i] || 0),
        currency: cur,
        lastAlert: alert['LastAlert' + i]
      });
    }
  });
  return out;
}

function getDueAlertLegsV1000_(alert, hitLegs, nowText) {
  const repeat = Math.max(5, Number(alert.RepeatMinutes || BUY_ALERT_DEFAULT_REPEAT_MIN_V1000));
  return (hitLegs || []).filter(function(x) {
    if (!x.lastAlert) return true;
    return elapsedMinutesV1000_(x.lastAlert, nowText) >= repeat;
  });
}

function markAlertTriggeredV1000_(sh, rowIndex, map, legs, now) {
  (legs || []).forEach(function(x) {
    setIfHeaderV1000_(sh, rowIndex, map, 'Fired' + x.leg, true);
    setIfHeaderV1000_(sh, rowIndex, map, 'LastAlert' + x.leg, now);
  });
  setIfHeaderV1000_(sh, rowIndex, map, 'UpdatedAt', now);
}

function buildBuyAlertHitMessageV1000_(cfg, price, alert, legs, ai) {
  const cur = cfg.currency || alert.Currency || 'USD';
  const lines = [];
  lines.push('🚨 BUY ZONE ALERT: ' + cfg.symbol);
  lines.push('━━━━━━━━━━━━━━━━━━');
  lines.push('ราคา: ' + moneyV748_(price.last, cur) + ' | Provider: ' + (price.provider || '-'));
  if (isFinite(price.changePct)) lines.push('เปลี่ยนแปลง: ' + fmtPctV748_(price.changePct));
  lines.push('');
  lines.push('เข้าเงื่อนไขพร้อมกัน:');
  legs.forEach(function(x) {
    lines.push('✅ ไม้ ' + x.leg + ' ≤ ' + moneyV748_(x.entry, cur) + (x.amount > 0 ? ' | เงิน ' + moneyV748_(x.amount, cur) : ''));
  });
  lines.push('');
  lines.push('🧠 AI Decision: ' + (ai.decision || 'LOCAL') + (ai.score ? ' ' + ai.score + '/100' : ''));
  if (ai.action) lines.push('Action: ' + ai.action);
  if (ai.risk) lines.push('Risk: ' + ai.risk);
  if (ai.note) lines.push('เหตุผล: ' + ai.note);
  lines.push('');
  lines.push('บอทรอคำตอบจากพี่:');
  lines.push('• ซื้อแล้ว = ให้บอทถามยืนยันก่อนอัปเดต');
  lines.push('• ยังไม่ซื้อ = ยังเตือนซ้ำตามรอบ');
  lines.push('• ข้ามไม้ = ให้บอทถามยืนยันก่อนปิดเตือนไม้นั้น');
  lines.push('หรือพิมพ์เจาะจง: ซื้อ ' + cfg.symbol + ' ไม้ ' + legs.map(function(x) { return x.leg; }).join(' ') + ' แล้ว');
  lines.push('⚠️ เป็นสัญญาณช่วยตัดสินใจ ไม่ใช่คำสั่งซื้ออัตโนมัติ');
  return lines.join('\n');
}

function setIfHeaderV1000_(sh, rowIndex, map, header, value) {
  if (map[header]) sh.getRange(rowIndex, map[header]).setValue(value);
}

function setBuyAlertActiveV1000_(symbol, active) {
  const sh = getBuyAlertSheetV1000_();
  const map = headerMapBuyAlertV1000_(sh);
  symbol = sanitizeAlertSymbolV1000_(symbol);
  const row = findBuyAlertRowV1000_(sh, symbol, map);
  if (!row) return '❌ ไม่พบ Buy Alert: ' + symbol;
  setIfHeaderV1000_(sh, row, map, 'Active', !!active);
  setIfHeaderV1000_(sh, row, map, 'Status', active ? 'ACTIVE' : 'PAUSED');
  setIfHeaderV1000_(sh, row, map, 'UpdatedAt', nowTextV1000_());
  return (active ? '✅ เปิด Alert แล้ว: ' : '⏸️ ปิด Alert แล้ว: ') + symbol;
}

function deleteBuyAlertV1000_(symbol) {
  const sh = getBuyAlertSheetV1000_();
  const map = headerMapBuyAlertV1000_(sh);
  symbol = sanitizeAlertSymbolV1000_(symbol);
  const row = findBuyAlertRowV1000_(sh, symbol, map);
  if (!row) return '❌ ไม่พบ Buy Alert: ' + symbol;
  sh.deleteRow(row);
  return '🗑️ ลบ Buy Alert แล้ว: ' + symbol;
}

function resetBuyAlertFiredV1000_(symbol) {
  const sh = getBuyAlertSheetV1000_();
  const map = headerMapBuyAlertV1000_(sh);
  symbol = sanitizeAlertSymbolV1000_(symbol);
  const row = findBuyAlertRowV1000_(sh, symbol, map);
  if (!row) return '❌ ไม่พบ Buy Alert: ' + symbol;
  [1,2,3].forEach(function(i) {
    setIfHeaderV1000_(sh, row, map, 'Fired' + i, false);
    setIfHeaderV1000_(sh, row, map, 'Skipped' + i, false);
    setIfHeaderV1000_(sh, row, map, 'Bought' + i, false);
    setIfHeaderV1000_(sh, row, map, 'LastAlert' + i, '');
  });
  setIfHeaderV1000_(sh, row, map, 'Status', 'ACTIVE');
  setIfHeaderV1000_(sh, row, map, 'UpdatedAt', nowTextV1000_());
  return '🔄 รีเซ็ต Alert แล้ว: ' + symbol;
}

function markBuyDoneV1000_(symbol, legs) {
  const sh = getBuyAlertSheetV1000_();
  const map = headerMapBuyAlertV1000_(sh);
  symbol = sanitizeAlertSymbolV1000_(symbol);
  const row = findBuyAlertRowV1000_(sh, symbol, map);
  if (!row) return '❌ ไม่พบ Buy Alert: ' + symbol;
  const now = nowTextV1000_();
  legs = normalizeLegsV1010_(legs || [1,2,3]);
  legs.forEach(function(i) {
    if ([1,2,3].indexOf(Number(i)) < 0) return;
    setIfHeaderV1000_(sh, row, map, 'Bought' + i, true);
    setIfHeaderV1000_(sh, row, map, 'Skipped' + i, false);
  });
  setIfHeaderV1000_(sh, row, map, 'Status', 'PARTIAL_OR_DONE');
  setIfHeaderV1000_(sh, row, map, 'UpdatedAt', now);
  return '✅ บันทึกซื้อแล้ว: ' + symbol + ' ไม้ ' + legs.join(', ') + '\nระบบจะไม่เตือนซ้ำไม้ที่ซื้อแล้ว';
}

function markBuySkippedV1010_(symbol, legs) {
  const sh = getBuyAlertSheetV1000_();
  const map = headerMapBuyAlertV1000_(sh);
  symbol = sanitizeAlertSymbolV1000_(symbol);
  const row = findBuyAlertRowV1000_(sh, symbol, map);
  if (!row) return '❌ ไม่พบ Buy Alert: ' + symbol;
  const now = nowTextV1000_();
  legs = normalizeLegsV1010_(legs || [1,2,3]);
  legs.forEach(function(i) {
    if ([1,2,3].indexOf(Number(i)) < 0) return;
    setIfHeaderV1000_(sh, row, map, 'Skipped' + i, true);
    setIfHeaderV1000_(sh, row, map, 'Bought' + i, false);
  });
  setIfHeaderV1000_(sh, row, map, 'Status', 'SKIPPED_LEG');
  setIfHeaderV1000_(sh, row, map, 'UpdatedAt', now);
  return '⏭️ บันทึกข้ามไม้แล้ว: ' + symbol + ' ไม้ ' + legs.join(', ') + '\nระบบจะไม่เตือนซ้ำไม้ที่ข้าม จนกว่าจะ resetalert';
}

function setupBuyAlertTriggerV1000() {
  cleanupBuyAlertTriggersV1000_('checkBuyAlertsTriggerV1000');
  ScriptApp.newTrigger('checkBuyAlertsTriggerV1000')
    .timeBased()
    .everyMinutes(5)
    .create();
  sendLine('✅ ตั้ง Trigger ตรวจ Buy Alerts ทุก 5 นาทีแล้ว\nถ้าราคาแตะไม้ซื้อ ระบบจะ push เข้า LINE_USER_ID และรอคำตอบซื้อแล้ว/ยังไม่ซื้อ');
}

function cleanupBuyAlertTriggersV1000_(handlerName) {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction && t.getHandlerFunction() === handlerName) {
      try { ScriptApp.deleteTrigger(t); } catch (e) {}
    }
  });
}

function buildAiDecisionReportV1000_(symbol) {
  symbol = sanitizeAlertSymbolV1000_(symbol);
  const cfg = getAlertSymbolConfigV1000_(symbol);
  const price = fetchAlertLivePriceV1000_(cfg);
  if (!price || !price.ok) return '❌ ดึงราคา ' + symbol + ' ไม่สำเร็จ: ' + (price && price.error ? price.error : 'unknown');

  const ai = buildAlertAiDecisionV1000_(cfg, price, null, []);
  const d = safeFetchTechnicalForAlertV1000_(cfg);
  const lines = [];
  lines.push('🧠 AI Decision — ' + symbol);
  lines.push('━━━━━━━━━━━━━━━━━━');
  lines.push('ราคา: ' + moneyV748_(price.last, cfg.currency) + ' | Provider: ' + price.provider);
  if (d && d.ok) {
    lines.push('RSI: ' + fmtNumV748_(d.rsi, 1) + ' | MACD Hist: ' + fmtNumV748_(d.macdHist, 3));
    lines.push('EMA20/50/200: ' + moneyV748_(d.ema20, cfg.currency) + ' / ' + moneyV748_(d.ema50, cfg.currency) + ' / ' + moneyV748_(d.ema200, cfg.currency));
    lines.push('Volatility: ' + volTextV748_(d.volatility));
  }
  lines.push('');
  lines.push('Decision: ' + (ai.decision || 'LOCAL') + (ai.score ? ' ' + ai.score + '/100' : ''));
  if (ai.action) lines.push('Action: ' + ai.action);
  if (ai.risk) lines.push('Risk: ' + ai.risk);
  if (ai.note) lines.push('เหตุผล: ' + ai.note);
  lines.push('');
  lines.push('สร้าง alert อัตโนมัติ: autoalert ' + symbol);
  return lines.join('\n');
}

function createAutoBuyAlertFromAnalysisV1000_(symbol) {
  symbol = sanitizeAlertSymbolV1000_(symbol);
  const cfg = getAlertSymbolConfigV1000_(symbol);
  const d = safeFetchTechnicalForAlertV1000_(cfg);
  if (!d || !d.ok) return '❌ สร้าง Auto Alert ไม่สำเร็จ: ดึงข้อมูล ' + symbol + ' ไม่ได้';

  const market = (typeof fastMarketSnapshotV930_ === 'function') ? fastMarketSnapshotV930_() : { heat: 45, regime: 'Fast Mode' };
  const decision = buildSymbolDecisionV748_(cfg, d, market, true);
  decision.news = buildNewsGate_(cfg.symbol, getSymbolContextV1000_(cfg.symbol));
  applyBuyTierLogicV753_(decision, d, market);

  let entries = [];
  let amounts = [];
  if (decision.plan && decision.plan.legs && decision.plan.legs.length) {
    entries = decision.plan.legs.map(function(x) { return x.price; });
    amounts = decision.plan.legs.map(function(x) { return x.amount; });
  } else {
    const supports = buildSupportLevelsV773_(d);
    entries = [supports.near, supports.mid, supports.deep].filter(function(x) { return isFinite(x) && x > 0; });
    amounts = ['', '', ''];
  }

  const ai = buildAlertAiDecisionV1000_(cfg, { ok: true, last: d.last, provider: d.provider || 'Technical', changePct: d.changePct }, null, []);
  const msg = appendOrUpdateBuyAlertV1000_({
    symbol: cfg.symbol,
    market: cfg.currency === 'THB' ? 'TH' : 'US',
    currency: cfg.currency || 'USD',
    entries: entries,
    amounts: amounts,
    repeatMinutes: BUY_ALERT_DEFAULT_REPEAT_MIN_V1000,
    aiDecision: ai.decision,
    aiScore: ai.score,
    aiNote: ai.note || (decision.reasons || []).slice(0, 2).join(' / '),
    note: decision.openBuy ? 'Auto from decision plan' : 'Auto watch zone from supports'
  });

  return msg + '\n\n🧠 สถานะจากระบบ: ' + (decision.displayAction || decision.buyTier || 'WAIT') +
    ' | Score ' + decision.score + ' | Signal Score ' + Math.round(decision.signalScore || decision.confidence || 0) + '\n' +
    'เหตุผล: ' + (decision.reasons || []).slice(0, 3).join(' / ');
}

function buildAlertAiDecisionV1000_(cfg, price, alert, hitLegs) {
  const local = buildLocalAiDecisionV1000_(cfg, price, alert, hitLegs);
  const props = PropertiesService.getScriptProperties();
  const apiKey = props.getProperty('OPENROUTER_API_KEY');

  // ถ้าไม่ได้ตั้ง OpenRouter key ระบบยังทำงานได้ด้วย LocalRule
  if (!apiKey) return local;

  const context = buildAiContextV1000_(cfg, price, alert, hitLegs, local);
  const remote = callOpenRouterStockDecisionV1000_(context);
  if (!remote || !remote.ok) {
    local.note = local.note + ' | OpenRouter fallback: ' + (remote && remote.error ? remote.error : 'no response');
    return local;
  }
  return {
    decision: remote.decision || local.decision,
    score: isFinite(Number(remote.score)) ? Number(remote.score) : local.score,
    action: remote.action || local.action,
    risk: remote.risk || local.risk,
    note: remote.note || local.note,
    source: 'OpenRouter'
  };
}

function buildLocalAiDecisionV1000_(cfg, price, alert, hitLegs) {
  const d = safeFetchTechnicalForAlertV1000_(cfg);
  const market = (typeof fastMarketSnapshotV930_ === 'function') ? fastMarketSnapshotV930_() : { heat: 45, regime: 'Fast Mode' };
  let decision = null;
  if (d && d.ok) {
    decision = buildSymbolDecisionV748_(cfg, d, market, true);
    decision.news = buildNewsGate_(cfg.symbol, getSymbolContextV1000_(cfg.symbol));
    applyBuyTierLogicV753_(decision, d, market);
  }

  let score = decision ? Math.max(0, Math.min(100, 50 + Number(decision.score || 0) * 7)) : 50;
  const vol = d && d.ok ? Number(d.volatility || 0) : 0;
  const rsi = d && d.ok ? Number(d.rsi || 50) : 50;
  let label = 'WATCH';
  let action = 'รอข้อมูลยืนยันเพิ่ม';
  let risk = 'กลาง';

  if (decision && decision.locked) {
    label = 'RISK_BLOCK';
    score = Math.min(score, 45);
    action = 'งดซื้อ/รอราคาและ RSI เย็นลง';
    risk = 'สูง';
  } else if (decision && decision.openBuy && hitLegs && hitLegs.length) {
    label = 'BUY_ZONE';
    score = Math.max(score, 60);
    action = 'ซื้อได้ตามไม้ที่แจ้ง แต่ไม่ไล่เกินราคา Entry';
    risk = vol > VOL_HIGH_V800 ? 'สูง' : 'กลาง';
  } else if (hitLegs && hitLegs.length) {
    label = vol > VOL_HIGH_V800 || rsi >= RSI_HOT_V820 ? 'SMALL_BUY_ONLY' : 'BUY_ZONE_CAUTION';
    score = Math.max(score, 55);
    action = 'เข้าไม้เล็ก/รอแท่งยืนยัน ถ้าข่าวไม่เสีย';
    risk = vol > VOL_HIGH_V800 ? 'สูง' : 'กลาง';
  } else if (decision && decision.openBuy) {
    label = 'READY_WAIT_ENTRY';
    action = 'พื้นฐานเทคนิคผ่าน รอราคาแตะไม้ซื้อ';
  } else {
    label = 'WAIT';
    action = 'ยังไม่ควรรีบซื้อ รอเข้าโซนหรือสัญญาณชัดกว่า';
  }

  const reasons = decision && decision.reasons ? decision.reasons.slice(0, 3).join(' / ') : 'ใช้ราคาและ technical fallback';
  return {
    decision: label,
    score: Math.round(score),
    action: action,
    risk: risk,
    note: reasons,
    source: 'LocalRule'
  };
}

function buildAiContextV1000_(cfg, price, alert, hitLegs, local) {
  const d = safeFetchTechnicalForAlertV1000_(cfg);
  const news = buildNewsGate_(cfg.symbol, getSymbolContextV1000_(cfg.symbol));
  const ctx = {
    symbol: cfg.symbol,
    market: cfg.currency === 'THB' ? 'TH' : 'US',
    currency: cfg.currency || 'USD',
    latest_price: price && price.last,
    price_provider: price && price.provider,
    change_pct: price && price.changePct,
    alert_entries_hit: (hitLegs || []).map(function(x) { return { leg: x.leg, entry: x.entry, amount: x.amount }; }),
    technical: d && d.ok ? {
      last: d.last,
      rsi: d.rsi,
      macd_hist: d.macdHist,
      ema20: d.ema20,
      ema50: d.ema50,
      ema200: d.ema200,
      support: d.support,
      resistance: d.resistance,
      volatility: d.volatility,
      provider: d.provider
    } : null,
    news: news ? {
      status: news.status,
      gatePass: news.gatePass,
      score: news.score,
      headline: news.headline,
      error: news.error
    } : null,
    local_rule_decision: local,
    instruction: 'Return compact Thai decision for LINE stock buy alert. Do not guarantee profit. Decide BUY_ZONE, SMALL_BUY_ONLY, WAIT, or RISK_BLOCK.'
  };
  return ctx;
}

function callOpenRouterStockDecisionV1000_(context) {
  try {
    const props = PropertiesService.getScriptProperties();
    const apiKey = props.getProperty('OPENROUTER_API_KEY');
    if (!apiKey) return { ok: false, error: 'Missing OPENROUTER_API_KEY' };

    // แนะนำ: openrouter/auto ใช้งานง่ายที่สุด ถ้าต้องการคุมโมเดลให้ใส่ OPENROUTER_MODEL เช่น openai/gpt-4.1-mini
    const model = props.getProperty('OPENROUTER_MODEL') || 'openrouter/auto';

    const payload = {
      model: model,
      messages: [
        {
          role: 'system',
          content: [
            'You are a disciplined stock buy-alert decision assistant.',
            'Use only the provided data. Do not invent prices, news, or broker actions.',
            'Return JSON only with keys: decision, score, action, risk, note.',
            'Language: Thai.',
            'decision must be one of BUY_ZONE, SMALL_BUY_ONLY, READY_WAIT_ENTRY, WAIT, RISK_BLOCK.',
            'score is 0-100.',
            'Do not guarantee profit and do not say this is an automatic buy order.'
          ].join(' ')
        },
        {
          role: 'user',
          content: JSON.stringify(context)
        }
      ],
      temperature: 0.2,
      max_tokens: 500
    };

    const headers = {
      Authorization: 'Bearer ' + apiKey,
      'HTTP-Referer': 'https://script.google.com',
      'X-Title': 'Stockify LINE Buy Alert Bot'
    };

    const res = UrlFetchApp.fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'post',
      contentType: 'application/json',
      headers: headers,
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });

    const code = res.getResponseCode();
    const body = res.getContentText();
    if (code < 200 || code >= 300) {
      return { ok: false, error: 'OpenRouter HTTP ' + code + ': ' + body.slice(0, 220) };
    }

    const json = JSON.parse(body || '{}');
    const text = extractOpenRouterOutputTextV1000_(json);
    const parsed = safeJsonParseV1000_(text);
    if (!parsed) return { ok: false, error: 'OpenRouter JSON parse failed: ' + String(text || '').slice(0, 220) };

    parsed.ok = true;
    parsed.model = model;
    return parsed;
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

function extractOpenRouterOutputTextV1000_(json) {
  if (!json) return '';

  // OpenRouter Chat Completions format
  if (json.choices && json.choices.length) {
    const msg = json.choices[0].message || {};
    const content = msg.content;
    if (typeof content === 'string') return content.trim();
    if (Array.isArray(content)) {
      return content.map(function(part) {
        if (typeof part === 'string') return part;
        if (part && part.text) return part.text;
        if (part && part.type === 'text' && part.text) return part.text;
        return '';
      }).join('\n').trim();
    }
  }

  // Fallback for OpenAI Responses-like output if provider returns normalized text
  if (json.output_text) return String(json.output_text).trim();
  if (json.error) return JSON.stringify(json.error);
  return JSON.stringify(json).slice(0, 1000);
}

function safeJsonParseV1000_(text) {
  try { return JSON.parse(text); } catch (e) {}
  const m = String(text || '').match(/\{[\s\S]*\}/);
  if (m) {
    try { return JSON.parse(m[0]); } catch (e2) {}
  }
  return null;
}

function fetchAlertLivePriceV1000_(cfg) {
  const providers = [
    fetchYahooIntradayPriceV1000_,
    fetchTwelveQuotePriceV1000_,
    fetchFinnhubQuotePriceV1000_,
    fetchTechnicalPriceFallbackV1000_
  ];
  const errors = [];
  for (let i = 0; i < providers.length; i++) {
    const p = providers[i](cfg);
    if (p && p.ok && isFinite(Number(p.last)) && Number(p.last) > 0) return p;
    errors.push((p && p.provider ? p.provider : 'provider') + ': ' + (p && p.error ? p.error : 'failed'));
  }
  return { ok: false, cfg: cfg, provider: 'none', error: errors.join(' | ') };
}

function fetchYahooIntradayPriceV1000_(cfg) {
  try {
    const y = encodeURIComponent(yahooSymbolV748_(cfg));
    const url = 'https://query1.finance.yahoo.com/v8/finance/chart/' + y + '?range=1d&interval=1m&includePrePost=true';
    const res = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    if (res.getResponseCode() !== 200) return { ok: false, provider: 'YahooIntraday', error: 'HTTP ' + res.getResponseCode() };
    const json = JSON.parse(res.getContentText() || '{}');
    const result = json.chart && json.chart.result && json.chart.result[0];
    if (!result) return { ok: false, provider: 'YahooIntraday', error: 'No result' };
    const meta = result.meta || {};
    let last = Number(meta.regularMarketPrice || meta.postMarketPrice || meta.preMarketPrice);
    const prev = Number(meta.previousClose || meta.chartPreviousClose);
    const quote = result.indicators && result.indicators.quote && result.indicators.quote[0];
    const closes = quote && quote.close ? quote.close.filter(function(x) { return typeof x === 'number' && isFinite(x) && x > 0; }) : [];
    if ((!isFinite(last) || last <= 0) && closes.length) last = closes[closes.length - 1];
    if (!isFinite(last) || last <= 0) return { ok: false, provider: 'YahooIntraday', error: 'No live price' };
    return {
      ok: true,
      cfg: cfg,
      provider: 'YahooIntraday',
      last: last,
      prev: isFinite(prev) && prev > 0 ? prev : null,
      changePct: isFinite(prev) && prev > 0 ? (last - prev) / prev * 100 : null
    };
  } catch (err) {
    return { ok: false, provider: 'YahooIntraday', error: err.message };
  }
}

function fetchTwelveQuotePriceV1000_(cfg) {
  try {
    const key = PropertiesService.getScriptProperties().getProperty('TWELVE_DATA_API_KEY');
    if (!key) return { ok: false, provider: 'TwelveQuote', error: 'Missing TWELVE_DATA_API_KEY' };
    if ((cfg.currency || 'USD') === 'THB') return { ok: false, provider: 'TwelveQuote', error: 'Skipped THB ticker' };
    const sym = twelveDataSymbolV870_(cfg);
    const url = 'https://api.twelvedata.com/quote?symbol=' + encodeURIComponent(sym) + '&apikey=' + encodeURIComponent(key);
    const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) return { ok: false, provider: 'TwelveQuote', error: 'HTTP ' + res.getResponseCode() };
    const json = JSON.parse(res.getContentText() || '{}');
    if (json.status === 'error' || json.code) return { ok: false, provider: 'TwelveQuote', error: json.message || 'API error' };
    const last = Number(json.close || json.price || json.last || json.previous_close);
    const prev = Number(json.previous_close);
    if (!isFinite(last) || last <= 0) return { ok: false, provider: 'TwelveQuote', error: 'No quote price' };
    return { ok: true, cfg: cfg, provider: 'TwelveQuote', last: last, prev: prev, changePct: isFinite(prev) && prev > 0 ? (last - prev) / prev * 100 : null };
  } catch (err) {
    return { ok: false, provider: 'TwelveQuote', error: err.message };
  }
}

function fetchFinnhubQuotePriceV1000_(cfg) {
  try {
    const key = PropertiesService.getScriptProperties().getProperty('FINNHUB_API_KEY');
    if (!key) return { ok: false, provider: 'FinnhubQuote', error: 'Missing FINNHUB_API_KEY' };
    if ((cfg.currency || 'USD') === 'THB') return { ok: false, provider: 'FinnhubQuote', error: 'Skipped THB ticker' };
    const sym = String(cfg.symbol || '').toUpperCase().replace('.BK', '');
    const url = 'https://finnhub.io/api/v1/quote?symbol=' + encodeURIComponent(sym) + '&token=' + encodeURIComponent(key);
    const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) return { ok: false, provider: 'FinnhubQuote', error: 'HTTP ' + res.getResponseCode() };
    const json = JSON.parse(res.getContentText() || '{}');
    const last = Number(json.c);
    const prev = Number(json.pc);
    if (!isFinite(last) || last <= 0) return { ok: false, provider: 'FinnhubQuote', error: 'No quote price' };
    return { ok: true, cfg: cfg, provider: 'FinnhubQuote', last: last, prev: prev, changePct: isFinite(prev) && prev > 0 ? (last - prev) / prev * 100 : null };
  } catch (err) {
    return { ok: false, provider: 'FinnhubQuote', error: err.message };
  }
}

function fetchTechnicalPriceFallbackV1000_(cfg) {
  const d = safeFetchTechnicalForAlertV1000_(cfg);
  if (d && d.ok) {
    return {
      ok: true,
      cfg: cfg,
      provider: 'TechnicalFallback/' + (d.provider || 'unknown'),
      last: d.last,
      prev: d.prev,
      changePct: d.changePct
    };
  }
  return { ok: false, provider: 'TechnicalFallback', error: d && d.error ? d.error : 'No technical data' };
}

function safeFetchTechnicalForAlertV1000_(cfg) {
  try { return fetchTechnicalDataV748_(cfg); } catch (e) { return { ok: false, cfg: cfg, error: e.message }; }
}

function getAlertSymbolConfigV1000_(symbol) {
  const clean = sanitizeAlertSymbolV1000_(symbol);
  let cfg = null;
  try { cfg = getSymbolConfigV748_(clean); } catch (e) {}
  if (!cfg || !cfg.symbol) cfg = { symbol: clean, cat: 'Custom', portfolio: 'CUSTOM', currency: 'USD' };
  if (/\.BK$/i.test(String(symbol || ''))) {
    cfg.symbol = clean.replace('.BK', '');
    cfg.currency = 'THB';
    cfg.portfolio = cfg.portfolio || 'TH_BLS';
  }
  if ((cfg.portfolio || '') === 'TH_BLS') cfg.currency = 'THB';
  return cfg;
}

function sanitizeAlertSymbolV1000_(symbol) {
  let s = String(symbol || '').trim().toUpperCase().replace(/[^A-Z0-9.\-]/g, '');
  s = s.replace(/\.BK$/i, '');
  try { s = fixCommonTickerTypoV960_(s); } catch (e) {}
  return s;
}

function truthyV1000_(v) {
  if (v === true) return true;
  const s = String(v || '').trim().toLowerCase();
  return ['true', 'yes', 'y', '1', '✅', 'done'].indexOf(s) >= 0;
}

function nowTextV1000_() {
  return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm:ss');
}

function elapsedMinutesV1000_(lastText, nowText) {
  const last = parseDateTextV1000_(lastText);
  const now = parseDateTextV1000_(nowText) || new Date();
  if (!last) return 999999;
  return (now.getTime() - last.getTime()) / 60000;
}

function parseDateTextV1000_(v) {
  if (!v) return null;
  if (Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v.getTime())) return v;
  const s = String(v).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6] || 0));
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function setupOpenRouterApiKeyV1000(apiKey, model) {
  apiKey = String(apiKey || '').trim();
  if (!apiKey) throw new Error('ใส่ API key ก่อน เช่น setupOpenRouterApiKeyV1000("sk-or-v1-...", "openrouter/auto")');
  const props = PropertiesService.getScriptProperties();
  props.setProperty('OPENROUTER_API_KEY', apiKey);
  if (model) props.setProperty('OPENROUTER_MODEL', String(model).trim());
  sendLine('✅ ตั้งค่า OPENROUTER_API_KEY สำเร็จ\nModel: ' + (props.getProperty('OPENROUTER_MODEL') || 'openrouter/auto'));
}

// Backward-compatible alias: ถ้าเผลอเรียกชื่อเดิม จะบันทึกเป็น OpenRouter แทน
function setupOpenAiApiKeyV1000(apiKey, model) {
  return setupOpenRouterApiKeyV1000(apiKey, model || 'openrouter/auto');
}
function testBuyAlertV1000() {
  sendManyLine(checkBuyAlertsNowV1000(true));
}

