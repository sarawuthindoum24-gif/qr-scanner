# investment

Google Apps Script สำหรับพอร์ต ต้นทุน ถัวเฉลี่ย Buy Alert และตรวจราคาแบบ near-real-time

- Buy Alert ใช้ Yahoo 1 นาที แล้ว fallback Twelve Data/Finnhub
- Trigger `checkBuyAlertsTriggerV1000` ทำงานทุก 5 นาที
- Integration: `Bot3Hub.gs` เป็นตัวสร้าง Hub และรวมผลจากทั้งสามบอท
- ไม่มี Auto Order
- Webull credentials ต้องอยู่ใน Script Properties เท่านั้น

