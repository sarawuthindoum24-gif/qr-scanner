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

const V748 = '10.2-openrouter-buy-alert-confirm-flow';
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

  // V10.1 Buy Alert module: must be checked before generic symbol/buy commands.
  // Handles: setalert, alert, checkalert, ai ASTS, autoalert ASTS,
  // and short pending replies: ซื้อแล้ว / ยังไม่ซื้อ / ยืนยัน / ยกเลิก.
  if (typeof handleBuyAlertCommandV1000_ === 'function' && handleBuyAlertCommandV1000_(textRaw, replyToken)) {
    return;
  }

  // V13 role gate: investment owns portfolio, cost basis and average-down workflows.
  if (['ข่าว','news','dailynews','สรุปข่าว','mocknews','ข่าวทดลอง','ทดลองข่าว','testnews','setupnews','ตั้งข่าวทุกวัน','ตั้งข่าว'].indexOf(text) >= 0) {
    replyLine(replyToken, '📰 ข่าวหุ้นและปฏิทินเศรษฐกิจ ให้ใช้บอท Khao');
    return;
  }
  const investmentAnalysisCommandV1300 = ['เช็คทั้งหมด','เช็กทั้งหมด','all','fullscan','scanall','วิเคราะห์','report','รายงาน','ซื้อ','ซื้ออะไร','buy'].indexOf(text) >= 0;
  const investmentSymbolOnlyV1300 = /^[A-Za-z][A-Za-z0-9.\-]{0,11}$/.test(textRaw) && ['help','menu','health','alert','checkalert'].indexOf(text) < 0;
  if (investmentAnalysisCommandV1300 || investmentSymbolOnlyV1300) {
    replyLine(replyToken, '📊 วิเคราะห์หุ้นและคำแนะนำจังหวะซื้อ ให้ใช้บอท Grace\ninvestment รับผิดชอบพอร์ต ต้นทุน และการถัวเฉลี่ย');
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

  if (['mocknews', 'ข่าวทดลอง', 'ทดลองข่าว', 'testnews'].indexOf(text) >= 0) {
    replyLine(replyToken, '⏳ รับคำสั่งแล้ว: สร้าง Mockup ข่าวหุ้นจาก Yahoo + Investing เพื่อทดลองรูปแบบก่อน');
    enqueueTaskV748_({ type: 'NEWS_MOCK', createdAt: new Date().toISOString() });
    return;
  }

  if (['setupnews', 'ตั้งข่าวทุกวัน', 'ตั้งข่าว', 'dailynewssetup'].indexOf(text) >= 0) {
    try {
      replyLine(replyToken, setupDailyNewsTriggerV1100(20, 30));
    } catch (err) {
      replyLine(replyToken, '❌ ตั้ง Daily News Trigger ไม่สำเร็จ: ' + err.message);
    }
    return;
  }

  if (['ข่าว', 'news', 'dailynews', 'สรุปข่าว'].indexOf(text) >= 0) {
    replyLine(replyToken, '⏳ รับคำสั่งแล้ว: สรุปข่าวหุ้นวันนี้จาก Yahoo + Investing + แผนซื้อ 3 ไม้\nระบบจะส่งผลลัพธ์เป็นข้อความถัดไป ไม่ต้องพิมพ์ซ้ำ');
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
  // === AI Agentic fallback (V1): ถ้าไม่ match คำสั่งเดิม ให้ agent ลองตอบก่อน ===
  try {
    if (typeof runAgentV1_ === 'function') {
      var _agentUserId = (event && event.source && event.source.userId) ? event.source.userId : 'default';
      var _agentReply = runAgentV1_(textRaw, _agentUserId);
      if (_agentReply) { replyLine(replyToken, _agentReply); return; }
    }
  } catch (agentErr) { /* fall through to default help */ }


  replyLine(replyToken, 'พิมพ์คำสั่งได้ เช่น\n• ASTS / NVDA / VOO / CPALL\n• เช็คทั้งหมด\n• ข่าว\n• health');
}

function enqueueTaskV748_(task) {
  const props = PropertiesService.getScriptProperties();

  // V7.7.1: prevent stale queued tasks from replying with the wrong ticker.
  // LINE commands are interactive, so the latest command should win.
  let queue = [];
  try { queue = JSON.parse(props.getProperty(TASK_PROP_KEY) || '[]'); } catch (e) { queue = []; }
  if (task && ['SYMBOL','FULL_SCAN','BUY_CHECKLIST','NEWS_BUY3','NEWS_MOCK','HEALTH','RM_REVIEW','CHECK_BUY_ALERTS','AI_SYMBOL','AUTO_ALERT','SMART_ALERT'].indexOf(task.type) >= 0) {
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
    } else if (task.type === 'NEWS_MOCK') {
      sendManyLine(buildDailyStockNewsReportV1100(true));
    } else if (task.type === 'BUY_CHECKLIST') {
      sendManyLine(buildBuyChecklistReportV752());
    } else if (task.type === 'RM_REVIEW') {
      sendLine(buildPortfolioReviewRMReportV770());
    } else if (task.type === 'CHECK_BUY_ALERTS') {
      sendManyLine(checkBuyAlertsNowV1000(true));
    } else if (task.type === 'AI_SYMBOL') {
      sendLine(buildAiDecisionReportV1000_(task.symbol));
    } else if (task.type === 'AUTO_ALERT') {
      sendLine(createAutoBuyAlertFromAnalysisV1000_(task.symbol));
    } else if (task.type === 'SMART_ALERT') {
      sendLine(createSmartAlertProposalV1110_(task.symbol, task.amounts || [], task.repeatMinutes));
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
  const orKey = props.getProperty('OPENROUTER_API_KEY');
  const orModel = props.getProperty('OPENROUTER_MODEL') || 'openrouter/auto';
  const ba = props.getProperty('BUY_ALERT_SHEET_ID');

  sendLine([
    '🧪 Debug v' + V748,
    'LINE_TOKEN: ' + (token ? '✅ set' : '❌ missing'),
    'LINE_USER_ID: ' + (userId ? '✅ set' : '⚠️ missing (push เท่านั้น)'),
    'TWELVE_DATA_API_KEY: ' + (td ? '✅ set' : '⚠️ missing'),
    'FINNHUB_API_KEY: ' + (fh ? '✅ set' : '⚠️ missing'),
    'OPENROUTER_API_KEY: ' + (orKey ? '✅ set' : '⚠️ missing'),
    'OPENROUTER_MODEL: ' + orModel,
    'BUY_ALERT_SHEET_ID: ' + (ba ? '✅ set' : '⚠️ missing - run setupBuyAlertSheetV1000'),
    'Mode: Stockify + Buy Alert Confirm Flow + OpenRouter'
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
  Logger.log('V13: automatic analysis report disabled for investment role');
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
    '💼 investment — พอร์ต ต้นทุน และถัวเฉลี่ย',
    '━━━━━━━━━━━━━━━━━━━━',
    '• สรุปพอร์ต = ดูทุกพอร์ต',
    '• สรุปพอร์ต Dime = ดูเฉพาะพอร์ต',
    '• ถัว NVDA เพิ่ม 5000 บาท ที่ 190 พอร์ต Dime',
    '• ถัว AMD เพิ่ม 100 usd ที่ 60 พอร์ต Hundred',
    '• บันทึกถัว NVDA Dime = บันทึกหลังตรวจตัวเลข',
    '• ตั้งต้นทุน NVDA = 185 จำนวน 1.5 หุ้น Dime',
    '• ยืนยันตั้งต้นทุน NVDA Dime = บันทึกหลังยืนยัน',
    '• alert / checkalert = ดูและตรวจ Buy Alert',
    '• health = ตรวจระบบ',
    '',
    'ทุกการเขียนพอร์ตต้องยืนยันก่อน ไม่มีการส่งคำสั่งซื้อขายอัตโนมัติ',
    'วิเคราะห์หุ้น/จังหวะซื้อ → Grace',
    'ข่าวหุ้น/ปฏิทินเศรษฐกิจ → Khao',
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
  const n = fetchFinnhubCompanyNewsV880_({ symbol: 'NVDA', currency: 'USD', cat: 'Semiconductor' });
  sendLine(n && n.finnhub > 0
    ? '✅ Finnhub OK: NVDA news ' + n.finnhub + ' ข่าว\nหัวข่าว: ' + (n.headline || '-')
    : '❌ Finnhub failed/no news: ' + (n && n.error ? n.error : 'no relevant news'));
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


/* ============================================================
 * V11.0 LINE CONFIG HELPER
 * - Do not hardcode secrets in source code.
 * - Run once from Apps Script with your own token/user id, or set Script Properties manually.
 * ============================================================ */

function setupLineConfigV1100(channelAccessToken, lineUserId) {
  channelAccessToken = String(channelAccessToken || '').trim();
  lineUserId = String(lineUserId || '').trim();

  if (!channelAccessToken) throw new Error('ใส่ Channel Access Token ก่อน');
  if (!lineUserId) throw new Error('ใส่ LINE User ID ก่อน');

  const props = PropertiesService.getScriptProperties();
  props.setProperty('LINE_TOKEN', channelAccessToken);
  props.setProperty('LINE_USER_ID', lineUserId);

  return '✅ ตั้งค่า LINE_TOKEN และ LINE_USER_ID สำเร็จใน Script Properties\nแนะนำอย่าฝัง token ในไฟล์โค้ด และถ้า token เคยถูกส่งต่อ ให้ regenerate token ใหม่ใน LINE Developers';
}

function testLinePushV1100() {
  sendLine('✅ Stockify LINE Bot ทดสอบส่งข้อความสำเร็จ\nเวลา: ' + Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm'));
}


