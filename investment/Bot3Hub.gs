/**
 * Bot 3 Trade Hub V1
 * Shared Google Sheet queue for Grace, investment and Khao.
 * Configure the same BOT3_HUB_SHEET_ID in Script Properties for all projects.
 */
var BOT3_ROLE_V1 = 'investment';
var BOT3_HUB_PROP_V1 = 'BOT3_HUB_SHEET_ID';
var BOT3_HUB_JOBS_TAB_V1 = 'Jobs';
var BOT3_HUB_STATUS_TAB_V1 = 'Status';
var BOT3_HUB_HANDLER_V1 = 'bot3ProcessJobsV1';
var BOT3_HUB_HEADERS_V1 = [
  'group_id', 'job_id', 'created_at', 'target', 'action', 'symbol',
  'status', 'claimed_at', 'finished_at', 'result_text', 'error', 'notified'
];

function bot3CreateHubV1() {
  if (BOT3_ROLE_V1 !== 'investment') {
    throw new Error('ให้สร้าง Hub จากโปรเจกต์ investment เท่านั้น');
  }
  var ss = SpreadsheetApp.create('Bot 3 Trade Hub');
  bot3EnsureHubSheetsV1_(ss);
  PropertiesService.getScriptProperties().setProperty(BOT3_HUB_PROP_V1, ss.getId());
  return { spreadsheetId: ss.getId(), url: ss.getUrl(), role: BOT3_ROLE_V1 };
}

function bot3ConfigureHubV1(spreadsheetId) {
  var id = String(spreadsheetId || '').trim();
  if (!id) throw new Error('กรุณาใส่ Spreadsheet ID ของ Bot 3 Trade Hub');
  var ss = SpreadsheetApp.openById(id);
  bot3EnsureHubSheetsV1_(ss);
  PropertiesService.getScriptProperties().setProperty(BOT3_HUB_PROP_V1, id);
  return { ok: true, role: BOT3_ROLE_V1, spreadsheetId: id, url: ss.getUrl() };
}

function bot3AutoDiscoverHubV1() {
  var files = DriveApp.getFilesByName('Bot 3 Trade Hub');
  var selected = null;
  while (files.hasNext()) {
    var file = files.next();
    if (!selected || file.getLastUpdated().getTime() > selected.getLastUpdated().getTime()) {
      selected = file;
    }
  }
  if (!selected) throw new Error('ไม่พบ Google Sheet ชื่อ Bot 3 Trade Hub');
  return bot3ConfigureHubV1(selected.getId());
}

function bot3BootstrapV1() {
  var id = PropertiesService.getScriptProperties().getProperty(BOT3_HUB_PROP_V1);
  var hub;
  if (!id) {
    hub = BOT3_ROLE_V1 === 'investment' ? bot3CreateHubV1() : bot3AutoDiscoverHubV1();
  } else {
    hub = bot3ConfigureHubV1(id);
  }
  var worker = bot3InstallWorkerV1();
  var result = { ok: true, role: BOT3_ROLE_V1, hub: hub, worker: worker };
  Logger.log(JSON.stringify(result));
  return result;
}

function bot3InstallWorkerV1() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === BOT3_HUB_HANDLER_V1) ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger(BOT3_HUB_HANDLER_V1).timeBased().everyMinutes(5).create();
  return { ok: true, role: BOT3_ROLE_V1, everyMinutes: 5 };
}

function bot3QueueTeamReviewV1(symbol) {
  var clean = String(symbol || '').trim().toUpperCase().replace(/[^A-Z0-9.\-]/g, '');
  if (!clean) throw new Error('กรุณาใส่ ticker เช่น bot3QueueTeamReviewV1("NVDA")');
  var ss = bot3OpenHubV1_();
  var sh = bot3EnsureHubSheetsV1_(ss).jobs;
  var groupId = Utilities.getUuid();
  var now = new Date().toISOString();
  var jobs = [
    [groupId, Utilities.getUuid(), now, 'grace', 'ANALYZE_SYMBOL', clean, 'PENDING', '', '', '', '', ''],
    [groupId, Utilities.getUuid(), now, 'investment', 'PORTFOLIO_SYMBOL', clean, 'PENDING', '', '', '', '', ''],
    [groupId, Utilities.getUuid(), now, 'khao', 'NEWS_SYMBOL', clean, 'PENDING', '', '', '', '', '']
  ];
  sh.getRange(sh.getLastRow() + 1, 1, jobs.length, BOT3_HUB_HEADERS_V1.length).setValues(jobs);
  return { ok: true, groupId: groupId, symbol: clean, queued: jobs.length };
}

function bot3ProcessJobsV1() {
  var job = bot3ClaimJobV1_();
  if (!job) {
    bot3HeartbeatV1_('IDLE', '');
    bot3FinalizeReviewsV1_();
    return { ok: true, role: BOT3_ROLE_V1, status: 'IDLE' };
  }

  var result = '';
  var error = '';
  try {
    result = bot3ExecuteRoleJobV1_(job);
  } catch (err) {
    error = String(err && (err.stack || err.message) || err);
  }
  bot3FinishJobV1_(job.row, result, error);
  bot3HeartbeatV1_(error ? 'ERROR' : 'OK', job.jobId);
  bot3FinalizeReviewsV1_();
  return { ok: !error, role: BOT3_ROLE_V1, jobId: job.jobId, error: error };
}

function bot3ClaimJobV1_() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return null;
  try {
    var sh = bot3EnsureHubSheetsV1_(bot3OpenHubV1_()).jobs;
    if (sh.getLastRow() < 2) return null;
    var values = sh.getRange(2, 1, sh.getLastRow() - 1, BOT3_HUB_HEADERS_V1.length).getValues();
    for (var i = 0; i < values.length; i++) {
      if (String(values[i][3]).toLowerCase() !== BOT3_ROLE_V1) continue;
      if (String(values[i][6]).toUpperCase() !== 'PENDING') continue;
      var row = i + 2;
      var claimedAt = new Date().toISOString();
      sh.getRange(row, 7, 1, 2).setValues([['RUNNING', claimedAt]]);
      return {
        row: row,
        groupId: String(values[i][0]),
        jobId: String(values[i][1]),
        action: String(values[i][4]),
        symbol: String(values[i][5])
      };
    }
    return null;
  } finally {
    lock.releaseLock();
  }
}

function bot3FinishJobV1_(row, result, error) {
  var sh = bot3EnsureHubSheetsV1_(bot3OpenHubV1_()).jobs;
  var text = String(result == null ? '' : result);
  if (text.length > 45000) text = text.slice(0, 45000);
  var errText = String(error || '');
  if (errText.length > 5000) errText = errText.slice(0, 5000);
  sh.getRange(row, 7).setValue(errText ? 'ERROR' : 'DONE');
  sh.getRange(row, 9, 1, 3).setValues([[new Date().toISOString(), text, errText]]);
}

function bot3OpenHubV1_() {
  var id = PropertiesService.getScriptProperties().getProperty(BOT3_HUB_PROP_V1);
  if (!id) throw new Error('ยังไม่ได้ตั้ง BOT3_HUB_SHEET_ID');
  return SpreadsheetApp.openById(id);
}

function bot3EnsureHubSheetsV1_(ss) {
  var jobs = ss.getSheetByName(BOT3_HUB_JOBS_TAB_V1) || ss.insertSheet(BOT3_HUB_JOBS_TAB_V1);
  if (jobs.getLastRow() === 0) {
    jobs.getRange(1, 1, 1, BOT3_HUB_HEADERS_V1.length).setValues([BOT3_HUB_HEADERS_V1]);
    jobs.setFrozenRows(1);
  }
  var status = ss.getSheetByName(BOT3_HUB_STATUS_TAB_V1) || ss.insertSheet(BOT3_HUB_STATUS_TAB_V1);
  if (status.getLastRow() === 0) {
    status.getRange(1, 1, 1, 5).setValues([['role', 'state', 'last_job_id', 'updated_at', 'message']]);
    status.setFrozenRows(1);
  }
  return { jobs: jobs, status: status };
}

function bot3HeartbeatV1_(state, jobId) {
  var sh = bot3EnsureHubSheetsV1_(bot3OpenHubV1_()).status;
  var values = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, 5).getValues() : [];
  var row = 0;
  for (var i = 0; i < values.length; i++) {
    if (String(values[i][0]).toLowerCase() === BOT3_ROLE_V1) { row = i + 2; break; }
  }
  var data = [[BOT3_ROLE_V1, state, jobId || '', new Date().toISOString(), 'Bot 3 Trade Hub V1']];
  if (row) sh.getRange(row, 1, 1, 5).setValues(data);
  else sh.getRange(sh.getLastRow() + 1, 1, 1, 5).setValues(data);
}

function bot3CompactTextV1_(value) {
  var text = Array.isArray(value) ? value.join('\n') :
    (typeof value === 'string' ? value : JSON.stringify(value));
  return String(text || '').slice(0, 1200);
}

function bot3ExecuteRoleJobV1_(job) {
  if (job.action !== 'PORTFOLIO_SYMBOL') throw new Error('investment ไม่รองรับ action: ' + job.action);
  var holdings = getAllHoldingsV1_().filter(function(x) {
    return String(x.symbol || '').toUpperCase() === job.symbol;
  });
  var lines = ['💼 ตรวจพอร์ต ' + job.symbol];
  if (!holdings.length) {
    lines.push('• ไม่พบหุ้นนี้ในพอร์ตที่บันทึกไว้');
  } else {
    holdings.forEach(function(x) {
      lines.push('• พอร์ต: ' + String(x.portfolio || '-'));
      lines.push('• จำนวน: ' + Number(x.shares || 0).toFixed(6).replace(/0+$/, '').replace(/\.$/, '') + ' หุ้น');
      lines.push('• ต้นทุนเฉลี่ย: $' + Number(x.avgCost || 0).toFixed(2));
      lines.push('• เงินลงทุน: $' + Number(x.totalCost || 0).toFixed(2));
      if (x.lastUpdated) lines.push('• อัปเดตพอร์ตล่าสุด: ' + String(x.lastUpdated));
    });
  }
  lines.push('• ตรวจสอบเมื่อ: ' + new Date().toISOString());
  return bot3CompactTextV1_(lines);
}

function bot3FinalizeReviewsV1_() {
  var sh = bot3EnsureHubSheetsV1_(bot3OpenHubV1_()).jobs;
  if (sh.getLastRow() < 4) return;
  var values = sh.getRange(2, 1, sh.getLastRow() - 1, BOT3_HUB_HEADERS_V1.length).getValues();
  var groups = {};
  values.forEach(function(row, idx) {
    var id = String(row[0] || '');
    if (!id || String(row[11] || '')) return;
    if (!groups[id]) groups[id] = [];
    groups[id].push({ row: idx + 2, values: row });
  });

  Object.keys(groups).forEach(function(groupId) {
    var rows = groups[groupId];
    var targets = {};
    rows.forEach(function(x) { targets[String(x.values[3]).toLowerCase()] = x; });
    if (!targets.grace || !targets.investment || !targets.khao) return;
    var terminal = rows.every(function(x) {
      var s = String(x.values[6]).toUpperCase();
      return s === 'DONE' || s === 'ERROR';
    });
    if (!terminal) return;

    var symbol = String(rows[0].values[5] || '');
    var lines = ['🤝 Bot 3 Trade Team — ' + symbol, ''];
    ['grace', 'investment', 'khao'].forEach(function(role) {
      var row = targets[role].values;
      var label = role === 'grace' ? '📊 Grace' : (role === 'investment' ? '💼 investment' : '📰 Khao');
      lines.push(label);
      lines.push(String(row[6]).toUpperCase() === 'DONE' ? String(row[9] || '-').slice(0, 1200) : 'ERROR: ' + String(row[10] || '-').slice(0, 500));
      lines.push('');
    });
    lines.push('Group: ' + groupId);
    lines.push('ข้อมูลประกอบการตัดสินใจ ไม่ใช่คำแนะนำการลงทุน');
    sendManyLine([lines.join('\n')]);
    rows.forEach(function(x) { sh.getRange(x.row, 12).setValue(new Date().toISOString()); });
  });
}
