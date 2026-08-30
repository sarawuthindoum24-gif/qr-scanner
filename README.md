# Bot 3 Trade

ชุด source จาก Google Apps Script 3 โปรเจกต์ โดยแยกความรับผิดชอบและเชื่อมกันผ่าน Shared Google Sheet Queue

| Bot | หน้าที่หลัก | Project ID |
|---|---|---|
| Grace | วิเคราะห์ราคา เทคนิค RSI/MACD แนวรับ และจังหวะซื้อ | `1i16mfeDICEzax02EyxQl08SoQ3vPjyvtLVlDZhGEbzmEdirYZ7YGp-8a` |
| investment | พอร์ต ต้นทุน ถัวเฉลี่ย และ Buy Alert | `1e9SXgXbSD5vDlvaR5DrKIaVbr_RHWuLg8NqSjP3IEXEn7KOJJ_pjva8z` |
| Khao | ข่าวหุ้น ปฏิทินเศรษฐกิจ และสรุปภาษาไทย | `1qJFtazGPl-cXYQxyaHJflI0iK3OXAa1qCOqzIT8hIl7BpPXfdb56ioRU` |

## การเชื่อมทั้ง 3 บอท

ไฟล์ `Bot3Hub.gs` ในแต่ละโปรเจกต์ใช้ Google Sheet เดียวกันเป็นคิวกลาง

1. ในโปรเจกต์ investment เรียก `bot3CreateHubV1()` หนึ่งครั้ง
2. นำ `spreadsheetId` ที่ได้ไปเรียก `bot3ConfigureHubV1("SPREADSHEET_ID")` ใน Grace และ Khao
3. เรียก `bot3InstallWorkerV1()` ในทั้งสามโปรเจกต์
4. สั่งรีวิวร่วมด้วย `bot3QueueTeamReviewV1("NVDA")`
5. Grace วิเคราะห์หุ้น, investment ตรวจพอร์ต, Khao ตรวจข่าว และ investment รวมผลส่ง LINE

บอทไม่ส่งคำสั่งซื้อขายอัตโนมัติ

## สถานะใช้งานจริง (30 สิงหาคม 2026)

- Deploy รุ่นใช้งานจริงโดยรักษา LINE webhook URL เดิม: Grace V14, investment V15 และ Khao V15
- สร้าง Shared Google Sheet `Bot 3 Trade Hub` และติดตั้ง worker trigger ทุก 5 นาทีครบทั้งสามโปรเจกต์
- Smoke test `team NVDA` สำเร็จ: Grace, investment และ Khao เป็น `DONE` ครบ และ investment รวมผลพร้อมทำเครื่องหมาย `notified`
- Grace ใช้ Yahoo สร้างรายงานเทคนิค, investment พบ NVDA ในพอร์ต Dime และ Khao ตรวจ News Gate สำเร็จ

## Secrets

ห้าม commit ค่า `LINE_TOKEN`, `LINE_USER_ID`, `TWELVE_DATA_API_KEY`, `FINNHUB_API_KEY`, `OPENROUTER_API_KEY`, `NVIDIA_API_KEY`, `WEBULL_APP_KEY`, `WEBULL_APP_SECRET` หรือ `WEBULL_ACCESS_TOKEN` ให้เก็บใน Apps Script Properties เท่านั้น

ดูผลตรวจละเอียดที่ [REALTIME_AUDIT.md](REALTIME_AUDIT.md)

