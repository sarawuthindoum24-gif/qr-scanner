# Realtime & Runtime Audit

ตรวจ source และประวัติการทำงานวันที่ 29 สิงหาคม 2026

## สรุป

| ส่วนข้อมูล | แหล่งข้อมูล | ความถี่/ความละเอียด | ข้อสรุป |
|---|---|---|---|
| Buy Alert | Yahoo Chart `range=1d&interval=1m&includePrePost=true` | แท่ง 1 นาทีเมื่อ trigger เรียก | Near-real-time ไม่ใช่ streaming |
| Buy Alert fallback | Twelve Data quote, Finnhub quote | quote ตอนเรียก API | Near-real-time ขึ้นกับแพ็กเกจ/ข้อจำกัดผู้ให้บริการ |
| Technical scan | Yahoo Chart รายวัน 8–12 เดือน | แท่ง 1 วัน | ไม่ใช่ realtime |
| Webull snapshot | Webull OpenAPI | snapshot ตอนเรียก | มีโค้ดรองรับ แต่ต้องมี credentials จริงและยังไม่มี execution proof |
| ข่าว | Yahoo/Google/Investing RSS, Finnhub company news | ตามรอบ feed และ cache | ไม่ใช่ realtime; RSS/ผู้ให้บริการอาจหน่วง |
| ข่าว Khao cache | CacheService | สดไม่เกิน 30 นาที | near-live สำหรับข่าว ไม่ใช่ tick data |
| USD/THB | Yahoo `THB=X` รายวัน | ล่าสุดจาก daily chart | ไม่ใช่ FX streaming |
| Earnings/FOMC | Twelve Data/Finnhub + วันที่ FOMC ในโค้ด | รายวัน/ตาม trigger | ปฏิทิน ไม่ใช่ realtime |

## หลักฐานการรัน

- investment: `checkBuyAlertsTriggerV1000` ทำงานทุก 5 นาที และรายการล่าสุดวันที่ 29 ส.ค. 2026 สำเร็จต่อเนื่อง
- Grace: เปิดใช้งาน worker แล้ว และ smoke test วันที่ 30 ส.ค. 2026 ประมวลผล NVDA สำเร็จจาก Yahoo ภายในประมาณ 3 วินาที
- Khao: `dailyPortfolioReportNvidiaThaiV1400` ทำงานวันละ 2 รอบ; หลายรอบสำเร็จ แต่บางรอบหมดเวลาที่ประมาณ 360 วินาที
- แก้ source Khao ให้ดึง Yahoo หลาย ticker ด้วย `UrlFetchApp.fetchAll` และ fallback เฉพาะ ticker ที่ล้มเหลว เพื่อลดเวลาและ quota
- ลบ Webull test app key/secret ที่ฝังใน source ของ investment แล้ว; ต้องใช้ Script Properties เท่านั้น
- Smoke test `team NVDA` วันที่ 30 ส.ค. 2026: Grace, investment และ Khao จบสถานะ `DONE` ครบ ไม่มี error และ investment ทำเครื่องหมาย `notified` ครบทั้งกลุ่ม
- ราคาที่ Grace ใช้ในการทดสอบมาจาก Yahoo Chart แบบเรียกตามรอบ จึงเป็น near-real-time/polling ไม่ใช่ tick streaming
- Smoke test V15 ยืนยันว่า investment และ Khao ส่งผลเป็นข้อความภาษาไทยอ่านง่ายแทน JSON และทั้งกลุ่มทำเครื่องหมาย `notified` สำเร็จ

## ข้อจำกัดสำคัญ

คำว่า `last` หรือ `live price` ในโค้ดไม่ได้รับประกันข้อมูลแบบตลาดหลักทรัพย์ระดับ tick. ความสดจริงขึ้นกับเวลาตลาด, สิทธิ์ API, แพ็กเกจ, pre/after-market และการหน่วงของผู้ให้บริการ ควรตรวจราคากับโบรกเกอร์ก่อนซื้อทุกครั้ง

