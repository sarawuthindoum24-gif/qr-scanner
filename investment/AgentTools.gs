/*
 * AgentTools.gs — Tool registry for the AI Agentic layer
 * ----------------------------------------------------------------------
 * ห่อฟังก์ชันที่มีอยู่ในโปรเจกต์ให้เป็น "tools" ที่ LLM เลือกเรียกได้
 * - readonly: true  -> agent เรียกได้เอง (ดึงข้อมูล)
 * - readonly: false -> ต้องให้ผู้ใช้ยืนยันก่อน (เขียนข้อมูล/สร้าง alert)
 *
 * แต่ละ tool: { name, description, readonly, params, run(args) }
 */

function getAgentToolsV1_() {
  return [
    /* ---------- READ-ONLY TOOLS ---------- */
    {
      name: 'get_portfolio',
      description: 'ดูพอร์ตการลงทุนทั้งหมดของผู้ใช้ (symbol, พอร์ต, จำนวนหุ้น, ต้นทุนเฉลี่ย, ต้นทุนรวม). ใช้เมื่อผู้ใช้ถามเรื่องพอร์ต/หุ้นที่ถืออยู่/ต้นทุน',
      readonly: true,
      params: { portfolio: 'ชื่อพอร์ต (ETF/Dime/Hundred) หรือเว้นว่างเพื่อดูทั้งหมด' },
      run: function (args) {
        var all = getAllHoldingsV1_();
        if (args && args.portfolio) {
          var p = String(args.portfolio).toLowerCase();
          all = all.filter(function (h) { return h.portfolio.toLowerCase() === p; });
        }
        return all.map(function (h) {
          return { symbol: h.symbol, portfolio: h.portfolio, shares: h.shares, avgCost: h.avgCost, totalCost: h.totalCost };
        });
      }
    },
    {
      name: 'compute_average_down',
      description: 'คำนวณต้นทุนเฉลี่ยใหม่เมื่อจะซื้อหุ้นเพิ่ม (ถัวต้นทุน). รับ symbol, ราคาที่จะซื้อ, และจำนวน (เป็นหุ้น หรือ เงิน USD/THB). ไม่บันทึกลงพอร์ต แค่คำนวณให้ดู',
      readonly: true,
      params: {
        symbol: 'ชื่อหุ้น เช่น NVDA',
        portfolio: 'พอร์ต (ระบุถ้าหุ้นอยู่หลายพอร์ต)',
        price: 'ราคาที่จะซื้อเพิ่ม (USD)',
        addShares: 'จำนวนหุ้นที่จะซื้อเพิ่ม (ถ้ากรอกเป็นหุ้น)',
        addAmountUSD: 'จำนวนเงิน USD (ถ้ากรอกเป็นดอลลาร์)',
        addAmountTHB: 'จำนวนเงินบาท (ถ้ากรอกเป็นบาท)'
      },
      run: function (args) {
        var addAmountUSD = args.addAmountUSD != null ? Number(args.addAmountUSD) : null;
        var fx = null;
        if (addAmountUSD == null && args.addAmountTHB != null) {
          fx = getUsdThbRateV1_();
          addAmountUSD = Number(args.addAmountTHB) / fx;
        }
        var matches = findHoldingV1_(args.symbol, args.portfolio);
        if (matches.length > 1) {
          return { needPortfolio: true, portfolios: matches.map(function (h) { return h.portfolio; }) };
        }
        var current = matches.length ? matches[0] : { shares: 0, avgCost: 0, portfolio: args.portfolio || '-' };
        var calc = computeAverageDownV1_(current, {
          price: Number(args.price),
          addShares: args.addShares != null ? Number(args.addShares) : null,
          addAmountUSD: addAmountUSD
        });
        calc.fxUsed = fx;
        calc.symbol = String(args.symbol).toUpperCase();
        calc.portfolio = current.portfolio;
        return calc;
      }
    },
    {
      name: 'analyze_symbol',
      description: 'วิเคราะห์หุ้นรายตัว (เทคนิคอล + แผนซื้อ) เช่นเมื่อผู้ใช้ถามว่า "วิเคราะห์ NVDA" หรือ "ควรซื้อ AMD ไหม"',
      readonly: true,
      params: { symbol: 'ชื่อหุ้น เช่น NVDA' },
      run: function (args) {
        var sym = normalizeInputSymbolV748_ ? normalizeInputSymbolV748_(args.symbol) : String(args.symbol).toUpperCase();
        // ใช้ pipeline วิเคราะห์เดิมถ้ามี
        if (typeof buildSymbolDecisionV748_ === 'function' && typeof fetchTechnicalDataV748_ === 'function') {
          try {
            var tech = fetchTechnicalDataV748_(sym);
            var decision = buildSymbolDecisionV748_(sym, tech);
            return { symbol: sym, decision: decision };
          } catch (e) {
            return { symbol: sym, error: 'วิเคราะห์ไม่สำเร็จ: ' + e.message };
          }
        }
        return { symbol: sym, note: 'ระบบวิเคราะห์เดิมไม่พร้อมใช้งาน' };
      }
    },
    {
      name: 'get_economic_calendar',
      description: 'ดึงปฏิทินเศรษฐกิจ/ข่าว FED/ข่าวตลาดล่าสุด ใช้เมื่อผู้ใช้ถามเรื่องข่าว เศรษฐกิจ ปฏิทิน หรือเหตุการณ์สำคัญ',
      readonly: true,
      params: {},
      run: function () {
        if (typeof ecMarketDashboard === 'function') {
          try { return { ok: true, ran: 'ecMarketDashboard' }; } catch (e) { return { error: e.message }; }
        }
        return { note: 'ระบบข่าวเดิมไม่พร้อมใช้งาน' };
      }
    },

    /* ---------- WRITE TOOLS (require confirm) ---------- */
    {
      name: 'save_average_down',
      description: 'บันทึกผลถัวต้นทุนลงพอร์ตจริง (อัปเดตจำนวนหุ้น + ต้นทุนเฉลี่ยใหม่). ต้องให้ผู้ใช้ยืนยันก่อนเสมอ',
      readonly: false,
      params: {
        symbol: 'ชื่อหุ้น', portfolio: 'พอร์ต',
        price: 'ราคาซื้อเพิ่ม', addShares: 'จำนวนหุ้นเพิ่ม', addAmountUSD: 'เงิน USD', addAmountTHB: 'เงินบาท'
      },
      run: function (args) {
        return saveAverageDownV1_(args);
      }
    }
  ];
}

function getAgentToolByNameV1_(name) {
  var tools = getAgentToolsV1_();
  for (var i = 0; i < tools.length; i++) if (tools[i].name === name) return tools[i];
  return null;
}

// สรุป schema ของ tools สำหรับส่งให้ LLM
function buildToolsSchemaTextV1_() {
  return getAgentToolsV1_().map(function (t) {
    var ps = Object.keys(t.params || {}).map(function (k) { return '    - ' + k + ': ' + t.params[k]; }).join('\n');
    return '• ' + t.name + (t.readonly ? '' : ' [ต้องยืนยัน]') + '\n  ' + t.description + (ps ? '\n' + ps : '');
  }).join('\n\n');
}

