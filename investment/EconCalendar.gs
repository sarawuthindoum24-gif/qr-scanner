/**
 * EconCalendar.gs
 * ระบบอัพเดตปฏิทินเศรษฐกิจ + ข่าว FED + ข่าวหุ้น พร้อมแจ้งเตือน (ภาษาไทย)
 * ----------------------------------------------------------------------
 * - ดึงปฏิทินเศรษฐกิจ + ข่าว จาก Finnhub (ใช้ FINNHUB_API_KEY เดิม)
 * - สรุปเป็นภาษาไทยด้วย NVIDIA AI API (OpenAI-compatible)
 * - ส่งแจ้งเตือนผ่าน LINE (ใช้ LINE_TOKEN / LINE_USER_ID เดิม)
 * - กันแจ้งซ้ำด้วย CacheService / Script Properties
 *
 * Script Properties ที่ต้องตั้งค่าเอง (Project Settings > Script Properties):
 *   NVIDIA_API_KEY   -> คีย์ NVIDIA (สร้างใหม่ อย่าใช้ตัวที่หลุดแล้ว)
 * ที่มีอยู่แล้วในโปรเจกต์ (ใช้ซ้ำ):
 *   FINNHUB_API_KEY, LINE_TOKEN, LINE_USER_ID
 * ตัวเลือกเสริม:
 *   NVIDIA_MODEL     -> ค่าเริ่มต้น "meta/llama-3.1-70b-instruct"
 *   ECON_IMPACT_MIN  -> ระดับผลกระทบขั้นต่ำที่จะแจ้ง (low/medium/high) ค่าเริ่มต้น "high"
 */

// ==================== CONFIG ====================
var EC_CONFIG = {
  NVIDIA_ENDPOINT: 'https://integrate.api.nvidia.com/v1/chat/completions',
  DEFAULT_MODEL: 'meta/llama-3.1-70b-instruct',
  FINNHUB_BASE: 'https://finnhub.io/api/v1',
  NEWS_CATEGORY: 'general',   // general | forex | crypto | merger
  MAX_NEWS: 6,                // จำนวนข่าวสูงสุดต่อรอบ
  MAX_EVENTS: 10,             // จำนวนอีเวนต์ปฏิทินสูงสุดต่อรอบ
  CACHE_HOURS: 6              // กันแจ้งซ้ำภายในกี่ชั่วโมง
};

function EC_props_() { return PropertiesService.getScriptProperties(); }
function EC_get_(k, d) { var v = EC_props_().getProperty(k); return (v === null || v === undefined || v === '') ? d : v; }

// ==================== MAIN ENTRY (ตั้ง Trigger เรียกฟังก์ชันนี้) ====================
function ecRunAll() {
  var summaryLines = [];
  try {
    var events = ecFetchEconomicCalendar_();
    var news   = ecFetchMarketNews_();

    var newEvents = ecFilterUnseen_(events, 'ev');
    var newNews   = ecFilterUnseen_(news, 'nw');

    if (newEvents.length === 0 && newNews.length === 0) {
      Logger.log('ไม่มีข้อมูลใหม่ในรอบนี้');
      return { ok: true, message: 'ไม่มีข้อมูลใหม่' };
    }

    var rawText = ecBuildRawText_(newEvents, newNews);
    var thaiMsg = ecSummarizeThai_(rawText);

    ecSendLine_(thaiMsg);
    ecMarkSeen_(newEvents, 'ev');
    ecMarkSeen_(newNews, 'nw');

    Logger.log('ส่งแจ้งเตือนเรียบร้อย: ' + newEvents.length + ' อีเวนต์, ' + newNews.length + ' ข่าว');
    return { ok: true, events: newEvents.length, news: newNews.length, message: thaiMsg };
  } catch (e) {
    Logger.log('ERROR ecRunAll: ' + e);
    return { ok: false, error: String(e) };
  }
}

// ==================== ดึงปฏิทินเศรษฐกิจ ====================
function ecFetchEconomicCalendar_() {
  // ใช้ RSS ฟรีจาก property INVESTING_RSS_URLS (คั่นหลาย URL ด้วยเครื่องหมายจุลภาค , หรือขึ้นบรรทัดใหม่)
  var raw = EC_get_('INVESTING_RSS_URLS', '');
  if (!raw) {
    // ค่าเริ่มต้น: RSS ข่าวเศรษฐกิจ/เฟด จากแหล่งฟรี
    raw = 'https://www.investing.com/rss/news_25.rss'; // Economic Indicators News
  }
  var urls = raw.split(/[,\n]+/).map(function(s){return s.trim();}).filter(String);
  var events = [];
  var kw = /fed|federal reserve|fomc|powell|rate|inflation|cpi|ppi|gdp|payroll|jobs|unemployment|treasury|เฟด|ดอกเบี้ย|เงินเฟ้อ/i;
  urls.forEach(function(u){
    try {
      var res = UrlFetchApp.fetch(u, { muteHttpExceptions: true, followRedirects: true });
      if (res.getResponseCode() !== 200) { Logger.log('RSS ' + u + ': HTTP ' + res.getResponseCode()); return; }
      var items = ecParseRss_(res.getContentText());
      items.forEach(function(it){
        var t = (it.title || '') + ' ' + (it.desc || '');
        if (kw.test(t)) {
          events.push({
            id: 'ev_' + (it.guid || it.link || it.title || '').slice(0, 60),
            title: it.title || '(ไม่มีชื่อ)',
            country: '',
            time: it.pubDate || '',
            impact: 'rss',
            actual: '', estimate: '', prev: ''
          });
        }
      });
    } catch(e){ Logger.log('RSS error ' + u + ': ' + e); }
  });
  return events.slice(0, EC_CONFIG.MAX_EVENTS);
}

// ==================== ตัวแยกวิเคราะห์ RSS (XML) ====================
function ecParseRss_(xml) {
  var out = [];
  try {
    var doc = XmlService.parse(xml);
    var root = doc.getRootElement();
    var channel = root.getChild('channel');
    var items = channel ? channel.getChildren('item') : root.getChildren('item');
    // รองรับ Atom feed ด้วย
    if ((!items || !items.length)) {
      var atomNs = XmlService.getNamespace('http://www.w3.org/2005/Atom');
      items = root.getChildren('entry', atomNs);
      (items||[]).forEach(function(en){
        out.push({
          title: en.getChildText('title', atomNs),
          link: '', guid: en.getChildText('id', atomNs),
          pubDate: en.getChildText('updated', atomNs),
          desc: en.getChildText('summary', atomNs) || ''
        });
      });
      return out;
    }
    (items||[]).forEach(function(it){
      out.push({
        title: it.getChildText('title'),
        link: it.getChildText('link'),
        guid: it.getChildText('guid'),
        pubDate: it.getChildText('pubDate'),
        desc: it.getChildText('description') || ''
      });
    });
  } catch(e){ Logger.log('parseRss error: ' + e); }
  return out;
}

// ==================== ดึงข่าวตลาด/FED ====================
function ecFetchMarketNews_() {
  var key = EC_get_('FINNHUB_API_KEY', '');
  if (!key) throw new Error('ไม่พบ FINNHUB_API_KEY');

  var url = EC_CONFIG.FINNHUB_BASE + '/news?category=' + EC_CONFIG.NEWS_CATEGORY + '&token=' + key;
  var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) {
    Logger.log('ข่าว: HTTP ' + res.getResponseCode());
    return [];
  }
  var data = JSON.parse(res.getContentText() || '[]');
  if (!Array.isArray(data)) return [];

  // เน้นข่าวที่เกี่ยว FED / เศรษฐกิจ / ตลาดหุ้น
  var kw = /fed|federal reserve|rate|inflation|cpi|ppi|fomc|powell|treasury|jobs|payroll|gdp|stock|market|earnings|nasdaq|dow|s&p/i;
  var picked = data.filter(function (n) {
    var t = (n.headline || '') + ' ' + (n.summary || '');
    return kw.test(t);
  });
  if (picked.length === 0) picked = data; // สำรอง

  return picked.slice(0, EC_CONFIG.MAX_NEWS).map(function (n) {
    return {
      id: 'nw_' + (n.id || n.datetime || (n.headline || '').slice(0, 40)),
      title: n.headline || '',
      summary: (n.summary || '').slice(0, 400),
      source: n.source || '',
      url: n.url || ''
    };
  });
}

// ==================== กันแจ้งซ้ำ ====================
function ecFilterUnseen_(items, prefix) {
  var cache = CacheService.getScriptCache();
  return items.filter(function (it) {
    var seen = cache.get(prefix + '_' + it.id);
    return !seen;
  });
}
function ecMarkSeen_(items, prefix) {
  var cache = CacheService.getScriptCache();
  var ttl = EC_CONFIG.CACHE_HOURS * 3600;
  items.forEach(function (it) { cache.put(prefix + '_' + it.id, '1', ttl); });
}

// ==================== รวมข้อความดิบ ====================
function ecBuildRawText_(events, news) {
  var lines = [];
  if (events.length) {
    lines.push('=== ปฏิทินเศรษฐกิจ ===');
    events.forEach(function (e) {
      lines.push('- [' + e.country + '] ' + e.title + ' | เวลา: ' + e.time +
        ' | impact: ' + e.impact +
        ' | actual: ' + e.actual + ' est: ' + e.estimate + ' prev: ' + e.prev);
    });
  }
  if (news.length) {
    lines.push('=== ข่าว FED / ตลาดหุ้น ===');
    news.forEach(function (n) {
      lines.push('- ' + n.title + ' (' + n.source + '): ' + n.summary);
    });
  }
  return lines.join('\n');
}

// ==================== สรุปเป็นภาษาไทยด้วย NVIDIA AI ====================
function ecSummarizeThai_(rawText) {
  var apiKey = EC_get_('NVIDIA_API_KEY', '');
  if (!apiKey) {
    // ถ้ายังไม่ตั้งคีย์ NVIDIA -> ส่งข้อมูลดิบไปก่อน
    return '⚠️ (ยังไม่ได้ตั้งค่า NVIDIA_API_KEY - ส่งข้อมูลดิบ)\n\n' + rawText;
  }
  var model = EC_get_('NVIDIA_MODEL', EC_CONFIG.DEFAULT_MODEL);

  var payload = {
    model: model,
    messages: [
      { role: 'system', content: 'คุณเป็นนักวิเคราะห์การเงิน สรุปข่าวเศรษฐกิจและปฏิทินเศรษฐกิจเป็นภาษาไทยแบบกระชับ อ่านง่าย เป็นหัวข้อ bullet เน้นผลกระทบต่อตลาดหุ้นและทิศทางดอกเบี้ย FED ความยาวไม่เกิน 10 บรรทัด' },
      { role: 'user', content: 'ช่วยสรุปข้อมูลต่อไปนี้เป็นภาษาไทย:\n\n' + rawText }
    ],
    temperature: 0.3,
    max_tokens: 700
  };

  var res = UrlFetchApp.fetch(EC_CONFIG.NVIDIA_ENDPOINT, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'Authorization': 'Bearer ' + apiKey },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  if (res.getResponseCode() !== 200) {
    Logger.log('NVIDIA API: HTTP ' + res.getResponseCode() + ' ' + res.getContentText());
    return '⚠️ (สรุป AI ไม่สำเร็จ - ส่งข้อมูลดิบ)\n\n' + rawText;
  }
  var data = JSON.parse(res.getContentText() || '{}');
  var msg = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  return '📊 สรุปเศรษฐกิจ/ข่าวหุ้น (' + Utilities.formatDate(new Date(), 'Asia/Bangkok', 'dd/MM HH:mm') + ')\n\n' + (msg || rawText);
}

// ==================== ส่ง LINE ====================
function ecSendLine_(text) {
  Logger.log('V13: economic/news LINE push disabled in investment; owner is Khao');
  return false;
}

function ecInstallTrigger() {
  // ลบ trigger เดิมของ ecRunAll กันซ้ำ
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'ecRunAll') ScriptApp.deleteTrigger(t);
  });
  // ทุก 1 ชั่วโมง
  ScriptApp.newTrigger('ecRunAll').timeBased().everyHours(1).create();
  Logger.log('ติดตั้ง trigger: ecRunAll ทุก 1 ชั่วโมง เรียบร้อย');
}

// ==================== ทดสอบเชื่อมต่อ NVIDIA ====================
function ecTestNvidia() {
  var out = ecSummarizeThai_('=== ทดสอบ ===\n- FOMC ประกาศคงดอกเบี้ยที่ 5.25-5.50%\n- CPI สหรัฐ 3.2% ต่ำกว่าคาด');
  Logger.log(out);
  return out;
}


// ==================== ตรวจสอบคีย์ (ปลอดภัย ไม่โชว์ค่าจริง) ====================
function ecDiagKey() {
  var p = PropertiesService.getScriptProperties();
  var k = p.getProperty('NVIDIA_API_KEY');
  if (!k) { Logger.log('X ไม่พบ NVIDIA_API_KEY เลย - ยังไม่ได้ตั้งค่า'); return; }
  var masked = k.length > 8 ? (k.slice(0,6) + '...' + k.slice(-4)) : '(สั้นผิดปกติ)';
  Logger.log('OK พบคีย์ | ความยาว: ' + k.length +
             ' | ขึ้นต้นด้วย nvapi-: ' + (k.indexOf('nvapi-')===0) +
             ' | มีช่องว่าง/ขึ้นบรรทัด: ' + (/\s/.test(k)) +
             ' | ตัวอย่าง: ' + masked);
  Logger.log('โมเดลที่ใช้: ' + (p.getProperty('NVIDIA_MODEL') || 'meta/llama-3.1-70b-instruct'));
}


// ==================== ทดสอบปฏิทิน RSS ====================
function ecTestCalendar() {
  var raw = EC_get_('INVESTING_RSS_URLS', '(ใช้ค่าเริ่มต้น)');
  Logger.log('RSS URLs ที่ตั้งไว้: ' + raw);
  var ev = ecFetchEconomicCalendar_();
  Logger.log('พบอีเวนต์/ข่าวเศรษฐกิจ: ' + ev.length + ' รายการ');
  ev.slice(0,5).forEach(function(e,i){ Logger.log((i+1)+'. '+e.title+' | '+e.time); });
  return ev;
}


// ==================================================================
// Market Dashboard ก่อนตลาดหุ้นสหรัฐฯ เปิด (ข่าว + ปฏิทินหัวข้อ)
// - ไม่มีตัวเลข Actual/Forecast/Previous (RSS ฟรีให้ไม่ได้ + เลี่ยงข้อมูลมั่ว)
// - วิเคราะห์แบบ 'ความอ่อนไหว/ผลกระทบเชิงกลไก' ไม่ฟันธงซื้อ/ขาย
// ==================================================================
var EC_PORTFOLIO = 'VOO, QQQM, AVGO, TSM, ASML, AMD, MU, NBIS, RKLB';

function ecMarketDashboard() {
  try {
    var events = ecFetchEconomicCalendar_(); // หัวข้อปฏิทิน/ข่าวเฟด (RSS)
    var news   = ecFetchMarketNews_();        // ข่าวตลาด (Finnhub news)
    var rawText = ecBuildRawText_(events, news);
    var stockText = ecBuildStockText_(); // earnings + ข่าวหุ้นรายตัวในพอร์ต
    if (stockText) rawText = rawText + '\n\n' + stockText;
    if (!rawText) rawText = '(ไม่พบข่าว/ปฏิทินใหม่ในรอบนี้)';
    var msg = ecDashboardSummarize_(rawText);
    ecSendLine_(msg);
    Logger.log('ส่ง Market Dashboard เรียบร้อย');
    return { ok: true, message: msg };
  } catch (e) {
    Logger.log('ERROR ecMarketDashboard: ' + e);
    return { ok: false, error: String(e) };
  }
}

function ecDashboardSummarize_(rawText) {
  var apiKey = EC_get_('NVIDIA_API_KEY', '');
  var head = 'US Market Dashboard ก่อนตลาดเปิด (' + Utilities.formatDate(new Date(),'Asia/Bangkok','dd/MM/yyyy') + ')\n\n';
  if (!apiKey) return head + '(ยังไม่ได้ตั้ง NVIDIA_API_KEY)\n\n' + rawText;
  var model = EC_get_('NVIDIA_MODEL', EC_CONFIG.DEFAULT_MODEL);
  var sys = 'คุณเป็นนักวิเคราะห์การเงิน สรุปเป็นภาษาไทยแบบ dashboard กระชับ อ่านง่าย เป็นหัวข้อ. ' +
    'ห้ามแต่งตัวเลข Actual/Forecast/Previous ที่ไม่มีในข้อมูล ให้พูดถึงเฉพาะหัวข้อ/ทิศทางที่ปรากฏจริงเท่านั้น. ' +
    'โครงสร้าง: 1) ข่าว/ปฏิทินสำคัญวันนี้ 2) ภาพรวมมหภาค (Fed/เงินเฟ้อ/การจ้างงาน/bond yield/น้ำมัน/ทอง เท่าที่มีข่าว) ' +
    '3) ความอ่อนไหวต่อพอร์ต: อธิบายเชิงกลไกว่าหุ้นแต่ละกลุ่มอ่อนไหวต่อปัจจัยไหนอย่างไร (เช่น เงินเฟ้อสูง/ดอกเบี้ยสูง กดดันหุ้น growth และ semiconductor). ' +
    'สำคัญมาก: ห้ามให้คำแนะนำซื้อ/ขาย/ถือ ห้ามฟันธงว่าควรทำอะไรกับหุ้น ให้เป็นการอธิบายกลไกและความอ่อนไหวเท่านั้น. ' +
    'ปิดท้ายด้วยประโยคเตือนว่านี่เป็นข้อมูลเพื่อการศึกษา ไม่ใช่คำแนะนำการลงทุน.';
  var user = 'พอร์ตที่ถือ: ' + EC_PORTFOLIO + '\n\nข้อมูลข่าว/ปฏิทินวันนี้:\n' + rawText;
  var payload = { model: model, messages: [ {role:'system',content:sys}, {role:'user',content:user} ], temperature: 0.3, max_tokens: 900 };
  var res = UrlFetchApp.fetch(EC_CONFIG.NVIDIA_ENDPOINT, { method:'post', contentType:'application/json', headers:{'Authorization':'Bearer '+apiKey}, payload:JSON.stringify(payload), muteHttpExceptions:true });
  if (res.getResponseCode() !== 200) { Logger.log('NVIDIA dashboard: HTTP '+res.getResponseCode()+' '+res.getContentText()); return head + '(สรุป AI ไม่สำเร็จ)\n\n' + rawText; }
  var data = JSON.parse(res.getContentText()||'{}');
  var out = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  return head + (out || rawText);
}

// ตั้ง trigger: ส่ง dashboard จันทร์-ศุกร์ 19:30 น. (เวลาไทย)
function ecInstallDashboardTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(t){ if (t.getHandlerFunction()==='ecMarketDashboard') ScriptApp.deleteTrigger(t); });
  var days = [ScriptApp.WeekDay.MONDAY, ScriptApp.WeekDay.TUESDAY, ScriptApp.WeekDay.WEDNESDAY, ScriptApp.WeekDay.THURSDAY, ScriptApp.WeekDay.FRIDAY];
  days.forEach(function(d){ ScriptApp.newTrigger('ecMarketDashboard').timeBased().onWeekDay(d).atHour(19).nearMinute(30).inTimezone('Asia/Bangkok').create(); });
  Logger.log('ติดตั้ง trigger: ecMarketDashboard จันทร์-ศุกร์ 19:30 น. (เวลาไทย) เรียบร้อย');
}

// ทดสอบส่ง dashboard ทันที
function ecTestDashboard() { var r = ecMarketDashboard(); Logger.log(r.message || r.error); return r; }


// ==================== ทดสอบว่า RSS feed ไหนเข้าถึงได้ ====================
function ecTestRssFeeds() {
  var candidates = [
    'https://www.investing.com/rss/news_25.rss',   // Economic Indicators
    'https://www.investing.com/rss/news_285.rss',  // Economy News
    'https://www.investing.com/rss/news_95.rss',   // Central Banks
    'https://www.investing.com/rss/news_1.rss',    // Latest News
    'https://www.investing.com/rss/news_356.rss',  // Stock Market News
    'https://www.investing.com/rss/stock_stock_picks.rss', // Stock Picks
    'https://th.investing.com/rss/news_25.rss'     // TH Economic Indicators
  ];
  var ok = [];
  candidates.forEach(function(u){
    try {
      var res = UrlFetchApp.fetch(u, { muteHttpExceptions:true, followRedirects:true });
      var code = res.getResponseCode();
      var n = 0;
      if (code === 200) { n = ecParseRss_(res.getContentText()).length; if (n>0) ok.push(u); }
      Logger.log(code + ' | items=' + n + ' | ' + u);
    } catch(e){ Logger.log('ERR | ' + u + ' | ' + e); }
  });
  Logger.log('===> feed ที่ใช้ได้: ' + ok.length + ' อัน');
  Logger.log(ok.join('\n'));
  return ok;
}


// ==================== ตั้งค่า RSS feeds ของ Investing (รันครั้งเดียว) ====================
function ecSetInvestingFeeds() {
  var feeds = [
    'https://www.investing.com/rss/news_25.rss',  // Economic Indicators
    'https://www.investing.com/rss/news_285.rss', // Economy
    'https://www.investing.com/rss/news_95.rss',  // Central Banks (เฟด/ธนาคารกลาง)
    'https://www.investing.com/rss/news_356.rss'  // Stock Market News
  ].join(',');
  PropertiesService.getScriptProperties().setProperty('INVESTING_RSS_URLS', feeds);
  Logger.log('ตั้งค่า INVESTING_RSS_URLS = ' + feeds);
}


// ==================== ทดสอบ endpoint หุ้นรายตัว/earnings ของ Finnhub ====================
function ecTestStockEndpoints() {
  var key = EC_get_('FINNHUB_API_KEY','');
  if (!key) { Logger.log('ไม่พบ FINNHUB_API_KEY'); return; }
  var base = EC_CONFIG.FINNHUB_BASE;
  var today = new Date();
  var from = Utilities.formatDate(new Date(today.getTime()-7*86400000),'GMT','yyyy-MM-dd');
  var to = Utilities.formatDate(today,'GMT','yyyy-MM-dd');
  var toE = Utilities.formatDate(new Date(today.getTime()+30*86400000),'GMT','yyyy-MM-dd');
  var tests = [
    ['company-news AMD', base+'/company-news?symbol=AMD&from='+from+'&to='+to+'&token='+key],
    ['company-news TSM', base+'/company-news?symbol=TSM&from='+from+'&to='+to+'&token='+key],
    ['earnings-calendar', base+'/calendar/earnings?from='+to+'&to='+toE+'&token='+key],
    ['earnings-calendar AMD', base+'/calendar/earnings?from='+to+'&to='+toE+'&symbol=AMD&token='+key]
  ];
  tests.forEach(function(t){
    try {
      var res = UrlFetchApp.fetch(t[1], {muteHttpExceptions:true});
      var code = res.getResponseCode();
      var body = res.getContentText()||'';
      var n = '-';
      try { var j = JSON.parse(body); if (Array.isArray(j)) n=j.length; else if (j.earningsCalendar) n=j.earningsCalendar.length; } catch(e){}
      Logger.log(code + ' | count=' + n + ' | ' + t[0] + ' | ' + body.slice(0,120));
    } catch(e){ Logger.log('ERR | ' + t[0] + ' | ' + e); }
  });
}


// ==================================================================
// ข่าวหุ้นรายตัว + ปฏิทินผลประกอบการ (earnings) สำหรับหุ้นในพอร์ต
// ==================================================================
// ticker ที่จะติดตาม (ข้าม VOO เพราะเป็น ETF ไม่มีข่าว/งบรายตัว)
var EC_STOCK_TICKERS = ['QQQM','AVGO','TSM','ASML','AMD','MU','NBIS','RKLB'];

function ecFetchStockNews_() {
  var key = EC_get_('FINNHUB_API_KEY',''); if (!key) return [];
  var today = new Date();
  var from = Utilities.formatDate(new Date(today.getTime()-3*86400000),'GMT','yyyy-MM-dd');
  var to = Utilities.formatDate(today,'GMT','yyyy-MM-dd');
  var out = [];
  EC_STOCK_TICKERS.forEach(function(sym){
    try {
      var url = EC_CONFIG.FINNHUB_BASE + '/company-news?symbol=' + sym + '&from=' + from + '&to=' + to + '&token=' + key;
      var res = UrlFetchApp.fetch(url, {muteHttpExceptions:true});
      if (res.getResponseCode() !== 200) return;
      var arr = JSON.parse(res.getContentText()||'[]');
      if (!Array.isArray(arr) || !arr.length) return;
      // เอาข่าวล่าสุด 1-2 ข่าวต่อ ticker
      arr.slice(0,2).forEach(function(n){
        out.push({ id:'st_'+sym+'_'+(n.id||n.datetime), sym:sym, title:n.headline||'', source:n.source||'' });
      });
    } catch(e){ Logger.log('stock news '+sym+': '+e); }
    Utilities.sleep(200); // กัน rate limit
  });
  return out;
}

function ecFetchEarnings_() {
  var key = EC_get_('FINNHUB_API_KEY',''); if (!key) return [];
  var today = new Date();
  var from = Utilities.formatDate(today,'GMT','yyyy-MM-dd');
  var to = Utilities.formatDate(new Date(today.getTime()+21*86400000),'GMT','yyyy-MM-dd'); // ล่วงหน้า 3 สัปดาห์
  var setTk = {}; EC_STOCK_TICKERS.forEach(function(s){ setTk[s]=true; });
  try {
    var url = EC_CONFIG.FINNHUB_BASE + '/calendar/earnings?from=' + from + '&to=' + to + '&token=' + key;
    var res = UrlFetchApp.fetch(url, {muteHttpExceptions:true});
    if (res.getResponseCode() !== 200) return [];
    var data = JSON.parse(res.getContentText()||'{}');
    var arr = data.earningsCalendar || [];
    return arr.filter(function(e){ return setTk[e.symbol]; }).map(function(e){
      var when = e.hour==='bmo' ? 'ก่อนตลาดเปิด' : (e.hour==='amc' ? 'หลังตลาดปิด' : '');
      return { sym:e.symbol, date:e.date, when:when, epsEst:e.epsEstimate };
    });
  } catch(e){ Logger.log('earnings: '+e); return []; }
}

// สร้างข้อความส่วนหุ้นรายตัว + earnings (เพิ่มเข้าไปใน dashboard)
function ecBuildStockText_() {
  var lines = [];
  var earn = ecFetchEarnings_();
  if (earn.length) {
    lines.push('=== ผลประกอบการที่กำลังจะมาถึง (หุ้นในพอร์ต) ===');
    earn.forEach(function(e){
      lines.push('- ' + e.sym + ' รายงานงบ ' + e.date + (e.when?(' ('+e.when+')'):'') + (e.epsEst!=null?(' | EPS คาด '+e.epsEst):''));
    });
  }
  var news = ecFetchStockNews_();
  if (news.length) {
    lines.push('=== ข่าวหุ้นรายตัวในพอร์ต ===');
    news.forEach(function(n){ lines.push('- [' + n.sym + '] ' + n.title + ' (' + n.source + ')'); });
  }
  return lines.join('\n');
}


// ==================== ดูรายการงบที่จะประกาศ (ทดสอบ) ====================
function ecShowEarnings() {
  var e = ecFetchEarnings_();
  Logger.log('หุ้นในพอร์ตที่จะประกาศงบใน 3 สัปดาห์: ' + e.length + ' ตัว');
  var today = new Date(); today.setHours(0,0,0,0);
  e.sort(function(a,b){ return a.date < b.date ? -1 : 1; });
  e.forEach(function(x){
    var d = new Date(x.date + 'T00:00:00');
    var days = Math.round((d - today)/86400000);
    Logger.log(x.sym + ' | ' + x.date + ' | อีก ' + days + ' วัน | ' + (x.when||'') + ' | EPS คาด ' + x.epsEst);
  });
  return e;
}


// ==================================================================
// แจ้งเตือนล่วงหน้าก่อนวันประกาศงบ + วิเคราะห์เชิงกลไก
// - แจ้งเมื่อเหลืออีก 3 วัน / 1 วัน / วันประกาศ (0 วัน)
// - กันแจ้งซ้ำต่อหุ้นต่อจังหวะ ด้วย Script Properties
// ==================================================================
var EC_EARN_ALERT_DAYS = [3, 1, 0]; // จังหวะที่จะแจ้ง (จำนวนวันก่อนประกาศ)

function ecEarningsAlert() {
  try {
    var list = ecFetchEarnings_();
    if (!list.length) { Logger.log('ไม่มีงบที่จะประกาศในช่วงนี้'); return {ok:true, count:0}; }
    var today = new Date(); today.setHours(0,0,0,0);
    var props = PropertiesService.getScriptProperties();
    var sent = 0;
    list.forEach(function(e){
      var d = new Date(e.date + 'T00:00:00');
      var days = Math.round((d - today)/86400000);
      if (EC_EARN_ALERT_DAYS.indexOf(days) === -1) return; // ยังไม่ถึงจังหวะแจ้ง
      var flagKey = 'earnAlert_' + e.sym + '_' + e.date + '_' + days;
      if (props.getProperty(flagKey)) return; // แจ้งจังหวะนี้ไปแล้ว
      var msg = ecBuildEarningsAlert_(e, days);
      ecSendLine_(msg);
      props.setProperty(flagKey, '1');
      sent++;
      Logger.log('แจ้งเตือนงบ ' + e.sym + ' (อีก ' + days + ' วัน)');
    });
    Logger.log('ส่งแจ้งเตือนงบทั้งหมด ' + sent + ' รายการ');
    return {ok:true, count:sent};
  } catch(err){ Logger.log('ERROR ecEarningsAlert: ' + err); return {ok:false, error:String(err)}; }
}

function ecBuildEarningsAlert_(e, days) {
  var whenTxt = days === 0 ? 'วันนี้!' : ('อีก ' + days + ' วัน');
  var timeTxt = e.when ? (' (' + e.when + ')') : '';
  var raw = 'หุ้น ' + e.sym + ' จะประกาศผลประกอบการ ' + e.date + timeTxt + ' — ' + whenTxt + '\n' +
            'EPS ที่นักวิเคราะห์คาด: ' + (e.epsEst!=null ? e.epsEst : 'ไม่มีข้อมูล') + '\n';
  // ดึงข่าวล่าสุดของหุ้นตัวนี้มาประกอบการวิเคราะห์
  var newsCtx = ecOneStockNews_(e.sym);
  if (newsCtx) raw += '\nข่าวล่าสุดของ ' + e.sym + ':\n' + newsCtx;
  var analysis = ecEarningsAnalyze_(e, days, newsCtx);
  return '📣 เตือนประกาศงบ: ' + e.sym + ' (' + whenTxt + ')\n\n' + analysis;
}

function ecOneStockNews_(sym) {
  var key = EC_get_('FINNHUB_API_KEY',''); if (!key) return '';
  var today = new Date();
  var from = Utilities.formatDate(new Date(today.getTime()-5*86400000),'GMT','yyyy-MM-dd');
  var to = Utilities.formatDate(today,'GMT','yyyy-MM-dd');
  try {
    var url = EC_CONFIG.FINNHUB_BASE + '/company-news?symbol=' + sym + '&from=' + from + '&to=' + to + '&token=' + key;
    var res = UrlFetchApp.fetch(url, {muteHttpExceptions:true});
    if (res.getResponseCode() !== 200) return '';
    var arr = JSON.parse(res.getContentText()||'[]');
    if (!Array.isArray(arr)) return '';
    return arr.slice(0,3).map(function(n){ return '- ' + (n.headline||''); }).join('\n');
  } catch(e){ return ''; }
}

function ecEarningsAnalyze_(e, days, newsCtx) {
  var apiKey = EC_get_('NVIDIA_API_KEY','');
  var fallback = 'หุ้น ' + e.sym + ' จะประกาศงบ ' + e.date + (e.when?(' ('+e.when+')'):'') +
    ' | EPS คาด ' + (e.epsEst!=null?e.epsEst:'-') + '\n(ยังไม่ได้ตั้งค่า NVIDIA_API_KEY จึงไม่มีบทวิเคราะห์)';
  if (!apiKey) return fallback;
  var model = EC_get_('NVIDIA_MODEL', EC_CONFIG.DEFAULT_MODEL);
  var sys = 'คุณเป็นนักวิเคราะห์การเงิน อธิบายเป็นภาษาไทยกระชับ เกี่ยวกับการประกาศผลประกอบการของหุ้นที่กำลังจะมาถึง. ' +
    'ให้ครอบคลุม: (1) สรุปว่าหุ้นตัวนี้ทำธุรกิจอะไรสั้นๆ (2) ตลาดคาดหวังอะไรจากงบรอบนี้ (อ้างอิง EPS ที่คาด ถ้ามี) ' +
    '(3) ปัจจัย/ตัวเลขที่ควรจับตาในงบ (เช่น รายได้ ดาต้าเซ็นเตอร์ AI กำลังการผลิต ฯลฯ) (4) ความอ่อนไหวเชิงกลไก: ถ้างบดี/แย่กว่าคาด ' +
    'มักส่งผลต่อราคาหุ้นและกลุ่มที่เกี่ยวข้องอย่างไร. ' +
    'ห้ามแต่งตัวเลขที่ไม่มีในข้อมูล. สำคัญมาก: ห้ามให้คำแนะนำซื้อ/ขาย/ถือ เป็นการอธิบายกลไกเท่านั้น. ' +
    'ปิดท้ายด้วยประโยคเตือนว่าเป็นข้อมูลเพื่อการศึกษา ไม่ใช่คำแนะนำการลงทุน.';
  var user = 'หุ้น: ' + e.sym + '\nวันประกาศงบ: ' + e.date + (e.when?(' ('+e.when+')'):'') + ' (อีก ' + days + ' วัน)\n' +
    'EPS ที่คาด: ' + (e.epsEst!=null?e.epsEst:'ไม่มีข้อมูล') + '\n' +
    (newsCtx ? ('ข่าวล่าสุด:\n'+newsCtx) : '');
  var payload = { model:model, messages:[{role:'system',content:sys},{role:'user',content:user}], temperature:0.3, max_tokens:700 };
  try {
    var res = UrlFetchApp.fetch(EC_CONFIG.NVIDIA_ENDPOINT, {method:'post',contentType:'application/json',headers:{'Authorization':'Bearer '+apiKey},payload:JSON.stringify(payload),muteHttpExceptions:true});
    if (res.getResponseCode() !== 200) { Logger.log('NVIDIA earn: HTTP '+res.getResponseCode()); return fallback; }
    var data = JSON.parse(res.getContentText()||'{}');
    var out = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    return out || fallback;
  } catch(err){ Logger.log('earn analyze err: '+err); return fallback; }
}

// ตั้ง trigger: เช็ควันประกาศงบทุกวัน 08:00 น. (เวลาไทย)
function ecInstallEarningsTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(t){ if (t.getHandlerFunction()==='ecEarningsAlert') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('ecEarningsAlert').timeBased().everyDays(1).atHour(8).create();
  Logger.log('ติดตั้ง trigger: ecEarningsAlert ทุกวัน ~08:00 น. เรียบร้อย');
}

// ทดสอบส่งแจ้งเตือนงบทันที (บังคับส่งตัวแรกในลิสต์ ไม่สนใจจังหวะวัน/กันซ้ำ)
function ecTestEarningsAlert() {
  var list = ecFetchEarnings_();
  if (!list.length) { Logger.log('ไม่มีงบที่จะประกาศ'); return; }
  var today = new Date(); today.setHours(0,0,0,0);
  var e = list[0];
  var d = new Date(e.date + 'T00:00:00');
  var days = Math.round((d - today)/86400000);
  var msg = ecBuildEarningsAlert_(e, days);
  ecSendLine_(msg);
  Logger.log(msg);
  return msg;
}

