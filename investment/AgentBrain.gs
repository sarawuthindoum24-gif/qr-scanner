/*
 * AgentBrain.gs — AI Agentic loop (NVIDIA LLM, OpenAI-compatible)
 * ----------------------------------------------------------------------
 * รับข้อความภาษาธรรมชาติ -> LLM เลือก tool (จาก AgentTools) -> เรียก tool -> ตอบ
 * - Read-only tools: เรียกได้เอง
 * - Write tools: ต้องให้ผู้ใช้ยืนยันก่อน (คืนข้อความขอ confirm ไม่ execute)
 * - Memory: เก็บบทสนทนาล่าสุดต่อ user ใน Script Properties
 *
 * ใช้ NVIDIA_API_KEY + NVIDIA_MODEL (Script Properties) — ไม่แตะค่าคีย์
 * DISCLAIMER: ข้อมูลประกอบ ไม่ใช่คำแนะนำการลงทุน
 */

var AGENT_NVIDIA_ENDPOINT_V1 = 'https://integrate.api.nvidia.com/v1/chat/completions';
var AGENT_DEFAULT_MODEL_V1 = 'meta/llama-3.1-70b-instruct';
var AGENT_MEMORY_MAX_V1 = 6; // จำนวน turn ล่าสุดที่เก็บ

/* ---------- LLM call ---------- */

function callAgentLlmV1_(messages) {
  var props = PropertiesService.getScriptProperties();
  var key = props.getProperty('NVIDIA_API_KEY');
  if (!key) throw new Error('ยังไม่ได้ตั้งค่า NVIDIA_API_KEY');
  var model = props.getProperty('NVIDIA_MODEL') || AGENT_DEFAULT_MODEL_V1;

  var payload = { model: model, messages: messages, temperature: 0.2, max_tokens: 700 };
  var res = UrlFetchApp.fetch(AGENT_NVIDIA_ENDPOINT_V1, {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + key },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
  var code = res.getResponseCode();
  var body = res.getContentText();
  if (code < 200 || code >= 300) throw new Error('LLM error ' + code + ': ' + body.slice(0, 200));
  var data = JSON.parse(body);
  return data && data.choices && data.choices[0] && data.choices[0].message
    ? data.choices[0].message.content : '';
}

/* ---------- System prompt (tool router) ---------- */

function buildAgentSystemPromptV1_() {
  return [
    'คุณคือผู้ช่วยพอร์ตลงทุนภาษาไทยของแอป Stockify ตอบสั้น กระชับ เป็นกันเอง',
    'คุณมีเครื่องมือ (tools) ต่อไปนี้:',
    '',
    buildToolsSchemaTextV1_(),
    '',
    'กติกา:',
    '1) ถ้าต้องใช้ tool ให้ตอบเป็น JSON บรรทัดเดียวเท่านั้น: {"tool":"ชื่อ","args":{...}}',
    '2) ถ้าตอบผู้ใช้ได้เลยโดยไม่ต้องใช้ tool ให้ตอบเป็น JSON: {"reply":"ข้อความ"}',
    '3) tool ที่มี [ต้องยืนยัน] ห้ามสั่งทำทันที ให้เลือก tool คำนวณ/แสดงผลก่อน แล้วให้ผู้ใช้ยืนยันเอง',
    '4) ห้ามแต่งตัวเลขพอร์ตเอง ต้องเรียก get_portfolio หรือ compute_average_down เพื่อดูข้อมูลจริง',
    '5) ทุกคำแนะนำการลงทุน ให้ปิดท้ายว่าเป็นข้อมูลประกอบ ไม่ใช่คำแนะนำการลงทุน',
    'ตอบ JSON เท่านั้น ห้ามมีข้อความอื่นนอก JSON'
  ].join('\n');
}

/* ---------- Memory ---------- */

function getAgentMemoryV1_(userId) {
  var raw = PropertiesService.getScriptProperties().getProperty('AGENT_MEM_' + userId);
  if (!raw) return [];
  try { return JSON.parse(raw); } catch (e) { return []; }
}
function pushAgentMemoryV1_(userId, role, content) {
  var mem = getAgentMemoryV1_(userId);
  mem.push({ role: role, content: String(content).slice(0, 800) });
  while (mem.length > AGENT_MEMORY_MAX_V1 * 2) mem.shift();
  PropertiesService.getScriptProperties().setProperty('AGENT_MEM_' + userId, JSON.stringify(mem));
}

/* ---------- Main agent entry ---------- */

// คืน string ข้อความตอบกลับสำหรับ LINE
function runAgentV1_(userText, userId) {
  userId = userId || 'default';

  // 1) ก่อนเข้า LLM: จับ deterministic commands ที่แม่นกว่า (ถัวต้นทุน / บันทึกถัว)
  var saveReply = handleSaveAverageDownReplyV1_(userText);
  if (saveReply) { pushAgentMemoryV1_(userId, 'user', userText); return saveReply; }
  var avgReply = handleAverageDownCommandV1_(userText);
  if (avgReply) { pushAgentMemoryV1_(userId, 'user', userText); return avgReply; }

  // Option C: set-cost confirm (must precede preview) then preview
  var setCostReply = (typeof handleSetCostReplyV1_ === 'function') ? handleSetCostReplyV1_(userText) : null;
  if (setCostReply) { pushAgentMemoryV1_(userId, 'user', userText); return setCostReply; }
  var setCostPreview = (typeof handleSetCostCommandV1_ === 'function') ? handleSetCostCommandV1_(userText) : null;
  if (setCostPreview) { pushAgentMemoryV1_(userId, 'user', userText); return setCostPreview; }

  // Read-only: portfolio summary command
  var summaryReply = (typeof handlePortfolioSummaryCommandV1_ === 'function') ? handlePortfolioSummaryCommandV1_(userText) : null;
  if (summaryReply) { pushAgentMemoryV1_(userId, 'user', userText); return summaryReply; }

  // 2) เข้า LLM ให้เลือก tool
  var messages = [{ role: 'system', content: buildAgentSystemPromptV1_() }];
  getAgentMemoryV1_(userId).forEach(function (m) { messages.push(m); });
  messages.push({ role: 'user', content: userText });

  var raw;
  try { raw = callAgentLlmV1_(messages); }
  catch (e) { return 'ขออภัย ระบบ AI ขัดข้องชั่วคราว: ' + e.message; }

  var decision = safeParseAgentJsonV1_(raw);
  pushAgentMemoryV1_(userId, 'user', userText);

  // ตอบตรงๆ
  if (decision && decision.reply) {
    pushAgentMemoryV1_(userId, 'assistant', decision.reply);
    return decision.reply;
  }

  // เรียก tool
  if (decision && decision.tool) {
    var tool = getAgentToolByNameV1_(decision.tool);
    if (!tool) return 'ขออภัย ไม่พบเครื่องมือ "' + decision.tool + '"';

    // WRITE tool -> ไม่ execute ขอยืนยันก่อน
    if (!tool.readonly) {
      var confirmMsg = buildToolConfirmMessageV1_(tool, decision.args || {});
      pushAgentMemoryV1_(userId, 'assistant', confirmMsg);
      return confirmMsg;
    }

    // READ-ONLY tool -> execute แล้วให้ LLM สรุปผลเป็นภาษาคน
    var result;
    try { result = tool.run(decision.args || {}); }
    catch (e) { return 'เรียกใช้ ' + tool.name + ' ไม่สำเร็จ: ' + e.message; }

    var summary = summarizeToolResultV1_(userText, tool, result);
    pushAgentMemoryV1_(userId, 'assistant', summary);
    return summary;
  }

  // parse ไม่ได้ -> คืน raw (ตัด JSON ที่พัง)
  var fallback = raw && raw.length ? raw : 'ขออภัย ไม่เข้าใจคำถาม ลองถามใหม่ได้ครับ';
  return fallback;
}

function safeParseAgentJsonV1_(raw) {
  if (!raw) return null;
  var s = String(raw).trim();
  var a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a === -1 || b === -1) return null;
  try { return JSON.parse(s.slice(a, b + 1)); } catch (e) { return null; }
}

function buildToolConfirmMessageV1_(tool, args) {
  if (tool.name === 'save_average_down') {
    return '⚠️ ยืนยันบันทึกถัวต้นทุนลงพอร์ต\n' +
      'หุ้น: ' + (args.symbol || '?') + (args.portfolio ? ' [' + args.portfolio + ']' : '') + '\n' +
      'ราคา: ' + (args.price || '?') + ' | จำนวน: ' +
      (args.addShares ? args.addShares + ' หุ้น' : (args.addAmountTHB ? args.addAmountTHB + ' บาท' : (args.addAmountUSD ? '$' + args.addAmountUSD : '?'))) + '\n' +
      'พิมพ์ "บันทึกถัว ' + (args.symbol || '') + (args.portfolio ? ' ' + args.portfolio : '') +
      ' ' + (args.addAmountTHB ? args.addAmountTHB + ' บาท' : (args.addShares ? args.addShares + ' หุ้น' : '')) +
      ' ที่ ' + (args.price || '') + '" เพื่อยืนยัน';
  }
  return 'การกระทำนี้ต้องยืนยัน พิมพ์ยืนยันเพื่อดำเนินการต่อครับ';
}

function summarizeToolResultV1_(userText, tool, result) {
  // ให้ LLM แปลงผล JSON เป็นภาษาคน
  var messages = [
    { role: 'system', content: 'สรุปผลข้อมูลการลงทุนเป็นภาษาไทย สั้น กระชับ อ่านง่าย. กติกาเข้ม: ใช้เฉพาะตัวเลขจากข้อมูลที่ให้ ห้ามคำนวณ/นับ/เดาเอง. ตัวเลขในฟิลด์ totalCost คือ "ต้นทุนรวม (USD)" ไม่ใช่มูลค่าตลาด. ถ้าจะนับจำนวนหุ้นในพอร์ต ให้นับจากจำนวน item จริงเท่านั้น. ปิดท้ายว่าเป็นข้อมูลประกอบ ไม่ใช่คำแนะนำการลงทุน' },
    { role: 'user', content: 'คำถาม: ' + userText + '\n\nผลจากเครื่องมือ ' + tool.name + ':\n' + JSON.stringify(result).slice(0, 3000) }
  ];
  try { return callAgentLlmV1_(messages); }
  catch (e) { return JSON.stringify(result, null, 2); }
}

