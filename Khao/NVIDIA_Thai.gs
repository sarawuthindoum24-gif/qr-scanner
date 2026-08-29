/**
 * Khao NVIDIA Thai News V14.1
 * Primary AI: NVIDIA NIM nvidia/llama-3.3-nemotron-super-49b-v1.5
 * Script Properties: NVIDIA_API_KEY, NVIDIA_MODEL
 */
var KHAO_NVIDIA_VERSION_V1400 = '14.1-nvidia-nemotron-thai';
var NVIDIA_CHAT_URL_V1400 = 'https://integrate.api.nvidia.com/v1/chat/completions';
var KHAO_NVIDIA_HANDLER_V1400 = 'dailyPortfolioReportNvidiaThaiV1400';

function callNvidiaKimiV1400_(messages, maxTokens) {
  var props = PropertiesService.getScriptProperties();
  var apiKey = String(props.getProperty('NVIDIA_API_KEY') || '').trim();
  var model = String(props.getProperty('NVIDIA_MODEL') || 'moonshotai/kimi-k2.6').trim();
  if (!apiKey) throw new Error('Missing Script Property: NVIDIA_API_KEY');

  var payload = {
    model: model,
    messages: messages,
    max_tokens: maxTokens || 3500,
    temperature: 0.2,
    top_p: 0.9,
    stream: false,
    chat_template_kwargs: { thinking: false }
  };

  var response = UrlFetchApp.fetch(NVIDIA_CHAT_URL_V1400, {
    method: 'post',
    contentType: 'application/json',
    headers: {
      Authorization: 'Bearer ' + apiKey,
      Accept: 'application/json'
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  var status = response.getResponseCode();
  var body = response.getContentText();
  Logger.log('NVIDIA AI HTTP ' + status);
  if (status < 200 || status >= 300) {
    throw new Error('NVIDIA API HTTP ' + status + ': ' + body.slice(0, 500));
  }

  var json = JSON.parse(body);
  var text = json && json.choices && json.choices[0] &&
    json.choices[0].message && json.choices[0].message.content;
  text = String(text || '').trim();
  if (!text) throw new Error('NVIDIA API returned empty content');
  return text;
}

function translateKhaoReportThaiNvidiaV1400(reportText) {
  var source = String(reportText || '').trim();
  if (!source) return source;

  var cache = CacheService.getScriptCache();
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, source);
  var key = 'KHAO_TH_' + Utilities.base64EncodeWebSafe(digest).slice(0, 40);
  var cached = cache.get(key);
  if (cached) return cached;

  var systemPrompt = [
    'คุณเป็นบรรณาธิการข่าวหุ้นภาษาไทยสำหรับนักลงทุนไทย',
    'แปลและเรียบเรียงรายงานที่ได้รับเป็นภาษาไทยธรรมชาติ กระชับ และเป็นกลาง',
    'ห้ามเพิ่มข้อเท็จจริง คำแนะนำซื้อขาย ราคาเป้าหมาย หรือข่าวที่ไม่มีในต้นฉบับ',
    'คง ticker เช่น NVDA, AAPL, SET, ตัวเลข วันที่ เวลา สกุลเงิน URL และชื่อแหล่งข่าวไว้',
    'ห้ามแปลหรือแก้ URL',
    'รักษาลำดับ หัวข้อ bullet emoji และโครงสร้างเดิม',
    'ถ้ามีข้อความภาษาไทยอยู่แล้วให้เกลาเฉพาะที่จำเป็น',
    'ส่งคืนเฉพาะรายงานฉบับภาษาไทย ไม่ใส่คำอธิบายเพิ่มเติม'
  ].join('\n');

  var translated = callNvidiaKimiV1400_([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: source }
  ], 3500);

  if (!/[ก-๙]/.test(translated)) {
    throw new Error('NVIDIA translation did not contain Thai text');
  }
  cache.put(key, translated, 21600);
  return translated;
}

function dailyPortfolioReportNvidiaThaiV1400() {
  var raw = buildNewsBuy3ReportV748();
  var thai;
  try {
    thai = translateKhaoReportThaiNvidiaV1400(raw);
  } catch (err) {
    Logger.log('NVIDIA fallback: ' + err.message);
    thai = LanguageApp.translate(String(raw || ''), '', 'th');
  }
  sendManyLine([thai]);
  return {
    ok: true,
    provider: 'NVIDIA',
    model: PropertiesService.getScriptProperties().getProperty('NVIDIA_MODEL') || 'moonshotai/kimi-k2.6',
    version: KHAO_NVIDIA_VERSION_V1400
  };
}

function testNvidiaKimiThaiV1400() {
  var out = callNvidiaKimiV1400_([
    {
      role: 'system',
      content: 'แปลข่าวหุ้นเป็นภาษาไทย กระชับ คง ticker ตัวเลขและชื่อบริษัท ส่งเฉพาะคำแปล'
    },
    {
      role: 'user',
      content: 'NVIDIA shares rose after the company announced stronger data-center demand.'
    }
  ], 250);
  if (!/[ก-๙]/.test(out)) throw new Error('Test output is not Thai: ' + out);
  Logger.log('NVIDIA Nemotron Thai OK: ' + out);
  return out;
}

function setupKhaoNvidiaThaiScheduleV1400() {
  var handlers = ['dailyPortfolioReportV748', KHAO_NVIDIA_HANDLER_V1400];
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (handlers.indexOf(t.getHandlerFunction()) >= 0) ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger(KHAO_NVIDIA_HANDLER_V1400)
    .timeBased().atHour(10).nearMinute(0).everyDays(1).inTimezone('Asia/Bangkok').create();
  ScriptApp.newTrigger(KHAO_NVIDIA_HANDLER_V1400)
    .timeBased().atHour(19).nearMinute(30).everyDays(1).inTimezone('Asia/Bangkok').create();
  PropertiesService.getScriptProperties().setProperty(
    'KHAO_NEWS_SCHEDULE',
    '10:00,19:30 Asia/Bangkok | NVIDIA Nemotron | Thai'
  );
  return getKhaoNvidiaThaiStatusV1400();
}

function getKhaoNvidiaThaiStatusV1400() {
  var triggers = ScriptApp.getProjectTriggers().filter(function(t) {
    return t.getHandlerFunction() === KHAO_NVIDIA_HANDLER_V1400;
  });
  var result = {
    version: KHAO_NVIDIA_VERSION_V1400,
    model: PropertiesService.getScriptProperties().getProperty('NVIDIA_MODEL') || '',
    keyConfigured: !!PropertiesService.getScriptProperties().getProperty('NVIDIA_API_KEY'),
    triggerCount: triggers.length,
    handler: KHAO_NVIDIA_HANDLER_V1400,
    schedule: PropertiesService.getScriptProperties().getProperty('KHAO_NEWS_SCHEDULE') || ''
  };
  Logger.log(JSON.stringify(result));
  return result;
}

