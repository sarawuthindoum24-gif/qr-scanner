/*
 * AI Portfolio Agent V8.2 RSI REGIME LOGIC
 * Main.gs
 * - LINE webhook
 * - Async task queue to avoid LINE timeout
 * - Full scan: DIME / Streaming / Watchlist
 * - Stockify-style symbol report
 * - Buy 3 entries only
 *
 * Script Properties required:
 * LINE_TOKEN   = LINE Messaging API channel access token
 * LINE_USER_ID = Your LINE user id
 */

const V748 = '9.6-typo-guard-provider-fix';
const TZ = 'Asia/Bangkok';
const MAX_LINE_CHARS = 3600;
const TASK_PROP_KEY = 'V748_TASK_QUEUE';

function doGet(e) {
  return ContentService.createTextOutput('AI Portfolio Agent ' + V748 + ' OK');
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || '{}');
    const events = body.events || [];
    events.forEach(handleLineEventV748_);
    return ContentService.createTextOutput('OK');
  } catch (err) {
    Logger.log('doPost error: ' + (err.stack || err));
    return ContentService.createTextOutput('ERR');
  }
}

function handleLineEventV748_(event) {
  if (!event || !event.message || event.message.type !== 'text') return;
  const textRaw = String(event.message.text || '').trim();
  const text = textRaw.toLowerCase();
  const replyToken = event.replyToken;

  const bot3TeamMatchV1 = textRaw.match(/^(?:ทีม|team)\s+([A-Za-z][A-Za-z0-9.\-]{0,11})$/i);
  if (bot3TeamMatchV1 && typeof bot3QueueTeamReviewV1 === 'function') {
    try {
      const queued = bot3QueueTeamReviewV1(bot3TeamMatchV1[1]);
      replyLine(replyToken, '🤝 รับงานทีม ' + queued.symbol + ' แล้ว\nGrace + investment + Khao จะตรวจร่วมกัน และส่งสรุปเมื่อครบ');
    } catch (err) {
      replyLine(replyToken, '❌ ส่งงานทีมไม่สำเร็จ: ' + err.message);
    }
    return;
  }

  // V13 role gate: Khao owns news, macro and economic-calendar reporting only.
  const khaoPortfolioCommandV1300 = /(?:พอร์ต|ถัว|ต้นทุน|average|บันทึกถัว|ตั้งต้นทุน)/i.test(textRaw);
  const khaoAnalysisCommandV1300 = ['เช็คทั้งหมด','เช็กทั้งหมด','all','fullscan','scanall','วิเคราะห์','report','รายงาน','ซื้อ','ซื้ออะไร','buy'].indexOf(text) >= 0;
  const khaoSymbolOnlyV1300 = /^[A-Za-z][A-Za-z0-9.\-]{0,11}$/.test(textRaw) && ['help','menu','news','health','watchlist','wl'].indexOf(text) < 0;
  if (khaoPortfolioCommandV1300) {
    replyLine(replyToken, '💼 งานพอร์ตและคำนวณถัวเฉลี่ย ให้ใช้บอท investment\nKhao รับผิดชอบข่าวหุ้นและปฏิทินเศรษฐกิจ');
    return;
  }
  if (khaoAnalysisCommandV1300 || khaoSymbolOnlyV1300) {
    replyLine(replyToken, '📊 วิเคราะห์หุ้นและคำแนะนำจังหวะซื้อ ให้ใช้บอท Grace\nKhao รับผิดชอบข่าวหุ้นและปฏิทินเศรษฐกิจ');
    return;
  }
  if (['help', 'ช่วยเหลือ', 'คำสั่ง', 'menu', 'เมนู'].indexOf(text) >= 0) {
    replyLine(replyToken, buildCommandHelpV749_());
    return;
  }

  const addParsed = parseAddWatchlistCommandV760_(textRaw);
  if (addParsed) {
    try {
      const added = appendWatchlistToSheetV760_(addParsed.symbol, addParsed.category, addParsed.portfolio, addParsed.currency);
      replyLine(replyToken, added.message);
    } catch (err) {
      Logger.log('add watchlist error: ' + (err.stack || err));
      replyLine(replyToken, '❌ เพิ่ม Watchlist ไม่สำเร็จ: ' + err.message + '\nพิมพ์ help เพื่อดูคำสั่ง หรือรัน setupWatchlistSheetV760 ก่อน');
    }
    return;
  }

  if (text === 'watchlist' || text === 'วอชลิสต์' || text === 'wl') {
    try {
      replyLine(replyToken, buildWatchlistSheetSummaryV760_());
    } catch (err) {
      replyLine(replyToken, '❌ อ่าน Watchlist จาก Sheet ไม่สำเร็จ: ' + err.message);
    }
    return;
  }



  if (['พอร์ต', 'วิเคราะห์พอร์ต', 'รายงานพอร์ต', 'review', 'rm', 'portfolio', 'portfolio review'].indexOf(text) >= 0) {
    replyLine(replyToken, '⏳ รับคำสั่งแล้ว: สร้าง Portfolio Review แบบ RM-style\nระบบจะสร้างไฟล์ HTML และส่งลิงก์กลับมาเป็นข้อความถัดไป');
    enqueueTaskV748_({ type: 'RM_REVIEW', createdAt: new Date().toISOString() });
    return;
  }

  if (['เช็คทั้งหมด', 'เช็กทั้งหมด', 'all', 'fullscan', 'scanall'].indexOf(text) >= 0) {
    replyLine(replyToken, '⏳ รับคำสั่งแล้ว: เช็คทั้งหมดแบบ Full Scan\nระบบจะส่งผลลัพธ์เป็นข้อความถัดไป ไม่ต้องพิมพ์ซ้ำ');
    enqueueTaskV748_({ type: 'FULL_SCAN', createdAt: new Date().toISOString() });
    return;
  }

  if (['วิเคราะห์', 'report', 'รายงาน'].indexOf(text) >= 0) {
    replyLine(replyToken, '⏳ รับคำสั่งแล้ว: วิเคราะห์พอร์ต DIME / Streaming แบบสั้น\nระบบจะส่งผลลัพธ์เป็นข้อความถัดไป ไม่ต้องพิมพ์ซ้ำ');
    enqueueTaskV748_({ type: 'FULL_SCAN', createdAt: new Date().toISOString() });
    return;
  }

  if (['ซื้อ', 'ซื้ออะไร', 'buy'].indexOf(text) >= 0) {
    replyLine(replyToken, '⏳ รับคำสั่งแล้ว: เช็คลิสต์ก่อนซื้อ + แผนเข้าซื้อ 3 ไม้\nระบบจะส่งผลลัพธ์เป็นข้อความถัดไป ไม่ต้องพิมพ์ซ้ำ');
    enqueueTaskV748_({ type: 'BUY_CHECKLIST', createdAt: new Date().toISOString() });
    return;
  }

  if (['ข่าว', 'news'].indexOf(text) >= 0) {
    replyLine(replyToken, '⏳ รับคำสั่งแล้ว: สรุปข่าวหุ้นวันนี้จากแหล่งข่าวไทย\nระบบจะส่งผลลัพธ์เป็นข้อความถัดไป ไม่ต้องพิมพ์ซ้ำ');
    enqueueTaskV748_({ type: 'NEWS_BUY3', createdAt: new Date().toISOString() });
    return;
  }

  if (['health', 'debug'].indexOf(text) >= 0) {
    replyLine(replyToken, '⏳ รับคำสั่งแล้ว: ตรวจระบบแบบเร็ว');
    enqueueTaskV748_({ type: 'HEALTH', createdAt: new Date().toISOString() });
    return;
  }

  const symbol = normalizeInputSymbolV748_(textRaw);
  if (symbol) {
    // V9.5: ตอบรับทันทีเพื่อไม่ให้ดูเงียบ แล้วส่งรายงานผ่าน queue/push
    replyLine(replyToken, '✅ รับคำสั่ง ' + symbol + ' แล้ว กำลังวิเคราะห์...');
    enqueueTaskV748_({ type: 'SYMBOL', symbol: symbol, createdAt: new Date().toISOString() });
    return;
  }

  replyLine(replyToken, 'พิมพ์คำสั่งได้ เช่น\n• ASTS / NVDA / VOO / CPALL\n• เช็คทั้งหมด\n• ข่าว\n• health');
}

function enqueueTaskV748_(task) {
  const props = PropertiesService.getScriptProperties();

  // V7.7.1: prevent stale queued tasks from replying with the wrong ticker.
  // LINE commands are interactive, so the latest command should win.
  let queue = [];
  try { queue = JSON.parse(props.getProperty(TASK_PROP_KEY) || '[]'); } catch (e) { queue = []; }
  if (task && ['SYMBOL','FULL_SCAN','BUY_CHECKLIST','NEWS_BUY3','HEALTH','RM_REVIEW'].indexOf(task.type) >= 0) {
    queue = [task];
  } else {
    queue.push(task);
    queue = queue.slice(-10);
  }
  props.setProperty(TASK_PROP_KEY, JSON.stringify(queue));
  cleanupTriggersV748_('runQueuedTaskV748');
  ScriptApp.newTrigger('runQueuedTaskV748').timeBased().after(1000).create();
}

function runQueuedTaskV748() {
  cleanupTriggersV748_('runQueuedTaskV748');
  const props = PropertiesService.getScriptProperties();
  let queue = [];
  try { queue = JSON.parse(props.getProperty(TASK_PROP_KEY) || '[]'); } catch (e) { queue = []; }
  if (!queue.length) return;
  const task = queue.shift();
  props.setProperty(TASK_PROP_KEY, JSON.stringify(queue));

  try {
    if (task.type === 'FULL_SCAN') {
      sendManyLine(runFullScanV748());
    } else if (task.type === 'SYMBOL') {
      sendSymbolVisualPackageV830_(task.symbol);
    } else if (task.type === 'NEWS_BUY3') {
      sendManyLine(buildNewsBuy3ReportV748());
    } else if (task.type === 'BUY_CHECKLIST') {
      sendManyLine(buildBuyChecklistReportV752());
    } else if (task.type === 'RM_REVIEW') {
      sendLine(buildPortfolioReviewRMReportV770());
    } else if (task.type === 'HEALTH') {
      sendLine(buildHealthReportV748());
    }
  } catch (err) {
    Logger.log('runQueuedTaskV748 error: ' + (err.stack || err));
    sendLine('❌ ระบบทำงานล้มเหลว: ' + err.message);
  } finally {
    // If a batch left more tasks, continue processing. Normally interactive commands replace the queue.
    try {
      const left = JSON.parse(props.getProperty(TASK_PROP_KEY) || '[]');
      if (left.length) ScriptApp.newTrigger('runQueuedTaskV748').timeBased().after(1000).create();
    } catch (e) {}
  }
}

function cleanupTriggersV748_(handlerName) {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function(t) {
    if (t.getHandlerFunction && t.getHandlerFunction() === handlerName) {
      try { ScriptApp.deleteTrigger(t); } catch (e) {}
    }
  });
}

function sendLine(text) {
  sendManyLine([text]);
}

function sendManyLine(messages) {
  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty('LINE_TOKEN');
  const userId = props.getProperty('LINE_USER_ID');
  if (!token || !userId) throw new Error('Missing LINE_TOKEN or LINE_USER_ID in Script Properties');

  const chunks = [];
  (messages || []).forEach(function(msg) {
    splitLineTextV748_(String(msg || '')).forEach(function(x) { chunks.push(x); });
  });
  chunks.forEach(function(chunk) {
    const payload = { to: userId, messages: [{ type: 'text', text: chunk }] };
    const res = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + token },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
    Logger.log('LINE push ' + res.getResponseCode() + ': ' + res.getContentText());
  });
}


function sendSymbolVisualPackageV830_(symbol) {
  // V9.5 queued result: push final sharp text only.
  let pkg = null;

  try {
    pkg = buildVisualSymbolPackageV830_(symbol);
  } catch (err) {
    Logger.log('sendSymbolVisualPackageV830_ build error: ' + (err.stack || err));
    sendLine('❌ วิเคราะห์ ' + symbol + ' ไม่สำเร็จ\nสาเหตุ: ' + err.message);
    return;
  }

  if (!pkg || !pkg.text) {
    sendLine('❌ ไม่สามารถสร้างรายงาน ' + symbol + ' ได้');
    return;
  }

  sendManyLine(splitLineTextV748_(String(pkg.text)));
}



function replySingleSymbolDirectV920_(replyToken, symbol) {
  // V9.4 text-only direct reply.
  // No Flex/Card and no queue to reduce delay and LINE rejection risk.
  let pkg = null;

  try {
    pkg = buildVisualSymbolPackageV830_(symbol);
  } catch (err) {
    Logger.log('replySingleSymbolDirectV920_ build error: ' + (err.stack || err));
    replyLine(replyToken, '❌ วิเคราะห์ ' + symbol + ' ไม่สำเร็จ\nสาเหตุ: ' + err.message);
    return;
  }

  if (!pkg || !pkg.text) {
    replyLine(replyToken, '❌ ไม่สามารถสร้างรายงาน ' + symbol + ' ได้');
    return;
  }

  const first = splitLineTextV748_(String(pkg.text))[0] || String(pkg.text).slice(0, 4500);
  replyLine(replyToken, first);
}

function replyFlexMessageV920_(replyToken, altText, contents) {
  const token = PropertiesService.getScriptProperties().getProperty('LINE_TOKEN');
  if (!token || !replyToken || !contents) return false;

  const payload = {
    replyToken: replyToken,
    messages: [{
      type: 'flex',
      altText: altText || 'Stock summary',
      contents: contents
    }]
  };

  const res = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + token },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  const code = res.getResponseCode();
  const body = res.getContentText();
  Logger.log('LINE reply flex ' + code + ': ' + body);
  return code >= 200 && code < 300;
}


function pushLineMessagesV830_(messages) {
  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty('LINE_TOKEN');
  const userId = props.getProperty('LINE_USER_ID');
  if (!token || !userId) throw new Error('Missing LINE_TOKEN or LINE_USER_ID in Script Properties');

  const list = (messages || []).filter(function(x) { return !!x; });
  if (!list.length) return true;

  let allOk = true;
  for (var i = 0; i < list.length; i += 5) {
    const payload = { to: userId, messages: list.slice(i, i + 5) };
    const res = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + token },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });

    const code = res.getResponseCode();
    const body = res.getContentText();
    Logger.log('LINE push multi ' + code + ': ' + body);
    if (code < 200 || code >= 300) allOk = false;
  }
  return allOk;
}

function replyLine(replyToken, text) {
  const token = PropertiesService.getScriptProperties().getProperty('LINE_TOKEN');
  if (!token || !replyToken) return;
  const payload = { replyToken: replyToken, messages: [{ type: 'text', text: String(text).slice(0, 4500) }] };
  const res = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + token },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
  Logger.log('LINE reply ' + res.getResponseCode() + ': ' + res.getContentText());
}

function splitLineTextV748_(text) {
  if (text.length <= MAX_LINE_CHARS) return [text];
  const lines = text.split('\n');
  const out = [];
  let buf = '';
  lines.forEach(function(line) {
    if ((buf + '\n' + line).length > MAX_LINE_CHARS) {
      out.push(buf);
      buf = line;
    } else {
      buf = buf ? buf + '\n' + line : line;
    }
  });
  if (buf) out.push(buf);
  return out;
}


function clearOldCommandsV748() {
  const props = PropertiesService.getScriptProperties();
  props.deleteProperty(TASK_PROP_KEY);
  cleanupTriggersV748_('runQueuedTaskV748');
  sendLine('✅ เคลียร์คำสั่งเก่า / คิวเก่าเรียบร้อยแล้ว');
}



function testPushSymbolV950() {
  sendSymbolVisualPackageV830_('NVDA');
}

function debugBotV920() {
  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty('LINE_TOKEN');
  const userId = props.getProperty('LINE_USER_ID');
  const td = props.getProperty('TWELVE_DATA_API_KEY');
  const fh = props.getProperty('FINNHUB_API_KEY');

  sendLine([
    '🧪 Debug v' + V748,
    'LINE_TOKEN: ' + (token ? '✅ set' : '❌ missing'),
    'LINE_USER_ID: ' + (userId ? '✅ set' : '⚠️ missing (push เท่านั้น)'),
    'TWELVE_DATA_API_KEY: ' + (td ? '✅ set' : '⚠️ missing'),
    'FINNHUB_API_KEY: ' + (fh ? '✅ set' : '⚠️ missing'),
    'Mode: single stock = ack first + queued sharp text'
  ].join('\n'));
}

function setupDailyTrigger() {
  cleanupTriggersV748_('dailyPortfolioReportV748');
  ScriptApp.newTrigger('dailyPortfolioReportV748')
    .timeBased()
    .everyDays(1)
    .atHour(20)
    .nearMinute(30)
    .inTimezone(TZ)
    .create();
  sendLine('✅ ตั้งรายงานประจำวัน 20:30 น. แล้ว');
}

function dailyPortfolioReportV748() {
  sendManyLine(buildNewsBuy3ReportV748());
}

function testPush() { testPushV748(); }
function testReport() { testFullScanV748(); }

function testPushV748() {
  sendLine('✅ V9.6 Typo Guard Provider Fix test สำเร็จ');
}

function testFullScanV748() {
  sendManyLine(runFullScanV748());
}


function testSymbolSafeV885() {
  sendSymbolVisualPackageV830_('NVDA');
}


function testSymbolReportV748() {
  sendLine(buildStockifySymbolReportV748('ASTS'));
}

function testNewsBuy3V748() {
  sendManyLine(buildNewsBuy3ReportV748());
}

function testBuyChecklistV752() {
  sendManyLine(buildBuyChecklistReportV752());
}

function testBuyTierV753() {
  sendManyLine(buildBuyChecklistReportV752());
}

function normalizeInputSymbolV748_(input) {
  const raw = String(input || '').trim();
  if (!raw) return '';

  // Support commands like "ซื้อ CRWV" / "buy CRWV" as a single-symbol Stockify report.
  // Plain "ซื้อ" still means Buy Checklist.
  let candidateRaw = raw;
  const buyWithSymbol = raw.match(/^(?:ซื้อ|buy)\s+([A-Za-z0-9.\-]{1,12})$/i);
  if (buyWithSymbol) candidateRaw = buyWithSymbol[1];

  let s = String(candidateRaw || '').trim().toUpperCase().replace(/[^A-Z0-9.\-]/g, '');
  if (!s) return '';

  // V9.6 typo guard for common mistyped tickers.
  // Example: AZMN -> AMZN prevents provider 404/no quote errors.
  s = fixCommonTickerTypoV960_(s);

  // Reserved words / commands must never be treated as stock symbols.
  const reserved = [
    'HELP','MENU','COMMAND','COMMANDS','NEWS','BUY','ALL','FULLSCAN','SCANALL',
    'REPORT','DEBUG','HEALTH','RM','PORTFOLIO','REVIEW','WATCHLIST','WL'
  ];
  if (reserved.indexOf(s) >= 0) return '';

  const all = getAllTrackedSymbolsV748_().map(function(x) { return x.symbol; });
  if (all.indexOf(s) >= 0) return s;
  const noBk = s.replace('.BK', '');
  if (all.indexOf(noBk) >= 0) return noBk;

  // V7.7.1: allow custom valid-looking tickers such as CRWV, EOSE, ASML.
  // The report will still fail safely if Yahoo has no chart data.
  if (/^[A-Z][A-Z0-9.\-]{0,9}$/.test(s)) return s;
  return '';
}


function fixCommonTickerTypoV960_(s) {
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

function buildCommandHelpV749_() {
  return [
    '📰 Khao — ข่าวหุ้นและปฏิทินเศรษฐกิจ',
    '━━━━━━━━━━━━━━━━━━━━',
    '• ข่าว / news = สรุปข่าวล่าสุดของหุ้นใน Watchlist',
    '• watchlist / wl = ดูรายชื่อหุ้นที่ติดตาม',
    '• +TSLA = เพิ่มหุ้นเข้า Watchlist ข่าว',
    '• health = ตรวจการเชื่อมต่อระบบ',
    '',
    'แหล่งข่าว: Investing.com Thailand + Yahoo Finance (รวม ticker ไทย .BK)',
    'Webull Thailand News API: รอ endpoint/สิทธิ์ที่รองรับหุ้นไทย และไม่ใช้ endpoint ที่ไม่เป็นทางการ',
    'ปฏิทิน: Earnings และ FOMC จาก EconCalendar',
    '',
    'วิเคราะห์หุ้น/จังหวะซื้อ → Grace',
    'พอร์ต/ต้นทุน/ถัวเฉลี่ย → investment',
    'ข้อมูลประกอบการตัดสินใจ ไม่ใช่คำแนะนำการลงทุน'
  ].join('\n');
}

function testHelpV749() {
  sendLine(buildCommandHelpV749_());
}



function setupFinnhubApiKeyV880(apiKey) {
  apiKey = String(apiKey || '').trim();
  if (!apiKey) throw new Error('ใส่ API key ก่อน เช่น setupFinnhubApiKeyV880("YOUR_KEY")');
  PropertiesService.getScriptProperties().setProperty('FINNHUB_API_KEY', apiKey);
  sendLine('✅ ตั้งค่า FINNHUB_API_KEY สำเร็จ\nระบบจะใช้ Finnhub ช่วย News Gate / Sentiment');
}

function testFinnhubNewsV880() {
  // v1000 wrapper: RSS News Gate test with rich LINE report.
  var symbol = 'NVDA';
  var d = buildNewsGateV1000_(symbol);

  if (d && d.SOURCE_ERROR) {
    sendLine('\u274C RSS News Gate ERROR: ' + symbol + '\nsource: ' + (d.sourceStatus||'Error') + '\nreason: ' + (d.reason||d.SOURCE_ERROR));
    return d;
  }

  var top = (d.topPositive && d.topPositive.title) ? d.topPositive :
            (d.topNegative && d.topNegative.title) ? d.topNegative :
            (d.items && d.items[0]) ? d.items[0] : null;
  var headline = top && top.title ? top.title : '(\u0E44\u0E21\u0E48\u0E21\u0E35\u0E02\u0E48\u0E32\u0E27\u0E17\u0E35\u0E48\u0E43\u0E0A\u0E49\u0E44\u0E14\u0E49)';
  var pub = top && top.source ? top.source : (d.publisherSource || '-');

  var rr = d.rejectedReasons || {};
  var rrKeys = Object.keys(rr);
  var rrText = rrKeys.length ? rrKeys.map(function(k){return k + '=' + rr[k];}).join(', ') : '-';

  var latest = d.latestNewsAt ? String(d.latestNewsAt) : '-';

  var icon = d.status === 'POSITIVE' ? '\u2705' : d.status === 'NEGATIVE' ? '\u26A0\uFE0F' : '\u2696\uFE0F';
  var msg =
    icon + ' RSS News Gate: ' + symbol + '\n' +
    'status: ' + d.status + ' (gatePass=' + d.gatePass + ')\n' +
    'source: ' + (d.sourceStatus || '-') + (d.feedSource ? ' / ' + d.feedSource : '') + '\n' +
    'n\u0E31\u0E1A\u0E02\u0E48\u0E32\u0E27: raw ' + d.rawItemCount + ' \u2192 relevant ' + d.relevantItemCount + ' \u2192 actionable ' + d.actionableItemCount + ' (\u0E15\u0E31\u0E14\u0E17\u0E34\u0E49\u0E07 ' + d.rejectedItemCount + ')\n' +
    '\u0E40\u0E2B\u0E15\u0E38\u0E17\u0E35\u0E48\u0E15\u0E31\u0E14: ' + rrText + '\n' +
    'latestNewsAt: ' + latest + '\n' +
    '\u0E2B\u0E31\u0E27\u0E02\u0E48\u0E32\u0E27: ' + headline + '\n' +
    'publisher: ' + pub + '\n' +
    'reason: ' + (d.reason || '-');

  sendLine(msg);
  Logger.log(msg);
  return d;
}
function setupTwelveDataApiKeyV870(apiKey) {
  apiKey = String(apiKey || '').trim();
  if (!apiKey) throw new Error('ใส่ API key ก่อน เช่น setupTwelveDataApiKeyV870("YOUR_KEY")');
  PropertiesService.getScriptProperties().setProperty('TWELVE_DATA_API_KEY', apiKey);
  sendLine('✅ ตั้งค่า TWELVE_DATA_API_KEY สำเร็จ\nระบบจะใช้ Twelve Data เป็น fallback ถ้า Yahoo ดึงราคาไม่ได้');
}

function testTwelveDataV870() {
  const d = fetchTwelveDataTechnicalDataV870_({ symbol: 'AVGO', currency: 'USD', portfolio: 'TEST', cat: 'Stock' });
  sendLine(d && d.ok
    ? '✅ Twelve Data OK: AVGO ' + moneyV748_(d.last, 'USD') + '\nProvider: ' + d.provider
    : '❌ Twelve Data failed: ' + (d && d.error ? d.error : 'unknown'));
}



function testWatchlistSheetV760() {
  sendLine(buildWatchlistSheetSummaryV760_());
}

function testAddWatchlistV760() {
  const r = appendWatchlistToSheetV760_('TEST', 'Test', 'WATCH_US', 'USD');
  sendLine(r.message);
}

function testSetupWatchlistSheetV760() {
  const id = setupWatchlistSheetV760();
  sendLine('✅ setupWatchlistSheetV760 สำเร็จ\nSheet ID: ' + id + '\nไปที่ Script Properties จะมี WATCHLIST_SHEET_ID แล้ว');
}


function testPortfolioReviewV770() {
  sendLine(buildPortfolioReviewRMReportV770());
}

function testRMReportV770() {
  testPortfolioReviewV770();
}


function testTypoGuardV960() {
  sendSymbolVisualPackageV830_('AZMN');
}

// ============================================================================
// NEWS GATE v1000 - Actionable News Filtering & Quality Checks
// Non-invasive post-processing layer over buildNewsGate_ (Agent.gs unchanged)
// ============================================================================

function isActionableNewsItemV1000(item) {
  if (!item) return false;
  var title = String(item.title || "").toLowerCase();
  var link = String(item.link || item.url || "").toLowerCase();
  var combined = title + " " + link;
  if (!title) return false;

  // ALLOW real event-forecast news first (guard against false rejects)
  var allowPatterns = [
    /\bcuts?\s+(?:its\s+)?revenue\s+forecast/,
    /\braises?\s+(?:its\s+)?earnings?\s+forecast/,
    /\braises?\s+(?:its\s+)?revenue\s+forecast/,
    /\bcuts?\s+(?:its\s+)?earnings?\s+forecast/,
    /\blowers?\s+(?:its\s+)?guidance/,
    /\braises?\s+(?:its\s+)?guidance/,
    /\bwarns?\b.*\bforecast/,
    /\bslashes?\b.*\bforecast/,
    /\bboosts?\b.*\bforecast/,
    /\bupdates?\b.*\bguidance/
  ];
  for (var a = 0; a < allowPatterns.length; a++) {
    if (allowPatterns[a].test(combined)) return true;
  }

  // REJECT evergreen / non-news reference pages
  var rejectPatterns = [
    /\bstock\s+quote\b/,
    /\bstock\s+price\b/,
    /\bprice\s+and\s+forecast\b/,
    /\bprice\s+forecast\b/,
    /\bprice\s+prediction\b/,
    /\breal[\s-]?time\s+quote\b/,
    /\blive\s+quote\b/,
    /\binteractive\s+chart\b/,
    /\bstock\s+chart\b/,
    /\btechnical\s+analysis\b/,
    /\btechnical\s+summary\b/,
    /\bcompany\s+profile\b/,
    /\bhistorical\s+data\b/,
    /\bdividend\s+history\b/,
    /\bearnings\s+calendar\b/,
    /\bmarket\s+data\b/,
    /\boverview\s+page\b/,
    /\banalyst\s+ratings?\s+page\b/
  ];
  for (var r = 0; r < rejectPatterns.length; r++) {
    if (rejectPatterns[r].test(combined)) return false;
  }

  return true;
}

function validateNewsQualityV1000(item) {
  if (!item) return { valid: false, reason: "null_item" };
  var title = String(item.title || "").trim();
  if (!title) return { valid: false, reason: "no_title" };
  var link = String(item.link || item.url || "").trim();
  if (!link) return { valid: false, reason: "no_link" };
  var pub = item.publishedAt || item.pubDate || item.date;
  if (!pub) return { valid: false, reason: "no_publish_date" };
  var t;
  try { t = (pub instanceof Date) ? pub.getTime() : new Date(pub).getTime(); }
  catch (e) { return { valid: false, reason: "invalid_date" }; }
  if (isNaN(t)) return { valid: false, reason: "invalid_date" };
  var ageHours = (Date.now() - t) / 3600000;
  if (ageHours > 72) return { valid: false, reason: "stale_" + Math.floor(ageHours) + "h" };
  if (ageHours < -1) return { valid: false, reason: "future_date" };
  return { valid: true, reason: "ok", ageHours: ageHours };
}

function tickerAliasMapV1000_(symbol) {
  var s = String(symbol || "").toUpperCase();
  var map = {
    "NVDA": ["nvda", "nvidia"],
    "AMZN": ["amzn", "amazon"],
    "GOOGL": ["googl", "google", "alphabet"],
    "TSLA": ["tsla", "tesla"],
    "META": ["meta", "facebook"],
    "MSFT": ["msft", "microsoft"],
    "AAPL": ["aapl", "apple"]
  };
  return map[s] || [s.toLowerCase()];
}

function processRssNewsItemsV1000(symbol, items) {
  var m = {
    symbol: symbol,
    rawItemCount: (items && items.length) || 0,
    relevantItemCount: 0,
    actionableItemCount: 0,
    rejectedItemCount: 0,
    rejectedReasons: {},
    items: [],
    allFiltered: true
  };
  if (!items || !items.length) return m;
  var aliases = tickerAliasMapV1000_(symbol);
  for (var i = 0; i < items.length; i++) {
    var it = items[i];
    var hay = (String(it.title || "") + " " + String(it.link || it.url || "")).toLowerCase();
    var rel = false;
    for (var k = 0; k < aliases.length; k++) { if (hay.indexOf(aliases[k]) >= 0) { rel = true; break; } }
    if (!rel) {
      m.rejectedItemCount++;
      m.rejectedReasons["no_symbol"] = (m.rejectedReasons["no_symbol"] || 0) + 1;
      continue;
    }
    m.relevantItemCount++;
    var q = validateNewsQualityV1000(it);
    if (!q.valid) {
      m.rejectedItemCount++;
      var key = "qc_" + q.reason;
      m.rejectedReasons[key] = (m.rejectedReasons[key] || 0) + 1;
      continue;
    }
    if (!isActionableNewsItemV1000(it)) {
      m.rejectedItemCount++;
      m.rejectedReasons["not_actionable"] = (m.rejectedReasons["not_actionable"] || 0) + 1;
      continue;
    }
    m.actionableItemCount++;
    m.items.push(it);
  }
  m.allFiltered = (m.actionableItemCount === 0);
  return m;
}

function rankNewsItemsV1000_(items) {
  var arr = (items || []).slice();
  function sev(it) {
    var s = String(it.severity || "").toLowerCase();
    if (s.indexOf("critical") >= 0) return 3;
    if (s.indexOf("high") >= 0) return 2;
    if (s.indexOf("med") >= 0) return 1;
    return 0;
  }
  function fresh(it) {
    var pub = it.publishedAt || it.pubDate || it.date;
    try { return (pub instanceof Date) ? pub.getTime() : new Date(pub).getTime(); }
    catch (e) { return 0; }
  }
  arr.sort(function(a, b) {
    var sd = sev(b) - sev(a);
    if (sd !== 0) return sd;
    return fresh(b) - fresh(a);
  });
  return arr;
}

function buildNewsGateV1000_(symbol) {
  symbol = symbol || "NVDA";
  var sourceStatus = "Error";
  var base = null;
  try {
    base = buildNewsGate_(symbol);
  } catch (e) {
    return {
      symbol: symbol, status: "NEUTRAL", gatePass: false,
      sourceStatus: "Error", feedSource: "", publisherSource: "",
      rawItemCount: 0, relevantItemCount: 0, actionableItemCount: 0,
      rejectedItemCount: 0, rejectedReasons: {}, latestNewsAt: null,
      topPositive: null, topNegative: null, items: [],
      reason: "SOURCE_ERROR: " + e
    };
  }

  var rawItems = (base && base.items) ? base.items : [];
  // Determine source transparency
  var srcKeys = (base && base.sources) ? base.sources : {};
  if (rawItems.length > 0 || base) {
    sourceStatus = "GoogleNews";
    for (var i = 0; i < rawItems.length; i++) {
      var lk = String(rawItems[i].link || rawItems[i].url || "").toLowerCase();
      if (lk.indexOf("investing.com") >= 0) { sourceStatus = "Investing"; break; }
    }
  }

  var proc = processRssNewsItemsV1000(symbol, rawItems);
  var ranked = rankNewsItemsV1000_(proc.items);

  var status, gatePass, reason;
  if (proc.allFiltered) {
    status = "NEUTRAL";
    gatePass = false;
    reason = "NO_MATCHING_ACTIONABLE_NEWS";
  } else {
    status = base.status || "NEUTRAL";
    gatePass = (base.gatePass === true);
    reason = base.reason || "OK";
  }

  var topPos = null, topNeg = null;
  for (var j = 0; j < ranked.length; j++) {
    var lab = String(ranked[j].label || ranked[j].sentiment || "").toLowerCase();
    if (!topPos && lab.indexOf("pos") >= 0) topPos = ranked[j];
    if (!topNeg && lab.indexOf("neg") >= 0) topNeg = ranked[j];
  }

  var latestAt = null;
  if (ranked.length) {
    var p = ranked[0].publishedAt || ranked[0].pubDate || ranked[0].date;
    try { latestAt = (p instanceof Date) ? p.toISOString() : new Date(p).toISOString(); } catch (e) {}
  }

  return {
    symbol: symbol,
    status: status,
    gatePass: gatePass,
    sourceStatus: sourceStatus,
    feedSource: "RSS_" + sourceStatus,
    publisherSource: (ranked[0] && ranked[0].source) || "",
    rawItemCount: proc.rawItemCount,
    relevantItemCount: proc.relevantItemCount,
    actionableItemCount: proc.actionableItemCount,
    rejectedItemCount: proc.rejectedItemCount,
    rejectedReasons: proc.rejectedReasons,
    latestNewsAt: latestAt,
    topPositive: topPos,
    topNegative: topNeg,
    items: ranked,
    reason: reason
  };
}

function testRssNewsGateV1000(symbol) {
  symbol = symbol || "NVDA";
  var r = buildNewsGateV1000_(symbol);
  var top = (r.items && r.items[0]) ? r.items[0].title : "(none)";
  var rr = [];
  for (var k in r.rejectedReasons) { rr.push(k + "=" + r.rejectedReasons[k]); }
  var lines = [
    "NEWS GATE v1000 | " + r.symbol,
    "status: " + r.status + " | gatePass: " + r.gatePass,
    "sourceStatus: " + r.sourceStatus,
    "counts raw/relevant/actionable/rejected: " + r.rawItemCount + "/" + r.relevantItemCount + "/" + r.actionableItemCount + "/" + r.rejectedItemCount,
    "rejectedReasons: " + (rr.length ? rr.join(", ") : "(none)"),
    "latestNewsAt: " + (r.latestNewsAt || "N/A"),
    "headline1: " + top,
    "reason: " + r.reason
  ];
  var report = lines.join("\n");
  Logger.log(report);
  if (typeof console !== "undefined" && console.log) console.log(r);
  return r;
}

// Compatibility wrapper - keeps existing menu/name working, no real LINE/deploy
function testFinnhubNewsV880Local_() {
  return testRssNewsGateV1000("NVDA");
}

// ============================================================================
// UNIT TESTS - News Gate v1000 (Mock data only, NO real web calls)
// ============================================================================

function runNewsGateTestsV1000() {
  var now = new Date();
  var fresh = new Date(now.getTime() - 3600000); // 1h ago
  var stale = new Date(now.getTime() - 100 * 3600000); // 100h ago
  var results = [];
  function check(name, actual, expected) {
    var pass = (actual === expected);
    results.push((pass ? "PASS" : "FAIL") + " | " + name + " | expected=" + expected + " actual=" + actual);
    return pass;
  }

  // 1. Stock Quote page must be REJECTED
  check("reject NVDA Stock Quote Price and Forecast",
    isActionableNewsItemV1000({ title: "NVDA Stock Quote Price and Forecast", link: "x" }), false);
  // 2. cuts revenue forecast must be ACTIONABLE (allowed)
  check("accept NVDA cuts revenue forecast",
    isActionableNewsItemV1000({ title: "Nvidia cuts revenue forecast on export curbs", link: "x" }), true);
  // 3. raises earnings forecast must be ACTIONABLE
  check("accept NVDA raises earnings forecast",
    isActionableNewsItemV1000({ title: "Nvidia raises earnings forecast for Q3", link: "x" }), true);
  // 4. historical data page rejected
  check("reject historical data page",
    isActionableNewsItemV1000({ title: "NVDA Historical Data", link: "x" }), false);
  // 5. stock chart page rejected
  check("reject stock chart page",
    isActionableNewsItemV1000({ title: "Nvidia Stock Chart Interactive", link: "x" }), false);
  // 6. company profile page rejected
  check("reject company profile page",
    isActionableNewsItemV1000({ title: "NVIDIA Corporation Company Profile", link: "x" }), false);
  // 7. valid earnings news accepted
  check("accept valid earnings news",
    isActionableNewsItemV1000({ title: "Nvidia beats Q2 earnings, revenue up 40%", link: "x" }), true);
  // 8. valid regulatory/investigation news accepted
  check("accept regulatory investigation news",
    isActionableNewsItemV1000({ title: "US opens antitrust investigation into Nvidia", link: "x" }), true);

  // 9. quality: no title rejected
  check("qc no_title", validateNewsQualityV1000({ title: "", link: "x", publishedAt: now }).reason, "no_title");
  // 10. quality: stale rejected
  check("qc stale rejected",
    validateNewsQualityV1000({ title: "t", link: "x", publishedAt: stale }).valid, false);
  // 11. quality: fresh valid
  check("qc fresh valid",
    validateNewsQualityV1000({ title: "t", link: "x", publishedAt: fresh }).valid, true);

  // 12. filtered-all result => NEUTRAL + NO_MATCHING_ACTIONABLE_NEWS
  var allQuote = processRssNewsItemsV1000("NVDA", [
    { title: "NVDA Stock Quote Price and Forecast", link: "a", publishedAt: fresh },
    { title: "Nvidia Stock Chart", link: "b", publishedAt: fresh },
    { title: "NVIDIA Company Profile", link: "c", publishedAt: fresh }
  ]);
  check("all-quote allFiltered", allQuote.allFiltered, true);
  check("all-quote actionable=0", allQuote.actionableItemCount, 0);

  // 13. mixed set: 1 real news survives
  var mixed = processRssNewsItemsV1000("NVDA", [
    { title: "NVDA Stock Quote Price and Forecast", link: "a", publishedAt: fresh },
    { title: "Nvidia cuts revenue forecast on export curbs", link: "b", publishedAt: fresh },
    { title: "Some unrelated crypto news", link: "c", publishedAt: fresh }
  ]);
  check("mixed actionable=1", mixed.actionableItemCount, 1);
  check("mixed rejected has not_actionable", (mixed.rejectedReasons["not_actionable"] || 0) >= 1, true);

  // 14. ranking: critical severity first
  var ranked = rankNewsItemsV1000_([
    { title: "low", severity: "low", publishedAt: stale },
    { title: "crit", severity: "critical", publishedAt: stale },
    { title: "med", severity: "medium", publishedAt: fresh }
  ]);
  check("ranking critical first", ranked[0].title, "crit");

  var passCount = 0;
  for (var i = 0; i < results.length; i++) { if (results[i].indexOf("PASS") === 0) passCount++; }
  var summary = "NEWS GATE v1000 UNIT TESTS: " + passCount + "/" + results.length + " passed\n" + results.join("\n");
  Logger.log(summary);
  if (typeof console !== "undefined" && console.log) console.log(summary);
  return { passed: passCount, total: results.length, results: results };
}

function getKhaoNewsScheduleStatusV1300() {
  var props = PropertiesService.getScriptProperties();
  var triggers = ScriptApp.getProjectTriggers().filter(function(t) {
    return t.getHandlerFunction && t.getHandlerFunction() === 'dailyPortfolioReportV748';
  });
  var result = {
    timezone: TZ,
    intendedTimes: props.getProperty('KHAO_NEWS_SCHEDULE') || '',
    triggerCount: triggers.length,
    triggers: triggers.map(function(t) {
      return { handler: t.getHandlerFunction(), eventType: String(t.getEventType()), source: String(t.getTriggerSource()), id: t.getUniqueId() };
    })
  };
  Logger.log(JSON.stringify(result));
  return result;
}

function setupKhaoNewsScheduleV1300() {
  var handler = 'dailyPortfolioReportV748';
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction && t.getHandlerFunction() === handler) ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger(handler).timeBased().atHour(10).nearMinute(0).everyDays(1).inTimezone(TZ).create();
  ScriptApp.newTrigger(handler).timeBased().atHour(19).nearMinute(30).everyDays(1).inTimezone(TZ).create();
  PropertiesService.getScriptProperties().setProperty('KHAO_NEWS_SCHEDULE', '10:00,19:30 Asia/Bangkok');
  return getKhaoNewsScheduleStatusV1300();
}
