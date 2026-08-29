/**
 * EconCalendar.gs - Economic Calendar & Earnings alert system (v1000)
 * Alerts upcoming quarterly earnings (Twelve Data) and Fed/FOMC meetings.
 * NOT part of deploy set validation for News Gate; standalone module.
 * No hardcoded API key (reads TWELVE_DATA_API_KEY from script properties).
 */

var EC_WATCHLIST_V1000 = ['NVDA','AAPL','TSLA','AMZN','GOOGL','MSFT'];

// Earnings alert lead time (days before event).
var EC_EARNINGS_LEAD_DAYS_V1000 = 1;
// FOMC alert lead times (days before meeting) to notify on.
var EC_FOMC_LEAD_DAYS_V1000 = [3, 1, 0];

// Hardcoded FOMC meeting dates (announcement/decision day, US Eastern).
// Source: Federal Reserve published schedule. Update yearly.
var EC_FOMC_DATES_V1000 = [
  '2025-01-29','2025-03-19','2025-05-07','2025-06-18',
  '2025-07-30','2025-09-17','2025-10-29','2025-12-10',
  '2026-01-28','2026-03-18','2026-04-29','2026-06-17',
  '2026-07-29','2026-09-16','2026-10-28','2026-12-09'
];

// ---- date helpers ----
function ecTodayUtc_() {
  var n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
}

function ecParseDate_(s) {
  var p = String(s).slice(0,10).split('-');
  if (p.length !== 3) return null;
  return new Date(Date.UTC(Number(p[0]), Number(p[1]) - 1, Number(p[2])));
}

function ecDaysBetween_(a, b) {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

function ecFmtDate_(d) {
  var y = d.getUTCFullYear();
  var mo = ('0' + (d.getUTCMonth() + 1)).slice(-2);
  var da = ('0' + d.getUTCDate()).slice(-2);
  return y + '-' + mo + '-' + da;
}


// ---- Twelve Data earnings fetch ----
function ecFetchEarningsV1000_(symbol) {
  var key = PropertiesService.getScriptProperties().getProperty('TWELVE_DATA_API_KEY');
  if (!key) return { symbol: symbol, error: 'NO_API_KEY', events: [] };

  var sym = (typeof twelveDataSymbolV870_ === 'function') ? twelveDataSymbolV870_(symbol) : symbol;
  var base = 'https://' + 'api.twelvedata.com' + '/earnings';
  var url = base + '?symbol=' + encodeURIComponent(sym) +
            '&outputsize=6' + '&apikey=' + encodeURIComponent(key);

  try {
    var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    var code = res.getResponseCode();
    if (code !== 200) return { symbol: symbol, error: 'HTTP_' + code, events: [] };
    var data = JSON.parse(res.getContentText() || '{}');
    if (data && data.status === 'error') {
      return { symbol: symbol, error: data.message || 'API_ERROR', events: [] };
    }
    var rows = (data && data.earnings) ? data.earnings : [];
    var events = [];
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (!r || !r.date) continue;
      events.push({
        symbol: symbol,
        date: String(r.date).slice(0,10),
        time: r.time || '',
        epsEstimate: (r.eps_estimate != null ? r.eps_estimate : null),
        epsActual: (r.eps_actual != null ? r.eps_actual : null)
      });
    }
    return { symbol: symbol, error: null, events: events };
  } catch (e) {
    return { symbol: symbol, error: 'FETCH_EXCEPTION', events: [] };
  }
}


// ---- FOMC upcoming check ----
function ecUpcomingFomcV1000_() {
  var today = ecTodayUtc_();
  var out = [];
  for (var i = 0; i < EC_FOMC_DATES_V1000.length; i++) {
    var d = ecParseDate_(EC_FOMC_DATES_V1000[i]);
    if (!d) continue;
    var diff = ecDaysBetween_(today, d);
    if (EC_FOMC_LEAD_DAYS_V1000.indexOf(diff) !== -1) {
      out.push({ date: EC_FOMC_DATES_V1000[i], daysAhead: diff });
    }
  }
  return out;
}

// ---- earnings upcoming check ----
function ecUpcomingEarningsV1000_() {
  var today = ecTodayUtc_();
  var out = [];
  var errors = [];
  for (var i = 0; i < EC_WATCHLIST_V1000.length; i++) {
    var sym = EC_WATCHLIST_V1000[i];
    var r = ecFetchEarningsV1000_(sym);
    if (r.error) { errors.push(sym + ':' + r.error); continue; }
    for (var j = 0; j < r.events.length; j++) {
      var ev = r.events[j];
      var ed = ecParseDate_(ev.date);
      if (!ed) continue;
      var diff = ecDaysBetween_(today, ed);
      // only future events (0 = today) that are within the lead window
      if (diff >= 0 && diff <= EC_EARNINGS_LEAD_DAYS_V1000) {
        ev.daysAhead = diff;
        out.push(ev);
      }
    }
    Utilities.sleep(200); // gentle rate limit
  }
  return { events: out, errors: errors };
}

// ---- dedup via PropertiesService ----
function ecAlreadySentV1000_(tokenKey) {
  var p = PropertiesService.getScriptProperties();
  return p.getProperty('EC_SENT_' + tokenKey) === '1';
}

function ecMarkSentV1000_(tokenKey) {
  PropertiesService.getScriptProperties().setProperty('EC_SENT_' + tokenKey, '1');
}


// ---- main entry: check calendar and send LINE alerts ----
function ecCheckAndAlertV1000() {
  var lines = [];
  var todayStr = ecFmtDate_(ecTodayUtc_());

  // FOMC
  var fomc = ecUpcomingFomcV1000_();
  for (var i = 0; i < fomc.length; i++) {
    var f = fomc[i];
    var tok = 'FOMC_' + f.date + '_' + f.daysAhead;
    if (ecAlreadySentV1000_(tok)) continue;
    var when = f.daysAhead === 0 ? 'วันนี้' : ('อีก ' + f.daysAhead + ' วัน');
    lines.push('\uD83C\uDFE6 ประชุม Fed (FOMC): ' + f.date + ' (' + when + ') \u2014 อาจทำให้ตลาดผันผวน');
    ecMarkSentV1000_(tok);
  }

  // Earnings
  var er = ecUpcomingEarningsV1000_();
  for (var k = 0; k < er.events.length; k++) {
    var ev = er.events[k];
    var tok2 = 'EARN_' + ev.symbol + '_' + ev.date;
    if (ecAlreadySentV1000_(tok2)) continue;
    var when2 = ev.daysAhead === 0 ? 'วันนี้' : ('พรุ่งนี้');
    var est = (ev.epsEstimate != null) ? (' | EPS คาด ' + ev.epsEstimate) : '';
    lines.push('\uD83D\uDCC5 งบไตรมาส: ' + ev.symbol + ' ' + ev.date + ' (' + when2 + ')' + est);
    ecMarkSentV1000_(tok2);
  }

  if (!lines.length) {
    Logger.log('EconCalendar ' + todayStr + ': ไม่มีเหตุการณ์ที่ต้องแจ้งเตือนวันนี้' +
              (er.errors.length ? ' (errors: ' + er.errors.join(', ') + ')' : ''));
    return { sent: false, count: 0, errors: er.errors };
  }

  var header = '\uD83D\uDCCA ปฏิทินเศรษฐกิจ ' + todayStr + '\n';
  var msg = header + lines.join('\n');
  if (er.errors.length) msg += '\n(หมายเหตุ: ดึงข้อมูลบางตัวไม่ได้)';

  sendLine(msg);
  Logger.log(msg);
  return { sent: true, count: lines.length, errors: er.errors };
}

// ---- trigger setup (run once manually to schedule daily check) ----
function ecSetupDailyTriggerV1000() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'ecCheckAndAlertV1000') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  ScriptApp.newTrigger('ecCheckAndAlertV1000')
    .timeBased().everyDays(1).atHour(7).create();
  Logger.log('ตั้ง trigger รายวัน (07:00) สำหรับ ecCheckAndAlertV1000 เรียบร้อย');
}


// ---- tests / preview (no LINE send) ----
function ecTestFomcLogicV1000() {
  // Unit test: FOMC lead-day detection using a fixed 'today' vs a known date.
  var results = [];
  function chk(name, cond) { results.push((cond ? 'PASS' : 'FAIL') + ' - ' + name); }

  var a = ecParseDate_('2026-01-25');
  var b = ecParseDate_('2026-01-28');
  chk('3 days between 01-25 and 01-28', ecDaysBetween_(a, b) === 3);
  chk('parse returns UTC date', b.getUTCFullYear() === 2026 && b.getUTCMonth() === 0);
  chk('fmt roundtrip', ecFmtDate_(b) === '2026-01-28');
  chk('lead window contains 0,1,3', EC_FOMC_LEAD_DAYS_V1000.indexOf(3) !== -1 && EC_FOMC_LEAD_DAYS_V1000.indexOf(2) === -1);

  var log = results.join('\n');
  Logger.log(log);
  return log;
}

function ecPreviewEarningsV1000() {
  // Live preview of upcoming earnings (fetches Twelve Data) - does NOT send LINE.
  var er = ecUpcomingEarningsV1000_();
  var lines = er.events.map(function(ev){
    return ev.symbol + ' ' + ev.date + ' (อีก ' + ev.daysAhead + ' วัน)';
  });
  var out = 'Upcoming earnings (' + er.events.length + '):\n' + (lines.join('\n') || '(none)');
  if (er.errors.length) out += '\nerrors: ' + er.errors.join(', ');
  Logger.log(out);
  return out;
}

function ecPreviewFomcV1000() {
  // Preview which FOMC alerts would fire today - does NOT send LINE.
  var f = ecUpcomingFomcV1000_();
  var out = 'FOMC alerts today (' + f.length + '):\n' +
    (f.map(function(x){return x.date + ' (อีก ' + x.daysAhead + ' วัน)';}).join('\n') || '(none)');
  Logger.log(out);
  return out;
}

